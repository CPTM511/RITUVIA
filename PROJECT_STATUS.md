# RITUVIA Project Status

**Last reconciled:** 2026-07-17

**Stage:** M2 local implementation is complete through the private, safe-off RIT-026 ordered three-card tarot reflection flow. M1 RIT-016 and manual assistive-technology exit evidence remain outstanding, and M0 hosted CI evidence remains owner-gated. Production catalog approval/activation and actual indexing remain separately gated.

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
- Private `@rituvia/ui` package with semantic color/type/spacing/radius/elevation/motion/control tokens; closed local-action and control-value contracts; native-first action, field, selection, alert, spinner, skeleton, and presentation-only empty/error/offline/provider-unavailable patterns; system/light/dark, reduced-motion, forced-color, RTL, long-content, and narrow-reflow fixtures; and byte-for-byte built stylesheet verification.
- Case-sensitive finite locale/page routing, explicit root redirect, per-page `en`/x-default canonical metadata, non-production `noindex`, and server-side `experience.public_shell` enforcement across every HTML and RSC representation; default/emergency/error states fail closed without exposing the shell.
- One typed four-page crawl inventory drives unique canonical/Open Graph metadata, production-only index polarity, exact end-anchored robots document allows, reviewed render-asset access, and a deterministic sitemap without fabricated `lastmod`; non-production, disabled, unavailable, private, query, spoofed/bare RSC, and unreviewed internal paths remain noindex, private/non-cacheable 404, disallow-all, or absent as appropriate.
- Fail-closed Web build policy for all four canonical route artifacts, bounded compressed HTML/CSS/JavaScript/icon output, and HTML/CSS fetch surfaces including remote, ambiguous, duplicated, escaped, entity-obfuscated, and unbudgeted resources.
- A production-artifact Chromium/axe gate for all four public routes plus the private intake, one-card, and three-card routes with exact WCAG 2.0/2.1/2.2 AA and best-practice tags, complete forward/reverse keyboard order, native radio behavior, 44px targets, 40% text expansion, test-only LTR/RTL pseudolocales, dark/reduced-motion/no-JavaScript states, mobile/desktop reflow, a persistent online/offline/online advisory announcement, and same-origin-only requests; exact gradient/background contrast incompletes are compensated by token-level contrast tests.
- Cancellable Worker runtime and framework-independent domain package boundary.
- Shared typed configuration package with validated build/server/client separation, root environment loading, fail-closed Web/Worker startup, and configurable working-brand projection.
- Repository-owned PostgreSQL 17 local runtime with random SCRAM credentials, loopback-only networking, data checksums, cluster attestation, least-privilege application role, and guarded setup/reset/stop commands.
- Prisma 7.8 database adapter boundary, expand-only initial migration, database-enforced seed-provenance invariants, deterministic synthetic seed, and documented migration/recovery policy.
- Expand-only anonymous identity persistence with fixed-expiry subjects/sessions, SHA-256-only bearer-token storage, request-digest idempotency, append-only per-purpose consent and withdrawal history, a privacy-minimal database-atomic global issuance gate, restrictive foreign keys, exact runtime column privileges, and non-empty logical restore evidence.
- Exact same-origin `POST /api/v1/anonymous/session` with empty request/body response, safe Problem Details, server-side safe-off routing, high-entropy idempotency, and a host-only Secure/HttpOnly/SameSite=Strict fixed-expiry cookie; missing policy/database configuration refuses issuance.
- Deterministic English question-intake policy with ten fixed reflection themes, strict normalized input, ordered crisis/blocked/reframed/allowed classification, agency-preserving suggestions, and a public result DTO that excludes raw questions and internal risk categories.
- Separately gated private `/en/intake` and exact same-origin `POST /api/v1/intake/evaluate` surfaces with noindex/no-store isolation, in-memory-only optional text, explicit safer-question choice, cancellation and offline/error states, crisis stop behavior, and no intake persistence or analytics emitter. Production configuration accepts only an OWN-009-qualified activation reference.
- Pure `@rituvia/divination` contracts for strict immutable V1 tarot catalogs, sources, rights, decks, cards, spreads, orientation content, translation/editorial evidence, exact version references, tradition consistency, and explicit dated structural publication eligibility. The Git-authored three-card/six-content English fixture is original, internal-validation-only, art-free, non-publishable, non-indexable, and unavailable to AI retrieval.
- Pure versioned deterministic tarot draw contracts with canonical without-replacement partial Fisher–Yates selection, bounded unbiased uint8 sampling, exact orientation rules, immutable public facts separated from internal audit data, fixed compatibility vectors, and safe replay/projection that require a caller-injected execution verifier.
- Strict theme-only tarot reading creation with a server-selected exact catalog, operating-system CSPRNG, domain-separated HMAC execution binding, server-derived digests, owner-scoped transactional idempotency and limits, immutable `reading`/`tarot_draw` persistence, historical replay, and verified public-fact projection.
- Exact no-store/noindex `POST /api/v1/readings/tarot` and owner-scoped `GET /api/v1/readings/{uuid}` contracts with bounded input, safe Problem Details, indistinguishable unknown/cross-owner reads, verified V2 reviewed-content presentation, and a hard unavailable runtime until an eligible production catalog is separately approved and configured.
- Private noindex/no-store `/en/tarot/one-card` with ten theme-only choices, separate session/reading idempotency, explicit reveal without redraw, strict fact/presentation parsing, reviewed limitation/question/action output, complete calm failure states, and no AI, raw-question, analytics, account, payment, share, or storage surface.
- Private noindex/no-store `/en/tarot/three-card` with the same theme-only privacy boundary and calm state machine, one fixed server-authoritative draw, exact unique Situation/Action/Possibility order, strict fact/presentation parsing, explicit reveal without redraw, reviewed per-position limitations/questions/actions, and no AI, raw-question, analytics, account, payment, share, or storage surface.
- One active least-privilege GitHub Actions workflow with immutable action references, an ephemeral digest-pinned PostgreSQL 17 service, dependency/current-tree/history secret scans, and separate quality/database/security jobs.
- Repository-enforced CI structure/toolchain contract, historical migration immutability/destructive-SQL policy, idempotent generated-client check, and fail-closed secret scanning.
- Central fail-closed architecture policy for registered modules, manifests, TypeScript inheritance, public exports, runtime roots, internal/external/Node dependency allowlists, browser/server closure taint, adapter ownership, dynamic loading, and source/module cycles.
- Zero-dependency server-only observability package with fixed structured events, bounded JSON-line output, server-generated correlation IDs, strict W3C trace context, default redaction, Web proxy handoff tracing, Worker lifecycle tracing, and a serialization-safe internal job-carrier protocol.
- Immutable versioned feature-flag metadata and evaluator with literal safe-off defaults, approval/scope/lifecycle enforcement, emergency-off precedence, rolling registry-version isolation, and dedicated cleanup tasks.
- Exact zero-argument Web feature-flag composition with internal database sourcing, live read-only-role attestation, forced-RLS append-only control plane, separated migrator/runtime/control identities, and non-empty logical restore evidence.
- Root formatting, ESLint, TypeScript, 760 Vitest tests, real local and CI-shaped PostgreSQL integration, dependency audit, and production-build gates with behavioral, HTTP, shell/private-browser, and artifact verification.

