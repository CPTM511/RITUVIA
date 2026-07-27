export const ritualCatalogSchemaVersion = "ritual-catalog.v1" as const;
export const ritualTemplateSchemaVersion = "ritual-template.v1" as const;
export const ritualCatalogItemSchemaVersion = "ritual-catalog-item.v1" as const;
export const ritualPublicationSchemaVersion = "ritual-publication.v1" as const;
export const ritualLegacyMappingSchemaVersion = "ritual-legacy-mapping.v1" as const;

export const ritualCatalogItemCodes = Object.freeze([
  "free_candle",
  "free_incense",
  "mindful_incense",
  "moonlit_lotus",
  "amethyst_guardian",
  "golden_bowl",
  "guided_light",
  "offering",
  "moon_phase",
  "relationship_release",
  "annual_open_close",
] as const);
export const freeRitualCatalogItemCodes = Object.freeze(["free_candle", "free_incense"] as const);
export const permanentRitualObjectCodes = Object.freeze([
  "mindful_incense",
  "moonlit_lotus",
  "amethyst_guardian",
  "golden_bowl",
] as const);
export const consumableRitualCodes = Object.freeze([
  "guided_light",
  "offering",
  "moon_phase",
  "relationship_release",
  "annual_open_close",
] as const);
export const legacyReflectionRitualObjectCodes = Object.freeze([
  "candle",
  "incense",
  "mindful_incense",
  "moonlit_lotus",
  "amethyst_guardian",
  "golden_intention_bowl",
] as const);
export const ritualTemplateCodes = Object.freeze([
  "free-candle-pause",
  "free-incense-pause",
  "permanent-object-pause",
  "guided-light",
  "symbolic-offering",
  "moon-phase-reflection",
  "relationship-release",
  "annual-open-close",
] as const);
export const ritualInteractionCodes = Object.freeze([
  "prepare",
  "light",
  "place",
  "breathe",
  "pause",
  "complete",
] as const);
export const ritualPresentationEnhancements = Object.freeze([
  "art",
  "animation",
  "audio",
  "arrangement",
  "duration",
  "memory",
  "collection",
  "persistence",
] as const);
export const ritualPurposeCodes = Object.freeze([
  "grounded_pause",
  "guided_reflection",
  "symbolic_offering",
  "seasonal_reflection",
  "relationship_release",
  "annual_reflection",
] as const);

export type RitualCatalogItemCode = (typeof ritualCatalogItemCodes)[number];
export type FreeRitualCatalogItemCode = (typeof freeRitualCatalogItemCodes)[number];
export type PermanentRitualObjectCode = (typeof permanentRitualObjectCodes)[number];
export type ConsumableRitualCode = (typeof consumableRitualCodes)[number];
export type LegacyReflectionRitualObjectCode = (typeof legacyReflectionRitualObjectCodes)[number];
export type RitualTemplateCode = (typeof ritualTemplateCodes)[number];
export type RitualInteractionCode = (typeof ritualInteractionCodes)[number];
export type RitualPresentationEnhancement = (typeof ritualPresentationEnhancements)[number];
export type RitualPurposeCode = (typeof ritualPurposeCodes)[number];

export type RitualPublicationV1 = Readonly<{
  approvalReference: string;
  audience: "adult";
  authorReference: string;
  changeReasonCode: "initial_production_pack_adaptation";
  effectiveOn: string;
  id: string;
  locale: "en";
  method: "rituvia_original_secular";
  requiredApprovalRole: "product_safety";
  reviewDueOn: string;
  rightsStatus: "owned";
  safetyRisk: "low";
  schemaVersion: typeof ritualPublicationSchemaVersion;
  sourceReferences: readonly string[];
  status: "approved" | "retired";
  supersedes: string | null;
}>;

