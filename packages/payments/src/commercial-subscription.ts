import { parseIdentifier, parseInstant, parseResourceId } from "./validation.js";

export const commercialSubscriptionStates = Object.freeze([
  "pending",
  "active",
  "grace_period",
  "past_due",
  "cancel_at_period_end",
  "cancelled",
  "refunded",
  "disputed",
] as const);
export type CommercialSubscriptionState = (typeof commercialSubscriptionStates)[number];

export const commercialSubscriptionEventTypes = Object.freeze([
  "subscription_created",
  "subscription_period_paid",
  "subscription_payment_failed",
  "subscription_grace_expired",
  "subscription_changed",
  "subscription_cancel_scheduled",
  "subscription_cancelled",
  "subscription_refunded",
  "subscription_disputed",
] as const);
export type CommercialSubscriptionEventType = (typeof commercialSubscriptionEventTypes)[number];

export type CommercialSubscriptionEvent = Readonly<{
  cancelAtPeriodEnd: boolean;
  eventId: string;
  eventType: CommercialSubscriptionEventType;
  occurredAt: string;
  periodEndsAt: string | null;
  periodStartsAt: string | null;
  priceId: string;
  productCode: string;
  providerEventId: string;
}>;

export type CommercialSubscriptionTimelineDisposition = Readonly<{
  disposition: "applied" | "ignored_out_of_order";
  eventId: string;
}>;

export type ReducedCommercialSubscriptionTimeline = Readonly<{
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  currentPeriodEndsAt: string | null;
  currentPeriodStartsAt: string | null;
  dispositions: readonly CommercialSubscriptionTimelineDisposition[];
  paidPeriodCount: number;
  priceId: string | null;
  productCode: string | null;
  refundedAt: string | null;
  state: CommercialSubscriptionState;
  updatedAt: string | null;
}>;

const eventRank = (eventType: CommercialSubscriptionEventType): number => {
  switch (eventType) {
    case "subscription_created":
      return 10;
    case "subscription_period_paid":
      return 20;
    case "subscription_payment_failed":
      return 30;
    case "subscription_cancel_scheduled":
    case "subscription_changed":
      return 40;
    case "subscription_grace_expired":
      return 50;
    case "subscription_cancelled":
      return 60;
    case "subscription_disputed":
      return 70;
    case "subscription_refunded":
      return 80;
  }
};

const parseEvent = (event: CommercialSubscriptionEvent): CommercialSubscriptionEvent => {
  if (!commercialSubscriptionEventTypes.includes(event.eventType)) {
    throw new TypeError("Commercial subscription event type is invalid.");
  }
  const periodStartsAt = event.periodStartsAt === null ? null : parseInstant(event.periodStartsAt);
  const periodEndsAt = event.periodEndsAt === null ? null : parseInstant(event.periodEndsAt);
  if (
    (periodStartsAt === null) !== (periodEndsAt === null) ||
    (periodStartsAt !== null &&
      periodEndsAt !== null &&
      Date.parse(periodEndsAt) <= Date.parse(periodStartsAt))
  ) {
    throw new TypeError("Commercial subscription period is invalid.");
  }
  return Object.freeze({
    cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    eventId: parseResourceId(event.eventId),
    eventType: event.eventType,
    occurredAt: parseInstant(event.occurredAt),
    periodEndsAt,
    periodStartsAt,
    priceId: parseResourceId(event.priceId),
    productCode: parseIdentifier(event.productCode),
    providerEventId: parseResourceId(event.providerEventId),
  });
};

const nextState = (
  state: CommercialSubscriptionState,
  event: CommercialSubscriptionEvent,
): CommercialSubscriptionState | null => {
  switch (event.eventType) {
    case "subscription_created":
      return state === "pending" ? "pending" : null;
    case "subscription_period_paid":
      return ["pending", "active", "grace_period", "past_due", "cancel_at_period_end"].includes(
        state,
      )
        ? event.cancelAtPeriodEnd
          ? "cancel_at_period_end"
          : "active"
        : null;
    case "subscription_payment_failed":
      return ["pending", "active", "cancel_at_period_end", "grace_period"].includes(state)
        ? "grace_period"
        : null;
    case "subscription_grace_expired":
      return state === "grace_period" ? "past_due" : null;
    case "subscription_changed":
      return ["pending", "active", "grace_period", "past_due", "cancel_at_period_end"].includes(
        state,
      )
        ? event.cancelAtPeriodEnd
          ? "cancel_at_period_end"
          : state === "cancel_at_period_end"
            ? "active"
            : state
        : null;
    case "subscription_cancel_scheduled":
      return ["active", "grace_period", "past_due", "cancel_at_period_end"].includes(state)
        ? "cancel_at_period_end"
        : null;
    case "subscription_cancelled":
      return ["pending", "active", "grace_period", "past_due", "cancel_at_period_end"].includes(
        state,
      )
        ? "cancelled"
        : null;
    case "subscription_refunded":
      return state === "disputed" || state === "cancelled" || state === "refunded"
        ? "refunded"
        : null;
    case "subscription_disputed":
      return state === "active" || state === "cancel_at_period_end" ? "disputed" : null;
  }
};

