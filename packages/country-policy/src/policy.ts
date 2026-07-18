const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length && actual.every((key, index) => key === expected.at(index))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u;
const evidencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const countryCodePattern = /^[A-Z]{2}$/u;
const currencyCodePattern = /^[A-Z]{3}$/u;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const countryPolicyRuleSchemaVersion = "country-policy-rule.v1" as const;
export const countryPolicyEnvironments = Object.freeze([
  "local",
  "preview",
  "staging",
  "production",
] as const);
export type CountryPolicyEnvironment = (typeof countryPolicyEnvironments)[number];

export const countryPolicyDecisionReasons = Object.freeze([
  "allowed",
  "adult_attestation_required",
  "ambiguous_policy",
  "currency_not_approved",
  "invalid_input",
  "method_not_approved",
  "no_country_policy",
  "policy_expired",
  "policy_inactive",
  "policy_not_approved",
  "product_not_approved",
  "provider_not_approved",
  "test_evidence_forbidden",
] as const);
export type CountryPolicyDecisionReason = (typeof countryPolicyDecisionReasons)[number];

export type CountryPolicyPaymentMethod = "card" | "hosted_wallet";

export type CountryPolicyApprovalEvidenceV1 = Readonly<{
  legalReference: string;
  ownerReference: string;
  providerReference: string;
}>;

export type CountryPolicyRuleV1 = Readonly<{
  approvalMode: "local_test" | "written";
  countryCode: string;
  currencyCode: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  environment: CountryPolicyEnvironment;
  evidence: CountryPolicyApprovalEvidenceV1;
  minimumAge: 18;
  paymentMethod: CountryPolicyPaymentMethod;
  productCode: string;
  providerId: string;
  schemaVersion: typeof countryPolicyRuleSchemaVersion;
  status: "approved" | "disabled";
  version: string;
}>;

export type CountryPolicyEvaluationInput = Readonly<{
  adultAttested: boolean;
  asOf: string;
  countryCode: string;
  currencyCode: string;
  environment: CountryPolicyEnvironment;
  paymentMethod: CountryPolicyPaymentMethod;
  productCode: string;
  providerId: string;
}>;

export type CountryPolicySnapshotV1 = Readonly<{
  countryCode: string;
  currencyCode: string;
  evaluatedAt: string;
  evidence: CountryPolicyApprovalEvidenceV1;
  paymentMethod: CountryPolicyPaymentMethod;
  productCode: string;
  providerId: string;
  ruleVersion: string;
  schemaVersion: "country-policy-snapshot.v1";
}>;

export type CountryPolicyDecision =
  | Readonly<{
      allowed: false;
      reason: Exclude<CountryPolicyDecisionReason, "allowed">;
      snapshot: null;
    }>
  | Readonly<{
      allowed: true;
      reason: "allowed";
      snapshot: CountryPolicySnapshotV1;
    }>;

const deny = (reason: Exclude<CountryPolicyDecisionReason, "allowed">): CountryPolicyDecision =>
  Object.freeze({ allowed: false, reason, snapshot: null });

const validInstant = (value: string): boolean =>
  instantPattern.test(value) && Number.isFinite(Date.parse(value));

const validEvidence = (value: CountryPolicyApprovalEvidenceV1): boolean =>
  evidencePattern.test(value.legalReference) &&
  evidencePattern.test(value.ownerReference) &&
  evidencePattern.test(value.providerReference);

const hasTestEvidence = (evidence: CountryPolicyApprovalEvidenceV1): boolean =>
  Object.values(evidence).some((reference) => reference.startsWith("test:"));

const validInput = (input: CountryPolicyEvaluationInput): boolean =>
  typeof input.adultAttested === "boolean" &&
  validInstant(input.asOf) &&
  countryCodePattern.test(input.countryCode) &&
  currencyCodePattern.test(input.currencyCode) &&
  countryPolicyEnvironments.includes(input.environment) &&
  (input.paymentMethod === "card" || input.paymentMethod === "hosted_wallet") &&
  identifierPattern.test(input.productCode) &&
  identifierPattern.test(input.providerId);

