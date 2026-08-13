import { snapshotOwnEnumerableData } from "@rituvia/observability";

export const ownerOperationsSnapshotSchemaVersion = "owner-operations-snapshot.v1" as const;
export const ownerOperationsReportSchemaVersion = "owner-operations-report.v1" as const;
export const ownerOperationsPolicyVersion = "owner-operations.v1" as const;

export const ownerOperationsSectionIds = Object.freeze([
  "health",
  "revenue",
  "core_loop",
  "ai",
  "queue",
  "support",
  "cost",
  "approvals",
] as const);

export type OwnerOperationsSectionId = (typeof ownerOperationsSectionIds)[number];
export type OwnerOperationsEnvironment = "ci" | "local" | "production" | "protected_staging";
export type OwnerOperationsSourceKind =
  | "durable_operational_aggregate"
  | "local_verification"
  | "owner_approved_record"
  | "synthetic_fixture"
  | "unavailable";
export type OwnerOperationsFreshness = "current" | "stale" | "unavailable";
export type OwnerOperationsState =
  "attention" | "blocked" | "nominal" | "not_applicable" | "unknown";
export type OwnerOperationsDetailCode =
  | "beta_commerce_excluded"
  | "beta_production_ai_excluded"
  | "beta_slo_local_verification"
  | "core_loop_aggregate_unavailable"
  | "cost_aggregate_unavailable"
  | "cost_guardrails_local_verified"
  | "local_case_kernel_verified"
  | "local_core_loop_verified"
  | "local_queue_controls_verified"
  | "own_005_blocked"
  | "own_019_blocked"
  | "release_approvals_current"
  | "revenue_aggregate_unavailable"
  | "standing_staging_unavailable"
  | "support_queue_aggregate_unavailable";

export type OwnerOperationsSource = Readonly<{
  approvalReference: string | null;
  evidencePath: string | null;
  kind: OwnerOperationsSourceKind;
  observedThrough: string | null;
  windowEnd: string | null;
  windowStart: string | null;
}>;

export type OwnerOperationsSectionSnapshot = Readonly<{
  detailCode: OwnerOperationsDetailCode;
  id: OwnerOperationsSectionId;
  source: OwnerOperationsSource;
  state: OwnerOperationsState;
}>;

export type OwnerOperationsReleaseSnapshot = Readonly<{
  candidate: "protected_english_anonymous_free_beta";
  gateH: "complete" | "incomplete";
  independentSecurityReview: "passed_no_open_critical_high" | "pending";
  nextApproval: string | null;
  nextTasks: readonly string[];
  standingStaging: "protected_available" | "unavailable";
}>;

export type OwnerOperationsSnapshot = Readonly<{
  capturedAt: string;
  environment: OwnerOperationsEnvironment;
  release: OwnerOperationsReleaseSnapshot;
  schemaVersion: typeof ownerOperationsSnapshotSchemaVersion;
  sections: readonly OwnerOperationsSectionSnapshot[];
}>;

export type OwnerOperationsSection = Readonly<{
  dataQuality: "stale" | "synthetic" | "unavailable" | "verified";
  detail: string;
  detailCode: OwnerOperationsDetailCode;
  id: OwnerOperationsSectionId;
  knownGaps: readonly string[];
  runbookPath: string;
  source: OwnerOperationsSource &
    Readonly<{
      environment: OwnerOperationsEnvironment;
      freshness: OwnerOperationsFreshness;
      maximumAgeHours: number;
    }>;
  state: OwnerOperationsState;
  title: string;
}>;

export type OwnerOperationsReport = Readonly<{
  authorizationStatus: "owner_deployment_approval_required";
  caveats: readonly string[];
  decisionStatus: "blocked" | "evidence_ready";
  generatedAt: string;
  inputDigest: string;
  policyVersion: typeof ownerOperationsPolicyVersion;
  release: OwnerOperationsReleaseSnapshot;
  schemaVersion: typeof ownerOperationsReportSchemaVersion;
  sections: readonly OwnerOperationsSection[];
}>;

