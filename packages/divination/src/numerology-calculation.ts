import {
  numerologyMasterNumbers,
  type NumerologyCalculationCode,
  type NumerologyCalculationRuleV1,
  type NumerologyRuleCatalogV1,
  type NumerologyRuleSetV1,
  type NumerologyVersionReference,
} from "./numerology-content.js";
import { assertNumerologyEngineReady } from "./numerology-readiness.js";

export const numerologyCalculationRequestSchemaVersion =
  "numerology-calculation-request.v1" as const;
export const numerologyCalculationFactsSchemaVersion = "numerology-calculation-facts.v1" as const;
export const numerologyEngineName = "rituvia-date-numerology" as const;
export const numerologyEngineVersion = "1.0.0" as const;
export const numerologyAlgorithmVersion = "rituvia-date-reduction.v1" as const;

export const numerologyCalculationErrorCodes = Object.freeze([
  "NUMEROLOGY_REQUEST_INVALID",
  "NUMEROLOGY_FACTS_INVALID",
  "NUMEROLOGY_RULE_SET_UNSUPPORTED",
  "NUMEROLOGY_ENGINE_INVARIANT",
] as const);
export type NumerologyCalculationErrorCode = (typeof numerologyCalculationErrorCodes)[number];

const numerologyCalculationErrorMessage = (code: NumerologyCalculationErrorCode): string => {
  switch (code) {
    case "NUMEROLOGY_REQUEST_INVALID":
      return "The numerology calculation request is invalid.";
    case "NUMEROLOGY_FACTS_INVALID":
      return "The numerology calculation facts are invalid.";
    case "NUMEROLOGY_RULE_SET_UNSUPPORTED":
      return "The numerology rule set is unsupported by this engine.";
    case "NUMEROLOGY_ENGINE_INVARIANT":
      return "The numerology calculation invariant failed.";
  }
};

export class NumerologyCalculationError extends Error {
  readonly code: NumerologyCalculationErrorCode;

  constructor(code: NumerologyCalculationErrorCode) {
    super(numerologyCalculationErrorMessage(code));
    this.name = "NumerologyCalculationError";
    this.code = code;
  }
}

export type NumerologyCalculationRequestV1 = Readonly<{
  birthDate: string;
  schemaVersion: typeof numerologyCalculationRequestSchemaVersion;
  targetYear: number;
}>;

export type NumerologyDatePartsV1 = Readonly<{
  day: number;
  dayDigits: string;
  month: number;
  monthDigits: string;
  year: number;
  yearDigits: string;
}>;

export type NumerologyCalculatedValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 22 | 33;

export type NumerologyFormulaEvidenceV1 = Readonly<{
  calculationCode: NumerologyCalculationCode;
  canonicalDigits: string;
  formula: NumerologyCalculationRuleV1["formula"];
  initialValue: number;
  masterNumberPreserved: boolean;
  reductionPolicy: NumerologyVersionReference;
  reductionSteps: readonly number[];
  result: NumerologyCalculatedValue;
  rule: NumerologyVersionReference;
}>;

export type NumerologyCalculationFactsV1 = Readonly<{
  algorithmVersion: typeof numerologyAlgorithmVersion;
  calculations: readonly NumerologyFormulaEvidenceV1[];
  catalog: NumerologyVersionReference;
  engineName: typeof numerologyEngineName;
  engineVersion: typeof numerologyEngineVersion;
  input: Readonly<{
    birthDate: string;
    targetYear: number;
  }>;
  ruleSet: NumerologyVersionReference;
  schemaVersion: typeof numerologyCalculationFactsSchemaVersion;
}>;

export type CalculateNumerologyInputV1 = Readonly<{
  asOf: string;
  catalog: unknown;
  request: unknown;
}>;

export type VerifyNumerologyCalculationFactsInputV1 = Readonly<{
  asOf: string;
  catalog: unknown;
  facts: unknown;
}>;

type UnknownRecord = Record<string, unknown>;

const requestInvalid = (): never => {
  throw new NumerologyCalculationError("NUMEROLOGY_REQUEST_INVALID");
};

const unsupported = (): never => {
  throw new NumerologyCalculationError("NUMEROLOGY_RULE_SET_UNSUPPORTED");
};

const factsInvalid = (): never => {
  throw new NumerologyCalculationError("NUMEROLOGY_FACTS_INVALID");
};

