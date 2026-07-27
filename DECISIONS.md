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

### [D-037 — Provider-neutral, public-fact-only AI interpretation contracts](records/decisions/D-037.md)

- **Decision:** Establish a pure Tarot-first AI package that consumes only public deterministic
  facts and exact versioned provenance, exposes capability-shaped structured generation with
  opaque allowed authorization, normalized failures, and provisional streams, and validates the
  canonical reflective output with strict bounded schemas bound to the parsed input's exact facts,
  sources, and approved ritual codes. Defer retrieval, question safety, orchestration/fallback,
  prose safety/fabrication verification, provider activation, and other modalities to their
  sequenced tasks.
- **Reason:** A narrow provider-neutral boundary prevents private data, internal draw audit,
  invented modality facts, vendor objects, and structurally unsafe output from becoming accepted
  contracts before the required retrieval and safety pipeline exists.
- **Date:** 2026-07-18

### [D-038 — Exact published-content retrieval and checksummed prompt artifacts](records/decisions/D-038.md)

- **Decision:** Require independent checksum and server-owned allowlist verification before exact
  published Tarot content or an approved prompt can become a runtime-issued prompt artifact;
  separate checksummed system instructions from bounded JSON data and attach complete immutable,
  persistable provenance without performing generation or persistence.
- **Reason:** Structural approval fields and caller-provided digests cannot authenticate content,
  unpublished or cross-version material must never reach a model, and later orchestration needs an
  unforgeable artifact that reconstructs exactly which facts, sources, prompt, schemas, and policies
  were used.
- **Date:** 2026-07-18

### [D-039 — Fail-closed pre-generation safety and request-bound authorization](records/decisions/D-039.md)

- **Decision:** Re-evaluate bounded raw intake inside a pure English/Tarot gate; require exact
  server-owned classifier and policy authority; merge routes without downgrades; keep question and
  risk data transient; and mint only an opaque authorization bound to the exact allowed request.
- **Reason:** Client routes, structural decisions, or reusable authorization cannot safely prove
  that high-stakes and crisis policy ran before divination or generation, while storing sensitive
  moderation data would create unnecessary privacy risk.
- **Date:** 2026-07-18

### [D-040 — Provider-neutral generation, authorized fallback, and fenced persistence](records/decisions/D-040.md)

- **Decision:** Require exact runtime-issued input, prompt, authorization, provider/model
  registration, and fallback-template authority; enforce strict structured-result validation,
  monotonic deadline/cancellation, one safe retry, an exact fallback allowlist, durable no-output
  failed states, redacted metadata, and owner-scoped PostgreSQL claims with database-clock leases,
  a 30-second execution buffer, and compare-and-set fencing while the runtime remains safe-off.
- **Reason:** Generation must tolerate provider failure without trusting caller configuration,
  persisting unverified prose, leaking sensitive content, duplicating paid inference, or inventing
  a retention policy before the post-generation verifier and owner-gated runtime exist.
- **Date:** 2026-07-18

### [D-041 — Monotonic post-generation verification and append-only safe results](records/decisions/D-041.md)

- **Decision:** Accept only a runtime-issued single-use provider candidate bound to exact
  generation context and an approved verification runtime; apply whole-output deterministic and
  independent semantic checks monotonically; replace unsafe or uncertain candidates with the
  already-authorized deterministic fallback; and atomically persist only a verified or safe-
  replacement output in a one-to-one append-only owner-scoped verification record with keyed replay
  validation, while a historical pending row without a child remains non-displayable.
- **Reason:** Structurally valid prose and self-reported safety flags do not prove factual or safety
  integrity, while mutating the immutable RIT-033 terminal row or storing rejected prose would
  weaken fencing, authenticated replay, privacy, and append-only guarantees.
- **Date:** 2026-07-18

### [D-042 — Private durable-only tarot interpretation polling boundary](records/decisions/D-042.md)

