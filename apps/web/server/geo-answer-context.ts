import "server-only";

import source from "../../../content/editorial/geo-answer-context.en.v1.json";
import {
  publicPageInventoryRecord,
  type RuntimePublicPageInventoryRecord,
} from "../app/_i18n/public-page-inventory";
import { publicRouteRegistry, type PublicRouteId } from "../app/_i18n/public-routes";

type UnknownRecord = Record<string, unknown>;

export type GeoAnswerClassification = "fact" | "interpretation" | "product_guidance" | "tradition";

type GeoAnswerEntity = Readonly<{
  definition: string;
  entityId: string;
  name: string;
}>;

type GeoAnswerContextDefinition = Readonly<{
  classifications: readonly Readonly<{
    kind: GeoAnswerClassification;
    statement: string;
  }>[];
  entityId: string;
}>;

type GeoAnswerCatalog = Readonly<{
  contexts: Readonly<
    Record<
      | "astrology"
      | "home"
      | "methodology"
      | "numerology"
      | "privacy"
      | "rituals"
      | "safety"
      | "tarot",
      GeoAnswerContextDefinition
    >
  >;
  editorial: Readonly<{
    reviewDueDate: string;
    reviewedDate: string;
  }>;
  entities: readonly GeoAnswerEntity[];
  labels: Readonly<{
    answerContextHeading: string;
    classification: Readonly<Record<GeoAnswerClassification, string>>;
    decisionAuthority: string;
    editorialAuthority: string;
    entity: string;
    reviewAuthority: string;
    reviewDue: string;
    reviewed: string;
    sourceBasis: string;
    sourceDecision: string;
  }>;
}>;

export type GeoAnswerContext = Readonly<{
  authority: RuntimePublicPageInventoryRecord["authority"];
  classifications: readonly Readonly<{
    kind: GeoAnswerClassification;
    label: string;
    statement: string;
  }>[];
  entity: Readonly<{
    definition: string;
    id: string;
    name: string;
  }>;
  labels: GeoAnswerCatalog["labels"];
  sources: readonly string[];
}>;

type GeoAnswerContextInput = Readonly<{
  asOfDate?: string;
  brandName: string;
  locale: string;
  routeId: PublicRouteId;
  sourceLabels?: readonly string[];
}>;

const contextKeys = Object.freeze([
  "astrology",
  "home",
  "methodology",
  "numerology",
  "privacy",
  "rituals",
  "safety",
  "tarot",
] as const);
const entityIds = Object.freeze([
  "rituvia-public-guidance-v1",
  "rituvia-numerology-v1",
  "rituvia-western-natal-astrology-v1",
  "rituvia-major-arcana-reflection-v1",
  "rituvia-original-secular-reflection-v1",
] as const);
const classificationKinds = Object.freeze([
  "fact",
  "interpretation",
  "product_guidance",
  "tradition",
] as const);
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const unsafeText =
  /(?:[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]|<[^>]*>|(?:^|[\s"'(])(?:apps|content|docs|packages|scripts)\/)/iu;

const object = (value: unknown, label: string): UnknownRecord => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`The GEO ${label} must be an object.`);
  }
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[], label: string): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) {
    throw new TypeError(`The GEO ${label} has an invalid field inventory.`);
  }
};

const reviewedText = (value: unknown, label: string, maximum = 400): string => {
  if (
    typeof value !== "string" ||
    value.length < 2 ||
    value.length > maximum ||
    value.trim() !== value ||
    unsafeText.test(value)
  ) {
    throw new TypeError(`The GEO ${label} is not safe reviewed text.`);
  }
  return value;
};

const literal = <Value extends string>(value: unknown, expected: Value, label: string): Value => {
  if (value !== expected) throw new TypeError(`The GEO ${label} is invalid.`);
  return expected;
};

const date = (value: unknown, label: string): string => {
  const parsed = reviewedText(value, label, 10);
  const instant = new Date(`${parsed}T00:00:00.000Z`);
  if (
    !datePattern.test(parsed) ||
    Number.isNaN(instant.valueOf()) ||
    instant.toISOString().slice(0, 10) !== parsed
  ) {
    throw new TypeError(`The GEO ${label} is invalid.`);
  }
  return parsed;
};

const templateText = (
  value: unknown,
  label: string,
  allowedTokens: readonly string[] = [],
): string => {
  const parsed = reviewedText(value, label);
  const tokens = [...parsed.matchAll(/\{([^}]+)\}/gu)].map((match) => match.at(1));
  if (
    tokens.some((token) => token === undefined || !allowedTokens.includes(token)) ||
    parsed.replaceAll(/\{[^}]+\}/gu, "").includes("{") ||
    parsed.replaceAll(/\{[^}]+\}/gu, "").includes("}")
  ) {
    throw new TypeError(`The GEO ${label} contains an invalid template token.`);
  }
  return parsed;
};

