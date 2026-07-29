import "server-only";

import publicationSource from "../../../content/traditions/astrology/rituvia-western-natal-education.en.v1.json";
import { astrologyGuideSlugs, type AstrologyGuideSlug } from "../app/_i18n/astrology-public-routes";

type UnknownRecord = Record<string, unknown>;

type AstrologyPublicationEditorialV1 = Readonly<{
  approvalReference: "OWN-016:option-a:2026-07-27";
  authorId: "product.codex";
  changeReason: string;
  effectiveDate: "2026-07-27";
  requiredApprovalRole: "owner";
  reviewDueDate: "2027-07-27";
  reviewedDate: "2026-07-27";
  reviewerId: "owner";
  reviewerRole: "owner";
  status: "approved";
  supersedes: null;
}>;

export type AstrologyPublicationSectionV1 = Readonly<{
  bullets: readonly string[];
  heading: string;
  paragraphs: readonly string[];
}>;

export type AstrologyPublicationTableV1 = Readonly<{
  caption: string;
  columns: readonly [string, string, string];
  rows: readonly (readonly [string, string, string])[];
}>;

export type AstrologyPublicationGuideV1 = Readonly<{
  answer: string;
  description: string;
  limitations: readonly [string, string, string];
  sections: readonly [AstrologyPublicationSectionV1, AstrologyPublicationSectionV1];
  slug: AstrologyGuideSlug;
  sourceRefs: readonly string[];
  table: AstrologyPublicationTableV1;
  title: string;
}>;

export type AstrologyPublicationSourceV1 = Readonly<{
  claims: readonly string[];
  creator: string;
  identifier: string;
  publisher: string;
  rights: Readonly<{
    allowedUses: readonly string[];
    evidenceReference: string;
    status: "owned" | "reference_only";
    territory: "worldwide";
  }>;
  sourceId:
    | "rituvia.astrology.agpl-integration"
    | "rituvia.astrology.location-time-policy"
    | "rituvia.astrology.method-catalog"
    | "rituvia.editorial.astrology-education"
    | "swiss-ephemeris.programming-reference";
  sourceType: "original" | "product_decision" | "product_method" | "technical_reference";
  title: string;
  version: string;
}>;

export type AstrologyPublicationCatalogV1 = Readonly<{
  audience: "adults";
  catalogId: "rituvia.astrology.western-natal-education.en";
  contentType: "astrology_education_catalog";
  editorial: AstrologyPublicationEditorialV1;
  guides: readonly AstrologyPublicationGuideV1[];
  hub: Readonly<{
    answer: string;
    boundary: string;
    description: string;
    eyebrow: string;
    sourceNote: string;
    title: string;
  }>;
  labels: Readonly<{
    backToHub: string;
    calculatorAction: string;
    guideListTitle: string;
    limitationsTitle: string;
    privacyAction: string;
    relatedGuidesTitle: string;
    safetyAction: string;
    sourceTitle: string;
    tableTitle: string;
  }>;
  locale: "en";
  method: "western_natal";
  publicationPolicy: Readonly<{
    calculatorPath: "/en/readings/astrology";
    indexingAllowed: true;
    personalizedPagesIndexable: false;
    profileDoorwayRoutesAllowed: false;
    publicPublicationAllowed: true;
  }>;
  publicationStatus: "approved";
  riskClassification: "sensitive_symbolic_education";
  schemaVersion: "astrology-education-catalog.v1";
  sources: readonly AstrologyPublicationSourceV1[];
  title: string;
  version: "1.0.0";
}>;

const sourceIds = Object.freeze([
  "rituvia.astrology.method-catalog",
  "swiss-ephemeris.programming-reference",
  "rituvia.astrology.agpl-integration",
  "rituvia.astrology.location-time-policy",
  "rituvia.editorial.astrology-education",
] as const satisfies readonly AstrologyPublicationSourceV1["sourceId"][]);

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("The astrology publication contract requires an object.");
  }
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) {
    throw new TypeError("The astrology publication contract has unexpected fields.");
  }
};

