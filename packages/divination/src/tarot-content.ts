import { questionIntakeThemeCodes, type QuestionIntakeThemeCode } from "@rituvia/domain";

declare const tarotValueBrand: unique symbol;

type Branded<Value, Brand extends string> = Value & {
  readonly [tarotValueBrand]: Brand;
};

type TarotIdentifier = Branded<string, "TarotIdentifier">;
type TarotVersion = Branded<string, "TarotVersion">;
type TarotLocale = Branded<string, "TarotLocale">;
type TarotDate = Branded<string, "TarotDate">;

export const tarotCatalogSchemaVersion = "tarot-catalog.v1" as const;

export const tarotOrientations = Object.freeze(["upright", "reversed"] as const);
export type TarotOrientation = (typeof tarotOrientations)[number];

export const tarotEditorialStatuses = Object.freeze([
  "draft",
  "source_checked",
  "cultural_review",
  "safety_review",
  "translation_ready",
  "localized_review",
  "approved",
  "published",
  "deprecated",
  "archived",
] as const);
export type TarotEditorialStatus = (typeof tarotEditorialStatuses)[number];

export const tarotRightsStatuses = Object.freeze([
  "owned",
  "licensed",
  "public_domain",
  "not_cleared",
  "pending",
  "revoked",
] as const);
export type TarotRightsStatus = (typeof tarotRightsStatuses)[number];

export const tarotRiskClassifications = Object.freeze(["low", "moderate", "high"] as const);
export type TarotRiskClassification = (typeof tarotRiskClassifications)[number];

export const tarotAllowedUses = Object.freeze([
  "internal_validation",
  "public_display",
  "commercial_use",
  "derivative_use",
  "translation",
  "ai_retrieval",
] as const);
export type TarotAllowedUse = (typeof tarotAllowedUses)[number];

export const tarotMaterialTypes = Object.freeze([
  "structural_data",
  "spread_definition",
  "interpretive_text",
  "artwork",
  "cultural_reference",
] as const);
export type TarotMaterialType = (typeof tarotMaterialTypes)[number];

export const tarotSourceTypes = Object.freeze([
  "original",
  "licensed",
  "public_domain",
  "reference",
] as const);
export type TarotSourceType = (typeof tarotSourceTypes)[number];

export const tarotTranslationStatuses = Object.freeze([
  "source_draft",
  "source_reviewed",
  "translation_ready",
  "localized_reviewed",
] as const);
export type TarotTranslationStatus = (typeof tarotTranslationStatuses)[number];

export const tarotContentErrorCodes = Object.freeze([
  "TAROT_CONTENT_INVALID",
  "TAROT_SCHEMA_VERSION_UNSUPPORTED",
  "TAROT_REFERENCE_INVALID",
  "TAROT_CATALOG_NOT_PUBLICATION_ELIGIBLE",
] as const);
export type TarotContentErrorCode = (typeof tarotContentErrorCodes)[number];

const tarotContentErrorMessage = (code: TarotContentErrorCode): string => {
  switch (code) {
    case "TAROT_CONTENT_INVALID":
      return "The tarot content contract is invalid.";
    case "TAROT_SCHEMA_VERSION_UNSUPPORTED":
      return "The tarot content schema version is unsupported.";
    case "TAROT_REFERENCE_INVALID":
      return "The tarot content reference graph is invalid.";
    case "TAROT_CATALOG_NOT_PUBLICATION_ELIGIBLE":
      return "The tarot catalog is not structurally eligible for publication.";
  }
};

export class TarotContentError extends Error {
  readonly code: TarotContentErrorCode;

  constructor(code: TarotContentErrorCode) {
    super(tarotContentErrorMessage(code));
    this.name = "TarotContentError";
    this.code = code;
  }
}

export type TarotVersionReference = Readonly<{
  id: TarotIdentifier;
  version: TarotVersion;
}>;

export type TarotEditorialMetadataV1 = Readonly<{
  aiAssisted: boolean;
  approvalReference: string | null;
  audience: string;
  authorId: TarotIdentifier;
  authorRole: TarotIdentifier;
  changeReason: string;
  effectiveDate: TarotDate;
  requiredApprovalRole: TarotIdentifier;
  reviewDueDate: TarotDate;
  reviewedDate: TarotDate | null;
  reviewerId: TarotIdentifier | null;
  reviewerRole: TarotIdentifier | null;
  riskClassification: TarotRiskClassification;
  status: TarotEditorialStatus;
  supersedes: TarotVersionReference | null;
}>;

