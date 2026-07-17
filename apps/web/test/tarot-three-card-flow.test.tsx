import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalActionHref } from "@rituvia/ui";
import { describe, expect, it } from "vitest";

import { TarotThreeCardFlow } from "../app/_components/tarot-three-card-flow";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";

describe("private three-card server render", () => {
  it("exposes theme-only disabled controls and explicit ordered no-prediction guidance", () => {
    const messages = getTarotThreeCardMessages("en");
    const html = renderToStaticMarkup(
      createElement(TarotThreeCardFlow, {
        messages,
        methodologyHref: createLocalActionHref("/en/methodology"),
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
});
