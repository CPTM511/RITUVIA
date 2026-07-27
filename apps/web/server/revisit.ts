import "server-only";

import { randomUUID } from "node:crypto";

import {
  canonicalizeRevisitMutationRequestV1,
  canonicalizeRevisitScheduleRequestV1,
  parseRevisitMutationRequestV1,
  parseRevisitResourceV1,
  parseRevisitScheduleRequestV1,
  reflectionIntentionV2SchemaVersion,
  RevisitContractError,
  type ReflectionIntentionResourceV2,
  type RevisitResourceV1,
} from "@rituvia/domain";
import {
  createRevisitPersistence,
  RevisitPersistenceError,
  type PersistedRevisit,
  type RevisitPersistence,
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
import {
  getWebIntention,
  ReflectionLoopApplicationError,
  type ReflectionLoopResult,
} from "./reflection-loop";

type RevisitMutationResult = Readonly<{
  kind: "mutated" | "replayed";
  resource: RevisitResourceV1 | null;
}>;

export type RevisitApplicationService = Readonly<{
  get(
    id: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RevisitResourceV1 | null>;
  list(
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<readonly RevisitResourceV1[]>;
  mutate(
    id: string,
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<RevisitMutationResult>;
  schedule(
    request: unknown,
    idempotencyKey: string,
    anonymousSessionToken: string | undefined,
    accountSessionToken?: string | undefined,
  ): Promise<ReflectionLoopResult<RevisitResourceV1>>;
}>;

const mapPersistenceError = (error: RevisitPersistenceError): never => {
  switch (error.code) {
    case "REVISIT_CONFLICT":
      throw new ReflectionLoopApplicationError("conflict");
    case "REVISIT_NOT_FOUND":
      throw new ReflectionLoopApplicationError("not_found");
    case "REVISIT_SCHEDULE_INVALID":
      throw new ReflectionLoopApplicationError("schedule_invalid");
    case "REVISIT_SESSION_REQUIRED":
      throw new ReflectionLoopApplicationError("session_required");
    case "REVISIT_UNAVAILABLE":
      throw new ReflectionLoopApplicationError("unavailable");
  }
};

const protect = async <Value>(operation: () => Promise<Value>): Promise<Value> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ReflectionLoopApplicationError) throw error;
    if (error instanceof RevisitPersistenceError) return mapPersistenceError(error);
    if (error instanceof RevisitContractError) {
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
  subjectId: string,
  idempotencyKey: string,
  canonicalRequest: string,
) =>
  Object.freeze({
    canonicalRequestDigest: cryptography.deriveCanonicalRequestDigest({
      canonicalRequest,
      ownerSubjectId: subjectId,
    }),
    idempotencyKeyDigest: cryptography.deriveIdempotencyKeyDigest({
      idempotencyKey,
      ownerSubjectId: subjectId,
    }),
  });

const project = (
  stored: PersistedRevisit,
  cryptography: PrivateContentCryptography,
): RevisitResourceV1 =>
  parseRevisitResourceV1({
    archivedAt: stored.archivedAt,
    completedAt: stored.completedAt,
    completionReflection:
      stored.encryptedCompletion === null
        ? null
        : cryptography.decrypt({
            context: {
              ownerSubjectId: stored.subjectId,
              purpose: "revisit.completion",
              resourceBinding: `revisit:${stored.id}`,
            },
            encrypted: stored.encryptedCompletion,
          }),
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
    id: stored.id,
    intentionId: stored.intentionId,
    intentionRevision: stored.intentionRevision,
    intentionText: cryptography.decrypt({
      context: {
        ownerSubjectId: stored.subjectId,
        purpose: "revisit.intention_snapshot",
        resourceBinding: `revisit:${stored.id}`,
      },
      encrypted: stored.encryptedIntentionText,
    }),
    isDue: stored.isDue,
    outcomeTags: stored.outcomeTags,
    policyVersion: stored.policyVersion,
    quietHours: stored.quietHours,
    reminderChannel: stored.reminderChannel,
    reminderPreference: stored.reminderPreference,
    revision: stored.revision,
    scheduledLocalDate: stored.scheduledLocalDate,
    scheduleKind: stored.scheduleKind,
    schemaVersion: stored.schemaVersion,
    smallAction: cryptography.decrypt({
      context: {
        ownerSubjectId: stored.subjectId,
        purpose: "revisit.action_snapshot",
        resourceBinding: `revisit:${stored.id}`,
      },
      encrypted: stored.encryptedSmallAction,
    }),
    status: stored.status,
    timeZone: stored.timeZone,
    updatedAt: stored.updatedAt,
  });

const requireIntentionV2 = (
  value: Awaited<ReturnType<typeof getWebIntention>>,
): ReflectionIntentionResourceV2 => {
  if (
    value === null ||
    value.schemaVersion !== reflectionIntentionV2SchemaVersion ||
    (value.status !== "active" && value.status !== "completed")
  ) {
    throw new ReflectionLoopApplicationError("not_found");
  }
  return value;
};

export const createRevisitApplicationService = (input: {
  analytics?: WebCoreLoopAnalytics;
  cryptography: PrivateContentCryptography;
  persistence: RevisitPersistence;
}): RevisitApplicationService => {
  const { cryptography, persistence } = input;
  const analytics = input.analytics ?? safeOffWebCoreLoopAnalytics;

  const schedule: RevisitApplicationService["schedule"] = async (
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseRevisitScheduleRequestV1(rawRequest);
    return protect(async () => {
      const intention = requireIntentionV2(
        await getWebIntention(request.intentionId, anonymousSessionToken, accountSessionToken),
      );
      const resourceId = randomUUID();
      const result = await persistence.schedule({
        expectedIntentionRevision: intention.revision,
        prepare: ({ subjectId }) => ({
          ...preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeRevisitScheduleRequestV1(request),
          ),
          encryptedIntentionText: cryptography.encrypt({
            context: {
              ownerSubjectId: subjectId,
              purpose: "revisit.intention_snapshot",
              resourceBinding: `revisit:${resourceId}`,
            },
            plaintext: intention.intentionText,
          }),
          encryptedSmallAction: cryptography.encrypt({
            context: {
              ownerSubjectId: subjectId,
              purpose: "revisit.action_snapshot",
              resourceBinding: `revisit:${resourceId}`,
            },
            plaintext: intention.smallAction,
          }),
        }),
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
        request,
        resourceId,
      });
      if (result.kind === "created" && intention.readingId !== null) {
        await captureCoreLoopAnalytics(analytics, {
          anonymousSessionToken,
          eventName: "revisit_scheduled",
          locale: intention.locale,
          occurredAt: result.resource.createdAt,
          properties: { scheduleKind: result.resource.scheduleKind },
          reflectionRoot: { kind: "reading", readingId: intention.readingId },
          semanticReference: result.resource.id,
          source: "server",
        });
      }
      return Object.freeze({
        kind: result.kind,
        resource: project(result.resource, cryptography),
      });
    });
  };

  const mutate: RevisitApplicationService["mutate"] = async (
    id,
    rawRequest,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  ) => {
    const request = parseRevisitMutationRequestV1(rawRequest);
    return protect(async () => {
      const result = await persistence.mutate({
        id,
        prepare: ({ resourceId, subjectId }) => ({
          ...preparedDigests(
            cryptography,
            subjectId,
            idempotencyKey,
            canonicalizeRevisitMutationRequestV1(request),
          ),
          ...(request.action === "complete"
            ? {
                encryptedCompletion: cryptography.encrypt({
                  context: {
                    ownerSubjectId: subjectId,
                    purpose: "revisit.completion",
                    resourceBinding: `revisit:${resourceId}`,
                  },
                  plaintext: request.reflection,
                }),
              }
            : {}),
        }),
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
          eventName: "revisit_completed",
          locale: "en",
          occurredAt: result.resource.completedAt,
          properties: {},
          reflectionRoot: { intentionId: result.resource.intentionId, kind: "intention" },
          semanticReference: result.resource.id,
          source: "server",
        });
      }
      return Object.freeze({
        kind: result.kind,
        resource: result.resource === null ? null : project(result.resource, cryptography),
      });
    });
  };

  const get: RevisitApplicationService["get"] = (id, anonymousSessionToken, accountSessionToken) =>
    protect(async () => {
      const stored = await persistence.get({
        id,
        principal: principalTokens(anonymousSessionToken, accountSessionToken),
      });
      return stored === null ? null : project(stored, cryptography);
    });

  const list: RevisitApplicationService["list"] = (anonymousSessionToken, accountSessionToken) =>
    protect(async () =>
      (
        await persistence.list({
          principal: principalTokens(anonymousSessionToken, accountSessionToken),
        })
      ).map((stored) => project(stored, cryptography)),
    );

  return Object.freeze({ get, list, mutate, schedule });
};

type RevisitRuntimeConfiguration = Readonly<{
  privateContentKeyring?: PrivateContentKeyringInput | undefined;
}>;

let runtimeService: RevisitApplicationService | undefined;

const loadRuntimeService = (): RevisitApplicationService => {
  if (runtimeService !== undefined) return runtimeService;
  const configuration = getWebRuntimeConfiguration();
  const revisitConfiguration = configuration as typeof configuration & RevisitRuntimeConfiguration;
  if (
    configuration.databaseUrl === undefined ||
    revisitConfiguration.privateContentKeyring === undefined
  ) {
    throw new ReflectionLoopApplicationError("unavailable");
  }
  runtimeService = createRevisitApplicationService({
    cryptography: createPrivateContentCryptography(revisitConfiguration.privateContentKeyring),
    persistence: createRevisitPersistence(loadWebDatabase()),
  });
  return runtimeService;
};

export const scheduleWebRevisit = (
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().schedule(
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const mutateWebRevisit = (
  id: string,
  request: unknown,
  idempotencyKey: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) =>
  loadRuntimeService().mutate(
    id,
    request,
    idempotencyKey,
    anonymousSessionToken,
    accountSessionToken,
  );

export const getWebRevisit = (
  id: string,
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().get(id, anonymousSessionToken, accountSessionToken);

export const listWebRevisits = (
  anonymousSessionToken: string | undefined,
  accountSessionToken?: string | undefined,
) => loadRuntimeService().list(anonymousSessionToken, accountSessionToken);