type TarotRightsV1 = Readonly<{
  allowedUses: readonly TarotAllowedUse[];
  attributionRequired: boolean;
  attributionText: string | null;
  evidenceReference: string | null;
  expiresOn: TarotDate | null;
  licenseIdentifier: string | null;
  materialTypes: readonly TarotMaterialType[];
  status: TarotRightsStatus;
  territory: string;
  version: TarotVersion;
}>;

type TarotSourceClaimV1 = Readonly<{
  claim: string;
  support: string;
}>;

export type TarotSourceRecordV1 = Readonly<{
  claims: readonly TarotSourceClaimV1[];
  creator: string;
  editor: string | null;
  editorial: TarotEditorialMetadataV1;
  geography: string;
  identifier: string | null;
  knownDisagreements: readonly string[];
  language: TarotLocale;
  publicationDate: TarotDate | null;
  publisher: string;
  rights: TarotRightsV1;
  sourceId: TarotIdentifier;
  sourceType: TarotSourceType;
  title: string;
  tradition: string;
  version: TarotVersion;
}>;

export type TarotCardV1 = Readonly<{
  alternativeTitles: readonly string[];
  artwork: Readonly<{
    altText: string;
    assetId: TarotIdentifier;
    credit: string;
    localizationNotes: string;
    source: TarotVersionReference;
    version: TarotVersion;
  }> | null;
  cardId: TarotIdentifier;
  order: number;
  title: string;
  traditionalTitle: string | null;
}>;

export type TarotDeckV1 = Readonly<{
  artworkRightsSource: TarotVersionReference | null;
  artworkStatus: "none" | "assigned";
  cards: readonly TarotCardV1[];
  contentType: "tarot_deck";
  deckId: TarotIdentifier;
  editorial: TarotEditorialMetadataV1;
  locale: TarotLocale;
  method: "tarot";
  supportedOrientations: readonly TarotOrientation[];
  textRightsSource: TarotVersionReference;
  title: string;
  tradition: string;
  version: TarotVersion;
}>;

type TarotSpreadPositionV1 = Readonly<{
  description: string;
  order: number;
  positionId: TarotIdentifier;
  title: string;
}>;

export type TarotSpreadV1 = Readonly<{
  compatibleDecks: readonly TarotVersionReference[];
  contentType: "tarot_spread";
  description: string;
  editorial: TarotEditorialMetadataV1;
  locale: TarotLocale;
  method: "tarot";
  positions: readonly TarotSpreadPositionV1[];
  source: TarotVersionReference;
  spreadId: TarotIdentifier;
  spreadType: "one_card" | "three_card" | "other";
  title: string;
  tradition: string;
  version: TarotVersion;
}>;

type TarotVisualSymbolV1 = Readonly<{
  altText: string;
  credit: string;
  description: string;
  localizationNotes: string;
  source: TarotVersionReference;
}>;

type TarotThemeReadingV1 = Readonly<{
  text: string;
  themeCode: QuestionIntakeThemeCode;
}>;

export type TarotCardContentV1 = Readonly<{
  alternativeTitles: readonly string[];
  cannotDetermine: string;
  cardId: TarotIdentifier;
  constructivePossibilities: readonly string[];
  contentType: "tarot_card_orientation";
  contentId: TarotIdentifier;
  coreThemes: readonly string[];
  culturalNotes: readonly string[];
  deck: TarotVersionReference;
  editorial: TarotEditorialMetadataV1;
  locale: TarotLocale;
  method: "tarot";
  orientation: TarotOrientation;
  reflectionQuestions: readonly string[];
  smallActions: readonly string[];
  sources: readonly TarotVersionReference[];
  tensions: readonly string[];
  themeReadings: readonly TarotThemeReadingV1[];
  tradition: string;
  translationStatus: TarotTranslationStatus;
  version: TarotVersion;
  visualSymbols: readonly TarotVisualSymbolV1[];
}>;

export type TarotCatalogV1 = Readonly<{
  cardContents: readonly TarotCardContentV1[];
  catalogId: TarotIdentifier;
  contentType: "tarot_catalog";
  decks: readonly TarotDeckV1[];
  editorial: TarotEditorialMetadataV1;
  locale: TarotLocale;
  schemaVersion: typeof tarotCatalogSchemaVersion;
  sources: readonly TarotSourceRecordV1[];
  spreads: readonly TarotSpreadV1[];
  supportedThemeCodes: readonly QuestionIntakeThemeCode[];
  title: string;
  usePolicy: Readonly<{
    aiRetrievalAllowed: boolean;
    indexingAllowed: boolean;
    publicationAllowed: boolean;
  }>;
  version: TarotVersion;
}>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  return actual === [...expected].sort().join("\u0000");
};

