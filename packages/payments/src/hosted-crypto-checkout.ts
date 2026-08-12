import { CommerceError } from "./errors.js";
import { createMoney, type Money } from "./money.js";
import { parseIdentifier, parseInstant, parseMinorAmount, parseResourceId } from "./validation.js";
import type { RawWebhookRequest } from "./webhook.js";

export const hostedCryptoAssetCodes = Object.freeze(["USDC"] as const);
export type HostedCryptoAssetCode = (typeof hostedCryptoAssetCodes)[number];

export const hostedCryptoNetworkCodes = Object.freeze(["base"] as const);
export type HostedCryptoNetworkCode = (typeof hostedCryptoNetworkCodes)[number];

export const hostedCryptoSettlementStatuses = Object.freeze([
  "pending",
  "confirmed",
  "failed",
  "expired",
  "refunded",
] as const);
export type HostedCryptoSettlementStatus = (typeof hostedCryptoSettlementStatuses)[number];

export type HostedCryptoSettlement = Readonly<{
  amountDecimal: string;
  assetCode: HostedCryptoAssetCode;
  networkCode: HostedCryptoNetworkCode;
}>;

export type HostedCryptoSettlementQuote = Readonly<{
  assetCode: HostedCryptoAssetCode;
  networkCode: HostedCryptoNetworkCode;
  usdAmount: Money;
  usdcAmountDecimal: string;
}>;

export type CreateHostedCryptoCheckoutInput = Readonly<{
  accountId: string;
  amount: Money;
  billingInterval?: "month" | "one_time" | "year";
  cancelUrl: string;
  countryCode: string;
  idempotencyKey: string;
  orderId: string;
  productCode: string;
  productName: string;
  providerId: string;
  returnUrl: string;
}>;

export type HostedCryptoCheckout = Readonly<{
  checkoutId: string;
  expiresAt: string;
  providerId: string;
  settlementQuote: HostedCryptoSettlementQuote;
  url: string;
}>;

export type ReconcileHostedCryptoCheckoutInput = Readonly<{
  checkoutId: string;
  orderId: string;
  providerId: string;
}>;

export type HostedCryptoWebhookEventV1 = Readonly<{
  eventId: string;
  occurredAt: string;
  orderId: string;
  providerCheckoutSessionId: string;
  providerId: string;
  providerObjectId: string;
  settlement: HostedCryptoSettlement;
  status: HostedCryptoSettlementStatus;
}>;

export type HostedCryptoReconciliationResultV1 = Readonly<{
  checkedAt: string;
  orderId: string;
  providerCheckoutSessionId: string;
  providerId: string;
  providerObjectId: string;
  settlement: HostedCryptoSettlement;
  status: HostedCryptoSettlementStatus;
}>;

export interface HostedCryptoCheckoutAdapter {
  readonly providerId: string;
  createCheckout(input: CreateHostedCryptoCheckoutInput): Promise<HostedCryptoCheckout>;
  reconcileCheckout(
    input: ReconcileHostedCryptoCheckoutInput,
  ): Promise<HostedCryptoReconciliationResultV1>;
  verifyWebhook(request: RawWebhookRequest): Promise<HostedCryptoWebhookEventV1>;
}

const usdcAmountDecimalPattern = /^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/u;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length && actual.every((key, index) => key === expected.at(index))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseAbsoluteUrl = (value: string): URL => {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.hash !== ""
    ) {
      throw new CommerceError("COMMERCE_INPUT_INVALID");
    }
    return parsed;
  } catch {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
};

const normalizeUsdcAmountDecimal = (value: string): string => {
  if (!usdcAmountDecimalPattern.test(value)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const [wholeCandidate, fraction = ""] = value.split(".");
  if (wholeCandidate === undefined) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const whole = wholeCandidate;
  const normalizedFraction = fraction.replace(/0+$/u, "");
  return normalizedFraction.length === 0 ? whole : `${whole}.${normalizedFraction}`;
};

const parseHostedCryptoAssetCode = (value: unknown): HostedCryptoAssetCode => {
  if (!hostedCryptoAssetCodes.includes(value as HostedCryptoAssetCode)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return value as HostedCryptoAssetCode;
};

const parseHostedCryptoNetworkCode = (value: unknown): HostedCryptoNetworkCode => {
  if (!hostedCryptoNetworkCodes.includes(value as HostedCryptoNetworkCode)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return value as HostedCryptoNetworkCode;
};

export const formatUsdMinorAsUsdcAmountDecimal = (amountMinor: number): string => {
  const parsedMinor = parseMinorAmount(amountMinor, false);
  const whole = Math.floor(parsedMinor / 100);
  const fraction = String(parsedMinor % 100).padStart(2, "0");
  return normalizeUsdcAmountDecimal(`${whole}.${fraction}`);
};

export const parseHostedCryptoSettlement = (value: unknown): HostedCryptoSettlement => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["amountDecimal", "assetCode", "networkCode"]) ||
    typeof value.amountDecimal !== "string"
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    amountDecimal: normalizeUsdcAmountDecimal(value.amountDecimal),
    assetCode: parseHostedCryptoAssetCode(value.assetCode),
    networkCode: parseHostedCryptoNetworkCode(value.networkCode),
  });
};

