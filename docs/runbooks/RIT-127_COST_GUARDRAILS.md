# RIT-127 Cost Guardrails

## 1. Purpose and current state

`cost-guardrail.v1` is a private offline safe-off evaluator for one exact daily provider/feature
cost snapshot. It verifies proposed allocation, reporting coverage, thresholds, and safe-action
shape. It never asserts policy approval and does not contact a provider, ingest an invoice, reserve
money, change a model, throttle a worker, mutate a feature flag, send an alert, or deploy.

Current production budget authority remains unavailable because OWN-005 has not approved exact
amounts or activation. The protected free Beta therefore keeps paid production providers safe-off.

## 2. Button and entry point

There is no Web or Admin Button and no HTTP route. Run the private command from the repository:

```bash
pnpm report:cost-guardrails -- \
  --as-of 2026-08-02T02:30:00.000Z \
  --input /absolute/private/path/cost-guardrail-input.json \
  --output-json /absolute/private/path/cost-guardrail-report.json \
  --output-markdown /absolute/private/path/cost-guardrail-report.md
```

Open the resulting Markdown in the Codex right sidebar. Output files are new, exclusive mode
`0600` files. Existing files are never overwritten.

## 3. Input contract

The top-level object contains exactly:

- `schemaVersion`: `cost-guardrail-snapshot.v1`;
- `capturedAt`: UTC capture time, no more than six hours after the window closes;
- `windowStart` / `windowEnd`: one exact 24-hour UTC window;
- `environment`: `local`, `ci`, `protected_staging`, or `production`;
- `currencyCode`: one ISO-style three-letter code; v1 performs no FX conversion;
- `source`: durable aggregate, synthetic fixture, or unavailable plus observed-through time;
- `policy`: unavailable or one explicitly unapproved proposed policy;
- `observations`: unique provider/feature aggregate cost and reporting counts.

The current proposed policy requires:

- `approvalReference: null` and `kind: proposed_policy`;
- a `cost-budget.<name>.vN` policy reference;
- a total budget in currency micros;
- one or more unique provider/feature lines whose budgets sum exactly to the total;
- warning basis points and exact warning/limit actions;
- `non_essential` or `essential_no_automatic_degradation` protection.

Provider and feature identifiers must come from the exported finite registries; arbitrary labels
are rejected. Do not enter a placeholder amount and label it approved. When no simulation is
needed, use:

```json
{
  "approvalReference": null,
  "kind": "unavailable",
  "lines": [],
  "policyReference": null,
  "totalBudgetMicros": null
}
```

## 4. Allocation and anomaly rules

- Every policy line is matched by exact provider ID plus feature ID.
- Proposed policy-line budgets must reconcile exactly to the proposed total.
- An observation without a policy line is `unbudgeted` and blocks the decision.
- A policy line without an observation is not interpreted as zero spend.
- Reporting coverage below 100% makes utilization and remaining budget unavailable.
- No v1 input can authorize non-essential spend; `Decision status` is always `blocked`.
- Fully reported spend at or above a proposed warning threshold simulates the proposed warning
  action; spend at or above the proposed budget simulates the proposed limit action.

## 5. Safe actions

The closed vocabulary is:

1. `alert_and_annotate`;
2. `reduce_non_critical_background_concurrency`;
3. `pause_non_essential_content_generation`;
4. `disable_non_essential_paid_provider`.

The report only simulates these actions. `automaticActionsExecuted` is always `false`, action
authority is `simulation_only` or `unavailable`, and non-essential spend authorization is `deny`.
Safety checks, payment integrity, backups, privacy rights, and existing paid entitlements must use
`essential_no_automatic_degradation`; both warning and limit actions must be
`alert_and_annotate`.

## 6. Missing runtime contract

RIT-127 cannot complete under D-106-approved Option A. It requires a superseding exact Option B
policy artifact and durable atomic reserve/commit/release/reconcile state before outbound provider
work. That later contract
must handle concurrent calls, retries, fallbacks, crashes, unknown/late cost, duplicate idempotency,
and alert delivery. The current evaluator intentionally exposes no admission API.

## 7. Daily review

1. Export only reviewed aggregate billing/usage facts; never private prompts, journal text,
   questions, birth data, identifiers, or raw provider payloads.
2. Verify source completeness, deduplication, late corrections, window, currency, and approval.
3. Generate JSON and Markdown to a private absolute path.
4. Review `Decision status`, `Evaluation status`, every allocation `Status`, reporting coverage,
   denied spend authorization, simulated action, and action authority.
5. Treat `blocked` as no authority for new non-essential paid spend.
6. Preserve evidence for review; do not commit live cost exports or private runtime reports.

## 8. Failure and recovery

- Invalid input: correct the source export or approved policy; never loosen parsing.
- Missing cost: refresh the source and retain unavailable values; never fill zero.
- Stale source: regenerate from a current durable aggregate.
- Unbudgeted observation: stop new non-essential spend for that line and obtain explicit policy
  review; do not silently absorb it into another budget.
- Warning/exhaustion: route the exact approved action for human review. Runtime execution remains a
  separate approved integration.
- Essential-line breach: alert and preserve service; use the incident/runbook path, not budget
  shutdown.

## 9. Verification and rollback

Run:

```bash
pnpm check:cost-guardrails
pnpm check:owner-operations
pnpm check:ci-contract
pnpm --filter @rituvia/analytics typecheck
pnpm --filter @rituvia/analytics build
```

Rollback removes the analytics contract, generator, tests, CI/build references, runbook, D-105,
and RIT-127 record. There is no database migration, provider mutation, budget activation, or user
data to reverse.
