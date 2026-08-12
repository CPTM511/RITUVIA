import { snapshotOwnEnumerableData } from "@rituvia/observability";

export const aiOperationsSnapshotSchemaVersion = "ai-operations-snapshot.v1" as const;
export const aiOperationsReportSchemaVersion = "ai-operations-report.v1" as const;
export const aiOperationsPolicyVersion = "ai-operations.v1" as const;

export type AiOperationsSourceKind =
  "durable_operational_aggregate" | "synthetic_fixture" | "unavailable";
export type AiOperationsFreshness = "current" | "stale" | "unavailable";
export type AiOperationsDecisionStatus = "blocked" | "ready";

export type AiOperationsAggregate = Readonly<{
  attemptCountTotal: number;
  contentVersions: readonly string[];
  costReportedCount: number;
  currencyCode: string | null;
  estimatedCostMicros: number;
  failedCount: number;
  fallbackCount: number;
  generationCount: number;
  inputTokens: number;
  latencyOverThirtySecondsCount: number;
  latencyTotalMs: number;
  locale: string;
  modality: "tarot";
  modelId: string;
  modelVersion: string;
  outputSchemaVersion: string;
  outputTokens: number;
  pendingVerificationCount: number;
  promptId: string;
  promptVersion: string;
  providerId: string;
  providerVersion: string;
  readingType: "one_card" | "three_card";
  retryCount: number;
  safeReplacementCount: number;
  safetyPolicyVersion: string;
  tokenReportedCount: number;
  totalTokens: number;
  verifiedCount: number;
}>;

export type AiOperationsSnapshot = Readonly<{
  capturedAt: string;
  groups: readonly AiOperationsAggregate[];
  schemaVersion: typeof aiOperationsSnapshotSchemaVersion;
  source: Readonly<{
    approvalReference: string | null;
    kind: AiOperationsSourceKind;
    observedThrough: string | null;
  }>;
  windowEnd: string;
  windowStart: string;
}>;

export type AiOperationsMetric = Readonly<{
  definition: string;
  denominator: number | null;
  id:
    | "average_latency_ms"
    | "average_reported_cost_micros"
    | "average_total_tokens"
    | "completion_rate"
    | "cost_reporting_coverage"
    | "estimated_cost_micros"
    | "failure_rate"
    | "fallback_rate"
    | "generation_count"
    | "latency_review_rate"
    | "retry_rate"
    | "safe_replacement_rate"
    | "token_reporting_coverage";
  knownGaps: readonly string[];
  numerator: number | null;
  unit: "count" | "micros" | "milliseconds" | "ratio" | "tokens";
  value: number | null;
}>;

export type AiOperationsAlert = Readonly<{
  action: string;
  evidence: string;
  kind:
    | "cost_reporting_incomplete"
    | "failure_rate_review"
    | "fallback_rate_review"
    | "latency_review"
    | "safe_replacement_review"
    | "source_refresh"
    | "token_reporting_incomplete";
  priority: "high" | "low" | "medium";
  requiresHumanReview: true;
}>;

export type AiOperationsGroupSummary = Readonly<{
  averageLatencyMs: number | null;
  averageReportedCostMicros: number | null;
  contentVersions: readonly string[];
  costReportingCoverage: number | null;
  currencyCode: string | null;
  failureRate: number | null;
  fallbackRate: number | null;
  generationCount: number | null;
  locale: string;
  modelId: string;
  modelVersion: string;
  outputSchemaVersion: string;
  promptId: string;
  promptVersion: string;
  providerId: string;
  providerVersion: string;
  readingType: "one_card" | "three_card";
  safeReplacementRate: number | null;
  safetyPolicyVersion: string;
}>;

