import type { QuestionIntakeThemeCode } from "@rituvia/domain";

import type { Locale } from "./routing";
import { getQuestionIntakeMessages } from "./question-intake-messages";

export type TarotOneCardMessages = Readonly<{
  metadata: Readonly<{ description: string; title: string }>;
  page: Readonly<{
    boundary: string;
    eyebrow: string;
    introduction: string;
    privacy: string;
    title: string;
  }>;
  form: Readonly<{
    loading: string;
    noScript: string;
    submit: string;
    themeDescription: string;
    themeError: string;
    themeLabel: string;
    themeRequired: string;
  }>;
  themes: Readonly<Record<QuestionIntakeThemeCode, string>>;
  states: Readonly<{
    conflict: Readonly<{ message: string; startOver: string; title: string }>;
    drawing: string;
    error: Readonly<{ message: string; retry: string; title: string }>;
    limitReached: Readonly<{ message: string; retry: string; title: string }>;
    offline: Readonly<{ message: string; retry: string; title: string }>;
    ready: Readonly<{ message: string; reveal: string; title: string }>;
    replayed: string;
    session: string;
    sessionRequired: Readonly<{ message: string; retry: string; title: string }>;
    unavailable: Readonly<{ message: string; retry: string; title: string }>;
  }>;
  result: Readonly<{
    actionTitle: string;
    aiBoundary: string;
    alternativeTitle: string;
    cannotDetermineTitle: string;
    completion: string;
    constructiveLabel: string;
    engineVersionLabel: string;
    methodologyAction: string;
    methodologySummary: string;
    orientation: Readonly<Record<"reversed" | "upright", string>>;
    perspectiveTitle: string;
    reflectionTitle: string;
    replayed: string;
    saved: string;
    tensionLabel: string;
    themesTitle: string;
    title: string;
    versionLabel: string;
  }>;
}>;

const questionIntakeMessages = getQuestionIntakeMessages("en");

const englishTarotOneCardMessages = {
  metadata: {
    description:
      "Choose a private reflection theme and reveal one server-selected symbolic perspective.",
    title: "Private one-card reflection",
  },
  page: {
    boundary: questionIntakeMessages.page.boundary,
    eyebrow: "One-card reflection",
    introduction:
      "Choose one theme. The server fixes a single card before you reveal it, and the result remains useful without an account or payment.",
    privacy:
      "Only the selected theme is sent with this reading. This flow has no question field and does not place the result in the URL or product analytics.",
    title: "A single perspective for this moment",
  },
  form: {
    loading: "Preparing your private draw",
    noScript:
      "JavaScript is required to create the private session and server-authoritative draw. The controls stay disabled without it.",
    submit: "Draw one card",
    themeDescription: "Choose the area where a symbolic perspective may be useful.",
    themeError: "Choose one theme before drawing a card.",
    themeLabel: "Reflection theme",
    themeRequired: "required",
  },
  themes: questionIntakeMessages.themes,
  states: {
    conflict: {
      message:
        "This saved attempt no longer matches the selected theme. Nothing was redrawn automatically. Start over only if you want a new request.",
      startOver: "Start over with no saved attempt",
      title: "This draw request conflicts with an earlier attempt",
    },
    drawing: "The server is fixing one card for this theme",
    error: {
      message:
        "The draw did not complete in this page. Nothing will retry automatically, and trying again keeps the same draw request.",
      retry: "Try the same draw again",
      title: "The draw could not be completed",
    },
    limitReached: {
      message:
        "This private session has reached its current reading limit. Pause here and return later; another card would not make the reflection more certain.",
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
        "The server has fixed this card. Revealing it changes only what is shown on this page; it does not draw again.",
      reveal: "Reveal my card",
      title: "Your card is ready",
    },
    replayed: "A matching saved attempt returned the same fixed card.",
    session: "Creating or resuming a private session",
    sessionRequired: {
      message:
        "The private session could not be confirmed. Try again manually; the existing draw request will be preserved.",
      retry: "Confirm the session and try again",
      title: "A private session is required",
    },
    unavailable: {
      message:
        "The one-card experience is temporarily unavailable. Nothing will retry or draw another card automatically.",
      retry: "Try the same draw again",
      title: "The reading service is unavailable",
    },
  },
  result: {
    actionTitle: "One small action",
    aiBoundary: "This result uses reviewed canonical content, not an AI-generated interpretation.",
    alternativeTitle: "Other lenses to hold beside it",
    cannotDetermineTitle: "What this cannot determine",
    completion: "You can stop here with one question and one small action.",
    constructiveLabel: "A constructive possibility",
    engineVersionLabel: "Draw engine",
    methodologyAction: "Read the methodology",
    methodologySummary: "How this draw was made",
    orientation: {
      reversed: "Reversed",
      upright: "Upright",
    },
    perspectiveTitle: "What this may invite you to notice",
    reflectionTitle: "A question to reflect on",
    replayed: "This was the same verified result from an earlier matching attempt.",
    saved: "This fixed draw is linked to the current private browser session.",
    tensionLabel: "A tension to consider",
    themesTitle: "Core themes",
    title: "Your one-card reflection",
    versionLabel: "Content version",
  },
} as const satisfies TarotOneCardMessages;

export const getTarotOneCardMessages = (locale: Locale): TarotOneCardMessages => {
  switch (locale) {
    case "en":
      return englishTarotOneCardMessages;
  }
};
