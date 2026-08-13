import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  OwnerOperationsContractError,
  ownerOperationsSectionIds,
  ownerOperationsSnapshotSchemaVersion,
  projectOwnerOperationsReport,
  renderOwnerOperationsMarkdown,
} from "../packages/analytics/src/index.js";

const digest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const source = (kind: "local_verification" | "owner_approved_record") => ({
  approvalReference: kind === "owner_approved_record" ? "D-097" : "D-101",
  evidencePath:
    kind === "owner_approved_record"
      ? "records/decisions/D-097.md"
      : "docs/runbooks/RIT-124_BETA_OPERATIONS.md",
  kind,
  observedThrough: "2026-08-02T01:00:00.000Z",
  windowEnd: null,
  windowStart: null,
});

const base = {
  capturedAt: "2026-08-02T01:00:00.000Z",
  environment: "local",
  release: {
    candidate: "protected_english_anonymous_free_beta",
    gateH: "incomplete",
    independentSecurityReview: "pending",
    nextApproval: "OWN-005",
    nextTasks: ["RIT-130"],
    standingStaging: "unavailable",
  },
  schemaVersion: ownerOperationsSnapshotSchemaVersion,
  sections: [
    {
      detailCode: "standing_staging_unavailable",
      id: "health",
      source: source("local_verification"),
      state: "blocked",
    },
    {
      detailCode: "beta_commerce_excluded",
      id: "revenue",
      source: source("owner_approved_record"),
      state: "not_applicable",
    },
    {
      detailCode: "local_core_loop_verified",
      id: "core_loop",
      source: source("local_verification"),
      state: "nominal",
    },
    {
      detailCode: "beta_production_ai_excluded",
      id: "ai",
      source: source("owner_approved_record"),
      state: "not_applicable",
    },
    {
      detailCode: "local_queue_controls_verified",
      id: "queue",
      source: source("local_verification"),
      state: "attention",
    },
    {
      detailCode: "local_case_kernel_verified",
      id: "support",
      source: source("local_verification"),
      state: "attention",
    },
    {
      detailCode: "cost_guardrails_local_verified",
      id: "cost",
      source: {
        approvalReference: "D-106",
        evidencePath: "docs/runbooks/RIT-127_COST_GUARDRAILS.md",
        kind: "local_verification",
        observedThrough: "2026-08-02T01:00:00.000Z",
        windowEnd: null,
        windowStart: null,
      },
      state: "attention",
    },
    {
      detailCode: "own_005_blocked",
      id: "approvals",
      source: {
        approvalReference: "D-105",
        evidencePath: "docs/reports/RITUVIA_OWN_005_COST_BUDGET_DECISION_REQUEST_2026-08-02.md",
        kind: "local_verification",
        observedThrough: "2026-08-02T01:00:00.000Z",
        windowEnd: null,
        windowStart: null,
      },
      state: "blocked",
    },
  ],
};

const contextFor = (input: unknown, asOf = "2026-08-02T01:30:00.000Z") => ({
  asOf,
  inputDigest: digest(input),
});

const current = projectOwnerOperationsReport(base, contextFor(base));
assert.equal(current.decisionStatus, "blocked");
assert.equal(current.sections.length, ownerOperationsSectionIds.length);
assert.equal(current.sections.find(({ id }) => id === "cost")?.state, "attention");
assert.equal(current.release.nextApproval, "OWN-005");
assert.deepEqual(current.release.nextTasks, ["RIT-130"]);

const stale = projectOwnerOperationsReport(base, contextFor(base, "2026-08-10T01:30:00.000Z"));
assert.ok(stale.sections.every(({ state }) => state === "unknown"));

const synthetic = {
  ...base,
  sections: base.sections.map((section) =>
    section.id === "core_loop"
      ? {
          ...section,
          source: {
            approvalReference: null,
            evidencePath: "tests/owner-operations-dashboard.test.ts",
            kind: "synthetic_fixture",
            observedThrough: "2026-08-02T01:00:00.000Z",
            windowEnd: null,
            windowStart: null,
          },
          state: "unknown",
        }
      : section,
  ),
};
const syntheticReport = projectOwnerOperationsReport(synthetic, contextFor(synthetic));
assert.equal(
  syntheticReport.sections.find(({ id }) => id === "core_loop")?.dataQuality,
  "synthetic",
);
assert.equal(syntheticReport.sections.find(({ id }) => id === "core_loop")?.state, "unknown");

assert.throws(
  () =>
    projectOwnerOperationsReport({ ...base, rawPrompt: "PRIVATE-OWNER-CANARY" }, contextFor(base)),
  OwnerOperationsContractError,
);
const markdown = renderOwnerOperationsMarkdown(current);
assert.doesNotMatch(markdown, /PRIVATE-OWNER-CANARY|rawPrompt|journal|prayer/u);
assert.match(markdown, /Next OWN approval: OWN-005/u);
assert.match(markdown, /Next task sequence: RIT-130/u);
assert.match(markdown, /Standing staging: unavailable/u);

process.stdout.write(
  "Verified owner dashboard sections, source freshness, unknown suppression, release gates, and private-field boundaries.\n",
);
