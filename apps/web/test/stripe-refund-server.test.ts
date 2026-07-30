import { describe, expect, it, vi } from "vitest";

import {
  createStripeRefundApplicationService,
  type StripeRefundApplicationDependencies,
} from "../server/stripe-refund";
import { WebPaymentProviderError } from "../server/payment-provider";

const userId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const refundId = "33333333-3333-4333-8333-333333333333";
const now = "2026-07-30T12:00:00.000Z";

const prepared = Object.freeze({
  amountMinor: 599,
  currencyCode: "USD",
  eligibilityPolicyVersion: "sandbox-unused-credit-refund.v1",
  kind: "created" as const,
  orderId,
  orderStatus: "paid",
  providerIdempotencyKey: `stripe:refund:${refundId}:1`,
  providerPaymentIntentId: "pi_12345678",
  providerRefundId: null,
  refundId,
  refundPolicyVersion: "test:local:refund.v1",
  requestStatus: "prepared" as const,
});

const harness = (overrides: Partial<StripeRefundApplicationDependencies> = {}) => {
  const prepareStripeSandboxRefund = vi.fn(async () => prepared);
  const rejectStripeSandboxRefund = vi.fn(async () => undefined);
  const submitStripeSandboxRefund = vi.fn(async () => ({
    ...prepared,
    orderStatus: "refund_requested",
    providerRefundId: "re_12345678",
    requestStatus: "submitted" as const,
  }));
  const requestRefund = vi.fn(async () => ({ providerRefundId: "re_12345678" }));
  const dependencies: StripeRefundApplicationDependencies = {
    accounts: {
      getProfile: async () => ({ id: userId, status: "active" }),
      resolveSession: async () => ({ userId }),
    },
    clock: () => now,
    environment: "local",
    idFactory: () => refundId,
    paymentProvider: {
      attestAccount: async () => undefined,
      requestRefund,
    },
    persistence: {
      prepareStripeSandboxRefund,
      rejectStripeSandboxRefund,
      submitStripeSandboxRefund,
    },
    providerAccountFingerprint: "acct_12345678",
    ...overrides,
  };
  return {
    prepareStripeSandboxRefund,
    rejectStripeSandboxRefund,
    requestRefund,
    service: createStripeRefundApplicationService(dependencies),
    submitStripeSandboxRefund,
  };
};

describe("Stripe sandbox refund application service", () => {
  it("uses persisted server authority and remains pending until signed provider confirmation", async () => {
    const test = harness();

    await expect(
      test.service.requestRefund({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        orderId,
        sessionToken: "session-token",
      }),
    ).resolves.toEqual({
      amountMinor: 599,
      currencyCode: "USD",
      eligibilityPolicyVersion: "sandbox-unused-credit-refund.v1",
      kind: "created",
      orderId,
      providerConfirmationPending: true,
      refundId,
      refundPolicyVersion: "test:local:refund.v1",
      state: "refund_requested",
    });
    expect(test.requestRefund).toHaveBeenCalledWith({
      amountMinor: 599,
      idempotencyKey: `stripe:refund:${refundId}:1`,
      orderId,
      paymentIntentId: "pi_12345678",
    });
    expect(test.submitStripeSandboxRefund).toHaveBeenCalledWith({
      providerRefundId: "re_12345678",
      refundId,
      submittedAt: now,
      userId,
    });
  });

  it("replays a submitted request without a second provider call", async () => {
    const prepareStripeSandboxRefund = vi.fn(async () => ({
      ...prepared,
      kind: "replayed" as const,
      orderStatus: "refund_requested",
      providerRefundId: "re_12345678",
      requestStatus: "submitted" as const,
    }));
    const test = harness({
      persistence: {
        prepareStripeSandboxRefund,
        rejectStripeSandboxRefund: vi.fn(),
        submitStripeSandboxRefund: vi.fn(),
      },
    });

    await expect(
      test.service.requestRefund({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        orderId,
        sessionToken: "session-token",
      }),
    ).resolves.toMatchObject({ kind: "replayed", state: "refund_requested" });
    expect(test.requestRefund).not.toHaveBeenCalled();
  });

  it("reports a signed-event-confirmed replay without another provider call", async () => {
    const prepareStripeSandboxRefund = vi.fn(async () => ({
      ...prepared,
      kind: "replayed" as const,
      orderStatus: "refunded",
      providerRefundId: "re_12345678",
      requestStatus: "confirmed" as const,
    }));
    const test = harness({
      persistence: {
        prepareStripeSandboxRefund,
        rejectStripeSandboxRefund: vi.fn(),
        submitStripeSandboxRefund: vi.fn(),
      },
    });

    await expect(
      test.service.requestRefund({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        orderId,
        sessionToken: "session-token",
      }),
    ).resolves.toMatchObject({
      kind: "replayed",
      providerConfirmationPending: false,
      state: "refunded",
    });
    expect(test.requestRefund).not.toHaveBeenCalled();
  });

  it("releases the request hold only for a definitive provider rejection", async () => {
    const requestRefund = vi.fn(async () => {
      throw new WebPaymentProviderError("rejected");
    });
    const test = harness({
      paymentProvider: {
        attestAccount: async () => undefined,
        requestRefund,
      },
    });

    await expect(
      test.service.requestRefund({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        orderId,
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(test.rejectStripeSandboxRefund).toHaveBeenCalledWith({
      refundId,
      rejectedAt: now,
      userId,
    });
    expect(test.submitStripeSandboxRefund).not.toHaveBeenCalled();
  });

  it("keeps the hold and provider idempotency authority after an ambiguous outage", async () => {
    const test = harness({
      paymentProvider: {
        attestAccount: async () => undefined,
        requestRefund: async () => {
          throw new WebPaymentProviderError("unavailable");
        },
      },
    });

    await expect(
      test.service.requestRefund({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        orderId,
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(test.rejectStripeSandboxRefund).not.toHaveBeenCalled();
  });
});