export type RitualTemplateV1 = Readonly<{
  audioDefault: "off";
  code: RitualTemplateCode;
  completionMode: "reflective_acknowledgement";
  durationClass: "brief" | "standard";
  linearAlternative: true;
  publicationId: string;
  purposeCode: RitualPurposeCode;
  reducedMotionMode: "static_equivalent";
  schemaVersion: typeof ritualTemplateSchemaVersion;
  steps: readonly RitualInteractionCode[];
  textAlternativeKey: string;
  version: string;
}>;

export type RitualCatalogItemAccessV1 =
  | Readonly<{ kind: "free"; requirementCode: null }>
  | Readonly<{
      kind: "permanent_entitlement";
      requirementCode: `permanent-object.${PermanentRitualObjectCode}`;
    }>
  | Readonly<{
      kind: "consumable_pass";
      requirementCode: `ritual-pass.${ConsumableRitualCode}`;
    }>;

export type RitualCatalogItemV1 = Readonly<{
  access: RitualCatalogItemAccessV1;
  accessibilityLabelKey: string;
  code: RitualCatalogItemCode;
  experienceScope: "symbolic_reflection_only";
  externalOutcome: "not_guaranteed";
  kind: "consumable_ritual" | "free_object" | "permanent_object";
  labelKey: string;
  presentationEnhancements: readonly RitualPresentationEnhancement[];
  publicationId: string;
  schemaVersion: typeof ritualCatalogItemSchemaVersion;
  status: "active" | "retired";
  template: Readonly<{ code: RitualTemplateCode; version: string }>;
  version: string;
}>;

export type RitualLegacyMappingV1 = Readonly<{
  legacyCode: LegacyReflectionRitualObjectCode;
  schemaVersion: typeof ritualLegacyMappingSchemaVersion;
  target: Readonly<{ code: RitualCatalogItemCode; version: string }>;
  use: "historical_replay_only";
}>;

export type RitualCatalogV1 = Readonly<{
  catalogId: "rituvia-original-secular";
  items: readonly RitualCatalogItemV1[];
  legacyMappings: readonly RitualLegacyMappingV1[];
  publicationId: string;
  publications: readonly RitualPublicationV1[];
  schemaVersion: typeof ritualCatalogSchemaVersion;
  templates: readonly RitualTemplateV1[];
  version: string;
}>;

export class RitualCatalogError extends Error {
  readonly code = "RITUAL_CATALOG_INVALID" as const;

  constructor() {
    super("The ritual catalog contract is invalid.");
    this.name = "RitualCatalogError";
  }
}

const semanticVersionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const messageKeyPattern = /^ritual\.[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

const invalid = (): never => {
  throw new RitualCatalogError();
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, required: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => Object.hasOwn(value, key));
};

const includes = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.some((candidate) => candidate === value);

const parseSemanticVersion = (value: unknown): string =>
  typeof value === "string" && semanticVersionPattern.test(value) ? value : invalid();

const parseReference = (value: unknown): string =>
  typeof value === "string" && referencePattern.test(value) ? value : invalid();

const parseIdentifier = (value: unknown): string =>
  typeof value === "string" && value.length <= 100 && identifierPattern.test(value)
    ? value
    : invalid();

const parseMessageKey = (value: unknown): string =>
  typeof value === "string" && value.length <= 120 && messageKeyPattern.test(value)
    ? value
    : invalid();

const parseDate = (value: unknown): string => {
  if (typeof value !== "string" || !datePattern.test(value)) return invalid();
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    return invalid();
  }
  return value;
};

const parseUniqueList = <Value extends string>(
  value: unknown,
  allowed: readonly Value[],
  minimum: number,
): readonly Value[] => {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > allowed.length ||
    value.some((entry) => !includes(allowed, entry)) ||
    new Set(value).size !== value.length
  ) {
    return invalid();
  }
  return Object.freeze([...value] as Value[]);
};

