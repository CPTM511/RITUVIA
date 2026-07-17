import {
  interpretationContractLimits,
  interpretationTimeHorizons,
  parseTarotInterpretationOutputForInputV1,
  tarotInterpretationFactRefsV1,
  tarotInterpretationOutputSchemaVersion,
  type InterpretationTimeHorizon,
  type TarotInterpretationInputV1,
  type TarotInterpretationOutputV1,
} from "./interpretation.js";
import {
  isTarotPromptAssemblyForInputV1,
  isTarotPromptAssemblyForRetrievedContentV1,
  type TarotPromptAssemblyV1,
} from "./prompt.js";
import {
  isInterpretationGenerationAuthorizationV1,
  structuredGenerationFailureCodes,
  structuredGenerationProviderSchemaVersion,
  structuredGenerationRequestSchemaVersion,
  type ProviderChecksummedReferenceV1,
  type ProviderVersionReferenceV1,
  type StructuredGenerationExecutionContextV1,
  type StructuredGenerationFailureCode,
  type StructuredGenerationProviderV1,
  type StructuredGenerationRequestV1,
  type StructuredGenerationResultV1,
} from "./provider.js";
import {
  isRetrievedTarotContentBundleV1,
  type RetrievedTarotContentBundleV1,
  type Sha256IntegrityVerifierV1,
} from "./retrieval.js";
import {
  isPreGenerationSafetyEvaluationV1,
  type PreGenerationSafetyContinuationContextV1,
} from "./safety.js";

export const tarotGenerationRuntimeSchemaVersion = "tarot-generation-runtime.v1" as const;
export const tarotGenerationAuthoritySchemaVersion = "tarot-generation-authority.v1" as const;
export const tarotGenerationOperationalMetadataSchemaVersion =
  "tarot-generation-operational-metadata.v1" as const;
export const tarotFallbackTemplateSchemaVersion = "tarot-fallback-template.v1" as const;
export const tarotFallbackAuthoritySchemaVersion = "tarot-fallback-authority.v1" as const;
export const tarotFallbackChecksumScope = "canonical-parsed-tarot-fallback-json.v1" as const;
export const tarotGenerationMaximumProviderRetryAfterMs = 30_000 as const;
export const tarotGenerationMaximumReportedTokenCount = 2_147_483_647 as const;
export const tarotGenerationMaximumOperationalLatencyMs = 240_000 as const;

export const tarotGenerationErrorCodes = Object.freeze([
  "AI_GENERATION_INPUT_INVALID",
  "AI_GENERATION_BINDING_MISMATCH",
  "AI_GENERATION_RUNTIME_NOT_APPROVED",
  "AI_GENERATION_DEADLINE_INVALID",
  "AI_FALLBACK_TEMPLATE_INVALID",
  "AI_FALLBACK_INTEGRITY_MISMATCH",
  "AI_FALLBACK_NOT_APPROVED",
] as const);
export type TarotGenerationErrorCode = (typeof tarotGenerationErrorCodes)[number];

export class TarotGenerationError extends Error {
  public readonly code: TarotGenerationErrorCode;

  public constructor(code: TarotGenerationErrorCode) {
    super(code);
    this.name = "TarotGenerationError";
    this.code = code;
  }
}

export type ApprovedTarotFallbackReferenceV1 = Readonly<{
  approvalReference: string;
  checksum: string;
  id: string;
  version: string;
}>;

export type TarotFallbackCopyV1 = Readonly<{
  boundaryNote: string;
  smallActionRationale: string;
  summary: string;
  timeHorizon: InterpretationTimeHorizon;
  title: string;
}>;

declare const approvedTarotFallbackTemplateBrand: unique symbol;
const issuedTarotFallbackTemplates = new WeakSet<object>();

export type ApprovedTarotFallbackTemplateV1 = Readonly<{
  approvalReference: string;
  authorId: string;
  checksum: string;
  copy: TarotFallbackCopyV1;
  effectiveDate: string;
  eligibilityAsOf: string;
  evaluationVersion: string;
  fallbackId: string;
  locale: string;
  modality: "tarot";
  requiredApprovalRole: string;
  reviewDueDate: string;
  reviewedDate: string;
  reviewerId: string;
  reviewerRole: string;
  schemaVersion: typeof tarotFallbackTemplateSchemaVersion;
  status: "approved";
  tradition: string;
  version: string;
  [approvedTarotFallbackTemplateBrand]: true;
}>;

export type TarotFallbackAuthorityV1 = Readonly<{
  fallback: ApprovedTarotFallbackReferenceV1;
  locale: string;
  outputSchema: ProviderChecksummedReferenceV1;
  schemaVersion: typeof tarotFallbackAuthoritySchemaVersion;
  tradition: string;
}>;

export type TarotFallbackAuthorityVerifierV1 = (
  authority: TarotFallbackAuthorityV1,
) => boolean | Promise<boolean>;

export type LoadApprovedTarotFallbackTemplateInputV1 = Readonly<{
  asOf: string;
  authorizeFallback: TarotFallbackAuthorityVerifierV1;
  outputSchema: ProviderChecksummedReferenceV1;
  registration: ApprovedTarotFallbackReferenceV1;
  templateJson: string;
  verifyIntegrity: Sha256IntegrityVerifierV1;
}>;

export type TarotGenerationRuntimeRegistrationV1 = Readonly<{
  approvalReference: string;
  attemptTimeoutMs: number;
  currencyCode: string;
  eligibilityAsOf: string;
  fallbackTemplate: ApprovedTarotFallbackReferenceV1;
  maximumAttempts: 1 | 2;
  maximumEstimatedCostMicros: number;
  maxOutputTokens: number;
  model: ProviderVersionReferenceV1;
  outputSchema: ProviderChecksummedReferenceV1;
  prompt: ProviderChecksummedReferenceV1;
  provider: ProviderVersionReferenceV1;
  retryDelayMs: number;
  schemaVersion: typeof tarotGenerationRuntimeSchemaVersion;
  totalTimeoutMs: number;
}>;

export type TarotGenerationAuthorityV1 = Readonly<{
  locale: string;
  modality: "tarot";
  registration: TarotGenerationRuntimeRegistrationV1;
  safetyPolicyVersion: string;
  schemaVersion: typeof tarotGenerationAuthoritySchemaVersion;
  themeCode: string;
}>;

export type TarotGenerationAuthorityVerifierV1 = (
  authority: TarotGenerationAuthorityV1,
) => boolean | Promise<boolean>;

export type GenerationDeadlineRunInputV1<Value> = Readonly<{
  attempt: 1 | 2;
  operation: (context: StructuredGenerationExecutionContextV1) => Promise<Value>;
  timeoutMs: number;
}>;

export type GenerationDeadlineRunResultV1<Value> =
  | Readonly<{ elapsedMs: number; status: "settled"; value: Value }>
  | Readonly<{
      cancellationAcknowledged: boolean;
      elapsedMs: number;
      status: "timeout";
    }>;

export type GenerationDeadlineWaitInputV1 = Readonly<{
  delayMs: number;
  timeoutMs: number;
}>;

export type GenerationDeadlineWaitResultV1 =
  | Readonly<{ elapsedMs: number; status: "settled" }>
  | Readonly<{
      cancellationAcknowledged: boolean;
      elapsedMs: number;
      status: "timeout";
    }>;

export type GenerationDeadlineRunnerV1 = Readonly<{
  run: <Value>(
    input: GenerationDeadlineRunInputV1<Value>,
  ) => Promise<GenerationDeadlineRunResultV1<Value>>;
  wait: (input: GenerationDeadlineWaitInputV1) => Promise<GenerationDeadlineWaitResultV1>;
}>;

