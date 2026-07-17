import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync("packages/ui/src/styles.css", "utf8");

const hexToRgb = (value: string): readonly [number, number, number] => {
  const normalized = value.slice(1);
  if (normalized.length !== 6) throw new TypeError(`Expected six-digit hex, received ${value}.`);
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
};

const luminance = (value: string): number => {
  const channels = hexToRgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
};

const contrast = (foreground: string, background: string): number => {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
};

const tokenValues = (name: string): readonly string[] =>
  [...styles.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "giu"))].map(
    (match) => match[1] ?? "",
  );

describe("UI stylesheet contract", () => {
  it("centralizes semantic color, type, spacing, shape, elevation, control, and motion tokens", () => {
    for (const token of [
      "surface-canvas",
      "surface-panel",
      "ink-primary",
      "ink-secondary",
      "state-info",
      "state-success",
      "state-warning",
      "state-error",
      "focus-ring",
      "font-ui",
      "font-display",
      "font-size-md",
      "space-4",
      "radius-md",
      "shadow-soft",
      "control-size-min",
      "motion-fast",
      "motion-easing",
    ]) {
      expect(styles).toContain(`--${token}:`);
    }
  });

  it("implements explicit light/dark plus system, reduced-motion, forced-color, and RTL contracts", () => {
    for (const contract of [
      '[data-theme="light"]',
      '[data-theme="dark"]',
      '[data-theme="system"]',
      "prefers-color-scheme: dark",
      "prefers-reduced-motion: reduce",
      "forced-colors: active",
      "animation-duration: 0.01ms",
      "min-block-size: var(--control-size-min)",
      ":dir(rtl)",
      "inset-inline-start",
      "border-inline-end-color",
    ]) {
      expect(styles).toContain(contract);
    }
    expect(styles).not.toMatch(
      /(?:margin|padding|inset)-(?:left|right)|(?:^|[;{])\s*(?:left|right):/mu,
    );
    expect(styles).not.toContain("color-scheme: light dark");
    expect(styles).not.toMatch(/\[dir=["']rtl["']\][^{]*\{/u);
    expect(styles.match(/color-scheme:\s*light;/gu)).toHaveLength(2);
    expect(styles.match(/color-scheme:\s*dark;/gu)).toHaveLength(2);
  });

  it("contains no remote, imported, escaped, inline-runtime, font, image, or media resource surface", () => {
    expect(styles).not.toMatch(
      /@import|@font-face|url\s*\(|(?:-webkit-)?image-set\s*\(|https?:|data:|blob:|\\/iu,
    );
  });

  it("keeps reviewed light and dark text, state, boundary, and focus pairs contrast compliant", () => {
    const pairs = [
      ["ink-primary", "surface-canvas", 4.5],
      ["ink-secondary", "surface-panel", 4.5],
      ["action-primary-ink", "action-primary", 4.5],
      ["ink-on-brand", "brand-deep", 4.5],
      ["ink-on-brand-secondary", "brand-deep", 4.5],
      ["ink-inverse", "state-error", 4.5],
      ["state-info", "state-info-surface", 4.5],
      ["state-success", "state-success-surface", 4.5],
      ["state-warning", "state-warning-surface", 4.5],
      ["state-error", "state-error-surface", 4.5],
      ["state-info", "surface-panel", 3],
      ["state-warning", "surface-panel", 3],
      ["state-error", "surface-panel", 3],
      ["line-strong", "surface-panel", 3],
      ["focus-ring", "surface-canvas", 3],
    ] as const;

    for (const [foregroundName, backgroundName, minimum] of pairs) {
      const foreground = tokenValues(foregroundName);
      const background = tokenValues(backgroundName);
      expect(foreground.length).toBeGreaterThanOrEqual(2);
      expect(background.length).toBeGreaterThanOrEqual(2);
      for (const index of [0, 1]) {
        expect(
          contrast(foreground[index] ?? "#000000", background[index] ?? "#ffffff"),
          `${foregroundName} on ${backgroundName} theme index ${index}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it("exposes visible non-color states for invalid, checked, mixed, disabled, busy, and alerts", () => {
    for (const selector of [
      '[aria-invalid="true"]',
      ":checked",
      '[data-state="mixed"]',
      ":disabled",
      '[data-state="loading"]',
      ".rvt-alert--error",
      ".rvt-state-pattern--error",
      ".rvt-state-pattern--offline",
      ".rvt-state-pattern--provider-unavailable",
    ]) {
      expect(styles).toContain(selector);
    }
  });

  it("keeps state patterns reflow-safe and their programmatic focus target visible", () => {
    for (const contract of [
      ".rvt-state-pattern__announcement",
      "grid-template-columns: auto minmax(0, 1fr)",
      "min-inline-size: 0",
      "flex-wrap: wrap",
      "overflow-wrap: anywhere",
      "width <= 24rem",
      ".rvt-state-pattern__title:focus",
    ]) {
      expect(styles).toContain(contract);
    }
  });

  it("keeps native selects at the reviewed minimum control height", () => {
    expect(styles).toMatch(
      /\.rvt-field__control--select\s*\{[^}]*block-size:\s*var\(--control-size-min\);[^}]*padding-block:\s*0;/u,
    );
  });

  it("mirrors directional controls from their computed direction, including nested overrides", () => {
    expect(styles).toContain(":where(.rvt-icon--back, .rvt-icon--forward):dir(rtl)");
    expect(styles).toContain(".rvt-switch__track:dir(rtl) .rvt-switch__thumb");
  });
});
