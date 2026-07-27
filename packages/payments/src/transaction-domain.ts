import { CommerceError } from "./errors.js";
import { parseIdentifier, parseInstant, parseResourceId } from "./validation.js";

export const commercialOrderStates = Object.freeze([
  "created",
  "checkout_created",
  "pending",
  "paid",
  "failed",
  "expired",
  "refund_requested",
  "partially_refunded",
  "refunded",
  "disputed",
  "cancelled",
] as const);
export type CommercialOrderState = (typeof commercialOrderStates)[number];

export const commercialPaymentAttemptStates = Object.freeze([
  "created",
  "checkout_created",
  "pending",
  "succeeded",
  "failed",
  "expired",
  "cancelled",
] as const);
export type CommercialPaymentAttemptState = (typeof commercialPaymentAttemptStates)[number];

export const commercialPaymentEvents = Object.freeze([
  "checkout_created",
  "payment_pending",
  "payment_succeeded",
  "payment_failed",
  "payment_expired",
  "payment_cancelled",
  "refund_requested",
  "payment_partially_refunded",
  "payment_refunded",
  "payment_disputed",
] as const);
export type CommercialPaymentEvent = (typeof commercialPaymentEvents)[number];

export type CommercialStateTransition<State> = Readonly<{
  disposition: "applied" | "duplicate" | "ignored_out_of_order";
  nextState: State;
}>;

const orderTransition = (
  state: CommercialOrderState,
  event: CommercialPaymentEvent,
): CommercialOrderState | null => {
  switch (event) {
    case "checkout_created":
      return state === "created" ? "checkout_created" : null;
    case "payment_pending":
      return state === "created" || state === "checkout_created" ? "pending" : null;
    case "payment_succeeded":
      return ["created", "checkout_created", "pending", "failed", "expired", "cancelled"].includes(
        state,
      )
        ? "paid"
        : null;
    case "payment_failed":
      return ["created", "checkout_created", "pending"].includes(state) ? "failed" : null;
    case "payment_expired":
      return ["created", "checkout_created", "pending"].includes(state) ? "expired" : null;
    case "payment_cancelled":
      return ["created", "checkout_created", "pending", "failed"].includes(state)
        ? "cancelled"
        : null;
    case "refund_requested":
      return state === "paid" || state === "partially_refunded" ? "refund_requested" : null;
    case "payment_partially_refunded":
      return ["paid", "refund_requested", "partially_refunded"].includes(state)
        ? "partially_refunded"
        : null;
    case "payment_refunded":
      return ["paid", "refund_requested", "partially_refunded", "disputed"].includes(state)
        ? "refunded"
        : null;
    case "payment_disputed":
      return ["paid", "refund_requested", "partially_refunded"].includes(state) ? "disputed" : null;
  }
};

const paymentAttemptTransition = (
  state: CommercialPaymentAttemptState,
  event: CommercialPaymentEvent,
): CommercialPaymentAttemptState | null => {
  switch (event) {
    case "checkout_created":
      return state === "created" ? "checkout_created" : null;
    case "payment_pending":
      return state === "created" || state === "checkout_created" ? "pending" : null;
    case "payment_succeeded":
      return ["created", "checkout_created", "pending", "failed", "expired", "cancelled"].includes(
        state,
      )
        ? "succeeded"
        : null;
    case "payment_failed":
      return ["created", "checkout_created", "pending"].includes(state) ? "failed" : null;
    case "payment_expired":
      return ["created", "checkout_created", "pending"].includes(state) ? "expired" : null;
    case "payment_cancelled":
      return ["created", "checkout_created", "pending", "failed"].includes(state)
        ? "cancelled"
        : null;
    case "payment_partially_refunded":
    case "payment_refunded":
    case "payment_disputed":
    case "refund_requested":
      return null;
  }
};

const applyTransition = <State extends string>(
  state: State,
  alreadyRecorded: boolean,
  resolve: () => State | null,
): CommercialStateTransition<State> => {
  if (alreadyRecorded) {
    return Object.freeze({ disposition: "duplicate", nextState: state });
  }
  const nextState = resolve();
  return Object.freeze(
    nextState === null
      ? { disposition: "ignored_out_of_order", nextState: state }
      : { disposition: "applied", nextState },
  );
};

