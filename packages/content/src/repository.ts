import { canonicalizeLocale } from "@rituvia/i18n";

type UnknownRecord = Record<string, unknown>;

export type EditorialStatus =
  | "approved"
  | "archived"
  | "cultural_review"
  | "deprecated"
  | "draft"
  | "localized_review"
  | "published"
  | "safety_review"
  | "source_checked"
  | "translation_ready";

export type EditorialAllowedUse =
  | "commercial_use"
  | "factual_citation"
  | "internal_preview"
  | "public_display"
  | "seo_publication"
  | "translation";

export type EditorialSourceV1 = Readonly<{
  claimsReviewed: boolean;
  creator: string;
  disagreementNotes: string;
  geography: string;
  language: string;
  locator: string;
  publicationDate: string | null;
  publisher: string;
  reviewDueDate: string;
  reviewedDate: string;
  reviewerId: string;
  rights: Readonly<{
    allowedUses: readonly EditorialAllowedUse[];
    evidenceReference: string;
    expiresDate: string | null;
    status: "licensed" | "owned" | "public_domain" | "reference_only";
    territory: string;
  }>;
  sourceId: string;
  sourceType: "institutional" | "original" | "primary" | "product_decision" | "technical";
  title: string;
  tradition: string;
  version: string;
}>;

export type EditorialClaimV1 = Readonly<{
  classification: "fact" | "interpretation" | "product_guidance" | "tradition";
  claimId: string;
  sourceIds: readonly string[];
  statement: string;
}>;

export type EditorialRecordV1 = Readonly<{
  artifact: Readonly<{
    path: string;
    sha256: string;
  }>;
  audience: "adults" | "all";
  author: Readonly<{
    aiAssistance: "draft_only" | "none";
    id: string;
    role: "external" | "owner" | "staff";
  }>;
  claimRefs: readonly string[];
  contentId: string;
  contentType:
    | "article_cluster"
    | "educational_catalog"
    | "legal_policy"
    | "lifecycle_messages"
    | "ritual_catalog"
    | "ui_messages";
  lifecycle: Readonly<{
    changeReason: string;
    deprecatedDate: string | null;
    effectiveDate: string;
    replacementRecordId: string | null;
    supersedesRecordId: string | null;
  }>;
  lineageId: string;
  locale: string;
  localization: Readonly<
    | {
        kind: "source";
        method: "original";
        sourceArtifactSha256: null;
        sourceRecordId: null;
        sourceVersion: null;
        status: "source_ready";
      }
    | {
        kind: "translation";
        method: "human" | "machine_then_human";
        sourceArtifactSha256: string;
        sourceRecordId: string;
        sourceVersion: string;
        status: "approved" | "human_review" | "stale" | "withdrawn";
      }
  >;
  methodOrTradition: string;
  publication: Readonly<{
    indexingAllowed: boolean;
    previewAllowed: boolean;
    publishAllowed: boolean;
  }>;
  recordId: string;
  review: Readonly<{
    approvalReference: string;
    requiredRole: "owner" | "qualified" | "reviewer";
    reviewDueDate: string;
    reviewedDate: string;
    reviewerId: string;
    reviewerRole: "owner" | "qualified" | "reviewer";
  }>;
  rights: Readonly<{
    allowedUses: readonly EditorialAllowedUse[];
    evidenceReference: string;
    expiresDate: string | null;
    owner: string;
    status: "licensed" | "owned" | "public_domain";
    territory: string;
  }>;
  risk: Readonly<{
    culturalReviewRequired: boolean;
    legalReviewRequired: boolean;
    prohibitedClaimsChecked: boolean;
    level: "legal" | "low" | "payment" | "safety" | "spiritual";
  }>;
  seo: Readonly<{
    canonicalPaths: readonly string[];
    description: string;
    title: string;
  }> | null;
  sourceRefs: readonly string[];
  status: EditorialStatus;
  version: string;
}>;

export type EditorialRepositoryV1 = Readonly<{
  claims: readonly EditorialClaimV1[];
  records: readonly EditorialRecordV1[];
  repositoryId: string;
  schemaVersion: "rituvia-editorial-repository.v1";
  sources: readonly EditorialSourceV1[];
  version: string;
}>;

export type EditorialGateFinding = Readonly<{
  code:
    | "approval"
    | "artifact"
    | "deprecated"
    | "indexing"
    | "locale"
    | "localization"
    | "preview"
    | "publication"
    | "review"
    | "rights"
    | "safety"
    | "source"
    | "transition";
  recordId: string;
}>;

export type EditorialPreviewContext = Readonly<{
  actorRole: "editor" | "owner" | "reviewer";
  actualArtifactSha256: string;
}>;

export type EditorialPublicationContext = Readonly<{
  actualArtifactSha256: string;
  approvedLocales: ReadonlySet<string>;
  approvedRecordAuthorities: ReadonlySet<string>;
  approvedSourceAuthorities: ReadonlySet<string>;
  asOfDate: string;
}>;

