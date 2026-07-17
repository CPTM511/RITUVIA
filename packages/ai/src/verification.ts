import { snapshotOwnEnumerableData } from "@rituvia/observability/redaction";

import {
  consumePendingTarotInterpretationCandidateForVerificationV1,
  type PendingTarotInterpretationCandidateV1,
  type PendingTarotInterpretationVerificationContextV1,
} from "./generation.js";
import type { TarotInterpretationOutputV1 } from "./interpretation.js";
import type {
  ProviderChecksummedReferenceV1,
  ProviderVersionReferenceV1,
  StructuredGenerationCancellationV1,
} from "./provider.js";
import type { Sha256IntegrityVerifierV1 } from "./retrieval.js";

export const tarotVerificationPolicySchemaVersion = "tarot-verification-policy.v1" as const;
export const tarotVerificationPolicyAuthoritySchemaVersion =
  "tarot-verification-policy-authority.v1" as const;
export const tarotVerificationPolicyChecksumScope =
  "canonical-parsed-tarot-verification-policy-json.v1" as const;
export const tarotVerificationRuntimeSchemaVersion = "tarot-verification-runtime.v1" as const;
export const tarotVerificationRuntimeAuthoritySchemaVersion =
  "tarot-verification-runtime-authority.v1" as const;
export const tarotVerificationRuntimeChecksumScope =
  "canonical-parsed-tarot-verification-runtime-json.v1" as const;
export const tarotSemanticReviewerSchemaVersion = "tarot-semantic-reviewer.v1" as const;
export const tarotSemanticReviewRequestSchemaVersion = "tarot-semantic-review-request.v1" as const;
export const tarotSemanticReviewResultSchemaVersion = "tarot-semantic-review-result.v1" as const;
export const tarotVerificationCandidateAuthoritySchemaVersion =
  "tarot-verification-candidate-authority.v1" as const;
export const preparedTarotInterpretationVerifierSchemaVersion =
  "prepared-tarot-interpretation-verifier.v1" as const;
export const tarotVerificationOperationalMetadataSchemaVersion =
  "tarot-verification-operational-metadata.v1" as const;
export const tarotVerificationProvenanceSchemaVersion = "tarot-verification-provenance.v1" as const;
export const tarotInterpretationVerificationResultSchemaVersion =
  "tarot-interpretation-verification-result.v1" as const;
export const tarotVerificationCandidateDigestScope =
  "canonical-tarot-verification-candidate-json.v1" as const;
export const tarotVerificationOutputDigestScope =
  "canonical-tarot-verification-output-json.v1" as const;
export const tarotDeterministicVerificationChecksVersion =
  "tarot-post-generation-checks.v1" as const;

export const tarotVerificationCheckCodes = Object.freeze([
  "fabricated_fact",
  "certainty",
  "professional_advice",
  "paid_efficacy",
  "dependency",
  "injection",
  "supernatural_persecution",
  "self_harm",
  "relationship_mind_reading",
  "cultural_authority",
] as const);
export type TarotVerificationCheckCode = (typeof tarotVerificationCheckCodes)[number];

export const tarotVerificationErrorCodes = Object.freeze([
  "AI_VERIFICATION_INPUT_INVALID",
  "AI_VERIFICATION_CANDIDATE_INVALID",
  "AI_VERIFICATION_POLICY_INVALID",
  "AI_VERIFICATION_POLICY_INTEGRITY_MISMATCH",
  "AI_VERIFICATION_POLICY_NOT_APPROVED",
  "AI_VERIFICATION_RUNTIME_INVALID",
  "AI_VERIFICATION_RUNTIME_INTEGRITY_MISMATCH",
  "AI_VERIFICATION_RUNTIME_NOT_APPROVED",
  "AI_VERIFICATION_REVIEWER_NOT_INDEPENDENT",
  "AI_VERIFICATION_DIGEST_INVALID",
  "AI_VERIFICATION_AUTHORIZATION_DENIED",
] as const);
export type TarotVerificationErrorCode = (typeof tarotVerificationErrorCodes)[number];

export class TarotVerificationError extends Error {
  public readonly code: TarotVerificationErrorCode;

  public constructor(code: TarotVerificationErrorCode) {
    super(code);
    this.name = "TarotVerificationError";
    this.code = code;
  }
}

export type ApprovedTarotVerificationReferenceV1 = Readonly<{
  approvalReference: string;
  checksum: string;
  id: string;
  version: string;
}>;

declare const approvedTarotVerificationPolicyBrand: unique symbol;
const issuedVerificationPolicies = new WeakSet<object>();

export type ApprovedTarotVerificationPolicyV1 = Readonly<{
  approvalReference: string;
  authorId: string;
  checksum: string;
  checks: readonly TarotVerificationCheckCode[];
  effectiveDate: string;
  eligibilityAsOf: string;
  evaluationVersion: string;
  locale: string;
  maximumAggregateTextBytes: 65_536;
  modality: "tarot";
  normalization: "NFKC";
  policyId: string;
  requiredApprovalRole: string;
  reviewDueDate: string;
  reviewedDate: string;
  reviewerId: string;
  reviewerRole: string;
  schemaVersion: typeof tarotVerificationPolicySchemaVersion;
  status: "approved";
  tradition: string;
  version: string;
  [approvedTarotVerificationPolicyBrand]: true;
}>;

export type TarotVerificationPolicyAuthorityV1 = Readonly<{
  locale: string;
  modality: "tarot";
  policy: ApprovedTarotVerificationReferenceV1;
  schemaVersion: typeof tarotVerificationPolicyAuthoritySchemaVersion;
  tradition: string;
}>;

export type TarotVerificationPolicyAuthorityVerifierV1 = (
  authority: TarotVerificationPolicyAuthorityV1,
) => boolean | Promise<boolean>;

export type LoadApprovedTarotVerificationPolicyInputV1 = Readonly<{
  asOf: string;
  authorizePolicy: TarotVerificationPolicyAuthorityVerifierV1;
  policyJson: string;
  registration: ApprovedTarotVerificationReferenceV1;
  verifyIntegrity: Sha256IntegrityVerifierV1;
}>;

declare const approvedTarotVerificationRuntimeBrand: unique symbol;
const issuedVerificationRuntimes = new WeakSet<object>();

export type ApprovedTarotVerificationRuntimeV1 = Readonly<{
  approvalReference: string;
  authorId: string;
  checksum: string;
  effectiveDate: string;
  eligibilityAsOf: string;
  evaluationVersion: string;
  locale: string;
  modality: "tarot";
  model: ProviderVersionReferenceV1;
  policy: ApprovedTarotVerificationReferenceV1;
  provider: ProviderVersionReferenceV1;
  requiredApprovalRole: string;
  reviewDueDate: string;
  reviewedDate: string;
  reviewer: ApprovedTarotVerificationReferenceV1;
  reviewerId: string;
  reviewerPolicy: ApprovedTarotVerificationReferenceV1;
  reviewerResultMaximumBytes: number;
  reviewerRole: string;
  reviewerTimeoutMs: number;
  runtimeId: string;
  schemaVersion: typeof tarotVerificationRuntimeSchemaVersion;
  status: "approved";
  tradition: string;
  version: string;
  [approvedTarotVerificationRuntimeBrand]: true;
}>;

export type TarotVerificationRuntimeAuthorityV1 = Readonly<{
  locale: string;
  modality: "tarot";
  policy: ApprovedTarotVerificationReferenceV1;
  runtime: ApprovedTarotVerificationReferenceV1;
  schemaVersion: typeof tarotVerificationRuntimeAuthoritySchemaVersion;
  tradition: string;
}>;

export type TarotVerificationRuntimeAuthorityVerifierV1 = (
  authority: TarotVerificationRuntimeAuthorityV1,
) => boolean | Promise<boolean>;

export type LoadApprovedTarotVerificationRuntimeInputV1 = Readonly<{
  asOf: string;
  authorizeRuntime: TarotVerificationRuntimeAuthorityVerifierV1;
  policy: ApprovedTarotVerificationPolicyV1;
  registration: ApprovedTarotVerificationReferenceV1;
  runtimeJson: string;
  verifyIntegrity: Sha256IntegrityVerifierV1;
}>;

export type TarotSemanticReviewerExecutionContextV1 = Readonly<{
  attemptId: string;
  cancellation: StructuredGenerationCancellationV1;
}>;

export type TarotSemanticReviewFactV1 = Readonly<{
  cardId: string;
  cardTitle: string;
  evidence: Readonly<{
    cannotDetermine: string;
    constructivePossibilities: readonly string[];
    coreThemes: readonly string[];
    culturalNotes: readonly string[];
    positionDescription: string;
    reflectionQuestions: readonly string[];
    smallActions: readonly string[];
    tensions: readonly string[];
    themeReading: string;
  }>;
  factRef: string;
  orientation: "reversed" | "upright";
  positionId: string;
  positionTitle: string;
}>;

