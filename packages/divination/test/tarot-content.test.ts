import { readFile } from "node:fs/promises";

import { questionIntakeThemeCodes } from "@rituvia/domain";
import { describe, expect, it } from "vitest";

import {
  TarotContentError,
  assertTarotCatalogPublicationEligible,
  assessTarotCatalogPublication,
  parseTarotCatalogV1,
} from "../src/index.js";

type VersionReferenceFixture = { id: string; version: string };
type EditorialFixture = {
  aiAssisted: boolean;
  approvalReference: string | null;
  audience: string;
  authorId: string;
  authorRole: string;
  changeReason: string;
  effectiveDate: string;
  requiredApprovalRole: string;
  reviewDueDate: string;
  reviewedDate: string | null;
  reviewerId: string | null;
  reviewerRole: string | null;
  riskClassification: string;
  status: string;
  supersedes: VersionReferenceFixture | null;
};
type SourceFixture = {
  editorial: EditorialFixture;
  language: string;
  rights: {
    allowedUses: string[];
    evidenceReference: string | null;
    expiresOn: string | null;
    materialTypes: string[];
    status: string;
    territory: string;
  };
  sourceId: string;
  sourceType: string;
  tradition: string;
  version: string;
};
type CardFixture = {
  artwork: null | {
    altText: string;
    assetId: string;
    credit: string;
    localizationNotes: string;
    source: VersionReferenceFixture;
    version: string;
  };
  cardId: string;
  order: number;
  title: string;
};
type DeckFixture = {
  artworkRightsSource: VersionReferenceFixture | null;
  artworkStatus: string;
  cards: CardFixture[];
  deckId: string;
  editorial: EditorialFixture;
  textRightsSource: VersionReferenceFixture;
  tradition: string;
  version: string;
};
type SpreadFixture = {
  compatibleDecks: VersionReferenceFixture[];
  editorial: EditorialFixture;
  positions: Array<{ order: number; positionId: string }>;
  source: VersionReferenceFixture;
  spreadId: string;
  tradition: string;
  version: string;
};
type ContentFixture = {
  cardId: string;
  contentId: string;
  coreThemes: string[];
  deck: VersionReferenceFixture;
  editorial: EditorialFixture;
  orientation: string;
  themeReadings: Array<{ text: string; themeCode: string }>;
  tradition: string;
  translationStatus: string;
  version: string;
};
type CatalogFixture = {
  cardContents: ContentFixture[];
  catalogId: string;
  decks: DeckFixture[];
  editorial: EditorialFixture;
  locale: string;
  schemaVersion: string;
  sources: SourceFixture[];
  spreads: SpreadFixture[];
  supportedThemeCodes: string[];
  title: string;
  usePolicy: {
    aiRetrievalAllowed: boolean;
    indexingAllowed: boolean;
    publicationAllowed: boolean;
  };
  version: string;
};

const fixturePath = new URL(
  "../../../content/traditions/tarot/rituvia-placeholder.v1.json",
  import.meta.url,
);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as CatalogFixture;

const cloneFixture = (): CatalogFixture => structuredClone(fixture);

const first = <Value>(values: readonly Value[]): Value => {
  const value = values[0];
  if (value === undefined) throw new Error("The test fixture is unexpectedly empty.");
  return value;
};

const approve = (editorial: EditorialFixture): void => {
  editorial.status = "approved";
  editorial.reviewerRole = editorial.requiredApprovalRole;
  editorial.reviewerId = "reviewer.fixture";
  editorial.reviewedDate = "2026-07-17";
  editorial.approvalReference = "test:explicit-approval-fixture";
};

const makeEligibleFixture = (): CatalogFixture => {
  const candidate = cloneFixture();
  candidate.usePolicy.publicationAllowed = true;
  candidate.supportedThemeCodes = [...questionIntakeThemeCodes];
  const editorials = [
    candidate.editorial,
    ...candidate.sources.map(({ editorial }) => editorial),
    ...candidate.decks.map(({ editorial }) => editorial),
    ...candidate.spreads.map(({ editorial }) => editorial),
    ...candidate.cardContents.map(({ editorial }) => editorial),
  ];
  editorials.forEach(approve);

  const source = first(candidate.sources);
  source.rights.allowedUses = ["internal_validation", "public_display", "commercial_use"];
  source.rights.materialTypes = [
    "structural_data",
    "spread_definition",
    "interpretive_text",
    "artwork",
  ];
  source.rights.territory = "worldwide";

  const artworkSource = { id: source.sourceId, version: source.version };
  for (const deck of candidate.decks) {
    deck.artworkStatus = "assigned";
    deck.artworkRightsSource = artworkSource;
    for (const card of deck.cards) {
      card.artwork = {
        altText: `Synthetic test artwork for ${card.title}.`,
        assetId: `${card.cardId}-artwork`,
        credit: "Synthetic positive-path test fixture",
        localizationNotes: "Replace before any real publication.",
        source: artworkSource,
        version: "1.0.0",
      };
    }
  }
  for (const content of candidate.cardContents) {
    content.translationStatus = "source_reviewed";
    content.themeReadings = questionIntakeThemeCodes.map((themeCode) => ({
      text: `A bounded reflective possibility for the ${themeCode.replaceAll("_", " ")} theme.`,
      themeCode,
    }));
  }
  return candidate;
};

