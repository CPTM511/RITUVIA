import { describe, expect, it } from "vitest";

import {
  AiOperationsContractError,
  parseAiOperationsSnapshot,
  projectAiOperationsReport,
  renderAiOperationsMarkdown,
  type AiOperationsAggregate,
  type AiOperationsSnapshot,
} from "../src/index.js";

const aggregate = (overrides: Partial<AiOperationsAggregate> = {}): AiOperationsAggregate => ({
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
  ...overrides,
});

const snapshot = (overrides: Partial<AiOperationsSnapshot> = {}): AiOperationsSnapshot => ({
  capturedAt: "2026-07-30T01:00:00.000Z",
  groups: [aggregate()],
  schemaVersion: "ai-operations-snapshot.v1",
  source: {
    approvalReference: "D-088",
    kind: "durable_operational_aggregate",
    observedThrough: "2026-07-30T00:00:00.000Z",
  },
  windowEnd: "2026-07-30T00:00:00.000Z",
  windowStart: "2026-07-29T00:00:00.000Z",
  ...overrides,
});

const context = {
  asOf: "2026-07-30T06:00:00.000Z",
  inputDigest: `sha256:${"a".repeat(64)}`,
};

describe("AI operations contract", () => {
  it("parses exact aggregate-only daily inputs", () => {
    expect(parseAiOperationsSnapshot(snapshot())).toEqual(snapshot());
  });

  it("rejects raw prompts, outputs, identifiers, and accessor-backed values", () => {
    expect(() =>
      parseAiOperationsSnapshot({
        ...snapshot(),
        rawPrompt: "PRIVATE-PROMPT-CANARY",
      }),
    ).toThrow(AiOperationsContractError);
    expect(() =>
      parseAiOperationsSnapshot({
        ...snapshot(),
        groups: [{ ...aggregate(), readingId: "reading-private" }],
      }),
    ).toThrow(AiOperationsContractError);

    let getterCalls = 0;
    const unsafe = { ...aggregate() };
    Object.defineProperty(unsafe, "modelId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "PRIVATE-MODEL-CANARY";
      },
    });
    expect(() => parseAiOperationsSnapshot({ ...snapshot(), groups: [unsafe] })).toThrow(
      AiOperationsContractError,
    );
    expect(getterCalls).toBe(0);
  });

  it("rejects invalid windows, duplicates, and inconsistent aggregates", () => {
    expect(() =>
      parseAiOperationsSnapshot({
        ...snapshot(),
        capturedAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow(AiOperationsContractError);
    expect(() =>
      parseAiOperationsSnapshot({
        ...snapshot(),
        groups: [aggregate(), aggregate()],
      }),
    ).toThrow(AiOperationsContractError);
    expect(() =>
      parseAiOperationsSnapshot({
        ...snapshot(),
        groups: [aggregate({ pendingVerificationCount: 84 })],
      }),
    ).toThrow(AiOperationsContractError);
    expect(() =>
      parseAiOperationsSnapshot({
        ...snapshot(),
        groups: [aggregate({ totalTokens: 93_999 })],
      }),
    ).toThrow(AiOperationsContractError);
  });

  it("requires unavailable sources to contain no invented values", () => {
    const unavailable = snapshot({
      groups: [],
      source: {
        approvalReference: null,
        kind: "unavailable",
        observedThrough: null,
      },
    });
    expect(parseAiOperationsSnapshot(unavailable)).toEqual(unavailable);
    expect(() =>
      parseAiOperationsSnapshot({
        ...unavailable,
        groups: [aggregate()],
      }),
    ).toThrow(AiOperationsContractError);
  });
});

describe("AI operations projection", () => {
  it("projects cost, latency, fallback, failure, retry, and safety metrics", () => {
    const report = projectAiOperationsReport(snapshot(), context);
    expect(report.decisionStatus).toBe("ready");
    expect(report.costBudgetStatus).toBe("owner_budget_unavailable");
    expect(report.metrics.map(({ id }) => id)).toEqual([
      "generation_count",
      "completion_rate",
      "failure_rate",
      "fallback_rate",
      "safe_replacement_rate",
      "retry_rate",
      "average_latency_ms",
      "latency_review_rate",
      "cost_reporting_coverage",
      "estimated_cost_micros",
      "average_reported_cost_micros",
      "token_reporting_coverage",
      "average_total_tokens",
    ]);
    expect(report.metrics.find(({ id }) => id === "generation_count")?.value).toBe(100);
    expect(report.metrics.find(({ id }) => id === "completion_rate")?.value).toBe(0.97);
    expect(report.metrics.find(({ id }) => id === "fallback_rate")?.value).toBe(0.12);
    expect(report.metrics.find(({ id }) => id === "average_latency_ms")?.value).toBe(20_000);
    expect(report.metrics.find(({ id }) => id === "estimated_cost_micros")?.value).toBe(950_000);
    expect(new Set(report.alerts.map(({ kind }) => kind))).toEqual(
      new Set([
        "failure_rate_review",
        "fallback_rate_review",
        "latency_review",
        "safe_replacement_review",
        "token_reporting_incomplete",
      ]),
    );
  });

  it("suppresses low-sample group and overall values", () => {
    const lowSample = aggregate({
      attemptCountTotal: 19,
      costReportedCount: 19,
      estimatedCostMicros: 190_000,
      failedCount: 0,
      fallbackCount: 1,
      generationCount: 19,
      inputTokens: 13_000,
      latencyOverThirtySecondsCount: 0,
      latencyTotalMs: 190_000,
      outputTokens: 6_000,
      pendingVerificationCount: 18,
      retryCount: 0,
      safeReplacementCount: 1,
      tokenReportedCount: 19,
      totalTokens: 19_000,
      verifiedCount: 17,
    });
    const report = projectAiOperationsReport(snapshot({ groups: [lowSample] }), context);
    expect(report.metrics.every(({ value }) => value === null)).toBe(true);
    expect(report.groupSummaries).toHaveLength(1);
    expect(report.groupSummaries[0]?.generationCount).toBeNull();
    expect(report.alerts).toEqual([]);
  });

  it("blocks stale, synthetic, and unavailable sources without performance values", () => {
    const stale = projectAiOperationsReport(snapshot(), {
      ...context,
      asOf: "2026-07-31T08:00:00.000Z",
    });
    const synthetic = projectAiOperationsReport(
      snapshot({
        source: {
          approvalReference: null,
          kind: "synthetic_fixture",
          observedThrough: "2026-07-30T00:00:00.000Z",
        },
      }),
      context,
    );
    const unavailable = projectAiOperationsReport(
      snapshot({
        groups: [],
        source: {
          approvalReference: null,
          kind: "unavailable",
          observedThrough: null,
        },
      }),
      context,
    );
    for (const report of [stale, synthetic, unavailable]) {
      expect(report.decisionStatus).toBe("blocked");
      expect(report.metrics.every(({ value }) => value === null)).toBe(true);
      expect(report.groupSummaries).toEqual([]);
      expect(report.alerts.map(({ kind }) => kind)).toEqual(["source_refresh"]);
    }
  });

  it("renders only branded deterministic reports", () => {
    const report = projectAiOperationsReport(snapshot(), context);
    const markdown = renderAiOperationsMarkdown(report);
    expect(markdown).toContain("# RITUVIA AI Operations Brief");
    expect(markdown).toContain("owner_budget_unavailable");
    expect(markdown).toContain("reflective-model@1.0.0");
    expect(markdown).not.toMatch(/question|journal|reading-private|PRIVATE-/u);
    expect(() => renderAiOperationsMarkdown({ ...report })).toThrow(AiOperationsContractError);
  });
});
