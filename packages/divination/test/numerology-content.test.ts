import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  NumerologyContentError,
  assertNumerologyEngineReady,
  assessNumerologyEngineReadiness,
  numerologyCalculationCodes,
  numerologyMasterNumbers,
  parseNumerologyRuleCatalogV1,
  type NumerologyContentErrorCode,
} from "../src/index.js";

type EditorialFixture = {
  approvalReference: string | null;
  reviewDueDate: string;
  reviewedDate: string | null;
  reviewerId: string | null;
  reviewerRole: string | null;
  status: string;
};

type ReferenceFixture = {
  id: string;
  version: string;
};

type RuleFixture = {
  calculationCode: string;
  formula: string;
  inputFields: string[];
  reductionPolicy: ReferenceFixture;
  targetYearSource: string;
  workedExamples: ReferenceFixture[];
};

type ExampleFixture = {
  birthDate: string;
  canonicalDigits: string;
  exampleId: string;
  initialValue: number;
  masterNumberPreserved: boolean;
  reductionSteps: number[];
  result: number;
  rule: ReferenceFixture;
  targetYear: number | null;
  version: string;
};

type SourceFixture = {
  claims: Array<{ claimCode: string; statement: string }>;
  editorial: EditorialFixture;
  rights: {
    allowedUses: string[];
    status: string;
    territory: string;
  };
};

type CatalogFixture = {
  catalogId: string;
  editorial: EditorialFixture;
  ruleSets: Array<{
    calculationRules: RuleFixture[];
    editorial: EditorialFixture;
    localePolicy: {
      nameMapping: string;
      silentTransliteration: string;
      supportedNameScripts: string[];
    };
    workedExamples: ExampleFixture[];
  }>;
  schemaVersion: string;
  sources: SourceFixture[];
  title: string;
  usePolicy: {
    engineCalculationAllowed: boolean;
  };
};

