# RITUVIA Decision Log

This is an append-only summary of accepted architectural and product decisions. Detailed decisions use
`records/decisions/D-NNN.md` and the template in `templates/ADR_TEMPLATE.md`. A detailed record is not
effective until this register links it. Do not rewrite historical rationale; supersede it with a new entry.

## Accepted decisions

### D-001 — Product category

- **Decision:** Position RITUVIA as symbolic self-reflection, personal ritual, and a private digital sanctuary—not as an oracle that guarantees objective future outcomes.
- **Reason:** Maximizes long-term trust, safety, global portability, and differentiated retention.
- **Date:** 2026-07-16

### D-002 — Core product loop

- **Decision:** Question → Interpretation → Intention → Ritual → Journal → Revisit.
- **Reason:** Turns a one-off reading into an ethical repeatable habit and measurable product loop.
- **Date:** 2026-07-16

### D-003 — Launch modalities

- **Decision:** Launch Tarot, Western astrology, and numerology; add regional traditions only as separately sourced and reviewed content packs.
- **Reason:** Balances immediate activation, persistent personalization, SEO acquisition, and global transferability.
- **Date:** 2026-07-16

### D-004 — Anonymous first

- **Decision:** Users can complete a useful first reading before creating an account; account creation is requested at a natural save/sync moment.
- **Reason:** Reduces activation friction and supports SEO landings.
- **Date:** 2026-07-16

### D-005 — Ethical ritual monetization

- **Decision:** Free ritual access always remains. Paid objects enhance expression, appearance, sound, duration, collection, or persistence, never claimed efficacy.
- **Reason:** Protects user autonomy and reduces manipulative or payment-network risk.
- **Date:** 2026-07-16

### D-006 — No stored-value wallet

- **Decision:** Sell named digital products and subscriptions directly. Do not require prepaid credits, transferable tokens, or cash-out balances.
- **Reason:** Clearer consumer value, refunds, accounting, and payment compliance.
- **Date:** 2026-07-16

### D-007 — Modular monolith

- **Decision:** Begin with a TypeScript modular monolith and worker, with explicit package boundaries and provider adapters.
- **Reason:** Best reliability/operability tradeoff for a one-person company; preserves a path to later extraction.
- **Date:** 2026-07-16

### D-008 — Deterministic engine / AI explanation separation

- **Decision:** Tarot draws, numerology, ephemeris positions, prices, entitlements, and country policy are deterministic. AI only produces bounded explanations and reflection prompts.
- **Reason:** Reproducibility, testing, safety, and trust.
- **Date:** 2026-07-16

### D-009 — Global architecture, phased launch

- **Decision:** Engineer for global locales/countries from the start, but activate countries and languages in controlled waves.
- **Reason:** Payment, legal, cultural, and support constraints differ materially by market.
- **Date:** 2026-07-16

### D-010 — Language order

- **Decision:** Launch English. Prepare Spanish (`es-419`), Brazilian Portuguese, French, German, Japanese, Korean, Simplified/Traditional Chinese, Hindi, Arabic/RTL, and Indonesian in staged waves.
- **Reason:** Broad global reach while preserving review quality and operational control.
- **Date:** 2026-07-16

### D-011 — Payment orchestration

- **Decision:** Use adapters and a Country Policy Engine, hosted fiat checkout, and optional hosted non-custodial crypto checkout. No single provider is embedded as the product architecture.
- **Reason:** Merchant-category and country restrictions require routing resilience.
- **Date:** 2026-07-16

### D-012 — Working brand

- **Decision:** Use `RITUVIA` as the configurable working brand pending formal clearance.
- **Reason:** It communicates a ritual path, is pronounceable, and had no obvious exact-match result in preliminary public-web screening.
- **Date:** 2026-07-16
- **Caveat:** This is not legal clearance or a guarantee of domain availability.

### D-013 — Human approval boundaries

- **Decision:** Production deploys, payments, legal copy, country activation, destructive data actions, model/safety changes, and material automated spend require owner approval.
- **Reason:** A one-person AI company still needs accountable human control over irreversible and regulated actions.
- **Date:** 2026-07-16

### D-014 — Canonical sources and generated evidence

- **Decision:** Individual repository files are canonical. `RITUVIA_CODEX_BUILD_MANUAL.md` is generated from an explicit source list, and `checksums.sha256` covers every package file except itself. Rebuild the manual before regenerating checksums whenever embedded sources change.
- **Reason:** Prevents a convenient handoff artifact or stale hash from silently contradicting the live backlog, status, policy, or specifications.
- **Date:** 2026-07-16

