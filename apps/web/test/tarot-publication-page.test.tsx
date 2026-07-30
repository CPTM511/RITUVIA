import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TarotPublicationCard,
  TarotPublicationHub,
  TarotPublicationSpread,
} from "../app/_components/tarot-publication";
import { createTarotPublicMetadata } from "../app/_i18n/tarot-public-metadata";
import { getMessages } from "../app/_i18n/messages";
import { getTarotLibraryGuide, tarotLibraryPublication } from "../server/tarot-publication";

const shared = {
  brandName: "Configured Brand",
  brandTagline: "Configured tagline",
  canonicalOrigin: "https://example.test",
  locale: "en" as const,
  messages: getMessages("en").shared,
};

describe("Approved Tarot library pages", () => {
  it("renders an answer-first hub with 22 cards, two spreads, sources, and no private input", () => {
    const html = renderToStaticMarkup(<TarotPublicationHub {...shared} />);

    expect(html).toContain("<h1>The Major Arcana as reflection, not prediction</h1>");
    expect(html.match(/class="tarot-library-card"/gu)).toHaveLength(24);
    expect(html).toContain('href="/en/tarot/the-fool"');
    expect(html).toContain('href="/en/tarot/situation-action-possibility-spread"');
    expect(html).toContain('href="/en/tarot/one-card"');
    expect(html).toContain("2026-07-28");
    expect(html).toContain("2027-07-28");
    expect(html).toContain('data-geo-entity-id="rituvia-major-arcana-reflection-v1"');
    expect(html).toContain(">Tradition</dt>");
    expect(html).toContain(">Interpretation</dt>");
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).not.toContain('"@type":"BreadcrumbList"');
    expect(html).not.toMatch(/<(?:input|form|textarea)\b/iu);
    expect(html).not.toMatch(/questionText|journal|birthTime/u);
  });

  it("renders every card with upright/reversed utility, limits, sources, and bounded links", () => {
    for (const guide of tarotLibraryPublication.cards) {
      const html = renderToStaticMarkup(<TarotPublicationCard {...shared} guide={guide} />);
      expect(html.match(/<h1>/gu)).toHaveLength(1);
      expect(html).toContain("<article>");
      expect(html).toContain("<h2>Upright reflection</h2>");
      expect(html).toContain("<h2>Reversed reflection</h2>");
      expect(html).toContain("What this cannot determine");
      expect(html).toContain("Source basis");
      expect(html).toContain("Owner-approved editorial record");
      expect(html).toContain('href="/en/tarot/one-card"');
      expect(html).toContain('href="/en/tarot"');
      expect(html.match(/<li><a href="\/en\/tarot\//gu) ?? []).toHaveLength(4);
      expect(html).toContain('"@type":"Article"');
      expect(html).not.toMatch(/<(?:input|form|textarea)\b/iu);
    }
  });

  it("renders both spread guides with ordered positions, steps, questions, and limits", () => {
    for (const slug of ["one-card-spread", "situation-action-possibility-spread"] as const) {
      const guide = getTarotLibraryGuide(slug);
      if (guide.kind !== "spread") throw new TypeError("Expected a spread guide.");
      const html = renderToStaticMarkup(<TarotPublicationSpread {...shared} guide={guide} />);
      expect(html).toContain("<h2>Spread positions</h2>");
      expect(html).toContain("<h2>How to use this spread</h2>");
      expect(html).toContain("<h2>Reflection question</h2>");
      expect(html).toContain("<h2>What this cannot determine</h2>");
      expect(html).toContain("Source basis");
      expect(html).toContain('"@type":"Article"');
      expect(html).not.toContain("HowTo");
      expect(html).not.toMatch(/<(?:input|form|textarea)\b/iu);
    }
  });

  it("indexes approved metadata only in production", () => {
    for (const deploymentEnvironment of ["local", "preview", "staging", "production"] as const) {
      const metadata = createTarotPublicMetadata({
        brandName: "Configured Brand",
        canonicalOrigin: "https://example.test",
        deploymentEnvironment,
        description: "A bounded Tarot education page.",
        locale: "en",
        publicationApproved: true,
        routeId: "tarot-guide:the-fool",
        title: "The Fool Tarot meaning",
        type: "article",
      });
      expect(metadata).toMatchObject({
        alternates: {
          canonical: "https://example.test/en/tarot/the-fool",
          languages: {
            en: "https://example.test/en/tarot/the-fool",
            "x-default": "https://example.test/en/tarot/the-fool",
          },
        },
        robots:
          deploymentEnvironment === "production"
            ? { follow: true, index: true }
            : { follow: false, index: false },
      });
    }
  });
});
