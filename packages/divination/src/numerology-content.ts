declare const numerologyValueBrand: unique symbol;

type Branded<Value, Brand extends string> = Value & {
  readonly [numerologyValueBrand]: Brand;
};

type NumerologyIdentifier = Branded<string, "NumerologyIdentifier">;
type NumerologyVersion = Branded<string, "NumerologyVersion">;
type NumerologyDate = Branded<string, "NumerologyDate">;

export const numerologyCatalogSchemaVersion = "numerology-rule-catalog.v1" as const;

export const numerologyCalculationCodes = Object.freeze([
  "life_path",
  "birthday_number",
  "personal_year",
] as const);
export type NumerologyCalculationCode = (typeof numerologyCalculationCodes)[number];

export const numerologyMasterNumbers = Object.freeze([11, 22, 33] as const);
export type NumerologyMasterNumber = (typeof numerologyMasterNumbers)[number];

export const numerologyEditorialStatuses = Object.freeze([
  "draft",
  "source_checked",
  "approved",
  "deprecated",
] as const);
export type NumerologyEditorialStatus = (typeof numerologyEditorialStatuses)[number];

export const numerologyContentErrorCodes = Object.freeze([
  "NUMEROLOGY_CONTENT_INVALID",
  "NUMEROLOGY_SCHEMA_VERSION_UNSUPPORTED",
  "NUMEROLOGY_REFERENCE_INVALID",
  "NUMEROLOGY_CATALOG_NOT_ENGINE_READY",
] as const);
export type NumerologyContentErrorCode = (typeof numerologyContentErrorCodes)[number];

const numerologyContentErrorMessage = (code: NumerologyContentErrorCode): string => {
  switch (code) {
    case "NUMEROLOGY_CONTENT_INVALID":
      return "The numerology content contract is invalid.";
    case "NUMEROLOGY_SCHEMA_VERSION_UNSUPPORTED":
      return "The numerology content schema version is unsupported.";
    case "NUMEROLOGY_REFERENCE_INVALID":
      return "The numerology content reference graph is invalid.";
    case "NUMEROLOGY_CATALOG_NOT_ENGINE_READY":
      return "The numerology catalog is not structurally ready for engine use.";
  }
};

export class NumerologyContentError extends Error {
  readonly code: NumerologyContentErrorCode;

  constructor(code: NumerologyContentErrorCode) {
    super(numerologyContentErrorMessage(code));
    this.name = "NumerologyContentError";
    this.code = code;
  }
}

export type NumerologyVersionReference = Readonly<{
  id: NumerologyIdentifier;
  version: NumerologyVersion;
}>;

export type NumerologyEditorialMetadataV1 = Readonly<{
  approvalReference: string | null;
  authorId: NumerologyIdentifier;
  changeReason: string;
  effectiveDate: NumerologyDate;
  requiredApprovalRole: "owner";
  reviewDueDate: NumerologyDate;
  reviewedDate: NumerologyDate | null;
  reviewerId: NumerologyIdentifier | null;
  reviewerRole: "owner" | null;
  status: NumerologyEditorialStatus;
  supersedes: NumerologyVersionReference | null;
}>;

type NumerologySourceClaimV1 = Readonly<{
  claimCode: NumerologyIdentifier;
  statement: string;
}>;

type NumerologySourceRightsV1 = Readonly<{
  allowedUses: readonly (
    | "engine_calculation"
    | "internal_validation"
    | "public_display"
    | "commercial_use"
    | "translation"
  )[];
  evidenceReference: string;
  status: "owned" | "licensed" | "public_domain" | "not_cleared";
  territory: "worldwide" | "restricted";
  version: NumerologyVersion;
}>;

export type NumerologySourceRecordV1 = Readonly<{
  claims: readonly NumerologySourceClaimV1[];
  creator: string;
  editorial: NumerologyEditorialMetadataV1;
  identifier: string;
  knownDisagreements: readonly string[];
  language: "en";
  publisher: string;
  rights: NumerologySourceRightsV1;
  sourceId: NumerologyIdentifier;
  sourceType: "original" | "licensed" | "public_domain" | "reference";
  title: string;
  tradition: string;
  version: NumerologyVersion;
}>;

export type NumerologyReductionPolicyV1 = Readonly<{
  base: 10;
  policyId: NumerologyIdentifier;
  preserveExactTotals: readonly NumerologyMasterNumber[];
  preserveOnEveryStep: true;
  repeatWhile: "greater_than_nine_and_not_preserved";
  stepOperation: "sum_ascii_decimal_digits";
  version: NumerologyVersion;
}>;

