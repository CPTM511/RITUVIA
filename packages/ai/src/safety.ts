import {
  evaluateQuestionIntake,
  parseQuestionIntakeRequest,
  tarotReadingTypes,
  type QuestionIntakeRiskCategory,
  type QuestionIntakeSuggestionCode,
  type QuestionIntakeThemeCode,
  type TarotReadingType,
} from "@rituvia/domain";

import {
  issueInterpretationGenerationAuthorizationV1,
  type InterpretationGenerationAuthorizationV1,
  type InterpretationSafetyDecisionV1,
  type ProviderChecksummedReferenceV1,
  type ProviderVersionReferenceV1,
} from "./provider.js";
export const preGenerationSafetyClassifierRequestSchemaVersion =
  "pre-generation-safety-classifier-request.v1" as const;
export const preGenerationSafetyClassifierResultSchemaVersion =
  "pre-generation-safety-classifier-result.v1" as const;
export const preGenerationSafetyClassifierAuthoritySchemaVersion =
  "pre-generation-safety-classifier-authority.v1" as const;
export const preGenerationSafetyPolicyAuthoritySchemaVersion =
  "pre-generation-safety-policy-authority.v1" as const;
export const preGenerationSafetyEvaluationSchemaVersion =
  "pre-generation-safety-evaluation.v1" as const;
export const preGenerationSafetyPolicyVersion = "pre-generation-safety.en.v1" as const;
export const preGenerationSafetyIntakePolicyVersion = "question-intake.en.v1" as const;

export const preGenerationSafetyRoutes = Object.freeze([
  "allowed",
  "reframed",
  "blocked",
  "crisis",
] as const);
export type PreGenerationSafetyRoute = (typeof preGenerationSafetyRoutes)[number];

export const preGenerationSafetyClassifierStatuses = Object.freeze([
  "assessed",
  "uncertain",
] as const);
export type PreGenerationSafetyClassifierStatus =
  (typeof preGenerationSafetyClassifierStatuses)[number];

export const preGenerationSafetyRiskCategories = Object.freeze([
  "self_harm",
  "immediate_danger",
  "violent_harm",
  "medical_determination",
  "legal_determination",
  "financial_determination",
  "death_timing",
  "criminal_guilt",
  "coercive_control",
  "supernatural_persecution",
  "relationship_mind_reading",
  "guaranteed_outcome",
  "instruction_injection",
  "abuse_or_coercion",
  "delusion_or_paranoia",
  "dependency_or_exclusivity",
  "fertility_prediction",
  "paid_efficacy_or_spiritual_remedy",
  "severe_distress",
] as const);
export type PreGenerationSafetyRiskCategory = (typeof preGenerationSafetyRiskCategories)[number];

export const preGenerationSafetyErrorCodes = Object.freeze([
  "PRE_GENERATION_SAFETY_INPUT_INVALID",
  "PRE_GENERATION_SAFETY_CLASSIFIER_NOT_APPROVED",
  "PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE",
  "PRE_GENERATION_SAFETY_CLASSIFIER_INVALID",
  "PRE_GENERATION_SAFETY_POLICY_NOT_APPROVED",
  "PRE_GENERATION_SAFETY_AUTHORIZATION_DENIED",
] as const);
export type PreGenerationSafetyErrorCode = (typeof preGenerationSafetyErrorCodes)[number];

export const preGenerationSafetyLimits = Object.freeze({
  classifierResultJsonMaximumBytes: 8_192,
  requestJsonMaximumBytes: 4_096,
} as const);

const safetyErrorMessage = (code: PreGenerationSafetyErrorCode): string => {
  switch (code) {
    case "PRE_GENERATION_SAFETY_INPUT_INVALID":
      return "The pre-generation safety contract is invalid.";
    case "PRE_GENERATION_SAFETY_CLASSIFIER_NOT_APPROVED":
      return "The pre-generation safety classifier is not approved.";
    case "PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE":
      return "The pre-generation safety classifier is unavailable.";
    case "PRE_GENERATION_SAFETY_CLASSIFIER_INVALID":
      return "The pre-generation safety classifier result is invalid.";
    case "PRE_GENERATION_SAFETY_POLICY_NOT_APPROVED":
      return "The pre-generation safety policy is not approved.";
    case "PRE_GENERATION_SAFETY_AUTHORIZATION_DENIED":
      return "The pre-generation safety decision cannot authorize generation.";
  }
};

