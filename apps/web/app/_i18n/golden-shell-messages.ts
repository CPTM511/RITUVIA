import { createLocalActionHref, type LocalActionHref } from "@rituvia/ui";

export const goldenShellLocales = Object.freeze(["en", "zh-Hans"] as const);

export type GoldenShellLocale = (typeof goldenShellLocales)[number];

type GoldenMethod = Readonly<{
  action: string;
  badge: string;
  description: string;
  footer: string;
  title: string;
}>;

type GoldenValueCard = Readonly<{
  badge: string;
  description: string;
  title: string;
}>;

type GoldenLoopStep = Readonly<{
  description: string;
  title: string;
}>;

type GoldenRecoverableState = Readonly<{
  message: string;
  retryAction: string;
  retryingAction: string;
  returnAction: string;
  title: string;
}>;

export type GoldenShellMessages = Readonly<{
  accessibility: Readonly<{
    closeMenu: string;
    disabledAction: string;
    mobileNavigation: string;
    openMenu: string;
    primaryNavigation: string;
    reduceMotion: string;
    skipToContent: string;
    switchLanguage: string;
  }>;
  footer: Readonly<{
    account: readonly string[];
    accountHeading: string;
    begin: readonly string[];
    beginHeading: string;
    continue: readonly string[];
    continueHeading: string;
    copyright: string;
    introduction: string;
    legal: string;
  }>;
  freePath: Readonly<{
    action: string;
    cards: readonly GoldenValueCard[];
    eyebrow: string;
    introduction: string;
    title: string;
  }>;
  hero: Readonly<{
    cardLabel: string;
    eyebrow: string;
    introduction: string;
    meta: readonly string[];
    primaryAction: string;
    secondaryAction: string;
    titleAccent: string;
    titleLead: string;
  }>;
  loop: Readonly<{
    eyebrow: string;
    introduction: string;
    steps: readonly GoldenLoopStep[];
    title: string;
  }>;
  metadata: Readonly<{
    description: string;
    title: string;
  }>;
  navigation: Readonly<{
    account: string;
    brandHomeLabel: string;
    brandTagline: string;
    home: string;
    journal: string;
    plus: string;
    readings: string;
    revisit: string;
    sanctuary: string;
    signIn: string;
    switchLabel: string;
  }>;
  state: Readonly<{
    connection: Readonly<{
      offlineAnnouncement: string;
      onlineAnnouncement: string;
    }>;
    error: GoldenRecoverableState;
    offline: GoldenRecoverableState;
  }>;
  wayIn: Readonly<{
    eyebrow: string;
    introduction: string;
    methods: readonly GoldenMethod[];
    title: string;
  }>;
}>;

export const goldenShellReview = Object.freeze({
  authority: "2026-07-23 owner-approved production source-of-truth pack",
  prototypeSha256: "e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740",
  reviewedDate: "2026-07-23",
  schemaVersion: "rituvia-golden-shell-copy.v1",
});

