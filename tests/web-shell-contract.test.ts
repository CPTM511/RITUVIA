import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

describe("Web shell repository contract", () => {
  it("keeps production copy out of route and component JSX literals", () => {
    const component = [
      "apps/web/app/_components/site-shell.tsx",
      "apps/web/app/_components/public-site-frame.tsx",
      "apps/web/app/_components/public-information-page.tsx",
    ]
      .map(read)
      .join("\n");
    const route = ["apps/web/app/[locale]/page.tsx", "apps/web/app/[locale]/[page]/page.tsx"]
      .map(read)
      .join("\n");

    expect(component).not.toMatch(/>\s*[A-Za-z][^<{]*</u);
    expect(component).not.toMatch(/\b(?:aria-label|placeholder|title)="[^"]+"/u);
    expect(route).not.toMatch(/>\s*[A-Za-z][^<{]*</u);
    expect(route).not.toContain("RITUVIA");
  });

  it("locks explicit redirect, unsupported-locale failure, and server rendering", () => {
    const root = read("apps/web/app/page.tsx");
    const route = read("apps/web/app/[locale]/page.tsx");
    const publicRoute = read("apps/web/app/[locale]/[page]/page.tsx");

    expect(root).toContain("permanentRedirect(localeHomePath(defaultLocale) as Route)");
    expect(route).toContain("parseLocale");
    expect(route).toContain("notFound()");
    expect(route).toContain("export const dynamicParams = false");
    expect(route).not.toContain('"use client"');
    expect(publicRoute).toContain("parsePublicPageSlug");
    expect(publicRoute).toContain("notFound()");
    expect(publicRoute).toContain("export const dynamicParams = false");
    expect(publicRoute).not.toContain('"use client"');
  });

  it("locks reflow, focus, touch, dark, reduced-motion, and forced-color foundations", () => {
    const applicationStyles = read("apps/web/app/styles.css");
    const sharedStyles = read("packages/ui/src/styles.css");
    const styles = `${sharedStyles}\n${applicationStyles}`;

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
    expect(applicationStyles).not.toContain("--surface-canvas:");
    expect(applicationStyles).not.toContain("--motion-fast:");
    expect(styles).toMatch(
      /\.brand-link\s*\{[^}]*max-inline-size:\s*100%[^}]*overflow-wrap:\s*anywhere/su,
    );
    expect(styles).not.toContain("overflow-x: auto");
    expect(styles).not.toMatch(/(?:margin|padding)-(?:left|right)|(?:left|right):/u);
  });
});