## What does not exist yet

- A production-available reading flow, accounts, payments, legal terms/policies, rituals, or other complete end-to-end product flows; the reviewed English public pages, private intake, and private one-card flow remain server-side safe-off until their existing gates are explicitly satisfied.
- An approved production anonymous-session retention duration, legal consent notice, consent/privacy-control UI, per-client abuse strategy, account merge, anonymous export/deletion workflow, or private-resource authorization surface; the current session policy is required configuration and safe-off when absent.
- A country-specific crisis-resource program, nuanced or probabilistic moderation, intake persistence, question-bearing analytics, or an intake-to-reading continuation; the owner-approved English lexical baseline remains safe-off and is not the RIT-032 pre-generation policy.
- A real provider-unavailable classifier, provider adapter, offline cache/synchronization layer, or generic partial/degraded network state machine; current provider states are synthetic presentation evidence and the connection notice is only a `navigator.onLine` advisory.
- Hosted GitHub Actions execution evidence, a configured remote, and owner-enforced required checks/workflow protection.
- Production infrastructure.
- Production metrics, alerts, retention/sampling policy, vendor exporters, and a real persisted outbox/queue consumer; the current Worker carrier path is a reviewed protocol and sealed adapter boundary, not a deployed queue.
- Approved legal entity, legal terms, privacy notices, or tax configuration.
- Formal trademark clearance or secured canonical domain.
- Payment-provider written underwriting approval.
- Astrology calculation commercial-license decision.
- A production content corpus, a real rights-cleared tarot deck or artwork set, an authorized publishing/import workflow, and expert-reviewed localized traditions; the synthetic RIT-022 fixture is contract evidence only.
- An approved production tarot catalog, production runtime activation, AI interpretation, intention/ritual continuation, or user-visible redraw/report controls; the synthetic RIT-022 fixture remains publication-ineligible and cannot activate the RIT-024/RIT-026 runtime.
- Production credentials or vendor accounts.
- Manual assistive-technology coverage with current screen readers, Firefox/WebKit coverage, and real 200%/400% browser zoom remain release-level work; Chromium/axe does not substitute for those checks.

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