export class OwnerOperationsContractError extends Error {
  constructor() {
    super("The owner operations input is invalid.");
    this.name = "OwnerOperationsContractError";
  }
}

type DetailPolicy = Readonly<{
  detail: string;
  gap: string;
  sectionId: OwnerOperationsSectionId;
}>;

type SectionPolicy = Readonly<{
  maximumAgeHours: number;
  runbookPath: string;
  title: string;
}>;

const sectionPolicies = new Map<OwnerOperationsSectionId, SectionPolicy>([
  [
    "health",
    Object.freeze({
      maximumAgeHours: 1,
      runbookPath: "docs/runbooks/RIT-124_BETA_OPERATIONS.md",
      title: "Service health and incidents",
    }),
  ],
  [
    "revenue",
    Object.freeze({
      maximumAgeHours: 30,
      runbookPath: "docs/25_PRODUCT_ENGINEERING_RUNBOOK.md",
      title: "Revenue, payments, refunds, and disputes",
    }),
  ],
  [
    "core_loop",
    Object.freeze({
      maximumAgeHours: 30,
      runbookPath: "docs/23_PRODUCT_FUNCTIONS_AND_USER_GUIDE_ZH.md",
      title: "Core loop and retention",
    }),
  ],
  [
    "ai",
    Object.freeze({
      maximumAgeHours: 30,
      runbookPath: "docs/11_AUTONOMOUS_OPERATIONS.md",
      title: "AI cost, quality, and safety",
    }),
  ],
  [
    "queue",
    Object.freeze({
      maximumAgeHours: 1,
      runbookPath: "docs/runbooks/RIT-124_BETA_OPERATIONS.md",
      title: "Queues, reconciliation, and backups",
    }),
  ],
  [
    "support",
    Object.freeze({
      maximumAgeHours: 1,
      runbookPath: "docs/runbooks/RIT-125_CASE_OPERATIONS.md",
      title: "Support, privacy, and safety cases",
    }),
  ],
  [
    "cost",
    Object.freeze({
      maximumAgeHours: 30,
      runbookPath: "docs/16_COST_GUARDRAILS.md",
      title: "Cost and approved budgets",
    }),
  ],
  [
    "approvals",
    Object.freeze({
      maximumAgeHours: 168,
      runbookPath: "docs/codex/rituvia-production-2026-07-23/11_PRODUCTION_READINESS_GATES.md",
      title: "Release evidence and approvals",
    }),
  ],
]);

