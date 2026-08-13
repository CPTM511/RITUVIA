import { describe, expect, it } from "vitest";

import { betaSloDefinitions, betaSloIds, evaluateBetaSlo } from "../src/index.js";

const now = "2026-08-01T12:00:00.000Z";

describe("protected Beta operational policy", () => {
  it("publishes the fixed owner, objective, freshness, and runbook contract", () => {
    expect(betaSloDefinitions.map(({ id, objective }) => [id, objective])).toEqual([
      ["core_page_availability", 0.999],
      ["auth_verification_p95_ms", 1_500],
      ["order_creation_p95_ms", 2_000],
      ["payment_webhook_processing_p95_ms", 5_000],
      ["deep_reading_success_ratio", 0.98],
      ["credit_entry_loss_or_duplicate_count", 0],
    ]);

    for (const id of betaSloIds) {
      const alert = evaluateBetaSlo(id, undefined, now).alert;
      expect(alert?.runbookPath).toBe("docs/runbooks/RIT-124_BETA_OPERATIONS.md");
      expect(alert?.requiresCorrelationId).toBe(true);
      expect(alert?.owner).toMatch(/^(?:commerce|identity|platform|product_ai)$/u);
    }
  });

  it("distinguishes healthy and breached samples at the exact objectives", () => {
    expect(
      evaluateBetaSlo(
        "core_page_availability",
        { observedAt: "2026-08-01T11:59:00.000Z", value: 0.999 },
        now,
      ),
    ).toMatchObject({ alert: null, reason: "within_objective", state: "healthy" });
    expect(
      evaluateBetaSlo(
        "payment_webhook_processing_p95_ms",
        { observedAt: "2026-08-01T11:59:00.000Z", value: 5_001 },
        now,
      ),
    ).toMatchObject({
      alert: { owner: "commerce", severity: "critical" },
      reason: "objective_breached",
      state: "breached",
    });
  });

  it("never converts missing, stale, future, or invalid evidence into healthy status", () => {
    const canary = "private-question-canary";
    const evaluations = [
      evaluateBetaSlo("auth_verification_p95_ms", undefined, now),
      evaluateBetaSlo(
        "auth_verification_p95_ms",
        { observedAt: "2026-08-01T11:54:59.999Z", value: 100 },
        now,
      ),
      evaluateBetaSlo(
        "auth_verification_p95_ms",
        { observedAt: "2026-08-01T12:00:01.000Z", value: 100 },
        now,
      ),
      evaluateBetaSlo("auth_verification_p95_ms", { observedAt: canary, value: Number.NaN }, now),
    ];

    expect(evaluations.map(({ reason, state }) => [reason, state])).toEqual([
      ["missing", "unknown"],
      ["stale", "unknown"],
      ["stale", "unknown"],
      ["invalid", "unknown"],
    ]);
    expect(evaluations.every(({ alert }) => alert !== null)).toBe(true);
    expect(JSON.stringify(evaluations)).not.toContain(canary);
  });
});