function invalidContent(): never {
  throw new TarotContentError("TAROT_CONTENT_INVALID");
}

function invalidReference(): never {
  throw new TarotContentError("TAROT_REFERENCE_INVALID");
}

const hiddenOrControlCharacters =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;

const parseText = (value: unknown, maximumLength: number): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    value.normalize("NFC") !== value ||
    hiddenOrControlCharacters.test(value)
  ) {
    invalidContent();
  }
  return value;
};

const parseNullableText = (value: unknown, maximumLength: number): string | null =>
  value === null ? null : parseText(value, maximumLength);

const parseIdentifier = (value: unknown): TarotIdentifier => {
  const parsed = parseText(value, 100);
  if (!identifierPattern.test(parsed)) invalidContent();
  return parsed as TarotIdentifier;
};

const parseVersion = (value: unknown): TarotVersion => {
  if (typeof value !== "string" || !versionPattern.test(value)) invalidContent();
  return value as TarotVersion;
};

const parseLocale = (value: unknown): TarotLocale => {
  if (typeof value !== "string" || value.length > 35) invalidContent();
  try {
    if (new Intl.Locale(value).toString() !== value) invalidContent();
  } catch {
    invalidContent();
  }
  return value as TarotLocale;
};

const parseDate = (value: unknown): TarotDate => {
  if (typeof value !== "string" || !datePattern.test(value)) invalidContent();
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    invalidContent();
  }
  return value as TarotDate;
};

const parseNullableDate = (value: unknown): TarotDate | null =>
  value === null ? null : parseDate(value);

export const parseTarotAsOfDate = (value: unknown): TarotDate => parseDate(value);

const included = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.some((candidate) => candidate === value);

const parseInteger = (value: unknown, minimum: number, maximum: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalidContent();
  }
  return value as number;
};

const parseList = <Value>(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
  parser: (item: unknown) => Value,
): readonly Value[] => {
  if (!Array.isArray(value) || value.length < minimumLength || value.length > maximumLength) {
    invalidContent();
  }
  return Object.freeze(value.map((item) => parser(item)));
};

const parseTextList = (
  value: unknown,
  minimumLength: number,
  maximumLength: number,
  maximumItemLength = 300,
): readonly string[] => {
  const parsed = parseList(value, minimumLength, maximumLength, (item) =>
    parseText(item, maximumItemLength),
  );
  if (new Set(parsed).size !== parsed.length) invalidContent();
  return parsed;
};

const parseVersionReference = (value: unknown): TarotVersionReference => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["id", "version"])) invalidContent();
  return Object.freeze({
    id: parseIdentifier(candidate.id),
    version: parseVersion(candidate.version),
  });
};

const parseEditorial = (value: unknown): TarotEditorialMetadataV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "aiAssisted",
      "approvalReference",
      "audience",
      "authorId",
      "authorRole",
      "changeReason",
      "effectiveDate",
      "requiredApprovalRole",
      "reviewDueDate",
      "reviewedDate",
      "reviewerId",
      "reviewerRole",
      "riskClassification",
      "status",
      "supersedes",
    ]) ||
    typeof candidate.aiAssisted !== "boolean" ||
    !included(tarotEditorialStatuses, candidate.status) ||
    !included(tarotRiskClassifications, candidate.riskClassification)
  ) {
    invalidContent();
  }
  const effectiveDate = parseDate(candidate.effectiveDate);
  const reviewDueDate = parseDate(candidate.reviewDueDate);
  const reviewerRole =
    candidate.reviewerRole === null ? null : parseIdentifier(candidate.reviewerRole);
  const reviewerId = candidate.reviewerId === null ? null : parseIdentifier(candidate.reviewerId);
  const reviewedDate = parseNullableDate(candidate.reviewedDate);
  const approvalReference = parseNullableText(candidate.approvalReference, 500);
  if (
    reviewDueDate < effectiveDate ||
    (reviewerRole === null) !== (reviewedDate === null) ||
    (reviewerRole === null) !== (reviewerId === null) ||
    (reviewerRole === null) !== (approvalReference === null) ||
    ((candidate.status === "approved" || candidate.status === "published") && reviewerRole === null)
  ) {
    invalidContent();
  }
  return Object.freeze({
    aiAssisted: candidate.aiAssisted,
    approvalReference,
    audience: parseText(candidate.audience, 200),
    authorId: parseIdentifier(candidate.authorId),
    authorRole: parseIdentifier(candidate.authorRole),
    changeReason: parseText(candidate.changeReason, 500),
    effectiveDate,
    requiredApprovalRole: parseIdentifier(candidate.requiredApprovalRole),
    reviewDueDate,
    reviewedDate,
    reviewerId,
    reviewerRole,
    riskClassification: candidate.riskClassification,
    status: candidate.status,
    supersedes: candidate.supersedes === null ? null : parseVersionReference(candidate.supersedes),
  });
};

