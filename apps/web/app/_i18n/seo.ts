import {
  indexablePublicPagePathnames,
  publicRouteRegistry,
  publicSitemapPathnames,
} from "./public-routes";
import { isPublicPageInventoryCurrent } from "./public-page-inventory";

export type DeploymentEnvironment = "local" | "preview" | "production" | "staging";

type CrawlPolicyInput = Readonly<{
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
}>;

const canPublishIndexInventory = ({ deploymentEnvironment }: CrawlPolicyInput): boolean =>
  deploymentEnvironment === "production" && isPublicPageInventoryCurrent();

const canonicalUrl = (canonicalOrigin: string, pathname: string): string =>
  new URL(pathname, canonicalOrigin).toString();

const escapeXmlText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const sitemapRecords = publicSitemapPathnames.map((pathname) => {
  const match =
    /^\/sitemaps\/([A-Za-z0-9-]+)-(pages|numerology|astrology|tarot|rituals)\.xml$/u.exec(pathname);
  if (match === null) throw new TypeError("The public sitemap inventory is invalid.");
  const [, locale, contentType] = match;
  const records = publicRouteRegistry.records.filter(
    (record) => record.locale === locale && record.contentType === contentType,
  );
  if (records.length < 1) throw new TypeError("Every public sitemap requires reviewed routes.");
  return Object.freeze({
    contentType,
    lastModified: records
      .map((record) => record.lastModified)
      .sort()
      .at(-1) as string,
    locale,
    pathname,
    records: Object.freeze(records),
  });
});

export const createRobotsText = (input: CrawlPolicyInput): string => {
  if (!canPublishIndexInventory(input)) {
    return "User-agent: *\nDisallow: /\n";
  }

  const exactAllows = [
    ...indexablePublicPagePathnames.map((pathname) => `Allow: ${pathname}$`),
    "Allow: /_next/static/",
    "Allow: /icon.svg$",
    "Allow: /sitemap.xml$",
    ...publicSitemapPathnames.map((pathname) => `Allow: ${pathname}$`),
  ];
  const sitemap = canonicalUrl(input.canonicalOrigin, "/sitemap.xml");

  return ["User-agent: *", ...exactAllows, "Disallow: /", `Sitemap: ${sitemap}`, ""].join("\n");
};

export const createSitemapXml = (
  input: CrawlPolicyInput,
  pathname = "/sitemap.xml",
): string | null => {
  if (!canPublishIndexInventory(input)) {
    return null;
  }

  if (pathname === "/sitemap.xml") {
    const entries = sitemapRecords
      .map(
        (sitemap) =>
          `  <sitemap><loc>${escapeXmlText(canonicalUrl(input.canonicalOrigin, sitemap.pathname))}</loc><lastmod>${sitemap.lastModified}</lastmod></sitemap>`,
      )
      .join("\n");
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      entries,
      "</sitemapindex>",
      "",
    ].join("\n");
  }

  const sitemap = sitemapRecords.find((candidate) => candidate.pathname === pathname);
  if (sitemap === undefined) return null;
  const entries = sitemap.records
    .map((record) => {
      const alternateRecords = publicRouteRegistry.alternates(record.id);
      const defaultRoute = Object.values(alternateRecords).find(
        (alternate) => alternate.locale === publicRouteRegistry.defaultLocale,
      );
      if (defaultRoute === undefined) {
        throw new TypeError("Sitemap routes require a reviewed default-locale alternate.");
      }
      const alternateLinks = [
        ...Object.entries(alternateRecords).map(
          ([locale, alternate]) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXmlText(locale)}" href="${escapeXmlText(canonicalUrl(input.canonicalOrigin, alternate.pathname))}"/>`,
        ),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXmlText(canonicalUrl(input.canonicalOrigin, defaultRoute.pathname))}"/>`,
      ].join("");
      return `  <url><loc>${escapeXmlText(canonicalUrl(input.canonicalOrigin, record.pathname))}</loc><lastmod>${record.lastModified}</lastmod>${alternateLinks}</url>`;
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries,
    "</urlset>",
    "",
  ].join("\n");
};
