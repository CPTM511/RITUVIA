# RITUVIA Product Engineering Runbook

## 1. Purpose

This runbook owns implementation navigation for the D-095 core-loop convergence stage. It keeps
routes, modules, commands, test evidence, and frozen-scope rules out of the plain-language user
guide.

It does not override `AGENTS.md`, `DECISIONS.md`, the production source-of-truth pack,
`PROJECT_STATUS.md`, or `BACKLOG.md`.

The evidence-gated launch sequence lives in `docs/26_PRE_LAUNCH_EXECUTION_PLAN_ZH.md`. The exact
user-facing route, control-location, workflow, implementation, privacy, and recovery inventory lives
in `docs/27_DETAILED_PRODUCT_USER_MANUAL_ZH.md`; this runbook must not duplicate or contradict it.

## 2. Current engineering outcome

The sole active product outcome is:

`Question/theme -> Interpretation -> Intention -> Small action -> Free ritual -> Private reflection -> Revisit`

The journey must remain anonymous-first, payment-free, accessible, private by default, and useful
without production AI.

## 3. Current repository route path

| Stage | User route | Main UI ownership |
| --- | --- | --- |
| Product entry | `/en` | `apps/web/app/[locale]/page.tsx` |
| Approved primary safety intake | `/en/intake` | `apps/web/app/_components/question-intake-form.tsx` |
| Primary reading | `/en/tarot/one-card` | `apps/web/app/_components/tarot-one-card-flow.tsx` |
| Intention, action, ritual, journal | `/en/sanctuary` | `apps/web/app/_components/sanctuary-flow.tsx` |
| Review | `/en/revisit` | `apps/web/app/_components/revisit-experience.tsx` |

The three-card, numerology, account, sharing, and public education routes may remain operational,
but they are not current-stage expansion targets. Astrology, commerce, production AI, and external
delivery remain frozen or approval-gated.

These are current repository paths, not a replacement for the production route contract. RIT-166
implements D-097: both homepage one-card entries use intake, an allowed categorical theme transfers
once through `question-intake-theme-handoff.ts`, and direct one-card URLs remain valid. Production
accepts only activation reference `own-009.question-intake.en.v1`; missing or near-match references
fail closed without a homepage bypass.
The production pack still requires future Readings, Daily Tarot, standalone Journal, Account
Billing, Account Orders, Account Privacy, and About destinations. D-095 freezes their implementation
sequence. D-097 separately supersedes prepaid-Credit production product details with direct sale
without required preload; it does not activate a paid offer.

## 4. Architecture path

```text
Next.js page and component
        -> same-origin route handler
        -> apps/web/server composition
        -> framework-independent domain package
        -> PostgreSQL through reviewed persistence
        -> worker only where durable asynchronous work is required
```

Keep the modular monolith. Do not create a new service, parallel domain model, replacement frontend,
or second persistence path during convergence.

## 5. Core implementation ownership

| Concern | Primary location |
| --- | --- |
| User-facing English messages | `apps/web/app/_i18n` |
| Shared locale and ICU contracts | `packages/i18n` |
| Tarot facts and reviewed content | `packages/divination` |
| Intention and reflection contracts | `packages/domain` |
| Accessible primitives | `packages/ui` |
| Web composition and privacy boundaries | `apps/web/server` |
| Persistence and migrations | `packages/db` |
| Core browser verification | `scripts/verify-full-loop-browser.mjs` |

Domain facts must not move into React components. UI code must not decide draws, prices,
eligibility, entitlements, or persistence ownership.

## 6. Frozen engineering scope

Do not start new implementation for:

- payment, subscription, refund, dispute, or commerce-admin capability;
- production model/provider calls or additional AI interpretation products;
- astrology creation, provider data, or runtime activation;
- additional locale publication or country activation;
- new SEO/GEO content inventories;
- provider, queue, cache, or service extraction not required by the retained journey.

Permitted work inside frozen areas is limited to security fixes, privacy fixes, dependency safety,
data recoverability, disabling unsafe behavior, and changes required to keep the retained journey
building and testing.

## 7. Local startup

Use the repository-pinned Node.js and pnpm versions.

For a fresh local environment:

```bash
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:setup
```

Run local configuration once, only when `.env.local` does not already exist:

```bash
pnpm mvp:local:configure
```

Build and start the Web application:

