# RITUVIA Decision Log

This is an append-only summary of accepted architectural and product decisions. Detailed decisions may use `templates/ADR_TEMPLATE.md`. Do not rewrite historical rationale; supersede it with a new entry.

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