export type AiOperationsReport = Readonly<{
  alerts: readonly AiOperationsAlert[];
  caveats: readonly string[];
  costBudgetStatus: "owner_budget_unavailable";
  decisionStatus: AiOperationsDecisionStatus;
  generatedAt: string;
  groupSummaries: readonly AiOperationsGroupSummary[];
  inputDigest: string;
  metrics: readonly AiOperationsMetric[];
  policyVersion: typeof aiOperationsPolicyVersion;
  schemaVersion: typeof aiOperationsReportSchemaVersion;
  source: Readonly<{
    approvalReference: string | null;
    freshness: AiOperationsFreshness;
    kind: AiOperationsSourceKind;
    maximumAgeHours: 30;
    observedThrough: string | null;
  }>;
  thresholds: Readonly<{
    costReportingCoverageMinimum: 0.95;
    failureRateReview: 0.02;
    fallbackRateReview: 0.1;
    latencyMilliseconds: 30_000;
    latencyReviewRate: 0.05;
    minimumDisplayCount: 20;
    safeReplacementRateReview: 0.05;
    tokenReportingCoverageMinimum: 0.95;
  }>;
  windowEnd: string;
  windowStart: string;
}>;

export class AiOperationsContractError extends Error {
  constructor() {
    super("The AI operations input is invalid.");
    this.name = "AiOperationsContractError";
  }
}

const invalid = (): never => {
  throw new AiOperationsContractError();
};

const projectedReports = new WeakSet<object>();
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/u;
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const approvalReferencePattern = /^(?:D|OWN)-\d{3}$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const maximumCount = 1_000_000_000;

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

const parseIdentifier = (value: unknown): string => {
  if (typeof value !== "string" || value.length > 120 || !identifierPattern.test(value)) {
    return invalid();
  }
  return value;
};

const parseVersion = (value: unknown): string => {
  if (typeof value !== "string" || !versionPattern.test(value)) return invalid();
  return value;
};

const parseVersions = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return invalid();
  const versions = value.map(parseVersion);
  if (new Set(versions).size !== versions.length) return invalid();
  let previous: string | undefined;
  for (const version of versions) {
    if (previous !== undefined && version <= previous) return invalid();
    previous = version;
  }
  return Object.freeze(versions);
};

