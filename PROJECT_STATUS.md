# RITUVIA Project Status

**Last reconciled:** 2026-07-17

**Stage:** M0 engineering foundation in progress; package architecture, local observability, typed safe-off feature flags, repository CI quality gates, and durable repository records implemented and locally verified; hosted evidence pending; product features not started.

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
- Contribution policy plus typed task, decision, incident, and experiment records with a generated compact index, Git-index-only checksums, contextual task-result validation, and active CI record/generated-evidence gates.
- Private pnpm/Turborepo TypeScript workspace pinned to Node.js 24.18.0 and pnpm 11.13.1 with a frozen lockfile and strict dependency-build allowlist.
- Minimal buildable Next.js Web shell, cancellable Worker runtime, and framework-independent domain package boundary.
- Shared typed configuration package with validated build/server/client separation, root environment loading, fail-closed Web/Worker startup, and configurable working-brand projection.
- Repository-owned PostgreSQL 17 local runtime with random SCRAM credentials, loopback-only networking, data checksums, cluster attestation, least-privilege application role, and guarded setup/reset/stop commands.
- Prisma 7.8 database adapter boundary, expand-only initial migration, database-enforced seed-provenance invariants, deterministic synthetic seed, and documented migration/recovery policy.
- One active least-privilege GitHub Actions workflow with immutable action references, an ephemeral digest-pinned PostgreSQL 17 service, dependency/current-tree/history secret scans, and separate quality/database/security jobs.
- Repository-enforced CI structure/toolchain contract, historical migration immutability/destructive-SQL policy, idempotent generated-client check, and fail-closed secret scanning.
- Central fail-closed architecture policy for registered modules, manifests, TypeScript inheritance, public exports, runtime roots, internal/external/Node dependency allowlists, browser/server closure taint, adapter ownership, dynamic loading, and source/module cycles.
- Zero-dependency server-only observability package with fixed structured events, bounded JSON-line output, server-generated correlation IDs, strict W3C trace context, default redaction, Web proxy handoff tracing, Worker lifecycle tracing, and a serialization-safe internal job-carrier protocol.
- Immutable versioned feature-flag metadata and evaluator with literal safe-off defaults, approval/scope/lifecycle enforcement, emergency-off precedence, rolling registry-version isolation, and dedicated cleanup tasks.
- Exact zero-argument Web feature-flag composition with internal database sourcing, live read-only-role attestation, forced-RLS append-only control plane, separated migrator/runtime/control identities, and non-empty logical restore evidence.
- Root formatting, ESLint, TypeScript, 216 Vitest tests, real local and CI-shaped PostgreSQL integration, dependency audit, and production-build gates with behavioral and artifact verification.

## What does not exist yet

- User-facing product features and production-ready application behavior.
- Hosted GitHub Actions execution evidence, a configured remote, and owner-enforced required checks/workflow protection.
- Production infrastructure.
- Production metrics, alerts, retention/sampling policy, vendor exporters, and a real persisted outbox/queue consumer; the current Worker carrier path is a reviewed protocol and sealed adapter boundary, not a deployed queue.
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
| OWN-008 | Repository remote and required CI checks       | Final RIT-004 acceptance              | Provide/approve the GitHub remote and protect the three CI jobs plus workflow changes         |

These do not block local engineering foundation work.

## Queue authority

`BACKLOG.md` alone determines the executable next task from priority, status, dependencies, and
owner gates. This dated capability snapshot intentionally does not copy a task ID; blocked context
remains above and task history stays in Git and durable records.

## Current quality state

The instruction pack and generated evidence pass local validation. On exact Node.js 24.18.0 and pnpm 11.13.1, frozen installation, formatting, ESLint, strict type checking across six workspaces, 216 unit/contract tests in 20 files, configuration-boundary integration, real PostgreSQL integration, and production builds pass. The record-policy mutation suite covers typed filenames and headings, authority duplication, task/decision graphs, incident and experiment gates, privacy-safe Markdown, contextual task-result semantics, and schema drift; generated evidence is staged and verified in the exact index-to-manual-to-checksums order. The build verifier checks 22 emitted artifacts and narrowed runtime exports. The architecture verifier audits 53 active source files across six modules, and its mutation suite covers forbidden directions, browser/server bridges, provider leakage, unsafe exports, runtime/tool separation, host globals, dynamic loading, reflection, raw output, structured-console shape, Worker continuation capability imports, exact feature-flag composition, JSDoc/type edges, and file/module cycles. Feature-flag tests prove strict typed registry metadata, safe-off evaluation, owner-gate and canonical-scope validation, scheduled activation, emergency off, expiry/removal behavior, version-qualified rolling upgrade/rollback, and fail-closed live database privilege attestation. The real Web boundary test proves a server-generated `x-request-id`, a correlated structured proxy-handoff trace, client correlation override, and absence of server-only canaries from HTTP and observability output. Redaction tests cover fixed metadata, private unknown fields, `Error`, accessors, `toJSON`, proxies, cycles, control characters, UTF-8 byte bounds, invalid trace IDs, untrusted carriers, writer failures, and serialization-safe Web-to-Worker propagation. The local database suite proves clean/idempotent migration and seed, separated non-superuser migrator/read-only runtime/append-only control roles, forced RLS, exact activation constraints, guarded reset, non-empty logical dump/restore with exact row comparison, transaction/race behavior, lifecycle locking, managed configuration, and log privacy. A second fresh PostgreSQL 17 run at the exact CI target proves run-derived target guards, least privilege, data checksums, deterministic generation, migration deployment/status/drift, exact migration inventory, activation and append-only constraints, registry-version coexistence, DDL denial, and rollback. The repository architecture, CI/toolchain, historical migration, current-tree/full-history secret, actionlint, and dependency gates pass; the npm audit reports no known vulnerabilities. Independent architecture, security, and dependency reviews found no unresolved P0/P1 issue after remediation. No remote is configured, so no hosted Actions run or owner-side required-check protection is claimed.

## Update rules

Codex must update this file whenever release stage, blockers, completed capabilities, environments, or quality state changes. Do not turn it into a changelog; keep only the current truth and link historical decisions to `DECISIONS.md`.