const parseRights = (value: unknown): TarotRightsV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "allowedUses",
      "attributionRequired",
      "attributionText",
      "evidenceReference",
      "expiresOn",
      "licenseIdentifier",
      "materialTypes",
      "status",
      "territory",
      "version",
    ]) ||
    !included(tarotRightsStatuses, candidate.status) ||
    typeof candidate.attributionRequired !== "boolean"
  ) {
    invalidContent();
  }
  const allowedUses = parseList(candidate.allowedUses, 0, tarotAllowedUses.length, (item) => {
    if (!included(tarotAllowedUses, item)) invalidContent();
    return item;
  });
  if (new Set(allowedUses).size !== allowedUses.length) invalidContent();
  const materialTypes = parseList(candidate.materialTypes, 1, tarotMaterialTypes.length, (item) => {
    if (!included(tarotMaterialTypes, item)) invalidContent();
    return item;
  });
  if (new Set(materialTypes).size !== materialTypes.length) invalidContent();
  const licenseIdentifier = parseNullableText(candidate.licenseIdentifier, 200);
  const attributionText = parseNullableText(candidate.attributionText, 500);
  if (
    (candidate.status === "licensed" || candidate.status === "public_domain") &&
    licenseIdentifier === null
  ) {
    invalidContent();
  }
  if (
    (candidate.attributionRequired && attributionText === null) ||
    (!candidate.attributionRequired && attributionText !== null)
  ) {
    invalidContent();
  }
  return Object.freeze({
    allowedUses,
    attributionRequired: candidate.attributionRequired,
    attributionText,
    evidenceReference: parseNullableText(candidate.evidenceReference, 500),
    expiresOn: parseNullableDate(candidate.expiresOn),
    licenseIdentifier,
    materialTypes,
    status: candidate.status,
    territory: parseText(candidate.territory, 100),
    version: parseVersion(candidate.version),
  });
};

const parseSourceClaim = (value: unknown): TarotSourceClaimV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["claim", "support"])) invalidContent();
  return Object.freeze({
    claim: parseText(candidate.claim, 500),
    support: parseText(candidate.support, 1_000),
  });
};

const parseSource = (value: unknown): TarotSourceRecordV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "claims",
      "creator",
      "editor",
      "editorial",
      "geography",
      "identifier",
      "knownDisagreements",
      "language",
      "publicationDate",
      "publisher",
      "rights",
      "sourceId",
      "sourceType",
      "title",
      "tradition",
      "version",
    ]) ||
    !included(tarotSourceTypes, candidate.sourceType)
  ) {
    invalidContent();
  }
  const rights = parseRights(candidate.rights);
  if (
    (candidate.sourceType === "original" &&
      rights.status !== "owned" &&
      rights.status !== "not_cleared" &&
      rights.status !== "pending" &&
      rights.status !== "revoked") ||
    (candidate.sourceType === "licensed" &&
      rights.status !== "licensed" &&
      rights.status !== "not_cleared" &&
      rights.status !== "pending" &&
      rights.status !== "revoked") ||
    (candidate.sourceType === "public_domain" &&
      rights.status !== "public_domain" &&
      rights.status !== "not_cleared" &&
      rights.status !== "pending" &&
      rights.status !== "revoked")
  ) {
    invalidContent();
  }
  return Object.freeze({
    claims: parseList(candidate.claims, 0, 100, parseSourceClaim),
    creator: parseText(candidate.creator, 200),
    editor: parseNullableText(candidate.editor, 200),
    editorial: parseEditorial(candidate.editorial),
    geography: parseText(candidate.geography, 100),
    identifier: parseNullableText(candidate.identifier, 300),
    knownDisagreements: parseTextList(candidate.knownDisagreements, 0, 20, 1_000),
    language: parseLocale(candidate.language),
    publicationDate: parseNullableDate(candidate.publicationDate),
    publisher: parseText(candidate.publisher, 200),
    rights,
    sourceId: parseIdentifier(candidate.sourceId),
    sourceType: candidate.sourceType,
    title: parseText(candidate.title, 300),
    tradition: parseText(candidate.tradition, 200),
    version: parseVersion(candidate.version),
  });
};