const parseAggregate = (value: unknown): AiOperationsAggregate => {
  const group = exact(value, [
    "attemptCountTotal",
    "contentVersions",
    "costReportedCount",
    "currencyCode",
    "estimatedCostMicros",
    "failedCount",
    "fallbackCount",
    "generationCount",
    "inputTokens",
    "latencyOverThirtySecondsCount",
    "latencyTotalMs",
    "locale",
    "modality",
    "modelId",
    "modelVersion",
    "outputSchemaVersion",
    "outputTokens",
    "pendingVerificationCount",
    "promptId",
    "promptVersion",
    "providerId",
    "providerVersion",
    "readingType",
    "retryCount",
    "safeReplacementCount",
    "safetyPolicyVersion",
    "tokenReportedCount",
    "totalTokens",
    "verifiedCount",
  ]);
  const generationCount = parseCount(group.generationCount);
  const failedCount = parseCount(group.failedCount);
  const fallbackCount = parseCount(group.fallbackCount);
  const pendingVerificationCount = parseCount(group.pendingVerificationCount);
  const verifiedCount = parseCount(group.verifiedCount);
  const safeReplacementCount = parseCount(group.safeReplacementCount);
  const costReportedCount = parseCount(group.costReportedCount);
  const tokenReportedCount = parseCount(group.tokenReportedCount);
  const retryCount = parseCount(group.retryCount);
  const attemptCountTotal = parseCount(group.attemptCountTotal);
  const latencyOverThirtySecondsCount = parseCount(group.latencyOverThirtySecondsCount);
  const latencyTotalMs = parseCount(group.latencyTotalMs);
  const estimatedCostMicros = parseCount(group.estimatedCostMicros);
  const inputTokens = parseCount(group.inputTokens);
  const outputTokens = parseCount(group.outputTokens);
  const totalTokens = parseCount(group.totalTokens);
  if (
    generationCount === 0 ||
    failedCount + fallbackCount + pendingVerificationCount !== generationCount ||
    verifiedCount + safeReplacementCount !== pendingVerificationCount ||
    costReportedCount > generationCount ||
    tokenReportedCount > generationCount ||
    retryCount > generationCount ||
    attemptCountTotal > generationCount * 2 ||
    attemptCountTotal < retryCount * 2 ||
    latencyOverThirtySecondsCount > generationCount ||
    latencyTotalMs > generationCount * 240_000 ||
    totalTokens !== inputTokens + outputTokens ||
    (costReportedCount === 0) !== (estimatedCostMicros === 0) ||
    (tokenReportedCount === 0) !== (totalTokens === 0)
  ) {
    return invalid();
  }
  const currencyCode =
    group.currencyCode === null
      ? null
      : typeof group.currencyCode === "string" && currencyPattern.test(group.currencyCode)
        ? group.currencyCode
        : invalid();
  if (
    (costReportedCount === 0) !== (currencyCode === null) ||
    typeof group.locale !== "string" ||
    !localePattern.test(group.locale) ||
    group.modality !== "tarot" ||
    (group.readingType !== "one_card" && group.readingType !== "three_card")
  ) {
    return invalid();
  }
  return Object.freeze({
    attemptCountTotal,
    contentVersions: parseVersions(group.contentVersions),
    costReportedCount,
    currencyCode,
    estimatedCostMicros,
    failedCount,
    fallbackCount,
    generationCount,
    inputTokens,
    latencyOverThirtySecondsCount,
    latencyTotalMs,
    locale: group.locale,
    modality: "tarot",
    modelId: parseIdentifier(group.modelId),
    modelVersion: parseVersion(group.modelVersion),
    outputSchemaVersion: parseVersion(group.outputSchemaVersion),
    outputTokens,
    pendingVerificationCount,
    promptId: parseIdentifier(group.promptId),
    promptVersion: parseVersion(group.promptVersion),
    providerId: parseIdentifier(group.providerId),
    providerVersion: parseVersion(group.providerVersion),
    readingType: group.readingType,
    retryCount,
    safeReplacementCount,
    safetyPolicyVersion: parseVersion(group.safetyPolicyVersion),
    tokenReportedCount,
    totalTokens,
    verifiedCount,
  });
};

export const parseAiOperationsSnapshot = (value: unknown): AiOperationsSnapshot => {
  const snapshot = exact(value, [
    "capturedAt",
    "groups",
    "schemaVersion",
    "source",
    "windowEnd",
    "windowStart",
  ]);
  if (
    snapshot.schemaVersion !== aiOperationsSnapshotSchemaVersion ||
    !Array.isArray(snapshot.groups) ||
    snapshot.groups.length > 500
  ) {
    return invalid();
  }
  const capturedAt = parseInstant(snapshot.capturedAt);
  const windowStart = parseInstant(snapshot.windowStart);
  const windowEnd = parseInstant(snapshot.windowEnd);
  if (
    Date.parse(windowStart) >= Date.parse(windowEnd) ||
    Date.parse(windowEnd) > Date.parse(capturedAt) ||
    Date.parse(windowEnd) - Date.parse(windowStart) !== 86_400_000 ||
    Date.parse(capturedAt) - Date.parse(windowEnd) > 6 * 3_600_000
  ) {
    return invalid();
  }
  const sourceInput = exact(snapshot.source, ["approvalReference", "kind", "observedThrough"]);
  if (
    sourceInput.kind !== "durable_operational_aggregate" &&
    sourceInput.kind !== "synthetic_fixture" &&
    sourceInput.kind !== "unavailable"
  ) {
    return invalid();
  }
  const approvalReference =
    sourceInput.approvalReference === null
      ? null
      : typeof sourceInput.approvalReference === "string" &&
          approvalReferencePattern.test(sourceInput.approvalReference)
        ? sourceInput.approvalReference
        : invalid();
  if ((sourceInput.kind === "durable_operational_aggregate") !== (approvalReference !== null)) {
    return invalid();
  }
  const observedThrough =
    sourceInput.kind === "unavailable"
      ? sourceInput.observedThrough === null
        ? null
        : invalid()
      : parseInstant(sourceInput.observedThrough);
  if (
    observedThrough !== null &&
    (Date.parse(observedThrough) < Date.parse(windowEnd) ||
      Date.parse(observedThrough) > Date.parse(capturedAt))
  ) {
    return invalid();
  }
  const groups = snapshot.groups.map(parseAggregate);
  if (sourceInput.kind === "unavailable" && groups.length !== 0) return invalid();
  const keys = groups.map(
    (group) =>
      `${group.locale}\0${group.readingType}\0${group.providerId}\0${group.providerVersion}\0${group.modelId}\0${group.modelVersion}\0${group.promptId}\0${group.promptVersion}\0${group.outputSchemaVersion}\0${group.safetyPolicyVersion}\0${group.contentVersions.join(",")}`,
  );
  if (new Set(keys).size !== keys.length) return invalid();
  return Object.freeze({
    capturedAt,
    groups: Object.freeze(groups),
    schemaVersion: aiOperationsSnapshotSchemaVersion,
    source: Object.freeze({
      approvalReference,
      kind: sourceInput.kind,
      observedThrough,
    }),
    windowEnd,
    windowStart,
  });
};

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

