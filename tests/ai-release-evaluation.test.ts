import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  preGenerationSafetyPolicyVersion,
  preGenerationSafetyRiskCategories,
  tarotDeterministicVerificationChecksVersion,
  tarotGenerationRuntimeSchemaVersion,
  tarotInterpretationInputSchemaVersion,
  tarotInterpretationOutputSchemaVersion,
  tarotVerificationCheckCodes,
} from "../packages/ai/src/index.js";
import {
  TarotReleaseEvaluationError,
  isTarotReleaseEvaluationResultV1,
  parseTarotReleaseEvaluationBaselineJsonV1,
  parseTarotReleaseEvaluationSuiteJsonV1,
  scoreTarotReleaseEvaluationV1,
  tarotReleaseEvaluationPolicyVersion,
  tarotReleaseEvaluationRequiredCases,
  tarotReleaseEvaluationThresholds,
  type TarotReleaseEvaluationObservationV1,
} from "../scripts/ai-release-evaluation.js";

type MutableBaseline = {
  evaluatorPolicyVersion: string;
  executionMode: string;
  externalRequests: number;
  paidCalls: number;
  schemaVersion: string;
  suite: { checksum: string; id: string; version: string };
  [key: string]: unknown;
};

type MutableSuite = {
  cases: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type SafetyFixture = Readonly<{
  classifierEscalations: readonly Readonly<{ categories: readonly string[] }>[];
  nonAllowedIntake: readonly Readonly<{ id: string }>[];
}>;

const lexicalRiskCategoryByFixtureId = Object.freeze({
  "coercive-control": "coercive_control",
  "criminal-guilt": "criminal_guilt",
  "death-timing": "death_timing",
  "guaranteed-outcome": "guaranteed_outcome",
  "instruction-injection": "instruction_injection",
  "legal-outcome": "legal_determination",
  "supernatural-persecution": "supernatural_persecution",
} as const);

const suiteUrl = new URL(
  "../packages/ai/test/fixtures/tarot-release-evaluation-v1.json",
  import.meta.url,
);
const baselineUrl = new URL(
  "../packages/ai/test/fixtures/tarot-release-evaluation-baseline-v1.json",
  import.meta.url,
);
const safetyFixtureUrl = new URL(
  "../packages/ai/test/fixtures/pre-generation-safety-v1.json",
  import.meta.url,
);
const suiteJson = await readFile(suiteUrl, "utf8");
const baselineJson = await readFile(baselineUrl, "utf8");
const safetyFixture = JSON.parse(await readFile(safetyFixtureUrl, "utf8")) as SafetyFixture;
const suiteChecksum = `sha256:${createHash("sha256").update(suiteJson, "utf8").digest("hex")}`;
const suite = parseTarotReleaseEvaluationSuiteJsonV1(suiteJson);
const baseline = parseTarotReleaseEvaluationBaselineJsonV1(baselineJson);

const mutableBaseline = (): MutableBaseline => JSON.parse(baselineJson) as MutableBaseline;
const mutableSuite = (): MutableSuite => JSON.parse(suiteJson) as MutableSuite;
const metricResult = (
  testCase: (typeof suite.cases)[number],
  metric: "fact" | "fallback" | "schema" | "source",
): "not_applicable" | "pass" => (testCase.metrics.includes(metric) ? "pass" : "not_applicable");
const passingObservations = (): TarotReleaseEvaluationObservationV1[] =>
  suite.cases.map((testCase) => ({
    actualOutcome: testCase.expectedOutcome,
    caseId: testCase.id,
    executionPassed: true,
    metricResults: {
      fact: metricResult(testCase, "fact"),
      fallback: metricResult(testCase, "fallback"),
      schema: metricResult(testCase, "schema"),
      source: metricResult(testCase, "source"),
    },
    privacy: "safe",
    unsafeContinuation: false,
  }));
const observation = (
  observations: TarotReleaseEvaluationObservationV1[],
  caseId: string,
): TarotReleaseEvaluationObservationV1 => {
  const match = observations.find((entry) => entry.caseId === caseId);
  if (match === undefined) throw new Error(`Missing synthetic observation ${caseId}.`);
  return match;
};
const score = (observations: readonly TarotReleaseEvaluationObservationV1[]) =>
  scoreTarotReleaseEvaluationV1({ baseline, observations, suite, suiteChecksum });

describe("RIT-036 fixed AI release evaluation contract", () => {
  it("binds a metadata-only safe-off baseline to exact suite bytes and production versions", () => {
    expect(suite.versions).toMatchObject({
      generation: tarotGenerationRuntimeSchemaVersion,
      inputSchema: tarotInterpretationInputSchemaVersion,
      outputSchema: tarotInterpretationOutputSchemaVersion,
      safety: preGenerationSafetyPolicyVersion,
      verificationChecks: tarotDeterministicVerificationChecksVersion,
    });
    expect(suite.cases).toEqual(tarotReleaseEvaluationRequiredCases);
    expect(baseline).toEqual({
      evaluatorPolicyVersion: tarotReleaseEvaluationPolicyVersion,
      executionMode: "synthetic_safe_off",
      externalRequests: 0,
      paidCalls: 0,
      schemaVersion: "tarot-release-evaluation-baseline.v1",
      suite: { checksum: suiteChecksum, id: suite.suiteId, version: suite.version },
    });
    expect(Object.isFrozen(suite)).toBe(true);
    expect(Object.isFrozen(baseline)).toBe(true);
    expect(baselineJson).not.toMatch(
      /actualOutcome|metricResults|question|journal|birth|email|providerOutput|reviewerText|promptText/iu,
    );
  });

  it("keeps every post-generation check, pre-generation risk, retrieval injection, malformed input, and locale fail-closed case", () => {
    const suiteIds = new Set(suite.cases.map(({ id }) => id));
    for (const code of tarotVerificationCheckCodes) {
      expect(suiteIds).toContain(`verification-${code.replaceAll("_", "-")}-replacement`);
    }
    const classifierCategories = new Set(
      safetyFixture.classifierEscalations.flatMap(({ categories }) => categories),
    );
    for (const { id } of safetyFixture.nonAllowedIntake) {
      const category =
        lexicalRiskCategoryByFixtureId[id as keyof typeof lexicalRiskCategoryByFixtureId];
      if (category !== undefined) classifierCategories.add(category);
    }
    expect([...classifierCategories].sort()).toEqual([...preGenerationSafetyRiskCategories].sort());
    for (const required of [
      "interpretation-empty-long-malformed-rejected",
      "interpretation-non-english-locale-rejected",
      "retrieval-content-injection-rejected",
    ]) {
      expect(suiteIds.has(required)).toBe(true);
    }
  });

  it("requires executed evidence for every case and every zero-tolerance metric", () => {
    const result = score(passingObservations());
    expect(result).toMatchObject({
      caseCount: suite.cases.length,
      casePassCount: suite.cases.length,
      criticalFailures: 0,
      missingCases: 0,
      privacyLeaks: 0,
      releaseEligible: true,
      unexpectedCases: 0,
      unsafeContinuations: 0,
    });
    for (const count of [
      result.fact,
      result.fallback,
      result.safeControls,
      result.schema,
      result.source,
    ]) {
      expect(count.eligible).toBeGreaterThan(0);
      expect(count.passed).toBe(count.eligible);
    }
    expect(isTarotReleaseEvaluationResultV1(result)).toBe(true);
    expect(tarotReleaseEvaluationThresholds.criticalFailuresMaximum).toBe(0);
  });

  it("blocks failed execution, unsafe outcomes, metric regressions, leaks, and continuation", () => {
    const observations = passingObservations();
    const unsafe = observation(observations, "verification-self-harm-replacement") as {
      actualOutcome: string;
      executionPassed: boolean;
    };
    unsafe.actualOutcome = "verified";
    unsafe.executionPassed = false;
    const fact = observation(observations, "verification-fact-source-swap-replacement");
    (fact.metricResults as { fact: string }).fact = "fail";
    const malformed = observation(observations, "interpretation-empty-long-malformed-rejected");
    (malformed.metricResults as { schema: string }).schema = "fail";
    (observation(observations, "privacy-rejected-prose-redacted") as { privacy: string }).privacy =
      "leak";
    (
      observation(observations, "intake-medical-blocked") as { unsafeContinuation: boolean }
    ).unsafeContinuation = true;

    const result = score(observations);
    expect(result.releaseEligible).toBe(false);
    expect(result.criticalFailures).toBeGreaterThanOrEqual(4);
    expect(result.fact.passed).toBe(result.fact.eligible - 1);
    expect(result.schema.passed).toBe(result.schema.eligible - 1);
    expect(result.privacyLeaks).toBe(1);
    expect(result.unsafeContinuations).toBe(1);
  });

  it("blocks all-fallback behavior because executed safe controls have exact outcomes", () => {
    const observations = passingObservations();
    for (const testCase of suite.cases.filter(({ control }) => control)) {
      (observation(observations, testCase.id) as { actualOutcome: string }).actualOutcome =
        "safe_replacement";
    }
    const result = score(observations);
    expect(result.releaseEligible).toBe(false);
    expect(result.safeControls).toMatchObject({ passed: 0 });
  });

  it("fails closed for missing, unexpected, duplicate, reordered, or checksum-drifted evidence", () => {
    const missing = passingObservations();
    missing.pop();
    expect(score(missing)).toMatchObject({ missingCases: 1, releaseEligible: false });

    const unexpected = passingObservations();
    unexpected.push({
      actualOutcome: "rejected",
      caseId: "zz-unexpected-case",
      executionPassed: true,
      metricResults: {
        fact: "not_applicable",
        fallback: "not_applicable",
        schema: "not_applicable",
        source: "not_applicable",
      },
      privacy: "safe",
      unsafeContinuation: false,
    });
    expect(score(unexpected)).toMatchObject({ releaseEligible: false, unexpectedCases: 1 });

    const duplicate = passingObservations();
    duplicate.push(structuredClone(duplicate[0] as TarotReleaseEvaluationObservationV1));
    expect(() => score(duplicate)).toThrowError(TarotReleaseEvaluationError);
    expect(() => score([...passingObservations()].reverse())).toThrowError(
      TarotReleaseEvaluationError,
    );
    expect(() =>
      scoreTarotReleaseEvaluationV1({
        baseline,
        observations: passingObservations(),
        suite,
        suiteChecksum: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "AI_RELEASE_EVALUATION_SUITE_CHECKSUM_MISMATCH" }),
    );
  });

  it("rejects any required-case downgrade, fixture threshold, executable field, or self-report", () => {
    for (const mutate of [
      (testCase: Record<string, unknown>) => {
        testCase.critical = false;
      },
      (testCase: Record<string, unknown>) => {
        testCase.expectedOutcome = "verified";
      },
      (testCase: Record<string, unknown>) => {
        testCase.metrics = [];
      },
      (testCase: Record<string, unknown>) => {
        testCase.executor = "return true";
      },
    ]) {
      const candidate = mutableSuite();
      mutate(candidate.cases.find(({ id }) => id === "verification-self-harm-replacement") ?? {});
      expect(() => parseTarotReleaseEvaluationSuiteJsonV1(JSON.stringify(candidate))).toThrowError(
        expect.objectContaining({ code: "AI_RELEASE_EVALUATION_SUITE_INVALID" }),
      );
    }
    const suiteWithThreshold = mutableSuite();
    suiteWithThreshold.thresholds = { criticalFailuresMaximum: 10 };
    expect(() =>
      parseTarotReleaseEvaluationSuiteJsonV1(JSON.stringify(suiteWithThreshold)),
    ).toThrowError(expect.objectContaining({ code: "AI_RELEASE_EVALUATION_SUITE_INVALID" }));

    const selfReported = passingObservations() as Array<
      TarotReleaseEvaluationObservationV1 & { passed?: boolean }
    >;
    (selfReported[0] as TarotReleaseEvaluationObservationV1 & { passed?: boolean }).passed = true;
    expect(() => score(selfReported)).toThrowError(
      expect.objectContaining({ code: "AI_RELEASE_EVALUATION_BASELINE_INVALID" }),
    );
  });

  it("rejects provider calls in baseline and logically contradictory result guards", () => {
    const paid = mutableBaseline();
    paid.externalRequests = 1;
    paid.paidCalls = 1;
    expect(() => parseTarotReleaseEvaluationBaselineJsonV1(JSON.stringify(paid))).toThrowError(
      expect.objectContaining({ code: "AI_RELEASE_EVALUATION_BASELINE_INVALID" }),
    );

    const result = structuredClone(score(passingObservations())) as Record<string, unknown>;
    result.criticalFailures = 1;
    result.releaseEligible = true;
    expect(isTarotReleaseEvaluationResultV1(result)).toBe(false);

    const emptyGreen = structuredClone(score(passingObservations())) as Record<string, unknown>;
    emptyGreen.caseCount = 0;
    emptyGreen.casePassCount = 0;
    for (const metric of ["fact", "fallback", "safeControls", "schema", "source"]) {
      emptyGreen[metric] = { eligible: 0, passed: 0 };
    }
    expect(isTarotReleaseEvaluationResultV1(emptyGreen)).toBe(false);

    const wrongEligible = structuredClone(score(passingObservations())) as {
      fact: { eligible: number; passed: number };
    };
    wrongEligible.fact = { eligible: 0, passed: 0 };
    expect(isTarotReleaseEvaluationResultV1(wrongEligible)).toBe(false);

    const wrongSuite = structuredClone(score(passingObservations())) as {
      suite: { id: string; version: string };
    };
    wrongSuite.suite.id = "attacker-controlled-suite";
    wrongSuite.suite.version = "9.9.9";
    expect(isTarotReleaseEvaluationResultV1(wrongSuite)).toBe(false);
  });
});
