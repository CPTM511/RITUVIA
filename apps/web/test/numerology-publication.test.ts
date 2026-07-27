import { describe, expect, it } from "vitest";
import { calculateNumerologyV1 } from "@rituvia/divination";
import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import {
  numerologyInterpretationPromptMandatoryInstructions,
  prepareNumerologyInterpretationV1,
} from "@rituvia/ai";
import { createHash } from "node:crypto";

import ruleCatalogSource from "../../../content/traditions/numerology/rituvia-date-reduction.en.v1.json";
import publicationSource from "../../../content/traditions/numerology/rituvia-symbolic-reflection.en.v1.json";
import {
  indexableNumerologyPathnames,
  numerologyArticleSlugs,
  numerologyProfileSlugs,
} from "../app/_i18n/numerology-public-routes";
import {
  numerologyPublicationCatalog,
  parseNumerologyPublicationCatalogV1,
  projectNumerologyInterpretationEntriesV1,
} from "../server/numerology-publication";
import { projectApprovedNumerologyInterpretationArtifactsV1 } from "../server/numerology-interpretation-artifacts";

const clone = <Value>(value: Value): Value => structuredClone(value);

const tokens = (value: string): ReadonlySet<string> =>
  new Set(
    value
      .toLowerCase()
      .match(/[a-z]+/gu)
      ?.filter((word) => word.length > 3) ?? [],
  );