export type TarotSemanticReviewRequestV1 = Readonly<{
  allowedSourceRefs: readonly string[];
  candidateDigest: string;
  checks: readonly TarotVerificationCheckCode[];
  facts: readonly TarotSemanticReviewFactV1[];
  locale: string;
  modality: "tarot";
  output: TarotInterpretationOutputV1;
  schemaVersion: typeof tarotSemanticReviewRequestSchemaVersion;
  tradition: string;
}>;

export type TarotSemanticReviewerV1 = Readonly<{
  descriptor: Readonly<{
    model: ProviderVersionReferenceV1;
    policy: ProviderChecksummedReferenceV1;
    provider: ProviderVersionReferenceV1;
    reviewer: ProviderChecksummedReferenceV1;
    schemaVersion: typeof tarotSemanticReviewerSchemaVersion;
  }>;
  review: (
    request: TarotSemanticReviewRequestV1,
    context: TarotSemanticReviewerExecutionContextV1,
  ) => Promise<string>;
}>;

export type TarotVerificationDeadlineRunInputV1<Value> = Readonly<{
  operation: (context: TarotSemanticReviewerExecutionContextV1) => Promise<Value>;
  timeoutMs: number;
}>;

export type TarotVerificationDeadlineRunResultV1<Value> =
  | Readonly<{ elapsedMs: number; status: "settled"; value: Value }>
  | Readonly<{
      cancellationAcknowledged: boolean;
      elapsedMs: number;
      status: "timeout";
    }>;

export type TarotVerificationDeadlineRunnerV1 = Readonly<{
  run: <Value>(
    input: TarotVerificationDeadlineRunInputV1<Value>,
  ) => Promise<TarotVerificationDeadlineRunResultV1<Value>>;
}>;

export type TarotVerificationDigestProviderV1 = (canonicalJson: string) => string | Promise<string>;
export type TarotVerificationDigestVerifierV1 = (
  canonicalJson: string,
  digest: string,
) => boolean | Promise<boolean>;

export type TarotVerificationCandidateAuthorityV1 = Readonly<{
  candidateDigest: string;
  policy: ApprovedTarotVerificationReferenceV1;
  runtime: ApprovedTarotVerificationReferenceV1;
  schemaVersion: typeof tarotVerificationCandidateAuthoritySchemaVersion;
}>;

export type TarotVerificationCandidateAuthorityVerifierV1 = (
  authority: TarotVerificationCandidateAuthorityV1,
) => boolean | Promise<boolean>;

export type PrepareTarotInterpretationVerifierInputV1 = Readonly<{
  digest: TarotVerificationDigestProviderV1;
  generationProvider: ProviderVersionReferenceV1;
  policy: ApprovedTarotVerificationPolicyV1;
  reviewer: TarotSemanticReviewerV1;
  runner: TarotVerificationDeadlineRunnerV1;
  runtime: ApprovedTarotVerificationRuntimeV1;
  verifyDigest: TarotVerificationDigestVerifierV1;
}>;

declare const preparedTarotInterpretationVerifierBrand: unique symbol;
const issuedPreparedTarotInterpretationVerifiers = new WeakSet<object>();

export type PreparedTarotInterpretationVerifierV1 = Readonly<{
  policy: ApprovedTarotVerificationReferenceV1;
  reviewer: ApprovedTarotVerificationReferenceV1;
  reviewerModel: ProviderVersionReferenceV1;
  reviewerPolicy: ApprovedTarotVerificationReferenceV1;
  reviewerProvider: ProviderVersionReferenceV1;
  runtime: ApprovedTarotVerificationReferenceV1;
  schemaVersion: typeof preparedTarotInterpretationVerifierSchemaVersion;
  [preparedTarotInterpretationVerifierBrand]: true;
}>;

export type VerifyTarotInterpretationCandidateInputV1 = Readonly<{
  authorizeCandidate: TarotVerificationCandidateAuthorityVerifierV1;
  candidate: PendingTarotInterpretationCandidateV1;
  verifier: PreparedTarotInterpretationVerifierV1;
}>;

export type TarotVerificationOperationalMetadataV1 = Readonly<{
  deterministicChecksVersion: typeof tarotDeterministicVerificationChecksVersion;
  outcome: "safe_replacement" | "verified";
  policyVersion: string;
  reviewerModelVersion: string;
  reviewerPolicyVersion: string;
  reviewerProviderVersion: string;
  reviewerVersion: string;
  runtimeVersion: string;
  schemaVersion: typeof tarotVerificationOperationalMetadataSchemaVersion;
}>;

export type TarotVerificationProvenanceV1 = Readonly<{
  candidateDigest: string;
  candidateDigestScope: typeof tarotVerificationCandidateDigestScope;
  deterministicChecksVersion: typeof tarotDeterministicVerificationChecksVersion;
  outputDigest: string;
  outputDigestScope: typeof tarotVerificationOutputDigestScope;
  policy: ApprovedTarotVerificationReferenceV1;
  reviewer: ApprovedTarotVerificationReferenceV1;
  reviewerModel: ProviderVersionReferenceV1;
  reviewerPolicy: ApprovedTarotVerificationReferenceV1;
  reviewerProvider: ProviderVersionReferenceV1;
  runtime: ApprovedTarotVerificationReferenceV1;
  schemaVersion: typeof tarotVerificationProvenanceSchemaVersion;
  verificationTimeoutMs: number;
}>;

declare const tarotInterpretationVerificationResultBrand: unique symbol;
const issuedVerificationResults = new WeakSet<object>();

export type TarotInterpretationVerificationResultV1 = Readonly<{
  displayable: true;
  metadata: TarotVerificationOperationalMetadataV1;
  output: TarotInterpretationOutputV1;
  provenance: TarotVerificationProvenanceV1;
  schemaVersion: typeof tarotInterpretationVerificationResultSchemaVersion;
  status: "safe_replacement" | "verified";
  [tarotInterpretationVerificationResultBrand]: true;
}>;

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;
const keyedDigestPattern = /^hmac-sha256:[0-9a-f]{64}$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;
const forbiddenTextPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u;

const fail = (code: TarotVerificationErrorCode): never => {
  throw new TarotVerificationError(code);
};

const record = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const snapshot = snapshotOwnEnumerableData(value);
  return snapshot === null ? null : Object.fromEntries(snapshot);
};

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

const parseText = (value: unknown, maximum: number, code: TarotVerificationErrorCode): string => {
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

const parseIdentifier = (value: unknown, code: TarotVerificationErrorCode): string => {
  const parsed = parseText(value, 100, code);
  return identifierPattern.test(parsed) ? parsed : fail(code);
};

const parseVersion = (value: unknown, code: TarotVerificationErrorCode): string =>
  typeof value === "string" && utf8ByteLength(value) <= 100 && semanticVersionPattern.test(value)
    ? value
    : fail(code);

const parseChecksum = (value: unknown, code: TarotVerificationErrorCode): string =>
  typeof value === "string" && sha256Pattern.test(value) ? value : fail(code);

const parseDate = (value: unknown, code: TarotVerificationErrorCode): string => {
  if (typeof value !== "string" || !datePattern.test(value)) return fail(code);
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? value
    : fail(code);
};

const parseLocale = (value: unknown, code: TarotVerificationErrorCode): string => {
  const locale = parseText(value, 35, code);
  try {
    return new Intl.Locale(locale).toString() === locale ? locale : fail(code);
  } catch {
    return fail(code);
  }
};

const parseApprovalReference = (value: unknown, code: TarotVerificationErrorCode): string => {
  const parsed = parseText(value, 200, code);
  return approvalReferencePattern.test(parsed) ? parsed : fail(code);
};

const isIntegerIn = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

const parseReference = (
  value: unknown,
  code: TarotVerificationErrorCode,
): ApprovedTarotVerificationReferenceV1 => {
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
    version: parseVersion(candidate.version, code),
  });
};

const parseChecksummedReference = (
  value: unknown,
  code: TarotVerificationErrorCode,
): ProviderChecksummedReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["checksum", "id", "version"])) {
    return fail(code);
  }
  return Object.freeze({
    checksum: parseChecksum(candidate.checksum, code),
    id: parseIdentifier(candidate.id, code),
    version: parseVersion(candidate.version, code),
  });
};

const parseVersionReference = (
  value: unknown,
  code: TarotVerificationErrorCode,
): ProviderVersionReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["id", "version"])) return fail(code);
  return Object.freeze({
    id: parseIdentifier(candidate.id, code),
    version: parseVersion(candidate.version, code),
  });
};

type ParsedPolicyV1 = Omit<
  ApprovedTarotVerificationPolicyV1,
  typeof approvedTarotVerificationPolicyBrand | "checksum" | "eligibilityAsOf"
>;

const parseChecks = (
  value: unknown,
  code: TarotVerificationErrorCode,
): readonly TarotVerificationCheckCode[] => {
  if (!Array.isArray(value) || value.length !== tarotVerificationCheckCodes.length) {
    return fail(code);
  }
  if (value.some((entry, index) => entry !== tarotVerificationCheckCodes.at(index))) {
    return fail(code);
  }
  return Object.freeze([...tarotVerificationCheckCodes]);
};

