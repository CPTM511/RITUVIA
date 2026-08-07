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
const cryptoAssetPattern = /^[A-Z0-9][A-Z0-9._-]{0,31}$/u;
const localePattern = /^[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const countryPolicyVersionSchemaVersion = "country-policy-version.v1" as const;
export const countryPolicySnapshotSchemaVersion = "country-policy-snapshot.v2" as const;
export const countryPolicyVersionStatuses = Object.freeze([
  "disabled",
  "content_only",
  "free_only",
  "paid",
] as const);
export type CountryPolicyVersionStatus = (typeof countryPolicyVersionStatuses)[number];

export const countryPolicyDecisionReasonsV2 = Object.freeze([
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
export type CountryPolicyDecisionReasonV2 = (typeof countryPolicyDecisionReasonsV2)[number];

export type CountryPolicyApprovalEvidenceV2 = Readonly<{
  cryptoApprovalReference: string | null;
  fiatApprovalReference: string | null;
  legalReference: string;
  ownerReference: string;
  providerReference: string;
}>;

export type CountryPolicyLegalDocumentVersionV1 = Readonly<{
  documentCode: string;
  version: string;
}>;

export type CountryPolicyProductV1 = Readonly<{
  access: "free" | "paid";
  productCode: string;
  subscriptionAllowed: boolean;
}>;

export type CountryPolicyFiatV1 = Readonly<{
  currencies: readonly string[];
  enabled: boolean;
  methods: readonly ("card" | "hosted_wallet")[];
  providerRoutes: readonly string[];
  recurringAllowed: boolean;
}>;

export type CountryPolicyCryptoV1 = Readonly<{
  assets: readonly string[];
  enabled: boolean;
  providerRoute: string | null;
}>;

export type CountryPolicyVersionV1 = Readonly<{
  approvalMode: "local_test" | "written";
  countryCode: string;
  crypto: CountryPolicyCryptoV1;
  dataFlags: readonly string[];
  effectiveFrom: string;
  effectiveUntil: string | null;
  environment: "local" | "preview" | "staging" | "production";
  evidence: CountryPolicyApprovalEvidenceV2;
  fiat: CountryPolicyFiatV1;
  legalDocumentVersions: readonly CountryPolicyLegalDocumentVersionV1[];
  localeTags: readonly string[];
  marketingFlags: readonly string[];
  minimumAge: number;
  modalities: readonly string[];
  nextReviewAt: string;
  prohibitedClaims: readonly string[];
  products: readonly CountryPolicyProductV1[];
  refundPolicyVersion: string;
  requiredDisclosures: readonly string[];
  schemaVersion: typeof countryPolicyVersionSchemaVersion;
  status: CountryPolicyVersionStatus;
  supersedesVersion: string | null;
  supportAvailable: boolean;
  taxMode: "merchant" | "merchant_of_record" | "not_applicable";
  version: string;
}>;

export type CountryPolicyCountryEvidenceV1 = Readonly<{
  billingCountryCode: string | null;
  declaredCountryCode: string | null;
  geolocationConfidence: "none" | "low" | "reliable";
  geolocationCountryCode: string | null;
  localeCountryCode: string | null;
}>;

export type CountryPolicyEvaluationInputV2 = Readonly<{
  ageAttested: boolean;
  asOf: string;
  countryEvidence: CountryPolicyCountryEvidenceV1;
  environment: CountryPolicyVersionV1["environment"];
  modality: string;
  payment: null | Readonly<{
    currencyCode: string;
    kind: "crypto" | "fiat";
    method: "card" | "hosted_wallet" | null;
    providerId: string;
    recurring: boolean;
  }>;
  productCode: string | null;
}>;

export type CountryPolicySnapshotV2 = Readonly<{
  countryEvidenceSource: "billing" | "declared" | "geolocation";
  evaluatedAt: string;
  legalDocumentVersions: readonly CountryPolicyLegalDocumentVersionV1[];
  payment: null | Readonly<{
    currencyCode: string;
    kind: "crypto" | "fiat";
    method: "card" | "hosted_wallet" | null;
    providerId: string;
    recurring: boolean;
  }>;
  policyVersion: string;
  productCode: string | null;
  requiredDisclosures: readonly string[];
  schemaVersion: typeof countryPolicySnapshotSchemaVersion;
  selectedCountryCode: string;
}>;

export type CountryPolicyDecisionV2 =
  | Readonly<{
      allowed: false;
      reason: Exclude<CountryPolicyDecisionReasonV2, "allowed">;
      snapshot: null;
    }>
  | Readonly<{
      allowed: true;
      reason: "allowed";
      snapshot: CountryPolicySnapshotV2;
    }>;

export type CountryPolicyDryRunComparisonV1 = Readonly<{
  changed: boolean;
  current: CountryPolicyDecisionV2;
  proposed: CountryPolicyDecisionV2;
  schemaVersion: "country-policy-dry-run.v1";
}>;

const validInstant = (value: string): boolean =>
  instantPattern.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(Date.parse(value)).toISOString() === value;

const validCountryCode = (value: unknown): value is string =>
  typeof value === "string" && countryCodePattern.test(value);

const parseStringArray = (value: unknown, pattern: RegExp, maximum: number): readonly string[] => {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError("Country policy version is invalid.");
  }
  const parsed = value.map((entry) => String(entry));
  if (
    parsed.some((entry) => !pattern.test(entry)) ||
    new Set(parsed).size !== parsed.length ||
    [...parsed].sort().some((entry, index) => entry !== parsed.at(index))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  return Object.freeze(parsed);
};

const parseEvidence = (value: unknown): CountryPolicyApprovalEvidenceV2 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "cryptoApprovalReference",
      "fiatApprovalReference",
      "legalReference",
      "ownerReference",
      "providerReference",
    ])
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  const evidence = {
    cryptoApprovalReference:
      value.cryptoApprovalReference === null ? null : String(value.cryptoApprovalReference),
    fiatApprovalReference:
      value.fiatApprovalReference === null ? null : String(value.fiatApprovalReference),
    legalReference: String(value.legalReference),
    ownerReference: String(value.ownerReference),
    providerReference: String(value.providerReference),
  };
  if (
    Object.values(evidence).some(
      (reference) => reference !== null && !evidencePattern.test(reference),
    )
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  return Object.freeze(evidence);
};

const parseLegalDocuments = (value: unknown): readonly CountryPolicyLegalDocumentVersionV1[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) {
    throw new TypeError("Country policy version is invalid.");
  }
  const parsed = value.map((entry) => {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ["documentCode", "version"]) ||
      !identifierPattern.test(String(entry.documentCode)) ||
      !versionPattern.test(String(entry.version))
    ) {
      throw new TypeError("Country policy version is invalid.");
    }
    return Object.freeze({
      documentCode: String(entry.documentCode),
      version: String(entry.version),
    });
  });
  const codes = parsed.map(({ documentCode }) => documentCode);
  if (
    new Set(codes).size !== codes.length ||
    [...codes].sort().some((entry, index) => entry !== codes.at(index))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  return Object.freeze(parsed);
};