### D-015 — Reproducible TypeScript foundation

- **Decision:** Pin the engineering contract to Node.js 24.18.0 LTS, pnpm 11.13.1, TypeScript 6.0.3, and ESLint 9.39.5; activate only the Web, Worker, and domain workspaces during RIT-001.
- **Reason:** The exact versions are mutually compatible, reproducible from the lockfile, and avoid initializing speculative packages before their backlog slices. TypeScript 7 is outside the current typescript-eslint support range, and ESLint 10 conflicts with the React ESLint peer used by the selected Next.js release.
- **Date:** 2026-07-16

### D-016 — Server-authoritative environment and brand boundary

- **Decision:** Centralize typed environment and working-brand parsing in `packages/config`; load the repository-root environment file set with identical pinned `@next/env` semantics in Web and Worker; reject `NEXT_PUBLIC_*`; and expose browser configuration only through a strict server-created allowlist projection. Require the complete approved brand surface and HTTPS canonical origin in production while retaining non-release local working defaults.
- **Reason:** Prevents accidental secret bundling and scattered brand constants, makes Web/Worker startup fail closed with sanitized diagnostics, and preserves the ability to replace the uncleared working brand without rewriting user-facing modules.
- **Date:** 2026-07-16

### D-017 — Attested native PostgreSQL and Prisma foundation

- **Decision:** Use the installed supported PostgreSQL 17.10 tools for a repository-owned local cluster at ignored `.local/postgres/`, bound only to `127.0.0.1:55432` with random SCRAM credentials, data checksums, cluster fingerprinting, and a least-privilege application role. Keep Prisma 7.8 inside `packages/db`, require committed `migrate deploy` migrations and explicit local-only synthetic seeding, and represent only internal seed provenance until later domain tasks own their schemas. RIT-004 must establish the independent CI PostgreSQL runtime; production remains managed-provider and owner-gated work.
- **Reason:** Docker is absent on the verified host. This path makes local setup/reset and real database tests reproducible without weakening authentication, consuming arbitrary connection URLs, or preempting identity/content/payment domains, while keeping builds free of database secrets.
- **Date:** 2026-07-16

### D-018 — Least-privilege CI and immutable quality evidence

- **Decision:** Use one active GitHub Actions workflow with independent quality, PostgreSQL integration, and security jobs on GitHub-hosted Ubuntu 24.04. Grant only top-level `contents: read`; pin every action to a reviewed commit and PostgreSQL 17.10 to its reviewed manifest digest; accept only run-derived ephemeral loopback CI database targets; enforce migration checksums, protected historical bytes, and destructive-SQL policy; and combine dependency audit, a repository-owned current-tree scanner, checksum-pinned actionlint, and full-history Gitleaks. Keep Codex automation examples outside `.github/workflows` so they are actually inert.
- **Reason:** Makes mandatory evidence diagnosable and reproducible while preventing mutable supply-chain references, privileged fork execution, arbitrary database targets, secret-bearing artifacts, and migration history drift. Remote required-check/workflow-protection settings remain an owner-controlled gate.
- **Date:** 2026-07-16

### D-019 — Fail-closed modular architecture boundaries

- **Decision:** Register every active app/package in one repository-owned architecture policy with an explicit internal allow matrix and exact external and Node built-in runtime allowlists. Require private package identities, strict TypeScript inheritance, package `src/` runtime/export roots, registered app runtime roots, public export subpaths, and exact `workspace:*` links; reject aliases, cross-module relatives, self/deep imports, unsafe exports, undeclared or dev-only runtime dependencies, dynamic loading/reflection/property access, dynamic framework configuration, and module/source cycles. Keep `domain` and `divination` free of host/network globals, propagate browser-safety taint through local and public-package imports, and confine provider SDKs to registered owners and adapter/provider zones. Treat `apps/web` as the server composition root and permit database imports only in reviewed server/composition paths. Run the verifier as a separate exact CI command.
- **Reason:** Manifests and TypeScript alone do not expose deep or type-only cycles, client bridge leaks, provider leakage, unsafe export targets, or script-alias bypasses. A default-deny AST and repository-metadata audit turns these architectural promises into reviewable, mutation-tested evidence.
- **Date:** 2026-07-16

### D-020 — Privacy-safe local observability boundary

