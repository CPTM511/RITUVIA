import type { QuestionIntakeThemeCode } from "@rituvia/domain";

import type { Locale } from "./routing";
import { getQuestionIntakeMessages } from "./question-intake-messages";

export type TarotShareMessages = Readonly<{
  altTextLabel: string;
  boundary: string;
  description: string;
  download: string;
  downloaded: string;
  error: string;
  eyebrow: string;
  fileName: string;
  genericReflection: string;
  heading: string;
  hidePreview: string;
  includeTheme: string;
  nativeShare: string;
  nativeShareTitle: string;
  preview: string;
  privacy: string;
  shared: string;
  sharing: string;
  themeDescription: string;
  themeFieldLabel: string;
}>;

export type TarotReadingMessages = Readonly<{
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
    limitReached: Readonly<{
      message: string;
      retryAfterLabel: string;
      returnToThemes: string;
      title: string;
    }>;
    offline: Readonly<{ message: string; retry: string; title: string }>;
    ready: Readonly<{ message: string; reveal: string; title: string }>;
    replayed: string;
    resume: Readonly<{
      chooseNew: string;
      error: Readonly<{ message: string; title: string }>;
      invalid: Readonly<{ message: string; title: string }>;
      loading: string;
      notFound: Readonly<{ message: string; title: string }>;
      offline: Readonly<{ message: string; title: string }>;
      ready: string;
      retry: string;
      unavailable: Readonly<{ message: string; title: string }>;
    }>;
    session: string;
    sessionRequired: Readonly<{ message: string; retry: string; title: string }>;
    unavailable: Readonly<{ message: string; retry: string; title: string }>;
  }>;
  result: Readonly<{
    actionTitle: string;
    aiBoundary: string;
    alternativeTitle: string;
    cannotDetermineTitle: string;
    cardsLabel: string;
    completion: string;
    constructiveLabel: string;
    engineVersionLabel: string;
    methodologyAction: string;
    methodologySummary: string;
    newReflection: string;
    newReflectionBoundary: string;
    notStored: string;
    orientation: Readonly<Record<"reversed" | "upright", string>>;
    perspectiveTitle: string;
    previousPreserved: string;
    positionBoundary: string;
    reflectionTitle: string;
    replayed: string;
    restored: string;
    sanctuaryAction: string;
    sanctuaryBoundary: string;
    saved: string;
    share?: TarotShareMessages;
    tensionLabel: string;
    themesTitle: string;
    title: string;
    versionLabel: string;
    interpretation: Readonly<{
      actionTitle: string;
      boundary: string;
      cancel: string;
      fallbackLabel: string;
      fallbackNotice: string;
      heading: string;
      idleDescription: string;
      kicker: string;
      limitsTitle: string;
      meaningLabel: string;
      perspectivesTitle: string;
      possibilityLabel: string;
      privacy: string;
      processingDescription: string;
      processingTitle: string;
      questionsTitle: string;
      retry: string;
      ritualTitle: string;
      start: string;
      symbolsTitle: string;
      terminal: Readonly<{ message: string; title: string }>;
      timeHorizon: Readonly<Record<"open" | "today" | "this_week", string>>;
      verifiedLabel: string;
      failures: Readonly<
        Record<
          | "conflict"
          | "invalid_response"
          | "not_found"
          | "offline"
          | "permission"
          | "rate_limited"
          | "session_expired"
          | "unavailable",
          Readonly<{ message: string; title: string }>
        >
      >;
    }>;
    report: Readonly<{
      categories: Readonly<
        Record<
          "accessibility" | "cultural" | "factual" | "rights" | "safety" | "translation",
          string
        >
      >;
      categoryLabel: string;
      conflict: string;
      disclosure: string;
      error: string;
      interpretationDisclosure: string;
      interpretationSummary: string;
      notFound: string;
      offline: string;
      retry: string;
      selectCategory: string;
      selectTarget: string;
      startNew: string;
      submit: string;
      submitting: string;
      success: string;
      summary: string;
      targetLabel: string;
      targetInterpretation: string;
      targetPosition: string;
      targetReading: string;
      unavailable: string;
    }>;
  }>;
}>;

export type TarotOneCardMessages = Readonly<
  Omit<TarotReadingMessages, "result"> & {
    result: Readonly<
      Omit<TarotReadingMessages["result"], "share"> & {
        share: TarotShareMessages;
      }
    >;
  }
