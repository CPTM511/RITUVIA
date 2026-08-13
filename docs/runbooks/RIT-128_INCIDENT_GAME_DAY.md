# RIT-128 Incident and Provider Failure Game Day

## 1. Purpose and current truth

This runbook executes one bounded repository-local failure matrix across security, Web containment,
AI, payments, notifications, database control, restore, dependency policy, and secret boundaries.
It reuses the existing tested controls rather than adding a second incident framework.

The exercise uses synthetic fixtures, local processes, and isolated PostgreSQL databases only. It
does not contact a live provider, deploy an environment, change DNS, send a notification, mutate
production data, activate payments or AI, or complete Gate H.

## 2. Button and entry point

There is no Web or Admin Button and no HTTP route. Run from the repository with the pinned Node and
pnpm toolchain:

```sh
pnpm test:incident-game-day
```

The command is intentionally manual and must not run as an unattended production automation.

## 3. Fixed scenario matrix

| ID | Injected failure | Required outcome | Evidence |
| --- | --- | --- | --- |
| GD-SEC-001 | Unauthorized role, exhausted anonymous capacity, unknown mutation | Default deny, bounded response, no private storage error, unknown route remains 404 | Security, abuse, proxy, and SLO unit tests |
| GD-WEB-001 | Global Web read-only containment | Reviewed mutations return correlated private 503; reads, signed webhooks, logout, and revocation remain admitted | Proxy tests and isolated configuration boundary |
| GD-AI-001 | Provider timeout, unavailable result, malformed/hostile output, late completion | Bounded retry/fallback, no display before verification, no private/raw error, no paid/external call in release evals | AI/provider/runtime tests and 96 release-eval cases |
| GD-PAY-001 | Stripe account/transport unavailable, payment provider API unavailable, missed webhook, or database claim outage | Redacted auditable case, bounded per-loop recovery, no Worker-wide collapse, no inferred payment or Credit issuance | Stripe reader, payment/subscription/reconciliation Worker tests |
| GD-PAY-002 | Twenty concurrent duplicate deliveries plus out-of-order/refund mismatch | One durable event, deterministic state, zero fulfillment at ingestion, least privilege | Isolated Stripe sandbox webhook database drill |
| GD-NOTIFY-001 | Reminder provider disabled, unavailable, rejected, stale, or hanging while ignoring abort | Hard timeout/cancel wins; late settlement is consumed; no unauthorized send; bounded retry/dead letter and stable idempotency | Revisit reminder Worker tests |
| GD-DB-001 | Dynamic feature containment and restore | Exact safe-off to approved-on to emergency-off history, runtime least privilege, restored final off | Isolated astrology kill-switch database drill |
| GD-DB-002 | Database loss at a synthetic snapshot boundary | Custom-format backup, isolated restore, snapshot equality, least privilege, cleanup | Backup/recovery database drill |
| GD-SUPPLY-001 | Dependency or repository-policy drift | CI contract, architecture ownership, locked registries, and secret boundary fail closed | CI contract, architecture, and secret checks |
| GD-SECRET-001 | Seeded credential/key-compromise patterns | Repository policy detects the bounded synthetic secrets; no real secret enters evidence; external rotation stays human-gated | Secret-policy tests and secret scan |

## 4. Execution workflow

1. Confirm the exact Git revision, Node `26.5.1`, pnpm `11.13.1`, local environment, and no live
   provider credentials.
2. Run `pnpm test:incident-game-day` without changing production or hosted configuration.
3. Stop on the first failed scenario. Preserve the scenario ID, command, exit code, UTC time,
   synthetic database name where applicable, and bounded redacted output.
4. Never copy prompts, questions, journals, prayers, birth data, email, tokens, webhook secrets,
   provider payloads, connection strings, or raw errors into incident evidence.
5. Classify findings by user safety, private-data exposure, settlement/entitlement integrity,
   authorization, availability, and evidence quality.
6. Remediate Critical/High findings before task closure. Record Medium/Low findings with an owner,
   compensating control, and release gate.
7. Rerun the failed scenario, the complete game-day command, and the ordinary full repository gate.

## 5. Scenario response rules

- **Security or private-data suspicion:** stop the affected path, preserve bounded evidence, revoke
  only through existing authorized controls, and escalate to the Owner. Do not delete evidence.
- **Payment ambiguity:** do not grant, refund, or reverse value from return URLs or local guesses;
  reconcile provider-authoritative state and retain idempotency.
- **AI failure:** return safe deterministic/fallback behavior or unavailable; never render an
  unverified provider response or retry without the bounded policy.
- **Notification failure:** do not bypass send-time authorization or substitute private content;
  use bounded retry/dead letter only.
- **Database incident:** freeze risky writes, restore to a new isolated target, reconcile exact
  snapshot/application/provider boundaries, and never overwrite the damaged source casually.
- **Dependency failure:** preserve the lockfile and exact toolchain; do not disable scans, loosen
  types, or install an unreviewed replacement to make the exercise pass.

## 6. Completion and known gaps

RIT-128 repository scope is complete only when every fixed scenario passes, the report records zero
open Critical/High findings, every Medium finding has an owner/compensating control/release gate,
any discovered repository defect is fixed and retested, and the full workspace gate passes.

This result still does not prove standing staging, external monitoring/paging/status delivery,
provider-level PITR/restore, live-provider kill switches, hosted DAST, independent penetration
testing, real secret/provider-key rotation, customer communication, or Gate H. AI circuit-breaker
and provider-health activation evidence remains required before any production AI provider. OWN-005
Option A also keeps every non-essential paid provider safe-off and leaves RIT-127 Blocked.

## 7. Rollback

The game day creates only disposable local test databases, generated Prisma clients, ordinary build
artifacts, and local backup evidence. The database scripts clean their isolated databases. Remove
the package scripts, this runbook, the report, and task/status records to roll back the repository
entry point. No production, provider, customer, DNS, or payment state requires reversal.