- **Decision:** Keep `@rituvia/observability` a zero-dependency server-only leaf package. Emit only fixed discriminated operational events into bounded JSON lines; reject free-text messages, arbitrary attributes, raw `Error` objects, raw sinks, and unreviewed console/process output. Generate correlation and W3C trace IDs with Web Crypto, ignore client correlation state, expose only the correlation ID as public `x-request-id`, and propagate only versioned correlation plus `traceparent`. Isolate persisted-job continuation behind the exact `@rituvia/observability/worker` capability and one branded Worker persistence boundary. The current Web span measures proxy handoff, not downstream response duration or status; the current job path proves serialization-safe protocol behavior but does not claim a deployed outbox or queue.
- **Reason:** Privacy-sensitive reflection text, birth data, safety content, provider payloads, credentials, and errors must be structurally impossible to log, while local services still need useful correlation. Fixed fields and exact capability/sink boundaries are auditable without a production telemetry vendor and avoid misleading evidence about infrastructure that does not yet exist.
- **Date:** 2026-07-17

### D-021 — Typed safe-off feature-flag registry and separated activation plane

- **Decision:** Keep raw feature-flag snapshot parsing and evaluator construction on the exact
  `@rituvia/config/feature-flags` capability, importable only by the reviewed Web server composition
  adapter. Every immutable definition has an owner, purpose, creation/removal date, lifecycle,
  cleanup task, required country/locale scope, approval gate where applicable, and literal `off`
  default. Evaluation uses a server-owned clock and the highest effective version; a later-created
  emergency version may take effect before an already scheduled lower version. PostgreSQL objects
  belong to a non-superuser migrator, runtime access to `feature_flag_version` is read-only and
  non-owner, and a separate control
  login can only read and append versions through forced RLS. Enabled rows require the exact
  registry key, gate prefix, and scope shape; no migration seeds one, and control access remains an
  owner-governed capability rather than an application endpoint. Registry-version-qualified reads
  and uniqueness permit rolling upgrade and rollback while retired keys remain safe-off tombstones
  until their cleanup task is complete. The zero-argument composition adapter obtains its database
  source internally and performs a live catalog attestation before every read; any database,
  schema, or table owner, DDL/table/column mutation privilege, missing read privilege, privileged
  role attribute, direct or transitive role-membership escalation path, or ambiguous result fails
  closed. Membership traversal includes non-settable membership so later membership administration
  cannot create a post-check upgrade.
  The authenticated session identity must also equal the current role, preventing startup role
  options from hiding a privileged login. Architecture policy requires the adapter's complete
  reviewed source exactly, so aliases, injected adapters, re-exports, and dead-code camouflage do
  not create a second construction path.
- **Reason:** A client-visible, generally importable raw factory, mutable row, runtime-owned table,
  or unversioned activation switch could bypass legal, payment, country, content, or safety gates
  and erase decision history. Exact code capability boundaries, separate database identities,
  append-only provenance, deterministic version isolation, and mandatory cleanup make incomplete
  or compromised runtime configuration fail closed without claiming that a future admin UI or
  owner-approval record system already exists.
- **Date:** 2026-07-17

### [D-022 — Canonical repository record workflow](records/decisions/D-022.md)

- **Decision:** Keep backlog and decision state in their canonical registers; link bounded typed detail records through a generated compact index and machine-validated task results. Build canonical checksums from regular files in the Git index only, after the record index and compiled manual.
- **Reason:** Stable links and fail-closed generation preserve traceability without duplicating mutable state, leaking untracked personal files, or allowing a record to manufacture owner approval. This clarifies D-014's package scope without superseding its canonical-source or manual-order rules.
- **Date:** 2026-07-17

### [D-023 — English-first locale-prefixed public shell](records/decisions/D-023.md)

- **Decision:** Build the first shell at the exact `/en` canonical route, redirect `/` there only when the server-side `experience.public_shell` flag is explicitly enabled, and return an empty 404 for disabled/error states and every unsupported HTML/RSC route. Use case-sensitive finite routing, typed English copy, configured branding, non-production `noindex`, direction-aware layout, and fail-closed local resource budgets without activating another language.
- **Reason:** A finite allowlist plus the existing safe-off activation plane provides an accessible server-rendered foundation without silent fallback, cache pollution, premature publication, hardcoded working-brand copy, or unreviewed third-party fetches.
- **Date:** 2026-07-17

### [D-024 — Semantic-token and native-first UI primitive boundary](records/decisions/D-024.md)