const parseProducts = (value: unknown): readonly CountryPolicyProductV1[] => {
  if (!Array.isArray(value) || value.length > 128) {
    throw new TypeError("Country policy version is invalid.");
  }
  const parsed = value.map((entry) => {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ["access", "productCode", "subscriptionAllowed"]) ||
      (entry.access !== "free" && entry.access !== "paid") ||
      !identifierPattern.test(String(entry.productCode)) ||
      typeof entry.subscriptionAllowed !== "boolean" ||
      (entry.access === "free" && entry.subscriptionAllowed)
    ) {
      throw new TypeError("Country policy version is invalid.");
    }
    return Object.freeze({
      access: entry.access,
      productCode: String(entry.productCode),
      subscriptionAllowed: entry.subscriptionAllowed,
    });
  });
  const codes = parsed.map(({ productCode }) => productCode);
  if (
    new Set(codes).size !== codes.length ||
    [...codes].sort().some((entry, index) => entry !== codes.at(index))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  return Object.freeze(parsed);
};

const parseFiat = (value: unknown): CountryPolicyFiatV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["currencies", "enabled", "methods", "providerRoutes", "recurringAllowed"]) ||
    typeof value.enabled !== "boolean" ||
    typeof value.recurringAllowed !== "boolean"
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  const currencies = parseStringArray(value.currencies, currencyCodePattern, 32);
  const providerRoutes = parseStringArray(value.providerRoutes, identifierPattern, 16);
  const methods = parseStringArray(value.methods, /^(?:card|hosted_wallet)$/u, 2) as readonly (
    "card" | "hosted_wallet"
  )[];
  if (
    (value.enabled &&
      (currencies.length === 0 || providerRoutes.length === 0 || methods.length === 0)) ||
    (!value.enabled &&
      (currencies.length > 0 ||
        providerRoutes.length > 0 ||
        methods.length > 0 ||
        value.recurringAllowed))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  return Object.freeze({
    currencies,
    enabled: value.enabled,
    methods,
    providerRoutes,
    recurringAllowed: value.recurringAllowed,
  });
};