const literal = <Value extends string | number | boolean | null>(
  value: unknown,
  expected: Value,
): Value => {
  if (value !== expected) {
    throw new TypeError("The astrology publication contract contains an invalid literal.");
  }
  return expected;
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
    throw new TypeError("The astrology publication contract contains unsafe text.");
  }
  return value;
};

const textArray = (value: unknown, minimum: number, maximum: number): readonly string[] => {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new TypeError("The astrology publication contract contains an invalid text list.");
  }
  return Object.freeze(value.map((item) => text(item)));
};

const fixedTuple = (value: unknown, label: string): readonly [string, string, string] => {
  const values = textArray(value, 3, 3);
  if (values.length !== 3) throw new TypeError(label);
  return Object.freeze([values.at(0) as string, values.at(1) as string, values.at(2) as string]);
};

const parseEditorial = (value: unknown): AstrologyPublicationEditorialV1 => {
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
    approvalReference: literal(candidate.approvalReference, "OWN-016:option-a:2026-07-27"),
    authorId: literal(candidate.authorId, "product.codex"),
    changeReason: text(candidate.changeReason),
    effectiveDate: literal(candidate.effectiveDate, "2026-07-27"),
    requiredApprovalRole: literal(candidate.requiredApprovalRole, "owner"),
    reviewDueDate: literal(candidate.reviewDueDate, "2027-07-27"),
    reviewedDate: literal(candidate.reviewedDate, "2026-07-27"),
    reviewerId: literal(candidate.reviewerId, "owner"),
    reviewerRole: literal(candidate.reviewerRole, "owner"),
    status: literal(candidate.status, "approved"),
    supersedes: literal(candidate.supersedes, null),
  });
};

const parseSource = (value: unknown): AstrologyPublicationSourceV1 => {
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
  if (!sourceIds.some((allowed) => allowed === sourceId)) {
    throw new TypeError("The astrology publication source is not approved.");
  }
  const sourceType = text(candidate.sourceType);
  if (
    !["original", "product_decision", "product_method", "technical_reference"].includes(sourceType)
  ) {
    throw new TypeError("The astrology publication source type is invalid.");
  }
  const rights = record(candidate.rights);
  exactKeys(rights, ["allowedUses", "evidenceReference", "status", "territory"]);
  const status = text(rights.status);
  if (status !== "owned" && status !== "reference_only") {
    throw new TypeError("The astrology publication rights status is invalid.");
  }
  const allowedUses = textArray(rights.allowedUses, 1, 5);
  if (
    status === "reference_only" &&
    (allowedUses.length !== 1 || allowedUses.at(0) !== "factual_citation")
  ) {
    throw new TypeError("Reference-only astrology material cannot authorize content reuse.");
  }
  if (
    sourceId === "rituvia.editorial.astrology-education" &&
    allowedUses.join("\u0000") !==
      ["public_display", "commercial_use", "seo_publication", "translation"].join("\u0000")
  ) {
    throw new TypeError("Astrology editorial content requires the exact approved rights.");
  }
  return Object.freeze({
    claims: textArray(candidate.claims, 3, 4),
    creator: text(candidate.creator),
    identifier: text(candidate.identifier),
    publisher: text(candidate.publisher),
    rights: Object.freeze({
      allowedUses,
      evidenceReference: text(rights.evidenceReference),
      status,
      territory: literal(rights.territory, "worldwide"),
    }),
    sourceId: sourceId as AstrologyPublicationSourceV1["sourceId"],
    sourceType: sourceType as AstrologyPublicationSourceV1["sourceType"],
    title: text(candidate.title),
    version: text(candidate.version, 40),
  });
};

const parseSection = (value: unknown): AstrologyPublicationSectionV1 => {
  const candidate = record(value);
  exactKeys(candidate, ["bullets", "heading", "paragraphs"]);
  return Object.freeze({
    bullets: textArray(candidate.bullets, 3, 5),
    heading: text(candidate.heading, 140),
    paragraphs: textArray(candidate.paragraphs, 1, 2),
  });
};

