import { describe, expect, it } from "vitest";

import {
  astrologyLocalTimeResolutionRequestSchemaVersion,
  astrologyLocationSearchRequestSchemaVersion,
  createAstrologyLocationTimeZoneAdapterV1,
  type AstrologyLocationProviderV1,
} from "@rituvia/divination";

import {
  createWebAstrologyLocationSearchCacheKey,
  createWebAstrologyLocationTimeZoneService,
  loadWebNodeIntlTimeZoneRuntimeV1,
  webAstrologyTimeZoneRuntimePin,
} from "../server/astrology-location-time-zone";

const cacheSecret = "test-only-private-cache-secret-32-bytes";

const descriptor = (dataVersion = "fixture-2026-07-26") => ({
  adapterVersion: "1.0.0",
  attributionRequired: true,
  attributionText: "GeoNames",
  dataSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  dataVersion,
  licenseId: "CC-BY-4.0",
  privateSearchCacheTtlSeconds: 60,
  providerId: "geonames.gazetteer",
  providerVersion: "1.0.0",
  sourceUrl: "https://download.geonames.org/export/dump/",
});

const newYork = {
  admin1Code: "NY",
  countryCode: "US",
  displayName: "New York City, New York, United States",
  latitudeE6: 40_714_300,
  locationId: "geonames:5128581",
  longitudeE6: -74_006_000,
  rank: 1,
  timeZoneConfidence: "provider_assigned",
  timeZoneId: "America/New_York",
  timeZoneSource: "geonames.timezone",
};

const provider = (
  dataVersion = "fixture-2026-07-26",
  searchImplementation?: AstrologyLocationProviderV1["search"],
): AstrologyLocationProviderV1 => ({
  descriptor: descriptor(dataVersion),
  async readLocation(locationId) {
    return locationId === newYork.locationId ? newYork : null;
  },
  search:
    searchImplementation ??
    (async () => {
      return [newYork];
    }),
});

const searchRequest = (query: string) => ({
  limit: 5,
  locale: "en",
  query,
  schemaVersion: astrologyLocationSearchRequestSchemaVersion,
});

describe("web astrology location and historical time-zone boundary", () => {
  it("exposes exact Node, ICU, and tzdata versions with reproducible DST behavior", async () => {
    expect(webAstrologyTimeZoneRuntimePin).toEqual({
      icuVersion: "78.3",
      runtimeVersion: "24.18.0",
      timeZoneDataVersion: "2026b",
    });
    const runtime = loadWebNodeIntlTimeZoneRuntimeV1();
    expect(runtime.metadata).toEqual({
      icuVersion: process.versions.icu,
      runtimeId: "node_intl",
      runtimeVersion: process.versions.node,
      timeZoneDataVersion: process.versions.tz,
    });

    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);
    await expect(adapter.readLocation(newYork.locationId)).resolves.toMatchObject({
      queryIncluded: false,
      schemaVersion: "astrology-location-selection-result.v1",
      selectedLocation: { locationId: newYork.locationId },
    });
    await expect(
      adapter.resolve({
        disambiguation: null,
        localDate: "2024-11-03",
        localTime: "01:30",
        locationId: newYork.locationId,
        schemaVersion: astrologyLocalTimeResolutionRequestSchemaVersion,
      }),
    ).resolves.toMatchObject({
      candidateInstants: [
        { utcInstant: "2024-11-03T05:30:00.000Z" },
        { utcInstant: "2024-11-03T06:30:00.000Z" },
      ],
      status: "ambiguous_local_time",
    });
  });

  it("uses an HMAC-only cache key partitioned by provider and data version", () => {
    const value = searchRequest("private-canary-place");
    const firstAdapter = createAstrologyLocationTimeZoneAdapterV1(
      provider("fixture-2026-07-26"),
      loadWebNodeIntlTimeZoneRuntimeV1(),
    );
    const secondAdapter = createAstrologyLocationTimeZoneAdapterV1(
      provider("fixture-2026-07-27"),
      loadWebNodeIntlTimeZoneRuntimeV1(),
    );

    const first = createWebAstrologyLocationSearchCacheKey(cacheSecret, firstAdapter, value);
    const second = createWebAstrologyLocationSearchCacheKey(cacheSecret, secondAdapter, value);
    expect(first).toMatch(/^hmac-sha256:[0-9a-f]{64}$/u);
    expect(first).not.toContain("private-canary");
    expect(first).not.toBe(second);
  });

  it("deduplicates concurrent searches and expires the private process cache", async () => {
    let calls = 0;
    let now = 1_000;
    const fixtureProvider = provider("fixture-2026-07-26", async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [newYork];
    });
    const service = createWebAstrologyLocationTimeZoneService({
      adapter: createAstrologyLocationTimeZoneAdapterV1(
        fixtureProvider,
        loadWebNodeIntlTimeZoneRuntimeV1(),
      ),
      cacheSecret,
      clock: () => now,
    });

    const request = searchRequest("New York");
    const [first, second] = await Promise.all([service.search(request), service.search(request)]);
    expect(first).toEqual(second);
    expect(calls).toBe(1);
    expect(service.cacheSize()).toBe(1);

    now += 60_001;
    await service.search(request);
    expect(calls).toBe(2);
  });

  it("does not cache provider failures or expose private provider errors", async () => {
    let calls = 0;
    const fixtureProvider = provider("fixture-2026-07-26", async (request) => {
      calls += 1;
      throw new Error(`failed for ${request.query}`);
    });
    const service = createWebAstrologyLocationTimeZoneService({
      adapter: createAstrologyLocationTimeZoneAdapterV1(
        fixtureProvider,
        loadWebNodeIntlTimeZoneRuntimeV1(),
      ),
      cacheSecret,
      clock: () => 1_000,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(service.search(searchRequest("private-canary"))).rejects.toMatchObject({
        code: "ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE",
        message: "The astrology location provider is unavailable.",
      });
    }
    expect(calls).toBe(2);
    expect(service.cacheSize()).toBe(0);
  });

  it("aborts and fails closed when the provider exceeds the bounded timeout", async () => {
    let aborted = false;
    const fixtureProvider = provider(
      "fixture-2026-07-26",
      async (_request, context) =>
        new Promise((_resolve, reject) => {
          const onAbort = (): void => {
            aborted = true;
            reject(new Error("private-canary-timeout"));
          };
          context.cancellation?.addEventListener("abort", onAbort, { once: true });
        }),
    );
    const service = createWebAstrologyLocationTimeZoneService({
      adapter: createAstrologyLocationTimeZoneAdapterV1(
        fixtureProvider,
        loadWebNodeIntlTimeZoneRuntimeV1(),
      ),
      cacheSecret,
      clock: () => 1_000,
      timeoutMilliseconds: 100,
    });

    await expect(service.search(searchRequest("private-canary"))).rejects.toMatchObject({
      code: "ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE",
      message: "The astrology location provider is unavailable.",
    });
    expect(aborted).toBe(true);
    expect(service.cacheSize()).toBe(0);
  });
});
