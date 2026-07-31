import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CommercialPaymentEventPersistenceError,
  type CommercialPaymentEventPersistence,
  type CommercialSubscriptionPersistence,
} from "@rituvia/db";
import {
  CommerceError,
  createMoney,
  type HostedCheckoutAdapter,
  type NormalizedPaymentEventV1,
} from "@rituvia/payments";
import type { NormalizedSubscriptionEventV1 } from "@rituvia/payments/adapters/stripe";

import { classifyStripeWebhook, createStripeWebhookApplicationService } from "./stripe-webhook";

const orderId = "11111111-1111-4111-8111-111111111111";
const rawBody = new TextEncoder().encode(
  '{"id":"evt_success","type":"checkout.session.completed"}',
);
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
const normalizedSubscriptionEvent: NormalizedSubscriptionEventV1 = Object.freeze({
  amount: createMoney(999, "USD"),
  cancelAtPeriodEnd: false,
  eventId: "evt_subscription_paid",
  occurredAt: "2026-07-30T12:00:01.000Z",
  orderId,
  productCode: "plus_monthly",
  providerChargeId: null,
  providerCustomerId: "cus_12345678",
  providerId: "stripe",
  providerInvoiceId: "in_12345678",
  providerObjectId: "in_12345678",
  providerSubscriptionId: "sub_12345678",
  subscriptionInterval: "month",
  subscriptionPeriodEnd: "2026-08-30T12:00:00.000Z",
  subscriptionPeriodStart: "2026-07-30T12:00:00.000Z",
  type: "subscription_period_paid",
});

const harness = () => {
  const verifyWebhook = vi.fn(async () => normalizedEvent);
  const verifySubscriptionWebhook = vi.fn(async () => normalizedSubscriptionEvent);
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
  const ingestSubscriptionEvent =
    vi.fn<CommercialSubscriptionPersistence["ingestStripeSandboxEvent"]>();
  ingestSubscriptionEvent.mockResolvedValue({
    disposition: "queued",
    eventId: "22222222-2222-4222-8222-222222222222",
  });
  return {
    paymentProvider,
    persistence,
    processStripeSandboxEvent,
    ingestSubscriptionEvent,
    service: createStripeWebhookApplicationService({
      clock: () => "2026-07-30T12:00:02.000Z",
      paymentProvider,
      paymentProviders: { accountFingerprint: () => "acct_12345678" },
      persistence,
      subscriptionPaymentProvider: {
        providerId: "stripe",
        verifySubscriptionWebhook,
      },
      subscriptionPersistence: { ingestStripeSandboxEvent: ingestSubscriptionEvent },
    }),
    verifySubscriptionWebhook,
    verifyWebhook,
  };
};

describe("Stripe v2 webhook application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes signed event shapes to exactly one provider verifier", () => {
    const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    expect(classifyStripeWebhook(encode({ type: "invoice.paid" }))).toBe("subscription");
    expect(classifyStripeWebhook(encode({ type: "checkout.session.completed" }))).toBe("payment");
    expect(
      classifyStripeWebhook(
        encode({
          data: { object: { mode: "subscription" } },
          type: "checkout.session.completed",
        }),
      ),
    ).toBe("subscription");
    expect(
      classifyStripeWebhook(
        encode({ data: { object: { invoice: "in_12345678" } }, type: "charge.refunded" }),
      ),
    ).toBe("subscription");
    expect(
      classifyStripeWebhook(
        encode({ data: { object: { invoice: null } }, type: "charge.refunded" }),
      ),
    ).toBe("payment");
    expect(() => classifyStripeWebhook(encode({ type: "unknown.event" }))).toThrow();
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

  it("persists a paid subscription period without invoking the one-time verifier", async () => {
    const test = harness();
    const subscriptionBody = new TextEncoder().encode(
      '{"id":"evt_subscription_paid","type":"invoice.paid"}',
    );

    await expect(
      test.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody: subscriptionBody,
      }),
    ).resolves.toMatchObject({ disposition: "queued" });
    expect(test.verifySubscriptionWebhook).toHaveBeenCalledOnce();
    expect(test.verifyWebhook).not.toHaveBeenCalled();
    expect(test.ingestSubscriptionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "subscription_period_paid",
        providerInvoiceId: "in_12345678",
        sourceOrderId: orderId,
      }),
    );
  });

  it("acknowledges a verified subscription Checkout without changing value", async () => {
    const test = harness();
    test.verifySubscriptionWebhook.mockResolvedValueOnce({
      ...normalizedSubscriptionEvent,
      amount: null,
      providerChargeId: null,
      providerInvoiceId: null,
      providerObjectId: "cs_test_12345678",
      type: "subscription_checkout_completed",
    });
    const body = new TextEncoder().encode(
      '{"data":{"object":{"mode":"subscription"}},"type":"checkout.session.completed"}',
    );
    await expect(
      test.service.processWebhook({
        headers: { "stripe-signature": signatureHeader },
        rawBody: body,
      }),
    ).resolves.toEqual({ disposition: "ignored" });
    expect(test.ingestSubscriptionEvent).not.toHaveBeenCalled();
    expect(test.verifyWebhook).not.toHaveBeenCalled();
  });

  it("maps signature, replay, and altered-event conflicts to one private invalid response", async () => {
    const signature = harness();
    signature.verifyWebhook.mockRejectedValueOnce(new CommerceError("WEBHOOK_INVALID"));
    await expect(signature.service.processWebhook({ headers: {}, rawBody })).rejects.toMatchObject({
      code: "webhook_invalid",
    });

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
        paymentProviders: { accountFingerprint: () => "cfg_local" },
        persistence: test.persistence,
        subscriptionPaymentProvider: {
          providerId: "stripe",
          verifySubscriptionWebhook: test.verifySubscriptionWebhook,
        },
        subscriptionPersistence: {
          ingestStripeSandboxEvent: test.ingestSubscriptionEvent,
        },
      }),
    ).toThrow();
  });
});