const englishMessages = {
  accessibility: {
    closeMenu: "Close menu",
    disabledAction: "Unavailable in this protected staging item",
    mobileNavigation: "Mobile navigation",
    openMenu: "Open menu",
    primaryNavigation: "Primary navigation",
    reduceMotion: "Reduce motion",
    skipToContent: "Skip to main content",
    switchLanguage: "切换到中文",
  },
  footer: {
    account: [
      "About RITUVIA",
      "Sign-in & payments",
      "Privacy & data",
      "Reduce motion",
      "Download my data",
      "Delete data on this device",
    ],
    accountHeading: "Account & support",
    begin: ["Daily Tarot", "Tarot", "Numerology", "Western astrology"],
    beginHeading: "Begin",
    continue: ["Sanctuary", "Journal", "Revisit", "Plus & Credits"],
    continueHeading: "Continue",
    copyright: "© 2026 RITUVIA",
    introduction:
      "Begin with a reading, then keep what matters in your own words, rituals, and life.",
    legal:
      "For adults 18+. For personal reflection and experience; not a substitute for medical, legal, financial, or mental-health support.",
  },
  freePath: {
    action: "See Plus & Credits",
    cards: [
      {
        badge: "Start anytime",
        description:
          "See the cards and their core meanings, name an intention, complete a free ritual, and keep what happened in your journal.",
        title: "A complete free experience",
      },
      {
        badge: "Credits",
        description:
          "Deep Readings use only the context you choose to share. The Credit cost and what you will receive are always shown first.",
        title: "More context when you want it",
      },
      {
        badge: "RITUVIA Plus",
        description:
          "Monthly Credits, longer history, cross-device sync, full Journal and Revisit history, and more Sanctuary settings.",
        title: "Keep the thread over time",
      },
    ],
    eyebrow: "At your own pace",
    introduction:
      "Daily Tarot, core Tarot, intentions, free rituals, journaling, and revisits all stand on their own. Plus, Credits, and collectibles are there only when you want more context, space, or continuity.",
    title: "Start with the experience. Choose more only when it helps.",
  },
  hero: {
    cardLabel: "MAKE ROOM FOR WHAT MATTERS",
    eyebrow: "Make room for the moment",
    introduction:
      "Begin with a daily card, a Tarot reading, or a quiet ritual. Keep what feels useful in your own words, then return later to notice what has changed.",
    meta: [
      "No account needed to begin",
      "Private by default",
      "A free reading every day",
      "Rituals with a clear ending",
    ],
    primaryAction: "See today’s card",
    secondaryAction: "Choose a reading",
    titleAccent: "See what deserves your attention.",
    titleLead: "Pause here.",
  },
  loop: {
    eyebrow: "From insight to life",
    introduction:
      "What lasts is not a single interpretation, but how you choose, act, write, and understand the moment once time has passed.",
    steps: [
      { description: "Name what is present", title: "Ask" },
      { description: "See from another angle", title: "Notice" },
      { description: "Keep what matters", title: "Intend" },
      { description: "Mark the choice", title: "Ritual" },
      { description: "Record action and feeling", title: "Write" },
      { description: "Let time add perspective", title: "Return" },
    ],
    title: "A reading is only the beginning",
  },
  metadata: {
    description:
      "Begin with a symbolic reading, set an intention, complete a private ritual, and return to your own reflection.",
    title: "A private space for reflection",
  },
  navigation: {
    account: "Account",
    brandHomeLabel: "RITUVIA home",
    brandTagline: "A PRIVATE SPACE FOR REFLECTION",
    home: "Home",
    journal: "Journal",
    plus: "Plus & Credits",
    readings: "Readings",
    revisit: "Revisit",
    sanctuary: "Sanctuary",
    signIn: "Sign in",
    switchLabel: "中文",
  },
  state: {
    connection: {
      offlineAnnouncement:
        "Your device appears to be offline. This page remains readable, but links or new content may need a connection.",
      onlineAnnouncement: "Your device appears to be back online.",
    },
    error: {
      message: "Something interrupted this page. Try again, or return to the public foundation.",
      retryAction: "Try again",
      retryingAction: "Trying again",
      returnAction: "Return home",
      title: "We couldn’t open this page.",
    },
    offline: {
      message: "This page remains readable, but links or new content may need a connection.",
      retryAction: "Try again",
      retryingAction: "Trying again",
      returnAction: "Return home",
      title: "Your device appears to be offline.",
    },
  },
  wayIn: {
    eyebrow: "Choose your way in",
    introduction:
      "You do not need a perfect question, and no method has the final word. Begin with the doorway that feels closest today.",
    methods: [
      {
        action: "Begin",
        badge: "Free",
        description:
          "One card for the day, with a question and a practical way to carry it forward.",
        footer: "Carry it into an intention and the sanctuary",
        title: "Daily Tarot",
      },
      {
        action: "Begin",
        badge: "Free",
        description:
          "Use one card to find the focus, or three to see the situation in a fuller way.",
        footer: "Carry it into an intention and the sanctuary",
        title: "Tarot",
      },
      {
        action: "Begin",
        badge: "AI-assisted",
        description:
          "Bring in the context you choose to share for a reading that feels closer to what is happening now.",
        footer: "Carry it into an intention and the sanctuary",
        title: "Deep Readings",
      },
    ],
    title: "What feels right for today?",
  },
} as const satisfies GoldenShellMessages;

