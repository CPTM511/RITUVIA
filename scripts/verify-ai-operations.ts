import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  AiOperationsContractError,
  aiOperationsSnapshotSchemaVersion,
  projectAiOperationsReport,
  renderAiOperationsMarkdown,
} from "../packages/analytics/src/index.js";

const digest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const group = {
  attemptCountTotal: 112,
  contentVersions: ["1.0.0", "2.0.0"],
  costReportedCount: 95,
  currencyCode: "USD",
  estimatedCostMicros: 950_000,
  failedCount: 3,
  fallbackCount: 12,
  generationCount: 100,
  inputTokens: 70_000,
  latencyOverThirtySecondsCount: 8,
  latencyTotalMs: 2_000_000,
  locale: "en",
  modality: "tarot",
  modelId: "reflective-model",
  modelVersion: "1.0.0",
  outputSchemaVersion: "1.0.0",
  outputTokens: 24_000,
  pendingVerificationCount: 85,
  promptId: "tarot-reflection",
  promptVersion: "1.0.0",
  providerId: "local-preview",
  providerVersion: "1.0.0",
  readingType: "one_card",
  retryCount: 12,
  safeReplacementCount: 10,
  safetyPolicyVersion: "1.0.0",
  tokenReportedCount: 94,
  totalTokens: 94_000,
  verifiedCount: 75,
};

const base = {
  capturedAt: "2026-07-30T01:00:00.000Z",
  groups: [group],
  schemaVersion: aiOperationsSnapshotSchemaVersion,
  source: {
    approvalReference: "D-088",
    kind: "durable_operational_aggregate",
    observedThrough: "2026-07-30T00:00:00.000Z",
  },
  windowEnd: "2026-07-30T00:00:00.000Z",
  windowStart: "2026-07-29T00:00:00.000Z",
};

const contextFor = (input: unknown, asOf = "2026-07-30T06:00:00.000Z") => ({
  asOf,
  inputDigest: digest(input),
});

const current = projectAiOperationsReport(base, contextFor(base));
assert.equal(current.decisionStatus, "ready");
assert.equal(current.metrics.find(({ id }) => id === "generation_count")?.value, 100);
assert.ok(current.alerts.some(({ kind }) => kind === "safe_replacement_review"));
assert.ok(current.alerts.every(({ requiresHumanReview }) => requiresHumanReview));

const synthetic = {
  ...base,
  source: {
    approvalReference: null,
    kind: "synthetic_fixture",
    observedThrough: "2026-07-30T00:00:00.000Z",
  },
};
const syntheticReport = projectAiOperationsReport(synthetic, contextFor(synthetic));
assert.equal(syntheticReport.decisionStatus, "blocked");
assert.ok(syntheticReport.metrics.every(({ value }) => value === null));

const unavailable = {
  ...base,
  groups: [],
  source: {
    approvalReference: null,
    kind: "unavailable",
    observedThrough: null,
  },
};
const unavailableReport = projectAiOperationsReport(unavailable, contextFor(unavailable));
assert.equal(unavailableReport.decisionStatus, "blocked");
assert.ok(unavailableReport.metrics.every(({ value }) => value === null));

const stale = projectAiOperationsReport(base, contextFor(base, "2026-07-31T08:00:00.000Z"));
assert.equal(stale.decisionStatus, "blocked");
assert.ok(stale.metrics.every(({ value }) => value === null));

assert.throws(
  () =>
    projectAiOperationsReport({ ...base, rawPrompt: "PRIVATE-PROMPT-CANARY" }, contextFor(base)),
  AiOperationsContractError,
);
const markdown = renderAiOperationsMarkdown(current);
assert.doesNotMatch(markdown, /PRIVATE-PROMPT-CANARY|readingId|rawPrompt/u);
assert.match(markdown, /owner_budget_unavailable/u);

process.stdout.write(
  "Verified offline AI cost, latency, fallback, retry, safety, freshness, suppression, and private-field boundaries.\n",
);
