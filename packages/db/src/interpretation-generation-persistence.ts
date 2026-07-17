import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { assertAnonymousIdentityRuntimeDatabasePrivileges } from "./anonymous-identity.js";
import { assertTarotReadingRuntimeDatabasePrivileges } from "./tarot-reading-persistence.js";

const generationSchemaVersion = "interpretation-generation.v1" as const;
const generationProvenanceSchemaVersion = "interpretation-generation-provenance.v1" as const;
const maximumJsonBytes = 65_536;
const maximumJsonDepth = 24;
const maximumJsonNodes = 8_192;
const maximumPostgresInteger = 2_147_483_647;
const minimumFinalizeLeaseBufferMs = 30_000;

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const looseVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const currencyCodePattern = /^[A-Z]{3}$/u;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;
const forbiddenProvenanceKeys = new Set([
  "authorization",
  "error",
  "messages",
  "outputJson",
  "promptMessages",
  "providerOutput",
  "question",
  "rawQuestion",
  "riskCategories",
]);

const failureCodes = Object.freeze([
  "aborted",
  "configuration",
  "content_filtered",
  "invalid_request",
  "invalid_response",
  "quota_exceeded",
  "rate_limited",
  "timeout",
  "unavailable",
  "unknown",
] as const);
type InterpretationGenerationFailureCode = (typeof failureCodes)[number];
const fallbackFailureCodes = new Set<InterpretationGenerationFailureCode>([
  "aborted",
  "content_filtered",
  "invalid_response",
  "quota_exceeded",
  "rate_limited",
  "timeout",
  "unavailable",
]);
const failedFailureCodes = new Set<InterpretationGenerationFailureCode>([
  "configuration",
  "invalid_request",
  "unknown",
]);
const retryReasons = Object.freeze(["rate_limited", "unavailable", "invalid_response"] as const);
type InterpretationGenerationRetryReason = (typeof retryReasons)[number];

export const interpretationGenerationPersistenceErrorCodes = Object.freeze([
  "INTERPRETATION_GENERATION_SESSION_UNAVAILABLE",
  "INTERPRETATION_GENERATION_READING_NOT_FOUND",
  "INTERPRETATION_GENERATION_IDEMPOTENCY_CONFLICT",
  "INTERPRETATION_GENERATION_CLAIM_LOST",
  "INTERPRETATION_GENERATION_INPUT_INVALID",
  "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
] as const);

export type InterpretationGenerationPersistenceErrorCode =
  (typeof interpretationGenerationPersistenceErrorCodes)[number];

const persistenceMessage = (code: InterpretationGenerationPersistenceErrorCode): string => {
  switch (code) {
    case "INTERPRETATION_GENERATION_SESSION_UNAVAILABLE":
      return "The interpretation session is unavailable.";
    case "INTERPRETATION_GENERATION_READING_NOT_FOUND":
      return "The interpretation reading is unavailable.";
    case "INTERPRETATION_GENERATION_IDEMPOTENCY_CONFLICT":
      return "The interpretation generation request conflicts.";
    case "INTERPRETATION_GENERATION_CLAIM_LOST":
      return "The interpretation generation claim is unavailable.";
    case "INTERPRETATION_GENERATION_INPUT_INVALID":
      return "The interpretation generation persistence input is invalid.";
    case "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE":
      return "Interpretation generation storage is unavailable.";
  }
};

export class InterpretationGenerationPersistenceError extends Error {
  readonly code: InterpretationGenerationPersistenceErrorCode;

  constructor(code: InterpretationGenerationPersistenceErrorCode) {
    super(persistenceMessage(code));
    this.name = "InterpretationGenerationPersistenceError";
    this.code = code;
  }
}

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonArray | JsonObject;
type JsonArray = readonly JsonValue[];
interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type InterpretationGenerationVersionReferenceV1 = Readonly<{
  id: string;
  version: string;
}>;

export type InterpretationGenerationChecksummedReferenceV1 = Readonly<{
  approvalReference: string;
  checksum: string;
  id: string;
  version: string;
}>;

export type InterpretationGenerationProvenanceV1 = Readonly<{
  assemblyPolicyVersion: string;
  content: JsonObject;
  deterministicFacts: JsonObject;
  deterministicEngine: Readonly<{
    algorithmVersion: string;
    engineName: string;
    engineVersion: string;
    rulesVersion: string;
  }>;
  fallbackTemplate: InterpretationGenerationChecksummedReferenceV1;
  inputSchemaVersion: string;
  locale: "en";
  modality: "tarot";
  outputSchema: Readonly<{ checksum: string; id: string; version: string }>;
  prompt: JsonObject;
  retrievalPolicyVersion: string;
  safetyPolicyVersion: string;
  schemaVersion: typeof generationProvenanceSchemaVersion;
  themeCode: string;
  tone: "concise" | "gentle" | "grounded" | "poetic-light";
  tradition: string;
}>;

export type InterpretationGenerationClaimProvenanceV1 = Readonly<{
  assemblyPolicyVersion: string;
  attemptTimeoutMs: number;
  contentVersions: readonly string[];
  deterministicAlgorithmVersion: string;
  deterministicEngineName: string;
  deterministicEngineVersion: string;
  deterministicRulesVersion: string;
  eligibilityAsOf: string;
  fallbackTemplate: InterpretationGenerationChecksummedReferenceV1;
  generationPolicyVersion: string;
  generationProvenance: InterpretationGenerationProvenanceV1;
  locale: "en";
  maxAttempts: 1 | 2;
  maxOutputTokens: number;
  maximumEstimatedCostMicros: number;
  modality: "tarot";
  model: InterpretationGenerationVersionReferenceV1;
  outputSchemaVersion: string;
  prompt: InterpretationGenerationChecksummedReferenceV1;
  provider: InterpretationGenerationVersionReferenceV1 & Readonly<{ approvalReference: string }>;
  readingType: "one_card" | "three_card";
  retryDelayMs: number;
  retrievalPolicyVersion: string;
  safetyPolicyVersion: string;
  themeCode: string;
  tone: "concise" | "gentle" | "grounded" | "poetic-light";
  totalTimeoutMs: number;
  currencyCode: string;
}>;

export type InterpretationGenerationOperationalMetadataV1 = Readonly<{
  attemptCount: 0 | 1 | 2;
  costStatus: "reported" | "unavailable";
  currencyCode: string | null;
  estimatedCostMicros: number | null;
  failureCode: InterpretationGenerationFailureCode | null;
  inputTokens: number | null;
  latencyMs: number;
  outputTokens: number | null;
  retryReason: InterpretationGenerationRetryReason | null;
  tokenStatus: "reported" | "unavailable";
  totalTokens: number | null;
}>;

export type InterpretationGenerationCompletionV1 =
  | Readonly<{
      operational: InterpretationGenerationOperationalMetadataV1;
      status: "pending_verification";
    }>
  | Readonly<{
      operational: InterpretationGenerationOperationalMetadataV1;
      output: JsonValue;
      status: "fallback";
    }>
  | Readonly<{
      operational: InterpretationGenerationOperationalMetadataV1;
      status: "failed";
    }>;

type PersistedInterpretationBase = Readonly<{
  completedAt: string;
  createdAt: string;
  expiresAt: string;
  generationNumber: 1;
  generationSchemaVersion: typeof generationSchemaVersion;
  id: string;
  operational: InterpretationGenerationOperationalMetadataV1;
  provenance: InterpretationGenerationClaimProvenanceV1;
  readingId: string;
  requestId: string;
  subjectId: string;
}>;

export type PersistedInterpretationGeneration =
  | (PersistedInterpretationBase & Readonly<{ status: "pending_verification" }>)
  | (PersistedInterpretationBase & Readonly<{ status: "failed" }>)
  | (PersistedInterpretationBase & Readonly<{ output: JsonValue; status: "fallback" }>);

export type InterpretationGenerationClaimResult =
  | Readonly<{
      claimToken: string;
      claimVersion: number;
      interpretationId: string;
      kind: "claimed" | "reclaimed";
      leaseExpiresAt: string;
      providerEligible: boolean;
    }>
  | Readonly<{
      interpretationId: string;
      kind: "in_progress";
      leaseExpiresAt: string;
    }>
  | Readonly<{
      interpretation: PersistedInterpretationGeneration;
      kind: "replayed";
    }>;

