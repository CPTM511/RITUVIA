import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicInformationPage } from "../app/_components/public-information-page";
import { getMessages } from "../app/_i18n/messages";
import { publicPageSlugs } from "../app/_i18n/routing";

const render = (page: (typeof publicPageSlugs)[number]) =>
  renderToStaticMarkup(
    createElement(PublicInformationPage, {
      brandName: "Configured Brand",
      brandTagline: "Configured tagline",
      locale: "en",
      messages: getMessages("en"),
      page,
    }),
  );

describe("server-rendered public information pages", () => {
  it.each(publicPageSlugs)(
    "renders the exact %s page with one H1 and current navigation",
    (page) => {
      const html = render(page);

      expect(html).toContain('<main class="information-main" id="main-content" tabindex="-1">');
      expect(html.match(/<h1\b/gu)).toHaveLength(1);
      expect(html).toContain(`aria-current="page" class="navigation-link" href="/en/${page}"`);
      expect(html).toContain("No readings, AI interpretations, accounts, purchases, or rituals");
      expect(html).not.toMatch(/<(?:form|input|textarea)\b/u);
      expect(html).not.toMatch(/href="https?:/u);
    },
  );

  it("keeps approved current-state language near the privacy design", () => {
    const html = render("privacy");

    expect(html).toContain("not a legal Privacy Policy");
    expect(html).toContain("Minimum operational request metadata may be processed");
    expect(html).not.toContain("We collect nothing");
  });
});