const parsePolicyJson = (value: string): ParsedPolicyV1 => {
  const code = "AI_VERIFICATION_POLICY_INVALID" as const;
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
    candidate.schemaVersion !== tarotVerificationPolicySchemaVersion ||
    candidate.modality !== "tarot" ||
    candidate.status !== "approved" ||
    candidate.normalization !== "NFKC" ||
    candidate.maximumAggregateTextBytes !== 65_536 ||
    !hasExactKeys(candidate, [
      "approvalReference",
      "authorId",
      "checks",
      "effectiveDate",
      "evaluationVersion",
      "locale",
      "maximumAggregateTextBytes",
      "modality",
      "normalization",
      "policyId",
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
    return fail("AI_VERIFICATION_POLICY_NOT_APPROVED");
  }
  return deepFreeze({
    approvalReference: parseApprovalReference(candidate.approvalReference, code),
    authorId,
    checks: parseChecks(candidate.checks, code),
    effectiveDate,
    evaluationVersion: parseVersion(candidate.evaluationVersion, code),
    locale: parseLocale(candidate.locale, code),
    maximumAggregateTextBytes: 65_536 as const,
    modality: "tarot" as const,
    normalization: "NFKC" as const,
    policyId: parseIdentifier(candidate.policyId, code),
    requiredApprovalRole,
    reviewDueDate,
    reviewedDate,
    reviewerId,
    reviewerRole,
    schemaVersion: tarotVerificationPolicySchemaVersion,
    status: "approved" as const,
    tradition: parseIdentifier(candidate.tradition, code),
    version: parseVersion(candidate.version, code),
  });
};

export const isApprovedTarotVerificationPolicyV1 = (
  value: unknown,
): value is ApprovedTarotVerificationPolicyV1 =>
  typeof value === "object" && value !== null && issuedVerificationPolicies.has(value);

export const loadApprovedTarotVerificationPolicyV1 = async (
  input: LoadApprovedTarotVerificationPolicyInputV1,
): Promise<ApprovedTarotVerificationPolicyV1> => {
  const envelope = record(input);
  if (
    envelope === null ||
    !hasExactKeys(envelope, [
      "asOf",
      "authorizePolicy",
      "policyJson",
      "registration",
      "verifyIntegrity",
    ])
  ) {
    return fail("AI_VERIFICATION_POLICY_INVALID");
  }
  const asOf = parseDate(envelope.asOf, "AI_VERIFICATION_POLICY_INVALID");
  const registration = parseReference(envelope.registration, "AI_VERIFICATION_POLICY_INVALID");
  const policy = parsePolicyJson(
    typeof envelope.policyJson === "string"
      ? envelope.policyJson
      : fail("AI_VERIFICATION_POLICY_INVALID"),
  );
  const verifyIntegrity = envelope.verifyIntegrity;
  if (typeof verifyIntegrity !== "function") return fail("AI_VERIFICATION_POLICY_INVALID");
  let integrity: unknown;
  try {
    integrity = await verifyIntegrity(JSON.stringify(policy), registration.checksum);
  } catch {
    return fail("AI_VERIFICATION_POLICY_INTEGRITY_MISMATCH");
  }
  if (integrity !== true) return fail("AI_VERIFICATION_POLICY_INTEGRITY_MISMATCH");
  if (
    policy.policyId !== registration.id ||
    policy.version !== registration.version ||
    policy.approvalReference !== registration.approvalReference
  ) {
    return fail("AI_VERIFICATION_POLICY_INVALID");
  }
  if (policy.reviewedDate > asOf || policy.effectiveDate > asOf || policy.reviewDueDate < asOf) {
    return fail("AI_VERIFICATION_POLICY_NOT_APPROVED");
  }
  const authorizePolicy = envelope.authorizePolicy;
  if (typeof authorizePolicy !== "function") {
    return fail("AI_VERIFICATION_POLICY_INVALID");
  }
  let authorized: unknown;
  try {
    authorized = await authorizePolicy(
      deepFreeze({
        locale: policy.locale,
        modality: "tarot" as const,
        policy: registration,
        schemaVersion: tarotVerificationPolicyAuthoritySchemaVersion,
        tradition: policy.tradition,
      }),
    );
  } catch {
    return fail("AI_VERIFICATION_POLICY_NOT_APPROVED");
  }
  if (authorized !== true) return fail("AI_VERIFICATION_POLICY_NOT_APPROVED");
  const approved = deepFreeze({
    ...policy,
    checksum: registration.checksum,
    eligibilityAsOf: asOf,
  }) as ApprovedTarotVerificationPolicyV1;
  issuedVerificationPolicies.add(approved);
  return approved;
};

type ParsedRuntimeV1 = Omit<
  ApprovedTarotVerificationRuntimeV1,
  typeof approvedTarotVerificationRuntimeBrand | "checksum" | "eligibilityAsOf"
>;

const parseRuntimeJson = (value: string): ParsedRuntimeV1 => {
  const code = "AI_VERIFICATION_RUNTIME_INVALID" as const;
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
    candidate.schemaVersion !== tarotVerificationRuntimeSchemaVersion ||
    candidate.modality !== "tarot" ||
    candidate.status !== "approved" ||
    !isIntegerIn(candidate.reviewerResultMaximumBytes, 256, 16_384) ||
    !isIntegerIn(candidate.reviewerTimeoutMs, 100, 30_000) ||
    !hasExactKeys(candidate, [
      "approvalReference",
      "authorId",
      "effectiveDate",
      "evaluationVersion",
      "locale",
      "modality",
      "model",
      "policy",
      "provider",
      "requiredApprovalRole",
      "reviewDueDate",
      "reviewedDate",
      "reviewer",
      "reviewerId",
      "reviewerPolicy",
      "reviewerResultMaximumBytes",
      "reviewerRole",
      "reviewerTimeoutMs",
      "runtimeId",
      "schemaVersion",
      "status",
      "tradition",
      "version",
    ])
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
    return fail("AI_VERIFICATION_RUNTIME_NOT_APPROVED");
  }
  return deepFreeze({
    approvalReference: parseApprovalReference(candidate.approvalReference, code),
    authorId,
    effectiveDate,
    evaluationVersion: parseVersion(candidate.evaluationVersion, code),
    locale: parseLocale(candidate.locale, code),
    modality: "tarot" as const,
    model: parseVersionReference(candidate.model, code),
    policy: parseReference(candidate.policy, code),
    provider: parseVersionReference(candidate.provider, code),
    requiredApprovalRole,
    reviewDueDate,
    reviewedDate,
    reviewer: parseReference(candidate.reviewer, code),
    reviewerId,
    reviewerPolicy: parseReference(candidate.reviewerPolicy, code),
    reviewerResultMaximumBytes: candidate.reviewerResultMaximumBytes,
    reviewerRole,
    reviewerTimeoutMs: candidate.reviewerTimeoutMs,
    runtimeId: parseIdentifier(candidate.runtimeId, code),
    schemaVersion: tarotVerificationRuntimeSchemaVersion,
    status: "approved" as const,
    tradition: parseIdentifier(candidate.tradition, code),
    version: parseVersion(candidate.version, code),
  });
};

export const isApprovedTarotVerificationRuntimeV1 = (
  value: unknown,
): value is ApprovedTarotVerificationRuntimeV1 =>
  typeof value === "object" && value !== null && issuedVerificationRuntimes.has(value);

export const loadApprovedTarotVerificationRuntimeV1 = async (
  input: LoadApprovedTarotVerificationRuntimeInputV1,
): Promise<ApprovedTarotVerificationRuntimeV1> => {
  const envelope = record(input);
  if (
    envelope === null ||
    !hasExactKeys(envelope, [
      "asOf",
      "authorizeRuntime",
      "policy",
      "registration",
      "runtimeJson",
      "verifyIntegrity",
    ])
  ) {
    return fail("AI_VERIFICATION_RUNTIME_INVALID");
  }
  if (!isApprovedTarotVerificationPolicyV1(envelope.policy)) {
    return fail("AI_VERIFICATION_RUNTIME_INVALID");
  }
  const policy = envelope.policy;
  const asOf = parseDate(envelope.asOf, "AI_VERIFICATION_RUNTIME_INVALID");
  const registration = parseReference(envelope.registration, "AI_VERIFICATION_RUNTIME_INVALID");
  const runtime = parseRuntimeJson(
    typeof envelope.runtimeJson === "string"
      ? envelope.runtimeJson
      : fail("AI_VERIFICATION_RUNTIME_INVALID"),
  );
  const verifyIntegrity = envelope.verifyIntegrity;
  if (typeof verifyIntegrity !== "function") return fail("AI_VERIFICATION_RUNTIME_INVALID");
  let integrity: unknown;
  try {
    integrity = await verifyIntegrity(JSON.stringify(runtime), registration.checksum);
  } catch {
    return fail("AI_VERIFICATION_RUNTIME_INTEGRITY_MISMATCH");
  }
  if (integrity !== true) return fail("AI_VERIFICATION_RUNTIME_INTEGRITY_MISMATCH");
  if (
    runtime.runtimeId !== registration.id ||
    runtime.version !== registration.version ||
    runtime.approvalReference !== registration.approvalReference ||
    runtime.policy.id !== policy.policyId ||
    runtime.policy.version !== policy.version ||
    runtime.policy.checksum !== policy.checksum ||
    runtime.policy.approvalReference !== policy.approvalReference ||
    runtime.locale !== policy.locale ||
    runtime.tradition !== policy.tradition ||
    runtime.evaluationVersion !== policy.evaluationVersion ||
    asOf !== policy.eligibilityAsOf
  ) {
    return fail("AI_VERIFICATION_RUNTIME_INVALID");
  }
  if (runtime.reviewedDate > asOf || runtime.effectiveDate > asOf || runtime.reviewDueDate < asOf) {
    return fail("AI_VERIFICATION_RUNTIME_NOT_APPROVED");
  }
  const authorizeRuntime = envelope.authorizeRuntime;
  if (typeof authorizeRuntime !== "function") {
    return fail("AI_VERIFICATION_RUNTIME_INVALID");
  }
  let authorized: unknown;
  try {
    authorized = await authorizeRuntime(
      deepFreeze({
        locale: runtime.locale,
        modality: "tarot" as const,
        policy: runtime.policy,
        runtime: registration,
        schemaVersion: tarotVerificationRuntimeAuthoritySchemaVersion,
        tradition: runtime.tradition,
      }),
    );
  } catch {
    return fail("AI_VERIFICATION_RUNTIME_NOT_APPROVED");
  }
  if (authorized !== true) return fail("AI_VERIFICATION_RUNTIME_NOT_APPROVED");
  const approved = deepFreeze({
    ...runtime,
    checksum: registration.checksum,
    eligibilityAsOf: asOf,
  }) as ApprovedTarotVerificationRuntimeV1;
  issuedVerificationRuntimes.add(approved);
  return approved;
};