export type TarotGenerationRetryReasonV1 = "invalid_response" | "rate_limited" | "unavailable";
export type TarotGenerationReportingStatusV1 = "reported" | "unavailable";

export type TarotGenerationOperationalMetadataV1 = Readonly<{
  attemptCount: number;
  contentVersions: readonly string[];
  costStatus: TarotGenerationReportingStatusV1;
  currencyCode: string | null;
  estimatedCostMicros: number | null;
  failureCode: StructuredGenerationFailureCode | null;
  fallbackTemplateVersion: string;
  inputTokens: number | null;
  latencyMs: number;
  locale: string;
  modality: "tarot";
  modelId: string;
  modelVersion: string;
  outputSchemaVersion: string;
  outputTokens: number | null;
  promptId: string;
  promptVersion: string;
  providerId: string;
  providerVersion: string;
  readingType: "one_card" | "three_card";
  result: "failed" | "fallback" | "pending_verification";
  retryReason: TarotGenerationRetryReasonV1 | null;
  safetyPolicyVersion: string;
  schemaVersion: typeof tarotGenerationOperationalMetadataSchemaVersion;
  themeCode: string;
  tokenStatus: TarotGenerationReportingStatusV1;
  totalTokens: number | null;
}>;

declare const pendingTarotInterpretationCandidateBrand: unique symbol;

export type PendingTarotInterpretationCandidateV1 = Readonly<{
  displayable: false;
  metadata: TarotGenerationOperationalMetadataV1;
  status: "pending_verification";
  [pendingTarotInterpretationCandidateBrand]: true;
}>;

export type TarotInterpretationGenerationResultV1 =
  | PendingTarotInterpretationCandidateV1
  | Readonly<{
      displayable: true;
      metadata: TarotGenerationOperationalMetadataV1;
      output: TarotInterpretationOutputV1;
      status: "fallback";
    }>
  | Readonly<{
      displayable: false;
      metadata: TarotGenerationOperationalMetadataV1;
      status: "failed";
    }>;

export type PrepareTarotInterpretationGenerationInputV1 = Readonly<{
  authorizeRuntime: TarotGenerationAuthorityVerifierV1;
  continuation: PreGenerationSafetyContinuationContextV1;
  fallbackTemplate: ApprovedTarotFallbackTemplateV1;
  input: TarotInterpretationInputV1;
  prompt: TarotPromptAssemblyV1;
  provider: StructuredGenerationProviderV1;
  retrievedContent: RetrievedTarotContentBundleV1;
  runtime: TarotGenerationRuntimeRegistrationV1;
}>;

export type GenerateTarotInterpretationInputV1 =
  | (PrepareTarotInterpretationGenerationInputV1 &
      Readonly<{
        mode: "fallback_only";
      }>)
  | (PrepareTarotInterpretationGenerationInputV1 &
      Readonly<{
        mode: "provider_with_fallback";
        runner: GenerationDeadlineRunnerV1;
      }>);

declare const preparedTarotInterpretationGenerationBrand: unique symbol;

export type PreparedTarotInterpretationGenerationProvenanceV1 = Readonly<{
  fallbackTemplate: Readonly<{
    approvalReference: string;
    authorId: string;
    checksum: string;
    checksumScope: typeof tarotFallbackChecksumScope;
    effectiveDate: string;
    eligibilityAsOf: string;
    evaluationVersion: string;
    id: string;
    requiredApprovalRole: string;
    reviewDueDate: string;
    reviewedDate: string;
    reviewerId: string;
    reviewerRole: string;
    schemaVersion: typeof tarotFallbackTemplateSchemaVersion;
    version: string;
  }>;
  prompt: TarotPromptAssemblyV1["provenance"];
  request: Readonly<{
    locale: string;
    modality: "tarot";
    readingType: "one_card" | "three_card";
    requestId: string;
    safetyPolicyVersion: string;
    themeCode: string;
  }>;
  runtime: TarotGenerationRuntimeRegistrationV1;
  schemaVersion: "prepared-tarot-interpretation-generation-provenance.v1";
}>;

export type PreparedTarotInterpretationGenerationV1 = Readonly<{
  provenance: PreparedTarotInterpretationGenerationProvenanceV1;
  schemaVersion: "prepared-tarot-interpretation-generation.v1";
  [preparedTarotInterpretationGenerationBrand]: true;
}>;

export type ExecutePreparedTarotInterpretationGenerationInputV1 =
  | Readonly<{
      mode: "fallback_only";
      prepared: PreparedTarotInterpretationGenerationV1;
    }>
  | Readonly<{
      mode: "provider_with_fallback";
      prepared: PreparedTarotInterpretationGenerationV1;
      provider: StructuredGenerationProviderV1;
      runner: GenerationDeadlineRunnerV1;
    }>;

const issuedPreparedGenerations = new WeakSet<object>();
const consumedPreparedGenerations = new WeakSet<object>();
const preparedGenerationState = new WeakMap<
  object,
  Readonly<{
    input: PrepareTarotInterpretationGenerationInputV1;
    runtime: TarotGenerationRuntimeRegistrationV1;
  }>
>();

/** @internal Consumed only by the same-package post-generation verifier. */
export type PendingTarotInterpretationVerificationContextV1 = Readonly<{
  candidate: PendingTarotInterpretationCandidateV1;
  candidateOutput: TarotInterpretationOutputV1;
  fallbackOutput: TarotInterpretationOutputV1;
  fallbackTemplate: ApprovedTarotFallbackTemplateV1;
  generationProvenance: PreparedTarotInterpretationGenerationProvenanceV1;
  input: TarotInterpretationInputV1;
  retrievedContent: RetrievedTarotContentBundleV1;
}>;

const issuedPendingTarotCandidates = new WeakSet<object>();
const consumedPendingTarotCandidates = new WeakSet<object>();
const pendingTarotCandidateState = new WeakMap<
  object,
  PendingTarotInterpretationVerificationContextV1
>();

/** @internal Do not export from the package root. */
export const consumePendingTarotInterpretationCandidateForVerificationV1 = (
  candidate: unknown,
): PendingTarotInterpretationVerificationContextV1 => {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !issuedPendingTarotCandidates.has(candidate) ||
    consumedPendingTarotCandidates.has(candidate)
  ) {
    return fail("AI_GENERATION_BINDING_MISMATCH");
  }
  const context = pendingTarotCandidateState.get(candidate);
  if (context === undefined) return fail("AI_GENERATION_BINDING_MISMATCH");
  consumedPendingTarotCandidates.add(candidate);
  return context;
};

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const outputSchemaVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const forbiddenTextPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u;

const fail = (code: TarotGenerationErrorCode): never => {
  throw new TarotGenerationError(code);
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...keys].sort().join("\u0000");

const hasLoneSurrogate = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
};

const utf8ByteLength = (value: string): number => {
  if (hasLoneSurrogate(value)) return Number.POSITIVE_INFINITY;
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const deepFreeze = <Value>(value: Value): Value => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

const parseText = (value: unknown, maximum: number, code: TarotGenerationErrorCode): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    utf8ByteLength(value) > maximum ||
    forbiddenTextPattern.test(value)
  ) {
    return fail(code);
  }
  return value;
};

const parseIdentifier = (value: unknown, code: TarotGenerationErrorCode): string => {
  const parsed = parseText(value, 100, code);
  return identifierPattern.test(parsed) ? parsed : fail(code);
};