const invariant = (): never => {
  throw new NumerologyCalculationError("NUMEROLOGY_ENGINE_INVARIANT");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) requestInvalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) {
    requestInvalid();
  }
};

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number => {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    default:
      return 0;
  }
};

export const parseNumerologyBirthDateV1 = (value: unknown): NumerologyDatePartsV1 => {
  if (typeof value !== "string") requestInvalid();
  const birthDate = value as string;
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(birthDate);
  if (match === null) requestInvalid();
  const [, yearDigits, monthDigits, dayDigits] = match as RegExpExecArray;
  if (yearDigits === undefined || monthDigits === undefined || dayDigits === undefined) {
    requestInvalid();
  }
  const safeYearDigits = yearDigits as string;
  const safeMonthDigits = monthDigits as string;
  const safeDayDigits = dayDigits as string;
  const year = Number(safeYearDigits);
  const month = Number(safeMonthDigits);
  const day = Number(safeDayDigits);
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    requestInvalid();
  }
  return Object.freeze({
    day,
    dayDigits: safeDayDigits,
    month,
    monthDigits: safeMonthDigits,
    year,
    yearDigits: safeYearDigits,
  });
};

const parseNumerologyCalculationRequestUnsafe = (
  value: unknown,
): NumerologyCalculationRequestV1 => {
  const candidate = record(value);
  exactKeys(candidate, ["birthDate", "schemaVersion", "targetYear"]);
  if (candidate.schemaVersion !== numerologyCalculationRequestSchemaVersion) requestInvalid();
  parseNumerologyBirthDateV1(candidate.birthDate);
  if (
    !Number.isSafeInteger(candidate.targetYear) ||
    (candidate.targetYear as number) < 1000 ||
    (candidate.targetYear as number) > 9999
  ) {
    requestInvalid();
  }
  return Object.freeze({
    birthDate: candidate.birthDate as string,
    schemaVersion: numerologyCalculationRequestSchemaVersion,
    targetYear: candidate.targetYear as number,
  });
};

export const parseNumerologyCalculationRequestV1 = (
  value: unknown,
): NumerologyCalculationRequestV1 => {
  try {
    return parseNumerologyCalculationRequestUnsafe(value);
  } catch (error) {
    if (error instanceof NumerologyCalculationError) throw error;
    return requestInvalid();
  }
};

const digitSum = (digits: string): number => {
  let total = 0;
  for (const digit of digits) total += Number(digit);
  return total;
};

const isMasterNumber = (value: number): value is 11 | 22 | 33 =>
  numerologyMasterNumbers.includes(value as 11 | 22 | 33);

const isCalculatedValue = (value: number): value is NumerologyCalculatedValue =>
  (value >= 1 && value <= 9) || isMasterNumber(value);

const reduceValue = (
  initialValue: number,
): Readonly<{
  masterNumberPreserved: boolean;
  reductionSteps: readonly number[];
  result: NumerologyCalculatedValue;
}> => {
  if (!Number.isSafeInteger(initialValue) || initialValue < 1) invariant();
  const reductionSteps = [initialValue];
  let current = initialValue;
  while (current > 9 && !isMasterNumber(current)) {
    current = digitSum(String(current));
    reductionSteps.push(current);
  }
  if (!isCalculatedValue(current)) invariant();
  return Object.freeze({
    masterNumberPreserved: isMasterNumber(current),
    reductionSteps: Object.freeze(reductionSteps),
    result: current as NumerologyCalculatedValue,
  });
};

const reference = (id: string, version: string): NumerologyVersionReference =>
  Object.freeze({
    id: id as NumerologyVersionReference["id"],
    version: version as NumerologyVersionReference["version"],
  });

const supportedCatalog = Object.freeze({
  id: "rituvia.numerology.date-reduction.en",
  version: "1.0.0",
});
const supportedRuleSet = Object.freeze({
  id: "rituvia.date-reduction",
  version: "1.0.0",
});
const supportedReductionPolicy = Object.freeze({
  id: "rituvia.decimal-reduction",
  version: "1.0.0",
});
const supportedApprovalReference = "OWN-011:option-a:2026-07-25";

