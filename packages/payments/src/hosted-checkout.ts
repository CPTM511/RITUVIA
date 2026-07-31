import { CommerceError } from "./errors.js";
import { createMoney, type Money } from "./money.js";
import type { NormalizedPaymentEventV1 } from "./order.js";
import { parseIdentifier, parseInstant, parseResourceId } from "./validation.js";
import type { RawWebhookRequest } from "./webhook.js";

export type CreateHostedCheckoutInput = Readonly<{
  accountId: string;
  amount: Money;
  cancelUrl: string;
  countryCode: string;
  idempotencyKey: string;
  orderId: string;
  productCode: string;
  productName: string;
  providerId: string;
  returnUrl: string;
}>;

export type HostedCheckout = Readonly<{
  checkoutId: string;
  expiresAt: string;
  providerId: string;
  url: string;
}>;

export const subscriptionIntervals = Object.freeze(["month", "year"] as const);
export type SubscriptionInterval = (typeof subscriptionIntervals)[number];

export type CreateSubscriptionCheckoutInput = Readonly<{
  accountId: string;
  amount: Money;
  cancelUrl: string;
  countryCode: string;
  idempotencyKey: string;
  mode: "subscription";
  orderId: string;
  productCode: string;
  productName: string;
  providerId: string;
  returnUrl: string;
  subscriptionInterval: SubscriptionInterval;
}>;

export const normalizedSubscriptionEventTypes = Object.freeze([
  "subscription_checkout_completed",
  "subscription_created",
  "subscription_period_paid",
  "subscription_payment_failed",
  "subscription_changed",
  "subscription_canceled",
  "subscription_refunded",
  "subscription_disputed",
] as const);
export type NormalizedSubscriptionEventType = (typeof normalizedSubscriptionEventTypes)[number];

export type NormalizedSubscriptionEventV1 = Readonly<{
  amount: Money | null;
  cancelAtPeriodEnd: boolean;
  eventId: string;
  occurredAt: string;
  orderId: string;
  productCode: string;
  providerChargeId: string | null;
  providerCustomerId: string;
  providerId: string;
  providerInvoiceId: string | null;
  providerObjectId: string;
  providerSubscriptionId: string;
  subscriptionInterval: SubscriptionInterval;
  subscriptionPeriodEnd: string;
  subscriptionPeriodStart: string;
  type: NormalizedSubscriptionEventType;
}>;

export interface HostedCheckoutAdapter {
  readonly providerId: string;
  createCheckout(input: CreateHostedCheckoutInput): Promise<HostedCheckout>;
  verifyWebhook(request: RawWebhookRequest): Promise<NormalizedPaymentEventV1>;
}

export interface SubscriptionHostedCheckoutAdapter {
  readonly providerId: string;
  createSubscriptionCheckout(input: CreateSubscriptionCheckoutInput): Promise<HostedCheckout>;
  verifySubscriptionWebhook(request: RawWebhookRequest): Promise<NormalizedSubscriptionEventV1>;
}

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

export const validateCreateHostedCheckoutInput = (
  input: CreateHostedCheckoutInput,
): Readonly<{ cancelUrl: URL; returnUrl: URL }> => {
  parseResourceId(input.accountId);
  parseResourceId(input.orderId);
  parseResourceId(input.idempotencyKey);
  parseIdentifier(input.productCode);
  parseIdentifier(input.providerId);
  if (
    input.amount.amountMinor < 1 ||
    !Number.isSafeInteger(input.amount.amountMinor) ||
    !/^[A-Z]{3}$/u.test(input.amount.currencyCode) ||
    !/^[A-Z]{2}$/u.test(input.countryCode) ||
    input.productName.length === 0 ||
    input.productName.length > 120 ||
    /[\r\n]/u.test(input.productName)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    cancelUrl: parseAbsoluteUrl(input.cancelUrl),
    returnUrl: parseAbsoluteUrl(input.returnUrl),
  });
};

export const validateCreateSubscriptionCheckoutInput = (
  input: CreateSubscriptionCheckoutInput,
): Readonly<{ cancelUrl: URL; returnUrl: URL }> => {
  if (
    input.mode !== "subscription" ||
    !subscriptionIntervals.includes(input.subscriptionInterval)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return validateCreateHostedCheckoutInput(input);
};

export const validateHostedCheckout = (
  value: HostedCheckout,
  expectedProviderId: string,
): HostedCheckout => {
  const parsed = parseAbsoluteUrl(value.url);
  if (value.providerId !== expectedProviderId || parsed.protocol !== "https:") {
    throw new CommerceError("CHECKOUT_PROVIDER_FAILURE");
  }
  return Object.freeze({
    checkoutId: parseResourceId(value.checkoutId),
    expiresAt: parseInstant(value.expiresAt),
    providerId: parseIdentifier(value.providerId),
    url: parsed.toString(),
  });
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected.at(index))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseNullableResourceId = (value: unknown): string | null =>
  value === null ? null : parseResourceId(value);

export const parseNormalizedSubscriptionEventV1 = (
  value: unknown,
): NormalizedSubscriptionEventV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "amount",
      "cancelAtPeriodEnd",
      "eventId",
      "occurredAt",
      "orderId",
      "productCode",
      "providerChargeId",
      "providerCustomerId",
      "providerId",
      "providerInvoiceId",
      "providerObjectId",
      "providerSubscriptionId",
      "subscriptionInterval",
      "subscriptionPeriodEnd",
      "subscriptionPeriodStart",
      "type",
    ]) ||
    (value.amount !== null && !isRecord(value.amount)) ||
    !normalizedSubscriptionEventTypes.includes(value.type as never) ||
    !subscriptionIntervals.includes(value.subscriptionInterval as never) ||
    typeof value.cancelAtPeriodEnd !== "boolean"
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const amount =
    value.amount === null ? null : createMoney(value.amount.amountMinor, value.amount.currencyCode);
  const type = value.type as NormalizedSubscriptionEventType;
  const providerInvoiceId = parseNullableResourceId(value.providerInvoiceId);
  const providerChargeId = parseNullableResourceId(value.providerChargeId);
  if (
    (type === "subscription_period_paid" || type === "subscription_payment_failed") &&
    (amount === null || providerInvoiceId === null || providerChargeId !== null)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  if (
    type === "subscription_disputed" &&
    (amount === null || providerInvoiceId === null || providerChargeId === null)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  if (
    type === "subscription_refunded" &&
    (amount === null || providerInvoiceId === null || providerChargeId === null)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  if (
    (type === "subscription_created" ||
      type === "subscription_checkout_completed" ||
      type === "subscription_changed" ||
      type === "subscription_canceled") &&
    (amount !== null || providerInvoiceId !== null || providerChargeId !== null)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    amount,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd,
    eventId: parseResourceId(value.eventId),
    occurredAt: parseInstant(value.occurredAt),
    orderId: parseResourceId(value.orderId),
    productCode: parseIdentifier(value.productCode),
    providerChargeId,
    providerCustomerId: parseResourceId(value.providerCustomerId),
    providerId: parseIdentifier(value.providerId),
    providerInvoiceId,
    providerObjectId: parseResourceId(value.providerObjectId),
    providerSubscriptionId: parseResourceId(value.providerSubscriptionId),
    subscriptionInterval: value.subscriptionInterval as SubscriptionInterval,
    subscriptionPeriodEnd: parseInstant(value.subscriptionPeriodEnd),
    subscriptionPeriodStart: parseInstant(value.subscriptionPeriodStart),
    type,
  });
};