export type NumerologyCalculationRuleV1 = Readonly<{
  calculationCode: NumerologyCalculationCode;
  formula:
    | "sum_iso_birth_date_digits"
    | "sum_birth_day_digits"
    | "sum_birth_month_day_and_target_year_digits";
  inputFields: readonly ("birth_date" | "target_year")[];
  limitations: readonly string[];
  reductionPolicy: NumerologyVersionReference;
  ruleId: NumerologyIdentifier;
  sources: readonly NumerologyVersionReference[];
  targetYearSource: "not_applicable" | "explicit_integer_input";
  title: string;
  version: NumerologyVersion;
  workedExamples: readonly NumerologyVersionReference[];
}>;

export type NumerologyWorkedExampleV1 = Readonly<{
  birthDate: string;
  canonicalDigits: string;
  exampleId: NumerologyIdentifier;
  initialValue: number;
  masterNumberPreserved: boolean;
  reductionSteps: readonly number[];
  result: number;
  rule: NumerologyVersionReference;
  targetYear: number | null;
  version: NumerologyVersion;
}>;

export type NumerologyRuleSetV1 = Readonly<{
  calendar: Readonly<{
    canonicalDateFormat: "YYYY-MM-DD";
    localizedCalendarConversion: "unsupported";
    system: "proleptic_gregorian";
  }>;
  calculationRules: readonly NumerologyCalculationRuleV1[];
  contentType: "numerology_rule_set";
  editorial: NumerologyEditorialMetadataV1;
  localePolicy: Readonly<{
    canonicalCalculationInput: "ascii_iso_date";
    dateRulesApplyAcrossLocales: true;
    nameMapping: "unsupported";
    reviewedContentLocales: readonly ["en"];
    silentTransliteration: "forbidden";
    supportedNameScripts: readonly [];
  }>;
  method: "numerology";
  privacy: Readonly<{
    analyticsAllowed: false;
    birthDateClassification: "sensitive";
    logsAllowed: false;
    nameCollection: "not_applicable";
    urlAllowed: false;
  }>;
  reductionPolicies: readonly NumerologyReductionPolicyV1[];
  ruleSetId: NumerologyIdentifier;
  sources: readonly NumerologyVersionReference[];
  title: string;
  tradition: string;
  version: NumerologyVersion;
  workedExamples: readonly NumerologyWorkedExampleV1[];
}>;

export type NumerologyRuleCatalogV1 = Readonly<{
  catalogId: NumerologyIdentifier;
  contentType: "numerology_rule_catalog";
  editorial: NumerologyEditorialMetadataV1;
  locale: "en";
  method: "numerology";
  ruleSets: readonly NumerologyRuleSetV1[];
  schemaVersion: typeof numerologyCatalogSchemaVersion;
  sources: readonly NumerologySourceRecordV1[];
  title: string;
  usePolicy: Readonly<{
    aiInterpretationAllowed: false;
    engineCalculationAllowed: boolean;
    indexingAllowed: false;
    publicPublicationAllowed: false;
  }>;
  version: NumerologyVersion;
}>;

type UnknownRecord = Record<string, unknown>;

const invalid = (): never => {
  throw new NumerologyContentError("NUMEROLOGY_CONTENT_INVALID");
};

const invalidReference = (): never => {
  throw new NumerologyContentError("NUMEROLOGY_REFERENCE_INVALID");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\u0000") !== expected.join("\u0000")) {
    invalid();
  }
};

const stringValue = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) invalid();
  return value as string;
};

const booleanValue = (value: unknown): boolean => {
  if (typeof value !== "boolean") invalid();
  return value as boolean;
};

const integerValue = (value: unknown): number => {
  if (!Number.isSafeInteger(value)) invalid();
  return value as number;
};

const literal = <Value extends string | number | boolean>(
  value: unknown,
  expected: Value,
): Value => {
  if (value !== expected) invalid();
  return expected;
};

const oneOf = <Value extends string>(value: unknown, allowed: readonly Value[]): Value => {
  if (typeof value !== "string" || !allowed.includes(value as Value)) invalid();
  return value as Value;
};

const arrayValue = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) invalid();
  return value as readonly unknown[];
};

const nonEmptyArray = (value: unknown): readonly unknown[] => {
  const values = arrayValue(value);
  if (values.length === 0) invalid();
  return values;
};