export type EditorialPreviewAuthorization = Readonly<{
  artifactSha256: string;
  cacheControl: "private, no-store";
  locale: string;
  mode: "preview";
  recordId: string;
  robots: "noindex, nofollow, noarchive";
}>;

export type EditorialPublicationAuthorization = Readonly<{
  artifactSha256: string;
  canonicalPaths: readonly string[];
  indexingAllowed: boolean;
  locale: string;
  mode: "publication";
  recordId: string;
  reviewDueDate: string;
  robots: "index, follow" | "noindex, follow";
}>;

const forbiddenControlPattern =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const identifierPattern = /^[a-z0-9][a-z0-9._-]{1,159}$/u;
const versionPattern = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/u;
const checksumPattern = /^[0-9a-f]{64}$/u;
const datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u;
const artifactPathPattern = /^content\/[A-Za-z0-9._/[\]-]+\.json$/u;
const canonicalPathPattern = /^\/[a-z][A-Za-z0-9-]*(?:\/[A-Za-z0-9-]+)*$/u;

const editorialStatuses = new Set<EditorialStatus>([
  "approved",
  "archived",
  "cultural_review",
  "deprecated",
  "draft",
  "localized_review",
  "published",
  "safety_review",
  "source_checked",
  "translation_ready",
]);
const editorialTransitions = new Map<EditorialStatus, ReadonlySet<EditorialStatus>>([
  ["draft", new Set(["archived", "source_checked"])],
  [
    "source_checked",
    new Set(["approved", "archived", "cultural_review", "safety_review", "translation_ready"]),
  ],
  ["cultural_review", new Set(["archived", "safety_review", "translation_ready"])],
  ["safety_review", new Set(["approved", "archived", "translation_ready"])],
  ["translation_ready", new Set(["approved", "archived", "localized_review"])],
  ["localized_review", new Set(["approved", "archived"])],
  ["approved", new Set(["archived", "published"])],
  ["published", new Set(["archived", "deprecated"])],
  ["deprecated", new Set(["archived"])],
  ["archived", new Set()],
]);
const editorialAllowedUses = new Set<EditorialAllowedUse>([
  "commercial_use",
  "factual_citation",
  "internal_preview",
  "public_display",
  "seo_publication",
  "translation",
]);

const record = (value: unknown): UnknownRecord => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("The editorial value must be an object.");
  }
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected.at(index))
  ) {
    throw new TypeError("The editorial value has an invalid field inventory.");
  }
};

const text = (value: unknown, maximum = 1_000): string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximum ||
    value.trim() !== value ||
    forbiddenControlPattern.test(value)
  ) {
    throw new TypeError("The editorial value contains invalid text.");
  }
  return value;
};

const identifier = (value: unknown): string => {
  const parsed = text(value, 160);
  if (!identifierPattern.test(parsed)) throw new TypeError("The editorial identifier is invalid.");
  return parsed;
};

const version = (value: unknown): string => {
  const parsed = text(value, 40);
  if (!versionPattern.test(parsed)) throw new TypeError("The editorial version is invalid.");
  return parsed;
};

const compareVersions = (left: string, right: string): number => {
  const [leftMajor = 0, leftMinor = 0, leftPatch = 0] = left
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  const [rightMajor = 0, rightMinor = 0, rightPatch = 0] = right
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  return leftMajor - rightMajor || leftMinor - rightMinor || leftPatch - rightPatch;
};

const checksum = (value: unknown): string => {
  const parsed = text(value, 64);
  if (!checksumPattern.test(parsed)) throw new TypeError("The editorial checksum is invalid.");
  return parsed;
};

const date = (value: unknown): string => {
  const parsed = text(value, 10);
  const instant = new Date(`${parsed}T00:00:00.000Z`);
  if (
    !datePattern.test(parsed) ||
    Number.isNaN(instant.valueOf()) ||
    instant.toISOString().slice(0, 10) !== parsed
  ) {
    throw new TypeError("The editorial date is invalid.");
  }
  return parsed;
};

const nullableDate = (value: unknown): string | null => (value === null ? null : date(value));

const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") throw new TypeError("The editorial boolean is invalid.");
  return value;
};

const literal = <Value extends string>(value: unknown, expected: Value): Value => {
  if (value !== expected) throw new TypeError("The editorial literal is invalid.");
  return expected;
};

const recordReference = (value: unknown): string => {
  const parsed = text(value, 220);
  const separator = parsed.lastIndexOf("@");
  if (separator < 2) throw new TypeError("The editorial record reference is invalid.");
  identifier(parsed.slice(0, separator));
  version(parsed.slice(separator + 1));
  return parsed;
};

const optionalRecordReference = (value: unknown): string | null =>
  value === null ? null : recordReference(value);

