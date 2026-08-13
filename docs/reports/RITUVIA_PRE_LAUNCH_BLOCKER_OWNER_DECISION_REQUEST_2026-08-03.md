# RITUVIA Pre-Launch Blocker Owner Option Pack

> Date: 2026-08-03
>
> Current recommendation: approve the bounded staging preparation package below; keep production
> deployment on HOLD until Gate H evidence passes.
>
> This document authorizes only the exact selected scope. It never converts planned work into
> completed evidence and never authorizes public launch by implication.

## 1. Current truth

RIT-168 now closes the repository-local invite admission/revocation contract. Release remains
blocked by exact RIT-127 Option B budget authority and atomic runtime enforcement, a persistent
protected staging environment, actual invitation execution, provider restore evidence, external
monitoring/paging/status evidence, external security evidence, all eight Gate H controls, and a
final separate Owner production-deployment approval.

The options below resolve the decisions needed to start that work. Provider account creation,
payment, DNS, credential placement, contracts, staging deployment, scans, and restore drills remain
human-gated execution steps and produce evidence only after they actually run.

## 2. BUDGET — RIT-127 Option B

### Option A — Approve exact protected-staging budget (recommended)

Approve `cost-budget.protected-staging.v2` only for `protected_staging`, USD, no FX conversion and
no carryover, effective `2026-08-04T00:00:00Z` through `2026-09-03T00:00:00Z`:

- hard monthly authority: USD 100;
- exact rolling 24-hour internal reservation cap: USD 3.25, with fixed subscriptions amortized by
  UTC day;
- warn at 80%; reject new non-essential reservations at 100%; never disable safety, privacy,
  payment integrity, backup, or already-paid entitlement controls;
- exact daily allocation: Web USD 0.45; Worker USD 0.45; PostgreSQL USD 0.65; backup/restore USD
  0.15; object storage USD 0.10; edge protection USD 0.85; external monitoring USD 0.30; hosted
  DAST USD 0.20; alert delivery USD 0.10;
- AI generation, payment activation, marketing, fraud vendors, paid email, and every unlisted line:
  USD 0 and deny-by-default;
- warning actions: alert and annotate; limit actions: pause hosted DAST, reduce non-critical Worker
  concurrency, and reject new non-essential spend;
- required durable flow: PostgreSQL-atomic reserve, commit, release, expiry recovery, invoice
  reconcile, price-drift detection, and idempotency;
- fixed alerts: `COST-BUDGET-WARN`, `COST-BUDGET-EXHAUSTED`, `COST-UNBUDGETED`,
  `COST-SOURCE-STALE`, `COST-PRICE-DRIFT`, `COST-RESERVATION-STUCK`, `COST-RECONCILE-LATE`, and
  `COST-ALERT-DELIVERY-FAILED`;
- Warning destination: Owner email plus push, four-hour acknowledgement; Critical destination:
  Owner phone plus email plus push, 15-minute acknowledgement; duplicate key is alert,
  environment, and budget window; every recovery sends a recovery event.

Approval supersedes D-106 only for this exact protected-staging window and authorizes RIT-127
implementation. It does not activate any provider or approve production spend.

### Option B — Higher staging ceiling

Approve the same contract with USD 500/month and USD 16.25/24 hours. This reduces procurement
friction but permits materially more unproven recurring spend. Not recommended before Gate H.

### Option C — Keep current safe-off posture

Keep USD 0. RIT-127 remains Blocked and standing staging/Gate H cannot complete.

## 3. STAGING — Persistent protected environment

### Option A — Render + Cloudflare protected staging (recommended)

Authorize procurement/provisioning within the approved budget: one paid Render Web service, one
paid Render Worker, one paid Render PostgreSQL instance with provider backups/PITR, no Redis unless
measured evidence requires it, and a Render Blueprint for reproducibility. Place the approved
staging hostname behind Cloudflare Pro WAF/rate limiting. Use staging-only secrets, databases,
buckets, monitors, provider sandbox credentials, synthetic users, `noindex`, robots disallow, and
deny-by-default invitation ingress.

