import { readFile } from "node:fs/promises";

import { questionIntakeThemeCodes } from "@rituvia/domain";
import { describe, expect, it } from "vitest";

import {
  assertTarotCatalogPublicationEligible,
  assessTarotCatalogPublication,
  parseTarotCatalogV1,
} from "../src/index.js";

const fixturePath = new URL(
  "../../../content/traditions/tarot/rituvia-original-reflection.v1.json",
  import.meta.url,
);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as unknown;

describe("RITUVIA original reflection catalog", () => {
  it("is an approved, rights-cleared, complete local MVP catalog", () => {
    const catalog = assertTarotCatalogPublicationEligible(fixture, "2026-07-18");

    expect(catalog.catalogId).toBe("rituvia.original-reflection-catalog");
    expect(catalog.editorial.approvalReference).toBe("OWN-010:rituvia-original-reflection.v1");
    expect(catalog.supportedThemeCodes).toEqual(questionIntakeThemeCodes);
    expect(catalog.decks).toHaveLength(1);
    expect(catalog.decks[0]?.cards).toHaveLength(3);
    expect(catalog.cardContents).toHaveLength(6);
    expect(
      catalog.cardContents.every(
        ({ culturalNotes, themeReadings }) =>
          culturalNotes.some((note) => note.includes("not presented as a historical")) &&
          themeReadings.length === questionIntakeThemeCodes.length,
      ),
    ).toBe(true);
    expect(assessTarotCatalogPublication(catalog, "2026-07-18")).toMatchObject({
      eligible: true,
      reasons: [],
    });
  });

  it("expires closed when its bounded editorial review window passes", () => {
    const catalog = parseTarotCatalogV1(fixture);

    expect(assessTarotCatalogPublication(catalog, "2027-07-19")).toMatchObject({
      eligible: false,
      reasons: ["REVIEW_EXPIRED"],
    });
  });
});
