import { describe, expect, it } from "vitest";

import {
  planSubscriptionCreditAllocation,
  reduceCommercialSubscriptionTimeline,
  type CommercialSubscriptionEvent,
} from "../src/index.js";

const event = (
  eventType: CommercialSubscriptionEvent["eventType"],
  occurredAt: string,
  overrides: Partial<CommercialSubscriptionEvent> = {},
): CommercialSubscriptionEvent => ({
  cancelAtPeriodEnd: false,
  eventId: `event_${eventType}_${occurredAt}`,
  eventType,
  occurredAt,
  periodEndsAt: null,
  periodStartsAt: null,
  priceId: "price_plus_monthly",
  productCode: "plus_monthly",
  providerEventId: `stripe_${eventType}_${occurredAt}`,
  ...overrides,
});

describe("commercial subscription lifecycle", () => {
  it("activates only from a paid period and recovers from grace", () => {
    const result = reduceCommercialSubscriptionTimeline({
      events: [
        event("subscription_payment_failed", "2026-08-02T00:00:00.000Z"),
        event("subscription_created", "2026-08-01T00:00:00.000Z"),
        event("subscription_period_paid", "2026-08-03T00:00:00.000Z", {
          periodStartsAt: "2026-08-03T00:00:00.000Z",
          periodEndsAt: "2026-09-03T00:00:00.000Z",
        }),
      ],
    });

    expect(result.state).toBe("active");
    expect(result.paidPeriodCount).toBe(1);
    expect(result.dispositions.map(({ disposition }) => disposition)).toEqual([
      "applied",
      "applied",
      "applied",
    ]);
  });

  it("deduplicates paid coverage and preserves cancellation through period end", () => {
    const period = {
      periodStartsAt: "2026-08-01T00:00:00.000Z",
      periodEndsAt: "2026-09-01T00:00:00.000Z",
    };
    const result = reduceCommercialSubscriptionTimeline({
      events: [
        event("subscription_created", "2026-07-31T00:00:00.000Z"),
        event("subscription_period_paid", "2026-08-01T00:00:00.000Z", period),
        event("subscription_period_paid", "2026-08-01T00:00:01.000Z", period),
        event("subscription_cancel_scheduled", "2026-08-10T00:00:00.000Z", {
          cancelAtPeriodEnd: true,
          ...period,
        }),
      ],
    });

    expect(result.state).toBe("cancel_at_period_end");
    expect(result.paidPeriodCount).toBe(1);
    expect(result.dispositions.at(2)?.disposition).toBe("ignored_out_of_order");
  });

  it("moves through grace, past due, cancellation, and refund without creating value", () => {
    const result = reduceCommercialSubscriptionTimeline({
      events: [
        event("subscription_created", "2026-08-01T00:00:00.000Z"),
        event("subscription_payment_failed", "2026-08-02T00:00:00.000Z"),
        event("subscription_grace_expired", "2026-08-09T00:00:00.000Z"),
        event("subscription_cancelled", "2026-08-10T00:00:00.000Z"),
        event("subscription_refunded", "2026-08-11T00:00:00.000Z"),
      ],
    });

    expect(result.state).toBe("refunded");
    expect(result.paidPeriodCount).toBe(0);
    expect(result.cancelledAt).toBe("2026-08-10T00:00:00.000Z");
  });

  it("allocates exactly the configured monthly amount inside paid coverage", () => {
    expect(
      planSubscriptionCreditAllocation({
        alreadyAllocated: false,
        creditsPerMonth: 8,
        monthEndsAt: "2026-09-01T00:00:00.000Z",
        monthStartsAt: "2026-08-01T00:00:00.000Z",
        paidCoverageEndsAt: "2027-08-01T00:00:00.000Z",
        paidCoverageStartsAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toEqual({
      allocationAmount: 8,
      disposition: "allocate",
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
  });

  it("makes a retried monthly allocation a no-op", () => {
    expect(
      planSubscriptionCreditAllocation({
        alreadyAllocated: true,
        creditsPerMonth: 8,
        monthEndsAt: "2026-09-01T00:00:00.000Z",
        monthStartsAt: "2026-08-01T00:00:00.000Z",
        paidCoverageEndsAt: "2026-09-01T00:00:00.000Z",
        paidCoverageStartsAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toMatchObject({ allocationAmount: 0, disposition: "unchanged" });
  });
});
