import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLocalActionHref } from "@rituvia/ui";
import { describe, expect, it } from "vitest";

import { QuestionIntakeForm } from "../app/_components/question-intake-form";
import { getQuestionIntakeMessages } from "../app/_i18n/question-intake-messages";

const render = () =>
  renderToStaticMarkup(
    createElement(QuestionIntakeForm, {
      messages: getQuestionIntakeMessages("en"),
      readingHref: createLocalActionHref("/en/tarot/one-card"),
    }),
  );

describe("server-rendered question intake form", () => {
  it("renders ten themes and a bounded private POST form", () => {
    const html = render();

    expect(html).toContain('action="/api/v1/intake/evaluate"');
    expect(html).toContain('method="post"');
    expect(html.match(/type="radio"/gu)).toHaveLength(10);
    expect(html).toContain('name="theme-code"');
    expect(html).toContain('name="question"');
    expect(html).toContain('maxLength="600"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain("<noscript>");
  });

  it("keeps controls disabled before hydration so no-JS cannot submit private text", () => {
    const html = render();

    expect(html).toMatch(/<fieldset[^>]*disabled=""/u);
    expect(html).toMatch(/<textarea[^>]*disabled=""/u);
    expect(html).toMatch(/<button[^>]*disabled=""/u);
    expect(html).toContain("cannot be placed in a URL");
    expect(html).not.toContain("localStorage");
    expect(html).not.toContain("sessionStorage");
  });
});
