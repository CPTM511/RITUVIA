import "server-only";

import type {
  BirthProfilePersistence,
  PersistedBirthProfile,
  PreparedBirthProfileWrite,
} from "@rituvia/db";
import {
  astrologyLocalTimeResolutionRequestSchemaVersion,
  type AstrologyLocationProviderDescriptorV1,
  type AstrologyLocationSelectionResultV1,
  type AstrologyResolvedLocalTimeV1,
} from "@rituvia/divination";
import {
  birthProfileCreateSchemaVersion,
  birthProfileSchemaVersion,
  birthProfileUpdateSchemaVersion,
  canonicalizeBirthProfileWriteRequestV1,
  parseBirthProfilePayloadV1,
  parseBirthProfileWriteRequestV1,
  type BirthProfilePayloadV1,
  type BirthProfileWriteRequestV1,
} from "@rituvia/domain";

import type { WebAstrologyLocationTimeZoneService } from "./astrology-location-time-zone";
import type { PrivateContentCryptography } from "./private-content-crypto";

export const birthProfileServiceErrorCodes = Object.freeze([
  "BIRTH_PROFILE_INPUT_INVALID",
  "BIRTH_PROFILE_AMBIGUITY_REQUIRED",
  "BIRTH_PROFILE_LOCAL_TIME_NONEXISTENT",
  "BIRTH_PROFILE_UNAVAILABLE",
] as const);

export type BirthProfileServiceErrorCode = (typeof birthProfileServiceErrorCodes)[number];

export class BirthProfileServiceError extends Error {
  readonly code: BirthProfileServiceErrorCode;

  constructor(code: BirthProfileServiceErrorCode) {
    super("The birth profile operation is unavailable.");
    this.name = "BirthProfileServiceError";
    this.code = code;
  }
}

export type BirthProfileResourceV1 = Readonly<{
  createdAt: string;
  id: string;
  payload: BirthProfilePayloadV1;
  revision: number;
  updatedAt: string;
}>;

export type BirthProfileService = Readonly<{
  create(input: {
    idempotencyKey: string;
    request: unknown;
    sessionToken: string;
  }): Promise<BirthProfileResourceV1>;
  delete(input: {
    expectedRevision: number;
    idempotencyKey: string;
    profileId: string;
    sessionToken: string;
  }): Promise<void>;
  list(input: { sessionToken: string }): Promise<readonly BirthProfileResourceV1[]>;
  read(input: { profileId: string; sessionToken: string }): Promise<BirthProfileResourceV1>;
  update(input: {
    expectedRevision: number;
    idempotencyKey: string;
    profileId: string;
    request: unknown;
    sessionToken: string;
  }): Promise<BirthProfileResourceV1>;
}>;

type Dependencies = Readonly<{
  cryptography: PrivateContentCryptography;
  locationTimeZone: WebAstrologyLocationTimeZoneService;
  persistence: BirthProfilePersistence;
}>;

const providerPayload = (provider: AstrologyLocationProviderDescriptorV1) =>
  Object.freeze({
    adapterVersion: provider.adapterVersion,
    attributionRequired: provider.attributionRequired,
    attributionText: provider.attributionText,
    dataSha256: provider.dataSha256,
    dataVersion: provider.dataVersion,
    licenseId: provider.licenseId,
    providerId: provider.providerId,
    providerVersion: provider.providerVersion,
    sourceUrl: provider.sourceUrl,
  });

const unknownPayload = (
  request: BirthProfileWriteRequestV1,
  selection: AstrologyLocationSelectionResultV1,
): BirthProfilePayloadV1 =>
  parseBirthProfilePayloadV1({
    label: request.label,
    normalized: {
      ambiguity: "unknown_time",
      offsetSeconds: null,
      runtimeCanonicalTimeZoneId: null,
      utcInstant: null,
    },
    originalInput: {
      approximationWindowMinutes: null,
      birthDate: request.birthDate,
      birthTime: null,
      disambiguation: null,
      locationId: request.locationId,
    },
    provider: providerPayload(selection.provider),
    runtime: null,
    schemaVersion: birthProfileSchemaVersion,
    selectedLocation: selection.selectedLocation,
    timeCertainty: "unknown",
  });