- **Decision:** Start interpretation only through an explicit owner-bound UUID-idempotent POST;
  poll status through a separate side-effect-free GET; expose only strict non-displayable
  processing/failure states or a durable verified/reviewed-fallback projection; and bound the
  foreground client to cancellation, eight polls, and same-operation manual retry while runtime
  composition remains hard safe-off.
- **Reason:** Browser delivery must never disclose provisional provider prose, turn a read into
  paid work, duplicate inference, leak internal provenance, or imply that an unavailable provider
  runtime is active.
- **Date:** 2026-07-18

### [D-043 — Fixed synthetic AI release evaluation gate](records/decisions/D-043.md)

- **Decision:** Bind one versioned English/Tarot synthetic suite to an independent safe-off baseline
  by checksum; score exact outcomes with compiled zero-tolerance fact, schema, source, fallback,
  safe-control, privacy, continuation, completeness, and critical-safety thresholds; and pin the
  production-boundary evaluation command as an explicit Quality workflow step.
- **Reason:** Dispersed tests, fixture-defined thresholds, aggregate/model-judge scores, or an
  all-fallback result cannot provide a trustworthy release decision, while live provider calls
  would introduce unauthorized secrets, spend, and nondeterminism.
- **Date:** 2026-07-18

### [D-044 — Lumora-reference local commercial MVP consolidation](records/decisions/D-044.md)

- **Decision:** For the owner-directed local commercial MVP, use
  `reference/lumora_interactive_prototype.html` and `reference/lumora_business_plan_zh.html` as the
  primary product references for scope, UX, and the commercial loop, and consolidate execution in
  RIT-158. Deliver one responsive English vertical slice covering anonymous reading, account
  sign-in/sign-out, exact 18+ paid attestation, intention, free and owned paid rituals, encrypted
  private journal/revisit, a server-authoritative catalog, Stripe hosted-checkout adapter, signed
  local checkout simulator, and verified webhook-to-ledger-to-entitlement fulfillment. `AGENTS.md`
  safety, privacy, payment, cultural-integrity, and human-approval floors continue to override any
  conflicting prototype or business-plan detail. The 2026-07-18 corrective owner directive also
  makes standalone Sanctuary intentions valid and selects the prototype's 22-card Rider-Waite-
  Smith Major Arcana ordering for new local readings, while retaining the superseded three-symbol
  catalog only for exact historical replay.
- **Reason:** A runnable local commercial loop now provides better owner validation than continuing
  isolated milestone slices, while one consolidated record preserves the distinction between local
  product evidence and unapproved production payment, legal, provider, or launch state.
- **Date:** 2026-07-18

### [D-045 — Production pack precedence and Phase 0 reconciliation](records/decisions/D-045.md)

- **Decision:** Install the owner-supplied 2026-07-23 production source-of-truth pack with only the
  repository-required deterministic LF normalization for its security matrix, execute one Phase 0
  repository reality audit before more feature work, apply its safety/security invariants and
  golden UI contract to future changes, and adapt its SQL/OpenAPI to the existing modular
  TypeScript/PostgreSQL architecture rather than replacing or duplicating it.
- **Reason:** The new production contracts materially supersede older product details and require
  a verified reuse/gap/security plan before continuing RIT-037 or introducing wallet, Credit,
  payment, AI, or bilingual production behavior.
- **Date:** 2026-07-23

### [D-046 — Split exact interpretation reporting from history and paid regeneration](records/decisions/D-046.md)

- **Decision:** Re-scope RIT-037 to an owner-scoped categorical report bound to one exact
  displayable interpretation result through the existing reading report boundary; add no
  history/list or regeneration/start behavior, and defer paid Deep Reading creation, version
  history, and regeneration until a separate Credits transaction task can reserve, consume, or
  release Credits exactly once.
- **Reason:** The production pack makes AI an explicit paid Deep Reading capability, while the
  repository does not yet have the required Credit reservation/projection authority and currently
  constrains interpretation generation to one. Extending history or the old free safe-off POST
  boundary would encode the wrong transaction model and risk duplicate or uncharged generation.
- **Date:** 2026-07-23

### [D-047 — Production ritual catalog and legacy replay separation](records/decisions/D-047.md)

