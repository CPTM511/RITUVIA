import { describe, expect, it } from "vitest";

import {
  OwnerOperationsContractError,
  ownerOperationsSectionIds,
  ownerOperationsSnapshotSchemaVersion,
  parseOwnerOperationsSnapshot,
  projectOwnerOperationsReport,
  renderOwnerOperationsMarkdown,
  type OwnerOperationsSectionSnapshot,
  type OwnerOperationsSnapshot,
} from "../src/index.js";

const trustedSource = (kind: "local_verification" | "owner_approved_record") => ({
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

const sections = (): OwnerOperationsSectionSnapshot[] => [
  {
    detailCode: "standing_staging_unavailable",
    id: "health",
    source: trustedSource("local_verification"),
    state: "blocked",
  },
  {
    detailCode: "beta_commerce_excluded",
    id: "revenue",
    source: trustedSource("owner_approved_record"),
    state: "not_applicable",
  },
  {
    detailCode: "local_core_loop_verified",
    id: "core_loop",
    source: trustedSource("local_verification"),
    state: "nominal",
  },
  {
    detailCode: "beta_production_ai_excluded",
    id: "ai",
    source: trustedSource("owner_approved_record"),
    state: "not_applicable",
  },
  {
    detailCode: "local_queue_controls_verified",
    id: "queue",
    source: trustedSource("local_verification"),
    state: "attention",
  },
  {
    detailCode: "local_case_kernel_verified",
    id: "support",
    source: trustedSource("local_verification"),
    state: "attention",
  },
  {
    detailCode: "cost_guardrails_local_verified",
    id: "cost",
    source: {
      approvalReference: "D-105",
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
      approvalReference: "D-106",
      evidencePath: "docs/reports/RITUVIA_OWN_005_COST_BUDGET_DECISION_REQUEST_2026-08-02.md",
      kind: "local_verification",
      observedThrough: "2026-08-02T01:00:00.000Z",
      windowEnd: null,
      windowStart: null,
    },
    state: "blocked",
  },
];

const snapshot = (overrides: Partial<OwnerOperationsSnapshot> = {}): OwnerOperationsSnapshot => ({
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
  sections: sections(),
  ...overrides,
});

const context = {
  asOf: "2026-08-02T01:30:00.000Z",
  inputDigest: `sha256:${"a".repeat(64)}`,
};

describe("owner operations contract", () => {
  it("requires all eight sections in canonical order", () => {
    expect(parseOwnerOperationsSnapshot(snapshot()).sections.map(({ id }) => id)).toEqual(
      ownerOperationsSectionIds,
    );
    expect(() =>
      parseOwnerOperationsSnapshot(snapshot({ sections: sections().slice(0, 7) })),
    ).toThrow(OwnerOperationsContractError);
    expect(() =>
      parseOwnerOperationsSnapshot(
        snapshot({ sections: [sections()[1]!, sections()[0]!, ...sections().slice(2)] }),
      ),
    ).toThrow(OwnerOperationsContractError);
  });

  it("rejects private fields and accessor-backed values without invoking getters", () => {
    expect(() =>
      parseOwnerOperationsSnapshot({ ...snapshot(), rawPrompt: "PRIVATE-OWNER-CANARY" }),
    ).toThrow(OwnerOperationsContractError);
    let getterCalls = 0;
    const unsafe: OwnerOperationsSectionSnapshot = { ...sections()[0]! };
    Object.defineProperty(unsafe, "state", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "nominal";
      },
    });
    expect(() =>
      parseOwnerOperationsSnapshot(snapshot({ sections: [unsafe, ...sections().slice(1)] })),
    ).toThrow(OwnerOperationsContractError);
    expect(getterCalls).toBe(0);
  });

  it("requires unavailable sources to contain no invented evidence", () => {
    const invalidSections = sections();
    invalidSections[6] = {
      detailCode: "cost_aggregate_unavailable",
      id: "cost",
      source: {
        approvalReference: null,
        evidencePath: null,
        kind: "unavailable",
        observedThrough: "2026-08-02T01:00:00.000Z",
        windowEnd: null,
        windowStart: null,
      },
      state: "unknown",
    };
    expect(() => parseOwnerOperationsSnapshot(snapshot({ sections: invalidSections }))).toThrow(
      OwnerOperationsContractError,
    );
  });

  it("requires completed Gate H to include staging and independent security evidence", () => {
    expect(() =>
      parseOwnerOperationsSnapshot(
        snapshot({ release: { ...snapshot().release, gateH: "complete" } }),
      ),
    ).toThrow(OwnerOperationsContractError);
  });
});

describe("owner operations projection", () => {
  it("shows source labels while keeping missing values unknown", () => {
    const report = projectOwnerOperationsReport(snapshot(), context);
    expect(report.decisionStatus).toBe("blocked");
    expect(report.authorizationStatus).toBe("owner_deployment_approval_required");
    expect(report.sections).toHaveLength(8);
    expect(report.sections.find(({ id }) => id === "cost")).toMatchObject({
      dataQuality: "verified",
      state: "attention",
      source: { freshness: "current", kind: "local_verification" },
    });
    expect(report.sections.every(({ source }) => source.environment === "local")).toBe(true);
  });

  it("forces stale and synthetic sources to unknown", () => {
    const stale = projectOwnerOperationsReport(snapshot(), {
      ...context,
      asOf: "2026-08-10T01:30:00.000Z",
    });
    expect(stale.sections.every(({ state }) => state === "unknown")).toBe(true);

    const syntheticSections = sections();
    syntheticSections[2] = {
      ...syntheticSections[2]!,
      source: {
        approvalReference: null,
        evidencePath: "tests/owner-operations-dashboard.test.ts",
        kind: "synthetic_fixture",
        observedThrough: "2026-08-02T01:00:00.000Z",
        windowEnd: null,
        windowStart: null,
      },
      state: "unknown",
    };
    const synthetic = projectOwnerOperationsReport(
      snapshot({ sections: syntheticSections }),
      context,
    );
    expect(synthetic.sections[2]).toMatchObject({ dataQuality: "synthetic", state: "unknown" });
  });

  it("renders only branded reports with the release sequence and no private prose", () => {
    const report = projectOwnerOperationsReport(snapshot(), context);
    const markdown = renderOwnerOperationsMarkdown(report);
    expect(markdown).toContain("# RITUVIA Owner Operations Dashboard");
    expect(markdown).toContain("Next OWN approval: OWN-005");
    expect(markdown).toContain("Next task sequence: RIT-130");
    expect(markdown).toContain("Standing staging: unavailable");
    expect(markdown).not.toMatch(/question|journal|prayer|PRIVATE-/u);
    expect(() => renderOwnerOperationsMarkdown({ ...report })).toThrow(
      OwnerOperationsContractError,
    );
  });
});
