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
      "Only the selected theme is sent. After a draw is fixed, this tab temporarily stores only its random reading ID for refresh recovery—not the result text, a question, or analytics data.",
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
      retryAfterLabel: "Server wait before another attempt:",
      returnToThemes: "Return to theme selection",
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
    resume: {
      chooseNew: "Choose a new theme instead",
      error: {
        message:
          "The saved result could not be checked. Nothing will retry or draw other cards automatically.",
        title: "The saved result could not be restored",
      },
      invalid: {
        message:
          "The saved result did not pass validation and was removed from this tab. No cards were redrawn.",
        title: "The saved result was invalid",
      },
      loading: "Restoring the fixed result saved in this tab",
      notFound: {
        message:
          "That saved result is no longer available to this private session. Its reading ID was removed from this tab.",
        title: "The saved result is no longer available",
      },
      offline: {
        message:
          "Reconnect to restore the saved result. Its reading ID remains in this tab, and nothing will retry automatically.",
        title: "You appear to be offline",
      },
      ready:
        "These are the same saved cards in the same order. Revealing them does not draw again.",
      retry: "Try to restore the saved result",
      unavailable: {
        message:
          "The saved result cannot be restored right now. Its reading ID remains in this tab, and nothing will retry automatically.",
        title: "The reading service is unavailable",
      },
    },
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
    newReflection: "Start a new reflection",
    newReflectionBoundary:
      "A new reflection creates a separate server-selected draw. It does not make this result more certain, and you can stop here.",
    notStored:
      "This fixed result remains on this page, but no reading ID is currently stored for refresh recovery.",
    orientation: {
      reversed: "Reversed",
      upright: "Upright",
    },
    perspectiveTitle: "What this position may invite you to notice",
    previousPreserved:
      "Your previous fixed result remains available while a separate new reflection is unfinished.",
    positionBoundary:
      "Situation and Action are reflective lenses. Possibility is something to consider, not a prediction of what will happen.",
    reflectionTitle: "A question to reflect on",
    replayed: "This was the same verified result from an earlier matching attempt.",
    restored:
      "This is the same fixed result restored for this private session. No cards were redrawn.",
    saved:
      "This tab temporarily stores only this reading's random ID so the same fixed result can be restored after a refresh.",
    tensionLabel: "A tension to consider",
    themesTitle: "Core themes",
    title: "Your three-card reflection",
    versionLabel: "Content version",
    report: {
      categories: {
        accessibility: "Accessibility",
        cultural: "Cultural context",
        factual: "Factual accuracy",
        rights: "Rights or attribution",
        safety: "Safety",
        translation: "Translation",
      },
      categoryLabel: "Issue category",
      conflict:
        "This saved report no longer matches the selected options. Choose again to start a new report.",
      disclosure:
        "Reports record only the selected category and target. There is no free-text field, and reporting does not redraw or change this result.",
      error: "The report was not recorded. Nothing will retry automatically.",
      notFound: "This reading is no longer available to report in the current private session.",
      offline: "Reconnect before sending this report. Nothing will retry automatically.",
      retry: "Try the same report again",
      selectCategory: "Choose a category",
      selectTarget: "Choose what the report concerns",
      startNew: "Start a new report request",
      submit: "Send report",
      submitting: "Sending report",
      success: "Thank you. The report was recorded without your private question or journal text.",
      summary: "Report an issue with this reading",
      targetLabel: "Report target",
      targetPosition: "Position: {position}",
      targetReading: "The whole reading",
      unavailable:
        "The report service is temporarily unavailable. Nothing will retry automatically.",
    },
  },
} as const satisfies TarotThreeCardMessages;

export const getTarotThreeCardMessages = (locale: Locale): TarotThreeCardMessages => {
  switch (locale) {
    case "en":
      return englishTarotThreeCardMessages;
  }
};
