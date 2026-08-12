import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CommercialPaymentEventPersistenceError,
  type CommercialPaymentEventPersistence,
} from "@rituvia/db";
import {
  CommerceError,
  type HostedCryptoCheckoutAdapter,
  type HostedCryptoReconciliationResultV1,
  type HostedCryptoWebhookEventV1,
} from "@rituvia/payments";

import { createCoinbaseWebhookApplicationService } from "./coinbase-webhook";

const orderId = "11111111-1111-4111-8111-111111111111";
const checkoutId = "0123456789abcdef01234567";
const rawBody = new TextEncoder().encode('{"eventType":"checkout.payment.success"}');
const timestamp = Math.floor(Date.parse("2026-08-08T12:00:02.000Z") / 1_000);
const signatureHeader = `t=${timestamp},h=content-type x-hook0-id,v1=${"a".repeat(64)}`;
const event: HostedCryptoWebhookEventV1 = Object.freeze({
  eventId: "hook0_12345678",
  occurredAt: "2026-08-08T12:00:01.000Z",
  orderId,
  providerCheckoutSessionId: checkoutId,
  providerId: "coinbase_usdc_base",
  providerObjectId: checkoutId,
  settlement: Object.freeze({ amountDecimal: "5.99", assetCode: "USDC", networkCode: "base" }),
  status: "confirmed",
});
const reconciliation: HostedCryptoReconciliationResultV1 = Object.freeze({
  checkedAt: "2026-08-08T12:00:02.000Z",
  orderId,
  providerCheckoutSessionId: checkoutId,
  providerId: "coinbase_usdc_base",
  providerObjectId: checkoutId,
  settlement: Object.freeze({ amountDecimal: "5.99", assetCode: "USDC", networkCode: "base" }),
  status: "confirmed",
});

const harness = () => {
  const verifyWebhook = vi.fn(async () => event);
  const reconcileCheckout = vi.fn(async () => reconciliation);
  const processCoinbaseSandboxEvent =
    vi.fn<CommercialPaymentEventPersistence["processCoinbaseSandboxEvent"]>();
  processCoinbaseSandboxEvent.mockResolvedValue({
    disposition: "applied",
    kind: "processed",
    orderStatus: "paid",
    outboxCreated: true,
    paymentAttemptState: "succeeded",
  });
  const paymentProvider = {
    createCheckout: vi.fn(),
    providerId: "coinbase_usdc_base",
    reconcileCheckout,
    verifyWebhook,
  } as unknown as HostedCryptoCheckoutAdapter;
  const persistence = {
    processCoinbaseSandboxEvent,
  } as unknown as CommercialPaymentEventPersistence;
  return {
    paymentProvider,
    persistence,
    processCoinbaseSandboxEvent,
    reconcileCheckout,
    service: createCoinbaseWebhookApplicationService({
      clock: () => "2026-08-08T12:00:02.000Z",
      paymentProvider,
      persistence,
      providerAccountFingerprint: `sha256:${"b".repeat(64)}`,
      recoveryScope: "D-098:OWNER:item-11:protected-staging",
    }),
    verifyWebhook,
  };
};

describe("Coinbase Business sandbox webhook application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles the signed sandbox event before writing the existing idempotent ledger", async () => {
    const test = harness();
    await expect(
      test.service.processWebhook({
        headers: { "x-hook0-signature": signatureHeader },
        rawBody,
      }),
    ).resolves.toMatchObject({ disposition: "applied", orderStatus: "paid" });

    expect(test.verifyWebhook).toHaveBeenCalledOnce();
    expect(test.reconcileCheckout).toHaveBeenCalledWith({
      checkoutId,
      orderId,
      providerId: "coinbase_usdc_base",
    });
    expect(test.processCoinbaseSandboxEvent).toHaveBeenCalledOnce();
    const [prepared, reduce] = test.processCoinbaseSandboxEvent.mock.calls[0]!;
    expect(prepared).toMatchObject({
      amountMinor: 599,
      currencyCode: "USD",
      eventType: "payment_succeeded",
      normalizationVersion: "coinbase-business-sandbox-event.v1",
      observedAsset: "USDC",
      observedNetwork: "base",
      orderId,
      providerCheckoutId: checkoutId,
      providerEventId: "hook0_12345678",
      providerInvoiceId: null,
      providerObjectId: checkoutId,
      providerPaymentIntentId: null,
      providerSubscriptionId: null,
      recoveryScope: "D-098:OWNER:item-11:protected-staging",
      signatureTimestampSeconds: timestamp,
      verifierVersion: "coinbase-business-hook0-signature.v1",
    });
    expect(Buffer.from(prepared.payloadDigest).toString("hex")).toBe(
      createHash("sha256").update(rawBody).digest("hex"),
    );
    expect(typeof reduce).toBe("function");
  });

  it("rejects provider reconciliation disagreement without writing payment state", async () => {
    const test = harness();
    test.reconcileCheckout.mockResolvedValueOnce({
      ...reconciliation,
      settlement: { ...reconciliation.settlement, amountDecimal: "6" },
    });

    await expect(
      test.service.processWebhook({
        headers: { "x-hook0-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "webhook_invalid" });
    expect(test.processCoinbaseSandboxEvent).not.toHaveBeenCalled();
  });

  it("rejects stale or invalid signatures before provider or database work", async () => {
    const test = harness();
    await expect(
      test.service.processWebhook({
        headers: { "x-hook0-signature": `t=1,h=content-type x-hook0-id,v1=${"a".repeat(64)}` },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "webhook_invalid" });
    expect(test.verifyWebhook).not.toHaveBeenCalled();
    expect(test.reconcileCheckout).not.toHaveBeenCalled();
    expect(test.processCoinbaseSandboxEvent).not.toHaveBeenCalled();
  });

  it("keeps database outages retryable and event conflicts private", async () => {
    const unavailable = harness();
    unavailable.processCoinbaseSandboxEvent.mockRejectedValueOnce(
      new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE"),
    );
    await expect(
      unavailable.service.processWebhook({
        headers: { "x-hook0-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "unavailable" });

    const conflict = harness();
    conflict.processCoinbaseSandboxEvent.mockRejectedValueOnce(
      new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_CONFLICT"),
    );
    await expect(
      conflict.service.processWebhook({
        headers: { "x-hook0-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "webhook_invalid" });
  });

  it("cannot be constructed around a non-Coinbase adapter or scope", () => {
    const test = harness();
    expect(() =>
      createCoinbaseWebhookApplicationService({
        clock: () => "2026-08-08T12:00:02.000Z",
        paymentProvider: { ...test.paymentProvider, providerId: "stripe" },
        persistence: test.persistence,
        providerAccountFingerprint: "cfg",
        recoveryScope: "D-098:OWNER:item-11:protected-staging",
      }),
    ).toThrow();
  });

  it("normalizes adapter failures into one invalid webhook result", async () => {
    const test = harness();
    test.verifyWebhook.mockRejectedValueOnce(new CommerceError("WEBHOOK_INVALID"));
    await expect(
      test.service.processWebhook({
        headers: { "x-hook0-signature": signatureHeader },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "webhook_invalid" });
  });
});
