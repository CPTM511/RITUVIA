import {
  assertTarotCatalogPublicationEligible,
  parseTarotCatalogV1,
  parseTarotDrawFactsV1,
  type TarotCardContentV1,
  type TarotCatalogV1,
  type TarotDrawFactsV1,
  type TarotSourceRecordV1,
} from "@rituvia/divination";
import { parseQuestionIntakeThemeCode, type QuestionIntakeThemeCode } from "@rituvia/domain";

import type { InterpretationContentReferenceV1 } from "./interpretation.js";

export const tarotContentRetrievalRequestSchemaVersion =
  "tarot-content-retrieval-request.v1" as const;
export const tarotRetrievedContentSchemaVersion = "tarot-retrieved-content.v1" as const;
export const tarotContentRetrievalPolicyVersion = "tarot-content-retrieval-policy.v1" as const;
export const tarotCatalogChecksumScope = "canonical-parsed-tarot-catalog-json.v1" as const;
export const tarotRetrievalAuthoritySchemaVersion = "tarot-retrieval-authority.v1" as const;

export const tarotContentRetrievalLimits = Object.freeze({
  catalogJsonMaximum: 8_388_608,
  culturalNotesMaximum: 2,
  excerptItemsMaximum: 3,
  promptDataJsonMaximum: 32_768,
  requestJsonMaximum: 65_536,
  themesMaximum: 4,
} as const);

export const tarotContentRetrievalErrorCodes = Object.freeze([
  "AI_CONTENT_RETRIEVAL_INVALID",
  "AI_CONTENT_INTEGRITY_MISMATCH",
  "AI_CONTENT_NOT_APPROVED",
  "AI_CONTENT_REFERENCE_MISMATCH",
  "AI_CONTENT_UNSAFE",
] as const);
export type TarotContentRetrievalErrorCode = (typeof tarotContentRetrievalErrorCodes)[number];

const retrievalErrorMessage = (code: TarotContentRetrievalErrorCode): string => {
  switch (code) {
    case "AI_CONTENT_RETRIEVAL_INVALID":
      return "The tarot content retrieval request is invalid.";
    case "AI_CONTENT_INTEGRITY_MISMATCH":
      return "The tarot content snapshot integrity check failed.";
    case "AI_CONTENT_NOT_APPROVED":
      return "The tarot content snapshot is not approved for AI retrieval.";
    case "AI_CONTENT_REFERENCE_MISMATCH":
      return "The tarot content references do not match the deterministic facts.";
    case "AI_CONTENT_UNSAFE":
      return "The tarot content snapshot contains unsafe prompt data.";
  }
};

export class TarotContentRetrievalError extends Error {
  public readonly code: TarotContentRetrievalErrorCode;

  public constructor(code: TarotContentRetrievalErrorCode) {
    super(retrievalErrorMessage(code));
    this.name = "TarotContentRetrievalError";
    this.code = code;
  }
}

export type Sha256IntegrityVerifierV1 = (
  canonicalJson: string,
  expectedChecksum: string,
) => boolean | Promise<boolean>;

export type TarotRetrievalAuthorityV1 = Readonly<{
  catalog: ApprovedTarotCatalogReferenceV1;
  locale: string;
  retrievalPolicyVersion: typeof tarotContentRetrievalPolicyVersion;
  schemaVersion: typeof tarotRetrievalAuthoritySchemaVersion;
  tradition: string;
}>;

export type TarotRetrievalAuthorityVerifierV1 = (
  authority: TarotRetrievalAuthorityV1,
) => boolean | Promise<boolean>;

export type ApprovedTarotCatalogReferenceV1 = Readonly<{
  approvalReference: string;
  checksum: string;
  id: string;
  version: string;
}>;

export type TarotContentRetrievalRequestV1 = Readonly<{
  catalog: ApprovedTarotCatalogReferenceV1;
  deterministicFacts: TarotDrawFactsV1;
  locale: string;
  schemaVersion: typeof tarotContentRetrievalRequestSchemaVersion;
  themeCode: QuestionIntakeThemeCode;
  tradition: string;
}>;