export const parseRitualPublicationV1 = (value: unknown): RitualPublicationV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "approvalReference",
      "audience",
      "authorReference",
      "changeReasonCode",
      "effectiveOn",
      "id",
      "locale",
      "method",
      "requiredApprovalRole",
      "reviewDueOn",
      "rightsStatus",
      "safetyRisk",
      "schemaVersion",
      "sourceReferences",
      "status",
      "supersedes",
    ]) ||
    input.audience !== "adult" ||
    input.changeReasonCode !== "initial_production_pack_adaptation" ||
    input.locale !== "en" ||
    input.method !== "rituvia_original_secular" ||
    input.requiredApprovalRole !== "product_safety" ||
    input.rightsStatus !== "owned" ||
    input.safetyRisk !== "low" ||
    input.schemaVersion !== ritualPublicationSchemaVersion ||
    (input.status !== "approved" && input.status !== "retired") ||
    (input.supersedes !== null && typeof input.supersedes !== "string") ||
    !Array.isArray(input.sourceReferences) ||
    input.sourceReferences.length < 1 ||
    input.sourceReferences.length > 8
  ) {
    return invalid();
  }
  const effectiveOn = parseDate(input.effectiveOn);
  const reviewDueOn = parseDate(input.reviewDueOn);
  const sourceReferences = Object.freeze(input.sourceReferences.map(parseReference));
  if (
    Date.parse(`${reviewDueOn}T00:00:00.000Z`) <= Date.parse(`${effectiveOn}T00:00:00.000Z`) ||
    new Set(sourceReferences).size !== sourceReferences.length
  ) {
    return invalid();
  }
  return Object.freeze({
    approvalReference: parseReference(input.approvalReference),
    audience: "adult",
    authorReference: parseReference(input.authorReference),
    changeReasonCode: "initial_production_pack_adaptation",
    effectiveOn,
    id: parseIdentifier(input.id),
    locale: "en",
    method: "rituvia_original_secular",
    requiredApprovalRole: "product_safety",
    reviewDueOn,
    rightsStatus: "owned",
    safetyRisk: "low",
    schemaVersion: ritualPublicationSchemaVersion,
    sourceReferences,
    status: input.status,
    supersedes: input.supersedes === null ? null : parseIdentifier(input.supersedes),
  });
};

export const parseRitualTemplateV1 = (value: unknown): RitualTemplateV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "audioDefault",
      "code",
      "completionMode",
      "durationClass",
      "linearAlternative",
      "publicationId",
      "purposeCode",
      "reducedMotionMode",
      "schemaVersion",
      "steps",
      "textAlternativeKey",
      "version",
    ]) ||
    input.audioDefault !== "off" ||
    !includes(ritualTemplateCodes, input.code) ||
    input.completionMode !== "reflective_acknowledgement" ||
    (input.durationClass !== "brief" && input.durationClass !== "standard") ||
    input.linearAlternative !== true ||
    !includes(ritualPurposeCodes, input.purposeCode) ||
    input.reducedMotionMode !== "static_equivalent" ||
    input.schemaVersion !== ritualTemplateSchemaVersion
  ) {
    return invalid();
  }
  const steps = parseUniqueList(input.steps, ritualInteractionCodes, 3);
  if (
    steps.at(0) !== "prepare" ||
    steps.at(-1) !== "complete" ||
    !steps.some((step) => step === "breathe" || step === "pause")
  ) {
    return invalid();
  }
  return Object.freeze({
    audioDefault: "off",
    code: input.code,
    completionMode: "reflective_acknowledgement",
    durationClass: input.durationClass,
    linearAlternative: true,
    publicationId: parseIdentifier(input.publicationId),
    purposeCode: input.purposeCode,
    reducedMotionMode: "static_equivalent",
    schemaVersion: ritualTemplateSchemaVersion,
    steps,
    textAlternativeKey: parseMessageKey(input.textAlternativeKey),
    version: parseSemanticVersion(input.version),
  });
};