const unique = <Value>(values: readonly Value[]): boolean => new Set(values).size === values.length;

const identifier = (value: unknown): NumerologyIdentifier => {
  const parsed = stringValue(value);
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(parsed)) invalid();
  return parsed as NumerologyIdentifier;
};

const version = (value: unknown): NumerologyVersion => {
  const parsed = stringValue(value);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(parsed)) invalid();
  return parsed as NumerologyVersion;
};

const date = (value: unknown): NumerologyDate => {
  const parsed = stringValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed)) invalid();
  const candidate = new Date(`${parsed}T00:00:00.000Z`);
  if (Number.isNaN(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== parsed) {
    invalid();
  }
  return parsed as NumerologyDate;
};

const versionReference = (value: unknown): NumerologyVersionReference => {
  const parsed = record(value);
  exactKeys(parsed, ["id", "version"]);
  return Object.freeze({
    id: identifier(parsed.id),
    version: version(parsed.version),
  });
};

const editorial = (value: unknown): NumerologyEditorialMetadataV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
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
  const approvalReference =
    parsed.approvalReference === null ? null : stringValue(parsed.approvalReference);
  const authorId = identifier(parsed.authorId);
  const changeReason = stringValue(parsed.changeReason);
  const effectiveDate = date(parsed.effectiveDate);
  const reviewDueDate = date(parsed.reviewDueDate);
  const reviewedDate = parsed.reviewedDate === null ? null : date(parsed.reviewedDate);
  literal(parsed.requiredApprovalRole, "owner");
  const reviewerRole = parsed.reviewerRole === null ? null : literal(parsed.reviewerRole, "owner");
  const reviewerId = parsed.reviewerId === null ? null : identifier(parsed.reviewerId);
  const status = oneOf(parsed.status, numerologyEditorialStatuses);
  const supersedes = parsed.supersedes === null ? null : versionReference(parsed.supersedes);
  return Object.freeze({
    approvalReference,
    authorId,
    changeReason,
    effectiveDate,
    requiredApprovalRole: "owner",
    reviewDueDate,
    reviewedDate,
    reviewerId,
    reviewerRole,
    status,
    supersedes,
  });
};

const sourceRecord = (value: unknown): NumerologySourceRecordV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "claims",
    "creator",
    "editorial",
    "identifier",
    "knownDisagreements",
    "language",
    "publisher",
    "rights",
    "sourceId",
    "sourceType",
    "title",
    "tradition",
    "version",
  ]);
  const claims = Object.freeze(
    nonEmptyArray(parsed.claims).map((claim) => {
      const claimRecord = record(claim);
      exactKeys(claimRecord, ["claimCode", "statement"]);
      return Object.freeze({
        claimCode: identifier(claimRecord.claimCode),
        statement: stringValue(claimRecord.statement),
      });
    }),
  );
  if (!unique(claims.map(({ claimCode }) => claimCode))) invalid();
  const knownDisagreements = Object.freeze(
    nonEmptyArray(parsed.knownDisagreements).map(stringValue),
  );
  const rightsRecord = record(parsed.rights);
  exactKeys(rightsRecord, ["allowedUses", "evidenceReference", "status", "territory", "version"]);
  const allowedUses = Object.freeze(
    nonEmptyArray(rightsRecord.allowedUses).map((allowedUse) =>
      oneOf(allowedUse, [
        "engine_calculation",
        "internal_validation",
        "public_display",
        "commercial_use",
        "translation",
      ] as const),
    ),
  );
  if (!unique(allowedUses)) invalid();
  const rights = Object.freeze({
    allowedUses,
    evidenceReference: stringValue(rightsRecord.evidenceReference),
    status: oneOf(rightsRecord.status, [
      "owned",
      "licensed",
      "public_domain",
      "not_cleared",
    ] as const),
    territory: oneOf(rightsRecord.territory, ["worldwide", "restricted"] as const),
    version: version(rightsRecord.version),
  });
  return Object.freeze({
    claims,
    creator: stringValue(parsed.creator),
    editorial: editorial(parsed.editorial),
    identifier: stringValue(parsed.identifier),
    knownDisagreements,
    language: literal(parsed.language, "en"),
    publisher: stringValue(parsed.publisher),
    rights,
    sourceId: identifier(parsed.sourceId),
    sourceType: oneOf(parsed.sourceType, [
      "original",
      "licensed",
      "public_domain",
      "reference",
    ] as const),
    title: stringValue(parsed.title),
    tradition: stringValue(parsed.tradition),
    version: version(parsed.version),
  });
};

