import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteShell } from "../app/_components/site-shell";
import { getMessages } from "../app/_i18n/messages";

const render = () =>
  renderToStaticMarkup(
    createElement(SiteShell, {
      brandName: "Configured Brand",
      brandTagline: "Configured tagline",
      locale: "en",
      messages: getMessages("en"),
    }),
  );

describe("server-rendered public shell", () => {
  it("renders landmark, heading, skip-link, and label relationships", () => {
    const html = render();

    expect(html).toContain('<a class="skip-link" href="#main-content">');
    expect(html).toContain("<header");
    expect(html).toContain('<nav aria-label="Primary navigation"');
    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain("<footer");
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain('<label class="locale-label" for="locale-select">');
    expect(html).toContain('aria-describedby="locale-hint"');
    expect(html).toContain("<noscript>");
  });

  it("renders only locale-safe internal targets and no unfinished feature route", () => {
    const html = render();
    const targets = [...html.matchAll(/href="([^"]+)"/gu)]
      .map((match) => match[1])
      .filter((target): target is string => target !== undefined);

    expect(targets.length).toBeGreaterThan(10);
    expect(targets.every((target) => target === "#main-content" || target.startsWith("/en"))).toBe(
      true,
    );
    expect(html).not.toMatch(/href="https?:/u);
    expect(html).not.toMatch(/href="\/en\/(?:account|tarot|astrology|numerology|pricing)/u);
  });

  it("uses configured brand values without exposing a server-only configuration surface", () => {
    const html = render();

    expect(html).toContain("Configured Brand");
    expect(html).toContain("Configured tagline");
    expect(html).not.toContain("BRAND_NAME");
    expect(html).not.toContain("DATABASE_URL");
  });

  it("omits the optional tagline element when configuration leaves it empty", () => {
    const html = renderToStaticMarkup(
      createElement(SiteShell, {
        brandName: "Configured Brand",
        brandTagline: "",
        locale: "en",
        messages: getMessages("en"),
      }),
    );

    expect(html).not.toContain('class="footer-tagline"');
  });
});