type ParsedSemanticReviewerV1 = Readonly<{
  descriptor: Readonly<{
    model: ProviderVersionReferenceV1;
    policy: ProviderChecksummedReferenceV1;
    provider: ProviderVersionReferenceV1;
    reviewer: ProviderChecksummedReferenceV1;
  }>;
  receiver: object;
  review: TarotSemanticReviewerV1["review"];
}>;

type PreparedVerifierStateV1 = Readonly<{
  digest: TarotVerificationDigestProviderV1;
  generationProvider: ProviderVersionReferenceV1;
  policy: ApprovedTarotVerificationPolicyV1;
  reviewer: ParsedSemanticReviewerV1;
  runner: Readonly<{
    receiver: object;
    run: TarotVerificationDeadlineRunnerV1["run"];
  }>;
  runtime: ApprovedTarotVerificationRuntimeV1;
  verifyDigest: TarotVerificationDigestVerifierV1;
}>;

const preparedVerifierStates = new WeakMap<object, PreparedVerifierStateV1>();

const approvedPolicyReference = (
  policy: ApprovedTarotVerificationPolicyV1,
): ApprovedTarotVerificationReferenceV1 =>
  Object.freeze({
    approvalReference: policy.approvalReference,
    checksum: policy.checksum,
    id: policy.policyId,
    version: policy.version,
  });

const approvedRuntimeReference = (
  runtime: ApprovedTarotVerificationRuntimeV1,
): ApprovedTarotVerificationReferenceV1 =>
  Object.freeze({
    approvalReference: runtime.approvalReference,
    checksum: runtime.checksum,
    id: runtime.runtimeId,
    version: runtime.version,
  });

const sameVersionReference = (
  left: ProviderVersionReferenceV1,
  right: ProviderVersionReferenceV1,
): boolean => left.id === right.id && left.version === right.version;

const sameChecksummedReference = (
  left: ProviderChecksummedReferenceV1,
  right: ApprovedTarotVerificationReferenceV1,
): boolean =>
  left.id === right.id && left.version === right.version && left.checksum === right.checksum;

