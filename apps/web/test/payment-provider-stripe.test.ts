import { describe, expect, it, vi } from "vitest";

import {
  createStripeGateway,
  createWebPaymentProviderRegistry,
  stripeHostedCheckoutProviderId,
  verifiedStripePaymentEvent,
} from "../server/payment-provider";

const orderId = "11111111-1111-4111-8111-111111111111";

describe("Stripe verified event normalization", () => {
  it("keeps Stripe webhooks unavailable until shared account attestation succeeds", async () => {
    const attestAccount = vi.fn(async () => undefined);
    const attestationIdentity = `unit.shared.${orderId}`;
    const startupRegistry = createWebPaymentProviderRegistry({
      stripe: { providerId: stripeHostedCheckoutProviderId } as never,
      stripeAccountAttestation: attestAccount,
      stripeAccountAttestationIdentity: attestationIdentity,
      stripeAccountFingerprint: "acct_12345678",
    });
    const webhookBundleRegistry = createWebPaymentProviderRegistry({
      stripe: { providerId: stripeHostedCheckoutProviderId } as never,
      stripeAccountAttestationIdentity: attestationIdentity,
      stripeAccountFingerprint: "acct_12345678",
    });

    expect(() =>
      webhookBundleRegistry.assertAccountAttested(stripeHostedCheckoutProviderId),
    ).toThrowError("The payment provider is unavailable.");
    await expect(
      startupRegistry.attestAccount(stripeHostedCheckoutProviderId),
    ).resolves.toBeUndefined();
    expect(() =>
      webhookBundleRegistry.assertAccountAttested(stripeHostedCheckoutProviderId),
    ).not.toThrow();
    expect(attestAccount).toHaveBeenCalledOnce();
  });

  it("proves the configured Stripe account before any Price or Checkout request", async () => {
    const retrieveAccount = vi.fn(async () => ({ id: "acct_12345678" }));
    const retrievePrice = vi.fn(async () => ({
      active: true,
      currency: "usd",
      id: "price_pack06test",
      livemode: false,
      type: "one_time",
      unit_amount: 599,
    }));
    const createSession = vi.fn(async () => ({
      expires_at: 1_775_000_000,
      id: "cs_test_12345678",
      livemode: false,
      url: "https://checkout.stripe.com/c/pay/cs_test_12345678",
    }));
    const stripe = {
      accounts: { retrieveCurrent: retrieveAccount },
      checkout: { sessions: { create: createSession } },
      prices: { retrieve: retrievePrice },
    };
    const runtime = createStripeGateway(
      {
        accountId: "acct_12345678",
        priceIds: { pack_6: "price_pack06test" },
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      stripe as never,
    );
    const request = {
      cancelUrl: "https://example.test/en/store",
      clientReferenceId: orderId,
      countryCode: "US",
      currencyCode: "USD",
      idempotencyKey: `stripe:${orderId}:1`,
      metadata: { orderId, productCode: "pack_6" },
      mode: "payment" as const,
      productName: "6 Credits",
      quantity: 1 as const,
      returnUrl: "https://example.test/en/checkout/return",
      unitAmountMinor: 599,
    };

    await expect(runtime.attestAccount()).resolves.toBeUndefined();
    await expect(runtime.gateway.createCheckoutSession(request)).resolves.toMatchObject({
      id: "cs_test_12345678",
    });
    await expect(runtime.gateway.createCheckoutSession(request)).resolves.toMatchObject({
      id: "cs_test_12345678",
    });
    expect(retrieveAccount).toHaveBeenCalledOnce();
    expect(retrievePrice).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenCalledTimes(2);

    const mismatched = createStripeGateway(
      {
        accountId: "acct_87654321",
        priceIds: { pack_6: "price_pack06test" },
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      stripe as never,
    );
    await expect(mismatched.attestAccount()).rejects.toMatchObject({
      code: "configuration",
    });
    expect(retrievePrice).toHaveBeenCalledTimes(2);
  });

  it("submits one full Test Mode refund with provider idempotency and no client amount", async () => {
    const createRefund = vi.fn(async () => ({
      amount: 599,
      id: "re_12345678",
      livemode: false,
      metadata: { orderId },
      payment_intent: "pi_12345678",
      status: "pending",
    }));
    const runtime = createStripeGateway(
      {
        accountId: "acct_12345678",
        priceIds: { pack_6: "price_pack06test" },
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      {
        accounts: { retrieveCurrent: vi.fn(async () => ({ id: "acct_12345678" })) },
        refunds: { create: createRefund },
      } as never,
    );

    await expect(
      runtime.requestRefund({
        amountMinor: 599,
        idempotencyKey: `stripe:refund:${orderId}:1`,
        orderId,
        paymentIntentId: "pi_12345678",
      }),
    ).resolves.toEqual({ providerRefundId: "re_12345678" });
    expect(createRefund).toHaveBeenCalledWith(
      {
        amount: 599,
        metadata: { orderId },
        payment_intent: "pi_12345678",
      },
      { idempotencyKey: `stripe:refund:${orderId}:1` },
    );
  });

  it("rejects failed or mismatched refund responses instead of asserting completion", async () => {
    const base = {
      amount: 599,
      id: "re_12345678",
      livemode: false,
      metadata: { orderId },
      payment_intent: "pi_12345678",
    };
    const stripe = {
      accounts: { retrieveCurrent: vi.fn(async () => ({ id: "acct_12345678" })) },
      refunds: { create: vi.fn(async () => ({ ...base, status: "failed" })) },
    };
    const runtime = createStripeGateway(
      {
        accountId: "acct_12345678",
        priceIds: {},
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      stripe as never,
    );
    await expect(
      runtime.requestRefund({
        amountMinor: 599,
        idempotencyKey: `stripe:refund:${orderId}:1`,
        orderId,
        paymentIntentId: "pi_12345678",
      }),
    ).rejects.toMatchObject({ code: "rejected" });

    stripe.refunds.create.mockResolvedValueOnce({
      ...base,
      amount: 1,
      status: "pending",
    });
    await expect(
      runtime.requestRefund({
        amountMinor: 599,
        idempotencyKey: `stripe:refund:${orderId}:1`,
        orderId,
        paymentIntentId: "pi_12345678",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("resolves a payment intent to its exact Checkout Session", async () => {
    const list = vi.fn(async () => ({ data: [{ id: "cs_old" }] }));
    const stripe = { checkout: { sessions: { list } } };

    const normalized = await verifiedStripePaymentEvent(
      stripe as never,
      {
        created: 1_774_000_000,
        livemode: false,
        data: {
          object: {
            amount: 99,
            currency: "usd",
            id: "pi_old",
            metadata: { orderId },
          },
        },
        id: "evt_payment_intent_succeeded",
        type: "payment_intent.succeeded",
      } as never,
    );

    expect(list).toHaveBeenCalledWith({ limit: 2, payment_intent: "pi_old" });
    expect(normalized).toMatchObject({
      orderId,
      providerCheckoutSessionId: "cs_old",
      providerObjectId: "pi_old",
      providerPaymentIntentId: "pi_old",
      type: "payment_succeeded",
    });
  });

  it("rejects a payment intent that cannot resolve to one unambiguous Checkout Session", async () => {
    const stripe = {
      checkout: { sessions: { list: vi.fn(async () => ({ data: [] })) } },
    };

    await expect(
      verifiedStripePaymentEvent(
        stripe as never,
        {
          created: 1_774_000_000,
          livemode: false,
          data: {
            object: {
              amount: 99,
              currency: "usd",
              id: "pi_unbound",
              metadata: { orderId },
            },
          },
          id: "evt_unbound",
          type: "payment_intent.succeeded",
        } as never,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("keeps the provider charge object while associating a refund to the same attempt refs", async () => {
    const stripe = {
      checkout: {
        sessions: { list: vi.fn(async () => ({ data: [{ id: "cs_old" }] })) },
      },
    };

    await expect(
      verifiedStripePaymentEvent(
        stripe as never,
        {
          created: 1_774_000_000,
          livemode: false,
          data: {
            object: {
              amount_refunded: 99,
              currency: "usd",
              id: "ch_old",
              metadata: { orderId },
              payment_intent: "pi_old",
            },
          },
          id: "evt_refund",
          type: "charge.refunded",
        } as never,
      ),
    ).resolves.toMatchObject({
      orderId,
      providerCheckoutSessionId: "cs_old",
      providerObjectId: "ch_old",
      providerPaymentIntentId: "pi_old",
      type: "payment_refunded",
    });
  });

  it.each([
    ["checkout.session.completed", "unpaid", "payment_pending"],
    ["checkout.session.async_payment_failed", "unpaid", "payment_failed"],
    ["checkout.session.expired", "unpaid", "payment_expired"],
  ] as const)(
    "maps %s into %s without granting value",
    async (type, paymentStatus, expectedType) => {
      await expect(
        verifiedStripePaymentEvent(
          {} as never,
          {
            created: 1_774_000_000,
            data: {
              object: {
                amount_total: 599,
                client_reference_id: orderId,
                currency: "usd",
                id: `cs_test_${expectedType}`,
                mode: "payment",
                payment_intent: "pi_12345678",
                payment_status: paymentStatus,
              },
            },
            id: `evt_${expectedType}`,
            livemode: false,
            type,
          } as never,
        ),
      ).resolves.toMatchObject({
        amountMinor: 599,
        orderId,
        providerPaymentIntentId: "pi_12345678",
        type: expectedType,
      });
    },
  );

  it("accepts a signed Test Mode dispute and binds it to the exact Checkout attempt", async () => {
    const event = {
      created: 1_774_000_000,
      data: {
        object: {
          amount: 99,
          charge: "ch_disputed",
          currency: "usd",
          id: "dp_12345678",
        },
      },
      id: "evt_dispute",
      livemode: false,
      type: "charge.dispute.created",
    };
    const constructEventAsync = vi.fn(async () => event);
    const retrieveCharge = vi.fn(async () => ({
      currency: "usd",
      id: "ch_disputed",
      metadata: { orderId },
      payment_intent: "pi_disputed",
      refunded: false,
    }));
    const list = vi.fn(async () => ({ data: [{ id: "cs_disputed" }] }));
    const runtime = createStripeGateway(
      {
        accountId: "acct_12345678",
        priceIds: {},
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      {
        charges: { retrieve: retrieveCharge },
        checkout: { sessions: { list } },
        webhooks: { constructEventAsync },
      } as never,
    );
    const rawBody = new TextEncoder().encode('{"id":"evt_dispute"}');

    await expect(
      runtime.gateway.verifyWebhook({
        nowSeconds: 1_774_000_001,
        rawBody,
        signatureHeader: "t=1774000000,v1=synthetic",
        toleranceSeconds: 300,
      }),
    ).resolves.toMatchObject({
      amountMinor: 99,
      currencyCode: "USD",
      eventId: "evt_dispute",
      orderId,
      providerCheckoutSessionId: "cs_disputed",
      providerObjectId: "dp_12345678",
      providerPaymentIntentId: "pi_disputed",
      type: "payment_disputed",
    });
    expect(constructEventAsync).toHaveBeenCalledWith(
      rawBody,
      "t=1774000000,v1=synthetic",
      `whsec_${"b".repeat(24)}`,
      300,
      undefined,
      1_774_000_001_000,
    );
    expect(retrieveCharge).toHaveBeenCalledWith("ch_disputed");
    expect(list).toHaveBeenCalledWith({ limit: 2, payment_intent: "pi_disputed" });
  });

  it("rejects disputes for refunded charges before changing payment state", async () => {
    const stripe = {
      charges: {
        retrieve: vi.fn(async () => ({
          id: "ch_refunded",
          refunded: true,
        })),
      },
    };

    await expect(
      verifiedStripePaymentEvent(
        stripe as never,
        {
          created: 1_774_000_000,
          data: {
            object: {
              amount: 99,
              charge: "ch_refunded",
              currency: "usd",
              id: "dp_refunded",
            },
          },
          id: "evt_refunded_dispute",
          livemode: false,
          type: "charge.dispute.created",
        } as never,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("rejects every live-mode event before provider object retrieval", async () => {
    const list = vi.fn();
    const stripe = { checkout: { sessions: { list } } };

    await expect(
      verifiedStripePaymentEvent(
        stripe as never,
        {
          created: 1_774_000_000,
          data: { object: {} },
          id: "evt_live",
          livemode: true,
          type: "payment_intent.succeeded",
        } as never,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(list).not.toHaveBeenCalled();
  });
});
