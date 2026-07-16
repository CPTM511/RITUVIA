# RITUVIA Codex Build System — QA Report

**Validated:** 2026-07-16

**Result:** PASS for the imported instruction pack, repository consistency, and the locally verifiable RIT-001 through RIT-005 engineering foundation. Hosted RIT-004 evidence remains owner-gated.

## Checks passed

- All 85 files from the source ZIP were inventoried and read or mechanically compared in full before baseline changes. Before mutation, all 84 archive checksum entries passed.
- All required root, specification, Codex, automation, template, generated-evidence, and retained-reference files exist. Project TOML and JSON parse; repository YAML parses with the host Ruby parser and pnpm accepts the workspace policy.
- Backlog contains 123 unique items: 115 product/engineering tasks and eight owner gates. Dependencies are valid and acyclic; `RIT-000` through `RIT-003` and `RIT-005` are Done, `RIT-004` is blocked only by `OWN-008`, and exactly one executable item is Ready: `RIT-006`.
- Ten custom Codex agents contain the required metadata and instructions. Root and nested `AGENTS.md` files remain below the configured 65,536-byte instruction limit.
- Thirty-five representative command-policy cases cover push, force push, destructive Git, recursive deletion, Prisma migration/reset commands, infrastructure changes, production deploys, remote repository mutation, and publishing.
- Local Markdown links resolve inside the package. Historical `LUMORA` text remains confined to retained references and documented migration/baseline contexts. Both retained HTML artifacts pass integrity-size checks and remain non-canonical references.
- `RITUVIA_CODEX_BUILD_MANUAL.md` is deterministically generated from 87 current text sources; `checksums.sha256` covers every intended repository file except itself, without missing, extra, duplicate, or mismatched entries in a clean copy.
- Node.js 24.18.0, pnpm 11.13.1, and direct JavaScript dependencies are exact. The frozen lockfile passes peer, engine, release-age, exotic-subdependency, and install-script allowlist policies; a clean temporary copy installs with `--frozen-lockfile` without changing the lockfile or leaving ignored build scripts.
- Root CI/toolchain, architecture, migration-history, current-tree secret, formatting, ESLint, strict TypeScript, Vitest, configuration-boundary, real PostgreSQL integration, and build gates pass across five workspaces. One hundred two unit/contract tests run in eleven files; the build verifier checks 14 emitted artifacts and imports built ESM exports.
- The fail-closed architecture gate audits manifests, strict TypeScript inheritance, package exports, runtime roots, AST/JSDoc dependency edges, exact internal/external/Node allowlists, provider ownership, browser/server transitive taint, dynamic loading, and file/module cycles. Mutation tests cover the reviewed bypass classes, and CI invokes the exact architecture command as an independent mandatory step.
- `.env.example` exactly matches the typed server inventory. Production source limits environment reads to reviewed adapters, rejects all `NEXT_PUBLIC_*` variables, excludes secrets from client artifacts and HTTP, and proves sanitized nonzero Web/Worker startup failure plus a real `server-only` negative build.
- The repository-owned PostgreSQL 17 runtime is bound to `127.0.0.1:55432`, uses random mode-0600 SCRAM credentials, data checksums, exact managed HBA/configuration files, an attested cluster fingerprint, and a non-superuser application role. Lifecycle operations are directory-lock serialized, including a two-contender stale-lock recovery test.
- Prisma 7.8 generation and `migrate deploy` pass against isolated real databases. The suite proves clean and idempotent migration, deterministic/idempotent synthetic seed, database CHECK/unique constraints, transaction rollback, eight-way concurrent uniqueness, guarded isolated reset, custom-format dump/restore into a second isolated database, managed-setting attestation, and absence of a unique failure canary from PostgreSQL logs.
- `db:setup`, the exact-confirmation local development reset, default non-disclosing `db:url`, and `db:stop` pass. No production, preview, staging, remote, or arbitrary ambient database URL is accepted by these lifecycle commands.
- One active GitHub Actions workflow has exact read-only triggers, immutable actions, GitHub-hosted runners, ordered non-skippable steps, synchronized Node/pnpm versions, and no secrets, artifacts, write permissions, or deployment environment. Codex examples live outside the workflow directory.
- A fresh PostgreSQL 17 CI-shaped run proves run-derived exact target guards, checksums, private service addressing, least privilege, deterministic client generation twice, migration deployment twice, seed twice, exact migration inventory/status/drift, constraints, and rollback. Historical migration bytes are compared with the trusted event baseline and dangerous SQL is rejected.
- Current-tree secret policy, repository-independent Gitleaks configuration, full-history scan wiring, and high-severity dependency audit are fail-closed. The current npm audit reports no known vulnerability after exact patched transitive overrides.

## Validation commands

```bash
python3 scripts/build_compiled_manual.py --check
python3 scripts/build_checksums.py --check
python3 scripts/validate_instruction_pack.py
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

- This validates the specification package and locally executable RIT-001 through RIT-005 foundations. It does not validate a user-facing product flow, browser interaction, payment, AI, accessibility, hosted infrastructure, or a production database.
- Docker and Podman are absent on the verified host. A native fresh PostgreSQL 17 instance reproduced the CI target contract, but the digest-pinned service image and bridge networking still require the first hosted Actions run.
- The repository YAML parser and actionlint wiring are portable in CI. A JSON Schema meta-validator remains unavailable locally; critical task-result schema invariants are checked directly.
- Command rules are exact positional prefixes and supplement, rather than replace, the owner-approval boundaries in `AGENTS.md`. Reordered flags, aliases, and opaque wrappers still require human review.
- Codex GitHub workflow examples remain intentionally inactive outside `.github/workflows`. The active CI workflow is contract-tested, but remote required-check enforcement and workflow-change protection require owner configuration.
- `RITUVIA` has only a preliminary exact-name web screen; this report does not establish legal clearance, domain availability, or right to use. Payment, crypto, tax, country, astrology-license, content-rights, vendor, and production decisions remain owner- or qualified-reviewer-gated.

## Acceptance result

The repository now has a reproducible strict TypeScript monorepo, a typed server-authoritative configuration boundary, attested local and CI-shaped PostgreSQL/Prisma paths, a fail-closed module architecture contract, and active portable quality, dependency, secret, migration, and build gates. RIT-005 is complete. RIT-004 remains Blocked until the owner provides or approves a GitHub remote, protects all three jobs and workflow changes, and obtains one passing hosted run. Production remains gated by later milestones and explicit owner approvals.