const reductionPolicy = (value: unknown): NumerologyReductionPolicyV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "base",
    "policyId",
    "preserveExactTotals",
    "preserveOnEveryStep",
    "repeatWhile",
    "stepOperation",
    "version",
  ]);
  literal(parsed.base, 10);
  const policyId = identifier(parsed.policyId);
  const masters = Object.freeze(nonEmptyArray(parsed.preserveExactTotals).map(integerValue));
  if (
    masters.length !== numerologyMasterNumbers.length ||
    masters.join(",") !== numerologyMasterNumbers.join(",")
  ) {
    invalid();
  }
  return Object.freeze({
    base: 10,
    policyId,
    preserveExactTotals: masters as readonly NumerologyMasterNumber[],
    preserveOnEveryStep: literal(parsed.preserveOnEveryStep, true),
    repeatWhile: literal(parsed.repeatWhile, "greater_than_nine_and_not_preserved"),
    stepOperation: literal(parsed.stepOperation, "sum_ascii_decimal_digits"),
    version: version(parsed.version),
  });
};

const calculationRule = (value: unknown): NumerologyCalculationRuleV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "calculationCode",
    "formula",
    "inputFields",
    "limitations",
    "reductionPolicy",
    "ruleId",
    "sources",
    "targetYearSource",
    "title",
    "version",
    "workedExamples",
  ]);
  const calculationCode = oneOf(parsed.calculationCode, numerologyCalculationCodes);
  const formula = oneOf(parsed.formula, [
    "sum_iso_birth_date_digits",
    "sum_birth_day_digits",
    "sum_birth_month_day_and_target_year_digits",
  ] as const);
  const inputFields = Object.freeze(
    nonEmptyArray(parsed.inputFields).map((field) =>
      oneOf(field, ["birth_date", "target_year"] as const),
    ),
  );
  if (!unique(inputFields)) invalid();
  const limitations = Object.freeze(nonEmptyArray(parsed.limitations).map(stringValue));
  const reductionPolicyReference = versionReference(parsed.reductionPolicy);
  const ruleId = identifier(parsed.ruleId);
  const sources = Object.freeze(nonEmptyArray(parsed.sources).map(versionReference));
  if (!unique(sources.map(referenceKey))) invalid();
  const targetYearSource = oneOf(parsed.targetYearSource, [
    "not_applicable",
    "explicit_integer_input",
  ] as const);
  const title = stringValue(parsed.title);
  const ruleVersion = version(parsed.version);
  const examples = Object.freeze(nonEmptyArray(parsed.workedExamples).map(versionReference));
  if (!unique(examples.map(referenceKey))) invalid();
  return Object.freeze({
    calculationCode,
    formula,
    inputFields,
    limitations,
    reductionPolicy: reductionPolicyReference,
    ruleId,
    sources,
    targetYearSource,
    title,
    version: ruleVersion,
    workedExamples: examples,
  });
};

const workedExample = (value: unknown): NumerologyWorkedExampleV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "birthDate",
    "canonicalDigits",
    "exampleId",
    "initialValue",
    "masterNumberPreserved",
    "reductionSteps",
    "result",
    "rule",
    "targetYear",
    "version",
  ]);
  const birthDate = date(parsed.birthDate);
  const canonicalDigits = stringValue(parsed.canonicalDigits);
  if (!/^\d+$/u.test(canonicalDigits)) invalid();
  const exampleId = identifier(parsed.exampleId);
  const initialValue = integerValue(parsed.initialValue);
  if (initialValue < 1) invalid();
  const masterNumberPreserved = booleanValue(parsed.masterNumberPreserved);
  const steps = Object.freeze(nonEmptyArray(parsed.reductionSteps).map(integerValue));
  if (steps.some((step) => step < 1) || steps[0] !== initialValue) invalid();
  const result = integerValue(parsed.result);
  if (steps.at(-1) !== result) invalid();
  const rule = versionReference(parsed.rule);
  let targetYear: number | null = null;
  if (parsed.targetYear !== null) {
    targetYear = integerValue(parsed.targetYear);
    if (targetYear < 1000 || targetYear > 9999) invalid();
  }
  return Object.freeze({
    birthDate,
    canonicalDigits,
    exampleId,
    initialValue,
    masterNumberPreserved,
    reductionSteps: steps,
    result,
    rule,
    targetYear,
    version: version(parsed.version),
  });
};

