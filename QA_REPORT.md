# RITUVIA Codex Build System — QA Report

**Validated:** 2026-07-17

**Result:** PASS for the imported instruction pack, repository consistency, and the locally verifiable RIT-001 through RIT-009 engineering foundation. Hosted RIT-004 evidence remains owner-gated.

## Checks passed

- All 85 files from the source ZIP were inventoried and read or mechanically compared in full before baseline changes. Before mutation, all 84 archive checksum entries passed.
- All required root, specification, Codex, automation, template, generated-evidence, and retained-reference files exist. Project TOML and JSON parse; repository YAML parses with the host Ruby parser and pnpm accepts the workspace policy.
- Backlog contains 128 unique items: 120 product/engineering tasks and eight owner gates. Dependencies are valid and acyclic; `RIT-000` through `RIT-003`, `RIT-005` through `RIT-007`, and `RIT-009` are Done, `RIT-004` is blocked only by `OWN-008`, RIT-008 remains Planned behind it, and exactly one executable item is Ready: `RIT-010`.
- Ten custom Codex agents contain the required metadata and instructions. Root and nested `AGENTS.md` files remain below the configured 65,536-byte instruction limit.
- Thirty-five representative command-policy cases cover push, force push, destructive Git, recursive deletion, Prisma migration/reset commands, infrastructure changes, production deploys, remote repository mutation, and publishing.
- Local Markdown links resolve inside the package. Historical `LUMORA` text remains confined to retained references and documented migration/baseline contexts. Both retained HTML artifacts pass integrity-size checks and remain non-canonical references.
- `RITUVIA_CODEX_BUILD_MANUAL.md` is deterministically generated from 95 current text sources; `checksums.sha256` covers all 213 intended Git-indexed inputs except itself, without missing, extra, duplicate, or mismatched entries in a clean copy.
- Node.js 24.18.0, pnpm 11.13.1, and direct JavaScript dependencies are exact. The frozen lockfile passes peer, engine, release-age, exotic-subdependency, and install-script allowlist policies; a clean temporary copy installs with `--frozen-lockfile` without changing the lockfile or leaving ignored build scripts.
- Root CI/toolchain, architecture, record, generated-evidence, migration-history, current-tree secret, formatting, ESLint, strict TypeScript, Vitest, configuration-boundary, real PostgreSQL integration, and build gates pass across six workspaces. Two hundred sixteen unit/contract tests run in 20 files; the build verifier checks 22 emitted artifacts, imports built ESM exports, and proves that raw sink, trust-ambiguous continuation, and raw feature-flag construction APIs are absent from general exports.
- The durable record workflow enforces four typed grammars, canonical task/decision authority, reciprocal task dossier and decision graph links, contextual task-result semantics, privacy-safe Markdown, Git-index-only regular-file checksums, and staged exact-order synchronization. CI and mutation tests reject stale, dangling, duplicated, unsafe, unreviewed, or locally untracked evidence.
- The fail-closed architecture gate audits 53 active source files across six modules, including manifests, strict TypeScript inheritance, package exports, runtime roots, AST/JSDoc dependency edges, exact internal/external/Node allowlists, provider ownership, browser/server transitive taint, dynamic loading, descriptor reflection, structured-console shape, raw process output, Worker capability imports, exact feature-flag composition, and file/module cycles. Mutation tests cover the reviewed bypass classes, including injected and dead-code-camouflaged feature-flag sources, and CI invokes the exact architecture command as an independent mandatory step.
- The zero-dependency server-only observability package emits only fixed bounded JSON-line events with service/environment/release/level/correlation/trace fields. Web Crypto creates nonzero server-authoritative IDs; W3C trace validation rejects malformed, uppercase, unsupported, and zero identifiers; spans rotate across JSON-persisted Web → Worker → provider protocol steps; and neither baggage nor tracestate propagates.
- Adversarial telemetry tests prove that unknown private fields, prompts, journal/prayer/birth text, authorization, URLs, raw `Error`, stack/cause, getters, `toJSON`, coercion hooks, revoked/wide proxies, cycles, symbols, `BigInt`, functions, control characters, oversized UTF-8 records, invalid metadata/carriers, duplicate span end, clock reversal, and failing writers cannot leak canaries or alter application flow.
- The typed feature-flag registry is immutable, version-qualified, bounded, server-authoritative, and literal safe-off. Tests cover unknown keys/fields, non-canonical scope, missing approval, scheduled activation, immediate emergency off, expiry/removal, retired tombstones, cleanup-task integrity, and rolling v1/v2 coexistence plus rollback isolation.
- Raw snapshot/evaluator construction is exported only from the exact capability subpath and consumed by one complete-source-pinned, zero-argument Web adapter. The adapter owns runtime configuration and client lifecycle, performs a live PostgreSQL catalog/privilege attestation before reading, and rejects owner, DDL, mutation, superuser/bypass-RLS, missing-SELECT, caller-injected, and ambiguous persistence contexts.
- A real built-Web request returns a fresh `x-request-id`, overrides client correlation/trace/baggage state, passes server-generated context downstream, and emits a correlated `http.proxy_handoff` record without server-only canaries. That span intentionally proves proxy handoff only, not downstream status or full request duration.
- `.env.example` exactly matches the typed server inventory. Production source limits environment reads to reviewed adapters, rejects all `NEXT_PUBLIC_*` variables, excludes secrets from client artifacts and HTTP, and proves sanitized nonzero Web/Worker startup failure plus a real `server-only` negative build.
- The repository-owned PostgreSQL 17 runtime is bound to `127.0.0.1:55432`, uses random mode-0600 SCRAM credentials, data checksums, exact managed HBA/configuration files, an attested cluster fingerprint, and separate non-superuser migrator, read-only runtime, and append-only feature-control roles. Lifecycle operations are directory-lock serialized, including a two-contender stale-lock recovery test.
- Prisma 7.8 generation and `migrate deploy` pass against isolated real databases. The suite proves clean/idempotent migrations and seed, database constraints, forced RLS, exact approved activation, runtime DDL/TRUNCATE denial, control update/delete denial, registry coexistence, transaction rollback, concurrent uniqueness, guarded isolated reset, and a row-security-aware non-empty custom-format dump/restore with exact row comparison and post-restore privilege attestation.
- `db:setup`, the exact-confirmation local development reset, default non-disclosing `db:url`, and `db:stop` pass. No production, preview, staging, remote, or arbitrary ambient database URL is accepted by these lifecycle commands.
- One active GitHub Actions workflow has exact read-only triggers, immutable actions, GitHub-hosted runners, ordered non-skippable steps, synchronized Node/pnpm versions, and no secrets, artifacts, write permissions, or deployment environment. Codex examples live outside the workflow directory.
- A fresh PostgreSQL 17 CI-shaped run proves run-derived exact target guards, checksums, private service addressing, separated non-superuser roles, deterministic client generation, idempotent migration deployment and seed, exact migration inventory/status/drift, feature-flag activation/append-only constraints, registry coexistence, runtime DDL denial, and rollback. Historical migration bytes are compared with the trusted event baseline and dangerous SQL is rejected.
- Current-tree secret policy, repository-independent Gitleaks configuration, full-history scan wiring, and high-severity dependency audit are fail-closed. The current npm audit reports no known vulnerability after exact patched transitive overrides.

