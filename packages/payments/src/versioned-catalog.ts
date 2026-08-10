import { CommerceError } from "./errors.js";
import {
  maximumMinorAmount,
  parseCurrencyCode,
  parseIdentifier,
  parseInstant,
  parseResourceId,
} from "./validation.js";

export const catalogEnvironments = ["local", "preview", "staging", "production"] as const;
export const catalogProductKinds = [
  "credit_pack",
  "plus_plan",
  "deep_reading",
  "permanent_object",
  "free_object",
  "consumable_ritual",
] as const;
export const catalogPaymentProviders = ["stripe", "coinbase_usdc_base"] as const;

export type CatalogEnvironment = (typeof catalogEnvironments)[number];
export type CatalogProductKind = (typeof catalogProductKinds)[number];
export type CatalogPaymentProvider = (typeof catalogPaymentProviders)[number];

export type CatalogLocalizationV1 = Readonly<{
  description: string;
  exactContents: readonly string[];
  locale: string;
  title: string;
}>;

export type CatalogProductV1 = Readonly<{
  code: string;
  creditsCost: number | null;
  creditsGranted: number | null;
  creditsPerMonth: number | null;
  fulfillmentCode: string;
  kind: CatalogProductKind;
  localizations: readonly CatalogLocalizationV1[];
  status: "active" | "retired";
  subscriptionInterval: "month" | "year" | null;
  version: string;
}>;

export type CatalogPriceV1 = Readonly<{
  amountMinor: number;
  billingInterval: "one_time" | "month" | "year";
  countryCodes: readonly string[];
  currencyCode: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  priceId: string;
  productCode: string;
  productVersion: string;
  providerEligibility: readonly CatalogPaymentProvider[];
  refundPolicyVersion: string;
  status: "active" | "retired";
  taxCategory: string;
  version: string;
}>;

export type CatalogVersionV1 = Readonly<{
  approvalMode: "local_test" | "written";
  defaultLocale: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  environment: CatalogEnvironment;
  evidence: Readonly<{
    ownerReference: string;
    sourceChecksumSha256: string;
    sourceReference: string;
  }>;
  nextReviewAt: string;
  prices: readonly CatalogPriceV1[];
  products: readonly CatalogProductV1[];
  schemaVersion: "catalog-version.v1";
  status: "active" | "disabled" | "retired";
  supersedesVersion: string | null;
  supportedLocales: readonly string[];
  version: string;
}>;

const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const countryPattern = /^[A-Z]{2}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const sourceReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,299}$/u;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const fail = (): never => {
  throw new CommerceError("COMMERCE_INPUT_INVALID");
};
const requireExactRecord = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!isRecord(value) || !exactKeys(value, keys)) fail();
  return value as Record<string, unknown>;
};
const parseNullableInstant = (value: unknown): string | null =>
  value === null ? null : parseInstant(value);
const parseNullablePositiveInteger = (value: unknown): number | null => {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > maximumMinorAmount
  ) {
    fail();
  }
  return value as number;
};
const parseLocale = (value: unknown): string => {
  if (typeof value !== "string" || !localePattern.test(value) || value.length > 35) fail();
  return value as string;
};
const parseControlledText = (value: unknown, maximumLength: number): string => {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0 ||
    value.length > maximumLength
  ) {
    fail();
  }
  return value as string;
};
const parseUniqueValues = <T>(
  value: unknown,
  parse: (entry: unknown) => T,
  minimum: number,
  maximum: number,
): readonly T[] => {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail();
  const parsed = (value as unknown[]).map(parse);
  if (new Set(parsed).size !== parsed.length) fail();
  return Object.freeze(parsed);
};

const parseLocalization = (value: unknown): CatalogLocalizationV1 => {
  const record = requireExactRecord(value, ["description", "exactContents", "locale", "title"]);
  const exactContents = parseUniqueValues(
    record.exactContents,
    (entry) => parseControlledText(entry, 500),
    1,
    16,
  );
  return Object.freeze({
    description: parseControlledText(record.description, 1_000),
    exactContents,
    locale: parseLocale(record.locale),
    title: parseControlledText(record.title, 160),
  });
};

const parseProductKind = (value: unknown): CatalogProductKind => {
  if (!catalogProductKinds.includes(value as CatalogProductKind)) fail();
  return value as CatalogProductKind;
};

