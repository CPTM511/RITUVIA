import "server-only";

import { randomUUID } from "node:crypto";

import {
  canonicalizePrivateJournalCreateRequestV2,
  canonicalizePrivateJournalMutationRequestV1,
  canonicalizeRitualSessionMutationRequestV1,
  canonicalizeRitualSessionStartRequestV2,
  createRitualSessionSnapshotV1,
  parsePrivateJournalCreateRequestV2,
  parsePrivateJournalMutationRequestV1,
  parsePrivateJournalResourceV2,
  parseRitualSessionMutationRequestV1,
  parseRitualSessionStartRequestV2,
  reflectionPolicyVersion,
  RitualJournalContractError,
  type PrivateJournalResourceV2,
  type RitualSessionResourceV2,
} from "@rituvia/domain";
import {
  createRitualJournalPersistence,
  RitualJournalPersistenceError,
  type PersistedPrivateJournalV2,
  type RitualJournalPersistence,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import {
  captureCoreLoopAnalytics,
  safeOffWebCoreLoopAnalytics,
  type WebCoreLoopAnalytics,
} from "./core-loop-analytics";
import { loadWebDatabase } from "./database";
import {
  createPrivateContentCryptography,
  PrivateContentCryptoError,
  type PrivateContentCryptography,
  type PrivateContentKeyringInput,
} from "./private-content-crypto";
import { getWebRitualCatalog } from "./ritual-catalog";
import { ReflectionLoopApplicationError } from "./reflection-loop";

type RitualJournalResult<Resource> = Readonly<{
  kind: "created" | "replayed";
  resource: Resource;
}>;

type RitualJournalMutationResult<Resource> = Readonly<{
  kind: "mutated" | "replayed";
  resource: Resource | null;
}>;

export type RitualJournalApplicationService = Readonly<{
  createJournal(
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RitualJournalResult<PrivateJournalResourceV2>>;
  getJournal(
    id: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<PrivateJournalResourceV2 | null>;
  getSession(
    id: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RitualSessionResourceV2 | null>;
  mutateJournal(
    id: string,
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RitualJournalMutationResult<PrivateJournalResourceV2>>;
  mutateSession(
    id: string,
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RitualJournalMutationResult<RitualSessionResourceV2>>;
  startSession(
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RitualJournalResult<RitualSessionResourceV2>>;
}>;

const mapPersistenceError = (error: RitualJournalPersistenceError): never => {
  switch (error.code) {
    case "RITUAL_JOURNAL_ACCESS_REQUIRED":
      throw new ReflectionLoopApplicationError("entitlement_required");
    case "RITUAL_JOURNAL_CONFLICT":
      throw new ReflectionLoopApplicationError("conflict");
    case "RITUAL_JOURNAL_NOT_FOUND":
      throw new ReflectionLoopApplicationError("not_found");
    case "RITUAL_JOURNAL_SESSION_REQUIRED":
      throw new ReflectionLoopApplicationError("session_required");
    case "RITUAL_JOURNAL_UNAVAILABLE":
      throw new ReflectionLoopApplicationError("unavailable");
  }
};

const protect = async <Value>(operation: () => Promise<Value>): Promise<Value> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ReflectionLoopApplicationError) throw error;
    if (error instanceof RitualJournalPersistenceError) return mapPersistenceError(error);
    if (error instanceof RitualJournalContractError) {
      throw new ReflectionLoopApplicationError("invalid");
    }
    if (error instanceof PrivateContentCryptoError) {
      throw new ReflectionLoopApplicationError("unavailable");
    }
    throw error;
  }
};

const principalTokens = (
  anonymousSessionToken: string | undefined,
  accountSessionToken: string | undefined,
) =>
  Object.freeze({
    ...(accountSessionToken === undefined ? {} : { accountSessionToken }),
    ...(anonymousSessionToken === undefined ? {} : { anonymousSessionToken }),
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
    keyVersion: cryptography.activeKeyVersion,
  });

const projectJournal = (
  stored: PersistedPrivateJournalV2,
  cryptography: PrivateContentCryptography,
): PrivateJournalResourceV2 =>
  parsePrivateJournalResourceV2({
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    id: stored.id,
    intentionId: stored.intentionId,
    reflection: cryptography.decrypt({
      context: {
        ownerSubjectId: stored.subjectId,
        purpose: "journal.reflection",
        resourceBinding: `journal:${stored.id}`,
      },
      encrypted: stored.encryptedReflection,
    }),
    revision: stored.revision,
    ritualSessionId: stored.ritualSessionId,
    schemaVersion: stored.schemaVersion,
    updatedAt: stored.updatedAt,
  });

export const createRitualJournalApplicationService = (
  input: Readonly<{
    analytics?: WebCoreLoopAnalytics;
    cryptography: PrivateContentCryptography;
    persistence: RitualJournalPersistence;
  }>,
): RitualJournalApplicationService => {
  const { cryptography, persistence } = input;
  const analytics = input.analytics ?? safeOffWebCoreLoopAnalytics;

  const startSession: RitualJournalApplicationService["startSession"] = async (
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseRitualSessionStartRequestV2(rawRequest);
    const catalog = getWebRitualCatalog();
    const item = catalog.items.find(
      (candidate) => candidate.code === request.itemCode && candidate.status === "active",
    );
    if (item === undefined) throw new ReflectionLoopApplicationError("invalid");
    const snapshot = createRitualSessionSnapshotV1(catalog.catalogId, catalog.version, item);
    return protect(async () => {
      const result = await persistence.startSession({
        prepare: ({ subjectId }) =>
          preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeRitualSessionStartRequestV2(request),
          ),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
        snapshot,
      });
      if (result.kind === "created") {
        await captureCoreLoopAnalytics(analytics, {
          anonymousSessionToken,
          eventName: "ritual_started",
          locale: "en",
          occurredAt: result.resource.startedAt,
          properties: {
            accessCategory: result.resource.access.kind,
            ritualItemCode: result.resource.itemCode,
            templateVersion: result.resource.templateVersion,
          },
          reflectionRoot: { intentionId: result.resource.intentionId, kind: "intention" },
          semanticReference: result.resource.id,
          source: "server",
        });
      }
      return result;
    });
  };

  const mutateSession: RitualJournalApplicationService["mutateSession"] = async (
    id,
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseRitualSessionMutationRequestV1(rawRequest);
    return protect(async () => {
      const result = await persistence.mutateSession({
        id,
        prepare: ({ subjectId }) =>
          preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeRitualSessionMutationRequestV1(request),
          ),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
      });
      if (
        result.kind === "mutated" &&
        request.action === "complete" &&
        result.resource?.completedAt !== null &&
        result.resource !== null
      ) {
        await captureCoreLoopAnalytics(analytics, {
          anonymousSessionToken,
          eventName: "ritual_completed",
          locale: "en",
          occurredAt: result.resource.completedAt,
          properties: {
            accessCategory: result.resource.access.kind,
            ritualItemCode: result.resource.itemCode,
            templateVersion: result.resource.templateVersion,
          },
          reflectionRoot: { intentionId: result.resource.intentionId, kind: "intention" },
          semanticReference: result.resource.id,
          source: "server",
        });
      }
      return result;
    });
  };

  const getSession: RitualJournalApplicationService["getSession"] = (
    id,
    anonymousSessionToken,
    accountSessionToken,
  ) =>
    protect(() =>
      persistence.getSession({
        id,
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
      }),
    );

  const createJournal: RitualJournalApplicationService["createJournal"] = async (
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parsePrivateJournalCreateRequestV2(rawRequest);
    const resourceId = randomUUID();
    return protect(async () => {
      const result = await persistence.createJournal({
        prepare: ({ subjectId }) => ({
          ...preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizePrivateJournalCreateRequestV2(request),
          ),
          encryptedReflection: cryptography.encrypt({
            context: {
              ownerSubjectId: subjectId,
              purpose: "journal.reflection",
              resourceBinding: `journal:${resourceId}`,
            },
            plaintext: request.reflection,
          }),
        }),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
        resourceId,
      });
      if (result.kind === "created") {
        await captureCoreLoopAnalytics(analytics, {
          anonymousSessionToken,
          eventName: "journal_entry_created",
          locale: "en",
          occurredAt: result.resource.createdAt,
          properties: {},
          reflectionRoot: { intentionId: result.resource.intentionId, kind: "intention" },
          semanticReference: result.resource.id,
          source: "server",
        });
      }
      return Object.freeze({
        kind: result.kind,
        resource: projectJournal(result.resource, cryptography),
      });
    });
  };

  const mutateJournal: RitualJournalApplicationService["mutateJournal"] = async (
    id,
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parsePrivateJournalMutationRequestV1(rawRequest);
    return protect(async () => {
      const result = await persistence.mutateJournal({
        id,
        prepare: ({ resourceId, subjectId }) => ({
          ...preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizePrivateJournalMutationRequestV1(request),
          ),
          ...(request.action === "update"
            ? {
                encryptedReflection: cryptography.encrypt({
                  context: {
                    ownerSubjectId: subjectId,
                    purpose: "journal.reflection",
                    resourceBinding: `journal:${resourceId}`,
                  },
                  plaintext: request.reflection,
                }),
              }
            : {}),
        }),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
      });
      return Object.freeze({
        kind: result.kind,
        resource: result.resource === null ? null : projectJournal(result.resource, cryptography),
      });
    });
  };

  const getJournal: RitualJournalApplicationService["getJournal"] = async (
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

  return Object.freeze({
    createJournal,
    getJournal,
    getSession,
    mutateJournal,
    mutateSession,
    startSession,
  });
};

type RitualJournalRuntimeConfiguration = Readonly<{
  privateContentKeyring?: PrivateContentKeyringInput | undefined;
  reflectionPolicy?: Readonly<{ policyVersion: string }> | undefined;
}>;

let runtimeService: RitualJournalApplicationService | undefined;

const loadRuntimeService = (): RitualJournalApplicationService => {
  if (runtimeService !== undefined) return runtimeService;
  const configuration = getWebRuntimeConfiguration();
  const ritualConfiguration = configuration as typeof configuration &
    RitualJournalRuntimeConfiguration;
  if (
    configuration.databaseUrl === undefined ||
    ritualConfiguration.privateContentKeyring === undefined ||
    ritualConfiguration.reflectionPolicy?.policyVersion !== reflectionPolicyVersion
  ) {
    throw new ReflectionLoopApplicationError("unavailable");
  }
  runtimeService = createRitualJournalApplicationService({
    cryptography: createPrivateContentCryptography(ritualConfiguration.privateContentKeyring),
    persistence: createRitualJournalPersistence(loadWebDatabase()),
  });
  return runtimeService;
};

export const startWebRitualSession = (
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().startSession(
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const mutateWebRitualSession = (
  id: string,
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().mutateSession(
    id,
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const getWebRitualSessionV2 = (
  id: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().getSession(id, anonymousSessionToken, accountSessionToken);

export const createWebJournalEntryV2 = (
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

export const mutateWebJournalEntry = (
  id: string,
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().mutateJournal(
    id,
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const getWebJournalEntryV2 = (
  id: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().getJournal(id, anonymousSessionToken, accountSessionToken);