const parseCrypto = (value: unknown): CountryPolicyCryptoV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["assets", "enabled", "providerRoute"]) ||
    typeof value.enabled !== "boolean" ||
    (value.providerRoute !== null && !identifierPattern.test(String(value.providerRoute)))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  const assets = parseStringArray(value.assets, cryptoAssetPattern, 16);
  if (
    (value.enabled && (assets.length === 0 || value.providerRoute === null)) ||
    (!value.enabled && (assets.length > 0 || value.providerRoute !== null))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }
  return Object.freeze({
    assets,
    enabled: value.enabled,
    providerRoute: value.providerRoute === null ? null : String(value.providerRoute),
  });
};

export const parseCountryPolicyVersionV1 = (value: unknown): CountryPolicyVersionV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "approvalMode",
      "countryCode",
      "crypto",
      "dataFlags",
      "effectiveFrom",
      "effectiveUntil",
      "environment",
      "evidence",
      "fiat",
      "legalDocumentVersions",
      "localeTags",
      "marketingFlags",
      "minimumAge",
      "modalities",
      "nextReviewAt",
      "prohibitedClaims",
      "products",
      "refundPolicyVersion",
      "requiredDisclosures",
      "schemaVersion",
      "status",
      "supersedesVersion",
      "supportAvailable",
      "taxMode",
      "version",
    ]) ||
    value.schemaVersion !== countryPolicyVersionSchemaVersion ||
    (value.approvalMode !== "local_test" && value.approvalMode !== "written") ||
    !["local", "preview", "staging", "production"].includes(String(value.environment)) ||
    !validCountryCode(value.countryCode) ||
    !countryPolicyVersionStatuses.includes(value.status as CountryPolicyVersionStatus) ||
    !Number.isSafeInteger(value.minimumAge) ||
    Number(value.minimumAge) < 18 ||
    Number(value.minimumAge) > 120 ||
    typeof value.supportAvailable !== "boolean" ||
    !["merchant", "merchant_of_record", "not_applicable"].includes(String(value.taxMode)) ||
    !versionPattern.test(String(value.version)) ||
    (value.supersedesVersion !== null &&
      (!versionPattern.test(String(value.supersedesVersion)) ||
        value.supersedesVersion === value.version)) ||
    !versionPattern.test(String(value.refundPolicyVersion)) ||
    typeof value.effectiveFrom !== "string" ||
    !validInstant(value.effectiveFrom) ||
    typeof value.nextReviewAt !== "string" ||
    !validInstant(value.nextReviewAt) ||
    Date.parse(value.nextReviewAt) <= Date.parse(value.effectiveFrom) ||
    (value.effectiveUntil !== null &&
      (typeof value.effectiveUntil !== "string" ||
        !validInstant(value.effectiveUntil) ||
        Date.parse(value.effectiveUntil) <= Date.parse(value.effectiveFrom) ||
        Date.parse(value.nextReviewAt) > Date.parse(value.effectiveUntil)))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }

  const evidence = parseEvidence(value.evidence);
  const fiat = parseFiat(value.fiat);
  const crypto = parseCrypto(value.crypto);
  const modalities = parseStringArray(value.modalities, identifierPattern, 32);
  const prohibitedClaims = parseStringArray(value.prohibitedClaims, identifierPattern, 64);
  const requiredDisclosures = parseStringArray(value.requiredDisclosures, identifierPattern, 64);
  const dataFlags = parseStringArray(value.dataFlags, identifierPattern, 64);
  const localeTags = parseStringArray(value.localeTags, localePattern, 64);
  const marketingFlags = parseStringArray(value.marketingFlags, identifierPattern, 64);
  const legalDocumentVersions = parseLegalDocuments(value.legalDocumentVersions);
  const products = parseProducts(value.products);
  const hasTestEvidence = Object.values(evidence).some((reference) =>
    reference?.startsWith("test:"),
  );
  const paidProducts = products.some(({ access }) => access === "paid");

  if (
    modalities.length === 0 ||
    requiredDisclosures.length === 0 ||
    localeTags.length === 0 ||
    (value.approvalMode === "local_test" &&
      (value.environment !== "local" ||
        Object.values(evidence).some(
          (reference) => reference !== null && !reference.startsWith("test:"),
        ))) ||
    (value.approvalMode === "written" && hasTestEvidence) ||
    (value.status !== "paid" && (fiat.enabled || crypto.enabled || paidProducts)) ||
    (value.status === "disabled" && products.length > 0) ||
    (crypto.enabled && evidence.cryptoApprovalReference === null) ||
    (!crypto.enabled && evidence.cryptoApprovalReference !== null) ||
    (fiat.enabled && evidence.fiatApprovalReference === null) ||
    (!fiat.enabled && evidence.fiatApprovalReference !== null) ||
    (crypto.enabled &&
      value.environment !== "local" &&
      !evidence.cryptoApprovalReference?.startsWith("OWN-006:")) ||
    (fiat.enabled &&
      value.environment !== "local" &&
      !evidence.fiatApprovalReference?.startsWith("OWN-002:") &&
      !(
        value.environment === "staging" &&
        evidence.fiatApprovalReference?.startsWith("D-098:OWN-017:stripe-test:")
      ))
  ) {
    throw new TypeError("Country policy version is invalid.");
  }

  return Object.freeze({
    approvalMode: value.approvalMode,
    countryCode: value.countryCode,
    crypto,
    dataFlags,
    effectiveFrom: value.effectiveFrom,
    effectiveUntil: value.effectiveUntil as string | null,
    environment: value.environment as CountryPolicyVersionV1["environment"],
    evidence,
    fiat,
    legalDocumentVersions,
    localeTags,
    marketingFlags,
    minimumAge: Number(value.minimumAge),
    modalities,
    nextReviewAt: value.nextReviewAt,
    prohibitedClaims,
    products,
    refundPolicyVersion: String(value.refundPolicyVersion),
    requiredDisclosures,
    schemaVersion: countryPolicyVersionSchemaVersion,
    status: value.status as CountryPolicyVersionStatus,
    supersedesVersion: value.supersedesVersion === null ? null : String(value.supersedesVersion),
    supportAvailable: value.supportAvailable,
    taxMode: value.taxMode as CountryPolicyVersionV1["taxMode"],
    version: String(value.version),
  });
};