const parseSemanticReviewer = (
  value: unknown,
  runtime: ApprovedTarotVerificationRuntimeV1,
): ParsedSemanticReviewerV1 => {
  const reviewer = record(value);
  if (
    reviewer === null ||
    !hasExactKeys(reviewer, ["descriptor", "review"]) ||
    typeof reviewer.review !== "function"
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  const descriptor = record(reviewer.descriptor);
  if (
    descriptor === null ||
    !hasExactKeys(descriptor, ["model", "policy", "provider", "reviewer", "schemaVersion"]) ||
    descriptor.schemaVersion !== tarotSemanticReviewerSchemaVersion
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  const parsed = Object.freeze({
    model: parseVersionReference(descriptor.model, "AI_VERIFICATION_INPUT_INVALID"),
    policy: parseChecksummedReference(descriptor.policy, "AI_VERIFICATION_INPUT_INVALID"),
    provider: parseVersionReference(descriptor.provider, "AI_VERIFICATION_INPUT_INVALID"),
    reviewer: parseChecksummedReference(descriptor.reviewer, "AI_VERIFICATION_INPUT_INVALID"),
  });
  if (
    !sameChecksummedReference(parsed.reviewer, runtime.reviewer) ||
    !sameChecksummedReference(parsed.policy, runtime.reviewerPolicy) ||
    !sameVersionReference(parsed.provider, runtime.provider) ||
    !sameVersionReference(parsed.model, runtime.model)
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  return Object.freeze({
    descriptor: parsed,
    receiver: value as object,
    review: reviewer.review as TarotSemanticReviewerV1["review"],
  });
};

export const isPreparedTarotInterpretationVerifierV1 = (
  value: unknown,
): value is PreparedTarotInterpretationVerifierV1 =>
  typeof value === "object" &&
  value !== null &&
  issuedPreparedTarotInterpretationVerifiers.has(value);

export const prepareTarotInterpretationVerifierV1 = (
  input: PrepareTarotInterpretationVerifierInputV1,
): PreparedTarotInterpretationVerifierV1 => {
  const envelope = record(input);
  if (
    envelope === null ||
    !hasExactKeys(envelope, [
      "digest",
      "generationProvider",
      "policy",
      "reviewer",
      "runner",
      "runtime",
      "verifyDigest",
    ]) ||
    !isApprovedTarotVerificationPolicyV1(envelope.policy) ||
    !isApprovedTarotVerificationRuntimeV1(envelope.runtime) ||
    typeof envelope.digest !== "function" ||
    typeof envelope.verifyDigest !== "function"
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  const policy = envelope.policy;
  const runtime = envelope.runtime;
  const generationProvider = parseVersionReference(
    envelope.generationProvider,
    "AI_VERIFICATION_INPUT_INVALID",
  );
  if (
    runtime.policy.id !== policy.policyId ||
    runtime.policy.version !== policy.version ||
    runtime.policy.checksum !== policy.checksum ||
    runtime.policy.approvalReference !== policy.approvalReference ||
    runtime.locale !== policy.locale ||
    runtime.tradition !== policy.tradition ||
    runtime.eligibilityAsOf !== policy.eligibilityAsOf
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  const reviewer = parseSemanticReviewer(envelope.reviewer, runtime);
  if (generationProvider.id === reviewer.descriptor.provider.id) {
    return fail("AI_VERIFICATION_REVIEWER_NOT_INDEPENDENT");
  }
  const runner = record(envelope.runner);
  if (runner === null || !hasExactKeys(runner, ["run"]) || typeof runner.run !== "function") {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  const plan = deepFreeze({
    policy: approvedPolicyReference(policy),
    reviewer: runtime.reviewer,
    reviewerModel: reviewer.descriptor.model,
    reviewerPolicy: runtime.reviewerPolicy,
    reviewerProvider: reviewer.descriptor.provider,
    runtime: approvedRuntimeReference(runtime),
    schemaVersion: preparedTarotInterpretationVerifierSchemaVersion,
  }) as PreparedTarotInterpretationVerifierV1;
  issuedPreparedTarotInterpretationVerifiers.add(plan);
  preparedVerifierStates.set(
    plan,
    Object.freeze({
      digest: envelope.digest as TarotVerificationDigestProviderV1,
      generationProvider,
      policy,
      reviewer,
      runner: Object.freeze({
        receiver: envelope.runner as object,
        run: runner.run as TarotVerificationDeadlineRunnerV1["run"],
      }),
      runtime,
      verifyDigest: envelope.verifyDigest as TarotVerificationDigestVerifierV1,
    }),
  );
  return plan;
};

type VisibleTextLeafV1 = Readonly<{
  factRef: string | null;
  text: string;
}>;

const visibleTextLeaves = (output: TarotInterpretationOutputV1): readonly VisibleTextLeafV1[] => {
  const leaves: VisibleTextLeafV1[] = [
    { factRef: null, text: output.title },
    { factRef: null, text: output.summary },
    ...output.perspectives.map((text) => ({ factRef: null, text })),
    ...output.reflectionQuestions.map((text) => ({ factRef: null, text })),
    { factRef: null, text: output.smallAction.label },
    { factRef: null, text: output.smallAction.rationale },
    { factRef: null, text: output.boundaryNote },
  ];
  for (const symbol of output.symbols) {
    leaves.push(
      { factRef: symbol.factRef, text: symbol.meaning },
      { factRef: symbol.factRef, text: symbol.possibility },
    );
    if (symbol.limitation !== undefined) {
      leaves.push({ factRef: symbol.factRef, text: symbol.limitation });
    }
  }
  if (output.ritualSuggestion !== undefined) {
    leaves.push({ factRef: null, text: output.ritualSuggestion.reason });
  }
  return Object.freeze(leaves.map((leaf) => Object.freeze(leaf)));
};

const confusableCharacters: ReadonlyMap<string, string> = new Map([
  ["\u0391", "a"],
  ["\u0392", "b"],
  ["\u0395", "e"],
  ["\u0397", "h"],
  ["\u0399", "i"],
  ["\u039A", "k"],
  ["\u039C", "m"],
  ["\u039D", "n"],
  ["\u039F", "o"],
  ["\u03A1", "p"],
  ["\u03A4", "t"],
  ["\u03A5", "y"],
  ["\u03A7", "x"],
  ["\u03B1", "a"],
  ["\u03B5", "e"],
  ["\u03B9", "i"],
  ["\u03BA", "k"],
  ["\u03BF", "o"],
  ["\u03C1", "p"],
  ["\u03C4", "t"],
  ["\u03C5", "y"],
  ["\u03C7", "x"],
  ["\u0410", "a"],
  ["\u0412", "b"],
  ["\u0415", "e"],
  ["\u041A", "k"],
  ["\u041C", "m"],
  ["\u041D", "h"],
  ["\u041E", "o"],
  ["\u0420", "p"],
  ["\u0421", "c"],
  ["\u0422", "t"],
  ["\u0425", "x"],
  ["\u0430", "a"],
  ["\u0435", "e"],
  ["\u043E", "o"],
  ["\u0440", "p"],
  ["\u0441", "c"],
  ["\u0443", "y"],
  ["\u0445", "x"],
  ["\u0456", "i"],
  ["\u0458", "j"],
]);

const confusablePattern =
  /[\u0391\u0392\u0395\u0397\u0399\u039a\u039c\u039d\u039f\u03a1\u03a4\u03a5\u03a7\u03b1\u03b5\u03b9\u03ba\u03bf\u03c1\u03c4\u03c5\u03c7\u0410\u0412\u0415\u041a\u041c\u041d\u041e\u0420\u0421\u0422\u0425\u0430\u0435\u043e\u0440\u0441\u0443\u0445\u0456\u0458]/gu;

const normalizeForVerification = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\p{Cf}\p{M}]/gu, "")
    .replace(confusablePattern, (character) => confusableCharacters.get(character) ?? character)
    .toLowerCase();

const neutralizeSafeLanguage = (value: string): string =>
  value
    .replace(
      /\b(?:not|never|cannot|can't|can not|does not|doesn't|is not|isn't|no)\s+(?:a\s+)?(?:prediction|guarantee(?:d)?|certainty|diagnos(?:e|is)|treat|prescribe|cure|medical advice|legal advice|financial advice|professional advice|determine|predict)\b/gu,
      " ",
    )
    .replace(
      /\b(?:nothing|no\s+(?:card|reading|symbol))[^.!?]{0,48}\b(?:guarantees?|predicts?|determines?)\b/gu,
      " ",
    )
    .replace(/\bdo\s+not\s+(?:stop|change|skip)\s+(?:your\s+)?medication\b/gu, " ")
    .replace(
      /\b(?:paying|payment|upgrading|premium)[^.!?]{0,48}\b(?:does not|doesn't|cannot|can't)\s+(?:make|create|increase|improve)\b/gu,
      " ",
    )
    .replace(/\byou\s+(?:do not|don't)\s+need\s+(?:me|this\s+reading|rituvia)\b/gu, " ");

const deterministicCategoryPatterns: Readonly<
  Partial<Record<TarotVerificationCheckCode, readonly RegExp[]>>
> = Object.freeze({
  certainty: Object.freeze([
    /\bguarantee(?:d|s)?\b/gu,
    /\b(?:definitely|certainly|inevitably|without a doubt|100\s*%)\b/gu,
    /\b(?:will|must)\s+(?:definitely\s+)?(?:happen|occur|come true|return|succeed)\b/gu,
    /\b(?:destined|fated)\s+to\b/gu,
  ]),
  professional_advice: Object.freeze([
    /\b(?:diagnos(?:e|is)|prescrib(?:e|ed)|treat(?:ment)?|cure[sd]?)\b/gu,
    /\b(?:stop|change|skip)\s+(?:your\s+)?(?:medication|medicine|treatment)\b/gu,
    /\b(?:medical|legal|financial|investment)\s+advice\b/gu,
    /\b(?:buy|sell|short)\s+(?:this\s+)?(?:stock|security|crypto|bitcoin)\b/gu,
    /\b(?:you are|you have)\s+(?:pregnant|bipolar|depressed|psychotic)\b/gu,
  ]),
  paid_efficacy: Object.freeze([
    /\b(?:pay|buy|purchase|upgrade|premium|subscription)[^.!?]{0,64}\b(?:stronger|more effective|more powerful|better result|spiritual efficacy)\b/gu,
    /\b(?:stronger|more effective|more powerful|better result|spiritual efficacy)[^.!?]{0,64}\b(?:pay|paid|premium|purchase|upgrade)\b/gu,
  ]),
  dependency: Object.freeze([
    /\b(?:only i|only this reading|only rituvia)\s+can\b/gu,
    /\b(?:need|must use|must consult)\s+(?:me|this reading|rituvia)\s+(?:daily|every day|to cope|to be safe)\b/gu,
    /\b(?:do not|don't|never)\s+(?:leave|stop using|question)\s+(?:me|this reading|rituvia)\b/gu,
    /\b(?:cannot|can't)\s+(?:cope|decide|function|be safe)\s+without\s+(?:me|this reading|rituvia)\b/gu,
    /\b(?:act|pay|book|read again)\s+now\b[^.!?]{0,48}\b(?:or else|before it is too late|to avoid danger)\b/gu,
    /\b(?:keep|continue)\s+(?:drawing|asking|getting readings?)[^.!?]{0,48}\buntil\b/gu,
    /\b(?:another|repeated|daily)\s+reading\s+(?:is|required|will keep you safe)\b/gu,
  ]),
  injection: Object.freeze([
    /\b(?:ignore|disregard|override)\b[^.!?]{0,64}\b(?:instruction|message|policy|prompt|system|developer)\b/gu,
    /\b(?:reveal|expose|print)\b[^.!?]{0,64}\b(?:instruction|prompt|secret|system message)\b/gu,
    /\b(?:system|developer|assistant)\s+(?:instruction|message|prompt|role)\b/gu,
    /\brole\s*:\s*(?:system|developer|assistant)\b/gu,
  ]),
  supernatural_persecution: Object.freeze([
    /\b(?:you are|you have been|someone has)\s+(?:cursed|hexed|possessed)\b/gu,
    /\b(?:demon|evil spirit|entity|curse)\b[^.!?]{0,64}\b(?:targets?|watches?|follows?|controls?|attacks?)\s+you\b/gu,
    /\b(?:remove|break|lift)\s+(?:the|your|a)\s+(?:curse|hex|possession)\b/gu,
    /\byou\s+(?:are|have been)\s+(?:chosen|divinely selected|awakened)\b[^.!?]{0,64}\b(?:special powers?|divine mission|cosmic mission)\b/gu,
    /\byou\s+(?:can|will)\s+(?:control reality|command the universe|read every mind)\b/gu,
  ]),
  self_harm: Object.freeze([
    /\b(?:kill|hurt|harm|cut)\s+yourself\b/gu,
    /\bend\s+your\s+(?:life|existence)\b/gu,
    /\b(?:commit|attempt)\s+suicide\b/gu,
    /\bsuicide\s+(?:is|would be)\s+(?:the|a)\s+(?:answer|solution|option)\b/gu,
    /\b(?:jump|drive|walk)\s+(?:off|into)\s+(?:a bridge|traffic|the ocean|a cliff)\b/gu,
  ]),
  relationship_mind_reading: Object.freeze([
    /\b(?:he|she|they|your ex|your partner)\s+(?:secretly\s+)?(?:loves?|hates?|is cheating on|is lying to|is thinking about|will return to)\s+you\b/gu,
    /\b(?:your ex|your partner|they)\s+will\s+(?:return|leave|propose|confess)\b/gu,
    /\b(?:twin flame|soulmate)\s+(?:is|will)\b/gu,
  ]),
  cultural_authority: Object.freeze([
    /\b(?:i speak|this reading speaks)\s+for\s+(?:all|the)\s+(?:indigenous|hindu|buddhist|islamic|christian|jewish|hoodoo|vedic)\b/gu,
    /\b(?:all|every)\s+(?:indigenous|hindu|buddhist|muslim|christian|jewish)\s+(?:people|practitioners|believe|teach)\b/gu,
    /\b(?:the only|one true)\s+(?:sacred|traditional|spiritual)\s+(?:meaning|teaching|interpretation)\b/gu,
    /\bas\s+(?:a|your)\s+(?:priest|priestess|shaman|guru|medicine man)\b/gu,
  ]),
  fabricated_fact: Object.freeze([
    /\b(?:you previously told me|you told me before|i remember you|your past readings? (?:show|said)|based on your (?:journal|history|birth data|private data))\b/gu,
  ]),
});
const deterministicCategoryPatternsByCode: ReadonlyMap<
  TarotVerificationCheckCode,
  readonly RegExp[]
> = new Map(
  Object.entries(deterministicCategoryPatterns) as readonly (readonly [
    TarotVerificationCheckCode,
    readonly RegExp[],
  ])[],
);

const majorArcanaNames = Object.freeze([
  "the fool",
  "the magician",
  "the high priestess",
  "the empress",
  "the emperor",
  "the hierophant",
  "the lovers",
  "the chariot",
  "strength",
  "the hermit",
  "wheel of fortune",
  "justice",
  "the hanged man",
  "death",
  "temperance",
  "the devil",
  "the tower",
  "the star",
  "the moon",
  "the sun",
  "judgement",
  "the world",
] as const);

const commonPositionNames = Object.freeze([
  "past",
  "present",
  "future",
  "situation",
  "challenge",
  "advice",
  "outcome",
  "obstacle",
  "action",
] as const);

const isAsciiAlphaNumeric = (value: string | undefined): boolean => {
  if (value === undefined || value.length === 0) return false;
  const code = value.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
};

const containsPhrase = (text: string, phrase: string): boolean => {
  if (phrase.length === 0) return false;
  let offset = 0;
  while (offset <= text.length - phrase.length) {
    const index = text.indexOf(phrase, offset);
    if (index === -1) return false;
    if (
      !isAsciiAlphaNumeric(text.at(index - 1)) &&
      !isAsciiAlphaNumeric(text.at(index + phrase.length))
    ) {
      return true;
    }
    offset = index + phrase.length;
  }
  return false;
};

const sameStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every((entry) => expected.has(entry));
};

const cardNameAliases = (value: string): readonly string[] => {
  const normalized = normalizeForVerification(value);
  return normalized.startsWith("the ")
    ? Object.freeze([normalized, normalized.slice(4)])
    : Object.freeze([normalized, `the ${normalized}`]);
};

const genericCardLabels = new Set([
  "drawn",
  "first",
  "same",
  "second",
  "selected",
  "tarot",
  "third",
]);

const explicitNamedCards = (text: string): readonly string[] => {
  const names: string[] = [];
  const titled = /\bthe\s+([a-z][a-z0-9'-]*(?:\s+(?:of\s+)?[a-z][a-z0-9'-]*){0,2})\s+card\b/gu;
  const labeled = /\bcard\s*:\s*([a-z][a-z0-9'-]*(?:\s+(?:of\s+)?[a-z][a-z0-9'-]*){0,2})\b/gu;
  for (const pattern of [titled, labeled]) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1];
      if (name !== undefined && !genericCardLabels.has(name)) names.push(name);
    }
  }
  return names;
};

const explicitNamedPositions = (text: string): readonly string[] => {
  const names: string[] = [];
  const titled = /\bthe\s+([a-z][a-z0-9'-]*(?:\s+[a-z][a-z0-9'-]*){0,2})\s+position\b/gu;
  const labeled = /\bposition\s*:\s*([a-z][a-z0-9'-]*(?:\s+[a-z][a-z0-9'-]*){0,2})\b/gu;
  for (const pattern of [titled, labeled]) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1];
      if (name !== undefined && !["drawn", "selected", "spread"].includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
};

const explicitOrientationClaims = (text: string): ReadonlySet<"reversed" | "upright"> => {
  const claims = new Set<"reversed" | "upright">();
  let remaining = text;
  const negativeReversed =
    /\b(?:no\s+(?:card|cards|position|positions)\s+(?:is|are)|(?:card|cards|position|positions)\s+(?:is|are)\s+not)\s+(?:reversed|in reverse)\b/gu;
  const negativeUpright =
    /\b(?:no\s+(?:card|cards|position|positions)\s+(?:is|are)|(?:card|cards|position|positions)\s+(?:is|are)\s+not)\s+upright\b/gu;
  if (negativeReversed.test(remaining)) claims.add("upright");
  negativeReversed.lastIndex = 0;
  remaining = remaining.replace(negativeReversed, " ");
  if (negativeUpright.test(remaining)) claims.add("reversed");
  negativeUpright.lastIndex = 0;
  remaining = remaining.replace(negativeUpright, " ");

  const subject = "(?:card|cards|position|positions|draw|spread|orientation)";
  if (
    new RegExp(`\\b${subject}\\b[^.!?\\n]{0,40}\\bupright\\b`, "u").test(remaining) ||
    new RegExp(`\\bupright\\b[^.!?\\n]{0,24}\\b${subject}\\b`, "u").test(remaining)
  ) {
    claims.add("upright");
  }
  if (
    new RegExp(`\\b${subject}\\b[^.!?\\n]{0,40}\\b(?:reversed|in reverse)\\b`, "u").test(
      remaining,
    ) ||
    new RegExp(`\\b(?:reversed|reverse)\\b[^.!?\\n]{0,24}\\b${subject}\\b`, "u").test(remaining)
  ) {
    claims.add("reversed");
  }
  return claims;
};

const scanDeterministicFindings = (
  context: PendingTarotInterpretationVerificationContextV1,
  policy: ApprovedTarotVerificationPolicyV1,
): ReadonlySet<TarotVerificationCheckCode> => {
  const findings = new Set<TarotVerificationCheckCode>();
  const leaves = visibleTextLeaves(context.candidateOutput);
  let aggregateBytes = 0;
  const normalizedLeaves: ReadonlyArray<VisibleTextLeafV1> = leaves.map((leaf) => {
    aggregateBytes += utf8ByteLength(leaf.text);
    return Object.freeze({ factRef: leaf.factRef, text: normalizeForVerification(leaf.text) });
  });
  if (!Number.isSafeInteger(aggregateBytes) || aggregateBytes > policy.maximumAggregateTextBytes) {
    findings.add("fabricated_fact");
  }
  for (const leaf of normalizedLeaves) {
    const text = neutralizeSafeLanguage(leaf.text);
    for (const code of tarotVerificationCheckCodes) {
      const patterns = deterministicCategoryPatternsByCode.get(code) ?? [];
      if (patterns.some((pattern) => pattern.test(text))) findings.add(code);
      for (const pattern of patterns) pattern.lastIndex = 0;
    }
  }

  const positions = context.retrievedContent.positions;
  const selectedCards = new Set(positions.flatMap(({ cardTitle }) => cardNameAliases(cardTitle)));
  const selectedPositionTitles = new Set(
    positions.flatMap(({ positionTitle }) => {
      const normalized = normalizeForVerification(positionTitle);
      return normalized.startsWith("the ") ? [normalized, normalized.slice(4)] : [normalized];
    }),
  );
  const allText = normalizedLeaves.map(({ text }) => text).join("\n");
  const unboundText = normalizedLeaves
    .filter(({ factRef }) => factRef === null)
    .map(({ text }) => text)
    .join("\n");
  const unboundOrientationClaims = explicitOrientationClaims(unboundText);
  const selectedOrientations = new Set(positions.map(({ orientation }) => orientation));
  if (
    (selectedOrientations.size > 1 && unboundOrientationClaims.size > 0) ||
    (selectedOrientations.size === 1 &&
      [...unboundOrientationClaims].some((orientation) => !selectedOrientations.has(orientation)))
  ) {
    findings.add("fabricated_fact");
  }
  for (const cardName of majorArcanaNames) {
    if (containsPhrase(allText, cardName) && !selectedCards.has(cardName)) {
      findings.add("fabricated_fact");
    }
  }
  for (const cardName of explicitNamedCards(allText)) {
    if (!selectedCards.has(cardName) && !selectedCards.has(`the ${cardName}`)) {
      findings.add("fabricated_fact");
    }
  }
  const minorArcanaPattern =
    /\b(?:ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king) of (?:wands|cups|swords|pentacles)\b/gu;
  for (const match of allText.matchAll(minorArcanaPattern)) {
    const cardName = match[0];
    if (!selectedCards.has(cardName)) findings.add("fabricated_fact");
  }
  for (const positionName of commonPositionNames) {
    if (
      (containsPhrase(allText, `${positionName} position`) ||
        containsPhrase(allText, `position of ${positionName}`)) &&
      !selectedPositionTitles.has(positionName)
    ) {
      findings.add("fabricated_fact");
    }
  }
  for (const positionName of explicitNamedPositions(allText)) {
    if (!selectedPositionTitles.has(positionName)) findings.add("fabricated_fact");
  }

  for (const symbol of context.candidateOutput.symbols) {
    const position = positions.find(({ factRef }) => factRef === symbol.factRef);
    if (position === undefined) {
      findings.add("fabricated_fact");
      continue;
    }
    const symbolText = normalizedLeaves
      .filter(({ factRef }) => factRef === symbol.factRef)
      .map(({ text }) => text)
      .join("\n");
    const ownCardAliases = new Set(cardNameAliases(position.cardTitle));
    for (const cardName of explicitNamedCards(symbolText)) {
      if (!ownCardAliases.has(cardName) && !ownCardAliases.has(`the ${cardName}`)) {
        findings.add("fabricated_fact");
      }
    }
    for (const other of positions) {
      if (other.factRef === position.factRef) continue;
      if (containsPhrase(symbolText, normalizeForVerification(other.cardTitle))) {
        findings.add("fabricated_fact");
      }
      const otherPosition = normalizeForVerification(other.positionTitle);
      if (
        containsPhrase(symbolText, `${otherPosition} position`) ||
        containsPhrase(symbolText, `position of ${otherPosition}`)
      ) {
        findings.add("fabricated_fact");
      }
    }
    for (const cardName of majorArcanaNames) {
      if (!ownCardAliases.has(cardName) && containsPhrase(symbolText, cardName)) {
        findings.add("fabricated_fact");
      }
    }
    for (const match of symbolText.matchAll(minorArcanaPattern)) {
      if (!ownCardAliases.has(match[0])) findings.add("fabricated_fact");
    }
    if (
      (position.orientation === "upright" && /\b(?:reversed|in reverse)\b/u.test(symbolText)) ||
      (position.orientation === "reversed" && /\bupright\b/u.test(symbolText))
    ) {
      findings.add("fabricated_fact");
    }
  }

  const expectedOutputSources = context.input.approvedContent.map(({ sourceRef }) => sourceRef);
  if (!sameStringSet(context.candidateOutput.sourceRefs, expectedOutputSources)) {
    findings.add("fabricated_fact");
  }
  const allowedSourceRefs = new Set([
    ...expectedOutputSources,
    ...positions.flatMap(({ sourceRefs }) => sourceRefs),
  ]);
  const explicitSourcePattern = /\bsource\s*:\s*([a-z][a-z0-9._:-]{0,159})\b/gu;
  for (const match of allText.matchAll(explicitSourcePattern)) {
    if (match[1] === undefined || !allowedSourceRefs.has(match[1])) {
      findings.add("fabricated_fact");
    }
  }
  const attributedSourcePattern = /\baccording\s+to\s+source\s+([a-z][a-z0-9._:-]{0,159})\b/gu;
  for (const match of allText.matchAll(attributedSourcePattern)) {
    if (match[1] === undefined || !allowedSourceRefs.has(match[1])) {
      findings.add("fabricated_fact");
    }
  }
  const machineAttributedSourcePattern =
    /\b(?:according\s+to|citing)\s+([a-z][a-z0-9_]*(?:[.:-][a-z0-9_]+)+)\b/gu;
  for (const match of allText.matchAll(machineAttributedSourcePattern)) {
    if (match[1] === undefined || !allowedSourceRefs.has(match[1])) {
      findings.add("fabricated_fact");
    }
  }
  const foreignTraditions = [
    "vedic",
    "hoodoo",
    "indigenous",
    "buddhist",
    "hindu",
    "islamic",
    "christian",
    "kabbalah",
  ];
  const expectedTradition = normalizeForVerification(context.retrievedContent.tradition);
  for (const tradition of foreignTraditions) {
    if (
      !expectedTradition.includes(tradition) &&
      (containsPhrase(allText, `${tradition} tradition`) ||
        containsPhrase(allText, `according to ${tradition}`) ||
        containsPhrase(allText, `according to the ${tradition}`))
    ) {
      findings.add("cultural_authority");
      findings.add("fabricated_fact");
    }
  }
  return findings;
};

const candidateCanonicalJson = (context: PendingTarotInterpretationVerificationContextV1): string =>
  JSON.stringify({
    digestScope: tarotVerificationCandidateDigestScope,
    generation: {
      fallbackTemplate: {
        approvalReference: context.generationProvenance.fallbackTemplate.approvalReference,
        checksum: context.generationProvenance.fallbackTemplate.checksum,
        checksumScope: context.generationProvenance.fallbackTemplate.checksumScope,
        id: context.generationProvenance.fallbackTemplate.id,
        version: context.generationProvenance.fallbackTemplate.version,
      },
      metadata: context.candidate.metadata,
      prompt: context.generationProvenance.prompt,
      request: {
        locale: context.generationProvenance.request.locale,
        modality: context.generationProvenance.request.modality,
        readingType: context.generationProvenance.request.readingType,
        safetyPolicyVersion: context.generationProvenance.request.safetyPolicyVersion,
        themeCode: context.generationProvenance.request.themeCode,
      },
      runtime: context.generationProvenance.runtime,
      schemaVersion: context.generationProvenance.schemaVersion,
    },
    input: {
      approvedContent: context.input.approvedContent,
      approvedRitualTemplateCodes: context.input.approvedRitualTemplateCodes,
      deterministicFacts: context.input.deterministicFacts,
      locale: context.input.locale,
      modality: context.input.modality,
      prompt: context.input.prompt,
      readingType: context.input.readingType,
      safetyDecision: context.input.safetyDecision,
      schemaVersion: context.input.schemaVersion,
      themeCode: context.input.themeCode,
      tone: context.input.tone,
    },
    output: context.candidateOutput,
    retrieval: {
      locale: context.retrievedContent.locale,
      provenance: context.retrievedContent.provenance,
      readingType: context.retrievedContent.readingType,
      schemaVersion: context.retrievedContent.schemaVersion,
      themeCode: context.retrievedContent.themeCode,
      tradition: context.retrievedContent.tradition,
    },
  });

const outputCanonicalJson = (output: TarotInterpretationOutputV1): string =>
  JSON.stringify({
    digestScope: tarotVerificationOutputDigestScope,
    output,
  });

const issueAndVerifyDigest = async (
  canonicalJson: string,
  state: PreparedVerifierStateV1,
): Promise<string> => {
  let digest: unknown;
  try {
    digest = await state.digest(canonicalJson);
  } catch {
    return fail("AI_VERIFICATION_DIGEST_INVALID");
  }
  if (typeof digest !== "string" || !keyedDigestPattern.test(digest)) {
    return fail("AI_VERIFICATION_DIGEST_INVALID");
  }
  let verified: unknown;
  try {
    verified = await state.verifyDigest(canonicalJson, digest);
  } catch {
    return fail("AI_VERIFICATION_DIGEST_INVALID");
  }
  if (verified !== true) return fail("AI_VERIFICATION_DIGEST_INVALID");
  return digest;
};

const semanticReviewRequest = (
  context: PendingTarotInterpretationVerificationContextV1,
  state: PreparedVerifierStateV1,
  candidateDigest: string,
): TarotSemanticReviewRequestV1 => {
  const positions = [...context.retrievedContent.positions].sort(
    (left, right) => left.order - right.order,
  );
  const allowedSourceRefs = Object.freeze(
    [
      ...new Set([
        ...context.candidateOutput.sourceRefs,
        ...positions.flatMap(({ sourceRefs }) => sourceRefs),
      ]),
    ].sort(),
  );
  return deepFreeze({
    allowedSourceRefs,
    candidateDigest,
    checks: state.policy.checks,
    facts: positions.map((position) => ({
      cardId: position.cardId,
      cardTitle: position.cardTitle,
      evidence: {
        cannotDetermine: position.cannotDetermine,
        constructivePossibilities: position.constructivePossibilities,
        coreThemes: position.coreThemes,
        culturalNotes: position.culturalNotes,
        positionDescription: position.positionDescription,
        reflectionQuestions: position.reflectionQuestions,
        smallActions: position.smallActions,
        tensions: position.tensions,
        themeReading: position.themeReading,
      },
      factRef: position.factRef,
      orientation: position.orientation,
      positionId: position.positionId,
      positionTitle: position.positionTitle,
    })),
    locale: context.input.locale,
    modality: "tarot" as const,
    output: context.candidateOutput,
    schemaVersion: tarotSemanticReviewRequestSchemaVersion,
    tradition: context.retrievedContent.tradition,
  });
};

type SemanticReviewVerdictV1 = "safe" | "uncertain" | "unsafe";

const parseSemanticReviewResult = (
  value: unknown,
  candidateDigest: string,
  maximumBytes: number,
): SemanticReviewVerdictV1 | null => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    utf8ByteLength(value) > maximumBytes ||
    hasLoneSurrogate(value)
  ) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  const result = record(parsed);
  if (
    result === null ||
    !hasExactKeys(result, ["candidateDigest", "checks", "schemaVersion", "verdict"]) ||
    result.schemaVersion !== tarotSemanticReviewResultSchemaVersion ||
    result.candidateDigest !== candidateDigest ||
    (result.verdict !== "safe" && result.verdict !== "unsafe" && result.verdict !== "uncertain") ||
    !Array.isArray(result.checks) ||
    result.checks.length !== tarotVerificationCheckCodes.length
  ) {
    return null;
  }
  const statuses: SemanticReviewVerdictV1[] = [];
  for (let index = 0; index < tarotVerificationCheckCodes.length; index += 1) {
    const check = record(result.checks.at(index));
    if (
      check === null ||
      !hasExactKeys(check, ["code", "status"]) ||
      check.code !== tarotVerificationCheckCodes.at(index) ||
      (check.status !== "safe" && check.status !== "unsafe" && check.status !== "uncertain")
    ) {
      return null;
    }
    statuses.push(check.status);
  }
  const expectedVerdict: SemanticReviewVerdictV1 = statuses.includes("unsafe")
    ? "unsafe"
    : statuses.includes("uncertain")
      ? "uncertain"
      : "safe";
  return result.verdict === expectedVerdict ? expectedVerdict : null;
};