const parseCard = (value: unknown): TarotCardV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "alternativeTitles",
      "artwork",
      "cardId",
      "order",
      "title",
      "traditionalTitle",
    ])
  ) {
    invalidContent();
  }
  return Object.freeze({
    alternativeTitles: parseTextList(candidate.alternativeTitles, 0, 20, 200),
    artwork: parseArtwork(candidate.artwork),
    cardId: parseIdentifier(candidate.cardId),
    order: parseInteger(candidate.order, 1, 200),
    title: parseText(candidate.title, 200),
    traditionalTitle: parseNullableText(candidate.traditionalTitle, 200),
  });
};

const parseArtwork = (value: unknown): NonNullable<TarotCardV1["artwork"]> | null => {
  if (value === null) return null;
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "altText",
      "assetId",
      "credit",
      "localizationNotes",
      "source",
      "version",
    ])
  ) {
    invalidContent();
  }
  return Object.freeze({
    altText: parseText(candidate.altText, 500),
    assetId: parseIdentifier(candidate.assetId),
    credit: parseText(candidate.credit, 300),
    localizationNotes: parseText(candidate.localizationNotes, 500),
    source: parseVersionReference(candidate.source),
    version: parseVersion(candidate.version),
  });
};

const hasUniqueContiguousOrder = (values: readonly { readonly order: number }[]): boolean => {
  const orders = values.map(({ order }) => order);
  return (
    new Set(orders).size === orders.length &&
    [...orders].sort((a, b) => a - b).every((order, index) => order === index + 1)
  );
};

const parseDeck = (value: unknown): TarotDeckV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "artworkRightsSource",
      "artworkStatus",
      "cards",
      "contentType",
      "deckId",
      "editorial",
      "locale",
      "method",
      "supportedOrientations",
      "textRightsSource",
      "title",
      "tradition",
      "version",
    ]) ||
    (candidate.artworkStatus !== "none" && candidate.artworkStatus !== "assigned") ||
    candidate.contentType !== "tarot_deck" ||
    candidate.method !== "tarot"
  ) {
    invalidContent();
  }
  const artworkRightsSource =
    candidate.artworkRightsSource === null
      ? null
      : parseVersionReference(candidate.artworkRightsSource);
  if (
    (candidate.artworkStatus === "none" && artworkRightsSource !== null) ||
    (candidate.artworkStatus === "assigned" && artworkRightsSource === null)
  ) {
    invalidContent();
  }
  const cards = parseList(candidate.cards, 1, 200, parseCard);
  if (
    new Set(cards.map(({ cardId }) => cardId)).size !== cards.length ||
    !hasUniqueContiguousOrder(cards)
  ) {
    invalidContent();
  }
  if (
    (candidate.artworkStatus === "none" && cards.some(({ artwork }) => artwork !== null)) ||
    (candidate.artworkStatus === "assigned" && cards.some(({ artwork }) => artwork === null)) ||
    cards.some(
      ({ artwork }) =>
        artwork !== null &&
        (artworkRightsSource === null ||
          referenceKey(artwork.source) !== referenceKey(artworkRightsSource)),
    )
  ) {
    invalidContent();
  }
  const supportedOrientations = parseList(candidate.supportedOrientations, 1, 2, (item) => {
    if (!included(tarotOrientations, item)) invalidContent();
    return item;
  });
  if (new Set(supportedOrientations).size !== supportedOrientations.length) invalidContent();
  return Object.freeze({
    artworkRightsSource,
    artworkStatus: candidate.artworkStatus,
    cards,
    contentType: "tarot_deck",
    deckId: parseIdentifier(candidate.deckId),
    editorial: parseEditorial(candidate.editorial),
    locale: parseLocale(candidate.locale),
    method: "tarot",
    supportedOrientations,
    textRightsSource: parseVersionReference(candidate.textRightsSource),
    title: parseText(candidate.title, 300),
    tradition: parseText(candidate.tradition, 200),
    version: parseVersion(candidate.version),
  });
};

const parseSpreadPosition = (value: unknown): TarotSpreadPositionV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["description", "order", "positionId", "title"])
  ) {
    invalidContent();
  }
  return Object.freeze({
    description: parseText(candidate.description, 500),
    order: parseInteger(candidate.order, 1, 12),
    positionId: parseIdentifier(candidate.positionId),
    title: parseText(candidate.title, 100),
  });
};

