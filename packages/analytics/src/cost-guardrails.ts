import { snapshotOwnEnumerableData } from "@rituvia/observability";

export const costGuardrailSnapshotSchemaVersion = "cost-guardrail-snapshot.v1" as const;
export const costGuardrailReportSchemaVersion = "cost-guardrail-report.v1" as const;
export const costGuardrailPolicyVersion = "cost-guardrail.v1" as const;

export const costGuardrailProviderIds = Object.freeze([
  "ai_fallback",
  "ai_primary",
  "backup_storage",
  "database",
  "fraud_tooling",
  "marketing_channel",
  "monitoring_security",
  "notification_delivery",
  "object_storage",
  "payment_processor",
  "web_compute",
  "worker_compute",
] as const);

export const costGuardrailFeatureIds = Object.freeze([
  "backup_restore",
  "classification",
  "content_generation",
  "fraud_screening",
  "interpretation_generation",
  "offline_evals",
  "paid_acquisition",
  "payment_processing",
  "privacy_export",
  "refund_processing",
  "revisit_notification",
  "security_monitoring",
  "share_export",
  "transactional_email",
] as const);

export type CostGuardrailEnvironment = "ci" | "local" | "production" | "protected_staging";
export type CostGuardrailProviderId = (typeof costGuardrailProviderIds)[number];
export type CostGuardrailFeatureId = (typeof costGuardrailFeatureIds)[number];
export type CostGuardrailSourceKind =
  "durable_cost_aggregate" | "synthetic_fixture" | "unavailable";
export type CostBudgetPolicyKind = "proposed_policy" | "unavailable";
export type CostProtectionClass = "essential_no_automatic_degradation" | "non_essential";
export type CostGuardrailAction =
  | "alert_and_annotate"
  | "disable_non_essential_paid_provider"
  | "none"
  | "pause_non_essential_content_generation"
  | "reduce_non_critical_background_concurrency";
export type CostGuardrailEvaluationStatus = "blocked" | "review_required" | "within_budget";

export type CostBudgetLine = Readonly<{
  budgetMicros: number;
  featureId: CostGuardrailFeatureId;
  limitAction: Exclude<CostGuardrailAction, "none">;
  protectionClass: CostProtectionClass;
  providerId: CostGuardrailProviderId;
  warningAction: Exclude<CostGuardrailAction, "none">;
  warningThresholdBasisPoints: number;
}>;

export type CostBudgetPolicy = Readonly<{
  approvalReference: string | null;
  kind: CostBudgetPolicyKind;
  lines: readonly CostBudgetLine[];
  policyReference: string | null;
  totalBudgetMicros: number | null;
}>;

export type CostObservation = Readonly<{
  featureId: CostGuardrailFeatureId;
  providerId: CostGuardrailProviderId;
  reportedCostMicros: number;
  reportedUsageCount: number;
  totalUsageCount: number;
}>;

export type CostGuardrailSnapshot = Readonly<{
  capturedAt: string;
  currencyCode: string;
  environment: CostGuardrailEnvironment;
  observations: readonly CostObservation[];
  policy: CostBudgetPolicy;
  schemaVersion: typeof costGuardrailSnapshotSchemaVersion;
  source: Readonly<{
    kind: CostGuardrailSourceKind;
    observedThrough: string | null;
  }>;
  windowEnd: string;
  windowStart: string;
}>;

export type CostAllocationStatus =
  | "budget_exhausted"
  | "cost_reporting_incomplete"
  | "source_unavailable"
  | "unbudgeted"
  | "warning"
  | "within_budget";

export type CostAllocation = Readonly<{
  actionAuthority: "simulation_only" | "unavailable";
  budgetMicros: number | null;
  costReportingCoverage: number | null;
  featureId: CostGuardrailFeatureId;
  limitAction: Exclude<CostGuardrailAction, "none"> | null;
  protectionClass: CostProtectionClass | null;
  providerId: CostGuardrailProviderId;
  recommendedAction: CostGuardrailAction;
  remainingBudgetMicros: number | null;
  reportedCostMicros: number | null;
  spendAuthorization: "alert_only" | "allow" | "deny";
  status: CostAllocationStatus;
  utilization: number | null;
  warningAction: Exclude<CostGuardrailAction, "none"> | null;
  warningThresholdMicros: number | null;
}>;

