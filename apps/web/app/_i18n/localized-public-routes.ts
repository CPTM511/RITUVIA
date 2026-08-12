import { canonicalizeLocale } from "@rituvia/i18n/locale";

export const publicContentTypes = Object.freeze([
  "pages",
  "numerology",
  "astrology",
  "tarot",
  "rituals",
] as const);
export type PublicContentType = (typeof publicContentTypes)[number];

export type LocalizedPublicRouteDefinition<RouteId extends string = string> = Readonly<{
  contentType: PublicContentType;
  id: RouteId;
  localizations: Readonly<
    Record<
      string,
      Readonly<{
        lastModified: string;
        publication: Readonly<{
          approvalReference: string;
          contentVersion: string;
          reviewedDate: string;
          reviewerId: string;
          status: "approved";
        }>;
        segments: readonly string[];
      }>
    >
  >;
}>;

export type LocalizedPublicRedirectDefinition<RouteId extends string = string> = Readonly<{
  fromSegments: readonly string[];
  locale: string;
  targetId: RouteId;
}>;

export type LocalizedPublicRouteRecord<RouteId extends string = string> = Readonly<{
  contentType: PublicContentType;
  id: RouteId;
  lastModified: string;
  locale: string;
  pathname: string;
  publication: Readonly<{
    approvalReference: string;
    contentVersion: string;
    reviewedDate: string;
    reviewerId: string;
    status: "approved";
  }>;
  segments: readonly string[];
}>;

export type LocalizedPublicRedirectRecord<RouteId extends string = string> = Readonly<{
  fromPathname: string;
  locale: string;
  targetId: RouteId;
  targetPathname: string;
}>;

export type LocalizedPublicRouteRegistry<RouteId extends string = string> = Readonly<{
  defaultLocale: string;
  locales: readonly string[];
  records: readonly LocalizedPublicRouteRecord<RouteId>[];
  redirects: readonly LocalizedPublicRedirectRecord<RouteId>[];
  route: (id: RouteId, locale: string) => LocalizedPublicRouteRecord<RouteId> | null;
  routeByPathname: (pathname: string) => LocalizedPublicRouteRecord<RouteId> | null;
  redirectByPathname: (pathname: string) => LocalizedPublicRedirectRecord<RouteId> | null;
  alternates: (id: RouteId) => Readonly<Record<string, LocalizedPublicRouteRecord<RouteId>>>;
}>;

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const segmentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const assertExactLocale = (value: string): string => {
  const locale = canonicalizeLocale(value);
  if (locale !== value) throw new TypeError("Published locales must use canonical BCP 47 tags.");
  return locale;
};

const assertSegments = (segments: readonly string[]): readonly string[] => {
  if (
    !Array.isArray(segments) ||
    segments.length > 8 ||
    segments.some((segment) => !segmentPattern.test(segment))
  ) {
    throw new TypeError("Localized public route segments must be finite canonical slugs.");
  }
  return Object.freeze([...segments]);
};

const pathnameFor = (locale: string, segments: readonly string[]): string =>
  `/${[locale, ...segments].join("/")}`;

