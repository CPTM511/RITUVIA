import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  auditAutomationPromptContracts,
  auditAutomationScheduleContract,
  auditRecordSet,
  auditTaskResult,
  auditTaskResultSchema,
  isSafeRepositoryPath,
  parseBacklog,
} from "../scripts/record-policy.js";

const backlog = [
  "| ID | Milestone | Priority | Status | Task | Dependencies | Primary role | Done when |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  "| RIT-000 | M0 | P0 | Done | Bootstrap | None | product | Done |",
  "| RIT-009 | M0 | P1 | Done | Records | RIT-000 | product | Done |",
  "| RIT-010 | M0 | P0 | Ready | Next | RIT-009 | backend | Done |",
  "| OWN-008 | Cross | Owner | Done | Protection | None | owner | Done |",
].join("\n");

const taskRecord = `# RIT-009: Repository record workflow

- Backlog item: RIT-009
- Related records: D-022

## Outcome

Linked records.

## Scope

Repository only.

## Acceptance criteria

- [x] Complete.

## Verification evidence

- local checks

## Risks and rollback

Revert the commit.
`;

const reviewedTaskRecord = taskRecord
  .replace("- Related records: D-022", "- Related records: D-022, EXP-001")
  .replace(
    "- [x] Complete.",
    "- [x] Complete.\n- [x] Safety/privacy/cultural review complete: evidence:review-001",
  );

const decisionRecord = (id = "D-022") => `# ${id}: Canonical record workflow

- Date: 2026-07-17
- Owners: product
- Related tasks: RIT-009
- Evidence references: local-review

## Context

Records were disconnected.

## Decision

Link them.

## Alternatives considered

Keep stale copies.

## Consequences

One source of truth.

## Validation

Run local checks.

## Rollout and rollback

Revert this repository commit.

## Sources and approvals

No owner gate is satisfied.
`;

const contributing =
  "BACKLOG.md DECISIONS.md records/INDEX.md task-result.schema.json sync_generated_evidence.py owner gate Git-indexed";
const decisions =
  "### [D-022 — Canonical record workflow](records/decisions/D-022.md)\n\n- **Date:** 2026-07-17\n";

const incidentRecord = (
  status = "Resolved",
  related = "RIT-009, D-022",
  corrective = "RIT-009",
) => `# INC-001: Synthetic policy fixture

- Severity: SEV-2
- Status: ${status}
- Related tasks/decisions: ${related}
- Start / detected / mitigated / resolved times: 2026-07-17T00:00:00Z / 2026-07-17T00:01:00Z / 2026-07-17T00:02:00Z / 2026-07-17T00:03:00Z
- Incident commander: synthetic-reviewer
- Affected environments/countries/features: local synthetic fixture only
- Closure review evidence: evidence:closure-001
- Owner/counsel/notification decision evidence: None

## User/business impact

Aggregate facts only.

## Detection

Synthetic fixture.

## Evidence locations

evidence:incident-001

## Timeline

Exact synthetic timestamps.

## Root cause and contributing factors

Fixture only.

## Response and recovery

No external action.

## Privacy/security/legal assessment

No real event or data.

## Corrective actions

| Backlog ID | Action and completion evidence |
| --- | --- |
| ${corrective} | Local policy check |

## Lessons and control updates

Keep the policy test.
`;

const experimentRecord = (
  status = "Running",
  related = "RIT-009, D-022",
  gateEvidence = "evidence:gate-001",
  requiredGates = "None",
) => `# EXP-001: Synthetic policy fixture

- Status: ${status}
- Owner: synthetic-reviewer
- Related tasks/decisions: ${related}
- Required owner/qualified-reviewer gates: ${requiredGates}
- Gate evidence references: ${gateEvidence}
- Qualified review task: RIT-009
- Qualified review evidence: evidence:review-001
- Population/countries/locales: local synthetic population
- Start/end: 2026-07-17T00:00:00Z / 2026-07-17T01:00:00Z

## Decision and hypothesis

Synthetic only.

## Variants and assignment

Deterministic fixture.

## Metrics

- Primary metric: aggregate fixture completion
- Guardrails: safety, privacy, and trust
- Stopping rule: stop after the synthetic review window

## Ethics and privacy

No private data.

## Implementation and QA

- Rollback: stop the synthetic fixture
- Cleanup date: 2026-07-18

## Results

No production result.

## Decision

Fixture only.
`;