const detailPolicies = new Map<OwnerOperationsDetailCode, DetailPolicy>([
  [
    "beta_commerce_excluded",
    Object.freeze({
      detail: "Real payment, Credits, and subscriptions are excluded from the approved free Beta.",
      gap: "No production revenue aggregate is active or implied.",
      sectionId: "revenue",
    }),
  ],
  [
    "beta_production_ai_excluded",
    Object.freeze({
      detail: "Production AI is excluded from the approved free Beta.",
      gap: "No production model quality, safety, latency, or cost aggregate is active.",
      sectionId: "ai",
    }),
  ],
  [
    "beta_slo_local_verification",
    Object.freeze({
      detail: "The six Beta SLO definitions pass local verification only.",
      gap: "No standing environment sampler, external monitor, or incident feed is connected.",
      sectionId: "health",
    }),
  ],
  [
    "core_loop_aggregate_unavailable",
    Object.freeze({
      detail: "A durable consented core-loop aggregate is unavailable.",
      gap: "Local in-memory events cannot represent production users or retention.",
      sectionId: "core_loop",
    }),
  ],
  [
    "cost_aggregate_unavailable",
    Object.freeze({
      detail: "Cross-provider cost and approved budget data are unavailable.",
      gap: "RIT-127 and applicable Owner budget approvals remain incomplete.",
      sectionId: "cost",
    }),
  ],
  [
    "cost_guardrails_local_verified",
    Object.freeze({
      detail: "The strict cost guardrail policy and private report pass local verification.",
      gap: "D-106 preserves safe-off; exact budget amounts, durable provider aggregates, and external alert bindings remain unavailable.",
      sectionId: "cost",
    }),
  ],
  [
    "local_case_kernel_verified",
    Object.freeze({
      detail: "The metadata-only operational case kernel passes isolated local verification.",
      gap: "No production support SLA, external delivery, or standing queue monitor is active.",
      sectionId: "support",
    }),
  ],
  [
    "local_core_loop_verified",
    Object.freeze({
      detail: "The anonymous reflection loop passes bounded local verification.",
      gap: "No durable consented analytics source is active.",
      sectionId: "core_loop",
    }),
  ],
  [
    "local_queue_controls_verified",
    Object.freeze({
      detail:
        "Local queue, reconciliation, backup, and containment controls have bounded evidence.",
      gap: "No standing staging queue monitor or provider-level restore evidence is active.",
      sectionId: "queue",
    }),
  ],
  [
    "own_005_blocked",
    Object.freeze({
      detail:
        "D-106 approves OWN-005 Option A safe-off while the exact paid-launch envelope remains blocked.",
      gap: "RIT-127 cannot complete under Option A; Option B policy bytes and durable atomic enforcement/alert evidence remain required.",
      sectionId: "approvals",
    }),
  ],
  [
    "own_019_blocked",
    Object.freeze({
      detail: "OWN-019 remains blocked for exact production abuse thresholds and ingress controls.",
      gap: "RIT-130 cannot begin until the policy reference and cohort profile are approved.",
      sectionId: "approvals",
    }),
  ],
  [
    "release_approvals_current",
    Object.freeze({
      detail: "Required release approvals are current in their named source records.",
      gap: "This report still cannot authorize deployment, DNS, provider activation, or launch.",
      sectionId: "approvals",
    }),
  ],
  [
    "revenue_aggregate_unavailable",
    Object.freeze({
      detail: "A production revenue, refund, and dispute aggregate is unavailable.",
      gap: "Single-order administration and Test Mode evidence are not a revenue dashboard.",
      sectionId: "revenue",
    }),
  ],
  [
    "standing_staging_unavailable",
    Object.freeze({
      detail: "A protected standing staging environment is unavailable.",
      gap: "Local health evidence cannot complete Gate H.",
      sectionId: "health",
    }),
  ],
  [
    "support_queue_aggregate_unavailable",
    Object.freeze({
      detail:
        "A current aggregate of support, privacy, safety, and content-report cases is unavailable.",
      gap: "The metadata kernel exists, but no standing operator dashboard or monitor is active.",
      sectionId: "support",
    }),
  ],
]);

const projectedReports = new WeakSet<object>();
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const approvalReferencePattern = /^(?:D|OWN)-\d{3}$/u;
const taskReferencePattern = /^RIT-\d{3}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const evidencePathPattern = /^(?:apps|docs|packages|records|scripts|tests)\/[A-Za-z0-9._/-]+$/u;

const invalid = (): never => {
  throw new OwnerOperationsContractError();
};

const ownDataRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  const snapshot = snapshotOwnEnumerableData(value);
  if (snapshot === null) return invalid();
  return Object.freeze(Object.fromEntries(snapshot));
};

const exact = (value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> => {
  const record = ownDataRecord(value);
  const actual = Object.keys(record);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
    return invalid();
  }
  return record;
};

const parseInstant = (value: unknown): string => {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) return invalid();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return invalid();
  }
  return value;
};

const parseNullableInstant = (value: unknown): string | null =>
  value === null ? null : parseInstant(value);

const parseApprovalReference = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || !approvalReferencePattern.test(value)) return invalid();
  return value;
};

const parseEvidencePath = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || value.includes("..") || !evidencePathPattern.test(value)) {
    return invalid();
  }
  return value;
};

const parseSourceKind = (value: unknown): OwnerOperationsSourceKind => {
  if (
    value !== "durable_operational_aggregate" &&
    value !== "local_verification" &&
    value !== "owner_approved_record" &&
    value !== "synthetic_fixture" &&
    value !== "unavailable"
  ) {
    return invalid();
  }
  return value;
};