Render documents separate Web/Worker service types and paid PostgreSQL point-in-time recovery;
Cloudflare documents managed WAF rules on Pro and plan-specific rate limiting. Review current terms
at execution: [Render service types](https://render.com/docs/service-types),
[Render PostgreSQL backups](https://render.com/docs/postgresql-backups),
[Render Blueprint specification](https://render.com/docs/blueprint-spec),
[Cloudflare plans](https://www.cloudflare.com/plans/),
[Cloudflare managed rules](https://developers.cloudflare.com/waf/managed-rules/), and
[Cloudflare rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).

### Option B — Existing approved cloud accounts

Use an existing Owner-controlled cloud and edge account only if it can satisfy the same isolation,
PITR, WAF, evidence, rollback, and cost contract. This avoids a new vendor but requires a provider-
specific plan before execution.

### Option C — Continue ephemeral/local rehearsal

Spend remains minimal, but it cannot prove standing staging, external ingress, provider restore,
external monitoring, DAST, or Gate H.

## 4. DOMAIN — Protected-staging hostname

### Option A — Use an existing cleared Owner-controlled domain (recommended)

Authorize one non-public staging subdomain after confirming ownership and name clearance. Configure
DNS only during the separately reviewed staging execution. This keeps cost and legal surface small.

### Option B — Buy a neutral staging-only domain

Authorize up to USD 25/year after basic naming clearance. The exact name, registrar, registrant,
DNS records, and renewal posture require Owner confirmation before purchase.

### Option C — Use only the provider hostname

Acceptable for initial deployment rehearsal, but not enough to close the final Cloudflare
edge-control evidence.

## 5. INVITE — Execute the 25-seat protected cohort

### Option A — Manual 5 + 10 + 10 waves (recommended)

Authorize trained operator issuance using `pnpm beta:invite`, seven-day expiry, one private
one-to-one human delivery channel, and reviewed pause points after 5, 15, and 25 issued seats. Never
put the raw invite in email automation, tickets, shared spreadsheets, URL parameters, analytics, or
the repository. Revoke suspected disclosures immediately. Start execution only after standing
staging, edge protection, alerting, support readiness, and the first Gate H dry-run entry criteria
pass.

### Option B — One 25-seat wave

Faster, but concentrates support, abuse, and incident risk. Not recommended.

### Option C — Do not issue yet

The repository contract remains ready, but no Beta users can enter and invitation execution
evidence remains absent.

## 6. RESTORE — Provider recovery evidence

### Option A — Isolated Render PITR drill (recommended)

Use paid Render PostgreSQL PITR to restore the latest eligible staging point into a new isolated
database, never over the source. Target RPO no more than 15 minutes and measured RTO no more than
four hours; run integrity/privacy checks, application smoke tests, invite-revocation checks, and
document cleanup. Render states that PITR creates a new isolated database and the newest ten-minute
window is unavailable as a restore target: [Render PostgreSQL backups](https://render.com/docs/postgresql-backups).

### Option B — Backup-only restore

Cheaper but produces a coarser RPO and weaker incident evidence. Accept only if PITR is unavailable
and Gate H records the reduced recovery objective.

### Option C — Keep local logical restore only

RIT-123 local evidence remains useful but provider restore and Gate H stay incomplete.

## 7. MONITOR — External monitoring, paging, and status

### Option A — Better Stack bounded monitoring (recommended)

Start with Better Stack Free if its current limits still cover ten monitors/heartbeats, one status
page, and one responder. Monitor only health/readiness, intake/session aggregate availability,
Worker heartbeat, database reachability, restore freshness, and certificate/edge health. Send no
private body, invite, cookie, journal, question, or birth data. Prove Warning email/push and Critical
phone/email/push delivery; upgrade only if the Critical phone path requires a paid responder.
Current provider references: [Better Stack pricing](https://betterstack.com/pricing),
[monitor creation](https://betterstack.com/docs/uptime/monitoring-start/),
[status reports](https://betterstack.com/docs/uptime/creating-status-report-and-status-update/), and
[escalation policies](https://betterstack.com/docs/uptime/escalation-policies/).

### Option B — Provider-native monitoring only

Fewer vendors, but weaker independent detection and status/paging separation. Not recommended for
Gate H.

### Option C — Repository/local checks only

No external detection, paging, or status evidence; Gate H remains incomplete.

## 8. SECURITY — Hosted DAST and independent review

### Option A — Probely Free plus independent manual penetration test (recommended)

Run hosted DAST only against synthetic protected staging, then procure three fixed-scope quotes for
an independent authenticated Web/API penetration test with one included retest. Authorize a
one-time quote ceiling of USD 5,000; the final vendor, contract, data-processing terms, exact scope,
test window, source/IP allowlist, and credentials require a separate Owner confirmation. Probely
currently advertises a free tier with five scan hours/month:
[Probely pricing](https://probely.com/pricing/).

### Option B — Pentest-Tools hosted DAST plus manual review

Authorize WebNetSec and the same independent manual test process. Current pricing starts around USD
140/month, so it needs a larger recurring budget:
[Pentest-Tools pricing](https://pentest-tools.com/pricing).

### Option C — Internal/repository testing only

The repository security matrix remains useful, but independent DAST/penetration evidence and Gate
H stay incomplete.

## 9. GATE H — Evidence campaign

### Option A — Authorize bounded staging evidence campaign (recommended)

Authorize the team to execute, without production access, the exact eight RIT-129 controls:
immutable release/CI provenance; protected standing staging and ingress; Beta SLO/alert delivery;
provider PITR restore; support/admin operational exercise; RIT-128 staging Game Day; hosted DAST
plus independent penetration/retest; and release/rollback rehearsal. Require fresh, digest-bound,
private evidence and zero unresolved Critical/High findings. Gate H is passed only when the
projector derives `complete`; no person may manually override it.

### Option B — Partial campaign

Run selected controls for learning. Useful, but Gate H remains incomplete.

### Option C — Defer

No deployment or launch approval can follow.

## 10. DEPLOY — Owner production deployment approval

### Option A — HOLD until Gate H passes (recommended)

Do not approve production deployment now. After all eight Gate H controls pass, return with the
immutable release digest, migration/restore result, external security closure, rollback evidence,
known risks, exact production configuration, and one separate `DEPLOY-GO` / `DEPLOY-NO-GO` request.

### Option B — Prepare production plan only

Allow provider-neutral plan and evidence-template work, but no resource creation, migration, DNS,
deployment, or public access. This is compatible with Option A.

### Option C — Deploy now

Rejected as unsafe: Gate H, provider restore, external monitoring/security, and exact budget
enforcement are not yet proven.

## 11. Recommended approval text

The Owner can approve the recommended bounded path by replying exactly:

```text
批准 2026-08-03 上线阻塞 Option Pack：
BUDGET-A；STAGING-A；DOMAIN-A；INVITE-A；RESTORE-A；MONITOR-A；SECURITY-A；GATE-H-A；DEPLOY-HOLD。
授权上限：经常性 USD100/月（仅 protected_staging，2026-08-04T00:00:00Z 至 2026-09-03T00:00:00Z，无 FX/结转）；独立渗透测试询价上限 USD5000，最终供应商/合同另行确认。
```

If no cleared existing domain is available, replace `DOMAIN-A` with `DOMAIN-B` and add:

```text
另授权中性 staging-only 域名采购上限 USD25/年；具体名称、注册商、注册主体、DNS 和续费另行确认。
```

## 12. What approval does and does not do

Approval of the recommended text supersedes D-106 only for the exact protected-staging budget
window, authorizes implementation of RIT-127 atomic controls, and authorizes separately reviewed
staging procurement/evidence execution within the stated caps. It does not itself create accounts,
accept provider terms, place credentials, change DNS, issue invitations, scan a host, restore a
database, pass Gate H, migrate production, deploy, or launch. Each execution must be recorded as
actual evidence, and production remains on HOLD until a later explicit Owner `DEPLOY-GO` decision.
