import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  NumerologyCalculationError,
  NumerologyContentError,
  calculateNumerologyV1,
  numerologyCalculationRequestSchemaVersion,
  numerologyMasterNumbers,
  parseNumerologyBirthDateV1,
  parseNumerologyCalculationFactsV1,
  parseNumerologyCalculationRequestV1,
  parseNumerologyRuleCatalogV1,
  verifyNumerologyCalculationFactsV1,
  type NumerologyCalculatedValue,
  type NumerologyCalculationErrorCode,
  type NumerologyCalculationFactsV1,
  type NumerologyCalculationRequestV1,
} from "../src/index.js";

const fixturePath = new URL(
  "../../../content/traditions/numerology/rituvia-date-reduction.en.v1.json",
  import.meta.url,
);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as unknown;
const catalog = parseNumerologyRuleCatalogV1(fixture);

const request = (birthDate: string, targetYear: number): NumerologyCalculationRequestV1 => ({
  birthDate,
  schemaVersion: numerologyCalculationRequestSchemaVersion,
  targetYear,
});

const calculate = (birthDate: string, targetYear: number): NumerologyCalculationFactsV1 =>
  calculateNumerologyV1({
    asOf: "2026-07-25",
    catalog,
    request: request(birthDate, targetYear),
  });

const first = <Value>(values: readonly Value[]): Value => {
  const value = values[0];
  if (value === undefined) throw new Error("The test fixture is unexpectedly empty.");
  return value;
};

const evidenceFor = (
  facts: NumerologyCalculationFactsV1,
  calculationCode: "life_path" | "birthday_number" | "personal_year",
) => {
  const evidence = facts.calculations.find(
    (candidate) => candidate.calculationCode === calculationCode,
  );
  if (evidence === undefined) throw new Error("The expected calculation is missing.");
  return evidence;
};