export const createLocalizedPublicRouteRegistry = <RouteId extends string>(
  defaultLocaleInput: string,
  definitions: readonly LocalizedPublicRouteDefinition<RouteId>[],
  redirectDefinitions: readonly LocalizedPublicRedirectDefinition<RouteId>[] = [],
): LocalizedPublicRouteRegistry<RouteId> => {
  const defaultLocale = assertExactLocale(defaultLocaleInput);
  if (definitions.length < 1) throw new TypeError("The public route registry cannot be empty.");

  const definitionIds = new Set<RouteId>();
  const records: LocalizedPublicRouteRecord<RouteId>[] = [];
  const recordKeys = new Set<string>();
  const pathnameKeys = new Set<string>();

  for (const definition of definitions) {
    if (
      definitionIds.has(definition.id) ||
      !publicContentTypes.some((candidate) => candidate === definition.contentType)
    ) {
      throw new TypeError("The public route registry contains a duplicate or invalid definition.");
    }
    definitionIds.add(definition.id);
    const localizations = Object.entries(definition.localizations);
    if (localizations.length < 1) {
      throw new TypeError("Every public route requires at least one reviewed localization.");
    }
    for (const [localeInput, localization] of localizations) {
      const locale = assertExactLocale(localeInput);
      const segments = assertSegments(localization.segments);
      const publication = localization.publication;
      if (
        !datePattern.test(localization.lastModified) ||
        Number.isNaN(Date.parse(`${localization.lastModified}T00:00:00.000Z`)) ||
        publication.status !== "approved" ||
        !/^[A-Z]+-[0-9]+$/u.test(publication.approvalReference) ||
        publication.contentVersion.length < 1 ||
        publication.contentVersion.length > 120 ||
        !datePattern.test(publication.reviewedDate) ||
        Number.isNaN(Date.parse(`${publication.reviewedDate}T00:00:00.000Z`)) ||
        publication.reviewerId.length < 1 ||
        publication.reviewerId.length > 120
      ) {
        throw new TypeError("Public routes require valid revision and approval evidence.");
      }
      const pathname = pathnameFor(locale, segments);
      const recordKey = `${definition.id}\u0000${locale}`;
      if (recordKeys.has(recordKey) || pathnameKeys.has(pathname)) {
        throw new TypeError("The public route registry contains a duplicate route.");
      }
      recordKeys.add(recordKey);
      pathnameKeys.add(pathname);
      records.push(
        Object.freeze({
          contentType: definition.contentType,
          id: definition.id,
          lastModified: localization.lastModified,
          locale,
          pathname,
          publication: Object.freeze({ ...publication }),
          segments,
        }),
      );
    }
  }

  const defaultRoutes = records.filter((record) => record.locale === defaultLocale);
  if (defaultRoutes.length !== definitions.length) {
    throw new TypeError("Every public route requires a reviewed default-locale localization.");
  }

  const redirects: LocalizedPublicRedirectRecord<RouteId>[] = [];
  const redirectPathnames = new Set<string>();
  for (const definition of redirectDefinitions) {
    const locale = assertExactLocale(definition.locale);
    const fromPathname = pathnameFor(locale, assertSegments(definition.fromSegments));
    const target = records.find(
      (record) => record.id === definition.targetId && record.locale === locale,
    );
    if (
      target === undefined ||
      pathnameKeys.has(fromPathname) ||
      redirectPathnames.has(fromPathname) ||
      fromPathname === target.pathname
    ) {
      throw new TypeError("The public redirect registry contains an invalid redirect.");
    }
    redirectPathnames.add(fromPathname);
    redirects.push(
      Object.freeze({
        fromPathname,
        locale,
        targetId: definition.targetId,
        targetPathname: target.pathname,
      }),
    );
  }

  const locales = Object.freeze(
    [...new Set(records.map((record) => record.locale))].sort((left, right) =>
      left.localeCompare(right),
    ),
  );
  const frozenRecords = Object.freeze(records);
  const frozenRedirects = Object.freeze(redirects);

  return Object.freeze({
    alternates: (id) =>
      Object.freeze(
        Object.fromEntries(
          frozenRecords
            .filter((record) => record.id === id)
            .map((record) => [record.locale, record]),
        ),
      ),
    defaultLocale,
    locales,
    records: frozenRecords,
    redirectByPathname: (pathname) =>
      frozenRedirects.find((redirect) => redirect.fromPathname === pathname) ?? null,
    redirects: frozenRedirects,
    route: (id, locale) =>
      frozenRecords.find((record) => record.id === id && record.locale === locale) ?? null,
    routeByPathname: (pathname) =>
      frozenRecords.find((record) => record.pathname === pathname) ?? null,
  });
};