const fixturePath = new URL(
  "../../../content/traditions/numerology/rituvia-date-reduction.en.v1.json",
  import.meta.url,
);
const fixtureText = await readFile(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as CatalogFixture;

const cloneFixture = (): CatalogFixture => structuredClone(fixture);

const first = <Value>(values: readonly Value[]): Value => {
  const value = values[0];
  if (value === undefined) throw new Error("The test fixture is unexpectedly empty.");
  return value;
};

const approve = (editorial: EditorialFixture): void => {
  editorial.approvalReference = "test:explicit-owner-approval";
  editorial.reviewedDate = "2026-07-25";
  editorial.reviewerId = "owner";
  editorial.reviewerRole = "owner";
  editorial.status = "approved";
};

const makeApprovedFixture = (): CatalogFixture => {
  const candidate = cloneFixture();
  approve(candidate.editorial);
  candidate.ruleSets.forEach(({ editorial }) => approve(editorial));
  return candidate;
};

const expectNumerologyError = (
  candidate: unknown,
  code: Exclude<NumerologyContentErrorCode, "NUMEROLOGY_CATALOG_NOT_ENGINE_READY">,
): void => {
  try {
    parseNumerologyRuleCatalogV1(candidate);
    expect.unreachable("The invalid catalog must be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(NumerologyContentError);
    expect((error as NumerologyContentError).code).toBe(code);
    expect((error as Error).message).not.toContain("private-canary");
  }
};

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

describe("numerology rule catalog v1", () => {
  it("parses the source-checked catalog without changing source bytes", () => {
    const before = JSON.stringify(fixture);
    const catalog = parseNumerologyRuleCatalogV1(fixture);
    const ruleSet = first(catalog.ruleSets);

    expect(JSON.stringify(fixture)).toBe(before);
    expect(catalog.schemaVersion).toBe("numerology-rule-catalog.v1");
    expect(ruleSet.calculationRules.map(({ calculationCode }) => calculationCode)).toEqual(
      numerologyCalculationCodes,
    );
    expect(first(ruleSet.reductionPolicies).preserveExactTotals).toEqual(numerologyMasterNumbers);
    expect(ruleSet.localePolicy).toEqual({
      canonicalCalculationInput: "ascii_iso_date",
      dateRulesApplyAcrossLocales: true,
      nameMapping: "unsupported",
      reviewedContentLocales: ["en"],
      silentTransliteration: "forbidden",
      supportedNameScripts: [],
    });
    expect(ruleSet.privacy).toEqual({
      analyticsAllowed: false,
      birthDateClassification: "sensitive",
      logsAllowed: false,
      nameCollection: "not_applicable",
      urlAllowed: false,
    });
  });

  it("deep-freezes every parsed branch and preserves exact serialization", () => {
    const catalog = parseNumerologyRuleCatalogV1(cloneFixture());

    expectDeepFrozen(catalog);
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(fixture);
  });

  it("records ordinary and master-number examples for every required rule", () => {
    const ruleSet = first(parseNumerologyRuleCatalogV1(fixture).ruleSets);

    for (const rule of ruleSet.calculationRules) {
      const examples = ruleSet.workedExamples.filter(
        ({ rule: exampleRule }) =>
          exampleRule.id === rule.ruleId && exampleRule.version === rule.version,
      );
      expect(examples).toHaveLength(2);
      expect(examples.some(({ masterNumberPreserved }) => masterNumberPreserved)).toBe(true);
      expect(examples.some(({ masterNumberPreserved }) => !masterNumberPreserved)).toBe(true);
    }
    expect(
      ruleSet.workedExamples.map(({ canonicalDigits, initialValue, reductionSteps, result }) => ({
        canonicalDigits,
        initialValue,
        reductionSteps,
        result,
      })),
    ).toEqual([
      {
        canonicalDigits: "19840719",
        initialValue: 39,
        reductionSteps: [39, 12, 3],
        result: 3,
      },
      {
        canonicalDigits: "19990901",
        initialValue: 38,
        reductionSteps: [38, 11],
        result: 11,
      },
      {
        canonicalDigits: "28",
        initialValue: 28,
        reductionSteps: [28, 10, 1],
        result: 1,
      },
      {
        canonicalDigits: "22",
        initialValue: 22,
        reductionSteps: [22],
        result: 22,
      },
      {
        canonicalDigits: "11282025",
        initialValue: 21,
        reductionSteps: [21, 3],
        result: 3,
      },
      {
        canonicalDigits: "11282026",
        initialValue: 22,
        reductionSteps: [22],
        result: 22,
      },
    ]);
  });

  it("proves the exact owner-approved repository catalog engine-ready", () => {
    expect(assessNumerologyEngineReadiness(fixture, "2026-07-25")).toEqual({
      asOf: "2026-07-25",
      catalogId: "rituvia.numerology.date-reduction.en",
      catalogVersion: "1.0.0",
      eligible: true,
      reasons: [],
      schemaVersion: "numerology-engine-readiness.v1",
    });
    expect(assertNumerologyEngineReady(fixture, "2026-07-25")).toEqual(fixture);
    expect(fixture.editorial).toMatchObject({
      approvalReference: "OWN-011:option-a:2026-07-25",
      reviewerId: "owner",
      reviewerRole: "owner",
      status: "approved",
    });
    expect(first(fixture.ruleSets).editorial).toMatchObject({
      approvalReference: "OWN-011:option-a:2026-07-25",
      reviewerId: "owner",
      reviewerRole: "owner",
      status: "approved",
    });
  });

  it("keeps readiness structural while the calculation engine pins the exact approval", () => {
    const candidate = makeApprovedFixture();

    expect(assessNumerologyEngineReadiness(candidate, "2026-07-25")).toMatchObject({
      eligible: true,
      reasons: [],
    });
    expect(assertNumerologyEngineReady(candidate, "2026-07-25")).toEqual(candidate);
    expect(fixture.editorial.status).toBe("approved");
    expect(fixture.editorial.approvalReference).toBe("OWN-011:option-a:2026-07-25");
  });

  it("rejects implicit time, formula drift, arithmetic drift, and missing example coverage", () => {
    const implicitTime = makeApprovedFixture();
    const personalYearRule = first(first(implicitTime.ruleSets).calculationRules.slice(2));
    personalYearRule.targetYearSource = "not_applicable";
    expect(assessNumerologyEngineReadiness(implicitTime, "2026-07-25").reasons).toContain(
      "RULE_FORMULA_INVALID",
    );

    const arithmeticDrift = makeApprovedFixture();
    first(first(arithmeticDrift.ruleSets).workedExamples).canonicalDigits = "19840718";
    expect(assessNumerologyEngineReadiness(arithmeticDrift, "2026-07-25").reasons).toContain(
      "WORKED_EXAMPLE_ARITHMETIC_INVALID",
    );

    const missingCoverage = makeApprovedFixture();
    const ruleSet = first(missingCoverage.ruleSets);
    const removed = ruleSet.workedExamples.pop();
    if (removed === undefined) throw new Error("The test fixture is unexpectedly empty.");
    const personalRule = first(ruleSet.calculationRules.slice(2));
    personalRule.workedExamples = personalRule.workedExamples.filter(
      ({ id }) => id !== removed.exampleId,
    );
    expect(assessNumerologyEngineReadiness(missingCoverage, "2026-07-25").reasons).toContain(
      "WORKED_EXAMPLE_COVERAGE_INVALID",
    );
  });

  it("fails stale, uncleared, disabled, unsupported, or universal claims closed", () => {
    const expired = makeApprovedFixture();
    expired.editorial.reviewDueDate = "2027-07-23";
    expect(assessNumerologyEngineReadiness(expired, "2028-01-01").reasons).toContain(
      "REVIEW_EXPIRED",
    );

    const uncleared = makeApprovedFixture();
    first(uncleared.sources).rights.status = "not_cleared";
    expect(assessNumerologyEngineReadiness(uncleared, "2026-07-25").reasons).toContain(
      "SOURCE_RIGHTS_NOT_CLEARED",
    );

    const disabled = makeApprovedFixture();
    disabled.usePolicy.engineCalculationAllowed = false;
    expect(assessNumerologyEngineReadiness(disabled, "2026-07-25").reasons).toContain(
      "ENGINE_USE_DISABLED",
    );

    const universalClaim = makeApprovedFixture();
    universalClaim.title = "Universal numerology";
    expect(assessNumerologyEngineReadiness(universalClaim, "2026-07-25").reasons).toContain(
      "PROHIBITED_CLAIM",
    );
  });

  it("rejects unknown fields, unsupported schemas, invalid dates, and broken references", () => {
    const unknownField = cloneFixture() as CatalogFixture & { privateCanary?: string };
    unknownField.privateCanary = "private-canary";
    expectNumerologyError(unknownField, "NUMEROLOGY_CONTENT_INVALID");

    const unsupportedSchema = cloneFixture();
    unsupportedSchema.schemaVersion = "numerology-rule-catalog.v2";
    expectNumerologyError(unsupportedSchema, "NUMEROLOGY_SCHEMA_VERSION_UNSUPPORTED");

    const invalidDate = cloneFixture();
    first(first(invalidDate.ruleSets).workedExamples).birthDate = "2026-02-31";
    expectNumerologyError(invalidDate, "NUMEROLOGY_CONTENT_INVALID");

    const nonFourDigitTargetYear = cloneFixture();
    const personalYearExample = first(
      first(nonFourDigitTargetYear.ruleSets).workedExamples.slice(-1),
    );
    personalYearExample.targetYear = 999;
    expectNumerologyError(nonFourDigitTargetYear, "NUMEROLOGY_CONTENT_INVALID");

    const brokenReference = cloneFixture();
    first(first(brokenReference.ruleSets).calculationRules).reductionPolicy.id =
      "missing.reduction-policy";
    expectNumerologyError(brokenReference, "NUMEROLOGY_REFERENCE_INVALID");
  });

  it("rejects any attempt to activate name mapping or silent transliteration in V1", () => {
    const nameMapping = cloneFixture();
    first(nameMapping.ruleSets).localePolicy.nameMapping = "latin_letters";
    expectNumerologyError(nameMapping, "NUMEROLOGY_CONTENT_INVALID");

    const transliteration = cloneFixture();
    first(transliteration.ruleSets).localePolicy.silentTransliteration = "enabled";
    expectNumerologyError(transliteration, "NUMEROLOGY_CONTENT_INVALID");

    const scripts = cloneFixture();
    first(scripts.ruleSets).localePolicy.supportedNameScripts = ["Latn"];
    expectNumerologyError(scripts, "NUMEROLOGY_CONTENT_INVALID");
  });
});