const parseSemanticVersion = (value: unknown, code: TarotGenerationErrorCode): string =>
  typeof value === "string" && utf8ByteLength(value) <= 100 && semanticVersionPattern.test(value)
    ? value
    : fail(code);

const parseOutputSchemaVersion = (value: unknown, code: TarotGenerationErrorCode): string =>
  typeof value === "string" && outputSchemaVersionPattern.test(value) ? value : fail(code);

const parseChecksum = (value: unknown, code: TarotGenerationErrorCode): string =>
  typeof value === "string" && sha256DigestPattern.test(value) ? value : fail(code);

const parseDate = (value: unknown, code: TarotGenerationErrorCode): string => {
  if (typeof value !== "string" || !datePattern.test(value)) return fail(code);
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value
    : fail(code);
};

const parseLocale = (value: unknown, code: TarotGenerationErrorCode): string => {
  const locale = parseText(value, 35, code);
  try {
    return new Intl.Locale(locale).toString() === locale ? locale : fail(code);
  } catch {
    return fail(code);
  }
};

const parseReference = (
  value: unknown,
  code: TarotGenerationErrorCode,
  outputSchema = false,
): ProviderChecksummedReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["checksum", "id", "version"])) {
    return fail(code);
  }
  return Object.freeze({
    checksum: parseChecksum(candidate.checksum, code),
    id: parseIdentifier(candidate.id, code),
    version: outputSchema
      ? parseOutputSchemaVersion(candidate.version, code)
      : parseSemanticVersion(candidate.version, code),
  });
};

const parseVersionReference = (
  value: unknown,
  code: TarotGenerationErrorCode,
): ProviderVersionReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["id", "version"])) return fail(code);
  return Object.freeze({
    id: parseIdentifier(candidate.id, code),
    version: parseSemanticVersion(candidate.version, code),
  });
};

const parseApprovalReference = (value: unknown, code: TarotGenerationErrorCode): string => {
  const parsed = parseText(value, 200, code);
  return approvalReferencePattern.test(parsed) ? parsed : fail(code);
};

const exact = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const isSafeIntegerIn = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

type ParsedFallbackTemplateV1 = Omit<
  ApprovedTarotFallbackTemplateV1,
  typeof approvedTarotFallbackTemplateBrand | "checksum" | "eligibilityAsOf"
>;

const parseFallbackReference = (
  value: unknown,
  code: TarotGenerationErrorCode,
): ApprovedTarotFallbackReferenceV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["approvalReference", "checksum", "id", "version"])
  ) {
    return fail(code);
  }
  return Object.freeze({
    approvalReference: parseApprovalReference(candidate.approvalReference, code),
    checksum: parseChecksum(candidate.checksum, code),
    id: parseIdentifier(candidate.id, code),
    version: parseSemanticVersion(candidate.version, code),
  });
};

const parseFallbackTemplateJson = (value: string): ParsedFallbackTemplateV1 => {
  const code = "AI_FALLBACK_TEMPLATE_INVALID" as const;
  if (typeof value !== "string" || value.length === 0 || utf8ByteLength(value) > 32_768) {
    return fail(code);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return fail(code);
  }
  const candidate = record(parsed);
  if (
    candidate === null ||
    candidate.schemaVersion !== tarotFallbackTemplateSchemaVersion ||
    candidate.modality !== "tarot" ||
    candidate.status !== "approved" ||
    !hasExactKeys(candidate, [
      "approvalReference",
      "authorId",
      "copy",
      "effectiveDate",
      "evaluationVersion",
      "fallbackId",
      "locale",
      "modality",
      "requiredApprovalRole",
      "reviewDueDate",
      "reviewedDate",
      "reviewerId",
      "reviewerRole",
      "schemaVersion",
      "status",
      "tradition",
      "version",
    ])
  ) {
    return fail(code);
  }
  const copy = record(candidate.copy);
  if (
    copy === null ||
    !hasExactKeys(copy, [
      "boundaryNote",
      "smallActionRationale",
      "summary",
      "timeHorizon",
      "title",
    ]) ||
    typeof copy.timeHorizon !== "string" ||
    !interpretationTimeHorizons.includes(copy.timeHorizon as InterpretationTimeHorizon)
  ) {
    return fail(code);
  }
  const effectiveDate = parseDate(candidate.effectiveDate, code);
  const reviewedDate = parseDate(candidate.reviewedDate, code);
  const reviewDueDate = parseDate(candidate.reviewDueDate, code);
  const authorId = parseIdentifier(candidate.authorId, code);
  const reviewerId = parseIdentifier(candidate.reviewerId, code);
  const reviewerRole = parseIdentifier(candidate.reviewerRole, code);
  const requiredApprovalRole = parseIdentifier(candidate.requiredApprovalRole, code);
  if (
    reviewedDate > effectiveDate ||
    reviewDueDate < effectiveDate ||
    authorId === reviewerId ||
    reviewerRole !== requiredApprovalRole
  ) {
    return fail("AI_FALLBACK_NOT_APPROVED");
  }
  return deepFreeze({
    approvalReference: parseApprovalReference(candidate.approvalReference, code),
    authorId,
    copy: {
      boundaryNote: parseText(
        copy.boundaryNote,
        interpretationContractLimits.boundaryNoteMaximum,
        code,
      ),
      smallActionRationale: parseText(
        copy.smallActionRationale,
        interpretationContractLimits.rationaleMaximum,
        code,
      ),
      summary: parseText(copy.summary, interpretationContractLimits.summaryMaximum, code),
      timeHorizon: copy.timeHorizon as InterpretationTimeHorizon,
      title: parseText(copy.title, interpretationContractLimits.titleMaximum, code),
    },
    effectiveDate,
    evaluationVersion: parseSemanticVersion(candidate.evaluationVersion, code),
    fallbackId: parseIdentifier(candidate.fallbackId, code),
    locale: parseLocale(candidate.locale, code),
    modality: "tarot" as const,
    requiredApprovalRole,
    reviewDueDate,
    reviewedDate,
    reviewerId,
    reviewerRole,
    schemaVersion: tarotFallbackTemplateSchemaVersion,
    status: "approved" as const,
    tradition: parseIdentifier(candidate.tradition, code),
    version: parseSemanticVersion(candidate.version, code),
  });
};

export const isApprovedTarotFallbackTemplateV1 = (
  value: unknown,
): value is ApprovedTarotFallbackTemplateV1 =>
  typeof value === "object" && value !== null && issuedTarotFallbackTemplates.has(value);

