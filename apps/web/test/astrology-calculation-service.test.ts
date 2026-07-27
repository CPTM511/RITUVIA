import { describe, expect, it, vi } from "vitest";

import {
  astrologyMethodCatalogSha256,
  createAstrologyEphemerisAdapterV1,
  type AstrologyEngineBuildMetadataV1,
  type AstrologyNativeExecutionV1,
} from "@rituvia/divination";
import { parseBirthProfilePayloadV1 } from "@rituvia/domain";

import {
  AstrologyCalculationServiceError,
  createAstrologyCalculationService,
} from "../server/astrology-calculation";
import { createPrivateContentCryptography } from "../server/private-content-crypto";

const userId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const sessionToken = "A".repeat(43);
const cryptography = createPrivateContentCryptography({
  activeKeyVersion: "private-content.v1",
  digestKeyVersion: "private-content.v1",
  keys: [{ key: new Uint8Array(32).fill(7), version: "private-content.v1" }],
});
const birthPayload = parseBirthProfilePayloadV1({
  label: "My birth profile",
  normalized: {
    ambiguity: "unambiguous",
    offsetSeconds: -14400,
    runtimeCanonicalTimeZoneId: "America/New_York",
    utcInstant: "2000-01-01T12:00:00.000Z",
  },
  originalInput: {
    approximationWindowMinutes: null,
    birthDate: "2000-01-01",
    birthTime: "07:00",
    disambiguation: null,
    locationId: "geonames:5128581",
  },
  provider: {
    adapterVersion: "1.0.0",
    attributionRequired: true,
    attributionText: "GeoNames",
    dataSha256: "a".repeat(64),
    dataVersion: "fixture",
    licenseId: "CC-BY-4.0",
    providerId: "geonames.gazetteer",
    providerVersion: "1.0.0",
    sourceUrl: "https://download.geonames.org/export/dump/",
  },
  runtime: {
    historicalConfidence: "tzdb_rule_match",
    icuVersion: "78.3",
    runtimeId: "node_intl",
    runtimeVersion: "24.18.0",
    timeZoneDataVersion: "2026b",
  },
  schemaVersion: "birth-profile.v1",
  selectedLocation: {
    admin1Code: "NY",
    countryCode: "US",
    displayName: "New York City, New York, United States",
    latitudeE6: 40_714_300,
    locationId: "geonames:5128581",
    longitudeE6: -74_006_000,
    timeZoneConfidence: "provider_assigned",
    timeZoneId: "America/New_York",
    timeZoneSource: "geonames.timezone",
  },
  timeCertainty: "exact",
});
const birthPlaintext = JSON.stringify(birthPayload);
const persistedProfile = {
  canonicalPayloadDigest: cryptography.deriveCanonicalRequestDigest({
    canonicalRequest: birthPlaintext,
    ownerSubjectId: userId,
  }),
  createdAt: "2026-07-26T00:00:00.000Z",
  deletedAt: null,
  digestKeyVersion: cryptography.digestKeyVersion,
  encryptedPayload: cryptography.encrypt({
    context: {
      ownerSubjectId: userId,
      purpose: "birth_profile.payload",
      resourceBinding: `birth-profile:${profileId}`,
    },
    plaintext: birthPlaintext,
  }),
  id: profileId,
  revision: 3,
  schemaVersion: "birth-profile.v1" as const,
  timeCertainty: "exact" as const,
  updatedAt: "2026-07-26T00:00:00.000Z",
  userId,
};
const engine: AstrologyEngineBuildMetadataV1 = {
  abiVersion: "darwin-arm64",
  adapterVersion: "1.0.0",
  binarySha256: "b".repeat(64),
  compilerFlagsSha256: "c".repeat(64),
  compilerId: "Apple clang 17",
  dataInventorySha256: "d".repeat(64),
  libraryVersion: "2.10.03",
  nativeSbomSha256: "e".repeat(64),
  sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
  sourceInventorySha256: "f".repeat(64),
  sourceSnapshotTag: "v2.10.3final",
};
const execution: AstrologyNativeExecutionV1 = {
  angles: {
    armcDegrees: 281,
    ascendantDegrees: 24,
    midheavenDegrees: 283,
    vertexDegrees: 167,
  },
  engineVersion: "2.10.03",
  houseCuspsDegrees: [24, 51, 76, 103, 132, 164, 204, 231, 256, 283, 312, 344],
  julianDayUt: 2451545,
  positions: [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
    "true_node",
  ].map((body, index) => ({
    body,
    distanceAu: 1,
    latitudeDegrees: 0,
    longitudeDegrees: (280 + index * 17) % 360,
    longitudeSpeedDegreesPerDay: 1,
    returnedEphemerisFlags: 258,
  })) as AstrologyNativeExecutionV1["positions"],
  schemaVersion: "astrology-native-execution.v1",
};