const parseClassification = (
  value: unknown,
): GeoAnswerContextDefinition["classifications"][number] => {
  const candidate = object(value, "classification");
  exactKeys(candidate, ["kind", "statement"], "classification");
  const kind = reviewedText(candidate.kind, "classification kind", 40);
  if (!classificationKinds.some((candidateKind) => candidateKind === kind)) {
    throw new TypeError("The GEO classification kind is invalid.");
  }
  return Object.freeze({
    kind: kind as GeoAnswerClassification,
    statement: templateText(candidate.statement, "classification statement", ["brandName"]),
  });
};

const parseContext = (value: unknown): GeoAnswerContextDefinition => {
  const candidate = object(value, "context");
  exactKeys(candidate, ["classifications", "entityId"], "context");
  if (
    !Array.isArray(candidate.classifications) ||
    candidate.classifications.length < 1 ||
    candidate.classifications.length > 3
  ) {
    throw new TypeError("The GEO classification inventory is incomplete.");
  }
  const classifications = candidate.classifications.map(parseClassification);
  if (new Set(classifications.map(({ kind }) => kind)).size !== classifications.length) {
    throw new TypeError("The GEO classification inventory contains duplicates.");
  }
  const entityId = reviewedText(candidate.entityId, "entity identifier", 80);
  if (!entityIds.some((candidateId) => candidateId === entityId)) {
    throw new TypeError("The GEO entity identifier is invalid.");
  }
  return Object.freeze({ classifications: Object.freeze(classifications), entityId });
};

const parseCatalog = (value: unknown): GeoAnswerCatalog => {
  const candidate = object(value, "catalog");
  exactKeys(
    candidate,
    [
      "contentId",
      "contexts",
      "editorial",
      "entities",
      "labels",
      "locale",
      "schemaVersion",
      "version",
    ],
    "catalog",
  );
  literal(candidate.contentId, "rituvia.geo-answer-context.en", "content identifier");
  literal(candidate.locale, "en", "locale");
  literal(candidate.schemaVersion, "rituvia-geo-answer-context.v1", "schema version");
  literal(candidate.version, "1.0.0", "version");

  const editorial = object(candidate.editorial, "editorial record");
  exactKeys(
    editorial,
    [
      "approvalReference",
      "authorId",
      "effectiveDate",
      "reviewDueDate",
      "reviewedDate",
      "reviewerId",
      "status",
    ],
    "editorial record",
  );
  literal(editorial.approvalReference, "D-086", "approval reference");
  literal(editorial.authorId, "product.codex", "author identifier");
  literal(editorial.reviewerId, "owner", "reviewer identifier");
  literal(editorial.status, "approved", "editorial status");
  const effectiveDate = date(editorial.effectiveDate, "effective date");
  const reviewedDate = date(editorial.reviewedDate, "reviewed date");
  const reviewDueDate = date(editorial.reviewDueDate, "review due date");
  if (effectiveDate < reviewedDate || reviewDueDate < effectiveDate) {
    throw new TypeError("The GEO editorial review window is invalid.");
  }

  const contextsValue = object(candidate.contexts, "context registry");
  exactKeys(contextsValue, contextKeys, "context registry");
  const contexts = Object.freeze({
    astrology: parseContext(contextsValue.astrology),
    home: parseContext(contextsValue.home),
    methodology: parseContext(contextsValue.methodology),
    numerology: parseContext(contextsValue.numerology),
    privacy: parseContext(contextsValue.privacy),
    rituals: parseContext(contextsValue.rituals),
    safety: parseContext(contextsValue.safety),
    tarot: parseContext(contextsValue.tarot),
  });

  if (!Array.isArray(candidate.entities) || candidate.entities.length !== entityIds.length) {
    throw new TypeError("The GEO entity inventory is incomplete.");
  }
  const entities = candidate.entities.map((value): GeoAnswerEntity => {
    const entity = object(value, "entity");
    exactKeys(entity, ["definition", "entityId", "name"], "entity");
    const entityId = reviewedText(entity.entityId, "entity identifier", 80);
    if (!entityIds.some((candidateId) => candidateId === entityId)) {
      throw new TypeError("The GEO entity identifier is invalid.");
    }
    return Object.freeze({
      definition: templateText(entity.definition, "entity definition", ["brandName"]),
      entityId,
      name: templateText(entity.name, "entity name", ["brandName"]),
    });
  });
  if (new Set(entities.map(({ entityId }) => entityId)).size !== entityIds.length) {
    throw new TypeError("The GEO entity inventory contains duplicates.");
  }

  const labels = object(candidate.labels, "labels");
  exactKeys(
    labels,
    [
      "answerContextHeading",
      "classification",
      "decisionAuthority",
      "editorialAuthority",
      "entity",
      "reviewAuthority",
      "reviewDue",
      "reviewed",
      "sourceBasis",
      "sourceDecision",
    ],
    "labels",
  );
  const classificationLabels = object(labels.classification, "classification labels");
  exactKeys(classificationLabels, classificationKinds, "classification labels");
  const parsedClassificationLabels = Object.freeze({
    fact: reviewedText(classificationLabels.fact, "classification label"),
    interpretation: reviewedText(classificationLabels.interpretation, "classification label"),
    product_guidance: reviewedText(classificationLabels.product_guidance, "classification label"),
    tradition: reviewedText(classificationLabels.tradition, "classification label"),
  });
  const parsedLabels = Object.freeze({
    answerContextHeading: reviewedText(labels.answerContextHeading, "answer-context heading"),
    classification: parsedClassificationLabels,
    decisionAuthority: reviewedText(labels.decisionAuthority, "decision authority"),
    editorialAuthority: reviewedText(labels.editorialAuthority, "editorial authority"),
    entity: reviewedText(labels.entity, "entity label"),
    reviewAuthority: reviewedText(labels.reviewAuthority, "review authority label"),
    reviewDue: reviewedText(labels.reviewDue, "review-due label"),
    reviewed: reviewedText(labels.reviewed, "reviewed label"),
    sourceBasis: reviewedText(labels.sourceBasis, "source-basis label"),
    sourceDecision: templateText(labels.sourceDecision, "source-decision label", [
      "approvalReference",
      "brandName",
    ]),
  });

  return Object.freeze({
    contexts: Object.freeze(contexts),
    editorial: Object.freeze({ reviewDueDate, reviewedDate }),
    entities: Object.freeze(entities),
    labels: parsedLabels,
  });
};