const deny = (reason: Exclude<CountryPolicyDecisionReasonV2, "allowed">): CountryPolicyDecisionV2 =>
  Object.freeze({ allowed: false, reason, snapshot: null });

const validCountryEvidence = (value: CountryPolicyCountryEvidenceV1): boolean =>
  isRecord(value) &&
  exactKeys(value, [
    "billingCountryCode",
    "declaredCountryCode",
    "geolocationConfidence",
    "geolocationCountryCode",
    "localeCountryCode",
  ]) &&
  [value.billingCountryCode, value.declaredCountryCode, value.geolocationCountryCode].every(
    (entry) => entry === null || validCountryCode(entry),
  ) &&
  (value.localeCountryCode === null || validCountryCode(value.localeCountryCode)) &&
  ["none", "low", "reliable"].includes(value.geolocationConfidence) &&
  ((value.geolocationConfidence === "none" && value.geolocationCountryCode === null) ||
    (value.geolocationConfidence !== "none" && value.geolocationCountryCode !== null));

const resolveCountry = (
  evidence: CountryPolicyCountryEvidenceV1,
):
  | Readonly<{
      countryCode: string;
      source: "billing" | "declared" | "geolocation";
    }>
  | "conflict"
  | "insufficient" => {
  const authoritative = [evidence.billingCountryCode, evidence.declaredCountryCode].filter(
    (entry): entry is string => entry !== null,
  );
  if (new Set(authoritative).size > 1) return "conflict";
  const reliableGeo =
    evidence.geolocationConfidence === "reliable" ? evidence.geolocationCountryCode : null;
  if (authoritative.length > 0 && reliableGeo !== null && authoritative.at(0) !== reliableGeo) {
    return "conflict";
  }
  if (evidence.billingCountryCode !== null) {
    return Object.freeze({ countryCode: evidence.billingCountryCode, source: "billing" });
  }
  if (evidence.declaredCountryCode !== null) {
    return Object.freeze({ countryCode: evidence.declaredCountryCode, source: "declared" });
  }
  if (reliableGeo !== null) {
    return Object.freeze({ countryCode: reliableGeo, source: "geolocation" });
  }
  return "insufficient";
};