- **Decision:** Centralize version-one visual semantics and accessible native-first controls in `@rituvia/ui`; expose one reviewed stylesheet and typed React primitives, with system preference as the default and explicit light/dark theme attributes for later user choice.
- **Reason:** A shared, locale-safe contract prevents application-specific state, theme, focus, motion, and accessibility behavior from diverging as public and product surfaces expand.
- **Date:** 2026-07-17

### [D-025 — Finite public trust-content boundary](records/decisions/D-025.md)

- **Decision:** Extend the reviewed English shell with an exact allowlist of server-rendered methodology, safety, and privacy-design pages backed by typed source messages and per-route metadata. Treat privacy content as a product-design explanation rather than a legal privacy notice, and treat safety content as product boundaries rather than an activated crisis flow.
- **Reason:** Users need durable category, method, safety, and privacy context before personal features exist, while legal terms, crisis resources, another locale, production activation, and unsupported product claims must remain behind their separate owner/review gates.
- **Date:** 2026-07-17

### [D-026 — Finite environment-safe crawl inventory](records/decisions/D-026.md)

- **Decision:** Drive production page indexing, exact robots document allows, and the initial English sitemap from one typed four-page inventory; default-deny every other route and every non-production/query/framework representation through explicit noindex or a private non-cacheable 404, permit only build-audited local render assets, omit untrustworthy `lastmod`, and leave multi-locale sitemap indexes plus structured-data publishing to RIT-103 and RIT-114.
- **Reason:** A small end-anchored allowlist prevents preview, private, unsupported, and framework URLs from being advertised or accidentally authorized without inventing editorial freshness or crossing later backlog boundaries.
- **Date:** 2026-07-17

### [D-027 — Production-artifact accessibility and pseudolocale gate](records/decisions/D-027.md)

- **Decision:** Keep one pinned Chromium/axe smoke inside the existing Quality job after the production build; test the exact four public routes, keyboard and 44px behavior, dark/reduced-motion/no-JavaScript states, at-least-40% LTR expansion, and desktop/mobile RTL through test-only DOM transforms without activating another locale. Fail every violation and unexpected incomplete result, with only exact selector-level gradient contrast incompletes accepted when independent worst-case token math passes.
- **Reason:** A deterministic local-artifact gate catches shell regressions without remote traffic, production activation, public pseudolocale routes, a fourth required CI job, or a broad axe suppression that could hide real accessibility failures.
- **Date:** 2026-07-17

### [D-028 — Presentation-only resilient state boundary](records/decisions/D-028.md)

- **Decision:** Keep closed empty, error, offline, and provider-unavailable presentation patterns in `@rituvia/ui`, while applications own localized copy, truthful classification, announcement/focus timing, and idempotent recovery. Use the existing public shell as the first real consumer without changing its empty safe-off 404 contract or inventing a provider/PWA capability.
- **Reason:** Separating presentation from operational classification prevents raw error/private-data leakage, false availability claims, unsafe automatic retries, public debug surfaces, and component-library coupling to providers or domains.
- **Date:** 2026-07-17

### [D-029 — Privacy-minimal anonymous identity and per-purpose consent ledger](records/decisions/D-029.md)

- **Decision:** Issue a 256-bit opaque anonymous-session cookie whose database representation is only a versioned digest; use database-clock fixed expiry from required owner-policy configuration, bounded full-ledger validation of append-only consent history independently per purpose and notice version, exact same-origin/idempotent empty-body HTTP issuance, a privacy-minimal global capacity gate, runtime revocation, and runtime-attested least-privilege identity persistence. D-021's read-only runtime scope applies to `feature_flag_version`; identity uses a separate exact writer capability.
- **Reason:** Same-device anonymous continuity must not become fingerprinting, sliding indefinite retention, optional-consent coercion, mutable audit history, token leakage, or a privileged generic database capability.
- **Date:** 2026-07-17

### [D-030 — English question-intake safety language and activation eligibility](records/decisions/D-030.md)

- **Decision:** Approve the exact English `question-intake.en.v1` boundary, reframed, blocked, crisis, and safer-question language; require crisis stop/clear behavior, explicit suggestion adoption, transient raw text, and the exact `own-009.question-intake.en.v1` production eligibility reference while keeping activation and deployment separately gated.
- **Reason:** A global English-first intake needs direct, agency-preserving safety language and fail-closed activation provenance without inventing a universal hotline, persisting private questions, or treating copy approval as a production launch.
- **Date:** 2026-07-17