const resolvedPayload = (
  request: BirthProfileWriteRequestV1,
  resolution: AstrologyResolvedLocalTimeV1,
): BirthProfilePayloadV1 =>
  parseBirthProfilePayloadV1({
    label: request.label,
    normalized: {
      ambiguity: resolution.ambiguity,
      offsetSeconds: resolution.offsetSeconds,
      runtimeCanonicalTimeZoneId: resolution.runtimeCanonicalTimeZoneId,
      utcInstant: resolution.utcInstant,
    },
    originalInput: {
      approximationWindowMinutes: request.approximationWindowMinutes,
      birthDate: request.birthDate,
      birthTime: request.birthTime,
      disambiguation: request.disambiguation,
      locationId: request.locationId,
    },
    provider: providerPayload(resolution.provider),
    runtime: {
      historicalConfidence: resolution.historicalConfidence,
      ...resolution.runtime,
    },
    schemaVersion: birthProfileSchemaVersion,
    selectedLocation: resolution.selectedLocation,
    timeCertainty: request.timeCertainty,
  });

const resolvePayload = async (
  dependencies: Dependencies,
  request: BirthProfileWriteRequestV1,
): Promise<BirthProfilePayloadV1> => {
  if (request.timeCertainty === "unknown") {
    return unknownPayload(
      request,
      await dependencies.locationTimeZone.readLocation(request.locationId),
    );
  }
  const resolution = await dependencies.locationTimeZone.resolve({
    disambiguation: request.disambiguation,
    localDate: request.birthDate,
    localTime: request.birthTime,
    locationId: request.locationId,
    schemaVersion: astrologyLocalTimeResolutionRequestSchemaVersion,
  });
  if (resolution.status === "ambiguous_local_time") {
    throw new BirthProfileServiceError("BIRTH_PROFILE_AMBIGUITY_REQUIRED");
  }
  if (resolution.status === "nonexistent_local_time") {
    throw new BirthProfileServiceError("BIRTH_PROFILE_LOCAL_TIME_NONEXISTENT");
  }
  return resolvedPayload(request, resolution);
};

const context = (userId: string, profileId: string) =>
  Object.freeze({
    ownerSubjectId: userId,
    purpose: "birth_profile.payload" as const,
    resourceBinding: `birth-profile:${profileId}`,
  });

const decryptResource = (
  dependencies: Dependencies,
  persisted: PersistedBirthProfile,
): BirthProfileResourceV1 => {
  try {
    const plaintext = dependencies.cryptography.decrypt({
      context: context(persisted.userId, persisted.id),
      encrypted: persisted.encryptedPayload,
    });
    const payload = parseBirthProfilePayloadV1(JSON.parse(plaintext));
    if (payload.timeCertainty !== persisted.timeCertainty) {
      throw new BirthProfileServiceError("BIRTH_PROFILE_UNAVAILABLE");
    }
    return Object.freeze({
      createdAt: persisted.createdAt,
      id: persisted.id,
      payload,
      revision: persisted.revision,
      updatedAt: persisted.updatedAt,
    });
  } catch (error) {
    if (error instanceof BirthProfileServiceError) throw error;
    throw new BirthProfileServiceError("BIRTH_PROFILE_UNAVAILABLE");
  }
};