>;

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
      "Only the selected theme is sent. After a draw is fixed, this tab temporarily stores only its random reading ID for refresh recovery—not the result text, a question, or analytics data.",
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
        "The server has fixed this card. Revealing it changes only what is shown on this page; it does not draw again.",
      reveal: "Reveal my card",
      title: "Your card is ready",
    },
    replayed: "A matching saved attempt returned the same fixed card.",
    resume: {
      chooseNew: "Choose a new theme instead",
      error: {
        message:
          "The saved result could not be checked. Nothing will retry or draw another card automatically.",
        title: "The saved result could not be restored",
      },
      invalid: {
        message:
          "The saved result did not pass validation and was removed from this tab. No card was redrawn.",
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
      ready: "This is the same saved result. Revealing it does not draw another card.",
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
        "The one-card experience is temporarily unavailable. Nothing will retry or draw another card automatically.",
      retry: "Try the same draw again",
      title: "The reading service is unavailable",
    },
  },
  result: {
    actionTitle: "One small action",
    aiBoundary:
      "This fixed card result uses reviewed canonical content, not an AI-generated interpretation. Any optional AI-generated interpretation appears in a separate panel after the card.",
    alternativeTitle: "Other lenses to hold beside it",
    cannotDetermineTitle: "What this cannot determine",
    cardsLabel: "Ordered reading positions",
    completion: "You can stop here with one question and one small action.",
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
    perspectiveTitle: "What this may invite you to notice",
    previousPreserved:
      "Your previous fixed result remains available while a separate new reflection is unfinished.",
    positionBoundary:
      "This symbolic perspective offers something to consider, not a prediction or instruction.",
    reflectionTitle: "A question to reflect on",
    replayed: "This was the same verified result from an earlier matching attempt.",
    restored:
      "This is the same fixed result restored for this private session. No card was redrawn.",
    sanctuaryAction: "Continue to a private intention",
    sanctuaryBoundary:
      "Continue only if it feels useful. Sanctuary can link this fixed reading to an intention without copying private prose into browser storage.",
    saved:
      "This tab temporarily stores only this reading's random ID so the same fixed result can be restored after a refresh.",
    share: {
      altTextLabel: "Accessible description:",
      boundary: "Symbolic reflection · not a prediction",
      description:
        "Create a local preview before choosing whether to download it or open your device's share sheet.",
      download: "Download privacy-safe SVG",
      downloaded: "The privacy-safe SVG was downloaded. Nothing was uploaded.",
      error: "The privacy-safe share card could not be prepared. Nothing was uploaded or retried.",
      eyebrow: "Optional sharing",
      fileName: "rituvia-reflection-card.svg",
      genericReflection: "A symbolic perspective to hold lightly, with your own judgment in view.",
      heading: "Preview a privacy-safe share card",
      hidePreview: "Hide share preview",
      includeTheme: "Include my selected reflection theme",
      nativeShare: "Open device share sheet",
      nativeShareTitle: "A symbolic reflection",
      preview: "Preview share card",
      privacy:
        "The card uses only the card title, orientation, optional bounded theme, generic reflection line, public Tarot URL, and configured brand attribution. It never includes a private question, reading ID, interpretation, birth data, intention, journal text, or account details.",
      shared: "The privacy-safe card was passed to your device's share sheet.",
      sharing: "Opening device share sheet",
      themeDescription:
        "On by default. Turn this off before previewing if the theme feels personal.",
      themeFieldLabel: "Reflection theme",
    },
    tensionLabel: "A tension to consider",
    themesTitle: "Core themes",
    title: "Your one-card reflection",
    versionLabel: "Content version",
    interpretation: {
      actionTitle: "One small action",
      boundary: "Symbolic reflection, not professional advice.",
      cancel: "Stop checking",
      fallbackLabel: "Reviewed non-AI fallback",
      fallbackNotice:
        "The AI draft was not used. This bounded alternative comes from reviewed content.",
      heading: "Explore a deeper interpretation",
      idleDescription:
        "Ask for one optional, structured perspective on the fixed cards. Starting is explicit and never redraws the reading.",
      kicker: "Optional AI perspective",
      limitsTitle: "Limits to hold in view",
      meaningLabel: "Context",
      perspectivesTitle: "Possibilities to consider",
      possibilityLabel: "A possibility",
      privacy:
        "Only this reading's random ID is used. No free-text question, journal entry, or payment data is sent.",
      processingDescription:
        "The draft remains hidden while it is independently checked. The fixed reading above stays available.",
      processingTitle: "Preparing and checking the interpretation",
      questionsTitle: "Questions for reflection",
      retry: "Try the same request again",
      ritualTitle: "Optional ritual prompt",
      start: "Explore the deeper interpretation",
      symbolsTitle: "Symbols and context",
      terminal: {
        message:
          "No enhanced text was released because the request did not complete its checks. The fixed reading above remains complete.",
        title: "No interpretation was displayed",
      },
      timeHorizon: {
        open: "when it feels useful",
        today: "today",
        this_week: "this week",
      },
      verifiedLabel: "AI-generated interpretation · independently checked",
      failures: {
        conflict: {
          message:
            "This request no longer matches the saved interpretation. The fixed reading is unchanged.",
          title: "The interpretation request conflicts",
        },
        invalid_response: {
          message:
            "The returned interpretation did not pass the page's safety checks and was not displayed.",
          title: "The interpretation could not be verified",
        },
        not_found: {
          message:
            "This private reading or interpretation is no longer available in the current session.",
          title: "The interpretation is no longer available",
        },
        offline: {
          message:
            "Reconnect before checking the same request. Nothing will retry in the background.",
          title: "You appear to be offline",
        },
        permission: {
          message:
            "An enhanced interpretation is not available for this reading. The fixed result remains complete.",
          title: "The interpretation is not available",
        },
        rate_limited: {
          message:
            "Pause before checking again. Nothing will create another interpretation automatically.",
          title: "Interpretation checks are temporarily limited",
        },
        session_expired: {
          message:
            "The private session ended before this interpretation could be checked. The visible fixed result is unchanged.",
          title: "The private session has ended",
        },
        unavailable: {
          message:
            "The enhanced interpretation is temporarily unavailable. The fixed reading above remains complete and useful.",
          title: "The interpretation could not be completed",
        },
      },
    },
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
      interpretationDisclosure:
        "This report records only the selected category and the exact displayed interpretation request. It does not include the interpretation text, your private question, or journal content.",
      interpretationSummary: "Report an issue with this interpretation",
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
      targetInterpretation: "The displayed interpretation",
      targetPosition: "Position: {position}",
      targetReading: "The whole reading",
      unavailable:
        "The report service is temporarily unavailable. Nothing will retry automatically.",
    },
  },
} as const satisfies TarotOneCardMessages;

export const getTarotOneCardMessages = (locale: Locale): TarotOneCardMessages => {
  switch (locale) {
    case "en":
      return englishTarotOneCardMessages;
  }
};
