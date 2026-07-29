import "server-only";

import { createBrandConfiguration } from "@rituvia/config/brand";
import {
  parseTarotCatalogV1,
  type TarotCardContentV1,
  type TarotCardV1,
  type TarotSpreadV1,
} from "@rituvia/divination";

import sourceCatalog from "../../../content/traditions/tarot/rituvia-major-arcana.v1.json";
import publicationSource from "../../../content/traditions/tarot/rituvia-major-arcana-library.en.v1.json";
import {
  tarotCardSlugs,
  tarotSpreadSlugs,
  type TarotCardSlug,
  type TarotGuideSlug,
  type TarotSpreadSlug,
} from "../app/_i18n/tarot-public-routes";

type UnknownRecord = Record<string, unknown>;
const publicationPublisher = createBrandConfiguration().name;

type TarotLibraryEditorialV1 = Readonly<{
  approvalReference: "D-081";
  authorId: "product.codex";
  changeReason: string;
  effectiveDate: "2026-07-28";
  requiredApprovalRole: "owner";
  reviewDueDate: "2027-07-28";
  reviewedDate: "2026-07-28";
  reviewerId: "owner";
  reviewerRole: "owner";
  status: "approved";
  supersedes: null;
}>;

export type TarotLibrarySourceV1 = Readonly<{
  claims: readonly string[];
  creator: string;
  identifier: string;
  publisher: string;
  rights: Readonly<{
    allowedUses: readonly string[];
    evidenceReference: "D-044" | "D-081";
    status: "owned";
    territory: "worldwide";
  }>;
  sourceId: "rituvia.editorial.tarot-library" | "rituvia.tarot.major-arcana-catalog";
  sourceType: "approved_product_catalog" | "original_editorial";
  title: string;
  version: "1.0.0";
}>;

type TarotLibraryCardRouteV1 = Readonly<{
  cardId: string;
  number: string;
  slug: TarotCardSlug;
  symbol: string;
}>;

type TarotLibrarySpreadRouteV1 = Readonly<{
  answer: string;
  description: string;
  limitations: readonly [string, string, string];
  reflectionQuestions: readonly [string, string];
  slug: TarotSpreadSlug;
  spreadId: string;
  steps: readonly [string, string, string, string];
  title: string;
}>;

export type TarotLibraryCardV1 = Readonly<{
  altText: string;
  card: TarotCardV1;
  description: string;
  kind: "card";
  nextSlug: TarotCardSlug;
  number: string;
  previousSlug: TarotCardSlug;
  reversed: TarotCardContentV1;
  slug: TarotCardSlug;
  sourceRefs: readonly ["rituvia.tarot.major-arcana-catalog@1.0.0"];
  symbol: string;
  title: string;
  upright: TarotCardContentV1;
}>;

export type TarotLibrarySpreadV1 = Readonly<{
  answer: string;
  description: string;
  kind: "spread";
  limitations: readonly [string, string, string];
  reflectionQuestions: readonly [string, string];
  slug: TarotSpreadSlug;
  sourceRefs: readonly [
    "rituvia.tarot.major-arcana-catalog@1.0.0",
    "rituvia.editorial.tarot-library@1.0.0",
  ];
  spread: TarotSpreadV1;
  steps: readonly [string, string, string, string];
  title: string;
}>;

export type TarotLibraryGuideV1 = TarotLibraryCardV1 | TarotLibrarySpreadV1;

type TarotLibraryLabelsV1 = Readonly<{
  actionTitle: string;
  aiAssistanceTitle: string;
  aiAssistanceValue: string;
  backToHub: string;
  cardEyebrow: string;
  cardListTitle: string;
  limitsTitle: string;
  nextCard: string;
  pendingReviewValue: string;
  positionsTitle: string;
  possibilityTitle: string;
  previousCard: string;
  questionTitle: string;
  readingAction: string;
  relatedTitle: string;
  reviewDueTitle: string;
  reviewedDateTitle: string;
  reversedTitle: string;
  safetyAction: string;
  sourceTitle: string;
  spreadEyebrow: string;
  spreadListTitle: string;
  stepsTitle: string;
  tensionTitle: string;
  themesTitle: string;
  uprightTitle: string;
}>;

