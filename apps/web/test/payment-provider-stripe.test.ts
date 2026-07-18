import { describe, expect, it, vi } from "vitest";

import { verifiedStripePaymentEvent } from "../server/payment-provider";

const orderId = "11111111-1111-4111-8111-111111111111";

describe("Stripe verified event normalization", () => {
  it("resolves a payment intent to its exact Checkout Session", async () => {
    const list = vi.fn(async () => ({ data: [{ id: "cs_old" }] }));
    const stripe = { checkout: { sessions: { list } } };

    const normalized = await verifiedStripePaymentEvent(
      stripe as never,
      {
        created: 1_774_000_000,
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
});
