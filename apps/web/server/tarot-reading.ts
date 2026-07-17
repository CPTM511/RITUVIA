import "server-only";

import {
  assertTarotCatalogPublicationEligible,
  parseTarotCatalogV1,
  parseTarotDrawExecutionV1,
  projectTarotDrawFactsV1,
  resolveTarotDrawV1,
  tarotDrawRulesVersion,
  type TarotCatalogV1,
  type TarotOrientationPolicy,
} from "@rituvia/divination";
import {
  parseTarotReadingCreateRequestV1,
  parseTarotReadingReportRequestV1,
  tarotReadingCreateSchemaVersion,
  type TarotReadingType,
} from "@rituvia/domain";
import type {
  PersistedTarotReading as DatabasePersistedTarotReading,
  TarotReadingPersistence as DatabaseTarotReadingPersistence,
} from "@rituvia/db";

import {
  createTarotCatalogChecksum,
  createTarotReadingCryptography,
  tarotReadingDigestsEqual,
  type TarotReadingIntegrityKeyringInput,
} from "./tarot-reading-crypto";
import {
  tarotReadingResponseSchemaVersion,
  type TarotReadingPublicResponseV2,
} from "../app/_contracts/tarot-reading-response";
import { projectTarotReadingPresentationV1 } from "./tarot-reading-presentation";

export const tarotReadingPolicySchemaVersion = "tarot-reading-policy.v1" as const;

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const approvalPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

type VersionReference = Readonly<{ id: string; version: string }>;

export type TarotReadingPolicyV1 = Readonly<{
  catalog: Readonly<{
    approvalReference: string;
    checksum: string;
    id: string;
    version: string;
  }>;
  deck: VersionReference;
  locale: "en";
  maximumReadingsPerWindow: number;
  orientationPolicy: TarotOrientationPolicy;
  policyVersion: string;
  schemaVersion: typeof tarotReadingPolicySchemaVersion;
  spreads: Readonly<Record<TarotReadingType, VersionReference>>;
  windowSeconds: number;
}>;

export type TarotReadingCatalogProvider = Readonly<{
  load(reference: Readonly<{ id: string; version: string }>): Promise<unknown>;
}>;

export type PersistedTarotReading = DatabasePersistedTarotReading;
export type TarotReadingPersistence = DatabaseTarotReadingPersistence;

export type TarotReadingApplicationErrorCode =
  "conflict" | "limit_reached" | "not_found" | "session_required" | "unavailable";

export class TarotReadingApplicationError extends Error {
  public readonly code: TarotReadingApplicationErrorCode;
  public readonly retryAfterSeconds: number | undefined;

  public constructor(code: TarotReadingApplicationErrorCode, retryAfterSeconds?: number) {
    super("The tarot reading operation failed.");
    this.name = "TarotReadingApplicationError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const invalidConfiguration = (): never => {
  throw new TypeError("Tarot reading service configuration is invalid.");
};

const parseReference = (value: VersionReference): VersionReference => {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.keys(value).length !== 2 ||
    !identifierPattern.test(value.id) ||
    !versionPattern.test(value.version)
  ) {
    return invalidConfiguration();
  }
  return Object.freeze({ id: value.id, version: value.version });
};

const parsePolicy = (value: TarotReadingPolicyV1): TarotReadingPolicyV1 => {
  if (
    typeof value !== "object" ||
    value === null ||
    value.schemaVersion !== tarotReadingPolicySchemaVersion ||
    value.locale !== "en" ||
    !identifierPattern.test(value.policyVersion) ||
    !Number.isSafeInteger(value.maximumReadingsPerWindow) ||
    value.maximumReadingsPerWindow < 1 ||
    value.maximumReadingsPerWindow > 100 ||
    !Number.isSafeInteger(value.windowSeconds) ||
    value.windowSeconds < 60 ||
    value.windowSeconds > 604_800 ||
    (value.orientationPolicy !== "upright_only" &&
      value.orientationPolicy !== "upright_and_reversed") ||
    typeof value.catalog !== "object" ||
    value.catalog === null ||
    !approvalPattern.test(value.catalog.approvalReference) ||
    !digestPattern.test(value.catalog.checksum)
  ) {
    return invalidConfiguration();
  }
  const catalogReference = parseReference({ id: value.catalog.id, version: value.catalog.version });
  return Object.freeze({
    catalog: Object.freeze({
      ...catalogReference,
      approvalReference: value.catalog.approvalReference,
      checksum: value.catalog.checksum,
    }),
    deck: parseReference(value.deck),
    locale: "en",
    maximumReadingsPerWindow: value.maximumReadingsPerWindow,
    orientationPolicy: value.orientationPolicy,
    policyVersion: value.policyVersion,
    schemaVersion: tarotReadingPolicySchemaVersion,
    spreads: Object.freeze({
      one_card: parseReference(value.spreads.one_card),
      three_card: parseReference(value.spreads.three_card),
    }),
    windowSeconds: value.windowSeconds,
  });
};