export type CostGuardrailReport = Readonly<{
  allocations: readonly CostAllocation[];
  automaticActionsExecuted: false;
  caveats: readonly string[];
  currencyCode: string;
  decisionStatus: "blocked";
  environment: CostGuardrailEnvironment;
  evaluationStatus: CostGuardrailEvaluationStatus;
  generatedAt: string;
  inputDigest: string;
  policy: Readonly<{
    approvalReference: string | null;
    kind: CostBudgetPolicyKind;
    policyReference: string | null;
    totalBudgetMicros: number | null;
  }>;
  policyVersion: typeof costGuardrailPolicyVersion;
  schemaVersion: typeof costGuardrailReportSchemaVersion;
  source: Readonly<{
    freshness: "current" | "stale" | "unavailable";
    kind: CostGuardrailSourceKind;
    maximumAgeHours: 30;
    observedThrough: string | null;
  }>;
  windowEnd: string;
  windowStart: string;
}>;

export class CostGuardrailContractError extends Error {
  constructor() {
    super("The cost guardrail input is invalid.");
    this.name = "CostGuardrailContractError";
  }
}

const invalid = (): never => {
  throw new CostGuardrailContractError();
};

const projectedReports = new WeakSet<object>();
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const policyReferencePattern = /^cost-budget\.[a-z0-9.-]+\.v[1-9][0-9]*$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const maximumMicros = 1_000_000_000_000_000;
const maximumCount = 1_000_000_000;
const currentAgeMilliseconds = 30 * 3_600_000;

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

const parseProviderId = (value: unknown): CostGuardrailProviderId =>
  typeof value === "string" && (costGuardrailProviderIds as readonly string[]).includes(value)
    ? (value as CostGuardrailProviderId)
    : invalid();

const parseFeatureId = (value: unknown): CostGuardrailFeatureId =>
  typeof value === "string" && (costGuardrailFeatureIds as readonly string[]).includes(value)
    ? (value as CostGuardrailFeatureId)
    : invalid();

const parseMicros = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximumMicros
  ) {
    return invalid();
  }
  return value;
};

const parseCount = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximumCount
  ) {
    return invalid();
  }
  return value;
};

const parseAction = (value: unknown): Exclude<CostGuardrailAction, "none"> => {
  if (
    value !== "alert_and_annotate" &&
    value !== "disable_non_essential_paid_provider" &&
    value !== "pause_non_essential_content_generation" &&
    value !== "reduce_non_critical_background_concurrency"
  ) {
    return invalid();
  }
  return value;
};

const parseBudgetLine = (value: unknown): CostBudgetLine => {
  const line = exact(value, [
    "budgetMicros",
    "featureId",
    "limitAction",
    "protectionClass",
    "providerId",
    "warningAction",
    "warningThresholdBasisPoints",
  ]);
  const protectionClass = line.protectionClass;
  if (
    protectionClass !== "essential_no_automatic_degradation" &&
    protectionClass !== "non_essential"
  ) {
    return invalid();
  }
  const warningAction = parseAction(line.warningAction);
  const limitAction = parseAction(line.limitAction);
  if (
    protectionClass === "essential_no_automatic_degradation" &&
    (warningAction !== "alert_and_annotate" || limitAction !== "alert_and_annotate")
  ) {
    return invalid();
  }
  const warningThresholdBasisPoints = parseCount(line.warningThresholdBasisPoints);
  if (warningThresholdBasisPoints < 1 || warningThresholdBasisPoints >= 10_000) return invalid();
  return Object.freeze({
    budgetMicros: parseMicros(line.budgetMicros),
    featureId: parseFeatureId(line.featureId),
    limitAction,
    protectionClass,
    providerId: parseProviderId(line.providerId),
    warningAction,
    warningThresholdBasisPoints,
  });
};

