import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  NumerologyPublicationGuide,
  NumerologyPublicationHub,
} from "../app/_components/numerology-publication";
import { getMessages } from "../app/_i18n/messages";
import { createNumerologyPublicMetadata } from "../app/_i18n/numerology-public-metadata";
import { getNumerologyPublicationGuide } from "../server/numerology-publication";

const shared = {
  brandName: "Configured Brand",
  brandTagline: "Configured tagline",
  canonicalOrigin: "https://example.test",
  locale: "en" as const,
  messages: getMessages("en").shared,
};

describe("public numerology SEO pages", () => {
  it("renders the hub as answer-first static HTML with exact guides, sources, and no private input", () => {
    const html = renderToStaticMarkup(<NumerologyPublicationHub {...shared} />);

    expect(html).toContain("<h1>Numerology, with the method kept visible</h1>");
    expect(html.match(/class="numerology-guide-card"/gu)).toHaveLength(4);
    expect(html).toContain('href="/en/numerology/life-path-number"');
    expect(html).toContain('href="/en/readings/numerology"');
    expect(html).toContain("RITUVIA English symbolic number profiles, version 1.0.0");
    expect(html).toContain('data-geo-entity-id="rituvia-numerology-v1"');
    expect(html).toContain(">Fact or documented method</dt>");
    expect(html).toContain(">Interpretation</dt>");
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).not.toContain('"@type":"BreadcrumbList"');
    expect(html).toContain("https://example.test/en/numerology");
    expect(html).not.toContain("FAQPage");
    expect(html).not.toMatch(/<(?:input|form)\b/iu);
    expect(html).not.toContain("birth-date");
  });

  it("renders each guide with one H1, visible formula/example/limits, sources, and full internal links", () => {
    for (const slug of [
      "life-path-number",
      "birthday-number",
      "personal-year-number",
      "master-numbers",
    ] as const) {
      const html = renderToStaticMarkup(
        <NumerologyPublicationGuide {...shared} guide={getNumerologyPublicationGuide(slug)} />,
      );
      expect(html.match(/<h1>/gu)).toHaveLength(1);
      expect(html).toContain("<article>");
      expect(html).toContain("Calculation rule");
      expect(html).toContain("Worked example");
      expect(html).toContain("What this cannot determine");
      expect(html).toContain("Questions for reflection");
      expect(html).toContain("Source basis");
      expect(html).toContain(">Reviewed</dt><dd>2026-07-25</dd>");
      expect(html).toContain('href="/en/readings/numerology"');
      expect(html).toContain('href="/en/numerology"');
      expect(html.match(/<li><a href="\/en\/numerology\//gu)).toHaveLength(3);
      expect(html).toContain('"@type":"Article"');
      expect(html).not.toContain('"@type":"BreadcrumbList"');
      expect(html).not.toMatch(/<(?:input|form)\b/iu);
    }
  });

  it("binds unique canonical, hreflang, Open Graph, and environment indexing policy", () => {
    const production = createNumerologyPublicMetadata({
      brandName: "Configured Brand",
      canonicalOrigin: "https://example.test",
      deploymentEnvironment: "production",
      description: "Unique guide description.",
      locale: "en",
      routeId: "numerology-guide:life-path-number",
      title: "Life Path guide",
      type: "article",
    });
    expect(production).toMatchObject({
      alternates: {
        canonical: "https://example.test/en/numerology/life-path-number",
        languages: {
          en: "https://example.test/en/numerology/life-path-number",
          "x-default": "https://example.test/en/numerology/life-path-number",
        },
      },
      description: "Unique guide description.",
      robots: { follow: true, index: true },
      title: "Life Path guide — Configured Brand",
    });
    expect(production.openGraph).toMatchObject({
      type: "article",
      url: "https://example.test/en/numerology/life-path-number",
    });

    for (const deploymentEnvironment of ["local", "preview", "staging"] as const) {
      expect(
        createNumerologyPublicMetadata({
          brandName: "Configured Brand",
          canonicalOrigin: "https://example.test",
          deploymentEnvironment,
          description: "Unique guide description.",
          locale: "en",
          routeId: "numerology-guide:life-path-number",
          title: "Life Path guide",
          type: "article",
        }).robots,
      ).toEqual({ follow: false, index: false });
    }
  });
});
