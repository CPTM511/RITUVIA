import { describe, expect, it } from "vitest";

import { indexablePublicPagePathnames } from "../app/_i18n/public-routes";
import { createRobotsText, createSitemapXml } from "../app/_i18n/seo";

const input = {
  canonicalOrigin: "https://example.test",
  deploymentEnvironment: "production" as const,
  publicShellState: "enabled" as const,
};

describe("finite public crawl policy", () => {
  it("publishes exact end-anchored production allows and one canonical sitemap", () => {
    const robots = createRobotsText(input);

    expect(robots).toBe(
      [
        "User-agent: *",
        "Allow: /en$",
        "Allow: /en/methodology$",
        "Allow: /en/safety$",
        "Allow: /en/privacy$",
        "Allow: /_next/static/",
        "Allow: /icon.svg$",
        "Allow: /sitemap.xml$",
        "Disallow: /",
        "Sitemap: https://example.test/sitemap.xml",
        "",
      ].join("\n"),
    );
    expect(robots).not.toContain("account");
    expect(robots).not.toContain("journal");
    expect(robots).not.toContain("checkout");
    expect(robots).not.toContain("/_next/image");
  });

  it.each([
    ["local", "enabled"],
    ["preview", "enabled"],
    ["staging", "enabled"],
    ["production", "disabled"],
    ["production", "unavailable"],
  ] as const)("disallows all for %s with shell %s", (deploymentEnvironment, publicShellState) => {
    const policy = { ...input, deploymentEnvironment, publicShellState };

    expect(createRobotsText(policy)).toBe("User-agent: *\nDisallow: /\n");
    expect(createSitemapXml(policy)).toBeNull();
  });

  it("emits one deterministic production XML URL set from the exact inventory", () => {
    const sitemap = createSitemapXml(input);

    expect(sitemap).not.toBeNull();
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const locations = [...(sitemap ?? "").matchAll(/<loc>([^<]+)<\/loc>/gu)].map(
      ([, location]) => location,
    );
    expect(locations).toEqual(
      indexablePublicPagePathnames.map((pathname) => `https://example.test${pathname}`),
    );
    expect(new Set(locations)).toHaveLength(4);
    expect(sitemap).not.toContain("<lastmod>");
    expect(locations.join("\n")).not.toMatch(
      /(?:\.rsc|\.segments|\?|#|\/account|\/journal|\/checkout)/u,
    );
  });

  it("escapes canonical URL text without trusting request host input", () => {
    const sitemap = createSitemapXml({
      ...input,
      canonicalOrigin: "https://example.test",
    });

    expect(sitemap).toContain("https://example.test/en");
    expect(sitemap).not.toContain("localhost");
    expect(sitemap).not.toContain("request-host");
  });
});