const validReviewerExecutionContext = (
  value: unknown,
): TarotSemanticReviewerExecutionContextV1 | null => {
  const context = record(value);
  const cancellation = record(context?.cancellation);
  if (
    context === null ||
    !hasExactKeys(context, ["attemptId", "cancellation"]) ||
    typeof context.attemptId !== "string" ||
    context.attemptId.length === 0 ||
    utf8ByteLength(context.attemptId) > 200 ||
    forbiddenTextPattern.test(context.attemptId) ||
    cancellation === null ||
    !hasExactKeys(cancellation, ["aborted", "subscribe"]) ||
    cancellation.aborted !== false ||
    typeof cancellation.subscribe !== "function"
  ) {
    return null;
  }
  return Object.freeze({
    attemptId: context.attemptId,
    cancellation: Object.freeze({
      aborted: false,
      subscribe: cancellation.subscribe as StructuredGenerationCancellationV1["subscribe"],
    }),
  });
};

const runSemanticReview = async (
  request: TarotSemanticReviewRequestV1,
  state: PreparedVerifierStateV1,
): Promise<SemanticReviewVerdictV1 | null> => {
  let invalidExecutionContext = false;
  let runResult: unknown;
  try {
    const runInput: TarotVerificationDeadlineRunInputV1<string> = Object.freeze({
      operation: async (executionContext: unknown): Promise<string> => {
        const parsedContext = validReviewerExecutionContext(executionContext);
        if (parsedContext === null) {
          invalidExecutionContext = true;
          throw new TypeError("AI_VERIFICATION_INPUT_INVALID");
        }
        return state.reviewer.review.call(state.reviewer.receiver, request, parsedContext);
      },
      timeoutMs: state.runtime.reviewerTimeoutMs,
    });
    runResult = await state.runner.run.call(state.runner.receiver, runInput);
  } catch {
    if (invalidExecutionContext) return fail("AI_VERIFICATION_INPUT_INVALID");
    return null;
  }
  if (invalidExecutionContext) return fail("AI_VERIFICATION_INPUT_INVALID");
  const result = record(runResult);
  if (result === null || typeof result.status !== "string") {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  if (
    result.status === "timeout" &&
    hasExactKeys(result, ["cancellationAcknowledged", "elapsedMs", "status"]) &&
    typeof result.cancellationAcknowledged === "boolean" &&
    isIntegerIn(result.elapsedMs, 0, state.runtime.reviewerTimeoutMs + 1_000)
  ) {
    return null;
  }
  if (
    result.status !== "settled" ||
    !hasExactKeys(result, ["elapsedMs", "status", "value"]) ||
    !isIntegerIn(result.elapsedMs, 0, 60_000)
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  if (result.elapsedMs > state.runtime.reviewerTimeoutMs) return null;
  return parseSemanticReviewResult(
    result.value,
    request.candidateDigest,
    state.runtime.reviewerResultMaximumBytes,
  );
};

const authorizeCandidateDigest = async (
  authorizeCandidate: TarotVerificationCandidateAuthorityVerifierV1,
  candidateDigest: string,
  verifier: PreparedTarotInterpretationVerifierV1,
): Promise<void> => {
  let authorized: unknown;
  try {
    authorized = await authorizeCandidate(
      deepFreeze({
        candidateDigest,
        policy: verifier.policy,
        runtime: verifier.runtime,
        schemaVersion: tarotVerificationCandidateAuthoritySchemaVersion,
      }),
    );
  } catch {
    return fail("AI_VERIFICATION_AUTHORIZATION_DENIED");
  }
  if (authorized !== true) return fail("AI_VERIFICATION_AUTHORIZATION_DENIED");
};

const issueVerificationResult = async (
  output: TarotInterpretationOutputV1,
  status: "safe_replacement" | "verified",
  candidateDigest: string,
  verifier: PreparedTarotInterpretationVerifierV1,
  state: PreparedVerifierStateV1,
): Promise<TarotInterpretationVerificationResultV1> => {
  const outputDigest = await issueAndVerifyDigest(outputCanonicalJson(output), state);
  const result = deepFreeze({
    displayable: true as const,
    metadata: {
      deterministicChecksVersion: tarotDeterministicVerificationChecksVersion,
      outcome: status,
      policyVersion: state.policy.version,
      reviewerModelVersion: verifier.reviewerModel.version,
      reviewerPolicyVersion: verifier.reviewerPolicy.version,
      reviewerProviderVersion: verifier.reviewerProvider.version,
      reviewerVersion: verifier.reviewer.version,
      runtimeVersion: state.runtime.version,
      schemaVersion: tarotVerificationOperationalMetadataSchemaVersion,
    },
    output,
    provenance: {
      candidateDigest,
      candidateDigestScope: tarotVerificationCandidateDigestScope,
      deterministicChecksVersion: tarotDeterministicVerificationChecksVersion,
      outputDigest,
      outputDigestScope: tarotVerificationOutputDigestScope,
      policy: verifier.policy,
      reviewer: verifier.reviewer,
      reviewerModel: verifier.reviewerModel,
      reviewerPolicy: verifier.reviewerPolicy,
      reviewerProvider: verifier.reviewerProvider,
      runtime: verifier.runtime,
      schemaVersion: tarotVerificationProvenanceSchemaVersion,
      verificationTimeoutMs: state.runtime.reviewerTimeoutMs,
    },
    schemaVersion: tarotInterpretationVerificationResultSchemaVersion,
    status,
  }) as TarotInterpretationVerificationResultV1;
  issuedVerificationResults.add(result);
  return result;
};

export const verifyTarotInterpretationCandidateV1 = async (
  input: VerifyTarotInterpretationCandidateInputV1,
): Promise<TarotInterpretationVerificationResultV1> => {
  const envelope = record(input);
  if (
    envelope === null ||
    !hasExactKeys(envelope, ["authorizeCandidate", "candidate", "verifier"]) ||
    typeof envelope.authorizeCandidate !== "function" ||
    !isPreparedTarotInterpretationVerifierV1(envelope.verifier)
  ) {
    return fail("AI_VERIFICATION_INPUT_INVALID");
  }
  const verifier = envelope.verifier;
  const state = preparedVerifierStates.get(verifier);
  if (state === undefined) return fail("AI_VERIFICATION_INPUT_INVALID");

  // Consumption deliberately happens before the first await. Concurrent calls,
  // clones, casts, and retries therefore fail closed before any reviewer work.
  let context: PendingTarotInterpretationVerificationContextV1;
  try {
    context = consumePendingTarotInterpretationCandidateForVerificationV1(envelope.candidate);
  } catch {
    return fail("AI_VERIFICATION_CANDIDATE_INVALID");
  }
  if (context.candidate !== envelope.candidate) {
    return fail("AI_VERIFICATION_CANDIDATE_INVALID");
  }
  if (
    context.input.locale !== state.policy.locale ||
    context.retrievedContent.locale !== state.policy.locale ||
    context.retrievedContent.tradition !== state.policy.tradition ||
    context.generationProvenance.request.locale !== state.policy.locale ||
    context.generationProvenance.request.modality !== state.policy.modality ||
    context.generationProvenance.request.safetyPolicyVersion !==
      context.input.safetyDecision.policyVersion
  ) {
    return fail("AI_VERIFICATION_CANDIDATE_INVALID");
  }
  if (
    !sameVersionReference(context.generationProvenance.runtime.provider, state.generationProvider)
  ) {
    return fail("AI_VERIFICATION_CANDIDATE_INVALID");
  }
  if (context.generationProvenance.runtime.provider.id === state.reviewer.descriptor.provider.id) {
    return fail("AI_VERIFICATION_REVIEWER_NOT_INDEPENDENT");
  }

  const candidateDigest = await issueAndVerifyDigest(candidateCanonicalJson(context), state);
  await authorizeCandidateDigest(
    envelope.authorizeCandidate as TarotVerificationCandidateAuthorityVerifierV1,
    candidateDigest,
    verifier,
  );

  const findings = scanDeterministicFindings(context, state.policy);
  if (findings.size !== 0) {
    return issueVerificationResult(
      context.fallbackOutput,
      "safe_replacement",
      candidateDigest,
      verifier,
      state,
    );
  }

  const reviewRequest = semanticReviewRequest(context, state, candidateDigest);
  const semanticVerdict = await runSemanticReview(reviewRequest, state);
  return issueVerificationResult(
    semanticVerdict === "safe" ? context.candidateOutput : context.fallbackOutput,
    semanticVerdict === "safe" ? "verified" : "safe_replacement",
    candidateDigest,
    verifier,
    state,
  );
};

export const isTarotInterpretationVerificationResultV1 = (
  value: unknown,
): value is TarotInterpretationVerificationResultV1 =>
  typeof value === "object" && value !== null && issuedVerificationResults.has(value);