export type TarotLibraryPublicationV1 = Readonly<{
  audience: "adults";
  cards: readonly TarotLibraryCardV1[];
  catalogId: "rituvia.tarot.major-arcana-library.en";
  contentType: "tarot_library_publication";
  editorial: TarotLibraryEditorialV1;
  hub: Readonly<{
    answer: string;
    boundary: string;
    description: string;
    eyebrow: string;
    sourceNote: string;
    title: string;
  }>;
  labels: TarotLibraryLabelsV1;
  locale: "en";
  method: "tarot";
  publicationPolicy: Readonly<{
    aiRetrievalAllowed: false;
    indexingAllowed: true;
    personalizedResultsIndexable: false;
    profileDoorwayRoutesAllowed: false;
    publicPublicationAllowed: true;
    readingPath: "/en/tarot/one-card";
  }>;
  publicationStatus: "approved";
  riskClassification: "sensitive_symbolic_education";
  schemaVersion: "tarot-library-publication.v1";
  sources: readonly TarotLibrarySourceV1[];
  sourceCatalog: Readonly<{
    catalogId: "rituvia.major-arcana-catalog";
    sha256: "412c8605631c0f8953b3b5864ac7428507c157a13a0f981c02684615ea6e39db";
    version: "1.0.0";
  }>;
  spreads: readonly TarotLibrarySpreadV1[];
  title: string;
  version: "1.0.0";
}>;

const prohibitedClaims =
  /\b(?:(?:guarantees?|predicts?|diagnoses?|cures?) your|destined (?:future|outcome)|will definitely happen)\b/iu;

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("The Tarot library publication contract requires an object.");
  }
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) {
    throw new TypeError("The Tarot library publication contract has unexpected fields.");
  }
};

const text = (value: unknown, maximum = 2_400): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value.trim() !== value ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u.test(value) ||
    /<[^>]*>/u.test(value)
  ) {
    throw new TypeError("The Tarot library publication contract contains unsafe text.");
  }
  return value;
};

const safeEditorialText = (value: unknown, maximum = 2_400): string => {
  const parsed = text(value, maximum);
  if (prohibitedClaims.test(parsed)) {
    throw new TypeError("The Tarot library publication contract contains a prohibited claim.");
  }
  return parsed;
};

const literal = <Value extends string | boolean | null>(value: unknown, expected: Value): Value => {
  if (value !== expected) {
    throw new TypeError("The Tarot library publication contract contains an invalid literal.");
  }
  return expected;
};

const textArray = (value: unknown, minimum: number, maximum: number): readonly string[] => {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TypeError("The Tarot library publication contract contains an invalid text list.");
  }
  return Object.freeze(value.map((item) => safeEditorialText(item)));
};

const fixedTuple = <Length extends 2 | 3 | 4>(
  value: unknown,
  length: Length,
): Length extends 2
  ? readonly [string, string]
  : Length extends 3
    ? readonly [string, string, string]
    : readonly [string, string, string, string] => {
  const values = textArray(value, length, length);
  if (values.length !== length) throw new TypeError("The Tarot library tuple is incomplete.");
  return Object.freeze([...values]) as never;
};

const parseEditorial = (value: unknown): TarotLibraryEditorialV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "approvalReference",
    "authorId",
    "changeReason",
    "effectiveDate",
    "requiredApprovalRole",
    "reviewDueDate",
    "reviewedDate",
    "reviewerId",
    "reviewerRole",
    "status",
    "supersedes",
  ]);
  return Object.freeze({
    approvalReference: literal(candidate.approvalReference, "D-081"),
    authorId: literal(candidate.authorId, "product.codex"),
    changeReason: safeEditorialText(candidate.changeReason),
    effectiveDate: literal(candidate.effectiveDate, "2026-07-28"),
    requiredApprovalRole: literal(candidate.requiredApprovalRole, "owner"),
    reviewDueDate: literal(candidate.reviewDueDate, "2027-07-28"),
    reviewedDate: literal(candidate.reviewedDate, "2026-07-28"),
    reviewerId: literal(candidate.reviewerId, "owner"),
    reviewerRole: literal(candidate.reviewerRole, "owner"),
    status: literal(candidate.status, "approved"),
    supersedes: literal(candidate.supersedes, null),
  });
};