export type TarotRetrievedPositionV1 = Readonly<{
  cannotDetermine: string;
  cardId: string;
  cardTitle: string;
  constructivePossibilities: readonly string[];
  contentId: string;
  contentVersion: string;
  coreThemes: readonly string[];
  culturalNotes: readonly string[];
  factRef: string;
  order: number;
  orientation: "reversed" | "upright";
  positionDescription: string;
  positionId: string;
  positionTitle: string;
  reflectionQuestions: readonly string[];
  smallActions: readonly string[];
  sourceRefs: readonly string[];
  tensions: readonly string[];
  themeReading: string;
}>;

export type TarotContentSourceProvenanceV1 = Readonly<{
  allowedUses: readonly string[];
  approvalReference: string;
  attributionText: string | null;
  creator: string;
  evidenceReference: string;
  expiresOn: string | null;
  rightsStatus: string;
  rightsVersion: string;
  sourceId: string;
  sourceRef: string;
  title: string;
  territory: string;
  tradition: string;
  version: string;
}>;

export type TarotContentProvenanceV1 = Readonly<{
  catalog: ApprovedTarotCatalogReferenceV1;
  catalogChecksumScope: typeof tarotCatalogChecksumScope;
  content: readonly Readonly<{
    approvalReference: string;
    cardId: string;
    checksum: string;
    contentId: string;
    integrityScope: "catalog_snapshot";
    locale: string;
    order: number;
    orientation: "reversed" | "upright";
    positionId: string;
    sourceRef: string;
    sourceRefs: readonly string[];
    tradition: string;
    version: string;
  }>[];
  deck: Readonly<{
    approvalReference: string;
    id: string;
    version: string;
  }>;
  eligibilityAsOf: string;
  retrievalPolicyVersion: typeof tarotContentRetrievalPolicyVersion;
  sources: readonly TarotContentSourceProvenanceV1[];
  spread: Readonly<{
    approvalReference: string;
    id: string;
    version: string;
  }>;
}>;

declare const retrievedTarotContentBrand: unique symbol;
const issuedRetrievedTarotContent = new WeakSet<object>();

export type RetrievedTarotContentBundleV1 = Readonly<{
  approvedContent: readonly InterpretationContentReferenceV1[];
  deterministicFacts: TarotDrawFactsV1;
  locale: string;
  positions: readonly TarotRetrievedPositionV1[];
  provenance: TarotContentProvenanceV1;
  readingType: "one_card" | "three_card";
  schemaVersion: typeof tarotRetrievedContentSchemaVersion;
  themeCode: QuestionIntakeThemeCode;
  tradition: string;
  [retrievedTarotContentBrand]: true;
}>;

export type RetrieveApprovedTarotContentInputV1 = Readonly<{
  asOf: string;
  authorizeRetrieval: TarotRetrievalAuthorityVerifierV1;
  catalogJson: string;
  requestJson: string;
  verifyIntegrity: Sha256IntegrityVerifierV1;
}>;

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u;
const forbiddenTextPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u;
const promptInjectionPattern =
  /(?:ignore|disregard|override).{0,48}(?:instruction|message|policy|prompt)|(?:system|developer|assistant)\s+(?:instruction|message|prompt|role)|reveal.{0,48}(?:instruction|prompt|secret)|(?:begin|end)\s+(?:system|developer|assistant)\s+(?:instruction|message|prompt)|role\s*:\s*(?:system|developer|assistant)|<\/?(?:system|developer|assistant|user)\b/iu;
const unsafePromptDataCharacters = /[\u2028\u2029]/u;

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  return actual === [...expected].sort().join("\u0000");
};

const fail = (code: TarotContentRetrievalErrorCode): never => {
  throw new TarotContentRetrievalError(code);
};

const parseText = (value: unknown, maximum: number): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    utf8ByteLength(value) > maximum ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    forbiddenTextPattern.test(value)
  ) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  return value;
};

