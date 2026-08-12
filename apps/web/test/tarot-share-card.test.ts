import { pseudoLocalizeText } from "@rituvia/i18n/testing";
import { describe, expect, it } from "vitest";

import {
  createTarotShareCardProjection,
  createTarotShareCardText,
  serializeTarotShareCardSvg,
  type TarotShareCardProjection,
} from "../app/_components/tarot-share-card-artifact";

const approvedInput = Object.freeze({
  altText:
    "The Hermit, Upright. Reflection theme: Open reflection. Privacy-safe RITUVIA share card. Symbolic reflection, not a prediction.",
  boundary: "Symbolic reflection, not a prediction.",
  brandName: "RITUVIA",
  canonicalUrl: "https://example.test/en/tarot",
  cardTitle: "The Hermit",
  genericReflection: "A prompt to pause, notice, and choose one grounded next step.",
  includeTheme: true,
  locale: "en" as const,
  orientationLabel: "Upright",
  themeFieldLabel: "Reflection theme",
  themeLabel: "Open reflection",
});

describe("redacted Tarot share-card artifact", () => {
  it("projects only approved public fields and renders a self-contained accessible SVG", () => {
    const projection = createTarotShareCardProjection(approvedInput);

    expect(projection).toEqual({
      altText: approvedInput.altText,
      boundary: approvedInput.boundary,
      brandName: approvedInput.brandName,
      canonicalLabel: "example.test/en/tarot",
      canonicalUrl: "https://example.test/en/tarot",
      cardTitle: approvedInput.cardTitle,
      direction: "ltr",
      genericReflection: approvedInput.genericReflection,
      locale: "en",
      orientationLabel: approvedInput.orientationLabel,
      schemaVersion: "tarot-share-card.v1",
      theme: {
        label: approvedInput.themeFieldLabel,
        value: approvedInput.themeLabel,
      },
    });

    const svg = serializeTarotShareCardSvg(projection!);
    expect(svg).toContain("<title>The Hermit, Upright.");
    expect(svg).toContain("<desc>Symbolic reflection, not a prediction.</desc>");
    expect(svg).toContain('lang="en"');
    expect(svg).toContain('direction="ltr"');
    expect(svg).toContain("example.test/en/tarot");
    expect(svg).not.toMatch(/<(?:script|foreignObject|image)\b|(?:href|src)=/iu);
    expect(createTarotShareCardText(projection!)).toBe(
      `${approvedInput.altText}\nhttps://example.test/en/tarot`,
    );
  });

  it("removes the bounded theme from every generated surface when the user hides it", () => {
    const hiddenAltText =
      "The Hermit, Upright. Reflection theme hidden. Privacy-safe RITUVIA share card. Symbolic reflection, not a prediction.";
    const projection = createTarotShareCardProjection({
      ...approvedInput,
      altText: hiddenAltText,
      includeTheme: false,
    });
    const serialized = JSON.stringify(projection);
    const svg = serializeTarotShareCardSvg(projection!);
    const shareText = createTarotShareCardText(projection!);

    expect(projection?.theme).toBeNull();
    expect(serialized).not.toContain(approvedInput.themeLabel);
    expect(svg).not.toContain(approvedInput.themeLabel);
    expect(shareText).not.toContain(approvedInput.themeLabel);
    expect(svg).toContain("Reflection theme hidden.");
  });

  it("escapes reviewed display text instead of admitting executable SVG markup", () => {
    const projection = createTarotShareCardProjection({
      ...approvedInput,
      altText:
        "The <Lantern> & Mirror, Upright. Reflection theme: Open reflection. Privacy-safe RITUVIA share card. Symbolic reflection, not a prediction.",
      cardTitle: "The <Lantern> & Mirror",
    });
    const svg = serializeTarotShareCardSvg(projection!);

    expect(svg).toContain("The &lt;Lantern&gt; &amp; Mirror");
    expect(svg).not.toContain("<Lantern>");
  });

  it.each([
    ["en-XA", "ltr", "start"],
    ["ar-XB", "rtl", "end"],
  ] as const)(
    "exercises the serializer's test-only %s writing-system structure",
    (locale, direction, anchor) => {
      const productionProjection = createTarotShareCardProjection(approvedInput);
      expect(productionProjection).not.toBeNull();
      const localize = (value: string): string => pseudoLocalizeText(value, locale);
      const testProjection = {
        ...productionProjection!,
        altText: localize(productionProjection!.altText),
        boundary: localize(productionProjection!.boundary),
        cardTitle: localize(productionProjection!.cardTitle),
        direction,
        genericReflection: localize(productionProjection!.genericReflection),
        locale,
        orientationLabel: localize(productionProjection!.orientationLabel),
        theme: {
          label: localize(productionProjection!.theme!.label),
          value: localize(productionProjection!.theme!.value),
        },
      } as unknown as TarotShareCardProjection;
      const svg = serializeTarotShareCardSvg(testProjection);

      expect(svg).not.toBeNull();
      expect(svg).toContain(`lang="${locale}"`);
      expect(svg).toContain(`direction="${direction}"`);
      expect(svg).toContain(`text-anchor="${anchor}"`);
      expect(svg).not.toMatch(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u);
    },
  );

  it.each([
    ["pseudolocale", { locale: "en-XA" }],
    ["unlaunched RTL locale", { locale: "ar-XB" }],
    ["private result URL", { canonicalUrl: "https://example.test/en/tarot/one-card" }],
    ["query-bearing URL", { canonicalUrl: "https://example.test/en/tarot?reading=private" }],
    ["fragment-bearing URL", { canonicalUrl: "https://example.test/en/tarot#private" }],
    ["credential-bearing URL", { canonicalUrl: "https://user@example.test/en/tarot" }],
    ["control character", { cardTitle: "The\u202eHermit" }],
    ["unnormalized text", { cardTitle: "Cafe\u0301" }],
    ["oversized text", { cardTitle: "A".repeat(161) }],
  ])("fails closed for %s", (_label, override) => {
    expect(
      createTarotShareCardProjection({
        ...approvedInput,
        ...override,
      } as typeof approvedInput),
    ).toBeNull();
  });
});
