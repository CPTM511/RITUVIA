import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalActionHref } from "@rituvia/ui";
import { describe, expect, it } from "vitest";

import { TarotOneCardFlow } from "../app/_components/tarot-one-card-flow";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";

describe("private one-card server render", () => {
  it("exposes ten theme-only disabled controls and meaningful no-JavaScript guidance", () => {
    const html = renderToStaticMarkup(
      createElement(TarotOneCardFlow, {
        messages: getTarotOneCardMessages("en"),
        methodologyHref: createLocalActionHref("/en/methodology"),
      }),
    );

    expect(html).toContain('action="/api/v1/readings/tarot"');
    expect(html).toContain('method="post"');
    expect(html.match(/name="tarot-theme-code"/gu)).toHaveLength(10);
    expect(html).toMatch(/<fieldset\b[^>]*disabled/gu);
    expect(html).toContain("JavaScript is required");
    expect(html).not.toMatch(/textarea|name="question|localStorage|sessionStorage/iu);
  });
});