const safeAdd = (left: number, right: number): number => {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value > maximumCount) return invalid();
  return value;
};

const thresholds = Object.freeze({
  costReportingCoverageMinimum: 0.95 as const,
  failureRateReview: 0.02 as const,
  fallbackRateReview: 0.1 as const,
  latencyMilliseconds: 30_000 as const,
  latencyReviewRate: 0.05 as const,
  minimumDisplayCount: 20 as const,
  safeReplacementRateReview: 0.05 as const,
  tokenReportingCoverageMinimum: 0.95 as const,
});

const freshnessFor = (
  observedThrough: string | null,
  asOfMilliseconds: number,
): AiOperationsFreshness => {
  if (observedThrough === null) return "unavailable";
  return asOfMilliseconds - Date.parse(observedThrough) <= 30 * 3_600_000 ? "current" : "stale";
};

export const projectAiOperationsReport = (
  snapshotInput: unknown,
  context: Readonly<{ asOf: string; inputDigest: string }>,
): AiOperationsReport => {
  const snapshot = parseAiOperationsSnapshot(snapshotInput);
  const asOf = parseInstant(context.asOf);
  if (
    Date.parse(snapshot.capturedAt) > Date.parse(asOf) ||
    !digestPattern.test(context.inputDigest)
  ) {
    return invalid();
  }
  const freshness = freshnessFor(snapshot.source.observedThrough, Date.parse(asOf));
  const usable =
    freshness === "current" && snapshot.source.kind === "durable_operational_aggregate";
  const total = snapshot.groups.reduce(
    (current, group) => ({
      costReportedCount: safeAdd(current.costReportedCount, group.costReportedCount),
      estimatedCostMicros: safeAdd(current.estimatedCostMicros, group.estimatedCostMicros),
      failedCount: safeAdd(current.failedCount, group.failedCount),
      fallbackCount: safeAdd(current.fallbackCount, group.fallbackCount),
      generationCount: safeAdd(current.generationCount, group.generationCount),
      latencyOverThirtySecondsCount: safeAdd(
        current.latencyOverThirtySecondsCount,
        group.latencyOverThirtySecondsCount,
      ),
      latencyTotalMs: safeAdd(current.latencyTotalMs, group.latencyTotalMs),
      retryCount: safeAdd(current.retryCount, group.retryCount),
      safeReplacementCount: safeAdd(current.safeReplacementCount, group.safeReplacementCount),
      tokenReportedCount: safeAdd(current.tokenReportedCount, group.tokenReportedCount),
      totalTokens: safeAdd(current.totalTokens, group.totalTokens),
      verificationCount: safeAdd(
        current.verificationCount,
        group.verifiedCount + group.safeReplacementCount,
      ),
    }),
    {
      costReportedCount: 0,
      estimatedCostMicros: 0,
      failedCount: 0,
      fallbackCount: 0,
      generationCount: 0,
      latencyOverThirtySecondsCount: 0,
      latencyTotalMs: 0,
      retryCount: 0,
      safeReplacementCount: 0,
      tokenReportedCount: 0,
      totalTokens: 0,
      verificationCount: 0,
    },
  );
  const visible = usable && total.generationCount >= thresholds.minimumDisplayCount;
  const verificationVisible = usable && total.verificationCount >= thresholds.minimumDisplayCount;
  const completionCount = total.generationCount - total.failedCount;
  const metricInputs: AiOperationsMetric[] = [
    {
      definition: "Terminal generation aggregates in the exact daily window.",
      denominator: visible ? 1 : null,
      id: "generation_count",
      knownGaps: ["The aggregate export does not prove provider-side billing completeness."],
      numerator: visible ? total.generationCount : null,
      unit: "count",
      value: visible ? total.generationCount : null,
    },
    {
      definition: "Displayable outcomes divided by all terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "completion_rate",
      knownGaps: ["Completion does not measure interpretation helpfulness or user value."],
      numerator: visible ? completionCount : null,
      unit: "ratio",
      value: visible ? ratio(completionCount, total.generationCount) : null,
    },
    {
      definition: "Failed terminal generations divided by all terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "failure_rate",
      knownGaps: ["Raw provider errors remain prohibited."],
      numerator: visible ? total.failedCount : null,
      unit: "ratio",
      value: visible ? ratio(total.failedCount, total.generationCount) : null,
    },
    {
      definition: "Reviewed deterministic fallbacks divided by terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "fallback_rate",
      knownGaps: ["Fallback can preserve safe value and is not automatically a defect."],
      numerator: visible ? total.fallbackCount : null,
      unit: "ratio",
      value: visible ? ratio(total.fallbackCount, total.generationCount) : null,
    },
    {
      definition: "Safe replacements divided by independently verified outcomes.",
      denominator: verificationVisible ? total.verificationCount : null,
      id: "safe_replacement_rate",
      knownGaps: ["A safe replacement is a protective intervention, not a critical failure."],
      numerator: verificationVisible ? total.safeReplacementCount : null,
      unit: "ratio",
      value: verificationVisible
        ? ratio(total.safeReplacementCount, total.verificationCount)
        : null,
    },
    {
      definition: "Retried generations divided by terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "retry_rate",
      knownGaps: ["The metric counts retried generations, not provider attempts."],
      numerator: visible ? total.retryCount : null,
      unit: "ratio",
      value: visible ? ratio(total.retryCount, total.generationCount) : null,
    },
    {
      definition: "Aggregate generation latency divided by terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "average_latency_ms",
      knownGaps: ["Aggregate means do not provide percentile latency."],
      numerator: visible ? total.latencyTotalMs : null,
      unit: "milliseconds",
      value: visible ? ratio(total.latencyTotalMs, total.generationCount) : null,
    },
    {
      definition: "Generations exceeding 30 seconds divided by terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "latency_review_rate",
      knownGaps: ["The review threshold is not a provider SLA or runtime timeout."],
      numerator: visible ? total.latencyOverThirtySecondsCount : null,
      unit: "ratio",
      value: visible ? ratio(total.latencyOverThirtySecondsCount, total.generationCount) : null,
    },
    {
      definition: "Generations with validated estimated cost divided by terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "cost_reporting_coverage",
      knownGaps: ["Estimated cost is not an invoice or approved operating budget."],
      numerator: visible ? total.costReportedCount : null,
      unit: "ratio",
      value: visible ? ratio(total.costReportedCount, total.generationCount) : null,
    },
    {
      definition: "Sum of validated provider-estimated cost in currency micros.",
      denominator: visible && total.costReportedCount > 0 ? total.costReportedCount : null,
      id: "estimated_cost_micros",
      knownGaps: ["OWN-005 is incomplete, so no monetary budget alert is available."],
      numerator: visible && total.costReportedCount > 0 ? total.estimatedCostMicros : null,
      unit: "micros",
      value: visible && total.costReportedCount > 0 ? total.estimatedCostMicros : null,
    },
    {
      definition: "Estimated cost divided by generations reporting cost.",
      denominator: visible && total.costReportedCount > 0 ? total.costReportedCount : null,
      id: "average_reported_cost_micros",
      knownGaps: ["Missing cost reports are not treated as zero spend."],
      numerator: visible && total.costReportedCount > 0 ? total.estimatedCostMicros : null,
      unit: "micros",
      value:
        visible && total.costReportedCount > 0
          ? ratio(total.estimatedCostMicros, total.costReportedCount)
          : null,
    },
    {
      definition: "Generations with validated token totals divided by terminal generations.",
      denominator: visible ? total.generationCount : null,
      id: "token_reporting_coverage",
      knownGaps: ["Provider token accounting can differ from billable units."],
      numerator: visible ? total.tokenReportedCount : null,
      unit: "ratio",
      value: visible ? ratio(total.tokenReportedCount, total.generationCount) : null,
    },
    {
      definition: "Validated tokens divided by generations reporting tokens.",
      denominator: visible && total.tokenReportedCount > 0 ? total.tokenReportedCount : null,
      id: "average_total_tokens",
      knownGaps: ["Averages do not authorize larger prompts or output limits."],
      numerator: visible && total.tokenReportedCount > 0 ? total.totalTokens : null,
      unit: "tokens",
      value:
        visible && total.tokenReportedCount > 0
          ? ratio(total.totalTokens, total.tokenReportedCount)
          : null,
    },
  ];
  const valueFor = (id: AiOperationsMetric["id"]): number | null =>
    metricInputs.find((metric) => metric.id === id)?.value ?? null;
  const alerts: AiOperationsAlert[] = [];
  if (!usable) {
    alerts.push({
      action: "Refresh an approved aggregate-only export before making an AI operations decision.",
      evidence: `The source is ${snapshot.source.kind} with ${freshness} freshness.`,
      kind: "source_refresh",
      priority: "high",
      requiresHumanReview: true,
    });
  } else if (visible) {
    const addAlert = (
      condition: boolean,
      alert: Omit<AiOperationsAlert, "requiresHumanReview">,
    ): void => {
      if (condition) alerts.push(Object.freeze({ ...alert, requiresHumanReview: true }));
    };
    const failureRate = valueFor("failure_rate");
    const fallbackRate = valueFor("fallback_rate");
    const latencyRate = valueFor("latency_review_rate");
    const costCoverage = valueFor("cost_reporting_coverage");
    const tokenCoverage = valueFor("token_reporting_coverage");
    addAlert(failureRate !== null && failureRate > thresholds.failureRateReview, {
      action: "Review categorical failures and provider health without exposing raw errors.",
      evidence: `Failure rate ${((failureRate ?? 0) * 100).toFixed(2)}% exceeded 2.00%.`,
      kind: "failure_rate_review",
      priority: "high",
    });
    addAlert(fallbackRate !== null && fallbackRate > thresholds.fallbackRateReview, {
      action: "Review fallback causes; do not weaken the reviewed fallback or safety checks.",
      evidence: `Fallback rate ${((fallbackRate ?? 0) * 100).toFixed(2)}% exceeded 10.00%.`,
      kind: "fallback_rate_review",
      priority: "medium",
    });
    addAlert(latencyRate !== null && latencyRate > thresholds.latencyReviewRate, {
      action: "Review aggregate latency by approved version group before changing timeouts.",
      evidence: `Latency review rate ${((latencyRate ?? 0) * 100).toFixed(2)}% exceeded 5.00%.`,
      kind: "latency_review",
      priority: "medium",
    });
    addAlert(costCoverage !== null && costCoverage < thresholds.costReportingCoverageMinimum, {
      action: "Repair cost-reporting completeness; never treat unavailable cost as zero.",
      evidence: `Cost-reporting coverage ${((costCoverage ?? 0) * 100).toFixed(2)}% fell below 95.00%.`,
      kind: "cost_reporting_incomplete",
      priority: "medium",
    });
    addAlert(tokenCoverage !== null && tokenCoverage < thresholds.tokenReportingCoverageMinimum, {
      action: "Review provider usage normalization before using token averages.",
      evidence: `Token-reporting coverage ${((tokenCoverage ?? 0) * 100).toFixed(2)}% fell below 95.00%.`,
      kind: "token_reporting_incomplete",
      priority: "low",
    });
  }
  const safeReplacementRate = valueFor("safe_replacement_rate");
  if (
    usable &&
    verificationVisible &&
    safeReplacementRate !== null &&
    safeReplacementRate > thresholds.safeReplacementRateReview
  ) {
    alerts.push({
      action: "Review approved verifier evidence; never weaken safety to reduce replacements.",
      evidence: `Safe-replacement rate ${(safeReplacementRate * 100).toFixed(2)}% exceeded 5.00%.`,
      kind: "safe_replacement_review",
      priority: "high",
      requiresHumanReview: true,
    });
  }
  const groupSummaries = usable
    ? snapshot.groups
        .map((group): AiOperationsGroupSummary => {
          const groupVisible = group.generationCount >= thresholds.minimumDisplayCount;
          const verificationCount = group.verifiedCount + group.safeReplacementCount;
          return Object.freeze({
            averageLatencyMs: groupVisible
              ? ratio(group.latencyTotalMs, group.generationCount)
              : null,
            averageReportedCostMicros:
              groupVisible && group.costReportedCount > 0
                ? ratio(group.estimatedCostMicros, group.costReportedCount)
                : null,
            contentVersions: group.contentVersions,
            costReportingCoverage: groupVisible
              ? ratio(group.costReportedCount, group.generationCount)
              : null,
            currencyCode: groupVisible ? group.currencyCode : null,
            failureRate: groupVisible ? ratio(group.failedCount, group.generationCount) : null,
            fallbackRate: groupVisible ? ratio(group.fallbackCount, group.generationCount) : null,
            generationCount: groupVisible ? group.generationCount : null,
            locale: group.locale,
            modelId: group.modelId,
            modelVersion: group.modelVersion,
            outputSchemaVersion: group.outputSchemaVersion,
            promptId: group.promptId,
            promptVersion: group.promptVersion,
            providerId: group.providerId,
            providerVersion: group.providerVersion,
            readingType: group.readingType,
            safeReplacementRate:
              groupVisible && verificationCount >= thresholds.minimumDisplayCount
                ? ratio(group.safeReplacementCount, verificationCount)
                : null,
            safetyPolicyVersion: group.safetyPolicyVersion,
          });
        })
        .sort(
          (left, right) =>
            left.locale.localeCompare(right.locale) ||
            left.readingType.localeCompare(right.readingType) ||
            left.providerId.localeCompare(right.providerId) ||
            left.modelId.localeCompare(right.modelId) ||
            left.promptId.localeCompare(right.promptId),
        )
    : [];
  const report: AiOperationsReport = Object.freeze({
    alerts: Object.freeze(alerts),
    caveats: Object.freeze([
      "The report consumes aggregate operational metadata and performs no database, provider, model, or network request.",
      "Questions, prompts, outputs, excerpts, safety categories, user or reading identifiers, and raw provider errors are prohibited.",
      "Safe replacements and reviewed fallbacks preserve safety; they never justify weakening controls.",
      "OWN-005 is incomplete, so estimated cost is evidence only and no monetary budget alert is authorized.",
      "Critical safety release failures remain governed by fixed eval suites and are not inferred from runtime replacement rates.",
      ...(!visible
        ? [
            "Operational values are unavailable because the source is unusable or the daily aggregate contains fewer than 20 generations.",
          ]
        : []),
    ]),
    costBudgetStatus: "owner_budget_unavailable",
    decisionStatus: usable ? "ready" : "blocked",
    generatedAt: asOf,
    groupSummaries: Object.freeze(groupSummaries),
    inputDigest: context.inputDigest,
    metrics: Object.freeze(
      metricInputs.map((metric) =>
        Object.freeze({ ...metric, knownGaps: Object.freeze(metric.knownGaps) }),
      ),
    ),
    policyVersion: aiOperationsPolicyVersion,
    schemaVersion: aiOperationsReportSchemaVersion,
    source: Object.freeze({
      approvalReference: snapshot.source.approvalReference,
      freshness,
      kind: snapshot.source.kind,
      maximumAgeHours: 30,
      observedThrough: snapshot.source.observedThrough,
    }),
    thresholds,
    windowEnd: snapshot.windowEnd,
    windowStart: snapshot.windowStart,
  });
  projectedReports.add(report);
  return report;
};

