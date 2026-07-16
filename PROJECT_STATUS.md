# RITUVIA Project Status

**Last reconciled:** 2026-07-16

**Stage:** M0 engineering foundation in progress; reproducible monorepo complete; product features not started.

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
- Root formatting, ESLint, TypeScript, Vitest, and production-build gates with non-empty behavioral tests and artifact verification.

## What does not exist yet

- User-facing product features and production-ready application behavior.
- Environment validation, runtime configuration, and configurable brand boundary.
- Database schema, migrations, local PostgreSQL runtime, and integration-test infrastructure.
- Production infrastructure.
- Approved legal entity, legal terms, privacy notices, or tax configuration.
- Formal trademark clearance or secured canonical domain.
- Payment-provider written underwriting approval.
- Astrology calculation commercial-license decision.
- Production content corpus and expert-reviewed localized traditions.
- Production credentials or vendor accounts.

## Current blockers and owner decisions

| ID | Decision needed | Blocks | Owner action |
|---|---|---|---|
| OWN-001 | Formal brand/domain clearance | Public branding and trademark filing | Commission trademark and linguistic search; secure domains/accounts |
| OWN-002 | Payment underwriting path | Production checkout | Obtain written pre-approval from primary and backup providers |
| OWN-003 | Astrology engine license/provider | Production natal chart | Select and license a lawful deterministic engine |
| OWN-004 | Launch legal markets and entity | Public launch | Select entity, tax setup, legal counsel, and first launch countries |
| OWN-005 | Initial operating budget | Paid vendors and traffic | Set monthly infrastructure, AI, payment-loss, and marketing limits |
| OWN-006 | Crypto checkout decision and provider approval | Production crypto checkout | Decide whether to pilot; obtain legal/provider approval and define supported countries/assets |
| OWN-007 | Regional-tradition expert/content approval | Any regional spiritual tradition pack | Select named tradition, qualified reviewers, sources, rights, language, and boundaries |

These do not block local engineering foundation work.

## Next task

`RIT-002` — Add environment validation and brand configuration.

## Current quality state

The instruction pack and generated evidence pass local validation. On Node.js 24.18.0 with pnpm 11.13.1, a dependency-free temporary copy passed frozen installation, formatting, ESLint, strict type checking across all three workspaces, five unit/contract tests in two files, and production builds for Web, Worker, and domain. CI, integration tests, secret scanning, and database migration checks remain later M0 gates in RIT-003/RIT-004.

## Update rules

Codex must update this file whenever release stage, blockers, completed capabilities, environments, or quality state changes. Do not turn it into a changelog; keep only the current truth and link historical decisions to `DECISIONS.md`.