const ruleSet = (value: unknown): NumerologyRuleSetV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "calendar",
    "calculationRules",
    "contentType",
    "editorial",
    "localePolicy",
    "method",
    "privacy",
    "reductionPolicies",
    "ruleSetId",
    "sources",
    "title",
    "tradition",
    "version",
    "workedExamples",
  ]);
  const calendar = record(parsed.calendar);
  exactKeys(calendar, ["canonicalDateFormat", "localizedCalendarConversion", "system"]);
  literal(calendar.canonicalDateFormat, "YYYY-MM-DD");
  literal(calendar.localizedCalendarConversion, "unsupported");
  literal(calendar.system, "proleptic_gregorian");
  const rules = Object.freeze(nonEmptyArray(parsed.calculationRules).map(calculationRule));
  if (!unique(rules.map(({ ruleId, version: ruleVersion }) => `${ruleId}@${ruleVersion}`))) {
    invalid();
  }
  const ruleSetEditorial = editorial(parsed.editorial);
  const localePolicy = record(parsed.localePolicy);
  exactKeys(localePolicy, [
    "canonicalCalculationInput",
    "dateRulesApplyAcrossLocales",
    "nameMapping",
    "reviewedContentLocales",
    "silentTransliteration",
    "supportedNameScripts",
  ]);
  literal(localePolicy.canonicalCalculationInput, "ascii_iso_date");
  literal(localePolicy.dateRulesApplyAcrossLocales, true);
  literal(localePolicy.nameMapping, "unsupported");
  const reviewedLocales = arrayValue(localePolicy.reviewedContentLocales);
  if (reviewedLocales.length !== 1 || reviewedLocales[0] !== "en") invalid();
  literal(localePolicy.silentTransliteration, "forbidden");
  if (arrayValue(localePolicy.supportedNameScripts).length !== 0) invalid();
  const privacy = record(parsed.privacy);
  exactKeys(privacy, [
    "analyticsAllowed",
    "birthDateClassification",
    "logsAllowed",
    "nameCollection",
    "urlAllowed",
  ]);
  literal(privacy.analyticsAllowed, false);
  literal(privacy.birthDateClassification, "sensitive");
  literal(privacy.logsAllowed, false);
  literal(privacy.nameCollection, "not_applicable");
  literal(privacy.urlAllowed, false);
  const reductions = Object.freeze(nonEmptyArray(parsed.reductionPolicies).map(reductionPolicy));
  if (
    !unique(
      reductions.map(({ policyId, version: policyVersion }) => `${policyId}@${policyVersion}`),
    )
  ) {
    invalid();
  }
  const ruleSetId = identifier(parsed.ruleSetId);
  const sources = Object.freeze(nonEmptyArray(parsed.sources).map(versionReference));
  if (!unique(sources.map(referenceKey))) invalid();
  const title = stringValue(parsed.title);
  const tradition = stringValue(parsed.tradition);
  const ruleSetVersion = version(parsed.version);
  const examples = Object.freeze(nonEmptyArray(parsed.workedExamples).map(workedExample));
  if (
    !unique(
      examples.map(({ exampleId, version: exampleVersion }) => `${exampleId}@${exampleVersion}`),
    )
  ) {
    invalid();
  }
  return Object.freeze({
    calendar: Object.freeze({
      canonicalDateFormat: "YYYY-MM-DD",
      localizedCalendarConversion: "unsupported",
      system: "proleptic_gregorian",
    }),
    calculationRules: rules,
    contentType: literal(parsed.contentType, "numerology_rule_set"),
    editorial: ruleSetEditorial,
    localePolicy: Object.freeze({
      canonicalCalculationInput: "ascii_iso_date",
      dateRulesApplyAcrossLocales: true,
      nameMapping: "unsupported",
      reviewedContentLocales: Object.freeze(["en"] as const),
      silentTransliteration: "forbidden",
      supportedNameScripts: Object.freeze([] as const),
    }),
    method: literal(parsed.method, "numerology"),
    privacy: Object.freeze({
      analyticsAllowed: false,
      birthDateClassification: "sensitive",
      logsAllowed: false,
      nameCollection: "not_applicable",
      urlAllowed: false,
    }),
    reductionPolicies: reductions,
    ruleSetId,
    sources,
    title,
    tradition,
    version: ruleSetVersion,
    workedExamples: examples,
  });
};