const supportedRule = (
  calculationCode: NumerologyCalculationCode,
): Readonly<{
  formula: NumerologyCalculationRuleV1["formula"];
  id: string;
  version: string;
}> => {
  switch (calculationCode) {
    case "life_path":
      return Object.freeze({
        formula: "sum_iso_birth_date_digits",
        id: "rituvia.life-path",
        version: "1.0.0",
      });
    case "birthday_number":
      return Object.freeze({
        formula: "sum_birth_day_digits",
        id: "rituvia.birthday-number",
        version: "1.0.0",
      });
    case "personal_year":
      return Object.freeze({
        formula: "sum_birth_month_day_and_target_year_digits",
        id: "rituvia.personal-year",
        version: "1.0.0",
      });
  }
};

const exactReference = (
  candidate: NumerologyVersionReference,
  expected: Readonly<{ id: string; version: string }>,
): boolean => candidate.id === expected.id && candidate.version === expected.version;

const resolveSupportedRuleSet = (catalog: NumerologyRuleCatalogV1): NumerologyRuleSetV1 => {
  const ruleSet = catalog.ruleSets.find(
    ({ ruleSetId, version }) =>
      ruleSetId === supportedRuleSet.id && version === supportedRuleSet.version,
  );
  if (
    catalog.catalogId !== supportedCatalog.id ||
    catalog.version !== supportedCatalog.version ||
    catalog.editorial.approvalReference !== supportedApprovalReference ||
    ruleSet === undefined ||
    ruleSet.editorial.approvalReference !== supportedApprovalReference ||
    ruleSet.reductionPolicies.length !== 1
  ) {
    unsupported();
  }
  const resolvedRuleSet = ruleSet as NumerologyRuleSetV1;
  const reductionPolicy = resolvedRuleSet.reductionPolicies.at(0);
  if (
    reductionPolicy === undefined ||
    reductionPolicy.policyId !== supportedReductionPolicy.id ||
    reductionPolicy.version !== supportedReductionPolicy.version
  ) {
    unsupported();
  }
  return resolvedRuleSet;
};

const resolveRule = (
  ruleSet: NumerologyRuleSetV1,
  calculationCode: NumerologyCalculationCode,
): NumerologyCalculationRuleV1 => {
  const expected = supportedRule(calculationCode);
  const rule = ruleSet.calculationRules.find(
    (candidate) => candidate.calculationCode === calculationCode,
  );
  if (
    rule === undefined ||
    rule.ruleId !== expected.id ||
    rule.version !== expected.version ||
    rule.formula !== expected.formula ||
    !exactReference(rule.reductionPolicy, supportedReductionPolicy)
  ) {
    unsupported();
  }
  return rule as NumerologyCalculationRuleV1;
};

const calculateEvidence = (
  rule: NumerologyCalculationRuleV1,
  canonicalDigits: string,
  initialValue: number,
): NumerologyFormulaEvidenceV1 => {
  const reduction = reduceValue(initialValue);
  return Object.freeze({
    calculationCode: rule.calculationCode,
    canonicalDigits,
    formula: rule.formula,
    initialValue,
    masterNumberPreserved: reduction.masterNumberPreserved,
    reductionPolicy: reference(rule.reductionPolicy.id, rule.reductionPolicy.version),
    reductionSteps: reduction.reductionSteps,
    result: reduction.result,
    rule: reference(rule.ruleId, rule.version),
  });
};

export const calculateNumerologyV1 = ({
  asOf,
  catalog: catalogInput,
  request: requestInput,
}: CalculateNumerologyInputV1): NumerologyCalculationFactsV1 => {
  const request = parseNumerologyCalculationRequestV1(requestInput);
  const date = parseNumerologyBirthDateV1(request.birthDate);
  const catalog = assertNumerologyEngineReady(catalogInput, asOf);
  const ruleSet = resolveSupportedRuleSet(catalog);
  const lifePathRule = resolveRule(ruleSet, "life_path");
  const birthdayRule = resolveRule(ruleSet, "birthday_number");
  const personalYearRule = resolveRule(ruleSet, "personal_year");
  const lifePathDigits = `${date.yearDigits}${date.monthDigits}${date.dayDigits}`;
  const personalYearDigits = `${date.monthDigits}${date.dayDigits}${String(request.targetYear)}`;

  const calculations = Object.freeze([
    calculateEvidence(lifePathRule, lifePathDigits, digitSum(lifePathDigits)),
    calculateEvidence(birthdayRule, date.dayDigits, date.day),
    calculateEvidence(personalYearRule, personalYearDigits, digitSum(personalYearDigits)),
  ]);

  return Object.freeze({
    algorithmVersion: numerologyAlgorithmVersion,
    calculations,
    catalog: reference(catalog.catalogId, catalog.version),
    engineName: numerologyEngineName,
    engineVersion: numerologyEngineVersion,
    input: Object.freeze({
      birthDate: request.birthDate,
      targetYear: request.targetYear,
    }),
    ruleSet: reference(ruleSet.ruleSetId, ruleSet.version),
    schemaVersion: numerologyCalculationFactsSchemaVersion,
  });
};

