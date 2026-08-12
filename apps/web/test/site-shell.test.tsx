import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteShell } from "../app/_components/site-shell";
import { getGoldenShellMessages } from "../app/_i18n/golden-shell-messages";

const render = () =>
  renderToStaticMarkup(
    createElement(SiteShell, {
      brandName: "Configured Brand",
      locale: "en",
      messages: getGoldenShellMessages("en"),
    }),
  );

describe("server-rendered public shell", () => {
  it("renders landmark, heading, skip-link, and label relationships", () => {
    const html = render();

    expect(html).toContain('<a class="golden-skip-link" href="#main-content">');
    expect(html).toContain('<header class="golden-site-header"');
    expect(html).toContain('<nav aria-label="Primary navigation"');
    expect(html).toContain('href="/en#readings"');
    expect(html).toContain('href="/en/sanctuary"');
    expect(html).toContain('href="/en/revisit"');
    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain('<footer class="golden-site-footer"');
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain('href="/zh-Hans"');
    expect(html).toContain('hrefLang="zh-Hans"');
    expect(html).toContain('href="/en/tarot/one-card"');
    expect(html).toContain('href="/en/intake"');
    expect(html).toContain("Pause here.");
    expect(html).toContain("See what deserves your attention.");
    expect(html).toContain("What feels right for today?");
    expect(html).toContain("A reading is only the beginning");
    expect(html).toContain('aria-disabled="true"');
  });

  it("renders only locale-safe internal targets and no unsupported feature route", () => {
    const html = render();
    const targets = [...html.matchAll(/href="([^"]+)"/gu)]
      .map((match) => match[1])
      .filter((target): target is string => target !== undefined);

    expect(targets.length).toBeGreaterThan(10);
    expect(
      targets.every(
        (target) => target === "#main-content" || target === "/zh-Hans" || target.startsWith("/en"),
      ),
    ).toBe(true);
    expect(html).not.toMatch(/href="https?:/u);
    expect(html).not.toMatch(
      /href="\/en\/(?:account|plans|pricing|readings\/(?:astrology|deep|numerology))/u,
    );
    expect(html).not.toMatch(/<(?:form|input|textarea)\b/u);
  });

  it("uses configured brand values without exposing a server-only configuration surface", () => {
    const html = render();

    expect(html).toContain("Configured Brand");
    expect(html).toContain("A PRIVATE SPACE FOR REFLECTION");
    expect(html).not.toContain("BRAND_NAME");
    expect(html).not.toContain("DATABASE_URL");
  });

  it("renders reviewed Simplified Chinese without leaking into an English product journey", () => {
    const html = renderToStaticMarkup(
      createElement(SiteShell, {
        brandName: "Configured Brand",
        locale: "zh-Hans",
        messages: getGoldenShellMessages("zh-Hans"),
      }),
    );

    expect(html).toContain("在这里停一停。");
    expect(html).toContain("看清什么值得你认真对待。");
    expect(html).toContain('href="/en"');
    expect(html).not.toMatch(/href="\/en\/(?:intake|tarot|sanctuary|revisit)/u);
  });

  it("keeps unapproved Item 7+ entries visible only as disabled golden-shell copy", () => {
    const html = render();

    expect(html).not.toContain('href="/en/readings/numerology"');
    expect(html).not.toContain('href="/en/readings/deep"');
    expect(html).not.toContain('href="/en/plans"');
    expect(html).toContain("Numerology");
    expect(html).toContain("Deep Readings");
    expect(html).toContain("Plus &amp; Credits");
  });
});