These owner decisions do not block independent local engineering foundation work.

## Queue authority

`BACKLOG.md` alone determines the executable next task from priority, status, dependencies, and
owner gates. This dated capability snapshot intentionally does not copy a task ID; blocked context
remains above and task history stays in Git and durable records.

## Current quality state

The RIT-026 source passes local validation. With the bundled Node.js 24 runtime, formatting, lint,
strict type checking, 760 unit/contract tests in 58 files, configuration-boundary integration, the
154-file/eight-module architecture gate, and the 56-artifact production build pass. The record-policy
suite covers the canonical task/decision graph, privacy-safe records, contextual task results, and
exact staged index-to-manual-to-checksum evidence. RIT-026 changes no database source or migration;
the RIT-024 PostgreSQL suite remains the applicable persistence evidence and passed without stopping
or modifying the active external `IPO.ONE` database on port 55432.

The build verifier checks 56 artifacts and narrowed exports, including exact UI stylesheet parity,
all four canonical pages, all three private experience pages, the intake/reading APIs, the anonymous-session route, identity and
question-intake domain/database exports, the divination parser, safe-off fixture assessment,
deterministic draw/replay/verified projection vector, the reading service/API/persistence boundary,
and the icon. Maximum Web output is 6,095 B
gzip HTML, 6,098 B gzip CSS, 223,318 B gzip JavaScript, and 356 B raw icon.
Mutation tests reject remote, ambiguous, escaped, entity-obfuscated, unbudgeted, non-canonical, or
traversal-capable build resources before file access, plus poisoned canonical/robots/route behavior.
The architecture verifier audits 154 active source files across eight modules and keeps module,
runtime, browser/server, provider, UI-host, storage, unsafe-HTML/style, and adapter boundaries closed.

RIT-024 focused evidence covers 147 domain, cryptographic, service, proxy, and HTTP tests. RIT-025
adds the first strict V2 one-card consumer. RIT-026 generalizes the flow and adds exact three-card
position-title/order/uniqueness parsing, real service create/replay projection, browser-state,
transport, proxy, metadata, build, and accessibility coverage. Real
PostgreSQL integration proves clean/idempotent migration, exact owner/session authorization,
same-key replay and conflict, key rotation, winner-before-entropy concurrent creation, atomic
limits, immutable execution, least privilege, and non-empty logical restore. Independent review
found no remaining P0/P1 after the canonical GET route and catalog checksum/approval provenance were
included in the complete execution binding. The synthetic fixture remains intentionally ineligible
for publication and retrieval, and runtime composition remains hard unavailable rather than
silently substituting test content.