const parseSource = (value: unknown): TarotLibrarySourceV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "claims",
    "creator",
    "identifier",
    "publisher",
    "rights",
    "sourceId",
    "sourceType",
    "title",
    "version",
  ]);
  const sourceId = text(candidate.sourceId);
  if (
    sourceId !== "rituvia.tarot.major-arcana-catalog" &&
    sourceId !== "rituvia.editorial.tarot-library"
  ) {
    throw new TypeError("The Tarot library source is not approved.");
  }
  const sourceType = text(candidate.sourceType);
  if (sourceType !== "approved_product_catalog" && sourceType !== "original_editorial") {
    throw new TypeError("The Tarot library source type is invalid.");
  }
  const rights = record(candidate.rights);
  exactKeys(rights, ["allowedUses", "evidenceReference", "status", "territory"]);
  const allowedUses = textArray(rights.allowedUses, 2, 4);
  const expectedUses =
    sourceId === "rituvia.editorial.tarot-library"
      ? ["public_display", "commercial_use", "seo_publication", "translation"]
      : ["public_display", "commercial_use"];
  if (allowedUses.join("\u0000") !== expectedUses.join("\u0000")) {
    throw new TypeError("The Tarot library source rights are invalid.");
  }
  return Object.freeze({
    claims: textArray(candidate.claims, 3, 3),
    creator: text(candidate.creator),
    identifier: text(candidate.identifier),
    publisher: literal(candidate.publisher, publicationPublisher),
    rights: Object.freeze({
      allowedUses,
      evidenceReference:
        sourceId === "rituvia.editorial.tarot-library"
          ? literal(rights.evidenceReference, "D-081")
          : literal(rights.evidenceReference, "D-044"),
      status: literal(rights.status, "owned"),
      territory: literal(rights.territory, "worldwide"),
    }),
    sourceId,
    sourceType,
    title: text(candidate.title),
    version: literal(candidate.version, "1.0.0"),
  });
};

const parseCardRoutes = (value: unknown): readonly TarotLibraryCardRouteV1[] => {
  if (!Array.isArray(value) || value.length !== tarotCardSlugs.length) {
    throw new TypeError("The Tarot library requires the exact 22-card route inventory.");
  }
  const routes = value.map((item) => {
    const candidate = record(item);
    exactKeys(candidate, ["cardId", "number", "slug", "symbol"]);
    const slug = text(candidate.slug);
    if (!tarotCardSlugs.some((allowed) => allowed === slug)) {
      throw new TypeError("The Tarot library card slug is invalid.");
    }
    return Object.freeze({
      cardId: text(candidate.cardId),
      number: text(candidate.number, 8),
      slug: slug as TarotCardSlug,
      symbol: text(candidate.symbol, 8),
    });
  });
  if (
    new Set(routes.map(({ cardId }) => cardId)).size !== routes.length ||
    new Set(routes.map(({ slug }) => slug)).size !== routes.length
  ) {
    throw new TypeError("The Tarot library card routes must be unique.");
  }
  return Object.freeze(routes);
};