- **Decision:** Use production-pack ritual codes for a new versioned source-governed catalog;
  distinguish free objects, permanent objects, and consumable rituals through abstract access
  requirements; retain the historical `reflection-ritual.v1` code set unchanged; and map every
  legacy code only for exact historical replay, including `golden_intention_bowl` to
  `golden_bowl`. Keep Credit, payment, entitlement fulfillment, pass consumption, and durable
  session snapshots outside the read-only catalog domain until their sequenced transactional
  foundations exist.
- **Reason:** Silent renaming would corrupt historical meaning, treating passes as permanent
  ownership would violate the production contract, and allowing ritual content to carry money or
  efficacy authority would cross commerce and safety boundaries.
- **Date:** 2026-07-24

### [D-048 — Additive ritual lifecycle and durable-pause boundary](records/decisions/D-048.md)

- **Decision:** Preserve historical ritual/journal tables unchanged; add separate v2 lifecycle,
  private-journal, and consumable-pass tables; resolve exact catalog/access authority on the
  server; consume a pass only in the session-creation transaction; bind new journal ciphertext to
  owner and journal ID; and map visible Sanctuary exit to durable pause rather than abandonment.
- **Reason:** Relaxing v1 constraints would corrupt replay, split pass writes can double-spend, and
  terminal abandonment conflicts with the approved “leave for now” interaction.
- **Date:** 2026-07-24

### [D-049 — Local-calendar Revisit and reminder-safe boundary](records/decisions/D-049.md)

- **Decision:** Represent a Revisit by local calendar date plus IANA time zone; support next-day,
  seven-day, and custom scheduling; snapshot original intention/action under resource-bound
  encryption; bind only the intention in v1; store optional quiet hours while reminder preference
  remains none and channel remains null; treat the date as an invitation rather than an unlock;
  and use independently versioned ciphertext plus an append-only operation ledger for revisioned
  reschedule, completion, archive, and soft deletion without any delivery adapter.
- **Reason:** A fixed UTC instant can shift the chosen return day across DST, reusing only the
  intention date cannot preserve or complete a comparison, and activating reminders would cross
  consent, copy, operations, and production-email gates owned by RIT-045.
- **Date:** 2026-07-24

### [D-050 — Layered local verification with milestone full-suite gates](records/decisions/D-050.md)

- **Decision:** Use targeted affected-area tests during implementation and ordinary task closure;
  reserve the complete workspace matrix for milestone integration tasks such as RIT-047, release
  candidates, broad shared-runtime/toolchain changes, or explicit risk triggers. Reuse prior
  passing evidence only when all tested inputs remain unchanged, while CI may retain broader
  mandatory pull-request gates.
- **Reason:** Repeating more than fifteen hundred unaffected unit tests plus every integration and
  browser gate after each small edit consumes time and output without proportional confidence.
- **Date:** 2026-07-24

### [D-051 — Safe-off consented-anonymous core-loop analytics baseline](records/decisions/D-051.md)

- **Decision:** Define WMRS v1 as distinct consented anonymous subjects with at least one
  reading-rooted qualifying Tarot reflection session in a rolling seven-day UTC window; keep
  qualifying sessions separate, freeze nine strict allowlisted events, derive purpose-scoped keyed
  pseudonyms, require exact current optional analytics consent, and keep all production collection,
  persistence, browser ingestion, vendors, retention, deletion, account merge, and backfill
  hard safe-off.
- **Reason:** The repository can prove event privacy and metric arithmetic without converting the
  necessary anonymous cookie into analytics consent or creating unapproved data-retention and
  production-activation obligations.
- **Date:** 2026-07-24

### [D-052 — Safe-off authentication provider and hardened session boundary](records/decisions/D-052.md)

- **Decision:** Keep authentication behind a local-only closed capability adapter; return only a
  constant local preview path and `HttpOnly` state; enforce database-atomic global plus bounded
  keyed identifier-bucket start limits; bind previous-session rotation at challenge start; require
  session-derived CSRF and durable revocation; and add passkey persistence constraints without
  activating WebAuthn.