export const loadApprovedTarotFallbackTemplateV1 = async (
  input: LoadApprovedTarotFallbackTemplateInputV1,
): Promise<ApprovedTarotFallbackTemplateV1> => {
  if (typeof input !== "object" || input === null) return fail("AI_FALLBACK_TEMPLATE_INVALID");
  const registration = parseFallbackReference(input.registration, "AI_FALLBACK_TEMPLATE_INVALID");
  const outputSchema = parseReference(input.outputSchema, "AI_FALLBACK_TEMPLATE_INVALID", true);
  const asOf = parseDate(input.asOf, "AI_FALLBACK_TEMPLATE_INVALID");
  const template = parseFallbackTemplateJson(input.templateJson);
  if (typeof input.verifyIntegrity !== "function") return fail("AI_FALLBACK_TEMPLATE_INVALID");
  let verified: unknown;
  try {
    verified = await input.verifyIntegrity(JSON.stringify(template), registration.checksum);
  } catch {
    return fail("AI_FALLBACK_INTEGRITY_MISMATCH");
  }
  if (verified !== true) return fail("AI_FALLBACK_INTEGRITY_MISMATCH");
  if (
    template.fallbackId !== registration.id ||
    template.version !== registration.version ||
    template.approvalReference !== registration.approvalReference
  ) {
    return fail("AI_GENERATION_BINDING_MISMATCH");
  }
  if (
    template.reviewedDate > asOf ||
    template.effectiveDate > asOf ||
    template.reviewDueDate < asOf
  ) {
    return fail("AI_FALLBACK_NOT_APPROVED");
  }
  if (typeof input.authorizeFallback !== "function") return fail("AI_FALLBACK_TEMPLATE_INVALID");
  let authorized: unknown;
  try {
    authorized = await input.authorizeFallback(
      deepFreeze({
        fallback: registration,
        locale: template.locale,
        outputSchema,
        schemaVersion: tarotFallbackAuthoritySchemaVersion,
        tradition: template.tradition,
      }),
    );
  } catch {
    return fail("AI_FALLBACK_NOT_APPROVED");
  }
  if (authorized !== true) return fail("AI_FALLBACK_NOT_APPROVED");
  const approved = deepFreeze({
    ...template,
    checksum: registration.checksum,
    eligibilityAsOf: asOf,
  }) as ApprovedTarotFallbackTemplateV1;
  issuedTarotFallbackTemplates.add(approved);
  return approved;
};

const parseRuntime = (value: unknown): TarotGenerationRuntimeRegistrationV1 => {
  const code = "AI_GENERATION_INPUT_INVALID" as const;
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "approvalReference",
      "attemptTimeoutMs",
      "currencyCode",
      "eligibilityAsOf",
      "fallbackTemplate",
      "maximumAttempts",
      "maximumEstimatedCostMicros",
      "maxOutputTokens",
      "model",
      "outputSchema",
      "prompt",
      "provider",
      "retryDelayMs",
      "schemaVersion",
      "totalTimeoutMs",
    ]) ||
    candidate.schemaVersion !== tarotGenerationRuntimeSchemaVersion ||
    (candidate.maximumAttempts !== 1 && candidate.maximumAttempts !== 2) ||
    !isSafeIntegerIn(candidate.attemptTimeoutMs, 100, 120_000) ||
    !isSafeIntegerIn(candidate.totalTimeoutMs, 100, 240_000) ||
    candidate.totalTimeoutMs < candidate.attemptTimeoutMs ||
    !isSafeIntegerIn(candidate.retryDelayMs, 0, 30_000) ||
    !isSafeIntegerIn(candidate.maxOutputTokens, 64, 8_192) ||
    !isSafeIntegerIn(candidate.maximumEstimatedCostMicros, 0, 1_000_000_000) ||
    typeof candidate.currencyCode !== "string" ||
    !currencyPattern.test(candidate.currencyCode)
  ) {
    return fail(code);
  }
  return deepFreeze({
    approvalReference: parseApprovalReference(candidate.approvalReference, code),
    attemptTimeoutMs: candidate.attemptTimeoutMs,
    currencyCode: candidate.currencyCode,
    eligibilityAsOf: parseDate(candidate.eligibilityAsOf, code),
    fallbackTemplate: parseFallbackReference(candidate.fallbackTemplate, code),
    maximumAttempts: candidate.maximumAttempts,
    maximumEstimatedCostMicros: candidate.maximumEstimatedCostMicros,
    maxOutputTokens: candidate.maxOutputTokens,
    model: parseVersionReference(candidate.model, code),
    outputSchema: parseReference(candidate.outputSchema, code, true),
    prompt: parseReference(candidate.prompt, code),
    provider: parseVersionReference(candidate.provider, code),
    retryDelayMs: candidate.retryDelayMs,
    schemaVersion: tarotGenerationRuntimeSchemaVersion,
    totalTimeoutMs: candidate.totalTimeoutMs,
  });
};

const exactReference = (
  left: Readonly<{ checksum?: string; id: string; version: string }>,
  right: Readonly<{ checksum?: string; id: string; version: string }>,
): boolean =>
  left.id === right.id && left.version === right.version && left.checksum === right.checksum;

const validateBindings = (
  input: PrepareTarotInterpretationGenerationInputV1,
  runtime: TarotGenerationRuntimeRegistrationV1,
): void => {
  try {
    tarotInterpretationFactRefsV1(input.input);
  } catch {
    return fail("AI_GENERATION_BINDING_MISMATCH");
  }
  const engine = input.prompt.provenance.deterministicEngine;
  parseIdentifier(engine.engineName, "AI_GENERATION_INPUT_INVALID");
  parseSemanticVersion(engine.engineVersion, "AI_GENERATION_INPUT_INVALID");
  parseIdentifier(engine.algorithmVersion, "AI_GENERATION_INPUT_INVALID");
  parseIdentifier(engine.rulesVersion, "AI_GENERATION_INPUT_INVALID");
  parseIdentifier(input.input.safetyDecision.policyVersion, "AI_GENERATION_INPUT_INVALID");
  parseIdentifier(input.prompt.provenance.retrievalPolicyVersion, "AI_GENERATION_INPUT_INVALID");
  parseIdentifier(input.prompt.provenance.assemblyPolicyVersion, "AI_GENERATION_INPUT_INVALID");
  for (const content of input.input.approvedContent) {
    parseSemanticVersion(content.version, "AI_GENERATION_INPUT_INVALID");
  }
  const continuation = input.continuation;
  const evaluation = continuation.evaluation;
  const expectedBinding = {
    intakePolicyVersion: evaluation.intakePolicyVersion,
    locale: input.input.locale,
    modality: "tarot" as const,
    policyApprovalReference: continuation.policyApprovalReference,
    readingType: input.input.readingType,
    requestId: input.input.requestId,
    safetyPolicyVersion: input.input.safetyDecision.policyVersion,
    themeCode: input.input.themeCode,
  };
  if (
    !isTarotPromptAssemblyForInputV1(input.prompt, input.input) ||
    !isTarotPromptAssemblyForRetrievedContentV1(input.prompt, input.retrievedContent) ||
    !isRetrievedTarotContentBundleV1(input.retrievedContent) ||
    !isApprovedTarotFallbackTemplateV1(input.fallbackTemplate) ||
    !isPreGenerationSafetyEvaluationV1(evaluation) ||
    evaluation.route !== "allowed" ||
    continuation.decision.route !== "allowed" ||
    continuation.decision.schemaVersion !== "interpretation-safety-decision.v1" ||
    continuation.decision.policyVersion !== input.input.safetyDecision.policyVersion ||
    evaluation.requestId !== input.input.requestId ||
    evaluation.readingType !== input.input.readingType ||
    evaluation.locale !== input.input.locale ||
    evaluation.modality !== input.input.modality ||
    evaluation.themeCode !== input.input.themeCode ||
    evaluation.policyVersion !== input.input.safetyDecision.policyVersion ||
    evaluation.intakePolicyVersion !== expectedBinding.intakePolicyVersion ||
    continuation.policyApprovalReference !==
      continuation.authorization.binding.policyApprovalReference ||
    !isInterpretationGenerationAuthorizationV1(continuation.authorization, expectedBinding) ||
    input.input.locale !== input.retrievedContent.locale ||
    input.input.locale !== input.fallbackTemplate.locale ||
    input.retrievedContent.tradition !== input.fallbackTemplate.tradition ||
    !exactReference(runtime.prompt, input.prompt.prompt) ||
    !exactReference(runtime.outputSchema, input.prompt.provenance.outputSchema) ||
    !exactReference(runtime.fallbackTemplate, {
      checksum: input.fallbackTemplate.checksum,
      id: input.fallbackTemplate.fallbackId,
      version: input.fallbackTemplate.version,
    }) ||
    runtime.fallbackTemplate.approvalReference !== input.fallbackTemplate.approvalReference ||
    !exact(input.input.approvedContent, input.retrievedContent.approvedContent) ||
    !exact(input.input.deterministicFacts, input.retrievedContent.deterministicFacts)
  ) {
    return fail("AI_GENERATION_BINDING_MISMATCH");
  }
};

