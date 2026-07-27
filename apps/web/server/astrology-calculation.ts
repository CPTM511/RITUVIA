import "server-only";

import { createHash } from "node:crypto";

import type {
  AstrologyCalculationPersistence,
  AstrologyEngineBuildProvenanceV1,
  BirthProfilePersistence,
  PersistedAstrologyCalculation,
  PersistedBirthProfile,
} from "@rituvia/db";
import {
  astrologyAspectPolicyVersion,
  astrologyMethodCatalogSha256,
  astrologyNatalMethodVersion,
  astrologyNatalRequestSchemaVersion,
  parseAstrologyNatalFactsV1,
  type AstrologyEphemerisAdapterV1,
  type AstrologyNatalFactsV1,
  type AstrologyNatalRequestV1,
} from "@rituvia/divination";
import { parseBirthProfilePayloadV1, type BirthProfilePayloadV1 } from "@rituvia/domain";

import type { PrivateContentCryptography } from "./private-content-crypto";

const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const calculationPayloadSchemaVersion = "astrology-calculation-payload.v1" as const;

export const astrologyCalculationServiceErrorCodes = Object.freeze([
  "ASTROLOGY_CALCULATION_DISABLED",
  "ASTROLOGY_CALCULATION_INPUT_INVALID",
  "ASTROLOGY_CALCULATION_PROFILE_CONFLICT",
  "ASTROLOGY_CALCULATION_UNAVAILABLE",
] as const);

export type AstrologyCalculationServiceErrorCode =
  (typeof astrologyCalculationServiceErrorCodes)[number];

export class AstrologyCalculationServiceError extends Error {
  readonly code: AstrologyCalculationServiceErrorCode;

  constructor(code: AstrologyCalculationServiceErrorCode) {
    super("The astrology calculation is unavailable.");
    this.name = "AstrologyCalculationServiceError";
    this.code = code;
  }
}

export type AstrologyCalculationResourceV1 = Readonly<{
  birthProfileId: string;
  birthProfileRevision: number;
  createdAt: string;
  facts: AstrologyNatalFactsV1;
  id: string;
}>;

export type AstrologyCalculationService = Readonly<{
  calculate(input: {
    birthProfileId: string;
    expectedBirthProfileRevision: number;
    idempotencyKey: string;
    sessionToken: string;
  }): Promise<AstrologyCalculationResourceV1>;
  list(input: {
    limit?: number;
    sessionToken: string;
  }): Promise<readonly AstrologyCalculationResourceV1[]>;
  read(input: {
    calculationId: string;
    sessionToken: string;
  }): Promise<AstrologyCalculationResourceV1>;
}>;

type Dependencies = Readonly<{
  birthProfiles: BirthProfilePersistence;
  calculations: AstrologyCalculationPersistence;
  cryptography: PrivateContentCryptography;
  isEnabled(): Promise<boolean>;
  loadEphemeris(): Promise<AstrologyEphemerisAdapterV1>;
}>;

type CalculationPayloadV1 = Readonly<{
  facts: AstrologyNatalFactsV1;
  request: AstrologyNatalRequestV1;
  schemaVersion: typeof calculationPayloadSchemaVersion;
}>;

const birthProfileContext = (userId: string, profileId: string) =>
  Object.freeze({
    ownerSubjectId: userId,
    purpose: "birth_profile.payload" as const,
    resourceBinding: `birth-profile:${profileId}`,
  });

const calculationContext = (userId: string, calculationId: string) =>
  Object.freeze({
    ownerSubjectId: userId,
    purpose: "astrology_calculation.payload" as const,
    resourceBinding: `astrology-calculation:${calculationId}`,
  });

const digestPayload = (
  cryptography: PrivateContentCryptography,
  ownerSubjectId: string,
  value: string,
): string =>
  cryptography.deriveCanonicalRequestDigest({
    canonicalRequest: value,
    ownerSubjectId,
  });

const rawDigest = (value: string): string =>
  /^sha256:[0-9a-f]{64}$/u.test(value)
    ? value.slice("sha256:".length)
    : (() => {
        throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
      })();