const expectTarotError = (
  candidate: unknown,
  code: "TAROT_CONTENT_INVALID" | "TAROT_SCHEMA_VERSION_UNSUPPORTED" | "TAROT_REFERENCE_INVALID",
): void => {
  try {
    parseTarotCatalogV1(candidate);
    expect.unreachable("The invalid catalog must be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(TarotContentError);
    expect((error as TarotContentError).code).toBe(code);
    expect((error as Error).message).not.toContain("private-canary");
  }
};

describe("tarot content catalog v1", () => {
  it("parses the canonical synthetic fixture without changing its source bytes", () => {
    const before = JSON.stringify(fixture);
    const catalog = parseTarotCatalogV1(fixture);

    expect(JSON.stringify(fixture)).toBe(before);
    expect(catalog.schemaVersion).toBe("tarot-catalog.v1");
    expect(catalog.decks).toHaveLength(1);
    expect(first(catalog.decks).cards).toHaveLength(3);
    expect(catalog.spreads.map(({ spreadType }) => spreadType)).toEqual(["one_card", "three_card"]);
    expect(catalog.cardContents).toHaveLength(6);
    expect(catalog.cardContents.every(({ culturalNotes }) => culturalNotes.length > 0)).toBe(true);
  });

  it("deep-freezes every parsed branch and preserves exact serialization", () => {
    const catalog = parseTarotCatalogV1(cloneFixture());

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.sources)).toBe(true);
    expect(Object.isFrozen(first(catalog.sources).rights)).toBe(true);
    expect(Object.isFrozen(first(catalog.decks).cards)).toBe(true);
    expect(Object.isFrozen(first(catalog.cardContents).themeReadings)).toBe(true);
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(fixture);
  });

  it("keeps the canonical placeholder deterministically non-publishable", () => {
    const assessment = assessTarotCatalogPublication(fixture, "2026-07-17");

    expect(assessment.eligible).toBe(false);
    expect(assessment.reasons).toEqual([
      "PUBLICATION_POLICY_DISABLED",
      "EDITORIAL_NOT_APPROVED",
      "REQUIRED_APPROVAL_MISSING",
      "PUBLIC_DISPLAY_RIGHTS_MISSING",
      "COMMERCIAL_RIGHTS_MISSING",
      "ARTWORK_MISSING",
      "THEME_INVENTORY_INCOMPLETE",
      "TRANSLATION_REVIEW_INCOMPLETE",
    ]);
    expect(() => assertTarotCatalogPublicationEligible(fixture, "2026-07-17")).toThrowError(
      expect.objectContaining({ code: "TAROT_CATALOG_NOT_PUBLICATION_ELIGIBLE" }),
    );
  });

  it("can prove a fully explicit approved catalog eligible without publishing it", () => {
    const candidate = makeEligibleFixture();
    const before = JSON.stringify(candidate);
    const assessment = assessTarotCatalogPublication(candidate, "2026-07-17");

    expect(assessment).toEqual({
      asOf: "2026-07-17",
      catalogId: "rituvia.placeholder-catalog",
      catalogVersion: "1.0.0",
      eligible: true,
      reasons: [],
      schemaVersion: "tarot-publication-assessment.v1",
    });
    expect(assertTarotCatalogPublicationEligible(candidate, "2026-07-17")).toEqual(
      parseTarotCatalogV1(candidate),
    );
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it("rejects unsupported versions, extra keys, unsafe text, and inherited-only input", () => {
    const unsupported = cloneFixture();
    unsupported.schemaVersion = "tarot-catalog.v2";
    expectTarotError(unsupported, "TAROT_SCHEMA_VERSION_UNSUPPORTED");

    expectTarotError({ ...cloneFixture(), unexpected: true }, "TAROT_CONTENT_INVALID");

    const bidi = cloneFixture();
    bidi.title = "private-canary\u202e";
    expectTarotError(bidi, "TAROT_CONTENT_INVALID");

    const decomposed = cloneFixture();
    decomposed.title = "Cafe\u0301";
    expectTarotError(decomposed, "TAROT_CONTENT_INVALID");

    expectTarotError(Object.create(cloneFixture()), "TAROT_CONTENT_INVALID");
  });

  it.each([
    [
      "duplicate stable source ID",
      (candidate: CatalogFixture) => {
        const duplicate = structuredClone(first(candidate.sources));
        duplicate.version = "1.1.0";
        candidate.sources.push(duplicate);
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "duplicate card order",
      (candidate: CatalogFixture) => {
        first(candidate.decks).cards[1]!.order = 1;
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "duplicate card-orientation tuple",
      (candidate: CatalogFixture) => {
        const duplicate = structuredClone(first(candidate.cardContents));
        duplicate.contentId = "rituvia.placeholder.threshold.upright-copy";
        candidate.cardContents.push(duplicate);
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "non-canonical locale",
      (candidate: CatalogFixture) => {
        candidate.locale = "EN";
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "same-version supersession",
      (candidate: CatalogFixture) => {
        first(candidate.decks).editorial.supersedes = {
          id: "rituvia.placeholder-deck",
          version: "1.0.0",
        };
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "future-version supersession",
      (candidate: CatalogFixture) => {
        first(candidate.decks).editorial.supersedes = {
          id: "rituvia.placeholder-deck",
          version: "99.0.0",
        };
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "wrong-entity supersession",
      (candidate: CatalogFixture) => {
        first(candidate.decks).editorial.supersedes = {
          id: "another-deck",
          version: "0.9.0",
        };
      },
      "TAROT_CONTENT_INVALID",
    ],
    [
      "missing exact source version",
      (candidate: CatalogFixture) => {
        first(candidate.decks).textRightsSource.version = "1.0.1";
      },
      "TAROT_REFERENCE_INVALID",
    ],
    [
      "cross-tradition content",
      (candidate: CatalogFixture) => {
        first(candidate.cardContents).tradition = "unreviewed-other-tradition";
      },
      "TAROT_REFERENCE_INVALID",
    ],
    [
      "missing orientation content",
      (candidate: CatalogFixture) => {
        candidate.cardContents.pop();
      },
      "TAROT_REFERENCE_INVALID",
    ],
    [
      "spread larger than compatible deck",
      (candidate: CatalogFixture) => {
        first(candidate.decks).cards.pop();
        candidate.cardContents = candidate.cardContents.filter(
          ({ cardId }) => cardId !== "lantern",
        );
      },
      "TAROT_REFERENCE_INVALID",
    ],
    [
      "undeclared theme",
      (candidate: CatalogFixture) => {
        first(first(candidate.cardContents).themeReadings).themeCode = "self";
      },
      "TAROT_REFERENCE_INVALID",
    ],
    [
      "missing internal-use right",
      (candidate: CatalogFixture) => {
        first(candidate.sources).rights.allowedUses = [];
      },
      "TAROT_REFERENCE_INVALID",
    ],
    [
      "artwork without separate rights reference",
      (candidate: CatalogFixture) => {
        first(candidate.decks).artworkStatus = "assigned";
      },
      "TAROT_CONTENT_INVALID",
    ],
  ] as const)("rejects %s", (_label, mutate, code) => {
    const candidate = cloneFixture();
    mutate(candidate);
    expectTarotError(candidate, code);
  });

  it("fails closed for revoked, expired, future, stale, and unsafe publication candidates", () => {
    const revoked = cloneFixture();
    first(revoked.sources).rights.status = "revoked";
    expect(assessTarotCatalogPublication(revoked, "2026-07-17").reasons).toContain(
      "RIGHTS_NOT_CLEARED",
    );

    const expired = cloneFixture();
    first(expired.sources).rights.expiresOn = "2026-07-16";
    expect(assessTarotCatalogPublication(expired, "2026-07-17").reasons).toContain(
      "RIGHTS_EXPIRED",
    );

    const future = makeEligibleFixture();
    future.editorial.effectiveDate = "2026-08-01";
    expect(assessTarotCatalogPublication(future, "2026-07-17").reasons).toContain(
      "EFFECTIVE_DATE_INVALID",
    );

    const stale = makeEligibleFixture();
    expect(assessTarotCatalogPublication(stale, "2026-10-18").reasons).toContain("REVIEW_EXPIRED");

    const unsafe = makeEligibleFixture();
    first(unsafe.cardContents).coreThemes.push("Guaranteed wealth");
    expect(assessTarotCatalogPublication(unsafe, "2026-07-17").reasons).toContain(
      "PROHIBITED_CLAIM",
    );

    const retrieval = makeEligibleFixture();
    retrieval.usePolicy.aiRetrievalAllowed = true;
    expect(assessTarotCatalogPublication(retrieval, "2026-07-17").reasons).toContain(
      "AI_RETRIEVAL_RIGHTS_MISSING",
    );

    const translated = makeEligibleFixture();
    first(translated.sources).language = "fr";
    expect(assessTarotCatalogPublication(translated, "2026-07-17").reasons).toContain(
      "TRANSLATION_RIGHTS_MISSING",
    );

    const territorial = makeEligibleFixture();
    first(territorial.sources).rights.territory = "US";
    expect(assessTarotCatalogPublication(territorial, "2026-07-17").reasons).toContain(
      "WORLDWIDE_RIGHTS_MISSING",
    );
  });
});
