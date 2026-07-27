const localization = (
  locale: "en" | "zh-Hans",
  title: string,
  description: string,
  exactContents: readonly string[],
) => ({ description, exactContents, locale, title });

const creditPack = (code: string, credits: number, amountMinor: number) => ({
  price: {
    amountMinor,
    billingInterval: "one_time",
    countryCodes: ["US"],
    currencyCode: "USD",
    effectiveFrom: "2026-07-23T00:00:00.000Z",
    effectiveUntil: null,
    priceId: `price.${code}.usd.2026-07-23`,
    productCode: code,
    productVersion: "2026-07-23",
    providerEligibility: ["stripe", "coinbase_usdc_base"],
    refundPolicyVersion: "test:local:refund.v1",
    status: "active",
    taxCategory: "digital_service",
    version: "2026-07-23",
  },
  product: {
    code,
    creditsCost: null,
    creditsGranted: credits,
    creditsPerMonth: null,
    fulfillmentCode: `credits.${code}`,
    kind: "credit_pack",
    localizations: [
      localization(
        "en",
        `${credits} Credits`,
        "A one-time pack of non-transferable RITUVIA service entitlements.",
        [
          `${credits} Credits`,
          "Added once after verified payment",
          "Non-transferable digital service entitlements with no cash value",
        ],
      ),
      localization("zh-Hans", `${credits} Credits`, "一次性获得不可转让的 RITUVIA 服务权益。", [
        `${credits} Credits`,
        "仅在付款验证后一次性发放",
        "不可转让、不可兑现金的数字服务权益",
      ]),
    ],
    status: "active",
    subscriptionInterval: null,
    version: "2026-07-23",
  },
});

const plusPlan = (
  code: "plus_monthly" | "plus_annual",
  interval: "month" | "year",
  amountMinor: number,
) => ({
  price: {
    amountMinor,
    billingInterval: interval,
    countryCodes: ["US"],
    currencyCode: "USD",
    effectiveFrom: "2026-07-23T00:00:00.000Z",
    effectiveUntil: null,
    priceId: `price.${code}.usd.2026-07-23`,
    productCode: code,
    productVersion: "2026-07-23",
    providerEligibility: ["stripe"],
    refundPolicyVersion: "test:local:refund.v1",
    status: "active",
    taxCategory: "digital_subscription",
    version: "2026-07-23",
  },
  product: {
    code,
    creditsCost: null,
    creditsGranted: null,
    creditsPerMonth: 8,
    fulfillmentCode: `subscription.${code}`,
    kind: "plus_plan",
    localizations: [
      localization(
        "en",
        interval === "month" ? "Plus Monthly" : "Plus Annual",
        interval === "month" ? "Renews monthly." : "Renews yearly.",
        [
          "8 Credits allocated each month",
          interval === "month" ? "Monthly recurring subscription" : "Annual recurring subscription",
          interval === "year"
            ? "Credits are allocated monthly, not 96 upfront"
            : "Credits are allocated after each verified monthly renewal",
        ],
      ),
      localization(
        "zh-Hans",
        interval === "month" ? "Plus 按月" : "Plus 按年",
        interval === "month" ? "每月自动续订。" : "每年自动续订。",
        [
          "每月分配 8 Credits",
          interval === "month" ? "按月自动续订" : "按年自动续订",
          interval === "year"
            ? "Credits 按月分配，不会一次性发放 96 Credits"
            : "每次月度续订验证后分配 Credits",
        ],
      ),
    ],
    status: "active",
    subscriptionInterval: interval,
    version: "2026-07-23",
  },
});

const creditProduct = (input: {
  code: string;
  credits: number;
  descriptionEn: string;
  descriptionZh: string;
  exactContentsEn: readonly string[];
  exactContentsZh: readonly string[];
  fulfillmentPrefix: "deep_reading" | "ritual" | "sanctuary";
  kind: "consumable_ritual" | "deep_reading" | "permanent_object";
  titleEn: string;
  titleZh: string;
}) => ({
  code: input.code,
  creditsCost: input.credits,
  creditsGranted: null,
  creditsPerMonth: null,
  fulfillmentCode: `${input.fulfillmentPrefix}.${input.code}`,
  kind: input.kind,
  localizations: [
    localization("en", input.titleEn, input.descriptionEn, input.exactContentsEn),
    localization("zh-Hans", input.titleZh, input.descriptionZh, input.exactContentsZh),
  ],
  status: "active",
  subscriptionInterval: null,
  version: "2026-07-23",
});