const parsePolicy = (value: unknown): CostBudgetPolicy => {
  const policy = exact(value, [
    "approvalReference",
    "kind",
    "lines",
    "policyReference",
    "totalBudgetMicros",
  ]);
  if (!Array.isArray(policy.lines) || policy.lines.length > 100) return invalid();
  if (policy.kind === "unavailable") {
    if (
      policy.approvalReference !== null ||
      policy.policyReference !== null ||
      policy.totalBudgetMicros !== null ||
      policy.lines.length !== 0
    ) {
      return invalid();
    }
    return Object.freeze({
      approvalReference: null,
      kind: "unavailable",
      lines: Object.freeze([]),
      policyReference: null,
      totalBudgetMicros: null,
    });
  }
  if (
    policy.kind !== "proposed_policy" ||
    policy.approvalReference !== null ||
    typeof policy.policyReference !== "string" ||
    !policyReferencePattern.test(policy.policyReference) ||
    policy.lines.length === 0
  ) {
    return invalid();
  }
  const lines = policy.lines.map(parseBudgetLine);
  const keys = new Set(lines.map(({ featureId, providerId }) => `${providerId}\u0000${featureId}`));
  if (keys.size !== lines.length) return invalid();
  const totalBudgetMicros = parseMicros(policy.totalBudgetMicros);
  const allocated = lines.reduce((total, line) => {
    const next = total + line.budgetMicros;
    return Number.isSafeInteger(next) && next <= maximumMicros ? next : invalid();
  }, 0);
  if (allocated !== totalBudgetMicros) return invalid();
  return Object.freeze({
    approvalReference: null,
    kind: "proposed_policy",
    lines: Object.freeze(lines),
    policyReference: policy.policyReference,
    totalBudgetMicros,
  });
};

const parseObservation = (value: unknown): CostObservation => {
  const observation = exact(value, [
    "featureId",
    "providerId",
    "reportedCostMicros",
    "reportedUsageCount",
    "totalUsageCount",
  ]);
  const reportedUsageCount = parseCount(observation.reportedUsageCount);
  const totalUsageCount = parseCount(observation.totalUsageCount);
  if (reportedUsageCount > totalUsageCount) return invalid();
  return Object.freeze({
    featureId: parseFeatureId(observation.featureId),
    providerId: parseProviderId(observation.providerId),
    reportedCostMicros: parseMicros(observation.reportedCostMicros),
    reportedUsageCount,
    totalUsageCount,
  });
};

export const parseCostGuardrailSnapshot = (value: unknown): CostGuardrailSnapshot => {
  const snapshot = exact(value, [
    "capturedAt",
    "currencyCode",
    "environment",
    "observations",
    "policy",
    "schemaVersion",
    "source",
    "windowEnd",
    "windowStart",
  ]);
  if (snapshot.schemaVersion !== costGuardrailSnapshotSchemaVersion) return invalid();
  if (
    snapshot.environment !== "ci" &&
    snapshot.environment !== "local" &&
    snapshot.environment !== "production" &&
    snapshot.environment !== "protected_staging"
  ) {
    return invalid();
  }
  if (typeof snapshot.currencyCode !== "string" || !currencyPattern.test(snapshot.currencyCode)) {
    return invalid();
  }
  if (!Array.isArray(snapshot.observations) || snapshot.observations.length > 100) return invalid();
  const capturedAt = parseInstant(snapshot.capturedAt);
  const windowStart = parseInstant(snapshot.windowStart);
  const windowEnd = parseInstant(snapshot.windowEnd);
  if (
    Date.parse(windowEnd) - Date.parse(windowStart) !== 86_400_000 ||
    Date.parse(capturedAt) < Date.parse(windowEnd) ||
    Date.parse(capturedAt) - Date.parse(windowEnd) > 21_600_000
  ) {
    return invalid();
  }
  const source = exact(snapshot.source, ["kind", "observedThrough"]);
  if (
    source.kind !== "durable_cost_aggregate" &&
    source.kind !== "synthetic_fixture" &&
    source.kind !== "unavailable"
  ) {
    return invalid();
  }
  const observations = snapshot.observations.map(parseObservation);
  const keys = new Set(
    observations.map(({ featureId, providerId }) => `${providerId}\u0000${featureId}`),
  );
  if (keys.size !== observations.length) return invalid();
  let observedThrough: string | null = null;
  if (source.kind === "unavailable") {
    if (source.observedThrough !== null || observations.length !== 0) return invalid();
  } else {
    observedThrough = parseInstant(source.observedThrough);
    if (
      Date.parse(observedThrough) < Date.parse(windowEnd) ||
      Date.parse(observedThrough) > Date.parse(capturedAt)
    ) {
      return invalid();
    }
  }
  return Object.freeze({
    capturedAt,
    currencyCode: snapshot.currencyCode,
    environment: snapshot.environment,
    observations: Object.freeze(observations),
    policy: parsePolicy(snapshot.policy),
    schemaVersion: costGuardrailSnapshotSchemaVersion,
    source: Object.freeze({ kind: source.kind, observedThrough }),
    windowEnd,
    windowStart,
  });
};