export class PreGenerationSafetyError extends Error {
  public readonly code: PreGenerationSafetyErrorCode;

  public constructor(code: PreGenerationSafetyErrorCode) {
    super(safetyErrorMessage(code));
    this.name = "PreGenerationSafetyError";
    this.code = code;
  }
}

export type ApprovedPreGenerationSafetyClassifierPolicyReferenceV1 = Readonly<
  ProviderChecksummedReferenceV1 & {
    approvalReference: string;
  }
>;

export type PreGenerationSafetyClassifierRegistrationV1 = Readonly<{
  classifier: ProviderVersionReferenceV1;
  policy: ApprovedPreGenerationSafetyClassifierPolicyReferenceV1;
}>;

export type PreGenerationSafetyClassifierAuthorityV1 = Readonly<{
  asOf: string;
  classifier: PreGenerationSafetyClassifierRegistrationV1;
  locale: "en";
  modality: "tarot";
  policyVersion: typeof preGenerationSafetyPolicyVersion;
  schemaVersion: typeof preGenerationSafetyClassifierAuthoritySchemaVersion;
}>;

export type PreGenerationSafetyClassifierAuthorityVerifierV1 = (
  authority: PreGenerationSafetyClassifierAuthorityV1,
) => boolean | Promise<boolean>;

export type PreGenerationSafetyPolicyAuthorityV1 = Readonly<{
  approvalReference: string;
  asOf: string;
  intakePolicyVersion: typeof preGenerationSafetyIntakePolicyVersion;
  locale: "en";
  modality: "tarot";
  policyVersion: typeof preGenerationSafetyPolicyVersion;
  schemaVersion: typeof preGenerationSafetyPolicyAuthoritySchemaVersion;
}>;

export type PreGenerationSafetyPolicyAuthorityVerifierV1 = (
  authority: PreGenerationSafetyPolicyAuthorityV1,
) => boolean | Promise<boolean>;

export type PreGenerationSafetyClassifierRequestV1 = Readonly<{
  locale: "en";
  modality: "tarot";
  question: string;
  schemaVersion: typeof preGenerationSafetyClassifierRequestSchemaVersion;
  themeCode: QuestionIntakeThemeCode;
}>;

export type PreGenerationSafetyClassifierV1 = (
  request: PreGenerationSafetyClassifierRequestV1,
) => string | Promise<string>;

export type EvaluatePreGenerationSafetyInputV1 = Readonly<{
  asOf: string;
  authorizeClassifier?: PreGenerationSafetyClassifierAuthorityVerifierV1;
  authorizePolicy?: PreGenerationSafetyPolicyAuthorityVerifierV1;
  classifier?: PreGenerationSafetyClassifierV1;
  classifierRegistration?: PreGenerationSafetyClassifierRegistrationV1;
  policyApprovalReference?: string;
  readingType: TarotReadingType;
  requestId: string;
  requestJson: string;
}>;

declare const preGenerationSafetyEvaluationBrand: unique symbol;

export type PreGenerationSafetyEvaluationV1 = Readonly<{
  canContinue: boolean;
  classifier: Readonly<
    PreGenerationSafetyClassifierRegistrationV1 & {
      eligibilityAsOf: string;
      status: PreGenerationSafetyClassifierStatus;
    }
  > | null;
  evaluatedAsOf: string;
  intakePolicyVersion: typeof preGenerationSafetyIntakePolicyVersion;
  locale: "en";
  modality: "tarot";
  policyVersion: typeof preGenerationSafetyPolicyVersion;
  readingType: TarotReadingType;
  requestId: string;
  route: PreGenerationSafetyRoute;
  schemaVersion: typeof preGenerationSafetyEvaluationSchemaVersion;
  suggestedQuestionCode: QuestionIntakeSuggestionCode | null;
  themeCode: QuestionIntakeThemeCode;
  [preGenerationSafetyEvaluationBrand]: true;
}>;