const nullValue = (value: unknown): null => {
  if (value !== null) throw new TypeError("The editorial null binding is invalid.");
  return null;
};

const stringList = <Value extends string>(
  value: unknown,
  parser: (item: unknown) => Value,
  maximum = 100,
): readonly Value[] => {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError("The editorial list is invalid.");
  }
  const parsed = value.map(parser);
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError("The editorial list contains duplicates.");
  }
  return Object.freeze(parsed);
};

const enumValue = <Value extends string>(
  value: unknown,
  allowed: ReadonlySet<Value>,
  label: string,
): Value => {
  const parsed = text(value, 60) as Value;
  if (!allowed.has(parsed)) throw new TypeError(`The editorial ${label} is invalid.`);
  return parsed;
};

const allowedUses = (value: unknown): readonly EditorialAllowedUse[] =>
  stringList(value, (item) => enumValue(item, editorialAllowedUses, "allowed use"), 10);

const parseSource = (value: unknown): EditorialSourceV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "claimsReviewed",
    "creator",
    "disagreementNotes",
    "geography",
    "language",
    "locator",
    "publicationDate",
    "publisher",
    "reviewDueDate",
    "reviewedDate",
    "reviewerId",
    "rights",
    "sourceId",
    "sourceType",
    "title",
    "tradition",
    "version",
  ]);
  const rights = record(candidate.rights);
  exactKeys(rights, ["allowedUses", "evidenceReference", "expiresDate", "status", "territory"]);
  const reviewedDate = date(candidate.reviewedDate);
  const reviewDueDate = date(candidate.reviewDueDate);
  if (reviewDueDate < reviewedDate) throw new TypeError("The source review window is invalid.");
  const creator = text(candidate.creator, 300);
  const reviewerId = identifier(candidate.reviewerId);
  if (creator === reviewerId) {
    throw new TypeError("The editorial source creator and reviewer must be separate.");
  }
  const sourceType = enumValue(
    candidate.sourceType,
    new Set(["institutional", "original", "primary", "product_decision", "technical"] as const),
    "source type",
  );
  const rightsStatus = enumValue(
    rights.status,
    new Set(["licensed", "owned", "public_domain", "reference_only"] as const),
    "source rights status",
  );
  const parsedAllowedUses = allowedUses(rights.allowedUses);
  if (
    rightsStatus === "reference_only" &&
    parsedAllowedUses.some((use) => use !== "factual_citation")
  ) {
    throw new TypeError("Reference-only sources may only support factual citation.");
  }
  return Object.freeze({
    claimsReviewed: boolean(candidate.claimsReviewed),
    creator,
    disagreementNotes: text(candidate.disagreementNotes, 1_000),
    geography: text(candidate.geography, 120),
    language: canonicalizeLocale(text(candidate.language, 64)),
    locator: text(candidate.locator, 1_000),
    publicationDate: nullableDate(candidate.publicationDate),
    publisher: text(candidate.publisher, 300),
    reviewDueDate,
    reviewedDate,
    reviewerId,
    rights: Object.freeze({
      allowedUses: parsedAllowedUses,
      evidenceReference: text(rights.evidenceReference, 500),
      expiresDate: nullableDate(rights.expiresDate),
      status: rightsStatus,
      territory: text(rights.territory, 120),
    }),
    sourceId: identifier(candidate.sourceId),
    sourceType,
    title: text(candidate.title, 500),
    tradition: text(candidate.tradition, 200),
    version: version(candidate.version),
  });
};

const parseClaim = (value: unknown): EditorialClaimV1 => {
  const candidate = record(value);
  exactKeys(candidate, ["claimId", "classification", "sourceIds", "statement"]);
  return Object.freeze({
    classification: enumValue(
      candidate.classification,
      new Set(["fact", "interpretation", "product_guidance", "tradition"] as const),
      "claim classification",
    ),
    claimId: identifier(candidate.claimId),
    sourceIds: stringList(candidate.sourceIds, identifier, 20),
    statement: text(candidate.statement, 2_000),
  });
};

