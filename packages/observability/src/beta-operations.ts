export const betaSloIds = Object.freeze([
  "core_page_availability",
  "auth_verification_p95_ms",
  "order_creation_p95_ms",
  "payment_webhook_processing_p95_ms",
  "deep_reading_success_ratio",
  "credit_entry_loss_or_duplicate_count",
] as const);

export type BetaSloId = (typeof betaSloIds)[number];
export type BetaSloState = "breached" | "healthy" | "unknown";

type BetaSloDefinition = Readonly<{
  comparison: "maximum" | "minimum";
  id: BetaSloId;
  maxSampleAgeSeconds: number;
  objective: number;
  owner: "commerce" | "identity" | "platform" | "product_ai";
  severity: "critical" | "warning";
  unit: "count" | "milliseconds" | "ratio";
}>;

const runbookPath = "docs/runbooks/RIT-124_BETA_OPERATIONS.md";

export const betaSloDefinitions: readonly BetaSloDefinition[] = Object.freeze([
  Object.freeze({
    comparison: "minimum",
    id: "core_page_availability",
    maxSampleAgeSeconds: 900,
    objective: 0.999,
    owner: "platform",
    severity: "critical",
    unit: "ratio",
  }),
  Object.freeze({
    comparison: "maximum",
    id: "auth_verification_p95_ms",
    maxSampleAgeSeconds: 300,
    objective: 1_500,
    owner: "identity",
    severity: "warning",
    unit: "milliseconds",
  }),
  Object.freeze({
    comparison: "maximum",
    id: "order_creation_p95_ms",
    maxSampleAgeSeconds: 300,
    objective: 2_000,
    owner: "commerce",
    severity: "warning",
    unit: "milliseconds",
  }),
  Object.freeze({
    comparison: "maximum",
    id: "payment_webhook_processing_p95_ms",
    maxSampleAgeSeconds: 300,
    objective: 5_000,
    owner: "commerce",
    severity: "critical",
    unit: "milliseconds",
  }),
  Object.freeze({
    comparison: "minimum",
    id: "deep_reading_success_ratio",
    maxSampleAgeSeconds: 900,
    objective: 0.98,
    owner: "product_ai",
    severity: "warning",
    unit: "ratio",
  }),
  Object.freeze({
    comparison: "maximum",
    id: "credit_entry_loss_or_duplicate_count",
    maxSampleAgeSeconds: 300,
    objective: 0,
    owner: "commerce",
    severity: "critical",
    unit: "count",
  }),
]);

export type BetaSloSample = Readonly<{
  observedAt: string;
  value: number;
}>;

export type BetaSloEvaluation = Readonly<{
  alert: Readonly<{
    id: string;
    owner: BetaSloDefinition["owner"];
    requiresCorrelationId: true;
    runbookPath: typeof runbookPath;
    severity: BetaSloDefinition["severity"];
  }> | null;
  id: BetaSloId;
  objective: number;
  reason: "invalid" | "missing" | "objective_breached" | "stale" | "within_objective";
  state: BetaSloState;
  unit: BetaSloDefinition["unit"];
}>;

const definitionById = new Map(betaSloDefinitions.map((definition) => [definition.id, definition]));

const alertFor = (
  definition: BetaSloDefinition,
  reason: Exclude<BetaSloEvaluation["reason"], "within_objective">,
): NonNullable<BetaSloEvaluation["alert"]> =>
  Object.freeze({
    id: `rituvia.slo.${definition.id}.${reason}`,
    owner: definition.owner,
    requiresCorrelationId: true,
    runbookPath,
    severity: definition.severity,
  });

export const evaluateBetaSlo = (
  id: BetaSloId,
  sample: BetaSloSample | undefined,
  now: string,
): BetaSloEvaluation => {
  const definition = definitionById.get(id);
  if (definition === undefined) throw new TypeError("Unknown Beta SLO identifier.");

  const nowMs = Date.parse(now);
  const observedAtMs = sample === undefined ? Number.NaN : Date.parse(sample.observedAt);
  let reason: BetaSloEvaluation["reason"];
  let state: BetaSloState;

  if (sample === undefined) {
    reason = "missing";
    state = "unknown";
  } else if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(observedAtMs) ||
    !Number.isFinite(sample.value)
  ) {
    reason = "invalid";
    state = "unknown";
  } else if (
    observedAtMs > nowMs ||
    nowMs - observedAtMs > definition.maxSampleAgeSeconds * 1_000
  ) {
    reason = "stale";
    state = "unknown";
  } else {
    const withinObjective =
      definition.comparison === "minimum"
        ? sample.value >= definition.objective
        : sample.value <= definition.objective;
    reason = withinObjective ? "within_objective" : "objective_breached";
    state = withinObjective ? "healthy" : "breached";
  }

  return Object.freeze({
    alert: reason === "within_objective" ? null : alertFor(definition, reason),
    id,
    objective: definition.objective,
    reason,
    state,
    unit: definition.unit,
  });
};