type ParsedClassifierResultV1 = Readonly<{
  categories: readonly PreGenerationSafetyRiskCategory[];
  classifier: ProviderVersionReferenceV1;
  policy: ProviderChecksummedReferenceV1;
  schemaVersion: typeof preGenerationSafetyClassifierResultSchemaVersion;
  status: PreGenerationSafetyClassifierStatus;
}>;

const issuedPreGenerationSafetyEvaluations = new WeakSet<object>();

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const fail = (code: PreGenerationSafetyErrorCode): never => {
  throw new PreGenerationSafetyError(code);
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  const expected = [...required, ...optional]
    .filter((key) => Object.hasOwn(value, key))
    .sort()
    .join("\u0000");
  return actual === expected && required.every((key) => Object.hasOwn(value, key));
};

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const parseDate = (value: unknown): string => {
  if (typeof value !== "string" || !datePattern.test(value)) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return value;
};

const parseIdentifier = (value: unknown): string => {
  if (typeof value !== "string" || value.length > 120 || !identifierPattern.test(value)) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return value;
};

const parseVersion = (value: unknown): string => {
  if (typeof value !== "string" || !versionPattern.test(value)) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return value;
};

const parseProviderReference = (value: unknown): ProviderVersionReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["id", "version"])) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return Object.freeze({
    id: parseIdentifier(candidate.id),
    version: parseVersion(candidate.version),
  });
};

const parseChecksummedReference = (value: unknown): ProviderChecksummedReferenceV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["checksum", "id", "version"]) ||
    typeof candidate.checksum !== "string" ||
    !sha256DigestPattern.test(candidate.checksum)
  ) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return Object.freeze({
    checksum: candidate.checksum,
    id: parseIdentifier(candidate.id),
    version: parseVersion(candidate.version),
  });
};

const parseClassifierRegistration = (
  value: unknown,
): PreGenerationSafetyClassifierRegistrationV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["classifier", "policy"])) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  const policy = record(candidate.policy);
  if (
    policy === null ||
    !hasExactKeys(policy, ["approvalReference", "checksum", "id", "version"]) ||
    typeof policy.approvalReference !== "string" ||
    !approvalReferencePattern.test(policy.approvalReference)
  ) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  const parsedPolicy = parseChecksummedReference({
    checksum: policy.checksum,
    id: policy.id,
    version: policy.version,
  });
  return Object.freeze({
    classifier: parseProviderReference(candidate.classifier),
    policy: Object.freeze({
      approvalReference: policy.approvalReference,
      ...parsedPolicy,
    }),
  });
};

const exactJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const isRiskCategory = (value: unknown): value is PreGenerationSafetyRiskCategory =>
  typeof value === "string" &&
  preGenerationSafetyRiskCategories.some((candidate) => candidate === value);

const isTarotReadingType = (value: unknown): value is TarotReadingType =>
  typeof value === "string" && tarotReadingTypes.some((candidate) => candidate === value);

const isClassifierStatus = (value: unknown): value is PreGenerationSafetyClassifierStatus =>
  typeof value === "string" &&
  preGenerationSafetyClassifierStatuses.some((candidate) => candidate === value);