const simplifiedChineseMessages = {
  accessibility: {
    closeMenu: "关闭导航",
    disabledAction: "此受保护 Staging 项目暂未开放",
    mobileNavigation: "移动导航",
    openMenu: "打开导航",
    primaryNavigation: "主导航",
    reduceMotion: "减少动态效果",
    skipToContent: "跳到主要内容",
    switchLanguage: "Switch to English",
  },
  footer: {
    account: [
      "关于 RITUVIA",
      "登录与付款方式",
      "隐私与数据",
      "减少动态效果",
      "下载我的数据",
      "删除这台设备上的数据",
    ],
    accountHeading: "账户与支持",
    begin: ["每日塔罗", "塔罗", "数字命理", "西方占星"],
    beginHeading: "开始",
    continue: ["圣所", "日志", "回望", "Plus 与 Credits"],
    continueHeading: "继续",
    copyright: "© 2026 RITUVIA",
    introduction: "从一段解读开始，把真正重要的留在自己的文字、仪式和生活里。",
    legal:
      "面向 18 岁以上成年人，用于自我反思与个人体验；不替代医疗、法律、财务或心理健康专业支持。",
  },
  freePath: {
    action: "查看 Plus 与 Credits",
    cards: [
      {
        badge: "随时开始",
        description: "看见牌面和基础含义，写下意图，完成一段免费仪式，再把真实感受留在日志里。",
        title: "完整的免费体验",
      },
      {
        badge: "Credits",
        description:
          "深度解读会结合你愿意分享的背景；使用前会清楚显示所需 Credits 和你会收到的内容。",
        title: "需要时，多一点语境",
      },
      {
        badge: "RITUVIA Plus",
        description: "每月 Credits、更长历史、跨设备同步、完整日志与回望，以及更多圣所空间。",
        title: "把零散的片刻连起来",
      },
    ],
    eyebrow: "按自己的节奏",
    introduction:
      "每日塔罗、基础塔罗、意图、免费仪式、日志和回望都可以独立完成。Plus、Credits 和收藏只在你想要更多语境、空间或长期保存时出现。",
    title: "先体验，再决定要不要更深入",
  },
  hero: {
    cardLabel: "MAKE ROOM FOR WHAT MATTERS",
    eyebrow: "为此刻留一点空间",
    introduction:
      "从每日一张牌、一组塔罗，或一段安静的仪式开始。留下真正有用的部分，用自己的话写下来；过些时候，再回来看看什么已经改变。",
    meta: ["无需登录即可开始", "私密是默认设置", "每日解读免费", "仪式可以自然结束"],
    primaryAction: "看看今天的牌",
    secondaryAction: "选择一种解读",
    titleAccent: "看清什么值得你认真对待。",
    titleLead: "在这里停一停。",
  },
  loop: {
    eyebrow: "从看见，到生活",
    introduction:
      "真正留下来的，不是某一句解释，而是你如何选择、行动、记录，再在时间过去之后理解自己。",
    steps: [
      { description: "把眼前的事说清楚", title: "提问" },
      { description: "换一个角度理解", title: "看见" },
      { description: "留下真正重要的", title: "意图" },
      { description: "为这次选择做一个标记", title: "仪式" },
      { description: "写下行动与感受", title: "记录" },
      { description: "让时间带来新的理解", title: "回望" },
    ],
    title: "一次解读只是开始",
  },
  metadata: {
    description: "从象征性解读开始，写下意图，完成一段私密仪式，再回望自己的文字。",
    title: "用于自我反思的私密空间",
  },
  navigation: {
    account: "账户",
    brandHomeLabel: "RITUVIA 首页",
    brandTagline: "A PRIVATE SPACE FOR REFLECTION",
    home: "首页",
    journal: "日志",
    plus: "Plus 与 Credits",
    readings: "解读",
    revisit: "回望",
    sanctuary: "圣所",
    signIn: "登录",
    switchLabel: "EN",
  },
  state: {
    connection: {
      offlineAnnouncement: "你的设备似乎已离线。当前页面仍可阅读，但链接或新内容可能需要网络连接。",
      onlineAnnouncement: "你的设备似乎已恢复联网。",
    },
    error: {
      message: "页面被意外中断。你可以重试，或返回首页。",
      retryAction: "重试",
      retryingAction: "正在重试",
      returnAction: "返回首页",
      title: "暂时无法打开这个页面。",
    },
    offline: {
      message: "当前页面仍可阅读，但链接或新内容可能需要网络连接。",
      retryAction: "重试",
      retryingAction: "正在重试",
      returnAction: "返回首页",
      title: "你的设备似乎已离线。",
    },
  },
  wayIn: {
    eyebrow: "选择你的入口",
    introduction: "不必准备一个完整的问题，也没有哪一种方法更权威。选一个此刻愿意靠近的入口就好。",
    methods: [
      {
        action: "开始",
        badge: "免费",
        description: "每天一张牌，陪你看看今天最值得留意的线索。",
        footer: "可以继续写下意图，再进入圣所",
        title: "每日塔罗",
      },
      {
        action: "开始",
        badge: "免费",
        description: "用一张牌看清焦点，或用三张牌把事情展开。",
        footer: "可以继续写下意图，再进入圣所",
        title: "塔罗",
      },
      {
        action: "开始",
        badge: "AI-assisted",
        description: "把你愿意分享的背景带进来，让解读更贴近正在发生的事。",
        footer: "可以继续写成意图，带进圣所",
        title: "深度解读",
      },
    ],
    title: "今天，哪一种方式更贴近你？",
  },
} as const satisfies GoldenShellMessages;

export const parseGoldenShellLocale = (
  value: string | null | undefined,
): GoldenShellLocale | null => goldenShellLocales.find((locale) => locale === value) ?? null;

export const goldenShellHomePath = (locale: GoldenShellLocale): LocalActionHref =>
  createLocalActionHref(`/${locale}`);

export const getGoldenShellMessages = (locale: GoldenShellLocale): GoldenShellMessages => {
  switch (locale) {
    case "en":
      return englishMessages;
    case "zh-Hans":
      return simplifiedChineseMessages;
  }
};
