import type { PublicPageSlug } from "./public-routes";
import type { Locale } from "./routing";

type PracticeStep = Readonly<{
  title: string;
  description: string;
}>;

type Principle = Readonly<{
  title: string;
  description: string;
}>;

type InformationSection = Readonly<{
  title: string;
  description: string;
  items?: readonly string[];
}>;

export type SharedMessages = Readonly<{
  accessibility: Readonly<{
    skipToContent: string;
    noScript: string;
  }>;
  navigation: Readonly<{
    home: string;
    homeLabel: string;
    primaryLabel: string;
    methodology: string;
    safety: string;
    privacy: string;
    primaryAction: string;
    localeLabel: string;
    localeName: string;
    localeHint: string;
  }>;
  footer: Readonly<{
    navigationLabel: string;
    foundationNote: string;
  }>;
}>;

export type HomeMessages = Readonly<{
  metadata: Readonly<{
    title: string;
    description: string;
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
  boundary: Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    note: string;
    action: string;
  }>;
}>;

export type PublicPageMessages = Readonly<{
  metadata: Readonly<{
    title: string;
    description: string;
  }>;
  eyebrow: string;
  title: string;
  introduction: string;
  status: string;
  sections: readonly InformationSection[];
  nextStep: Readonly<{
    title: string;
    description: string;
    action: string;
  }>;
}>;

export type ShellMessages = Readonly<{
  shared: SharedMessages;
  home: HomeMessages;
  pages: Readonly<Record<PublicPageSlug, PublicPageMessages>>;
}>;

