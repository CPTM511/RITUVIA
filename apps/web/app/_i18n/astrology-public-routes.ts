export const astrologyGuideSlugs = Object.freeze([
  "natal-chart-calculation",
  "birth-time-uncertainty",
  "houses-and-major-aspects",
  "sources-and-methodology",
] as const);

export type AstrologyGuideSlug = (typeof astrologyGuideSlugs)[number];
export type AstrologyPublicRouteId = "astrology-hub" | `astrology-guide:${AstrologyGuideSlug}`;

export const parseAstrologyGuideSlug = (
  value: string | null | undefined,
): AstrologyGuideSlug | null =>
  astrologyGuideSlugs.find((candidate) => candidate === value) ?? null;

export const astrologyHubPathname = "/en/astrology" as const;

export const astrologyGuidePathname = (slug: AstrologyGuideSlug): string =>
  `${astrologyHubPathname}/${slug}`;

export const indexableAstrologyPathnames = Object.freeze([
  astrologyHubPathname,
  ...astrologyGuideSlugs.map(astrologyGuidePathname),
]);

export const astrologyRouteId = (slug: AstrologyGuideSlug): AstrologyPublicRouteId =>
  `astrology-guide:${slug}`;