const parseTable = (value: unknown): AstrologyPublicationTableV1 => {
  const candidate = record(value);
  exactKeys(candidate, ["caption", "columns", "rows"]);
  if (!Array.isArray(candidate.rows) || candidate.rows.length < 3 || candidate.rows.length > 8) {
    throw new TypeError("The astrology publication table row inventory is invalid.");
  }
  return Object.freeze({
    caption: text(candidate.caption, 180),
    columns: fixedTuple(candidate.columns, "The astrology table requires three columns."),
    rows: Object.freeze(
      candidate.rows.map((row) =>
        fixedTuple(row, "Every astrology table row requires three cells."),
      ),
    ),
  });
};

const parseGuide = (value: unknown): AstrologyPublicationGuideV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "answer",
    "description",
    "limitations",
    "sections",
    "slug",
    "sourceRefs",
    "table",
    "title",
  ]);
  const slug = text(candidate.slug);
  if (!astrologyGuideSlugs.some((allowed) => allowed === slug)) {
    throw new TypeError("The astrology publication guide slug is invalid.");
  }
  if (!Array.isArray(candidate.sections) || candidate.sections.length !== 2) {
    throw new TypeError("The astrology publication guide requires two substantive sections.");
  }
  return Object.freeze({
    answer: text(candidate.answer),
    description: text(candidate.description, 360),
    limitations: fixedTuple(
      candidate.limitations,
      "The astrology guide requires three limitations.",
    ),
    sections: Object.freeze([
      parseSection(candidate.sections.at(0)),
      parseSection(candidate.sections.at(1)),
    ]) as readonly [AstrologyPublicationSectionV1, AstrologyPublicationSectionV1],
    slug: slug as AstrologyGuideSlug,
    sourceRefs: textArray(candidate.sourceRefs, 2, 3),
    table: parseTable(candidate.table),
    title: text(candidate.title, 140),
  });
};

const validateReferences = (
  guides: readonly AstrologyPublicationGuideV1[],
  sources: readonly AstrologyPublicationSourceV1[],
): void => {
  const approved = new Set(sources.map(({ sourceId, version }) => `${sourceId}@${version}`));
  if (
    guides.flatMap(({ sourceRefs }) => sourceRefs).some((reference) => !approved.has(reference))
  ) {
    throw new TypeError("The astrology publication contains an unknown source reference.");
  }
};

const validatePublicSafety = (catalog: unknown): void => {
  const serialized = JSON.stringify(catalog).normalize("NFKC");
  const prohibited = [
    /\b(?:guarantees?|destined|fated|certainly predicts?|proves? your personality)\b/iu,
    /\b(?:diagnos(?:e|es|is)|medical advice|legal advice|investment advice)\b/iu,
    /\b(?:your partner|your ex|they) (?:secretly|definitely|certainly) (?:thinks?|feels?|wants?)\b/iu,
    /\b(?:curse removal|psychic attack|supernatural persecution|death timing)\b/iu,
    /\b(?:paid|premium).{0,40}\b(?:stronger|powerful|effective|accurate)\b/iu,
  ];
  if (prohibited.some((pattern) => pattern.test(serialized))) {
    throw new TypeError("The astrology publication contains a prohibited claim.");
  }
};

