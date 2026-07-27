import {
  ritualLegacyDefinitionFor,
  type RitualCatalogV1,
  type LegacyReflectionRitualObjectCode,
} from "@rituvia/domain";
import { paidRitualObjectCodes } from "@rituvia/payments";
import { describe, expect, it } from "vitest";

import { GET, ritualObjectCatalogApiPath } from "../app/api/v1/ritual-objects/route";
import { getWebRitualCatalog } from "../server/ritual-catalog";

describe("ritual object catalog API", () => {
  it("returns the exact validated public catalog with bounded caching", async () => {
    const response = GET();

    expect(ritualObjectCatalogApiPath).toBe("/api/v1/ritual-objects");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=3600",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual(getWebRitualCatalog());
  });

  it("maps every historical paid object to one permanent production definition", () => {
    const catalog: RitualCatalogV1 = getWebRitualCatalog();
    const targets = paidRitualObjectCodes.map((legacyCode) =>
      ritualLegacyDefinitionFor(catalog, legacyCode as LegacyReflectionRitualObjectCode),
    );

    expect(targets.every((item) => item?.kind === "permanent_object")).toBe(true);
    expect(targets.map((item) => item?.code)).toEqual([
      "mindful_incense",
      "moonlit_lotus",
      "amethyst_guardian",
      "golden_bowl",
    ]);
    expect(JSON.stringify(catalog)).not.toMatch(
      /price|amountMinor|checkout|payment|efficacy|spiritual_power/iu,
    );
  });
});