type ParsedUsageV1 = Readonly<{
  currencyCode: string | null;
  estimatedCostMicros: number | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

type ParsedProviderResultV1 =
  | Readonly<{
      code: StructuredGenerationFailureCode;
      retryAfterPolicyValid: boolean;
      retryAfterMs: number | null;
      status: "failed";
    }>
  | Readonly<{
      finishReason: "length" | "other" | "stop";
      outputJson: string;
      status: "succeeded";
      usage: ParsedUsageV1;
    }>;

const parseUsage = (
  value: unknown,
  runtime: TarotGenerationRuntimeRegistrationV1,
): ParsedUsageV1 | null => {
  const candidate = record(value);
  if (candidate === null) return null;
  const hasCost = Object.hasOwn(candidate, "estimatedCost");
  if (
    !hasExactKeys(
      candidate,
      hasCost
        ? ["estimatedCost", "inputTokens", "outputTokens", "totalTokens"]
        : ["inputTokens", "outputTokens", "totalTokens"],
    ) ||
    !isSafeIntegerIn(candidate.inputTokens, 0, tarotGenerationMaximumReportedTokenCount) ||
    !isSafeIntegerIn(candidate.outputTokens, 0, runtime.maxOutputTokens) ||
    !isSafeIntegerIn(candidate.totalTokens, 0, tarotGenerationMaximumReportedTokenCount) ||
    candidate.inputTokens + candidate.outputTokens !== candidate.totalTokens
  ) {
    return null;
  }
  let currencyCode: string | null = null;
  let estimatedCostMicros: number | null = null;
  if (hasCost) {
    const cost = record(candidate.estimatedCost);
    if (
      cost === null ||
      !hasExactKeys(cost, ["amountMicros", "currencyCode"]) ||
      !isSafeIntegerIn(cost.amountMicros, 0, runtime.maximumEstimatedCostMicros) ||
      cost.currencyCode !== runtime.currencyCode
    ) {
      return null;
    }
    currencyCode = runtime.currencyCode;
    estimatedCostMicros = cost.amountMicros;
  }
  return Object.freeze({
    currencyCode,
    estimatedCostMicros,
    inputTokens: candidate.inputTokens,
    outputTokens: candidate.outputTokens,
    totalTokens: candidate.totalTokens,
  });
};

const parseProviderResult = (
  value: unknown,
  runtime: TarotGenerationRuntimeRegistrationV1,
): ParsedProviderResultV1 | null => {
  const candidate = record(value);
  if (candidate === null || typeof candidate.status !== "string") return null;
  if (candidate.status === "failed") {
    const hasRetryAfter = Object.hasOwn(candidate, "retryAfterMs");
    if (
      !hasExactKeys(
        candidate,
        hasRetryAfter
          ? ["code", "retryAfterMs", "retryable", "status"]
          : ["code", "retryable", "status"],
      ) ||
      typeof candidate.code !== "string" ||
      !structuredGenerationFailureCodes.includes(
        candidate.code as StructuredGenerationFailureCode,
      ) ||
      typeof candidate.retryable !== "boolean" ||
      (hasRetryAfter && !isSafeIntegerIn(candidate.retryAfterMs, 0, 300_000))
    ) {
      return null;
    }
    return Object.freeze({
      code: candidate.code as StructuredGenerationFailureCode,
      retryAfterPolicyValid:
        !hasRetryAfter ||
        (candidate.retryAfterMs as number) <= tarotGenerationMaximumProviderRetryAfterMs,
      retryAfterMs: hasRetryAfter ? (candidate.retryAfterMs as number) : null,
      status: "failed" as const,
    });
  }
  if (
    candidate.status !== "succeeded" ||
    !hasExactKeys(candidate, ["finishReason", "outputJson", "status", "usage"]) ||
    (candidate.finishReason !== "stop" &&
      candidate.finishReason !== "length" &&
      candidate.finishReason !== "other") ||
    typeof candidate.outputJson !== "string" ||
    candidate.outputJson.length === 0 ||
    utf8ByteLength(candidate.outputJson) > interpretationContractLimits.jsonMaximum
  ) {
    return null;
  }
  const usage = parseUsage(candidate.usage, runtime);
  return usage === null
    ? null
    : Object.freeze({
        finishReason: candidate.finishReason,
        outputJson: candidate.outputJson,
        status: "succeeded" as const,
        usage,
      });
};

const validateProvider = (
  provider: StructuredGenerationProviderV1,
  runtime: TarotGenerationRuntimeRegistrationV1,
): void => {
  const candidate = record(provider);
  const descriptor = record(candidate?.descriptor);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["descriptor", "generateStructured"]) ||
    typeof candidate.generateStructured !== "function" ||
    descriptor === null ||
    !hasExactKeys(descriptor, ["capabilities", "provider", "schemaVersion"]) ||
    descriptor.schemaVersion !== structuredGenerationProviderSchemaVersion ||
    !Array.isArray(descriptor.capabilities) ||
    descriptor.capabilities.length !== 2 ||
    !descriptor.capabilities.includes("structured_generation") ||
    !descriptor.capabilities.includes("usage_reporting") ||
    new Set(descriptor.capabilities).size !== descriptor.capabilities.length ||
    !exact(
      parseVersionReference(descriptor.provider, "AI_GENERATION_INPUT_INVALID"),
      runtime.provider,
    )
  ) {
    return fail("AI_GENERATION_INPUT_INVALID");
  }
};

const renderFallback = (
  input: TarotInterpretationInputV1,
  content: RetrievedTarotContentBundleV1,
  template: ApprovedTarotFallbackTemplateV1,
): TarotInterpretationOutputV1 => {
  const unique = (values: readonly string[]): readonly string[] =>
    Object.freeze([...new Set(values)]);
  const perspectives = unique(content.positions.map(({ themeReading }) => themeReading));
  const questions = unique(
    content.positions.flatMap(({ reflectionQuestions }) => reflectionQuestions),
  );
  const firstAction = content.positions.flatMap(({ smallActions }) => smallActions).at(0);
  if (perspectives.length === 0 || questions.length === 0 || firstAction === undefined) {
    return fail("AI_FALLBACK_TEMPLATE_INVALID");
  }
  const outputJson = JSON.stringify({
    boundaryNote: template.copy.boundaryNote,
    perspectives: perspectives.slice(0, interpretationContractLimits.perspectivesMaximum),
    reflectionQuestions: questions.slice(0, interpretationContractLimits.questionsMaximum),
    safety: {
      certaintyLevel: "reflective",
      containsGuaranteedOutcome: false,
      containsProfessionalAdvice: false,
    },
    schemaVersion: tarotInterpretationOutputSchemaVersion,
    smallAction: {
      label: firstAction,
      rationale: template.copy.smallActionRationale,
      timeHorizon: template.copy.timeHorizon,
    },
    sourceRefs: input.approvedContent.map(({ sourceRef }) => sourceRef),
    summary: template.copy.summary,
    symbols: content.positions.map((position) => ({
      factRef: position.factRef,
      limitation: position.cannotDetermine,
      meaning: position.themeReading,
      possibility: position.constructivePossibilities.at(0) ?? position.themeReading,
    })),
    title: template.copy.title,
  });
  try {
    return parseTarotInterpretationOutputForInputV1(input, outputJson);
  } catch {
    return fail("AI_FALLBACK_TEMPLATE_INVALID");
  }
};