const parseSpreadRoutes = (value: unknown): readonly TarotLibrarySpreadRouteV1[] => {
  if (!Array.isArray(value) || value.length !== tarotSpreadSlugs.length) {
    throw new TypeError("The Tarot library requires the exact spread route inventory.");
  }
  const routes = value.map((item) => {
    const candidate = record(item);
    exactKeys(candidate, [
      "answer",
      "description",
      "limitations",
      "reflectionQuestions",
      "slug",
      "spreadId",
      "steps",
      "title",
    ]);
    const slug = text(candidate.slug);
    if (!tarotSpreadSlugs.some((allowed) => allowed === slug)) {
      throw new TypeError("The Tarot library spread slug is invalid.");
    }
    return Object.freeze({
      answer: safeEditorialText(candidate.answer),
      description: safeEditorialText(candidate.description, 320),
      limitations: fixedTuple(candidate.limitations, 3),
      reflectionQuestions: fixedTuple(candidate.reflectionQuestions, 2),
      slug: slug as TarotSpreadSlug,
      spreadId: text(candidate.spreadId),
      steps: fixedTuple(candidate.steps, 4),
      title: safeEditorialText(candidate.title, 140),
    });
  });
  if (
    new Set(routes.map(({ spreadId }) => spreadId)).size !== routes.length ||
    new Set(routes.map(({ slug }) => slug)).size !== routes.length
  ) {
    throw new TypeError("The Tarot library spread routes must be unique.");
  }
  return Object.freeze(routes);
};

const exactTextRecord = (value: unknown, expected: readonly string[]): UnknownRecord => {
  const candidate = record(value);
  exactKeys(candidate, expected);
  return candidate;
};

const parseHub = (value: unknown): TarotLibraryPublicationV1["hub"] => {
  const candidate = exactTextRecord(value, [
    "answer",
    "boundary",
    "description",
    "eyebrow",
    "sourceNote",
    "title",
  ]);
  return Object.freeze({
    answer: safeEditorialText(candidate.answer),
    boundary: safeEditorialText(candidate.boundary),
    description: safeEditorialText(candidate.description),
    eyebrow: safeEditorialText(candidate.eyebrow),
    sourceNote: safeEditorialText(candidate.sourceNote),
    title: safeEditorialText(candidate.title),
  });
};

const parseLabels = (value: unknown): TarotLibraryLabelsV1 => {
  const candidate = exactTextRecord(value, [
    "actionTitle",
    "aiAssistanceTitle",
    "aiAssistanceValue",
    "backToHub",
    "cardEyebrow",
    "cardListTitle",
    "limitsTitle",
    "nextCard",
    "pendingReviewValue",
    "positionsTitle",
    "possibilityTitle",
    "previousCard",
    "questionTitle",
    "readingAction",
    "relatedTitle",
    "reviewDueTitle",
    "reviewedDateTitle",
    "reversedTitle",
    "safetyAction",
    "sourceTitle",
    "spreadEyebrow",
    "spreadListTitle",
    "stepsTitle",
    "tensionTitle",
    "themesTitle",
    "uprightTitle",
  ]);
  return Object.freeze({
    actionTitle: safeEditorialText(candidate.actionTitle),
    aiAssistanceTitle: safeEditorialText(candidate.aiAssistanceTitle),
    aiAssistanceValue: safeEditorialText(candidate.aiAssistanceValue),
    backToHub: safeEditorialText(candidate.backToHub),
    cardEyebrow: safeEditorialText(candidate.cardEyebrow),
    cardListTitle: safeEditorialText(candidate.cardListTitle),
    limitsTitle: safeEditorialText(candidate.limitsTitle),
    nextCard: safeEditorialText(candidate.nextCard),
    pendingReviewValue: safeEditorialText(candidate.pendingReviewValue),
    positionsTitle: safeEditorialText(candidate.positionsTitle),
    possibilityTitle: safeEditorialText(candidate.possibilityTitle),
    previousCard: safeEditorialText(candidate.previousCard),
    questionTitle: safeEditorialText(candidate.questionTitle),
    readingAction: safeEditorialText(candidate.readingAction),
    relatedTitle: safeEditorialText(candidate.relatedTitle),
    reviewDueTitle: safeEditorialText(candidate.reviewDueTitle),
    reviewedDateTitle: safeEditorialText(candidate.reviewedDateTitle),
    reversedTitle: safeEditorialText(candidate.reversedTitle),
    safetyAction: safeEditorialText(candidate.safetyAction),
    sourceTitle: safeEditorialText(candidate.sourceTitle),
    spreadEyebrow: safeEditorialText(candidate.spreadEyebrow),
    spreadListTitle: safeEditorialText(candidate.spreadListTitle),
    stepsTitle: safeEditorialText(candidate.stepsTitle),
    tensionTitle: safeEditorialText(candidate.tensionTitle),
    themesTitle: safeEditorialText(candidate.themesTitle),
    uprightTitle: safeEditorialText(candidate.uprightTitle),
  });
};

