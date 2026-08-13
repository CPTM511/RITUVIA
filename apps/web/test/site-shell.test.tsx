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
      canonicalOrigin: "https://rituvia.example",
      locale: "en",
      messages: getMessages("en"),
      numerologyEnabled: true,
    }),
  );

describe("server-rendered public shell", () => {
  it("renders landmark, heading, skip-link, and label relationships", () => {
    const html = render();

    expect(html).toContain('<a class="skip-link" href="#main-content">');
    expect(html).toContain("<header");
    expect(html).toContain('<nav aria-label="Primary navigation"');
    expect(html).toContain('href="/en/methodology"');
    expect(html).toContain('href="/en/safety"');
    expect(html).toContain('href="/en/privacy"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('<main id="main-content" tabindex="-1">');
    expect(html).toContain("<footer");
    expect(html.match(/<h1\b/gu)).toHaveLength(1);
    expect(html).toContain('<label class="locale-label" for="locale-select">');
    expect(html).toContain('aria-describedby="locale-hint"');
    expect(html).toContain("<noscript>");
    expect(html.match(/href="\/en\/intake"/gu)).toHaveLength(2);
    expect(html).not.toContain('href="/en/tarot/one-card"');
    expect(html).toContain('href="/en/tarot/three-card"');
    expect(html).toContain('href="/en/sanctuary"');
    expect(html).toContain('href="/en/readings/numerology"');
    expect(html).toContain('href="/en/account"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("rituvia-sanctuary-orb.png");
    expect(html).toContain("A free ritual path always remains");
    expect(html).toContain('data-geo-entity-id="rituvia-public-guidance-v1"');
    expect(html).toContain(">Product policy</dt>");
    expect(html).toContain(">Interpretation</dt>");
    expect(html).toContain("Owner-approved product decision");
    expect(html).toContain('"@type":"WebSite"');
    expect(html).toContain('"url":"https://rituvia.example/en"');
    expect(html).not.toContain("BreadcrumbList");
    expect(html).not.toMatch(/"author"|"dateModified"|"datePublished"|"publisher"/u);
    expect(html).not.toContain('data-connection-state="offline"');
  });

  it("renders only locale-safe internal targets and no unsupported feature route", () => {
    const html = render();
    const targets = [...html.matchAll(/href="([^"]+)"/gu)]
      .map((match) => match[1])
      .filter((target): target is string => target !== undefined);

    expect(targets.length).toBeGreaterThan(10);
    expect(targets.every((target) => target === "#main-content" || target.startsWith("/en"))).toBe(
      true,
    );
    expect(html).not.toMatch(/href="https?:/u);
    expect(html).not.toMatch(/href="\/en\/(?:readings\/astrology|pricing)/u);
    expect(html).not.toMatch(/<(?:form|input|textarea)\b/u);
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
        canonicalOrigin: "https://rituvia.example",
        locale: "en",
        messages: getMessages("en"),
        numerologyEnabled: true,
      }),
    );

    expect(html).not.toContain('class="footer-tagline"');
  });

  it("hides the calculator entry when the approved catalog gate is closed", () => {
    const html = renderToStaticMarkup(
      createElement(SiteShell, {
        brandName: "Configured Brand",
        brandTagline: "Configured tagline",
        canonicalOrigin: "https://rituvia.example",
        locale: "en",
        messages: getMessages("en"),
        numerologyEnabled: false,
      }),
    );

    expect(html).not.toContain('href="/en/readings/numerology"');
    expect(html).not.toContain("Numerology calculator");
  });
});
