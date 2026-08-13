# RITUVIA RIT-162 Deletion Audit

**Date:** 2026-07-31

**Task:** RIT-162

**Authority:** D-095 and `docs/25_PRODUCT_ENGINEERING_RUNBOOK.md` section 10

**Method:** exact file, caller, durable-obligation, route, flag, test, record, evidence, and rollback
review before any deletion

## Result

Only two files meet every removal condition. All local-checkout, compatibility, provider, privacy,
migration, replay, and current-state candidates with unresolved or active obligations remain in the
repository. This is a small reversible cleanup, not a rewrite and not a deletion-by-line-count
exercise.

## Approved removals

| File | Caller evidence | Durable obligations | Mechanical references | Rollback |
| --- | --- | --- | --- | --- |
| `apps/worker/src/job-observability.ts` | No static import, dynamic import, package entry, runtime entry, or test caller. `apps/worker/src/main.ts` composes the active payment, subscription, and reconciliation loops directly; `apps/worker/package.json` starts `dist/main.js`. | No route, flag, database, migration, replay, export, deletion, audit, or production-recovery contract. | Two allowlist exceptions in `scripts/architecture-policy.ts` and its checksum entry only. | Restore the file and two exact exceptions from Git, then rebuild. |
| `docs/reports/RITUVIA_MVP_TEAM_HANDOFF_ZH_2026-07-18.md` | No code, record, documentation-index, or build authority points to the report path. | The authoritative byte-identical copy remains at `docs/codex/rituvia-production-2026-07-23/source/RITUVIA_MVP_TEAM_HANDOFF_ZH_2026-07-18.md` and remains fixed by the production-pack manifest. | Its checksum entry only. | Restore the duplicate from Git; authority remains unchanged throughout. |

Before deletion, both handoff files had SHA-256
`3f2a5c338a272456109296df9114cf6012d01f96254ae188292b5fa8f1c7ff01` and `cmp` reported exact
byte equality.

## Quarantine

The following paths are frozen from product expansion but are not dead:

- Local checkout page, component, completion route, local payment webhook, local hosted-checkout
  adapter, commerce branch, provider branch, configuration, proxy, routing, and reviewed copy. They
  remain active runtime paths and carry signed event, idempotency, ledger, entitlement, replay, test,
  and privacy-export obligations.
- `apps/worker/src/revisit-reminder.ts`. It is not composed by the current Worker entry, but direct
  tests, persistent queue schema, template/version replay, and privacy-deletion verification still
  depend on it.
- `apps/web/server/birth-profile.ts` and
  `apps/web/server/astrology-location-time-zone.ts`. They are production-safe-off but retain
  encrypted CRUD, replay, tombstone deletion, export, and deterministic runtime-provenance duties.

These files may be revisited only after their whole caller and durable-data clusters are explicitly
retired. Current environment isolation is not equivalent to deletion approval.

## Consolidate before removal

- `apps/web/server/reflection-loop.ts` contains overlapping V1/V2 projections, but current
  intention, ritual, journal, Revisit, history, and privacy flows still read them. Migrate every
  reader and prove historical replay before removing either projection.
- `apps/web/app/_components/resilient-state.tsx` is a small wrapper, but error and connection states
  still call it. Consolidation must preserve keyboard, screen-reader, retry, offline, and reduced-
  motion behavior.
- `apps/web/server/numerology-interpretation-artifacts.ts` is test-only at runtime but still builds
  reviewed prompt, fallback, source, and safety artifacts for a safe-off AI boundary.
- `ENGINEERING_BASELINE.md` and `QA_REPORT.md` are stale current-status surfaces but remain explicit
  compiled-manual inputs. Remove them only after the manual manifest and remaining historical
  references have a reviewed replacement.

## Keep

- `apps/web/server/tarot-reading-state.ts` retains current and historical tarot catalogs for new
  draws and exact replay.
- `packages/domain/src/ritual.ts`, the legacy history route, and related persistence/export/delete
  paths retain explicit `historical_replay_only`, `journal_legacy`, and `ritual_legacy` obligations.
- All existing migrations and database verification scripts remain immutable evidence.
- Stripe hosted checkout remains the approved Test Mode provider boundary; production activation
  stays separately gated.
- `PROJECT_STATUS.md`, the generated compiled manual, and the production source-of-truth pack remain
  current authorities or generated evidence.

## Post-removal gates

Run the narrowest checks first:

1. Worker typecheck/build and architecture policy.
2. Record, generated-evidence, documentation-link, and whitespace checks.
3. Full workspace build.
4. Retained full-loop browser acceptance with zero payment request, serious/critical Axe violation,
   unexpected request, private leak, console/page error, layout failure, or touch-target failure.

The patch does not change user-visible behavior, database schema, persisted data, golden
screenshots, provider settings, deployment, DNS, or production activation.

All four gate groups passed after removal: Worker typecheck/build, architecture and 54 mutation
tests, record/generated/link/diff validation, the 121-artifact workspace build, and the six-stage
production-artifact core loop.
