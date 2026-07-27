import { describe, expect, it } from "vitest";

import {
  allocateCreditSources,
  applyCreditProjection,
  commercialOrderStates,
  commercialPaymentAttemptStates,
  commercialPaymentEvents,
  CommerceError,
  createCreditLedgerEntryV1,
  resolveCommercialIdempotency,
  transitionCommercialEntitlement,
  transitionCommercialOrder,
  transitionCommercialPaymentAttempt,
  type CreditProjection,
  type CreditSource,
} from "../src/index.js";

const now = "2026-07-25T12:00:00.000Z";

describe("commercial transaction state machines", () => {
  it("accepts the canonical checkout, payment, refund, and dispute paths", () => {
    let order = transitionCommercialOrder({
      alreadyRecorded: false,
      event: "checkout_created",
      state: "created",
    }).nextState;
    order = transitionCommercialOrder({
      alreadyRecorded: false,
      event: "payment_pending",
      state: order,
    }).nextState;
    order = transitionCommercialOrder({
      alreadyRecorded: false,
      event: "payment_succeeded",
      state: order,
    }).nextState;
    expect(order).toBe("paid");
    expect(
      transitionCommercialOrder({
        alreadyRecorded: false,
        event: "refund_requested",
        state: order,
      }).nextState,
    ).toBe("refund_requested");
    expect(
      transitionCommercialOrder({
        alreadyRecorded: false,
        event: "payment_disputed",
        state: order,
      }).nextState,
    ).toBe("disputed");
  });

  it("records duplicates and out-of-order events without changing state", () => {
    expect(
      transitionCommercialOrder({
        alreadyRecorded: true,
        event: "payment_succeeded",
        state: "created",
      }),
    ).toEqual({ disposition: "duplicate", nextState: "created" });
    expect(
      transitionCommercialOrder({
        alreadyRecorded: false,
        event: "payment_succeeded",
        state: "refunded",
      }),
    ).toEqual({ disposition: "ignored_out_of_order", nextState: "refunded" });
    expect(
      transitionCommercialPaymentAttempt({
        alreadyRecorded: false,
        event: "refund_requested",
        state: "succeeded",
      }),
    ).toEqual({ disposition: "ignored_out_of_order", nextState: "succeeded" });
  });

  it("replays only an exact canonical request under the same idempotency key", () => {
    expect(
      resolveCommercialIdempotency({
        existingCanonicalRequestHash: null,
        requestedCanonicalRequestHash: "sha256_request_a",
      }),
    ).toBe("create");
    expect(
      resolveCommercialIdempotency({
        existingCanonicalRequestHash: "sha256_request_a",
        requestedCanonicalRequestHash: "sha256_request_a",
      }),
    ).toBe("replay");
    expect(
      resolveCommercialIdempotency({
        existingCanonicalRequestHash: "sha256_request_a",
        requestedCanonicalRequestHash: "sha256_request_b",
      }),
    ).toBe("conflict");
  });

  it("keeps every state/event combination inside its finite union", () => {
    for (const state of commercialOrderStates) {
      for (const event of commercialPaymentEvents) {
        expect(commercialOrderStates, `${state} + ${event} left the order union`).toContain(
          transitionCommercialOrder({ alreadyRecorded: false, event, state }).nextState,
        );
      }
    }
    for (const state of commercialPaymentAttemptStates) {
      for (const event of commercialPaymentEvents) {
        expect(
          commercialPaymentAttemptStates,
          `${state} + ${event} left the attempt union`,
        ).toContain(
          transitionCommercialPaymentAttempt({ alreadyRecorded: false, event, state }).nextState,
        );
      }
    }
  });

  it("never revives a revoked entitlement", () => {
    expect(
      transitionCommercialEntitlement({
        alreadyRecorded: false,
        event: "grant",
        state: "revoked",
      }),
    ).toEqual({ disposition: "ignored_out_of_order", nextState: "revoked" });
  });
});

