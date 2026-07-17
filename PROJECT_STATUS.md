# RITUVIA Project Status

**Last reconciled:** 2026-07-17

**Stage:** M1 local public-shell foundation in progress while M0 hosted CI evidence remains owner-gated; four accessible English public pages, the shared UI foundation, the finite SEO crawl/index contract, and the server-side safe-off delivery boundary are implemented and locally verified. Production activation and actual indexing remain separately gated.

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
- Accessible Next.js App Router public surface at exact `/en`, `/en/methodology`, `/en/safety`, and `/en/privacy` canonical routes with typed English messages, configured branding, semantic landmarks, keyboard skip/focus, responsive and long-text reflow, light/dark/reduced-motion/forced-color behavior, direction-aware CSS, local icon, and server-rendered no-JavaScript content.
- Private `@rituvia/ui` package with semantic color/type/spacing/radius/elevation/motion/control tokens; closed local-action and control-value contracts; native-first action, field, selection, alert, spinner, and skeleton primitives; system/light/dark, reduced-motion, forced-color, RTL, long-content, and narrow-reflow fixtures; and byte-for-byte built stylesheet verification.
- Case-sensitive finite locale/page routing, explicit root redirect, per-page `en`/x-default canonical metadata, non-production `noindex`, and server-side `experience.public_shell` enforcement across every HTML and RSC representation; default/emergency/error states fail closed without exposing the shell.
- One typed four-page crawl inventory drives unique canonical/Open Graph metadata, production-only index polarity, exact end-anchored robots document allows, reviewed render-asset access, and a deterministic sitemap without fabricated `lastmod`; non-production, disabled, unavailable, private, query, spoofed/bare RSC, and unreviewed internal paths remain noindex, private/non-cacheable 404, disallow-all, or absent as appropriate.
- Fail-closed Web build policy for all four canonical route artifacts, bounded compressed HTML/CSS/JavaScript/icon output, and HTML/CSS fetch surfaces including remote, ambiguous, duplicated, escaped, entity-obfuscated, and unbudgeted resources.
- Cancellable Worker runtime and framework-independent domain package boundary.
- Shared typed configuration package with validated build/server/client separation, root environment loading, fail-closed Web/Worker startup, and configurable working-brand projection.
- Repository-owned PostgreSQL 17 local runtime with random SCRAM credentials, loopback-only networking, data checksums, cluster attestation, least-privilege application role, and guarded setup/reset/stop commands.
- Prisma 7.8 database adapter boundary, expand-only initial migration, database-enforced seed-provenance invariants, deterministic synthetic seed, and documented migration/recovery policy.
- One active least-privilege GitHub Actions workflow with immutable action references, an ephemeral digest-pinned PostgreSQL 17 service, dependency/current-tree/history secret scans, and separate quality/database/security jobs.
- Repository-enforced CI structure/toolchain contract, historical migration immutability/destructive-SQL policy, idempotent generated-client check, and fail-closed secret scanning.
- Central fail-closed architecture policy for registered modules, manifests, TypeScript inheritance, public exports, runtime roots, internal/external/Node dependency allowlists, browser/server closure taint, adapter ownership, dynamic loading, and source/module cycles.
- Zero-dependency server-only observability package with fixed structured events, bounded JSON-line output, server-generated correlation IDs, strict W3C trace context, default redaction, Web proxy handoff tracing, Worker lifecycle tracing, and a serialization-safe internal job-carrier protocol.
- Immutable versioned feature-flag metadata and evaluator with literal safe-off defaults, approval/scope/lifecycle enforcement, emergency-off precedence, rolling registry-version isolation, and dedicated cleanup tasks.
- Exact zero-argument Web feature-flag composition with internal database sourcing, live read-only-role attestation, forced-RLS append-only control plane, separated migrator/runtime/control identities, and non-empty logical restore evidence.
- Root formatting, ESLint, TypeScript, 432 Vitest tests, real local and CI-shaped PostgreSQL integration, dependency audit, and production-build gates with behavioral, HTTP, retained shell-browser, and artifact verification.

## What does not exist yet

- Implemented readings, accounts, payments, legal terms/policies, rituals, or other end-to-end product flows; the reviewed English public pages are product explanations and remain server-side safe-off until explicitly activated through the existing control plane.
- Hosted GitHub Actions execution evidence, a configured remote, and owner-enforced required checks/workflow protection.
- Production infrastructure.
- Production metrics, alerts, retention/sampling policy, vendor exporters, and a real persisted outbox/queue consumer; the current Worker carrier path is a reviewed protocol and sealed adapter boundary, not a deployed queue.
- Approved legal entity, legal terms, privacy notices, or tax configuration.
- Formal trademark clearance or secured canonical domain.
- Payment-provider written underwriting approval.
- Astrology calculation commercial-license decision.
- Production content corpus and expert-reviewed localized traditions.
- Production credentials or vendor accounts.
- Automated screen-reader coverage beyond the semantic accessibility-tree and browser checks completed for the shared UI catalog; broader automated accessibility and pseudolocale smoke is owned by RIT-014.

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

