export const numerologyGuideSlugs = Object.freeze([
  "life-path-number",
  "birthday-number",
  "personal-year-number",
  "master-numbers",
] as const);

export const numerologyProfileValues = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33,
] as const);

export const numerologyProfileSlugs = Object.freeze(
  numerologyProfileValues.map((value) => `number-${value}` as const),
);

export const numerologyArticleSlugs = numerologyGuideSlugs;

export type NumerologyGuideSlug = (typeof numerologyGuideSlugs)[number];
export type NumerologyProfileValue = (typeof numerologyProfileValues)[number];
export type NumerologyProfileSlug = (typeof numerologyProfileSlugs)[number];
export type NumerologyArticleSlug = NumerologyGuideSlug;

export const parseNumerologyArticleSlug = (
  value: string | null | undefined,
): NumerologyArticleSlug | null =>
  numerologyArticleSlugs.find((candidate) => candidate === value) ?? null;

export const numerologyHubPathname = "/en/numerology" as const;

export const numerologyArticlePathname = (slug: NumerologyArticleSlug): string =>
  `${numerologyHubPathname}/${slug}`;

export const indexableNumerologyPathnames = Object.freeze([
  numerologyHubPathname,
  ...numerologyArticleSlugs.map(numerologyArticlePathname),
]);
