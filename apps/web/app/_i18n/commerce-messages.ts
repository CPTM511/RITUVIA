import type { Locale } from "./routing";

export type CommerceMessages = Readonly<{
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
    title: "Confirming your digital item",
    introduction:
      "The return page does not grant an item. We wait for the server's verified payment event before showing access.",
    verifying: "Checking the verified order status",
    pendingTitle: "Payment confirmation is still processing",
    pending:
      "This can take a moment. Keep this page open or return to your account later. Do not pay again.",
    successTitle: "Your ritual object is ready",
    success: "The verified payment event was received and your account access is active.",
    failedTitle: "The checkout was not completed",
    failed:
      "No item was granted. You can return to the sanctuary and try again when you are ready.",
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