const parseState = (value: unknown): OwnerOperationsState => {
  if (
    value !== "attention" &&
    value !== "blocked" &&
    value !== "nominal" &&
    value !== "not_applicable" &&
    value !== "unknown"
  ) {
    return invalid();
  }
  return value;
};

const parseDetailCode = (value: unknown): OwnerOperationsDetailCode => {
  if (typeof value !== "string" || !detailPolicies.has(value as OwnerOperationsDetailCode)) {
    return invalid();
  }
  return value as OwnerOperationsDetailCode;
};

const parseSource = (value: unknown, capturedAt: string): OwnerOperationsSource => {
  const source = exact(value, [
    "approvalReference",
    "evidencePath",
    "kind",
    "observedThrough",
    "windowEnd",
    "windowStart",
  ]);
  const parsed = Object.freeze({
    approvalReference: parseApprovalReference(source.approvalReference),
    evidencePath: parseEvidencePath(source.evidencePath),
    kind: parseSourceKind(source.kind),
    observedThrough: parseNullableInstant(source.observedThrough),
    windowEnd: parseNullableInstant(source.windowEnd),
    windowStart: parseNullableInstant(source.windowStart),
  });
  if (parsed.kind === "unavailable") {
    if (
      parsed.approvalReference !== null ||
      parsed.evidencePath !== null ||
      parsed.observedThrough !== null ||
      parsed.windowEnd !== null ||
      parsed.windowStart !== null
    ) {
      return invalid();
    }
    return parsed;
  }
  if (parsed.observedThrough === null || parsed.evidencePath === null) return invalid();
  if (Date.parse(parsed.observedThrough) > Date.parse(capturedAt)) return invalid();
  if (
    (parsed.kind === "durable_operational_aggregate" ||
      parsed.kind === "owner_approved_record" ||
      parsed.kind === "local_verification") &&
    parsed.approvalReference === null
  ) {
    return invalid();
  }
  if (parsed.kind === "synthetic_fixture" && parsed.approvalReference !== null) return invalid();
  if ((parsed.windowStart === null) !== (parsed.windowEnd === null)) return invalid();
  if (parsed.windowStart !== null && parsed.windowEnd !== null) {
    if (
      Date.parse(parsed.windowStart) >= Date.parse(parsed.windowEnd) ||
      Date.parse(parsed.windowEnd) > Date.parse(parsed.observedThrough)
    ) {
      return invalid();
    }
  }
  if (parsed.kind === "durable_operational_aggregate" && parsed.windowStart === null) {
    return invalid();
  }
  return parsed;
};

const parseSection = (
  value: unknown,
  expectedId: OwnerOperationsSectionId,
  capturedAt: string,
): OwnerOperationsSectionSnapshot => {
  const section = exact(value, ["detailCode", "id", "source", "state"]);
  if (section.id !== expectedId) return invalid();
  const detailCode = parseDetailCode(section.detailCode);
  if (detailPolicies.get(detailCode)?.sectionId !== expectedId) return invalid();
  const source = parseSource(section.source, capturedAt);
  const state = parseState(section.state);
  if (
    (source.kind === "unavailable" || source.kind === "synthetic_fixture") &&
    state !== "unknown"
  ) {
    return invalid();
  }
  if (state === "not_applicable" && source.kind !== "owner_approved_record") return invalid();
  return Object.freeze({ detailCode, id: expectedId, source, state });
};