const englishMessages = {
  shared: {
    accessibility: {
      skipToContent: "Skip to main content",
      noScript: "This page remains fully readable and navigable without JavaScript.",
    },
    navigation: {
      home: "Home",
      homeLabel: "{brand} home",
      primaryLabel: "Primary navigation",
      methodology: "Methodology",
      safety: "Safety",
      privacy: "Privacy",
      primaryAction: "Explore the practice",
      localeLabel: "Language",
      localeName: "English",
      localeHint:
        "English is the only language available in this foundation; no other locale is active.",
    },
    footer: {
      navigationLabel: "Public information navigation",
      foundationNote:
        "No readings, AI interpretations, accounts, purchases, or rituals are available in this foundation yet.",
    },
  },
  home: {
    metadata: {
      title: "A private place for symbolic reflection",
      description:
        "A calm, private foundation for symbolic self-reflection, personal ritual, and thoughtful return.",
    },
    hero: {
      status: "English foundation preview",
      eyebrow: "A private digital sanctuary in development",
      title: "Pause. Notice what matters. Choose one small next step.",
      introduction:
        "RITUVIA is being built for symbolic self-reflection, personal ritual, and a private digital sanctuary—a calm place to explore perspective, shape an intention, and return to what you learn.",
      boundary: "Symbolic reflection, not prediction or professional advice.",
      primaryAction: "See the reflection path",
      secondaryAction: "Read how the method works",
    },
    trust: {
      label: "Product commitments",
      items: ["Private by default", "No belief required", "A meaningful free path"],
    },
    practice: {
      eyebrow: "A complete moment",
      title: "From a question to a thoughtful return.",
      introduction:
        "The planned experience follows a finite path that supports your agency instead of asking you to keep scrolling, buying, or drawing.",
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
          description:
            "Create a deliberate pause. At least one free candle and one free incense experience are product commitments for ritual launch.",
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
    boundary: {
      eyebrow: "Trust starts in public",
      title: "Understand the boundaries before sharing anything personal.",
      description:
        "These public pages explain the planned method, safety limits, and privacy design. This foundation asks for no personal question, journal entry, prayer, birth detail, account, or payment.",
      note: "Only the minimum operational request metadata needed to serve and protect this site may be processed.",
      action: "Review the privacy design",
    },
  },
  pages: {
    methodology: {
      metadata: {
        title: "How symbolic reflection is designed",
        description:
          "Learn how RITUVIA plans to separate deterministic calculations, curated sources, bounded AI explanation, and personal reflection.",
      },
      eyebrow: "Methodology",
      title: "A transparent path from source material to your own reflection.",
      introduction:
        "The planned method keeps calculation, interpretation, and personal choice separate so the product can show what it knows, what it suggests, and what remains yours to decide.",
      status: "Method overview; no readings or AI interpretations are available yet.",
      sections: [
        {
          title: "Product systems draw and calculate; AI does not",
          description:
            "Tested domain logic will perform randomized card draws and deterministic numerology or chart calculations; AI prose will do neither.",
        },
        {
          title: "Curated sources provide context",
          description:
            "Versioned, reviewed sources will provide attributable, tradition-specific context, including limits or disagreement. General model memory will not act as the cultural authority.",
        },
        {
          title: "Bounded AI explains",
          description:
            "AI-generated material will be disclosed and constrained to explain possibilities, context, limitations, and reflective questions. It will not invent calculations or certainty.",
        },
        {
          title: "You interpret your life",
          description:
            "A reading can offer a lens, but your circumstances, values, and choices remain primary. The planned loop can lead to an intention, a small action, a ritual, a private journal, and an optional revisit.",
        },
        {
          title: "Modality boundaries stay visible",
          description:
            "Tarot, numerology, and astrology will remain separate systems. Western astrology is a future possibility and will not launch until a licensed calculation path, content and source rights, and required reviews are approved.",
        },
      ],
      nextStep: {
        title: "Start with the product boundary",
        description:
          "See the complete reflection path and the commitments that apply before any personal experience is available.",
        action: "Return to the reflection path",
      },
    },
    safety: {
      metadata: {
        title: "Safety and autonomy boundaries",
        description:
          "Review the safety limits RITUVIA plans to apply to symbolic reflection, rituals, AI explanations, and monetization.",
      },
      eyebrow: "Safety",
      title: "Reflection should widen your choices, not narrow them.",
      introduction:
        "RITUVIA is designed around autonomy, clear limits, and calm stopping points. Symbolic material will never be presented as authority over your life.",
      status: "Product boundary overview; this is not professional or emergency guidance.",
      sections: [
        {
          title: "No high-stakes determinations",
          description:
            "The product will not diagnose or treat health conditions, decide legal outcomes, promise financial results, predict fertility or death, determine guilt, or replace qualified professional support.",
        },
        {
          title: "No fear or supernatural certainty",
          description:
            "It will not validate mind reading, curses, supernatural persecution, guaranteed reunion, guaranteed wealth, or other claims that intensify fear, paranoia, or certainty about unseen causes.",
        },
        {
          title: "No dependence by design",
          description:
            "There will be no false scarcity, shame, streak punishment, countdown pressure, infinite drawing, or language that makes the product necessary for a decision.",
        },
        {
          title: "Payment never buys spiritual efficacy",
          description:
            "Enhanced experiences may add clearly described digital value, but paying more will never be framed as stronger protection, luck, manifestation, or spiritual effect.",
        },
        {
          title: "A free ritual path remains",
          description:
            "When rituals launch, at least one free candle and one free incense experience will be available. Rituals are deliberate pauses for reflection, not proof that an outcome will occur.",
        },
      ],
      nextStep: {
        title: "Know what stays private",
        description:
          "Review the product privacy principles planned for questions, intentions, prayers, journals, and birth details.",
        action: "Review the privacy design",
      },
    },
    privacy: {
      metadata: {
        title: "Privacy by product design",
        description:
          "Understand RITUVIA's current public-site boundary and the privacy principles planned for future sensitive reflection data.",
      },
      eyebrow: "Privacy design",
      title: "Private reflection should not become public exhaust.",
      introduction:
        "This is a product-design overview, not a legal Privacy Policy. It explains the current public foundation and the constraints planned for future personal experiences.",
      status:
        "This public foundation accepts no personal inputs and has no accounts, readings, purchases, or product analytics.",
      sections: [
        {
          title: "The current site asks for no personal content",
          description:
            "You cannot submit a question, journal entry, prayer, intention, birth detail, account, or payment on this foundation. Minimum operational request metadata may be processed to serve and protect the site.",
        },
        {
          title: "Future reflection data stays private by default",
          description:
            "Questions, intentions, prayers, journals, and birth details are planned as private content. Public sharing will never be the default.",
        },
        {
          title: "Sensitive words stay out of exposure surfaces",
          description:
            "Private content must not appear in URLs, page metadata, routine logs, analytics, notifications, or public previews. Any future support access must be purpose-limited, authorized, and audited.",
        },
        {
          title: "AI receives only what the experience needs",
          description:
            "Future AI features must minimize the context they send, disclose generated material, and exclude raw sensitive prompts from routine logs. Provider changes remain subject to review.",
        },
        {
          title: "Controls must be real before they are promised",
          description:
            "Retention, export, deletion, consent, and legal-policy details will be documented only after their product behavior and owner-approved terms exist.",
        },
      ],
      nextStep: {
        title: "See how interpretations stay bounded",
        description:
          "Review how deterministic logic, curated sources, AI explanation, and personal judgment are planned to remain distinct.",
        action: "Read the methodology",
      },
    },
  },
} as const satisfies ShellMessages;

export const getMessages = (locale: Locale): ShellMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
  }
};

export const getPublicPageMessages = (
  messages: ShellMessages,
  page: PublicPageSlug,
): PublicPageMessages => {
  switch (page) {
    case "methodology":
      return messages.pages.methodology;
    case "safety":
      return messages.pages.safety;
    case "privacy":
      return messages.pages.privacy;
  }
};
