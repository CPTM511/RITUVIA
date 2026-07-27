import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const uiStyles = readFileSync("packages/ui/src/styles.css", "utf8");
const webStyles = readFileSync("apps/web/app/styles.css", "utf8");

type Rgb = readonly [number, number, number];

const selectorBlock = (styles: string, pattern: RegExp): string => {
  const block = pattern.exec(styles)?.[1];
  if (block === undefined) throw new TypeError("Expected reviewed theme block.");
  return block;
};

const dark = selectorBlock(uiStyles, /\[data-theme="dark"\]\s*\{([\s\S]*?)\}/u);
const systemDark = selectorBlock(
  uiStyles,
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\),\s*\[data-theme="system"\]\s*\{([\s\S]*?)\}\s*\}/u,
);
const webTheme = selectorBlock(
  webStyles,
  /:root,\s*\[data-theme="light"\],\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\}/u,
);

const token = (block: string, name: string): Rgb => {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "iu").exec(block)?.[1];
  if (value === undefined) throw new TypeError(`Expected ${name} theme token.`);
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
};

const luminance = (value: Rgb): number => {
  const channels = value.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
};

const contrast = (foreground: Rgb, background: Rgb): number => {
  const values = [luminance(foreground), luminance(background)].sort(
    (leftValue, rightValue) => rightValue - leftValue,
  );
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
};

const composite = (background: Rgb, foreground: Rgb, alpha: number): Rgb =>
  background.map((channel, index) =>
    Math.round(channel * (1 - alpha) + (foreground[index] ?? 0) * alpha),
  ) as unknown as Rgb;

describe("public shell contrast compensation", () => {
  it("keeps system dark colors byte-equivalent to the explicit dark theme", () => {
    for (const name of ["surface-canvas", "ink-primary", "ink-secondary", "brand-main"]) {
      expect(token(systemDark, name)).toEqual(token(dark, name));
    }
  });

  it("proves Web text contrast against every reviewed gradient, header, and oracle background", () => {
    expect(webStyles).toContain(
      "radial-gradient(circle at 88% 8%, rgb(169 119 50 / 12%), transparent 26rem)",
    );
    expect(webStyles).toContain(
      "radial-gradient(circle at 18% -5%, rgb(161 146 255 / 18%), transparent 32rem)",
    );
    expect(webStyles).toContain(
      "background: color-mix(in srgb, var(--surface-canvas) 94%, transparent)",
    );
    expect(webStyles).toContain(
      "background: color-mix(in srgb, var(--surface-panel) 92%, transparent)",
    );
    expect(webStyles).toContain(
      "background: linear-gradient(145deg, var(--brand-soft), var(--surface-panel))",
    );
    const canvas = token(webTheme, "surface-canvas");
    const panel = token(webTheme, "surface-panel");
    const goldGradient = composite(canvas, [169, 119, 50], 0.12);
    const violetGradient = composite(canvas, [161, 146, 255], 0.18);
    const combinedGradient = composite(violetGradient, [169, 119, 50], 0.12);
    const backgrounds = [
      canvas,
      goldGradient,
      violetGradient,
      combinedGradient,
      composite(goldGradient, canvas, 0.94),
      composite(violetGradient, canvas, 0.94),
      composite(combinedGradient, canvas, 0.94),
      composite([255, 255, 255], canvas, 0.94),
      composite(goldGradient, panel, 0.92),
      composite(violetGradient, panel, 0.92),
      composite(combinedGradient, panel, 0.92),
      token(webTheme, "brand-soft"),
      panel,
    ];
    for (const foregroundName of ["ink-primary", "ink-secondary", "brand-main", "accent-sage"]) {
      const foreground = token(webTheme, foregroundName);
      for (const [index, background] of backgrounds.entries()) {
        expect(
          contrast(foreground, background),
          `web:${foregroundName}:background-${index}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps every axe-incomplete text family on one of the reviewed foreground tokens", () => {
    for (const declaration of [
      ".navigation-link,\n.footer-link",
      ".locale-label",
      ".eyebrow,\n.status-pill",
      ".hero-introduction,\n.section-introduction",
      ".hero-boundary",
      ".information-introduction",
      ".question-intake-introduction",
      ".question-intake-boundary,\n.question-intake-privacy",
      ".oracle-card > p:not(.eyebrow)",
      ".oracle-card .oracle-note",
    ]) {
      expect(webStyles).toContain(declaration);
    }
    expect(webStyles).toMatch(/\.navigation-link,[\s\S]*?color: var\(--ink-secondary\)/u);
    expect(webStyles).toMatch(/\.locale-label \{[\s\S]*?color: var\(--ink-secondary\)/u);
    expect(webStyles).toMatch(/\.eyebrow,[\s\S]*?color: var\(--brand-main\)/u);
    expect(webStyles).toMatch(/\.hero-introduction,[\s\S]*?color: var\(--ink-secondary\)/u);
    expect(webStyles).toMatch(
      /\.question-intake-introduction \{[\s\S]*?color: var\(--ink-secondary\)/u,
    );
    expect(webStyles).toMatch(/\.question-intake-boundary,[\s\S]*?color: var\(--ink-secondary\)/u);
    expect(webStyles).toMatch(/body \{[\s\S]*?color: var\(--ink-primary\)/u);
    expect(webStyles).toMatch(
      /\.oracle-card > p:not\(\.eyebrow\) \{[\s\S]*?color: var\(--ink-secondary\)/u,
    );
    expect(webStyles).toMatch(/\.oracle-card \.oracle-note \{[\s\S]*?color: var\(--accent-sage\)/u);
  });

  it("keeps the decorative sanctuary preview inside its reviewed clipping bounds", () => {
    expect(webStyles).toMatch(
      /\.sanctuary-preview-art \{[\s\S]*?inline-size: 100%;[\s\S]*?max-inline-size: 33\.5rem;[\s\S]*?max-block-size: 42rem;[\s\S]*?aspect-ratio: 1122 \/ 1402;[\s\S]*?justify-self: center;[\s\S]*?overflow: hidden;/u,
    );
    expect(webStyles).toMatch(
      /@media \(width <= 40rem\) \{[\s\S]*?\.sanctuary-preview-art \{[\s\S]*?max-inline-size: 25\.5rem;[\s\S]*?max-block-size: 32rem;/u,
    );
  });
});
