# RITUVIA Project Status

**Last reconciled:** 2026-07-16

**Stage:** M0 engineering foundation in progress; repository CI quality gates implemented and locally verified; hosted evidence pending; product features not started.

**Release:** Pre-M0

**Working brand:** RITUVIA, pending formal trademark/domain/language clearance.

## What exists

- Market and product strategy.
- Interactive concept prototype.
- Product charter and full PRD.
- UX/design doctrine.
- Technical architecture and data model.
- AI, payment, safety, security, localization, SEO/GEO, analytics, and operations specifications.
- Sequenced roadmap and executable backlog.
- Codex root/nested instructions, specialized roles, command rules, automation prompts, and review templates.
- Verified import baseline, deterministic compiled-manual generation, and whole-package checksum validation.
- Private pnpm/Turborepo TypeScript workspace pinned to Node.js 24.18.0 and pnpm 11.13.1 with a frozen lockfile and strict dependency-build allowlist.
- Minimal buildable Next.js Web shell, cancellable Worker runtime, and framework-independent domain package boundary.
- Shared typed configuration package with validated build/server/client separation, root environment loading, fail-closed Web/Worker startup, and configurable working-brand projection.
- Repository-owned PostgreSQL 17 local runtime with random SCRAM credentials, loopback-only networking, data checksums, cluster attestation, least-privilege application role, and guarded setup/reset/stop commands.
- Prisma 7.8 database adapter boundary, expand-only initial migration, database-enforced seed-provenance invariants, deterministic synthetic seed, and documented migration/recovery policy.
- One active least-privilege GitHub Actions workflow with immutable action references, an ephemeral digest-pinned PostgreSQL 17 service, dependency/current-tree/history secret scans, and separate quality/database/security jobs.
- Repository-enforced CI structure/toolchain contract, historical migration immutability/destructive-SQL policy, idempotent generated-client check, and fail-closed secret scanning.
- Root formatting, ESLint, TypeScript, 83 Vitest tests, real local and CI-shaped PostgreSQL integration, dependency audit, and production-build gates with behavioral and artifact verification.

## What does not exist yet

- User-facing product features and production-ready application behavior.
- Hosted GitHub Actions execution evidence, a configured remote, and owner-enforced required checks/workflow protection.
- Production infrastructure.
- Approved legal entity, legal terms, privacy notices, or tax configuration.
- Formal trademark clearance or secured canonical domain.
- Payment-provider written underwriting approval.
- Astrology calculation commercial-license decision.
- Production content corpus and expert-reviewed localized traditions.
- Production credentials or vendor accounts.

## Current blockers and owner decisions

| ID      | Decision needed                                | Blocks                                | Owner action                                                                                  |
| ------- | ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| OWN-001 | Formal brand/domain clearance                  | Public branding and trademark filing  | Commission trademark and linguistic search; secure domains/accounts                           |
| OWN-002 | Payment underwriting path                      | Production checkout                   | Obtain written pre-approval from primary and backup providers                                 |
| OWN-003 | Astrology engine license/provider              | Production natal chart                | Select and license a lawful deterministic engine                                              |
| OWN-004 | Launch legal markets and entity                | Public launch                         | Select entity, tax setup, legal counsel, and first launch countries                           |
| OWN-005 | Initial operating budget                       | Paid vendors and traffic              | Set monthly infrastructure, AI, payment-loss, and marketing limits                            |
| OWN-006 | Crypto checkout decision and provider approval | Production crypto checkout            | Decide whether to pilot; obtain legal/provider approval and define supported countries/assets |
| OWN-007 | Regional-tradition expert/content approval     | Any regional spiritual tradition pack | Select named tradition, qualified reviewers, sources, rights, language, and boundaries        |
| OWN-008 | Repository remote and required CI checks       | Final RIT-004 acceptance               | Provide/approve the GitHub remote and protect the three CI jobs plus workflow changes          |

These do not block local engineering foundation work.

## Next task

`RIT-004` — Obtain owner-approved remote/required-check configuration and one passing hosted run for the implemented CI quality gates.

## Current quality state

The instruction pack and generated evidence pass local validation. On exact Node.js 24.18.0 and pnpm 11.13.1, frozen installation, formatting, ESLint, strict type checking across five workspaces, 83 unit/contract tests in ten files, configuration-boundary integration, real PostgreSQL integration, and production builds pass. The local database suite proves clean/idempotent migration and seed, constraints, transaction/race behavior, guarded reset, logical dump/restore, lifecycle locking, managed configuration, and log privacy. A second fresh PostgreSQL 17 run at the exact CI target proves run-derived target guards, least privilege, data checksums, two deterministic generations, two migration deployments, two seeds, migration status/drift, exact migration inventory, constraints, and rollback. The repository CI/toolchain, historical migration, current-tree secret, and dependency gates pass; the npm audit reports no known vulnerabilities. Independent architecture, security, and supply-chain reviews found no unresolved high issue after remediation. No remote is configured, so no hosted Actions run or owner-side required-check protection is claimed.

## Update rules

Codex must update this file whenever release stage, blockers, completed capabilities, environments, or quality state changes. Do not turn it into a changelog; keep only the current truth and link historical decisions to `DECISIONS.md`.