const validInput = (input: CountryPolicyEvaluationInputV2): boolean => {
  if (
    !isRecord(input) ||
    !exactKeys(input, [
      "ageAttested",
      "asOf",
      "countryEvidence",
      "environment",
      "modality",
      "payment",
      "productCode",
    ]) ||
    typeof input.ageAttested !== "boolean" ||
    !validInstant(input.asOf) ||
    !["local", "preview", "staging", "production"].includes(input.environment) ||
    !identifierPattern.test(input.modality) ||
    (input.productCode !== null && !identifierPattern.test(input.productCode)) ||
    !validCountryEvidence(input.countryEvidence)
  ) {
    return false;
  }
  if (input.payment === null) return true;
  return (
    isRecord(input.payment) &&
    exactKeys(input.payment, ["currencyCode", "kind", "method", "providerId", "recurring"]) &&
    (input.payment.kind === "fiat" || input.payment.kind === "crypto") &&
    (input.payment.kind === "fiat"
      ? currencyCodePattern.test(input.payment.currencyCode)
      : cryptoAssetPattern.test(input.payment.currencyCode)) &&
    (input.payment.method === null ||
      input.payment.method === "card" ||
      input.payment.method === "hosted_wallet") &&
    identifierPattern.test(input.payment.providerId) &&
    typeof input.payment.recurring === "boolean" &&
    ((input.payment.kind === "fiat" && input.payment.method !== null) ||
      (input.payment.kind === "crypto" && input.payment.method === null))
  );
};