const referenceKey = ({ id, version: referenceVersion }: NumerologyVersionReference): string =>
  `${id}@${referenceVersion}`;

const assertReferences = (catalog: NumerologyRuleCatalogV1): void => {
  const sourceKeys = new Set(
    catalog.sources.map(({ sourceId, version: sourceVersion }) => `${sourceId}@${sourceVersion}`),
  );
  const knownSources = (references: readonly NumerologyVersionReference[]): boolean =>
    references.every((reference) => sourceKeys.has(referenceKey(reference)));

  for (const ruleSet of catalog.ruleSets) {
    if (!knownSources(ruleSet.sources)) invalidReference();
    const reductionKeys = new Set(
      ruleSet.reductionPolicies.map(
        ({ policyId, version: policyVersion }) => `${policyId}@${policyVersion}`,
      ),
    );
    const ruleKeys = new Set(
      ruleSet.calculationRules.map(
        ({ ruleId, version: ruleVersion }) => `${ruleId}@${ruleVersion}`,
      ),
    );
    const exampleKeys = new Set(
      ruleSet.workedExamples.map(
        ({ exampleId, version: exampleVersion }) => `${exampleId}@${exampleVersion}`,
      ),
    );
    for (const rule of ruleSet.calculationRules) {
      if (
        !knownSources(rule.sources) ||
        !reductionKeys.has(referenceKey(rule.reductionPolicy)) ||
        !rule.workedExamples.every((reference) => exampleKeys.has(referenceKey(reference)))
      ) {
        invalidReference();
      }
    }
    for (const example of ruleSet.workedExamples) {
      if (!ruleKeys.has(referenceKey(example.rule))) invalidReference();
    }
  }
};

export const parseNumerologyRuleCatalogV1 = (value: unknown): NumerologyRuleCatalogV1 => {
  const parsed = record(value);
  if (parsed.schemaVersion !== numerologyCatalogSchemaVersion) {
    throw new NumerologyContentError("NUMEROLOGY_SCHEMA_VERSION_UNSUPPORTED");
  }
  exactKeys(parsed, [
    "catalogId",
    "contentType",
    "editorial",
    "locale",
    "method",
    "ruleSets",
    "schemaVersion",
    "sources",
    "title",
    "usePolicy",
    "version",
  ]);
  const catalogId = identifier(parsed.catalogId);
  const catalogEditorial = editorial(parsed.editorial);
  const parsedRuleSets = Object.freeze(nonEmptyArray(parsed.ruleSets).map(ruleSet));
  if (
    !unique(
      parsedRuleSets.map(
        ({ ruleSetId, version: ruleSetVersion }) => `${ruleSetId}@${ruleSetVersion}`,
      ),
    )
  ) {
    invalid();
  }
  const parsedSources = Object.freeze(nonEmptyArray(parsed.sources).map(sourceRecord));
  if (
    !unique(
      parsedSources.map(({ sourceId, version: sourceVersion }) => `${sourceId}@${sourceVersion}`),
    )
  ) {
    invalid();
  }
  const title = stringValue(parsed.title);
  const usePolicy = record(parsed.usePolicy);
  exactKeys(usePolicy, [
    "aiInterpretationAllowed",
    "engineCalculationAllowed",
    "indexingAllowed",
    "publicPublicationAllowed",
  ]);
  literal(usePolicy.aiInterpretationAllowed, false);
  const engineCalculationAllowed = booleanValue(usePolicy.engineCalculationAllowed);
  literal(usePolicy.indexingAllowed, false);
  literal(usePolicy.publicPublicationAllowed, false);
  const catalog = Object.freeze({
    catalogId,
    contentType: literal(parsed.contentType, "numerology_rule_catalog"),
    editorial: catalogEditorial,
    locale: literal(parsed.locale, "en"),
    method: literal(parsed.method, "numerology"),
    ruleSets: parsedRuleSets,
    schemaVersion: numerologyCatalogSchemaVersion,
    sources: parsedSources,
    title,
    usePolicy: Object.freeze({
      aiInterpretationAllowed: false,
      engineCalculationAllowed,
      indexingAllowed: false,
      publicPublicationAllowed: false,
    }),
    version: version(parsed.version),
  });
  assertReferences(catalog);
  return catalog;
};

export const parseNumerologyAsOfDate = (value: unknown): string => date(value);
