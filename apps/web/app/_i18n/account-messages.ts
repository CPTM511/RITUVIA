import type { Locale } from "./routing";

export type AccountMessages = Readonly<{
  navigation: Readonly<{
    loading: string;
    signIn: string;
    account: string;
  }>;
  signIn: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    privacy: string;
    emailLabel: string;
    emailDescription: string;
    emailPlaceholder: string;
    required: string;
    requiredLabel: string;
    submit: string;
    submitting: string;
    localTitle: string;
    localDescription: string;
    localAction: string;
    sentTitle: string;
    sentDescription: string;
    offline: string;
    invalid: string;
    error: string;
    unavailable: string;
  }>;
  account: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    loading: string;
    signedOutTitle: string;
    signedOutDescription: string;
    signInAction: string;
    errorTitle: string;
    error: string;
    retry: string;
    profileTitle: string;
    profileDescription: string;
    displayNameLabel: string;
    displayNameDescription: string;
    timeZoneLabel: string;
    verified: string;
    adultConfirmed: string;
    adultNotConfirmed: string;
    ageTitle: string;
    ageDescription: string;
    ageLabel: string;
    ageSave: string;
    ageSaving: string;
    ageSaved: string;
    ageError: string;
    save: string;
    saving: string;
    saved: string;
    saveError: string;
    requiredLabel: string;
    readingsTitle: string;
    readingsEmpty: string;
    readingsCount: string;
    readingsDescription: string;
    sanctuaryAction: string;
    signOut: string;
    signingOut: string;
    signOutError: string;
  }>;
}>;

const englishMessages = {
  navigation: {
    loading: "Account",
    signIn: "Sign in",
    account: "Account",
  },
  signIn: {
    eyebrow: "Private account",
    title: "Sign in without a password.",
    introduction:
      "Use a verified email to keep readings, intentions, ritual objects, and private reflections available across devices.",
    privacy:
      "Your email is used for account access and essential service messages, not spiritual profiling.",
    emailLabel: "Email address",
    emailDescription: "We will prepare a secure, short-lived sign-in link.",
    emailPlaceholder: "you@example.com",
    required: "Enter a valid email address.",
    requiredLabel: "required",
    submit: "Continue securely",
    submitting: "Preparing sign-in",
    localTitle: "Local preview sign-in is ready",
    localDescription:
      "Local test only: no email was sent. Use the secure callback below to finish this local sign-in.",
    localAction: "Complete local sign-in",
    sentTitle: "Check your email",
    sentDescription: "Use the short-lived link we sent to finish signing in.",
    offline: "You appear to be offline. Reconnect before requesting a sign-in link.",
    invalid: "That sign-in link is invalid or has expired. Request a new one below.",
    error: "Sign-in could not be started. No account changes were made. Try again.",
    unavailable: "Account sign-in is temporarily unavailable in this environment.",
  },
  account: {
    eyebrow: "Private account",
    title: "Your reflection space",
    introduction:
      "Manage the small amount of profile information used to restore your private experience.",
    loading: "Loading your private account",
    signedOutTitle: "Sign in to view your account",
    signedOutDescription:
      "The free anonymous reflection path remains available without an account.",
    signInAction: "Sign in",
    errorTitle: "Your account could not be loaded",
    error: "Try again. No profile, reading, or purchase data was changed.",
    retry: "Retry account",
    profileTitle: "Profile preferences",
    profileDescription:
      "Display name is optional. Language and time zone keep dates and future reminders understandable.",
    displayNameLabel: "Display name",
    displayNameDescription: "Optional and visible only inside your private account.",
    timeZoneLabel: "Time zone",
    verified: "Email verified",
    adultConfirmed: "18+ confirmation recorded",
    adultNotConfirmed: "18+ confirmation will be requested before a paid checkout",
    ageTitle: "Paid experience eligibility",
    ageDescription:
      "Paid digital experiences are limited to adults in this local MVP. This confirmation does not change the free anonymous path.",
    ageLabel: "I confirm that I am 18 or older.",
    ageSave: "Save 18+ confirmation",
    ageSaving: "Saving age confirmation",
    ageSaved: "Your 18+ confirmation was saved.",
    ageError: "The age confirmation could not be saved. Paid checkout remains unavailable.",
    save: "Save profile",
    saving: "Saving profile",
    saved: "Profile saved.",
    saveError: "Your profile could not be saved. Review the fields and try again.",
    requiredLabel: "required",
    readingsTitle: "Your reflections",
    readingsEmpty: "No account-linked reflections are available yet.",
    readingsCount: "{count} account-linked reflections",
    readingsDescription:
      "Anonymous work can be merged into your account after sign-in without moving another person's data.",
    sanctuaryAction: "Visit my sanctuary",
    signOut: "Sign out",
    signingOut: "Signing out",
    signOutError: "Sign-out could not be completed. Try again before leaving this device.",
  },
} as const satisfies AccountMessages;

export const getAccountMessages = (locale: Locale): AccountMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};
