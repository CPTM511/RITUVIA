export const ritualReflectionGuideSlugs = Object.freeze([
  "virtual-candle-reflection",
  "virtual-incense-reflection",
  "intention-and-small-action",
  "private-reflection-journal",
  "revisit-a-reflection",
] as const);

export type RitualReflectionGuideSlug = (typeof ritualReflectionGuideSlugs)[number];
export type RitualReflectionPublicRouteId =
  "ritual-reflection-hub" | `ritual-reflection-guide:${RitualReflectionGuideSlug}`;

export const parseRitualReflectionGuideSlug = (
  value: string | null | undefined,
): RitualReflectionGuideSlug | null =>
  ritualReflectionGuideSlugs.find((candidate) => candidate === value) ?? null;

export const ritualReflectionHubPathname = "/en/rituals" as const;

export const ritualReflectionGuidePathname = (slug: RitualReflectionGuideSlug): string =>
  `${ritualReflectionHubPathname}/${slug}`;

export const indexableRitualReflectionPathnames = Object.freeze([
  ritualReflectionHubPathname,
  ...ritualReflectionGuideSlugs.map(ritualReflectionGuidePathname),
]);

export const ritualReflectionRouteId = (
  slug: RitualReflectionGuideSlug,
): RitualReflectionPublicRouteId => `ritual-reflection-guide:${slug}`;
