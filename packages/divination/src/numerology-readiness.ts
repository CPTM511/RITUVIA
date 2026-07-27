import {
  NumerologyContentError,
  numerologyCalculationCodes,
  numerologyMasterNumbers,
  parseNumerologyAsOfDate,
  parseNumerologyRuleCatalogV1,
  type NumerologyCalculationRuleV1,
  type NumerologyEditorialMetadataV1,
  type NumerologyRuleCatalogV1,
  type NumerologyRuleSetV1,
  type NumerologySourceRecordV1,
} from "./numerology-content.js";

export const numerologyReadinessReasonCodes = Object.freeze([
  "ENGINE_USE_DISABLED",
  "EDITORIAL_NOT_APPROVED",
  "REQUIRED_APPROVAL_MISSING",
  "EFFECTIVE_DATE_INVALID",
  "REVIEW_EXPIRED",
  "SOURCE_RIGHTS_NOT_CLEARED",
  "ENGINE_RIGHTS_MISSING",
  "WORLDWIDE_RIGHTS_MISSING",
  "SOURCE_CLAIMS_MISSING",
  "RULE_SET_INVENTORY_INVALID",
  "CALCULATION_INVENTORY_INVALID",
  "RULE_FORMULA_INVALID",
  "WORKED_EXAMPLE_COVERAGE_INVALID",
  "WORKED_EXAMPLE_ARITHMETIC_INVALID",
  "PROHIBITED_CLAIM",
] as const);

export type NumerologyReadinessReasonCode = (typeof numerologyReadinessReasonCodes)[number];

export type NumerologyReadinessAssessment = Readonly<{
  asOf: string;
  catalogId: string;
  catalogVersion: string;
  eligible: boolean;
  reasons: readonly NumerologyReadinessReasonCode[];
  schemaVersion: "numerology-engine-readiness.v1";
}>;

