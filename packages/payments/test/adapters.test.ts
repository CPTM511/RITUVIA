import { describe, expect, it, vi } from "vitest";

import { createMoney, CommerceError, type NormalizedPaymentEventV1 } from "../src/index.js";
import {
  createLocalHostedCheckoutAdapter,
  type LocalHostedCheckoutAdapter,
} from "../src/adapters/local-hosted-checkout.js";
import {
  createStripeHostedCheckoutAdapter,
  type StripeGateway,
} from "../src/adapters/stripe-hosted-checkout.js";

const localSecret = new Uint8Array(32).fill(7);
const checkoutInput = (providerId: string) => ({
  accountId: "account_11111111",
  amount: createMoney(99, "USD"),
  cancelUrl: "http://127.0.0.1:4175/en/sanctuary",
  countryCode: "US",
  idempotencyKey: "idempotency_11111111",
  orderId: "order_11111111",
  productCode: "mindful_incense",
  productName: "Mindful incense",
  providerId,
  returnUrl: "http://127.0.0.1:4175/en/checkout/return",
});
const localEvent = (): NormalizedPaymentEventV1 => ({
  amount: createMoney(99, "USD"),
  eventId: "event_local_success",
  occurredAt: "2026-07-18T12:00:00.000Z",
  orderId: "order_11111111",
  providerCheckoutSessionId: "local_checkout_11111111",
  providerId: "local_hosted",
  providerObjectId: "local_checkout_11111111",
  providerPaymentIntentId: null,
  type: "payment_succeeded",
});

const localAdapter = (clock: () => string): LocalHostedCheckoutAdapter =>
  createLocalHostedCheckoutAdapter({
    clock,
    environment: "local",
    idFactory: () => "checkout_11111111",
    origin: "http://127.0.0.1:4175",
    signingSecret: localSecret,
  });

describe("signed local hosted checkout adapter", () => {
  it("cannot be constructed outside local or against a non-loopback origin", () => {
    expect(() =>
      createLocalHostedCheckoutAdapter({
        clock: () => "2026-07-18T12:00:00.000Z",
        environment: "staging",
        idFactory: () => "checkout_1",
        origin: "http://127.0.0.1:4175",
        signingSecret: localSecret,
      }),
    ).toThrow(CommerceError);
    expect(() =>
      createLocalHostedCheckoutAdapter({
        clock: () => "2026-07-18T12:00:00.000Z",
        environment: "local",
        idFactory: () => "checkout_1",
        origin: "https://example.com",
        signingSecret: localSecret,
      }),
    ).toThrow(CommerceError);
  });

  it("creates only a local hosted URL and does not represent payment success", async () => {
    const adapter = localAdapter(() => "2026-07-18T12:00:00.000Z");
    const checkout = await adapter.createCheckout(checkoutInput("local_hosted"));
    expect(checkout).toEqual({
      checkoutId: "local_checkout_11111111",
      expiresAt: "2026-07-18T12:30:00.000Z",
      providerId: "local_hosted",
      url: "http://127.0.0.1:4175/en/checkout/local?checkout_id=local_checkout_11111111",
    });
  });

  it("round-trips an exact signed raw webhook", async () => {
    const adapter = localAdapter(() => "2026-07-18T12:00:00.000Z");
    const signed = await adapter.createSignedWebhook(localEvent());
    await expect(adapter.verifyWebhook(signed)).resolves.toEqual(localEvent());
  });

  it("rejects tampered raw bytes and payloads older than five minutes", async () => {
    let current = "2026-07-18T12:00:00.000Z";
    const adapter = localAdapter(() => current);
    const signed = await adapter.createSignedWebhook(localEvent());
    const tampered = signed.rawBody.slice();
    tampered[tampered.length - 2] = (tampered[tampered.length - 2] ?? 0) ^ 1;
    await expect(adapter.verifyWebhook({ ...signed, rawBody: tampered })).rejects.toMatchObject({
      code: "WEBHOOK_INVALID",
    });

    current = "2026-07-18T12:05:01.000Z";
    await expect(adapter.verifyWebhook(signed)).rejects.toMatchObject({
      code: "WEBHOOK_REPLAYED",
    });
  });

  it("rejects a signed payload for another provider", async () => {
    const adapter = localAdapter(() => "2026-07-18T12:00:00.000Z");
    await expect(
      adapter.createSignedWebhook({ ...localEvent(), providerId: "stripe" }),
    ).rejects.toBeInstanceOf(CommerceError);
  });
});