const parseProduct = (value: unknown, supportedLocales: readonly string[]): CatalogProductV1 => {
  const record = requireExactRecord(value, [
    "code",
    "creditsCost",
    "creditsGranted",
    "creditsPerMonth",
    "fulfillmentCode",
    "kind",
    "localizations",
    "status",
    "subscriptionInterval",
    "version",
  ]);
  if (
    (record.status !== "active" && record.status !== "retired") ||
    (record.subscriptionInterval !== null &&
      record.subscriptionInterval !== "month" &&
      record.subscriptionInterval !== "year")
  ) {
    fail();
  }
  const kind = parseProductKind(record.kind);
  const creditsCost = parseNullablePositiveInteger(record.creditsCost);
  const creditsGranted = parseNullablePositiveInteger(record.creditsGranted);
  const creditsPerMonth = parseNullablePositiveInteger(record.creditsPerMonth);
  const subscriptionInterval = record.subscriptionInterval as "month" | "year" | null;
  const validTerms =
    (kind === "credit_pack" &&
      creditsGranted !== null &&
      creditsCost === null &&
      creditsPerMonth === null &&
      subscriptionInterval === null) ||
    (kind === "plus_plan" &&
      creditsGranted === null &&
      creditsCost === null &&
      creditsPerMonth !== null &&
      subscriptionInterval !== null) ||
    ((kind === "deep_reading" || kind === "permanent_object" || kind === "consumable_ritual") &&
      creditsGranted === null &&
      creditsCost !== null &&
      creditsPerMonth === null &&
      subscriptionInterval === null) ||
    (kind === "free_object" &&
      creditsGranted === null &&
      creditsCost === null &&
      creditsPerMonth === null &&
      subscriptionInterval === null);
  if (!validTerms) fail();

  const localizations = parseUniqueValues(
    record.localizations,
    (entry) => parseLocalization(entry),
    supportedLocales.length,
    supportedLocales.length,
  );
  const localizationLocales = localizations.map(({ locale }) => locale);
  if (
    localizationLocales.length !== supportedLocales.length ||
    supportedLocales.some((locale) => !localizationLocales.includes(locale))
  ) {
    fail();
  }
  return Object.freeze({
    code: parseIdentifier(record.code),
    creditsCost,
    creditsGranted,
    creditsPerMonth,
    fulfillmentCode: parseIdentifier(record.fulfillmentCode),
    kind,
    localizations,
    status: record.status as CatalogProductV1["status"],
    subscriptionInterval,
    version: parseResourceId(record.version),
  });
};

const parseProvider = (value: unknown): CatalogPaymentProvider => {
  if (!catalogPaymentProviders.includes(value as CatalogPaymentProvider)) fail();
  return value as CatalogPaymentProvider;
};

const parsePrice = (value: unknown): CatalogPriceV1 => {
  const record = requireExactRecord(value, [
    "amountMinor",
    "billingInterval",
    "countryCodes",
    "currencyCode",
    "effectiveFrom",
    "effectiveUntil",
    "priceId",
    "productCode",
    "productVersion",
    "providerEligibility",
    "refundPolicyVersion",
    "status",
    "taxCategory",
    "version",
  ]);
  if (
    (record.status !== "active" && record.status !== "retired") ||
    !["one_time", "month", "year"].includes(record.billingInterval as string) ||
    typeof record.amountMinor !== "number" ||
    !Number.isSafeInteger(record.amountMinor) ||
    record.amountMinor < 1 ||
    record.amountMinor > maximumMinorAmount
  ) {
    fail();
  }
  const effectiveFrom = parseInstant(record.effectiveFrom);
  const effectiveUntil = parseNullableInstant(record.effectiveUntil);
  if (effectiveUntil !== null && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)) fail();
  return Object.freeze({
    amountMinor: record.amountMinor as number,
    billingInterval: record.billingInterval as CatalogPriceV1["billingInterval"],
    countryCodes: parseUniqueValues(
      record.countryCodes,
      (entry) => {
        if (typeof entry !== "string" || !countryPattern.test(entry)) fail();
        return entry as string;
      },
      1,
      249,
    ),
    currencyCode: parseCurrencyCode(record.currencyCode),
    effectiveFrom,
    effectiveUntil,
    priceId: parseResourceId(record.priceId),
    productCode: parseIdentifier(record.productCode),
    productVersion: parseResourceId(record.productVersion),
    providerEligibility: parseUniqueValues(record.providerEligibility, parseProvider, 1, 2),
    refundPolicyVersion: parseResourceId(record.refundPolicyVersion),
    status: record.status as CatalogPriceV1["status"],
    taxCategory: parseIdentifier(record.taxCategory),
    version: parseResourceId(record.version),
  });
};

