import { describe, expect, it } from "vitest";

import {
  astrologyLocalTimeResolutionRequestSchemaVersion,
  astrologyLocationSearchRequestSchemaVersion,
  createAstrologyLocationTimeZoneAdapterV1,
  type AstrologyLocationCandidateV1,
  type AstrologyLocationProviderV1,
  type AstrologyTimeZoneLocalPartsV1,
  type AstrologyTimeZoneRuntimeV1,
} from "../src/index.js";

type MutableCandidate = {
  -readonly [Key in keyof AstrologyLocationCandidateV1]: AstrologyLocationCandidateV1[Key];
};

const providerDescriptor = {
  adapterVersion: "1.0.0",
  attributionRequired: true,
  attributionText: "GeoNames",
  dataSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  dataVersion: "fixture-2026-07-26",
  licenseId: "CC-BY-4.0",
  privateSearchCacheTtlSeconds: 900,
  providerId: "geonames.gazetteer",
  providerVersion: "1.0.0",
  sourceUrl: "https://download.geonames.org/export/dump/",
} as const;

const candidate = (
  locationId: string,
  displayName: string,
  countryCode: string,
  latitudeE6: number,
  longitudeE6: number,
  timeZoneId: string,
  rank = 1,
): MutableCandidate => ({
  admin1Code: null,
  countryCode,
  displayName,
  latitudeE6,
  locationId: locationId as AstrologyLocationCandidateV1["locationId"],
  longitudeE6,
  rank,
  timeZoneConfidence: "provider_assigned",
  timeZoneId,
  timeZoneSource: "geonames.timezone" as AstrologyLocationCandidateV1["timeZoneSource"],
});

const locations = {
  apia: candidate(
    "geonames:4035413",
    "Apia, Samoa",
    "WS",
    -13_833_300,
    -171_766_700,
    "Pacific/Apia",
  ),
  kathmandu: candidate(
    "geonames:1283240",
    "Kathmandu, Nepal",
    "NP",
    27_716_700,
    85_316_700,
    "Asia/Kathmandu",
  ),
  newYork: candidate(
    "geonames:5128581",
    "New York City, New York, United States",
    "US",
    40_714_300,
    -74_006_000,
    "America/New_York",
  ),
  shanghai: candidate(
    "geonames:1796236",
    "Shanghai, China",
    "CN",
    31_222_200,
    121_458_100,
    "Asia/Shanghai",
  ),
  springfieldIllinois: candidate(
    "geonames:4250542",
    "Springfield, Illinois, United States",
    "US",
    39_801_700,
    -89_643_700,
    "America/Chicago",
    1,
  ),
  springfieldMassachusetts: candidate(
    "geonames:4951788",
    "Springfield, Massachusetts, United States",
    "US",
    42_101_500,
    -72_589_800,
    "America/New_York",
    2,
  ),
};

const readById = new Map(
  Object.values(locations).map((location) => [
    location.locationId,
    Object.freeze({ ...location, rank: 1 }),
  ]),
);

const runtimeParts = (
  timeZoneId: string,
  utcEpochMilliseconds: number,
): AstrologyTimeZoneLocalPartsV1 => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timeZoneId,
    year: "numeric",
  });
  const parts = formatter.formatToParts(new Date(utcEpochMilliseconds));
  const part = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((candidatePart) => candidatePart.type === type)?.value;
    if (value === undefined) throw new Error("fixture runtime is unavailable");
    return Number.parseInt(value, 10);
  };
  return Object.freeze({
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    month: part("month"),
    second: part("second"),
    year: part("year"),
  });
};

const runtime: AstrologyTimeZoneRuntimeV1 = Object.freeze({
  canonicalizeTimeZone: (timeZoneId: string) =>
    new Intl.DateTimeFormat("en", { timeZone: timeZoneId }).resolvedOptions().timeZone,
  formatLocalParts: runtimeParts,
  metadata: Object.freeze({
    icuVersion: process.versions.icu,
    runtimeId: "node_intl",
    runtimeVersion: process.versions.node,
    timeZoneDataVersion: process.versions.tz,
  }),
});

const provider = (
  overrides: Partial<AstrologyLocationProviderV1> = {},
): AstrologyLocationProviderV1 => ({
  descriptor: providerDescriptor,
  async readLocation(locationId) {
    return readById.get(locationId) ?? null;
  },
  async search(request) {
    if (request.query.toLowerCase() === "springfield") {
      return [locations.springfieldIllinois, locations.springfieldMassachusetts];
    }
    if (request.query.toLowerCase() === "nowhere") return [];
    if (request.query.toLowerCase().includes("new york")) return [locations.newYork];
    return [locations.shanghai];
  },
  ...overrides,
});

