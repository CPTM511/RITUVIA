import { readFileSync } from "node:fs";
import ts from "typescript";

import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(path, "utf8");

const jsxCopyFindings = (source: string): string[] => {
  const sourceFile = ts.createSourceFile(
    "contract.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && /[A-Za-z]/u.test(node.text)) findings.push(node.text.trim());
    if (
      ts.isJsxAttribute(node) &&
      ["aria-label", "placeholder", "title"].includes(node.name.getText(sourceFile)) &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer)
    ) {
      findings.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

describe("Web shell repository contract", () => {
  it("keeps production copy out of route and component JSX literals", () => {
    const component = [
      "apps/web/app/_components/site-shell.tsx",
      "apps/web/app/_components/public-site-frame.tsx",
      "apps/web/app/_components/public-information-page.tsx",
      "apps/web/app/_components/question-intake-form.tsx",
    ]
      .map(read)
      .join("\n");
    const route = [
      "apps/web/app/[locale]/page.tsx",
      "apps/web/app/[locale]/[page]/page.tsx",
      "apps/web/app/[locale]/intake/page.tsx",
    ]
      .map(read)
      .join("\n");

    expect(jsxCopyFindings(component)).toEqual([]);
    expect(jsxCopyFindings(route)).toEqual([]);
    expect(route).not.toContain("RITUVIA");
  });

  it("keeps private question text out of browser persistence, URLs, analytics, and logs", () => {
    const form = read("apps/web/app/_components/question-intake-form.tsx");
    const route = read("apps/web/app/api/v1/intake/evaluate/route.ts");
    const source = `${form}\n${route}`;

    expect(form).toContain('method="post"');
    expect(form).toContain('cache: "no-store"');
    expect(form).not.toMatch(
      /\b(?:localStorage|sessionStorage|indexedDB|history\.|URLSearchParams)\b/u,
    );
    expect(source).not.toMatch(/\b(?:console\.|analytics|captureException|recording)\b/iu);
    expect(route).not.toContain("riskCategories");
  });

  it("locks explicit redirect, unsupported-locale failure, and server rendering", () => {
    const root = read("apps/web/app/(root)/page.tsx");
    const localeLayout = read("apps/web/app/[locale]/layout.tsx");
    const route = read("apps/web/app/[locale]/page.tsx");
    const publicRoute = read("apps/web/app/[locale]/[page]/page.tsx");

    expect(root).toContain("permanentRedirect(localeHomePath(defaultLocale) as Route)");
    expect(route).toContain("parseGoldenShellLocale");
    expect(route).toContain("goldenShellLocales");
    expect(route).toContain("notFound()");
    expect(route).toContain("export const dynamicParams = false");
    expect(route).not.toContain('"use client"');
    expect(localeLayout).toContain("parseGoldenShellLocale");
    expect(localeLayout).toContain("goldenShellLocales");
    expect(localeLayout).toContain("<RootDocument locale={locale}>");
    expect(publicRoute).toContain("publicRouteRegistry.routeByPathname");
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
    expect(applicationStyles).toMatch(
      /:root,\s*\[data-theme="light"\],\s*\[data-theme="dark"\]\s*\{[^}]*--surface-canvas:\s*#060711/su,
    );
    expect(applicationStyles).not.toContain("--motion-fast:");
    expect(styles).toMatch(
      /\.brand-link\s*\{[^}]*max-inline-size:\s*100%[^}]*overflow-wrap:\s*anywhere/su,
    );
    expect(styles).not.toMatch(/(?:html|body)\s*\{[^}]*overflow-x:\s*auto/gu);
    expect(styles).not.toMatch(/(?:margin|padding)-(?:left|right)|(?:left|right):/u);
  });
});