const parseRecord = (value: unknown): EditorialRecordV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "artifact",
    "audience",
    "author",
    "claimRefs",
    "contentId",
    "contentType",
    "lifecycle",
    "lineageId",
    "locale",
    "localization",
    "methodOrTradition",
    "publication",
    "recordId",
    "review",
    "rights",
    "risk",
    "seo",
    "sourceRefs",
    "status",
    "version",
  ]);
  const artifact = record(candidate.artifact);
  exactKeys(artifact, ["path", "sha256"]);
  const artifactPath = text(artifact.path, 240);
  if (!artifactPathPattern.test(artifactPath) || artifactPath.includes("..")) {
    throw new TypeError("The editorial artifact path is invalid.");
  }
  const author = record(candidate.author);
  exactKeys(author, ["aiAssistance", "id", "role"]);
  const lifecycle = record(candidate.lifecycle);
  exactKeys(lifecycle, [
    "changeReason",
    "deprecatedDate",
    "effectiveDate",
    "replacementRecordId",
    "supersedesRecordId",
  ]);
  const localization = record(candidate.localization);
  exactKeys(localization, [
    "kind",
    "method",
    "sourceArtifactSha256",
    "sourceRecordId",
    "sourceVersion",
    "status",
  ]);
  const publication = record(candidate.publication);
  exactKeys(publication, ["indexingAllowed", "previewAllowed", "publishAllowed"]);
  const review = record(candidate.review);
  exactKeys(review, [
    "approvalReference",
    "requiredRole",
    "reviewDueDate",
    "reviewedDate",
    "reviewerId",
    "reviewerRole",
  ]);
  const rights = record(candidate.rights);
  exactKeys(rights, [
    "allowedUses",
    "evidenceReference",
    "expiresDate",
    "owner",
    "status",
    "territory",
  ]);
  const risk = record(candidate.risk);
  exactKeys(risk, [
    "culturalReviewRequired",
    "legalReviewRequired",
    "level",
    "prohibitedClaimsChecked",
  ]);
  const status = enumValue(candidate.status, editorialStatuses, "status");
  const recordVersion = version(candidate.version);
  const contentId = identifier(candidate.contentId);
  const locale = canonicalizeLocale(text(candidate.locale, 64));
  const recordId = text(candidate.recordId, 220);
  if (recordId !== `${contentId}@${recordVersion}`) {
    throw new TypeError("The editorial record ID does not bind its content and version.");
  }
  const reviewedDate = date(review.reviewedDate);
  const reviewDueDate = date(review.reviewDueDate);
  if (reviewDueDate < reviewedDate) throw new TypeError("The editorial review window is invalid.");
  const requiredRole = enumValue(
    review.requiredRole,
    new Set(["owner", "qualified", "reviewer"] as const),
    "required review role",
  );
  const reviewerRole = enumValue(
    review.reviewerRole,
    new Set(["owner", "qualified", "reviewer"] as const),
    "reviewer role",
  );
  if (requiredRole === "owner" && reviewerRole !== "owner") {
    throw new TypeError("The editorial owner review is missing.");
  }
  if (requiredRole === "qualified" && !["owner", "qualified"].includes(reviewerRole)) {
    throw new TypeError("The editorial qualified review is missing.");
  }
  if (identifier(author.id) === identifier(review.reviewerId)) {
    throw new TypeError("The editorial author and reviewer must be separate.");
  }
  const parsedRightsUses = allowedUses(rights.allowedUses);
  const publishAllowed = boolean(publication.publishAllowed);
  const indexingAllowed = boolean(publication.indexingAllowed);
  if (
    publishAllowed &&
    (!parsedRightsUses.includes("public_display") || !parsedRightsUses.includes("commercial_use"))
  ) {
    throw new TypeError("Publishable editorial content lacks display or commercial rights.");
  }
  if (indexingAllowed && (!publishAllowed || !parsedRightsUses.includes("seo_publication"))) {
    throw new TypeError("Indexable editorial content lacks publication or SEO rights.");
  }
  const seo =
    candidate.seo === null
      ? null
      : (() => {
          const parsedSeo = record(candidate.seo);
          exactKeys(parsedSeo, ["canonicalPaths", "description", "title"]);
          const canonicalPaths = stringList(
            parsedSeo.canonicalPaths,
            (item) => {
              const path = text(item, 240);
              if (!canonicalPathPattern.test(path)) {
                throw new TypeError("The editorial canonical path is invalid.");
              }
              return path;
            },
            100,
          );
          if (canonicalPaths.length === 0) {
            throw new TypeError("The editorial SEO path inventory is empty.");
          }
          if (
            canonicalPaths.some(
              (canonicalPath) =>
                canonicalPath !== `/${locale}` && !canonicalPath.startsWith(`/${locale}/`),
            )
          ) {
            throw new TypeError("The editorial canonical path does not match its locale.");
          }
          return Object.freeze({
            canonicalPaths,
            description: text(parsedSeo.description, 500),
            title: text(parsedSeo.title, 200),
          });
        })();
  if (indexingAllowed !== (seo !== null)) {
    throw new TypeError("The editorial SEO metadata does not match indexing policy.");
  }
  const localizationKind = enumValue(
    localization.kind,
    new Set(["source", "translation"] as const),
    "localization kind",
  );
  const parsedLocalization =
    localizationKind === "source"
      ? Object.freeze({
          kind: "source" as const,
          method: literal(localization.method, "original"),
          sourceArtifactSha256: nullValue(localization.sourceArtifactSha256),
          sourceRecordId: nullValue(localization.sourceRecordId),
          sourceVersion: nullValue(localization.sourceVersion),
          status: literal(localization.status, "source_ready"),
        })
      : Object.freeze({
          kind: "translation" as const,
          method: enumValue(
            localization.method,
            new Set(["human", "machine_then_human"] as const),
            "translation method",
          ),
          sourceArtifactSha256: checksum(localization.sourceArtifactSha256),
          sourceRecordId: recordReference(localization.sourceRecordId),
          sourceVersion: version(localization.sourceVersion),
          status: enumValue(
            localization.status,
            new Set(["approved", "human_review", "stale", "withdrawn"] as const),
            "translation status",
          ),
        });
  const deprecatedDate = nullableDate(lifecycle.deprecatedDate);
  const replacementRecordId = optionalRecordReference(lifecycle.replacementRecordId);
  const supersedesRecordId = optionalRecordReference(lifecycle.supersedesRecordId);
  const hasDeprecation = deprecatedDate !== null && replacementRecordId !== null;
  if ((deprecatedDate === null) !== (replacementRecordId === null)) {
    throw new TypeError("The editorial deprecation metadata is invalid.");
  }
  if (status === "deprecated" && !hasDeprecation) {
    throw new TypeError("Deprecated editorial content requires a replacement.");
  }
  if (!["archived", "deprecated"].includes(status) && hasDeprecation) {
    throw new TypeError("Active editorial content cannot have a deprecation date.");
  }
  const effectiveDate = date(lifecycle.effectiveDate);
  if (deprecatedDate !== null && deprecatedDate < effectiveDate) {
    throw new TypeError("The editorial deprecation date precedes its effective date.");
  }
  const riskLevel = enumValue(
    risk.level,
    new Set(["legal", "low", "payment", "safety", "spiritual"] as const),
    "risk level",
  );
  const legalReviewRequired = boolean(risk.legalReviewRequired);
  if (riskLevel === "legal" && !legalReviewRequired) {
    throw new TypeError("Legal editorial content must require legal review.");
  }
  if (legalReviewRequired && !["owner", "qualified"].includes(reviewerRole)) {
    throw new TypeError("Legal editorial content lacks qualified review.");
  }
  const culturalReviewRequired = boolean(risk.culturalReviewRequired);
  if (culturalReviewRequired && !["owner", "qualified"].includes(reviewerRole)) {
    throw new TypeError("Culturally reviewed content lacks qualified review.");
  }
  return Object.freeze({
    artifact: Object.freeze({ path: artifactPath, sha256: checksum(artifact.sha256) }),
    audience: enumValue(candidate.audience, new Set(["adults", "all"] as const), "audience"),
    author: Object.freeze({
      aiAssistance: enumValue(
        author.aiAssistance,
        new Set(["draft_only", "none"] as const),
        "AI assistance",
      ),
      id: identifier(author.id),
      role: enumValue(author.role, new Set(["external", "owner", "staff"] as const), "author role"),
    }),
    claimRefs: stringList(candidate.claimRefs, identifier, 100),
    contentId,
    contentType: enumValue(
      candidate.contentType,
      new Set([
        "article_cluster",
        "educational_catalog",
        "legal_policy",
        "lifecycle_messages",
        "ritual_catalog",
        "ui_messages",
      ] as const),
      "content type",
    ),
    lifecycle: Object.freeze({
      changeReason: text(lifecycle.changeReason, 1_000),
      deprecatedDate,
      effectiveDate,
      replacementRecordId,
      supersedesRecordId,
    }),
    lineageId: identifier(candidate.lineageId),
    locale,
    localization: parsedLocalization,
    methodOrTradition: text(candidate.methodOrTradition, 200),
    publication: Object.freeze({
      indexingAllowed,
      previewAllowed: boolean(publication.previewAllowed),
      publishAllowed,
    }),
    recordId,
    review: Object.freeze({
      approvalReference: text(review.approvalReference, 300),
      requiredRole,
      reviewDueDate,
      reviewedDate,
      reviewerId: identifier(review.reviewerId),
      reviewerRole,
    }),
    rights: Object.freeze({
      allowedUses: parsedRightsUses,
      evidenceReference: text(rights.evidenceReference, 500),
      expiresDate: nullableDate(rights.expiresDate),
      owner: text(rights.owner, 300),
      status: enumValue(
        rights.status,
        new Set(["licensed", "owned", "public_domain"] as const),
        "rights status",
      ),
      territory: text(rights.territory, 120),
    }),
    risk: Object.freeze({
      culturalReviewRequired,
      legalReviewRequired,
      prohibitedClaimsChecked: boolean(risk.prohibitedClaimsChecked),
      level: riskLevel,
    }),
    seo,
    sourceRefs: stringList(candidate.sourceRefs, identifier, 100),
    status,
    version: recordVersion,
  });
};

