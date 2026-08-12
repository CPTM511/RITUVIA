import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import publicationSource from "../../../content/traditions/tarot/rituvia-major-arcana-library.en.v1.json";
import {
  indexableTarotPathnames,
  tarotCardSlugs,
  tarotGuideSlugs,
  tarotSpreadSlugs,
} from "../app/_i18n/tarot-public-routes";
import { indexablePublicPagePathnames, publicSitemapPathnames } from "../app/_i18n/public-routes";
import {
  parseTarotLibraryPublicationV1,
  tarotLibraryPublication,
} from "../server/tarot-publication";

const clone = <Value>(value: Value): Value => structuredClone(value);

describe("RIT-111 approved Tarot library publication", () => {
  it("pins the exact source catalog and approved publication bytes", () => {
    const sourceDigest = createHash("sha256")
      .update(
        readFileSync(
          new URL(
            "../../../content/traditions/tarot/rituvia-major-arcana.v1.json",
            import.meta.url,
          ),
        ),
      )
      .digest("hex");
    const publicationDigest = createHash("sha256")
      .update(
        readFileSync(
          new URL(
            "../../../content/traditions/tarot/rituvia-major-arcana-library.en.v1.json",
            import.meta.url,
          ),
        ),
      )
      .digest("hex");

    expect(sourceDigest).toBe("412c8605631c0f8953b3b5864ac7428507c157a13a0f981c02684615ea6e39db");
    expect(publicationDigest).toBe(
      "15a1d9d5f5502ddf8c14543da06bc85813dc0b67cd7dae1cf9a0044ba72b8595",
    );
    expect(tarotLibraryPublication.sourceCatalog.sha256).toBe(sourceDigest);
  });

  it("publishes one finite hub, 22 card pages, and two spread guides", () => {
    expect(tarotCardSlugs).toHaveLength(22);
    expect(tarotSpreadSlugs).toEqual(["one-card-spread", "situation-action-possibility-spread"]);
    expect(tarotGuideSlugs).toHaveLength(24);
    expect(indexableTarotPathnames).toHaveLength(25);
    expect(tarotLibraryPublication.cards).toHaveLength(22);
    expect(tarotLibraryPublication.spreads).toHaveLength(2);
    expect(tarotLibraryPublication.publicationStatus).toBe("approved");
    expect(tarotLibraryPublication.publicationPolicy).toMatchObject({
      aiRetrievalAllowed: false,
      indexingAllowed: true,
      personalizedResultsIndexable: false,
      profileDoorwayRoutesAllowed: false,
      publicPublicationAllowed: true,
    });
    for (const pathname of indexableTarotPathnames) {
      expect(indexablePublicPagePathnames).toContain(pathname);
    }
    expect(publicSitemapPathnames).toContain("/sitemaps/en-tarot.xml");
  });

  it("binds every route to the exact card, both orientations, and a unique content core", () => {
    expect(
      tarotLibraryPublication.cards.map(({ card, slug }) => `${card.cardId}:${slug}`),
    ).toHaveLength(new Set(tarotLibraryPublication.cards.map(({ card }) => card.cardId)).size);
    expect(
      new Set(
        tarotLibraryPublication.cards.map(({ reversed, upright }) =>
          [...upright.coreThemes, ...reversed.coreThemes].join("|"),
        ),
      ),
    ).toHaveLength(22);
    for (const guide of tarotLibraryPublication.cards) {
      expect(guide.upright.orientation).toBe("upright");
      expect(guide.reversed.orientation).toBe("reversed");
      expect(guide.upright.cardId).toBe(guide.card.cardId);
      expect(guide.reversed.cardId).toBe(guide.card.cardId);
      expect(guide.upright.reflectionQuestions).toHaveLength(1);
      expect(guide.reversed.smallActions).toHaveLength(1);
      expect(guide.upright.cannotDetermine).toContain("does not determine");
    }
    expect(JSON.stringify(indexableTarotPathnames)).not.toMatch(
      /\/(?:upright|reversed|relationships|love|career|future|pregnancy)(?:\/|"|$)/u,
    );
  });

  it("keeps source catalog display rights separate from approved SEO editorial rights", () => {
    const sourceCatalog = tarotLibraryPublication.sources.find(
      ({ sourceId }) => sourceId === "rituvia.tarot.major-arcana-catalog",
    );
    const editorial = tarotLibraryPublication.sources.find(
      ({ sourceId }) => sourceId === "rituvia.editorial.tarot-library",
    );
    expect(sourceCatalog?.rights).toEqual({
      allowedUses: ["public_display", "commercial_use"],
      evidenceReference: "D-044",
      status: "owned",
      territory: "worldwide",
    });
    expect(editorial?.rights).toEqual({
      allowedUses: ["public_display", "commercial_use", "seo_publication", "translation"],
      evidenceReference: "D-081",
      status: "owned",
      territory: "worldwide",
    });
    expect(tarotLibraryPublication.editorial).toMatchObject({
      approvalReference: "D-081",
      reviewerId: "owner",
      status: "approved",
    });
  });

  it("fails closed on forged approval, route expansion, source drift, and prohibited claims", () => {
    for (const mutate of [
      (candidate: Record<string, unknown>) => {
        candidate.publicationStatus = "review_pending";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.publicationPolicy as Record<string, unknown>).indexingAllowed = false;
      },
      (candidate: Record<string, unknown>) => {
        (
          (candidate.cardRoutes as Array<Record<string, unknown>>).at(0) as Record<string, unknown>
        ).slug = "the-fool-love";
      },
      (candidate: Record<string, unknown>) => {
        (candidate.sourceCatalog as Record<string, unknown>).sha256 = "0".repeat(64);
      },
      (candidate: Record<string, unknown>) => {
        (candidate.hub as Record<string, unknown>).answer =
          "This card guarantees your destined future.";
      },
    ]) {
      const candidate = clone(publicationSource) as unknown as Record<string, unknown>;
      mutate(candidate);
      expect(() => parseTarotLibraryPublicationV1(candidate)).toThrow(TypeError);
    }
  });
});