const parseSpread = (value: unknown): TarotSpreadV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "compatibleDecks",
      "contentType",
      "description",
      "editorial",
      "locale",
      "method",
      "positions",
      "source",
      "spreadId",
      "spreadType",
      "title",
      "tradition",
      "version",
    ]) ||
    candidate.contentType !== "tarot_spread" ||
    candidate.method !== "tarot" ||
    (candidate.spreadType !== "one_card" &&
      candidate.spreadType !== "three_card" &&
      candidate.spreadType !== "other")
  ) {
    invalidContent();
  }
  const positions = parseList(candidate.positions, 1, 12, parseSpreadPosition);
  if (
    new Set(positions.map(({ positionId }) => positionId)).size !== positions.length ||
    !hasUniqueContiguousOrder(positions) ||
    (candidate.spreadType === "one_card" && positions.length !== 1) ||
    (candidate.spreadType === "three_card" && positions.length !== 3)
  ) {
    invalidContent();
  }
  return Object.freeze({
    compatibleDecks: parseList(candidate.compatibleDecks, 1, 32, parseVersionReference),
    contentType: "tarot_spread",
    description: parseText(candidate.description, 500),
    editorial: parseEditorial(candidate.editorial),
    locale: parseLocale(candidate.locale),
    method: "tarot",
    positions,
    source: parseVersionReference(candidate.source),
    spreadId: parseIdentifier(candidate.spreadId),
    spreadType: candidate.spreadType,
    title: parseText(candidate.title, 200),
    tradition: parseText(candidate.tradition, 200),
    version: parseVersion(candidate.version),
  });
};

const parseVisualSymbol = (value: unknown): TarotVisualSymbolV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["altText", "credit", "description", "localizationNotes", "source"])
  ) {
    invalidContent();
  }
  return Object.freeze({
    altText: parseText(candidate.altText, 500),
    credit: parseText(candidate.credit, 300),
    description: parseText(candidate.description, 500),
    localizationNotes: parseText(candidate.localizationNotes, 500),
    source: parseVersionReference(candidate.source),
  });
};

const parseThemeReading = (value: unknown): TarotThemeReadingV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["text", "themeCode"]) ||
    !included(questionIntakeThemeCodes, candidate.themeCode)
  ) {
    invalidContent();
  }
  return Object.freeze({
    text: parseText(candidate.text, 1_000),
    themeCode: candidate.themeCode,
  });
};

const parseCardContent = (value: unknown): TarotCardContentV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "alternativeTitles",
      "cannotDetermine",
      "cardId",
      "constructivePossibilities",
      "contentType",
      "contentId",
      "coreThemes",
      "culturalNotes",
      "deck",
      "editorial",
      "locale",
      "method",
      "orientation",
      "reflectionQuestions",
      "smallActions",
      "sources",
      "tensions",
      "themeReadings",
      "tradition",
      "translationStatus",
      "version",
      "visualSymbols",
    ]) ||
    !included(tarotOrientations, candidate.orientation) ||
    !included(tarotTranslationStatuses, candidate.translationStatus) ||
    candidate.contentType !== "tarot_card_orientation" ||
    candidate.method !== "tarot"
  ) {
    invalidContent();
  }
  const themeReadings = parseList(
    candidate.themeReadings,
    1,
    questionIntakeThemeCodes.length,
    parseThemeReading,
  );
  if (new Set(themeReadings.map(({ themeCode }) => themeCode)).size !== themeReadings.length) {
    invalidContent();
  }
  const sources = parseList(candidate.sources, 1, 20, parseVersionReference);
  if (new Set(sources.map((source) => `${source.id}@${source.version}`)).size !== sources.length) {
    invalidContent();
  }
  return Object.freeze({
    alternativeTitles: parseTextList(candidate.alternativeTitles, 0, 20, 200),
    cannotDetermine: parseText(candidate.cannotDetermine, 1_000),
    cardId: parseIdentifier(candidate.cardId),
    constructivePossibilities: parseTextList(candidate.constructivePossibilities, 1, 20, 500),
    contentType: "tarot_card_orientation",
    contentId: parseIdentifier(candidate.contentId),
    coreThemes: parseTextList(candidate.coreThemes, 1, 20, 200),
    culturalNotes: parseTextList(candidate.culturalNotes, 0, 20, 1_000),
    deck: parseVersionReference(candidate.deck),
    editorial: parseEditorial(candidate.editorial),
    locale: parseLocale(candidate.locale),
    method: "tarot",
    orientation: candidate.orientation,
    reflectionQuestions: parseTextList(candidate.reflectionQuestions, 1, 20, 500),
    smallActions: parseTextList(candidate.smallActions, 1, 20, 500),
    sources,
    tensions: parseTextList(candidate.tensions, 1, 20, 500),
    themeReadings,
    tradition: parseText(candidate.tradition, 200),
    translationStatus: candidate.translationStatus,
    version: parseVersion(candidate.version),
    visualSymbols: parseList(candidate.visualSymbols, 0, 20, parseVisualSymbol),
  });
};