The production Web matrix proves restrictive browser headers, server correlation, independent public-shell/intake safe-off behavior,
exact canonical/robots/sitemap polarity, private/query/internal/RSC rejection, and sensitive-canary
isolation. RIT-010 through RIT-013 browser evidence retains semantic, content, SEO, no-JavaScript,
mobile, and same-origin coverage. Fresh production-artifact acceptance passes all four public routes
plus the private intake, one-card, and three-card pages with 29 blocking axe scans, exact selector-level review for 276 gradient/background
`color-contrast` incomplete nodes plus independent token contrast tests, complete forward/reverse
focus, skip-link transfer, 44px targets, 40% expansion, desktop/mobile RTL, dark/reduced-motion/no-JS
states, a persistent online/offline/online advisory announcement, and local-only requests. CLI Playwright also
verifies all four synthetic state variants at 320px, RTL, and dark mode with zero console errors.

The real local and CI-shaped PostgreSQL 17 suites prove clean/idempotent migrations and synthetic
seed, separated least-privilege roles, forced RLS, exact activation and append-only constraints,
guarded reset, non-empty dump/restore, transaction/race behavior, migration drift checks, and DDL
denial. The RIT-020 path additionally proves no plaintext token storage/logging, fixed
expiry/runtime revocation, bounded full-ledger consent validation and withdrawal, eight-way
idempotency races, privacy-minimal global capacity, injected privilege-drift denial, exact identity
column privileges, and exact restored-history behavior and attestation. Repository architecture,
CI/toolchain, historical migration, current-tree/full-history secret,
actionlint, and dependency gates pass; the npm audit reports no known vulnerabilities. Independent
accessibility, architecture, localization, and security review found no remaining local-slice P0/P1;
the intentionally global issuance gate and required pre-gate catalog attestation remain explicit
production-abuse/load P2 release risks and are not accepted as complete production admission
controls. Feature-flag and anonymous-identity access now share one bounded database pool per Web
process instead of either path creating one per request.
Playwright CLI against the local production artifact verifies 204 create/resume, redacted exact
cookie attributes, empty/no-store/noindex responses, query rejection, public navigation, 320px
reflow, and skip-link focus; its temporary local shell activation was appended safe-off afterward
and the token-bearing network trace was removed.
RIT-021 Playwright CLI evidence additionally verifies native theme selection, required-theme focus,
mismatched-origin rejection, the same-origin theme-only allowed flow, and private page semantics
against an isolated production build whose feature-flag reader is replaced only by a deterministic
test adapter. Reframed, blocked, crisis, offline/degraded, edit/stale-response, 320px, RTL, dark,
no-JavaScript, noindex/no-store, and raw-question non-retention behavior are covered by the
component, domain, API, production HTTP, and Chromium/axe gates rather than overstated as CLI flows.
RIT-026 Playwright CLI evidence at 320px verifies one 204 session request, one 201 exact theme-only
three-card draw, an explicit reveal with no third request, three semantic result cards in fixed
Situation/Action/Possibility order, no horizontal overflow, an actionable offline state with no new
request, and zero success-path browser errors/warnings. The success response exists only in the
isolated browser route; the same latest production server returns an empty 404 without interception.
Production deployment, public-shell activation, canonical-domain/DNS changes, actual indexing, and
Search Console remain separate owner gates. No remote is configured, so no hosted Actions run or
owner-side required-check protection is claimed.

## Update rules

Codex must update this file whenever release stage, blockers, completed capabilities, environments, or quality state changes. Do not turn it into a changelog; keep only the current truth and link historical decisions to `DECISIONS.md`.
