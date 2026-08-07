import type { Locale } from "./routing";

export type CommerceMessages = Readonly<{
  recoveryCommerce: Readonly<{
    accountRequired: string;
    billingEmpty: string;
    billingTitle: string;
    cancellationScheduled: string;
    checkout: string;
    checkoutError: string;
    checkoutPending: string;
    creditsLabel: string;
    creditsPlusLabel: string;
    creditsPurchasedLabel: string;
    creditsReservedLabel: string;
    fulfillmentAwaiting: string;
    fulfillmentVerified: string;
    ledgerTitle: string;
    ledgerAdded: string;
    ledgerAdjustment: string;
    ledgerOther: string;
    ledgerPurchased: string;
    ledgerRemoved: string;
    ledgerSubscription: string;
    loadError: string;
    loading: string;
    ordersEmpty: string;
    ordersTitle: string;
    plansIntroduction: string;
    plansTitle: string;
    priceMonthSuffix: string;
    priceYearSuffix: string;
    productNames: Readonly<Record<string, string>>;
    reconciliationFail: string;
    reconciliationPass: string;
    safetyNote: string;
    signIn: string;
    stagingEyebrow: string;
    statusLabel: string;
    statusLabels: Readonly<Record<string, string>>;
    subscriptionCredits: string;
    subscriptionPeriodEnd: string;
  }>;
  localCheckout: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    testOnly: string;
    missingTitle: string;
    missing: string;
    complete: string;
    completing: string;
    successTitle: string;
    success: string;
    errorTitle: string;
    error: string;
    sessionRequired: string;
    unavailable: string;
    signInAction: string;
    sanctuaryAction: string;
  }>;
  checkoutReturn: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    verifying: string;
    pendingTitle: string;
    pending: string;
    successTitle: string;
    success: string;
    failedTitle: string;
    failed: string;
    missingTitle: string;
    missing: string;
    unavailableTitle: string;
    unavailable: string;
    retry: string;
    sanctuaryAction: string;
    accountAction: string;
    safetyNote: string;
  }>;
}>;

const englishMessages = {
  recoveryCommerce: {
    accountRequired: "Sign in to use Stripe Test Checkout or review private billing records.",
    billingEmpty: "No Plus subscription has been verified for this account.",
    billingTitle: "Billing and Credits",
    cancellationScheduled: "Cancellation is scheduled for the end of this paid period.",
    checkout: "Continue to Stripe Test Checkout",
    checkoutError: "Test Checkout could not be created. Nothing was charged or granted.",
    checkoutPending: "Creating a protected Test Checkout",
    creditsLabel: "available Credits",
    creditsPlusLabel: "Plus",
    creditsPurchasedLabel: "Purchased",
    creditsReservedLabel: "Reserved",
    fulfillmentAwaiting: "Awaiting a signed Stripe Test event",
    fulfillmentVerified: "Verified fulfillment recorded",
    ledgerAdded: "added",
    ledgerAdjustment: "Refund or dispute adjustment",
    ledgerOther: "Credit activity",
    ledgerPurchased: "Purchased Credits",
    ledgerRemoved: "removed",
    ledgerSubscription: "Plus Credits",
    ledgerTitle: "Credit activity",
    loadError: "Private commerce records are temporarily unavailable.",
    loading: "Loading verified commerce state",
    ordersEmpty: "No verified Stripe Test orders yet.",
    ordersTitle: "Orders",
    plansIntroduction:
      "Choose a test-only Credit pack or Plus plan. Prices are server-owned and Credits are granted only after a signed Stripe Test event.",
    plansTitle: "Plus & Credits",
    priceMonthSuffix: "per month",
    priceYearSuffix: "per year",
    productNames: {
      pack_6: "6 Credits",
      pack_15: "15 Credits",
      pack_40: "40 Credits",
      plus_annual: "Plus Annual",
      plus_monthly: "Plus Monthly",
    },
    reconciliationFail: "Ledger reconciliation needs review. Do not create another checkout.",
    reconciliationPass: "Ledger and balance projection reconcile.",
    safetyNote:
      "Protected Staging only. Stripe Test Mode uses no real funds, creates no cash balance, and does not authorize production billing.",
    signIn: "Sign in",
    stagingEyebrow: "Founder Acceptance · Item 10",
    statusLabel: "Status",
    statusLabels: {
      active: "Active",
      cancelled: "Cancelled",
      checkout_created: "Checkout created",
      created: "Created",
      disputed: "Disputed",
      expired: "Expired",
      failed: "Failed",
      paid: "Paid",
      partially_refunded: "Partially refunded",
      past_due: "Past due",
      pending: "Pending",
      refund_requested: "Refund requested",
      refunded: "Refunded",
    },
    subscriptionCredits: "Credits per verified month",
    subscriptionPeriodEnd: "Current paid period ends",
  },
  localCheckout: {
    eyebrow: "Local hosted checkout",
    title: "Complete a local test payment",
    introduction:
      "This page exercises the same order, signed payment-event, and entitlement flow used by a hosted provider.",
    testOnly:
      "Local test only. No card details are requested, no real payment is taken, and this checkout cannot run outside the local environment.",
    missingTitle: "Checkout reference missing",
    missing: "Return to the sanctuary and begin a new local checkout.",
    complete: "Complete local test payment",
    completing: "Verifying local test payment",
    successTitle: "Local payment event verified",
    success: "Your verified order is ready for the final entitlement check.",
    errorTitle: "Local checkout was not completed",
    error: "No new access was granted. Retry safely or return to the sanctuary.",
    sessionRequired: "Sign in with the account that started this checkout, then try again.",
    unavailable: "Local checkout is safely disabled or temporarily unavailable.",
    signInAction: "Sign in",
    sanctuaryAction: "Return to sanctuary",
  },
  checkoutReturn: {
    eyebrow: "Secure checkout return",
    title: "Confirming your Credits or Plus access",
    introduction:
      "The return page grants nothing. We wait for the server's verified payment event before showing Credits or Plus access.",
    verifying: "Checking the verified order status",
    pendingTitle: "Payment confirmation is still processing",
    pending:
      "This can take a moment. Keep this page open or return to your account later. Do not pay again.",
    successTitle: "Your verified access is ready",
    success: "The verified payment event was received and your account access is active.",
    failedTitle: "The checkout was not completed",
    failed:
      "No Credits or Plus access were granted. You can return to the sanctuary and try again when you are ready.",
    missingTitle: "Order reference missing",
    missing: "Open this page from the secure checkout return link or review your account.",
    unavailableTitle: "Order status is temporarily unavailable",
    unavailable: "No access was granted from this page. Retry safely or review your account later.",
    retry: "Check again",
    sanctuaryAction: "Return to sanctuary",
    accountAction: "View my account",
    safetyNote:
      "A successful browser redirect is never treated as proof of payment. Only a verified provider event can activate access.",
  },
} as const satisfies CommerceMessages;

export const getCommerceMessages = (locale: Locale): CommerceMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};
