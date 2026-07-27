import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  NumerologyReleaseEvaluationError,
  numerologyReleaseEvaluationPolicyVersion,
  numerologyReleaseEvaluationRequiredCases,
  numerologyReleaseEvaluationThresholds,
  parseNumerologyReleaseEvaluationBaselineJsonV1,
  parseNumerologyReleaseEvaluationSuiteJsonV1,
  scoreNumerologyReleaseEvaluationV1,
  type NumerologyReleaseEvaluationObservationV1,
} from "../scripts/numerology-ai-release-evaluation.js";

const suiteJson = await readFile(
  new URL("../packages/ai/test/fixtures/numerology-release-evaluation-v1.json", import.meta.url),
  "utf8",
);
const baselineJson = await readFile(
  new URL(
    "../packages/ai/test/fixtures/numerology-release-evaluation-baseline-v1.json",
    import.meta.url,
  ),
  "utf8",
);
const suite = parseNumerologyReleaseEvaluationSuiteJsonV1(suiteJson);
const baseline = parseNumerologyReleaseEvaluationBaselineJsonV1(baselineJson);
const suiteChecksum = `sha256:${createHash("sha256").update(suiteJson).digest("hex")}`;

const passingObservations = (): NumerologyReleaseEvaluationObservationV1[] =>
  suite.cases.map(({ id }) => ({ caseId: id, executionPassed: true }));

const score = (observations: readonly NumerologyReleaseEvaluationObservationV1[]) =>
  scoreNumerologyReleaseEvaluationV1({
    baseline,
    observations,
    suite,
    suiteChecksum,
  });

describe("RIT-083 fixed numerology AI release evaluation", () => {
  it("binds a metadata-only safe-off baseline to exact suite bytes and versions", () => {
    expect(suite.cases).toEqual(numerologyReleaseEvaluationRequiredCases);
    expect(baseline).toEqual({
      evaluatorPolicyVersion: numerologyReleaseEvaluationPolicyVersion,
      executionMode: "synthetic_safe_off",
      externalRequests: 0,
      paidCalls: 0,
      schemaVersion: "numerology-release-evaluation-baseline.v1",
      suite: {
        checksum: suiteChecksum,
        id: suite.suiteId,
        version: suite.version,
      },
    });
    expect(Object.isFrozen(suite)).toBe(true);
    expect(Object.isFrozen(baseline)).toBe(true);
    expect(baselineJson).not.toMatch(
      /birthDate|question|journal|email|providerOutput|reviewerText|promptText/iu,
    );
  });

  it("requires every zero-tolerance metric and both safe controls to pass", () => {
    const result = score(passingObservations());
    expect(result).toMatchObject({
      caseCount: suite.cases.length,
      casePassCount: suite.cases.length,
      criticalFailures: 0,
      missingCases: 0,
      releaseEligible: true,
      safeControlFailures: 0,
      unexpectedCases: 0,
    });
    expect(Object.values(result.metricFailures)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(numerologyReleaseEvaluationThresholds).toEqual({
      criticalFailuresMaximum: 0,
      metricFailuresMaximum: 0,
      missingCasesMaximum: 0,
      safeControlFailuresMaximum: 0,
      unexpectedCasesMaximum: 0,
    });
  });

  it("blocks critical, metric, safe-control, missing, and unexpected regressions", () => {
    const observations = passingObservations();
    const critical = observations.find(({ caseId }) => caseId === "safety-certainty-replacement");
    const control = observations.find(({ caseId }) => caseId === "safe-control-verified");
    if (critical === undefined || control === undefined) {
      throw new Error("The fixed numerology evaluation controls are unavailable.");
    }
    (critical as { executionPassed: boolean }).executionPassed = false;
    (control as { executionPassed: boolean }).executionPassed = false;
    observations.pop();
    observations.push({ caseId: "unexpected-case", executionPassed: true });

    const result = score(observations);
    expect(result.releaseEligible).toBe(false);
    expect(result.criticalFailures).toBeGreaterThan(0);
    expect(result.safeControlFailures).toBeGreaterThan(0);
    expect(result.missingCases).toBeGreaterThan(0);
    expect(result.unexpectedCases).toBe(1);
    expect(Object.values(result.metricFailures).some((failures) => failures > 0)).toBe(true);
  });

  it("rejects suite drift, fixture thresholds, executable fields, and paid baselines", () => {
    for (const mutate of [
      (candidate: Record<string, unknown>) => {
        (candidate.cases as unknown[]).reverse();
      },
      (candidate: Record<string, unknown>) => {
        candidate.thresholds = { criticalFailuresMaximum: 10 };
      },
      (candidate: Record<string, unknown>) => {
        (
          (candidate.cases as Array<Record<string, unknown>>)[0] as Record<string, unknown>
        ).execute = "return true";
      },
    ]) {
      const candidate = JSON.parse(suiteJson) as Record<string, unknown>;
      mutate(candidate);
      expect(() =>
        parseNumerologyReleaseEvaluationSuiteJsonV1(JSON.stringify(candidate)),
      ).toThrowError(NumerologyReleaseEvaluationError);
    }

    const paid = JSON.parse(baselineJson) as Record<string, unknown>;
    paid.externalRequests = 1;
    paid.paidCalls = 1;
    expect(() => parseNumerologyReleaseEvaluationBaselineJsonV1(JSON.stringify(paid))).toThrowError(
      NumerologyReleaseEvaluationError,
    );
  });

  it("fails closed for checksum drift and duplicate observations", () => {
    expect(() =>
      scoreNumerologyReleaseEvaluationV1({
        baseline,
        observations: passingObservations(),
        suite,
        suiteChecksum: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "NUMEROLOGY_RELEASE_EVALUATION_CHECKSUM_MISMATCH",
      }),
    );

    const duplicate = passingObservations();
    duplicate.push({ ...duplicate[0] } as NumerologyReleaseEvaluationObservationV1);
    expect(() => score(duplicate)).toThrowError(
      expect.objectContaining({
        code: "NUMEROLOGY_RELEASE_EVALUATION_BASELINE_INVALID",
      }),
    );
  });
});
