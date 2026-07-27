export const numerologyCalculationRequestSchemaVersion =
  "numerology-calculation-request.v1" as const;
export const numerologyCalculationFactsSchemaVersion = "numerology-calculation-facts.v1" as const;

export type NumerologyCalculationCode = "birthday_number" | "life_path" | "personal_year";
export type NumerologyCalculatedValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 22 | 33;
export type NumerologyCalculationRequest = Readonly<{
  birthDate: string;
  schemaVersion: typeof numerologyCalculationRequestSchemaVersion;
  targetYear: number;
}>;
export type NumerologyFormulaEvidence = Readonly<{
  calculationCode: NumerologyCalculationCode;
  canonicalDigits: string;
  formula:
    | "sum_birth_day_digits"
    | "sum_birth_month_day_and_target_year_digits"
    | "sum_iso_birth_date_digits";
  initialValue: number;
  masterNumberPreserved: boolean;
  reductionPolicy: Readonly<{ id: string; version: string }>;
  reductionSteps: readonly number[];
  result: NumerologyCalculatedValue;
  rule: Readonly<{ id: string; version: string }>;
}>;
export type NumerologyCalculationFacts = Readonly<{
  algorithmVersion: "rituvia-date-reduction.v1";
  calculations: readonly NumerologyFormulaEvidence[];
  catalog: Readonly<{ id: string; version: string }>;
  engineName: "rituvia-date-numerology";
  engineVersion: "1.0.0";
  input: Readonly<{ birthDate: string; targetYear: number }>;
  ruleSet: Readonly<{ id: string; version: string }>;
  schemaVersion: typeof numerologyCalculationFactsSchemaVersion;
}>;

type UnknownRecord = Record<string, unknown>;

const invalid = (): never => {
  throw new TypeError("The numerology calculation response is invalid.");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) invalid();
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

export const parseNumerologyBirthDateInput = (
  value: unknown,
): Readonly<{ day: number; dayDigits: string; monthDigits: string; yearDigits: string }> => {
  if (typeof value !== "string") invalid();
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(value as string);
  if (match === null) invalid();
  const yearDigits = (match as RegExpExecArray).at(1);
  const monthDigits = (match as RegExpExecArray).at(2);
  const dayDigits = (match as RegExpExecArray).at(3);
  if (yearDigits === undefined || monthDigits === undefined || dayDigits === undefined) invalid();
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
    invalid();
  }
  return Object.freeze({
    day,
    dayDigits: safeDayDigits,
    monthDigits: safeMonthDigits,
    yearDigits: safeYearDigits,
  });
};

export const createNumerologyCalculationRequest = (
  birthDate: unknown,
  targetYear: unknown,
): NumerologyCalculationRequest => {
  parseNumerologyBirthDateInput(birthDate);
  if (
    !Number.isSafeInteger(targetYear) ||
    (targetYear as number) < 1000 ||
    (targetYear as number) > 9999
  ) {
    invalid();
  }
  return Object.freeze({
    birthDate: birthDate as string,
    schemaVersion: numerologyCalculationRequestSchemaVersion,
    targetYear: targetYear as number,
  });
};

const digitSum = (digits: string): number =>
  [...digits].reduce((total, digit) => total + Number(digit), 0);

const reduce = (
  initialValue: number,
): Readonly<{
  masterNumberPreserved: boolean;
  reductionSteps: readonly number[];
  result: NumerologyCalculatedValue;
}> => {
  const steps = [initialValue];
  let current = initialValue;
  while (current > 9 && current !== 11 && current !== 22 && current !== 33) {
    current = digitSum(String(current));
    steps.push(current);
  }
  if (!((current >= 1 && current <= 9) || current === 11 || current === 22 || current === 33)) {
    invalid();
  }
  return Object.freeze({
    masterNumberPreserved: current === 11 || current === 22 || current === 33,
    reductionSteps: Object.freeze(steps),
    result: current as NumerologyCalculatedValue,
  });
};

