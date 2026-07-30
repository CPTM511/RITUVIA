import type { Locale } from "./routing";

export type CommerceMessages = Readonly<{
  plans: Readonly<{
    eyebrow: string;
    title: string;
    availableTitle: string;
    introduction: string;
    boundary: string;
    contentsTitle: string;
    purchaseTerms: string;
    refundTerms: string;
    accountLoading: string;
    signInTitle: string;
    signInMessage: string;
    signInAction: string;
    ageTitle: string;
    ageMessage: string;
    accountAction: string;
    unavailableTitle: string;
    unavailable: string;
    retry: string;
    continueAction: string;
    continuingAction: string;
    checkoutErrorTitle: string;
    checkoutError: string;
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
  plans: {
    eyebrow: "Credits",
    title: "Choose a one-time Credit pack",
    availableTitle: "Available Credit packs",
    introduction:
      "Credits unlock clearly described digital experiences inside RITUVIA. They do not change outcomes or make a reflection more spiritually effective.",
    boundary:
      "These packs are for eligible United States accounts, are charged once in USD, do not renew, cannot be transferred, and have no cash value.",
    contentsTitle: "Exact contents",
    purchaseTerms:
      "Added once after verified payment. No expiry is specified in the current approved catalogue.",
    refundTerms:
      "Accessed digital experiences are otherwise non-refundable. Mandatory-law remedies, duplicate or unauthorized charges, non-delivery, and an uncured material defect remain reviewable.",
    accountLoading: "Checking checkout eligibility",
    signInTitle: "Sign in to continue",
    signInMessage: "A verified adult account is required before secure checkout can begin.",
    signInAction: "Sign in",
    ageTitle: "Adult confirmation required",
    ageMessage: "Confirm that you are 18 or older in your private account before continuing.",
    accountAction: "Open my account",
    unavailableTitle: "Checkout is temporarily unavailable",
    unavailable: "No order was created. Check again safely when you are ready.",
    retry: "Check again",
    continueAction: "Continue to secure checkout",
    continuingAction: "Opening secure checkout",
    checkoutErrorTitle: "Secure checkout did not open",
    checkoutError: "No duplicate order is needed. Retry safely with the same request.",
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
    title: "Confirming your purchase",
    introduction:
      "The return page does not grant Credits or access. We wait for the server's verified payment event and completed fulfillment.",
    verifying: "Checking the verified order status",
    pendingTitle: "Payment confirmation is still processing",
    pending:
      "This can take a moment. Keep this page open or return to your account later. Do not pay again.",
    successTitle: "Your purchase is ready",
    success: "The verified payment event was received and fulfillment is active on your account.",
    failedTitle: "The checkout was not completed",
    failed:
      "No purchase was fulfilled. You can return to your account and try again when you are ready.",
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
