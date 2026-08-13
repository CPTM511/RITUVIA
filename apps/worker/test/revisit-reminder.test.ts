import { describe, expect, it, vi } from "vitest";
import { revisitReminderTemplateBinding } from "@rituvia/domain";

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
  quietHours: "saved" as const,
  recipientIdentityId: "12345678-1234-4123-8123-123456789abc",
  revisitId: "22345678-1234-4123-8123-123456789abc",
  scheduledLocalDate: "2026-07-28",
  subscriptionId: "32345678-1234-4123-8123-123456789abc",
  templateFallbackUsed: false,
  templateId: revisitReminderTemplateBinding.templateId,
  templateLocale: revisitReminderTemplateBinding.locale,
  templateSourceChecksum: revisitReminderTemplateBinding.sourceChecksum,
  templateVersion: revisitReminderTemplateBinding.templateVersion,
  timeZone: "Asia/Shanghai",
});

const messageConfiguration = Object.freeze({
  brandName: "RITUVIA",
  canonicalOrigin: "https://example.test",
  supportEmail: "support@example.test",
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
        messageConfiguration,
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
    expect(delivery.mock.calls[0]?.[0].message).toMatchObject({
      fallbackUsed: false,
      locale: "en",
      preference: {
        label: "Turn off this reminder",
        url: "https://example.test/en/revisit#reminder-preferences",
      },
      sourceChecksum: revisitReminderTemplateBinding.sourceChecksum,
      templateVersion: revisitReminderTemplateBinding.templateVersion,
      timeZone: "Asia/Shanghai",
    });
    expect(delivery.mock.calls[0]?.[0].message.bodyText).toContain(
      "outside your saved quiet hours",
    );
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
        messageConfiguration,
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
        messageConfiguration,
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
        messageConfiguration,
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
        messageConfiguration,
        store: jobStore,
      }),
    ).resolves.toBe("dead_lettered");
    expect(jobStore.failDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "provider_disabled", retryable: false }),
    );
  });

  it("hard-times out a provider that ignores cancellation and schedules bounded retry", async () => {
    const jobStore = store();
    await expect(
      runOneRevisitReminderDelivery({
        adapter: {
          deliver() {
            return new Promise(() => undefined);
          },
        },
        messageConfiguration,
        store: jobStore,
        timeoutMs: 10,
      }),
    ).resolves.toBe("retry_wait");
    expect(jobStore.failDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "timeout", retryable: true }),
    );
  });

  it("hard-cancels an uncooperative provider during shutdown", async () => {
    const controller = new AbortController();
    const jobStore = store();
    const completion = runOneRevisitReminderDelivery({
      adapter: {
        deliver() {
          controller.abort();
          return new Promise(() => undefined);
        },
      },
      messageConfiguration,
      signal: controller.signal,
      store: jobStore,
    });
    await expect(completion).resolves.toBe("cancelled");
    expect(jobStore.failDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "provider_unavailable", retryable: true }),
    );
  });

  it("does not claim work after shutdown cancellation", async () => {
    const controller = new AbortController();
    const jobStore = store();
    controller.abort();
    await expect(
      runOneRevisitReminderDelivery({
        adapter: createDisabledRevisitReminderAdapter(),
        messageConfiguration,
        signal: controller.signal,
        store: jobStore,
      }),
    ).resolves.toBe("cancelled");
    expect(jobStore.claimDue).not.toHaveBeenCalled();
  });

  it("dead-letters a stale template binding without calling the provider", async () => {
    const delivery = vi.fn();
    const jobStore = store({
      claimDue: vi.fn().mockResolvedValue({ ...job, templateVersion: "revisit-reminder.en.stale" }),
      failDelivery: vi.fn().mockResolvedValue("dead_lettered"),
    });

    await expect(
      runOneRevisitReminderDelivery({
        adapter: { deliver: delivery },
        messageConfiguration,
        store: jobStore,
      }),
    ).resolves.toBe("dead_lettered");

    expect(delivery).not.toHaveBeenCalled();
    expect(jobStore.failDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ failureCode: "template_unavailable", retryable: false }),
    );
  });
});
