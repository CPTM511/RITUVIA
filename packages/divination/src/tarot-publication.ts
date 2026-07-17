import { questionIntakeThemeCodes } from "@rituvia/domain";

import {
  TarotContentError,
  parseTarotAsOfDate,
  parseTarotCatalogV1,
  type TarotCardContentV1,
  type TarotCatalogV1,
  type TarotEditorialMetadataV1,
  type TarotSourceRecordV1,
} from "./tarot-content.js";

export const tarotPublicationReasonCodes = Object.freeze([
  "PUBLICATION_POLICY_DISABLED",
  "EDITORIAL_NOT_APPROVED",
  "REQUIRED_APPROVAL_MISSING",
  "EFFECTIVE_DATE_INVALID",
  "REVIEW_EXPIRED",
  "RIGHTS_NOT_CLEARED",
  "RIGHTS_EXPIRED",
  "PUBLIC_DISPLAY_RIGHTS_MISSING",
  "COMMERCIAL_RIGHTS_MISSING",
  "TRANSLATION_RIGHTS_MISSING",
  "AI_RETRIEVAL_RIGHTS_MISSING",
  "WORLDWIDE_RIGHTS_MISSING",
  "RIGHTS_EVIDENCE_MISSING",
  "SOURCE_CLAIMS_MISSING",
  "ARTWORK_MISSING",
  "SPREAD_INVENTORY_INCOMPLETE",
  "THEME_INVENTORY_INCOMPLETE",
  "TRANSLATION_REVIEW_INCOMPLETE",
  "PROHIBITED_CLAIM",
] as const);

export type TarotPublicationReasonCode = (typeof tarotPublicationReasonCodes)[number];

export type TarotPublicationAssessment = Readonly<{
  asOf: string;
  catalogId: string;
  catalogVersion: string;
  eligible: boolean;
  reasons: readonly TarotPublicationReasonCode[];
  schemaVersion: "tarot-publication-assessment.v1";
}>;

const approvedStatuses = new Set(["approved", "published"] as const);

const prohibitedClaimPatterns = Object.freeze([
  /\b(?:this card|the card|the spread|rituvia) (?:guarantees?|proves?|predicts?|confirms?)\b/iu,
  /\byou (?:will definitely|are destined to|must inevitably)\b/iu,
  /\b(?:guaranteed reunion|guaranteed wealth|certain outcome|prophecy confirmed)\b/iu,
  /\b(?:remove|lift|break) (?:a |the )?curse\b/iu,
  /\b(?:diagnoses?|cures?|treats?) (?:your |a )?(?:disease|illness|condition)\b/iu,
  /\b(?:will win|guarantees?) (?:your |the )?(?:court|legal|immigration)\b/iu,
  /\b(?:guaranteed return|certain profit|winning lottery)\b/iu,
  /\b(?:will die|death date|time of death)\b/iu,
  /\b(?:knows?|reveals?|confirms?) (?:their|his|her) (?:secret thoughts|faithfulness|future behavior)\b/iu,
  /\b(?:paid|premium) (?:card|ritual|reading) (?:is|has|gives) (?:stronger|more powerful)\b/iu,
  /\b(?:act now|urgent spiritual window|dangerous energy)\b/iu,
]);

const editorialEligible = (
  editorial: TarotEditorialMetadataV1,
  asOf: string,
  addReason: (reason: TarotPublicationReasonCode) => void,
): void => {
  if (!approvedStatuses.has(editorial.status as "approved" | "published")) {
    addReason("EDITORIAL_NOT_APPROVED");
  }
  if (
    editorial.reviewerRole === null ||
    editorial.reviewerId === null ||
    editorial.approvalReference === null ||
    editorial.reviewedDate === null ||
    editorial.reviewerRole !== editorial.requiredApprovalRole ||
    editorial.reviewerId === editorial.authorId ||
    editorial.reviewedDate > asOf
  ) {
    addReason("REQUIRED_APPROVAL_MISSING");
  }
  if (editorial.effectiveDate > asOf) addReason("EFFECTIVE_DATE_INVALID");
  if (editorial.reviewDueDate < asOf) addReason("REVIEW_EXPIRED");
};

const sourceEligible = (
  source: TarotSourceRecordV1,
  catalogLocale: string,
  asOf: string,
  addReason: (reason: TarotPublicationReasonCode) => void,
): void => {
  editorialEligible(source.editorial, asOf, addReason);
  if (
    source.rights.status !== "owned" &&
    source.rights.status !== "licensed" &&
    source.rights.status !== "public_domain"
  ) {
    addReason("RIGHTS_NOT_CLEARED");
  }
  if (source.rights.expiresOn !== null && source.rights.expiresOn < asOf) {
    addReason("RIGHTS_EXPIRED");
  }
  if (!source.rights.allowedUses.includes("public_display")) {
    addReason("PUBLIC_DISPLAY_RIGHTS_MISSING");
  }
  if (!source.rights.allowedUses.includes("commercial_use")) {
    addReason("COMMERCIAL_RIGHTS_MISSING");
  }
  if (source.language !== catalogLocale && !source.rights.allowedUses.includes("translation")) {
    addReason("TRANSLATION_RIGHTS_MISSING");
  }
  if (source.rights.territory !== "worldwide") addReason("WORLDWIDE_RIGHTS_MISSING");
  if (source.rights.evidenceReference === null) addReason("RIGHTS_EVIDENCE_MISSING");
  if (source.sourceType !== "original" && source.claims.length === 0) {
    addReason("SOURCE_CLAIMS_MISSING");
  }
};

