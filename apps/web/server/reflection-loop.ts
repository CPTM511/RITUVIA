import "server-only";

import {
  canonicalizeReflectionIntentionCreateRequestV1,
  canonicalizeReflectionJournalCreateRequestV1,
  canonicalizeReflectionRitualCreateRequestV1,
  isFreeReflectionRitualObjectCode,
  parseReflectionIntentionCreateRequestV1,
  parseReflectionIntentionResourceV1,
  parseReflectionJournalCreateRequestV1,
  parseReflectionJournalResourceV1,
  parseReflectionRitualCreateRequestV1,
  parseReflectionRitualResourceV1,
  reflectionPolicyVersion,
  type ReflectionIntentionResourceV1,
  type ReflectionJournalResourceV1,
  type ReflectionRitualObjectCode,
  type ReflectionRitualResourceV1,
} from "@rituvia/domain";
import {
  createReflectionPersistence,
  ReflectionPersistenceError,
  type PersistedReflectionIntention,
  type PersistedReflectionJournal,
  type PersistedReflectionRitual,
  type ReflectionPersistence,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { authorizePaidRitualObject } from "./commerce";
import { loadWebDatabase } from "./database";
import {
  createPrivateContentCryptography,
  PrivateContentCryptoError,
  type PrivateContentCryptography,
  type PrivateContentKeyringInput,
} from "./private-content-crypto";

export type ReflectionLoopApplicationErrorCode =
  | "conflict"
  | "daily_limit"
  | "entitlement_required"
  | "not_found"
  | "session_required"
  | "unavailable";

export class ReflectionLoopApplicationError extends Error {
  readonly code: ReflectionLoopApplicationErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ReflectionLoopApplicationErrorCode, retryAfterSeconds?: number) {
    super("The private reflection operation failed.");
    this.name = "ReflectionLoopApplicationError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type ReflectionLoopResult<Resource> = Readonly<{
  kind: "created" | "replayed";
  resource: Resource;
}>;

export type ReflectionLoopApplicationService = Readonly<{
  createIntention(
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionLoopResult<ReflectionIntentionResourceV1>>;
  createJournal(
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionLoopResult<ReflectionJournalResourceV1>>;
  createRitual(
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionLoopResult<ReflectionRitualResourceV1>>;
  getIntention(
    id: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionIntentionResourceV1 | null>;
  getJournal(
    id: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionJournalResourceV1 | null>;
  getRitual(
    id: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionRitualResourceV1 | null>;
}>;

export type AuthorizeReflectionRitualObject = (
  input: Readonly<{
    accountSessionToken: string;
    anonymousSessionToken: string | undefined;
    objectCode: ReflectionRitualObjectCode;
  }>,
) => Promise<boolean>;

const mapPersistenceError = (error: ReflectionPersistenceError): never => {
  switch (error.code) {
    case "REFLECTION_SESSION_UNAVAILABLE":
      throw new ReflectionLoopApplicationError("session_required");
    case "REFLECTION_NOT_FOUND":
    case "REFLECTION_CHAIN_INVALID":
      throw new ReflectionLoopApplicationError("not_found");
    case "REFLECTION_IDEMPOTENCY_CONFLICT":
      throw new ReflectionLoopApplicationError("conflict");
    case "REFLECTION_RITUAL_DAILY_LIMIT":
      throw new ReflectionLoopApplicationError("daily_limit", error.retryAfterSeconds);
    case "REFLECTION_PERSISTENCE_UNAVAILABLE":
      throw new ReflectionLoopApplicationError("unavailable");
  }
};

const protect = async <Value>(operation: () => Promise<Value>): Promise<Value> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ReflectionLoopApplicationError) throw error;
    if (error instanceof ReflectionPersistenceError) return mapPersistenceError(error);
    if (error instanceof PrivateContentCryptoError) {
      throw new ReflectionLoopApplicationError("unavailable");
    }
    throw error;
  }
};

const projectIntention = (
  stored: PersistedReflectionIntention,
  cryptography: PrivateContentCryptography,
): ReflectionIntentionResourceV1 =>
  parseReflectionIntentionResourceV1({
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    id: stored.id,
    intentionCode: stored.intentionCode,
    locale: stored.locale,
    policyVersion: stored.policyVersion,
    readingId: stored.readingId,
    schemaVersion: stored.schemaVersion,
    smallAction: cryptography.decrypt({
      context: {
        ownerSubjectId: stored.subjectId,
        purpose: "intention.small_action",
        resourceBinding: `reading:${stored.readingId}`,
      },
      encrypted: stored.encryptedSmallAction,
    }),
  });

const projectRitual = (stored: PersistedReflectionRitual): ReflectionRitualResourceV1 =>
  parseReflectionRitualResourceV1({
    completedAt: stored.completedAt,
    expiresAt: stored.expiresAt,
    id: stored.id,
    intentionId: stored.intentionId,
    objectCode: stored.objectCode,
    policyVersion: stored.policyVersion,
    ritualDateUtc: stored.ritualDateUtc,
    schemaVersion: stored.schemaVersion,
  });

const projectJournal = (
  stored: PersistedReflectionJournal,
  cryptography: PrivateContentCryptography,
): ReflectionJournalResourceV1 =>
  parseReflectionJournalResourceV1({
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    id: stored.id,
    intentionId: stored.intentionId,
    policyVersion: stored.policyVersion,
    reflection: cryptography.decrypt({
      context: {
        ownerSubjectId: stored.subjectId,
        purpose: "journal.reflection",
        resourceBinding: `journal:${stored.intentionId}:${stored.ritualSessionId}`,
      },
      encrypted: stored.encryptedReflection,
    }),
    revisitAt: stored.revisitAt,
    ritualSessionId: stored.ritualSessionId,
    schemaVersion: stored.schemaVersion,
  });

const preparedDigests = (
  cryptography: PrivateContentCryptography,
  ownerSubjectId: string,
  idempotencyKey: string,
  canonicalRequest: string,
) =>
  Object.freeze({
    canonicalRequestDigest: cryptography.deriveCanonicalRequestDigest({
      canonicalRequest,
      ownerSubjectId,
    }),
    idempotencyKeyDigest: cryptography.deriveIdempotencyKeyDigest({
      idempotencyKey,
      ownerSubjectId,
    }),
    idempotencyKeyVersion: cryptography.activeKeyVersion,
  });

const principalTokens = (
  anonymousSessionToken: string | undefined,
  accountSessionToken: string | undefined,
) =>
  Object.freeze({
    ...(accountSessionToken === undefined ? {} : { accountSessionToken }),
    ...(anonymousSessionToken === undefined ? {} : { anonymousSessionToken }),
  });

export const createReflectionLoopApplicationService = (
  input: Readonly<{
    authorizeRitualObject: AuthorizeReflectionRitualObject;
    cryptography: PrivateContentCryptography;
    persistence: ReflectionPersistence;
  }>,
): ReflectionLoopApplicationService => {
  const { authorizeRitualObject, cryptography, persistence } = input;

  const getIntention: ReflectionLoopApplicationService["getIntention"] = async (
    id,
    anonymousSessionToken,
    accountSessionToken,
  ) =>
    protect(async () => {
      const stored = await persistence.getIntention({
        id,
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
      });
      return stored === null ? null : projectIntention(stored, cryptography);
    });

  const getRitual: ReflectionLoopApplicationService["getRitual"] = async (
    id,
    anonymousSessionToken,
    accountSessionToken,
  ) =>
    protect(async () => {
      const stored = await persistence.getRitual({
        id,
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
      });
      return stored === null ? null : projectRitual(stored);
    });

  const getJournal: ReflectionLoopApplicationService["getJournal"] = async (
    id,
    anonymousSessionToken,
    accountSessionToken,
  ) =>
    protect(async () => {
      const stored = await persistence.getJournal({
        id,
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
      });
      return stored === null ? null : projectJournal(stored, cryptography);
    });

  const createIntention: ReflectionLoopApplicationService["createIntention"] = async (
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseReflectionIntentionCreateRequestV1(rawRequest);
    return protect(async () => {
      const result = await persistence.resolveIntention({
        prepare: ({ subjectId }) => ({
          ...preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeReflectionIntentionCreateRequestV1(request),
          ),
          encrypted: cryptography.encrypt({
            context: {
              ownerSubjectId: subjectId,
              purpose: "intention.small_action",
              resourceBinding: `reading:${request.readingId}`,
            },
            plaintext: request.smallAction,
          }),
        }),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
      });
      return Object.freeze({
        kind: result.kind,
        resource: projectIntention(result.intention, cryptography),
      });
    });
  };

  const createRitual: ReflectionLoopApplicationService["createRitual"] = async (
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseReflectionRitualCreateRequestV1(rawRequest);
    return protect(async () => {
      if (
        !isFreeReflectionRitualObjectCode(request.objectCode) &&
        (accountSessionToken === undefined ||
          !(await authorizeRitualObject({
            accountSessionToken,
            anonymousSessionToken,
            objectCode: request.objectCode,
          })))
      ) {
        throw new ReflectionLoopApplicationError("entitlement_required");
      }
      const result = await persistence.resolveRitual({
        prepare: ({ subjectId }) =>
          preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeReflectionRitualCreateRequestV1(request),
          ),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
      });
      return Object.freeze({ kind: result.kind, resource: projectRitual(result.ritual) });
    });
  };

  const createJournal: ReflectionLoopApplicationService["createJournal"] = async (
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseReflectionJournalCreateRequestV1(rawRequest);
    return protect(async () => {
      const result = await persistence.resolveJournal({
        prepare: ({ subjectId }) => ({
          ...preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeReflectionJournalCreateRequestV1(request),
          ),
          encrypted: cryptography.encrypt({
            context: {
              ownerSubjectId: subjectId,
              purpose: "journal.reflection",
              resourceBinding: `journal:${request.intentionId}:${request.ritualSessionId}`,
            },
            plaintext: request.reflection,
          }),
        }),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
      });
      return Object.freeze({
        kind: result.kind,
        resource: projectJournal(result.journal, cryptography),
      });
    });
  };

  return Object.freeze({
    createIntention,
    createJournal,
    createRitual,
    getIntention,
    getJournal,
    getRitual,
  });
};

type ReflectionRuntimeConfiguration = Readonly<{
  privateContentKeyring?: PrivateContentKeyringInput | undefined;
  reflectionPolicy?:
    | Readonly<{
        policyVersion: string;
        retentionSeconds: number;
        revisitDelaySeconds: number;
      }>
    | undefined;
}>;

let runtimeService: ReflectionLoopApplicationService | undefined;

const loadRuntimeService = (): ReflectionLoopApplicationService => {
  if (runtimeService !== undefined) return runtimeService;
  const configuration = getWebRuntimeConfiguration();
  const reflectionConfiguration = configuration as typeof configuration &
    ReflectionRuntimeConfiguration;
  if (
    configuration.databaseUrl === undefined ||
    reflectionConfiguration.privateContentKeyring === undefined ||
    reflectionConfiguration.reflectionPolicy === undefined ||
    reflectionConfiguration.reflectionPolicy.policyVersion !== reflectionPolicyVersion
  ) {
    throw new ReflectionLoopApplicationError("unavailable");
  }
  runtimeService = createReflectionLoopApplicationService({
    authorizeRitualObject: authorizePaidRitualObject,
    cryptography: createPrivateContentCryptography(reflectionConfiguration.privateContentKeyring),
    persistence: createReflectionPersistence(loadWebDatabase(), {
      policyVersion: reflectionPolicyVersion,
      retentionSeconds: reflectionConfiguration.reflectionPolicy.retentionSeconds,
      revisitDelaySeconds: reflectionConfiguration.reflectionPolicy.revisitDelaySeconds,
    }),
  });
  return runtimeService;
};

export const createWebIntention = (
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().createIntention(
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const createWebRitualSession = (
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().createRitual(
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const createWebJournalEntry = (
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().createJournal(
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const getWebIntention = (
  id: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().getIntention(id, anonymousSessionToken, accountSessionToken);

export const getWebRitualSession = (
  id: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().getRitual(id, anonymousSessionToken, accountSessionToken);

export const getWebJournalEntry = (
  id: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().getJournal(id, anonymousSessionToken, accountSessionToken);