const coverageFor = (observation: CostObservation): number =>
  observation.totalUsageCount === 0
    ? 1
    : observation.reportedUsageCount / observation.totalUsageCount;

const actionAuthorityFor = (snapshot: CostGuardrailSnapshot): CostAllocation["actionAuthority"] => {
  if (snapshot.policy.kind === "unavailable") return "unavailable";
  return "simulation_only";
};

const allocationFor = (
  snapshot: CostGuardrailSnapshot,
  line: CostBudgetLine | null,
  observation: CostObservation | null,
  sourceCurrent: boolean,
): CostAllocation => {
  const authority = actionAuthorityFor(snapshot);
  const warningThresholdMicros =
    line === null
      ? null
      : Number((BigInt(line.budgetMicros) * BigInt(line.warningThresholdBasisPoints)) / 10_000n);
  const coverage = observation === null ? null : coverageFor(observation);
  const fullyReported = coverage === 1;
  const spend = observation?.reportedCostMicros ?? null;
  let status: CostAllocationStatus;
  let recommendedAction: CostGuardrailAction = "none";
  if (!sourceCurrent || snapshot.source.kind !== "durable_cost_aggregate") {
    status = "source_unavailable";
  } else if (line === null) {
    status = "unbudgeted";
    recommendedAction = "alert_and_annotate";
  } else if (!fullyReported || spend === null) {
    status = "cost_reporting_incomplete";
    recommendedAction = "alert_and_annotate";
  } else if (spend >= line.budgetMicros) {
    status = "budget_exhausted";
    recommendedAction = line.limitAction;
  } else if (warningThresholdMicros !== null && spend >= warningThresholdMicros) {
    status = "warning";
    recommendedAction = line.warningAction;
  } else {
    status = "within_budget";
  }
  const protectionClass = line?.protectionClass ?? null;
  const spendAuthorization =
    protectionClass === "essential_no_automatic_degradation" ? "alert_only" : "deny";
  return Object.freeze({
    actionAuthority: authority,
    budgetMicros: line?.budgetMicros ?? null,
    costReportingCoverage: coverage,
    featureId: line?.featureId ?? observation?.featureId ?? invalid(),
    limitAction: line?.limitAction ?? null,
    protectionClass,
    providerId: line?.providerId ?? observation?.providerId ?? invalid(),
    recommendedAction,
    remainingBudgetMicros:
      fullyReported && line !== null && spend !== null
        ? Math.max(0, line.budgetMicros - spend)
        : null,
    reportedCostMicros: spend,
    spendAuthorization,
    status,
    utilization:
      fullyReported && line !== null && spend !== null && line.budgetMicros > 0
        ? spend / line.budgetMicros
        : null,
    warningAction: line?.warningAction ?? null,
    warningThresholdMicros,
  });
};