const referenceKey = (reference: TarotVersionReference): string =>
  `${reference.id}@${reference.version}`;

const sourceKey = (source: TarotSourceRecordV1): string =>
  referenceKey({ id: source.sourceId, version: source.version });

const deckKey = (deck: TarotDeckV1): string =>
  referenceKey({ id: deck.deckId, version: deck.version });

const requireSourceUse = (
  sourceByReference: ReadonlyMap<string, TarotSourceRecordV1>,
  reference: TarotVersionReference,
  materialType: TarotMaterialType,
): TarotSourceRecordV1 => {
  const source = sourceByReference.get(referenceKey(reference));
  if (
    source === undefined ||
    !source.rights.allowedUses.includes("internal_validation") ||
    !source.rights.materialTypes.includes(materialType)
  ) {
    invalidReference();
  }
  return source;
};

const validateReferences = (catalog: TarotCatalogV1): void => {
  const sourceByReference = new Map(catalog.sources.map((source) => [sourceKey(source), source]));
  const deckByReference = new Map(catalog.decks.map((deck) => [deckKey(deck), deck]));

  for (const deck of catalog.decks) {
    const textSource = requireSourceUse(
      sourceByReference,
      deck.textRightsSource,
      "structural_data",
    );
    if (textSource.tradition !== deck.tradition) invalidReference();
    if (deck.artworkRightsSource !== null) {
      const artworkSource = requireSourceUse(
        sourceByReference,
        deck.artworkRightsSource,
        "artwork",
      );
      if (artworkSource.tradition !== deck.tradition) invalidReference();
    }
  }
  for (const spread of catalog.spreads) {
    const spreadSource = requireSourceUse(sourceByReference, spread.source, "spread_definition");
    if (spreadSource.tradition !== spread.tradition) invalidReference();
    if (
      new Set(spread.compatibleDecks.map(referenceKey)).size !== spread.compatibleDecks.length ||
      spread.compatibleDecks.some((reference) => {
        const deck = deckByReference.get(referenceKey(reference));
        return (
          deck === undefined ||
          deck.tradition !== spread.tradition ||
          spread.positions.length > deck.cards.length
        );
      })
    ) {
      invalidReference();
    }
  }
  for (const content of catalog.cardContents) {
    const deck = deckByReference.get(referenceKey(content.deck));
    if (
      deck === undefined ||
      content.locale !== catalog.locale ||
      !deck.cards.some(({ cardId }) => cardId === content.cardId) ||
      !deck.supportedOrientations.includes(content.orientation) ||
      content.tradition !== deck.tradition
    ) {
      invalidReference();
    }
    for (const source of content.sources) {
      const contentSource = requireSourceUse(sourceByReference, source, "interpretive_text");
      if (contentSource.tradition !== deck.tradition) invalidReference();
    }
    for (const symbol of content.visualSymbols) {
      const symbolSource = requireSourceUse(sourceByReference, symbol.source, "cultural_reference");
      if (symbolSource.tradition !== deck.tradition) invalidReference();
    }
    const themes = new Set(content.themeReadings.map(({ themeCode }) => themeCode));
    if (
      themes.size !== catalog.supportedThemeCodes.length ||
      catalog.supportedThemeCodes.some((themeCode) => !themes.has(themeCode))
    ) {
      invalidReference();
    }
  }
  for (const deck of catalog.decks) {
    for (const card of deck.cards) {
      for (const orientation of deck.supportedOrientations) {
        if (
          !catalog.cardContents.some(
            (content) =>
              referenceKey(content.deck) === deckKey(deck) &&
              content.cardId === card.cardId &&
              content.orientation === orientation,
          )
        ) {
          invalidReference();
        }
      }
    }
  }
};

const validSupersession = (
  supersedes: TarotVersionReference | null,
  id: TarotIdentifier,
  version: TarotVersion,
): boolean =>
  supersedes === null || (supersedes.id === id && compareVersions(supersedes.version, version) < 0);

