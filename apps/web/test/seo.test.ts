import { describe, expect, it } from "vitest";

import {
  indexablePublicPagePathnames,
  indexablePublicPageRecords,
  publicSitemapPathnames,
} from "../app/_i18n/public-routes";
import { createRobotsText, createSitemapXml } from "../app/_i18n/seo";

const input = {
  canonicalOrigin: "https://example.test",
  deploymentEnvironment: "production" as const,
};

describe("finite public crawl policy", () => {
  it("publishes exact end-anchored production allows and one canonical sitemap index", () => {
    const robots = createRobotsText(input);

    for (const pathname of indexablePublicPagePathnames) {
      expect(robots).toContain(`Allow: ${pathname}$`);
    }
    for (const pathname of ["/sitemap.xml", ...publicSitemapPathnames]) {
      expect(robots).toContain(`Allow: ${pathname}$`);
    }
    expect(robots).toContain("Allow: /_next/static/");
    expect(robots).toContain("Allow: /icon.svg$");
    expect(robots).toContain("Disallow: /");
    expect(robots).toContain("Sitemap: https://example.test/sitemap.xml");
    expect(robots).not.toContain("account");
    expect(robots).not.toContain("Allow: /en/journal$");
    expect(robots).not.toContain("checkout");
    expect(robots).not.toContain("/en/readings/numerology");
    expect(robots).not.toContain("/en/readings/astrology");
    expect(robots).not.toContain("/en/numerology/number-");
    expect(robots).not.toContain("/en/astrology/aries");
    expect(robots).not.toContain("/_next/image");
  });

  it.each(["local", "preview", "staging"] as const)(
    "disallows all outside production in %s",
    (deploymentEnvironment) => {
      const policy = { ...input, deploymentEnvironment };

      expect(createRobotsText(policy)).toBe("User-agent: *\nDisallow: /\n");
      expect(createSitemapXml(policy)).toBeNull();
      for (const pathname of publicSitemapPathnames) {
        expect(createSitemapXml(policy, pathname)).toBeNull();
      }
    },
  );

  it("emits a deterministic locale and content-type sitemap index", () => {
    const sitemap = createSitemapXml(input);

    expect(sitemap).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const locations = [...(sitemap ?? "").matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
      (match) => match[1] as string,
    );
    expect(locations).toEqual(
      publicSitemapPathnames.map((pathname) => `https://example.test${pathname}`),
    );
    expect(sitemap).not.toContain("<url>");
    expect(sitemap?.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/gu)).toHaveLength(
      publicSitemapPathnames.length,
    );
  });

  it("emits exact non-overlapping URL sets with reciprocal hreflang", () => {
    const observedLocations: string[] = [];
    for (const pathname of publicSitemapPathnames) {
      const sitemap = createSitemapXml(input, pathname);
      expect(sitemap).toContain(
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      );
      const locations = [...(sitemap ?? "").matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
        (match) => match[1] as string,
      );
      expect(locations.length).toBeGreaterThan(0);
      observedLocations.push(...locations);
      for (const location of locations) {
        expect(sitemap).toContain(`<xhtml:link rel="alternate" hreflang="en" href="${location}"/>`);
        expect(sitemap).toContain(
          `<xhtml:link rel="alternate" hreflang="x-default" href="${location}"/>`,
        );
      }
      expect(locations.join("\n")).not.toMatch(
        /(?:\.rsc|\.segments|\?|#|\/account|\/journal|\/checkout|\/readings\/)/u,
      );
    }
    expect(observedLocations).toEqual(
      indexablePublicPagePathnames.map((pathname) => `https://example.test${pathname}`),
    );
    expect(new Set(observedLocations)).toHaveLength(indexablePublicPageRecords.length);
  });

  it("rejects unknown sitemap documents and never trusts request-host input", () => {
    expect(createSitemapXml(input, "/sitemaps/en-private.xml")).toBeNull();
    const sitemap = createSitemapXml(input, "/sitemaps/en-pages.xml");
    expect(sitemap).toContain("https://example.test/en");
    expect(sitemap).not.toContain("localhost");
    expect(sitemap).not.toContain("request-host");
  });
});
