import type { Locale } from "./routing";

type PracticeStep = Readonly<{
  title: string;
  description: string;
}>;

type Principle = Readonly<{
  title: string;
  description: string;
}>;

export type ShellMessages = Readonly<{
  metadata: Readonly<{
    title: string;
    description: string;
  }>;
  accessibility: Readonly<{
    skipToContent: string;
    noScript: string;
  }>;
  navigation: Readonly<{
    home: string;
    homeLabel: string;
    primaryLabel: string;
    practice: string;
    principles: string;
    privacy: string;
    primaryAction: string;
    localeLabel: string;
    localeName: string;
    localeHint: string;
  }>;
  hero: Readonly<{
    status: string;
    eyebrow: string;
    title: string;
    introduction: string;
    boundary: string;
    primaryAction: string;
    secondaryAction: string;
  }>;
  trust: Readonly<{
    label: string;
    items: readonly string[];
  }>;
  practice: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    steps: readonly PracticeStep[];
  }>;
  principles: Readonly<{
    eyebrow: string;
    title: string;
    introduction: string;
    items: readonly Principle[];
  }>;
  privacy: Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    note: string;
  }>;
  footer: Readonly<{
    navigationLabel: string;
    foundationNote: string;
  }>;
}>;

const englishMessages = {
  metadata: {
    title: "A private place for symbolic reflection",
    description:
      "A calm, private foundation for symbolic reflection, intention, ritual, and thoughtful return.",
  },
  accessibility: {
    skipToContent: "Skip to main content",
    noScript: "This page remains fully readable and navigable without JavaScript.",
  },
  navigation: {
    home: "Home",
    homeLabel: "{brand} home",
    primaryLabel: "Primary navigation",
    practice: "The practice",
    principles: "Our principles",
    privacy: "Privacy",
    primaryAction: "Explore the practice",
    localeLabel: "Language",
    localeName: "English",
    localeHint: "English is the only reviewed language currently available.",
  },
  hero: {
    status: "English foundation preview",
    eyebrow: "A private space for symbolic reflection",
    title: "Pause. Notice what matters. Choose one small next step.",
    introduction:
      "This space is being built as a calm place to explore perspective, shape an intention, and return to what you learn—without fear, pressure, or certainty claims.",
    boundary: "Symbolic reflection, not prediction or professional advice.",
    primaryAction: "See the reflection path",
    secondaryAction: "How privacy begins",
  },
  trust: {
    label: "Product commitments",
    items: ["Private by default", "No belief required", "A meaningful free path"],
  },
  practice: {
    eyebrow: "A complete moment",
    title: "From a question to a thoughtful return.",
    introduction:
      "The experience is being shaped around a finite path that supports your agency instead of asking you to keep scrolling, buying, or drawing.",
    steps: [
      {
        title: "Question",
        description: "Begin with a theme or an agency-preserving question you want to consider.",
      },
      {
        title: "Interpretation",
        description: "Explore one symbolic perspective with its limits stated clearly.",
      },
      {
        title: "Intention",
        description: "Name what you want to practice and choose one small action you control.",
      },
      {
        title: "Ritual",
        description: "Create a deliberate pause with an accessible free ritual path.",
      },
      {
        title: "Journal",
        description: "Reflect privately, without a required mood score or public performance.",
      },
      {
        title: "Revisit",
        description:
          "Return to your own words and actions without treating events as proof of fate.",
      },
    ],
  },
  principles: {
    eyebrow: "Trust before novelty",
    title: "Grounded in clarity, agency, and completion.",
    introduction:
      "The public foundation sets expectations before any personal experience is available.",
    items: [
      {
        title: "Your agency stays central",
        description:
          "Reflections may offer possibilities and questions. They do not predict what will happen or make decisions for you.",
      },
      {
        title: "Boundaries appear nearby",
        description:
          "Symbolic material stays distinct from medical, legal, financial, and other professional guidance.",
      },
      {
        title: "Completion over compulsion",
        description:
          "Every experience should end with a clear next step or a calm stopping point—not an infinite feed.",
      },
    ],
  },
  privacy: {
    eyebrow: "Private from the foundation",
    title: "A public page that asks for nothing personal.",
    description:
      "This first shell does not collect a question, journal entry, prayer, birth detail, account, payment, or analytics event. It explains the product boundary before those future capabilities exist.",
    note: "Future private content must stay out of URLs, page metadata, logs, analytics, notifications, and public previews.",
  },
  footer: {
    navigationLabel: "Foundation navigation",
    foundationNote:
      "This repository-local foundation does not yet offer accounts, readings, purchases, legal terms, or a public launch.",
  },
} as const satisfies ShellMessages;

export const getMessages = (locale: Locale): ShellMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};
