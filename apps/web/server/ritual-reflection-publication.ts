import "server-only";

import { parseRitualCatalogV1 } from "@rituvia/domain";

import publicationSource from "../../../content/traditions/ritual/rituvia-ritual-reflection-library.en.v1.json";
import ritualCatalogSource from "../../../content/traditions/ritual/rituvia-original.en.v1.json";
import {
  ritualReflectionGuideSlugs,
  type RitualReflectionGuideSlug,
} from "../app/_i18n/ritual-reflection-public-routes";

type UnknownRecord = Record<string, unknown>;

type RitualReflectionEditorialV1 = Readonly<{
  approvalReference: "D-082";
  authorId: "product.codex";
  changeReason: string;
  effectiveDate: "2026-07-29";
  requiredApprovalRole: "owner";
  reviewDueDate: "2027-07-28";
  reviewedDate: "2026-07-28";
  reviewerId: "owner";
  reviewerRole: "owner";
  status: "approved";
  supersedes: null;
}>;

export type RitualReflectionSourceV1 = Readonly<{
  claims: readonly [string, string, string];
  creator: string;
  identifier: string;
  publisher: "RITUVIA";
  rights: Readonly<{
    allowedUses: readonly string[];
    evidenceReference: "D-047" | "D-082";
    status: "owned";
    territory: "worldwide";
  }>;
  sourceId:
    "rituvia.editorial.ritual-reflection-library" | "rituvia.ritual.original-secular-catalog";
  sourceType: "approved_product_catalog" | "original_editorial";
  title: string;
  version: "1.0.0";
}>;

export type RitualReflectionCatalogBindingV1 = Readonly<{
  itemCode: "free_candle" | "free_incense";
  itemVersion: "1.0.0";
  steps: readonly ["prepare", "light", "breathe", "pause", "complete"];
  templateCode: "free-candle-pause" | "free-incense-pause";
  templateVersion: "1.0.0";
}>;

export type RitualReflectionGuideV1 = Readonly<{
  answer: string;
  catalogBinding: RitualReflectionCatalogBindingV1 | null;
  description: string;
  guideId:
    | "intention-and-small-action"
    | "private-reflection-journal"
    | "revisit-a-reflection"
    | "virtual-candle-reflection"
    | "virtual-incense-reflection";
  kind: "intention" | "private_reflection" | "revisit" | "virtual_ritual";
  limitations: readonly [string, string, string];
  reflectionQuestions: readonly [string, string];
  slug: RitualReflectionGuideSlug;
  sourceRefs:
    | readonly ["rituvia.editorial.ritual-reflection-library@1.0.0"]
    | readonly [
        "rituvia.ritual.original-secular-catalog@1.0.0",
        "rituvia.editorial.ritual-reflection-library@1.0.0",
      ];
  steps: readonly [string, string, string, string];
  title: string;
}>;

type RitualReflectionLabelsV1 = Readonly<{
  aiAssistanceTitle: string;
  aiAssistanceValue: string;
  backToHub: string;
  experienceAction: string;
  guideListTitle: string;
  limitsTitle: string;
  pendingReviewValue: string;
  questionsTitle: string;
  relatedTitle: string;
  reviewDueTitle: string;
  reviewedDateTitle: string;
  safetyAction: string;
  sourceTitle: string;
  stepsTitle: string;
}>;

export type RitualReflectionPublicationV1 = Readonly<{
  audience: "adults";
  catalogId: "rituvia.ritual-reflection-library.en";
  contentType: "ritual_reflection_library";
  editorial: RitualReflectionEditorialV1;
  guides: readonly RitualReflectionGuideV1[];
  hub: Readonly<{
    answer: string;
    boundary: string;
    description: string;
    eyebrow: string;
    sourceNote: string;
    title: string;
  }>;
  labels: RitualReflectionLabelsV1;
  locale: "en";
  method: "rituvia_original_secular";
  publicationPolicy: Readonly<{
    aiRetrievalAllowed: false;
    experiencePath: "/en/sanctuary";
    indexingAllowed: true;
    occasionDoorwayRoutesAllowed: false;
    personalizedResultsIndexable: false;
    physicalPracticeInstructionsAllowed: false;
    publicPublicationAllowed: true;
  }>;
  publicationStatus: "approved";
  riskClassification: "low_risk_symbolic_education";
  schemaVersion: "ritual-reflection-library.v1";
  sourceCatalog: Readonly<{
    catalogId: "rituvia-original-secular";
    publicationId: "rituvia-original.en.2026-07-23";
    sha256: "a31e09b1f3ef2d905a77d3eee499d69ff82b5ed52e271a52b922a06b208b29aa";
    version: "1.0.0";
  }>;
  sources: readonly RitualReflectionSourceV1[];
  title: string;
  version: "1.0.0";
}>;

