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
const majorArcanaFixturePath = new URL(
  "../../../content/traditions/tarot/rituvia-major-arcana.v1.json",
  import.meta.url,
);
const majorArcanaFixtureText = await readFile(majorArcanaFixturePath, "utf8");
const majorArcanaFixture = JSON.parse(majorArcanaFixtureText) as unknown;

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

describe("RITUVIA Major Arcana catalog", () => {
  it("publishes the complete owner-directed 22-card RWS-ordered local catalog", () => {
    const catalog = assertTarotCatalogPublicationEligible(majorArcanaFixture, "2026-07-18");
    const cards = catalog.decks[0]?.cards;

    expect(catalog.catalogId).toBe("rituvia.major-arcana-catalog");
    expect(catalog.editorial.approvalReference).toBe("owner-directive:2026-07-18-major-arcana");
    expect(catalog.supportedThemeCodes).toEqual(questionIntakeThemeCodes);
    expect(catalog.decks).toHaveLength(1);
    expect(cards).toHaveLength(22);
    expect(cards?.map(({ cardId, title }) => ({ cardId, title }))).toEqual([
      { cardId: "arcana-00-the-fool", title: "The Fool" },
      { cardId: "arcana-01-the-magician", title: "The Magician" },
      { cardId: "arcana-02-the-high-priestess", title: "The High Priestess" },
      { cardId: "arcana-03-the-empress", title: "The Empress" },
      { cardId: "arcana-04-the-emperor", title: "The Emperor" },
      { cardId: "arcana-05-the-hierophant", title: "The Hierophant" },
      { cardId: "arcana-06-the-lovers", title: "The Lovers" },
      { cardId: "arcana-07-the-chariot", title: "The Chariot" },
      { cardId: "arcana-08-strength", title: "Strength" },
      { cardId: "arcana-09-the-hermit", title: "The Hermit" },
      { cardId: "arcana-10-wheel-of-fortune", title: "Wheel of Fortune" },
      { cardId: "arcana-11-justice", title: "Justice" },
      { cardId: "arcana-12-the-hanged-man", title: "The Hanged Man" },
      { cardId: "arcana-13-death", title: "Death" },
      { cardId: "arcana-14-temperance", title: "Temperance" },
      { cardId: "arcana-15-the-devil", title: "The Devil" },
      { cardId: "arcana-16-the-tower", title: "The Tower" },
      { cardId: "arcana-17-the-star", title: "The Star" },
      { cardId: "arcana-18-the-moon", title: "The Moon" },
      { cardId: "arcana-19-the-sun", title: "The Sun" },
      { cardId: "arcana-20-judgement", title: "Judgement" },
      { cardId: "arcana-21-the-world", title: "The World" },
    ]);
    expect(catalog.cardContents).toHaveLength(44);
    expect(
      catalog.cardContents.every(
        ({ culturalNotes, themeReadings }) =>
          culturalNotes.some((note) => note.includes("Strength is VIII and Justice is XI")) &&
          themeReadings.length === questionIntakeThemeCodes.length,
      ),
    ).toBe(true);
    expect(assessTarotCatalogPublication(catalog, "2026-07-18")).toMatchObject({
      eligible: true,
      reasons: [],
    });
  });

  it("expires closed when its bounded editorial review window passes", () => {
    const catalog = parseTarotCatalogV1(majorArcanaFixture);

    expect(assessTarotCatalogPublication(catalog, "2027-07-19")).toMatchObject({
      eligible: false,
      reasons: ["REVIEW_EXPIRED"],
    });
  });
});