const calculationIdFor = (profileId: string, idempotencyKey: string): string => {
  if (!idempotencyKeyPattern.test(idempotencyKey)) {
    throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_INPUT_INVALID");
  }
  const bytes = createHash("sha256")
    .update(`rituvia\0astrology-calculation-id\0${profileId}\0${idempotencyKey}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const decryptBirthProfile = (
  dependencies: Dependencies,
  persisted: PersistedBirthProfile,
): BirthProfilePayloadV1 => {
  try {
    const plaintext = dependencies.cryptography.decrypt({
      context: birthProfileContext(persisted.userId, persisted.id),
      encrypted: persisted.encryptedPayload,
    });
    const digest = digestPayload(dependencies.cryptography, persisted.userId, plaintext);
    if (
      persisted.digestKeyVersion !== dependencies.cryptography.digestKeyVersion ||
      !dependencies.cryptography.digestsEqual(digest, persisted.canonicalPayloadDigest)
    ) {
      throw new Error("digest mismatch");
    }
    const payload = parseBirthProfilePayloadV1(JSON.parse(plaintext));
    if (payload.timeCertainty !== persisted.timeCertainty) throw new Error("certainty mismatch");
    return payload;
  } catch {
    throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
  }
};

const timeZoneProvenance = (payload: BirthProfilePayloadV1): string =>
  JSON.stringify({
    normalized: payload.normalized,
    originalInput: {
      approximationWindowMinutes: payload.originalInput.approximationWindowMinutes,
    },
    provider: payload.provider,
    runtime: payload.runtime,
    selectedLocation: {
      latitudeE6: payload.selectedLocation.latitudeE6,
      locationId: payload.selectedLocation.locationId,
      longitudeE6: payload.selectedLocation.longitudeE6,
      timeZoneConfidence: payload.selectedLocation.timeZoneConfidence,
      timeZoneId: payload.selectedLocation.timeZoneId,
      timeZoneSource: payload.selectedLocation.timeZoneSource,
    },
    schemaVersion: "astrology-time-zone-provenance.v1",
  });

const requestFor = (
  dependencies: Dependencies,
  profile: PersistedBirthProfile,
  payload: BirthProfilePayloadV1,
): AstrologyNatalRequestV1 => ({
  approximationWindowMinutes: payload.originalInput.approximationWindowMinutes,
  houseSystem: "placidus",
  inputSnapshotSha256: rawDigest(profile.canonicalPayloadDigest),
  latitudeE6: payload.selectedLocation.latitudeE6,
  longitudeE6: payload.selectedLocation.longitudeE6,
  method: {
    aspectPolicyVersion: astrologyAspectPolicyVersion,
    catalogSha256: astrologyMethodCatalogSha256,
    methodVersion: astrologyNatalMethodVersion,
    node: "true_node",
    zodiac: "tropical",
  },
  profileRevision: profile.revision,
  schemaVersion: astrologyNatalRequestSchemaVersion,
  timeCertainty: payload.timeCertainty,
  timeZoneProvenanceSha256: rawDigest(
    digestPayload(dependencies.cryptography, profile.userId, timeZoneProvenance(payload)),
  ),
  utcInstant: payload.normalized.utcInstant,
});

const provenance = (facts: AstrologyNatalFactsV1): AstrologyEngineBuildProvenanceV1 =>
  Object.freeze({
    ...facts.engine,
    binarySha256: `sha256:${facts.engine.binarySha256}`,
    compilerFlagsSha256: `sha256:${facts.engine.compilerFlagsSha256}`,
    dataInventorySha256: `sha256:${facts.engine.dataInventorySha256}`,
    nativeSbomSha256: `sha256:${facts.engine.nativeSbomSha256}`,
    sourceInventorySha256: `sha256:${facts.engine.sourceInventorySha256}`,
  });

const decryptCalculation = (
  dependencies: Dependencies,
  persisted: PersistedAstrologyCalculation,
): AstrologyCalculationResourceV1 => {
  try {
    const plaintext = dependencies.cryptography.decrypt({
      context: calculationContext(persisted.userId, persisted.id),
      encrypted: persisted.encryptedFacts,
    });
    const calculatedDigest = digestPayload(dependencies.cryptography, persisted.userId, plaintext);
    if (
      persisted.digestKeyVersion !== dependencies.cryptography.digestKeyVersion ||
      !dependencies.cryptography.digestsEqual(calculatedDigest, persisted.keyedFactsDigest)
    ) {
      throw new Error("digest mismatch");
    }
    const payload = JSON.parse(plaintext) as Record<string, unknown>;
    if (
      payload.schemaVersion !== calculationPayloadSchemaVersion ||
      typeof payload.request !== "object" ||
      payload.request === null
    ) {
      throw new Error("schema mismatch");
    }
    const facts = parseAstrologyNatalFactsV1(payload.facts);
    if (
      facts.profileRevision !== persisted.birthProfileRevision ||
      facts.calculationStatus !== persisted.status ||
      facts.confidence.timeCertainty !== persisted.timeCertainty ||
      facts.method.methodVersion !== persisted.methodVersion ||
      facts.method.aspectPolicyVersion !== persisted.aspectPolicyVersion ||
      `sha256:${facts.method.catalogSha256}` !== persisted.methodCatalogDigest ||
      `sha256:${facts.inputSnapshotSha256}` !== persisted.inputSnapshotDigest ||
      `sha256:${facts.timeZoneProvenanceSha256}` !== persisted.timezoneProvenanceDigest
    ) {
      throw new Error("metadata mismatch");
    }
    const expectedProvenance = provenance(facts);
    if (JSON.stringify(expectedProvenance) !== JSON.stringify(persisted.engineBuildProvenance)) {
      throw new Error("engine provenance mismatch");
    }
    return Object.freeze({
      birthProfileId: persisted.birthProfileId,
      birthProfileRevision: persisted.birthProfileRevision,
      createdAt: persisted.createdAt,
      facts,
      id: persisted.id,
    });
  } catch {
    throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
  }
};

export const createAstrologyCalculationService = (
  dependencies: Dependencies,
): AstrologyCalculationService =>
  Object.freeze({
    async calculate(input) {
      if (!(await dependencies.isEnabled())) {
        throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_DISABLED");
      }
      const profile = await dependencies.birthProfiles.read({
        profileId: input.birthProfileId,
        sessionToken: input.sessionToken,
      });
      if (profile.revision !== input.expectedBirthProfileRevision) {
        throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_PROFILE_CONFLICT");
      }
      const birthPayload = decryptBirthProfile(dependencies, profile);
      const request = requestFor(dependencies, profile, birthPayload);
      let ephemeris: AstrologyEphemerisAdapterV1;
      try {
        ephemeris = await dependencies.loadEphemeris();
      } catch {
        throw new AstrologyCalculationServiceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
      }
      const facts = parseAstrologyNatalFactsV1(await ephemeris.calculateNatal(request));
      const calculationId = calculationIdFor(profile.id, input.idempotencyKey);
      const persisted = await dependencies.calculations.create({
        birthProfileId: profile.id,
        calculationId,
        expectedBirthProfilePayloadDigest: profile.canonicalPayloadDigest,
        expectedBirthProfileRevision: profile.revision,
        prepare: ({ userId }) => {
          const payload: CalculationPayloadV1 = Object.freeze({
            facts,
            request,
            schemaVersion: calculationPayloadSchemaVersion,
          });
          const plaintext = JSON.stringify(payload);
          return Object.freeze({
            aspectPolicyVersion: astrologyAspectPolicyVersion,
            canonicalRequestDigest: digestPayload(
              dependencies.cryptography,
              userId,
              JSON.stringify({
                birthProfileId: profile.id,
                birthProfilePayloadDigest: profile.canonicalPayloadDigest,
                birthProfileRevision: profile.revision,
                calculationId,
                methodCatalogSha256: astrologyMethodCatalogSha256,
                operation: "astrology-calculation.create.v1",
                request,
              }),
            ),
            digestKeyVersion: dependencies.cryptography.digestKeyVersion,
            encryptedFacts: dependencies.cryptography.encrypt({
              context: calculationContext(userId, calculationId),
              plaintext,
            }),
            engineBuildProvenance: provenance(facts),
            engineProvenanceVersion: "astrology-engine-build-provenance.v1",
            idempotencyKeyDigest: dependencies.cryptography.deriveIdempotencyKeyDigest({
              idempotencyKey: input.idempotencyKey,
              ownerSubjectId: userId,
            }),
            inputSnapshotDigest: `sha256:${facts.inputSnapshotSha256}`,
            keyedFactsDigest: digestPayload(dependencies.cryptography, userId, plaintext),
            methodCatalogDigest: `sha256:${astrologyMethodCatalogSha256}`,
            methodVersion: astrologyNatalMethodVersion,
            status: facts.calculationStatus,
            timeCertainty: facts.confidence.timeCertainty,
            timezoneProvenanceDigest: `sha256:${facts.timeZoneProvenanceSha256}`,
          });
        },
        sessionToken: input.sessionToken,
      });
      return decryptCalculation(dependencies, persisted);
    },
    async list(input) {
      const rows = await dependencies.calculations.list(input);
      return Object.freeze(rows.map((row) => decryptCalculation(dependencies, row)));
    },
    async read(input) {
      return decryptCalculation(dependencies, await dependencies.calculations.read(input));
    },
  });
