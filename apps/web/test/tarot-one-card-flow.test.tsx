import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalActionHref } from "@rituvia/ui";
import { describe, expect, it } from "vitest";

import { TarotOneCardFlow } from "../app/_components/tarot-one-card-flow";
import { TarotReadingReport } from "../app/_components/tarot-reading-report";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";

describe("private one-card server render", () => {
  it("exposes ten theme-only disabled controls and meaningful no-JavaScript guidance", () => {
    const html = renderToStaticMarkup(
      createElement(TarotOneCardFlow, {
        brandName: "RITUVIA",
        enhancedInterpretationAvailable: false,
        locale: "en",
        messages: getTarotOneCardMessages("en"),
        methodologyHref: createLocalActionHref("/en/methodology"),
        sanctuaryHref: createLocalActionHref("/en/sanctuary"),
        shareCanonicalUrl: "https://example.test/en/tarot",
      }),
    );

    expect(html).toContain('action="/api/v1/readings/tarot"');
    expect(html).toContain('method="post"');
    expect(html.match(/name="tarot-theme-code"/gu)).toHaveLength(10);
    expect(html).toMatch(/<fieldset\b[^>]*disabled/gu);
    expect(html).toContain("JavaScript is required");
    expect(html).not.toMatch(/textarea|name="question|localStorage|sessionStorage/iu);
    expect(html).not.toContain("Explore a deeper interpretation");
    expect(getTarotOneCardMessages("en").result.providerSafeOff).toContain(
      "Provider AI is disabled in protected staging",
    );
  });

  it("server-renders a closed categorical report control for the whole reading or card", () => {
    const messages = getTarotOneCardMessages("en");
    const html = renderToStaticMarkup(
      createElement(TarotReadingReport, {
        locale: "en",
        messages: messages.result.report,
        positions: [{ positionId: "single", positionTitle: "Single card" }],
        readingId: "33333333-3333-4333-8333-333333333333",
      }),
    );

    expect(html).toContain("Report an issue with this reading");
    expect(html).toContain("There is no free-text field");
    expect(html.match(/<select\b/gu)).toHaveLength(2);
    expect(html.match(/<option\b/gu)).toHaveLength(9);
    expect(html).toContain('value="reading"');
    expect(html).toContain('value="single"');
    expect(html).not.toMatch(/textarea|name="(?:question|comment|journal|prayer)/iu);
  });

  it("keeps the share surface absent when staging omits public share inputs", () => {
    const html = renderToStaticMarkup(
      createElement(TarotOneCardFlow, {
        enhancedInterpretationAvailable: false,
        locale: "en",
        messages: getTarotOneCardMessages("en"),
        methodologyHref: createLocalActionHref("/en/methodology"),
        sanctuaryHref: createLocalActionHref("/en/sanctuary"),
      }),
    );

    expect(html).not.toContain("Share this card");
    expect(html).not.toContain("https://");
  });

  it("server-renders an exact interpretation report without exposing its request identifier", () => {
    const messages = getTarotOneCardMessages("en");
    const interpretationRequestId = "44444444-4444-4444-8444-444444444444";
    const html = renderToStaticMarkup(
      createElement(TarotReadingReport, {
        interpretationRequestId,
        locale: "en",
        messages: messages.result.report,
        positions: [],
        readingId: "33333333-3333-4333-8333-333333333333",
      }),
    );

    expect(html).toContain("Report an issue with this interpretation");
    expect(html).toContain("The displayed interpretation");
    expect(html.match(/<select\b/gu)).toHaveLength(1);
    expect(html).not.toContain(interpretationRequestId);
    expect(html).not.toMatch(/textarea|name="(?:question|comment|journal|prayer)/iu);
  });
});
