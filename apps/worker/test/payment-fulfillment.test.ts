import { describe, expect, it, vi } from "vitest";

import {
  CommercialFulfillmentPersistenceError,
  type CommercialFulfillmentPersistence,
} from "@rituvia/db";
import { planCommercialCreditPackFulfillment } from "@rituvia/payments";

import { runOneCommercialPaymentFulfillment } from "../src/payment-fulfillment.js";

const claim = Object.freeze({
  attempt: 1,
  leaseExpiresAt: "2026-07-30T12:01:00.000Z",
  maxAttempts: 20 as const,
  orderId: "12345678-1234-4123-8123-123456789abc",
  orderStatus: "paid" as const,
  outboxId: "22345678-1234-4123-8123-123456789abc",
  paymentAttemptId: "32345678-1234-4123-8123-123456789abc",
  paymentEventId: "42345678-1234-4123-8123-123456789abc",
  paymentStateVersion: 1,
  schemaVersion: "commercial-payment-state-outbox.v1" as const,
});

const store = (
  overrides: Partial<CommercialFulfillmentPersistence> = {},
): CommercialFulfillmentPersistence => ({
  claimNextPaymentState: vi.fn().mockResolvedValue(claim),
  failPaymentState: vi.fn().mockResolvedValue("retry_wait"),
  fulfillPaymentState: vi.fn().mockResolvedValue({
    creditsGranted: 6,
    creditsHeld: 0,
    creditsReversed: 0,
    disposition: "granted",
    fulfillmentCode: "credits.pack_6",
    orderId: claim.orderId,
    shortfallAmount: 0,
    userId: "52345678-1234-4123-8123-123456789abc",
  }),
  readPurchaseStatus: vi.fn(),
  restorePurchases: vi.fn(),
  ...overrides,
});

describe("commercial payment fulfillment worker", () => {
  it("fulfills one leased outbox job with the deterministic planner", async () => {
    const persistence = store();
    await expect(
      runOneCommercialPaymentFulfillment({
        clock: () => "2026-07-30T12:00:00.000Z",
        plan: planCommercialCreditPackFulfillment,
        store: persistence,
      }),
    ).resolves.toBe("granted");
    expect(persistence.fulfillPaymentState).toHaveBeenCalledWith(
      expect.objectContaining({ outboxId: claim.outboxId }),
      planCommercialCreditPackFulfillment,
    );
    expect(persistence.failPaymentState).not.toHaveBeenCalled();
  });

  it("does nothing when no payment-state outbox is due", async () => {
    const persistence = store({
      claimNextPaymentState: vi.fn().mockResolvedValue(null),
    });
    await expect(
      runOneCommercialPaymentFulfillment({
        clock: () => "2026-07-30T12:00:00.000Z",
        plan: planCommercialCreditPackFulfillment,
        store: persistence,
      }),
    ).resolves.toBe("idle");
    expect(persistence.fulfillPaymentState).not.toHaveBeenCalled();
  });

  it("returns a cancelled lease to bounded retry during shutdown", async () => {
    const controller = new AbortController();
    const persistence = store({
      claimNextPaymentState: vi.fn().mockImplementation(async () => {
        controller.abort();
        return claim;
      }),
    });
    await expect(
      runOneCommercialPaymentFulfillment({
        clock: () => "2026-07-30T12:00:00.000Z",
        plan: planCommercialCreditPackFulfillment,
        signal: controller.signal,
        store: persistence,
      }),
    ).resolves.toBe("cancelled");
    expect(persistence.failPaymentState).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCode: "worker_cancelled",
        outboxId: claim.outboxId,
      }),
    );
  });

  it("retries unavailable persistence without exposing the raw error", async () => {
    const persistence = store({
      fulfillPaymentState: vi.fn().mockRejectedValue(new Error("private database details")),
    });
    await expect(
      runOneCommercialPaymentFulfillment({
        clock: () => "2026-07-30T12:00:00.000Z",
        plan: planCommercialCreditPackFulfillment,
        store: persistence,
      }),
    ).resolves.toBe("retried");
    expect(persistence.failPaymentState).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCode: "fulfillment_unavailable",
        outboxId: claim.outboxId,
      }),
    );
  });

  it("dead-letters a terminal accounting conflict", async () => {
    const persistence = store({
      failPaymentState: vi.fn().mockResolvedValue("dead_lettered"),
      fulfillPaymentState: vi
        .fn()
        .mockRejectedValue(
          new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT"),
        ),
    });
    await expect(
      runOneCommercialPaymentFulfillment({
        clock: () => "2026-07-30T12:00:00.000Z",
        plan: planCommercialCreditPackFulfillment,
        store: persistence,
      }),
    ).resolves.toBe("dead_lettered");
    expect(persistence.failPaymentState).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCode: "fulfillment_conflict",
        retryAt: null,
      }),
    );
  });
});