const windowsOverlap = (
  left: Pick<CatalogPriceV1, "effectiveFrom" | "effectiveUntil">,
  right: Pick<CatalogPriceV1, "effectiveFrom" | "effectiveUntil">,
): boolean => {
  const leftEnd =
    left.effectiveUntil === null ? Number.POSITIVE_INFINITY : Date.parse(left.effectiveUntil);
  const rightEnd =
    right.effectiveUntil === null ? Number.POSITIVE_INFINITY : Date.parse(right.effectiveUntil);
  return Date.parse(left.effectiveFrom) < rightEnd && Date.parse(right.effectiveFrom) < leftEnd;
};

const assertCatalogRelations = (
  products: readonly CatalogProductV1[],
  prices: readonly CatalogPriceV1[],
): void => {
  const productKeys = new Set<string>();
  const productCodes = new Set<string>();
  for (const product of products) {
    const key = `${product.code}:${product.version}`;
    if (productKeys.has(key) || productCodes.has(product.code)) fail();
    productKeys.add(key);
    productCodes.add(product.code);
  }
  const priceKeys = new Set<string>();
  for (const price of prices) {
    const key = `${price.priceId}:${price.version}`;
    if (priceKeys.has(key)) fail();
    priceKeys.add(key);
    const product = products.find(
      (candidate) =>
        candidate.code === price.productCode && candidate.version === price.productVersion,
    );
    if (
      product === undefined ||
      (product.kind !== "credit_pack" && product.kind !== "plus_plan") ||
      (product.kind === "credit_pack" && price.billingInterval !== "one_time") ||
      (product.kind === "plus_plan" && price.billingInterval !== product.subscriptionInterval) ||
      (product.kind === "plus_plan" && price.providerEligibility.includes("coinbase_usdc_base"))
    ) {
      fail();
    }
  }
  for (let index = 0; index < prices.length; index += 1) {
    const left = prices.at(index);
    if (left === undefined || left.status !== "active") continue;
    for (let comparedIndex = index + 1; comparedIndex < prices.length; comparedIndex += 1) {
      const right = prices.at(comparedIndex);
      if (
        right !== undefined &&
        right.status === "active" &&
        left.productCode === right.productCode &&
        left.productVersion === right.productVersion &&
        left.currencyCode === right.currencyCode &&
        left.countryCodes.some((country) => right.countryCodes.includes(country)) &&
        windowsOverlap(left, right)
      ) {
        fail();
      }
    }
  }
  for (const product of products) {
    const hasActivePrice = prices.some(
      (price) =>
        price.status === "active" &&
        price.productCode === product.code &&
        price.productVersion === product.version,
    );
    if (
      product.status === "active" &&
      (product.kind === "credit_pack" || product.kind === "plus_plan") !== hasActivePrice
    ) {
      fail();
    }
  }
};