const compareVersions = (left: TarotVersion, right: TarotVersion): number => {
  const [leftMajor, leftMinor, leftPatch] = left.split(".").map(Number);
  const [rightMajor, rightMinor, rightPatch] = right.split(".").map(Number);
  if (leftMajor !== rightMajor) return (leftMajor ?? 0) - (rightMajor ?? 0);
  if (leftMinor !== rightMinor) return (leftMinor ?? 0) - (rightMinor ?? 0);
  return (leftPatch ?? 0) - (rightPatch ?? 0);
};

const parseUsePolicy = (value: unknown): TarotCatalogV1["usePolicy"] => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["aiRetrievalAllowed", "indexingAllowed", "publicationAllowed"]) ||
    typeof candidate.aiRetrievalAllowed !== "boolean" ||
    typeof candidate.indexingAllowed !== "boolean" ||
    typeof candidate.publicationAllowed !== "boolean"
  ) {
    invalidContent();
  }
  if (
    !candidate.publicationAllowed &&
    (candidate.indexingAllowed || candidate.aiRetrievalAllowed)
  ) {
    invalidContent();
  }
  return Object.freeze({
    aiRetrievalAllowed: candidate.aiRetrievalAllowed,
    indexingAllowed: candidate.indexingAllowed,
    publicationAllowed: candidate.publicationAllowed,
  });
};

export const parseTarotCatalogV1 = (value: unknown): TarotCatalogV1 => {
  const candidate = record(value);
  if (candidate === null) invalidContent();
  if (candidate.schemaVersion !== tarotCatalogSchemaVersion) {
    throw new TarotContentError("TAROT_SCHEMA_VERSION_UNSUPPORTED");
  }
  if (
    !hasExactKeys(candidate, [
      "cardContents",
      "catalogId",
      "contentType",
      "decks",
      "editorial",
      "locale",
      "schemaVersion",
      "sources",
      "spreads",
      "supportedThemeCodes",
      "title",
      "usePolicy",
      "version",
    ]) ||
    candidate.contentType !== "tarot_catalog"
  ) {
    invalidContent();
  }
  const locale = parseLocale(candidate.locale);
  const sources = parseList(candidate.sources, 1, 1_000, parseSource);
  const decks = parseList(candidate.decks, 1, 32, parseDeck);
  const spreads = parseList(candidate.spreads, 1, 64, parseSpread);
  const cardContents = parseList(candidate.cardContents, 0, 10_000, parseCardContent);
  const supportedThemeCodes = parseList(
    candidate.supportedThemeCodes,
    1,
    questionIntakeThemeCodes.length,
    (item) => {
      if (!included(questionIntakeThemeCodes, item)) invalidContent();
      return item;
    },
  );

  if (
    new Set(sources.map(({ sourceId }) => sourceId)).size !== sources.length ||
    new Set(decks.map(({ deckId }) => deckId)).size !== decks.length ||
    new Set(spreads.map(({ spreadId }) => spreadId)).size !== spreads.length ||
    new Set(supportedThemeCodes).size !== supportedThemeCodes.length ||
    decks.some((deck) => deck.locale !== locale) ||
    spreads.some((spread) => spread.locale !== locale) ||
    sources.some(
      (source) => !validSupersession(source.editorial.supersedes, source.sourceId, source.version),
    ) ||
    decks.some(
      (deck) => !validSupersession(deck.editorial.supersedes, deck.deckId, deck.version),
    ) ||
    spreads.some(
      (spread) => !validSupersession(spread.editorial.supersedes, spread.spreadId, spread.version),
    )
  ) {
    invalidContent();
  }
  const contentKeys = cardContents.map(
    (content) =>
      `${referenceKey(content.deck)}/${content.cardId}/${content.orientation}/${content.locale}`,
  );
  if (
    new Set(contentKeys).size !== contentKeys.length ||
    new Set(cardContents.map(({ contentId }) => contentId)).size !== cardContents.length ||
    cardContents.some(
      (content) =>
        !validSupersession(content.editorial.supersedes, content.contentId, content.version),
    )
  ) {
    invalidContent();
  }

  const catalog = Object.freeze({
    cardContents,
    catalogId: parseIdentifier(candidate.catalogId),
    contentType: "tarot_catalog",
    decks,
    editorial: parseEditorial(candidate.editorial),
    locale,
    schemaVersion: tarotCatalogSchemaVersion,
    sources,
    spreads,
    supportedThemeCodes,
    title: parseText(candidate.title, 300),
    usePolicy: parseUsePolicy(candidate.usePolicy),
    version: parseVersion(candidate.version),
  });
  if (!validSupersession(catalog.editorial.supersedes, catalog.catalogId, catalog.version)) {
    invalidContent();
  }
  validateReferences(catalog);
  return catalog;
};