const parseClassifierResult = (
  value: unknown,
  registration: PreGenerationSafetyClassifierRegistrationV1,
): ParsedClassifierResultV1 => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    utf8ByteLength(value) > preGenerationSafetyLimits.classifierResultJsonMaximumBytes
  ) {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(value) as unknown;
  } catch {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
  }
  const candidate = record(parsedJson);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["categories", "classifier", "policy", "schemaVersion", "status"]) ||
    candidate.schemaVersion !== preGenerationSafetyClassifierResultSchemaVersion ||
    !isClassifierStatus(candidate.status) ||
    !Array.isArray(candidate.categories) ||
    candidate.categories.length > preGenerationSafetyRiskCategories.length
  ) {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
  }
  const categories = candidate.categories.map((category) => {
    if (!isRiskCategory(category)) return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
    return category;
  });
  const canonicalCategories = preGenerationSafetyRiskCategories.filter((category) =>
    categories.includes(category),
  );
  if (categories.join("\u0000") !== canonicalCategories.join("\u0000")) {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
  }
  let classifier: ProviderVersionReferenceV1;
  let policy: ProviderChecksummedReferenceV1;
  try {
    classifier = parseProviderReference(candidate.classifier);
    policy = parseChecksummedReference(candidate.policy);
  } catch {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
  }
  if (
    !exactJson(classifier, registration.classifier) ||
    !exactJson(policy, {
      checksum: registration.policy.checksum,
      id: registration.policy.id,
      version: registration.policy.version,
    })
  ) {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_INVALID");
  }
  return Object.freeze({
    categories: Object.freeze(canonicalCategories),
    classifier,
    policy,
    schemaVersion: preGenerationSafetyClassifierResultSchemaVersion,
    status: candidate.status,
  });
};

const includesRisk = (
  risks: readonly PreGenerationSafetyRiskCategory[],
  candidates: readonly PreGenerationSafetyRiskCategory[],
): boolean => candidates.some((candidate) => risks.includes(candidate));

const routeFor = (
  risks: readonly PreGenerationSafetyRiskCategory[],
  uncertain: boolean,
): PreGenerationSafetyRoute => {
  if (includesRisk(risks, ["self_harm", "immediate_danger"])) return "crisis";
  if (
    includesRisk(risks, [
      "abuse_or_coercion",
      "coercive_control",
      "criminal_guilt",
      "delusion_or_paranoia",
      "death_timing",
      "fertility_prediction",
      "financial_determination",
      "instruction_injection",
      "legal_determination",
      "medical_determination",
      "paid_efficacy_or_spiritual_remedy",
      "supernatural_persecution",
      "violent_harm",
    ])
  ) {
    return "blocked";
  }
  if (uncertain || risks.length > 0) return "reframed";
  return "allowed";
};

const highestRoute = (
  left: PreGenerationSafetyRoute,
  right: PreGenerationSafetyRoute,
): PreGenerationSafetyRoute => {
  const rank = (route: PreGenerationSafetyRoute): number => {
    switch (route) {
      case "allowed":
        return 0;
      case "reframed":
        return 1;
      case "blocked":
        return 2;
      case "crisis":
        return 3;
    }
  };
  return rank(left) >= rank(right) ? left : right;
};

const suggestionFor = (
  route: PreGenerationSafetyRoute,
  risks: readonly PreGenerationSafetyRiskCategory[],
): QuestionIntakeSuggestionCode | null => {
  if (route === "allowed" || route === "crisis") return null;
  if (
    includesRisk(risks, [
      "fertility_prediction",
      "financial_determination",
      "legal_determination",
      "medical_determination",
    ])
  ) {
    return "professional_preparation";
  }
  if (includesRisk(risks, ["abuse_or_coercion", "coercive_control", "relationship_mind_reading"])) {
    return "relationship_agency";
  }
  if (includesRisk(risks, ["delusion_or_paranoia", "supernatural_persecution"])) {
    return "grounded_observation";
  }
  return "agency_general";
};

const mergeRisks = (
  intakeRisks: readonly QuestionIntakeRiskCategory[],
  classifierRisks: readonly PreGenerationSafetyRiskCategory[],
): readonly PreGenerationSafetyRiskCategory[] => {
  const present = new Set<string>([...intakeRisks, ...classifierRisks]);
  return Object.freeze(
    preGenerationSafetyRiskCategories.filter((category) => present.has(category)),
  );
};

