import type { Locale } from "./routing";
import { getCoreSourceMessage } from "./core-messages";

export type SanctuaryThemeCode =
  | "calm_clarity"
  | "connection_understanding"
  | "courage_action"
  | "gratitude_abundance"
  | "release_renewal";

export type SanctuaryRitualStep = Readonly<{
  code: "breathe" | "complete" | "light" | "pause" | "prepare";
  instruction: string;
  title: string;
}>;

export type SanctuaryFreeRitualItem = Readonly<{
  code: "free_candle" | "free_incense";
  description: string;
  name: string;
  steps: readonly [SanctuaryRitualStep, ...SanctuaryRitualStep[]];
  visualAlternative: string;
}>;

export type SanctuaryRitualExperienceMessages = Readonly<{
  audioLabel: string;
  audioOff: string;
  complete: string;
  completeNow: string;
  completing: string;
  completionDescription: string;
  completionEyebrow: string;
  completionTitle: string;
  continue: string;
  continueToJournal: string;
  error: string;
  errorTitle: string;
  exit: string;
  eyebrow: string;
  intentionLabel: string;
  linearMode: string;
  modeHelp: string;
  modeLabel: string;
  offline: string;
  pause: string;
  previous: string;
  resume: string;
  returnToSanctuary: string;
  stepProgress: string;
  symbolicBoundary: string;
  useLinearMode: string;
  useVisualMode: string;
  visualMode: string;
}>;

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
    templateLabel: string;
    templates: readonly string[];
    intentionTextLabel: string;
    intentionTextDescription: string;
    intentionTextPlaceholder: string;
    smallActionLabel: string;
    smallActionDescription: string;
    smallActionPlaceholder: string;
    revisitDateLabel: string;
    revisitDateDescription: string;
    revisitAction: string;
    privacyDisclosure: string;
    reminderDisclosure: string;
    reframeTitle: string;
    reframeMessage: string;
    applyReframe: string;
    create: string;
    creating: string;
    created: string;
    saveChanges: string;
    savingChanges: string;
    updated: string;
    complete: string;
    archive: string;
    delete: string;
    confirmComplete: string;
    confirmArchive: string;
    confirmDelete: string;
    cancel: string;
    completed: string;
    archived: string;
    deleted: string;
    required: string;
    requiredLabel: string;
    readingRequired: string;
    intentionTextInvalid: string;
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
    experience: SanctuaryRitualExperienceMessages;
    freeItems: readonly SanctuaryFreeRitualItem[];
    noScriptDescription: string;
    noScriptTitle: string;
    retry: string;
    begin: string;
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
    confirmDelete: string;
    delete: string;
    save: string;
    saveChanges: string;
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
    templateLabel: "Start with an agency-based template",
    templates: ["I intend to…", "I will practice…", "I am willing to…"],
    intentionTextLabel: "Your intention",
    intentionTextDescription:
      "Use your own words and keep the intention focused on choices and actions within your control.",
    intentionTextPlaceholder: "For example: I intend to listen before I respond.",
    smallActionLabel: "One small real-world action",
    smallActionDescription: "Keep it specific, kind, and possible to complete today.",
    smallActionPlaceholder: "For example: take ten quiet minutes before replying.",
    revisitDateLabel: "Optional revisit date",
    revisitDateDescription:
      "This date stays private. Reminders are off until a separate reminder preference is available.",
    revisitAction: "Schedule a private Revisit",
    privacyDisclosure:
      "Private by default: only your current anonymous session or linked account can read this intention.",
    reminderDisclosure: "Reminder preference: none. No message will be sent.",
    reframeTitle: "Keep the intention within your control",
    reframeMessage:
      "This wording appears to direct another person's feelings or actions. You can use this self-owned alternative.",
    applyReframe: "Use the suggested intention",
    create: "Continue with this intention",
    creating: "Saving your intention",
    created: "Your intention is ready. Choose a ritual object when you feel ready.",
    saveChanges: "Save intention changes",
    savingChanges: "Saving intention changes",
    updated: "Your private intention was updated.",
    complete: "Mark complete",
    archive: "Archive intention",
    delete: "Delete intention",
    confirmComplete: "Mark this intention complete? It can still be archived or deleted.",
    confirmArchive: "Archive this intention? It will no longer start a new ritual.",
    confirmDelete:
      "Delete this intention? It will disappear immediately and cannot be restored here.",
    cancel: "Cancel",
    completed: "This intention is complete. You can archive or delete it.",
    archived: "This intention is archived and cannot start a new ritual.",
    deleted: "Your intention was deleted.",
    required: "Choose one intention theme to continue.",
    requiredLabel: "required",
    readingRequired: "Complete a free reading in this tab before saving a linked intention.",
    intentionTextInvalid: "Complete the intention in your own words before continuing.",
    smallActionRequired: "Add one small real-world action before continuing.",
    offline: "You appear to be offline. Reconnect before saving your private intention.",
    error: "Your intention could not be saved. Nothing was charged or completed. Try again.",
  },
  ritual: {
    title: "Choose a free ritual or symbolic object",
    description:
      "The complete candle and incense rituals are always free. Other objects change presentation only.",
    catalogLoading: "Loading available ritual objects",
    catalogErrorTitle: "Ritual objects are temporarily unavailable",
    catalogError: "Your intention is safe. Retry when the catalog is available again.",
    catalogDegraded: "Paid objects are temporarily unavailable. The free ritual remains available.",
    freeItems: [
      {
        code: "free_candle",
        description: "A quiet virtual light for one private moment of reflection.",
        name: "Quiet candle",
        steps: [
          {
            code: "prepare",
            instruction:
              "Settle into a comfortable position. Nothing needs to be believed or achieved.",
            title: "Prepare your space",
          },
          {
            code: "light",
            instruction:
              "Choose to light the virtual candle as a simple marker for this private pause.",
            title: "Light the candle",
          },
          {
            code: "breathe",
            instruction:
              "Take one unhurried breath. Let your intention remain an invitation, not a demand.",
            title: "Take one breath",
          },
          {
            code: "pause",
            instruction:
              "Pause for as long or as briefly as is useful. No timer, sound, or motion is required.",
            title: "Pause without pressure",
          },
          {
            code: "complete",
            instruction:
              "Acknowledge the moment as complete. This symbolic action does not guarantee an external result.",
            title: "Complete the pause",
          },
        ],
        visualAlternative:
          "A static warm candle shape on a dark surface, presented as a symbolic digital object.",
      },
      {
        code: "free_incense",
        description: "A simple virtual incense ritual with no purchase required.",
        name: "Quiet incense",
        steps: [
          {
            code: "prepare",
            instruction:
              "Settle into a comfortable position. Nothing needs to be believed or achieved.",
            title: "Prepare your space",
          },
          {
            code: "light",
            instruction:
              "Choose to light the virtual incense as a simple marker for this private pause.",
            title: "Light the incense",
          },
          {
            code: "breathe",
            instruction:
              "Take one natural breath. The visual smoke is decorative and is not needed for the exercise.",
            title: "Take one breath",
          },
          {
            code: "pause",
            instruction:
              "Pause for as long or as briefly as is useful. No timer, sound, or motion is required.",
            title: "Pause without pressure",
          },
          {
            code: "complete",
            instruction:
              "Acknowledge the moment as complete. This symbolic action does not guarantee an external result.",
            title: "Complete the pause",
          },
        ],
        visualAlternative:
          "A static incense stick and two soft smoke curves, presented as a symbolic digital object.",
      },
    ],
    noScriptDescription:
      "Interactive recording is unavailable, but the complete free candle and incense reflection steps remain below. Nothing will be saved.",
    noScriptTitle: "Free static ritual steps",
    experience: {
      audioLabel: "Audio",
      audioOff: "Off. No sound will start.",
      complete: "Complete this ritual",
      completeNow: "Complete now",
      completing: "Recording ritual completion",
      completionDescription:
        "The symbolic pause is complete. No outcome was promised or sent. Continue only if a private reflection would be useful.",
      completionEyebrow: "A complete pause",
      completionTitle: "You can leave this moment here.",
      continue: "Continue",
      continueToJournal: "Continue to private reflection",
      error:
        "Completion could not be recorded. Your intention and current step remain here so you can retry or exit.",
      errorTitle: "Ritual completion is unavailable",
      exit: "Exit ritual",
      eyebrow: "Free private ritual",
      intentionLabel: "Your intention",
      linearMode: "Accessible linear mode",
      modeHelp:
        "Both modes use the same words and controls. Animation, sound, dragging, and precise timing are never required.",
      modeLabel: "Experience mode",
      offline:
        "You appear to be offline. Your current step remains here; reconnect to record completion or exit without recording.",
      pause: "Pause ritual",
      previous: "Previous step",
      resume: "Resume ritual",
      returnToSanctuary: "Return to Sanctuary",
      stepProgress: getCoreSourceMessage("ritual.stepProgress"),
      symbolicBoundary:
        "This is a symbolic digital experience for reflection. It does not change or guarantee external events.",
      useLinearMode: "Use accessible linear mode",
      useVisualMode: "Use standard 2D mode",
      visualMode: "Standard 2D mode",
    },
    retry: "Retry catalog",
    begin: "Begin free ritual",
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
    confirmDelete:
      "Delete this private reflection? It will disappear immediately and cannot be restored here.",
    delete: "Delete private reflection",
    save: "Save private reflection",
    saveChanges: "Save reflection changes",
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
