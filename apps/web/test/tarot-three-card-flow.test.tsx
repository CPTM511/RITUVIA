import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalActionHref } from "@rituvia/ui";
import { describe, expect, it } from "vitest";

import { TarotThreeCardFlow } from "../app/_components/tarot-three-card-flow";
import { TarotReadingReport } from "../app/_components/tarot-reading-report";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";

describe("private three-card server render", () => {
  it("exposes theme-only disabled controls and explicit ordered no-prediction guidance", () => {
    const messages = getTarotThreeCardMessages("en");
    const html = renderToStaticMarkup(
      createElement(TarotThreeCardFlow, {
        messages,
        methodologyHref: createLocalActionHref("/en/methodology"),
        sanctuaryHref: createLocalActionHref("/en/sanctuary"),
      }),
    );

    expect(html).toContain('action="/api/v1/readings/tarot"');
    expect(html).toContain('id="tarot-three-card-form"');
    expect(html.match(/name="tarot-theme-code"/gu)).toHaveLength(10);
    expect(html).toMatch(/<fieldset\b[^>]*disabled/gu);
    expect(html).toContain("three ordered symbolic lenses");
    expect(messages.page.introduction).toContain("Situation, Action, and Possibility");
    expect(messages.result.positionBoundary).toContain("not a prediction");
    expect(html).not.toMatch(/textarea|name="question|localStorage|sessionStorage/iu);
  });

  it("server-renders a closed categorical report control for the whole reading or fixed position", () => {
    const messages = getTarotThreeCardMessages("en");
    const html = renderToStaticMarkup(
      createElement(TarotReadingReport, {
        messages: messages.result.report,
        positions: [
          { positionId: "situation", positionTitle: "Situation" },
          { positionId: "action", positionTitle: "Action" },
          { positionId: "possibility", positionTitle: "Possibility" },
        ],
        readingId: "33333333-3333-4333-8333-333333333333",
      }),
    );

    expect(html).toContain("Report an issue with this reading");
    expect(html.match(/<select\b/gu)).toHaveLength(2);
    expect(html.match(/<option\b/gu)).toHaveLength(11);
    for (const positionId of ["situation", "action", "possibility"]) {
      expect(html).toContain(`value="${positionId}"`);
    }
    expect(html).not.toMatch(/textarea|name="(?:question|comment|journal|prayer)/iu);
  });
});
