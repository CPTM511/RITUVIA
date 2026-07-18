import type { Locale } from "./routing";

export type SanctuaryThemeCode =
  | "calm_clarity"
  | "connection_understanding"
  | "courage_action"
  | "gratitude_abundance"
  | "release_renewal";

export type SanctuaryMessages = Readonly<{
  page: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    boundary: string;
    privacy: string;
  }>;
  intention: Readonly<{
    title: string;
    description: string;
    themeLabel: string;
    themes: Readonly<Record<SanctuaryThemeCode, string>>;
    smallActionLabel: string;
    smallActionDescription: string;
    smallActionPlaceholder: string;
    create: string;
    creating: string;
    created: string;
    required: string;
    requiredLabel: string;
    readingRequired: string;
    smallActionRequired: string;
    offline: string;
    error: string;
  }>;
  ritual: Readonly<{
    title: string;
    description: string;
    catalogLoading: string;
    catalogErrorTitle: string;
    catalogError: string;
    catalogDegraded: string;
    freeItems: readonly Readonly<{
      code: "candle" | "incense";
      description: string;
      name: string;
    }>[];
    retry: string;
    free: string;
    owned: string;
    purchase: string;
    unavailable: string;
    selectIntention: string;
    place: string;
    placing: string;
    completed: string;
    completionError: string;
    offline: string;
    priceDisclosure: string;
  }>;
  checkout: Readonly<{
    title: string;
    description: string;
    ageLabel: string;
    ageRequired: string;
    ageSaving: string;
    ageSaved: string;
    ageSaveError: string;
    ageConfirmed: string;
    requiredLabel: string;
    methodLabel: string;
    methodValue: string;
    accountChecking: string;
    signIn: string;
    signInDescription: string;
    continue: string;
    creating: string;
    error: string;
    unavailable: string;
  }>;
  journal: Readonly<{
    title: string;
    description: string;
    label: string;
    placeholder: string;
    required: string;
    requiredLabel: string;
    prerequisite: string;
    save: string;
    saving: string;
    saved: string;
    offline: string;
    error: string;
  }>;
  completion: Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    accountAction: string;
    readingAction: string;
  }>;
}>;

const englishMessages = {
  page: {
    eyebrow: "Private digital sanctuary",
    title: "Turn one insight into a ritual you can complete.",
    introduction:
      "Choose an intention, take one small action, place a free or owned ritual object, and keep a private reflection.",
    boundary:
      "Ritual objects change the visual experience, not the likelihood of any real-world outcome.",
    privacy:
      "Your intention and journal entry remain private. They are never used as public content or advertising data.",
  },
  intention: {
    title: "Set an intention",
    description:
      "Name a quality you want to practice and one action that remains within your control.",
    themeLabel: "Choose an intention theme",
    themes: {
      calm_clarity: "Peace and clarity",
      gratitude_abundance: "Gratitude",
      courage_action: "Courage",
      connection_understanding: "Connection",
      release_renewal: "Release and renewal",
    },
    smallActionLabel: "One small real-world action",
    smallActionDescription: "Keep it specific, kind, and possible to complete today.",
    smallActionPlaceholder: "For example: take ten quiet minutes before replying.",
    create: "Continue with this intention",
    creating: "Saving your intention",
    created: "Your intention is ready. Choose a ritual object when you feel ready.",
    required: "Choose one intention theme to continue.",
    requiredLabel: "required",
    readingRequired: "Complete a free reading in this tab before saving a linked intention.",
    smallActionRequired: "Add one small real-world action before continuing.",
    offline: "You appear to be offline. Reconnect before saving your private intention.",
    error: "Your intention could not be saved. Nothing was charged or completed. Try again.",
  },
  ritual: {
    title: "Choose a ritual object",
    description:
      "A free option remains available. Paid objects add lasting visual ambience to your private sanctuary.",
    catalogLoading: "Loading available ritual objects",
    catalogErrorTitle: "Ritual objects are temporarily unavailable",
    catalogError: "Your intention is safe. Retry when the catalog is available again.",
    catalogDegraded: "Paid objects are temporarily unavailable. The free ritual remains available.",
    freeItems: [
      {
        code: "candle",
        description: "A quiet virtual light for one private moment of reflection.",
        name: "Reflection candle",
      },
      {
        code: "incense",
        description: "A simple virtual incense ritual with no purchase required.",
        name: "Mindful incense",
      },
    ],
    retry: "Retry catalog",
    free: "Free",
    owned: "Owned",
    purchase: "One-time purchase",
    unavailable: "Unavailable",
    selectIntention: "Set an intention before starting a ritual.",
    place: "Place in my sanctuary",
    placing: "Preparing your ritual",
    completed: "Ritual complete. Take a breath, then write what you want to remember.",
    completionError: "The ritual could not be completed. Your intention is unchanged. Try again.",
    offline: "Reconnect before beginning or completing a ritual.",
    priceDisclosure: "Digital experience. Payment does not imply stronger spiritual effect.",
  },
  checkout: {
    title: "Complete a secure hosted checkout",
    description:
      "Price and delivery are confirmed by the server. Card details are entered only on the payment provider's hosted page.",
    ageLabel: "I confirm that I am 18 or older and understand this is a digital experience.",
    ageRequired: "Confirm that you are 18 or older before continuing to checkout.",
    ageSaving: "Saving your age confirmation",
    ageSaved: "Your 18+ confirmation was saved for paid digital experiences.",
    ageSaveError:
      "Your age confirmation could not be saved. Checkout has not started and no payment was taken.",
    ageConfirmed: "18+ confirmation recorded for this account.",
    requiredLabel: "required",
    methodLabel: "Payment method",
    methodValue: "Card, Apple Pay, or Google Pay when available",
    accountChecking: "Checking your account before checkout",
    signIn: "Sign in to purchase",
    signInDescription: "A verified account is required so the item can be restored across devices.",
    continue: "Continue to secure checkout",
    creating: "Preparing secure checkout",
    error: "Checkout could not be prepared. No payment was taken. Try again.",
    unavailable: "This item or payment method is not available for your account or country.",
  },
  journal: {
    title: "Private reflection",
    description: "Write one thing you noticed or one action you want to revisit.",
    label: "Your private journal entry",
    placeholder: "What do you want your future self to remember?",
    required: "Write at least one character before saving.",
    requiredLabel: "required",
    prerequisite: "Complete an intention and ritual before saving the linked reflection.",
    save: "Save private reflection",
    saving: "Saving your reflection",
    saved: "Your private reflection was saved.",
    offline: "Reconnect before saving your private reflection.",
    error: "Your reflection could not be saved. The text remains on this page so you can retry.",
  },
  completion: {
    eyebrow: "A complete moment",
    title: "Pause here, or return when it is useful.",
    description:
      "The experience is complete. There is no need to draw again or purchase anything else.",
    accountAction: "View my account",
    readingAction: "Start another free reflection",
  },
} as const satisfies SanctuaryMessages;

export const getSanctuaryMessages = (locale: Locale): SanctuaryMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};
