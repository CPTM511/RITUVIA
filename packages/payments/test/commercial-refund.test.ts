import { describe, expect, it } from "vitest";

import {
  commercialRefundEligibilityPolicyVersion,
  evaluateCommercialRefundEligibility,
  type CommercialRefundEligibilitySnapshot,
} from "../src/commercial-refund.js";

const eligible = (
  overrides: Partial<CommercialRefundEligibilitySnapshot> = {},
): CommercialRefundEligibilitySnapshot => ({
  countryCode: "US",
  creditsGranted: 6,
  currencyCode: "USD",
  environment: "sandbox",
  fulfillmentKind: "credit_pack",
  fulfillmentStatus: "active",
  grantedAmount: 6,
  heldAmount: 0,
  orderStatus: "paid",
  provider: "stripe",
  refundedMinor: 0,
  refundPolicyVersion: "local.refund.v1",
  reversedAmount: 0,
  shortfallAmount: 0,
  totalMinor: 599,
  unavailableAmount: 0,
  ...overrides,
});

describe("commercial sandbox refund eligibility", () => {
  it("allows one full refund only while every purchased Credit remains available", () => {
    expect(evaluateCommercialRefundEligibility(eligible())).toEqual({
      amountMinor: 599,
      creditsToHold: 6,
      eligible: true,
      policyVersion: commercialRefundEligibilityPolicyVersion,
    });
  });

  it("rejects consumed, reserved, held, reversed, or shortfall value", () => {
    for (const snapshot of [
      eligible({ unavailableAmount: 1 }),
      eligible({ heldAmount: 1 }),
      eligible({ reversedAmount: 1 }),
      eligible({ shortfallAmount: 1 }),
    ]) {
      expect(evaluateCommercialRefundEligibility(snapshot)).toEqual({
        eligible: false,
        reason: "credits_unavailable",
      });
    }
  });

  it("keeps repeated and completed refunds distinct", () => {
    expect(
      evaluateCommercialRefundEligibility(eligible({ orderStatus: "refund_requested" })),
    ).toEqual({
      eligible: false,
      reason: "already_requested",
    });
    expect(
      evaluateCommercialRefundEligibility(
        eligible({ orderStatus: "partially_refunded", refundedMinor: 100 }),
      ),
    ).toEqual({ eligible: false, reason: "already_refunded" });
    expect(
      evaluateCommercialRefundEligibility(
        eligible({ orderStatus: "refunded", refundedMinor: 599 }),
      ),
    ).toEqual({ eligible: false, reason: "already_refunded" });
  });

  it("fails closed for unpaid, non-sandbox, or non-Stripe orders", () => {
    expect(evaluateCommercialRefundEligibility(eligible({ orderStatus: "pending" }))).toEqual({
      eligible: false,
      reason: "not_paid",
    });
    expect(evaluateCommercialRefundEligibility(eligible({ environment: "production" }))).toEqual({
      eligible: false,
      reason: "unsupported_order",
    });
    expect(evaluateCommercialRefundEligibility(eligible({ provider: "coinbase" }))).toEqual({
      eligible: false,
      reason: "unsupported_order",
    });
    for (const snapshot of [
      eligible({ countryCode: "GB" }),
      eligible({ currencyCode: "EUR" }),
      eligible({ fulfillmentKind: "subscription" }),
      eligible({ refundPolicyVersion: "future.refund.v2" }),
    ]) {
      expect(evaluateCommercialRefundEligibility(snapshot)).toEqual({
        eligible: false,
        reason: "unsupported_order",
      });
    }
  });

  it("rejects incomplete or inconsistent fulfillment evidence", () => {
    expect(
      evaluateCommercialRefundEligibility(eligible({ fulfillmentStatus: "review_required" })),
    ).toEqual({ eligible: false, reason: "unsupported_order" });
    expect(evaluateCommercialRefundEligibility(eligible({ grantedAmount: 5 }))).toEqual({
      eligible: false,
      reason: "unsupported_order",
    });
    expect(() =>
      evaluateCommercialRefundEligibility(eligible({ heldAmount: 5, reversedAmount: 2 })),
    ).toThrow(TypeError);
  });
});
