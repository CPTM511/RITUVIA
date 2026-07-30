import {
  astrologyGuideSlugs,
  astrologyRouteId,
  type AstrologyGuideSlug,
  type AstrologyPublicRouteId,
} from "./astrology-public-routes";
import {
  createLocalizedPublicRouteRegistry,
  type LocalizedPublicRouteDefinition,
} from "./localized-public-routes";
import {
  numerologyArticleSlugs,
  numerologyRouteId,
  type NumerologyArticleSlug,
  type NumerologyPublicRouteId,
} from "./numerology-public-routes";
import {
  tarotGuideSlugs,
  tarotRouteId,
  type TarotGuideSlug,
  type TarotPublicRouteId,
} from "./tarot-public-routes";
import {
  ritualReflectionGuideSlugs,
  ritualReflectionRouteId,
  type RitualReflectionGuideSlug,
  type RitualReflectionPublicRouteId,
} from "./ritual-reflection-public-routes";

export const publicPageSlugs = Object.freeze(["methodology", "safety", "privacy"] as const);

export type PublicPageSlug = (typeof publicPageSlugs)[number];
export type PublicPageId = "home" | PublicPageSlug;
export type PublicRouteId =
  | PublicPageId
  | NumerologyPublicRouteId
  | AstrologyPublicRouteId
  | TarotPublicRouteId
  | RitualReflectionPublicRouteId;

export const indexablePublicPageIds = Object.freeze([
  "home",
  ...publicPageSlugs,
] as const satisfies readonly PublicPageId[]);

const publication = (
  approvalReference: "D-025" | "D-065" | "D-073" | "D-081" | "D-082",
  contentVersion: string,
  reviewedDate: string,
) =>
  Object.freeze({
    approvalReference,
    contentVersion,
    reviewedDate,
    reviewerId: "owner",
    status: "approved" as const,
  });

const corePublication = publication("D-025", "rituvia-public-shell.en.v1", "2026-07-17");
const numerologyPublication = publication(
  "D-065",
  "rituvia-numerology-education.en.v1",
  "2026-07-25",
);
const astrologyPublication = publication(
  "D-073",
  "rituvia-western-natal-education.en.v1",
  "2026-07-27",
);
const tarotPublication = publication(
  "D-081",
  "rituvia-tarot-major-arcana-library.en.v1",
  "2026-07-28",
);
const ritualReflectionPublication = publication(
  "D-082",
  "rituvia-ritual-reflection-library.en.v1",
  "2026-07-28",
);

const definitions = Object.freeze([
  ...indexablePublicPageIds.map((id): LocalizedPublicRouteDefinition<PublicRouteId> =>
    Object.freeze({
      contentType: "pages",
      id,
      localizations: Object.freeze({
        en: Object.freeze({
          lastModified: id === "home" ? "2026-07-25" : "2026-07-23",
          publication: corePublication,
          segments: Object.freeze(id === "home" ? [] : [id]),
        }),
      }),
    }),
  ),
  Object.freeze({
    contentType: "numerology",
    id: "numerology-hub",
    localizations: Object.freeze({
      en: Object.freeze({
        lastModified: "2026-07-25",
        publication: numerologyPublication,
        segments: Object.freeze(["numerology"]),
      }),
    }),
  }),
  ...numerologyArticleSlugs.map((slug): LocalizedPublicRouteDefinition<PublicRouteId> =>
    Object.freeze({
      contentType: "numerology",
      id: numerologyRouteId(slug),
      localizations: Object.freeze({
        en: Object.freeze({
          lastModified: "2026-07-25",
          publication: numerologyPublication,
          segments: Object.freeze(["numerology", slug]),
        }),
      }),
    }),
  ),
  Object.freeze({
    contentType: "astrology",
    id: "astrology-hub",
    localizations: Object.freeze({
      en: Object.freeze({
        lastModified: "2026-07-27",
        publication: astrologyPublication,
        segments: Object.freeze(["astrology"]),
      }),
    }),
  }),
  ...astrologyGuideSlugs.map((slug): LocalizedPublicRouteDefinition<PublicRouteId> =>
    Object.freeze({
      contentType: "astrology",
      id: astrologyRouteId(slug),
      localizations: Object.freeze({
        en: Object.freeze({
          lastModified: "2026-07-27",
          publication: astrologyPublication,
          segments: Object.freeze(["astrology", slug]),
        }),
      }),
    }),
  ),
  Object.freeze({
    contentType: "tarot",
    id: "tarot-hub",
    localizations: Object.freeze({
      en: Object.freeze({
        lastModified: "2026-07-28",
        publication: tarotPublication,
        segments: Object.freeze(["tarot"]),
      }),
    }),
  }),
  ...tarotGuideSlugs.map((slug): LocalizedPublicRouteDefinition<PublicRouteId> =>
    Object.freeze({
      contentType: "tarot",
      id: tarotRouteId(slug),
      localizations: Object.freeze({
        en: Object.freeze({
          lastModified: "2026-07-28",
          publication: tarotPublication,
          segments: Object.freeze(["tarot", slug]),
        }),
      }),
    }),
  ),
  Object.freeze({
    contentType: "rituals",
    id: "ritual-reflection-hub",
    localizations: Object.freeze({
      en: Object.freeze({
        lastModified: "2026-07-29",
        publication: ritualReflectionPublication,
        segments: Object.freeze(["rituals"]),
      }),
    }),
  }),
  ...ritualReflectionGuideSlugs.map((slug): LocalizedPublicRouteDefinition<PublicRouteId> =>
    Object.freeze({
      contentType: "rituals",
      id: ritualReflectionRouteId(slug),
      localizations: Object.freeze({
        en: Object.freeze({
          lastModified: "2026-07-29",
          publication: ritualReflectionPublication,
          segments: Object.freeze(["rituals", slug]),
        }),
      }),
    }),
  ),
]);