const parseRelease = (value: unknown): OwnerOperationsReleaseSnapshot => {
  const release = exact(value, [
    "candidate",
    "gateH",
    "independentSecurityReview",
    "nextApproval",
    "nextTasks",
    "standingStaging",
  ]);
  if (release.candidate !== "protected_english_anonymous_free_beta") return invalid();
  if (release.gateH !== "complete" && release.gateH !== "incomplete") return invalid();
  if (
    release.independentSecurityReview !== "passed_no_open_critical_high" &&
    release.independentSecurityReview !== "pending"
  ) {
    return invalid();
  }
  const nextApproval = parseApprovalReference(release.nextApproval);
  if (nextApproval !== null && !nextApproval.startsWith("OWN-")) return invalid();
  if (
    !Array.isArray(release.nextTasks) ||
    release.nextTasks.length === 0 ||
    release.nextTasks.length > 10
  ) {
    return invalid();
  }
  const nextTasks = release.nextTasks.map((task) => {
    if (typeof task !== "string" || !taskReferencePattern.test(task)) return invalid();
    return task;
  });
  if (new Set(nextTasks).size !== nextTasks.length) return invalid();
  if (
    release.standingStaging !== "protected_available" &&
    release.standingStaging !== "unavailable"
  ) {
    return invalid();
  }
  if (
    release.gateH === "complete" &&
    (release.standingStaging !== "protected_available" ||
      release.independentSecurityReview !== "passed_no_open_critical_high")
  ) {
    return invalid();
  }
  return Object.freeze({
    candidate: release.candidate,
    gateH: release.gateH,
    independentSecurityReview: release.independentSecurityReview,
    nextApproval,
    nextTasks: Object.freeze(nextTasks),
    standingStaging: release.standingStaging,
  });
};

export const parseOwnerOperationsSnapshot = (value: unknown): OwnerOperationsSnapshot => {
  const snapshot = exact(value, [
    "capturedAt",
    "environment",
    "release",
    "schemaVersion",
    "sections",
  ]);
  if (snapshot.schemaVersion !== ownerOperationsSnapshotSchemaVersion) return invalid();
  if (
    snapshot.environment !== "ci" &&
    snapshot.environment !== "local" &&
    snapshot.environment !== "production" &&
    snapshot.environment !== "protected_staging"
  ) {
    return invalid();
  }
  const capturedAt = parseInstant(snapshot.capturedAt);
  const sectionValues = snapshot.sections;
  if (!Array.isArray(sectionValues) || sectionValues.length !== ownerOperationsSectionIds.length) {
    return invalid();
  }
  const [health, revenue, coreLoop, ai, queue, support, cost, approvals] = sectionValues;
  const sections = [
    parseSection(health, "health", capturedAt),
    parseSection(revenue, "revenue", capturedAt),
    parseSection(coreLoop, "core_loop", capturedAt),
    parseSection(ai, "ai", capturedAt),
    parseSection(queue, "queue", capturedAt),
    parseSection(support, "support", capturedAt),
    parseSection(cost, "cost", capturedAt),
    parseSection(approvals, "approvals", capturedAt),
  ];
  return Object.freeze({
    capturedAt,
    environment: snapshot.environment,
    release: parseRelease(snapshot.release),
    schemaVersion: ownerOperationsSnapshotSchemaVersion,
    sections: Object.freeze(sections),
  });
};

const freshnessFor = (
  source: OwnerOperationsSource,
  asOf: string,
  maximumAgeHours: number,
): OwnerOperationsFreshness => {
  if (source.kind === "unavailable" || source.observedThrough === null) return "unavailable";
  const ageMilliseconds = Date.parse(asOf) - Date.parse(source.observedThrough);
  return ageMilliseconds < 0 || ageMilliseconds > maximumAgeHours * 60 * 60 * 1_000
    ? "stale"
    : "current";
};

const projectSection = (
  section: OwnerOperationsSectionSnapshot,
  environment: OwnerOperationsEnvironment,
  asOf: string,
): OwnerOperationsSection => {
  const sectionPolicy = sectionPolicies.get(section.id) ?? invalid();
  const detailPolicy = detailPolicies.get(section.detailCode) ?? invalid();
  const freshness = freshnessFor(section.source, asOf, sectionPolicy.maximumAgeHours);
  const dataQuality =
    section.source.kind === "unavailable"
      ? "unavailable"
      : section.source.kind === "synthetic_fixture"
        ? "synthetic"
        : freshness === "stale"
          ? "stale"
          : "verified";
  const state = dataQuality === "verified" ? section.state : "unknown";
  return Object.freeze({
    dataQuality,
    detail: detailPolicy.detail,
    detailCode: section.detailCode,
    id: section.id,
    knownGaps: Object.freeze([detailPolicy.gap]),
    runbookPath: sectionPolicy.runbookPath,
    source: Object.freeze({
      ...section.source,
      environment,
      freshness,
      maximumAgeHours: sectionPolicy.maximumAgeHours,
    }),
    state,
    title: sectionPolicy.title,
  });
};