const catalog = parseCatalog(source);

const interpolate = (
  template: string,
  values: Readonly<{ approvalReference?: string; brandName: string }>,
): string =>
  template
    .replaceAll("{brandName}", values.brandName)
    .replaceAll("{approvalReference}", values.approvalReference ?? "");

const contextDefinition = (
  record: RuntimePublicPageInventoryRecord,
): GeoAnswerContextDefinition => {
  if (record.routeId === "home") return catalog.contexts.home;
  if (record.routeId === "methodology") return catalog.contexts.methodology;
  if (record.routeId === "privacy") return catalog.contexts.privacy;
  if (record.routeId === "safety") return catalog.contexts.safety;
  switch (record.contentFamily) {
    case "astrology":
      return catalog.contexts.astrology;
    case "numerology":
      return catalog.contexts.numerology;
    case "rituals":
      return catalog.contexts.rituals;
    case "tarot":
      return catalog.contexts.tarot;
    default:
      throw new TypeError("The GEO content family is not approved.");
  }
};

const classificationLabel = (
  kind: GeoAnswerClassification,
): GeoAnswerCatalog["labels"]["classification"][GeoAnswerClassification] => {
  switch (kind) {
    case "fact":
      return catalog.labels.classification.fact;
    case "interpretation":
      return catalog.labels.classification.interpretation;
    case "product_guidance":
      return catalog.labels.classification.product_guidance;
    case "tradition":
      return catalog.labels.classification.tradition;
  }
};

const uniqueSourceLabels = (values: readonly string[]): readonly string[] => {
  if (values.length < 1 || values.length > 8) {
    throw new TypeError("The GEO source inventory is incomplete.");
  }
  const parsed = values.map((value) => reviewedText(value, "source label"));
  if (new Set(parsed).size !== parsed.length) {
    throw new TypeError("The GEO source inventory contains duplicates.");
  }
  return Object.freeze(parsed);
};

const currentDate = (): string => new Date().toISOString().slice(0, 10);

export const getGeoAnswerContext = ({
  asOfDate = currentDate(),
  brandName,
  locale,
  routeId,
  sourceLabels,
}: GeoAnswerContextInput): GeoAnswerContext => {
  const safeBrandName = reviewedText(brandName, "brand name");
  const route = publicRouteRegistry.route(routeId, locale);
  const record = publicPageInventoryRecord(routeId, locale, asOfDate);
  if (
    route === null ||
    record === null ||
    route.pathname !== record.pathname ||
    catalog.editorial.reviewedDate > asOfDate ||
    catalog.editorial.reviewDueDate < asOfDate
  ) {
    throw new TypeError("The GEO route does not have current publication evidence.");
  }
  const definition = contextDefinition(record);
  const entity = catalog.entities.find(({ entityId }) => entityId === definition.entityId);
  if (entity === undefined) throw new TypeError("The GEO entity definition is unavailable.");
  const sources =
    sourceLabels === undefined
      ? uniqueSourceLabels([
          interpolate(catalog.labels.sourceDecision, {
            approvalReference: route.publication.approvalReference,
            brandName: safeBrandName,
          }),
        ])
      : uniqueSourceLabels(sourceLabels);
  return Object.freeze({
    authority: record.authority,
    classifications: Object.freeze(
      definition.classifications.map(({ kind, statement }) =>
        Object.freeze({
          kind,
          label: classificationLabel(kind),
          statement: interpolate(statement, { brandName: safeBrandName }),
        }),
      ),
    ),
    entity: Object.freeze({
      definition: interpolate(entity.definition, { brandName: safeBrandName }),
      id: entity.entityId,
      name: interpolate(entity.name, { brandName: safeBrandName }),
    }),
    labels: catalog.labels,
    sources,
  });
};
