import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CommercialPaymentEventPersistenceError,
  type CommercialPaymentEventPersistence,
} from "@rituvia/db";
import {
  CommerceError,
  createMoney,
  type HostedCheckoutAdapter,
  type NormalizedPaymentEventV1,
} from "@rituvia/payments";

import { createStripeWebhookApplicationService } from "./stripe-webhook";

const orderId = "11111111-1111-4111-8111-111111111111";
const rawBody = new TextEncoder().encode('{"id":"evt_success"}');
const signatureHeader = `t=${Math.floor(Date.parse("2026-07-30T12:00:02.000Z") / 1_000)},v1=${"a".repeat(64)}`;
const normalizedEvent: NormalizedPaymentEventV1 = Object.freeze({
  amount: createMoney(599, "USD"),
  eventId: "evt_success",
  occurredAt: "2026-07-30T12:00:01.000Z",
  orderId,
  providerCheckoutSessionId: "cs_test_12345678",
  providerId: "stripe",
  providerObjectId: "pi_12345678",
  providerPaymentIntentId: "pi_12345678",
  type: "payment_succeeded" as const,
});

const harness = () => {
  const attestAccount = vi.fn(async () => undefined);
  const verifyWebhook = vi.fn(async () => normalizedEvent);
  const processStripeSandboxEvent =
    vi.fn<CommercialPaymentEventPersistence["processStripeSandboxEvent"]>();
  processStripeSandboxEvent.mockResolvedValue({
    disposition: "applied",
    kind: "processed",
    orderStatus: "paid",
    outboxCreated: true,
    paymentAttemptState: "succeeded",
  });
  const paymentProvider = {
    createCheckout: vi.fn(),
    providerId: "stripe",
    verifyWebhook,
  } as unknown as HostedCheckoutAdapter;
  const persistence = {
    processStripeSandboxEvent,
  } as unknown as CommercialPaymentEventPersistence;
  return {
    paymentProvider,
    persistence,
    processStripeSandboxEvent,
    service: createStripeWebhookApplicationService({
      clock: () => "2026-07-30T12:00:02.000Z",
      paymentProvider,
      paymentProviders: { accountFingerprint: () => "acct_12345678", attestAccount },
      persistence,
    }),
    attestAccount,
    verifyWebhook,
  };
};

describe("Stripe v2 webhook application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists only normalized verified facts and the exact raw-body digest", async () => {
    const test = harness();
    await expect(
      test.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody,
      }),
    ).resolves.toMatchObject({ disposition: "applied", orderStatus: "paid" });

    expect(test.verifyWebhook).toHaveBeenCalledOnce();
    expect(test.attestAccount).toHaveBeenCalledOnce();
    expect(test.attestAccount).toHaveBeenCalledWith("stripe");
    expect(test.processStripeSandboxEvent).toHaveBeenCalledOnce();
    const [prepared, reduce] = test.processStripeSandboxEvent.mock.calls[0]!;
    expect(prepared).toMatchObject({
      amountMinor: 599,
      currencyCode: "USD",
      eventType: "payment_succeeded",
      normalizationVersion: "stripe-commercial-event.v1",
      orderId,
      providerAccountFingerprint: "acct_12345678",
      providerCheckoutId: "cs_test_12345678",
      providerEventId: "evt_success",
      providerPaymentIntentId: "pi_12345678",
      receivedAt: "2026-07-30T12:00:02.000Z",
      signatureTimestampSeconds: Math.floor(Date.parse("2026-07-30T12:00:02.000Z") / 1_000),
      verifierVersion: "stripe-signature.v1",
    });
    expect(Buffer.from(prepared.payloadDigest).toString("hex")).toBe(
      createHash("sha256").update(rawBody).digest("hex"),
    );
    expect(typeof reduce).toBe("function");
  });

  it("attests the Stripe account inside the webhook function boundary", async () => {
    const test = harness();
    test.attestAccount.mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(
      test.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });

    expect(test.verifyWebhook).toHaveBeenCalledOnce();
    expect(test.attestAccount).toHaveBeenCalledOnce();
    expect(test.processStripeSandboxEvent).not.toHaveBeenCalled();
  });

  it("maps signature, replay, and altered-event conflicts to one private invalid response", async () => {
    const signature = harness();
    signature.verifyWebhook.mockRejectedValueOnce(new CommerceError("WEBHOOK_INVALID"));
    await expect(signature.service.processWebhook({ headers: {}, rawBody })).rejects.toMatchObject({
      code: "webhook_invalid",
    });
    expect(signature.attestAccount).not.toHaveBeenCalled();

    const conflict = harness();
    conflict.processStripeSandboxEvent.mockRejectedValueOnce(
      new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_CONFLICT"),
    );
    await expect(
      conflict.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "webhook_invalid" });
  });

  it("keeps database outages retryable and rejects unbound provider events", async () => {
    const unavailable = harness();
    unavailable.processStripeSandboxEvent.mockRejectedValueOnce(
      new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE"),
    );
    await expect(
      unavailable.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });

    const unbound = harness();
    unbound.verifyWebhook.mockResolvedValueOnce({
      ...normalizedEvent,
      providerCheckoutSessionId: null,
    });
    await expect(
      unbound.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "webhook_invalid" });
    expect(unbound.processStripeSandboxEvent).not.toHaveBeenCalled();
  });

  it("cannot be constructed around a non-Stripe adapter", () => {
    const test = harness();
    expect(() =>
      createStripeWebhookApplicationService({
        clock: () => "2026-07-30T12:00:02.000Z",
        paymentProvider: { ...test.paymentProvider, providerId: "local_hosted" },
        paymentProviders: { accountFingerprint: () => "cfg_local", attestAccount: vi.fn() },
        persistence: test.persistence,
      }),
    ).toThrow();
  });
});