export type InterpretationGenerationFinalizeResult = Readonly<{
  interpretation: PersistedInterpretationGeneration;
  kind: "finalized" | "replayed";
}>;

export type InterpretationGenerationPersistence = Readonly<{
  claim(
    input: Readonly<{
      canonicalRequestDigest: string;
      generationSchemaVersion: typeof generationSchemaVersion;
      idempotencyKeyDigest: string;
      idempotencyKeyVersion: string;
      provenance: InterpretationGenerationClaimProvenanceV1;
      readingId: string;
      requestId: string;
      token: string;
    }>,
  ): Promise<InterpretationGenerationClaimResult>;
  finalize(
    input: Readonly<{
      claimToken: string;
      claimVersion: number;
      completion: InterpretationGenerationCompletionV1;
      completionDigest: string;
      interpretationId: string;
      token: string;
    }>,
  ): Promise<InterpretationGenerationFinalizeResult>;
}>;

export type InterpretationGenerationPersistencePolicy = Readonly<{
  leaseSeconds: number;
}>;

type GenerationRow = Readonly<{
  anonymousSubjectId: string;
  assemblyPolicyVersion: string;
  attemptCount: number | null;
  attemptTimeoutMs: number;
  canonicalRequestHash: Uint8Array;
  claimTokenHash: Uint8Array;
  claimVersion: number;
  completedAt: Date | null;
  contentVersions: string[];
  costStatus: string | null;
  createdAt: Date;
  currencyCode: string | null;
  deterministicAlgorithmVersion: string;
  deterministicEngineName: string;
  deterministicEngineVersion: string;
  deterministicRulesVersion: string;
  estimatedCostMicros: bigint | null;
  eligibilityAsOf: Date;
  expiresAt: Date;
  failureCode: string | null;
  fallbackOutput: unknown | null;
  fallbackTemplateApprovalReference: string;
  fallbackTemplateChecksumSha256: Uint8Array;
  fallbackTemplateId: string;
  fallbackTemplateVersion: string;
  finalizationHash: Uint8Array | null;
  generationNumber: number;
  generationPolicyVersion: string;
  generationProvenance: unknown;
  generationSchemaVersion: string;
  id: string;
  idempotencyKeyHash: Uint8Array;
  idempotencyKeyVersion: string;
  inputTokens: number | null;
  latencyMs: number | null;
  leaseExpiresAt: Date;
  locale: string;
  maxAttempts: number;
  maxOutputTokens: number;
  maximumEstimatedCostMicros: bigint;
  modality: string;
  modelId: string;
  modelVersion: string;
  observedAt: Date;
  outputSchemaVersion: string;
  outputTokens: number | null;
  promptApprovalReference: string;
  promptChecksumSha256: Uint8Array;
  promptId: string;
  promptVersion: string;
  providerApprovalReference: string;
  providerId: string;
  providerVersion: string;
  readingId: string;
  readingType: string;
  requestId: string;
  retrievalPolicyVersion: string;
  retryDelayMs: number;
  retryReason: string | null;
  safetyPolicyVersion: string;
  status: string;
  themeCode: string;
  tokenStatus: string | null;
  tone: string;
  totalTimeoutMs: number;
  totalTokens: number | null;
  approvedCurrencyCode: string;
}>;

type ActiveSessionRow = Readonly<{
  expiresAt: Date;
  subjectId: string;
}>;

type ReadingBindingRow = Readonly<{
  expiresAt: Date;
  locale: string;
  modality: string;
  readingType: string;
  observedAt: Date;
  subjectId: string;
  themeCode: string;
}>;

type JsonSnapshot = Readonly<{ serialized: string; value: JsonValue }>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...expected].sort().join("\u0000");

const invalid = (): never => {
  throw new InterpretationGenerationPersistenceError("INTERPRETATION_GENERATION_INPUT_INVALID");
};

const snapshotJson = (input: unknown, rejectForbiddenKeys = false): JsonSnapshot => {
  try {
    let nodes = 0;
    const visit = (value: unknown, depth: number): JsonValue => {
      nodes += 1;
      if (nodes > maximumJsonNodes || depth > maximumJsonDepth) invalid();
      if (
        value === null ||
        typeof value === "boolean" ||
        typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value))
      ) {
        return value as JsonPrimitive;
      }
      if (typeof value !== "object") invalid();
      if (Array.isArray(value)) {
        const items = value.map((item) => visit(item, depth + 1));
        return Object.freeze(items);
      }
      const source = value as Record<string, unknown>;
      const entries = Object.entries(source)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => {
          if (
            key.length === 0 ||
            key.length > 128 ||
            /[\u0000-\u001f\u007f]/u.test(key) ||
            (rejectForbiddenKeys && forbiddenProvenanceKeys.has(key))
          ) {
            invalid();
          }
          return [key, visit(child, depth + 1)] as const;
        });
      return Object.freeze(Object.fromEntries(entries)) as JsonObject;
    };
    const serialized = JSON.stringify(input);
    if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > maximumJsonBytes) {
      invalid();
    }
    const value = visit(JSON.parse(serialized) as unknown, 0);
    return Object.freeze({ serialized: JSON.stringify(value), value });
  } catch (error) {
    if (error instanceof InterpretationGenerationPersistenceError) throw error;
    return invalid();
  }
};

const parseIdentifier = (value: unknown): string =>
  typeof value === "string" && value.length <= 100 && identifierPattern.test(value)
    ? value
    : invalid();

const parseVersion = (value: unknown): string =>
  typeof value === "string" && value.length <= 100 && semanticVersionPattern.test(value)
    ? value
    : invalid();

const parseLooseVersion = (value: unknown): string =>
  typeof value === "string" && value.length <= 100 && looseVersionPattern.test(value)
    ? value
    : invalid();

const parseApprovalReference = (value: unknown): string =>
  typeof value === "string" && value.length <= 200 && approvalReferencePattern.test(value)
    ? value
    : invalid();

const parseDigest = (value: unknown): string =>
  typeof value === "string" && sha256DigestPattern.test(value) ? value : invalid();

const parseDate = (value: unknown): string => {
  if (typeof value !== "string" || !datePattern.test(value)) return invalid();
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    return invalid();
  return value;
};

const parseChecksummedReference = (
  value: unknown,
): InterpretationGenerationChecksummedReferenceV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !exactKeys(candidate, ["approvalReference", "checksum", "id", "version"])
  ) {
    return invalid();
  }
  return Object.freeze({
    approvalReference: parseApprovalReference(candidate.approvalReference),
    checksum: parseDigest(candidate.checksum),
    id: parseIdentifier(candidate.id),
    version: parseVersion(candidate.version),
  });
};

const parseVersionReference = (value: unknown): InterpretationGenerationVersionReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, ["id", "version"])) return invalid();
  return Object.freeze({
    id: parseIdentifier(candidate.id),
    version: parseVersion(candidate.version),
  });
};

const parseGenerationProvenance = (
  value: unknown,
): Readonly<{
  serialized: string;
  value: InterpretationGenerationProvenanceV1;
}> => {
  const snapshot = snapshotJson(value, true);
  const candidate = record(snapshot.value);
  if (
    candidate === null ||
    !exactKeys(candidate, [
      "assemblyPolicyVersion",
      "content",
      "deterministicFacts",
      "deterministicEngine",
      "fallbackTemplate",
      "inputSchemaVersion",
      "locale",
      "modality",
      "outputSchema",
      "prompt",
      "retrievalPolicyVersion",
      "safetyPolicyVersion",
      "schemaVersion",
      "themeCode",
      "tone",
      "tradition",
    ]) ||
    candidate.schemaVersion !== generationProvenanceSchemaVersion ||
    candidate.locale !== "en" ||
    candidate.modality !== "tarot" ||
    !["concise", "gentle", "grounded", "poetic-light"].includes(String(candidate.tone))
  ) {
    return invalid();
  }
  const engine = record(candidate.deterministicEngine);
  const outputSchema = record(candidate.outputSchema);
  const content = record(candidate.content);
  const deterministicFacts = record(candidate.deterministicFacts);
  const prompt = record(candidate.prompt);
  if (
    engine === null ||
    !exactKeys(engine, ["algorithmVersion", "engineName", "engineVersion", "rulesVersion"]) ||
    outputSchema === null ||
    !exactKeys(outputSchema, ["checksum", "id", "version"]) ||
    content === null ||
    deterministicFacts === null ||
    prompt === null
  ) {
    return invalid();
  }
  parseIdentifier(engine.engineName);
  parseVersion(engine.engineVersion);
  parseIdentifier(engine.algorithmVersion);
  parseIdentifier(engine.rulesVersion);
  parseDigest(outputSchema.checksum);
  parseIdentifier(outputSchema.id);
  parseLooseVersion(outputSchema.version);
  parseIdentifier(candidate.assemblyPolicyVersion);
  parseIdentifier(candidate.inputSchemaVersion);
  parseIdentifier(candidate.retrievalPolicyVersion);
  parseIdentifier(candidate.safetyPolicyVersion);
  parseIdentifier(candidate.themeCode);
  parseIdentifier(candidate.tradition);
  const fallbackTemplate = parseChecksummedReference(candidate.fallbackTemplate);
  return Object.freeze({
    serialized: snapshot.serialized,
    value: Object.freeze({
      ...(candidate as unknown as InterpretationGenerationProvenanceV1),
      fallbackTemplate,
    }),
  });
};

