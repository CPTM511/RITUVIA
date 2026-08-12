import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  AstrologyReleaseEvaluationError,
  astrologyReleaseEvaluationPolicyVersion,
  astrologyReleaseEvaluationRequiredCases,
  astrologyReleaseEvaluationThresholds,
  parseAstrologyReleaseEvaluationBaselineJsonV1,
  parseAstrologyReleaseEvaluationSuiteJsonV1,
  scoreAstrologyReleaseEvaluationV1,
  type AstrologyReleaseEvaluationObservationV1,
} from "../scripts/astrology-ai-release-evaluation.js";

const suiteJson = await readFile(
  new URL("../packages/ai/test/fixtures/astrology-release-evaluation-v1.json", import.meta.url),
  "utf8",
);
const baselineJson = await readFile(
  new URL(
    "../packages/ai/test/fixtures/astrology-release-evaluation-baseline-v1.json",
    import.meta.url,
  ),
  "utf8",
);
const suite = parseAstrologyReleaseEvaluationSuiteJsonV1(suiteJson);
const baseline = parseAstrologyReleaseEvaluationBaselineJsonV1(baselineJson);
const suiteChecksum = `sha256:${createHash("sha256").update(suiteJson).digest("hex")}`;

const passingObservations = (): AstrologyReleaseEvaluationObservationV1[] =>
  suite.cases.map(({ id }) => ({ caseId: id, executionPassed: true }));

const score = (observations: readonly AstrologyReleaseEvaluationObservationV1[]) =>
  scoreAstrologyReleaseEvaluationV1({ baseline, observations, suite, suiteChecksum });

describe("RIT-095 fixed astrology AI release evaluation", () => {
  it("binds a metadata-only safe-off baseline to exact suite bytes and versions", () => {
    expect(suite.cases).toEqual(astrologyReleaseEvaluationRequiredCases);
    expect(baseline).toEqual({
      evaluatorPolicyVersion: astrologyReleaseEvaluationPolicyVersion,
      executionMode: "synthetic_safe_off",
      externalRequests: 0,
      paidCalls: 0,
      schemaVersion: "astrology-release-evaluation-baseline.v1",
      suite: {
        checksum: suiteChecksum,
        id: suite.suiteId,
        version: suite.version,
      },
    });
    expect(Object.isFrozen(suite)).toBe(true);
    expect(Object.isFrozen(baseline)).toBe(true);
    expect(baselineJson).not.toMatch(
      /birthDate|birthTime|place|latitude|longitude|question|journal|providerOutput|promptText/iu,
    );
  });

  it("requires every zero-tolerance metric and safe control to pass", () => {
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
    expect(Object.values(result.metricFailures)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(astrologyReleaseEvaluationThresholds).toEqual({
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
    const control = observations.find(({ caseId }) => caseId === "exact-facts-control-verified");
    if (critical === undefined || control === undefined) {
      throw new Error("The fixed astrology evaluation controls are unavailable.");
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

  it("rejects suite drift, executable fields, and paid baselines", () => {
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
        parseAstrologyReleaseEvaluationSuiteJsonV1(JSON.stringify(candidate)),
      ).toThrowError(AstrologyReleaseEvaluationError);
    }

    const paid = JSON.parse(baselineJson) as Record<string, unknown>;
    paid.externalRequests = 1;
    paid.paidCalls = 1;
    expect(() => parseAstrologyReleaseEvaluationBaselineJsonV1(JSON.stringify(paid))).toThrowError(
      AstrologyReleaseEvaluationError,
    );
  });

  it("fails closed for checksum drift and duplicate observations", () => {
    expect(() =>
      scoreAstrologyReleaseEvaluationV1({
        baseline,
        observations: passingObservations(),
        suite,
        suiteChecksum: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "ASTROLOGY_RELEASE_EVALUATION_CHECKSUM_MISMATCH",
      }),
    );

    const duplicate = passingObservations();
    duplicate.push({ ...duplicate[0] } as AstrologyReleaseEvaluationObservationV1);
    expect(() => score(duplicate)).toThrowError(
      expect.objectContaining({
        code: "ASTROLOGY_RELEASE_EVALUATION_BASELINE_INVALID",
      }),
    );
  });
});
