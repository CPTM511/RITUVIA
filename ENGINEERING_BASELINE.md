# RITUVIA M0 Engineering Baseline

**Observed:** 2026-07-16

**Task:** RIT-000

**Scope:** imported repository reality, build-system integrity, and the exact M0 execution plan. No production feature code is included.

## Outcome

The imported package is a coherent specification and operating system, not an implemented application. This baseline records what was actually inspected, what is executable today, which claims remain unproved, and the dependency order for completing M0 without silently expanding scope.

## Evidence reviewed

- Every one of the 85 files in the imported ZIP was read or mechanically compared in full, including 21 canonical specifications, all root and nested instructions, 10 Codex agent definitions, automation prompts/schema, templates, scripts, two retained HTML artifacts, the compiled manual, and all checksum entries.
- Before any repository mutation, all 84 recorded SHA-256 checksums passed and `python3 scripts/validate_instruction_pack.py` passed with 122 unique backlog items and one Ready task (`RIT-000`).
- The compiled manual contained 81 embedded sources plus two external HTML references. A section-by-section comparison found the only subsequent drift to be the intentional `RIT-000: Ready → In Progress` state transition made at the start of this task.
- The two `reference/` HTML files were reviewed line by line. They contain useful product and visual concepts, but are legacy research artifacts and are not production code, licensed content, approved pricing, or current implementation requirements.

## Repository reality

| Area | Observed state | Claim allowed |
|---|---|---|
| Git | Repository initialized on `main`; no remote configured; first baseline commit pending until RIT-000 closes | Local history can be established; no push/PR claim |
| Application | No `package.json`, workspace file, lockfile, TypeScript/JavaScript source, database schema, migration, or environment example | No install/build/test/runtime claim |
| Specifications | Canonical root/docs set is complete and internally well structured | Requirements are available for implementation |
| Codex configuration | TOML parses and the installed Codex CLI loads the project configuration | Local syntax/load compatibility only; model/account availability is not guaranteed |
| Command policy | Rules load in the installed CLI and representative decisions were exercised | Tested prefixes are enforced; root human-approval rules remain authoritative |
| GitHub automation | Two `.example.yml` templates exist and are intentionally inert | No CI, review automation, deployment, or secret is active |
| Product/infrastructure | No deployed service, database, vendor adapter, observability, or production credential | Pre-M0 only |

## Local toolchain snapshot

| Tool | Observed version/status | M0 implication |
|---|---|---|
| macOS | 26.5.2 arm64 | Current audit host only |
| Node.js | 26.0.0 | Current release line is not the future repository contract; RIT-001 must select and pin a supported LTS |
| pnpm | 11.1.3 | RIT-001 must verify the current stable release and pin an exact `packageManager` version |
| npm | 11.12.1 | Bootstrap availability only |
| Python | 3.14.6 | Runs the instruction-pack validator |
| Git | 2.39.3 (Apple Git) | Sufficient for local baseline history |
| Codex CLI | 0.144.2 | Config and exec-policy checks are locally available |
| Corepack | Not installed | RIT-001 must not assume Corepack exists without documenting/bootstrap-testing it |
| Docker | Not installed | RIT-003 must choose and verify a supported local PostgreSQL path; it cannot claim Docker reproducibility on this host yet |

Tool and package versions are time-sensitive. RIT-001 must re-query official release sources/registries, resolve peer dependencies without force flags, lock exact versions, and record the chosen supported Node LTS. This snapshot is evidence, not a permanent version recommendation.

## Compatibility evidence and open drift

- Current official Codex documentation confirms project-scoped configuration, subagents, exact-prefix rules with inline tests, and `codex execpolicy check`. It also confirms the GitHub Action inputs used by the inactive examples.
- The installed CLI accepted the current configuration and reports multi-agent support. The configured model identifiers and `model_reasoning_effort = "max"` must still be revalidated against the exact CLI/account used by automation because public configuration enums and available models can change.
- Rules are exact positional prefixes. Common destructive/deploy/database variants are covered, but no rules file replaces review of shell wrappers, reordered arguments, aliases, or a human approval gate.

## Reference artifact disposition

### Concepts that may inform implementation

- Anonymous-first delivery of useful value.
- Calm, private sanctuary and the Question → Interpretation → Intention → Ritual → Journal → Revisit loop.
- Deterministic calculation separated from bounded AI explanation.
- Free ritual access and paid expression without paid efficacy.
- Modular monolith, provider adapters, country policy, and phased international activation.

### Material that must not be copied into production

- The legacy `LUMORA` brand, hard-coded prices/countries/providers, market forecasts, timeline, and staffing assumptions.
- Client-side tarot draws, modulo-biased randomness, unlicensed 22-card content, approximate astrology, Latin-only numerology, localStorage journals/streaks, client-granted purchases, or global crypto visibility.
- Cross-tradition visual objects without provenance/review, compulsive streak mechanics, hard-coded bilingual strings, inaccessible modals/tabs, or dark-only styling.
- Any claim that reference content is licensed, legally approved, scientifically predictive, culturally reviewed, or suitable for release.