const parseAccess = (
  value: unknown,
  code: RitualCatalogItemCode,
  kind: RitualCatalogItemV1["kind"],
): RitualCatalogItemAccessV1 => {
  const input = record(value);
  if (input === null || !hasExactKeys(input, ["kind", "requirementCode"])) return invalid();
  if (kind === "free_object" && input.kind === "free" && input.requirementCode === null) {
    return Object.freeze({ kind: "free", requirementCode: null });
  }
  if (
    kind === "permanent_object" &&
    input.kind === "permanent_entitlement" &&
    includes(permanentRitualObjectCodes, code) &&
    input.requirementCode === `permanent-object.${code}`
  ) {
    return Object.freeze({
      kind: "permanent_entitlement",
      requirementCode: input.requirementCode as `permanent-object.${PermanentRitualObjectCode}`,
    });
  }
  if (
    kind === "consumable_ritual" &&
    input.kind === "consumable_pass" &&
    includes(consumableRitualCodes, code) &&
    input.requirementCode === `ritual-pass.${code}`
  ) {
    return Object.freeze({
      kind: "consumable_pass",
      requirementCode: input.requirementCode as `ritual-pass.${ConsumableRitualCode}`,
    });
  }
  return invalid();
};

export const parseRitualCatalogItemV1 = (value: unknown): RitualCatalogItemV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "access",
      "accessibilityLabelKey",
      "code",
      "experienceScope",
      "externalOutcome",
      "kind",
      "labelKey",
      "presentationEnhancements",
      "publicationId",
      "schemaVersion",
      "status",
      "template",
      "version",
    ]) ||
    !includes(ritualCatalogItemCodes, input.code) ||
    input.experienceScope !== "symbolic_reflection_only" ||
    input.externalOutcome !== "not_guaranteed" ||
    (input.kind !== "free_object" &&
      input.kind !== "permanent_object" &&
      input.kind !== "consumable_ritual") ||
    input.schemaVersion !== ritualCatalogItemSchemaVersion ||
    (input.status !== "active" && input.status !== "retired")
  ) {
    return invalid();
  }
  const template = record(input.template);
  if (
    template === null ||
    !hasExactKeys(template, ["code", "version"]) ||
    !includes(ritualTemplateCodes, template.code)
  ) {
    return invalid();
  }
  const access = parseAccess(input.access, input.code, input.kind);
  const presentationEnhancements = parseUniqueList(
    input.presentationEnhancements,
    ritualPresentationEnhancements,
    input.kind === "free_object" ? 0 : 1,
  );
  if (input.kind === "free_object" && presentationEnhancements.length !== 0) return invalid();
  return Object.freeze({
    access,
    accessibilityLabelKey: parseMessageKey(input.accessibilityLabelKey),
    code: input.code,
    experienceScope: "symbolic_reflection_only",
    externalOutcome: "not_guaranteed",
    kind: input.kind,
    labelKey: parseMessageKey(input.labelKey),
    presentationEnhancements,
    publicationId: parseIdentifier(input.publicationId),
    schemaVersion: ritualCatalogItemSchemaVersion,
    status: input.status,
    template: Object.freeze({
      code: template.code,
      version: parseSemanticVersion(template.version),
    }),
    version: parseSemanticVersion(input.version),
  });
};

export const parseRitualLegacyMappingV1 = (value: unknown): RitualLegacyMappingV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["legacyCode", "schemaVersion", "target", "use"]) ||
    !includes(legacyReflectionRitualObjectCodes, input.legacyCode) ||
    input.schemaVersion !== ritualLegacyMappingSchemaVersion ||
    input.use !== "historical_replay_only"
  ) {
    return invalid();
  }
  const target = record(input.target);
  if (
    target === null ||
    !hasExactKeys(target, ["code", "version"]) ||
    !includes(ritualCatalogItemCodes, target.code)
  ) {
    return invalid();
  }
  return Object.freeze({
    legacyCode: input.legacyCode,
    schemaVersion: ritualLegacyMappingSchemaVersion,
    target: Object.freeze({
      code: target.code,
      version: parseSemanticVersion(target.version),
    }),
    use: "historical_replay_only",
  });
};