const prohibitedClaims = /\b(?:will|can) (?:guarantee|manifest|heal|cleanse|protect|attract)\b/iu;
const prohibitedPracticeInstructions =
  /\b(?:burn (?:a candle|incense)|follow this ancient ritual|hold your breath|inhale (?:the )?smoke|light (?:a|the) physical candle|religious authority|sacred (?:practice|ritual))\b/iu;
const unsafePrivateFields =
  /\b(?:birth time|journal entry text|private question|relationship name|your diagnosis)\b/iu;

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("The ritual and reflection publication contract requires an object.");
  }
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) {
    throw new TypeError("The ritual and reflection publication contract has unexpected fields.");
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
    throw new TypeError("The ritual and reflection publication contains unsafe text.");
  }
  return value;
};

const safeEditorialText = (value: unknown, maximum = 2_400): string => {
  const parsed = text(value, maximum);
  if (
    prohibitedClaims.test(parsed) ||
    prohibitedPracticeInstructions.test(parsed) ||
    unsafePrivateFields.test(parsed)
  ) {
    throw new TypeError("The ritual and reflection publication contains a prohibited claim.");
  }
  return parsed;
};

const literal = <Value extends string | boolean | null>(value: unknown, expected: Value): Value => {
  if (value !== expected) {
    throw new TypeError("The ritual and reflection publication contains an invalid literal.");
  }
  return expected;
};

const textArray = (value: unknown, length: number): readonly string[] => {
  if (!Array.isArray(value) || value.length !== length) {
    throw new TypeError("The ritual and reflection publication contains an invalid text list.");
  }
  return Object.freeze(value.map((item) => safeEditorialText(item)));
};

const tuple2 = (value: unknown): readonly [string, string] =>
  textArray(value, 2) as readonly [string, string];
const tuple3 = (value: unknown): readonly [string, string, string] =>
  textArray(value, 3) as readonly [string, string, string];
const tuple4 = (value: unknown): readonly [string, string, string, string] =>
  textArray(value, 4) as readonly [string, string, string, string];

const parseEditorial = (value: unknown): RitualReflectionEditorialV1 => {
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
    approvalReference: literal(candidate.approvalReference, "D-082"),
    authorId: literal(candidate.authorId, "product.codex"),
    changeReason: safeEditorialText(candidate.changeReason),
    effectiveDate: literal(candidate.effectiveDate, "2026-07-29"),
    requiredApprovalRole: literal(candidate.requiredApprovalRole, "owner"),
    reviewDueDate: literal(candidate.reviewDueDate, "2027-07-28"),
    reviewedDate: literal(candidate.reviewedDate, "2026-07-28"),
    reviewerId: literal(candidate.reviewerId, "owner"),
    reviewerRole: literal(candidate.reviewerRole, "owner"),
    status: literal(candidate.status, "approved"),
    supersedes: literal(candidate.supersedes, null),
  });
};