const issueEvaluation = (input: {
  asOf: string;
  classifier: PreGenerationSafetyClassifierRegistrationV1 | null;
  classifierStatus: PreGenerationSafetyClassifierStatus | null;
  route: PreGenerationSafetyRoute;
  readingType: TarotReadingType;
  requestId: string;
  suggestedQuestionCode: QuestionIntakeSuggestionCode | null;
  themeCode: QuestionIntakeThemeCode;
}): PreGenerationSafetyEvaluationV1 => {
  const classifier =
    input.classifier === null || input.classifierStatus === null
      ? null
      : Object.freeze({
          classifier: input.classifier.classifier,
          eligibilityAsOf: input.asOf,
          policy: input.classifier.policy,
          status: input.classifierStatus,
        });
  const evaluation = Object.freeze({
    canContinue: input.route === "allowed",
    classifier,
    evaluatedAsOf: input.asOf,
    intakePolicyVersion: preGenerationSafetyIntakePolicyVersion,
    locale: "en" as const,
    modality: "tarot" as const,
    policyVersion: preGenerationSafetyPolicyVersion,
    readingType: input.readingType,
    requestId: input.requestId,
    route: input.route,
    schemaVersion: preGenerationSafetyEvaluationSchemaVersion,
    suggestedQuestionCode: input.suggestedQuestionCode,
    themeCode: input.themeCode,
  }) as PreGenerationSafetyEvaluationV1;
  issuedPreGenerationSafetyEvaluations.add(evaluation);
  return evaluation;
};

const parseInputEnvelope = (
  value: EvaluatePreGenerationSafetyInputV1,
): {
  asOf: string;
  authorizeClassifier: unknown;
  authorizePolicy: unknown;
  classifier: unknown;
  classifierRegistration: unknown;
  policyApprovalReference: unknown;
  readingType: TarotReadingType;
  requestId: string;
  requestJson: string;
} => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(
      candidate,
      ["asOf", "readingType", "requestId", "requestJson"],
      [
        "authorizeClassifier",
        "authorizePolicy",
        "classifier",
        "classifierRegistration",
        "policyApprovalReference",
      ],
    ) ||
    typeof candidate.requestJson !== "string" ||
    candidate.requestJson.length === 0 ||
    utf8ByteLength(candidate.requestJson) > preGenerationSafetyLimits.requestJsonMaximumBytes ||
    !isTarotReadingType(candidate.readingType) ||
    typeof candidate.requestId !== "string" ||
    !uuidV4Pattern.test(candidate.requestId)
  ) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return {
    asOf: parseDate(candidate.asOf),
    authorizeClassifier: candidate.authorizeClassifier,
    authorizePolicy: candidate.authorizePolicy,
    classifier: candidate.classifier,
    classifierRegistration: candidate.classifierRegistration,
    policyApprovalReference: candidate.policyApprovalReference,
    readingType: candidate.readingType,
    requestId: candidate.requestId,
    requestJson: candidate.requestJson,
  };
};

const parsePolicyConfiguration = (input: {
  authorizePolicy: unknown;
  policyApprovalReference: unknown;
}): {
  authorizePolicy: PreGenerationSafetyPolicyAuthorityVerifierV1;
  policyApprovalReference: string;
} => {
  if (
    typeof input.authorizePolicy !== "function" ||
    typeof input.policyApprovalReference !== "string" ||
    !approvalReferencePattern.test(input.policyApprovalReference)
  ) {
    return fail("PRE_GENERATION_SAFETY_POLICY_NOT_APPROVED");
  }
  return {
    authorizePolicy: input.authorizePolicy as PreGenerationSafetyPolicyAuthorityVerifierV1,
    policyApprovalReference: input.policyApprovalReference,
  };
};

const parseClassifierConfiguration = (input: {
  authorizeClassifier: unknown;
  classifier: unknown;
  classifierRegistration: unknown;
}): {
  authorizeClassifier: PreGenerationSafetyClassifierAuthorityVerifierV1;
  classifier: PreGenerationSafetyClassifierV1;
  classifierRegistration: PreGenerationSafetyClassifierRegistrationV1;
} => {
  const present = [
    input.authorizeClassifier,
    input.classifier,
    input.classifierRegistration,
  ].filter((entry) => entry !== undefined).length;
  if (present === 0) return fail("PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE");
  if (
    present !== 3 ||
    typeof input.authorizeClassifier !== "function" ||
    typeof input.classifier !== "function"
  ) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  return {
    authorizeClassifier:
      input.authorizeClassifier as PreGenerationSafetyClassifierAuthorityVerifierV1,
    classifier: input.classifier as PreGenerationSafetyClassifierV1,
    classifierRegistration: parseClassifierRegistration(input.classifierRegistration),
  };
};