const formatMetric = (metric: AiOperationsMetric): string => {
  if (metric.value === null) return "Unavailable";
  if (metric.unit === "ratio") return `${(metric.value * 100).toFixed(2)}%`;
  if (metric.unit === "micros") return `${metric.value.toFixed(2)} micros`;
  if (metric.unit === "milliseconds") return `${metric.value.toFixed(2)} ms`;
  if (metric.unit === "tokens") return `${metric.value.toFixed(2)} tokens`;
  return String(metric.value);
};

export const renderAiOperationsMarkdown = (report: AiOperationsReport): string => {
  if (!projectedReports.has(report)) return invalid();
  return [
    "# RITUVIA AI Operations Brief",
    "",
    `- Decision status: ${report.decisionStatus}`,
    `- Policy version: ${report.policyVersion}`,
    `- Generated at: ${report.generatedAt}`,
    `- Window: ${report.windowStart} to ${report.windowEnd}`,
    `- Input digest: ${report.inputDigest}`,
    `- Source: ${report.source.kind}; approval ${report.source.approvalReference ?? "not approved"}; observed ${report.source.observedThrough ?? "unavailable"}; freshness ${report.source.freshness}.`,
    `- Cost budget: ${report.costBudgetStatus}`,
    "",
    "## Metrics",
    "",
    "| Metric | Value | Numerator | Denominator |",
    "| --- | ---: | ---: | ---: |",
    ...report.metrics.map(
      (metric) =>
        `| ${metric.id} | ${formatMetric(metric)} | ${metric.numerator ?? "n/a"} | ${metric.denominator ?? "n/a"} |`,
    ),
    "",
    "## Approved Version Groups",
    "",
    ...(report.groupSummaries.length === 0
      ? ["No current approved version-group values are available."]
      : report.groupSummaries.map(
          (group) =>
            `- ${group.locale}/${group.readingType}: ${group.providerId}@${group.providerVersion}, ${group.modelId}@${group.modelVersion}, ${group.promptId}@${group.promptVersion}, schema ${group.outputSchemaVersion}, safety ${group.safetyPolicyVersion}, content ${group.contentVersions.join(", ")}; generations ${group.generationCount ?? "suppressed"}, failure ${group.failureRate === null ? "suppressed" : `${(group.failureRate * 100).toFixed(2)}%`}, fallback ${group.fallbackRate === null ? "suppressed" : `${(group.fallbackRate * 100).toFixed(2)}%`}.`,
        )),
    "",
    "## Alerts",
    "",
    ...(report.alerts.length === 0
      ? ["No reviewed operational alert threshold was exceeded."]
      : report.alerts.map(
          (alert) => `- **${alert.priority} / ${alert.kind}:** ${alert.evidence} ${alert.action}`,
        )),
    "",
    "## Data Quality Caveats",
    "",
    ...report.caveats.map((caveat) => `- ${caveat}`),
    ...report.metrics.flatMap((metric) => metric.knownGaps.map((gap) => `- ${metric.id}: ${gap}`)),
    "",
  ].join("\n");
};
