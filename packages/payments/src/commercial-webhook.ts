import {
  transitionCommercialOrder,
  transitionCommercialPaymentAttempt,
  type CommercialOrderState,
  type CommercialPaymentAttemptState,
} from "./transaction-domain.js";
import { parseInstant, parseResourceId } from "./validation.js";

export const verifiedCommercialPaymentEventTypes = Object.freeze([
  "payment_pending",
  "payment_succeeded",
  "payment_failed",
  "payment_expired",
  "payment_refunded",
  "payment_disputed",
] as const);
export type VerifiedCommercialPaymentEventType =
  (typeof verifiedCommercialPaymentEventTypes)[number];

export type CommercialPaymentTimelineEvent = Readonly<{
  eventId: string;
  eventType: VerifiedCommercialPaymentEventType;
  occurredAt: string;
  providerEventId: string;
}>;

export type CommercialPaymentTimelineDisposition = Readonly<{
  disposition: "applied" | "ignored_out_of_order";
  eventId: string;
}>;

export type ReducedCommercialPaymentTimeline = Readonly<{
  attemptCompletedAt: string | null;
  attemptState: CommercialPaymentAttemptState;
  dispositions: readonly CommercialPaymentTimelineDisposition[];
  orderStatus: CommercialOrderState;
  paidAt: string | null;
  refundedAt: string | null;
  refundedMinor: number;
  updatedAt: string | null;
}>;

const eventRank = (eventType: VerifiedCommercialPaymentEventType): number => {
  switch (eventType) {
    case "payment_pending":
      return 10;
    case "payment_failed":
      return 20;
    case "payment_expired":
      return 30;
    case "payment_succeeded":
      return 40;
    case "payment_disputed":
      return 50;
    case "payment_refunded":
      return 60;
  }
};

const parseTimelineEvent = (
  value: CommercialPaymentTimelineEvent,
): CommercialPaymentTimelineEvent => {
  if (!verifiedCommercialPaymentEventTypes.includes(value.eventType)) {
    throw new TypeError("Commercial payment event type is invalid.");
  }
  return Object.freeze({
    eventId: parseResourceId(value.eventId),
    eventType: value.eventType,
    occurredAt: parseInstant(value.occurredAt),
    providerEventId: parseResourceId(value.providerEventId),
  });
};

export const reduceCommercialPaymentTimeline = (input: {
  events: readonly CommercialPaymentTimelineEvent[];
  totalMinor: number;
}): ReducedCommercialPaymentTimeline => {
  if (!Number.isSafeInteger(input.totalMinor) || input.totalMinor < 1) {
    throw new TypeError("Commercial payment total is invalid.");
  }
  const events = input.events.map(parseTimelineEvent).sort((left, right) => {
    const occurred = left.occurredAt.localeCompare(right.occurredAt);
    if (occurred !== 0) return occurred;
    const rank = eventRank(left.eventType) - eventRank(right.eventType);
    return rank === 0 ? left.providerEventId.localeCompare(right.providerEventId) : rank;
  });
  if (new Set(events.map(({ eventId }) => eventId)).size !== events.length) {
    throw new TypeError("Commercial payment event IDs must be unique.");
  }

  let orderStatus: CommercialOrderState = "checkout_created";
  let attemptState: CommercialPaymentAttemptState = "checkout_created";
  let paidAt: string | null = null;
  let refundedAt: string | null = null;
  let refundedMinor = 0;
  let attemptCompletedAt: string | null = null;
  let updatedAt: string | null = null;
  let updatedAtMilliseconds = Number.NEGATIVE_INFINITY;
  const dispositions: CommercialPaymentTimelineDisposition[] = [];

  for (const event of events) {
    const orderTransition = transitionCommercialOrder({
      alreadyRecorded: false,
      event: event.eventType,
      state: orderStatus,
    });
    const attemptTransition = transitionCommercialPaymentAttempt({
      alreadyRecorded: false,
      event: event.eventType,
      state: attemptState,
    });
    const applied =
      orderTransition.disposition === "applied" || attemptTransition.disposition === "applied";
    dispositions.push(
      Object.freeze({
        disposition: applied ? "applied" : "ignored_out_of_order",
        eventId: event.eventId,
      }),
    );
    if (!applied) continue;

    orderStatus = orderTransition.nextState;
    attemptState = attemptTransition.nextState;
    const eventMilliseconds = Date.parse(event.occurredAt);
    if (eventMilliseconds > updatedAtMilliseconds) {
      updatedAt = event.occurredAt;
      updatedAtMilliseconds = eventMilliseconds;
    }
    if (event.eventType === "payment_succeeded" && paidAt === null) {
      paidAt = event.occurredAt;
    }
    if (event.eventType === "payment_refunded" && orderStatus === "refunded") {
      refundedAt = event.occurredAt;
      refundedMinor = input.totalMinor;
    }
    if (
      attemptTransition.disposition === "applied" &&
      ["succeeded", "failed", "expired", "cancelled"].includes(attemptState)
    ) {
      attemptCompletedAt = event.occurredAt;
    }
  }

  return Object.freeze({
    attemptCompletedAt,
    attemptState,
    dispositions: Object.freeze(dispositions),
    orderStatus,
    paidAt,
    refundedAt,
    refundedMinor,
    updatedAt,
  });
};