export const createHostedCryptoSettlementQuote = (amount: Money): HostedCryptoSettlementQuote => {
  if (amount.currencyCode !== "USD") {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const usdAmount = createMoney(parseMinorAmount(amount.amountMinor, false), "USD");
  return Object.freeze({
    assetCode: "USDC",
    networkCode: "base",
    usdAmount,
    usdcAmountDecimal: formatUsdMinorAsUsdcAmountDecimal(usdAmount.amountMinor),
  });
};

export const parseHostedCryptoSettlementQuote = (value: unknown): HostedCryptoSettlementQuote => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["assetCode", "networkCode", "usdAmount", "usdcAmountDecimal"]) ||
    !isRecord(value.usdAmount) ||
    !exactKeys(value.usdAmount, ["amountMinor", "currencyCode"]) ||
    typeof value.usdcAmountDecimal !== "string"
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const expected = createHostedCryptoSettlementQuote(
    createMoney(value.usdAmount.amountMinor, value.usdAmount.currencyCode),
  );
  if (
    parseHostedCryptoAssetCode(value.assetCode) !== expected.assetCode ||
    parseHostedCryptoNetworkCode(value.networkCode) !== expected.networkCode ||
    normalizeUsdcAmountDecimal(value.usdcAmountDecimal) !== expected.usdcAmountDecimal
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return expected;
};

export const hostedCryptoSettlementMatchesQuote = (
  settlement: HostedCryptoSettlement,
  quote: HostedCryptoSettlementQuote,
): boolean =>
  settlement.assetCode === quote.assetCode &&
  settlement.networkCode === quote.networkCode &&
  settlement.amountDecimal === quote.usdcAmountDecimal;

export const validateCreateHostedCryptoCheckoutInput = (
  input: CreateHostedCryptoCheckoutInput,
): Readonly<{ cancelUrl: URL; returnUrl: URL; settlementQuote: HostedCryptoSettlementQuote }> => {
  parseResourceId(input.accountId);
  parseResourceId(input.orderId);
  parseResourceId(input.idempotencyKey);
  parseIdentifier(input.productCode);
  parseIdentifier(input.providerId);
  if (
    !/^[A-Z]{2}$/u.test(input.countryCode) ||
    (input.billingInterval !== undefined && input.billingInterval !== "one_time") ||
    input.productName.length === 0 ||
    input.productName.length > 120 ||
    /[\r\n]/u.test(input.productName)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    cancelUrl: parseAbsoluteUrl(input.cancelUrl),
    returnUrl: parseAbsoluteUrl(input.returnUrl),
    settlementQuote: createHostedCryptoSettlementQuote(input.amount),
  });
};

export const validateHostedCryptoCheckout = (
  value: HostedCryptoCheckout,
  expectedProviderId: string,
): HostedCryptoCheckout => {
  const parsed = parseAbsoluteUrl(value.url);
  if (value.providerId !== expectedProviderId || parsed.protocol !== "https:") {
    throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
  }
  return Object.freeze({
    checkoutId: parseResourceId(value.checkoutId),
    expiresAt: parseInstant(value.expiresAt),
    providerId: parseIdentifier(value.providerId),
    settlementQuote: parseHostedCryptoSettlementQuote(value.settlementQuote),
    url: parsed.toString(),
  });
};

export const validateHostedCryptoReconciliationInput = (
  value: ReconcileHostedCryptoCheckoutInput,
): ReconcileHostedCryptoCheckoutInput =>
  Object.freeze({
    checkoutId: parseResourceId(value.checkoutId),
    orderId: parseResourceId(value.orderId),
    providerId: parseIdentifier(value.providerId),
  });

export const parseHostedCryptoWebhookEventV1 = (value: unknown): HostedCryptoWebhookEventV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "eventId",
      "occurredAt",
      "orderId",
      "providerCheckoutSessionId",
      "providerId",
      "providerObjectId",
      "settlement",
      "status",
    ]) ||
    !hostedCryptoSettlementStatuses.includes(value.status as HostedCryptoSettlementStatus)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    eventId: parseResourceId(value.eventId),
    occurredAt: parseInstant(value.occurredAt),
    orderId: parseResourceId(value.orderId),
    providerCheckoutSessionId: parseResourceId(value.providerCheckoutSessionId),
    providerId: parseIdentifier(value.providerId),
    providerObjectId: parseResourceId(value.providerObjectId),
    settlement: parseHostedCryptoSettlement(value.settlement),
    status: value.status as HostedCryptoSettlementStatus,
  });
};

export const parseHostedCryptoReconciliationResultV1 = (
  value: unknown,
): HostedCryptoReconciliationResultV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "checkedAt",
      "orderId",
      "providerCheckoutSessionId",
      "providerId",
      "providerObjectId",
      "settlement",
      "status",
    ]) ||
    !hostedCryptoSettlementStatuses.includes(value.status as HostedCryptoSettlementStatus)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    checkedAt: parseInstant(value.checkedAt),
    orderId: parseResourceId(value.orderId),
    providerCheckoutSessionId: parseResourceId(value.providerCheckoutSessionId),
    providerId: parseIdentifier(value.providerId),
    providerObjectId: parseResourceId(value.providerObjectId),
    settlement: parseHostedCryptoSettlement(value.settlement),
    status: value.status as HostedCryptoSettlementStatus,
  });
};
