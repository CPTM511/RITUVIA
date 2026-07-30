import { assertPurchasableProduct, type DigitalProductV1, type ProductPriceV1 } from "./catalog.js";
import { CommerceError } from "./errors.js";
import { createMoney, moneyEquals, type Money } from "./money.js";
import { parseIdentifier, parseInstant, parseResourceId } from "./validation.js";

export const orderStates = Object.freeze([
  "pending_checkout",
  "checkout_created",
  "processing",
  "payment_failed",
  "paid",
  "disputed",
  "refunded",
  "canceled",
] as const);
export type OrderState = (typeof orderStates)[number];

export const normalizedPaymentEventTypes = Object.freeze([
  "payment_pending",
  "payment_succeeded",
  "payment_failed",
  "payment_expired",
  "payment_refunded",
  "payment_disputed",
] as const);
export type NormalizedPaymentEventType = (typeof normalizedPaymentEventTypes)[number];

export type OrderPolicySnapshotV1 = Readonly<{
  countryCode: string;
  evaluatedAt: string;
  ruleVersion: string;
}>;

export type OrderV1 = Readonly<{
  accountId: string;
  amount: Money;
  checkoutId: string | null;
  countryPolicy: OrderPolicySnapshotV1;
  createdAt: string;
  entitlementCode: string;
  orderId: string;
  priceId: string;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerId: string;
  state: OrderState;
  updatedAt: string;
}>;

export type NormalizedPaymentEventV1 = Readonly<{
  amount: Money;
  eventId: string;
  occurredAt: string;
  orderId: string;
  providerCheckoutSessionId: string | null;
  providerId: string;
  providerObjectId: string;
  providerPaymentIntentId: string | null;
  type: NormalizedPaymentEventType;
}>;

export type EntitlementDirective = "grant" | "none" | "revoke";

export type PaymentEventApplication = Readonly<{
  disposition: "applied" | "duplicate" | "ignored_out_of_order" | "rejected_mismatch";
  entitlementDirective: EntitlementDirective;
  order: OrderV1;
  recordEvent: boolean;
}>;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length && actual.every((key, index) => key === expected.at(index))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseNullableResourceId = (value: unknown): string | null =>
  value === null ? null : parseResourceId(value);

export const parseNormalizedPaymentEventV1 = (value: unknown): NormalizedPaymentEventV1 => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "amount",
      "eventId",
      "occurredAt",
      "orderId",
      "providerCheckoutSessionId",
      "providerId",
      "providerObjectId",
      "providerPaymentIntentId",
      "type",
    ]) ||
    !isRecord(value.amount) ||
    !exactKeys(value.amount, ["amountMinor", "currencyCode"]) ||
    !normalizedPaymentEventTypes.includes(value.type as never)
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }

  return Object.freeze({
    amount: createMoney(value.amount.amountMinor, value.amount.currencyCode),
    eventId: parseResourceId(value.eventId),
    occurredAt: parseInstant(value.occurredAt),
    orderId: parseResourceId(value.orderId),
    providerCheckoutSessionId: parseNullableResourceId(value.providerCheckoutSessionId),
    providerId: parseIdentifier(value.providerId),
    providerObjectId: parseResourceId(value.providerObjectId),
    providerPaymentIntentId: parseNullableResourceId(value.providerPaymentIntentId),
    type: value.type as NormalizedPaymentEventType,
  });
};

const freezeOrder = (order: OrderV1): OrderV1 =>
  Object.freeze({
    ...order,
    amount: Object.freeze({ ...order.amount }),
    countryPolicy: Object.freeze({ ...order.countryPolicy }),
  });

