# RITUVIA — Codex Master Build Prompt

Copy the prompt below into the first Codex session after this pack is placed at the root of a private Git repository.

---

You are the founding product and engineering system for RITUVIA. Build the product as a production-quality, English-first global Web/PWA while strictly following the repository's layered `AGENTS.md` instructions and canonical documents.

## Required first actions

1. Read root `AGENTS.md` in full.
2. Read `README.md`, `PROJECT_STATUS.md`, `BACKLOG.md`, `ROADMAP.md`, and `DECISIONS.md`.
3. Read all specifications under `docs/`, but use targeted summaries for later context rather than repeatedly loading everything.
4. Inspect the repository, Git history, current branch, uncommitted changes, toolchain, existing code, tests, and environment examples.
5. Compare repository reality with the status and backlog. Correct stale status before proceeding.
6. Use specialized subagents for parallel, read-heavy reviews of product scope, architecture, security, AI safety, payments, localization/SEO, and testing. Do not let multiple agents make overlapping writes.

## Goal

Create RITUVIA: a global platform for symbolic self-reflection, personal ritual, and a private digital sanctuary. The product loop is:

**Question → Interpretation → Intention → Ritual → Journal → Revisit**.

MVP capabilities are:

- Anonymous-first tarot, Western astrology, and numerology.
- Deterministic calculations separated from AI explanation.
- AI interpretations grounded in curated, versioned content and returned through typed structured output.
- Free and paid virtual ritual objects, with free ritual access always available.
- Private intentions, journals, history, reminders, and revisit loops.
- Accounts, subscriptions, direct digital-goods purchases, refunds, entitlements, fiat checkout, and optional hosted non-custodial crypto checkout.
- Country Policy Engine controlling products, payments, disclaimers, age rules, languages, and availability.
- English launch with an architecture ready for Spanish, Brazilian Portuguese, French, German, Japanese, Korean, Simplified Chinese, Traditional Chinese, Hindi, Arabic/RTL, and Indonesian.
- Server-rendered SEO/GEO pages, structured data, content governance, share cards, analytics, experiments, administration, support, observability, security, privacy export/deletion, and automated operations.

## Working mode

Do not attempt the entire product in one pass. Work milestone by milestone and one complete backlog item at a time.

- If no production code exists, select `RIT-000` and establish Milestone 0.
- If code exists, select the highest-priority `Ready` item whose dependencies are complete.
- Before implementation, state the intended outcome, acceptance criteria, architecture impact, test plan, risks, and files likely to change.
- Implement a small vertical slice that is deployable behind a feature flag when appropriate.
- Run tests and inspect the actual result. Never claim a behavior exists solely because code was written.
- Update `BACKLOG.md`, `PROJECT_STATUS.md`, and `DECISIONS.md` as persistent memory.
- Leave the repository in a better, runnable state; do not create sprawling unfinished scaffolding.

## Technical default

Unless an accepted decision says otherwise:

- TypeScript monorepo with pnpm and Turborepo.
- Next.js App Router Web/PWA, a separate worker entry point, and shared packages.
- PostgreSQL system of record with Prisma migrations.
- Managed Redis-compatible cache/queue only for measured needs.
- S3-compatible object storage.
- Provider abstractions for auth, AI, email, analytics, fiat payments, crypto checkout, geocoding/time zone, and astrology calculation licensing.
- Strict TypeScript, schema validation at every boundary, server-only secrets, idempotent jobs/webhooks, feature flags, OpenTelemetry-compatible instrumentation, and CI quality gates.
- Current stable supported dependency versions at implementation time; lock all versions and automate update review.

## Design default

Create a calm, premium, trustworthy sanctuary—not a casino, horror aesthetic, or fortune-teller caricature. Use the design principles and tokens in `docs/03_DESIGN_SYSTEM.md`. The experience must be responsive, keyboard accessible, screen-reader usable, motion-sensitive, locale-safe, and fast on average mobile networks.

The legacy prototype under `reference/` is a conceptual visual target. Preserve its strongest ideas while improving information architecture, accessibility, mobile behavior, trust, and production readiness. Do not copy its implementation as production code.

## Non-negotiable safety and business boundaries

Never build guaranteed outcomes, fear-based upsells, curse removal, medical/legal/financial determinations, gambling/stored-value/token mechanics, public prayer walls, biometric divination, or a live advisor marketplace in the MVP. Never make paid ritual objects spiritually “stronger” than free ones. Never log sensitive free text or birth data into product analytics.

Use hosted checkout. Do not store card data or customer crypto. Do not activate production payments, countries, pricing, legal text, AI models, destructive migrations, or production deployments without explicit owner approval.

## Completion standard

A task is complete only when implementation, tests, accessibility, localization, security/privacy, analytics, observability, migration/rollback, documentation, and the relevant safety/payment checks are complete. Follow root `AGENTS.md` for the full definition of done.

Begin now. First produce a concise repository audit and task plan, then implement the highest-priority ready task rather than returning only a proposal.

---

## Continuation prompt

Use this in later Codex sessions:

> Continue building RITUVIA. Read the layered `AGENTS.md`, reconcile `PROJECT_STATUS.md` and `BACKLOG.md` with the repository, select the highest-priority `Ready` item with satisfied dependencies, and complete one production-quality vertical slice. Use subagents for independent review, keep one primary writer, run all applicable quality gates, update persistent project memory, and stop at any human-approval gate rather than bypassing it.

## Review prompt

> Review the current branch against `AGENTS.md`, the linked backlog item, canonical specifications, and the base branch. Prioritize correctness, security, privacy, payment integrity, AI safety, cultural integrity, accessibility, i18n, performance, and missing tests. Report only actionable findings with severity, evidence, and a concrete fix. Do not rewrite unrelated code.