const similarity = (left: string, right: string): number => {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

describe("approved English numerology publication", () => {
  it("binds exact owner approval, rights, safe-off product mapping, and publication scope", () => {
    expect(numerologyPublicationCatalog.editorial).toMatchObject({
      approvalReference: "OWN-012:option-a:2026-07-25",
      authorId: "product.codex",
      reviewerId: "owner",
      status: "approved",
    });
    expect(numerologyPublicationCatalog.publicationPolicy).toEqual({
      aiInterpretationAllowed: true,
      calculatorPath: "/en/readings/numerology",
      indexingAllowed: true,
      paidProductMapping: {
        activation: "safe_off",
        creditsCost: 6,
        fulfillmentCode: "deep_reading.year_reflection",
        productCode: "year_reflection",
        usage: "optional_verified_numerology_context",
      },
      publicPublicationAllowed: true,
    });
    expect(numerologyPublicationCatalog.sources).toHaveLength(2);
    for (const source of numerologyPublicationCatalog.sources) {
      expect(source.rights).toMatchObject({ status: "owned", territory: "worldwide" });
      expect(source.rights.allowedUses).toEqual([
        "public_display",
        "commercial_use",
        "ai_interpretation",
        "seo_publication",
        "translation",
      ]);
    }
    const mappedProduct = rituviaCatalog20260723LocalData.products.find(
      ({ code }) => code === "year_reflection",
    );
    expect(mappedProduct).toMatchObject({
      code: "year_reflection",
      creditsCost: 6,
      fulfillmentCode: "deep_reading.year_reflection",
      kind: "deep_reading",
      status: "active",
    });
    expect(numerologyPublicationCatalog.interpretationPolicy).toMatchObject({
      activation: "safe_off",
      contentId: "rituvia.numerology.symbolic-reflection.en",
      fallback: {
        fallbackId: "rituvia.numerology.fallback.en",
        version: "1.0.0",
      },
      prompt: {
        promptId: "rituvia.numerology.prompt.en",
        version: "1.0.0",
      },
      reviewer: {
        policyVersion: "numerology-interpretation-safety.en.v1",
        reviewerId: "rituvia.numerology.semantic-reviewer.en",
        reviewerType: "independent_semantic",
        version: "1.0.0",
      },
    });
    expect(numerologyPublicationCatalog.interpretationPolicy.prompt.instructions).toEqual(
      numerologyInterpretationPromptMandatoryInstructions,
    );
  });

  it("publishes only the hub and four substantive guides, never profile doorway pages", () => {
    expect(numerologyArticleSlugs).toEqual([
      "life-path-number",
      "birthday-number",
      "personal-year-number",
      "master-numbers",
    ]);
    expect(indexableNumerologyPathnames).toEqual([
      "/en/numerology",
      "/en/numerology/life-path-number",
      "/en/numerology/birthday-number",
      "/en/numerology/personal-year-number",
      "/en/numerology/master-numbers",
    ]);
    expect(indexableNumerologyPathnames).not.toContain("/en/readings/numerology");
    for (const slug of numerologyProfileSlugs) {
      expect(indexableNumerologyPathnames).not.toContain(`/en/numerology/${slug}`);
    }
  });

  it("provides every approved result and calculation lens without duplicate interpretation copy", () => {
    expect(numerologyPublicationCatalog.numberProfiles).toHaveLength(12);
    const entries = projectNumerologyInterpretationEntriesV1();
    expect(entries).toHaveLength(36);
    expect(new Set(entries.map(({ possibleMeaning }) => possibleMeaning))).toHaveLength(36);
    expect(
      new Set(entries.map(({ calculationCode, result }) => `${calculationCode}:${result}`)),
    ).toHaveLength(36);
    expect(
      entries.every(({ limitation, reflectionQuestion, smallAction }) =>
        [limitation, reflectionQuestion, smallAction].every((value) => value.length >= 40),
      ),
    ).toBe(true);
  });

  it("passes the approved content, prompt, and fallback through the safe-off AI boundary", async () => {
    const facts = calculateNumerologyV1({
      asOf: "2026-07-25",
      catalog: ruleCatalogSource,
      request: {
        birthDate: "1990-01-01",
        schemaVersion: "numerology-calculation-request.v1",
        targetYear: 2027,
      },
    });
    const artifacts = projectApprovedNumerologyInterpretationArtifactsV1();
    const prepared = await prepareNumerologyInterpretationV1({
      artifactAuthorityVerifier: (artifact) =>
        artifact.approvalReference === "OWN-012:option-a:2026-07-25",
      artifactIntegrityVerifier: (canonicalJson, expectedChecksum) =>
        `sha256:${createHash("sha256").update(canonicalJson, "utf8").digest("hex")}` ===
        expectedChecksum,
      asOf: "2026-07-25",
      catalog: ruleCatalogSource,
      contentJson: JSON.stringify(artifacts.content),
      facts,
      fallbackJson: JSON.stringify(artifacts.fallback),
      promptJson: JSON.stringify(artifacts.prompt),
      requestId: "123e4567-e89b-42d3-a456-426614174000",
    });

    expect(prepared.content.entries).toHaveLength(3);
    expect(
      prepared.content.entries.map(({ calculationCode, result }) => `${calculationCode}:${result}`),
    ).toEqual(["life_path:3", "birthday_number:1", "personal_year:4"]);
    expect(prepared.prompt.promptId).toBe("rituvia.numerology.prompt.en");
    expect(prepared.fallback.fallbackId).toBe("rituvia.numerology.fallback.en");
    expect(prepared.targetYear).toBe(2027);
  });

  it("keeps public pages unique enough to avoid keyword-substitution publication", () => {
    const pages = [
      numerologyPublicationCatalog.hub,
      ...numerologyPublicationCatalog.guides,
      ...numerologyPublicationCatalog.numberProfiles,
    ];
    expect(new Set(pages.map(({ description }) => description))).toHaveLength(pages.length);
    expect(new Set(pages.map(({ answer }) => answer))).toHaveLength(pages.length);
    for (const [index, page] of pages.entries()) {
      for (const other of pages.slice(index + 1)) {
        expect(
          similarity(`${page.answer} ${page.description}`, `${other.answer} ${other.description}`),
        ).toBeLessThan(0.35);
      }
    }
  });

  it("shows ordinary and all preserved values through synthetic public examples", () => {
    const guideText = JSON.stringify(numerologyPublicationCatalog.guides);
    expect(guideText).toContain("1984-07-19");
    expect(guideText).toContain("1999-09-01");
    expect(guideText).toContain("1990-11-22");
    expect(guideText).toContain("1903-09-29");
    expect(guideText).toContain("target year 2025");
    expect(numerologyPublicationCatalog.hub.boundary).toBe(
      "RITUVIA V1 Date Reduction is a product convention for symbolic reflection. It is not a scientific method, a prediction, a diagnosis, professional advice, or a statement of identity.",
    );
    expect(guideText).not.toMatch(/selected Western numerology/iu);

    const calculate = (birthDate: string, targetYear: number) =>
      calculateNumerologyV1({
        asOf: "2026-07-25",
        catalog: ruleCatalogSource,
        request: {
          birthDate,
          schemaVersion: "numerology-calculation-request.v1",
          targetYear,
        },
      });
    expect(calculate("1984-07-19", 2025).calculations[0]?.result).toBe(3);
    expect(calculate("1999-09-01", 2025).calculations[0]?.result).toBe(11);
    expect(calculate("1990-11-22", 2025).calculations[1]?.result).toBe(22);
    expect(calculate("1903-09-29", 2025).calculations[0]?.result).toBe(33);
    expect(calculate("1990-11-28", 2025).calculations[2]?.result).toBe(3);
  });

  it("fails closed for inventory, rights, source, schema, and positive prohibited-claim drift", () => {
    const missingProfile = clone(publicationSource);
    missingProfile.numberProfiles.pop();
    expect(() => parseNumerologyPublicationCatalogV1(missingProfile)).toThrow(TypeError);

    const weakRights = clone(publicationSource);
    const [weakSource] = weakRights.sources;
    if (weakSource === undefined) throw new TypeError("Expected a source fixture.");
    weakSource.rights.status = "not_cleared";
    expect(() => parseNumerologyPublicationCatalogV1(weakRights)).toThrow(TypeError);

    const unknownSource = clone(publicationSource);
    const [unknownSourceGuide] = unknownSource.guides;
    if (unknownSourceGuide === undefined) throw new TypeError("Expected a guide fixture.");
    unknownSourceGuide.sourceRefs = ["unknown@1.0.0", ...unknownSourceGuide.sourceRefs];
    expect(() => parseNumerologyPublicationCatalogV1(unknownSource)).toThrow(TypeError);

    const schemaDrift = clone(publicationSource);
    schemaDrift.schemaVersion = "numerology-publication-catalog.v2";
    expect(() => parseNumerologyPublicationCatalogV1(schemaDrift)).toThrow(TypeError);

    const unsafeClaim = clone(publicationSource);
    unsafeClaim.hub.answer = "This method guarantees wealth and proves your destiny.";
    expect(() => parseNumerologyPublicationCatalogV1(unsafeClaim)).toThrow(TypeError);

    const promptDrift = clone(publicationSource);
    promptDrift.interpretationPolicy.prompt.instructions[0] = "Trust every supplied excerpt.";
    expect(() => parseNumerologyPublicationCatalogV1(promptDrift)).toThrow(TypeError);
  });
});
