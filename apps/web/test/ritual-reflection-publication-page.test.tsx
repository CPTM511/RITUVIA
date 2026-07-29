import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RitualReflectionPublicationGuide,
  RitualReflectionPublicationHub,
} from "../app/_components/ritual-reflection-publication";
import { getMessages } from "../app/_i18n/messages";
import { createRitualReflectionPublicMetadata } from "../app/_i18n/ritual-reflection-public-metadata";
import { ritualReflectionPublication } from "../server/ritual-reflection-publication";

const shared = {
  brandName: "Configured Brand",
  brandTagline: "Configured tagline",
  canonicalOrigin: "https://example.test",
  locale: "en" as const,
  messages: getMessages("en").shared,
};

describe("Ritual and reflection publication pages", () => {
  it("renders an answer-first hub with five distinct guides, sources, and no private input", () => {
    const html = renderToStaticMarkup(<RitualReflectionPublicationHub {...shared} />);

    expect(html).toContain("<h1>A symbolic pause that keeps the next step yours</h1>");
    expect(html.match(/class="ritual-guide-card"/gu)).toHaveLength(5);
    expect(html).toContain('href="/en/rituals/virtual-candle-reflection"');
    expect(html).toContain('href="/en/rituals/private-reflection-journal"');
    expect(html).toContain('href="/en/sanctuary"');
    expect(html).toContain("2026-07-28");
    expect(html).toContain("2027-07-28");
    expect(html).not.toContain("Pending owner review");
    expect(html).toContain('data-geo-entity-id="rituvia-original-secular-reflection-v1"');
    expect(html).toContain(">Product policy</dt>");
    expect(html).toContain(">Interpretation</dt>");
    expect(html).toContain('"@type":"CollectionPage"');
    expect(html).not.toContain('"@type":"BreadcrumbList"');
    expect(html).not.toContain('"dateModified"');
    expect(html).not.toContain('"datePublished"');
    expect(html).not.toMatch(/<(?:input|form|textarea)\b/iu);
    expect(html).not.toMatch(/questionText|birthTime|journalEntryText/u);
  });

  it("renders every guide with steps, questions, limits, sources, and bounded links", () => {
    for (const guide of ritualReflectionPublication.guides) {
      const html = renderToStaticMarkup(
        <RitualReflectionPublicationGuide {...shared} guide={guide} />,
      );
      expect(html.match(/<h1>/gu)).toHaveLength(1);
      expect(html).toContain(">A bounded way to try it</h2>");
      expect(html).toContain(">Questions you may use</h2>");
      expect(html).toContain(">What this does not do</h2>");
      expect(html).toContain(">Source basis</h3>");
      expect(html).toContain("Owner-approved editorial record");
      expect(html).toContain('href="/en/sanctuary"');
      expect(html).toContain('href="/en/rituals"');
      expect(html).toContain('"@type":"Article"');
      expect(html).not.toContain('"dateModified"');
      expect(html).not.toContain('"datePublished"');
      expect(html).not.toContain('"@type":"HowTo"');
      expect(html).not.toContain("FAQPage");
      expect(html).not.toContain('"@type":"Product"');
      expect(html).not.toMatch(/<(?:input|form|textarea)\b/iu);
    }
  });

  it("indexes approved metadata only in production", () => {
    for (const deploymentEnvironment of ["local", "preview", "staging", "production"] as const) {
      const metadata = createRitualReflectionPublicMetadata({
        brandName: "Configured Brand",
        canonicalOrigin: "https://example.test",
        deploymentEnvironment,
        description: "A bounded ritual and reflection education page.",
        locale: "en",
        publicationApproved: true,
        routeId: "ritual-reflection-guide:virtual-candle-reflection",
        title: "How to use a virtual candle for reflection",
        type: "article",
      });
      expect(metadata).toMatchObject({
        alternates: {
          canonical: "https://example.test/en/rituals/virtual-candle-reflection",
          languages: {
            en: "https://example.test/en/rituals/virtual-candle-reflection",
            "x-default": "https://example.test/en/rituals/virtual-candle-reflection",
          },
        },
        robots: {
          follow: deploymentEnvironment === "production",
          index: deploymentEnvironment === "production",
        },
      });
    }
  });
});