export const evaluateCountryPolicyVersion = (
  input: CountryPolicyEvaluationInputV2,
  versions: readonly CountryPolicyVersionV1[],
): CountryPolicyDecisionV2 => {
  if (!validInput(input)) return deny("invalid_input");
  const country = resolveCountry(input.countryEvidence);
  if (country === "conflict") return deny("country_evidence_conflict");
  if (country === "insufficient") return deny("country_evidence_insufficient");

  let parsed: readonly CountryPolicyVersionV1[];
  try {
    parsed = versions.map((version) => parseCountryPolicyVersionV1(version));
  } catch {
    return deny("policy_not_approved");
  }
  const countryVersions = parsed.filter(
    (version) =>
      version.environment === input.environment && version.countryCode === country.countryCode,
  );
  if (countryVersions.length === 0) return deny("no_country_policy");
  const activeCandidates = countryVersions.filter(
    (version) =>
      Date.parse(version.effectiveFrom) <= Date.parse(input.asOf) &&
      (version.effectiveUntil === null ||
        Date.parse(input.asOf) < Date.parse(version.effectiveUntil)),
  );
  if (activeCandidates.length === 0) {
    return deny(
      countryVersions.some((version) => Date.parse(version.effectiveFrom) <= Date.parse(input.asOf))
        ? "policy_expired"
        : "policy_inactive",
    );
  }
  const superseded = new Set(
    activeCandidates.flatMap(({ supersedesVersion }) =>
      supersedesVersion === null ? [] : [supersedesVersion],
    ),
  );
  const activeHeads = activeCandidates.filter(({ version }) => !superseded.has(version));
  if (activeHeads.length !== 1) return deny("ambiguous_policy");
  const policy = activeHeads.at(0);
  if (policy === undefined) return deny("policy_not_approved");
  const reachable = new Set<string>();
  let cursor: CountryPolicyVersionV1 | undefined = policy;
  while (cursor !== undefined && !reachable.has(cursor.version)) {
    reachable.add(cursor.version);
    cursor =
      cursor.supersedesVersion === null
        ? undefined
        : activeCandidates.find(({ version }) => version === cursor?.supersedesVersion);
  }
  if (cursor !== undefined || activeCandidates.some(({ version }) => !reachable.has(version))) {
    return deny("ambiguous_policy");
  }
  if (policy.status === "disabled") return deny("policy_disabled");
  if (Date.parse(input.asOf) >= Date.parse(policy.nextReviewAt)) {
    return deny("policy_review_overdue");
  }
  if (
    (policy.approvalMode === "local_test" && input.environment !== "local") ||
    (input.environment !== "local" &&
      Object.values(policy.evidence).some((reference) => reference?.startsWith("test:")))
  ) {
    return deny("test_evidence_forbidden");
  }
  if (!policy.modalities.includes(input.modality)) return deny("modality_not_approved");
  if (!input.ageAttested) return deny("age_requirement_not_met");

  const product =
    input.productCode === null
      ? null
      : policy.products.find(({ productCode }) => productCode === input.productCode);
  if (input.productCode !== null && product === undefined) return deny("product_not_approved");
  if (product?.access === "free" && policy.status === "content_only") {
    return deny("service_not_approved");
  }
  if (product?.access === "paid" && policy.status !== "paid") {
    return deny("payment_not_approved");
  }
  if (input.payment !== null) {
    if (product === null || product === undefined || product.access !== "paid") {
      return deny("payment_not_approved");
    }
    if (input.payment.recurring && !product.subscriptionAllowed) {
      return deny("recurring_not_approved");
    }
    if (input.payment.kind === "fiat") {
      if (!policy.fiat.enabled) return deny("payment_not_approved");
      if (!policy.fiat.providerRoutes.includes(input.payment.providerId)) {
        return deny("provider_not_approved");
      }
      if (input.payment.method === null || !policy.fiat.methods.includes(input.payment.method)) {
        return deny("method_not_approved");
      }
      if (!policy.fiat.currencies.includes(input.payment.currencyCode)) {
        return deny("currency_not_approved");
      }
      if (input.payment.recurring && !policy.fiat.recurringAllowed) {
        return deny("recurring_not_approved");
      }
    } else {
      if (!policy.crypto.enabled) return deny("crypto_not_approved");
      if (policy.crypto.providerRoute !== input.payment.providerId) {
        return deny("provider_not_approved");
      }
      if (!policy.crypto.assets.includes(input.payment.currencyCode)) {
        return deny("currency_not_approved");
      }
      if (input.payment.recurring) return deny("recurring_not_approved");
    }
  }

  return Object.freeze({
    allowed: true,
    reason: "allowed",
    snapshot: Object.freeze({
      countryEvidenceSource: country.source,
      evaluatedAt: input.asOf,
      legalDocumentVersions: policy.legalDocumentVersions,
      payment: input.payment === null ? null : Object.freeze({ ...input.payment }),
      policyVersion: policy.version,
      productCode: input.productCode,
      requiredDisclosures: policy.requiredDisclosures,
      schemaVersion: countryPolicySnapshotSchemaVersion,
      selectedCountryCode: country.countryCode,
    }),
  });
};

export const compareCountryPolicyVersions = (
  input: CountryPolicyEvaluationInputV2,
  current: readonly CountryPolicyVersionV1[],
  proposed: readonly CountryPolicyVersionV1[],
): CountryPolicyDryRunComparisonV1 => {
  const currentDecision = evaluateCountryPolicyVersion(input, current);
  const proposedDecision = evaluateCountryPolicyVersion(input, proposed);
  return Object.freeze({
    changed: JSON.stringify(currentDecision) !== JSON.stringify(proposedDecision),
    current: currentDecision,
    proposed: proposedDecision,
    schemaVersion: "country-policy-dry-run.v1",
  });
};
