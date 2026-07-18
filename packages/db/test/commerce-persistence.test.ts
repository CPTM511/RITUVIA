import { describe, expect, it, vi } from "vitest";

import {
  createCommercePersistence,
  type CommerceTransitionResult,
  type PersistedCommerceOrder,
  type PreparedPaymentEvent,
} from "../src/commerce-persistence.js";

const orderId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const orderLineId = "33333333-3333-4333-8333-333333333333";
const oldAttemptId = "44444444-4444-4444-8444-444444444444";
const latestAttemptId = "55555555-5555-4555-8555-555555555555";
const paymentEventId = "66666666-6666-4666-8666-666666666666";
const ledgerEntryId = "77777777-7777-4777-8777-777777777777";
const entitlementId = "88888888-8888-4888-8888-888888888888";

const latestOrderRow = () => ({
  amountMinor: 99,
  checkoutExpiresAt: new Date("2026-07-18T12:30:00.000Z"),
  checkoutSessionId: "cs_latest",
  checkoutUrl: "https://checkout.stripe.com/c/pay/cs_latest",
  countryCode: "US",
  countryPolicyVersion: "local.us.v1",
  createdAt: new Date("2026-07-18T11:00:00.000Z"),
  currencyCode: "USD",
  entitlementCode: "sanctuary.mindful_incense",
  exactContents: ["One reusable digital incense object"],
  orderId,
  orderLineId,
  paymentAttemptId: latestAttemptId,
  paymentAttemptNumber: 2,
  priceVersion: "1.0.0",
  productCode: "mindful_incense",
  productVersion: "1.0.0",
  providerId: "stripe",
  refundPolicyVersion: "mvp.refund.v1",
  state: "paid",
  termsVersion: "mvp.terms.v1",
  updatedAt: new Date("2026-07-18T12:00:00.000Z"),
  userId,
});

const attemptRow = (input: {
  checkoutSessionId: string;
  id: string;
  number: number;
  paymentIntentId: string;
  state: string;
}) => ({
  checkoutExpiresAt: new Date("2026-07-18T11:30:00.000Z"),
  checkoutSessionId: input.checkoutSessionId,
  checkoutUrl: `https://checkout.stripe.com/c/pay/${input.checkoutSessionId}`,
  orderId,
  paymentAttemptId: input.id,
  paymentAttemptNumber: input.number,
  providerId: "stripe",
  providerPaymentIntentId: input.paymentIntentId,
  state: input.state,
});

const event = (): PreparedPaymentEvent => ({
  apiVersion: "stripe.verified-event.v1",
  amountMinor: 99,
  currencyCode: "USD",
  eventId: "evt_old_attempt_succeeded",
  eventType: "payment_succeeded",
  objectId: "pi_old",
  occurredAt: "2026-07-18T12:01:00.000Z",
  orderId,
  payloadDigest: new Uint8Array(32).fill(7),
  providerAccountFingerprint: "stripe.configured.v1",
  providerCheckoutSessionId: "cs_old",
  providerId: "stripe",
  providerPaymentIntentId: "pi_old",
  receivedAt: "2026-07-18T12:02:00.000Z",
});

describe("commerce payment event persistence", () => {
  it("associates a late success with its exact old attempt and records the second charge", async () => {
    const queryResults = [
      [latestOrderRow()],
      [
        attemptRow({
          checkoutSessionId: "cs_old",
          id: oldAttemptId,
          number: 1,
          paymentIntentId: "pi_old",
          state: "expired",
        }),
      ],
      [{ id: paymentEventId }],
      [],
      [latestOrderRow()],
    ];
    const queryRaw = vi.fn(async () => queryResults.shift() ?? []);
    const executeRaw = vi.fn(async () => 1);
    const transaction = { $executeRaw: executeRaw, $queryRaw: queryRaw };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const transition = vi.fn((order: PersistedCommerceOrder): CommerceTransitionResult => {
      expect(order.paymentAttemptId).toBe(oldAttemptId);
      expect(order.checkoutSessionId).toBe("cs_old");
      return {
        disposition: "ignored_out_of_order",
        entitlementDirective: "none",
        nextState: "paid",
      };
    });

    const result = await createCommercePersistence(database as never).processPaymentEvent(
      event(),
      { entitlementId, ledgerEntryId, paymentEventId },
      transition,
    );

    expect(result.disposition).toBe("ignored_out_of_order");
    expect(transition).toHaveBeenCalledOnce();
    expect(executeRaw).toHaveBeenCalledTimes(3);
    expect(executeRaw.mock.calls[0]).toContain(oldAttemptId);
    expect(executeRaw.mock.calls[1]).toContain(oldAttemptId);
    expect(executeRaw.mock.calls[0]).not.toContain(latestAttemptId);
    expect(executeRaw.mock.calls[1]).not.toContain(latestAttemptId);
  });

  it("rejects checkout and payment-intent references that resolve to different attempts", async () => {
    const queryResults = [
      [latestOrderRow()],
      [
        attemptRow({
          checkoutSessionId: "cs_old",
          id: oldAttemptId,
          number: 1,
          paymentIntentId: "pi_other",
          state: "expired",
        }),
        attemptRow({
          checkoutSessionId: "cs_latest",
          id: latestAttemptId,
          number: 2,
          paymentIntentId: "pi_old",
          state: "paid",
        }),
      ],
      [{ id: paymentEventId }],
    ];
    const queryRaw = vi.fn(async () => queryResults.shift() ?? []);
    const executeRaw = vi.fn(async () => 1);
    const transaction = { $executeRaw: executeRaw, $queryRaw: queryRaw };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const transition = vi.fn();

    const result = await createCommercePersistence(database as never).processPaymentEvent(
      event(),
      { entitlementId, ledgerEntryId, paymentEventId },
      transition,
    );

    expect(result).toEqual({ disposition: "rejected_mismatch", entitlement: null, order: null });
    expect(transition).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledOnce();
  });
});