export const reduceCommercialSubscriptionTimeline = (input: {
  events: readonly CommercialSubscriptionEvent[];
}): ReducedCommercialSubscriptionTimeline => {
  const events = input.events.map(parseEvent).sort((left, right) => {
    const occurred = left.occurredAt.localeCompare(right.occurredAt);
    if (occurred !== 0) return occurred;
    const rank = eventRank(left.eventType) - eventRank(right.eventType);
    return rank === 0 ? left.providerEventId.localeCompare(right.providerEventId) : rank;
  });
  if (new Set(events.map(({ eventId }) => eventId)).size !== events.length) {
    throw new TypeError("Commercial subscription event IDs must be unique.");
  }

  let state: CommercialSubscriptionState = "pending";
  let cancelAtPeriodEnd = false;
  let currentPeriodStartsAt: string | null = null;
  let currentPeriodEndsAt: string | null = null;
  let paidPeriodCount = 0;
  let productCode: string | null = null;
  let priceId: string | null = null;
  let cancelledAt: string | null = null;
  let refundedAt: string | null = null;
  let updatedAt: string | null = null;
  const paidPeriods = new Set<string>();
  const dispositions: CommercialSubscriptionTimelineDisposition[] = [];

  for (const event of events) {
    const transition = nextState(state, event);
    if (transition === null) {
      dispositions.push(
        Object.freeze({ disposition: "ignored_out_of_order", eventId: event.eventId }),
      );
      continue;
    }
    if (
      event.eventType === "subscription_period_paid" &&
      event.periodStartsAt !== null &&
      event.periodEndsAt !== null
    ) {
      const periodKey = `${event.periodStartsAt}/${event.periodEndsAt}`;
      if (paidPeriods.has(periodKey)) {
        dispositions.push(
          Object.freeze({ disposition: "ignored_out_of_order", eventId: event.eventId }),
        );
        continue;
      }
      paidPeriods.add(periodKey);
      paidPeriodCount += 1;
      currentPeriodStartsAt = event.periodStartsAt;
      currentPeriodEndsAt = event.periodEndsAt;
    }
    state = transition;
    cancelAtPeriodEnd = event.cancelAtPeriodEnd || state === "cancel_at_period_end";
    productCode = event.productCode;
    priceId = event.priceId;
    updatedAt = event.occurredAt;
    if (event.eventType === "subscription_cancelled") cancelledAt = event.occurredAt;
    if (event.eventType === "subscription_refunded") refundedAt = event.occurredAt;
    dispositions.push(Object.freeze({ disposition: "applied", eventId: event.eventId }));
  }

  return Object.freeze({
    cancelAtPeriodEnd,
    cancelledAt,
    currentPeriodEndsAt,
    currentPeriodStartsAt,
    dispositions: Object.freeze(dispositions),
    paidPeriodCount,
    priceId,
    productCode,
    refundedAt,
    state,
    updatedAt,
  });
};

export type SubscriptionCreditAllocationPlan = Readonly<{
  allocationAmount: number;
  disposition: "allocate" | "unchanged";
  expiresAt: string;
}>;

export const planSubscriptionCreditAllocation = (input: {
  alreadyAllocated: boolean;
  creditsPerMonth: number;
  monthEndsAt: string;
  paidCoverageEndsAt: string;
  paidCoverageStartsAt: string;
  monthStartsAt: string;
}): SubscriptionCreditAllocationPlan => {
  const creditsPerMonth = input.creditsPerMonth;
  if (!Number.isSafeInteger(creditsPerMonth) || creditsPerMonth < 1 || creditsPerMonth > 10_000) {
    throw new TypeError("Subscription Credit amount is invalid.");
  }
  const monthStartsAt = parseInstant(input.monthStartsAt);
  const monthEndsAt = parseInstant(input.monthEndsAt);
  const coverageStartsAt = parseInstant(input.paidCoverageStartsAt);
  const coverageEndsAt = parseInstant(input.paidCoverageEndsAt);
  if (
    Date.parse(monthEndsAt) <= Date.parse(monthStartsAt) ||
    Date.parse(coverageEndsAt) <= Date.parse(coverageStartsAt) ||
    Date.parse(monthStartsAt) < Date.parse(coverageStartsAt) ||
    Date.parse(monthEndsAt) > Date.parse(coverageEndsAt)
  ) {
    throw new TypeError("Subscription Credit coverage is invalid.");
  }
  return Object.freeze({
    allocationAmount: input.alreadyAllocated ? 0 : creditsPerMonth,
    disposition: input.alreadyAllocated ? "unchanged" : "allocate",
    expiresAt: monthEndsAt,
  });
};