const expectedEvidence = (
  code: NumerologyCalculationCode,
  input: Readonly<{ birthDate: string; targetYear: number }>,
): NumerologyFormulaEvidence => {
  const date = parseNumerologyBirthDateInput(input.birthDate);
  const canonicalDigits =
    code === "life_path"
      ? `${date.yearDigits}${date.monthDigits}${date.dayDigits}`
      : code === "birthday_number"
        ? date.dayDigits
        : `${date.monthDigits}${date.dayDigits}${String(input.targetYear)}`;
  const initialValue = code === "birthday_number" ? date.day : digitSum(canonicalDigits);
  const reduction = reduce(initialValue);
  const formula =
    code === "life_path"
      ? "sum_iso_birth_date_digits"
      : code === "birthday_number"
        ? "sum_birth_day_digits"
        : "sum_birth_month_day_and_target_year_digits";
  const ruleId =
    code === "life_path"
      ? "rituvia.life-path"
      : code === "birthday_number"
        ? "rituvia.birthday-number"
        : "rituvia.personal-year";
  return Object.freeze({
    calculationCode: code,
    canonicalDigits,
    formula,
    initialValue,
    masterNumberPreserved: reduction.masterNumberPreserved,
    reductionPolicy: Object.freeze({ id: "rituvia.decimal-reduction", version: "1.0.0" }),
    reductionSteps: reduction.reductionSteps,
    result: reduction.result,
    rule: Object.freeze({ id: ruleId, version: "1.0.0" }),
  });
};

const parseEvidence = (
  value: unknown,
  expected: NumerologyFormulaEvidence,
): NumerologyFormulaEvidence => {
  const candidate = record(value);
  exactKeys(candidate, [
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
  const policy = record(candidate.reductionPolicy);
  const rule = record(candidate.rule);
  exactKeys(policy, ["id", "version"]);
  exactKeys(rule, ["id", "version"]);
  if (
    candidate.calculationCode !== expected.calculationCode ||
    candidate.canonicalDigits !== expected.canonicalDigits ||
    candidate.formula !== expected.formula ||
    candidate.initialValue !== expected.initialValue ||
    candidate.masterNumberPreserved !== expected.masterNumberPreserved ||
    candidate.result !== expected.result ||
    policy.id !== expected.reductionPolicy.id ||
    policy.version !== expected.reductionPolicy.version ||
    rule.id !== expected.rule.id ||
    rule.version !== expected.rule.version ||
    !Array.isArray(candidate.reductionSteps) ||
    candidate.reductionSteps.join(",") !== expected.reductionSteps.join(",")
  ) {
    invalid();
  }
  return expected;
};

export const parseNumerologyCalculationFacts = (value: unknown): NumerologyCalculationFacts => {
  const candidate = record(value);
  exactKeys(candidate, [
    "algorithmVersion",
    "calculations",
    "catalog",
    "engineName",
    "engineVersion",
    "input",
    "ruleSet",
    "schemaVersion",
  ]);
  const input = record(candidate.input);
  const catalog = record(candidate.catalog);
  const ruleSet = record(candidate.ruleSet);
  exactKeys(input, ["birthDate", "targetYear"]);
  exactKeys(catalog, ["id", "version"]);
  exactKeys(ruleSet, ["id", "version"]);
  const request = createNumerologyCalculationRequest(input.birthDate, input.targetYear);
  const codes = ["life_path", "birthday_number", "personal_year"] as const;
  if (
    candidate.schemaVersion !== numerologyCalculationFactsSchemaVersion ||
    candidate.algorithmVersion !== "rituvia-date-reduction.v1" ||
    candidate.engineName !== "rituvia-date-numerology" ||
    candidate.engineVersion !== "1.0.0" ||
    catalog.id !== "rituvia.numerology.date-reduction.en" ||
    catalog.version !== "1.0.0" ||
    ruleSet.id !== "rituvia.date-reduction" ||
    ruleSet.version !== "1.0.0" ||
    !Array.isArray(candidate.calculations) ||
    candidate.calculations.length !== codes.length
  ) {
    invalid();
  }
  const evidenceInputs = candidate.calculations as unknown[];
  const calculations = Object.freeze(
    codes.map((code, index) =>
      parseEvidence(evidenceInputs.at(index), expectedEvidence(code, request)),
    ),
  );
  return Object.freeze({
    algorithmVersion: "rituvia-date-reduction.v1",
    calculations,
    catalog: Object.freeze({ id: catalog.id as string, version: catalog.version as string }),
    engineName: "rituvia-date-numerology",
    engineVersion: "1.0.0",
    input: Object.freeze({ birthDate: request.birthDate, targetYear: request.targetYear }),
    ruleSet: Object.freeze({ id: ruleSet.id as string, version: ruleSet.version as string }),
    schemaVersion: numerologyCalculationFactsSchemaVersion,
  });
};