const parseClaimProvenance = (
  value: unknown,
): Readonly<{
  generationProvenanceSerialized: string;
  value: InterpretationGenerationClaimProvenanceV1;
}> => {
  const candidate = record(value);
  if (
    candidate === null ||
    !exactKeys(candidate, [
      "assemblyPolicyVersion",
      "attemptTimeoutMs",
      "contentVersions",
      "deterministicAlgorithmVersion",
      "deterministicEngineName",
      "deterministicEngineVersion",
      "deterministicRulesVersion",
      "eligibilityAsOf",
      "fallbackTemplate",
      "generationPolicyVersion",
      "generationProvenance",
      "locale",
      "maxAttempts",
      "maxOutputTokens",
      "maximumEstimatedCostMicros",
      "modality",
      "model",
      "outputSchemaVersion",
      "prompt",
      "provider",
      "readingType",
      "retryDelayMs",
      "retrievalPolicyVersion",
      "safetyPolicyVersion",
      "themeCode",
      "tone",
      "totalTimeoutMs",
      "currencyCode",
    ])
  ) {
    return invalid();
  }
  const provider = record(candidate.provider);
  if (provider === null || !exactKeys(provider, ["approvalReference", "id", "version"])) {
    return invalid();
  }
  const providerReference = parseVersionReference({ id: provider.id, version: provider.version });
  const model = parseVersionReference(candidate.model);
  const prompt = parseChecksummedReference(candidate.prompt);
  const fallbackTemplate = parseChecksummedReference(candidate.fallbackTemplate);
  const generationProvenance = parseGenerationProvenance(candidate.generationProvenance);
  const contentVersions = candidate.contentVersions;
  if (
    candidate.locale !== "en" ||
    candidate.modality !== "tarot" ||
    (candidate.readingType !== "one_card" && candidate.readingType !== "three_card") ||
    !["concise", "gentle", "grounded", "poetic-light"].includes(String(candidate.tone)) ||
    !Array.isArray(contentVersions) ||
    contentVersions.length < 1 ||
    contentVersions.length > 24 ||
    contentVersions.some(
      (version) => typeof version !== "string" || !looseVersionPattern.test(version),
    ) ||
    new Set(contentVersions).size !== contentVersions.length ||
    !Number.isSafeInteger(candidate.maxOutputTokens) ||
    (candidate.maxOutputTokens as number) < 1 ||
    (candidate.maxOutputTokens as number) > 8_192 ||
    !Number.isSafeInteger(candidate.attemptTimeoutMs) ||
    (candidate.attemptTimeoutMs as number) < 100 ||
    (candidate.attemptTimeoutMs as number) > 120_000 ||
    !Number.isSafeInteger(candidate.totalTimeoutMs) ||
    (candidate.totalTimeoutMs as number) < (candidate.attemptTimeoutMs as number) ||
    (candidate.totalTimeoutMs as number) > 240_000 ||
    (candidate.maxAttempts !== 1 && candidate.maxAttempts !== 2) ||
    !Number.isSafeInteger(candidate.retryDelayMs) ||
    (candidate.retryDelayMs as number) < 0 ||
    (candidate.retryDelayMs as number) > 30_000 ||
    !Number.isSafeInteger(candidate.maximumEstimatedCostMicros) ||
    (candidate.maximumEstimatedCostMicros as number) < 0 ||
    (candidate.maximumEstimatedCostMicros as number) > 1_000_000_000 ||
    typeof candidate.currencyCode !== "string" ||
    !currencyCodePattern.test(candidate.currencyCode)
  ) {
    return invalid();
  }
  const valueResult = Object.freeze({
    assemblyPolicyVersion: parseIdentifier(candidate.assemblyPolicyVersion),
    attemptTimeoutMs: candidate.attemptTimeoutMs as number,
    contentVersions: Object.freeze([...contentVersions] as string[]),
    deterministicAlgorithmVersion: parseIdentifier(candidate.deterministicAlgorithmVersion),
    deterministicEngineName: parseIdentifier(candidate.deterministicEngineName),
    deterministicEngineVersion: parseVersion(candidate.deterministicEngineVersion),
    deterministicRulesVersion: parseIdentifier(candidate.deterministicRulesVersion),
    eligibilityAsOf: parseDate(candidate.eligibilityAsOf),
    fallbackTemplate,
    generationPolicyVersion: parseIdentifier(candidate.generationPolicyVersion),
    generationProvenance: generationProvenance.value,
    locale: "en" as const,
    maxAttempts: candidate.maxAttempts as 1 | 2,
    maxOutputTokens: candidate.maxOutputTokens as number,
    maximumEstimatedCostMicros: candidate.maximumEstimatedCostMicros as number,
    modality: "tarot" as const,
    model,
    outputSchemaVersion: parseLooseVersion(candidate.outputSchemaVersion),
    prompt,
    provider: Object.freeze({
      ...providerReference,
      approvalReference: parseApprovalReference(provider.approvalReference),
    }),
    readingType: candidate.readingType as "one_card" | "three_card",
    retryDelayMs: candidate.retryDelayMs as number,
    retrievalPolicyVersion: parseIdentifier(candidate.retrievalPolicyVersion),
    safetyPolicyVersion: parseIdentifier(candidate.safetyPolicyVersion),
    themeCode: parseIdentifier(candidate.themeCode),
    tone: candidate.tone as "concise" | "gentle" | "grounded" | "poetic-light",
    totalTimeoutMs: candidate.totalTimeoutMs as number,
    currencyCode: candidate.currencyCode,
  });
  const nested = generationProvenance.value;
  if (
    nested.assemblyPolicyVersion !== valueResult.assemblyPolicyVersion ||
    nested.deterministicEngine.algorithmVersion !== valueResult.deterministicAlgorithmVersion ||
    nested.deterministicEngine.engineName !== valueResult.deterministicEngineName ||
    nested.deterministicEngine.engineVersion !== valueResult.deterministicEngineVersion ||
    nested.deterministicEngine.rulesVersion !== valueResult.deterministicRulesVersion ||
    nested.fallbackTemplate.approvalReference !== fallbackTemplate.approvalReference ||
    nested.fallbackTemplate.checksum !== fallbackTemplate.checksum ||
    nested.fallbackTemplate.id !== fallbackTemplate.id ||
    nested.fallbackTemplate.version !== fallbackTemplate.version ||
    nested.locale !== valueResult.locale ||
    nested.modality !== valueResult.modality ||
    nested.outputSchema.version !== valueResult.outputSchemaVersion ||
    nested.retrievalPolicyVersion !== valueResult.retrievalPolicyVersion ||
    nested.safetyPolicyVersion !== valueResult.safetyPolicyVersion ||
    nested.themeCode !== valueResult.themeCode ||
    nested.tone !== valueResult.tone
  ) {
    return invalid();
  }
  return Object.freeze({
    generationProvenanceSerialized: generationProvenance.serialized,
    value: valueResult,
  });
};