- **Reason:** This closes enumeration, bearer exposure, login-flooding, fixation, CSRF, and false
  logout gaps without collecting network fingerprints or crossing production provider, passkey,
  retention, deployment, or public-launch approval gates.
- **Date:** 2026-07-24

### [D-053 — Immutable subject bridge with recoverable account-session rotation](records/decisions/D-053.md)

- **Decision:** Preserve immutable anonymous ownership behind one append-only account link; commit
  authentication and optional merge atomically; bind merge evidence to both source sessions and the
  exact keyed request; derive one recoverable successor session for same-source/same-key retries;
  and prohibit opportunistic merge inside reflection mutations.
- **Reason:** This prevents duplicate history, cross-account claims, partial callback state,
  discarded replacement credentials, and unrecoverable response-loss retries without copying
  private rows or storing a bearer in audit data.
- **Date:** 2026-07-24

### [D-054 — Read-time private history with timestamp-only session controls](records/decisions/D-054.md)

- **Decision:** Project currently retained reflection history at read time through immutable
  account-subject links; expose minimal metadata only; preserve optimistic profile revisions; list
  sessions with lifecycle timestamps but no device fingerprint data; and prohibit targeted
  revocation of the current session.
- **Reason:** This provides useful account recovery and security controls without copying private
  rows, indexing private prose, extending retention, enabling cross-account authority, or adding a
  new tracking surface.
- **Date:** 2026-07-24

### [D-055 — Recently authenticated encrypted privacy export boundary](records/decisions/D-055.md)

- **Decision:** Preserve an immutable per-session authentication instant across merge rotation;
  require recent authentication for export request, metadata, and download; snapshot all retained
  implemented account-linked data through explicit allowlists; package matching JSON and Markdown;
  store only dedicated-key account/export/expiry-bound ciphertext; require session-CSRF download;
  and keep privacy audit append-only.
- **Reason:** This prevents stale-auth refresh, cross-account disclosure, bearer-URL leakage,
  plaintext backup exposure, omitted retained data, mutable completion evidence, and key-purpose
  coupling without prematurely duplicating the future worker/object-storage infrastructure.
- **Date:** 2026-07-25

### [D-056 — Immediate access revocation and crypto-shredding deletion boundary](records/decisions/D-056.md)

- **Decision:** Require recent authentication and exact-scope idempotency; revoke affected
  sessions, privacy-delete ownership links, crypto-shred implemented private ciphertext, destroy
  export artifacts, and pseudonymize/revoke account identity for whole-account deletion while
  preserving only pseudonymous derived, consent, commerce, security, and privacy evidence under
  existing source retention.
- **Reason:** Immediate authorization revocation plus targeted ciphertext destruction removes
  recoverable private text without breaking restrictive financial/audit relationships or
  inventing final legal retention, KMS, provider, backup, deployment, or launch policy.
- **Date:** 2026-07-25

### [D-057 — Safe-off admin authorization and passkey-assurance foundation](records/decisions/D-057.md)

- **Decision:** Centralize a finite default-deny admin role/action matrix; require active owner
  authority, recent authentication, same-identity live passkey assurance, and typed confirmation
  for append-only role changes; commit mutation plus digest-only hash-chained audit evidence in one
  serializable transaction; and keep MFA issuance, production enrollment, and admin routes safe-off.
- **Reason:** This prevents magic-link-only escalation, cross-identity MFA, mutable privilege
  history, private-value audit leakage, mutation without evidence, and broad database access
  without crossing WebAuthn/provider/deployment approval gates.
- **Date:** 2026-07-25

### [D-058 — Request-scoped privacy deletion and composed security gate](records/decisions/D-058.md)

- **Decision:** Admit privacy routes through an exact proxy allowlist, reject cross-site export
  metadata reads, bind the dedicated deletion login to one transaction-local request-token hash
  enforced by a security-barrier view and row-level policies, and compose the Milestone 5 security
  slices into one focused gate while running the complete workspace matrix only once at closure.