```bash
pnpm --filter @rituvia/web build
pnpm --filter @rituvia/web start -H 127.0.0.1 -p 4175
```

Do not rerun local configuration over an existing `.env.local` unless rotating local-only keys is an
explicit task outcome.

### Protected-Beta abuse policy

`pnpm mvp:local:configure` writes the local-only acceptance policy:

```text
RITUVIA_PROTECTED_BETA_ABUSE_POLICY_VERSION=local.protected-beta-abuse.v1
RITUVIA_PROTECTED_BETA_MUTATION_LIMIT=120
RITUVIA_PROTECTED_BETA_MUTATION_WINDOW_SECONDS=86400
RITUVIA_QUESTION_INTAKE_RATE_LIMIT=12
RITUVIA_QUESTION_INTAKE_RATE_WINDOW_SECONDS=60
```

All five values are one fail-closed configuration unit. Do not copy local thresholds into
production. D-104 approves the exact `own-019.protected-beta-abuse.v1` cohort, invite,
allowlist/edge, observation, and rollback profile for RIT-130 standing-staging evidence only. A
missing/drifted policy or unavailable least-privilege database authority must make protected
intake and anonymous mutations unavailable rather than silently bypass admission. D-104 does not
select an edge provider, install credentials, deploy, change DNS, or authorize launch.

The database guard is per active anonymous session, stores at most two fixed-scope rows, and stores
no private text, IP, user agent, device identifier, or fingerprint. It complements rather than
replaces the global anonymous-session issuance cap and RIT-130 protected ingress controls.

### Provider-free staging and Gate H evidence

RIT-129 has no Web/Admin Button or HTTP route. Run `pnpm check:staging-gate-h` from the repository to
verify the contract. Use `pnpm report:staging-gate-h -- <arguments>` for reviewed private input,
then open its Markdown in Codex. Current state is `blocked`/`incomplete` and
`deploymentAuthorized=false`; exact arguments, eight gaps, recovery, and rollback are in
`docs/runbooks/RIT-129_STAGING_GATE_H_EVIDENCE.md`.

### Private Owner operations dashboard

RIT-120 has no HTTP route or Admin Button. Generate the private daily overview from one strict
source manifest:

```bash
pnpm report:owner-operations \
  --as-of 2026-08-02T02:00:00.000Z \
  --input /absolute/private/path/owner-operations-input.json \
  --output-json /absolute/private/path/owner-operations-dashboard.json \
  --output-markdown /absolute/private/path/owner-operations-dashboard.md
```

The manifest must contain all eight canonical sections. Missing, stale, future, or synthetic
sources become `unknown`; never enter a guessed zero. Outputs are exclusive mode-0600 files and
must not be committed when they contain runtime evidence. See
`docs/runbooks/RIT-120_OWNER_OPERATIONS_DASHBOARD.md` for the exact input, daily review, failure,
release-gate, and rollback workflow.

### Private cost guardrail simulation

RIT-127 has no HTTP route or Admin Button. Generate the D-105 safe-off simulation with:

```bash
pnpm report:cost-guardrails -- \
  --as-of 2026-08-02T02:30:00.000Z \
  --input /absolute/private/path/cost-guardrail-input.json \
  --output-json /absolute/private/path/cost-guardrail-report.json \
  --output-markdown /absolute/private/path/cost-guardrail-report.md
```

The v1 input accepts only finite provider/feature codes and `unavailable` or `proposed_policy`.
Decision status remains blocked, non-essential spend stays denied, and no runtime action executes.
See `docs/runbooks/RIT-127_COST_GUARDRAILS.md`; D-106-approved Option A preserves safe-off, while
exact Option B and atomic runtime/alert evidence remain the RIT-127 blocker.

### Incident and provider failure game day

RIT-128 also has no Web/Admin Button or HTTP route. Run the fixed repository-local matrix manually:

```bash
pnpm test:incident-game-day
```

The command covers security, read-only containment, AI failure, payment reconciliation/webhook
replay, notification failure, database kill-switch/restore, architecture, and secrets using
synthetic fixtures and isolated PostgreSQL. It never contacts a live provider. See
`docs/runbooks/RIT-128_INCIDENT_GAME_DAY.md` and
`docs/reports/RITUVIA_RIT_128_INCIDENT_GAME_DAY_2026-08-02.md`. Passing it does not complete standing
staging, provider-level restore, external paging/DAST/pentest, Gate H, deployment, or launch.