const factsRecord = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) factsInvalid();
  return value as UnknownRecord;
};

const factsExactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) {
    factsInvalid();
  }
};

const factsReference = (value: unknown): NumerologyVersionReference => {
  const candidate = factsRecord(value);
  factsExactKeys(candidate, ["id", "version"]);
  if (typeof candidate.id !== "string" || typeof candidate.version !== "string") {
    factsInvalid();
  }
  return reference(candidate.id as string, candidate.version as string);
};

const calculationCodeValue = (value: unknown): NumerologyCalculationCode => {
  if (value !== "life_path" && value !== "birthday_number" && value !== "personal_year") {
    factsInvalid();
  }
  return value as NumerologyCalculationCode;
};

const formulaValue = (value: unknown): NumerologyCalculationRuleV1["formula"] => {
  if (
    value !== "sum_iso_birth_date_digits" &&
    value !== "sum_birth_day_digits" &&
    value !== "sum_birth_month_day_and_target_year_digits"
  ) {
    factsInvalid();
  }
  return value as NumerologyCalculationRuleV1["formula"];
};

const parseEvidence = (value: unknown): NumerologyFormulaEvidenceV1 => {
  const candidate = factsRecord(value);
  factsExactKeys(candidate, [
    "calculationCode",
    "canonicalDigits",
    "formula",
    "initialValue",
    "masterNumberPreserved",
    "reductionPolicy",
    "reductionSteps",
    "result",
    "rule",
  ]);
  const calculationCode = calculationCodeValue(candidate.calculationCode);
  const formula = formulaValue(candidate.formula);
  const expectedRule = supportedRule(calculationCode);
  const rule = factsReference(candidate.rule);
  const reductionPolicy = factsReference(candidate.reductionPolicy);
  if (
    typeof candidate.canonicalDigits !== "string" ||
    !/^[0-9]+$/u.test(candidate.canonicalDigits) ||
    !Number.isSafeInteger(candidate.initialValue) ||
    (candidate.initialValue as number) < 1 ||
    typeof candidate.masterNumberPreserved !== "boolean" ||
    !Array.isArray(candidate.reductionSteps) ||
    candidate.reductionSteps.length === 0 ||
    candidate.reductionSteps.some((step) => !Number.isSafeInteger(step) || (step as number) < 1) ||
    !Number.isSafeInteger(candidate.result) ||
    !isCalculatedValue(candidate.result as number) ||
    formula !== expectedRule.formula ||
    rule.id !== expectedRule.id ||
    rule.version !== expectedRule.version ||
    !exactReference(reductionPolicy, supportedReductionPolicy)
  ) {
    factsInvalid();
  }
  const reductionSteps = Object.freeze((candidate.reductionSteps as number[]).map((step) => step));
  if (
    reductionSteps.at(0) !== candidate.initialValue ||
    reductionSteps.at(-1) !== candidate.result
  ) {
    factsInvalid();
  }
  return Object.freeze({
    calculationCode,
    canonicalDigits: candidate.canonicalDigits as string,
    formula,
    initialValue: candidate.initialValue as number,
    masterNumberPreserved: candidate.masterNumberPreserved as boolean,
    reductionPolicy,
    reductionSteps,
    result: candidate.result as NumerologyCalculatedValue,
    rule,
  });
};

