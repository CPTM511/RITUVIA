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

type OracleMethod = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  note: string;
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
    sanctuary: string;
    signIn: string;
    account: string;
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
  oracle: Readonly<{
    eyebrow: string;
    numerology: OracleMethod;
    title: string;
    introduction: string;
    oneCard: OracleMethod;
    threeCard: OracleMethod;
    sanctuary: OracleMethod;
  }>;
  sanctuaryPreview: Readonly<{
    eyebrow: string;
    title: string;
    description: string;
    note: string;
    action: string;
    imageAlt: string;
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
      sanctuary: "Sanctuary",
      signIn: "Sign in",
      account: "Account",
      localeLabel: "Language",
      localeName: "English",
      localeHint: "English is the current launch language; no other reviewed locale is active.",
    },
    footer: {
      navigationLabel: "Public information navigation",
      foundationNote:
        "Symbolic reflection and AI-generated interpretations are for entertainment and self-reflection, not prediction or professional advice.",
    },
  },
  home: {
    metadata: {
      title: "A private place for symbolic reflection",
      description:
        "A calm, private foundation for symbolic self-reflection, personal ritual, and thoughtful return.",
    },
    hero: {
      status: "Anonymous first · private by default",
      eyebrow: "Read · Intend · Ritualize · Reflect",
      title: "Read the symbols. Set an intention. Return to yourself.",
      introduction:
        "A calm digital space for symbolic self-reflection. Begin with a free tarot reading, choose one action you control, and carry the insight into a private ritual and journal.",
      boundary: "Symbolic reflection, not prediction or professional advice.",
      primaryAction: "Begin a free reading",
      secondaryAction: "Enter the sanctuary",
    },
    trust: {
      label: "Product commitments",
      items: ["Private by default", "No belief required", "A meaningful free path"],
    },
    oracle: {
      eyebrow: "The oracle",
      title: "Choose today's entry point.",
      introduction:
        "Each reading keeps the random draw separate from the interpretation and ends with a calm stopping point.",
      numerology: {
        eyebrow: "Every step visible",
        title: "Numerology calculator",
        description:
          "Calculate Life Path, Birthday Number, and Personal Year through one reviewed date method.",
        action: "Calculate my numbers",
        note: "Free · anonymous · no saved birth data",
      },
      oneCard: {
        eyebrow: "A focused pause",
        title: "One-card reflection",
        description:
          "Explore one theme through reviewed card content and an optional bounded AI interpretation.",
        action: "Draw one card",
        note: "Free · anonymous · about three minutes",
      },
      threeCard: {
        eyebrow: "A wider perspective",
        title: "Three-card reflection",
        description:
          "Consider Situation, Action, and Possibility without turning the spread into a prediction.",
        action: "Draw three cards",
        note: "Free · anonymous · fixed result",
      },
      sanctuary: {
        eyebrow: "Complete the loop",
        title: "Private sanctuary",
        description:
          "Set an intention, place a free ritual object, and save one private reflection.",
        action: "Visit the sanctuary",
        note: "A free ritual path always remains",
      },
    },
    sanctuaryPreview: {
      eyebrow: "Digital sanctuary",
      title: "Turn one insight into a ritual you can complete.",
      description:
        "Choose an intention, one small action, a free or owned ritual object, and a private journal entry.",
      note: "Paid objects enhance visual ambience only. They do not make an outcome more likely.",
      action: "Enter my sanctuary",
      imageAlt: "A luminous violet and gold sanctuary orb floating above a circular altar",
    },
    practice: {
      eyebrow: "A complete moment",
      title: "From a question to a thoughtful return.",
      introduction:
        "The experience follows a finite path that supports your agency instead of asking you to keep scrolling, buying, or drawing.",
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
        "These expectations remain visible before, during, and after every symbolic reading.",
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
        "Public pages ask for no personal content. Private questions, intentions, journals, accounts, and payments stay on purpose-limited routes with separate controls.",
      note: "Only the minimum operational request metadata needed to serve and protect this site may be processed.",
      action: "Review the privacy design",
    },
  },
  pages: {
    methodology: {
      metadata: {
        title: "How symbolic reflection is designed",
        description:
          "Learn how RITUVIA separates deterministic calculations, curated sources, bounded AI explanation, and personal reflection.",
      },
      eyebrow: "Methodology",
      title: "A transparent path from source material to your own reflection.",
      introduction:
        "The method keeps calculation, interpretation, and personal choice separate so the product can show what it knows, what it suggests, and what remains yours to decide.",
      status:
        "Free one-card and three-card reflections use fixed server-side draws and reviewed source content.",
      sections: [
        {
          title: "Product systems draw and calculate; AI does not",
          description:
            "Tested domain logic performs randomized card draws. AI prose does not choose cards, prices, entitlements, or country eligibility.",
        },
        {
          title: "Curated sources provide context",
          description:
            "Versioned, reviewed sources provide card context and limits. General model memory does not act as the cultural authority.",
        },
        {
          title: "Bounded AI explains",
          description:
            "When AI-generated material is available, it is disclosed and constrained to explain possibilities, context, limitations, and reflective questions. It cannot invent calculations or certainty.",
        },
        {
          title: "You interpret your life",
          description:
            "A reading can offer a lens, but your circumstances, values, and choices remain primary. The loop can lead to an intention, a small action, a ritual, a private journal, and an optional revisit.",
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
          "See the complete reflection path and the commitments that apply throughout the experience.",
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
        "RITUVIA is designed around autonomy, clear limits, and calm stopping points. Symbolic material is never presented as authority over your life.",
      status: "Product boundary overview; this is not professional or emergency guidance.",
      sections: [
        {
          title: "No high-stakes determinations",
          description:
            "The product does not diagnose or treat health conditions, decide legal outcomes, promise financial results, predict fertility or death, determine guilt, or replace qualified professional support.",
        },
        {
          title: "No fear or supernatural certainty",
          description:
            "It does not validate mind reading, curses, supernatural persecution, guaranteed reunion, guaranteed wealth, or other claims that intensify fear, paranoia, or certainty about unseen causes.",
        },
        {
          title: "No dependence by design",
          description:
            "There is no false scarcity, shame, streak punishment, countdown pressure, infinite drawing, or language that makes the product necessary for a decision.",
        },
        {
          title: "Payment never buys spiritual efficacy",
          description:
            "Paid digital objects add clearly described visual value. Paying more is never framed as stronger protection, luck, manifestation, or spiritual effect.",
        },
        {
          title: "A free ritual path remains",
          description:
            "A free candle and free incense experience remain available. Rituals are deliberate pauses for reflection, not proof that an outcome will occur.",
        },
      ],
      nextStep: {
        title: "Know what stays private",
        description:
          "Review the product privacy principles applied to questions, intentions, journals, accounts, and orders.",
        action: "Review the privacy design",
      },
    },
    privacy: {
      metadata: {
        title: "Privacy by product design",
        description:
          "Understand RITUVIA's public/private boundary and the controls around reflection and account data.",
      },
      eyebrow: "Privacy design",
      title: "Private reflection should not become public exhaust.",
      introduction:
        "This is a product-design overview, not a legal Privacy Policy. It explains the boundaries applied to the current local product.",
      status:
        "Public information pages accept no personal inputs. Account, reflection, and checkout data use separate private, non-indexable routes.",
      sections: [
        {
          title: "Public pages and private experiences stay separated",
          description:
            "Public pages do not collect personal content. Private questions, intentions, journals, accounts, orders, and entitlements stay off public and indexable routes.",
        },
        {
          title: "Reflection data stays private by default",
          description:
            "Questions, intentions, and journals are private content. Public sharing is not part of this MVP and is never the default.",
        },
        {
          title: "Sensitive words stay out of exposure surfaces",
          description:
            "Private content must not appear in URLs, page metadata, routine logs, analytics, notifications, or public previews. Any support access must be purpose-limited, authorized, and audited.",
        },
        {
          title: "AI receives only what the experience needs",
          description:
            "AI features minimize the context they send, disclose generated material, and exclude raw sensitive prompts from routine logs. Provider changes remain subject to review.",
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
          "Review how deterministic logic, curated sources, AI explanation, and personal judgment remain distinct.",
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