## Validation commands

```bash
pnpm check:records
pnpm check:generated
python3 -B scripts/sync_generated_evidence.py --check
shasum -a 256 -c checksums.sha256
codex execpolicy check --pretty --rules .codex/rules/default.rules -- <command...>
pnpm install --frozen-lockfile
pnpm ignored-builds
pnpm check
pnpm test:configuration-boundary
pnpm test:database-foundation
pnpm check:ci-contract
pnpm check:architecture
pnpm check:migrations
pnpm scan:secrets
pnpm audit --audit-level=high
APP_ENV=local pnpm db:setup
APP_ENV=local pnpm db:reset -- --confirm=reset:rituvia_local@127.0.0.1:55432
pnpm db:stop
```

## Limitations

- This validates the specification package and locally executable RIT-001 through RIT-009 foundations. It does not validate a user-facing product flow, payment, AI, accessibility, hosted infrastructure, or a production database.
- The Web proxy handoff is a real local HTTP boundary, but no route wrapper yet measures final downstream status/duration. The Worker continuation subpath and serialized carrier are protocol evidence behind a sealed persistence adapter type; no database outbox, queue, deployed consumer, telemetry vendor, metrics, alerting, sampling, or retention system exists yet.
- The feature-flag control plane has database-level append-only enforcement but no production credential grant, approval-record service, admin endpoint/UI, cache/invalidation policy, or operator emergency workflow. Enabling any gated capability still requires its explicit owner approval and later product task.
- Docker and Podman are absent on the verified host. A native fresh PostgreSQL 17 instance reproduced the CI target contract, but the digest-pinned service image and bridge networking still require the first hosted Actions run.
- The repository YAML parser and actionlint wiring are portable in CI. A JSON Schema meta-validator remains unavailable locally; an exact schema fingerprint plus contextual semantic validation locks the critical task-result contract.
- A durable record status or linked decision does not itself grant approval. Owner gates, qualified review, production actions, and external system evidence remain separately authoritative.
- Command rules are exact positional prefixes and supplement, rather than replace, the owner-approval boundaries in `AGENTS.md`. Reordered flags, aliases, and opaque wrappers still require human review.
- Codex GitHub workflow examples remain intentionally inactive outside `.github/workflows`. The active CI workflow is contract-tested, but remote required-check enforcement and workflow-change protection require owner configuration.
- `RITUVIA` has only a preliminary exact-name web screen; this report does not establish legal clearance, domain availability, or right to use. Payment, crypto, tax, country, astrology-license, content-rights, vendor, and production decisions remain owner- or qualified-reviewer-gated.

## Acceptance result

The repository now has a reproducible strict TypeScript monorepo, a typed server-authoritative configuration boundary, attested local and CI-shaped PostgreSQL/Prisma paths, a fail-closed module architecture contract, a privacy-safe local observability and propagation baseline, a versioned safe-off feature-flag registry with separated activation identities, a machine-checked durable record workflow, and active portable quality, dependency, secret, migration, and build gates. RIT-009 is complete and RIT-010 is Ready; RIT-008 remains Planned behind blocked RIT-004. RIT-004 remains Blocked until the owner provides or approves a GitHub remote, protects all three jobs and workflow changes, and obtains one passing hosted run. Production remains gated by later milestones and explicit owner approvals.
