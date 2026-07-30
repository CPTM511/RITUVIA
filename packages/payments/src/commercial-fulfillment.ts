import type { CommercialOrderState } from "./transaction-domain.js";

export type CommercialCreditPackFulfillmentPlan = Readonly<{
  disposition:
    | "adjusted"
    | "granted"
    | "granted_and_adjusted"
    | "granted_and_held"
    | "held"
    | "review_required"
    | "unchanged";
  convertHeldAmount: number;
  grantAmount: number;
  holdAmount: number;
  reverseAmount: number;
  shortfallAmount: number;
}>;

const requireAmount = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new TypeError("Commercial Credit fulfillment amount is invalid.");
  }
  return value;
};

export const planCommercialCreditPackFulfillment = (input: {
  creditsGranted: number;
  grantedAmount: number;
  heldAmount: number;
  orderStatus: CommercialOrderState;
  reversedAmount: number;
  unavailableAmount: number;
}): CommercialCreditPackFulfillmentPlan => {
  const creditsGranted = requireAmount(input.creditsGranted);
  const grantedAmount = requireAmount(input.grantedAmount);
  const heldAmount = requireAmount(input.heldAmount);
  const reversedAmount = requireAmount(input.reversedAmount);
  const unavailableAmount = requireAmount(input.unavailableAmount);
  if (
    creditsGranted === 0 ||
    grantedAmount > creditsGranted ||
    reversedAmount > grantedAmount ||
    heldAmount > grantedAmount - reversedAmount ||
    unavailableAmount > grantedAmount - reversedAmount - heldAmount
  ) {
    throw new TypeError("Commercial Credit fulfillment state is invalid.");
  }

  const authoritative =
    input.orderStatus === "paid" ||
    input.orderStatus === "refunded" ||
    input.orderStatus === "disputed";
  const grantAmount = authoritative ? creditsGranted - grantedAmount : 0;
  if (input.orderStatus !== "refunded" && input.orderStatus !== "disputed") {
    if (input.orderStatus === "paid" && (heldAmount > 0 || reversedAmount > 0)) {
      throw new TypeError("Commercial Credit fulfillment state is invalid.");
    }
    return Object.freeze({
      disposition: grantAmount === 0 ? "unchanged" : "granted",
      convertHeldAmount: 0,
      grantAmount,
      holdAmount: 0,
      reverseAmount: 0,
      shortfallAmount: 0,
    });
  }

  const effectiveGranted = grantedAmount + grantAmount;
  const availableAmount = effectiveGranted - reversedAmount - heldAmount - unavailableAmount;
  const isDispute = input.orderStatus === "disputed";
  const holdAmount = isDispute ? availableAmount : 0;
  const convertHeldAmount = isDispute ? 0 : heldAmount;
  const reverseAmount = isDispute ? 0 : availableAmount;
  const shortfallAmount = unavailableAmount;
  const disposition =
    shortfallAmount > 0
      ? "review_required"
      : grantAmount > 0 && holdAmount > 0
        ? "granted_and_held"
        : holdAmount > 0
          ? "held"
          : grantAmount > 0 && (reverseAmount > 0 || convertHeldAmount > 0)
            ? "granted_and_adjusted"
            : reverseAmount > 0 || convertHeldAmount > 0
              ? "adjusted"
              : "unchanged";
  return Object.freeze({
    disposition,
    convertHeldAmount,
    grantAmount,
    holdAmount,
    reverseAmount,
    shortfallAmount,
  });
};
