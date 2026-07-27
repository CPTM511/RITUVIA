import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  consumableRitualCodes,
  freeRitualCatalogItemCodes,
  parseRitualCatalogItemV1,
  parseRitualCatalogV1,
  parseRitualTemplateV1,
  permanentRitualObjectCodes,
  ritualCatalogItemDefinitionFor,
  ritualLegacyDefinitionFor,
  ritualPresentationEnhancements,
  ritualTemplateDefinitionFor,
} from "../src/index.js";

const source = JSON.parse(
  await readFile(
    new URL("../../../content/traditions/ritual/rituvia-original.en.v1.json", import.meta.url),
    "utf8",
  ),
) as unknown;
const catalog = parseRitualCatalogV1(source);

describe("ritual template and object domain", () => {
  it("publishes source-governed exact-version templates with accessible completion", () => {
    expect(catalog.templates).toHaveLength(8);
    expect(catalog.publications).toEqual([
      expect.objectContaining({
        approvalReference: "D-045",
        method: "rituvia_original_secular",
        rightsStatus: "owned",
        status: "approved",
      }),
    ]);
    for (const template of catalog.templates) {
      expect(template).toMatchObject({
        audioDefault: "off",
        completionMode: "reflective_acknowledgement",
        linearAlternative: true,
        reducedMotionMode: "static_equivalent",
        schemaVersion: "ritual-template.v1",
        version: "1.0.0",
      });
      expect(template.steps.at(0)).toBe("prepare");
      expect(template.steps.at(-1)).toBe("complete");
      expect(template.steps.some((step) => step === "breathe" || step === "pause")).toBe(true);
      expect(Object.isFrozen(template)).toBe(true);
      expect(Object.isFrozen(template.steps)).toBe(true);
    }
    expect(ritualTemplateDefinitionFor(catalog, "free-candle-pause", "1.0.0")).not.toBeNull();
    expect(ritualTemplateDefinitionFor(catalog, "free-candle-pause", "2.0.0")).toBeNull();
  });

  it("separates free, permanent, and consumable access without efficacy authority", () => {
    const freeItems = catalog.items.filter((item) => item.access.kind === "free");
    const permanentItems = catalog.items.filter(
      (item) => item.access.kind === "permanent_entitlement",
    );
    const consumableItems = catalog.items.filter((item) => item.access.kind === "consumable_pass");

    expect(freeItems.map((item) => item.code)).toEqual(freeRitualCatalogItemCodes);
    expect(permanentItems.map((item) => item.code)).toEqual(permanentRitualObjectCodes);
    expect(consumableItems.map((item) => item.code)).toEqual(consumableRitualCodes);
    expect(freeItems.every((item) => item.presentationEnhancements.length === 0)).toBe(true);
    for (const item of [...permanentItems, ...consumableItems]) {
      expect(item.presentationEnhancements.length).toBeGreaterThan(0);
      expect(
        item.presentationEnhancements.every((enhancement) =>
          ritualPresentationEnhancements.some((allowed) => allowed === enhancement),
        ),
      ).toBe(true);
      expect(item).toMatchObject({
        experienceScope: "symbolic_reflection_only",
        externalOutcome: "not_guaranteed",
      });
    }
  });

  it("maps legacy reflection codes explicitly without admitting them as new catalog codes", () => {
    expect(ritualLegacyDefinitionFor(catalog, "candle")?.code).toBe("free_candle");
    expect(ritualLegacyDefinitionFor(catalog, "incense")?.code).toBe("free_incense");
    expect(ritualLegacyDefinitionFor(catalog, "golden_intention_bowl")?.code).toBe("golden_bowl");
    expect(ritualCatalogItemDefinitionFor(catalog, "golden_bowl", "1.0.0")).not.toBeNull();
    expect(ritualCatalogItemDefinitionFor(catalog, "golden_bowl", "2.0.0")).toBeNull();
  });

  it.each([
    { ...catalog.items[0], efficacyClaim: "guaranteed result" },
    { ...catalog.items[0], price: 99 },
    { ...catalog.items[0], tradition: "unreviewed" },
    {
      ...catalog.items[2],
      presentationEnhancements: ["spiritual_power"],
    },
    {
      ...catalog.items[6],
      access: { kind: "permanent_entitlement", requirementCode: "permanent-object.guided_light" },
    },
  ])("rejects arbitrary claims, authority, and access-kind substitution", (value) => {
    expect(() => parseRitualCatalogItemV1(value)).toThrowError(
      expect.objectContaining({ code: "RITUAL_CATALOG_INVALID" }),
    );
  });

  it("rejects templates that omit accessible bounded completion", () => {
    const template = catalog.templates[0];
    expect(template).toBeDefined();
    expect(() =>
      parseRitualTemplateV1({
        ...template,
        steps: ["prepare", "light", "breathe"],
      }),
    ).toThrowError(expect.objectContaining({ code: "RITUAL_CATALOG_INVALID" }));
  });

  it("rejects catalogs with missing free parity or unresolved version references", () => {
    expect(() =>
      parseRitualCatalogV1({
        ...catalog,
        items: catalog.items.filter((item) => item.code !== "free_incense"),
      }),
    ).toThrowError(expect.objectContaining({ code: "RITUAL_CATALOG_INVALID" }));
    expect(() =>
      parseRitualCatalogV1({
        ...catalog,
        items: catalog.items.map((item) =>
          item.code === "free_candle"
            ? { ...item, template: { code: "free-candle-pause", version: "2.0.0" } }
            : item,
        ),
      }),
    ).toThrowError(expect.objectContaining({ code: "RITUAL_CATALOG_INVALID" }));
  });

  it("contains no free-form efficacy, certainty, protection, or payment authority", () => {
    expect(JSON.stringify(catalog)).not.toMatch(
      /price|creditCost|payment|checkout|efficacy|stronger|spiritual_power|curse/iu,
    );
  });
});
