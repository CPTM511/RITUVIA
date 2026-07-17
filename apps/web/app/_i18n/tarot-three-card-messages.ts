import type { QuestionIntakeThemeCode } from "@rituvia/domain";

import type { TarotReadingMessages } from "./tarot-one-card-messages";
import type { Locale } from "./routing";
import { getQuestionIntakeMessages } from "./question-intake-messages";

export type TarotThreeCardMessages = TarotReadingMessages;

const questionIntakeMessages = getQuestionIntakeMessages("en");

const englishTarotThreeCardMessages = {
  metadata: {
    description:
      "Choose a private theme and reveal three server-selected symbolic lenses in a fixed order.",
    title: "Private three-card reflection",
  },
  page: {
    boundary: questionIntakeMessages.page.boundary,
    eyebrow: "Three-card reflection",
    introduction:
      "Choose one theme. The server fixes three different cards for Situation, Action, and Possibility before you reveal them. Possibility is a reflective lens, not a prediction.",
    privacy:
      "Only the selected theme is sent with this reading. This flow has no question field and does not place the result in the URL or product analytics.",
    title: "Three ordered lenses for the next step",
  },
  form: {
    loading: "Preparing your private three-card draw",
    noScript:
      "JavaScript is required to create the private session and server-authoritative draw. The controls stay disabled without it.",
    submit: "Draw three cards",
    themeDescription: "Choose the area where three ordered symbolic lenses may be useful.",
    themeError: "Choose one theme before drawing the cards.",
    themeLabel: "Reflection theme",
    themeRequired: "required",
  },
  themes: questionIntakeMessages.themes satisfies Readonly<Record<QuestionIntakeThemeCode, string>>,
  states: {
    conflict: {
      message:
        "This saved attempt no longer matches the selected theme. Nothing was redrawn automatically. Start over only if you want a new request.",
      startOver: "Start over with no saved attempt",
      title: "This draw request conflicts with an earlier attempt",
    },
    drawing: "The server is fixing three different cards in their ordered positions",
    error: {
      message:
        "The draw did not complete in this page. Nothing will retry automatically, and trying again keeps the same draw request.",
      retry: "Try the same draw again",
      title: "The draw could not be completed",
    },
    limitReached: {
      message:
        "This private session has reached its current reading limit. Pause here and return later; another draw would not make the reflection more certain.",
      retry: "Check the same draw later",
      title: "The current reading limit has been reached",
    },
    offline: {
      message:
        "Reconnect before creating this draw. Your selected theme remains only in this page and nothing will retry automatically.",
      retry: "Check connection and try again",
      title: "You appear to be offline",
    },
    ready: {
      message:
        "The server has fixed all three cards and their order. Revealing them changes only what is shown on this page; it does not draw again.",
      reveal: "Reveal the three cards",
      title: "Your three cards are ready",
    },
    replayed: "A matching saved attempt returned the same three fixed cards in the same order.",
    session: "Creating or resuming a private session",
    sessionRequired: {
      message:
        "The private session could not be confirmed. Try again manually; the existing draw request will be preserved.",
      retry: "Confirm the session and try again",
      title: "A private session is required",
    },
    unavailable: {
      message:
        "The three-card experience is temporarily unavailable. Nothing will retry or draw other cards automatically.",
      retry: "Try the same draw again",
      title: "The reading service is unavailable",
    },
  },
  result: {
    actionTitle: "One small action",
    aiBoundary: "This result uses reviewed canonical content, not an AI-generated interpretation.",
    alternativeTitle: "Other lenses to hold beside it",
    cannotDetermineTitle: "What this cannot determine",
    cardsLabel: "Situation, Action, and Possibility in fixed order",
    completion:
      "You can stop here with the reflection question or small action that feels most useful.",
    constructiveLabel: "A constructive possibility",
    engineVersionLabel: "Draw engine",
    methodologyAction: "Read the methodology",
    methodologySummary: "How this draw was made",
    orientation: {
      reversed: "Reversed",
      upright: "Upright",
    },
    perspectiveTitle: "What this position may invite you to notice",
    positionBoundary:
      "Situation and Action are reflective lenses. Possibility is something to consider, not a prediction of what will happen.",
    reflectionTitle: "A question to reflect on",
    replayed: "This was the same verified result from an earlier matching attempt.",
    saved: "This fixed draw is linked to the current private browser session.",
    tensionLabel: "A tension to consider",
    themesTitle: "Core themes",
    title: "Your three-card reflection",
    versionLabel: "Content version",
  },
} as const satisfies TarotThreeCardMessages;

export const getTarotThreeCardMessages = (locale: Locale): TarotThreeCardMessages => {
  switch (locale) {
    case "en":
      return englishTarotThreeCardMessages;
  }
};
