# RIT-120 Owner Operations Dashboard

## 1. Purpose and status

This runbook operates the private `owner-operations.v1` daily surface. It summarizes eight domains:

1. service health and incidents;
2. revenue, payments, refunds, and disputes;
3. core loop and retention;
4. AI cost, quality, and safety;
5. queues, reconciliation, and backups;
6. support, privacy, and safety cases;
7. cost and approved budgets;
8. release evidence and approvals.

The dashboard is a source-labelled summary, not a replacement for detailed source systems and not
a production control plane. Its current release status is **local/private only**.

## 2. Entry point and button location

There is **no Web route, navigation item, Support button, or Admin Dashboard button** for this
surface. That omission is intentional: the repository does not yet have the complete protected
admin read-authentication, audit, no-store/noindex, staging, and browser-security evidence needed
to expose it safely.

The exact entry point is the repository command:

```bash
pnpm report:owner-operations \
  --as-of 2026-08-02T02:00:00.000Z \
  --input /absolute/private/path/owner-operations-input.json \
  --output-json /absolute/private/path/owner-operations-dashboard.json \
  --output-markdown /absolute/private/path/owner-operations-dashboard.md
```

The two output paths must not already exist. Both files are created with mode `0600`. Open the
Markdown output in Codex's right sidebar for the daily Owner review.

## 3. Required manifest

The input is one bounded regular JSON file. Top-level fields are exact:

- `schemaVersion`: `owner-operations-snapshot.v1`;
- `capturedAt`: UTC instant no later than `--as-of`;
- `environment`: `local`, `ci`, `protected_staging`, or `production`;
- `release`: candidate and release-gate state;
- `sections`: all eight section IDs exactly once in canonical order.

Each section contains only a fixed `detailCode`, `id`, categorical `state`, and source envelope.
The source envelope contains `kind`, `observedThrough`, optional exact window, approval reference,
and repository evidence path. It must never contain a question, reading, journal, prayer, birth
data, email, wallet/address, payment payload, provider error, user/session identifier, or arbitrary
operator note.

Allowed source kinds are:

| Source kind | Meaning | Display rule |
| --- | --- | --- |
| `durable_operational_aggregate` | Reviewed durable aggregate | Display only while current |
| `local_verification` | Bounded repository/local test evidence | Label local/CI; never claim production |
| `owner_approved_record` | Named decision/approval record | Requires exact `D-###` or `OWN-###` reference |
| `synthetic_fixture` | Synthetic test evidence | Force state to `unknown` |
| `unavailable` | No qualifying source | All source evidence fields are null; state is `unknown` |

## 4. Freshness and truth rules

Maximum source ages are fixed by section: health, queue, and support `1` hour; revenue, core loop,
AI, and cost `30` hours; approvals `168` hours.

- Missing evidence is `unavailable`.
- Future or expired evidence is `stale`.
- Synthetic evidence is `synthetic` even when its timestamp is recent.
- Unavailable, stale, or synthetic evidence always renders state `unknown`.
- `unknown` never means zero, healthy, empty, or safe to launch.
- `not_applicable` is allowed only from an Owner-approved record, such as D-097 excluding real
  commerce and production AI from the free protected Beta.

## 5. Current section interpretation

| Section | Current truthful state | What is missing |
| --- | --- | --- |
| Health | Blocked/local evidence only | Standing staging sampler, external monitoring, incident feed |
| Revenue | Not applicable to approved free Beta | Production revenue/refund/dispute aggregate |
| Core loop | Local loop verified; production metric unknown | Durable consented analytics and retention denominator |
| AI | Production AI not applicable to approved free Beta | Approved provider aggregate, quality/safety/cost evidence |
| Queue | Local controls and RIT-128 game day verified | Standing queue, reconciliation, backup, and provider monitor |
| Support | Metadata case kernel locally verified | Production contact/SLA, delivery, operator monitor |
| Cost | Attention/local simulation only | D-106 Option A is safe-off; exact Option B, durable atomic reservation/reconciliation, provider aggregates, and alert delivery remain missing |
| Approvals | Blocked | D-106 approved OWN-005 Option A and D-104 approved OWN-019; RIT-127, standing staging, external security evidence, and a separate deployment approval remain |

## 6. Release panel and sequence

The release panel must show, not hide, the current sequence:

1. **OWN-019 — Done under D-104:** use the exact `own-019.protected-beta-abuse.v1` limits, invited
   cohort, allowlist/edge controls, observation window, and rollback thresholds without drift.
2. **RIT-127 — Blocked:** D-106 approves Option A safe-off; exact Option B plus durable atomic
   reservation/reconciliation and fixed alert delivery remain missing.
3. **RIT-128 — Done locally:** the fixed repository-local security, payment, AI, notification,
   outage, restore, and dependency matrix passes with zero open scoped Critical/High findings.
4. **RIT-130 — Planned:** after blocked RIT-127 closes, assemble protected-Beta release evidence,
   invite controls, support, metrics, known risks, rollback, standing staging, and
   independent-security evidence. D-104 satisfies its Owner-policy dependency but does not deploy.

`decisionStatus=evidence_ready` still does not authorize deployment. The report always displays
`owner_deployment_approval_required`.

## 7. Daily review workflow

1. Collect only reviewed aggregate or categorical evidence from the named source systems.
2. Record the correct environment and observed-through time; never reuse a local timestamp as
   staging or production evidence.
3. Set unsupported sections to `unavailable` instead of entering `0`.
4. Generate new exclusive outputs; do not overwrite yesterday's evidence.
5. Verify the input digest and review blocked/attention/unknown sections first.
6. Open the named evidence and runbook for each exception.
7. Do not perform provider, deployment, refund, support-send, or launch actions from this report.
8. Retain or delete local reports under the applicable approved evidence-retention policy; do not
   commit private runtime outputs.

## 8. Failure and recovery

- Invalid/private/extra fields: generation fails before writing either output.
- Missing/stale/synthetic source: report generates but forces the section to `unknown`.
- Existing output or symlink: generation fails without overwriting the existing evidence.
- Partial write: the generator closes handles and removes only the files it created in that attempt.
- Wrong environment or approval: correct the source manifest; do not edit the generated report.
- Suspected private-data exposure: stop, isolate the local artifact, follow the incident runbook,
  and do not attach the artifact to issues, logs, analytics, or public repositories.

## 9. Verification

Run the narrowest checks first:

```bash
pnpm --filter @rituvia/analytics typecheck
pnpm exec vitest run \
  packages/analytics/test/owner-operations.test.ts \
  tests/owner-operations-dashboard.test.ts
pnpm check:owner-operations
```

Ordinary task closure also runs formatting, linting, workspace typecheck, architecture/evidence,
affected tests, build, and generated-evidence checks. RIT-120 does not complete Gate H.

## 10. Rollback

Remove the additive projection, generator, verifier, tests, and documentation. Delete local private
outputs if no retention obligation applies. No database, provider, environment, or production data
mutation is part of this feature.