const assertUnique = (values: readonly string[], label: string): void => {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`The editorial ${label} inventory contains duplicates.`);
  }
};

const assertCanonicalPathOwnership = (records: readonly EditorialRecordV1[]): void => {
  const owners = new Map<string, EditorialRecordV1[]>();
  for (const item of records) {
    for (const canonicalPath of item.seo?.canonicalPaths ?? []) {
      const current = owners.get(canonicalPath) ?? [];
      current.push(item);
      owners.set(canonicalPath, current);
    }
  }
  for (const items of owners.values()) {
    if (items.length < 2) continue;
    const lineage = items.at(0)?.lineageId;
    const locale = items.at(0)?.locale;
    if (
      items.some((item) => item.lineageId !== lineage || item.locale !== locale) ||
      items.filter((item) => !["archived", "deprecated"].includes(item.status)).length !== 1
    ) {
      throw new TypeError("The editorial canonical path inventory contains duplicates.");
    }
  }
};

const assertAcyclicSupersession = (records: readonly EditorialRecordV1[]): void => {
  const recordById = new Map(records.map((item) => [item.recordId, item]));
  for (const item of records) {
    const visited = new Set<string>();
    let current: EditorialRecordV1 | undefined = item;
    while (current !== undefined && current.lifecycle.replacementRecordId !== null) {
      if (visited.has(current.recordId)) {
        throw new TypeError("The editorial supersession graph contains a cycle.");
      }
      visited.add(current.recordId);
      current = recordById.get(current.lifecycle.replacementRecordId);
    }
  }
};