### [D-031 — Git-authored tarot snapshot and structural publication eligibility](records/decisions/D-031.md)

- **Decision:** Keep authored tarot source/deck/spread/card-orientation snapshots in `content/**`; validate exact independently versioned references through pure `@rituvia/divination` contracts; and require an explicit dated, rights-aware structural eligibility assessment while the synthetic placeholder remains complete but unpublishable.
- **Reason:** This separates editorial provenance from draw logic and operational reading facts, prevents draft or rights-incomplete material from leaking, and avoids a premature database/content service before runtime reading persistence exists.
- **Date:** 2026-07-17

### [D-032 — Versioned unbiased tarot draw and internal audit boundary](records/decisions/D-032.md)

- **Decision:** Keep the V1 tarot draw as a pure, exact-version, without-replacement partial
  Fisher–Yates transition with bounded uint8 rejection sampling and caller-injected entropy. Split
  public deterministic facts from the server-internal idempotency and entropy-audit envelope; replay
  matching existing execution without entropy and reject every conflicting or damaged execution.
- **Reason:** Historical draws require stable byte-to-fact behavior and safe idempotent replay, while
  client selection, predictable randomness, modulo bias, internal digest leakage, or database/AI
  coupling would undermine server authority, privacy, and future concurrent persistence.
- **Date:** 2026-07-17

### [D-033 — Owner-bound immutable tarot reading facts and safe-off API](records/decisions/D-033.md)

- **Decision:** Accept only the exact theme-only V1 create command; bind every OS-CSPRNG draw to
  its anonymous owner, server-issued reading identity, request and exact approved catalog through a
  domain-separated HMAC; and persist the verified execution as immutable owner-scoped reading facts
  in the same transaction that authenticates the session, resolves idempotency, and applies limits.
  Expose only verified public facts through the canonical create and owner-scoped read routes, while
  keeping runtime composition unavailable until an eligible production catalog is independently
  approved and configured.
- **Reason:** Server authority requires more than a pure draw algorithm: retries, races, ownership,
  limits, historical catalog provenance, and public projection must fail closed without retaining
  raw questions, entropy, keys, or client-controlled facts. A hard safe-off runtime prevents the
  synthetic internal fixture from becoming publishable by implementation accident.
- **Date:** 2026-07-17

### [D-034 — Private one-card presentation and idempotent reveal boundary](records/decisions/D-034.md)

- **Decision:** Project exact reviewed catalog content beside verified one-card facts in a strict V2
  response; render it on one private theme-only page; and keep session creation, draw creation, and
  visual reveal as separate state transitions. Generate distinct browser idempotency keys, reuse
  the same keys only on explicit retry, never redraw on reveal, and expose the page through the same
  safe-off catalog gate as its API.
- **Reason:** A useful anonymous result needs server-owned meaning, limitations, reflection, and one
  small action without sending raw questions or trusting the browser to choose content. Separate
  idempotency and reveal transitions make retries stable and prevent accidental or compulsive
  redraws, while the shared gate prevents the synthetic test fixture from becoming public content.
- **Date:** 2026-07-17

### [D-035 — Unified tarot limit, explicit new-reflection, and categorical report boundary](records/decisions/D-035.md)

- **Decision:** Require the Web reading policy to exactly match the persistence limit version,
  maximum, and window; preserve same-key manual retry and the prior revealed result; permit only an
  explicit post-result action to create a new reflection; and store exact categorical, no-free-text
  reports as owner-bound append-only rows whose expiry inherits the parent reading.
- **Reason:** Server-authoritative limits and distinct recovery/new-reflection transitions prevent
  silent rerolls, while minimal idempotent report records provide auditable correction input without
  collecting private prose, leaking reading existence, or inventing another retention period.
- **Date:** 2026-07-17

### [D-036 — Tab-scoped UUID-only tarot result resume boundary](records/decisions/D-036.md)

- **Decision:** Store only one strict UUID V4 per tarot reading type in tab-scoped
  `sessionStorage`; restore through the exact owner-scoped no-store GET into an explicit reveal
  state; clear invalid/private-404 IDs, retain transient failures for manual retry, and replace the
  prior ID only after a new fixed result validates.
- **Reason:** Same-tab recovery preserves a useful immutable result without redraw, private-text
  storage, cross-tab tracking, new retention, automatic traffic, or loss of the previous result
  during a failed new attempt.
- **Date:** 2026-07-18