const contentTexts = (content: TarotCardContentV1): readonly string[] =>
  Object.freeze([
    ...content.alternativeTitles,
    content.cannotDetermine,
    ...content.constructivePossibilities,
    ...content.coreThemes,
    ...content.culturalNotes,
    ...content.reflectionQuestions,
    ...content.smallActions,
    ...content.tensions,
    ...content.themeReadings.map(({ text }) => text),
    ...content.visualSymbols.flatMap(({ altText, credit, description, localizationNotes }) => [
      altText,
      credit,
      description,
      localizationNotes,
    ]),
  ]);

const hasProhibitedClaim = (catalog: TarotCatalogV1): boolean => {
  const texts = [
    catalog.title,
    ...catalog.decks.flatMap(({ cards, title, tradition }) => [
      title,
      tradition,
      ...cards.flatMap(({ alternativeTitles, title: cardTitle, traditionalTitle }) => [
        cardTitle,
        ...(traditionalTitle === null ? [] : [traditionalTitle]),
        ...alternativeTitles,
      ]),
    ]),
    ...catalog.spreads.flatMap(({ description, positions, title, tradition }) => [
      title,
      description,
      tradition,
      ...positions.flatMap(({ description: positionDescription, title: positionTitle }) => [
        positionTitle,
        positionDescription,
      ]),
    ]),
    ...catalog.cardContents.flatMap(contentTexts),
  ];
  return texts.some((text) => prohibitedClaimPatterns.some((pattern) => pattern.test(text)));
};

export const assessTarotCatalogPublication = (
  value: unknown,
  asOfInput: unknown,
): TarotPublicationAssessment => {
  const catalog = parseTarotCatalogV1(value);
  const asOf = parseTarotAsOfDate(asOfInput);
  const reasons = new Set<TarotPublicationReasonCode>();
  const addReason = (reason: TarotPublicationReasonCode): void => {
    reasons.add(reason);
  };

  if (!catalog.usePolicy.publicationAllowed) addReason("PUBLICATION_POLICY_DISABLED");
  editorialEligible(catalog.editorial, asOf, addReason);
  for (const source of catalog.sources) {
    sourceEligible(source, catalog.locale, asOf, addReason);
  }
  if (
    catalog.usePolicy.aiRetrievalAllowed &&
    catalog.sources.some(({ rights }) => !rights.allowedUses.includes("ai_retrieval"))
  ) {
    addReason("AI_RETRIEVAL_RIGHTS_MISSING");
  }
  for (const deck of catalog.decks) {
    editorialEligible(deck.editorial, asOf, addReason);
    if (deck.artworkStatus !== "assigned" || deck.artworkRightsSource === null) {
      addReason("ARTWORK_MISSING");
    }
  }
  for (const spread of catalog.spreads) editorialEligible(spread.editorial, asOf, addReason);
  for (const content of catalog.cardContents) {
    editorialEligible(content.editorial, asOf, addReason);
    if (
      content.translationStatus === "source_draft" ||
      content.translationStatus === "translation_ready"
    ) {
      addReason("TRANSLATION_REVIEW_INCOMPLETE");
    }
  }

  if (
    !catalog.spreads.some(({ spreadType }) => spreadType === "one_card") ||
    !catalog.spreads.some(({ spreadType }) => spreadType === "three_card")
  ) {
    addReason("SPREAD_INVENTORY_INCOMPLETE");
  }
  if (
    catalog.supportedThemeCodes.length !== questionIntakeThemeCodes.length ||
    questionIntakeThemeCodes.some((themeCode) => !catalog.supportedThemeCodes.includes(themeCode))
  ) {
    addReason("THEME_INVENTORY_INCOMPLETE");
  }
  if (hasProhibitedClaim(catalog)) addReason("PROHIBITED_CLAIM");

  const orderedReasons = Object.freeze(
    tarotPublicationReasonCodes.filter((reason) => reasons.has(reason)),
  );
  return Object.freeze({
    asOf,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.version,
    eligible: orderedReasons.length === 0,
    reasons: orderedReasons,
    schemaVersion: "tarot-publication-assessment.v1",
  });
};

export const assertTarotCatalogPublicationEligible = (
  value: unknown,
  asOfInput: unknown,
): TarotCatalogV1 => {
  const catalog = parseTarotCatalogV1(value);
  const assessment = assessTarotCatalogPublication(catalog, asOfInput);
  if (!assessment.eligible) {
    throw new TarotContentError("TAROT_CATALOG_NOT_PUBLICATION_ELIGIBLE");
  }
  return catalog;
};