const parseInstant = (value: string): number => {
  if (!utcInstantPattern.test(value)) return invalidConfiguration();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return invalidConfiguration();
  }
  return milliseconds;
};

const dateOnly = (value: Date): string => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return invalidConfiguration();
  return value.toISOString().slice(0, 10);
};

const resolveDeckCardCount = (catalog: TarotCatalogV1, deck: VersionReference): number => {
  const resolved = catalog.decks.find(
    (candidate) => candidate.deckId === deck.id && candidate.version === deck.version,
  );
  return resolved?.cards.length ?? invalidConfiguration();
};

const digestFromStored = (value: string): string =>
  digestPattern.test(value) ? value : invalidConfiguration();

export const createTarotReadingApplicationService = (
  input: Readonly<{
    catalogProvider: TarotReadingCatalogProvider;
    clock: () => Date;
    integrityKeys: TarotReadingIntegrityKeyringInput;
    persistence: TarotReadingPersistence;
    policy: TarotReadingPolicyV1;
  }>,
) => {
  const policy = parsePolicy(input.policy);
  if (
    input.persistence.limits.maximumReadingsPerWindow !== policy.maximumReadingsPerWindow ||
    input.persistence.limits.policyVersion !== policy.policyVersion ||
    input.persistence.limits.windowSeconds !== policy.windowSeconds
  ) {
    return invalidConfiguration();
  }
  const cryptography = createTarotReadingCryptography(input.integrityKeys);
  const catalogCache = new Map<string, Promise<TarotCatalogV1>>();

  const loadCatalog = async (reference: TarotReadingPolicyV1["catalog"], eligible: boolean) => {
    const cacheKey = `${reference.id}\0${reference.version}\0${reference.checksum}\0${reference.approvalReference}`;
    let pending = catalogCache.get(cacheKey);
    if (pending === undefined) {
      if (catalogCache.size >= 16) throw new TarotReadingApplicationError("unavailable");
      pending = input.catalogProvider.load(reference).then((raw) => {
        const parsed = parseTarotCatalogV1(raw);
        if (
          parsed.catalogId !== reference.id ||
          parsed.version !== reference.version ||
          parsed.editorial.approvalReference !== reference.approvalReference ||
          !tarotReadingDigestsEqual(
            createTarotCatalogChecksum(JSON.stringify(parsed)),
            reference.checksum,
          )
        ) {
          throw new TarotReadingApplicationError("unavailable");
        }
        return parsed;
      });
      catalogCache.set(cacheKey, pending);
    }
    const catalog = await pending;
    if (eligible) {
      assertTarotCatalogPublicationEligible(catalog, dateOnly(input.clock()));
    }
    return catalog;
  };

  const verifyReading = async (
    reading: PersistedTarotReading,
  ): Promise<TarotReadingPublicResponseV2> => {
    if (
      !uuidV4Pattern.test(reading.id) ||
      !uuidV4Pattern.test(reading.subjectId) ||
      reading.status !== "facts_ready" ||
      reading.requestSchemaVersion !== tarotReadingCreateSchemaVersion ||
      reading.readingPolicyVersion.length > 100 ||
      !identifierPattern.test(reading.readingPolicyVersion) ||
      !cryptography.keyVersions.includes(reading.integrityKeyVersion) ||
      reading.idempotencyKeyVersion !== reading.integrityKeyVersion ||
      reading.integrityScheme !== "hmac-sha256.tarot-reading.v1" ||
      parseInstant(reading.expiresAt) <= parseInstant(reading.createdAt)
    ) {
      return invalidConfiguration();
    }
    const request = parseTarotReadingCreateRequestV1({
      locale: reading.locale,
      readingType: reading.readingType,
      schemaVersion: reading.requestSchemaVersion,
      themeCode: reading.themeCode,
    });
    const expectedClientDigest = cryptography.deriveClientRequestDigest(
      reading.integrityKeyVersion,
      reading.subjectId,
      request,
    );
    if (
      !tarotReadingDigestsEqual(expectedClientDigest, digestFromStored(reading.clientRequestDigest))
    ) {
      return invalidConfiguration();
    }
    const execution = parseTarotDrawExecutionV1(reading.execution);
    const expectedRequestDigest = cryptography.deriveRequestDigest(reading.integrityKeyVersion, {
      catalog: {
        approvalReference: reading.catalog.approvalReference,
        checksum: reading.catalog.checksumSha256,
        ...execution.facts.catalog,
      },
      deck: execution.facts.deck,
      locale: request.locale,
      orientationPolicy: execution.facts.orientationPolicy,
      readingId: reading.id,
      readingPolicyVersion: reading.readingPolicyVersion,
      readingType: request.readingType,
      spread: execution.facts.spread,
      subjectId: reading.subjectId,
      themeCode: request.themeCode,
    });
    if (
      !tarotReadingDigestsEqual(expectedRequestDigest, execution.audit.requestDigest) ||
      !tarotReadingDigestsEqual(expectedRequestDigest, reading.drawRequestDigest) ||
      !tarotReadingDigestsEqual(
        digestFromStored(reading.idempotencyKeyDigest),
        execution.audit.idempotencyKeyDigest,
      )
    ) {
      return invalidConfiguration();
    }
    const catalog = await loadCatalog(
      {
        approvalReference: reading.catalog.approvalReference,
        checksum: reading.catalog.checksumSha256,
        id: reading.catalog.id,
        version: reading.catalog.version,
      },
      false,
    );
    const deckCardCount = resolveDeckCardCount(catalog, execution.facts.deck);
    const binding = Object.freeze({
      catalogApprovalReference: reading.catalog.approvalReference,
      catalogChecksum: reading.catalog.checksumSha256,
      clientRequestDigest: reading.clientRequestDigest,
      idempotencyKeyDigest: reading.idempotencyKeyDigest,
      integrityKeyVersion: reading.integrityKeyVersion,
      locale: request.locale,
      readingId: reading.id,
      readingPolicyVersion: reading.readingPolicyVersion,
      readingType: request.readingType,
      requestDigest: expectedRequestDigest,
      subjectId: reading.subjectId,
      themeCode: request.themeCode,
    });
    const verifier = cryptography.createExecutionVerifier(binding, deckCardCount);
    const verifiedExecution = resolveTarotDrawV1({
      catalog,
      existingExecution: execution,
      existingExecutionVerifier: verifier,
      request: {
        catalog: execution.facts.catalog,
        deck: execution.facts.deck,
        idempotencyKeyDigest: reading.idempotencyKeyDigest,
        method: "tarot",
        orientationPolicy: execution.facts.orientationPolicy,
        requestDigest: expectedRequestDigest,
        rulesVersion: tarotDrawRulesVersion,
        schemaVersion: "tarot-draw-request.v1",
        spread: execution.facts.spread,
      },
    });
    const facts = projectTarotDrawFactsV1(verifiedExecution, verifier);
    const presentation = projectTarotReadingPresentationV1(catalog, facts, request.themeCode);
    return Object.freeze({
      createdAt: reading.createdAt,
      facts,
      locale: request.locale,
      presentation,
      readingId: reading.id,
      readingPolicyVersion: reading.readingPolicyVersion,
      readingType: request.readingType,
      schemaVersion: tarotReadingResponseSchemaVersion,
      status: "facts_ready",
      themeCode: request.themeCode,
    });
  };

  const create = async (requestInput: unknown, idempotencyKey: string, sessionToken: string) => {
    const request = parseTarotReadingCreateRequestV1(requestInput);
    try {
      const spread =
        request.readingType === "one_card" ? policy.spreads.one_card : policy.spreads.three_card;
      const resolved = await input.persistence.resolveCreate({
        prepare: ({ readingPolicyVersion, request: preparedRequest, subjectId }) => {
          if (
            readingPolicyVersion !== policy.policyVersion ||
            preparedRequest.locale !== request.locale ||
            preparedRequest.readingType !== request.readingType ||
            preparedRequest.schemaVersion !== request.schemaVersion ||
            preparedRequest.themeCode !== request.themeCode
          ) {
            return invalidConfiguration();
          }
          const candidates = Object.freeze(
            cryptography.keyVersions.map((integrityKeyVersion) =>
              Object.freeze({
                clientRequestDigest: cryptography.deriveClientRequestDigest(
                  integrityKeyVersion,
                  subjectId,
                  request,
                ),
                idempotencyKeyDigest: cryptography.deriveIdempotencyKeyDigest(
                  integrityKeyVersion,
                  subjectId,
                  idempotencyKey,
                ),
                idempotencyKeyVersion: integrityKeyVersion,
              }),
            ),
          );
          const activeCandidate = candidates.find(
            ({ idempotencyKeyVersion }) => idempotencyKeyVersion === cryptography.activeVersion,
          );
          if (activeCandidate === undefined) return invalidConfiguration();
          return Object.freeze({
            activeIdempotencyKeyVersion: cryptography.activeVersion,
            catalog: Object.freeze({
              approvalReference: policy.catalog.approvalReference,
              checksumSha256: policy.catalog.checksum,
              id: policy.catalog.id,
              version: policy.catalog.version,
            }),
            candidates,
            createExecution: async ({
              catalog: persistedCatalog,
              idempotencyKeyDigest,
              integrityKeyVersion,
              readingId,
              subjectId: persistedSubjectId,
            }) => {
              if (
                persistedSubjectId !== subjectId ||
                integrityKeyVersion !== cryptography.activeVersion ||
                idempotencyKeyDigest !== activeCandidate.idempotencyKeyDigest ||
                persistedCatalog.id !== policy.catalog.id ||
                persistedCatalog.version !== policy.catalog.version ||
                persistedCatalog.checksumSha256 !== policy.catalog.checksum ||
                persistedCatalog.approvalReference !== policy.catalog.approvalReference
              ) {
                return invalidConfiguration();
              }
              const catalog = await loadCatalog(policy.catalog, true);
              if (!catalog.supportedThemeCodes.includes(request.themeCode)) {
                throw new TarotReadingApplicationError("unavailable");
              }
              const deckCardCount = resolveDeckCardCount(catalog, policy.deck);
              const requestDigest = cryptography.deriveRequestDigest(
                activeCandidate.idempotencyKeyVersion,
                {
                  catalog: policy.catalog,
                  deck: policy.deck,
                  locale: request.locale,
                  orientationPolicy: policy.orientationPolicy,
                  readingId,
                  readingPolicyVersion: policy.policyVersion,
                  readingType: request.readingType,
                  spread,
                  subjectId,
                  themeCode: request.themeCode,
                },
              );
              const binding = Object.freeze({
                catalogApprovalReference: policy.catalog.approvalReference,
                catalogChecksum: policy.catalog.checksum,
                clientRequestDigest: activeCandidate.clientRequestDigest,
                idempotencyKeyDigest: activeCandidate.idempotencyKeyDigest,
                integrityKeyVersion: activeCandidate.idempotencyKeyVersion,
                locale: request.locale,
                readingId,
                readingPolicyVersion: policy.policyVersion,
                readingType: request.readingType,
                requestDigest,
                subjectId,
                themeCode: request.themeCode,
              });
              const execution = resolveTarotDrawV1({
                catalog,
                entropy: cryptography.createEntropy(binding, deckCardCount),
                request: {
                  catalog: { id: policy.catalog.id, version: policy.catalog.version },
                  deck: policy.deck,
                  idempotencyKeyDigest: activeCandidate.idempotencyKeyDigest,
                  method: "tarot",
                  orientationPolicy: policy.orientationPolicy,
                  requestDigest,
                  rulesVersion: tarotDrawRulesVersion,
                  schemaVersion: "tarot-draw-request.v1",
                  spread,
                },
              });
              const verifier = cryptography.createExecutionVerifier(binding, deckCardCount);
              projectTarotDrawFactsV1(execution, verifier);
              return execution;
            },
            integrityKeyVersion: cryptography.activeVersion,
            integrityScheme: "hmac-sha256.tarot-reading.v1" as const,
          });
        },
        request,
        token: sessionToken,
      });
      return Object.freeze({
        kind: resolved.kind,
        response: await verifyReading(resolved.reading),
      });
    } catch (error) {
      if (error instanceof TarotReadingApplicationError) throw error;
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "TAROT_READING_IDEMPOTENCY_CONFLICT" ||
          error.code === "TAROT_READING_RATE_LIMITED" ||
          error.code === "TAROT_READING_SESSION_UNAVAILABLE")
      ) {
        const retryAfterSeconds =
          "retryAfterSeconds" in error &&
          Number.isSafeInteger(error.retryAfterSeconds) &&
          (error.retryAfterSeconds as number) >= 1 &&
          (error.retryAfterSeconds as number) <= policy.windowSeconds
            ? (error.retryAfterSeconds as number)
            : undefined;
        const code =
          error.code === "TAROT_READING_IDEMPOTENCY_CONFLICT"
            ? "conflict"
            : error.code === "TAROT_READING_RATE_LIMITED"
              ? "limit_reached"
              : "session_required";
        throw new TarotReadingApplicationError(code, retryAfterSeconds);
      }
      throw new TarotReadingApplicationError("unavailable");
    }
  };

  const get = async (readingId: string, sessionToken: string) => {
    if (!uuidV4Pattern.test(readingId)) return null;
    try {
      const reading = await input.persistence.get({ readingId, token: sessionToken });
      return reading === null ? null : await verifyReading(reading);
    } catch (error) {
      if (error instanceof TarotReadingApplicationError) throw error;
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "TAROT_READING_SESSION_UNAVAILABLE"
      ) {
        throw new TarotReadingApplicationError("session_required");
      }
      throw new TarotReadingApplicationError("unavailable");
    }
  };

  const report = async (
    readingId: string,
    requestInput: unknown,
    idempotencyKey: string,
    sessionToken: string,
  ) => {
    if (!uuidV4Pattern.test(readingId)) throw new TarotReadingApplicationError("not_found");
    const request = parseTarotReadingReportRequestV1(requestInput);
    try {
      return await input.persistence.report({
        prepare: ({
          readingId: persistedReadingId,
          reportPolicyVersion,
          request: preparedRequest,
          subjectId,
        }) => {
          if (
            persistedReadingId !== readingId ||
            preparedRequest.category !== request.category ||
            preparedRequest.schemaVersion !== request.schemaVersion ||
            JSON.stringify(preparedRequest.target) !== JSON.stringify(request.target)
          ) {
            return invalidConfiguration();
          }
          return Object.freeze({
            activeIdempotencyKeyVersion: cryptography.activeVersion,
            candidates: Object.freeze(
              cryptography.keyVersions.map((idempotencyKeyVersion) =>
                Object.freeze({
                  canonicalRequestDigest: cryptography.deriveReportRequestDigest(
                    idempotencyKeyVersion,
                    subjectId,
                    readingId,
                    reportPolicyVersion,
                    request,
                  ),
                  idempotencyKeyDigest: cryptography.deriveReportIdempotencyKeyDigest(
                    idempotencyKeyVersion,
                    subjectId,
                    idempotencyKey,
                  ),
                  idempotencyKeyVersion,
                }),
              ),
            ),
          });
        },
        readingId,
        request,
        token: sessionToken,
      });
    } catch (error) {
      if (error instanceof TarotReadingApplicationError) throw error;
      if (typeof error === "object" && error !== null && "code" in error) {
        if (error.code === "TAROT_READING_IDEMPOTENCY_CONFLICT") {
          throw new TarotReadingApplicationError("conflict");
        }
        if (
          error.code === "TAROT_READING_NOT_FOUND" ||
          error.code === "TAROT_READING_SESSION_UNAVAILABLE"
        ) {
          throw new TarotReadingApplicationError("not_found");
        }
      }
      throw new TarotReadingApplicationError("unavailable");
    }
  };

  return Object.freeze({ create, get, report });
};