const contentFor = (
  cardId: string,
  orientation: "reversed" | "upright",
  source: ReturnType<typeof parseTarotCatalogV1>,
): TarotCardContentV1 => {
  const content = source.cardContents.find(
    (candidate) => candidate.cardId === cardId && candidate.orientation === orientation,
  );
  if (content === undefined) {
    throw new TypeError("The Tarot library source orientation is unavailable.");
  }
  return content;
};

export const parseTarotLibraryPublicationV1 = (value: unknown): TarotLibraryPublicationV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "audience",
    "cardRoutes",
    "catalogId",
    "contentType",
    "editorial",
    "hub",
    "labels",
    "locale",
    "method",
    "publicationPolicy",
    "publicationStatus",
    "riskClassification",
    "schemaVersion",
    "sourceCatalog",
    "sources",
    "spreadRoutes",
    "title",
    "version",
  ]);
  const catalog = parseTarotCatalogV1(sourceCatalog);
  const sourceReference = record(candidate.sourceCatalog);
  exactKeys(sourceReference, ["catalogId", "sha256", "version"]);
  literal(sourceReference.catalogId, "rituvia.major-arcana-catalog");
  literal(sourceReference.version, "1.0.0");
  literal(
    sourceReference.sha256,
    "412c8605631c0f8953b3b5864ac7428507c157a13a0f981c02684615ea6e39db",
  );
  if (
    catalog.catalogId !== sourceReference.catalogId ||
    catalog.version !== sourceReference.version ||
    catalog.decks.length !== 1 ||
    catalog.decks.at(0)?.cards.length !== tarotCardSlugs.length ||
    catalog.cardContents.length !== tarotCardSlugs.length * 2
  ) {
    throw new TypeError("The Tarot library source catalog is not the approved exact inventory.");
  }

  const cardRoutes = parseCardRoutes(candidate.cardRoutes);
  const deck = catalog.decks.at(0);
  if (deck === undefined) throw new TypeError("The Tarot library source deck is unavailable.");
  const cards = Object.freeze(
    cardRoutes.map((route, index): TarotLibraryCardV1 => {
      const card = deck.cards.find((candidateCard) => candidateCard.cardId === route.cardId);
      if (card === undefined || card.order !== index + 1 || card.artwork === null) {
        throw new TypeError("The Tarot library card route does not match the source deck.");
      }
      const sourceSymbol = card.artwork.credit.split(" ").at(-1);
      if (sourceSymbol !== route.symbol) {
        throw new TypeError("The Tarot library symbol does not match the approved source.");
      }
      const previous = cardRoutes.at(index === 0 ? cardRoutes.length - 1 : index - 1);
      const next = cardRoutes.at(index === cardRoutes.length - 1 ? 0 : index + 1);
      if (previous === undefined || next === undefined) {
        throw new TypeError("The Tarot library related-card graph is incomplete.");
      }
      const upright = contentFor(route.cardId, "upright", catalog);
      const reversed = contentFor(route.cardId, "reversed", catalog);
      return Object.freeze({
        altText: card.artwork.altText,
        card,
        description: `${card.title} upright and reversed meanings for symbolic reflection, with themes, questions, actions, and explicit limits.`,
        kind: "card",
        nextSlug: next.slug,
        number: route.number,
        previousSlug: previous.slug,
        reversed,
        slug: route.slug,
        sourceRefs: Object.freeze(["rituvia.tarot.major-arcana-catalog@1.0.0"] as const),
        symbol: route.symbol,
        title: `${card.title} Tarot meaning`,
        upright,
      });
    }),
  );

  const spreadRoutes = parseSpreadRoutes(candidate.spreadRoutes);
  const spreads = Object.freeze(
    spreadRoutes.map((route): TarotLibrarySpreadV1 => {
      const spread = catalog.spreads.find(
        (candidateSpread) => candidateSpread.spreadId === route.spreadId,
      );
      if (spread === undefined) {
        throw new TypeError("The Tarot library spread route does not match the source catalog.");
      }
      return Object.freeze({
        ...route,
        kind: "spread",
        sourceRefs: Object.freeze([
          "rituvia.tarot.major-arcana-catalog@1.0.0",
          "rituvia.editorial.tarot-library@1.0.0",
        ] as const),
        spread,
      });
    }),
  );

  const publicationPolicy = record(candidate.publicationPolicy);
  exactKeys(publicationPolicy, [
    "aiRetrievalAllowed",
    "indexingAllowed",
    "personalizedResultsIndexable",
    "profileDoorwayRoutesAllowed",
    "publicPublicationAllowed",
    "readingPath",
  ]);
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== 2) {
    throw new TypeError("The Tarot library requires the exact source inventory.");
  }

  return Object.freeze({
    audience: literal(candidate.audience, "adults"),
    cards,
    catalogId: literal(candidate.catalogId, "rituvia.tarot.major-arcana-library.en"),
    contentType: literal(candidate.contentType, "tarot_library_publication"),
    editorial: parseEditorial(candidate.editorial),
    hub: parseHub(candidate.hub),
    labels: parseLabels(candidate.labels),
    locale: literal(candidate.locale, "en"),
    method: literal(candidate.method, "tarot"),
    publicationPolicy: Object.freeze({
      aiRetrievalAllowed: literal(publicationPolicy.aiRetrievalAllowed, false),
      indexingAllowed: literal(publicationPolicy.indexingAllowed, true),
      personalizedResultsIndexable: literal(publicationPolicy.personalizedResultsIndexable, false),
      profileDoorwayRoutesAllowed: literal(publicationPolicy.profileDoorwayRoutesAllowed, false),
      publicPublicationAllowed: literal(publicationPolicy.publicPublicationAllowed, true),
      readingPath: literal(publicationPolicy.readingPath, "/en/tarot/one-card"),
    }),
    publicationStatus: literal(candidate.publicationStatus, "approved"),
    riskClassification: literal(candidate.riskClassification, "sensitive_symbolic_education"),
    schemaVersion: literal(candidate.schemaVersion, "tarot-library-publication.v1"),
    sources: Object.freeze(candidate.sources.map(parseSource)),
    sourceCatalog: Object.freeze({
      catalogId: "rituvia.major-arcana-catalog",
      sha256: "412c8605631c0f8953b3b5864ac7428507c157a13a0f981c02684615ea6e39db",
      version: "1.0.0",
    }),
    spreads,
    title: safeEditorialText(candidate.title, 140),
    version: literal(candidate.version, "1.0.0"),
  });
};

export const tarotLibraryPublication = parseTarotLibraryPublicationV1(publicationSource);

export const getTarotLibraryGuide = (slug: TarotGuideSlug): TarotLibraryGuideV1 => {
  const guide = [...tarotLibraryPublication.cards, ...tarotLibraryPublication.spreads].find(
    (candidate) => candidate.slug === slug,
  );
  if (guide === undefined) throw new TypeError("The Tarot library guide is unavailable.");
  return guide;
};

export const getTarotLibrarySourceLabel = (reference: string): string => {
  const [sourceId, version] = reference.split("@");
  const source = tarotLibraryPublication.sources.find(
    (candidate) => candidate.sourceId === sourceId && candidate.version === version,
  );
  if (source === undefined) throw new TypeError("The Tarot library source is unavailable.");
  return `${source.title}, version ${source.version}`;
};