const parseOperational = (
  value: unknown,
  maximumAttempts: number,
  maximumOutputTokens: number,
  maximumEstimatedCostMicros: number,
  approvedCurrencyCode: string,
): InterpretationGenerationOperationalMetadataV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !exactKeys(candidate, [
      "attemptCount",
      "costStatus",
      "currencyCode",
      "estimatedCostMicros",
      "failureCode",
      "inputTokens",
      "latencyMs",
      "outputTokens",
      "retryReason",
      "tokenStatus",
      "totalTokens",
    ]) ||
    !Number.isSafeInteger(candidate.attemptCount) ||
    (candidate.attemptCount as number) < 0 ||
    (candidate.attemptCount as number) > maximumAttempts ||
    !Number.isSafeInteger(candidate.latencyMs) ||
    (candidate.latencyMs as number) < 0 ||
    (candidate.latencyMs as number) > 240_000 ||
    (candidate.failureCode !== null &&
      !failureCodes.includes(candidate.failureCode as InterpretationGenerationFailureCode)) ||
    (candidate.retryReason !== null &&
      !retryReasons.includes(candidate.retryReason as InterpretationGenerationRetryReason))
  ) {
    return invalid();
  }
  const tokenStatus = candidate.tokenStatus;
  const inputTokens = candidate.inputTokens;
  const outputTokens = candidate.outputTokens;
  const totalTokens = candidate.totalTokens;
  if (
    (tokenStatus === "reported" &&
      (!Number.isSafeInteger(inputTokens) ||
        (inputTokens as number) < 0 ||
        (inputTokens as number) > maximumPostgresInteger ||
        !Number.isSafeInteger(outputTokens) ||
        (outputTokens as number) < 0 ||
        (outputTokens as number) > maximumPostgresInteger ||
        (outputTokens as number) > maximumOutputTokens * (candidate.attemptCount as number) ||
        !Number.isSafeInteger(totalTokens) ||
        (totalTokens as number) > maximumPostgresInteger ||
        totalTokens !== (inputTokens as number) + (outputTokens as number))) ||
    (tokenStatus === "unavailable" &&
      (inputTokens !== null || outputTokens !== null || totalTokens !== null)) ||
    (tokenStatus !== "reported" && tokenStatus !== "unavailable")
  ) {
    return invalid();
  }
  const costStatus = candidate.costStatus;
  const estimatedCostMicros = candidate.estimatedCostMicros;
  const currencyCode = candidate.currencyCode;
  if (
    (costStatus === "reported" &&
      (!Number.isSafeInteger(estimatedCostMicros) ||
        (estimatedCostMicros as number) < 0 ||
        (estimatedCostMicros as number) > maximumEstimatedCostMicros ||
        typeof currencyCode !== "string" ||
        currencyCode !== approvedCurrencyCode)) ||
    (costStatus === "unavailable" && (estimatedCostMicros !== null || currencyCode !== null)) ||
    (costStatus !== "reported" && costStatus !== "unavailable")
  ) {
    return invalid();
  }
  return Object.freeze({
    attemptCount: candidate.attemptCount as 0 | 1 | 2,
    costStatus,
    currencyCode: currencyCode as string | null,
    estimatedCostMicros: estimatedCostMicros as number | null,
    failureCode: candidate.failureCode as InterpretationGenerationFailureCode | null,
    inputTokens: inputTokens as number | null,
    latencyMs: candidate.latencyMs as number,
    outputTokens: outputTokens as number | null,
    retryReason: candidate.retryReason as InterpretationGenerationRetryReason | null,
    tokenStatus,
    totalTokens: totalTokens as number | null,
  });
};

const parseFallbackOutput = (value: unknown): JsonSnapshot => {
  const snapshot = snapshotJson(value);
  const candidate = record(snapshot.value);
  const expected = [
    "boundaryNote",
    "perspectives",
    "reflectionQuestions",
    "safety",
    "schemaVersion",
    "smallAction",
    "sourceRefs",
    "summary",
    "symbols",
    "title",
  ];
  if (candidate?.ritualSuggestion !== undefined) expected.push("ritualSuggestion");
  const safety = candidate === null ? null : record(candidate.safety);
  if (
    candidate === null ||
    !exactKeys(candidate, expected) ||
    candidate.schemaVersion !== "1" ||
    safety === null ||
    !exactKeys(safety, [
      "certaintyLevel",
      "containsGuaranteedOutcome",
      "containsProfessionalAdvice",
    ]) ||
    safety.certaintyLevel !== "reflective" ||
    safety.containsGuaranteedOutcome !== false ||
    safety.containsProfessionalAdvice !== false ||
    !Array.isArray(candidate.perspectives) ||
    !Array.isArray(candidate.reflectionQuestions) ||
    !Array.isArray(candidate.sourceRefs) ||
    !Array.isArray(candidate.symbols) ||
    record(candidate.smallAction) === null ||
    typeof candidate.boundaryNote !== "string" ||
    typeof candidate.summary !== "string" ||
    typeof candidate.title !== "string"
  ) {
    return invalid();
  }
  return snapshot;
};

const parseCompletion = (
  value: unknown,
  maximumAttempts: number,
  maximumOutputTokens: number,
  maximumEstimatedCostMicros: number,
  approvedCurrencyCode: string,
): Readonly<{
  operational: InterpretationGenerationOperationalMetadataV1;
  output: JsonSnapshot | null;
  status: "failed" | "fallback" | "pending_verification";
}> => {
  const candidate = record(value);
  if (
    candidate === null ||
    (candidate.status !== "pending_verification" &&
      candidate.status !== "fallback" &&
      candidate.status !== "failed")
  ) {
    return invalid();
  }
  if (
    !exactKeys(
      candidate,
      candidate.status === "fallback"
        ? ["operational", "output", "status"]
        : ["operational", "status"],
    )
  ) {
    return invalid();
  }
  const operational = parseOperational(
    candidate.operational,
    maximumAttempts,
    maximumOutputTokens,
    maximumEstimatedCostMicros,
    approvedCurrencyCode,
  );
  if (
    (candidate.status === "pending_verification" && operational.failureCode !== null) ||
    (candidate.status === "pending_verification" && operational.attemptCount < 1) ||
    (candidate.status === "fallback" &&
      (operational.failureCode === null || !fallbackFailureCodes.has(operational.failureCode))) ||
    (candidate.status === "failed" &&
      (operational.attemptCount < 1 ||
        operational.failureCode === null ||
        !failedFailureCodes.has(operational.failureCode) ||
        operational.retryReason !== null ||
        operational.tokenStatus !== "unavailable" ||
        operational.costStatus !== "unavailable")) ||
    (operational.attemptCount === 0 &&
      (candidate.status !== "fallback" ||
        operational.failureCode !== "aborted" ||
        operational.retryReason !== null ||
        operational.tokenStatus !== "unavailable" ||
        operational.costStatus !== "unavailable"))
  ) {
    return invalid();
  }
  return Object.freeze({
    operational,
    output: candidate.status === "fallback" ? parseFallbackOutput(candidate.output) : null,
    status: candidate.status,
  });
};

