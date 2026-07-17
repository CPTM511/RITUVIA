import {
  parseQuestionIntakeThemeCode,
  tarotReadingTypes,
  type QuestionIntakeThemeCode,
  type TarotReadingType,
} from "@rituvia/domain";

export const structuredGenerationRequestSchemaVersion = "structured-generation-request.v1" as const;
export const structuredGenerationProviderSchemaVersion =
  "structured-generation-provider.v1" as const;

export const structuredGenerationFailureCodes = Object.freeze([
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
export type StructuredGenerationFailureCode = (typeof structuredGenerationFailureCodes)[number];

export const structuredGenerationFinishReasons = Object.freeze([
  "stop",
  "length",
  "other",
] as const);
export type StructuredGenerationFinishReason = (typeof structuredGenerationFinishReasons)[number];

export type ProviderVersionReferenceV1 = Readonly<{
  id: string;
  version: string;
}>;

export type ProviderChecksummedReferenceV1 = Readonly<{
  checksum: string;
  id: string;
  version: string;
}>;

export type AllowedInterpretationSafetyDecisionV1 = Readonly<{
  policyVersion: string;
  route: "allowed";
  schemaVersion: "interpretation-safety-decision.v1";
}>;

declare const interpretationGenerationAuthorizationBrand: unique symbol;

export type InterpretationGenerationAuthorizationBindingV1 = Readonly<{
  intakePolicyVersion: string;
  locale: string;
  modality: "tarot";
  policyApprovalReference: string;
  readingType: TarotReadingType;
  requestId: string;
  safetyPolicyVersion: string;
  themeCode: QuestionIntakeThemeCode;
}>;

export type InterpretationGenerationAuthorizationV1 = Readonly<{
  binding: InterpretationGenerationAuthorizationBindingV1;
  policyVersion: string;
  route: "allowed";
  schemaVersion: "interpretation-safety-decision.v1";
  [interpretationGenerationAuthorizationBrand]: true;
}>;

const issuedInterpretationGenerationAuthorizations = new WeakSet<object>();

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;

const parseAuthorizationBinding = (
  binding: InterpretationGenerationAuthorizationBindingV1,
): InterpretationGenerationAuthorizationBindingV1 => {
  let canonicalLocale: string;
  try {
    canonicalLocale = new Intl.Locale(binding.locale).toString();
  } catch {
    throw new TypeError("The interpretation generation authorization is invalid.");
  }
  if (
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(binding.intakePolicyVersion) ||
    canonicalLocale !== binding.locale ||
    binding.modality !== "tarot" ||
    !approvalReferencePattern.test(binding.policyApprovalReference) ||
    !tarotReadingTypes.includes(binding.readingType) ||
    !uuidV4Pattern.test(binding.requestId) ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(binding.safetyPolicyVersion)
  ) {
    throw new TypeError("The interpretation generation authorization is invalid.");
  }
  let themeCode: QuestionIntakeThemeCode;
  try {
    themeCode = parseQuestionIntakeThemeCode(binding.themeCode);
  } catch {
    throw new TypeError("The interpretation generation authorization is invalid.");
  }
  return Object.freeze({
    intakePolicyVersion: binding.intakePolicyVersion,
    locale: canonicalLocale,
    modality: "tarot",
    policyApprovalReference: binding.policyApprovalReference,
    readingType: binding.readingType,
    requestId: binding.requestId,
    safetyPolicyVersion: binding.safetyPolicyVersion,
    themeCode,
  });
};

export const issueInterpretationGenerationAuthorizationV1 = (
  decision: InterpretationSafetyDecisionV1,
  binding: InterpretationGenerationAuthorizationBindingV1,
): InterpretationGenerationAuthorizationV1 => {
  if (
    decision.route !== "allowed" ||
    decision.schemaVersion !== "interpretation-safety-decision.v1" ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(decision.policyVersion)
  ) {
    throw new TypeError("The interpretation generation authorization is invalid.");
  }
  const parsedBinding = parseAuthorizationBinding(binding);
  if (parsedBinding.safetyPolicyVersion !== decision.policyVersion) {
    throw new TypeError("The interpretation generation authorization is invalid.");
  }
  const authorization = Object.freeze({
    binding: parsedBinding,
    policyVersion: decision.policyVersion,
    route: "allowed" as const,
    schemaVersion: "interpretation-safety-decision.v1" as const,
  }) as InterpretationGenerationAuthorizationV1;
  issuedInterpretationGenerationAuthorizations.add(authorization);
  return authorization;
};

export const isInterpretationGenerationAuthorizationV1 = (
  value: unknown,
  expectedBinding?: InterpretationGenerationAuthorizationBindingV1,
): value is InterpretationGenerationAuthorizationV1 => {
  if (
    typeof value !== "object" ||
    value === null ||
    !issuedInterpretationGenerationAuthorizations.has(value)
  ) {
    return false;
  }
  if (expectedBinding === undefined) return true;
  try {
    return (
      JSON.stringify((value as InterpretationGenerationAuthorizationV1).binding) ===
      JSON.stringify(parseAuthorizationBinding(expectedBinding))
    );
  } catch {
    return false;
  }
};

export type InterpretationSafetyDecisionV1 =
  | AllowedInterpretationSafetyDecisionV1
  | Readonly<{
      policyVersion: string;
      route: "blocked" | "crisis" | "reframed";
      schemaVersion: "interpretation-safety-decision.v1";
    }>;

export type StructuredGenerationPromptMessageV1 = Readonly<{
  content: string;
  role: "system" | "user";
}>;

export type StructuredGenerationRequestV1 = Readonly<{
  authorization: InterpretationGenerationAuthorizationV1;
  maxOutputTokens: number;
  messages: readonly StructuredGenerationPromptMessageV1[];
  model: ProviderVersionReferenceV1;
  outputSchema: ProviderChecksummedReferenceV1;
  prompt: ProviderChecksummedReferenceV1;
  requestId: string;
  schemaVersion: typeof structuredGenerationRequestSchemaVersion;
  timeoutMs: number;
}>;

export type StructuredGenerationUsageV1 = Readonly<{
  estimatedCost?: Readonly<{
    amountMicros: number;
    currencyCode: string;
  }>;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

export type StructuredGenerationFailureV1 = Readonly<{
  code: StructuredGenerationFailureCode;
  retryAfterMs?: number;
  retryable: boolean;
  status: "failed";
}>;

export type StructuredGenerationSuccessV1 = Readonly<{
  finishReason: StructuredGenerationFinishReason;
  outputJson: string;
  status: "succeeded";
  usage: StructuredGenerationUsageV1;
}>;

export type StructuredGenerationResultV1 =
  StructuredGenerationFailureV1 | StructuredGenerationSuccessV1;

/**
 * Provider-neutral cancellation capability. The host owns the real timer and
 * maps this contract to the vendor SDK without bringing DOM globals into this
 * framework-independent package.
 */
export type StructuredGenerationCancellationV1 = Readonly<{
  readonly aborted: boolean;
  subscribe: (listener: () => void) => () => void;
}>;

export type StructuredGenerationExecutionContextV1 = Readonly<{
  attempt: 1 | 2;
  attemptId: string;
  cancellation: StructuredGenerationCancellationV1;
}>;

export type StructuredGenerationProviderV1 = Readonly<{
  descriptor: Readonly<{
    capabilities: readonly ("structured_generation" | "usage_reporting")[];
    provider: ProviderVersionReferenceV1;
    schemaVersion: typeof structuredGenerationProviderSchemaVersion;
  }>;
  generateStructured: (
    request: StructuredGenerationRequestV1,
    executionContext: StructuredGenerationExecutionContextV1,
  ) => Promise<StructuredGenerationResultV1>;
}>;

export type StructuredGenerationStreamEventV1 =
  | Readonly<{
      delta: string;
      provisional: true;
      type: "delta";
    }>
  | Readonly<{
      result: StructuredGenerationSuccessV1;
      type: "completed";
    }>
  | Readonly<{
      failure: StructuredGenerationFailureV1;
      type: "failed";
    }>;

export type StructuredStreamingProviderV1 = Omit<StructuredGenerationProviderV1, "descriptor"> &
  Readonly<{
    descriptor: Readonly<{
      capabilities: readonly (
        "structured_generation" | "structured_streaming" | "usage_reporting"
      )[];
      provider: ProviderVersionReferenceV1;
      schemaVersion: typeof structuredGenerationProviderSchemaVersion;
    }>;
    streamStructured: (
      request: StructuredGenerationRequestV1,
    ) => AsyncIterable<StructuredGenerationStreamEventV1>;
  }>;

export type InterpretationOperationalMetadataV1 = Readonly<{
  contentVersions: readonly string[];
  estimatedCostMicros?: number;
  inputTokens?: number;
  latencyMs: number;
  locale: string;
  modality: "tarot";
  modelVersion: string;
  outputSchemaVersion: string;
  outputTokens?: number;
  promptVersion: string;
  providerVersion: string;
  result: "failed" | "fallback" | "succeeded";
  safetyPolicyVersion: string;
  themeCode: string;
}>;