export const parseCatalogVersionV1 = (value: unknown): CatalogVersionV1 => {
  const record = requireExactRecord(value, [
    "approvalMode",
    "defaultLocale",
    "effectiveFrom",
    "effectiveUntil",
    "environment",
    "evidence",
    "nextReviewAt",
    "prices",
    "products",
    "schemaVersion",
    "status",
    "supersedesVersion",
    "supportedLocales",
    "version",
  ]);
  const evidence = requireExactRecord(record.evidence, [
    "ownerReference",
    "sourceChecksumSha256",
    "sourceReference",
  ]);
  if (
    record.schemaVersion !== "catalog-version.v1" ||
    !catalogEnvironments.includes(record.environment as CatalogEnvironment) ||
    !["active", "disabled", "retired"].includes(record.status as string) ||
    !["local_test", "written"].includes(record.approvalMode as string) ||
    (record.supersedesVersion !== null && typeof record.supersedesVersion !== "string")
  ) {
    fail();
  }
  const environment = record.environment as CatalogEnvironment;
  const approvalMode = record.approvalMode as CatalogVersionV1["approvalMode"];
  const effectiveFrom = parseInstant(record.effectiveFrom);
  const effectiveUntil = parseNullableInstant(record.effectiveUntil);
  const nextReviewAt = parseInstant(record.nextReviewAt);
  if (
    (effectiveUntil !== null && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)) ||
    Date.parse(nextReviewAt) <= Date.parse(effectiveFrom) ||
    (effectiveUntil !== null && Date.parse(nextReviewAt) > Date.parse(effectiveUntil)) ||
    (approvalMode === "local_test" && environment !== "local")
  ) {
    fail();
  }
  const ownerReference = parseResourceId(evidence.ownerReference);
  const sourceReferenceValue = evidence.sourceReference;
  const sourceChecksumValue = evidence.sourceChecksumSha256;
  if (
    typeof sourceReferenceValue !== "string" ||
    !sourceReferencePattern.test(sourceReferenceValue) ||
    typeof sourceChecksumValue !== "string" ||
    !digestPattern.test(sourceChecksumValue) ||
    (approvalMode === "local_test" && !ownerReference.startsWith("test:")) ||
    (approvalMode === "written" && ownerReference.startsWith("test:"))
  ) {
    fail();
  }
  const sourceReference = sourceReferenceValue as string;
  const sourceChecksumSha256 = sourceChecksumValue as string;
  const supportedLocales = parseUniqueValues(record.supportedLocales, parseLocale, 1, 32);
  const defaultLocale = parseLocale(record.defaultLocale);
  if (!supportedLocales.includes(defaultLocale)) fail();
  const products = parseUniqueValues(
    record.products,
    (entry) => parseProduct(entry, supportedLocales),
    1,
    256,
  );
  const prices = parseUniqueValues(record.prices, parsePrice, 1, 1_024);
  assertCatalogRelations(products, prices);
  const version = parseResourceId(record.version);
  const supersedesVersion =
    record.supersedesVersion === null ? null : parseResourceId(record.supersedesVersion);
  if (supersedesVersion === version) fail();
  return Object.freeze({
    approvalMode,
    defaultLocale,
    effectiveFrom,
    effectiveUntil,
    environment,
    evidence: Object.freeze({
      ownerReference,
      sourceChecksumSha256,
      sourceReference,
    }),
    nextReviewAt,
    prices,
    products,
    schemaVersion: "catalog-version.v1",
    status: record.status as CatalogVersionV1["status"],
    supersedesVersion,
    supportedLocales,
    version,
  });
};

export const selectActiveCatalogVersionV1 = (
  candidates: readonly CatalogVersionV1[],
  input: Readonly<{ asOf: string; environment: CatalogEnvironment }>,
): CatalogVersionV1 => {
  const evaluatedAt = Date.parse(parseInstant(input.asOf));
  const activeCandidates = candidates.filter(
    (candidate) =>
      candidate.environment === input.environment &&
      candidate.status === "active" &&
      evaluatedAt >= Date.parse(candidate.effectiveFrom) &&
      (candidate.effectiveUntil === null || evaluatedAt < Date.parse(candidate.effectiveUntil)) &&
      evaluatedAt < Date.parse(candidate.nextReviewAt),
  );
  if (
    activeCandidates.length === 0 ||
    new Set(activeCandidates.map(({ version }) => version)).size !== activeCandidates.length
  ) {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }
  const superseded = new Set(
    activeCandidates.flatMap(({ supersedesVersion }) =>
      supersedesVersion === null ? [] : [supersedesVersion],
    ),
  );
  const activeHeads = activeCandidates.filter(({ version }) => !superseded.has(version));
  if (activeHeads.length !== 1) throw new CommerceError("COMMERCE_STATE_CONFLICT");
  const selected = activeHeads[0];
  if (selected === undefined) throw new CommerceError("COMMERCE_STATE_CONFLICT");
  const reachable = new Set<string>();
  let cursor: CatalogVersionV1 | undefined = selected;
  while (cursor !== undefined && !reachable.has(cursor.version)) {
    reachable.add(cursor.version);
    cursor =
      cursor.supersedesVersion === null
        ? undefined
        : activeCandidates.find(({ version }) => version === cursor?.supersedesVersion);
  }
  if (cursor !== undefined || activeCandidates.some(({ version }) => !reachable.has(version))) {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }
  return selected;
};