### Codex recurring reviews

RIT-126 has no RITUVIA Web/Admin Button or HTTP route. In Codex Desktop open **Automations**, then
select `RITUVIA daily maintenance`, `RITUVIA weekly product review`, or
`RITUVIA monthly risk audit`. D-108 approves OWN-020 Option A, so all three cards must remain
**Paused**. Use **Edit** to inspect the schedule/prompt; do not use **Run now** or activate without a
new explicit Owner decision.

The cards are configured for 08:30 daily, 09:30 Monday, and 10:30 on day 1 of each month in
Asia/Shanghai. They use local project execution because the current Codex automation surface does not expose hard
read-only worktree execution. The shared runner stops on a dirty checkout and otherwise forbids
writes, external/provider/private access, spend, project-state changes, and gated actions. Exact
contract and recovery: `docs/runbooks/RIT-126_CODEX_AUTOMATIONS.md`.

## 8. Focused verification

Run the narrowest relevant check first:

```bash
pnpm test:full-loop-browser
pnpm test:intention-browser
pnpm test:ritual-browser
pnpm test:revisit-browser
pnpm format:check
pnpm lint
pnpm typecheck
```

Use the complete workspace, browser, and database matrices only for a release candidate, milestone
integration, shared-runtime change, or a focused result that exposes cross-cutting risk.

For documentation and record changes, also run:

```bash
pnpm check:records
pnpm check:generated
```

At ordinary task closure, run the affected tests plus the repository architecture/evidence,
formatting, lint, and type checks required by `AGENTS.md`. `pnpm check:evidence` owns architecture,
environment, generated evidence, localization, records, migration, and secret-scan boundaries; do
not replace it with a hand-maintained partial list.

## 9. Core acceptance contract

The production-artifact browser journey must prove:

- no account is created for an anonymous user;
- no payment request occurs;
- the reading result is fixed and is not redrawn during reveal;
- the intention and ritual tolerate exact retries without duplicate state;
- a free reduced-motion linear ritual can complete;
- a private journal entry can be created and deleted;
- a Revisit can be scheduled, completed, and deleted;
- private values do not enter URL, storage metadata, console, or unexpected requests;
- mobile, keyboard, RTL structure, touch targets, and serious/critical Axe checks pass.

## 10. Delete-candidate procedure

RIT-162 must evaluate exact files, not broad module names. For every candidate:

1. Identify all static and runtime callers.
2. Identify database, migration, replay, export, deletion, audit, and rollback obligations.
3. Identify current routes, flags, tests, records, and generated evidence that depend on it.
4. Classify it as keep, consolidate, quarantine, or remove.
5. Define the smallest reversible patch.
6. Run focused tests before broader architecture, build, and core-loop gates.
7. Update owner capability state and user-visible guidance only when behavior changes.

Do not measure success by deleted lines alone. Success is a smaller change surface with the same or
better core user result, privacy, accessibility, safety, and recoverability.

The completed RIT-162 dependency matrix is recorded in
`docs/reports/RITUVIA_RIT_162_DELETION_AUDIT_2026-07-31.md`. It approves only the exact uncalled
Worker wrapper and byte-duplicate report; all candidates with active callers or durable obligations
remain kept, quarantined, or consolidation-only.

## 11. Scope reactivation

A frozen area returns to active work only through an Owner-approved decision and a backlog task with
a user outcome, exact scope, dependencies, failure states, tests, risk, and rollback. Production
activation continues to require every existing human approval gate.

## 12. Existing operational authorities

Do not duplicate these contracts in this runbook:

- Environment isolation and promotion: `docs/21_ENVIRONMENT_CONTRACT.md`.
- Launch, go/no-go, and rollback: `docs/15_LAUNCH_RUNBOOK.md`.
- Backup and recovery: `docs/22_BACKUP_RECOVERY.md`.
- Production architecture, security, payments, AI, testing, and readiness: read the dated production
  pack from `docs/codex/rituvia-production-2026-07-23/00_START_HERE.md` in its required order.
- Payment/provider safe-off, Button locations, no-fallback boundary, recovery, and rollback:
  `docs/runbooks/RIT-075_PAYMENT_PROVIDER_CONTROLS.md`.