export const parseAstrologyPublicationCatalogV1 = (
  value: unknown,
): AstrologyPublicationCatalogV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "audience",
    "catalogId",
    "contentType",
    "editorial",
    "guides",
    "hub",
    "labels",
    "locale",
    "method",
    "publicationPolicy",
    "publicationStatus",
    "riskClassification",
    "schemaVersion",
    "sources",
    "title",
    "version",
  ]);
  if (
    !Array.isArray(candidate.guides) ||
    candidate.guides.length !== astrologyGuideSlugs.length ||
    !Array.isArray(candidate.sources) ||
    candidate.sources.length !== sourceIds.length
  ) {
    throw new TypeError("The astrology publication inventory is incomplete.");
  }
  const guides = Object.freeze(candidate.guides.map(parseGuide));
  const sources = Object.freeze(candidate.sources.map(parseSource));
  if (
    guides.map(({ slug }) => slug).join("\u0000") !== astrologyGuideSlugs.join("\u0000") ||
    sources.map(({ sourceId }) => sourceId).join("\u0000") !== sourceIds.join("\u0000")
  ) {
    throw new TypeError("The astrology publication inventory order is invalid.");
  }
  validateReferences(guides, sources);
  const hub = record(candidate.hub);
  exactKeys(hub, ["answer", "boundary", "description", "eyebrow", "sourceNote", "title"]);
  const labels = record(candidate.labels);
  exactKeys(labels, [
    "backToHub",
    "calculatorAction",
    "guideListTitle",
    "limitationsTitle",
    "privacyAction",
    "relatedGuidesTitle",
    "safetyAction",
    "sourceTitle",
    "tableTitle",
  ]);
  const policy = record(candidate.publicationPolicy);
  exactKeys(policy, [
    "calculatorPath",
    "indexingAllowed",
    "personalizedPagesIndexable",
    "profileDoorwayRoutesAllowed",
    "publicPublicationAllowed",
  ]);
  const catalog = Object.freeze({
    audience: literal(candidate.audience, "adults"),
    catalogId: literal(candidate.catalogId, "rituvia.astrology.western-natal-education.en"),
    contentType: literal(candidate.contentType, "astrology_education_catalog"),
    editorial: parseEditorial(candidate.editorial),
    guides,
    hub: Object.freeze({
      answer: text(hub.answer),
      boundary: text(hub.boundary),
      description: text(hub.description, 360),
      eyebrow: text(hub.eyebrow, 80),
      sourceNote: text(hub.sourceNote),
      title: text(hub.title, 140),
    }),
    labels: Object.freeze({
      backToHub: text(labels.backToHub, 100),
      calculatorAction: text(labels.calculatorAction, 100),
      guideListTitle: text(labels.guideListTitle, 140),
      limitationsTitle: text(labels.limitationsTitle, 140),
      privacyAction: text(labels.privacyAction, 100),
      relatedGuidesTitle: text(labels.relatedGuidesTitle, 140),
      safetyAction: text(labels.safetyAction, 100),
      sourceTitle: text(labels.sourceTitle, 140),
      tableTitle: text(labels.tableTitle, 140),
    }),
    locale: literal(candidate.locale, "en"),
    method: literal(candidate.method, "western_natal"),
    publicationPolicy: Object.freeze({
      calculatorPath: literal(policy.calculatorPath, "/en/readings/astrology"),
      indexingAllowed: literal(policy.indexingAllowed, true),
      personalizedPagesIndexable: literal(policy.personalizedPagesIndexable, false),
      profileDoorwayRoutesAllowed: literal(policy.profileDoorwayRoutesAllowed, false),
      publicPublicationAllowed: literal(policy.publicPublicationAllowed, true),
    }),
    publicationStatus: literal(candidate.publicationStatus, "approved"),
    riskClassification: literal(candidate.riskClassification, "sensitive_symbolic_education"),
    schemaVersion: literal(candidate.schemaVersion, "astrology-education-catalog.v1"),
    sources,
    title: text(candidate.title, 140),
    version: literal(candidate.version, "1.0.0"),
  });
  validatePublicSafety(catalog);
  return catalog;
};

export const astrologyPublicationCatalog = parseAstrologyPublicationCatalogV1(publicationSource);

export const getAstrologyPublicationGuide = (
  slug: AstrologyGuideSlug,
): AstrologyPublicationGuideV1 => {
  const guide = astrologyPublicationCatalog.guides.find((candidate) => candidate.slug === slug);
  if (guide === undefined) {
    throw new TypeError("The astrology publication guide is unavailable.");
  }
  return guide;
};