export const parseEditorialRepositoryV1 = (value: unknown): EditorialRepositoryV1 => {
  const candidate = record(value);
  exactKeys(candidate, [
    "claims",
    "records",
    "repositoryId",
    "schemaVersion",
    "sources",
    "version",
  ]);
  if (
    !Array.isArray(candidate.sources) ||
    candidate.sources.length < 1 ||
    candidate.sources.length > 5_000
  ) {
    throw new TypeError("The editorial source inventory is invalid.");
  }
  if (
    !Array.isArray(candidate.claims) ||
    candidate.claims.length < 1 ||
    candidate.claims.length > 10_000
  ) {
    throw new TypeError("The editorial claim inventory is invalid.");
  }
  if (
    !Array.isArray(candidate.records) ||
    candidate.records.length < 1 ||
    candidate.records.length > 10_000
  ) {
    throw new TypeError("The editorial record inventory is invalid.");
  }
  const sources = Object.freeze(candidate.sources.map(parseSource));
  const claims = Object.freeze(candidate.claims.map(parseClaim));
  const records = Object.freeze(candidate.records.map(parseRecord));
  assertUnique(
    sources.map(({ sourceId }) => sourceId),
    "source ID",
  );
  assertUnique(
    claims.map(({ claimId }) => claimId),
    "claim ID",
  );
  assertUnique(
    records.map(({ recordId }) => recordId),
    "record ID",
  );
  assertUnique(
    records.map(({ artifact }) => artifact.path),
    "artifact path",
  );
  assertCanonicalPathOwnership(records);
  assertAcyclicSupersession(records);
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const recordById = new Map(records.map((item) => [item.recordId, item]));
  for (const claim of claims) {
    if (
      claim.sourceIds.length < 1 ||
      claim.sourceIds.some((sourceId) => !sourceById.has(sourceId))
    ) {
      throw new TypeError("An editorial claim has an invalid source binding.");
    }
  }
  for (const item of records) {
    if (
      item.sourceRefs.length < 1 ||
      item.claimRefs.length < 1 ||
      item.sourceRefs.some((sourceId) => !sourceById.has(sourceId)) ||
      item.claimRefs.some((claimId) => !claimById.has(claimId))
    ) {
      throw new TypeError("An editorial record has an invalid evidence binding.");
    }
    for (const claimId of item.claimRefs) {
      const claim = claimById.get(claimId);
      if (claim?.sourceIds.some((sourceId) => !item.sourceRefs.includes(sourceId))) {
        throw new TypeError("An editorial record does not include every claim source.");
      }
    }
    if (item.lifecycle.supersedesRecordId !== null) {
      const previous = recordById.get(item.lifecycle.supersedesRecordId);
      if (
        previous === undefined ||
        previous.lineageId !== item.lineageId ||
        previous.locale !== item.locale ||
        compareVersions(previous.version, item.version) >= 0 ||
        previous.lifecycle.replacementRecordId !== item.recordId
      ) {
        throw new TypeError("The editorial supersession chain is invalid.");
      }
    }
    if (item.lifecycle.replacementRecordId !== null) {
      const replacement = recordById.get(item.lifecycle.replacementRecordId);
      if (
        replacement === undefined ||
        replacement.lifecycle.supersedesRecordId !== item.recordId ||
        replacement.lineageId !== item.lineageId ||
        replacement.locale !== item.locale
      ) {
        throw new TypeError("The editorial replacement chain is invalid.");
      }
    }
    if (item.localization.kind === "translation") {
      const source = recordById.get(item.localization.sourceRecordId);
      if (
        source === undefined ||
        source.localization.kind !== "source" ||
        source.lineageId !== item.lineageId ||
        source.locale === item.locale ||
        ["archived", "deprecated"].includes(source.status) ||
        !source.rights.allowedUses.includes("translation") ||
        source.version !== item.localization.sourceVersion ||
        source.artifact.sha256 !== item.localization.sourceArtifactSha256
      ) {
        throw new TypeError("The editorial translation source binding is invalid.");
      }
    }
  }
  return Object.freeze({
    claims,
    records,
    repositoryId: identifier(candidate.repositoryId),
    schemaVersion: literal(candidate.schemaVersion, "rituvia-editorial-repository.v1"),
    sources,
    version: version(candidate.version),
  });
};