export const parseCountryPolicyRuleV1 = (value: unknown): CountryPolicyRuleV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "approvalMode",
      "countryCode",
      "currencyCode",
      "effectiveFrom",
      "effectiveUntil",
      "environment",
      "evidence",
      "minimumAge",
      "paymentMethod",
      "productCode",
      "providerId",
      "schemaVersion",
      "status",
      "version",
    ]) ||
    value.schemaVersion !== countryPolicyRuleSchemaVersion ||
    (value.approvalMode !== "local_test" && value.approvalMode !== "written") ||
    !countryPolicyEnvironments.includes(value.environment as CountryPolicyEnvironment) ||
    !countryCodePattern.test(String(value.countryCode)) ||
    !currencyCodePattern.test(String(value.currencyCode)) ||
    !identifierPattern.test(String(value.productCode)) ||
    !identifierPattern.test(String(value.providerId)) ||
    (value.paymentMethod !== "card" && value.paymentMethod !== "hosted_wallet") ||
    value.minimumAge !== 18 ||
    (value.status !== "approved" && value.status !== "disabled") ||
    !versionPattern.test(String(value.version)) ||
    typeof value.effectiveFrom !== "string" ||
    !validInstant(value.effectiveFrom) ||
    (value.effectiveUntil !== null &&
      (typeof value.effectiveUntil !== "string" || !validInstant(value.effectiveUntil))) ||
    (typeof value.effectiveUntil === "string" &&
      Date.parse(value.effectiveUntil) <= Date.parse(value.effectiveFrom)) ||
    !isRecord(value.evidence) ||
    !exactKeys(value.evidence, ["legalReference", "ownerReference", "providerReference"])
  ) {
    throw new TypeError("Country policy rule is invalid.");
  }

  const evidence = Object.freeze({
    legalReference: String(value.evidence.legalReference),
    ownerReference: String(value.evidence.ownerReference),
    providerReference: String(value.evidence.providerReference),
  });
  if (!validEvidence(evidence)) throw new TypeError("Country policy rule is invalid.");
  if (
    (value.approvalMode === "local_test" && value.environment !== "local") ||
    (value.approvalMode === "written" && hasTestEvidence(evidence))
  ) {
    throw new TypeError("Country policy rule is invalid.");
  }

  return Object.freeze({
    approvalMode: value.approvalMode,
    countryCode: String(value.countryCode),
    currencyCode: String(value.currencyCode),
    effectiveFrom: value.effectiveFrom,
    effectiveUntil: value.effectiveUntil as string | null,
    environment: value.environment as CountryPolicyEnvironment,
    evidence,
    minimumAge: 18,
    paymentMethod: value.paymentMethod,
    productCode: String(value.productCode),
    providerId: String(value.providerId),
    schemaVersion: countryPolicyRuleSchemaVersion,
    status: value.status,
    version: String(value.version),
  });
};

export const evaluateCountryPolicy = (
  input: CountryPolicyEvaluationInput,
  rules: readonly CountryPolicyRuleV1[],
): CountryPolicyDecision => {
  if (!validInput(input)) return deny("invalid_input");

  let validatedRules: readonly CountryPolicyRuleV1[];
  try {
    validatedRules = rules.map((rule) => parseCountryPolicyRuleV1(rule));
  } catch {
    return deny("policy_not_approved");
  }

  const countryRules = validatedRules.filter(
    (rule) => rule.environment === input.environment && rule.countryCode === input.countryCode,
  );
  if (countryRules.length === 0) return deny("no_country_policy");
  const productRules = countryRules.filter((rule) => rule.productCode === input.productCode);
  if (productRules.length === 0) return deny("product_not_approved");
  const currencyRules = productRules.filter((rule) => rule.currencyCode === input.currencyCode);
  if (currencyRules.length === 0) return deny("currency_not_approved");
  const providerRules = currencyRules.filter((rule) => rule.providerId === input.providerId);
  if (providerRules.length === 0) return deny("provider_not_approved");
  const methodRules = providerRules.filter((rule) => rule.paymentMethod === input.paymentMethod);
  if (methodRules.length === 0) return deny("method_not_approved");

  const activeRules = methodRules.filter(
    (rule) =>
      Date.parse(rule.effectiveFrom) <= Date.parse(input.asOf) &&
      (rule.effectiveUntil === null || Date.parse(input.asOf) < Date.parse(rule.effectiveUntil)),
  );
  if (activeRules.length === 0) {
    const started = methodRules.some(
      (rule) => Date.parse(rule.effectiveFrom) <= Date.parse(input.asOf),
    );
    return deny(started ? "policy_expired" : "policy_inactive");
  }
  if (activeRules.length !== 1) return deny("ambiguous_policy");

  const rule = activeRules.at(0);
  if (rule === undefined || rule.status !== "approved" || !validEvidence(rule.evidence)) {
    return deny("policy_not_approved");
  }
  if (
    (rule.approvalMode === "local_test" && input.environment !== "local") ||
    (input.environment !== "local" && hasTestEvidence(rule.evidence))
  ) {
    return deny("test_evidence_forbidden");
  }
  if (!input.adultAttested) return deny("adult_attestation_required");

  return Object.freeze({
    allowed: true,
    reason: "allowed",
    snapshot: Object.freeze({
      countryCode: input.countryCode,
      currencyCode: input.currencyCode,
      evaluatedAt: input.asOf,
      evidence: rule.evidence,
      paymentMethod: input.paymentMethod,
      productCode: input.productCode,
      providerId: input.providerId,
      ruleVersion: rule.version,
      schemaVersion: "country-policy-snapshot.v1",
    }),
  });
};