const digestBytes = (digest: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(Buffer.from(digest.slice("sha256:".length), "hex")) as Uint8Array<ArrayBuffer>;

const digestFromBytes = (bytes: Uint8Array): string =>
  `sha256:${Buffer.from(bytes).toString("hex")}`;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const hashOpaqueToken = async (
  token: string,
  pattern: RegExp,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!pattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
};

const createClaimToken = (): string => {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
};

const validatePolicy = (
  policy: InterpretationGenerationPersistencePolicy,
): InterpretationGenerationPersistencePolicy => {
  if (
    !Number.isSafeInteger(policy.leaseSeconds) ||
    policy.leaseSeconds < 1 ||
    policy.leaseSeconds > 300
  ) {
    return invalid();
  }
  return Object.freeze({ leaseSeconds: policy.leaseSeconds });
};

const generationSelect = Prisma.sql`
  SELECT interpretation.id,
         interpretation.reading_id AS "readingId",
         interpretation.anonymous_subject_id AS "anonymousSubjectId",
         interpretation.generation_number AS "generationNumber",
         interpretation.request_id AS "requestId",
         interpretation.status,
         interpretation.generation_schema_version AS "generationSchemaVersion",
         interpretation.generation_policy_version AS "generationPolicyVersion",
         interpretation.eligibility_as_of AS "eligibilityAsOf",
         interpretation.idempotency_key_version AS "idempotencyKeyVersion",
         interpretation.idempotency_key_hash AS "idempotencyKeyHash",
         interpretation.canonical_request_hash AS "canonicalRequestHash",
         interpretation.locale,
         interpretation.modality,
         interpretation.reading_type AS "readingType",
         interpretation.theme_code AS "themeCode",
         interpretation.tone,
         interpretation.provider_id AS "providerId",
         interpretation.provider_version AS "providerVersion",
         interpretation.model_id AS "modelId",
         interpretation.model_version AS "modelVersion",
         interpretation.provider_approval_reference AS "providerApprovalReference",
         interpretation.prompt_id AS "promptId",
         interpretation.prompt_version AS "promptVersion",
         interpretation.prompt_checksum_sha256 AS "promptChecksumSha256",
         interpretation.prompt_approval_reference AS "promptApprovalReference",
         interpretation.output_schema_version AS "outputSchemaVersion",
         interpretation.safety_policy_version AS "safetyPolicyVersion",
         interpretation.retrieval_policy_version AS "retrievalPolicyVersion",
         interpretation.assembly_policy_version AS "assemblyPolicyVersion",
         interpretation.fallback_template_id AS "fallbackTemplateId",
         interpretation.fallback_template_version AS "fallbackTemplateVersion",
         interpretation.fallback_template_checksum_sha256 AS "fallbackTemplateChecksumSha256",
         interpretation.fallback_template_approval_reference AS "fallbackTemplateApprovalReference",
         interpretation.deterministic_engine_name AS "deterministicEngineName",
         interpretation.deterministic_engine_version AS "deterministicEngineVersion",
         interpretation.deterministic_algorithm_version AS "deterministicAlgorithmVersion",
         interpretation.deterministic_rules_version AS "deterministicRulesVersion",
         interpretation.content_versions AS "contentVersions",
         interpretation.generation_provenance AS "generationProvenance",
         interpretation.max_output_tokens AS "maxOutputTokens",
         interpretation.attempt_timeout_ms AS "attemptTimeoutMs",
         interpretation.total_timeout_ms AS "totalTimeoutMs",
         interpretation.max_attempts AS "maxAttempts",
         interpretation.retry_delay_ms AS "retryDelayMs",
         interpretation.maximum_estimated_cost_micros AS "maximumEstimatedCostMicros",
         interpretation.approved_currency_code AS "approvedCurrencyCode",
         interpretation.claim_version AS "claimVersion",
         interpretation.claim_token_hash AS "claimTokenHash",
         interpretation.lease_expires_at AS "leaseExpiresAt",
         interpretation.finalization_hash AS "finalizationHash",
         interpretation.attempt_count AS "attemptCount",
         interpretation.failure_code AS "failureCode",
         interpretation.retry_reason AS "retryReason",
         interpretation.latency_ms AS "latencyMs",
         interpretation.token_status AS "tokenStatus",
         interpretation.input_tokens AS "inputTokens",
         interpretation.output_tokens AS "outputTokens",
         interpretation.total_tokens AS "totalTokens",
         interpretation.cost_status AS "costStatus",
         interpretation.estimated_cost_micros AS "estimatedCostMicros",
         interpretation.currency_code AS "currencyCode",
         interpretation.fallback_output AS "fallbackOutput",
         interpretation.created_at AS "createdAt",
         interpretation.completed_at AS "completedAt",
         interpretation.expires_at AS "expiresAt",
         clock_timestamp() AS "observedAt"
    FROM interpretation
`;

const resolveActiveSession = async (
  transaction: Prisma.TransactionClient,
  token: string,
): Promise<ActiveSessionRow | null> => {
  const hash = await hashOpaqueToken(token, sessionTokenPattern);
  if (hash === null) return null;
  const rows = await transaction.$queryRaw<ActiveSessionRow[]>`
    SELECT subject.id AS "subjectId", subject.expires_at AS "expiresAt"
      FROM anonymous_session AS session
      JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
     WHERE session.token_hash = ${hash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > clock_timestamp()
       AND subject.expires_at > clock_timestamp()
     FOR UPDATE OF session, subject
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const operationalFromRow = (row: GenerationRow): InterpretationGenerationOperationalMetadataV1 =>
  parseOperational(
    {
      attemptCount: row.attemptCount,
      costStatus: row.costStatus,
      currencyCode: row.currencyCode?.trim() ?? null,
      estimatedCostMicros:
        row.estimatedCostMicros === null ? null : Number(row.estimatedCostMicros),
      failureCode: row.failureCode,
      inputTokens: row.inputTokens,
      latencyMs: row.latencyMs,
      outputTokens: row.outputTokens,
      retryReason: row.retryReason,
      tokenStatus: row.tokenStatus,
      totalTokens: row.totalTokens,
    },
    row.maxAttempts,
    row.maxOutputTokens,
    Number(row.maximumEstimatedCostMicros),
    row.approvedCurrencyCode.trim(),
  );

const persistedFromRow = (row: GenerationRow): PersistedInterpretationGeneration => {
  if (
    !uuidV4Pattern.test(row.id) ||
    !uuidV4Pattern.test(row.readingId) ||
    !uuidV4Pattern.test(row.anonymousSubjectId) ||
    !uuidV4Pattern.test(row.requestId) ||
    row.generationNumber !== 1 ||
    row.generationSchemaVersion !== generationSchemaVersion ||
    row.completedAt === null ||
    row.finalizationHash === null ||
    !(row.createdAt instanceof Date) ||
    !(row.completedAt instanceof Date) ||
    !(row.expiresAt instanceof Date) ||
    row.completedAt.getTime() < row.createdAt.getTime() ||
    row.completedAt.getTime() > row.expiresAt.getTime()
  ) {
    throw new InterpretationGenerationPersistenceError(
      "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
    );
  }
  const parsedProvenance = parseGenerationProvenance(row.generationProvenance).value;
  const provenance = parseClaimProvenance({
    assemblyPolicyVersion: row.assemblyPolicyVersion,
    attemptTimeoutMs: row.attemptTimeoutMs,
    contentVersions: row.contentVersions,
    deterministicAlgorithmVersion: row.deterministicAlgorithmVersion,
    deterministicEngineName: row.deterministicEngineName,
    deterministicEngineVersion: row.deterministicEngineVersion,
    deterministicRulesVersion: row.deterministicRulesVersion,
    eligibilityAsOf: row.eligibilityAsOf.toISOString().slice(0, 10),
    fallbackTemplate: {
      approvalReference: row.fallbackTemplateApprovalReference,
      checksum: digestFromBytes(row.fallbackTemplateChecksumSha256),
      id: row.fallbackTemplateId,
      version: row.fallbackTemplateVersion,
    },
    generationPolicyVersion: row.generationPolicyVersion,
    generationProvenance: parsedProvenance,
    locale: row.locale,
    maxAttempts: row.maxAttempts,
    maxOutputTokens: row.maxOutputTokens,
    maximumEstimatedCostMicros: Number(row.maximumEstimatedCostMicros),
    modality: row.modality,
    model: { id: row.modelId, version: row.modelVersion },
    outputSchemaVersion: row.outputSchemaVersion,
    prompt: {
      approvalReference: row.promptApprovalReference,
      checksum: digestFromBytes(row.promptChecksumSha256),
      id: row.promptId,
      version: row.promptVersion,
    },
    provider: {
      approvalReference: row.providerApprovalReference,
      id: row.providerId,
      version: row.providerVersion,
    },
    readingType: row.readingType,
    retryDelayMs: row.retryDelayMs,
    retrievalPolicyVersion: row.retrievalPolicyVersion,
    safetyPolicyVersion: row.safetyPolicyVersion,
    themeCode: row.themeCode,
    tone: row.tone,
    totalTimeoutMs: row.totalTimeoutMs,
    currencyCode: row.approvedCurrencyCode.trim(),
  }).value;
  const base = Object.freeze({
    completedAt: row.completedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    generationNumber: 1 as const,
    generationSchemaVersion,
    id: row.id,
    operational: operationalFromRow(row),
    provenance,
    readingId: row.readingId,
    requestId: row.requestId,
    subjectId: row.anonymousSubjectId,
  });
  if (row.status === "pending_verification" && row.fallbackOutput === null) {
    return Object.freeze({ ...base, status: "pending_verification" as const });
  }
  if (row.status === "failed" && row.fallbackOutput === null) {
    return Object.freeze({ ...base, status: "failed" as const });
  }
  if (row.status === "fallback" && row.fallbackOutput !== null) {
    return Object.freeze({
      ...base,
      output: parseFallbackOutput(row.fallbackOutput).value,
      status: "fallback" as const,
    });
  }
  throw new InterpretationGenerationPersistenceError(
    "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
  );
};

type InterpretationPrivilegeAttestation = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  exactInsertColumns: boolean;
  exactUpdateColumns: boolean;
  canMutateInterpretationBroadly: boolean;
  canReadIdentity: boolean;
  canReadInterpretation: boolean;
  canReadReading: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachableOwnerOrPrivilegedRole: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
}>;

export const assertInterpretationGenerationRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<InterpretationPrivilegeAttestation[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             (SELECT relowner FROM pg_class WHERE oid = 'public.interpretation'::regclass) AS table_owner_oid
    ), reachable_roles AS (
      SELECT role.*
        FROM pg_roles AS role
       WHERE role.rolname = current_user OR pg_has_role(current_user, role.oid, 'MEMBER')
    )
    SELECT current_user AS "roleName",
           session_user AS "sessionRoleName",
           pg_get_userbyid(owners.database_owner_oid) AS "databaseOwner",
           pg_get_userbyid(owners.schema_owner_oid) AS "schemaOwner",
           has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           (has_table_privilege(current_user, 'public.anonymous_subject', 'SELECT')
             AND has_table_privilege(current_user, 'public.anonymous_session', 'SELECT')) AS "canReadIdentity",
           (has_table_privilege(current_user, 'public.reading', 'SELECT')
             AND has_table_privilege(current_user, 'public.tarot_draw', 'SELECT')) AS "canReadReading",
           has_table_privilege(current_user, 'public.interpretation', 'SELECT') AS "canReadInterpretation",
           (has_table_privilege(current_user, 'public.interpretation', 'INSERT')
             OR has_table_privilege(current_user, 'public.interpretation', 'UPDATE')
             OR has_table_privilege(current_user, 'public.interpretation', 'DELETE')
             OR has_table_privilege(current_user, 'public.interpretation', 'TRUNCATE')
             OR has_table_privilege(current_user, 'public.interpretation', 'REFERENCES')
             OR has_table_privilege(current_user, 'public.interpretation', 'TRIGGER')
             OR has_table_privilege(current_user, 'public.interpretation', 'MAINTAIN')) AS "canMutateInterpretationBroadly",
           ARRAY(
             SELECT attribute.attname::text
               FROM pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.interpretation'::regclass
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped
                AND has_column_privilege(
                  current_user, 'public.interpretation', attribute.attname, 'INSERT'
                )
              ORDER BY attribute.attname
           ) = ARRAY[
             'anonymous_subject_id', 'approved_currency_code', 'assembly_policy_version',
             'attempt_timeout_ms', 'canonical_request_hash', 'claim_token_hash',
             'content_versions', 'deterministic_algorithm_version', 'deterministic_engine_name',
             'deterministic_engine_version', 'deterministic_rules_version', 'eligibility_as_of',
             'expires_at', 'fallback_template_approval_reference',
             'fallback_template_checksum_sha256', 'fallback_template_id',
             'fallback_template_version', 'generation_policy_version', 'generation_provenance',
             'generation_schema_version', 'idempotency_key_hash', 'idempotency_key_version',
             'lease_expires_at', 'locale', 'max_attempts', 'max_output_tokens',
             'maximum_estimated_cost_micros', 'modality', 'model_id', 'model_version',
             'output_schema_version', 'prompt_approval_reference', 'prompt_checksum_sha256',
             'prompt_id', 'prompt_version', 'provider_approval_reference', 'provider_id',
             'provider_version', 'reading_id', 'reading_type', 'request_id',
             'retrieval_policy_version', 'retry_delay_ms', 'safety_policy_version',
             'theme_code', 'tone', 'total_timeout_ms'
           ]::text[] AS "exactInsertColumns",
           ARRAY(
             SELECT attribute.attname::text
               FROM pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.interpretation'::regclass
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped
                AND has_column_privilege(
                  current_user, 'public.interpretation', attribute.attname, 'UPDATE'
                )
              ORDER BY attribute.attname
           ) = ARRAY[
             'attempt_count', 'claim_token_hash', 'claim_version', 'completed_at',
             'cost_status', 'currency_code', 'estimated_cost_micros', 'failure_code',
             'fallback_output', 'finalization_hash', 'input_tokens', 'latency_ms',
             'lease_expires_at', 'output_tokens', 'retry_reason', 'status', 'token_status',
             'total_tokens'
           ]::text[] AS "exactUpdateColumns",
           (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
              FROM pg_roles WHERE rolname = current_user) AS "privilegedRole",
           EXISTS (
             SELECT 1 FROM reachable_roles AS role
              WHERE role.rolsuper OR role.rolcreatedb OR role.rolcreaterole
                 OR role.rolreplication OR role.rolbypassrls
                 OR role.oid = owners.database_owner_oid
                 OR role.oid = owners.schema_owner_oid
                 OR role.oid = owners.table_owner_oid
                 OR has_database_privilege(role.oid, current_database(), 'CREATE')
                 OR has_schema_privilege(role.oid, 'public', 'CREATE')
           ) AS "reachableOwnerOrPrivilegedRole"
      FROM owners
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    row.sessionRoleName !== row.roleName ||
    row.roleName === row.databaseOwner ||
    row.roleName === row.schemaOwner ||
    row.canCreateInDatabase ||
    row.canCreateInSchema ||
    !row.canReadIdentity ||
    !row.canReadReading ||
    !row.canReadInterpretation ||
    row.canMutateInterpretationBroadly ||
    !row.exactInsertColumns ||
    !row.exactUpdateColumns ||
    row.privilegedRole ||
    row.reachableOwnerOrPrivilegedRole
  ) {
    throw new TypeError("Interpretation generation runtime database privileges are unsafe.");
  }
};

export const createInterpretationGenerationPersistence = (
  database: PrismaClient,
  rawPolicy: InterpretationGenerationPersistencePolicy,
): InterpretationGenerationPersistence => {
  const policy = validatePolicy(rawPolicy);

  const attest = async (): Promise<void> => {
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    await assertTarotReadingRuntimeDatabasePrivileges(database);
    await assertInterpretationGenerationRuntimeDatabasePrivileges(database);
  };

  const claim: InterpretationGenerationPersistence["claim"] = async (input) => {
    if (
      !uuidV4Pattern.test(input.readingId) ||
      !uuidV4Pattern.test(input.requestId) ||
      input.generationSchemaVersion !== generationSchemaVersion
    ) {
      return invalid();
    }
    const idempotencyKeyVersion = parseIdentifier(input.idempotencyKeyVersion);
    const idempotencyKeyHash = digestBytes(parseDigest(input.idempotencyKeyDigest));
    const canonicalRequestHash = digestBytes(parseDigest(input.canonicalRequestDigest));
    const prepared = parseClaimProvenance(input.provenance);
    if (
      policy.leaseSeconds * 1_000 <
      prepared.value.totalTimeoutMs + minimumFinalizeLeaseBufferMs
    ) {
      return invalid();
    }
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await resolveActiveSession(transaction, input.token);
          if (active === null) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_SESSION_UNAVAILABLE",
            );
          }
          const readingRows = await transaction.$queryRaw<ReadingBindingRow[]>`
            SELECT reading.anonymous_subject_id AS "subjectId",
                   reading.locale,
                   reading.modality,
                   reading.reading_type AS "readingType",
                   reading.theme_code AS "themeCode",
                   reading.expires_at AS "expiresAt",
                   clock_timestamp() AS "observedAt"
              FROM reading
              JOIN tarot_draw ON tarot_draw.reading_id = reading.id
             WHERE reading.id = ${input.readingId}::uuid
               AND reading.anonymous_subject_id = ${active.subjectId}::uuid
               AND reading.status = 'facts_ready'
               AND reading.expires_at > clock_timestamp()
               AND tarot_draw.execution -> 'facts' =
                   CAST(${JSON.stringify(prepared.value.generationProvenance.deterministicFacts)} AS JSONB)
          `;
          const reading = readingRows[0];
          if (readingRows.length !== 1 || reading === undefined) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_READING_NOT_FOUND",
            );
          }
          if (
            reading.locale !== prepared.value.locale ||
            reading.modality !== prepared.value.modality ||
            reading.readingType !== prepared.value.readingType ||
            reading.themeCode !== prepared.value.themeCode
          ) {
            return invalid();
          }
          if (
            reading.expiresAt.getTime() - reading.observedAt.getTime() <
            policy.leaseSeconds * 1_000
          ) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_READING_NOT_FOUND",
            );
          }

          const existingRows = await transaction.$queryRaw<GenerationRow[]>`
            ${generationSelect}
             WHERE interpretation.reading_id = ${input.readingId}::uuid
                OR interpretation.request_id = ${input.requestId}::uuid
                OR (
                  interpretation.anonymous_subject_id = ${active.subjectId}::uuid
                  AND interpretation.idempotency_key_version = ${idempotencyKeyVersion}
                  AND interpretation.idempotency_key_hash = ${idempotencyKeyHash}
             )
             ORDER BY interpretation.id
          `;
          if (existingRows.length > 1) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
            );
          }
          const existing = existingRows[0];
          if (existing !== undefined) {
            if (
              existing.readingId !== input.readingId ||
              existing.requestId !== input.requestId ||
              existing.anonymousSubjectId !== active.subjectId ||
              existing.idempotencyKeyVersion !== idempotencyKeyVersion ||
              !bytesEqual(existing.idempotencyKeyHash, idempotencyKeyHash) ||
              !bytesEqual(existing.canonicalRequestHash, canonicalRequestHash)
            ) {
              throw new InterpretationGenerationPersistenceError(
                "INTERPRETATION_GENERATION_IDEMPOTENCY_CONFLICT",
              );
            }
            if (existing.status !== "generating") {
              return Object.freeze({
                interpretation: persistedFromRow(existing),
                kind: "replayed" as const,
              });
            }
            if (existing.leaseExpiresAt.getTime() > existing.observedAt.getTime()) {
              return Object.freeze({
                interpretationId: existing.id,
                kind: "in_progress" as const,
                leaseExpiresAt: existing.leaseExpiresAt.toISOString(),
              });
            }
            const claimToken = createClaimToken();
            const claimTokenHash = await hashOpaqueToken(claimToken, sessionTokenPattern);
            if (claimTokenHash === null) return invalid();
            const reclaimed = await transaction.$queryRaw<GenerationRow[]>`
              UPDATE interpretation
                 SET claim_version = claim_version + 1,
                     claim_token_hash = ${claimTokenHash},
                     lease_expires_at = LEAST(
                       expires_at,
                       clock_timestamp() + make_interval(secs => ${policy.leaseSeconds})
                     )
               WHERE id = ${existing.id}::uuid
                 AND status = 'generating'
                 AND claim_version = ${existing.claimVersion}
                 AND lease_expires_at <= clock_timestamp()
              RETURNING *, clock_timestamp() AS "observedAt",
                        anonymous_subject_id AS "anonymousSubjectId",
                        reading_id AS "readingId", generation_number AS "generationNumber",
                        request_id AS "requestId", generation_schema_version AS "generationSchemaVersion",
                        generation_policy_version AS "generationPolicyVersion",
                        eligibility_as_of AS "eligibilityAsOf",
                        idempotency_key_version AS "idempotencyKeyVersion",
                        idempotency_key_hash AS "idempotencyKeyHash",
                        canonical_request_hash AS "canonicalRequestHash",
                        reading_type AS "readingType", theme_code AS "themeCode",
                        provider_id AS "providerId", provider_version AS "providerVersion",
                        model_id AS "modelId", model_version AS "modelVersion",
                        provider_approval_reference AS "providerApprovalReference",
                        prompt_id AS "promptId", prompt_version AS "promptVersion",
                        prompt_checksum_sha256 AS "promptChecksumSha256",
                        prompt_approval_reference AS "promptApprovalReference",
                        output_schema_version AS "outputSchemaVersion",
                        safety_policy_version AS "safetyPolicyVersion",
                        retrieval_policy_version AS "retrievalPolicyVersion",
                        assembly_policy_version AS "assemblyPolicyVersion",
                        fallback_template_id AS "fallbackTemplateId",
                        fallback_template_version AS "fallbackTemplateVersion",
                        fallback_template_checksum_sha256 AS "fallbackTemplateChecksumSha256",
                        fallback_template_approval_reference AS "fallbackTemplateApprovalReference",
                        deterministic_engine_name AS "deterministicEngineName",
                        deterministic_engine_version AS "deterministicEngineVersion",
                        deterministic_algorithm_version AS "deterministicAlgorithmVersion",
                        deterministic_rules_version AS "deterministicRulesVersion",
                        content_versions AS "contentVersions", generation_provenance AS "generationProvenance",
                        max_output_tokens AS "maxOutputTokens", attempt_timeout_ms AS "attemptTimeoutMs",
                        total_timeout_ms AS "totalTimeoutMs", max_attempts AS "maxAttempts",
                        retry_delay_ms AS "retryDelayMs",
                        maximum_estimated_cost_micros AS "maximumEstimatedCostMicros",
                        approved_currency_code AS "approvedCurrencyCode",
                        claim_version AS "claimVersion", claim_token_hash AS "claimTokenHash",
                        lease_expires_at AS "leaseExpiresAt", finalization_hash AS "finalizationHash",
                        attempt_count AS "attemptCount", failure_code AS "failureCode",
                        retry_reason AS "retryReason", latency_ms AS "latencyMs",
                        token_status AS "tokenStatus", input_tokens AS "inputTokens",
                        output_tokens AS "outputTokens", total_tokens AS "totalTokens",
                        cost_status AS "costStatus", estimated_cost_micros AS "estimatedCostMicros",
                        currency_code AS "currencyCode", fallback_output AS "fallbackOutput",
                        created_at AS "createdAt", completed_at AS "completedAt", expires_at AS "expiresAt"
            `;
            const row = reclaimed[0];
            if (reclaimed.length !== 1 || row === undefined) {
              throw new InterpretationGenerationPersistenceError(
                "INTERPRETATION_GENERATION_CLAIM_LOST",
              );
            }
            return Object.freeze({
              claimToken,
              claimVersion: row.claimVersion,
              interpretationId: row.id,
              kind: "reclaimed" as const,
              leaseExpiresAt: row.leaseExpiresAt.toISOString(),
              providerEligible: false,
            });
          }

          const claimToken = createClaimToken();
          const claimTokenHash = await hashOpaqueToken(claimToken, sessionTokenPattern);
          if (claimTokenHash === null) return invalid();
          const p = prepared.value;
          const inserted = await transaction.$queryRaw<
            Array<{
              claimVersion: number;
              id: string;
              leaseExpiresAt: Date;
            }>
          >`
            INSERT INTO interpretation (
              reading_id, anonymous_subject_id, request_id,
              generation_schema_version, generation_policy_version, eligibility_as_of,
              idempotency_key_version,
              idempotency_key_hash, canonical_request_hash, locale, modality, reading_type,
              theme_code, tone, provider_id, provider_version, model_id, model_version,
              provider_approval_reference, prompt_id, prompt_version, prompt_checksum_sha256,
              prompt_approval_reference, output_schema_version, safety_policy_version,
              retrieval_policy_version, assembly_policy_version, fallback_template_id,
              fallback_template_version, fallback_template_checksum_sha256,
              fallback_template_approval_reference, deterministic_engine_name,
              deterministic_engine_version, deterministic_algorithm_version,
              deterministic_rules_version, content_versions, generation_provenance,
              max_output_tokens, attempt_timeout_ms, total_timeout_ms, max_attempts,
              retry_delay_ms, maximum_estimated_cost_micros, approved_currency_code,
              claim_token_hash, lease_expires_at, expires_at
            ) VALUES (
              ${input.readingId}::uuid, ${active.subjectId}::uuid, ${input.requestId}::uuid,
              ${generationSchemaVersion}, ${p.generationPolicyVersion},
              ${new Date(`${p.eligibilityAsOf}T00:00:00.000Z`)},
              ${idempotencyKeyVersion}, ${idempotencyKeyHash}, ${canonicalRequestHash}, ${p.locale},
              ${p.modality}, ${p.readingType}, ${p.themeCode}, ${p.tone}, ${p.provider.id},
              ${p.provider.version}, ${p.model.id}, ${p.model.version},
              ${p.provider.approvalReference}, ${p.prompt.id}, ${p.prompt.version},
              ${digestBytes(p.prompt.checksum)}, ${p.prompt.approvalReference},
              ${p.outputSchemaVersion}, ${p.safetyPolicyVersion}, ${p.retrievalPolicyVersion},
              ${p.assemblyPolicyVersion}, ${p.fallbackTemplate.id}, ${p.fallbackTemplate.version},
              ${digestBytes(p.fallbackTemplate.checksum)}, ${p.fallbackTemplate.approvalReference},
              ${p.deterministicEngineName}, ${p.deterministicEngineVersion},
              ${p.deterministicAlgorithmVersion}, ${p.deterministicRulesVersion},
              ${p.contentVersions}, CAST(${prepared.generationProvenanceSerialized} AS JSONB),
              ${p.maxOutputTokens}, ${p.attemptTimeoutMs}, ${p.totalTimeoutMs}, ${p.maxAttempts},
              ${p.retryDelayMs}, ${p.maximumEstimatedCostMicros}, ${p.currencyCode},
              ${claimTokenHash},
              LEAST(
                ${reading.expiresAt},
                clock_timestamp() + make_interval(secs => ${policy.leaseSeconds})
              ), ${reading.expiresAt}
            )
            RETURNING id, claim_version AS "claimVersion", lease_expires_at AS "leaseExpiresAt"
          `;
          const row = inserted[0];
          if (inserted.length !== 1 || row === undefined || !uuidV4Pattern.test(row.id)) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
            );
          }
          return Object.freeze({
            claimToken,
            claimVersion: row.claimVersion,
            interpretationId: row.id,
            kind: "claimed" as const,
            leaseExpiresAt: row.leaseExpiresAt.toISOString(),
            providerEligible: true,
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof InterpretationGenerationPersistenceError) throw error;
      throw new InterpretationGenerationPersistenceError(
        "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
      );
    }
  };

  const finalize: InterpretationGenerationPersistence["finalize"] = async (input) => {
    if (
      !uuidV4Pattern.test(input.interpretationId) ||
      !Number.isSafeInteger(input.claimVersion) ||
      input.claimVersion < 1
    ) {
      return invalid();
    }
    const claimTokenHash = await hashOpaqueToken(input.claimToken, sessionTokenPattern);
    if (claimTokenHash === null) return invalid();
    const completionHash = digestBytes(parseDigest(input.completionDigest));
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await resolveActiveSession(transaction, input.token);
          if (active === null) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_SESSION_UNAVAILABLE",
            );
          }
          const rows = await transaction.$queryRaw<GenerationRow[]>`
            ${generationSelect}
             WHERE interpretation.id = ${input.interpretationId}::uuid
               AND interpretation.anonymous_subject_id = ${active.subjectId}::uuid
          `;
          const row = rows[0];
          if (rows.length !== 1 || row === undefined) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_CLAIM_LOST",
            );
          }
          if (row.status !== "generating") {
            if (
              row.claimVersion === input.claimVersion &&
              bytesEqual(row.claimTokenHash, claimTokenHash) &&
              row.finalizationHash !== null &&
              bytesEqual(row.finalizationHash, completionHash)
            ) {
              return Object.freeze({
                interpretation: persistedFromRow(row),
                kind: "replayed" as const,
              });
            }
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_CLAIM_LOST",
            );
          }
          if (
            row.claimVersion !== input.claimVersion ||
            !bytesEqual(row.claimTokenHash, claimTokenHash)
          ) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_CLAIM_LOST",
            );
          }
          const completion = parseCompletion(
            input.completion,
            row.maxAttempts,
            row.maxOutputTokens,
            Number(row.maximumEstimatedCostMicros),
            row.approvedCurrencyCode.trim(),
          );
          const metadata = completion.operational;
          const updated = await transaction.$queryRaw<GenerationRow[]>`
            UPDATE interpretation
               SET status = ${completion.status},
                   finalization_hash = ${completionHash},
                   attempt_count = ${metadata.attemptCount},
                   failure_code = ${metadata.failureCode},
                   retry_reason = ${metadata.retryReason},
                   latency_ms = ${metadata.latencyMs},
                   token_status = ${metadata.tokenStatus},
                   input_tokens = ${metadata.inputTokens},
                   output_tokens = ${metadata.outputTokens},
                   total_tokens = ${metadata.totalTokens},
                   cost_status = ${metadata.costStatus},
                   estimated_cost_micros = ${metadata.estimatedCostMicros},
                   currency_code = ${metadata.currencyCode},
                   fallback_output = ${
                     completion.output === null
                       ? Prisma.sql`NULL`
                       : Prisma.sql`CAST(${completion.output.serialized} AS JSONB)`
                   },
                   completed_at = clock_timestamp()
             WHERE id = ${row.id}::uuid
               AND status = 'generating'
               AND claim_version = ${input.claimVersion}
               AND claim_token_hash = ${claimTokenHash}
               AND lease_expires_at > clock_timestamp()
            RETURNING *, clock_timestamp() AS "observedAt",
                      anonymous_subject_id AS "anonymousSubjectId",
                      reading_id AS "readingId", generation_number AS "generationNumber",
                      request_id AS "requestId", generation_schema_version AS "generationSchemaVersion",
                      generation_policy_version AS "generationPolicyVersion",
                      eligibility_as_of AS "eligibilityAsOf",
                      idempotency_key_version AS "idempotencyKeyVersion",
                      idempotency_key_hash AS "idempotencyKeyHash",
                      canonical_request_hash AS "canonicalRequestHash",
                      reading_type AS "readingType", theme_code AS "themeCode",
                      provider_id AS "providerId", provider_version AS "providerVersion",
                      model_id AS "modelId", model_version AS "modelVersion",
                      provider_approval_reference AS "providerApprovalReference",
                      prompt_id AS "promptId", prompt_version AS "promptVersion",
                      prompt_checksum_sha256 AS "promptChecksumSha256",
                      prompt_approval_reference AS "promptApprovalReference",
                      output_schema_version AS "outputSchemaVersion",
                      safety_policy_version AS "safetyPolicyVersion",
                      retrieval_policy_version AS "retrievalPolicyVersion",
                      assembly_policy_version AS "assemblyPolicyVersion",
                      fallback_template_id AS "fallbackTemplateId",
                      fallback_template_version AS "fallbackTemplateVersion",
                      fallback_template_checksum_sha256 AS "fallbackTemplateChecksumSha256",
                      fallback_template_approval_reference AS "fallbackTemplateApprovalReference",
                      deterministic_engine_name AS "deterministicEngineName",
                      deterministic_engine_version AS "deterministicEngineVersion",
                      deterministic_algorithm_version AS "deterministicAlgorithmVersion",
                      deterministic_rules_version AS "deterministicRulesVersion",
                      content_versions AS "contentVersions", generation_provenance AS "generationProvenance",
                      max_output_tokens AS "maxOutputTokens", attempt_timeout_ms AS "attemptTimeoutMs",
                      total_timeout_ms AS "totalTimeoutMs", max_attempts AS "maxAttempts",
                      retry_delay_ms AS "retryDelayMs",
                      maximum_estimated_cost_micros AS "maximumEstimatedCostMicros",
                      approved_currency_code AS "approvedCurrencyCode",
                      claim_version AS "claimVersion", claim_token_hash AS "claimTokenHash",
                      lease_expires_at AS "leaseExpiresAt", finalization_hash AS "finalizationHash",
                      attempt_count AS "attemptCount", failure_code AS "failureCode",
                      retry_reason AS "retryReason", latency_ms AS "latencyMs",
                      token_status AS "tokenStatus", input_tokens AS "inputTokens",
                      output_tokens AS "outputTokens", total_tokens AS "totalTokens",
                      cost_status AS "costStatus", estimated_cost_micros AS "estimatedCostMicros",
                      currency_code AS "currencyCode", fallback_output AS "fallbackOutput",
                      created_at AS "createdAt", completed_at AS "completedAt", expires_at AS "expiresAt"
          `;
          const finalized = updated[0];
          if (updated.length !== 1 || finalized === undefined) {
            throw new InterpretationGenerationPersistenceError(
              "INTERPRETATION_GENERATION_CLAIM_LOST",
            );
          }
          return Object.freeze({
            interpretation: persistedFromRow(finalized),
            kind: "finalized" as const,
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof InterpretationGenerationPersistenceError) throw error;
      throw new InterpretationGenerationPersistenceError(
        "INTERPRETATION_GENERATION_PERSISTENCE_UNAVAILABLE",
      );
    }
  };

  return Object.freeze({ claim, finalize });
};

export { generationProvenanceSchemaVersion, generationSchemaVersion };