The instruction pack and generated evidence pass local validation. On exact Node.js 24.18.0 and pnpm 11.13.1, frozen installation, formatting, ESLint, strict type checking across seven workspaces, 432 unit/contract tests in 35 files, configuration-boundary integration, real PostgreSQL integration, and production builds pass. The record-policy mutation suite covers typed filenames and headings, authority duplication, task/decision graphs, incident and experiment gates, privacy-safe Markdown, contextual task-result semantics, schema drift, and bounded Next dynamic-path syntax; generated evidence is staged and verified in the exact index-to-manual-to-checksums order. The build verifier checks 31 emitted artifacts and narrowed runtime exports, including exact UI stylesheet parity, all four canonical English pages, the icon, and maximum Web output of 5,549 B gzip HTML, 4,963 B gzip CSS, 208,048 B gzip JavaScript, and 356 B raw icon. The reviewed 6 KiB CSS ceiling leaves 1,181 B headroom. Its mutation suite rejects remote or unbudgeted HTML/CSS fetch surfaces, every inline style attribute, duplicate or executable attributes, comment/raw-text parser ambiguity, entity/escape obfuscation, non-canonical preload/icon relations, canonical-origin poisoning, incorrect production robots polarity, premature structured data, case-insensitive routing, dynamic route fallback, and trailing-slash normalization outside the fail-closed proxy. The architecture verifier audits 84 active source files across seven modules, and its mutation suite additionally locks the static Next proxy-normalization contract and makes UI network/resource hosts and attributes, storage, runtime-global, direct JSX-runtime, polymorphic-host, JSX-spread, inline-style, unsafe-HTML, and external-adapter capabilities fail closed. UI contract tests verify bounded local links and public control values, native semantics and label/description/error relationships, Server Component-safe static output, controlled/default-state exclusivity, disabled/loading/checked/mixed/live behavior, light/dark contrast pairs, 44px controls, forced colors, reduced motion, computed-direction RTL mirroring with nested LTR overrides, CJK/Devanagari/Arabic/German fixtures, and narrow effective-width reflow rules. Feature-flag tests prove strict typed registry metadata, safe-off evaluation, owner-gate and canonical-scope validation, scheduled activation, emergency off, expiry/removal behavior, version-qualified rolling upgrade/rollback, and fail-closed live database privilege attestation. The real production Web boundary test proves a restrictive shell content-security policy, server-generated correlation, cold case/trailing-slash rejection, exact canonical metadata host and production robots polarity, four-page robots/sitemap output only while enabled, disallow/absent discovery while disabled or unavailable, query/private/internal-path rejection, spoofed/bare RSC rejection, reviewed RSC `noindex` plus `private, no-store`, direct RSC private non-cacheable 404 behavior, and post-request sensitive-canary isolation. Dependency failure is observable through fixed non-sensitive fields without changing the public response. Retained RIT-010 and RIT-011 browser evidence continues to cover semantic landmarks, native controls, themes, forced colors, reduced motion, RTL, keyboard behavior, and narrow reflow. RIT-012 Playwright checks verify all four content routes, unique H1/current navigation, accessibility states, no-JavaScript content, and same-origin requests. Fresh RIT-013 Playwright acceptance verifies four unique 200 pages with exact canonical/Open Graph/en/x-default metadata, local meta/header noindex, zero JSON-LD, local disallow-all robots and absent sitemap, empty private/query/bare-spoof RSC 404s, reviewed RSC cache/index headers, 320px zero-overflow reflow, 44px targets, visible 3px skip-link focus, complete no-JavaScript content, zero console messages, and 81 same-origin requests. Redaction tests cover fixed metadata, private unknown fields, `Error`, accessors, `toJSON`, proxies, cycles, control characters, UTF-8 byte bounds, invalid trace IDs, untrusted carriers, writer failures, and serialization-safe Web-to-Worker propagation. The local database suite proves clean/idempotent migration and seed, separated non-superuser migrator/read-only runtime/append-only control roles, forced RLS, exact activation constraints, guarded reset, non-empty logical dump/restore with exact row comparison, transaction/race behavior, lifecycle locking, managed configuration, and log privacy. A second fresh PostgreSQL 17 run at the exact CI target proves run-derived target guards, least privilege, data checksums, deterministic generation, migration deployment/status/drift, exact migration inventory, activation and append-only constraints, registry-version coexistence, DDL denial, and rollback. The repository architecture, CI/toolchain, historical migration, current-tree/full-history secret, actionlint, and dependency gates pass; the npm audit reports no known vulnerabilities. Independent architecture, safety/privacy, and product/accessibility review found no remaining runtime P0/P1/P2 after remediation. Production deployment, public-shell activation, canonical-domain/DNS changes, actual indexing, and Search Console remain separate owner gates. No remote is configured, so no hosted Actions run or owner-side required-check protection is claimed.

## Update rules

Codex must update this file whenever release stage, blockers, completed capabilities, environments, or quality state changes. Do not turn it into a changelog; keep only the current truth and link historical decisions to `DECISIONS.md`.
