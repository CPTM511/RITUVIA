import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TarotInterpretationPanel } from "../app/_components/tarot-interpretation-panel";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";

const readingId = "33333333-3333-4333-8333-333333333333";

describe("private tarot interpretation panel", () => {
  it.each([getTarotOneCardMessages("en"), getTarotThreeCardMessages("en")])(
    "server-renders an explicit safe idle boundary without starting work",
    (messages) => {
      const html = renderToStaticMarkup(
        createElement(TarotInterpretationPanel, {
          messages: messages.result.interpretation,
          reportMessages: messages.result.report,
          readingId,
        }),
      );

      expect(html).toContain("Explore a deeper interpretation");
      expect(html).toContain("Symbolic reflection, not professional advice.");
      expect(html).toContain("Only this reading&#x27;s random ID is used");
      expect(html).toContain("Explore the deeper interpretation");
      expect(html).not.toContain(readingId);
      expect(html).not.toMatch(/provider|model|provenance|digest|token|cost/iu);
      expect(html).not.toMatch(/<input|<textarea|<select/iu);
      expect(html).not.toMatch(/localStorage|sessionStorage|dangerouslySetInnerHTML/iu);
    },
  );
});
