import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  parseNumerologyReleaseEvaluationBaselineJsonV1,
  parseNumerologyReleaseEvaluationSuiteJsonV1,
  scoreNumerologyReleaseEvaluationV1,
  type NumerologyReleaseEvaluationObservationV1,
} from "./numerology-ai-release-evaluation.js";

type VitestAssertion = Readonly<{
  fullName: string;
  status: string;
}>;

type VitestFileResult = Readonly<{
  assertionResults: readonly VitestAssertion[];
}>;

type VitestJsonReport = Readonly<{
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests: number;
  success: boolean;
  testResults: readonly VitestFileResult[];
}>;

const root = process.cwd();
const suitePath = path.join(
  root,
  "packages/ai/test/fixtures/numerology-release-evaluation-v1.json",
);
const baselinePath = path.join(
  root,
  "packages/ai/test/fixtures/numerology-release-evaluation-baseline-v1.json",
);
const suiteJson = readFileSync(suitePath, "utf8");
const baselineJson = readFileSync(baselinePath, "utf8");
const suite = parseNumerologyReleaseEvaluationSuiteJsonV1(suiteJson);
const baseline = parseNumerologyReleaseEvaluationBaselineJsonV1(baselineJson);
const suiteChecksum = `sha256:${createHash("sha256").update(suiteJson).digest("hex")}`;
const testFiles = Object.freeze([
  "packages/ai/test/numerology-interpretation.test.ts",
  "tests/numerology-ai-release-evaluation.test.ts",
]);

const execution = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/vitest/vitest.mjs"), "run", ...testFiles, "--reporter=json"],
  {
    cwd: root,
    encoding: "utf8",
    env: {
      CI: "true",
      HOME: "/tmp",
      NO_COLOR: "1",
      PATH: process.env.PATH ?? "",
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  },
);

const fail = (message: string): never => {
  throw new TypeError(message);
};

const report = (() => {
  if (execution.error !== undefined || typeof execution.stdout !== "string") {
    return fail("Numerology AI evaluation runner failed before producing evidence.");
  }
  try {
    const candidate: unknown = JSON.parse(execution.stdout);
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "success" in candidate &&
      "numFailedTests" in candidate &&
      "numPendingTests" in candidate &&
      "numTodoTests" in candidate &&
      "testResults" in candidate &&
      typeof candidate.success === "boolean" &&
      typeof candidate.numFailedTests === "number" &&
      typeof candidate.numPendingTests === "number" &&
      typeof candidate.numTodoTests === "number" &&
      Array.isArray(candidate.testResults)
    ) {
      return candidate as VitestJsonReport;
    }
  } catch {
    return fail("Numerology AI evaluation runner returned malformed evidence.");
  }
  return fail("Numerology AI evaluation runner returned malformed evidence.");
})();

const assertions = report.testResults.flatMap(({ assertionResults }) => assertionResults);
const reportPassed =
  execution.status === 0 &&
  report.success &&
  report.numFailedTests === 0 &&
  report.numPendingTests === 0 &&
  report.numTodoTests === 0 &&
  report.testResults.length === testFiles.length;

const observations: readonly NumerologyReleaseEvaluationObservationV1[] = suite.cases.map(
  ({ assertionSuffix, id }) => {
    const matches = assertions.filter(({ fullName }) => fullName.endsWith(assertionSuffix));
    return Object.freeze({
      caseId: id,
      executionPassed: reportPassed && matches.length === 1 && matches[0]?.status === "passed",
    });
  },
);

const result = scoreNumerologyReleaseEvaluationV1({
  baseline,
  observations,
  suite,
  suiteChecksum,
});

process.stdout.write(
  `${JSON.stringify({
    caseCount: result.caseCount,
    casePassCount: result.casePassCount,
    criticalFailures: result.criticalFailures,
    evaluationVersion: suite.evaluationVersion,
    executedAssertionCount: assertions.length,
    executedFileCount: report.testResults.length,
    externalRequests: result.externalRequests,
    metricFailures: result.metricFailures,
    missingCases: result.missingCases,
    paidCalls: result.paidCalls,
    releaseEligible: result.releaseEligible,
    safeControlFailures: result.safeControlFailures,
    suite: result.suite,
    unexpectedCases: result.unexpectedCases,
  })}\n`,
);
if (!result.releaseEligible) process.exitCode = 1;