export const parseRitualCatalogV1 = (value: unknown): RitualCatalogV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "catalogId",
      "items",
      "legacyMappings",
      "publicationId",
      "publications",
      "schemaVersion",
      "templates",
      "version",
    ]) ||
    input.catalogId !== "rituvia-original-secular" ||
    input.schemaVersion !== ritualCatalogSchemaVersion ||
    !Array.isArray(input.items) ||
    !Array.isArray(input.legacyMappings) ||
    !Array.isArray(input.publications) ||
    !Array.isArray(input.templates)
  ) {
    return invalid();
  }
  const publications = Object.freeze(input.publications.map(parseRitualPublicationV1));
  const templates = Object.freeze(input.templates.map(parseRitualTemplateV1));
  const items = Object.freeze(input.items.map(parseRitualCatalogItemV1));
  const legacyMappings = Object.freeze(input.legacyMappings.map(parseRitualLegacyMappingV1));
  const publicationId = parseIdentifier(input.publicationId);
  const publication = publications.find((candidate) => candidate.id === publicationId);
  if (
    publication === undefined ||
    publication.status !== "approved" ||
    new Set(publications.map((candidate) => candidate.id)).size !== publications.length ||
    new Set(templates.map((template) => `${template.code}@${template.version}`)).size !==
      templates.length ||
    new Set(items.map((item) => `${item.code}@${item.version}`)).size !== items.length ||
    new Set(legacyMappings.map((mapping) => mapping.legacyCode)).size !== legacyMappings.length ||
    items.length !== ritualCatalogItemCodes.length ||
    !ritualCatalogItemCodes.every((code) =>
      items.some((item) => item.code === code && item.status === "active"),
    ) ||
    templates.length !== ritualTemplateCodes.length ||
    !ritualTemplateCodes.every((code) => templates.some((template) => template.code === code)) ||
    legacyMappings.length !== legacyReflectionRitualObjectCodes.length ||
    !legacyReflectionRitualObjectCodes.every((code) =>
      legacyMappings.some((mapping) => mapping.legacyCode === code),
    ) ||
    templates.some(
      (template) =>
        template.publicationId !== publicationId ||
        !publications.some(
          (candidate) => candidate.id === template.publicationId && candidate.status === "approved",
        ),
    ) ||
    items.some(
      (item) =>
        item.publicationId !== publicationId ||
        !templates.some(
          (template) =>
            template.code === item.template.code && template.version === item.template.version,
        ),
    ) ||
    legacyMappings.some(
      (mapping) =>
        !items.some(
          (item) => item.code === mapping.target.code && item.version === mapping.target.version,
        ),
    )
  ) {
    return invalid();
  }
  return Object.freeze({
    catalogId: "rituvia-original-secular",
    items,
    legacyMappings,
    publicationId,
    publications,
    schemaVersion: ritualCatalogSchemaVersion,
    templates,
    version: parseSemanticVersion(input.version),
  });
};

export const ritualCatalogItemDefinitionFor = (
  catalog: RitualCatalogV1,
  code: RitualCatalogItemCode,
  version: string,
): RitualCatalogItemV1 | null =>
  catalog.items.find((item) => item.code === code && item.version === version) ?? null;

export const ritualTemplateDefinitionFor = (
  catalog: RitualCatalogV1,
  code: RitualTemplateCode,
  version: string,
): RitualTemplateV1 | null =>
  catalog.templates.find((template) => template.code === code && template.version === version) ??
  null;

export const ritualLegacyDefinitionFor = (
  catalog: RitualCatalogV1,
  legacyCode: LegacyReflectionRitualObjectCode,
): RitualCatalogItemV1 | null => {
  const mapping = catalog.legacyMappings.find((candidate) => candidate.legacyCode === legacyCode);
  return mapping === undefined
    ? null
    : ritualCatalogItemDefinitionFor(catalog, mapping.target.code, mapping.target.version);
};
