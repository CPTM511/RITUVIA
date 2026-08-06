import type { QuestionIntakeThemeCode } from "@rituvia/domain";

import type { Locale } from "./routing";
import type { WalletAuthMessages } from "../_components/wallet-auth-control";

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
    rateLimited: string;
    invalid: string;
    error: string;
    unavailable: string;
    wallet: WalletAuthMessages;
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
    privacyAction: string;
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
    saveConflict: string;
    requiredLabel: string;
    consentEyebrow: string;
    consentTitle: string;
    consentDescription: string;
    consentLoading: string;
    consentErrorTitle: string;
    consentError: string;
    consentRetry: string;
    analyticsConsentLabel: string;
    analyticsConsentDescription: string;
    personalizationConsentLabel: string;
    personalizationConsentDescription: string;
    modelImprovementConsentLabel: string;
    modelImprovementConsentDescription: string;
    consentSeparationNote: string;
    consentSaving: string;
    consentSaved: string;
    consentSaveError: string;
    historyTitle: string;
    historyDescription: string;
    historyLoading: string;
    historyEmpty: string;
    historyErrorTitle: string;
    historyError: string;
    historyRetry: string;
    historyLoadMore: string;
    historyLoadingMore: string;
    historyOneCard: string;
    historyThreeCard: string;
    historyIntention: string;
    historyRitual: string;
    historyJournal: string;
    historyRevisit: string;
    historyStatusActive: string;
    historyStatusArchived: string;
    historyStatusCompleted: string;
    historyStatusPaused: string;
    historyStatusScheduled: string;
    historyStatusAbandoned: string;
    historyOpen: string;
    historyOpenError: string;
    readingThemes: Readonly<Record<QuestionIntakeThemeCode, string>>;
    sanctuaryAction: string;
    sessionsTitle: string;
    sessionsDescription: string;
    sessionsLoading: string;
    sessionsErrorTitle: string;
    sessionsError: string;
    sessionsRetry: string;
    sessionCurrent: string;
    sessionOther: string;
    sessionCreated: string;
    sessionLastActive: string;
    sessionExpires: string;
    sessionRevoke: string;
    sessionRevoking: string;
    sessionRevokeConfirm: string;
    sessionRevokeSuccess: string;
    sessionRevokeError: string;
    signOutAll: string;
    signingOutAll: string;
    signOutAllConfirm: string;
    signOutAllError: string;
    signOut: string;
    signingOut: string;
    signOutError: string;
    wallet: WalletAuthMessages;
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
    localTitle: "Protected sandbox sign-in is ready",
    localDescription:
      "Protected staging or local test only: no email was sent. Use the secure callback below to finish this sandbox sign-in.",
    localAction: "Complete sandbox sign-in",
    sentTitle: "Check your email",
    sentDescription: "Use the short-lived link we sent to finish signing in.",
    offline: "You appear to be offline. Reconnect before requesting a sign-in link.",
    rateLimited: "Too many sign-in links were requested. Wait a little, then try again.",
    invalid: "That sign-in link is invalid or has expired. Request a new one below.",
    error: "Sign-in could not be started. No account changes were made. Try again.",
    unavailable: "Account sign-in is temporarily unavailable in this environment.",
    wallet: {
      action: "Sign in with a linked wallet",
      description:
        "Use a wallet already linked to a RITUVIA sandbox account. This signs a message only; RITUVIA never requests funds or a transaction.",
      empty: "No wallet is linked to this sandbox account.",
      error: "Wallet sign-in could not be verified. No account authority was granted.",
      linked: "Wallet verified.",
      linkedTitle: "Wallet verified",
      loading: "Checking linked wallets",
      noProvider:
        "No browser wallet was found. Open this protected staging page inside a wallet browser or install an EIP-1193 wallet.",
      rejected: "The wallet signature request was canceled. No account authority was granted.",
      remove: "Unlink wallet",
      removeConfirm: "Unlink this wallet from sign-in?",
      removed: "The wallet was unlinked and its wallet-authenticated sessions were revoked.",
      signing: "Waiting for wallet signature",
      title: "Wallet sign-in",
      wrongChain: "Switch your wallet to Base Sepolia, then try again.",
    },
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
    privacyAction: "Manage privacy & data",
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
    saveConflict:
      "This profile changed in another session. Reload the account before saving again.",
    requiredLabel: "required",
    consentEyebrow: "You are in control",
    consentTitle: "Personalization choices",
    consentDescription:
      "These optional choices are off until you turn them on. Turning one off stops that purpose immediately.",
    consentLoading: "Loading privacy choices",
    consentErrorTitle: "Privacy choices could not be loaded",
    consentError: "No choice was changed. Try loading these controls again.",
    consentRetry: "Retry privacy choices",
    analyticsConsentLabel: "Use behavioral data without private text to improve the experience",
    analyticsConsentDescription:
      "This records an analytics preference only. Production analytics collection remains disabled until its separate policy and activation are approved.",
    personalizationConsentLabel:
      "Allow personalized summaries; private journal entries are excluded by default",
    personalizationConsentDescription:
      "Only an excerpt you explicitly select may pass this gate. Your name, email, payment data, full journal history, marketing, and model training remain excluded.",
    modelImprovementConsentLabel:
      "Allow excerpts I explicitly select to be considered for model-improvement review",
    modelImprovementConsentDescription:
      "This is separate from personalization. No production training or real-user-data evaluation path is enabled, and nothing is sent unless a later approved feature asks you to select an excerpt again.",
    consentSeparationNote:
      "Service notices, marketing, analytics, AI personalization, and model improvement are separate choices. One choice never grants another.",
    consentSaving: "Saving privacy choice",
    consentSaved: "Your privacy choice was saved and now applies to new data flows.",
    consentSaveError:
      "The choice could not be saved. The previous safe-off state remains in effect.",
    historyTitle: "Your history",
    historyDescription:
      "Only minimal account-linked metadata appears here. Questions, intentions, journal entries, and Revisit reflections are never included in this list.",
    historyLoading: "Loading your private history",
    historyEmpty: "No account-linked history is available yet.",
    historyErrorTitle: "History could not be loaded",
    historyError: "Your private resources were not changed. Try loading this list again.",
    historyRetry: "Retry history",
    historyLoadMore: "Load older history",
    historyLoadingMore: "Loading older history",
    historyOneCard: "One-card reflection",
    historyThreeCard: "Three-card reflection",
    historyIntention: "Intention",
    historyRitual: "Ritual session",
    historyJournal: "Private journal entry",
    historyRevisit: "Revisit",
    historyStatusActive: "Active",
    historyStatusArchived: "Archived",
    historyStatusCompleted: "Completed",
    historyStatusPaused: "Paused",
    historyStatusScheduled: "Scheduled",
    historyStatusAbandoned: "Ended",
    historyOpen: "Open this reading",
    historyOpenError:
      "This tab could not prepare the reading safely. Your history was not changed. Try again.",
    readingThemes: {
      self: "Self",
      relationships: "Relationships",
      work: "Work",
      creativity: "Creativity",
      transition: "Transition",
      grief: "Grief",
      courage: "Courage",
      gratitude: "Gratitude",
      release: "Release",
      open_reflection: "Open reflection",
    },
    sanctuaryAction: "Visit my sanctuary",
    sessionsTitle: "Signed-in sessions",
    sessionsDescription:
      "Review the current session and other active sessions. RITUVIA does not store device names, locations, or fingerprints for this list.",
    sessionsLoading: "Loading active sessions",
    sessionsErrorTitle: "Sessions could not be loaded",
    sessionsError: "No session was changed. Try loading the private session list again.",
    sessionsRetry: "Retry sessions",
    sessionCurrent: "This session",
    sessionOther: "Other active session",
    sessionCreated: "Signed in",
    sessionLastActive: "Last active",
    sessionExpires: "Expires",
    sessionRevoke: "Sign out this other session",
    sessionRevoking: "Signing out session",
    sessionRevokeConfirm: "Sign out this other session?",
    sessionRevokeSuccess: "The other session was signed out.",
    sessionRevokeError: "The other session could not be signed out. Try again.",
    signOutAll: "Sign out all sessions",
    signingOutAll: "Signing out all sessions",
    signOutAllConfirm: "Sign out this session and every other active session?",
    signOutAllError: "All sessions could not be signed out. Try again before leaving this device.",
    signOut: "Sign out",
    signingOut: "Signing out",
    signOutError: "Sign-out could not be completed. Try again before leaving this device.",
    wallet: {
      action: "Link a Base Sepolia wallet",
      description:
        "Link one non-custodial wallet for sign-in. Payment wallets remain separate, and RITUVIA never receives your private key or requests a transaction.",
      empty: "No wallet is linked to this account.",
      error: "The wallet operation could not be completed. Existing account access was unchanged.",
      linked: "The wallet is linked and can now be used for sign-in.",
      linkedTitle: "Wallet identity updated",
      loading: "Loading linked wallets",
      noProvider:
        "No browser wallet was found. Open this protected staging page inside a wallet browser or install an EIP-1193 wallet.",
      rejected: "The wallet signature request was canceled. Nothing was linked.",
      remove: "Unlink wallet",
      removeConfirm: "Unlink this wallet and revoke its wallet-authenticated sessions?",
      removed: "The wallet was unlinked and its wallet-authenticated sessions were revoked.",
      signing: "Waiting for wallet signature",
      title: "Linked sign-in wallets",
      wrongChain: "Switch your wallet to Base Sepolia, then try again.",
    },
  },
} as const satisfies AccountMessages;

export const getAccountMessages = (locale: Locale): AccountMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};
