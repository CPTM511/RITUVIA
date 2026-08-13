# RITUVIA RIT-129 Staging and Gate H Evidence Result

> Date: 2026-08-02
>
> Scope: provider-free repository contract only
>
> Gate H: incomplete
>
> Deployment/provider actions: 0

## 1. Outcome

RIT-129 adds one strict local contract that binds a protected-Beta candidate, exact D-104 ingress
profile, eight fixed operational/security controls, evidence file digests, source environment,
revision, freshness, and fail-closed derived status. It does not accept a caller-supplied Gate H
completion flag.

The current repository check passes while truthfully returning `blocked`, Gate H `incomplete`, and
`deploymentAuthorized=false` because the required external and standing-staging evidence does not
exist.

## 2. Implemented evidence boundary

- Exact candidate revision/worktree, pinned Node/pnpm, artifact/configuration/lockfile/Corresponding
  Source digests, isolated staging profile, and D-104 policy values are validated.
- Required evidence kinds are environment-specific; local/CI records cannot masquerade as standing
  staging, provider restore, operational aggregate, staging drill, DAST, or penetration test.
- Evidence files must be bounded regular non-symlink `docs/` or `records/` JSON/Markdown, and their
  actual SHA-256 must match the manifest.
- Missing, stale, future, failed, dirty, drifted, unknown, or digest-mismatched evidence cannot
  become passed.
- Private JSON/Markdown outputs are mode `0600`, exclusive-create, and never authorize deployment.

## 3. Current eight-control result

| Control | Repository/local evidence | Required missing evidence | State |
| --- | --- | --- | --- |
| Protected staging configuration | environment contract | standing-staging attestation | blocked |
| Invite ingress | D-104 exact Owner policy | protected-staging invite/edge drill | blocked |
| Aggregate monitoring/alerts | RIT-124 six-SLO evaluator | current staging aggregate and alert delivery | blocked |
| Provider backup/PITR/restore | local logical restore contract | provider-level isolated restore attestation | blocked |
| Kill switch/outage | RIT-128 local Game Day | standing-staging drill | blocked |
| Independent security | RIT-121 threat model | hosted DAST and independent pentest/retest | blocked |
| Support/refund/admin/audit | RIT-125 local metadata kernel | standing-staging operator drill | blocked |
| Rollback/evidence preservation | launch runbook | standing-staging rollback drill | blocked |

## 4. Verification

- `pnpm --filter @rituvia/observability typecheck` passes.
- The focused Vitest run passes two files and eight tests.
- `pnpm check:staging-gate-h` builds the observability package and verifies all eight current
  blockers, digest binding, derived Gate H state, and persistent Owner gate.
- Generator tests cover mode `0600`, exclusive output, digest mismatch, symbolic-link rejection,
  and private Markdown/JSON output.
- Contract tests cover complete evidence-ready projection, dirty/WORKTREE suppression, stale and
  failed evidence, environment masquerading, unsafe path, unknown field, getter, and D-104 threshold
  drift rejection.

The complete pinned Node.js 26.5.1 / pnpm 11.13.1 `pnpm check` gate exits successfully, including
records, architecture, secret, configuration, tests, PostgreSQL, browser/accessibility, and the
16-package production build. The Web build generated 61 pages.

## 5. Independent review

The independent read-only review confirmed that RIT-129 may close only as an evidence-contract
task, not as Gate H completion. It identified the existing Owner dashboard's coarse Gate H
predicate as insufficient by itself and required explicit PITR, failure drill, support/admin,
rollback, artifact/revision, and external-security bindings. The implemented contract adds those
separate controls and does not reuse that predicate.

## 6. Remaining blockers

Standing protected staging, invite/edge enforcement, deployment-wide session capacity, live
aggregate monitors/pager/status delivery, provider PITR/restore, hosted DAST, independent
penetration testing/retest, standing-staging support/admin operation, immutable clean release
candidate, and staging rollback remain unavailable. RIT-127 and RIT-130 also remain blocked in the
release sequence.

## 7. Rollback

Remove the module/export, generator/verifier, package commands, two test files, runbook, this report,
task/decision records, and status references. No external environment, provider, secret, DNS,
customer, payment, or deployment state changed.
