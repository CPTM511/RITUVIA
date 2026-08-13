import { describe, expect, it, vi } from "vitest";

import {
  CommercialSubscriptionPersistenceError,
  type CommercialSubscriptionPersistence,
} from "@rituvia/db";

import {
  runOneSubscriptionFulfillment,
  runSubscriptionFulfillmentLoop,
} from "../src/subscription-fulfillment.js";

const store = (
  overrides: Partial<CommercialSubscriptionPersistence> = {},
): CommercialSubscriptionPersistence =>
  ({
    claimNextAllocation: vi.fn(async () => ({
      allocationId: "11111111-1111-4111-8111-111111111111",
      amount: 8,
      attempt: 1,
      leaseExpiresAt: "2026-08-01T00:01:00.000Z",
      outboxId: "22222222-2222-4222-8222-222222222222",
      subscriptionPeriodId: "33333333-3333-4333-8333-333333333333",
    })),
    createOrReplaySubscription: vi.fn(),
    failAllocation: vi.fn(),
    fulfillAllocation: vi.fn(async () => ({
      allocationId: "11111111-1111-4111-8111-111111111111",
      disposition: "granted",
      subscriptionId: "44444444-4444-4444-8444-444444444444",
      userId: "55555555-5555-4555-8555-555555555555",
    })),
    ingestStripeSandboxEvent: vi.fn(),
    processNextSubscriptionEvent: vi.fn(async () => null),
    quarantineSubscriptionEvent: vi.fn(),
    ...overrides,
  }) as CommercialSubscriptionPersistence;

describe("subscription fulfillment worker", () => {
  it("processes one verified event before claiming allocations", async () => {
    const persistence = store({
      processNextSubscriptionEvent: vi.fn<
        CommercialSubscriptionPersistence["processNextSubscriptionEvent"]
      >(async () => ({
        allocationsScheduled: 1,
        disposition: "applied",
        refundDisposition: "not_applicable",
        state: "active",
        subscriptionId: "44444444-4444-4444-8444-444444444444",
      })),
    });
    await expect(
      runOneSubscriptionFulfillment({
        clock: () => "2026-08-01T00:00:00.000Z",
        store: persistence,
      }),
    ).resolves.toBe("event_processed");
    expect(persistence.claimNextAllocation).not.toHaveBeenCalled();
  });

  it("grants one due monthly allocation", async () => {
    const persistence = store();
    await expect(
      runOneSubscriptionFulfillment({
        clock: () => "2026-08-01T00:00:00.000Z",
        store: persistence,
      }),
    ).resolves.toBe("granted");
    expect(persistence.fulfillAllocation).toHaveBeenCalledOnce();
  });

  it("quarantines a conflicting event and keeps the worker available", async () => {
    const persistence = store({
      processNextSubscriptionEvent: vi.fn(async () => {
        throw new CommercialSubscriptionPersistenceError(
          "COMMERCIAL_SUBSCRIPTION_CONFLICT",
          "66666666-6666-4666-8666-666666666666",
        );
      }),
      quarantineSubscriptionEvent: vi.fn(async () => ({
        eventId: "66666666-6666-4666-8666-666666666666",
      })),
    });
    await expect(
      runOneSubscriptionFulfillment({
        clock: () => "2026-08-01T00:00:00.000Z",
        store: persistence,
      }),
    ).resolves.toBe("event_review_required");
    expect(persistence.quarantineSubscriptionEvent).toHaveBeenCalledWith({
      eventId: "66666666-6666-4666-8666-666666666666",
      processedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(persistence.claimNextAllocation).not.toHaveBeenCalled();
  });

  it("stays idle without due work", async () => {
    await expect(
      runOneSubscriptionFulfillment({
        clock: () => "2026-08-01T00:00:00.000Z",
        store: store({ claimNextAllocation: vi.fn(async () => null) }),
      }),
    ).resolves.toBe("idle");
  });

  it("returns cancelled before claiming when shutdown is requested", async () => {
    const controller = new AbortController();
    controller.abort();
    const persistence = store();
    await expect(
      runOneSubscriptionFulfillment({
        clock: () => "2026-08-01T00:00:00.000Z",
        signal: controller.signal,
        store: persistence,
      }),
    ).resolves.toBe("cancelled");
    expect(persistence.claimNextAllocation).not.toHaveBeenCalled();
  });

  it("contains a database outage and resumes without stopping unrelated loops", async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const persistence = store({
      processNextSubscriptionEvent: vi
        .fn<CommercialSubscriptionPersistence["processNextSubscriptionEvent"]>()
        .mockRejectedValueOnce(new Error("private database details"))
        .mockImplementationOnce(async () => {
          controller.abort();
          return {
            allocationsScheduled: 0,
            disposition: "applied",
            refundDisposition: "not_applicable",
            state: "active",
            subscriptionId: "44444444-4444-4444-8444-444444444444",
          };
        }),
    });
    await runSubscriptionFulfillmentLoop({
      failureDelayMilliseconds: 1,
      observe: ({ disposition }) => events.push(disposition),
      signal: controller.signal,
      store: persistence,
    });
    expect(persistence.processNextSubscriptionEvent).toHaveBeenCalledTimes(2);
    expect(events).toEqual(["persistence_unavailable", "event_processed"]);
  });
});
