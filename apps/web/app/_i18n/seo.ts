import { indexablePublicPagePathnames, indexablePublicPageRecords } from "./public-routes";

export type DeploymentEnvironment = "local" | "preview" | "production" | "staging";
export type PublicShellState = "disabled" | "enabled" | "unavailable";

type CrawlPolicyInput = Readonly<{
  canonicalOrigin: string;
  deploymentEnvironment: DeploymentEnvironment;
  publicShellState: PublicShellState;
}>;

const canPublishIndexInventory = ({
  deploymentEnvironment,
  publicShellState,
}: CrawlPolicyInput): boolean =>
  deploymentEnvironment === "production" && publicShellState === "enabled";

const canonicalUrl = (canonicalOrigin: string, pathname: string): string =>
  new URL(pathname, canonicalOrigin).toString();

const escapeXmlText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const createRobotsText = (input: CrawlPolicyInput): string => {
  if (!canPublishIndexInventory(input)) {
    return "User-agent: *\nDisallow: /\n";
  }

  const exactAllows = [
    ...indexablePublicPagePathnames.map((pathname) => `Allow: ${pathname}$`),
    "Allow: /_next/static/",
    "Allow: /icon.svg$",
    "Allow: /sitemap.xml$",
  ];
  const sitemap = canonicalUrl(input.canonicalOrigin, "/sitemap.xml");

  return ["User-agent: *", ...exactAllows, "Disallow: /", `Sitemap: ${sitemap}`, ""].join("\n");
};

export const createSitemapXml = (input: CrawlPolicyInput): string | null => {
  if (!canPublishIndexInventory(input)) {
    return null;
  }

  const entries = indexablePublicPageRecords
    .map(
      ({ lastModified, pathname }) =>
        `  <url><loc>${escapeXmlText(canonicalUrl(input.canonicalOrigin, pathname))}</loc><lastmod>${lastModified}</lastmod></url>`,
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    "",
  ].join("\n");
};