const parseCatalogBinding = (
  value: unknown,
  slug: RitualReflectionGuideSlug,
): RitualReflectionCatalogBindingV1 | null => {
  if (value === null) return null;
  const candidate = record(value);
  exactKeys(candidate, ["itemCode", "itemVersion", "steps", "templateCode", "templateVersion"]);
  const candle = slug === "virtual-candle-reflection";
  const incense = slug === "virtual-incense-reflection";
  if (!candle && !incense) {
    throw new TypeError("Only virtual ritual guides may bind the ritual catalog.");
  }
  const expectedSteps = ["prepare", "light", "breathe", "pause", "complete"] as const;
  if (
    !Array.isArray(candidate.steps) ||
    candidate.steps.join("\u0000") !== expectedSteps.join("\u0000")
  ) {
    throw new TypeError("The ritual guide step binding is invalid.");
  }
  return Object.freeze({
    itemCode: literal(candidate.itemCode, candle ? "free_candle" : "free_incense"),
    itemVersion: literal(candidate.itemVersion, "1.0.0"),
    steps: Object.freeze(expectedSteps),
    templateCode: literal(
      candidate.templateCode,
      candle ? "free-candle-pause" : "free-incense-pause",
    ),
    templateVersion: literal(candidate.templateVersion, "1.0.0"),
  });
};

const parseGuide = (value: unknown): RitualReflectionGuideV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "answer",
    "catalogBinding",
    "description",
    "guideId",
    "kind",
    "limitations",
    "reflectionQuestions",
    "slug",
    "sourceRefs",
    "steps",
    "title",
  ]);
  const slug = text(candidate.slug);
  if (!ritualReflectionGuideSlugs.some((allowed) => allowed === slug)) {
    throw new TypeError("The ritual and reflection guide slug is invalid.");
  }
  const typedSlug = slug as RitualReflectionGuideSlug;
  const kind = text(candidate.kind);
  const expectedKind =
    typedSlug === "virtual-candle-reflection" || typedSlug === "virtual-incense-reflection"
      ? "virtual_ritual"
      : typedSlug === "intention-and-small-action"
        ? "intention"
        : typedSlug === "private-reflection-journal"
          ? "private_reflection"
          : "revisit";
  if (kind !== expectedKind || candidate.guideId !== typedSlug) {
    throw new TypeError("The ritual and reflection guide identity is invalid.");
  }
  const sourceRefs = candidate.sourceRefs;
  const expectedSourceRefs =
    expectedKind === "virtual_ritual"
      ? [
          "rituvia.ritual.original-secular-catalog@1.0.0",
          "rituvia.editorial.ritual-reflection-library@1.0.0",
        ]
      : ["rituvia.editorial.ritual-reflection-library@1.0.0"];
  if (
    !Array.isArray(sourceRefs) ||
    sourceRefs.join("\u0000") !== expectedSourceRefs.join("\u0000")
  ) {
    throw new TypeError("The ritual and reflection guide source binding is invalid.");
  }
  return Object.freeze({
    answer: safeEditorialText(candidate.answer),
    catalogBinding: parseCatalogBinding(candidate.catalogBinding, typedSlug),
    description: safeEditorialText(candidate.description, 320),
    guideId: typedSlug,
    kind: expectedKind,
    limitations: tuple3(candidate.limitations),
    reflectionQuestions: tuple2(candidate.reflectionQuestions),
    slug: typedSlug,
    sourceRefs: Object.freeze([...expectedSourceRefs]) as RitualReflectionGuideV1["sourceRefs"],
    steps: tuple4(candidate.steps),
    title: safeEditorialText(candidate.title, 140),
  });
};

const parseSource = (value: unknown): RitualReflectionSourceV1 => {
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
    sourceId !== "rituvia.ritual.original-secular-catalog" &&
    sourceId !== "rituvia.editorial.ritual-reflection-library"
  ) {
    throw new TypeError("The ritual and reflection source is not approved.");
  }
  const rights = record(candidate.rights);
  exactKeys(rights, ["allowedUses", "evidenceReference", "status", "territory"]);
  const allowedUses =
    sourceId === "rituvia.ritual.original-secular-catalog"
      ? ["factual_citation", "public_display"]
      : ["public_display", "commercial_use", "seo_publication", "translation"];
  if (
    !Array.isArray(rights.allowedUses) ||
    rights.allowedUses.join("\u0000") !== allowedUses.join("\u0000")
  ) {
    throw new TypeError("The ritual and reflection source rights are invalid.");
  }
  const sourceType =
    sourceId === "rituvia.ritual.original-secular-catalog"
      ? "approved_product_catalog"
      : "original_editorial";
  return Object.freeze({
    claims: tuple3(candidate.claims),
    creator: text(candidate.creator),
    identifier: text(candidate.identifier),
    publisher: literal(candidate.publisher, "RITUVIA"),
    rights: Object.freeze({
      allowedUses: Object.freeze(allowedUses),
      evidenceReference:
        sourceId === "rituvia.ritual.original-secular-catalog"
          ? literal(rights.evidenceReference, "D-047")
          : literal(rights.evidenceReference, "D-082"),
      status: literal(rights.status, "owned"),
      territory: literal(rights.territory, "worldwide"),
    }),
    sourceId,
    sourceType: literal(candidate.sourceType, sourceType),
    title: text(candidate.title),
    version: literal(candidate.version, "1.0.0"),
  });
};