export const publicRouteRegistry = createLocalizedPublicRouteRegistry<PublicRouteId>(
  "en",
  definitions,
);

export const parsePublicPageSlug = (value: string | null | undefined): PublicPageSlug | null =>
  publicPageSlugs.find((candidate) => candidate === value) ?? null;

export const publicPagePathname = (locale: "en", page: PublicPageId): string => {
  const route = publicRouteRegistry.route(page, locale);
  if (route === null) throw new TypeError("The requested public page is not published.");
  return route.pathname;
};

export const publicRoutePathname = (locale: "en", id: PublicRouteId): string => {
  const route = publicRouteRegistry.route(id, locale);
  if (route === null) throw new TypeError("The requested public route is not published.");
  return route.pathname;
};

export const numerologyPublicPathname = (locale: "en", slug?: NumerologyArticleSlug): string =>
  publicRoutePathname(locale, slug === undefined ? "numerology-hub" : numerologyRouteId(slug));

export const astrologyPublicPathname = (locale: "en", slug?: AstrologyGuideSlug): string =>
  publicRoutePathname(locale, slug === undefined ? "astrology-hub" : astrologyRouteId(slug));

export const tarotPublicPathname = (locale: "en", slug?: TarotGuideSlug): string =>
  publicRoutePathname(locale, slug === undefined ? "tarot-hub" : tarotRouteId(slug));

export const ritualReflectionPublicPathname = (
  locale: "en",
  slug?: RitualReflectionGuideSlug,
): string =>
  publicRoutePathname(
    locale,
    slug === undefined ? "ritual-reflection-hub" : ritualReflectionRouteId(slug),
  );

export const indexablePublicPageRecords = publicRouteRegistry.records;
export const indexablePublicPagePathnames = Object.freeze(
  indexablePublicPageRecords.map(({ pathname }) => pathname),
);

export const isIndexablePublicPagePathname = (pathname: string): boolean =>
  publicRouteRegistry.routeByPathname(pathname) !== null;

export const resolvePublicRouteRedirect = (pathname: string) =>
  publicRouteRegistry.redirectByPathname(pathname);

export const isPublicRouteRedirectPathname = (pathname: string): boolean =>
  resolvePublicRouteRedirect(pathname) !== null;

export const publicSitemapPathnames = Object.freeze(
  publicRouteRegistry.locales.flatMap((locale) =>
    ["pages", "numerology", "astrology", "tarot", "rituals"].map(
      (contentType) => `/sitemaps/${locale}-${contentType}.xml`,
    ),
  ),
);

export const publicDiscoveryPathnames = Object.freeze([
  "/robots.txt",
  "/sitemap.xml",
  ...publicSitemapPathnames,
]);

export const isPublicDiscoveryPathname = (pathname: string): boolean =>
  publicDiscoveryPathnames.some((candidate) => candidate === pathname);

const publicDocumentPathnames = Object.freeze(["/", ...indexablePublicPagePathnames]);

export const isPublicShellPathname = (pathname: string): boolean =>
  publicDocumentPathnames.some((documentPathname) => {
    const representationBase = documentPathname === "/" ? "/index" : documentPathname;
    return (
      pathname === documentPathname ||
      pathname === `${representationBase}.rsc` ||
      pathname.startsWith(`${representationBase}.segments/`)
    );
  });

export const parseNumerologyRouteId = (id: PublicRouteId): NumerologyArticleSlug | "hub" | null => {
  if (id === "numerology-hub") return "hub";
  if (!id.startsWith("numerology-guide:")) return null;
  const slug = id.slice("numerology-guide:".length);
  return numerologyArticleSlugs.find((candidate) => candidate === slug) ?? null;
};

export const parseAstrologyRouteId = (id: PublicRouteId): AstrologyGuideSlug | "hub" | null => {
  if (id === "astrology-hub") return "hub";
  if (!id.startsWith("astrology-guide:")) return null;
  const slug = id.slice("astrology-guide:".length);
  return astrologyGuideSlugs.find((candidate) => candidate === slug) ?? null;
};

export const parseTarotRouteId = (id: PublicRouteId): TarotGuideSlug | "hub" | null => {
  if (id === "tarot-hub") return "hub";
  if (!id.startsWith("tarot-guide:")) return null;
  const slug = id.slice("tarot-guide:".length);
  return tarotGuideSlugs.find((candidate) => candidate === slug) ?? null;
};

export const parseRitualReflectionRouteId = (
  id: PublicRouteId,
): RitualReflectionGuideSlug | "hub" | null => {
  if (id === "ritual-reflection-hub") return "hub";
  if (!id.startsWith("ritual-reflection-guide:")) return null;
  const slug = id.slice("ritual-reflection-guide:".length);
  return ritualReflectionGuideSlugs.find((candidate) => candidate === slug) ?? null;
};
