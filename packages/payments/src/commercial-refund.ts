import type { CommercialOrderState } from "./transaction-domain.js";

export const commercialRefundEligibilityPolicyVersion = "sandbox-unused-credit-refund.v1" as const;

export type CommercialRefundEligibilitySnapshot = Readonly<{
  countryCode: string;
  creditsGranted: number;
  currencyCode: string;
  environment: string;
  fulfillmentKind: string;
  fulfillmentStatus: string;
  grantedAmount: number;
  heldAmount: number;
  orderStatus: CommercialOrderState;
  provider: string;
  refundedMinor: number;
  refundPolicyVersion: string;
  reversedAmount: number;
  shortfallAmount: number;
  totalMinor: number;
  unavailableAmount: number;
}>;

export type CommercialRefundEligibility =
  | Readonly<{
      amountMinor: number;
      creditsToHold: number;
      eligible: true;
      policyVersion: typeof commercialRefundEligibilityPolicyVersion;
    }>
  | Readonly<{
      eligible: false;
      reason:
        | "already_refunded"
        | "already_requested"
        | "credits_unavailable"
        | "not_paid"
        | "unsupported_order";
    }>;

const requireAmount = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new TypeError("Commercial refund amount is invalid.");
  }
  return value;
};

export const evaluateCommercialRefundEligibility = (
  input: CommercialRefundEligibilitySnapshot,
): CommercialRefundEligibility => {
  const totalMinor = requireAmount(input.totalMinor);
  const refundedMinor = requireAmount(input.refundedMinor);
  const creditsGranted = requireAmount(input.creditsGranted);
  const grantedAmount = requireAmount(input.grantedAmount);
  const heldAmount = requireAmount(input.heldAmount);
  const reversedAmount = requireAmount(input.reversedAmount);
  const shortfallAmount = requireAmount(input.shortfallAmount);
  const unavailableAmount = requireAmount(input.unavailableAmount);

  if (
    totalMinor === 0 ||
    creditsGranted === 0 ||
    refundedMinor > totalMinor ||
    grantedAmount > creditsGranted ||
    heldAmount + reversedAmount + shortfallAmount > grantedAmount ||
    unavailableAmount > grantedAmount - heldAmount - reversedAmount
  ) {
    throw new TypeError("Commercial refund state is invalid.");
  }
  if (
    input.provider !== "stripe" ||
    input.environment !== "sandbox" ||
    input.countryCode !== "US" ||
    input.currencyCode !== "USD" ||
    input.fulfillmentKind !== "credit_pack" ||
    input.refundPolicyVersion !== "local.refund.v1"
  ) {
    return Object.freeze({ eligible: false, reason: "unsupported_order" });
  }
  if (input.orderStatus === "refund_requested") {
    return Object.freeze({ eligible: false, reason: "already_requested" });
  }
  if (
    input.orderStatus === "refunded" ||
    input.orderStatus === "partially_refunded" ||
    refundedMinor > 0
  ) {
    return Object.freeze({ eligible: false, reason: "already_refunded" });
  }
  if (input.orderStatus !== "paid") {
    return Object.freeze({ eligible: false, reason: "not_paid" });
  }
  if (input.fulfillmentStatus !== "active" || grantedAmount !== creditsGranted) {
    return Object.freeze({ eligible: false, reason: "unsupported_order" });
  }
  if (
    heldAmount !== 0 ||
    reversedAmount !== 0 ||
    shortfallAmount !== 0 ||
    unavailableAmount !== 0
  ) {
    return Object.freeze({ eligible: false, reason: "credits_unavailable" });
  }
  return Object.freeze({
    amountMinor: totalMinor,
    creditsToHold: creditsGranted,
    eligible: true,
    policyVersion: commercialRefundEligibilityPolicyVersion,
  });
};