describe("astrology calculation service", () => {
  it("binds an authorized profile revision to one encrypted idempotent calculation", async () => {
    type CreateInput = Parameters<
      Parameters<typeof createAstrologyCalculationService>[0]["calculations"]["create"]
    >[0];
    type PersistedCalculation = Awaited<
      ReturnType<Parameters<typeof createAstrologyCalculationService>[0]["calculations"]["create"]>
    >;
    let stored: CreateInput | null = null;
    let persisted: PersistedCalculation | null = null;
    const calculations = {
      async create(input: NonNullable<typeof stored>) {
        stored = input;
        const prepared = input.prepare({
          birthProfileId: profileId,
          birthProfilePayloadDigest: persistedProfile.canonicalPayloadDigest,
          birthProfileRevision: 3,
          calculationId: input.calculationId,
          userId,
        });
        persisted = {
          aspectPolicyVersion: prepared.aspectPolicyVersion,
          birthProfileId: profileId,
          birthProfilePayloadDigest: persistedProfile.canonicalPayloadDigest,
          birthProfileRevision: 3,
          createdAt: "2026-07-26T01:00:00.000Z",
          digestKeyVersion: prepared.digestKeyVersion,
          encryptedFacts: prepared.encryptedFacts,
          engineBuildProvenance: prepared.engineBuildProvenance,
          engineProvenanceVersion: prepared.engineProvenanceVersion,
          id: input.calculationId,
          inputSnapshotDigest: prepared.inputSnapshotDigest,
          keyedFactsDigest: prepared.keyedFactsDigest,
          methodCatalogDigest: prepared.methodCatalogDigest,
          methodVersion: prepared.methodVersion,
          status: prepared.status,
          timeCertainty: prepared.timeCertainty,
          timezoneProvenanceDigest: prepared.timezoneProvenanceDigest,
          userId,
        };
        return persisted;
      },
      async list() {
        return persisted === null ? [] : [persisted];
      },
      async read() {
        if (persisted === null) throw new Error("missing");
        return persisted;
      },
    };
    const service = createAstrologyCalculationService({
      birthProfiles: {
        create: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        read: vi.fn(async () => persistedProfile),
        update: vi.fn(),
      },
      calculations,
      cryptography,
      isEnabled: async () => true,
      loadEphemeris: async () =>
        createAstrologyEphemerisAdapterV1({ execute: async () => execution }, engine),
    });

    const created = await service.calculate({
      birthProfileId: profileId,
      expectedBirthProfileRevision: 3,
      idempotencyKey: "i".repeat(22),
      sessionToken,
    });
    expect(created.facts.method.catalogSha256).toBe(astrologyMethodCatalogSha256);
    expect(created.facts.profileRevision).toBe(3);
    const capturedInput = stored as unknown as CreateInput;
    const capturedPersisted = persisted as unknown as PersistedCalculation;
    expect(capturedInput.expectedBirthProfilePayloadDigest).toBe(
      persistedProfile.canonicalPayloadDigest,
    );
    expect(Buffer.from(capturedPersisted.encryptedFacts.ciphertext).toString("utf8")).not.toContain(
      "America/New_York",
    );
    await expect(service.read({ calculationId: created.id, sessionToken })).resolves.toEqual(
      created,
    );
  });

  it("fails before native execution when disabled or the profile revision is stale", async () => {
    const execute = vi.fn(async () => execution);
    const base = {
      birthProfiles: {
        create: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        read: vi.fn(async () => persistedProfile),
        update: vi.fn(),
      },
      calculations: { create: vi.fn(), list: vi.fn(), read: vi.fn() },
      cryptography,
      loadEphemeris: vi.fn(async () => createAstrologyEphemerisAdapterV1({ execute }, engine)),
    };
    const disabled = createAstrologyCalculationService({ ...base, isEnabled: async () => false });
    await expect(
      disabled.calculate({
        birthProfileId: profileId,
        expectedBirthProfileRevision: 3,
        idempotencyKey: "d".repeat(22),
        sessionToken,
      }),
    ).rejects.toMatchObject({ code: "ASTROLOGY_CALCULATION_DISABLED" });
    const enabled = createAstrologyCalculationService({ ...base, isEnabled: async () => true });
    await expect(
      enabled.calculate({
        birthProfileId: profileId,
        expectedBirthProfileRevision: 2,
        idempotencyKey: "s".repeat(22),
        sessionToken,
      }),
    ).rejects.toBeInstanceOf(AstrologyCalculationServiceError);
    expect(base.loadEphemeris).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