const freeObject = (input: {
  code: string;
  descriptionEn: string;
  descriptionZh: string;
  titleEn: string;
  titleZh: string;
}) => ({
  code: input.code,
  creditsCost: null,
  creditsGranted: null,
  creditsPerMonth: null,
  fulfillmentCode: `sanctuary.${input.code}`,
  kind: "free_object",
  localizations: [
    localization("en", input.titleEn, input.descriptionEn, [
      "Free on every use",
      "3–10 minute visual ritual",
      "No audio required",
    ]),
    localization("zh-Hans", input.titleZh, input.descriptionZh, [
      "每次均可免费使用",
      "3–10 分钟视觉仪式",
      "无需音频",
    ]),
  ],
  status: "active",
  subscriptionInterval: null,
  version: "2026-07-23",
});

const packs = [
  creditPack("pack_6", 6, 599),
  creditPack("pack_15", 15, 1_199),
  creditPack("pack_40", 40, 2_499),
];
const plans = [plusPlan("plus_monthly", "month", 999), plusPlan("plus_annual", "year", 6_999)];

export const rituviaCatalog20260723LocalData = Object.freeze({
  approvalMode: "local_test",
  defaultLocale: "en",
  effectiveFrom: "2026-07-23T00:00:00.000Z",
  effectiveUntil: null,
  environment: "local",
  evidence: {
    ownerReference: "test:rit-061:local",
    sourceChecksumSha256: "723e3d723dc237c9eb496ccd2045150859000741915d5a0dd7f7199ee796a708",
    sourceReference: "docs/codex/rituvia-production-2026-07-23/contracts/catalog.json",
  },
  nextReviewAt: "2099-01-01T00:00:00.000Z",
  prices: [...packs.map(({ price }) => price), ...plans.map(({ price }) => price)],
  products: [
    ...packs.map(({ product }) => product),
    ...plans.map(({ product }) => product),
    creditProduct({
      code: "deep_one",
      credits: 1,
      descriptionEn:
        "Bring the context you choose to share together with one card, and see what deserves your attention now.",
      descriptionZh: "把你愿意分享的背景和这张牌放在一起，梳理此刻最值得留意的主题。",
      exactContentsEn: [
        "Input: The context you share, the card, and your chosen theme.",
        "Output: A personal reflection with the main thread, another perspective, and one practical next step.",
      ],
      exactContentsZh: [
        "输入：你写下的背景、牌面与当前主题。",
        "输出：一份个性化解读，包含主要线索、另一种角度和一件可以着手的小事。",
      ],
      fulfillmentPrefix: "deep_reading",
      kind: "deep_reading",
      titleEn: "One-card Deep Reading",
      titleZh: "一张牌深读",
    }),
    creditProduct({
      code: "deep_three",
      credits: 2,
      descriptionEn:
        "Build on the three card meanings already shown and explore how they echo, challenge, or complete one another.",
      descriptionZh: "在每张牌已经展开的基础上，看看它们之间如何呼应、冲突或补充。",
      exactContentsEn: [
        "Input: Your question and the position and orientation of all three cards.",
        "Output: A reading of the overall pattern that keeps each card’s original meaning intact.",
      ],
      exactContentsZh: [
        "输入：你写下的问题，以及三张牌的位置与方向。",
        "输出：一份围绕整体关系的解读，保留每张牌原本的含义。",
      ],
      fulfillmentPrefix: "deep_reading",
      kind: "deep_reading",
      titleEn: "Three-card Synthesis",
      titleZh: "三张牌综合解读",
    }),
    creditProduct({
      code: "relationship",
      credits: 3,
      descriptionEn:
        "Bring the focus back to your feelings, needs, boundaries, and choices—without speaking for the other person.",
      descriptionZh: "把注意力放回你的感受、需要、边界和选择，而不是替另一个人下结论。",
      exactContentsEn: [
        "Input: The relationship context you choose to share and what you most want to understand.",
        "Output: A personal reflection on patterns, needs, boundaries, communication, and what you can do next.",
      ],
      exactContentsZh: [
        "输入：你愿意分享的关系背景，以及此刻最想理清的部分。",
        "输出：一份关于互动模式、需要、边界、沟通和下一步的个人反思。",
      ],
      fulfillmentPrefix: "deep_reading",
      kind: "deep_reading",
      titleEn: "Relationship Reflection",
      titleZh: "关系中的自己",
    }),
    creditProduct({
      code: "theme_30",
      credits: 4,
      descriptionEn:
        "Shape a clear thread for the month ahead, with weekly questions and small actions you can return to.",
      descriptionZh: "为接下来的一个月整理一条清晰主线，配上每周问题和可以持续的小行动。",
      exactContentsEn: [
        "Input: What you are focusing on now, plus an optional recent reading.",
        "Output: A monthly theme, four weekly check-ins, and a light plan for action.",
      ],
      exactContentsZh: [
        "输入：你现在关注的主题，以及可选的最近一次解读。",
        "输出：一个月度主题、四次周度回看和一份轻量行动建议。",
      ],
      fulfillmentPrefix: "deep_reading",
      kind: "deep_reading",
      titleEn: "30-Day Theme",
      titleZh: "未来 30 天",
    }),
    creditProduct({
      code: "year_reflection",
      credits: 6,
      descriptionEn:
        "Use the rhythm of twelve months to hold your priorities, make adjustments, and return to what matters through the year.",
      descriptionZh: "用十二个月的节奏陪你看清重点、做出调整，并在一年里多次回来校准。",
      exactContentsEn: [
        "Input: The areas you want to care for this year and any context you choose to share.",
        "Output: Twelve monthly themes, questions, action prompts, and quarterly returns.",
      ],
      exactContentsZh: [
        "输入：你希望这一年重点照看的领域，以及可选背景。",
        "输出：十二个月度主题、问题、行动提示和季度回望。",
      ],
      fulfillmentPrefix: "deep_reading",
      kind: "deep_reading",
      titleEn: "Your Year in Reflection",
      titleZh: "这一年，慢慢看",
    }),
    creditProduct({
      code: "mindful_incense",
      credits: 3,
      descriptionEn: "Richer smoke, optional ambience, and a keepsake to mark the moment.",
      descriptionZh: "细腻的烟雾、可选环境声，以及一份可以保存的完成纪念。",
      exactContentsEn: [
        "Permanent access after one Credit consumption",
        "3–12 minute visual ritual",
        "Optional ambience",
      ],
      exactContentsZh: ["消费一次 Credits 后永久拥有", "3–12 分钟视觉仪式", "可选环境声"],
      fulfillmentPrefix: "sanctuary",
      kind: "permanent_object",
      titleEn: "Mindful Incense",
      titleZh: "静心香",
    }),
    creditProduct({
      code: "moonlit_lotus",
      credits: 5,
      descriptionEn: "Moonlight on water, with a lotus opening at an unhurried pace.",
      descriptionZh: "月光落在水面，莲花在安静中缓慢舒展。",
      exactContentsEn: [
        "Permanent access after one Credit consumption",
        "4–12 minute visual ritual",
        "Optional ambience",
      ],
      exactContentsZh: ["消费一次 Credits 后永久拥有", "4–12 分钟视觉仪式", "可选环境声"],
      fulfillmentPrefix: "sanctuary",
      kind: "permanent_object",
      titleEn: "Moonlit Lotus",
      titleZh: "月下莲",
    }),
    creditProduct({
      code: "amethyst_guardian",
      credits: 6,
      descriptionEn:
        "Low-stimulation amethyst light for focus, steadiness, and clearer boundaries.",
      descriptionZh: "低刺激的紫晶光影，为专注和边界留一处安稳空间。",
      exactContentsEn: [
        "Permanent access after one Credit consumption",
        "4–15 minute visual ritual",
        "Optional ambience",
      ],
      exactContentsZh: ["消费一次 Credits 后永久拥有", "4–15 分钟视觉仪式", "可选环境声"],
      fulfillmentPrefix: "sanctuary",
      kind: "permanent_object",
      titleEn: "Amethyst Guardian",
      titleZh: "紫晶守望",
    }),
    creditProduct({
      code: "golden_bowl",
      credits: 8,
      descriptionEn: "Place an intention into light and keep a quiet memento of the ritual.",
      descriptionZh: "把一句意图放进光里，留下一份属于这次仪式的纪念。",
      exactContentsEn: [
        "Permanent access after one Credit consumption",
        "4–15 minute visual ritual",
        "Optional ambience",
      ],
      exactContentsZh: ["消费一次 Credits 后永久拥有", "4–15 分钟视觉仪式", "可选环境声"],
      fulfillmentPrefix: "sanctuary",
      kind: "permanent_object",
      titleEn: "Golden Intention Bowl",
      titleZh: "金色意图钵",
    }),
    freeObject({
      code: "free_candle",
      descriptionEn: "Light a candle and give this moment a few unhurried minutes.",
      descriptionZh: "点亮一束烛光，给此刻留出几分钟。",
      titleEn: "Quiet Candle",
      titleZh: "一束烛光",
    }),
    freeObject({
      code: "free_incense",
      descriptionEn: "Let a trail of incense mark a quiet interval for you.",
      descriptionZh: "让一缕香气替你标记这段安静的时间。",
      titleEn: "Quiet Incense",
      titleZh: "一缕清香",
    }),
    creditProduct({
      code: "guided_light",
      credits: 2,
      descriptionEn: "A gentle guided sequence to gather your thoughts and choose one next step.",
      descriptionZh: "一段温和的文字引导，陪你收拢思绪，选定接下来的一小步。",
      exactContentsEn: ["One use", "8 minute guided ritual", "Optional audio"],
      exactContentsZh: ["单次使用", "8 分钟引导仪式", "可选音频"],
      fulfillmentPrefix: "ritual",
      kind: "consumable_ritual",
      titleEn: "Guided Light Ritual",
      titleZh: "引光仪式",
    }),
    creditProduct({
      code: "offering",
      credits: 2,
      descriptionEn:
        "Use flower or incense to mark gratitude, remembrance, or something you are ready to release.",
      descriptionZh: "用花或香标记感谢、纪念，或一段准备放下的心情。",
      exactContentsEn: ["One use", "6 minute guided ritual", "Optional audio"],
      exactContentsZh: ["单次使用", "6 分钟引导仪式", "可选音频"],
      fulfillmentPrefix: "ritual",
      kind: "consumable_ritual",
      titleEn: "Flower or Incense Offering",
      titleZh: "花与香的献礼",
    }),
    creditProduct({
      code: "moon_phase",
      credits: 3,
      descriptionEn:
        "Use the rhythm of the moon to mark a beginning, an adjustment, a completion, or a release.",
      descriptionZh: "借月相的节奏，为开始、调整、完成或放下留下一次清晰的标记。",
      exactContentsEn: ["One use", "10 minute guided ritual", "Optional audio"],
      exactContentsZh: ["单次使用", "10 分钟引导仪式", "可选音频"],
      fulfillmentPrefix: "ritual",
      kind: "consumable_ritual",
      titleEn: "Moon Phase Ritual",
      titleZh: "月相仪式",
    }),
    creditProduct({
      code: "relationship_release",
      credits: 3,
      descriptionEn:
        "Return to your own boundaries and choices, and loosen your hold on what is no longer yours to carry.",
      descriptionZh: "把注意力带回自己的边界与选择，为不再需要承担的部分松一松手。",
      exactContentsEn: ["One use", "10 minute guided ritual", "Optional audio"],
      exactContentsZh: ["单次使用", "10 分钟引导仪式", "可选音频"],
      fulfillmentPrefix: "ritual",
      kind: "consumable_ritual",
      titleEn: "Relationship Release Ritual",
      titleZh: "关系松绑仪式",
    }),
    creditProduct({
      code: "annual_open_close",
      credits: 4,
      descriptionEn:
        "Welcome a new year—or close the one behind you—with a ritual that has a clear beginning and end.",
      descriptionZh: "用一段有始有终的仪式，认真迎接新一年，或安静收好走过的一年。",
      exactContentsEn: ["One use", "14 minute guided ritual", "Optional audio"],
      exactContentsZh: ["单次使用", "14 分钟引导仪式", "可选音频"],
      fulfillmentPrefix: "ritual",
      kind: "consumable_ritual",
      titleEn: "Annual Opening or Closing Ritual",
      titleZh: "年度开启与收束",
    }),
  ],
  schemaVersion: "catalog-version.v1",
  status: "active",
  supersedesVersion: null,
  supportedLocales: ["en", "zh-Hans"],
  version: "local.catalog.2026-07-23.v1",
});