export const transitionCommercialOrder = (input: {
  alreadyRecorded: boolean;
  event: CommercialPaymentEvent;
  state: CommercialOrderState;
}): CommercialStateTransition<CommercialOrderState> =>
  applyTransition(input.state, input.alreadyRecorded, () =>
    orderTransition(input.state, input.event),
  );

export const transitionCommercialPaymentAttempt = (input: {
  alreadyRecorded: boolean;
  event: CommercialPaymentEvent;
  state: CommercialPaymentAttemptState;
}): CommercialStateTransition<CommercialPaymentAttemptState> =>
  applyTransition(input.state, input.alreadyRecorded, () =>
    paymentAttemptTransition(input.state, input.event),
  );

export const creditTypes = Object.freeze([
  "subscription_credit",
  "promotional_credit",
  "purchased_credit",
  "refund_adjustment",
] as const);
export type CreditType = (typeof creditTypes)[number];

export const creditDirections = Object.freeze([
  "grant",
  "reserve",
  "release",
  "consume",
  "reverse",
  "expire",
] as const);
export type CreditDirection = (typeof creditDirections)[number];

export type CreditSource = Readonly<{
  available: number;
  createdAt: string;
  creditType: Exclude<CreditType, "refund_adjustment">;
  entryId: string;
  expiresAt: string | null;
}>;

export type CreditAllocation = Readonly<{
  amount: number;
  creditType: CreditSource["creditType"];
  sourceEntryId: string;
}>;

const requireCreditAmount = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return value;
};

const creditPriority = (creditType: CreditSource["creditType"]): number => {
  switch (creditType) {
    case "subscription_credit":
      return 0;
    case "promotional_credit":
      return 1;
    case "purchased_credit":
      return 2;
  }
};

export const allocateCreditSources = (input: {
  amount: number;
  asOf: string;
  sources: readonly CreditSource[];
}): readonly CreditAllocation[] => {
  const amount = requireCreditAmount(input.amount);
  const asOf = parseInstant(input.asOf);
  const sources = input.sources
    .map((source) => {
      const expiresAt = source.expiresAt === null ? null : parseInstant(source.expiresAt);
      return Object.freeze({
        available: requireCreditAmount(source.available),
        createdAt: parseInstant(source.createdAt),
        creditType: source.creditType,
        entryId: parseResourceId(source.entryId),
        expiresAt,
      });
    })
    .filter(({ expiresAt }) => expiresAt === null || Date.parse(expiresAt) > Date.parse(asOf))
    .sort(
      (left, right) =>
        creditPriority(left.creditType) - creditPriority(right.creditType) ||
        (left.expiresAt === null ? Number.POSITIVE_INFINITY : Date.parse(left.expiresAt)) -
          (right.expiresAt === null ? Number.POSITIVE_INFINITY : Date.parse(right.expiresAt)) ||
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.entryId.localeCompare(right.entryId),
    );

  let remaining = amount;
  const allocations: CreditAllocation[] = [];
  for (const source of sources) {
    if (remaining === 0) break;
    const allocated = Math.min(remaining, source.available);
    allocations.push(
      Object.freeze({
        amount: allocated,
        creditType: source.creditType,
        sourceEntryId: source.entryId,
      }),
    );
    remaining -= allocated;
  }
  if (remaining !== 0) throw new CommerceError("COMMERCE_STATE_CONFLICT");
  return Object.freeze(allocations);
};

export type CreditProjection = Readonly<{
  promotionalAvailable: number;
  purchasedAvailable: number;
  reserved: number;
  subscriptionAvailable: number;
  version: number;
}>;

const requireProjection = (projection: CreditProjection): CreditProjection => {
  for (const value of [
    projection.subscriptionAvailable,
    projection.promotionalAvailable,
    projection.purchasedAvailable,
    projection.reserved,
    projection.version,
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CommerceError("COMMERCE_INPUT_INVALID");
    }
  }
  return projection;
};

const allocationTotal = (allocations: readonly CreditAllocation[]): number =>
  allocations.reduce((total, allocation) => total + requireCreditAmount(allocation.amount), 0);