export const projectOwnerOperationsReport = (
  value: unknown,
  context: Readonly<{ asOf: string; inputDigest: string }>,
): OwnerOperationsReport => {
  const snapshot = parseOwnerOperationsSnapshot(value);
  const generatedAt = parseInstant(context.asOf);
  if (Date.parse(snapshot.capturedAt) > Date.parse(generatedAt)) return invalid();
  if (!digestPattern.test(context.inputDigest)) return invalid();
  const sections = snapshot.sections.map((section) =>
    projectSection(section, snapshot.environment, generatedAt),
  );
  const evidenceReady =
    snapshot.release.gateH === "complete" &&
    snapshot.release.independentSecurityReview === "passed_no_open_critical_high" &&
    snapshot.release.nextApproval === null &&
    snapshot.release.standingStaging === "protected_available" &&
    sections.every(({ state }) => state === "nominal" || state === "not_applicable");
  const report = Object.freeze({
    authorizationStatus: "owner_deployment_approval_required" as const,
    caveats: Object.freeze([
      "Unavailable, stale, or synthetic sources are shown as unknown and never as zero or healthy.",
      "Local verification and Test Mode evidence do not establish production state.",
      "This read-only report cannot deploy, change DNS, activate providers, mutate data, or approve launch.",
    ]),
    decisionStatus: evidenceReady ? ("evidence_ready" as const) : ("blocked" as const),
    generatedAt,
    inputDigest: context.inputDigest,
    policyVersion: ownerOperationsPolicyVersion,
    release: snapshot.release,
    schemaVersion: ownerOperationsReportSchemaVersion,
    sections: Object.freeze(sections),
  });
  projectedReports.add(report);
  return report;
};

const display = (value: string | null): string => value ?? "unavailable";

export const renderOwnerOperationsMarkdown = (report: OwnerOperationsReport): string => {
  if (!projectedReports.has(report)) return invalid();
  const lines = [
    "# RITUVIA Owner Operations Dashboard",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Decision status: ${report.decisionStatus}`,
    `- Deployment authorization: ${report.authorizationStatus}`,
    `- Input digest: ${report.inputDigest}`,
    "",
    "## Release gates",
    "",
    `- Candidate: ${report.release.candidate}`,
    `- Next OWN approval: ${report.release.nextApproval ?? "none_pending"}`,
    `- Standing staging: ${report.release.standingStaging}`,
    `- Gate H: ${report.release.gateH}`,
    `- Independent security review: ${report.release.independentSecurityReview}`,
    `- Next task sequence: ${report.release.nextTasks.join(" -> ")}`,
    "",
    "## Daily operations",
    "",
  ];
  for (const section of report.sections) {
    const window =
      section.source.windowStart === null || section.source.windowEnd === null
        ? "unavailable"
        : `${section.source.windowStart} to ${section.source.windowEnd}`;
    lines.push(
      `### ${section.title}`,
      "",
      `- Status: ${section.state}`,
      `- Detail: ${section.detail}`,
      `- Source: ${section.source.kind}`,
      `- Environment: ${section.source.environment}`,
      `- Freshness: ${section.source.freshness}`,
      `- Data quality: ${section.dataQuality}`,
      `- Observed through: ${display(section.source.observedThrough)}`,
      `- Maximum age: ${section.source.maximumAgeHours} hour${section.source.maximumAgeHours === 1 ? "" : "s"}`,
      `- Window: ${window}`,
      `- Approval: ${display(section.source.approvalReference)}`,
      `- Evidence: ${display(section.source.evidencePath)}`,
      `- Runbook: ${section.runbookPath}`,
      `- Known gap: ${section.knownGaps.join(" ")}`,
      "",
    );
  }
  lines.push("## Caveats", "", ...report.caveats.map((caveat) => `- ${caveat}`), "");
  return `${lines.join("\n")}\n`;
};