const validResult = () => ({
  schema_version: 1,
  run_id: "run-test-001",
  as_of: "2026-07-17T12:00:00Z",
  repository_revision: "a".repeat(40),
  branch: "main",
  task_id: "RIT-009",
  status: "completed",
  summary: "RIT-009 is complete.",
  observed_evidence: [
    {
      claim: "The record policy test passed.",
      source: "tests/record-policy.test.ts",
      as_of: "2026-07-17T12:00:00Z",
      confidence: "high",
    },
  ],
  changes: [{ path: "records/tasks/RIT-009.md", description: "Added the task record." }],
  verification: [{ check: "pnpm test:unit", result: "passed", details: "All tests passed." }],
  assumptions: [] as string[],
  blockers: [] as { description: string; evidence_needed: string }[],
  risks: [] as { severity: string; status: string; description: string; mitigation: string }[],
  owner_actions: [] as { action: string; blocking: boolean; evidence_needed: string }[],
  record_refs: {
    task: "records/tasks/RIT-009.md",
    decisions: ["records/decisions/D-022.md"],
    incidents: [],
    experiments: [],
  },
  rollback_notes: "Revert the repository commit.",
  next_recommended_task: "RIT-010",
});

const context = {
  backlog: parseBacklog(backlog),
  repositoryPaths: new Set([
    "records/tasks/RIT-009.md",
    "records/decisions/D-022.md",
    "tests/record-policy.test.ts",
  ]),
};
const rules = (value: unknown) => auditTaskResult(value, context).map((finding) => finding.rule);
const schema = JSON.parse(
  readFileSync(new URL("../automation/schemas/task-result.schema.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("durable record graph", () => {
  it("accepts linked task and decision records without queue-field duplication", () => {
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": taskRecord,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        decisions,
        contributing,
      ),
    ).toEqual([]);
  });

  it("rejects placeholders, dangling references, unknown record paths, and missing dossiers", () => {
    const mutatedTask = taskRecord
      .replace("# RIT-009", "# RIT-NNN")
      .replace("D-022", "D-999")
      .concat("\n- Status: Done\n");
    const findings = auditRecordSet(
      {
        "records/tasks/RIT-009.md": mutatedTask,
        "records/decisions/D-022.md": decisionRecord(),
        "records/tasks/evil.md": "# evil",
      },
      backlog.replace("| RIT-009 | M0 | P1 | Done", "| RIT-009 | M0 | P1 | In Progress"),
      decisions,
      contributing,
    );
    expect(findings.map((finding) => finding.rule)).toEqual(
      expect.arrayContaining([
        "unexpected-record-path",
        "record-heading-or-placeholder",
        "duplicated-backlog-field",
        "dangling-related-record",
      ]),
    );
  });

  it.each([
    "![pixel](https://example.invalid/pixel)",
    "![pixel](//example.invalid/pixel)",
    "![pixel][remote]\n\n[remote]: https://example.invalid/pixel",
    "![pixel] [remote]\n\n[remote]: https://example.invalid/pixel",
    "![pixel]\n[remote]\n\n[remote]: https://example.invalid/pixel",
    '<img src="https://example.invalid/pixel">',
    "<svg onload=alert(1)></svg>",
    '<?xml version="1.0"?>',
    "<!DOCTYPE html>",
  ])("rejects embedded Markdown or HTML media in records: %s", (media) => {
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": `${taskRecord}\n${media}\n`,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("unsafe-record-content");
  });

  it("rejects dangling/self/cyclic decision supersession", () => {
    const files = {
      "records/tasks/RIT-009.md": taskRecord,
      "records/decisions/D-022.md": decisionRecord("D-022"),
      "records/decisions/D-023.md": decisionRecord("D-023"),
    };
    const register = `${decisions}\n- **Supersedes:** D-023\n\n### [D-023 — Other](records/decisions/D-023.md)\n\n- **Supersedes:** D-022\n`;
    const rulesFound = auditRecordSet(files, backlog, register, contributing).map(
      (finding) => finding.rule,
    );
    expect(rulesFound).toContain("supersession-cycle");
    expect(
      auditRecordSet(
        files,
        backlog,
        `${decisions}\n### [D-023 — Other](records/decisions/D-023.md)\n\n- **Supersedes:** D-023\n`,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("invalid-supersedes");
  });

  it("rejects duplicate decision IDs and a detail link outside its own register heading", () => {
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": taskRecord,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        `${decisions}\n### D-022 — duplicate\n`,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("duplicate-decision-id");

    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": taskRecord,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        "### D-022 — no link\n\nMention records/decisions/D-022.md later.\n",
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("decision-register-link");
  });

  it("requires a dossier for every non-grandfathered executing or completed task", () => {
    expect(
      auditRecordSet(
        { "records/decisions/D-022.md": decisionRecord() },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("missing-task-record");

    const reopened = backlog.replace(
      "| RIT-000 | M0 | P0 | Done",
      "| RIT-000 | M0 | P0 | In Progress",
    );
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": taskRecord,
          "records/decisions/D-022.md": decisionRecord(),
        },
        reopened,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("missing-task-record");
  });

  it("rejects Done with unchecked acceptance or empty verification/rollback evidence", () => {
    const unchecked = taskRecord.replace("- [x] Complete.", "* [ ] Complete.");
    const emptyVerification = taskRecord.replace("- local checks", "");
    const emptyRollback = taskRecord.replace("Revert the commit.", "");
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": unchecked,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("done-task-acceptance");
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": emptyVerification,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("done-task-verification");
    expect(
      auditRecordSet(
        {
          "records/tasks/RIT-009.md": emptyRollback,
          "records/decisions/D-022.md": decisionRecord(),
        },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toContain("done-task-rollback");
  });

  it("validates incident corrective-task and experiment gate/reference semantics", () => {
    const validFiles = {
      "records/tasks/RIT-009.md": reviewedTaskRecord,
      "records/decisions/D-022.md": decisionRecord(),
      "records/incidents/INC-001.md": incidentRecord(),
      "records/experiments/EXP-001.md": experimentRecord(),
    };
    expect(auditRecordSet(validFiles, backlog, decisions, contributing)).toEqual([]);

    const invalidFiles = {
      ...validFiles,
      "records/incidents/INC-001.md": incidentRecord("Resolved", "RIT-999", "RIT-999"),
      "records/experiments/EXP-001.md": experimentRecord("Running", "D-999", "None"),
    };
    expect(
      auditRecordSet(invalidFiles, backlog, decisions, contributing).map((finding) => finding.rule),
    ).toEqual(
      expect.arrayContaining([
        "dangling-event-reference",
        "dangling-corrective-task",
        "experiment-gate-evidence",
      ]),
    );

    const unrelatedGate = {
      ...validFiles,
      "records/experiments/EXP-001.md": experimentRecord(
        "Running",
        "RIT-009, D-022",
        "evidence:gate-001",
        "OWN-008",
      ),
    };
    expect(
      auditRecordSet(unrelatedGate, backlog, decisions, contributing).map(
        (finding) => finding.rule,
      ),
    ).toContain("experiment-gate-not-canonical");

    const omittedGateBacklog = `${backlog.replace(
      "| RIT-009 | M0 | P1 | Done | Records | RIT-000 |",
      "| RIT-009 | M0 | P1 | Done | Records | RIT-000,OWN-009 |",
    )}\n| OWN-009 | Cross | Owner | Blocked | Experiment approval | None | owner | Done |`;
    const omittedGateRules = auditRecordSet(
      validFiles,
      omittedGateBacklog,
      decisions,
      contributing,
    ).map((finding) => finding.rule);
    expect(omittedGateRules).toEqual(
      expect.arrayContaining(["experiment-gate-not-canonical", "done-task-incomplete-dependency"]),
    );

    const missingReview = {
      ...validFiles,
      "records/experiments/EXP-001.md": experimentRecord().replace(
        "- Qualified review evidence: evidence:review-001",
        "- Qualified review evidence: evidence:self-asserted",
      ),
    };
    expect(
      auditRecordSet(missingReview, backlog, decisions, contributing).map(
        (finding) => finding.rule,
      ),
    ).toContain("experiment-qualified-review");

    let emptyExperiment = experimentRecord();
    for (const body of [
      "Synthetic only.",
      "Deterministic fixture.",
      "- Primary metric: aggregate fixture completion\n- Guardrails: safety, privacy, and trust\n- Stopping rule: stop after the synthetic review window",
      "No private data.",
      "- Rollback: stop the synthetic fixture\n- Cleanup date: 2026-07-18",
      "No production result.",
      "Fixture only.",
    ]) {
      emptyExperiment = emptyExperiment.replace(body, "");
    }
    expect(
      auditRecordSet(
        { ...validFiles, "records/experiments/EXP-001.md": emptyExperiment },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toEqual(expect.arrayContaining(["experiment-empty-section", "experiment-design-contract"]));

    const duplicateMetadata = {
      ...validFiles,
      "records/experiments/EXP-001.md": `${experimentRecord()}\n- Qualified review task: None\n`,
      "records/incidents/INC-001.md": `${incidentRecord()}\n- Closure review evidence: evidence:conflict\n`,
    };
    expect(
      auditRecordSet(duplicateMetadata, backlog, decisions, contributing).map(
        (finding) => finding.rule,
      ),
    ).toContain("duplicate-event-metadata");

    const forgedGate = {
      ...validFiles,
      "records/experiments/EXP-001.md": experimentRecord(
        "Running",
        "RIT-009",
        "https://example.invalid/proof",
      ).replace(
        "- Required owner/qualified-reviewer gates: None",
        "- Required owner/qualified-reviewer gates: OWN-999",
      ),
    };
    expect(
      auditRecordSet(forgedGate, backlog, decisions, contributing).map((finding) => finding.rule),
    ).toEqual(
      expect.arrayContaining([
        "experiment-required-gates",
        "experiment-gate-not-canonical",
        "experiment-gate-evidence",
      ]),
    );

    const unsafeIncident = {
      ...validFiles,
      "records/incidents/INC-001.md": incidentRecord("Closed", "RIT-009", "RIT-010")
        .replace("- Severity: SEV-2", "- Severity: SEV-9")
        .replace("| RIT-010 | Local policy check |", "| RIT-010 |   |"),
    };
    expect(
      auditRecordSet(unsafeIncident, backlog, decisions, contributing).map(
        (finding) => finding.rule,
      ),
    ).toEqual(expect.arrayContaining(["incident-severity", "resolved-incident-corrective-task"]));

    const severeIncident = {
      ...validFiles,
      "records/incidents/INC-001.md": incidentRecord("Closed").replace(
        "- Severity: SEV-2",
        "- Severity: SEV-0",
      ),
    };
    expect(
      auditRecordSet(severeIncident, backlog, decisions, contributing).map(
        (finding) => finding.rule,
      ),
    ).toContain("severe-incident-decision-evidence");

    let emptyIncident = incidentRecord("Closed")
      .replace("synthetic-reviewer", "TBD")
      .replace("Aggregate facts only.", "")
      .replace("Synthetic fixture.", "")
      .replace("evidence:incident-001", "")
      .replace("Exact synthetic timestamps.", "")
      .replace("Fixture only.", "")
      .replace("No external action.", "")
      .replace("No real event or data.", "")
      .replace("Keep the policy test.", "");
    emptyIncident = emptyIncident.replace("Local policy check", " ");
    expect(
      auditRecordSet(
        { ...validFiles, "records/incidents/INC-001.md": emptyIncident },
        backlog,
        decisions,
        contributing,
      ).map((finding) => finding.rule),
    ).toEqual(
      expect.arrayContaining([
        "incident-required-metadata",
        "incident-empty-section",
        "resolved-incident-corrective-task",
      ]),
    );
  });

  it("rejects an orphan task dossier and non-reciprocal task/decision links", () => {
    const orphan = taskRecord.replaceAll("RIT-009", "RIT-999");
    const oneWayDecision = decisionRecord().replace(
      "- Related tasks: RIT-009",
      "- Related tasks: RIT-010",
    );
    const nextTask = taskRecord
      .replaceAll("RIT-009", "RIT-010")
      .replace("- Related records: D-022", "- Related records: None");
    const findings = auditRecordSet(
      {
        "records/tasks/RIT-009.md": taskRecord,
        "records/tasks/RIT-010.md": nextTask,
        "records/tasks/RIT-999.md": orphan,
        "records/decisions/D-022.md": oneWayDecision,
      },
      backlog,
      decisions,
      contributing,
    ).map((finding) => finding.rule);
    expect(findings).toContain("orphan-task-record");
    expect(findings).toEqual(
      expect.arrayContaining(["nonreciprocal-decision-link", "nonreciprocal-task-link"]),
    );
  });
});

describe("task-result semantics", () => {
  it("accepts a trace-bound completed result matching canonical state and records", () => {
    expect(auditTaskResult(validResult(), context)).toEqual([]);
  });

  it("rejects OWN completion, mismatched task records, unknown next work, and non-ready next work", () => {
    const owner = validResult();
    owner.task_id = "OWN-008";
    expect(rules(owner)).toContain("task-id");

    const mismatch = validResult();
    mismatch.record_refs.task = "records/tasks/RIT-010.md";
    expect(rules(mismatch)).toContain("task-record-match");

    const next = validResult();
    next.next_recommended_task = "RIT-009";
    expect(rules(next)).toContain("next-task-not-ready");
  });

  it("requires a real passed check and rejects blockers, blocking approvals, and open high risk", () => {
    const noPass = validResult();
    noPass.verification = [
      {
        check: "not applicable",
        result: "not_applicable",
        details: "No applicable remote check exists.",
      },
    ];
    expect(rules(noPass)).toContain("completed-verification");

    const blocked = validResult();
    blocked.blockers = [{ description: "Blocked", evidence_needed: "Owner evidence" }];
    expect(rules(blocked)).toContain("completed-blockers");

    const owner = validResult();
    owner.owner_actions = [
      { action: "Approve", blocking: true, evidence_needed: "OWN-008 evidence" },
    ];
    expect(rules(owner)).toContain("completed-owner-action");

    const risk = validResult();
    risk.risks = [{ severity: "high", status: "open", description: "Risk", mitigation: "Pending" }];
    expect(rules(risk)).toContain("completed-unmitigated-risk");
  });

  it("requires blockers for blocked runs and keeps review/no-change results non-mutating", () => {
    const blocked = validResult();
    blocked.status = "blocked";
    blocked.blockers = [];
    expect(rules(blocked)).toContain("blocked-without-blocker");

    for (const status of ["review_only", "no_change"]) {
      const result = validResult();
      result.status = status;
      expect(rules(result)).toContain("non-mutating-status-change");
    }
  });

  it.each([
    "../secret",
    "/tmp/secret",
    "C:\\secret",
    "file:secret",
    "https://example.invalid/evidence",
    "user:password@example.invalid/path",
    "safe/\u202eevil",
    "safe/line\nbreak",
  ])("rejects unsafe change and evidence paths: %s", (unsafePath) => {
    const change = validResult();
    change.changes[0]!.path = unsafePath;
    expect(rules(change)).toContain("change-shape-or-path");

    const evidence = validResult();
    evidence.observed_evidence[0]!.source = unsafePath;
    expect(rules(evidence)).toContain("evidence-shape-or-source");
  });

  it("accepts one bounded Next dynamic route segment without weakening path safety", () => {
    expect(isSafeRepositoryPath("apps/web/app/[locale]/page.tsx")).toBe(true);
    for (const unsafePath of [
      "apps/web/app/[..]/page.tsx",
      "apps/web/app/[locale/page.tsx",
      "apps/web/app/locale]/page.tsx",
      "apps/web/app/[[locale]]/page.tsx",
      "apps/web/app/[...locale]/page.tsx",
      "apps/web/app/[loc ale]/page.tsx",
    ]) {
      expect(isSafeRepositoryPath(unsafePath)).toBe(false);
    }
  });

  it("accepts one bounded Next route-group segment without allowing path syntax", () => {
    expect(isSafeRepositoryPath("apps/web/app/(root)/page.tsx")).toBe(true);
    for (const unsafePath of [
      "apps/web/app/(..)/page.tsx",
      "apps/web/app/(root/page.tsx",
      "apps/web/app/root)/page.tsx",
      "apps/web/app/((root))/page.tsx",
      "apps/web/app/(root path)/page.tsx",
      "apps/web/app/(root.shell)/page.tsx",
    ]) {
      expect(isSafeRepositoryPath(unsafePath)).toBe(false);
    }
  });

  it("rejects nested extra fields, duplicate references, invalid dates, and schema bounds", () => {
    const extra = validResult() as ReturnType<typeof validResult> & {
      extra?: string;
      record_refs: ReturnType<typeof validResult>["record_refs"] & { extra?: string };
    };
    extra.extra = "not allowed";
    extra.record_refs.extra = "not allowed";
    (extra.verification[0] as Record<string, unknown>).extra = "not allowed";
    expect(rules(extra)).toEqual(
      expect.arrayContaining(["root-fields", "record-refs-fields", "verification-shape"]),
    );

    const duplicate = validResult();
    duplicate.record_refs.decisions.push("records/decisions/D-022.md");
    expect(rules(duplicate)).toContain("typed-record-refs");

    const invalidDate = validResult();
    invalidDate.as_of = "not-a-date";
    invalidDate.observed_evidence[0]!.as_of = "tomorrow";
    expect(rules(invalidDate)).toEqual(
      expect.arrayContaining(["trace-time", "evidence-shape-or-source"]),
    );

    const oversized = validResult();
    oversized.owner_actions = Array.from({ length: 51 }, () => ({
      action: "Review",
      blocking: false,
      evidence_needed: "Evidence",
    }));
    expect(rules(oversized)).toContain("owner-action-shape");
  });
});

describe("task-result JSON Schema policy", () => {
  it("accepts the committed closed and bounded schema", () => {
    expect(auditTaskResultSchema(schema)).toEqual([]);
  });

  it("rejects relaxed task/reference patterns, duplicate refs, required fields, risks, and completion proof", () => {
    const mutated = structuredClone(schema);
    const properties = mutated.properties as Record<string, Record<string, unknown>>;
    properties.task_id!.pattern = "^(RIT|OWN)-[0-9]{3}$";
    const refs = properties.record_refs!.properties as Record<string, Record<string, unknown>>;
    refs.decisions!.uniqueItems = false;
    properties.risks!.items = {
      properties: { status: { enum: ["open", "mitigated", "accepted"] } },
    };
    mutated.required = (mutated.required as string[]).filter((field) => field !== "record_refs");
    mutated.allOf = [];
    expect(auditTaskResultSchema(mutated).map((finding) => finding.rule)).toEqual(
      expect.arrayContaining([
        "schema-fingerprint",
        "schema-root-contract",
        "schema-task-pattern",
        "schema-decisions-refs",
        "schema-risk-status",
        "schema-completed-contract",
      ]),
    );
  });

  it("rejects a dead completed-condition decoy and relaxed nested contracts", () => {
    const mutated = structuredClone(schema);
    const allOf = mutated.allOf as Record<string, unknown>[];
    allOf[1] = {
      if: { const: false },
      then: {
        decoy: { contains: { properties: { result: { const: "passed" } } }, minContains: 1 },
      },
    };
    const properties = mutated.properties as Record<string, Record<string, unknown>>;
    const refs = properties.record_refs!.properties as Record<string, Record<string, unknown>>;
    refs.task!.type = ["string", "null", "number"];
    const verificationItems = properties.verification!.items as Record<string, unknown>;
    verificationItems.additionalProperties = true;
    expect(auditTaskResultSchema(mutated).map((finding) => finding.rule)).toEqual(
      expect.arrayContaining(["schema-fingerprint", "schema-completed-contract"]),
    );
  });
});

describe("automation prompt contract", () => {
  it("requires every scheduled/implementation prompt to emit the bounded result without authority", () => {
    const names = [
      "continue-next-task.md",
      "daily-maintenance.md",
      "monthly-risk-audit.md",
      "release-readiness.md",
      "weekly-product-review.md",
    ];
    const prompts = Object.fromEntries(
      names.map((name) => [
        name,
        readFileSync(new URL(`../automation/prompts/${name}`, import.meta.url), "utf8"),
      ]),
    );
    expect(auditAutomationPromptContracts(prompts)).toEqual([]);
    expect(
      auditAutomationPromptContracts({
        ...prompts,
        "daily-maintenance.md": prompts["daily-maintenance.md"]!.replace(
          "record_refs.task",
          "record refs",
        ),
      }).map((finding) => finding.rule),
    ).toContain("prompt-contract:record_refs.task");
  });
});

describe("recurring automation schedule contract", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../automation/rituvia-recurring-reviews.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;
  const runnerSource = readFileSync(
    new URL("../automation/scheduled-read-only-runner.md", import.meta.url),
    "utf8",
  );
  const repositoryPaths = new Set([
    "automation/scheduled-read-only-runner.md",
    "automation/prompts/daily-maintenance.md",
    "automation/prompts/weekly-product-review.md",
    "automation/prompts/monthly-risk-audit.md",
    "automation/schemas/task-result.schema.json",
  ]);

  it("accepts the exact paused prompt-enforced read-only schedules", () => {
    expect(auditAutomationScheduleContract(manifest, repositoryPaths, runnerSource)).toEqual([]);
  });

  it("rejects execution-environment and notification-policy drift", () => {
    const candidate = structuredClone(manifest);
    const automations = candidate.automations as Record<string, unknown>[];
    automations[0]!.execution_environment = "worktree";
    automations[1]!.notification_policy = "always";
    expect(auditAutomationScheduleContract(candidate, repositoryPaths, runnerSource)).toEqual([
      {
        location: "automation/rituvia-recurring-reviews.json.automations[0]",
        rule: "schedule-contract",
      },
      {
        location: "automation/rituvia-recurring-reviews.json.automations[1]",
        rule: "schedule-contract",
      },
    ]);
  });

  it("rejects missing tracked prompt or result-schema references", () => {
    expect(auditAutomationScheduleContract(manifest, new Set(), runnerSource)).toHaveLength(9);
  });

  it("rejects removal of the no-production runner boundary", () => {
    expect(
      auditAutomationScheduleContract(
        manifest,
        repositoryPaths,
        runnerSource.replaceAll("production", "hosted"),
      ),
    ).toContainEqual({
      location: "automation/rituvia-recurring-reviews.json",
      rule: "runner-contract:production",
    });
  });
});
