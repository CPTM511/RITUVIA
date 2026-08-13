# OWN-005 cost budget and runtime-control decision request

> Status: **Option A approved under D-106; exact Option B remains required for RIT-127 completion**
>
> Scope: exact cost authority needed to complete RIT-127
>
> Current default: all production paid-provider spend and automated cost degradation remain off

## 1. Why this decision is required

The repository now has a strict private simulation for provider/feature allocation, cost coverage,
warning/limit shape, essential-service protection, and private evidence. Independent review found
that it would be unsafe to treat a syntactically valid `OWN-NNN` string as approval or to use a
read-only aggregate as concurrent spend admission.

RIT-127 therefore remains Blocked until the Owner chooses an exact budget authority and approves
the runtime-control boundary. No production provider, amount, alert destination, or degradation is
active today.

## 2. Approved decision

**Option A is approved: preserve safe-off for the protected free Beta until actual standing-staging
provider quotes and contracts are available.**

Under Option A:

- all non-essential paid AI, payment, notification, marketing, affiliate, and hosted lookup spend
  remains disabled;
- no placeholder budget is presented as approved;
- safety, payment integrity, backups, privacy rights, and existing entitlements remain outside
  automatic budget degradation;
- RIT-128 may run repository-local failure exercises independently;
- RIT-127 stays Blocked and resumes only after the Owner receives the exact provider/currency/
  amount/effective-period proposal below.

This is the smallest honest decision for the already-approved anonymous free Beta. It spends no
money and does not create an unused distributed accounting subsystem before provider selection.

## 3. Alternative

**Option B: approve an exact initial operating envelope now.** The Owner must supply or approve all
fields in one immutable policy artifact:

| Field                  | Required value                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Environment            | Exact `protected_staging` and/or `production` scope                                               |
| Currency/FX            | One settlement currency and any permitted conversion source/rule                                  |
| Effective period       | Start, expiry, renewal/carryover rule                                                             |
| Monthly total          | Exact operating ceiling                                                                           |
| Provider/feature lines | Exact provider alias, feature code, daily/monthly amount, warning basis points                    |
| AI                     | Daily global, primary/fallback, per-feature, anonymous/user caps, retry/fallback reservation rule |
| Infrastructure         | Web/worker/database/storage/bandwidth/backup/monitoring ceilings                                  |
| Notifications          | Email/push/SMS volume and monetary ceilings                                                       |
| Payments/risk          | Fees, refunds, chargebacks, fraud-loss tolerance, automated-refund threshold                      |
| Growth                 | Marketing/affiliate ceiling; manual approval remains mandatory                                    |
| Alerts                 | Fixed ID, severity, owner, destination, runbook, deduplication, acknowledgement, recovery         |
| Degradation            | Exact non-essential action per line plus restoration/hysteresis rule                              |

Option B also authorizes implementation—not activation—of a durable atomic
reserve/commit/release/reconcile ledger before outbound paid-provider work. Activation still
requires staging evidence and a separate deployment decision.

## 4. Required runtime evidence after Option B

- Exact policy bytes are digest-bound to the Owner decision, environment, effective period, and
  finite provider/feature registry.
- Worst-case cost reserves atomically before provider work; actual cost commits once and unused
  reservation releases once.
- Retries and fallbacks share the same budget authority and cannot double reserve/spend.
- Concurrent, crash/reaper, unknown-cost, late-correction, duplicate-idempotency, currency, and
  provider-price drift cases pass.
- Missing/unbudgeted cost results in zero outbound non-essential paid calls.
- Alerts have fixed IDs, severity, owner, runbook, correlation, deduplication, acknowledgement,
  delivery-failure, escalation, and recovery evidence.
- Essential safety/payment/backup/privacy/entitlement behavior is never disabled by cost pressure.

## 5. What neither option approves

Neither option approves provider onboarding, credentials, contracts, budget increases, live
payments, production AI, marketing spend, public access, deployment, DNS, or launch. Those remain
behind their existing Owner and release gates.

## 6. Recorded response and remaining decision

The Owner approved Option A exactly as recommended on 2026-08-02. D-106 records that approval and
the resulting safe-off boundary.

The same message requested RIT-127 completion, but Option A explicitly keeps that task Blocked. To
complete RIT-127, the Owner must supersede Option A by replying with `Choose OWN-005 Option B` plus
the completed exact table or an approved attached policy artifact.

Until Option B is recorded and its runtime evidence passes, the system remains safe-off and RIT-127
remains Blocked.
