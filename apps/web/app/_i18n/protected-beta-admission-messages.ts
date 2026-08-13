import type { Locale } from "./routing";

const english = Object.freeze({
  form: Object.freeze({
    description:
      "Paste the private invitation exactly as provided. It is used once and is not saved in this browser.",
    invalid: "Check the invitation and try again, or ask the Beta contact for a replacement.",
    label: "Protected-Beta invitation",
    placeholder: "Invitation token",
    required: "Required",
    submit: "Enter protected Beta",
    submitting: "Checking invitation",
  }),
  metadata: Object.freeze({
    description: "Private invitation entry for the protected RITUVIA Beta.",
    title: "Protected Beta access",
  }),
  page: Object.freeze({
    boundary:
      "This closed Beta is free, anonymous, English-only, and for invited adults. It does not include payments or production AI.",
    eyebrow: "Protected Beta",
    introduction:
      "Use your single-use invitation to create one private anonymous session before beginning the reflection flow.",
    privacy:
      "The invitation is submitted in the request body, never in the URL. RITUVIA stores only a one-way token digest and bounded admission metadata.",
    title: "Enter the protected Beta",
  }),
  status: Object.freeze({
    offline: Object.freeze({
      message: "Reconnect, then submit the invitation manually.",
      title: "You appear to be offline",
    }),
    unavailable: Object.freeze({
      message: "The admission service is temporarily unavailable. Please try again manually.",
      title: "Admission could not be checked",
    }),
  }),
});

export type ProtectedBetaAdmissionMessages = typeof english;

export const getProtectedBetaAdmissionMessages = (
  locale: Locale,
): ProtectedBetaAdmissionMessages => {
  if (locale !== "en") throw new TypeError("Protected-Beta admission messages are unavailable.");
  return english;
};