export const getEditorialRecord = (
  repository: EditorialRepositoryV1,
  recordId: string,
): EditorialRecordV1 => {
  const item = repository.records.find((candidate) => candidate.recordId === recordId);
  if (item === undefined) throw new TypeError("The editorial record is unavailable.");
  return item;
};

const authorityPart = (value: string | boolean | null): string =>
  value === null ? "" : String(value);

export const editorialRecordAuthorityKey = (item: EditorialRecordV1): string =>
  [
    item.recordId,
    item.contentId,
    item.lineageId,
    item.version,
    item.contentType,
    item.status,
    item.artifact.sha256,
    item.artifact.path,
    item.audience,
    item.author.id,
    item.author.role,
    item.author.aiAssistance,
    item.methodOrTradition,
    [...item.claimRefs].sort().join(","),
    [...item.sourceRefs].sort().join(","),
    item.lifecycle.changeReason,
    item.lifecycle.effectiveDate,
    item.lifecycle.deprecatedDate,
    item.lifecycle.replacementRecordId,
    item.lifecycle.supersedesRecordId,
    item.review.approvalReference,
    item.review.reviewerId,
    item.review.reviewerRole,
    item.review.requiredRole,
    item.review.reviewedDate,
    item.review.reviewDueDate,
    item.locale,
    item.localization.kind,
    item.localization.method,
    item.localization.status,
    item.localization.sourceRecordId,
    item.localization.sourceVersion,
    item.localization.sourceArtifactSha256,
    item.rights.evidenceReference,
    item.rights.status,
    item.rights.owner,
    item.rights.territory,
    item.rights.expiresDate,
    [...item.rights.allowedUses].sort().join(","),
    item.publication.publishAllowed,
    item.publication.indexingAllowed,
    item.publication.previewAllowed,
    item.risk.level,
    item.risk.culturalReviewRequired,
    item.risk.legalReviewRequired,
    item.risk.prohibitedClaimsChecked,
    item.seo?.title ?? null,
    item.seo?.description ?? null,
    item.seo === null ? null : [...item.seo.canonicalPaths].sort().join(","),
  ]
    .map(authorityPart)
    .join("\u0000");

export const editorialSourceAuthorityKey = (source: EditorialSourceV1): string =>
  [
    source.sourceId,
    source.title,
    source.creator,
    source.publisher,
    source.publicationDate,
    source.locator,
    source.tradition,
    source.geography,
    source.language,
    source.sourceType,
    source.version,
    source.reviewerId,
    source.reviewedDate,
    source.reviewDueDate,
    source.disagreementNotes,
    source.rights.evidenceReference,
    source.rights.status,
    source.rights.territory,
    source.rights.expiresDate,
    [...source.rights.allowedUses].sort().join(","),
    source.claimsReviewed,
  ]
    .map(authorityPart)
    .join("\u0000");

export const assessEditorialStatusTransition = (
  recordId: string,
  currentStatus: EditorialStatus,
  nextStatus: EditorialStatus,
): readonly EditorialGateFinding[] => {
  if (currentStatus === nextStatus) return Object.freeze([]);
  return editorialTransitions.get(currentStatus)?.has(nextStatus) === true
    ? Object.freeze([])
    : Object.freeze([finding(recordId, "transition")]);
};

export const authorizeEditorialStatusTransition = (
  recordId: string,
  currentStatus: EditorialStatus,
  nextStatus: EditorialStatus,
): void => {
  assertAuthorized(assessEditorialStatusTransition(recordId, currentStatus, nextStatus));
};

const finding = (recordId: string, code: EditorialGateFinding["code"]): EditorialGateFinding =>
  Object.freeze({ code, recordId });

