import type { QuestionIntakeSuggestionCode, QuestionIntakeThemeCode } from "@rituvia/domain";

import type { Locale } from "./routing";

export type QuestionIntakeMessages = Readonly<{
  metadata: Readonly<{ description: string; title: string }>;
  page: Readonly<{
    boundary: string;
    eyebrow: string;
    introduction: string;
    privacy: string;
    title: string;
  }>;
  form: Readonly<{
    example: string;
    loading: string;
    noScript: string;
    questionDescription: string;
    questionLabel: string;
    submit: string;
    themeDescription: string;
    themeError: string;
    themeLabel: string;
    themeRequired: string;
  }>;
  themes: Readonly<Record<QuestionIntakeThemeCode, string>>;
  suggestions: Readonly<Record<QuestionIntakeSuggestionCode, string>>;
  outcomes: Readonly<{
    allowed: Readonly<{ continue: string; message: string; reset: string; title: string }>;
    blocked: Readonly<{ message: string; title: string; useSuggestion: string }>;
    crisis: Readonly<{ message: string; title: string }>;
    error: Readonly<{ message: string; retry: string; title: string }>;
    offline: Readonly<{ message: string; retry: string; title: string }>;
    rateLimited: Readonly<{ message: string; title: string }>;
    reframed: Readonly<{ message: string; title: string; useSuggestion: string }>;
    unavailable: Readonly<{ message: string; retry: string; title: string }>;
  }>;
}>;

const englishQuestionIntakeMessages = {
  metadata: {
    description:
      "Choose a reflection theme and privately check an optional question against RITUVIA's symbolic-reflection boundaries.",
    title: "Private reflection intake",
  },
  page: {
    boundary:
      "Symbolic reflection can offer perspective. It cannot predict outcomes or replace professional support.",
    eyebrow: "Private reflection intake",
    introduction: "Choose one theme. You may add a question or continue without writing one.",
    privacy:
      "Your question is checked in memory and is not placed in the URL, page metadata, product analytics, or persistent intake storage.",
    title: "What would you like to reflect on?",
  },
  form: {
    example: "Example: What perspective could help me approach this conversation?",
    loading: "Reviewing your question",
    noScript:
      "JavaScript is required for this private check. The form stays disabled so your question cannot be placed in a URL.",
    questionDescription:
      "Focus on what you can notice, prepare for, or choose. You may continue without writing a question.",
    questionLabel: "Optional question",
    submit: "Review my question",
    themeDescription: "Choose the area that best fits this moment.",
    themeError: "Choose one theme to continue.",
    themeLabel: "Reflection theme",
    themeRequired: "required",
  },
  themes: {
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
  suggestions: {
    agency_general: "What can I notice, prepare for, or choose in this situation?",
    professional_preparation: "What questions could I prepare for a qualified professional?",
    relationship_agency: "What boundaries or actions are within my control in this relationship?",
    grounded_observation: "What observable facts and supportive steps could help me feel grounded?",
  },
  outcomes: {
    allowed: {
      continue: "Continue to a private one-card reflection",
      message:
        "This theme and question fit the current reflection boundary. Continue only if a symbolic perspective would be useful; your question will not be copied into the reading request.",
      reset: "Review another question",
      title: "Ready for a bounded reflection",
    },
    blocked: {
      message:
        "RITUVIA cannot determine or interpret this high-stakes or harmful request. You can choose the safer question below and review it again.",
      title: "This question is outside symbolic reflection",
      useSuggestion: "Use the safer question",
    },
    crisis: {
      message:
        "If you or someone else may be in immediate danger or at risk of self-harm, contact local emergency services now. Reach a trusted person who can stay with the person at risk. RITUVIA cannot provide emergency help.",
      title: "Pause this reflection and get immediate support",
    },
    error: {
      message:
        "The private check did not complete. Your draft remains only in this page, and nothing will retry automatically.",
      retry: "Try again",
      title: "The question could not be reviewed",
    },
    offline: {
      message:
        "Reconnect before sending this question. Your draft remains only in this page and will not be sent automatically.",
      retry: "Check connection and try again",
      title: "You appear to be offline",
    },
    rateLimited: {
      message:
        "Pause before sending another question. Your draft remains only in this page, and nothing will retry automatically.",
      title: "Question checks are temporarily limited",
    },
    reframed: {
      message:
        "This wording asks for certainty or falls outside the reviewed agency-preserving patterns. You can explicitly choose the safer question below and review it again.",
      title: "A gentler question keeps the choice with you",
      useSuggestion: "Use the suggested question",
    },
    unavailable: {
      message:
        "The intake service is temporarily unavailable. Your draft remains only in this page, and nothing will retry automatically.",
      retry: "Try again",
      title: "The question check is unavailable",
    },
  },
} as const satisfies QuestionIntakeMessages;

export const getQuestionIntakeMessages = (locale: Locale): QuestionIntakeMessages => {
  switch (locale) {
    case "en":
      return englishQuestionIntakeMessages;
  }
};
