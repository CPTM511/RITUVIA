import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const uiStyles = readFileSync("packages/ui/src/styles.css", "utf8");
const webStyles = readFileSync("apps/web/app/styles.css", "utf8");

type Rgb = readonly [number, number, number];

const selectorBlock = (pattern: RegExp): string => {
  const block = pattern.exec(uiStyles)?.[1];
  if (block === undefined) throw new TypeError("Expected reviewed theme block.");
  return block;
};

const light = selectorBlock(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\}/u);
const dark = selectorBlock(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/u);
const systemDark = selectorBlock(
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\),\s*\[data-theme="system"\]\s*\{([\s\S]*?)\}\s*\}/u,
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

  it("proves text contrast against the opaque and worst reviewed gradient/header backgrounds", () => {
    expect(webStyles).toContain(
      "radial-gradient(circle at 88% 8%, rgb(169 119 50 / 12%), transparent 26rem)",
    );
    expect(webStyles).toContain(
      "background: color-mix(in srgb, var(--surface-canvas) 94%, transparent)",
    );
    const gradientColor = [169, 119, 50] as const;
    for (const [themeName, theme] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      const canvas = token(theme, "surface-canvas");
      const gradient = composite(canvas, gradientColor, 0.12);
      const backgrounds = [
        canvas,
        gradient,
        composite(gradient, canvas, 0.94),
        composite(canvas, canvas, 0.94),
      ];
      for (const foregroundName of ["ink-primary", "ink-secondary", "brand-main"]) {
        const foreground = token(theme, foregroundName);
        for (const [index, background] of backgrounds.entries()) {
          expect(
            contrast(foreground, background),
            `${themeName}:${foregroundName}:background-${index}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
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
    ]) {
      expect(webStyles).toContain(declaration);
    }
    expect(webStyles).toMatch(/\.navigation-link,[\s\S]*?color: var\(--ink-secondary\)/u);
    expect(webStyles).toMatch(/\.locale-label \{[\s\S]*?color: var\(--ink-secondary\)/u);
    expect(webStyles).toMatch(/\.eyebrow,[\s\S]*?color: var\(--brand-main\)/u);
    expect(webStyles).toMatch(/\.hero-introduction,[\s\S]*?color: var\(--ink-secondary\)/u);
  });
});