describe("Credit allocation and projection", () => {
  const sources: readonly CreditSource[] = [
    {
      available: 4,
      createdAt: "2026-07-01T00:00:00.000Z",
      creditType: "purchased_credit",
      entryId: "grant_purchased",
      expiresAt: null,
    },
    {
      available: 2,
      createdAt: "2026-07-02T00:00:00.000Z",
      creditType: "promotional_credit",
      entryId: "grant_promotional",
      expiresAt: "2026-08-01T00:00:00.000Z",
    },
    {
      available: 3,
      createdAt: "2026-07-03T00:00:00.000Z",
      creditType: "subscription_credit",
      entryId: "grant_subscription",
      expiresAt: "2026-08-01T00:00:00.000Z",
    },
  ];

  it("allocates subscription, then promotional, then purchased Credits", () => {
    expect(allocateCreditSources({ amount: 7, asOf: now, sources })).toEqual([
      {
        amount: 3,
        creditType: "subscription_credit",
        sourceEntryId: "grant_subscription",
      },
      {
        amount: 2,
        creditType: "promotional_credit",
        sourceEntryId: "grant_promotional",
      },
      {
        amount: 2,
        creditType: "purchased_credit",
        sourceEntryId: "grant_purchased",
      },
    ]);
  });

  it("rejects expired or insufficient sources", () => {
    expect(() =>
      allocateCreditSources({
        amount: 3,
        asOf: "2026-09-01T00:00:00.000Z",
        sources: sources.slice(1),
      }),
    ).toThrow(CommerceError);
  });

  it("preserves non-negative projections across reserve, release, and consume", () => {
    const initial: CreditProjection = {
      promotionalAvailable: 2,
      purchasedAvailable: 4,
      reserved: 0,
      subscriptionAvailable: 3,
      version: 0,
    };
    const allocations = allocateCreditSources({ amount: 7, asOf: now, sources });
    const reserved = applyCreditProjection({
      allocations,
      direction: "reserve",
      projection: initial,
    });
    expect(reserved).toEqual({
      promotionalAvailable: 0,
      purchasedAvailable: 2,
      reserved: 7,
      subscriptionAvailable: 0,
      version: 1,
    });
    expect(
      applyCreditProjection({ allocations, direction: "release", projection: reserved }),
    ).toEqual({ ...initial, version: 2 });
    expect(
      applyCreditProjection({ allocations, direction: "consume", projection: reserved }),
    ).toEqual({
      promotionalAvailable: 0,
      purchasedAvailable: 2,
      reserved: 0,
      subscriptionAvailable: 0,
      version: 2,
    });
  });

  it("applies linked reversal only while authoritative availability remains", () => {
    const projection: CreditProjection = {
      promotionalAvailable: 0,
      purchasedAvailable: 6,
      reserved: 0,
      subscriptionAvailable: 0,
      version: 1,
    };
    const allocation = [
      {
        amount: 6,
        creditType: "purchased_credit" as const,
        sourceEntryId: "grant_pack_6",
      },
    ];
    expect(
      applyCreditProjection({ allocations: allocation, direction: "reverse", projection }),
    ).toEqual({
      promotionalAvailable: 0,
      purchasedAvailable: 0,
      reserved: 0,
      subscriptionAvailable: 0,
      version: 2,
    });
    expect(() =>
      applyCreditProjection({
        allocations: [{ ...allocation[0], amount: 7 }],
        direction: "reverse",
        projection,
      }),
    ).toThrow(CommerceError);
  });

  it("rejects projection underflow for every generated overspend", () => {
    for (let amount = 1; amount <= 64; amount += 1) {
      expect(() =>
        applyCreditProjection({
          allocations: [
            {
              amount,
              creditType: "purchased_credit",
              sourceEntryId: `grant_${amount}`,
            },
          ],
          direction: "reserve",
          projection: {
            promotionalAvailable: 0,
            purchasedAvailable: amount - 1,
            reserved: 0,
            subscriptionAvailable: 0,
            version: amount,
          },
        }),
      ).toThrow(CommerceError);
    }
  });

  it("requires exact ledger linkage by direction", () => {
    expect(
      createCreditLedgerEntryV1({
        amount: 2,
        createdAt: now,
        creditType: "purchased_credit",
        direction: "reserve",
        entryId: "entry_reserve",
        idempotencyScope: "credit.reserve",
        productCode: "deep_clarity",
        reservationId: "reservation_1",
        sourceEntryId: null,
        termsVersion: "terms.local.v1",
        userId: "user_1",
      }),
    ).toMatchObject({ direction: "reserve", reservationId: "reservation_1" });
    expect(() =>
      createCreditLedgerEntryV1({
        amount: 2,
        createdAt: now,
        creditType: "purchased_credit",
        direction: "reverse",
        entryId: "entry_reverse",
        idempotencyScope: "credit.reverse",
        productCode: "pack_6",
        reservationId: null,
        sourceEntryId: null,
        termsVersion: "terms.local.v1",
        userId: "user_1",
      }),
    ).toThrow(CommerceError);
  });
});
