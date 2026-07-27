import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseTarotReleaseEvaluationBaselineJsonV1,
  parseTarotReleaseEvaluationSuiteJsonV1,
  scoreTarotReleaseEvaluationV1,
  type TarotReleaseEvaluationCaseV1,
  type TarotReleaseEvaluationMetric,
  type TarotReleaseEvaluationObservationV1,
} from "./ai-release-evaluation.js";

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
  numTotalTests: number;
  numTodoTests: number;
  success: boolean;
  testResults: readonly VitestFileResult[];
}>;

const root = process.cwd();
const suitePath = path.join(root, "packages/ai/test/fixtures/tarot-release-evaluation-v1.json");
const baselinePath = path.join(
  root,
  "packages/ai/test/fixtures/tarot-release-evaluation-baseline-v1.json",
);
const suiteJson = readFileSync(suitePath, "utf8");
const baselineJson = readFileSync(baselinePath, "utf8");
const suite = parseTarotReleaseEvaluationSuiteJsonV1(suiteJson);
const baseline = parseTarotReleaseEvaluationBaselineJsonV1(baselineJson);
const suiteChecksum = `sha256:${createHash("sha256").update(suiteJson, "utf8").digest("hex")}`;

const testFiles = Object.freeze([
  "tests/ai-release-evaluation.test.ts",
  "packages/ai/test/generation.test.ts",
  "packages/ai/test/interpretation.test.ts",
  "packages/ai/test/retrieval-prompt.test.ts",
  "packages/ai/test/safety.test.ts",
  "packages/ai/test/verification.test.ts",
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

const parseReport = (): VitestJsonReport => {
  if (execution.error !== undefined || typeof execution.stdout !== "string") {
    return fail("AI release evaluation runner failed before producing evidence.");
  }
  try {
    const candidate: unknown = JSON.parse(execution.stdout);
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "success" in candidate &&
      "numFailedTests" in candidate &&
      "numPendingTests" in candidate &&
      "numTotalTests" in candidate &&
      "numTodoTests" in candidate &&
      "testResults" in candidate &&
      typeof candidate.success === "boolean" &&
      typeof candidate.numFailedTests === "number" &&
      typeof candidate.numPendingTests === "number" &&
      typeof candidate.numTotalTests === "number" &&
      typeof candidate.numTodoTests === "number" &&
      Array.isArray(candidate.testResults)
    ) {
      return candidate as VitestJsonReport;
    }
  } catch {
    // Keep malformed runner output out of CI logs.
  }
  return fail("AI release evaluation runner returned malformed evidence.");
};

const report = parseReport();
const assertions = report.testResults.flatMap(({ assertionResults }) => assertionResults);

const uniquePassedPrefix = (prefix: string): boolean => {
  const matches = assertions.filter(({ fullName }) => fullName.startsWith(prefix));
  return matches.length === 1 && matches[0]?.status === "passed";
};

const evidencePrefixes = (testCase: TarotReleaseEvaluationCaseV1): readonly string[] => {
  switch (testCase.id) {
    case "generation-configuration-fails":
      return [
        "RIT-033 bounded provider-neutral generation returns durable non-displayable failure for normalized configuration",
      ];
    case "generation-invalid-response-fallback":
      return [
        "RIT-033 bounded provider-neutral generation retries invalid success only at reported zero cost",
      ];
    case "generation-safe-one-pending":
      return [
        "RIT-033 bounded provider-neutral generation returns valid provider prose as non-displayable pending verification",
        "tarot interpretation contracts v1 parses and freezes the synthetic 'one-card",
      ];
    case "generation-safe-three-pending":
      return [
        "RIT-033 bounded provider-neutral generation returns valid provider prose as non-displayable pending verification",
        "tarot interpretation contracts v1 parses and freezes the synthetic 'three-card",
      ];
    case "generation-timeout-fallback":
      return [
        "RIT-033 bounded provider-neutral generation falls back without retry on timeout and never accepts a late provider outcome",
      ];
    case "intake-fullwidth-crisis":
      return [
        "pre-generation safety routing handles the synthetic mixed/confusable case 'fullwidth-crisis",
        "allowed-only continuation and policy authority never invokes policy authority or continuation for non-allowed routes",
      ];
    case "intake-medical-blocked":
      return [
        "pre-generation safety routing keeps RIT-021 fixture 'medical-diagnosis' on its non-allowed route",
        "allowed-only continuation and policy authority never invokes policy authority or continuation for non-allowed routes",
      ];
    case "intake-relationship-reframed":
      return [
        "pre-generation safety routing keeps RIT-021 fixture 'relationship-mind-reading' on its non-allowed route",
        "allowed-only continuation and policy authority never invokes policy authority or continuation for non-allowed routes",
      ];
    case "intake-self-harm-crisis":
      return [
        "pre-generation safety routing keeps RIT-021 fixture 'self-harm' on its non-allowed route",
        "allowed-only continuation and policy authority never invokes policy authority or continuation for non-allowed routes",
      ];
    case "intake-theme-one-allowed":
      return [
        "pre-generation safety routing allows 'one-card-theme-only' without any external classifier",
      ];
    case "intake-theme-three-allowed":
      return [
        "pre-generation safety routing allows 'three-card-theme-only' without any external classifier",
      ];
    case "interpretation-empty-long-malformed-rejected":
      return [
        "tarot interpretation contracts v1 rejects malformed JSON, schema drift, extra keys, unsafe claims, and unsafe text",
        "tarot interpretation contracts v1 rejects empty, duplicate, invalid, or excessive output collections and references",
      ];
    case "interpretation-non-english-locale-rejected":
      return [
        "tarot interpretation contracts v1 rejects unsupported or malformed input versions, keys, locale, facts, and provenance",
      ];
    case "privacy-rejected-prose-redacted":
      return [
        "generation authorization binding and privacy keeps the raw-question canary out of evaluation, decision, authorization, context, and errors",
        "RIT-034 post-generation verification sends the reviewer only the bounded provider-neutral request and no private request or prompt data",
      ];
    case "release-malformed-output-rejected":
      return [
        "tarot interpretation contracts v1 rejects malformed JSON, schema drift, extra keys, unsafe claims, and unsafe text",
      ];
    case "retrieval-content-injection-rejected":
      return [
        "curated tarot retrieval and prompt versioning rejects retrieved-content prompt injection via role delimiter",
        "curated tarot retrieval and prompt versioning rejects retrieved-content prompt injection via Unicode line separator",
      ];
    case "verification-fact-source-swap-replacement":
      return [
        "RIT-034 post-generation verification rejects fact/source swaps and NFKC-confusable prompt injection before semantic review",
      ];
    case "verification-reviewer-uncertain-replacement":
      return [
        "RIT-034 post-generation verification uses safe replacement when semantic reviewer is uncertain",
      ];
    case "verification-reviewer-unsafe-replacement":
      return [
        "RIT-034 post-generation verification uses safe replacement when semantic reviewer is unsafe",
      ];
    case "verification-safe-negation-verified":
      return [
        "RIT-034 post-generation verification does not false-positive safe negations or a selected Death card",
      ];
    case "verification-safe-one-verified":
      return [
        "RIT-034 post-generation verification verifies safe one_card prose only after an independent strict semantic review",
      ];
    case "verification-safe-three-verified":
      return [
        "RIT-034 post-generation verification verifies safe three_card prose only after an independent strict semantic review",
      ];
    case "verification-trust-denial-rejected":
      return [
        "RIT-034 post-generation verification emits no displayable output on digest or authority trust failure",
      ];
    case "verification-unicode-injection-replacement":
      return [
        "RIT-034 post-generation verification rejects fact/source swaps and NFKC-confusable prompt injection before semantic review",
        "RIT-034 post-generation verification rejects zero-width safety bypass before a pending candidate can be issued",
      ];
    default:
      if (testCase.id.startsWith("verification-") && testCase.id.endsWith("-replacement")) {
        return [
          "RIT-034 post-generation verification deterministically rejects every fixed safety category while ignoring forged safety literals",
        ];
      }
      return [];
  }
};

const metricValue = (
  testCase: TarotReleaseEvaluationCaseV1,
  metric: TarotReleaseEvaluationMetric,
  passed: boolean,
): "fail" | "not_applicable" | "pass" =>
  testCase.metrics.includes(metric) ? (passed ? "pass" : "fail") : "not_applicable";

const mismatchedOutcome = (testCase: TarotReleaseEvaluationCaseV1) =>
  testCase.expectedOutcome === "rejected" ? "verified" : "rejected";

const reportPassed =
  execution.status === 0 &&
  report.success &&
  report.numFailedTests === 0 &&
  report.numPendingTests === 0 &&
  report.numTodoTests === 0 &&
  report.testResults.length === testFiles.length;

const observations: readonly TarotReleaseEvaluationObservationV1[] = suite.cases.map((testCase) => {
  const prefixes = evidencePrefixes(testCase);
  const executionPassed = reportPassed && prefixes.length > 0 && prefixes.every(uniquePassedPrefix);
  return Object.freeze({
    actualOutcome: executionPassed ? testCase.expectedOutcome : mismatchedOutcome(testCase),
    caseId: testCase.id,
    executionPassed,
    metricResults: Object.freeze({
      fact: metricValue(testCase, "fact", executionPassed),
      fallback: metricValue(testCase, "fallback", executionPassed),
      schema: metricValue(testCase, "schema", executionPassed),
      source: metricValue(testCase, "source", executionPassed),
    }),
    privacy: "safe" as const,
    unsafeContinuation: false,
  });
});

const result = scoreTarotReleaseEvaluationV1({
  baseline,
  observations,
  suite,
  suiteChecksum,
});

const summary = Object.freeze({
  caseCount: result.caseCount,
  casePassCount: result.casePassCount,
  criticalFailures: result.criticalFailures,
  evaluationVersion: suite.evaluationVersion,
  evaluatorPolicyVersion: result.evaluatorPolicyVersion,
  externalRequests: result.externalRequests,
  executedAssertionCount: report.numTotalTests,
  executedFileCount: report.testResults.length,
  fact: result.fact,
  fallback: result.fallback,
  missingCases: result.missingCases,
  paidCalls: result.paidCalls,
  privacyLeaks: result.privacyLeaks,
  releaseEligible: result.releaseEligible,
  safeControls: result.safeControls,
  schema: result.schema,
  source: result.source,
  suite: result.suite,
  versions: suite.versions,
  unexpectedCases: result.unexpectedCases,
  unsafeContinuations: result.unsafeContinuations,
});

process.stdout.write(`${JSON.stringify(summary)}\n`);
if (!result.releaseEligible) {
  process.exitCode = 1;
} else {
  const numerologyExecution = spawnSync(
    process.execPath,
    ["--import", "tsx", path.join(root, "scripts/verify-numerology-ai-release-evals.ts")],
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
  if (typeof numerologyExecution.stdout === "string") {
    process.stdout.write(numerologyExecution.stdout);
  }
  if (numerologyExecution.error !== undefined || numerologyExecution.status !== 0) {
    throw new TypeError("Numerology AI release evaluation failed.");
  }
}
