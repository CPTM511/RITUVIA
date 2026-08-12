import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import publicationSource from "../../../content/traditions/astrology/rituvia-western-natal-education.en.v1.json";
import {
  astrologyGuideSlugs,
  indexableAstrologyPathnames,
} from "../app/_i18n/astrology-public-routes";
import { indexablePublicPagePathnames } from "../app/_i18n/public-routes";
import {
  astrologyPublicationCatalog,
  parseAstrologyPublicationCatalogV1,
} from "../server/astrology-publication";

const clone = <Value>(value: Value): Value => structuredClone(value);

const tokens = (value: string): ReadonlySet<string> =>
  new Set(
    value
      .toLowerCase()
      .match(/[a-z]+/gu)
      ?.filter((word) => word.length > 4) ?? [],
  );

const similarity = (left: string, right: string): number => {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

describe("RIT-096 approved astrology education publication", () => {
  it("pins the exact approved publication bytes", () => {
    const digest = createHash("sha256")
      .update(
        readFileSync(
          new URL(
            "../../../content/traditions/astrology/rituvia-western-natal-education.en.v1.json",
            import.meta.url,
          ),
        ),
      )
      .digest("hex");
    expect(digest).toBe("a27ca9b9a6fa6881353ff49c9acce0992bce094d3a53353013efaa2978a16504");
  });

  it("binds exact owner approval and the finite production crawl inventory", () => {
    expect(astrologyPublicationCatalog.editorial).toMatchObject({
      approvalReference: "OWN-016:option-a:2026-07-27",
      authorId: "product.codex",
      requiredApprovalRole: "owner",
      reviewedDate: "2026-07-27",
      reviewerId: "owner",
      status: "approved",
    });
    expect(astrologyPublicationCatalog.publicationPolicy).toEqual({
      calculatorPath: "/en/readings/astrology",
      indexingAllowed: true,
      personalizedPagesIndexable: false,
      profileDoorwayRoutesAllowed: false,
      publicPublicationAllowed: true,
    });
    expect(indexableAstrologyPathnames).toEqual([
      "/en/astrology",
      "/en/astrology/natal-chart-calculation",
      "/en/astrology/birth-time-uncertainty",
      "/en/astrology/houses-and-major-aspects",
      "/en/astrology/sources-and-methodology",
    ]);
    for (const pathname of indexableAstrologyPathnames) {
      expect(indexablePublicPagePathnames).toContain(pathname);
    }
  });

  it("publishes only four substantive method guides and no sign or personality doorway pages", () => {
    expect(astrologyGuideSlugs).toEqual([
      "natal-chart-calculation",
      "birth-time-uncertainty",
      "houses-and-major-aspects",
      "sources-and-methodology",
    ]);
    expect(astrologyPublicationCatalog.guides).toHaveLength(4);
    expect(
      astrologyPublicationCatalog.guides.every(
        ({ answer, limitations, sections, sourceRefs, table }) =>
          answer.length >= 100 &&
          limitations.length === 3 &&
          sections.length === 2 &&
          sections.every(
            ({ bullets, paragraphs }) => bullets.length >= 3 && paragraphs.length >= 1,
          ) &&
          sourceRefs.length >= 2 &&
          table.rows.length >= 3,
      ),
    ).toBe(true);
    expect(JSON.stringify(indexableAstrologyPathnames)).not.toMatch(
      /\/(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)(?:\/|"|$)/u,
    );
  });

  it("binds the exact D-070 uncertainty, house, body, and aspect method", () => {
    const calculation = astrologyPublicationCatalog.guides.at(0);
    const uncertainty = astrologyPublicationCatalog.guides.at(1);
    const geometry = astrologyPublicationCatalog.guides.at(2);
    const methodology = astrologyPublicationCatalog.guides.at(3);

    expect(calculation?.sections.at(1)?.bullets.at(0)).toContain(
      "Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, and the True Node",
    );
    expect(uncertainty?.table.rows).toEqual([
      [
        "Exact",
        "Placements, Placidus houses, angles, and approved aspects when calculation succeeds",
        "Any fact absent from the versioned natal schema",
      ],
      [
        "Approximate",
        "Planetary placements at the supplied center instant and the exact approximation window",
        "Houses, angles, and aspects",
      ],
      [
        "Unknown",
        "An explicit unavailable state",
        "Placements, houses, angles, aspects, and any invented substitute time",
      ],
      [
        "Engine or house failure",
        "An explicit unavailable state with bounded recovery guidance",
        "All partial astronomical facts and automatic fallback systems",
      ],
    ]);
    expect(geometry?.table.rows).toEqual([
      ["Conjunction", "0 degrees", "8 degrees"],
      ["Sextile", "60 degrees", "4 degrees"],
      ["Square", "90 degrees", "6 degrees"],
      ["Trine", "120 degrees", "6 degrees"],
      ["Opposition", "180 degrees", "8 degrees"],
    ]);
    expect(methodology?.table.rows.map((row) => row.at(1))).toEqual([
      "rituvia-western-natal.v1",
      "rituvia-major-aspects.v1",
      "Swiss Ephemeris 2.10.03",
      "v2.10.3final",
      "AGPL-3.0-only",
    ]);
  });

  it("keeps source rights distinct and never treats reference-only material as reusable copy", () => {
    expect(astrologyPublicationCatalog.sources).toHaveLength(5);
    const swiss = astrologyPublicationCatalog.sources.find(
      ({ sourceId }) => sourceId === "swiss-ephemeris.programming-reference",
    );
    const editorial = astrologyPublicationCatalog.sources.find(
      ({ sourceId }) => sourceId === "rituvia.editorial.astrology-education",
    );
    expect(swiss?.rights).toEqual({
      allowedUses: ["factual_citation"],
      evidenceReference: "content/sources/astrology/swiss-ephemeris-agpl.v2.json",
      status: "reference_only",
      territory: "worldwide",
    });
    expect(editorial?.rights).toEqual({
      allowedUses: ["public_display", "commercial_use", "seo_publication", "translation"],
      evidenceReference: "D-073",
      status: "owned",
      territory: "worldwide",
    });
    expect(
      astrologyPublicationCatalog.guides.flatMap(({ sourceRefs }) => sourceRefs),
    ).not.toContain("rituvia.editorial.astrology-education@1.0.0");
  });

  it("keeps every guide distinct enough to avoid keyword-substitution publication", () => {
    const pages = astrologyPublicationCatalog.guides.map((guide) =>
      [
        guide.title,
        guide.answer,
        ...guide.sections.flatMap(({ bullets, heading, paragraphs }) => [
          heading,
          ...paragraphs,
          ...bullets,
        ]),
        ...guide.limitations,
        ...guide.table.rows.flat(),
      ].join(" "),
    );
    for (let leftIndex = 0; leftIndex < pages.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < pages.length; rightIndex += 1) {
        expect(similarity(pages.at(leftIndex) ?? "", pages.at(rightIndex) ?? "")).toBeLessThan(
          0.34,
        );
      }
    }
  });

  it("fails closed on approval forgery, scope expansion, source drift, and prohibited claims", () => {
    for (const mutate of [
      (candidate: Record<string, unknown>) => {
        (candidate.editorial as Record<string, unknown>).status = "review_pending";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.publicationPolicy as Record<string, unknown>).indexingAllowed = false;
      },
      (candidate: Record<string, unknown>) => {
        (
          (candidate.guides as Array<Record<string, unknown>>).at(0) as Record<string, unknown>
        ).slug = "aries-personality";
      },
      (candidate: Record<string, unknown>) => {
        (
          ((candidate.sources as Array<Record<string, unknown>>).at(4) as Record<string, unknown>)
            .rights as Record<string, unknown>
        ).allowedUses = ["internal_review"];
      },
      (candidate: Record<string, unknown>) => {
        (
          (candidate.guides as Array<Record<string, unknown>>).at(0) as Record<string, unknown>
        ).answer = "This chart guarantees your destined future.";
      },
    ]) {
      const candidate = clone(publicationSource) as unknown as Record<string, unknown>;
      mutate(candidate);
      expect(() => parseAstrologyPublicationCatalogV1(candidate)).toThrow(TypeError);
    }
  });
});
