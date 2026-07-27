import { describe, expect, it, vi } from "vitest";

import {
  createDisabledRevisitReminderAdapter,
  RevisitReminderDeliveryError,
  runOneRevisitReminderDelivery,
  type RevisitReminderJobStore,
  type RevisitReminderWorkerEvent,
} from "../src/revisit-reminder.js";

const job = Object.freeze({
  attempt: 1,
  leaseToken: "x".repeat(43),
  locale: "en" as const,
  maxAttempts: 3 as const,
  recipientIdentityId: "12345678-1234-4123-8123-123456789abc",
  revisitId: "22345678-1234-4123-8123-123456789abc",
  subscriptionId: "32345678-1234-4123-8123-123456789abc",
});

const store = (overrides: Partial<RevisitReminderJobStore> = {}): RevisitReminderJobStore => ({
  authorizeDelivery: vi.fn().mockResolvedValue(true),
  claimDue: vi.fn().mockResolvedValue(job),
  completeDelivery: vi.fn().mockResolvedValue(true),
  failDelivery: vi.fn().mockResolvedValue("retry_wait"),
  ...overrides,
});

describe("Revisit reminder worker", () => {
  it("delivers fixed privacy-safe copy with a stable provider idempotency key", async () => {
    const delivery = vi.fn().mockResolvedValue({ providerMessageReference: "local.message.1" });
    const events: RevisitReminderWorkerEvent[] = [];
    const jobStore = store();

    await expect(
      runOneRevisitReminderDelivery({
        adapter: { deliver: delivery },
        observe: (event) => events.push(event),
        store: jobStore,
      }),
    ).resolves.toBe("delivered");

    expect(delivery).toHaveBeenCalledOnce();
    expect(delivery.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: `rituvia.revisit-reminder.delivery.v1:${job.subscriptionId}`,
      recipientIdentityId: job.recipientIdentityId,
      subscriptionId: job.subscriptionId,
    });
    expect(JSON.stringify(delivery.mock.calls[0]?.[0])).not.toMatch(
      /question|journal|relationship|intention|ritual|health|grief/iu,
    );
    expect(jobStore.completeDelivery).toHaveBeenCalledWith({
      leaseToken: job.leaseToken,
      providerMessageReference: "local.message.1",
      subscriptionId: job.subscriptionId,
    });
    expect(events.map(({ event }) => event)).toEqual(["started", "succeeded"]);
  });

  it("does nothing when no due job can be claimed", async () => {
    const delivery = vi.fn();
    await expect(
      runOneRevisitReminderDelivery({
        adapter: { deliver: delivery },
        store: store({ claimDue: vi.fn().mockResolvedValue(null) }),
      }),
    ).resolves.toBe("idle");
    expect(delivery).not.toHaveBeenCalled();
  });

  it("does not call a provider after send-time authorization is withdrawn", async () => {
    const delivery = vi.fn();
    const jobStore = store({ authorizeDelivery: vi.fn().mockResolvedValue(false) });
    await expect(
      runOneRevisitReminderDelivery({
        adapter: { deliver: delivery },
        store: jobStore,
      }),
    ).resolves.toBe("stale");
    expect(delivery).not.toHaveBeenCalled();
    expect(jobStore.completeDelivery).not.toHaveBeenCalled();
  });

  it("classifies retryable provider failure without leaking the provider error", async () => {
    const jobStore = store();
    await expect(
      runOneRevisitReminderDelivery({
        adapter: {
          deliver() {
            throw new RevisitReminderDeliveryError("provider_unavailable", true);
          },
        },
        store: jobStore,
      }),
    ).resolves.toBe("retry_wait");
    expect(jobStore.failDelivery).toHaveBeenCalledWith({
      failureCode: "provider_unavailable",
      leaseToken: job.leaseToken,
      retryable: true,
      subscriptionId: job.subscriptionId,
    });
  });

  it("dead-letters the safe-off provider without any external request", async () => {
    const jobStore = store({ failDelivery: vi.fn().mockResolvedValue("dead_lettered") });
    await expect(
      runOneRevisitReminderDelivery({
        adapter: createDisabledRevisitReminderAdapter(),
        store: jobStore,
      }),
    ).resolves.toBe("dead_lettered");
    expect(jobStore.failDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "provider_disabled", retryable: false }),
    );
  });

  it("times out a hanging provider and schedules bounded retry", async () => {
    const jobStore = store();
    await expect(
      runOneRevisitReminderDelivery({
        adapter: {
          deliver(_request, signal) {
            return new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => reject(new Error("private provider error")), {
                once: true,
              });
            });
          },
        },
        store: jobStore,
        timeoutMs: 10,
      }),
    ).resolves.toBe("retry_wait");
    expect(jobStore.failDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "timeout", retryable: true }),
    );
  });

  it("does not claim work after shutdown cancellation", async () => {
    const controller = new AbortController();
    const jobStore = store();
    controller.abort();
    await expect(
      runOneRevisitReminderDelivery({
        adapter: createDisabledRevisitReminderAdapter(),
        signal: controller.signal,
        store: jobStore,
      }),
    ).resolves.toBe("cancelled");
    expect(jobStore.claimDue).not.toHaveBeenCalled();
  });
});
