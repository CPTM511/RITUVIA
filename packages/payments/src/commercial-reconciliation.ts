export const commercialReconciliationCaseTypes = Object.freeze([
  "provider_api_unavailable",
  "provider_payment_missing",
  "internal_payment_pending",
  "payment_state_mismatch",
  "payment_amount_mismatch",
  "payment_currency_mismatch",
  "payment_reference_mismatch",
  "credit_issuance_missing",
  "credit_issuance_duplicate",
  "credit_issuance_amount_mismatch",
  "fulfillment_state_mismatch",
  "settlement_availability_missing",
] as const);

export type CommercialReconciliationCaseType = (typeof commercialReconciliationCaseTypes)[number];

export type CommercialReconciliationFinding = Readonly<{
  caseType: CommercialReconciliationCaseType;
  severity: "critical" | "high";
}>;

export type CommercialReconciliationInternalSnapshot = Readonly<{
  amountMinor: number;
  creditGrantAmount: number;
  creditGrantCount: number;
  creditsExpected: number;
  currencyCode: string;
  fulfillmentAppliedPaymentStateVersion: number | null;
  fulfillmentStatus: "active" | "disputed" | "refunded" | "review_required" | null;
  orderStatus:
    | "cancelled"
    | "checkout_created"
    | "created"
    | "disputed"
    | "expired"
    | "failed"
    | "paid"
    | "partially_refunded"
    | "pending"
    | "refund_requested"
    | "refunded";
  paymentStateVersion: number;
  providerCheckoutId: string;
  providerPaymentIntentId: string | null;
}>;

export type CommercialReconciliationProviderSnapshot =
  | Readonly<{ availability: "missing" }>
  | Readonly<{ availability: "unavailable" }>
  | Readonly<{
      amountMinor: number;
      availability: "available";
      currencyCode: string;
      orderId: string | null;
      paymentState:
        "disputed" | "expired" | "failed" | "paid" | "partially_refunded" | "pending" | "refunded";
      providerCheckoutId: string;
      providerPaymentIntentId: string | null;
      settlementState: "available" | "missing" | "not_applicable" | "pending";
    }>;

const paidStates = new Set([
  "disputed",
  "paid",
  "partially_refunded",
  "refund_requested",
  "refunded",
]);

const expectedFulfillmentStatus = (
  state: CommercialReconciliationInternalSnapshot["orderStatus"],
): CommercialReconciliationInternalSnapshot["fulfillmentStatus"] => {
  if (state === "disputed") return "disputed";
  if (state === "refunded") return "refunded";
  if (state === "paid" || state === "partially_refunded" || state === "refund_requested") {
    return "active";
  }
  return null;
};

export const compareCommercialPayment = (input: {
  internal: CommercialReconciliationInternalSnapshot;
  orderId: string;
  provider: CommercialReconciliationProviderSnapshot;
}): readonly CommercialReconciliationFinding[] => {
  const findings: CommercialReconciliationFinding[] = [];
  const add = (
    caseType: CommercialReconciliationCaseType,
    severity: CommercialReconciliationFinding["severity"] = "high",
  ): void => {
    if (!findings.some((finding) => finding.caseType === caseType)) {
      findings.push(Object.freeze({ caseType, severity }));
    }
  };

  if (input.provider.availability === "unavailable") {
    add("provider_api_unavailable");
    return Object.freeze(findings);
  }
  if (input.provider.availability === "missing") {
    if (paidStates.has(input.internal.orderStatus)) add("provider_payment_missing", "critical");
    return Object.freeze(findings);
  }

  if (
    input.provider.providerCheckoutId !== input.internal.providerCheckoutId ||
    input.provider.providerPaymentIntentId !== input.internal.providerPaymentIntentId ||
    (input.provider.orderId !== null && input.provider.orderId !== input.orderId)
  ) {
    add("payment_reference_mismatch", "critical");
  }
  if (input.provider.amountMinor !== input.internal.amountMinor) {
    add("payment_amount_mismatch", "critical");
  }
  if (input.provider.currencyCode !== input.internal.currencyCode) {
    add("payment_currency_mismatch", "critical");
  }

  const internalPaid = paidStates.has(input.internal.orderStatus);
  const providerPaid = paidStates.has(input.provider.paymentState);
  if (providerPaid && !internalPaid) {
    add("internal_payment_pending", "critical");
  } else if (internalPaid && !providerPaid) {
    add("payment_state_mismatch", "critical");
  } else if (
    internalPaid &&
    providerPaid &&
    input.internal.orderStatus !== "refund_requested" &&
    input.internal.orderStatus !== input.provider.paymentState
  ) {
    add("payment_state_mismatch", "critical");
  }

  if (internalPaid) {
    if (input.internal.creditGrantCount === 0) {
      add("credit_issuance_missing", "critical");
    } else if (input.internal.creditGrantCount > 1) {
      add("credit_issuance_duplicate", "critical");
    }
    if (
      input.internal.creditGrantCount > 0 &&
      input.internal.creditGrantAmount !== input.internal.creditsExpected
    ) {
      add("credit_issuance_amount_mismatch", "critical");
    }
    if (
      input.internal.fulfillmentStatus !== expectedFulfillmentStatus(input.internal.orderStatus) ||
      input.internal.fulfillmentAppliedPaymentStateVersion !== input.internal.paymentStateVersion
    ) {
      add("fulfillment_state_mismatch", "critical");
    }
  }
  if (input.provider.paymentState === "paid" && input.provider.settlementState === "missing") {
    add("settlement_availability_missing");
  }

  return Object.freeze(findings);
};
