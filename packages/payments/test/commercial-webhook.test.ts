import { describe, expect, it } from "vitest";

import {
  reduceCommercialPaymentTimeline,
  type CommercialPaymentTimelineEvent,
} from "../src/index.js";

const event = (
  eventId: string,
  eventType: CommercialPaymentTimelineEvent["eventType"],
  occurredAt: string,
): CommercialPaymentTimelineEvent => ({
  eventId,
  eventType,
  occurredAt,
  providerEventId: `evt_${eventId}`,
});

describe("commercial payment timeline reducer", () => {
  it("recomputes an arrival-independent refunded state", () => {
    const reduced = reduceCommercialPaymentTimeline({
      events: [
        event("refund", "payment_refunded", "2026-07-30T12:02:00.000Z"),
        event("success", "payment_succeeded", "2026-07-30T12:01:00.000Z"),
      ],
      totalMinor: 599,
    });

    expect(reduced).toMatchObject({
      attemptCompletedAt: "2026-07-30T12:01:00.000Z",
      attemptState: "succeeded",
      orderStatus: "refunded",
      paidAt: "2026-07-30T12:01:00.000Z",
      refundedAt: "2026-07-30T12:02:00.000Z",
      refundedMinor: 599,
    });
    expect(reduced.dispositions).toEqual([
      { disposition: "applied", eventId: "success" },
      { disposition: "applied", eventId: "refund" },
    ]);
  });

  it("keeps terminal refund state when a stale failure arrives later", () => {
    const reduced = reduceCommercialPaymentTimeline({
      events: [
        event("success", "payment_succeeded", "2026-07-30T12:01:00.000Z"),
        event("refund", "payment_refunded", "2026-07-30T12:02:00.000Z"),
        event("failure", "payment_failed", "2026-07-30T12:03:00.000Z"),
      ],
      totalMinor: 599,
    });

    expect(reduced.orderStatus).toBe("refunded");
    expect(reduced.attemptState).toBe("succeeded");
    expect(reduced.dispositions.at(-1)).toEqual({
      disposition: "ignored_out_of_order",
      eventId: "failure",
    });
  });

  it("uses deterministic event precedence when provider timestamps tie", () => {
    const occurredAt = "2026-07-30T12:01:00.000Z";
    expect(
      reduceCommercialPaymentTimeline({
        events: [
          event("refund", "payment_refunded", occurredAt),
          event("success", "payment_succeeded", occurredAt),
        ],
        totalMinor: 599,
      }).orderStatus,
    ).toBe("refunded");
  });

  it("rejects duplicate internal event IDs and invalid totals", () => {
    expect(() =>
      reduceCommercialPaymentTimeline({
        events: [
          event("same", "payment_pending", "2026-07-30T12:00:00.000Z"),
          event("same", "payment_succeeded", "2026-07-30T12:01:00.000Z"),
        ],
        totalMinor: 599,
      }),
    ).toThrow(TypeError);
    expect(() => reduceCommercialPaymentTimeline({ events: [], totalMinor: 0 })).toThrow(TypeError);
  });
});