const prepareWrite = (
  dependencies: Dependencies,
  input: {
    canonicalRequest: string;
    idempotencyKey: string;
    payload: BirthProfilePayloadV1;
    profileId: string;
    userId: string;
  },
): PreparedBirthProfileWrite => {
  const plaintext = JSON.stringify(input.payload);
  return Object.freeze({
    canonicalPayloadDigest: dependencies.cryptography.deriveCanonicalRequestDigest({
      canonicalRequest: plaintext,
      ownerSubjectId: input.userId,
    }),
    canonicalRequestDigest: dependencies.cryptography.deriveCanonicalRequestDigest({
      canonicalRequest: input.canonicalRequest,
      ownerSubjectId: input.userId,
    }),
    digestKeyVersion: dependencies.cryptography.digestKeyVersion,
    encryptedPayload: dependencies.cryptography.encrypt({
      context: context(input.userId, input.profileId),
      plaintext,
    }),
    idempotencyKeyDigest: dependencies.cryptography.deriveIdempotencyKeyDigest({
      idempotencyKey: input.idempotencyKey,
      ownerSubjectId: input.userId,
    }),
    timeCertainty: input.payload.timeCertainty,
  });
};

export const createBirthProfileService = (dependencies: Dependencies): BirthProfileService =>
  Object.freeze({
    async create(input) {
      let request: BirthProfileWriteRequestV1;
      try {
        request = parseBirthProfileWriteRequestV1(input.request, birthProfileCreateSchemaVersion);
      } catch {
        throw new BirthProfileServiceError("BIRTH_PROFILE_INPUT_INVALID");
      }
      const canonicalRequest = canonicalizeBirthProfileWriteRequestV1(
        request,
        birthProfileCreateSchemaVersion,
      );
      const payload = await resolvePayload(dependencies, request);
      const persisted = await dependencies.persistence.create({
        prepare: ({ profileId, userId }) =>
          prepareWrite(dependencies, {
            canonicalRequest,
            idempotencyKey: input.idempotencyKey,
            payload,
            profileId,
            userId,
          }),
        sessionToken: input.sessionToken,
      });
      return decryptResource(dependencies, persisted);
    },
    async delete(input) {
      const canonicalRequest = JSON.stringify({
        expectedRevision: input.expectedRevision,
        operation: "birth-profile.delete.v1",
        profileId: input.profileId,
      });
      await dependencies.persistence.delete({
        expectedRevision: input.expectedRevision,
        profileId: input.profileId,
        prepare: ({ profileId, userId }) =>
          Object.freeze({
            canonicalRequestDigest: dependencies.cryptography.deriveCanonicalRequestDigest({
              canonicalRequest,
              ownerSubjectId: userId,
            }),
            idempotencyKeyDigest: dependencies.cryptography.deriveIdempotencyKeyDigest({
              idempotencyKey: input.idempotencyKey,
              ownerSubjectId: userId,
            }),
            tombstone: dependencies.cryptography.encrypt({
              context: context(userId, profileId),
              plaintext: JSON.stringify({
                deleted: true,
                schemaVersion: "birth-profile-deleted.v1",
              }),
            }),
          }),
        sessionToken: input.sessionToken,
      });
    },
    async list(input) {
      const profiles = await dependencies.persistence.list({ sessionToken: input.sessionToken });
      return Object.freeze(profiles.map((profile) => decryptResource(dependencies, profile)));
    },
    async read(input) {
      return decryptResource(
        dependencies,
        await dependencies.persistence.read({
          profileId: input.profileId,
          sessionToken: input.sessionToken,
        }),
      );
    },
    async update(input) {
      let request: BirthProfileWriteRequestV1;
      try {
        request = parseBirthProfileWriteRequestV1(input.request, birthProfileUpdateSchemaVersion);
      } catch {
        throw new BirthProfileServiceError("BIRTH_PROFILE_INPUT_INVALID");
      }
      const canonicalRequest = canonicalizeBirthProfileWriteRequestV1(
        request,
        birthProfileUpdateSchemaVersion,
      );
      const payload = await resolvePayload(dependencies, request);
      const persisted = await dependencies.persistence.update({
        expectedRevision: input.expectedRevision,
        profileId: input.profileId,
        prepare: ({ profileId, userId }) =>
          prepareWrite(dependencies, {
            canonicalRequest,
            idempotencyKey: input.idempotencyKey,
            payload,
            profileId,
            userId,
          }),
        sessionToken: input.sessionToken,
      });
      return decryptResource(dependencies, persisted);
    },
  });