## Confirmed setup gaps

| Severity | Gap | Resolution owner/task |
|---|---|---|
| High | No reproducible install, lockfile, build, tests, or runtime | RIT-001 |
| High | No database foundation or real integration-test path; Docker absent locally | RIT-003/RIT-004 |
| High | No active CI, secret scan, migration check, or branch gate | RIT-004 |
| Medium | No environment/brand boundary | RIT-002 |
| Medium | Architecture boundaries exist only as prose | RIT-005 |
| Medium | No structured logging, correlation IDs, or redaction proof | RIT-006 |
| Medium | No typed safe-off feature/config registry | RIT-007 |
| Medium | Environment isolation/deploy documentation is not executable | RIT-008 |
| Medium | Generated manual/checksum lifecycle was undocumented and drift was not detected | Fixed in RIT-000; workflow integration continues in RIT-009 |
| Medium | Automation result schema/template/status vocabulary had internal mismatches | Fixed in RIT-000; workflow integration continues in RIT-009 |
| Low | Duplicate role nickname candidates can make delegation logs ambiguous | Revisit when role UI/logging is activated |

## Exact M0 execution plan

Tasks remain separate so each produces one verifiable, reversible slice.

| Order | Task | Exact boundary and evidence |
|---:|---|---|
| 1 | RIT-001 | Create the strict private pnpm/Turborepo TypeScript workspace, minimal buildable Web and Worker shells, package exports, a real foundation smoke/unit test, exact versions, frozen lockfile, and root format/lint/typecheck/test/build commands. Do not add Prisma, vendor SDKs, payment, AI, or product features. |
| 2 | RIT-002 | Add typed server/client environment separation, placeholder-only `.env.example`, configurable working brand, and tests proving secrets cannot enter client bundles. |
| 3 | RIT-003 | Add reproducible local PostgreSQL plus Prisma, initial migration, synthetic seed/reset path, constraints, and real integration verification. First resolve the local runtime approach because Docker is absent. |
| 4 | RIT-004 | Add CI for frozen install, format, lint, typecheck, unit/integration, migration, build, and secret scanning. Keep GitHub Codex examples inactive until separately approved. |
| 5 | RIT-005 | Turn package direction rules into lint/architecture tests: domain remains framework/vendor-free, UI does not import data adapters, divination does not import AI, and cycles fail CI. |
| 6 | RIT-006 | Add privacy-safe structured logs/traces, request/job correlation IDs, redaction tests, and local observability behavior without production vendors. |
| 7 | RIT-007 | Add a typed, versioned, server-authoritative configuration/feature-flag registry with conservative safe-off defaults and tests. |
| 8 | RIT-008 | Document and test, where locally possible, preview/staging/production isolation, secret boundaries, indexing, data classes, release gates, and rollback ownership. No deployment is authorized. |
| 9 | RIT-009 | Wire ADR/task/incident/experiment records to contribution and task-result workflows; document generated artifact/checksum maintenance and eliminate stale duplication. |

Parallel work is allowed only after dependencies are Done and file ownership does not overlap. The immediate critical path is `RIT-001 → RIT-002/RIT-003 → RIT-004`; RIT-005 can follow RIT-001, while RIT-006/007/008 wait on their declared dependencies. RIT-009 may follow this baseline but must not displace the higher-priority critical path.

## M0 exit gate

M0 is complete only when a fresh clone can:

1. Install from the committed frozen lockfile on the documented supported Node version.
2. Run format check, lint, strict typecheck, non-empty unit tests, real PostgreSQL integration tests, migration checks, and all builds.
3. Enforce package boundaries, environment separation, secret scanning, redaction, and safe configuration defaults.
4. Reproduce local database setup/reset using synthetic data and document recovery/rollback boundaries.
5. Show CI evidence for the same gates and current environment-isolation documentation.
6. Keep the manual/checksum/status/backlog evidence synchronized.

Until all six are proved, the repository must remain Pre-M0 and make no product-readiness claim.

## Risk, approvals, and rollback

- No owner gate is needed for this local audit, validation hardening, generated documentation, or initial commit.
- Production deployment, remote push/PR, vendor spend, payment/provider activation, legal copy, country activation, brand commitment, crypto, and destructive data actions remain unauthorized.
- RIT-000 changes are documentation and local policy/tooling only. Rollback is a normal Git revert; do not rewrite history or use destructive reset.

## Current external references

- [Codex configuration reference](https://developers.openai.com/codex/config-reference/)
- [Codex subagents](https://developers.openai.com/codex/subagents/)
- [Codex command rules](https://developers.openai.com/codex/rules/)
- [Codex GitHub Action](https://developers.openai.com/codex/github-action/)
