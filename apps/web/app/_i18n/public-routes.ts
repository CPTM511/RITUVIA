export const publicPageSlugs = Object.freeze(["methodology", "safety", "privacy"] as const);

export type PublicPageSlug = (typeof publicPageSlugs)[number];
export type PublicPageId = "home" | PublicPageSlug;

export const parsePublicPageSlug = (value: string | null | undefined): PublicPageSlug | null =>
  publicPageSlugs.find((candidate) => candidate === value) ?? null;

export const publicPagePathname = (locale: "en", page: PublicPageId): string =>
  page === "home" ? `/${locale}` : `/${locale}/${page}`;

const publicDocumentPathnames = Object.freeze([
  "/",
  ...(["home", ...publicPageSlugs] as const).map((page) => publicPagePathname("en", page)),
]);

export const isPublicShellPathname = (pathname: string): boolean =>
  publicDocumentPathnames.some((documentPathname) => {
    const representationBase = documentPathname === "/" ? "/index" : documentPathname;
    return (
      pathname === documentPathname ||
      pathname === `${representationBase}.rsc` ||
      pathname.startsWith(`${representationBase}.segments/`)
    );
  });