const searchRequest = (query: string, limit = 5) => ({
  limit,
  locale: "en",
  query,
  schemaVersion: astrologyLocationSearchRequestSchemaVersion,
});

const resolutionRequest = (
  locationId: string,
  localDate: string,
  localTime: string,
  disambiguation: "earlier" | "later" | null = null,
) => ({
  disambiguation,
  localDate,
  localTime,
  locationId,
  schemaVersion: astrologyLocalTimeResolutionRequestSchemaVersion,
});

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

describe("astrology location and historical time-zone adapter", () => {
  it("normalizes bounded search and never returns the raw query", async () => {
    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);
    const result = await adapter.search(searchRequest("  ｐｒｉｖａｔｅ   ｃａｎａｒｙ  "));

    expect(result).toMatchObject({
      provider: providerDescriptor,
      queryIncluded: false,
      selectionRequired: false,
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      locationId: locations.shanghai.locationId,
      timeZoneId: "Asia/Shanghai",
    });
    expect(JSON.stringify(result)).not.toContain("ｐｒｉｖａｔｅ");
    expect(JSON.stringify(result)).not.toContain("private canary");
    expect(result.cachePolicy).toEqual({
      containsRawQuery: false,
      searchResults: "private_process_memory_hmac_key_only",
      ttlSeconds: 900,
    });
    expectDeepFrozen(result);
  });

  it("requires explicit selection for zero or multiple candidates", async () => {
    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);

    await expect(adapter.search(searchRequest("Springfield"))).resolves.toMatchObject({
      candidates: [{ rank: 1 }, { rank: 2 }],
      selectionRequired: true,
    });
    await expect(adapter.search(searchRequest("Nowhere"))).resolves.toMatchObject({
      candidates: [],
      selectionRequired: true,
    });
  });

  it("resolves an ordinary quarter-hour offset with exact provenance", async () => {
    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);
    const result = await adapter.resolve(
      resolutionRequest(locations.kathmandu.locationId, "2024-01-01", "12:00"),
    );

    expect(result).toMatchObject({
      ambiguity: "unambiguous",
      historicalConfidence: "tzdb_rule_match",
      offsetSeconds: 20_700,
      provider: providerDescriptor,
      queryIncluded: false,
      runtime: {
        icuVersion: process.versions.icu,
        runtimeId: "node_intl",
        runtimeVersion: process.versions.node,
        timeZoneDataVersion: process.versions.tz,
      },
      status: "resolved",
      utcInstant: "2024-01-01T06:15:00.000Z",
    });
  });

  it("returns both fall-back instants and requires an explicit earlier or later choice", async () => {
    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);
    const request = resolutionRequest(locations.newYork.locationId, "2024-11-03", "01:30");

    const ambiguous = await adapter.resolve(request);
    expect(ambiguous).toMatchObject({
      ambiguity: "requires_explicit_choice",
      candidateInstants: [
        { offsetSeconds: -14_400, utcInstant: "2024-11-03T05:30:00.000Z" },
        { offsetSeconds: -18_000, utcInstant: "2024-11-03T06:30:00.000Z" },
      ],
      status: "ambiguous_local_time",
      utcInstant: null,
    });
    await expect(adapter.resolve({ ...request, disambiguation: "earlier" })).resolves.toMatchObject(
      {
        ambiguity: "earlier",
        offsetSeconds: -14_400,
        status: "resolved",
        utcInstant: "2024-11-03T05:30:00.000Z",
      },
    );
    await expect(adapter.resolve({ ...request, disambiguation: "later" })).resolves.toMatchObject({
      ambiguity: "later",
      offsetSeconds: -18_000,
      status: "resolved",
      utcInstant: "2024-11-03T06:30:00.000Z",
    });
  });

  it("returns gaps without inventing UTC for spring-forward and skipped-date inputs", async () => {
    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);

    await expect(
      adapter.resolve(resolutionRequest(locations.newYork.locationId, "2024-03-10", "02:30")),
    ).resolves.toMatchObject({
      ambiguity: "local_clock_gap",
      candidateInstants: [],
      status: "nonexistent_local_time",
      utcInstant: null,
    });
    await expect(
      adapter.resolve(resolutionRequest(locations.apia.locationId, "2011-12-30", "12:00")),
    ).resolves.toMatchObject({
      ambiguity: "local_clock_gap",
      status: "nonexistent_local_time",
      utcInstant: null,
    });
  });

  it("marks pre-1970 tzdb resolution as limited rather than overstating confidence", async () => {
    const adapter = createAstrologyLocationTimeZoneAdapterV1(provider(), runtime);

    await expect(
      adapter.resolve(resolutionRequest(locations.shanghai.locationId, "1949-05-01", "12:00")),
    ).resolves.toMatchObject({
      historicalConfidence: "limited_pre_1970_tzdb",
      status: "resolved",
    });
  });

  it("rejects duplicate, hostile, and mismatched provider output", async () => {
    expect(() =>
      createAstrologyLocationTimeZoneAdapterV1(
        provider({
          descriptor: { ...providerDescriptor, privateSearchCacheTtlSeconds: 901 },
        }),
        runtime,
      ),
    ).toThrowError(expect.objectContaining({ code: "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID" }));

    const duplicateAdapter = createAstrologyLocationTimeZoneAdapterV1(
      provider({
        async search() {
          return [locations.newYork, { ...locations.newYork, rank: 2 }];
        },
      }),
      runtime,
    );
    await expect(duplicateAdapter.search(searchRequest("New York"))).rejects.toMatchObject({
      code: "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID",
    });

    const hostileAdapter = createAstrologyLocationTimeZoneAdapterV1(
      provider({
        async search() {
          return [{ ...locations.newYork, displayName: "<script>private-canary</script>" }];
        },
      }),
      runtime,
    );
    await expect(hostileAdapter.search(searchRequest("private-canary"))).rejects.toMatchObject({
      code: "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID",
      message: "The astrology location provider returned an invalid response.",
    });

    const mismatchedRead = createAstrologyLocationTimeZoneAdapterV1(
      provider({
        async readLocation() {
          return locations.shanghai;
        },
      }),
      runtime,
    );
    await expect(
      mismatchedRead.resolve(
        resolutionRequest(locations.newYork.locationId, "2024-01-01", "12:00"),
      ),
    ).rejects.toMatchObject({
      code: "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID",
    });

    const mutableDescriptor = { ...providerDescriptor };
    const driftingProvider = provider();
    const driftingAdapter = createAstrologyLocationTimeZoneAdapterV1(
      { ...driftingProvider, descriptor: mutableDescriptor },
      runtime,
    );
    mutableDescriptor.dataVersion = "fixture-2026-07-27";
    await expect(
      driftingAdapter.resolve(
        resolutionRequest(locations.newYork.locationId, "2024-01-01", "12:00"),
      ),
    ).rejects.toMatchObject({
      code: "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID",
    });
  });

  it("fails closed without leaking a private query when the provider or runtime fails", async () => {
    const unavailableProvider = createAstrologyLocationTimeZoneAdapterV1(
      provider({
        async search(request) {
          throw new Error(`provider failed for ${request.query}`);
        },
      }),
      runtime,
    );
    await expect(unavailableProvider.search(searchRequest("private-canary"))).rejects.toMatchObject(
      {
        code: "ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE",
        message: "The astrology location provider is unavailable.",
      },
    );

    const unavailableRuntime = createAstrologyLocationTimeZoneAdapterV1(provider(), {
      ...runtime,
      canonicalizeTimeZone() {
        throw new Error("private-canary");
      },
    });
    await expect(
      unavailableRuntime.resolve(
        resolutionRequest(locations.newYork.locationId, "2024-01-01", "12:00"),
      ),
    ).rejects.toMatchObject({
      code: "ASTROLOGY_TIME_ZONE_RUNTIME_UNAVAILABLE",
      message: "The historical time-zone runtime is unavailable.",
    });

    const mutableMetadata = { ...runtime.metadata };
    const driftingRuntime = { ...runtime, metadata: mutableMetadata };
    const driftingRuntimeAdapter = createAstrologyLocationTimeZoneAdapterV1(
      provider(),
      driftingRuntime,
    );
    mutableMetadata.timeZoneDataVersion = "fixture-drift";
    await expect(
      driftingRuntimeAdapter.resolve(
        resolutionRequest(locations.newYork.locationId, "2024-01-01", "12:00"),
      ),
    ).rejects.toMatchObject({
      code: "ASTROLOGY_TIME_ZONE_RUNTIME_INVALID",
      message: "The historical time-zone runtime is invalid.",
    });
  });
});
