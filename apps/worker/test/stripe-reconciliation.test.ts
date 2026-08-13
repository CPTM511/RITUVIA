import { describe, expect, it, vi } from "vitest";

import {
  createStripeReconciliationReader,
  type StripeReconciliationRequest,
} from "../src/stripe-reconciliation.js";

const stripeRequest = (session: unknown, accountId = "acct_test"): StripeReconciliationRequest =>
  vi.fn(async (path) =>
    path === "/v1/account"
      ? { body: { id: accountId }, status: 200 }
      : { body: session, status: 200 },
  );

describe("Stripe reconciliation reader", () => {
  it("normalizes a Test Mode paid Checkout and settlement without raw response storage", async () => {
    const reader = createStripeReconciliationReader(
      { accountId: "acct_test", secretKey: "sk_test_unused" },
      stripeRequest({
        amount_total: 599,
        client_reference_id: "12345678-1234-4123-8123-123456789abc",
        currency: "usd",
        id: "cs_test_123",
        livemode: false,
        metadata: { orderId: "12345678-1234-4123-8123-123456789abc" },
        payment_intent: {
          id: "pi_123",
          latest_charge: {
            amount: 599,
            amount_refunded: 0,
            balance_transaction: { id: "txn_123", status: "available" },
            disputed: false,
            id: "ch_123",
          },
        },
        payment_status: "paid",
        status: "complete",
      }),
    );
    await expect(reader.readCheckout("cs_test_123")).resolves.toEqual({
      amountMinor: 599,
      availability: "available",
      currencyCode: "USD",
      orderId: "12345678-1234-4123-8123-123456789abc",
      paymentState: "paid",
      providerCheckoutId: "cs_test_123",
      providerPaymentIntentId: "pi_123",
      settlementState: "available",
    });
  });

  it("fails account attestation and refuses Live Mode evidence", async () => {
    await expect(
      createStripeReconciliationReader(
        { accountId: "acct_expected", secretKey: "sk_test_unused" },
        stripeRequest({}, "acct_wrong"),
      ).attestAccount(),
    ).rejects.toThrow("does not match");
    await expect(
      createStripeReconciliationReader(
        { accountId: "acct_test", secretKey: "sk_test_unused" },
        stripeRequest({ id: "cs_live_123", livemode: true }),
      ).readCheckout("cs_live_123"),
    ).resolves.toEqual({ availability: "unavailable" });
  });

  it("distinguishes a missing Checkout from provider unavailability", async () => {
    const request = vi.fn(async (path: string) =>
      path === "/v1/account"
        ? { body: { id: "acct_test" }, status: 200 }
        : { body: { error: { code: "resource_missing" } }, status: 404 },
    );
    await expect(
      createStripeReconciliationReader(
        { accountId: "acct_test", secretKey: "sk_test_unused" },
        request,
      ).readCheckout("cs_test_missing"),
    ).resolves.toEqual({ availability: "missing" });
  });

  it("contains account transport failure inside reconciliation and retries attestation", async () => {
    const request = vi
      .fn<StripeReconciliationRequest>()
      .mockRejectedValueOnce(new Error("private Stripe transport details"))
      .mockResolvedValueOnce({ body: { id: "acct_test" }, status: 200 })
      .mockResolvedValueOnce({ body: { error: { code: "resource_missing" } }, status: 404 });
    const reader = createStripeReconciliationReader(
      { accountId: "acct_test", secretKey: "sk_test_unused" },
      request,
    );
    await expect(reader.readCheckout("cs_test_missing")).resolves.toEqual({
      availability: "unavailable",
    });
    await expect(reader.readCheckout("cs_test_missing")).resolves.toEqual({
      availability: "missing",
    });
    expect(request).toHaveBeenCalledTimes(3);
  });
});