export const assessEditorialPreview = (
  repository: EditorialRepositoryV1,
  recordId: string,
  context: EditorialPreviewContext,
): readonly EditorialGateFinding[] => {
  const item = getEditorialRecord(repository, recordId);
  const findings: EditorialGateFinding[] = [];
  if (!item.publication.previewAllowed || item.status === "archived") {
    findings.push(finding(recordId, "preview"));
  }
  if (item.artifact.sha256 !== context.actualArtifactSha256) {
    findings.push(finding(recordId, "artifact"));
  }
  if (!["editor", "owner", "reviewer"].includes(context.actorRole)) {
    findings.push(finding(recordId, "preview"));
  }
  return Object.freeze(findings);
};

export const assessEditorialPublication = (
  repository: EditorialRepositoryV1,
  recordId: string,
  context: EditorialPublicationContext,
): readonly EditorialGateFinding[] => {
  const item = getEditorialRecord(repository, recordId);
  const findings: EditorialGateFinding[] = [];
  const asOfDate = date(context.asOfDate);
  if (!item.publication.publishAllowed || !["approved", "published"].includes(item.status)) {
    findings.push(finding(recordId, "publication"));
  }
  if (item.status === "deprecated" || item.status === "archived") {
    findings.push(finding(recordId, "deprecated"));
  }
  if (item.artifact.sha256 !== context.actualArtifactSha256) {
    findings.push(finding(recordId, "artifact"));
  }
  if (!context.approvedLocales.has(item.locale)) {
    findings.push(finding(recordId, "locale"));
  }
  if (
    !context.approvedRecordAuthorities.has(editorialRecordAuthorityKey(item)) ||
    item.review.reviewedDate > asOfDate
  ) {
    findings.push(finding(recordId, "approval"));
  }
  if (item.lifecycle.effectiveDate > asOfDate || item.review.reviewDueDate < asOfDate) {
    findings.push(finding(recordId, "review"));
  }
  if (
    !item.rights.allowedUses.includes("public_display") ||
    !item.rights.allowedUses.includes("commercial_use") ||
    (item.rights.expiresDate !== null && item.rights.expiresDate < asOfDate)
  ) {
    findings.push(finding(recordId, "rights"));
  }
  if (item.localization.kind === "translation" && item.localization.status !== "approved") {
    findings.push(finding(recordId, "localization"));
  }
  if (!item.risk.prohibitedClaimsChecked) {
    findings.push(finding(recordId, "safety"));
  }
  const sourceById = new Map(repository.sources.map((source) => [source.sourceId, source]));
  for (const sourceId of item.sourceRefs) {
    const source = sourceById.get(sourceId);
    if (
      source === undefined ||
      !context.approvedSourceAuthorities.has(editorialSourceAuthorityKey(source)) ||
      !source.claimsReviewed ||
      source.reviewedDate > asOfDate ||
      source.reviewDueDate < asOfDate ||
      (source.rights.expiresDate !== null && source.rights.expiresDate < asOfDate) ||
      !source.rights.allowedUses.some((use) => ["factual_citation", "public_display"].includes(use))
    ) {
      findings.push(finding(recordId, "source"));
      break;
    }
  }
  if (
    item.publication.indexingAllowed &&
    (item.seo === null || !item.rights.allowedUses.includes("seo_publication"))
  ) {
    findings.push(finding(recordId, "indexing"));
  }
  return Object.freeze(
    findings.filter(
      (candidate, index) => findings.findIndex((other) => other.code === candidate.code) === index,
    ),
  );
};

const assertAuthorized = (findings: readonly EditorialGateFinding[]): void => {
  if (findings.length > 0) {
    throw new TypeError(
      `Editorial authorization failed: ${findings.map(({ code }) => code).join(",")}`,
    );
  }
};

export const authorizeEditorialPreview = (
  repository: EditorialRepositoryV1,
  recordId: string,
  context: EditorialPreviewContext,
): EditorialPreviewAuthorization => {
  assertAuthorized(assessEditorialPreview(repository, recordId, context));
  const item = getEditorialRecord(repository, recordId);
  return Object.freeze({
    artifactSha256: item.artifact.sha256,
    cacheControl: "private, no-store",
    locale: item.locale,
    mode: "preview",
    recordId,
    robots: "noindex, nofollow, noarchive",
  });
};

export const authorizeEditorialPublication = (
  repository: EditorialRepositoryV1,
  recordId: string,
  context: EditorialPublicationContext,
): EditorialPublicationAuthorization => {
  assertAuthorized(assessEditorialPublication(repository, recordId, context));
  const item = getEditorialRecord(repository, recordId);
  return Object.freeze({
    artifactSha256: item.artifact.sha256,
    canonicalPaths: item.seo?.canonicalPaths ?? Object.freeze([]),
    indexingAllowed: item.publication.indexingAllowed,
    locale: item.locale,
    mode: "publication",
    recordId,
    reviewDueDate: item.review.reviewDueDate,
    robots: item.publication.indexingAllowed ? "index, follow" : "noindex, follow",
  });
};
