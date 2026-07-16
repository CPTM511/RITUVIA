# RITUVIA Codex Build System — QA Report

**Validated:** 2026-07-16

**Result:** PASS for the imported instruction pack, repository consistency, and the RIT-001 through RIT-003 engineering foundation.

## Checks passed

- All 85 files from the source ZIP were inventoried and read or mechanically compared in full before baseline changes. Before mutation, all 84 archive checksum entries passed.
- All required root, specification, Codex, automation, template, generated-evidence, and retained-reference files exist. Project TOML and JSON parse; repository YAML parses with the host Ruby parser and pnpm accepts the workspace policy.
- Backlog contains 122 unique items: 115 product/engineering tasks and seven owner gates. Dependencies are valid and acyclic; `RIT-000` through `RIT-003` are Done, and exactly one executable item is Ready: `RIT-004`.
- Ten custom Codex agents contain the required metadata and instructions. Root and nested `AGENTS.md` files remain below the configured 65,536-byte instruction limit.
- Thirty-five representative command-policy cases cover push, force push, destructive Git, recursive deletion, Prisma migration/reset commands, infrastructure changes, production deploys, remote repository mutation, and publishing.
- Local Markdown links resolve inside the package. Historical `LUMORA` text remains confined to retained references and documented migration/baseline contexts. Both retained HTML artifacts pass integrity-size checks and remain non-canonical references.
- `RITUVIA_CODEX_BUILD_MANUAL.md` is deterministically generated from 86 current text sources; `checksums.sha256` covers every current non-ignored package file except itself, without missing, extra, duplicate, or mismatched entries.
- Node.js 24.18.0, pnpm 11.13.1, and direct JavaScript dependencies are exact. The frozen lockfile passes peer, engine, release-age, exotic-subdependency, and install-script allowlist policies; a clean temporary copy installs with `--frozen-lockfile` without changing the lockfile or leaving ignored build scripts.
- Root formatting, ESLint, strict TypeScript, Vitest, configuration-boundary, real PostgreSQL integration, and build gates pass across five workspaces. Thirty-nine unit/contract tests run in five files; the build verifier checks 14 emitted artifacts and imports built ESM exports.
- `.env.example` exactly matches the typed server inventory. Production source limits environment reads to reviewed adapters, rejects all `NEXT_PUBLIC_*` variables, excludes secrets from client artifacts and HTTP, and proves sanitized nonzero Web/Worker startup failure plus a real `server-only` negative build.
- The repository-owned PostgreSQL 17 runtime is bound to `127.0.0.1:55432`, uses random mode-0600 SCRAM credentials, data checksums, exact managed HBA/configuration files, an attested cluster fingerprint, and a non-superuser application role. Lifecycle operations are directory-lock serialized, including a two-contender stale-lock recovery test.
- Prisma 7.8 generation and `migrate deploy` pass against isolated real databases. The suite proves clean and idempotent migration, deterministic/idempotent synthetic seed, database CHECK/unique constraints, transaction rollback, eight-way concurrent uniqueness, guarded isolated reset, custom-format dump/restore into a second isolated database, managed-setting attestation, and absence of a unique failure canary from PostgreSQL logs.
- `db:setup`, the exact-confirmation local development reset, default non-disclosing `db:url`, and `db:stop` pass. No production, preview, staging, remote, or arbitrary ambient database URL is accepted by these lifecycle commands.

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
APP_ENV=local pnpm db:setup
APP_ENV=local pnpm db:reset -- --confirm=reset:rituvia_local@127.0.0.1:55432
pnpm db:stop
```

## Limitations

- This validates the specification package and RIT-001 through RIT-003 foundations. It does not validate a user-facing product flow, browser interaction, payment, AI, accessibility, hosted infrastructure, or a production database.
- Docker and Podman are absent on the verified host. The local native PostgreSQL path is real and reproducible for the supported toolchains, but RIT-004 must add and verify a separate CI database runtime, secret scanning, migration enforcement, and active CI workflow.
- PyYAML and a JSON Schema meta-validator are unavailable in the host environment. YAML is independently parsed with Ruby; JSON and critical task-result schema invariants are checked locally. RIT-004 must make these checks portable in CI.
- Command rules are exact positional prefixes and supplement, rather than replace, the owner-approval boundaries in `AGENTS.md`. Reordered flags, aliases, and opaque wrappers still require human review.
- Example GitHub workflows remain intentionally inactive. Official action versions, permissions, fork-secret behavior, branch protection, and budget controls require review before activation.
- `RITUVIA` has only a preliminary exact-name web screen; this report does not establish legal clearance, domain availability, or right to use. Payment, crypto, tax, country, astrology-license, content-rights, vendor, and production decisions remain owner- or qualified-reviewer-gated.

## Acceptance result

The repository now has a reproducible strict TypeScript monorepo, a typed server-authoritative configuration boundary, and an attested real PostgreSQL/Prisma local foundation with deterministic migrations, synthetic seeding, guarded reset, and recovery evidence. The next task is `RIT-004`, which must activate portable CI quality, security, and migration gates. Production remains gated by later milestones and explicit owner approvals.
