export const paymentRouteControlSchemaVersion = "payment-route-control.v1" as const;
export const paymentRouteControlReasons = Object.freeze([
  "authorized",
  "checkout_disabled",
  "country_disabled",
  "fallback_forbidden",
  "invalid_input",
  "method_disabled",
  "policy_denied",
  "policy_mismatch",
  "provider_disabled",
] as const);
export type PaymentRouteControlReason = (typeof paymentRouteControlReasons)[number];

export type PaymentRouteKind = "crypto" | "fiat";
export type PaymentRouteMethod = "card" | "hosted_wallet" | null;
export type PaymentCheckoutFlagKey = "payments.crypto_checkout" | "payments.fiat_checkout";

export type PaymentControlFlagEvaluationV1 = Readonly<{
  enabled: boolean;
  evaluatedAt: string;
  flagKey: "market.country_activation" | PaymentCheckoutFlagKey;
  reason:
    | "configured-off"
    | "default-off"
    | "enabled"
    | "expired"
    | "registry-expired"
    | "retired"
    | "scope-mismatch";
  registryVersion: number;
  source: "default" | "version";
  version: number | null;
}>;

export type ScopedPaymentControlFlagEvaluationV1 = Readonly<{
  countryCode: string;
  evaluation: PaymentControlFlagEvaluationV1;
}>;

export type PaymentActivationControlsV1 = Readonly<{
  checkoutActivation: ScopedPaymentControlFlagEvaluationV1;
  countryActivation: ScopedPaymentControlFlagEvaluationV1;
}>;

export type PaymentRouteV1 = Readonly<{
  countryCode: string;
  currencyCode: string;
  evaluatedAt: string;
  kind: PaymentRouteKind;
  method: PaymentRouteMethod;
  providerId: string;
  recurring: boolean;
}>;

export type PaymentRouteControlEvidenceV1 = Readonly<{
  checkoutFlagKey: PaymentCheckoutFlagKey;
  checkoutFlagVersion: number | null;
  countryFlagVersion: number | null;
  evaluatedAt: string;
  policyVersion: string | null;
  registryVersion: number;
  schemaVersion: typeof paymentRouteControlSchemaVersion;
}>;

export type PaymentRouteControlDecisionV1 =
  | Readonly<{
      allowed: false;
      evidence: PaymentRouteControlEvidenceV1 | null;
      fallbackProviderId: null;
      reason: Exclude<PaymentRouteControlReason, "authorized">;
      route: null;
    }>
  | Readonly<{
      allowed: true;
      evidence: PaymentRouteControlEvidenceV1;
      fallbackProviderId: null;
      reason: "authorized";
      route: PaymentRouteV1;
    }>;

export type PaymentRouteControlInputV1 = Readonly<{
  activation: PaymentActivationControlsV1;
  fallbackProviderIds: readonly string[];
  policyDecision: PaymentCountryPolicyDecisionV1;
  route: PaymentRouteV1;
}>;

export type PaymentCountryPolicyDecisionV1 =
  | Readonly<{
      allowed: false;
      reason: Exclude<(typeof countryPolicyDecisionReasons)[number], "allowed">;
      snapshot: null;
    }>
  | Readonly<{
      allowed: true;
      reason: "allowed";
      snapshot: Readonly<{
        evaluatedAt: string;
        payment: Readonly<{
          currencyCode: string;
          kind: PaymentRouteKind;
          method: PaymentRouteMethod;
          providerId: string;
          recurring: boolean;
        }> | null;
        policyVersion: string;
        selectedCountryCode: string;
      }>;
    }>;

const countryCodePattern = /^[A-Z]{2}$/u;
const fiatCurrencyPattern = /^[A-Z]{3}$/u;
const cryptoAssetPattern = /^[A-Z0-9][A-Z0-9._-]{0,31}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u;
const flagReasons = Object.freeze([
  "configured-off",
  "default-off",
  "enabled",
  "expired",
  "registry-expired",
  "retired",
  "scope-mismatch",
] as const);
const countryPolicyDecisionReasons = Object.freeze([
  "allowed",
  "age_requirement_not_met",
  "ambiguous_policy",
  "country_evidence_conflict",
  "country_evidence_insufficient",
  "crypto_not_approved",
  "currency_not_approved",
  "invalid_input",
  "legal_document_not_approved",
  "marketing_not_approved",
  "method_not_approved",
  "modality_not_approved",
  "no_country_policy",
  "payment_not_approved",
  "policy_disabled",
  "policy_expired",
  "policy_inactive",
  "policy_not_approved",
  "policy_review_overdue",
  "product_not_approved",
  "provider_not_approved",
  "recurring_not_approved",
  "service_not_approved",
  "test_evidence_forbidden",
] as const);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected.at(index))
  );
};