const editorialEligible = (
  editorial: NumerologyEditorialMetadataV1,
  asOf: string,
  addReason: (reason: NumerologyReadinessReasonCode) => void,
): void => {
  if (editorial.status !== "approved") addReason("EDITORIAL_NOT_APPROVED");
  if (
    editorial.approvalReference === null ||
    editorial.reviewedDate === null ||
    editorial.reviewerId === null ||
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
  source: NumerologySourceRecordV1,
  asOf: string,
  addReason: (reason: NumerologyReadinessReasonCode) => void,
): void => {
  editorialEligible(source.editorial, asOf, addReason);
  if (!["owned", "licensed", "public_domain"].includes(source.rights.status)) {
    addReason("SOURCE_RIGHTS_NOT_CLEARED");
  }
  if (!source.rights.allowedUses.includes("engine_calculation")) {
    addReason("ENGINE_RIGHTS_MISSING");
  }
  if (source.rights.territory !== "worldwide") addReason("WORLDWIDE_RIGHTS_MISSING");
  if (source.claims.length === 0) addReason("SOURCE_CLAIMS_MISSING");
};

const decimalDigitSum = (digits: string): number =>
  [...digits].reduce((total, digit) => total + Number(digit), 0);

const expectedReductionSteps = (initialSum: number): readonly number[] => {
  const steps = [initialSum];
  let current = initialSum;
  while (current > 9 && !numerologyMasterNumbers.includes(current as 11 | 22 | 33)) {
    current = decimalDigitSum(String(current));
    steps.push(current);
  }
  return steps;
};

const expectedDigits = (
  calculationCode: NumerologyCalculationRuleV1["calculationCode"],
  birthDate: string,
  targetYear: number | null,
): string => {
  const [year, month, day] = birthDate.split("-");
  if (year === undefined || month === undefined || day === undefined) return "";
  switch (calculationCode) {
    case "life_path":
      return `${year}${month}${day}`;
    case "birthday_number":
      return day;
    case "personal_year":
      return targetYear === null ? "" : `${month}${day}${String(targetYear).padStart(4, "0")}`;
  }
};

const expectedInitialValue = (
  calculationCode: NumerologyCalculationRuleV1["calculationCode"],
  canonicalDigits: string,
): number =>
  calculationCode === "birthday_number"
    ? Number(canonicalDigits)
    : decimalDigitSum(canonicalDigits);

const ruleFormulaEligible = (rule: NumerologyCalculationRuleV1): boolean => {
  switch (rule.calculationCode) {
    case "life_path":
      return (
        rule.formula === "sum_iso_birth_date_digits" &&
        rule.inputFields.length === 1 &&
        rule.inputFields[0] === "birth_date" &&
        rule.targetYearSource === "not_applicable"
      );
    case "birthday_number":
      return (
        rule.formula === "sum_birth_day_digits" &&
        rule.inputFields.length === 1 &&
        rule.inputFields[0] === "birth_date" &&
        rule.targetYearSource === "not_applicable"
      );
    case "personal_year":
      return (
        rule.formula === "sum_birth_month_day_and_target_year_digits" &&
        rule.inputFields.length === 2 &&
        rule.inputFields[0] === "birth_date" &&
        rule.inputFields[1] === "target_year" &&
        rule.targetYearSource === "explicit_integer_input"
      );
  }
};

const exampleCoverageEligible = (ruleSet: NumerologyRuleSetV1): boolean =>
  ruleSet.calculationRules.every((rule) => {
    const examples = ruleSet.workedExamples.filter(
      ({ rule: exampleRule }) =>
        exampleRule.id === rule.ruleId && exampleRule.version === rule.version,
    );
    return (
      examples.length >= 2 &&
      examples.some(({ masterNumberPreserved }) => masterNumberPreserved) &&
      examples.some(({ masterNumberPreserved }) => !masterNumberPreserved)
    );
  });

const exampleArithmeticEligible = (ruleSet: NumerologyRuleSetV1): boolean => {
  const rules = new Map(
    ruleSet.calculationRules.map((rule) => [`${rule.ruleId}@${rule.version}`, rule]),
  );
  return ruleSet.workedExamples.every((example) => {
    const rule = rules.get(`${example.rule.id}@${example.rule.version}`);
    if (rule === undefined) return false;
    const digits = expectedDigits(rule.calculationCode, example.birthDate, example.targetYear);
    const steps = expectedReductionSteps(expectedInitialValue(rule.calculationCode, digits));
    return (
      digits === example.canonicalDigits &&
      steps[0] === example.initialValue &&
      steps.join(",") === example.reductionSteps.join(",") &&
      steps.at(-1) === example.result &&
      example.masterNumberPreserved ===
        numerologyMasterNumbers.includes(example.result as 11 | 22 | 33)
    );
  });
};

const prohibitedClaimPatterns = Object.freeze([
  /\b(?:universal|scientifically proven) numerology\b/iu,
  /\b(?:predicts?|proves?|guarantees?|determines?) (?:the |your )?(?:future|destiny|fate)\b/iu,
  /\bfixed (?:identity|personality|character)\b/iu,
  /\b(?:diagnoses?|treats?|cures?)\b/iu,
  /\b(?:guaranteed wealth|guaranteed reunion|curse removal)\b/iu,
]);

const hasProhibitedClaim = (catalog: NumerologyRuleCatalogV1): boolean => {
  const texts = [
    catalog.title,
    ...catalog.sources.flatMap(
      ({ claims, creator, knownDisagreements, publisher, title, tradition }) => [
        creator,
        publisher,
        title,
        tradition,
        ...knownDisagreements,
        ...claims.map(({ statement }) => statement),
      ],
    ),
    ...catalog.ruleSets.flatMap(({ calculationRules, title, tradition }) => [
      title,
      tradition,
      ...calculationRules.flatMap(({ limitations, title: ruleTitle }) => [
        ruleTitle,
        ...limitations,
      ]),
    ]),
  ];
  return texts.some((text) => prohibitedClaimPatterns.some((pattern) => pattern.test(text)));
};

export const assessNumerologyEngineReadiness = (
  value: unknown,
  asOfInput: unknown,
): NumerologyReadinessAssessment => {
  const catalog = parseNumerologyRuleCatalogV1(value);
  const asOf = parseNumerologyAsOfDate(asOfInput);
  const reasons = new Set<NumerologyReadinessReasonCode>();
  const addReason = (reason: NumerologyReadinessReasonCode): void => {
    reasons.add(reason);
  };

  if (!catalog.usePolicy.engineCalculationAllowed) addReason("ENGINE_USE_DISABLED");
  editorialEligible(catalog.editorial, asOf, addReason);
  for (const source of catalog.sources) sourceEligible(source, asOf, addReason);

  if (catalog.ruleSets.length !== 1) addReason("RULE_SET_INVENTORY_INVALID");
  for (const ruleSet of catalog.ruleSets) {
    editorialEligible(ruleSet.editorial, asOf, addReason);
    if (
      ruleSet.calculationRules.length !== numerologyCalculationCodes.length ||
      numerologyCalculationCodes.some(
        (calculationCode) =>
          !ruleSet.calculationRules.some((rule) => rule.calculationCode === calculationCode),
      )
    ) {
      addReason("CALCULATION_INVENTORY_INVALID");
    }
    if (!ruleSet.calculationRules.every(ruleFormulaEligible)) {
      addReason("RULE_FORMULA_INVALID");
    }
    if (!exampleCoverageEligible(ruleSet)) {
      addReason("WORKED_EXAMPLE_COVERAGE_INVALID");
    }
    if (!exampleArithmeticEligible(ruleSet)) {
      addReason("WORKED_EXAMPLE_ARITHMETIC_INVALID");
    }
  }
  if (hasProhibitedClaim(catalog)) addReason("PROHIBITED_CLAIM");

  const orderedReasons = Object.freeze(
    numerologyReadinessReasonCodes.filter((reason) => reasons.has(reason)),
  );
  return Object.freeze({
    asOf,
    catalogId: catalog.catalogId,
    catalogVersion: catalog.version,
    eligible: orderedReasons.length === 0,
    reasons: orderedReasons,
    schemaVersion: "numerology-engine-readiness.v1",
  });
};

export const assertNumerologyEngineReady = (
  value: unknown,
  asOfInput: unknown,
): NumerologyRuleCatalogV1 => {
  const catalog = parseNumerologyRuleCatalogV1(value);
  if (!assessNumerologyEngineReadiness(catalog, asOfInput).eligible) {
    throw new NumerologyContentError("NUMEROLOGY_CATALOG_NOT_ENGINE_READY");
  }
  return catalog;
};
