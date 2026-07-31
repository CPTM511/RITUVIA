import { describe, expect, it, vi } from "vitest";

import {
  createStripeGateway,
  createWebPaymentProviderRegistry,
  stripeHostedCheckoutProviderId,
  verifiedStripePaymentEvent,
  verifiedStripeSubscriptionEvent,
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

  it("creates only a matching recurring Stripe Test Mode Checkout Session", async () => {
    const retrievePrice = vi.fn(async () => ({
      active: true,
      currency: "usd",
      id: "price_plusmonthlytest",
      livemode: false,
      recurring: { interval: "month" },
      type: "recurring",
      unit_amount: 999,
    }));
    const createSession = vi.fn(async () => ({
      expires_at: 1_775_000_000,
      id: "cs_test_subscription_12345678",
      livemode: false,
      url: "https://checkout.stripe.com/c/pay/cs_test_subscription_12345678",
    }));
    const runtime = createStripeGateway(
      {
        accountId: "acct_12345678",
        priceIds: { plus_monthly: "price_plusmonthlytest" },
        secretKey: `sk_test_${"a".repeat(24)}`,
        webhookSecret: `whsec_${"b".repeat(24)}`,
      },
      {
        accounts: { retrieveCurrent: vi.fn(async () => ({ id: "acct_12345678" })) },
        checkout: { sessions: { create: createSession } },
        prices: { retrieve: retrievePrice },
      } as never,
    );

    await expect(runtime.attestAccount()).resolves.toBeUndefined();
    const createSubscriptionCheckoutSession = runtime.gateway.createSubscriptionCheckoutSession;
    if (createSubscriptionCheckoutSession === undefined) throw new Error("missing subscription");
    await expect(
      createSubscriptionCheckoutSession({
        cancelUrl: "https://example.test/en/plans",
        clientReferenceId: orderId,
        countryCode: "US",
        currencyCode: "USD",
        idempotencyKey: `stripe:${orderId}:subscription`,
        metadata: { orderId, productCode: "plus_monthly" },
        mode: "subscription",
        productName: "RITUVIA Plus Monthly",
        quantity: 1,
        returnUrl: "https://example.test/en/checkout/return",
        subscriptionInterval: "month",
        unitAmountMinor: 999,
      }),
    ).resolves.toMatchObject({ id: "cs_test_subscription_12345678" });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: orderId,
        metadata: { orderId, productCode: "plus_monthly" },
        mode: "subscription",
        subscription_data: { metadata: { orderId, productCode: "plus_monthly" } },
      }),
      { idempotencyKey: `stripe:${orderId}:subscription` },
    );
  });

  it.each([
    ["customer.subscription.created", "subscription_created"],
    ["customer.subscription.updated", "subscription_changed"],
    ["customer.subscription.deleted", "subscription_canceled"],
  ] as const)("maps %s without allocating a subscription period", async (type, expectedType) => {
    await expect(
      verifiedStripeSubscriptionEvent(
        {} as never,
        {
          created: 1_774_000_000,
          data: {
            object: {
              cancel_at_period_end: type === "customer.subscription.updated",
              current_period_end: 1_776_678_400,
              current_period_start: 1_774_000_000,
              customer: "cus_12345678",
              id: "sub_12345678",
              items: { data: [{ price: { recurring: { interval: "month" } } }] },
              metadata: { orderId, productCode: "plus_monthly" },
            },
          },
          id: `evt_${expectedType}`,
          livemode: false,
          type,
        } as never,
      ),
    ).resolves.toMatchObject({
      amount: null,
      cancelAtPeriodEnd: type === "customer.subscription.updated",
      orderId,
      providerSubscriptionId: "sub_12345678",
      type: expectedType,
    });
  });

  it.each([
    ["invoice.paid", "subscription_period_paid", "amount_paid"],
    ["invoice.payment_failed", "subscription_payment_failed", "amount_due"],
    ["invoice.payment_action_required", "subscription_payment_failed", "amount_due"],
  ] as const)(
    "maps %s to a precise subscription period fact",
    async (type, expectedType, amountField) => {
      const retrieveSubscription = vi.fn(async () => ({
        cancel_at_period_end: false,
        current_period_end: 1_776_678_400,
        current_period_start: 1_774_000_000,
        customer: "cus_12345678",
        id: "sub_12345678",
        items: { data: [{ price: { recurring: { interval: "month" } } }] },
        metadata: { orderId, productCode: "plus_monthly" },
      }));
      const invoice = {
        amount_due: 999,
        amount_paid: 999,
        currency: "usd",
        customer: "cus_12345678",
        id: "in_12345678",
        subscription: "sub_12345678",
      };
      await expect(
        verifiedStripeSubscriptionEvent(
          { subscriptions: { retrieve: retrieveSubscription } } as never,
          {
            created: 1_774_000_000,
            data: { object: invoice },
            id: `evt_${expectedType}`,
            livemode: false,
            type,
          } as never,
        ),
      ).resolves.toMatchObject({
        amount: { amountMinor: invoice[amountField], currencyCode: "USD" },
        providerInvoiceId: "in_12345678",
        providerSubscriptionId: "sub_12345678",
        type: expectedType,
      });
      expect(retrieveSubscription).toHaveBeenCalledWith("sub_12345678");
    },
  );

  it("verifies a subscription Checkout completion without granting value", async () => {
    const retrieveSubscription = vi.fn(async () => ({
      cancel_at_period_end: false,
      current_period_end: 1_776_678_400,
      current_period_start: 1_774_000_000,
      customer: "cus_12345678",
      id: "sub_12345678",
      items: { data: [{ price: { recurring: { interval: "month" } } }] },
      metadata: { orderId, productCode: "plus_monthly" },
    }));
    await expect(
      verifiedStripeSubscriptionEvent(
        { subscriptions: { retrieve: retrieveSubscription } } as never,
        {
          created: 1_774_000_000,
          data: {
            object: {
              client_reference_id: orderId,
              id: "cs_test_12345678",
              mode: "subscription",
              subscription: "sub_12345678",
            },
          },
          id: "evt_subscription_checkout",
          livemode: false,
          type: "checkout.session.completed",
        } as never,
      ),
    ).resolves.toMatchObject({
      amount: null,
      providerObjectId: "cs_test_12345678",
      type: "subscription_checkout_completed",
    });
  });

  it("maps a subscription refund only through its exact invoice and subscription", async () => {
    const retrieveInvoice = vi.fn(async () => ({
      currency: "usd",
      customer: "cus_12345678",
      id: "in_12345678",
      subscription: "sub_12345678",
    }));
    const retrieveSubscription = vi.fn(async () => ({
      cancel_at_period_end: false,
      current_period_end: 1_776_678_400,
      current_period_start: 1_774_000_000,
      customer: "cus_12345678",
      id: "sub_12345678",
      items: { data: [{ price: { recurring: { interval: "month" } } }] },
      metadata: { orderId, productCode: "plus_monthly" },
    }));

    await expect(
      verifiedStripeSubscriptionEvent(
        {
          invoices: { retrieve: retrieveInvoice },
          subscriptions: { retrieve: retrieveSubscription },
        } as never,
        {
          created: 1_774_000_000,
          data: {
            object: {
              amount: 999,
              amount_refunded: 999,
              currency: "usd",
              id: "ch_12345678",
              invoice: "in_12345678",
            },
          },
          id: "evt_subscription_refund",
          livemode: false,
          type: "charge.refunded",
        } as never,
      ),
    ).resolves.toMatchObject({
      providerChargeId: "ch_12345678",
      providerInvoiceId: "in_12345678",
      providerSubscriptionId: "sub_12345678",
      type: "subscription_refunded",
    });

    await expect(
      verifiedStripeSubscriptionEvent(
        {
          invoices: { retrieve: retrieveInvoice },
          subscriptions: { retrieve: retrieveSubscription },
        } as never,
        {
          created: 1_774_000_000,
          data: {
            object: {
              amount: 999,
              amount_refunded: 499,
              currency: "usd",
              id: "ch_partial",
              invoice: "in_12345678",
            },
          },
          id: "evt_subscription_partial_refund",
          livemode: false,
          type: "charge.refunded",
        } as never,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("rejects live, unsupported, or mismatched subscription facts before persistence", async () => {
    const retrieveSubscription = vi.fn();
    await expect(
      verifiedStripeSubscriptionEvent(
        { subscriptions: { retrieve: retrieveSubscription } } as never,
        {
          created: 1_774_000_000,
          data: { object: {} },
          id: "evt_live_subscription",
          livemode: true,
          type: "invoice.paid",
        } as never,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(retrieveSubscription).not.toHaveBeenCalled();

    await expect(
      verifiedStripeSubscriptionEvent(
        {} as never,
        {
          created: 1_774_000_000,
          data: { object: {} },
          id: "evt_unknown_subscription",
          livemode: false,
          type: "invoice.voided",
        } as never,
      ),
    ).rejects.toMatchObject({ code: "unavailable" });

    await expect(
      verifiedStripeSubscriptionEvent(
        {
          subscriptions: {
            retrieve: vi.fn(async () => ({
              cancel_at_period_end: false,
              current_period_end: 1_776_678_400,
              current_period_start: 1_774_000_000,
              customer: "cus_other",
              id: "sub_12345678",
              items: { data: [{ price: { recurring: { interval: "month" } } }] },
              metadata: { orderId, productCode: "plus_monthly" },
            })),
          },
        } as never,
        {
          created: 1_774_000_000,
          data: {
            object: {
              amount_paid: 999,
              currency: "usd",
              customer: "cus_12345678",
              id: "in_12345678",
              subscription: "sub_12345678",
            },
          },
          id: "evt_mismatched_subscription",
          livemode: false,
          type: "invoice.paid",
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