export const projectCostGuardrailReport = (
  value: unknown,
  context: Readonly<{ asOf: string; inputDigest: string }>,
): CostGuardrailReport => {
  const snapshot = parseCostGuardrailSnapshot(value);
  const generatedAt = parseInstant(context.asOf);
  if (
    Date.parse(snapshot.capturedAt) > Date.parse(generatedAt) ||
    !digestPattern.test(context.inputDigest)
  ) {
    return invalid();
  }
  const sourceCurrent =
    snapshot.source.observedThrough !== null &&
    Date.parse(generatedAt) - Date.parse(snapshot.source.observedThrough) <= currentAgeMilliseconds;
  const freshness =
    snapshot.source.kind === "unavailable" ? "unavailable" : sourceCurrent ? "current" : "stale";
  const observationByKey = new Map(
    snapshot.observations.map((observation) => [
      `${observation.providerId}\u0000${observation.featureId}`,
      observation,
    ]),
  );
  const allocations = snapshot.policy.lines.map((line) => {
    const key = `${line.providerId}\u0000${line.featureId}`;
    const observation = observationByKey.get(key) ?? null;
    observationByKey.delete(key);
    return allocationFor(snapshot, line, observation, sourceCurrent);
  });
  for (const observation of observationByKey.values()) {
    allocations.push(allocationFor(snapshot, null, observation, sourceCurrent));
  }
  const blocked =
    snapshot.policy.kind === "unavailable" ||
    snapshot.source.kind !== "durable_cost_aggregate" ||
    !sourceCurrent ||
    allocations.some(({ status }) =>
      ["cost_reporting_incomplete", "source_unavailable", "unbudgeted"].includes(status),
    );
  const evaluationStatus: CostGuardrailEvaluationStatus = blocked
    ? "blocked"
    : allocations.some(({ status }) => status !== "within_budget")
      ? "review_required"
      : "within_budget";
  const report = Object.freeze({
    allocations: Object.freeze(allocations),
    automaticActionsExecuted: false as const,
    caveats: Object.freeze([
      "Missing cost is never treated as zero or available budget.",
      "Essential safety, payment integrity, backups, privacy rights, and existing entitlements are alert-only.",
      "This report simulates proposed directives but does not approve spend, call providers, change runtime configuration, or execute degradation.",
    ]),
    currencyCode: snapshot.currencyCode,
    decisionStatus: "blocked" as const,
    environment: snapshot.environment,
    evaluationStatus,
    generatedAt,
    inputDigest: context.inputDigest,
    policy: Object.freeze({
      approvalReference: snapshot.policy.approvalReference,
      kind: snapshot.policy.kind,
      policyReference: snapshot.policy.policyReference,
      totalBudgetMicros: snapshot.policy.totalBudgetMicros,
    }),
    policyVersion: costGuardrailPolicyVersion,
    schemaVersion: costGuardrailReportSchemaVersion,
    source: Object.freeze({
      freshness,
      kind: snapshot.source.kind,
      maximumAgeHours: 30 as const,
      observedThrough: snapshot.source.observedThrough,
    }),
    windowEnd: snapshot.windowEnd,
    windowStart: snapshot.windowStart,
  });
  projectedReports.add(report);
  return report;
};

const display = (value: number | string | null): string =>
  value === null ? "unavailable" : `${value}`;

export const renderCostGuardrailMarkdown = (report: CostGuardrailReport): string => {
  if (!projectedReports.has(report)) return invalid();
  const lines = [
    "# RITUVIA private cost guardrail report",
    "",
    `- Decision status: ${report.decisionStatus}`,
    `- Evaluation status: ${report.evaluationStatus}`,
    `- Environment: ${report.environment}`,
    `- Window: ${report.windowStart} to ${report.windowEnd}`,
    `- Source: ${report.source.kind}`,
    `- Freshness: ${report.source.freshness}`,
    `- Policy: ${report.policy.policyReference ?? "unavailable"}`,
    `- Approval: ${report.policy.approvalReference ?? "unavailable"}`,
    `- Total budget micros (${report.currencyCode}): ${display(report.policy.totalBudgetMicros)}`,
    `- Automatic actions executed: ${report.automaticActionsExecuted}`,
    `- Input digest: ${report.inputDigest}`,
    "",
    "## Allocations",
  ];
  if (report.allocations.length === 0) lines.push("", "No approved allocation is available.");
  for (const allocation of report.allocations) {
    lines.push(
      "",
      `### ${allocation.providerId} / ${allocation.featureId}`,
      "",
      `- Status: ${allocation.status}`,
      `- Protection: ${allocation.protectionClass ?? "unavailable"}`,
      `- Budget micros: ${display(allocation.budgetMicros)}`,
      `- Reported cost micros: ${display(allocation.reportedCostMicros)}`,
      `- Cost reporting coverage: ${display(allocation.costReportingCoverage)}`,
      `- Remaining budget micros: ${display(allocation.remainingBudgetMicros)}`,
      `- Spend authorization: ${allocation.spendAuthorization}`,
      `- Warning action: ${allocation.warningAction ?? "unavailable"}`,
      `- Limit action: ${allocation.limitAction ?? "unavailable"}`,
      `- Recommended action: ${allocation.recommendedAction}`,
      `- Action authority: ${allocation.actionAuthority}`,
    );
  }
  lines.push("", "## Caveats", "", ...report.caveats.map((caveat) => `- ${caveat}`), "");
  return `${lines.join("\n")}\n`;
};