describe("Stripe hosted checkout boundary", () => {
  const stripeInput = () => ({
    ...checkoutInput("stripe"),
    cancelUrl: "https://rituvia.example/en/sanctuary",
    returnUrl: "https://rituvia.example/en/checkout/return",
  });

  it("maps server-owned checkout data into the injected Stripe gateway", async () => {
    const createCheckoutSession = vi.fn(async () => ({
      expiresAt: "2026-07-18T12:30:00.000Z",
      id: "cs_test_11111111",
      url: "https://checkout.stripe.com/c/pay/cs_test_11111111#fidkdWxOYHwnPyd1blpxYHZxWjA0",
    }));
    const gateway: StripeGateway = {
      createCheckoutSession,
      verifyWebhook: async () => ({ verified: true }),
    };
    const adapter = createStripeHostedCheckoutAdapter({
      clock: () => "2026-07-18T12:00:00.000Z",
      gateway,
      mapVerifiedEvent: () => ({ ...localEvent(), providerId: "stripe" }),
    });
    await expect(adapter.createCheckout(stripeInput())).resolves.toMatchObject({
      checkoutId: "cs_test_11111111",
      providerId: "stripe",
      url: "https://checkout.stripe.com/c/pay/cs_test_11111111#fidkdWxOYHwnPyd1blpxYHZxWjA0",
    });
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        clientReferenceId: "order_11111111",
        currencyCode: "USD",
        idempotencyKey: "idempotency_11111111",
        metadata: {
          orderId: "order_11111111",
          productCode: "mindful_incense",
        },
        mode: "payment",
        quantity: 1,
        unitAmountMinor: 99,
      }),
    );
  });

  it("requires raw Stripe signature timing before calling the provider verifier", async () => {
    const verifyWebhook = vi.fn(async () => ({ verified: true }));
    const adapter = createStripeHostedCheckoutAdapter({
      clock: () => "2026-07-18T12:00:00.000Z",
      gateway: {
        createCheckoutSession: async () => ({
          expiresAt: "2026-07-18T12:30:00.000Z",
          id: "cs_test_11111111",
          url: "https://checkout.stripe.com/c/pay/cs_test_11111111",
        }),
        verifyWebhook,
      },
      mapVerifiedEvent: () => ({ ...localEvent(), providerId: "stripe" }),
    });
    const rawBody = new TextEncoder().encode('{"id":"evt_1"}');
    const currentSeconds = Math.floor(Date.parse("2026-07-18T12:00:00.000Z") / 1_000);
    const signature = "a".repeat(64);
    await expect(
      adapter.verifyWebhook({
        headers: { "stripe-signature": `t=${currentSeconds},v1=${signature}` },
        rawBody,
      }),
    ).resolves.toMatchObject({ providerId: "stripe", type: "payment_succeeded" });
    expect(verifyWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: expect.any(Uint8Array),
        toleranceSeconds: 300,
      }),
    );

    await expect(
      adapter.verifyWebhook({
        headers: { "stripe-signature": `t=${currentSeconds - 301},v1=${signature}` },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "WEBHOOK_REPLAYED" });
    expect(verifyWebhook).toHaveBeenCalledTimes(1);
  });

  it("normalizes provider failures without exposing provider details", async () => {
    const adapter = createStripeHostedCheckoutAdapter({
      clock: () => "2026-07-18T12:00:00.000Z",
      gateway: {
        createCheckoutSession: async () => {
          throw new Error("private provider canary");
        },
        verifyWebhook: async () => {
          throw new Error("private webhook canary");
        },
      },
      mapVerifiedEvent: () => ({ ...localEvent(), providerId: "stripe" }),
    });
    try {
      await adapter.createCheckout(stripeInput());
    } catch (error) {
      expect(error).toMatchObject({ code: "CHECKOUT_PROVIDER_FAILURE" });
      expect(String(error)).not.toContain("private provider canary");
    }
  });

  it("normalizes mapper failures without exposing mapper details", async () => {
    const rawBody = new TextEncoder().encode('{"id":"evt_1"}');
    const currentSeconds = Math.floor(Date.parse("2026-07-18T12:00:00.000Z") / 1_000);
    const adapter = createStripeHostedCheckoutAdapter({
      clock: () => "2026-07-18T12:00:00.000Z",
      gateway: {
        createCheckoutSession: async () => ({
          expiresAt: "2026-07-18T12:30:00.000Z",
          id: "cs_test_11111111",
          url: "https://checkout.stripe.com/c/pay/cs_test_11111111",
        }),
        verifyWebhook: async () => ({ verified: true }),
      },
      mapVerifiedEvent: () => {
        throw new Error("private mapper canary");
      },
    });

    let caught: unknown;
    try {
      await adapter.verifyWebhook({
        headers: { "stripe-signature": `t=${currentSeconds},v1=${"a".repeat(64)}` },
        rawBody,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "WEBHOOK_INVALID" });
    expect(String(caught)).not.toContain("private mapper canary");
  });

  it("rejects a malformed event returned by the verified-event mapper", async () => {
    const rawBody = new TextEncoder().encode('{"id":"evt_1"}');
    const currentSeconds = Math.floor(Date.parse("2026-07-18T12:00:00.000Z") / 1_000);
    const adapter = createStripeHostedCheckoutAdapter({
      clock: () => "2026-07-18T12:00:00.000Z",
      gateway: {
        createCheckoutSession: async () => ({
          expiresAt: "2026-07-18T12:30:00.000Z",
          id: "cs_test_11111111",
          url: "https://checkout.stripe.com/c/pay/cs_test_11111111",
        }),
        verifyWebhook: async () => ({ verified: true }),
      },
      mapVerifiedEvent: () =>
        ({
          ...localEvent(),
          amount: { amountMinor: 0.99, currencyCode: "USD" },
          providerId: "stripe",
        }) as unknown as NormalizedPaymentEventV1,
    });

    await expect(
      adapter.verifyWebhook({
        headers: { "stripe-signature": `t=${currentSeconds},v1=${"a".repeat(64)}` },
        rawBody,
      }),
    ).rejects.toMatchObject({ code: "WEBHOOK_INVALID" });
  });
});