const expectCalculationError = (
  candidate: unknown,
  code: NumerologyCalculationErrorCode = "NUMEROLOGY_REQUEST_INVALID",
): void => {
  try {
    parseNumerologyCalculationRequestV1(candidate);
    expect.unreachable("The invalid request must be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(NumerologyCalculationError);
    expect((error as NumerologyCalculationError).code).toBe(code);
    expect((error as Error).message).not.toContain("private-canary");
  }
};

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

const digitSum = (digits: string): number =>
  [...digits].reduce((total, digit) => total + Number(digit), 0);

const expectedReduction = (initialValue: number): readonly number[] => {
  const steps = [initialValue];
  let current = initialValue;
  while (current > 9 && !numerologyMasterNumbers.includes(current as 11 | 22 | 33)) {
    current = digitSum(String(current));
    steps.push(current);
  }
  return steps;
};

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const validResults = new Set<NumerologyCalculatedValue>([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]);

type MutableFactsFixture = {
  calculations: Array<{
    canonicalDigits: string;
    formula: string;
    reductionSteps: number[];
    result: number;
    rule: { id: string; version: string };
  }>;
  catalog: { id: string; version: string };
};

const mutableFacts = (facts: NumerologyCalculationFactsV1): MutableFactsFixture =>
  structuredClone(facts) as unknown as MutableFactsFixture;

describe("numerology calculation engine v1", () => {
  it("matches the approved formulas and returns complete version-bound evidence", () => {
    const input = request("1984-07-19", 2026);
    const before = JSON.stringify(input);
    const facts = calculateNumerologyV1({
      asOf: "2026-07-25",
      catalog,
      request: input,
    });

    expect(JSON.stringify(input)).toBe(before);
    expect(facts).toEqual({
      algorithmVersion: "rituvia-date-reduction.v1",
      calculations: [
        {
          calculationCode: "life_path",
          canonicalDigits: "19840719",
          formula: "sum_iso_birth_date_digits",
          initialValue: 39,
          masterNumberPreserved: false,
          reductionPolicy: {
            id: "rituvia.decimal-reduction",
            version: "1.0.0",
          },
          reductionSteps: [39, 12, 3],
          result: 3,
          rule: { id: "rituvia.life-path", version: "1.0.0" },
        },
        {
          calculationCode: "birthday_number",
          canonicalDigits: "19",
          formula: "sum_birth_day_digits",
          initialValue: 19,
          masterNumberPreserved: false,
          reductionPolicy: {
            id: "rituvia.decimal-reduction",
            version: "1.0.0",
          },
          reductionSteps: [19, 10, 1],
          result: 1,
          rule: { id: "rituvia.birthday-number", version: "1.0.0" },
        },
        {
          calculationCode: "personal_year",
          canonicalDigits: "07192026",
          formula: "sum_birth_month_day_and_target_year_digits",
          initialValue: 27,
          masterNumberPreserved: false,
          reductionPolicy: {
            id: "rituvia.decimal-reduction",
            version: "1.0.0",
          },
          reductionSteps: [27, 9],
          result: 9,
          rule: { id: "rituvia.personal-year", version: "1.0.0" },
        },
      ],
      catalog: {
        id: "rituvia.numerology.date-reduction.en",
        version: "1.0.0",
      },
      engineName: "rituvia-date-numerology",
      engineVersion: "1.0.0",
      input: { birthDate: "1984-07-19", targetYear: 2026 },
      ruleSet: { id: "rituvia.date-reduction", version: "1.0.0" },
      schemaVersion: "numerology-calculation-facts.v1",
    });
    expectDeepFrozen(facts);
  });

  it("matches every approved catalog worked vector exactly", () => {
    const ruleSet = first(catalog.ruleSets);
    for (const example of ruleSet.workedExamples) {
      const rule = ruleSet.calculationRules.find(
        ({ ruleId, version }) => ruleId === example.rule.id && version === example.rule.version,
      );
      if (rule === undefined) throw new Error("The worked example rule is missing.");
      const facts = calculate(example.birthDate, example.targetYear ?? 2026);
      const evidence = evidenceFor(facts, rule.calculationCode);

      expect(evidence).toMatchObject({
        canonicalDigits: example.canonicalDigits,
        initialValue: example.initialValue,
        masterNumberPreserved: example.masterNumberPreserved,
        reductionSteps: example.reductionSteps,
        result: example.result,
        rule: example.rule,
      });
    }
  });

  it("preserves all approved master numbers, including 33", () => {
    expect(evidenceFor(calculate("1999-09-01", 2026), "life_path")).toMatchObject({
      reductionSteps: [38, 11],
      result: 11,
      masterNumberPreserved: true,
    });
    expect(evidenceFor(calculate("1990-11-22", 2026), "birthday_number")).toMatchObject({
      reductionSteps: [22],
      result: 22,
      masterNumberPreserved: true,
    });
    expect(evidenceFor(calculate("1903-09-29", 2026), "life_path")).toMatchObject({
      reductionSteps: [33],
      result: 33,
      masterNumberPreserved: true,
    });
  });

  it("validates proleptic Gregorian leap and century boundaries without host time", () => {
    expect(parseNumerologyBirthDateV1("0001-01-01")).toEqual({
      day: 1,
      dayDigits: "01",
      month: 1,
      monthDigits: "01",
      year: 1,
      yearDigits: "0001",
    });
    expect(parseNumerologyBirthDateV1("2000-02-29")).toMatchObject({
      day: 29,
      month: 2,
      year: 2000,
    });
    expect(parseNumerologyBirthDateV1("2400-02-29")).toMatchObject({
      day: 29,
      month: 2,
      year: 2400,
    });
    for (const invalidDate of [
      "0000-01-01",
      "1900-02-29",
      "2001-02-29",
      "2100-02-29",
      "2026-00-10",
      "2026-13-10",
      "2026-04-31",
      "2026-01-00",
      "2026-01-32",
    ]) {
      expect(() => parseNumerologyBirthDateV1(invalidDate)).toThrowError(
        expect.objectContaining({ code: "NUMEROLOGY_REQUEST_INVALID" }),
      );
    }
  });

  it("traverses a complete 400-year Gregorian cycle without date-library dependence", () => {
    let checkedDates = 0;
    for (let year = 2000; year < 2400; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (let day = 1; day <= daysInMonth(year, month); day += 1) {
          const birthDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const parsed = parseNumerologyBirthDateV1(birthDate);
          if (parsed.day !== day || parsed.month !== month || parsed.year !== year) {
            throw new Error("The Gregorian traversal produced an inconsistent date.");
          }
          checkedDates += 1;
        }
      }
    }
    expect(checkedDates).toBe(146_097);
  });

  it("keeps zero-containing canonical digits visible and deterministic", () => {
    const firstResult = calculate("2000-01-01", 2000);
    const replay = calculate("2000-01-01", 2000);

    expect(firstResult).toEqual(replay);
    expect(evidenceFor(firstResult, "life_path")).toMatchObject({
      canonicalDigits: "20000101",
      initialValue: 4,
      reductionSteps: [4],
      result: 4,
    });
    expect(evidenceFor(firstResult, "personal_year")).toMatchObject({
      canonicalDigits: "01012000",
      initialValue: 4,
      reductionSteps: [4],
      result: 4,
    });
  });

  it("makes Personal Year depend only on the explicit target year", () => {
    const for2025 = calculate("1990-11-28", 2025);
    const for2026 = calculate("1990-11-28", 2026);

    expect(evidenceFor(for2025, "life_path")).toEqual(evidenceFor(for2026, "life_path"));
    expect(evidenceFor(for2025, "birthday_number")).toEqual(
      evidenceFor(for2026, "birthday_number"),
    );
    expect(evidenceFor(for2025, "personal_year")).toMatchObject({
      canonicalDigits: "11282025",
      result: 3,
    });
    expect(evidenceFor(for2026, "personal_year")).toMatchObject({
      canonicalDigits: "11282026",
      result: 22,
    });
  });

  it("rejects localized digits, scripts, whitespace, names, locale, and unknown authority fields", () => {
    for (const birthDate of [
      " 2000-02-29",
      "2000-02-29 ",
      "2000/02/29",
      "２０００-０２-２９",
      "٢٠٠٠-٠٢-٢٩",
      "۲۰۰۰-۰۲-۲۹",
      "२०००-०२-२९",
      "二〇〇〇-〇二-二九",
      "2000‑02‑29",
      "2000-02-29\u0000",
      "2000-02-29\n",
      "\u00a02000-02-29",
      "private-canary",
    ]) {
      expectCalculationError(request(birthDate, 2026));
    }

    expectCalculationError({
      ...request("2000-02-29", 2026),
      name: "private-canary",
    });
    expectCalculationError({
      ...request("2000-02-29", 2026),
      latinName: "private-canary",
    });
    expectCalculationError({
      ...request("2000-02-29", 2026),
      locale: "en",
    });
    expectCalculationError({
      ...request("2000-02-29", 2026),
      result: 22,
    });
  });

  it("rejects schema, target-year, and request-shape drift with fixed private-safe errors", () => {
    expectCalculationError(null);
    expectCalculationError([]);
    expectCalculationError({});
    expectCalculationError({
      ...request("2000-02-29", 2026),
      schemaVersion: "numerology-calculation-request.v2",
    });
    for (const targetYear of [
      0,
      -1,
      1,
      999,
      10_000,
      2026.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      2026n,
      "2026",
    ]) {
      expectCalculationError({
        ...request("2000-02-29", 2026),
        targetYear,
      });
    }
    expect(parseNumerologyCalculationRequestV1(request("2000-02-29", 1000))).toMatchObject({
      targetYear: 1000,
    });
    expect(parseNumerologyCalculationRequestV1(request("2000-02-29", 9999))).toMatchObject({
      targetYear: 9999,
    });
  });

  it("pins exact OWN-011 approval and supported catalog/rule-set versions", () => {
    const changedApproval = structuredClone(fixture) as {
      editorial: { approvalReference: string | null };
      ruleSets: Array<{ editorial: { approvalReference: string | null } }>;
    };
    changedApproval.editorial.approvalReference = "test:other-approval";
    expect(() =>
      calculateNumerologyV1({
        asOf: "2026-07-25",
        catalog: changedApproval,
        request: request("2000-02-29", 2026),
      }),
    ).toThrowError(expect.objectContaining({ code: "NUMEROLOGY_RULE_SET_UNSUPPORTED" }));

    const changedRuleApproval = structuredClone(fixture) as {
      editorial: { approvalReference: string | null };
      ruleSets: Array<{ editorial: { approvalReference: string | null } }>;
    };
    first(changedRuleApproval.ruleSets).editorial.approvalReference = "test:other-approval";
    expect(() =>
      calculateNumerologyV1({
        asOf: "2026-07-25",
        catalog: changedRuleApproval,
        request: request("2000-02-29", 2026),
      }),
    ).toThrowError(expect.objectContaining({ code: "NUMEROLOGY_RULE_SET_UNSUPPORTED" }));

    expect(() =>
      calculateNumerologyV1({
        asOf: "2028-01-01",
        catalog,
        request: request("2000-02-29", 2026),
      }),
    ).toThrowError(expect.objectContaining({ code: "NUMEROLOGY_CATALOG_NOT_ENGINE_READY" }));

    const changedRule = structuredClone(fixture) as {
      ruleSets: Array<{
        calculationRules: Array<{ ruleId: string }>;
        workedExamples: Array<{ rule: { id: string } }>;
      }>;
    };
    const changedRuleSet = first(changedRule.ruleSets);
    first(changedRuleSet.calculationRules).ruleId = "rituvia.life-path.changed";
    for (const example of changedRuleSet.workedExamples) {
      if (example.rule.id === "rituvia.life-path") {
        example.rule.id = "rituvia.life-path.changed";
      }
    }
    expect(() =>
      calculateNumerologyV1({
        asOf: "2026-07-25",
        catalog: changedRule,
        request: request("2000-02-29", 2026),
      }),
    ).toThrowError(expect.objectContaining({ code: "NUMEROLOGY_RULE_SET_UNSUPPORTED" }));
  });

  it("normalizes hostile request object failures to one private-safe domain error", () => {
    const hostileGetter = {
      get birthDate(): string {
        throw new Error("private-canary");
      },
      schemaVersion: numerologyCalculationRequestSchemaVersion,
      targetYear: 2026,
    };
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("private-canary");
        },
      },
    );

    for (const candidate of [hostileGetter, hostileProxy]) {
      try {
        parseNumerologyCalculationRequestV1(candidate);
        expect.unreachable("The hostile request must be rejected.");
      } catch (error) {
        expect(error).toBeInstanceOf(NumerologyCalculationError);
        expect((error as NumerologyCalculationError).code).toBe("NUMEROLOGY_REQUEST_INVALID");
        expect((error as Error).message).not.toContain("private-canary");
      }
    }
  });

  it("parses and recomputes serialized facts before accepting replay", () => {
    const facts = calculate("1990-11-28", 2026);
    const serialized = structuredClone(facts);

    expect(parseNumerologyCalculationFactsV1(serialized)).toEqual(facts);
    expect(
      verifyNumerologyCalculationFactsV1({
        asOf: "2026-07-25",
        catalog,
        facts: serialized,
      }),
    ).toEqual(facts);
    expectDeepFrozen(parseNumerologyCalculationFactsV1(serialized));
  });

  it("rejects any serialized fact, formula, step, result, version, or order tampering", () => {
    const facts = calculate("1990-11-28", 2026);
    const tamperedDigits = mutableFacts(facts);
    first(tamperedDigits.calculations).canonicalDigits = "19901127";
    expect(() =>
      verifyNumerologyCalculationFactsV1({
        asOf: "2026-07-25",
        catalog,
        facts: tamperedDigits,
      }),
    ).toThrowError(expect.objectContaining({ code: "NUMEROLOGY_FACTS_INVALID" }));

    const tamperedFormula = mutableFacts(facts);
    first(tamperedFormula.calculations).formula = "sum_birth_day_digits";
    expect(() => parseNumerologyCalculationFactsV1(tamperedFormula)).toThrowError(
      expect.objectContaining({ code: "NUMEROLOGY_FACTS_INVALID" }),
    );

    const tamperedStep = mutableFacts(facts);
    first(tamperedStep.calculations).reductionSteps = [31, 5];
    first(tamperedStep.calculations).result = 5;
    expect(() =>
      verifyNumerologyCalculationFactsV1({
        asOf: "2026-07-25",
        catalog,
        facts: tamperedStep,
      }),
    ).toThrowError(expect.objectContaining({ code: "NUMEROLOGY_FACTS_INVALID" }));

    const tamperedRule = mutableFacts(facts);
    first(tamperedRule.calculations).rule = {
      id: "rituvia.life-path.changed",
      version: "1.0.0",
    };
    expect(() => parseNumerologyCalculationFactsV1(tamperedRule)).toThrowError(
      expect.objectContaining({ code: "NUMEROLOGY_FACTS_INVALID" }),
    );

    const tamperedCatalog = mutableFacts(facts);
    tamperedCatalog.catalog = {
      id: facts.catalog.id,
      version: "2.0.0",
    };
    expect(() => parseNumerologyCalculationFactsV1(tamperedCatalog)).toThrowError(
      expect.objectContaining({ code: "NUMEROLOGY_FACTS_INVALID" }),
    );

    const reordered = mutableFacts(facts);
    reordered.calculations.reverse();
    expect(() => parseNumerologyCalculationFactsV1(reordered)).toThrowError(
      expect.objectContaining({ code: "NUMEROLOGY_FACTS_INVALID" }),
    );
  });

  it("normalizes hostile serialized-fact objects to one private-safe error", () => {
    const hostileFacts = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("private-canary");
        },
      },
    );

    try {
      parseNumerologyCalculationFactsV1(hostileFacts);
      expect.unreachable("The hostile facts must be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(NumerologyCalculationError);
      expect((error as NumerologyCalculationError).code).toBe("NUMEROLOGY_FACTS_INVALID");
      expect((error as Error).message).not.toContain("private-canary");
    }
  });

  it("traverses every valid day across representative century years and proves invariants", () => {
    let checkedDates = 0;
    for (const year of [1900, 1903, 1904, 1999, 2000, 2001, 2100, 2400]) {
      for (let month = 1; month <= 12; month += 1) {
        for (let day = 1; day <= daysInMonth(year, month); day += 1) {
          const birthDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const targetYear = 2025 + ((month + day) % 3);
          const facts = calculate(birthDate, targetYear);
          checkedDates += 1;

          expect(facts.calculations.map(({ calculationCode }) => calculationCode)).toEqual([
            "life_path",
            "birthday_number",
            "personal_year",
          ]);
          for (const evidence of facts.calculations) {
            expect(validResults.has(evidence.result)).toBe(true);
            expect(evidence.reductionSteps).toEqual(expectedReduction(evidence.initialValue));
            expect(evidence.reductionSteps.at(0)).toBe(evidence.initialValue);
            expect(evidence.reductionSteps.at(-1)).toBe(evidence.result);
            expect(evidence.masterNumberPreserved).toBe(
              numerologyMasterNumbers.includes(evidence.result as 11 | 22 | 33),
            );
          }
        }
      }
    }
    expect(checkedDates).toBe(2_923);
  });

  it("contains no ambient clock, randomness, host locale, environment, network, storage, or AI dependency", async () => {
    const source = await readFile(
      new URL("../src/numerology-calculation.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(
      /\b(?:Date|Intl|Math\.random|crypto|process|fetch|localStorage|sessionStorage|AIProvider)\b/u,
    );
  });
});

describe("numerology calculation request v1", () => {
  it("parses and freezes the exact public request shape", () => {
    const parsed = parseNumerologyCalculationRequestV1(request("2000-02-29", 2026));

    expect(parsed).toEqual({
      birthDate: "2000-02-29",
      schemaVersion: "numerology-calculation-request.v1",
      targetYear: 2026,
    });
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("keeps content-readiness failures distinct from request failures", () => {
    expect(() =>
      calculateNumerologyV1({
        asOf: "2028-01-01",
        catalog,
        request: request("2000-02-29", 2026),
      }),
    ).toThrowError(NumerologyContentError);
  });
});
