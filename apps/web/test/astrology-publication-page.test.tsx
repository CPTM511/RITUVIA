import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AstrologyPublicationGuide,
  AstrologyPublicationHub,
} from "../app/_components/astrology-publication";
import { createAstrologyPublicMetadata } from "../app/_i18n/astrology-public-metadata";
import { getMessages } from "../app/_i18n/messages";
import { getAstrologyPublicationGuide } from "../server/astrology-publication";

const shared = {
  brandName: "Configured Brand",
  brandTagline: "Configured tagline",
  canonicalOrigin: "https://example.test",
  locale: "en" as const,
  messages: getMessages("en").shared,
};

describe("approved astrology education pages", () => {
  it("renders an answer-first hub with four exact guides and no private input", () => {
    const html = renderToStaticMarkup(<AstrologyPublicationHub {...shared} />);

    expect(html).toContain("<h1>Western astrology, with the calculation kept visible</h1>");
    expect(html.match(/class="numerology-guide-card astrology-guide-card"/gu)).toHaveLength(4);
    expect(html).toContain('href="/en/astrology/natal-chart-calculation"');
    expect(html).toContain('href="/en/readings/astrology"');
    expect(html).toContain('data-geo-entity-id="rituvia-western-natal-astrology-v1"');
    expect(html).toContain(">Fact or documented method</dt>");
    expect(html).toContain(">Tradition</dt>");
    expect(html).toContain(">Interpretation</dt>");
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).not.toContain('"@type":"BreadcrumbList"');
    expect(html).toContain("https://example.test/en/astrology");
    expect(html).not.toContain("FAQPage");
    expect(html).not.toMatch(/<(?:input|form)\b/iu);
    expect(html).not.toMatch(/birthDate|birthTime|latitudeE6|longitudeE6/u);
  });

  it("renders each guide with semantic tables, limits, sources, and complete internal links", () => {
    for (const slug of [
      "natal-chart-calculation",
      "birth-time-uncertainty",
      "houses-and-major-aspects",
      "sources-and-methodology",
    ] as const) {
      const html = renderToStaticMarkup(
        <AstrologyPublicationGuide {...shared} guide={getAstrologyPublicationGuide(slug)} />,
      );
      expect(html.match(/<h1>/gu)).toHaveLength(1);
      expect(html).toContain("<article>");
      expect(html).toContain("<table");
      expect(html).toContain("<caption>");
      expect(html).toContain('scope="col"');
      expect(html).toContain('scope="row"');
      expect(html).toContain("What this cannot determine");
      expect(html).toContain("Source basis");
      expect(html).toContain("Owner-approved editorial record");
      expect(html).toContain('href="/en/readings/astrology"');
      expect(html).toContain('href="/en/astrology"');
      expect(html.match(/<li><a href="\/en\/astrology\//gu)).toHaveLength(3);
      expect(html).toContain('"@type":"Article"');
      expect(html).not.toContain('"@type":"BreadcrumbList"');
      expect(html).not.toMatch(/<(?:input|form)\b/iu);
    }
  });

  it("indexes approved metadata only in production", () => {
    const metadata = createAstrologyPublicMetadata({
      brandName: "Configured Brand",
      canonicalOrigin: "https://example.test",
      deploymentEnvironment: "production",
      description: "Unique astrology guide description.",
      locale: "en",
      publicationApproved: true,
      routeId: "astrology-guide:natal-chart-calculation",
      title: "Natal chart calculation",
      type: "article",
    });
    expect(metadata).toMatchObject({
      alternates: {
        canonical: "https://example.test/en/astrology/natal-chart-calculation",
        languages: {
          en: "https://example.test/en/astrology/natal-chart-calculation",
          "x-default": "https://example.test/en/astrology/natal-chart-calculation",
        },
      },
      robots: { follow: true, index: true },
      title: "Natal chart calculation — Configured Brand",
    });

    for (const deploymentEnvironment of ["local", "preview", "staging"] as const) {
      expect(
        createAstrologyPublicMetadata({
          brandName: "Configured Brand",
          canonicalOrigin: "https://example.test",
          deploymentEnvironment,
          description: "Unique astrology guide description.",
          locale: "en",
          publicationApproved: true,
          routeId: "astrology-guide:natal-chart-calculation",
          title: "Natal chart calculation",
          type: "article",
        }).robots,
      ).toEqual({ follow: false, index: false });
    }
  });
});
