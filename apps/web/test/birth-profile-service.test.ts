import { describe, expect, it } from "vitest";

import { birthProfileCreateSchemaVersion, birthProfileUpdateSchemaVersion } from "@rituvia/domain";

import type { WebAstrologyLocationTimeZoneService } from "../server/astrology-location-time-zone";
import { createBirthProfileService } from "../server/birth-profile";
import { createPrivateContentCryptography } from "../server/private-content-crypto";

type BirthProfilePersistence = Parameters<typeof createBirthProfileService>[0]["persistence"];
type PersistedBirthProfile = Awaited<ReturnType<BirthProfilePersistence["create"]>>;
type PreparedBirthProfileWrite = ReturnType<
  Parameters<BirthProfilePersistence["create"]>[0]["prepare"]
>;

const userId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const sessionToken = "A".repeat(43);

const provider = {
  adapterVersion: "1.0.0",
  attributionRequired: true,
  attributionText: "GeoNames",
  dataSha256: "a".repeat(64),
  dataVersion: "fixture-2026-07-26",
  licenseId: "CC-BY-4.0",
  privateSearchCacheTtlSeconds: 60,
  providerId: "geonames.gazetteer",
  providerVersion: "1.0.0",
  sourceUrl: "https://download.geonames.org/export/dump/",
} as const;

const selectedPlace = {
  admin1Code: "NY",
  countryCode: "US",
  displayName: "New York City, New York, United States",
  latitudeE6: 40_714_300,
  locationId: "geonames:5128581",
  longitudeE6: -74_006_000,
  timeZoneConfidence: "provider_assigned",
  timeZoneId: "America/New_York",
  timeZoneSource: "geonames.timezone",
} as const;

const cryptography = createPrivateContentCryptography({
  activeKeyVersion: "private-content.v1",
  digestKeyVersion: "private-content.v1",
  keys: [{ key: new Uint8Array(32).fill(7), version: "private-content.v1" }],
});

const persisted = (write: PreparedBirthProfileWrite, revision = 1): PersistedBirthProfile =>
  Object.freeze({
    canonicalPayloadDigest: write.canonicalPayloadDigest,
    createdAt: "2026-07-26T00:00:00.000Z",
    deletedAt: null,
    digestKeyVersion: write.digestKeyVersion,
    encryptedPayload: write.encryptedPayload,
    id: profileId,
    revision,
    schemaVersion: "birth-profile.v1",
    timeCertainty: write.timeCertainty,
    updatedAt: "2026-07-26T00:00:00.000Z",
    userId,
  });

const persistence = (): BirthProfilePersistence => {
  let current: PersistedBirthProfile | null = null;
  return Object.freeze({
    async create(input) {
      const write = input.prepare({ profileId, userId });
      current = persisted(write);
      return current;
    },
    async delete() {
      throw new Error("not used");
    },
    async list() {
      return current === null ? [] : [current];
    },
    async read() {
      if (current === null) throw new Error("not found");
      return current;
    },
    async update(input) {
      const write = input.prepare({ profileId, userId });
      current = persisted(write, input.expectedRevision + 1);
      return current;
    },
  });
};

const exactRequest = {
  approximationWindowMinutes: null,
  birthDate: "1990-05-20",
  birthTime: "09:15",
  disambiguation: null,
  label: "My birth profile",
  locationId: selectedPlace.locationId,
  schemaVersion: birthProfileCreateSchemaVersion,
  timeCertainty: "exact",
} as const;

