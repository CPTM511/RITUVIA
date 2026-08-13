# RIT-124 Protected Beta operations runbook

## Purpose and current truth

This runbook covers the repository-side protected-Beta SLO contract, alert routing, correlation,
global Web read-only containment, and the existing database-backed astrology kill-switch drill.
It does **not** prove that a production metrics exporter, paging provider, public status page,
standing staging environment, or no-redeploy global control plane exists. Those external bindings
and every production change remain separately gated.

## Fixed protected-Beta SLOs

The executable contract is `packages/observability/src/beta-operations.ts`. It accepts only a fixed
metric identifier, numeric value, and observation time; it does not accept user, journal, prayer,
question, birth, prompt, email, payment credential, or arbitrary label content.

| SLO | Objective | Freshness | Alert owner | Severity |
| --- | ---: | ---: | --- | --- |
| Core page availability | at least 99.9% | 15 minutes | platform | critical |
| Authentication verification p95 | at most 1,500 ms | 5 minutes | identity | warning |
| Order creation p95 | at most 2,000 ms | 5 minutes | commerce | warning |
| Payment webhook processing p95 | at most 5,000 ms | 5 minutes | commerce | critical |
| Deep Reading success, policy refusals excluded | at least 98% | 15 minutes | product_ai | warning |
| Lost or duplicate Credit entries | exactly 0 | 5 minutes | commerce | critical |

Missing, invalid, future, and stale samples are `unknown`, never healthy. Every non-healthy result
has a fixed alert ID, owner, severity, this runbook path, and `requiresCorrelationId: true`.

## Alert response

1. Preserve the fixed alert ID, UTC observation window, release, environment, and correlation ID.
2. Do not paste request bodies, prompts, journal text, birth data, email, tokens, or provider payloads.
3. Confirm whether evidence is breached, missing, invalid, or stale; never treat missing as zero.
4. For a critical alert, stop the affected rollout and assign the named owner immediately.
5. For a warning, assign the named owner and investigate before the next cohort expansion.
6. Use correlated structured spans to locate the failing Web, worker, dependency, or job boundary.
7. If private-data exposure, settlement integrity, or duplicate/lost Credit evidence is plausible,
   stop the affected path and escalate to the Owner; do not auto-repair or delete evidence.

## Global Web read-only containment

`RITUVIA_OPERATION_MODE` accepts only `normal` or `read_only`. In `read_only`, reviewed GET/HEAD
requests continue; normal reviewed business mutations return private `503` JSON with code
`SERVICE_READ_ONLY`, `Retry-After: 300`, `Cache-Control: private, no-store`, and the same
`x-request-id` produced by request observability.

The following safety and settlement callbacks remain accepted:

- signed local/Stripe payment webhooks, so provider truth is not silently dropped;
- current-session and all-session logout;
- explicit account-session revocation.

Read-only mode does not bypass route review: an unknown mutation remains `404`. It does not activate
payments, AI, astrology, a country, a locale, Beta access, or production deployment.

### Local or approved staging drill

1. Capture the current environment, release, and approver reference.
2. Set `RITUVIA_OPERATION_MODE=read_only` and restart only the Web runtime.
3. Confirm one reviewed GET succeeds.
4. Confirm one reviewed business POST returns `503`, `Retry-After: 300`, private no-store, and a
   non-empty `x-request-id`.
5. Confirm an unknown POST remains `404`.
6. Using synthetic/sandbox fixtures only, confirm payment webhook handoff, logout, and session
   revocation are not blocked at the proxy.
7. Set `RITUVIA_OPERATION_MODE=normal`, restart the Web runtime, and confirm the reviewed POST is no
   longer blocked by the containment layer.

Production activation, restart, rollback, deployment, or customer-impacting use requires explicit
Owner approval. This environment-backed control currently requires a restart; a dynamic global
no-redeploy control plane is not claimed.

## Existing dynamic kill-switch drill

The astrology feature flag is database-backed, append-only for the control role, read-only for the
runtime, approval-bound, and safe-off by default. Run the isolated local PostgreSQL drill:

```sh
pnpm --filter @rituvia/db test:astrology-kill-switch
```

The drill must prove `off -> on -> off`, least privilege, no update/delete/truncate, logical restore,
and restored final `off`. It is synthetic evidence only and does not authorize a production flag
change. Payment-provider/country/method kill switches remain RIT-075 work and must not be inferred
from the astrology drill.

## Rollback and unresolved external bindings

Repository rollback removes the SLO evaluator, operation-mode configuration, proxy containment,
tests, and this runbook. There is no migration or user-state rewrite. If containment causes an
incident, restore `normal` only with the applicable approval and verify the exact protected path.

Before Gate H can pass, bind approved aggregate metrics to the fixed evaluator, connect a reviewed
paging/status provider, stand up protected staging, rehearse provider outage and restore, complete
support ownership, and close the remaining penetration/game-day evidence. Do not report this task
as production monitoring or operational readiness by itself.
