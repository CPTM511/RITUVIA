import { describe, expect, it } from "vitest";

import {
  compareCommercialPayment,
  type CommercialReconciliationInternalSnapshot,
  type CommercialReconciliationProviderSnapshot,
} from "../src/index.js";

const internal = (
  overrides: Partial<CommercialReconciliationInternalSnapshot> = {},
): CommercialReconciliationInternalSnapshot => ({
  amountMinor: 599,
  creditGrantAmount: 6,
  creditGrantCount: 1,
  creditsExpected: 6,
  currencyCode: "USD",
  fulfillmentAppliedPaymentStateVersion: 1,
  fulfillmentStatus: "active",
  orderStatus: "paid",
  paymentStateVersion: 1,
  providerCheckoutId: "cs_test_123",
  providerPaymentIntentId: "pi_123",
  ...overrides,
});

const provider = (
  overrides: Partial<
    Extract<CommercialReconciliationProviderSnapshot, { availability: "available" }>
  > = {},
): Extract<CommercialReconciliationProviderSnapshot, { availability: "available" }> => ({
  amountMinor: 599,
  availability: "available",
  currencyCode: "USD",
  orderId: "12345678-1234-4123-8123-123456789abc",
  paymentState: "paid",
  providerCheckoutId: "cs_test_123",
  providerPaymentIntentId: "pi_123",
  settlementState: "available",
  ...overrides,
});

const caseTypes = (value: ReturnType<typeof compareCommercialPayment>): readonly string[] =>
  value.map((finding) => finding.caseType);

describe("commercial payment reconciliation", () => {
  it("returns no findings for matching paid and fulfilled facts", () => {
    expect(
      compareCommercialPayment({
        internal: internal(),
        orderId: "12345678-1234-4123-8123-123456789abc",
        provider: provider(),
      }),
    ).toEqual([]);
  });

  it("detects a missed webhook and missing Credit issuance", () => {
    expect(
      caseTypes(
        compareCommercialPayment({
          internal: internal({
            creditGrantAmount: 0,
            creditGrantCount: 0,
            fulfillmentAppliedPaymentStateVersion: null,
            fulfillmentStatus: null,
            orderStatus: "pending",
            paymentStateVersion: 0,
          }),
          orderId: "12345678-1234-4123-8123-123456789abc",
          provider: provider(),
        }),
      ),
    ).toEqual(["internal_payment_pending"]);
  });

  it("detects provider, amount, reference, duplicate issuance, and payout differences", () => {
    expect(
      caseTypes(
        compareCommercialPayment({
          internal: internal({
            creditGrantAmount: 12,
            creditGrantCount: 2,
          }),
          orderId: "12345678-1234-4123-8123-123456789abc",
          provider: provider({
            amountMinor: 699,
            orderId: "22345678-1234-4123-8123-123456789abc",
            providerPaymentIntentId: "pi_wrong",
            settlementState: "missing",
          }),
        }),
      ),
    ).toEqual([
      "payment_reference_mismatch",
      "payment_amount_mismatch",
      "credit_issuance_duplicate",
      "credit_issuance_amount_mismatch",
      "settlement_availability_missing",
    ]);
  });

  it("distinguishes missing provider evidence from provider API failure", () => {
    expect(
      caseTypes(
        compareCommercialPayment({
          internal: internal(),
          orderId: "12345678-1234-4123-8123-123456789abc",
          provider: { availability: "missing" },
        }),
      ),
    ).toEqual(["provider_payment_missing"]);
    expect(
      caseTypes(
        compareCommercialPayment({
          internal: internal(),
          orderId: "12345678-1234-4123-8123-123456789abc",
          provider: { availability: "unavailable" },
        }),
      ),
    ).toEqual(["provider_api_unavailable"]);
  });

  it("detects refund and dispute fulfillment mismatches", () => {
    expect(
      caseTypes(
        compareCommercialPayment({
          internal: internal({
            fulfillmentStatus: "active",
            orderStatus: "refunded",
            paymentStateVersion: 3,
          }),
          orderId: "12345678-1234-4123-8123-123456789abc",
          provider: provider({ paymentState: "refunded", settlementState: "not_applicable" }),
        }),
      ),
    ).toEqual(["fulfillment_state_mismatch"]);
  });
});