const aggregateUsage = (usages: readonly ParsedUsageV1[]): ParsedUsageV1 | null => {
  if (usages.length === 0) return null;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let estimatedCostMicros = 0;
  let currencyCode: string | null = null;
  let allCostReported = true;
  for (const usage of usages) {
    inputTokens += usage.inputTokens;
    outputTokens += usage.outputTokens;
    totalTokens += usage.totalTokens;
    if (
      !Number.isSafeInteger(inputTokens) ||
      !Number.isSafeInteger(outputTokens) ||
      !Number.isSafeInteger(totalTokens) ||
      inputTokens > tarotGenerationMaximumReportedTokenCount ||
      outputTokens > tarotGenerationMaximumReportedTokenCount ||
      totalTokens > tarotGenerationMaximumReportedTokenCount
    ) {
      return null;
    }
    if (usage.estimatedCostMicros === null || usage.currencyCode === null) {
      allCostReported = false;
    } else {
      if (currencyCode !== null && currencyCode !== usage.currencyCode) allCostReported = false;
      currencyCode = usage.currencyCode;
      estimatedCostMicros += usage.estimatedCostMicros;
      if (!Number.isSafeInteger(estimatedCostMicros)) allCostReported = false;
    }
  }
  return Object.freeze({
    currencyCode: allCostReported ? currencyCode : null,
    estimatedCostMicros: allCostReported ? estimatedCostMicros : null,
    inputTokens,
    outputTokens,
    totalTokens,
  });
};

const usageWithinTotalCostBudget = (
  usages: readonly ParsedUsageV1[],
  runtime: TarotGenerationRuntimeRegistrationV1,
): boolean => {
  let total = 0;
  for (const usage of usages) {
    if (usage.estimatedCostMicros === null) continue;
    total += usage.estimatedCostMicros;
    if (!Number.isSafeInteger(total) || total > runtime.maximumEstimatedCostMicros) return false;
  }
  return true;
};