export const applyCreditProjection = (input: {
  allocations: readonly CreditAllocation[];
  direction: CreditDirection;
  projection: CreditProjection;
}): CreditProjection => {
  const current = requireProjection(input.projection);
  const next = { ...current, version: current.version + 1 };
  const total = allocationTotal(input.allocations);
  for (const allocation of input.allocations) {
    const delta =
      input.direction === "grant" || input.direction === "release"
        ? allocation.amount
        : input.direction === "reserve" ||
            input.direction === "reverse" ||
            input.direction === "expire"
          ? -allocation.amount
          : 0;
    switch (allocation.creditType) {
      case "subscription_credit":
        next.subscriptionAvailable += delta;
        break;
      case "promotional_credit":
        next.promotionalAvailable += delta;
        break;
      case "purchased_credit":
        next.purchasedAvailable += delta;
        break;
    }
  }
  if (input.direction === "reserve") next.reserved += total;
  if (input.direction === "release" || input.direction === "consume") next.reserved -= total;
  return Object.freeze(requireProjection(next));
};

export const commercialEntitlementStates = Object.freeze([
  "pending",
  "active",
  "frozen",
  "revoked",
] as const);
export type CommercialEntitlementState = (typeof commercialEntitlementStates)[number];

export const commercialEntitlementEvents = Object.freeze([
  "grant",
  "freeze",
  "unfreeze",
  "revoke",
] as const);
export type CommercialEntitlementEvent = (typeof commercialEntitlementEvents)[number];

export const transitionCommercialEntitlement = (input: {
  alreadyRecorded: boolean;
  event: CommercialEntitlementEvent;
  state: CommercialEntitlementState | null;
}): CommercialStateTransition<CommercialEntitlementState | null> => {
  if (input.alreadyRecorded) {
    return Object.freeze({ disposition: "duplicate", nextState: input.state });
  }
  const nextState =
    input.event === "grant" && (input.state === null || input.state === "pending")
      ? "active"
      : input.event === "freeze" && input.state === "active"
        ? "frozen"
        : input.event === "unfreeze" && input.state === "frozen"
          ? "active"
          : input.event === "revoke" && (input.state === "active" || input.state === "frozen")
            ? "revoked"
            : null;
  return Object.freeze(
    nextState === null
      ? { disposition: "ignored_out_of_order", nextState: input.state }
      : { disposition: "applied", nextState },
  );
};

export type CreditLedgerEntryV1 = Readonly<{
  amount: number;
  createdAt: string;
  creditType: CreditType;
  direction: CreditDirection;
  entryId: string;
  idempotencyScope: string;
  productCode: string | null;
  reservationId: string | null;
  sourceEntryId: string | null;
  termsVersion: string;
  userId: string;
}>;

export const resolveCommercialIdempotency = (input: {
  existingCanonicalRequestHash: string | null;
  requestedCanonicalRequestHash: string;
}): "conflict" | "create" | "replay" => {
  const requested = parseResourceId(input.requestedCanonicalRequestHash);
  if (input.existingCanonicalRequestHash === null) return "create";
  return parseResourceId(input.existingCanonicalRequestHash) === requested ? "replay" : "conflict";
};

export const createCreditLedgerEntryV1 = (input: CreditLedgerEntryV1): CreditLedgerEntryV1 => {
  const entry = Object.freeze({
    amount: requireCreditAmount(input.amount),
    createdAt: parseInstant(input.createdAt),
    creditType: input.creditType,
    direction: input.direction,
    entryId: parseResourceId(input.entryId),
    idempotencyScope: parseIdentifier(input.idempotencyScope),
    productCode: input.productCode === null ? null : parseIdentifier(input.productCode),
    reservationId: input.reservationId === null ? null : parseResourceId(input.reservationId),
    sourceEntryId: input.sourceEntryId === null ? null : parseResourceId(input.sourceEntryId),
    termsVersion: parseResourceId(input.termsVersion),
    userId: parseResourceId(input.userId),
  });
  if (!creditTypes.includes(entry.creditType) || !creditDirections.includes(entry.direction)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const shapeValid =
    (entry.direction === "grant" && entry.reservationId === null && entry.sourceEntryId === null) ||
    (entry.direction === "reserve" &&
      entry.reservationId !== null &&
      entry.sourceEntryId === null) ||
    ((entry.direction === "release" || entry.direction === "consume") &&
      entry.reservationId !== null &&
      entry.sourceEntryId === null) ||
    ((entry.direction === "reverse" || entry.direction === "expire") &&
      entry.reservationId === null &&
      entry.sourceEntryId !== null);
  if (!shapeValid) throw new CommerceError("COMMERCE_INPUT_INVALID");
  return entry;
};
