export const publicPageSlugs = Object.freeze(["methodology", "safety", "privacy"] as const);

export type PublicPageSlug = (typeof publicPageSlugs)[number];
export type PublicPageId = "home" | PublicPageSlug;

export const indexablePublicPageIds = Object.freeze([
  "home",
  ...publicPageSlugs,
] as const satisfies readonly PublicPageId[]);

export const parsePublicPageSlug = (value: string | null | undefined): PublicPageSlug | null =>
  publicPageSlugs.find((candidate) => candidate === value) ?? null;

export const publicPagePathname = (locale: "en", page: PublicPageId): string =>
  page === "home" ? `/${locale}` : `/${locale}/${page}`;

export const indexablePublicPagePathnames = Object.freeze(
  indexablePublicPageIds.map((page) => publicPagePathname("en", page)),
);

export const isIndexablePublicPagePathname = (pathname: string): boolean =>
  indexablePublicPagePathnames.some((candidate) => candidate === pathname);

export const publicDiscoveryPathnames = Object.freeze(["/robots.txt", "/sitemap.xml"] as const);

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