const parseIdentifier = (value: unknown, maximum = 120): string => {
  const parsed = parseText(value, maximum);
  if (!identifierPattern.test(parsed)) return fail("AI_CONTENT_RETRIEVAL_INVALID");
  return parsed;
};

const parseLocale = (value: unknown): string => {
  const locale = parseText(value, 35);
  try {
    if (new Intl.Locale(locale).toString() !== locale) {
      return fail("AI_CONTENT_RETRIEVAL_INVALID");
    }
  } catch {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  return locale;
};

const parseDate = (value: unknown): string => {
  if (typeof value !== "string" || !datePattern.test(value)) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  return value;
};

const parseCatalogReference = (value: unknown): ApprovedTarotCatalogReferenceV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["approvalReference", "checksum", "id", "version"]) ||
    typeof candidate.checksum !== "string" ||
    !sha256DigestPattern.test(candidate.checksum) ||
    typeof candidate.version !== "string" ||
    !versionPattern.test(candidate.version)
  ) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  const approvalReference = parseText(candidate.approvalReference, 200);
  if (!approvalReferencePattern.test(approvalReference)) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  return Object.freeze({
    approvalReference,
    checksum: candidate.checksum,
    id: parseIdentifier(candidate.id),
    version: candidate.version,
  });
};

const parseRetrievalRequestJson = (value: string): TarotContentRetrievalRequestV1 => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    utf8ByteLength(value) > tarotContentRetrievalLimits.requestJsonMaximum
  ) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(value) as unknown;
  } catch {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  const candidate = record(parsedJson);
  if (
    candidate === null ||
    candidate.schemaVersion !== tarotContentRetrievalRequestSchemaVersion ||
    !hasExactKeys(candidate, [
      "catalog",
      "deterministicFacts",
      "locale",
      "schemaVersion",
      "themeCode",
      "tradition",
    ])
  ) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  let deterministicFacts: TarotDrawFactsV1;
  let themeCode: QuestionIntakeThemeCode;
  try {
    deterministicFacts = parseTarotDrawFactsV1(candidate.deterministicFacts);
    themeCode = parseQuestionIntakeThemeCode(candidate.themeCode);
  } catch {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  return Object.freeze({
    catalog: parseCatalogReference(candidate.catalog),
    deterministicFacts,
    locale: parseLocale(candidate.locale),
    schemaVersion: tarotContentRetrievalRequestSchemaVersion,
    themeCode,
    tradition: parseIdentifier(candidate.tradition, 80),
  });
};

const parseCatalogJson = (value: string): TarotCatalogV1 => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    utf8ByteLength(value) > tarotContentRetrievalLimits.catalogJsonMaximum
  ) {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  try {
    return parseTarotCatalogV1(JSON.parse(value) as unknown);
  } catch {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
};

const verifySnapshotIntegrity = async (
  catalog: TarotCatalogV1,
  expectedChecksum: string,
  verifier: Sha256IntegrityVerifierV1,
): Promise<void> => {
  if (typeof verifier !== "function") return fail("AI_CONTENT_RETRIEVAL_INVALID");
  let verified: unknown;
  try {
    verified = await verifier(JSON.stringify(catalog), expectedChecksum);
  } catch {
    return fail("AI_CONTENT_INTEGRITY_MISMATCH");
  }
  if (verified !== true) return fail("AI_CONTENT_INTEGRITY_MISMATCH");
};

const sourceReference = (sourceId: string, version: string): string =>
  `source:${sourceId}:${version}`;

const contentReference = (contentId: string, version: string): string =>
  `content:${contentId}:${version}`;

const requireApprovalReference = (value: string | null): string =>
  value === null || !approvalReferencePattern.test(value) ? fail("AI_CONTENT_NOT_APPROVED") : value;

const requirePublished = (status: string): void => {
  if (status !== "published") return fail("AI_CONTENT_NOT_APPROVED");
};

const assertPromptSafeData = (values: readonly string[]): void => {
  if (
    values.some(
      (value) =>
        forbiddenTextPattern.test(value) ||
        unsafePromptDataCharacters.test(value) ||
        promptInjectionPattern.test(value),
    )
  ) {
    return fail("AI_CONTENT_UNSAFE");
  }
};

const resolveSource = (
  catalog: TarotCatalogV1,
  id: string,
  version: string,
): TarotSourceRecordV1 => {
  const source = catalog.sources.find(
    (candidate) => candidate.sourceId === id && candidate.version === version,
  );
  return source ?? fail("AI_CONTENT_REFERENCE_MISMATCH");
};

const contentPromptStrings = (
  content: TarotCardContentV1,
  cardTitle: string,
  positionTitle: string,
  positionDescription: string,
  themeReading: string,
): readonly string[] =>
  Object.freeze([
    cardTitle,
    positionTitle,
    positionDescription,
    themeReading,
    content.cannotDetermine,
    ...content.coreThemes.slice(0, tarotContentRetrievalLimits.themesMaximum),
    ...content.constructivePossibilities.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
    ...content.tensions.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
    ...content.reflectionQuestions.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
    ...content.smallActions.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
    ...content.culturalNotes.slice(0, tarotContentRetrievalLimits.culturalNotesMaximum),
  ]);

const exactReference = (
  reference: Readonly<{ id: string; version: string }>,
  id: string,
  version: string,
): boolean => reference.id === id && reference.version === version;

export const isRetrievedTarotContentBundleV1 = (
  value: unknown,
): value is RetrievedTarotContentBundleV1 =>
  typeof value === "object" && value !== null && issuedRetrievedTarotContent.has(value);

export const retrieveApprovedTarotContentV1 = async (
  input: RetrieveApprovedTarotContentInputV1,
): Promise<RetrievedTarotContentBundleV1> => {
  if (typeof input !== "object" || input === null) return fail("AI_CONTENT_RETRIEVAL_INVALID");
  const asOf = parseDate(input.asOf);
  const request = parseRetrievalRequestJson(input.requestJson);
  const catalog = parseCatalogJson(input.catalogJson);

  await verifySnapshotIntegrity(catalog, request.catalog.checksum, input.verifyIntegrity);

  if (typeof input.authorizeRetrieval !== "function") {
    return fail("AI_CONTENT_RETRIEVAL_INVALID");
  }
  const authority = Object.freeze({
    catalog: request.catalog,
    locale: request.locale,
    retrievalPolicyVersion: tarotContentRetrievalPolicyVersion,
    schemaVersion: tarotRetrievalAuthoritySchemaVersion,
    tradition: request.tradition,
  });
  let authorized: unknown;
  try {
    authorized = await input.authorizeRetrieval(authority);
  } catch {
    return fail("AI_CONTENT_NOT_APPROVED");
  }
  if (authorized !== true) return fail("AI_CONTENT_NOT_APPROVED");

  if (
    catalog.catalogId !== request.catalog.id ||
    catalog.version !== request.catalog.version ||
    catalog.locale !== request.locale ||
    catalog.editorial.approvalReference !== request.catalog.approvalReference ||
    !exactReference(request.deterministicFacts.catalog, catalog.catalogId, catalog.version)
  ) {
    return fail("AI_CONTENT_REFERENCE_MISMATCH");
  }
  try {
    assertTarotCatalogPublicationEligible(catalog, asOf);
  } catch {
    return fail("AI_CONTENT_NOT_APPROVED");
  }
  if (!catalog.usePolicy.aiRetrievalAllowed) return fail("AI_CONTENT_NOT_APPROVED");
  requirePublished(catalog.editorial.status);

  const facts = request.deterministicFacts;
  const deck = catalog.decks.find(({ deckId, version }) =>
    exactReference(facts.deck, deckId, version),
  );
  const spread = catalog.spreads.find(({ spreadId, version }) =>
    exactReference(facts.spread, spreadId, version),
  );
  if (
    deck === undefined ||
    spread === undefined ||
    deck.locale !== request.locale ||
    spread.locale !== request.locale ||
    deck.tradition !== request.tradition ||
    spread.tradition !== request.tradition ||
    !spread.compatibleDecks.some((reference) =>
      exactReference(reference, deck.deckId, deck.version),
    ) ||
    (spread.spreadType !== "one_card" && spread.spreadType !== "three_card")
  ) {
    return fail("AI_CONTENT_REFERENCE_MISMATCH");
  }
  requirePublished(deck.editorial.status);
  requirePublished(spread.editorial.status);

  const orderedFacts = [...facts.positions].sort((left, right) => left.order - right.order);
  const orderedSpreadPositions = [...spread.positions].sort(
    (left, right) => left.order - right.order,
  );
  if (
    orderedFacts.length !== orderedSpreadPositions.length ||
    orderedFacts.some((position) => {
      const definition = orderedSpreadPositions.find(({ order }) => order === position.order);
      return (
        definition === undefined ||
        position.order !== definition.order ||
        position.positionId !== definition.positionId ||
        !deck.cards.some(({ cardId }) => cardId === position.cardId) ||
        !deck.supportedOrientations.includes(position.orientation) ||
        (facts.orientationPolicy === "upright_only" && position.orientation !== "upright")
      );
    })
  ) {
    return fail("AI_CONTENT_REFERENCE_MISMATCH");
  }

  const approvedContent: InterpretationContentReferenceV1[] = [];
  const positions: TarotRetrievedPositionV1[] = [];
  const contentProvenance: TarotContentProvenanceV1["content"][number][] = [];
  const sourceByRef = new Map<string, TarotContentSourceProvenanceV1>();
  const addSourceProvenance = (id: string, version: string): string => {
    const source = resolveSource(catalog, id, version);
    requirePublished(source.editorial.status);
    const ref = sourceReference(source.sourceId, source.version);
    sourceByRef.set(
      ref,
      Object.freeze({
        allowedUses: Object.freeze([...source.rights.allowedUses]),
        approvalReference: requireApprovalReference(source.editorial.approvalReference),
        attributionText: source.rights.attributionText,
        creator: source.creator,
        evidenceReference: source.rights.evidenceReference ?? fail("AI_CONTENT_NOT_APPROVED"),
        expiresOn: source.rights.expiresOn,
        rightsStatus: source.rights.status,
        rightsVersion: source.rights.version,
        sourceId: source.sourceId,
        sourceRef: ref,
        title: source.title,
        territory: source.rights.territory,
        tradition: source.tradition,
        version: source.version,
      }),
    );
    return ref;
  };

  addSourceProvenance(deck.textRightsSource.id, deck.textRightsSource.version);
  addSourceProvenance(spread.source.id, spread.source.version);

  for (const position of orderedFacts) {
    const spreadPosition = orderedSpreadPositions.find(({ order }) => order === position.order);
    const card = deck.cards.find(({ cardId }) => cardId === position.cardId);
    const content = catalog.cardContents.find(
      (candidate) =>
        exactReference(candidate.deck, deck.deckId, deck.version) &&
        candidate.cardId === position.cardId &&
        candidate.orientation === position.orientation &&
        candidate.locale === request.locale &&
        candidate.tradition === request.tradition,
    );
    if (spreadPosition === undefined || card === undefined || content === undefined) {
      return fail("AI_CONTENT_REFERENCE_MISMATCH");
    }
    requirePublished(content.editorial.status);
    const themeReading = content.themeReadings.find(
      ({ themeCode }) => themeCode === request.themeCode,
    )?.text;
    if (themeReading === undefined) return fail("AI_CONTENT_REFERENCE_MISMATCH");

    assertPromptSafeData(
      contentPromptStrings(
        content,
        card.title,
        spreadPosition.title,
        spreadPosition.description,
        themeReading,
      ),
    );

    const sourceRefs = Object.freeze(
      content.sources.map(({ id, version }) => addSourceProvenance(id, version)),
    );

    const sourceRef = contentReference(content.contentId, content.version);
    const contentApprovalReference = requireApprovalReference(content.editorial.approvalReference);
    approvedContent.push(
      Object.freeze({
        checksum: request.catalog.checksum,
        contentId: content.contentId,
        locale: content.locale,
        sourceRef,
        tradition: content.tradition,
        version: content.version,
      }),
    );
    contentProvenance.push(
      Object.freeze({
        approvalReference: contentApprovalReference,
        cardId: content.cardId,
        checksum: request.catalog.checksum,
        contentId: content.contentId,
        integrityScope: "catalog_snapshot",
        locale: content.locale,
        order: position.order,
        orientation: content.orientation,
        positionId: position.positionId,
        sourceRef,
        sourceRefs,
        tradition: content.tradition,
        version: content.version,
      }),
    );
    positions.push(
      Object.freeze({
        cannotDetermine: content.cannotDetermine,
        cardId: card.cardId,
        cardTitle: card.title,
        constructivePossibilities: Object.freeze(
          content.constructivePossibilities.slice(
            0,
            tarotContentRetrievalLimits.excerptItemsMaximum,
          ),
        ),
        contentId: content.contentId,
        contentVersion: content.version,
        coreThemes: Object.freeze(
          content.coreThemes.slice(0, tarotContentRetrievalLimits.themesMaximum),
        ),
        culturalNotes: Object.freeze(
          content.culturalNotes.slice(0, tarotContentRetrievalLimits.culturalNotesMaximum),
        ),
        factRef: `tarot.position.${position.positionId}`,
        order: position.order,
        orientation: position.orientation,
        positionDescription: spreadPosition.description,
        positionId: position.positionId,
        positionTitle: spreadPosition.title,
        reflectionQuestions: Object.freeze(
          content.reflectionQuestions.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
        ),
        smallActions: Object.freeze(
          content.smallActions.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
        ),
        sourceRefs,
        tensions: Object.freeze(
          content.tensions.slice(0, tarotContentRetrievalLimits.excerptItemsMaximum),
        ),
        themeReading,
      }),
    );
  }

  const provenance = Object.freeze({
    catalog: request.catalog,
    catalogChecksumScope: tarotCatalogChecksumScope,
    content: Object.freeze(contentProvenance),
    deck: Object.freeze({
      approvalReference: requireApprovalReference(deck.editorial.approvalReference),
      id: deck.deckId,
      version: deck.version,
    }),
    eligibilityAsOf: asOf,
    retrievalPolicyVersion: tarotContentRetrievalPolicyVersion,
    sources: Object.freeze(
      [...sourceByRef.values()].sort((left, right) =>
        left.sourceRef < right.sourceRef ? -1 : left.sourceRef > right.sourceRef ? 1 : 0,
      ),
    ),
    spread: Object.freeze({
      approvalReference: requireApprovalReference(spread.editorial.approvalReference),
      id: spread.spreadId,
      version: spread.version,
    }),
  });
  const bundle = Object.freeze({
    approvedContent: Object.freeze(approvedContent),
    deterministicFacts: facts,
    locale: request.locale,
    positions: Object.freeze(positions),
    provenance,
    readingType: spread.spreadType,
    schemaVersion: tarotRetrievedContentSchemaVersion,
    themeCode: request.themeCode,
    tradition: request.tradition,
  }) as unknown as RetrievedTarotContentBundleV1;

  if (
    utf8ByteLength(
      JSON.stringify({
        locale: bundle.locale,
        positions: bundle.positions,
        schemaVersion: bundle.schemaVersion,
        themeCode: bundle.themeCode,
        tradition: bundle.tradition,
      }),
    ) > tarotContentRetrievalLimits.promptDataJsonMaximum
  ) {
    return fail("AI_CONTENT_UNSAFE");
  }

  issuedRetrievedTarotContent.add(bundle);
  return bundle;
};