const parseTextRecord = (value: unknown, keys: readonly string[]): UnknownRecord => {
  const candidate = record(value);
  exactKeys(candidate, keys);
  return candidate;
};

export const parseRitualReflectionPublicationV1 = (
  value: unknown,
): RitualReflectionPublicationV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "audience",
    "catalogId",
    "contentType",
    "editorial",
    "guideRoutes",
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
    "title",
    "version",
  ]);

  const sourceCatalog = parseTextRecord(candidate.sourceCatalog, [
    "catalogId",
    "publicationId",
    "sha256",
    "version",
  ]);
  literal(sourceCatalog.catalogId, "rituvia-original-secular");
  literal(sourceCatalog.version, "1.0.0");
  literal(sourceCatalog.publicationId, "rituvia-original.en.2026-07-23");
  literal(sourceCatalog.sha256, "a31e09b1f3ef2d905a77d3eee499d69ff82b5ed52e271a52b922a06b208b29aa");

  const catalog = parseRitualCatalogV1(ritualCatalogSource);
  if (
    catalog.catalogId !== sourceCatalog.catalogId ||
    catalog.version !== sourceCatalog.version ||
    catalog.publicationId !== sourceCatalog.publicationId
  ) {
    throw new TypeError("The ritual source catalog identity is invalid.");
  }

  if (!Array.isArray(candidate.guideRoutes) || candidate.guideRoutes.length !== 5) {
    throw new TypeError("The ritual and reflection library requires exactly five guides.");
  }
  const guides = Object.freeze(candidate.guideRoutes.map(parseGuide));
  if (
    new Set(guides.map(({ slug }) => slug)).size !== ritualReflectionGuideSlugs.length ||
    !ritualReflectionGuideSlugs.every((slug) =>
      guides.some((candidateGuide) => candidateGuide.slug === slug),
    )
  ) {
    throw new TypeError("The ritual and reflection route inventory is incomplete.");
  }
  for (const guide of guides.filter(
    (
      candidateGuide,
    ): candidateGuide is RitualReflectionGuideV1 & {
      catalogBinding: RitualReflectionCatalogBindingV1;
    } => candidateGuide.catalogBinding !== null,
  )) {
    const binding = guide.catalogBinding;
    const item = catalog.items.find(
      (candidateItem) =>
        candidateItem.code === binding.itemCode && candidateItem.version === binding.itemVersion,
    );
    const template = catalog.templates.find(
      (candidateTemplate) =>
        candidateTemplate.code === binding.templateCode &&
        candidateTemplate.version === binding.templateVersion,
    );
    if (
      item === undefined ||
      template === undefined ||
      item.kind !== "free_object" ||
      item.access.kind !== "free" ||
      item.experienceScope !== "symbolic_reflection_only" ||
      item.externalOutcome !== "not_guaranteed" ||
      item.template.code !== template.code ||
      item.template.version !== template.version ||
      template.steps.join("\u0000") !== binding.steps.join("\u0000") ||
      template.audioDefault !== "off" ||
      !template.linearAlternative ||
      template.reducedMotionMode !== "static_equivalent"
    ) {
      throw new TypeError("The virtual ritual guide does not match the approved free catalog.");
    }
  }

  const hub = parseTextRecord(candidate.hub, [
    "answer",
    "boundary",
    "description",
    "eyebrow",
    "sourceNote",
    "title",
  ]);
  const labels = parseTextRecord(candidate.labels, [
    "aiAssistanceTitle",
    "aiAssistanceValue",
    "backToHub",
    "experienceAction",
    "guideListTitle",
    "limitsTitle",
    "pendingReviewValue",
    "questionsTitle",
    "relatedTitle",
    "reviewDueTitle",
    "reviewedDateTitle",
    "safetyAction",
    "sourceTitle",
    "stepsTitle",
  ]);
  const publicationPolicy = parseTextRecord(candidate.publicationPolicy, [
    "aiRetrievalAllowed",
    "experiencePath",
    "indexingAllowed",
    "occasionDoorwayRoutesAllowed",
    "personalizedResultsIndexable",
    "physicalPracticeInstructionsAllowed",
    "publicPublicationAllowed",
  ]);
  if (!Array.isArray(candidate.sources) || candidate.sources.length !== 2) {
    throw new TypeError("The ritual and reflection library requires exactly two sources.");
  }

  return Object.freeze({
    audience: literal(candidate.audience, "adults"),
    catalogId: literal(candidate.catalogId, "rituvia.ritual-reflection-library.en"),
    contentType: literal(candidate.contentType, "ritual_reflection_library"),
    editorial: parseEditorial(candidate.editorial),
    guides,
    hub: Object.freeze({
      answer: safeEditorialText(hub.answer),
      boundary: safeEditorialText(hub.boundary),
      description: safeEditorialText(hub.description),
      eyebrow: safeEditorialText(hub.eyebrow),
      sourceNote: safeEditorialText(hub.sourceNote),
      title: safeEditorialText(hub.title),
    }),
    labels: Object.freeze(
      Object.fromEntries(
        Object.entries(labels).map(([key, value]) => [key, safeEditorialText(value)]),
      ) as RitualReflectionLabelsV1,
    ),
    locale: literal(candidate.locale, "en"),
    method: literal(candidate.method, "rituvia_original_secular"),
    publicationPolicy: Object.freeze({
      aiRetrievalAllowed: literal(publicationPolicy.aiRetrievalAllowed, false),
      experiencePath: literal(publicationPolicy.experiencePath, "/en/sanctuary"),
      indexingAllowed: literal(publicationPolicy.indexingAllowed, true),
      occasionDoorwayRoutesAllowed: literal(publicationPolicy.occasionDoorwayRoutesAllowed, false),
      personalizedResultsIndexable: literal(publicationPolicy.personalizedResultsIndexable, false),
      physicalPracticeInstructionsAllowed: literal(
        publicationPolicy.physicalPracticeInstructionsAllowed,
        false,
      ),
      publicPublicationAllowed: literal(publicationPolicy.publicPublicationAllowed, true),
    }),
    publicationStatus: literal(candidate.publicationStatus, "approved"),
    riskClassification: literal(candidate.riskClassification, "low_risk_symbolic_education"),
    schemaVersion: literal(candidate.schemaVersion, "ritual-reflection-library.v1"),
    sourceCatalog: Object.freeze({
      catalogId: "rituvia-original-secular",
      publicationId: "rituvia-original.en.2026-07-23",
      sha256: "a31e09b1f3ef2d905a77d3eee499d69ff82b5ed52e271a52b922a06b208b29aa",
      version: "1.0.0",
    }),
    sources: Object.freeze(candidate.sources.map(parseSource)),
    title: safeEditorialText(candidate.title, 140),
    version: literal(candidate.version, "1.0.0"),
  });
};

export const ritualReflectionPublication = parseRitualReflectionPublicationV1(publicationSource);

export const getRitualReflectionGuide = (
  slug: RitualReflectionGuideSlug,
): RitualReflectionGuideV1 => {
  const guide = ritualReflectionPublication.guides.find((candidate) => candidate.slug === slug);
  if (guide === undefined) {
    throw new TypeError("The ritual and reflection review candidate is unavailable.");
  }
  return guide;
};

export const getRitualReflectionSourceLabel = (reference: string): string => {
  const [sourceId, version] = reference.split("@");
  const source = ritualReflectionPublication.sources.find(
    (candidate) => candidate.sourceId === sourceId && candidate.version === version,
  );
  if (source === undefined) {
    throw new TypeError("The ritual and reflection review-candidate source is unavailable.");
  }
  return `${source.title}, version ${source.version}`;
};
