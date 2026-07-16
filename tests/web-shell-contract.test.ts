import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("Web shell repository contract", () => {
  it("keeps production copy out of route and component JSX literals", () => {
    const component = read("apps/web/app/_components/site-shell.tsx");
    const route = read("apps/web/app/[locale]/page.tsx");

    expect(component).not.toMatch(/>\s*[A-Za-z][^<{]*</u);
    expect(component).not.toMatch(/\b(?:aria-label|placeholder|title)="[^"]+"/u);
    expect(route).not.toMatch(/>\s*[A-Za-z][^<{]*</u);
    expect(route).not.toContain("RITUVIA");
  });

  it("locks explicit redirect, unsupported-locale failure, and server rendering", () => {
    const root = read("apps/web/app/page.tsx");
    const route = read("apps/web/app/[locale]/page.tsx");

    expect(root).toContain("permanentRedirect(localeHomePath(defaultLocale) as Route)");
    expect(route).toContain("parseLocale");
    expect(route).toContain("notFound()");
    expect(route).toContain("export const dynamicParams = false");
    expect(route).not.toContain('"use client"');
  });

  it("locks reflow, focus, touch, dark, reduced-motion, and forced-color foundations", () => {
    const styles = read("apps/web/app/styles.css");

    for (const rule of [
      ":focus-visible",
      "min-block-size: 2.75rem",
      "overflow-wrap: anywhere",
      "prefers-color-scheme: dark",
      "prefers-reduced-motion: reduce",
      "forced-colors: active",
      "width <= 40rem",
    ]) {
      expect(styles).toContain(rule);
    }
    expect(styles).toContain("border-inline-start");
    expect(styles).toMatch(
      /\.brand-link\s*\{[^}]*max-inline-size:\s*100%[^}]*overflow-wrap:\s*anywhere/su,
    );
    expect(styles).not.toContain("overflow-x: auto");
    expect(styles).not.toMatch(/(?:margin|padding)-(?:left|right)|(?:left|right):/u);
  });
});