describe("birth profile web service", () => {
  it("resolves exact time, encrypts the full payload, and preserves replay provenance", async () => {
    let resolveCalls = 0;
    const locationTimeZone = {
      cacheSize: () => 0,
      async readLocation() {
        throw new Error("not used");
      },
      async resolve() {
        resolveCalls += 1;
        return {
          ambiguity: "unambiguous",
          candidateInstants: [{ offsetSeconds: -14_400, utcInstant: "1990-05-20T13:15:00.000Z" }],
          historicalConfidence: "tzdb_rule_match",
          localInput: { date: "1990-05-20", precision: "minute", time: "09:15" },
          offsetSeconds: -14_400,
          provider,
          queryIncluded: false,
          runtime: {
            icuVersion: "78.3",
            runtimeId: "node_intl",
            runtimeVersion: "26.5.1",
            timeZoneDataVersion: "2026b",
          },
          runtimeCanonicalTimeZoneId: "America/New_York",
          schemaVersion: "astrology-local-time-resolution-result.v1",
          selectedLocation: selectedPlace,
          status: "resolved",
          utcInstant: "1990-05-20T13:15:00.000Z",
        };
      },
      async search() {
        throw new Error("not used");
      },
    } as unknown as WebAstrologyLocationTimeZoneService;
    const service = createBirthProfileService({
      cryptography,
      locationTimeZone,
      persistence: persistence(),
    });

    const created = await service.create({
      idempotencyKey: "c".repeat(22),
      request: exactRequest,
      sessionToken,
    });
    expect(resolveCalls).toBe(1);
    expect(created.payload.normalized.utcInstant).toBe("1990-05-20T13:15:00.000Z");
    expect(created.payload.provider.dataSha256).toBe(provider.dataSha256);
    expect((await service.list({ sessionToken }))[0]).toEqual(created);
  });

  it("never fabricates a clock time for unknown time and keeps approximate uncertainty", async () => {
    let readCalls = 0;
    let resolveCalls = 0;
    const locationTimeZone = {
      cacheSize: () => 0,
      async readLocation() {
        readCalls += 1;
        return {
          provider,
          queryIncluded: false,
          schemaVersion: "astrology-location-selection-result.v1",
          selectedLocation: selectedPlace,
        };
      },
      async resolve() {
        resolveCalls += 1;
        return {
          ambiguity: "unambiguous",
          candidateInstants: [{ offsetSeconds: -14_400, utcInstant: "1990-05-20T13:15:00.000Z" }],
          historicalConfidence: "tzdb_rule_match",
          localInput: { date: "1990-05-20", precision: "minute", time: "09:15" },
          offsetSeconds: -14_400,
          provider,
          queryIncluded: false,
          runtime: {
            icuVersion: "78.3",
            runtimeId: "node_intl",
            runtimeVersion: "26.5.1",
            timeZoneDataVersion: "2026b",
          },
          runtimeCanonicalTimeZoneId: "America/New_York",
          schemaVersion: "astrology-local-time-resolution-result.v1",
          selectedLocation: selectedPlace,
          status: "resolved",
          utcInstant: "1990-05-20T13:15:00.000Z",
        };
      },
      async search() {
        throw new Error("not used");
      },
    } as unknown as WebAstrologyLocationTimeZoneService;
    const service = createBirthProfileService({
      cryptography,
      locationTimeZone,
      persistence: persistence(),
    });

    const unknown = await service.create({
      idempotencyKey: "u".repeat(22),
      request: {
        ...exactRequest,
        birthTime: null,
        schemaVersion: birthProfileCreateSchemaVersion,
        timeCertainty: "unknown",
      },
      sessionToken,
    });
    expect(readCalls).toBe(1);
    expect(resolveCalls).toBe(0);
    expect(unknown.payload.normalized).toEqual({
      ambiguity: "unknown_time",
      offsetSeconds: null,
      runtimeCanonicalTimeZoneId: null,
      utcInstant: null,
    });

    const approximate = await service.update({
      expectedRevision: 1,
      idempotencyKey: "a".repeat(22),
      profileId,
      request: {
        ...exactRequest,
        approximationWindowMinutes: 45,
        schemaVersion: birthProfileUpdateSchemaVersion,
        timeCertainty: "approximate",
      },
      sessionToken,
    });
    expect(approximate.payload.originalInput.approximationWindowMinutes).toBe(45);
    expect(resolveCalls).toBe(1);
  });
});