const validInstant = (value: unknown): value is string =>
  typeof value === "string" &&
  instantPattern.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(Date.parse(value)).toISOString() === value;

const validRoute = (value: unknown): value is PaymentRouteV1 =>
  isRecord(value) &&
  exactKeys(value, [
    "countryCode",
    "currencyCode",
    "evaluatedAt",
    "kind",
    "method",
    "providerId",
    "recurring",
  ]) &&
  typeof value.countryCode === "string" &&
  countryCodePattern.test(value.countryCode) &&
  typeof value.currencyCode === "string" &&
  validInstant(value.evaluatedAt) &&
  (value.kind === "fiat" || value.kind === "crypto") &&
  (value.kind === "fiat"
    ? fiatCurrencyPattern.test(value.currencyCode) &&
      (value.method === "card" || value.method === "hosted_wallet")
    : cryptoAssetPattern.test(value.currencyCode) && value.method === null) &&
  typeof value.providerId === "string" &&
  identifierPattern.test(value.providerId) &&
  typeof value.recurring === "boolean" &&
  !(value.kind === "crypto" && value.recurring);

const validFlagEvaluation = (
  value: unknown,
  expectedFlagKey: PaymentControlFlagEvaluationV1["flagKey"],
  expectedAt: string,
): value is PaymentControlFlagEvaluationV1 =>
  isRecord(value) &&
  exactKeys(value, [
    "enabled",
    "evaluatedAt",
    "flagKey",
    "reason",
    "registryVersion",
    "source",
    "version",
  ]) &&
  typeof value.enabled === "boolean" &&
  value.evaluatedAt === expectedAt &&
  value.flagKey === expectedFlagKey &&
  flagReasons.includes(value.reason as (typeof flagReasons)[number]) &&
  value.enabled === (value.reason === "enabled") &&
  Number.isSafeInteger(value.registryVersion) &&
  Number(value.registryVersion) > 0 &&
  (value.source === "default" || value.source === "version") &&
  (!value.enabled || value.source === "version") &&
  ((value.source === "default" && value.version === null) ||
    (value.source === "version" &&
      Number.isSafeInteger(value.version) &&
      Number(value.version) > 0));

const validScopedFlag = (
  value: unknown,
  expectedFlagKey: PaymentControlFlagEvaluationV1["flagKey"],
  route: PaymentRouteV1,
): value is ScopedPaymentControlFlagEvaluationV1 =>
  isRecord(value) &&
  exactKeys(value, ["countryCode", "evaluation"]) &&
  value.countryCode === route.countryCode &&
  validFlagEvaluation(value.evaluation, expectedFlagKey, route.evaluatedAt);

const validPolicyDecision = (value: unknown): value is PaymentCountryPolicyDecisionV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["allowed", "reason", "snapshot"]) ||
    typeof value.allowed !== "boolean" ||
    !countryPolicyDecisionReasons.includes(value.reason as never)
  ) {
    return false;
  }
  if (!value.allowed) return value.reason !== "allowed" && value.snapshot === null;
  if (value.reason !== "allowed" || !isRecord(value.snapshot)) return false;
  const snapshot = value.snapshot;
  if (
    !exactKeys(snapshot, [
      "countryEvidenceSource",
      "evaluatedAt",
      "legalDocumentVersions",
      "payment",
      "policyVersion",
      "productCode",
      "requiredDisclosures",
      "schemaVersion",
      "selectedCountryCode",
    ]) ||
    !["billing", "declared", "geolocation"].includes(String(snapshot.countryEvidenceSource)) ||
    !validInstant(snapshot.evaluatedAt) ||
    typeof snapshot.policyVersion !== "string" ||
    !versionPattern.test(snapshot.policyVersion) ||
    typeof snapshot.selectedCountryCode !== "string" ||
    !countryCodePattern.test(snapshot.selectedCountryCode) ||
    snapshot.schemaVersion !== "country-policy-snapshot.v2" ||
    !Array.isArray(snapshot.legalDocumentVersions) ||
    !Array.isArray(snapshot.requiredDisclosures) ||
    (snapshot.productCode !== null &&
      (typeof snapshot.productCode !== "string" ||
        !identifierPattern.test(snapshot.productCode))) ||
    !isRecord(snapshot.payment) ||
    !exactKeys(snapshot.payment, ["currencyCode", "kind", "method", "providerId", "recurring"]) ||
    typeof snapshot.payment.currencyCode !== "string" ||
    (snapshot.payment.kind !== "fiat" && snapshot.payment.kind !== "crypto") ||
    (snapshot.payment.kind === "fiat"
      ? !fiatCurrencyPattern.test(snapshot.payment.currencyCode) ||
        (snapshot.payment.method !== "card" && snapshot.payment.method !== "hosted_wallet")
      : !cryptoAssetPattern.test(snapshot.payment.currencyCode) ||
        snapshot.payment.method !== null) ||
    typeof snapshot.payment.providerId !== "string" ||
    !identifierPattern.test(snapshot.payment.providerId) ||
    typeof snapshot.payment.recurring !== "boolean" ||
    (snapshot.payment.kind === "crypto" && snapshot.payment.recurring)
  ) {
    return false;
  }
  return true;
};

