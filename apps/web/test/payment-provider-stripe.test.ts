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
        mode: "test",
        priceIds: { pack_6: "price_pack06test" },
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      stripe as never,
    );
    const request = {
      billingInterval: "one_time" as const,
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
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_address_collection: "required",
        metadata: { countryCode: "US", orderId, productCode: "pack_6" },
        payment_intent_data: {
          metadata: { countryCode: "US", orderId, productCode: "pack_6" },
        },
      }),
      { idempotencyKey: `stripe:${orderId}:1` },
    );

    const mismatched = createStripeGateway(
      {
        accountId: "acct_87654321",
        mode: "test",
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

  it("accepts only fully activated Live account, Price, and Checkout objects in live mode", async () => {
    const stripe = {
      accounts: {
        retrieveCurrent: vi.fn(async () => ({
          charges_enabled: true,
          details_submitted: true,
          id: "acct_12345678",
        })),
      },
      checkout: {
        sessions: {
          create: vi.fn(async () => ({
            expires_at: 1_775_000_000,
            id: "cs_live_12345678",
            livemode: true,
            url: "https://checkout.stripe.com/c/pay/cs_live_12345678",
          })),
        },
      },
      prices: {
        retrieve: vi.fn(async () => ({
          active: true,
          currency: "usd",
          id: "price_pack06live",
          livemode: true,
          type: "one_time",
          unit_amount: 599,
        })),
      },
    };
    const runtime = createStripeGateway(
      {
        accountId: "acct_12345678",
        mode: "live",
        priceIds: { pack_6: "price_pack06live" },
        secretKey: `rk_live_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      stripe as never,
    );

    await expect(
      runtime.gateway.createCheckoutSession({
        billingInterval: "one_time",
        cancelUrl: "https://example.com/en/plans",
        clientReferenceId: orderId,
        countryCode: "US",
        currencyCode: "USD",
        idempotencyKey: `stripe:${orderId}:1`,
        metadata: { orderId, productCode: "pack_6" },
        mode: "payment",
        productName: "6 Credits",
        quantity: 1,
        returnUrl: "https://example.com/en/checkout/return",
        unitAmountMinor: 599,
      }),
    ).resolves.toMatchObject({ id: "cs_live_12345678" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_address_collection: "required",
        metadata: { countryCode: "US", orderId, productCode: "pack_6" },
        payment_intent_data: {
          metadata: { countryCode: "US", orderId, productCode: "pack_6" },
        },
      }),
      { idempotencyKey: `stripe:${orderId}:1` },
    );
    expect(() =>
      createStripeGateway({
        accountId: "acct_12345678",
        mode: "live",
        priceIds: { pack_6: "price_pack06live" },
        secretKey: `sk_live_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      }),
    ).toThrowError("The payment provider is unavailable.");
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
      "test",
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
        "test",
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
        "test",
      ),
    ).resolves.toMatchObject({
      orderId,
      providerCheckoutSessionId: "cs_old",
      providerObjectId: "ch_old",
      providerPaymentIntentId: "pi_old",
      type: "payment_refunded",
    });
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
        "test",
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(list).not.toHaveBeenCalled();
  });
});