- **Reason:** Separately passing slices did not prevent proxy omissions, cross-site read attempts,
  or broad direct use of the deletion credential; database-bound request scope preserves
  least-privilege defense in depth without repeatedly running unrelated tests.
- **Date:** 2026-07-25

### [D-059 — Immutable successor Country Policy registry](records/decisions/D-059.md)

- **Decision:** Resolve country from stronger billing/account/reliable-geolocation evidence with
  conflicts denied; evaluate one immutable reviewed successor-chain head; separate fiat and crypto
  approval references; persist the complete strict policy document under bounded read-only runtime
  access; and implement kill switch/rollback by appending successors while staging/production stay
  empty and safe-off.
- **Reason:** Hardcoded per-product rules could not govern service/legal/data behavior, mutable
  policy would erase provenance, IP/locale could bypass stronger facts, and one payment gate could
  accidentally authorize another.
- **Date:** 2026-07-25

### [D-060 — Immutable catalog registry and legacy checkout quarantine](records/decisions/D-060.md)

- **Decision:** Store one strict immutable locale-aware catalog with exact Credit terms and fiat
  prices only for packs/Plus; seed local/CI only; serve it through the public catalog endpoint; and
  quarantine the obsolete direct-object USD checkout as a local replay/test fixture rather than a
  product source.
- **Reason:** The old four-price list conflicts with the owner-approved Credit model, cannot express
  exact contents or compliance scope, and could expose incorrect prices even when payment remains
  disabled.
- **Date:** 2026-07-25

### [D-061 — Additive v2 commercial transactions and append-only Credits](records/decisions/D-061.md)

- **Decision:** Keep legacy direct-USD commerce replay unchanged; add provider-neutral v2
  order/payment-attempt states, exact-request idempotency, append-only integer Credit
  ledger/reservations/allocations/projection, and source-specific Plus/permanent entitlements.
- **Reason:** Extending the legacy fixture would preserve the wrong product model and unsafe
  refund/dispute coupling, while mutable balances cannot prove allocation, concurrency, expiry, or
  reversal integrity.
- **Date:** 2026-07-25

### [D-062 — Account-owned purpose consent and immediate data-flow withdrawal](records/decisions/D-062.md)

- **Decision:** Keep analytics, AI personalization, and model improvement in separate exact-version
  account-owned append-only sequences; serialize mutations, deny runtime history changes, and
  reread current consent at each sensitive data-flow boundary so committed withdrawal applies
  across sessions immediately.
- **Reason:** Linked anonymous grants and mutable/cached booleans can revive stale authority, erase
  evidence, or keep private-data processing active after withdrawal; an account authority closes
  that gap without activating external analytics, AI, training, marketing, or notifications.
- **Date:** 2026-07-25

### [D-063 — Account-owned once-only Revisit reminder and safe-off delivery](records/decisions/D-063.md)

- **Decision:** Keep Revisit v1 reminder fields inert; add one account-owned once-only English email
  preference, privacy-minimal PostgreSQL queue, send-time authorization, bounded retry/dead-letter,
  fixed lock-screen-safe copy, and provider-neutral adapter that remains disabled outside tests.
- **Reason:** Delivery consent must not inherit analytics/AI consent or expose private reflection
  content, and a mutable/browser-local reminder cannot prove withdrawal, duplicate suppression,
  ownership, deletion, retry, or once-only delivery.
- **Date:** 2026-07-25

### [D-064 — Approved RITUVIA V1 date-numerology method](records/decisions/D-064.md)

- **Decision:** Sum canonical Gregorian date digits for Life Path, begin Birthday Number from the
  day integer, use an explicit target year for Personal Year, preserve exact 11/22/33 totals at
  every reduction step, and exclude names, transliteration, non-ASCII calculation input, and
  non-Gregorian conversion from V1.
- **Reason:** One explicit versioned method preserves prototype fidelity, deterministic replay,
  formula transparency, locale safety, and historical compatibility without presenting a
  numerology convention as universal or scientific.
- **Date:** 2026-07-25

### [D-065 — Approved English numerology interpretation and publication pack](records/decisions/D-065.md)