const parseNumerologyCalculationFactsUnsafe = (value: unknown): NumerologyCalculationFactsV1 => {
  const candidate = factsRecord(value);
  factsExactKeys(candidate, [
    "algorithmVersion",
    "calculations",
    "catalog",
    "engineName",
    "engineVersion",
    "input",
    "ruleSet",
    "schemaVersion",
  ]);
  if (
    candidate.algorithmVersion !== numerologyAlgorithmVersion ||
    candidate.engineName !== numerologyEngineName ||
    candidate.engineVersion !== numerologyEngineVersion ||
    candidate.schemaVersion !== numerologyCalculationFactsSchemaVersion ||
    !Array.isArray(candidate.calculations) ||
    candidate.calculations.length !== 3
  ) {
    factsInvalid();
  }
  const catalogReference = factsReference(candidate.catalog);
  const ruleSetReference = factsReference(candidate.ruleSet);
  if (
    !exactReference(catalogReference, supportedCatalog) ||
    !exactReference(ruleSetReference, supportedRuleSet)
  ) {
    factsInvalid();
  }
  const input = factsRecord(candidate.input);
  factsExactKeys(input, ["birthDate", "targetYear"]);
  const parsedRequest = parseNumerologyCalculationRequestV1({
    birthDate: input.birthDate,
    schemaVersion: numerologyCalculationRequestSchemaVersion,
    targetYear: input.targetYear,
  });
  const calculations = Object.freeze((candidate.calculations as unknown[]).map(parseEvidence));
  if (
    calculations.map(({ calculationCode }) => calculationCode).join(",") !==
    "life_path,birthday_number,personal_year"
  ) {
    factsInvalid();
  }
  return Object.freeze({
    algorithmVersion: numerologyAlgorithmVersion,
    calculations,
    catalog: catalogReference,
    engineName: numerologyEngineName,
    engineVersion: numerologyEngineVersion,
    input: Object.freeze({
      birthDate: parsedRequest.birthDate,
      targetYear: parsedRequest.targetYear,
    }),
    ruleSet: ruleSetReference,
    schemaVersion: numerologyCalculationFactsSchemaVersion,
  });
};

export const parseNumerologyCalculationFactsV1 = (value: unknown): NumerologyCalculationFactsV1 => {
  try {
    return parseNumerologyCalculationFactsUnsafe(value);
  } catch (error) {
    if (error instanceof NumerologyCalculationError && error.code === "NUMEROLOGY_FACTS_INVALID") {
      throw error;
    }
    return factsInvalid();
  }
};

const sameReference = (
  left: NumerologyVersionReference,
  right: NumerologyVersionReference,
): boolean => left.id === right.id && left.version === right.version;

const sameEvidence = (
  left: NumerologyFormulaEvidenceV1,
  right: NumerologyFormulaEvidenceV1,
): boolean =>
  left.calculationCode === right.calculationCode &&
  left.canonicalDigits === right.canonicalDigits &&
  left.formula === right.formula &&
  left.initialValue === right.initialValue &&
  left.masterNumberPreserved === right.masterNumberPreserved &&
  sameReference(left.reductionPolicy, right.reductionPolicy) &&
  left.reductionSteps.join(",") === right.reductionSteps.join(",") &&
  left.result === right.result &&
  sameReference(left.rule, right.rule);

export const verifyNumerologyCalculationFactsV1 = ({
  asOf,
  catalog: catalogInput,
  facts: factsInput,
}: VerifyNumerologyCalculationFactsInputV1): NumerologyCalculationFactsV1 => {
  const facts = parseNumerologyCalculationFactsV1(factsInput);
  const expected = calculateNumerologyV1({
    asOf,
    catalog: catalogInput,
    request: {
      birthDate: facts.input.birthDate,
      schemaVersion: numerologyCalculationRequestSchemaVersion,
      targetYear: facts.input.targetYear,
    },
  });
  const [lifePath, birthday, personalYear] = facts.calculations;
  const [expectedLifePath, expectedBirthday, expectedPersonalYear] = expected.calculations;
  if (
    lifePath === undefined ||
    birthday === undefined ||
    personalYear === undefined ||
    expectedLifePath === undefined ||
    expectedBirthday === undefined ||
    expectedPersonalYear === undefined ||
    facts.algorithmVersion !== expected.algorithmVersion ||
    facts.engineName !== expected.engineName ||
    facts.engineVersion !== expected.engineVersion ||
    facts.schemaVersion !== expected.schemaVersion ||
    !sameReference(facts.catalog, expected.catalog) ||
    !sameReference(facts.ruleSet, expected.ruleSet) ||
    facts.input.birthDate !== expected.input.birthDate ||
    facts.input.targetYear !== expected.input.targetYear ||
    !sameEvidence(lifePath, expectedLifePath) ||
    !sameEvidence(birthday, expectedBirthday) ||
    !sameEvidence(personalYear, expectedPersonalYear)
  ) {
    factsInvalid();
  }
  return facts;
};
