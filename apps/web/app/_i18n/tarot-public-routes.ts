export const tarotCardSlugs = Object.freeze([
  "the-fool",
  "the-magician",
  "the-high-priestess",
  "the-empress",
  "the-emperor",
  "the-hierophant",
  "the-lovers",
  "the-chariot",
  "strength",
  "the-hermit",
  "wheel-of-fortune",
  "justice",
  "the-hanged-man",
  "death",
  "temperance",
  "the-devil",
  "the-tower",
  "the-star",
  "the-moon",
  "the-sun",
  "judgement",
  "the-world",
] as const);

export const tarotSpreadSlugs = Object.freeze([
  "one-card-spread",
  "situation-action-possibility-spread",
] as const);

export const tarotGuideSlugs = Object.freeze([...tarotCardSlugs, ...tarotSpreadSlugs] as const);

export type TarotCardSlug = (typeof tarotCardSlugs)[number];
export type TarotSpreadSlug = (typeof tarotSpreadSlugs)[number];
export type TarotGuideSlug = (typeof tarotGuideSlugs)[number];
export type TarotPublicRouteId = "tarot-hub" | `tarot-guide:${TarotGuideSlug}`;

export const parseTarotGuideSlug = (value: string | null | undefined): TarotGuideSlug | null =>
  tarotGuideSlugs.find((candidate) => candidate === value) ?? null;

export const tarotHubPathname = "/en/tarot" as const;

export const tarotGuidePathname = (slug: TarotGuideSlug): string => `${tarotHubPathname}/${slug}`;

export const indexableTarotPathnames = Object.freeze([
  tarotHubPathname,
  ...tarotGuideSlugs.map(tarotGuidePathname),
]);

export const tarotRouteId = (slug: TarotGuideSlug): TarotPublicRouteId => `tarot-guide:${slug}`;