export const createOrderV1 = (input: {
  accountId: string;
  asOf: string;
  countryPolicy: OrderPolicySnapshotV1;
  orderId: string;
  price: ProductPriceV1;
  product: DigitalProductV1;
  providerId: string;
}): OrderV1 => {
  const asOf = parseInstant(input.asOf);
  assertPurchasableProduct(input.product, input.price, asOf);
  if (
    input.countryPolicy.countryCode.length !== 2 ||
    !/^[A-Z]{2}$/u.test(input.countryPolicy.countryCode) ||
    parseInstant(input.countryPolicy.evaluatedAt) !== asOf
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }

  return freezeOrder({
    accountId: parseResourceId(input.accountId),
    amount: input.price.money,
    checkoutId: null,
    countryPolicy: Object.freeze({
      countryCode: input.countryPolicy.countryCode,
      evaluatedAt: asOf,
      ruleVersion: parseResourceId(input.countryPolicy.ruleVersion),
    }),
    createdAt: asOf,
    entitlementCode: input.product.entitlementCode,
    orderId: parseResourceId(input.orderId),
    priceId: input.price.priceId,
    priceVersion: input.price.version,
    productCode: input.product.code,
    productVersion: input.product.version,
    providerId: parseIdentifier(input.providerId),
    state: "pending_checkout",
    updatedAt: asOf,
  });
};

export const attachHostedCheckout = (
  order: OrderV1,
  input: { checkoutId: string; createdAt: string; providerId: string },
): OrderV1 => {
  if (
    order.state !== "pending_checkout" ||
    order.checkoutId !== null ||
    input.providerId !== order.providerId
  ) {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }
  const createdAt = parseInstant(input.createdAt);
  if (Date.parse(createdAt) < Date.parse(order.createdAt)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return freezeOrder({
    ...order,
    checkoutId: parseResourceId(input.checkoutId),
    state: "checkout_created",
    updatedAt: createdAt,
  });
};

export const cancelOrder = (order: OrderV1, canceledAt: string): OrderV1 => {
  if (
    order.state !== "pending_checkout" &&
    order.state !== "checkout_created" &&
    order.state !== "payment_failed"
  ) {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }
  const updatedAt = parseInstant(canceledAt);
  if (Date.parse(updatedAt) < Date.parse(order.updatedAt)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return freezeOrder({ ...order, state: "canceled", updatedAt });
};

const transitionFor = (
  state: OrderState,
  eventType: NormalizedPaymentEventType,
): Readonly<{ directive: EntitlementDirective; state: OrderState }> | null => {
  switch (eventType) {
    case "payment_pending":
      return ["pending_checkout", "checkout_created", "payment_failed"].includes(state)
        ? { directive: "none", state: "processing" }
        : null;
    case "payment_succeeded":
      return [
        "pending_checkout",
        "checkout_created",
        "processing",
        "payment_failed",
        "canceled",
      ].includes(state)
        ? { directive: "grant", state: "paid" }
        : null;
    case "payment_failed":
      return ["pending_checkout", "checkout_created", "processing"].includes(state)
        ? { directive: "none", state: "payment_failed" }
        : null;
    case "payment_expired":
      return ["pending_checkout", "checkout_created", "processing", "payment_failed"].includes(
        state,
      )
        ? { directive: "none", state: "canceled" }
        : null;
    case "payment_refunded":
      return state === "refunded" ? null : { directive: "revoke", state: "refunded" };
    case "payment_disputed":
      return state === "refunded" || state === "disputed"
        ? null
        : { directive: "revoke", state: "disputed" };
  }
};

export const applyPaymentEvent = (input: {
  alreadyRecorded: boolean;
  event: NormalizedPaymentEventV1;
  order: OrderV1;
}): PaymentEventApplication => {
  if (input.alreadyRecorded) {
    return Object.freeze({
      disposition: "duplicate",
      entitlementDirective: "none",
      order: input.order,
      recordEvent: false,
    });
  }

  const event = parseNormalizedPaymentEventV1(input.event);
  if (
    event.orderId !== input.order.orderId ||
    event.providerId !== input.order.providerId ||
    !moneyEquals(event.amount, input.order.amount)
  ) {
    return Object.freeze({
      disposition: "rejected_mismatch",
      entitlementDirective: "none",
      order: input.order,
      recordEvent: false,
    });
  }
  const transition = transitionFor(input.order.state, event.type);
  if (transition === null) {
    return Object.freeze({
      disposition: "ignored_out_of_order",
      entitlementDirective: "none",
      order: input.order,
      recordEvent: true,
    });
  }

  return Object.freeze({
    disposition: "applied",
    entitlementDirective: transition.directive,
    order: freezeOrder({
      ...input.order,
      state: transition.state,
      updatedAt:
        Date.parse(event.occurredAt) > Date.parse(input.order.updatedAt)
          ? event.occurredAt
          : input.order.updatedAt,
    }),
    recordEvent: true,
  });
};