export const evaluatePreGenerationSafetyV1 = async (
  rawInput: EvaluatePreGenerationSafetyInputV1,
): Promise<PreGenerationSafetyEvaluationV1> => {
  const input = parseInputEnvelope(rawInput);
  let requestValue: unknown;
  try {
    requestValue = JSON.parse(input.requestJson) as unknown;
  } catch {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }

  let request: ReturnType<typeof parseQuestionIntakeRequest>;
  let intake: ReturnType<typeof evaluateQuestionIntake>;
  try {
    request = parseQuestionIntakeRequest(requestValue);
    intake = evaluateQuestionIntake(request);
  } catch {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  if (String(intake.policyVersion) !== preGenerationSafetyIntakePolicyVersion) {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }

  const intakeRisks = intake.riskCategories;
  if (intake.state === "crisis") {
    return issueEvaluation({
      asOf: input.asOf,
      classifier: null,
      classifierStatus: null,
      route: "crisis",
      readingType: input.readingType,
      requestId: input.requestId,
      suggestedQuestionCode: null,
      themeCode: intake.themeCode,
    });
  }

  if (request.question === undefined) {
    return issueEvaluation({
      asOf: input.asOf,
      classifier: null,
      classifierStatus: null,
      route: "allowed",
      readingType: input.readingType,
      requestId: input.requestId,
      suggestedQuestionCode: null,
      themeCode: intake.themeCode,
    });
  }

  const classifierConfiguration = parseClassifierConfiguration(input);

  const authority = Object.freeze({
    asOf: input.asOf,
    classifier: classifierConfiguration.classifierRegistration,
    locale: "en" as const,
    modality: "tarot" as const,
    policyVersion: preGenerationSafetyPolicyVersion,
    schemaVersion: preGenerationSafetyClassifierAuthoritySchemaVersion,
  });
  let approved: unknown;
  try {
    approved = await classifierConfiguration.authorizeClassifier(authority);
  } catch {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_NOT_APPROVED");
  }
  if (approved !== true) return fail("PRE_GENERATION_SAFETY_CLASSIFIER_NOT_APPROVED");

  const classifierRequest = Object.freeze({
    locale: "en" as const,
    modality: "tarot" as const,
    question: request.question,
    schemaVersion: preGenerationSafetyClassifierRequestSchemaVersion,
    themeCode: request.themeCode,
  });
  let classifierResultJson: unknown;
  try {
    classifierResultJson = await classifierConfiguration.classifier(classifierRequest);
  } catch {
    return fail("PRE_GENERATION_SAFETY_CLASSIFIER_UNAVAILABLE");
  }
  const classifierResult = parseClassifierResult(
    classifierResultJson,
    classifierConfiguration.classifierRegistration,
  );
  const totalRisks = mergeRisks(intakeRisks, classifierResult.categories);
  const route = highestRoute(
    intake.state,
    routeFor(totalRisks, classifierResult.status === "uncertain"),
  );
  return issueEvaluation({
    asOf: input.asOf,
    classifier: classifierConfiguration.classifierRegistration,
    classifierStatus: classifierResult.status,
    route,
    readingType: input.readingType,
    requestId: input.requestId,
    suggestedQuestionCode: suggestionFor(route, totalRisks),
    themeCode: intake.themeCode,
  });
};

export const isPreGenerationSafetyEvaluationV1 = (
  value: unknown,
): value is PreGenerationSafetyEvaluationV1 =>
  typeof value === "object" && value !== null && issuedPreGenerationSafetyEvaluations.has(value);

export const createInterpretationSafetyDecisionV1 = (
  evaluation: PreGenerationSafetyEvaluationV1,
): InterpretationSafetyDecisionV1 => {
  if (!isPreGenerationSafetyEvaluationV1(evaluation)) {
    return fail("PRE_GENERATION_SAFETY_AUTHORIZATION_DENIED");
  }
  return Object.freeze({
    policyVersion: evaluation.policyVersion,
    route: evaluation.route,
    schemaVersion: "interpretation-safety-decision.v1" as const,
  });
};

const issuePreGenerationSafetyAuthorizationV1 = (
  evaluation: PreGenerationSafetyEvaluationV1,
  policyApprovalReference: string,
): InterpretationGenerationAuthorizationV1 => {
  if (!isPreGenerationSafetyEvaluationV1(evaluation) || evaluation.route !== "allowed") {
    return fail("PRE_GENERATION_SAFETY_AUTHORIZATION_DENIED");
  }
  return issueInterpretationGenerationAuthorizationV1(
    createInterpretationSafetyDecisionV1(evaluation),
    {
      intakePolicyVersion: evaluation.intakePolicyVersion,
      locale: evaluation.locale,
      modality: evaluation.modality,
      policyApprovalReference,
      readingType: evaluation.readingType,
      requestId: evaluation.requestId,
      safetyPolicyVersion: evaluation.policyVersion,
      themeCode: evaluation.themeCode,
    },
  );
};

export type PreGenerationSafetyContinuationContextV1 = Readonly<{
  authorization: InterpretationGenerationAuthorizationV1;
  decision: InterpretationSafetyDecisionV1 & Readonly<{ route: "allowed" }>;
  evaluation: PreGenerationSafetyEvaluationV1 & Readonly<{ route: "allowed" }>;
  policyApprovalReference: string;
}>;

export type PreGenerationSafetyGateResultV1<Value> =
  | Readonly<{
      evaluation: PreGenerationSafetyEvaluationV1;
      status: "stopped";
    }>
  | Readonly<{
      evaluation: PreGenerationSafetyEvaluationV1 & Readonly<{ route: "allowed" }>;
      status: "continued";
      value: Value;
    }>;

export const runPreGenerationSafetyGateV1 = async <Value>(
  input: EvaluatePreGenerationSafetyInputV1,
  onAllowed: (context: PreGenerationSafetyContinuationContextV1) => Value | Promise<Value>,
): Promise<PreGenerationSafetyGateResultV1<Value>> => {
  if (typeof onAllowed !== "function") {
    return fail("PRE_GENERATION_SAFETY_INPUT_INVALID");
  }
  const evaluation = await evaluatePreGenerationSafetyV1(input);
  if (evaluation.route !== "allowed") {
    return Object.freeze({ evaluation, status: "stopped" });
  }
  const allowedEvaluation = evaluation as PreGenerationSafetyEvaluationV1 &
    Readonly<{ route: "allowed" }>;
  const policyConfiguration = parsePolicyConfiguration({
    authorizePolicy: input.authorizePolicy,
    policyApprovalReference: input.policyApprovalReference,
  });
  const policyAuthority = Object.freeze({
    approvalReference: policyConfiguration.policyApprovalReference,
    asOf: allowedEvaluation.evaluatedAsOf,
    intakePolicyVersion: allowedEvaluation.intakePolicyVersion,
    locale: allowedEvaluation.locale,
    modality: allowedEvaluation.modality,
    policyVersion: allowedEvaluation.policyVersion,
    schemaVersion: preGenerationSafetyPolicyAuthoritySchemaVersion,
  });
  let policyApproved: unknown;
  try {
    policyApproved = await policyConfiguration.authorizePolicy(policyAuthority);
  } catch {
    return fail("PRE_GENERATION_SAFETY_POLICY_NOT_APPROVED");
  }
  if (policyApproved !== true) return fail("PRE_GENERATION_SAFETY_POLICY_NOT_APPROVED");
  const decision = createInterpretationSafetyDecisionV1(
    allowedEvaluation,
  ) as InterpretationSafetyDecisionV1 & Readonly<{ route: "allowed" }>;
  const authorization = issuePreGenerationSafetyAuthorizationV1(
    allowedEvaluation,
    policyConfiguration.policyApprovalReference,
  );
  const value = await onAllowed(
    Object.freeze({
      authorization,
      decision,
      evaluation: allowedEvaluation,
      policyApprovalReference: policyConfiguration.policyApprovalReference,
    }),
  );
  return Object.freeze({ evaluation: allowedEvaluation, status: "continued", value });
};
