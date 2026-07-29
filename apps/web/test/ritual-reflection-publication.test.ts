import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import publicationSource from "../../../content/traditions/ritual/rituvia-ritual-reflection-library.en.v1.json";
import {
  indexableRitualReflectionPathnames,
  ritualReflectionGuideSlugs,
} from "../app/_i18n/ritual-reflection-public-routes";
import { indexablePublicPagePathnames, publicSitemapPathnames } from "../app/_i18n/public-routes";
import {
  parseRitualReflectionPublicationV1,
  ritualReflectionPublication,
} from "../server/ritual-reflection-publication";

const clone = <Value>(value: Value): Value => structuredClone(value);

describe("RIT-112 approved ritual and reflection publication", () => {
  it("pins the exact approved source catalog and candidate publication bytes", () => {
    const sourceDigest = createHash("sha256")
      .update(
        readFileSync(
          new URL(
            "../../../content/traditions/ritual/rituvia-original.en.v1.json",
            import.meta.url,
          ),
        ),
      )
      .digest("hex");
    const publicationDigest = createHash("sha256")
      .update(
        readFileSync(
          new URL(
            "../../../content/traditions/ritual/rituvia-ritual-reflection-library.en.v1.json",
            import.meta.url,
          ),
        ),
      )
      .digest("hex");

    expect(sourceDigest).toBe("a31e09b1f3ef2d905a77d3eee499d69ff82b5ed52e271a52b922a06b208b29aa");
    expect(publicationDigest).toBe(
      "f551a42c2e55847736539ff57a0a3fd46a987dfd388235412a8c7790c23409bf",
    );
    expect(ritualReflectionPublication.sourceCatalog.sha256).toBe(sourceDigest);
  });

  it("publishes exactly one hub and five unique guides", () => {
    expect(ritualReflectionGuideSlugs).toEqual([
      "virtual-candle-reflection",
      "virtual-incense-reflection",
      "intention-and-small-action",
      "private-reflection-journal",
      "revisit-a-reflection",
    ]);
    expect(indexableRitualReflectionPathnames).toHaveLength(6);
    expect(ritualReflectionPublication.guides).toHaveLength(5);
    expect(ritualReflectionPublication.publicationStatus).toBe("approved");
    expect(ritualReflectionPublication.publicationPolicy).toEqual({
      aiRetrievalAllowed: false,
      experiencePath: "/en/sanctuary",
      indexingAllowed: true,
      occasionDoorwayRoutesAllowed: false,
      personalizedResultsIndexable: false,
      physicalPracticeInstructionsAllowed: false,
      publicPublicationAllowed: true,
    });
    for (const pathname of indexableRitualReflectionPathnames) {
      expect(indexablePublicPagePathnames).toContain(pathname);
    }
    expect(publicSitemapPathnames).toContain("/sitemaps/en-rituals.xml");
  });

  it("binds both virtual guides to exact free, accessible, non-efficacious catalog templates", () => {
    const virtualGuides = ritualReflectionPublication.guides.filter(
      ({ kind }) => kind === "virtual_ritual",
    );
    expect(virtualGuides).toHaveLength(2);
    expect(virtualGuides.map(({ catalogBinding }) => catalogBinding?.itemCode)).toEqual([
      "free_candle",
      "free_incense",
    ]);
    for (const guide of virtualGuides) {
      expect(guide.catalogBinding).toMatchObject({
        itemVersion: "1.0.0",
        steps: ["prepare", "light", "breathe", "pause", "complete"],
        templateVersion: "1.0.0",
      });
      expect(guide.answer).toMatch(/virtual|digital/iu);
      expect(guide.limitations.join(" ")).toMatch(/does not|not a physical/iu);
    }
    expect(new Set(virtualGuides.map(({ answer }) => answer))).toHaveLength(2);
    expect(
      new Set(ritualReflectionPublication.guides.map(({ description }) => description)),
    ).toHaveLength(5);
  });

  it("keeps source catalog rights separate from candidate SEO editorial rights", () => {
    const catalog = ritualReflectionPublication.sources.find(
      ({ sourceId }) => sourceId === "rituvia.ritual.original-secular-catalog",
    );
    const editorial = ritualReflectionPublication.sources.find(
      ({ sourceId }) => sourceId === "rituvia.editorial.ritual-reflection-library",
    );
    expect(catalog?.rights).toEqual({
      allowedUses: ["factual_citation", "public_display"],
      evidenceReference: "D-047",
      status: "owned",
      territory: "worldwide",
    });
    expect(editorial?.rights).toEqual({
      allowedUses: ["public_display", "commercial_use", "seo_publication", "translation"],
      evidenceReference: "D-082",
      status: "owned",
      territory: "worldwide",
    });
    expect(ritualReflectionPublication.editorial).toMatchObject({
      approvalReference: "D-082",
      reviewerId: "owner",
      status: "approved",
    });
  });

  it("fails closed on approval, routes, source, efficacy, cultural, physical, and private drift", () => {
    for (const mutate of [
      (candidate: Record<string, unknown>) => {
        candidate.publicationStatus = "review_pending";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.publicationPolicy as Record<string, unknown>).indexingAllowed = false;
      },
      (candidate: Record<string, unknown>) => {
        (candidate.editorial as Record<string, unknown>).approvalReference = "D-081";
      },
      (candidate: Record<string, unknown>) => {
        (
          (candidate.guideRoutes as Array<Record<string, unknown>>).at(0) as Record<string, unknown>
        ).slug = "virtual-candle-love";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.sourceCatalog as Record<string, unknown>).sha256 = "0".repeat(64);
      },
      (candidate: Record<string, unknown>) => {
        (candidate.hub as Record<string, unknown>).answer =
          "This ritual will guarantee an external outcome.";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.hub as Record<string, unknown>).answer = "Follow this ancient ritual.";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.hub as Record<string, unknown>).answer = "Burn incense before continuing.";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.hub as Record<string, unknown>).privateQuestion = "private";
      },
    ]) {
      const candidate = clone(publicationSource) as unknown as Record<string, unknown>;
      mutate(candidate);
      expect(() => parseRitualReflectionPublicationV1(candidate)).toThrow(TypeError);
    }
  });
});