const reportedCostTotal = (usages: readonly ParsedUsageV1[]): number | null => {
  let total = 0;
  for (const usage of usages) {
    if (usage.estimatedCostMicros === null) return null;
    total += usage.estimatedCostMicros;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
};

const metadata = (
  input: TarotInterpretationInputV1,
  runtime: TarotGenerationRuntimeRegistrationV1,
  result: "failed" | "fallback" | "pending_verification",
  failureCode: StructuredGenerationFailureCode | null,
  retryReason: TarotGenerationRetryReasonV1 | null,
  attemptCount: number,
  latencyMs: number,
  usages: readonly ParsedUsageV1[],
): TarotGenerationOperationalMetadataV1 => {
  const usage = usages.length === attemptCount ? aggregateUsage(usages) : null;
  const costReportable =
    usage !== null &&
    usage.estimatedCostMicros !== null &&
    usage.estimatedCostMicros <= runtime.maximumEstimatedCostMicros;
  return deepFreeze({
    attemptCount,
    contentVersions: [...new Set(input.approvedContent.map(({ version }) => version))].sort(),
    costStatus: costReportable ? "reported" : "unavailable",
    currencyCode: costReportable ? usage.currencyCode : null,
    estimatedCostMicros: costReportable ? usage.estimatedCostMicros : null,
    failureCode,
    fallbackTemplateVersion: runtime.fallbackTemplate.version,
    inputTokens: usage?.inputTokens ?? null,
    latencyMs,
    locale: input.locale,
    modality: "tarot" as const,
    modelId: runtime.model.id,
    modelVersion: runtime.model.version,
    outputSchemaVersion: runtime.outputSchema.version,
    outputTokens: usage?.outputTokens ?? null,
    promptId: runtime.prompt.id,
    promptVersion: runtime.prompt.version,
    providerId: runtime.provider.id,
    providerVersion: runtime.provider.version,
    readingType: input.readingType,
    result,
    retryReason,
    safetyPolicyVersion: input.safetyDecision.policyVersion,
    schemaVersion: tarotGenerationOperationalMetadataSchemaVersion,
    themeCode: input.themeCode,
    tokenStatus: usage === null ? "unavailable" : "reported",
    totalTokens: usage?.totalTokens ?? null,
  });
};

type AttemptOutcomeV1 =
  | Readonly<{ kind: "execution_invalid" }>
  | Readonly<{ kind: "provider_rejected" }>
  | Readonly<{ kind: "provider_result"; result: unknown }>;

const validExecutionContext = (
  value: unknown,
  attempt: 1 | 2,
): value is StructuredGenerationExecutionContextV1 => {
  const candidate = record(value);
  const cancellation = record(candidate?.cancellation);
  return (
    candidate !== null &&
    hasExactKeys(candidate, ["attempt", "attemptId", "cancellation"]) &&
    candidate.attempt === attempt &&
    typeof candidate.attemptId === "string" &&
    candidate.attemptId.length <= 200 &&
    candidate.attemptId.length > 0 &&
    utf8ByteLength(candidate.attemptId) <= 200 &&
    !forbiddenTextPattern.test(candidate.attemptId) &&
    cancellation !== null &&
    typeof cancellation.aborted === "boolean" &&
    cancellation.aborted === false &&
    typeof cancellation.subscribe === "function"
  );
};

const parseElapsed = (value: unknown): number =>
  isSafeIntegerIn(value, 0, tarotGenerationMaximumOperationalLatencyMs)
    ? value
    : fail("AI_GENERATION_DEADLINE_INVALID");

const parseRunResult = <Value>(value: unknown): GenerationDeadlineRunResultV1<Value> => {
  const candidate = record(value);
  if (candidate === null || typeof candidate.status !== "string") {
    return fail("AI_GENERATION_DEADLINE_INVALID");
  }
  if (candidate.status === "settled" && hasExactKeys(candidate, ["elapsedMs", "status", "value"])) {
    return Object.freeze({
      elapsedMs: parseElapsed(candidate.elapsedMs),
      status: "settled" as const,
      value: candidate.value as Value,
    });
  }
  if (
    candidate.status === "timeout" &&
    hasExactKeys(candidate, ["cancellationAcknowledged", "elapsedMs", "status"]) &&
    typeof candidate.cancellationAcknowledged === "boolean"
  ) {
    return Object.freeze({
      cancellationAcknowledged: candidate.cancellationAcknowledged,
      elapsedMs: parseElapsed(candidate.elapsedMs),
      status: "timeout" as const,
    });
  }
  return fail("AI_GENERATION_DEADLINE_INVALID");
};

const parseWaitResult = (value: unknown): GenerationDeadlineWaitResultV1 => {
  const candidate = record(value);
  if (candidate === null || typeof candidate.status !== "string") {
    return fail("AI_GENERATION_DEADLINE_INVALID");
  }
  if (candidate.status === "settled" && hasExactKeys(candidate, ["elapsedMs", "status"])) {
    return Object.freeze({ elapsedMs: parseElapsed(candidate.elapsedMs), status: "settled" });
  }
  if (
    candidate.status === "timeout" &&
    hasExactKeys(candidate, ["cancellationAcknowledged", "elapsedMs", "status"]) &&
    typeof candidate.cancellationAcknowledged === "boolean"
  ) {
    return Object.freeze({
      cancellationAcknowledged: candidate.cancellationAcknowledged,
      elapsedMs: parseElapsed(candidate.elapsedMs),
      status: "timeout" as const,
    });
  }
  return fail("AI_GENERATION_DEADLINE_INVALID");
};

const validateRunner = (value: unknown): value is GenerationDeadlineRunnerV1 => {
  const candidate = record(value);
  return (
    candidate !== null &&
    hasExactKeys(candidate, ["run", "wait"]) &&
    typeof candidate.run === "function" &&
    typeof candidate.wait === "function"
  );
};

const fallbackResult = (
  input: GenerateTarotInterpretationInputV1,
  runtime: TarotGenerationRuntimeRegistrationV1,
  failureCode: StructuredGenerationFailureCode,
  retryReason: TarotGenerationRetryReasonV1 | null,
  attemptCount: number,
  latencyMs: number,
  usages: readonly ParsedUsageV1[],
): TarotInterpretationGenerationResultV1 =>
  deepFreeze({
    displayable: true as const,
    metadata: metadata(
      input.input,
      runtime,
      "fallback",
      failureCode,
      retryReason,
      attemptCount,
      latencyMs,
      usages,
    ),
    output: renderFallback(input.input, input.retrievedContent, input.fallbackTemplate),
    status: "fallback" as const,
  });

const failedResult = (
  input: GenerateTarotInterpretationInputV1,
  runtime: TarotGenerationRuntimeRegistrationV1,
  failureCode: "configuration" | "invalid_request" | "unknown",
  attemptCount: number,
  latencyMs: number,
): TarotInterpretationGenerationResultV1 =>
  deepFreeze({
    displayable: false as const,
    metadata: metadata(
      input.input,
      runtime,
      "failed",
      failureCode,
      null,
      attemptCount,
      latencyMs,
      Object.freeze([]),
    ),
    status: "failed" as const,
  });

const issuePendingTarotInterpretationCandidateV1 = (
  input: GenerateTarotInterpretationInputV1,
  generationProvenance: PreparedTarotInterpretationGenerationProvenanceV1,
  runtime: TarotGenerationRuntimeRegistrationV1,
  output: TarotInterpretationOutputV1,
  retryReason: TarotGenerationRetryReasonV1 | null,
  attemptCount: number,
  latencyMs: number,
  usages: readonly ParsedUsageV1[],
): PendingTarotInterpretationCandidateV1 => {
  const candidate = deepFreeze({
    displayable: false as const,
    metadata: metadata(
      input.input,
      runtime,
      "pending_verification",
      null,
      retryReason,
      attemptCount,
      latencyMs,
      usages,
    ),
    status: "pending_verification" as const,
  }) as PendingTarotInterpretationCandidateV1;
  const context = Object.freeze({
    candidate,
    candidateOutput: output,
    fallbackOutput: renderFallback(input.input, input.retrievedContent, input.fallbackTemplate),
    fallbackTemplate: input.fallbackTemplate,
    generationProvenance,
    input: input.input,
    retrievedContent: input.retrievedContent,
  });
  issuedPendingTarotCandidates.add(candidate);
  pendingTarotCandidateState.set(candidate, context);
  return candidate;
};

export const prepareTarotInterpretationGenerationV1 = async (
  input: PrepareTarotInterpretationGenerationInputV1,
): Promise<PreparedTarotInterpretationGenerationV1> => {
  if (typeof input !== "object" || input === null || typeof input.authorizeRuntime !== "function") {
    return fail("AI_GENERATION_INPUT_INVALID");
  }
  const runtime = parseRuntime(input.runtime);
  validateBindings(input, runtime);
  validateProvider(input.provider, runtime);

  let approved: unknown;
  try {
    approved = await input.authorizeRuntime(
      deepFreeze({
        locale: input.input.locale,
        modality: "tarot" as const,
        registration: runtime,
        safetyPolicyVersion: input.input.safetyDecision.policyVersion,
        schemaVersion: tarotGenerationAuthoritySchemaVersion,
        themeCode: input.input.themeCode,
      }),
    );
  } catch {
    return fail("AI_GENERATION_RUNTIME_NOT_APPROVED");
  }
  if (approved !== true) return fail("AI_GENERATION_RUNTIME_NOT_APPROVED");

  const prepared = deepFreeze({
    provenance: {
      fallbackTemplate: {
        approvalReference: input.fallbackTemplate.approvalReference,
        authorId: input.fallbackTemplate.authorId,
        checksum: input.fallbackTemplate.checksum,
        checksumScope: tarotFallbackChecksumScope,
        effectiveDate: input.fallbackTemplate.effectiveDate,
        eligibilityAsOf: input.fallbackTemplate.eligibilityAsOf,
        evaluationVersion: input.fallbackTemplate.evaluationVersion,
        id: input.fallbackTemplate.fallbackId,
        requiredApprovalRole: input.fallbackTemplate.requiredApprovalRole,
        reviewDueDate: input.fallbackTemplate.reviewDueDate,
        reviewedDate: input.fallbackTemplate.reviewedDate,
        reviewerId: input.fallbackTemplate.reviewerId,
        reviewerRole: input.fallbackTemplate.reviewerRole,
        schemaVersion: tarotFallbackTemplateSchemaVersion,
        version: input.fallbackTemplate.version,
      },
      prompt: input.prompt.provenance,
      request: {
        locale: input.input.locale,
        modality: "tarot" as const,
        readingType: input.input.readingType,
        requestId: input.input.requestId,
        safetyPolicyVersion: input.input.safetyDecision.policyVersion,
        themeCode: input.input.themeCode,
      },
      runtime,
      schemaVersion: "prepared-tarot-interpretation-generation-provenance.v1" as const,
    },
    schemaVersion: "prepared-tarot-interpretation-generation.v1" as const,
  }) as PreparedTarotInterpretationGenerationV1;
  issuedPreparedGenerations.add(prepared);
  preparedGenerationState.set(
    prepared,
    Object.freeze({
      input: Object.freeze({
        authorizeRuntime: input.authorizeRuntime,
        continuation: input.continuation,
        fallbackTemplate: input.fallbackTemplate,
        input: input.input,
        prompt: input.prompt,
        provider: input.provider,
        retrievedContent: input.retrievedContent,
        runtime: input.runtime,
      }),
      runtime,
    }),
  );
  return prepared;
};

export const executePreparedTarotInterpretationGenerationV1 = async (
  execution: ExecutePreparedTarotInterpretationGenerationInputV1,
): Promise<TarotInterpretationGenerationResultV1> => {
  const envelope = record(execution);
  if (
    envelope === null ||
    (execution.mode === "fallback_only"
      ? !hasExactKeys(envelope, ["mode", "prepared"])
      : execution.mode === "provider_with_fallback"
        ? !hasExactKeys(envelope, ["mode", "prepared", "provider", "runner"])
        : true) ||
    !issuedPreparedGenerations.has(execution.prepared) ||
    consumedPreparedGenerations.has(execution.prepared)
  ) {
    return fail("AI_GENERATION_INPUT_INVALID");
  }
  const state = preparedGenerationState.get(execution.prepared);
  if (state === undefined) return fail("AI_GENERATION_INPUT_INVALID");
  if (execution.mode === "provider_with_fallback" && execution.provider !== state.input.provider) {
    return fail("AI_GENERATION_BINDING_MISMATCH");
  }
  consumedPreparedGenerations.add(execution.prepared);
  const input = (
    execution.mode === "fallback_only"
      ? { ...state.input, mode: "fallback_only" as const }
      : {
          ...state.input,
          mode: "provider_with_fallback" as const,
          provider: execution.provider,
          runner: execution.runner,
        }
  ) as GenerateTarotInterpretationInputV1;
  const runtime = state.runtime;

  if (input.mode === "fallback_only") {
    return fallbackResult(input, runtime, "aborted", null, 0, 0, Object.freeze([]));
  }
  if (input.mode !== "provider_with_fallback") return fail("AI_GENERATION_INPUT_INVALID");
  validateProvider(input.provider, runtime);
  if (!validateRunner(input.runner)) return fail("AI_GENERATION_DEADLINE_INVALID");

  const request = deepFreeze({
    authorization: input.continuation.authorization,
    maxOutputTokens: runtime.maxOutputTokens,
    messages: input.prompt.messages,
    model: runtime.model,
    outputSchema: runtime.outputSchema,
    prompt: runtime.prompt,
    requestId: input.input.requestId,
    schemaVersion: structuredGenerationRequestSchemaVersion,
    timeoutMs: runtime.attemptTimeoutMs,
  }) satisfies StructuredGenerationRequestV1;

  const usages: ParsedUsageV1[] = [];
  let attemptCount = 0;
  let latencyMs = 0;
  let retryReason: TarotGenerationRetryReasonV1 | null = null;

  for (let ordinal = 1; ordinal <= runtime.maximumAttempts; ordinal += 1) {
    const attempt = ordinal as 1 | 2;
    const remainingMs = runtime.totalTimeoutMs - latencyMs;
    if (remainingMs <= 0) {
      return fallbackResult(
        input,
        runtime,
        "timeout",
        retryReason,
        attemptCount,
        latencyMs,
        usages,
      );
    }
    attemptCount = ordinal;
    let runValue: unknown;
    try {
      runValue = await input.runner.run<AttemptOutcomeV1>({
        attempt,
        operation: async (context) => {
          if (!validExecutionContext(context, attempt)) {
            return Object.freeze({ kind: "execution_invalid" as const });
          }
          try {
            const result: StructuredGenerationResultV1 = await input.provider.generateStructured(
              request,
              context,
            );
            return Object.freeze({ kind: "provider_result" as const, result });
          } catch {
            return Object.freeze({ kind: "provider_rejected" as const });
          }
        },
        timeoutMs: Math.min(runtime.attemptTimeoutMs, remainingMs),
      });
    } catch {
      return failedResult(input, runtime, "unknown", attemptCount, latencyMs);
    }
    let run: GenerationDeadlineRunResultV1<AttemptOutcomeV1>;
    try {
      run = parseRunResult<AttemptOutcomeV1>(runValue);
    } catch {
      return failedResult(input, runtime, "unknown", attemptCount, latencyMs);
    }
    latencyMs += run.elapsedMs;
    if (!Number.isSafeInteger(latencyMs)) return fail("AI_GENERATION_DEADLINE_INVALID");
    if (run.status === "timeout" || latencyMs >= runtime.totalTimeoutMs) {
      return fallbackResult(
        input,
        runtime,
        "timeout",
        retryReason,
        attemptCount,
        latencyMs,
        usages,
      );
    }
    if (run.value.kind === "execution_invalid") {
      return failedResult(input, runtime, "unknown", attemptCount, latencyMs);
    }
    if (run.value.kind === "provider_rejected") {
      return failedResult(input, runtime, "unknown", attemptCount, latencyMs);
    }

    const result = parseProviderResult(run.value.result, runtime);
    let retry: TarotGenerationRetryReasonV1 | null = null;
    let finalFailure: StructuredGenerationFailureCode = "invalid_response";
    if (result === null) {
      retry = null;
    } else if (result.status === "failed") {
      if (
        result.code === "configuration" ||
        result.code === "invalid_request" ||
        result.code === "unknown"
      ) {
        return failedResult(input, runtime, result.code, attemptCount, latencyMs);
      }
      finalFailure = result.code;
      if (
        result.retryAfterPolicyValid &&
        (result.code === "rate_limited" || result.code === "unavailable")
      ) {
        retry = result.code;
      }
    } else {
      usages.push(result.usage);
      if (!usageWithinTotalCostBudget(usages, runtime)) {
        return fallbackResult(
          input,
          runtime,
          "invalid_response",
          retryReason,
          attemptCount,
          latencyMs,
          usages,
        );
      }
      if (result.finishReason === "stop") {
        try {
          const output = parseTarotInterpretationOutputForInputV1(input.input, result.outputJson);
          return issuePendingTarotInterpretationCandidateV1(
            input,
            execution.prepared.provenance,
            runtime,
            output,
            retryReason,
            attemptCount,
            latencyMs,
            usages,
          );
        } catch {
          retry = result.usage.estimatedCostMicros === 0 ? "invalid_response" : null;
        }
      } else {
        retry = result.usage.estimatedCostMicros === 0 ? "invalid_response" : null;
      }
    }

    const costTotal = reportedCostTotal(usages);
    const hasRetryCostBudget = costTotal === null || costTotal < runtime.maximumEstimatedCostMicros;
    const canRetry = retry !== null && ordinal < runtime.maximumAttempts && hasRetryCostBudget;
    if (!canRetry) {
      return fallbackResult(
        input,
        runtime,
        finalFailure,
        retryReason,
        attemptCount,
        latencyMs,
        usages,
      );
    }
    retryReason = retry;
    const providerDelay =
      result?.status === "failed" && result.retryAfterMs !== null ? result.retryAfterMs : 0;
    const delayMs = Math.max(runtime.retryDelayMs, providerDelay);
    const delayRemainingMs = runtime.totalTimeoutMs - latencyMs;
    if (delayMs >= delayRemainingMs) {
      return fallbackResult(
        input,
        runtime,
        "timeout",
        retryReason,
        attemptCount,
        latencyMs,
        usages,
      );
    }
    if (delayMs > 0) {
      let waitValue: unknown;
      try {
        waitValue = await input.runner.wait({ delayMs, timeoutMs: delayRemainingMs });
      } catch {
        return failedResult(input, runtime, "unknown", attemptCount, latencyMs);
      }
      let wait: GenerationDeadlineWaitResultV1;
      try {
        wait = parseWaitResult(waitValue);
      } catch {
        return failedResult(input, runtime, "unknown", attemptCount, latencyMs);
      }
      latencyMs += wait.elapsedMs;
      if (
        !Number.isSafeInteger(latencyMs) ||
        wait.status === "timeout" ||
        latencyMs >= runtime.totalTimeoutMs
      ) {
        return fallbackResult(
          input,
          runtime,
          "timeout",
          retryReason,
          attemptCount,
          latencyMs,
          usages,
        );
      }
    }
  }
  return fail("AI_GENERATION_INPUT_INVALID");
};

export const generateTarotInterpretationV1 = async (
  input: GenerateTarotInterpretationInputV1,
): Promise<TarotInterpretationGenerationResultV1> => {
  const prepared = await prepareTarotInterpretationGenerationV1(input);
  return input.mode === "fallback_only"
    ? executePreparedTarotInterpretationGenerationV1({ mode: "fallback_only", prepared })
    : executePreparedTarotInterpretationGenerationV1({
        mode: "provider_with_fallback",
        prepared,
        provider: input.provider,
        runner: input.runner,
      });
};