const denied = (
  reason: Exclude<PaymentRouteControlReason, "authorized">,
  evidence: PaymentRouteControlEvidenceV1 | null = null,
): PaymentRouteControlDecisionV1 =>
  Object.freeze({ allowed: false, evidence, fallbackProviderId: null, reason, route: null });

const evidenceFor = (
  activation: PaymentActivationControlsV1,
  route: PaymentRouteV1,
  policyVersion: string | null,
): PaymentRouteControlEvidenceV1 =>
  Object.freeze({
    checkoutFlagKey: activation.checkoutActivation.evaluation.flagKey as PaymentCheckoutFlagKey,
    checkoutFlagVersion: activation.checkoutActivation.evaluation.version,
    countryFlagVersion: activation.countryActivation.evaluation.version,
    evaluatedAt: route.evaluatedAt,
    policyVersion,
    registryVersion: activation.countryActivation.evaluation.registryVersion,
    schemaVersion: paymentRouteControlSchemaVersion,
  });

export const evaluatePaymentRouteControl = (
  input: PaymentRouteControlInputV1,
): PaymentRouteControlDecisionV1 => {
  if (
    !isRecord(input) ||
    !exactKeys(input, ["activation", "fallbackProviderIds", "policyDecision", "route"]) ||
    !validRoute(input.route) ||
    !isRecord(input.activation) ||
    !exactKeys(input.activation, ["checkoutActivation", "countryActivation"]) ||
    !Array.isArray(input.fallbackProviderIds) ||
    input.fallbackProviderIds.some(
      (providerId) => typeof providerId !== "string" || !identifierPattern.test(providerId),
    ) ||
    !validPolicyDecision(input.policyDecision)
  ) {
    return denied("invalid_input");
  }

  const checkoutFlagKey: PaymentCheckoutFlagKey =
    input.route.kind === "fiat" ? "payments.fiat_checkout" : "payments.crypto_checkout";
  if (
    !validScopedFlag(
      input.activation.countryActivation,
      "market.country_activation",
      input.route,
    ) ||
    !validScopedFlag(input.activation.checkoutActivation, checkoutFlagKey, input.route) ||
    input.activation.countryActivation.evaluation.registryVersion !==
      input.activation.checkoutActivation.evaluation.registryVersion
  ) {
    return denied("invalid_input");
  }

  const evidence = evidenceFor(
    input.activation,
    input.route,
    input.policyDecision.allowed ? input.policyDecision.snapshot.policyVersion : null,
  );
  if (input.fallbackProviderIds.length > 0) return denied("fallback_forbidden", evidence);
  if (!input.activation.countryActivation.evaluation.enabled) {
    return denied("country_disabled", evidence);
  }
  if (!input.activation.checkoutActivation.evaluation.enabled) {
    return denied("checkout_disabled", evidence);
  }
  if (!input.policyDecision.allowed) {
    if (input.policyDecision.reason === "provider_not_approved") {
      return denied("provider_disabled", evidence);
    }
    if (input.policyDecision.reason === "method_not_approved") {
      return denied("method_disabled", evidence);
    }
    return denied("policy_denied", evidence);
  }

  const payment = input.policyDecision.snapshot.payment;
  if (input.policyDecision.snapshot.selectedCountryCode !== input.route.countryCode) {
    return denied("policy_mismatch", evidence);
  }
  if (payment === null || payment.providerId !== input.route.providerId) {
    return denied("provider_disabled", evidence);
  }
  if (payment.method !== input.route.method) return denied("method_disabled", evidence);
  if (
    input.policyDecision.snapshot.evaluatedAt !== input.route.evaluatedAt ||
    payment.currencyCode !== input.route.currencyCode ||
    payment.kind !== input.route.kind ||
    payment.recurring !== input.route.recurring
  ) {
    return denied("policy_mismatch", evidence);
  }

  return Object.freeze({
    allowed: true,
    evidence,
    fallbackProviderId: null,
    reason: "authorized",
    route: Object.freeze({ ...input.route }),
  });
};
