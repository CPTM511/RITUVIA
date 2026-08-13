import { describe, expect, it } from "vitest";

import {
  CostGuardrailContractError,
  costGuardrailSnapshotSchemaVersion,
  projectCostGuardrailReport,
  renderCostGuardrailMarkdown,
} from "../src/index.js";

const base = {
  capturedAt: "2026-08-02T02:00:00.000Z",
  currencyCode: "USD",
  environment: "local",
  observations: [
    {
      featureId: "interpretation_generation",
      providerId: "ai_primary",
      reportedCostMicros: 750_000,
      reportedUsageCount: 100,
      totalUsageCount: 100,
    },
    {
      featureId: "backup_restore",
      providerId: "backup_storage",
      reportedCostMicros: 2_000_000,
      reportedUsageCount: 1,
      totalUsageCount: 1,
    },
  ],
  policy: {
    approvalReference: null,
    kind: "proposed_policy",
    lines: [
      {
        budgetMicros: 1_000_000,
        featureId: "interpretation_generation",
        limitAction: "disable_non_essential_paid_provider",
        protectionClass: "non_essential",
        providerId: "ai_primary",
        warningAction: "pause_non_essential_content_generation",
        warningThresholdBasisPoints: 8_000,
      },
      {
        budgetMicros: 2_000_000,
        featureId: "backup_restore",
        limitAction: "alert_and_annotate",
        protectionClass: "essential_no_automatic_degradation",
        providerId: "backup_storage",
        warningAction: "alert_and_annotate",
        warningThresholdBasisPoints: 9_000,
      },
    ],
    policyReference: "cost-budget.proposed-free-beta.v1",
    totalBudgetMicros: 3_000_000,
  },
  schemaVersion: costGuardrailSnapshotSchemaVersion,
  source: {
    kind: "durable_cost_aggregate",
    observedThrough: "2026-08-02T01:30:00.000Z",
  },
  windowEnd: "2026-08-02T00:00:00.000Z",
  windowStart: "2026-08-01T00:00:00.000Z",
} as const;

const contextFor = (_value: unknown, asOf = "2026-08-02T02:30:00.000Z") => ({
  asOf,
  inputDigest: `sha256:${"a".repeat(64)}`,
});

describe("cost guardrails", () => {
  it("projects proposed allocations without authorizing or executing degradation", () => {
    const report = projectCostGuardrailReport(base, contextFor(base));

    expect(report.decisionStatus).toBe("blocked");
    expect(report.evaluationStatus).toBe("review_required");
    expect(report.automaticActionsExecuted).toBe(false);
    expect(report.allocations).toEqual([
      expect.objectContaining({
        actionAuthority: "simulation_only",
        featureId: "interpretation_generation",
        remainingBudgetMicros: 250_000,
        spendAuthorization: "deny",
        status: "within_budget",
      }),
      expect.objectContaining({
        featureId: "backup_restore",
        recommendedAction: "alert_and_annotate",
        spendAuthorization: "alert_only",
        status: "budget_exhausted",
      }),
    ]);
    expect(renderCostGuardrailMarkdown(report)).toContain("Automatic actions executed: false");
  });

  it("blocks stale, synthetic, incomplete, unavailable, and unbudgeted evidence", () => {
    const stale = projectCostGuardrailReport(base, contextFor(base, "2026-08-04T00:00:00.000Z"));
    expect(stale.decisionStatus).toBe("blocked");
    expect(stale.allocations[0]?.spendAuthorization).toBe("deny");

    const synthetic = {
      ...base,
      source: { ...base.source, kind: "synthetic_fixture" },
    };
    const syntheticReport = projectCostGuardrailReport(synthetic, contextFor(synthetic));
    expect(syntheticReport.decisionStatus).toBe("blocked");
    expect(syntheticReport.allocations[0]?.actionAuthority).toBe("simulation_only");

    const incomplete = {
      ...base,
      observations: base.observations.map((observation, index) =>
        index === 0 ? { ...observation, reportedUsageCount: 95 } : observation,
      ),
    };
    expect(
      projectCostGuardrailReport(incomplete, contextFor(incomplete)).allocations[0],
    ).toMatchObject({
      remainingBudgetMicros: null,
      spendAuthorization: "deny",
      status: "cost_reporting_incomplete",
    });

    const unavailable = {
      ...base,
      observations: [],
      policy: {
        approvalReference: null,
        kind: "unavailable",
        lines: [],
        policyReference: null,
        totalBudgetMicros: null,
      },
      source: { kind: "unavailable", observedThrough: null },
    };
    expect(projectCostGuardrailReport(unavailable, contextFor(unavailable))).toMatchObject({
      allocations: [],
      decisionStatus: "blocked",
    });

    const unbudgeted = {
      ...base,
      observations: [
        ...base.observations,
        {
          featureId: "paid_acquisition",
          providerId: "marketing_channel",
          reportedCostMicros: 1,
          reportedUsageCount: 1,
          totalUsageCount: 1,
        },
      ],
    };
    expect(
      projectCostGuardrailReport(unbudgeted, contextFor(unbudgeted)).allocations[2],
    ).toMatchObject({ spendAuthorization: "deny", status: "unbudgeted" });
  });

  it("rejects private fields, accessors, unsafe essential actions, and forged reports", () => {
    expect(() =>
      projectCostGuardrailReport({ ...base, rawPrompt: "PRIVATE-COST-CANARY" }, contextFor(base)),
    ).toThrow(CostGuardrailContractError);

    const accessor = Object.defineProperty({ ...base }, "rawPrompt", {
      enumerable: true,
      get: () => "PRIVATE-COST-CANARY",
    });
    expect(() => projectCostGuardrailReport(accessor, contextFor(base))).toThrow(
      CostGuardrailContractError,
    );

    const unsafeEssential = {
      ...base,
      policy: {
        ...base.policy,
        lines: base.policy.lines.map((line, index) =>
          index === 1 ? { ...line, limitAction: "disable_non_essential_paid_provider" } : line,
        ),
      },
    };
    expect(() => projectCostGuardrailReport(unsafeEssential, contextFor(unsafeEssential))).toThrow(
      CostGuardrailContractError,
    );

    const arbitraryProvider = {
      ...base,
      observations: base.observations.map((observation, index) =>
        index === 0 ? { ...observation, providerId: "private-user-identifier" } : observation,
      ),
    };
    expect(() =>
      projectCostGuardrailReport(arbitraryProvider, contextFor(arbitraryProvider)),
    ).toThrow(CostGuardrailContractError);

    const report = projectCostGuardrailReport(base, contextFor(base));
    expect(() => renderCostGuardrailMarkdown({ ...report })).toThrow(CostGuardrailContractError);
    expect(renderCostGuardrailMarkdown(report)).not.toMatch(
      /PRIVATE-COST-CANARY|prompt|journal|prayer|birth/u,
    );
  });
});