- **Decision:** Approve the checksummed English thirty-six-entry interpretation corpus, owned
  source-rights inventory, exact prompt/fallback/reviewer records, five-page public education
  cluster, and optional six-Credit `year_reflection` mapping while keeping AI and fulfillment
  activation safe-off.
- **Reason:** One versioned approval completes the content, safety, rights, and SEO contracts
  without turning profile records into doorway pages or crossing provider, payment, deployment, or
  public-launch gates.
- **Date:** 2026-07-25

### [D-066 — Select Swiss Ephemeris Professional for Western astrology](records/decisions/D-066.md)

- **Decision:** Select Swiss Ephemeris library 2.10.03 and separately pin the
  `v2.10.3final` source/data snapshot behind a pure provider-neutral interface; target the June
  2026 Professional Unlimited License while keeping selection V1 permanently production-safe-off
  and requiring independent evidence authorization before native integration.
- **Reason:** Swiss Ephemeris supplies the required astrology-specific deterministic calculations
  and self-hosted replayability, but its AGPL path is incompatible with the current repository,
  its commercial path has no SLA or warranty, and its native implementation requires separate
  legal, supply-chain, build, integrity, and runtime evidence.
- **Date:** 2026-07-25

### [D-067 — Versioned self-hosted location and historical time-zone boundary](records/decisions/D-067.md)

- **Decision:** Use a provider-neutral pure location/time-zone contract with a self-hosted
  GeoNames snapshot as the intended source, exact provider/data digest and Node/ICU/tzdata
  provenance, explicit fold/gap outcomes, and private bounded HMAC-keyed Web caching; add no HTTP
  route until OWN-014 resolves the planned GET conflict.
- **Reason:** Reproducible natal facts require historical rules and traceable place data, while
  birthplace queries cannot enter URLs, logs, shared caches, or silent current-offset/first-result
  fallbacks.
- **Date:** 2026-07-26

### [D-068 — Privacy-safe astrology location-search HTTP contract](records/decisions/D-068.md)

- **Decision:** Replace the rejected URL-query GET with an authenticated same-origin,
  session-CSRF-protected, rate-limited POST JSON contract using no-store responses, redacted
  telemetry, no raw-query retention, and no shared cache.
- **Reason:** Birth-location search is private input; the route must remain useful without placing
  sensitive queries in URLs, logs, analytics, durable storage, or public/shared caches.
- **Date:** 2026-07-26

### [D-069 — Adopt AGPLv3 for RITUVIA and Swiss Ephemeris](records/decisions/D-069.md)

- **Decision:** License the complete RITUVIA deliverable project under `AGPL-3.0-only`, use Swiss
  Ephemeris through its AGPL path, publish exact deployed Corresponding Source, and preserve all
  native supply-chain and production-safe-off gates while superseding the planned Professional
  License purchase.
- **Reason:** The owner explicitly accepts whole-project source publication, removing the
  commercial contract requirement without weakening source provenance, reproducibility,
  correctness, security, or public-launch review.
- **Date:** 2026-07-26

### [D-070 — Approved conservative Western astrology V1 calculation method](records/decisions/D-070.md)

- **Decision:** Use tropical zodiac, eleven selected bodies including True Node, exact-time
  Placidus houses, fixed major-aspect orbs, strict approximate/unknown-time suppression, and
  unavailable-without-partial-facts behavior for polar/house failure.
- **Reason:** One owner-approved checksummed convention makes natal facts replayable without hidden
  defaults, invented unknown-time placements, mixed house systems, or misleading partial results.
- **Date:** 2026-07-26

### [D-071 — Canonicalize the astrology kill-switch persistence key](records/decisions/D-071.md)

- **Decision:** Use `experience.astrology` as the canonical registry and PostgreSQL key while
  treating historical `astrology_enabled` text as the superseded semantic label for the same
  default-off control.
- **Reason:** The immutable feature-flag schema requires hierarchical dotted keys; an additive RLS
  policy preserves that constraint and enables a real staging drill without rewriting history or
  activating production.
- **Date:** 2026-07-26
