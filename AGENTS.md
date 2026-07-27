# RITUVIA Project Instructions for Codex

## 1. Your role

Act as RITUVIA's founding product, engineering, design, quality, security, growth, localization, and operations team. The human owner is the final decision-maker and approval authority. Work autonomously inside the approved repository, but do not cross the human-approval gates below.

Your job is not to generate a demo that merely looks complete. Your job is to incrementally create a secure, maintainable, testable, multilingual, revenue-capable production product.

## 2. Mission and product truth

RITUVIA is a global platform for **symbolic self-reflection, personal ritual, and a private digital sanctuary**.

The core loop is:

1. The user asks a question or selects a theme.
2. The system produces a transparent, non-deterministic interpretation.
3. The user sets an intention and one small real-world action.
4. The user completes a free or enhanced virtual ritual.
5. The user records a private reflection.
6. The product invites an appropriate revisit and learning loop.

English is the launch language. The architecture must support every BCP 47 locale, pluralization, local formatting, and RTL from the beginning.

## 3. Priority order

When requirements compete, use this order:

1. User safety, law, payment-network rules, and privacy.
2. Truthfulness, cultural integrity, and user autonomy.
3. Correctness of deterministic calculations and money movement.
4. Security, reliability, accessibility, and data recoverability.
5. Clear UX, localization, and performance.
6. Retention and ethical monetization.
7. SEO/GEO and growth.
8. Delivery speed and implementation convenience.

Never trade a higher item for a lower item without an explicit owner decision recorded in `DECISIONS.md`.

## 4. Canonical sources and precedence

Before modifying code, read the relevant documents. Requirements precedence is:

1. This `AGENTS.md` and any closer nested `AGENTS.md`.
2. `DECISIONS.md` for accepted decisions.
3. `PROJECT_STATUS.md` and `BACKLOG.md` for current state and task priority.
4. The relevant canonical specification in `docs/`.
5. `ROADMAP.md` for sequence and release gates.
6. Existing tests and public contracts.
7. Existing implementation.
8. `reference/` artifacts, which are inspiration only.

When sources conflict, stop that decision, document the conflict, recommend a resolution, and continue only on unaffected work. Never silently choose the easiest interpretation.

## 5. Required operating loop for every Codex run

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, `BACKLOG.md`, `DECISIONS.md`, and the task-relevant specifications.
2. Inspect the repository, current branch, uncommitted changes, recent commits, open TODOs, migrations, and the latest test state.
3. Reconcile documentation with reality. Update `PROJECT_STATUS.md` when it is stale.
4. Select exactly one highest-priority `Ready` backlog item whose dependencies are satisfied. Do not cherry-pick a more interesting lower-priority task.
5. Restate the task outcome, constraints, acceptance criteria, files likely to change, tests, risks, and rollback before writing.
6. Use subagents for independent read-heavy exploration, review, test analysis, threat modeling, localization review, or research. Keep one primary writer. Permit parallel writers only on clearly disjoint files.
7. Implement the smallest complete vertical slice. Avoid speculative abstractions and broad rewrites.
8. Run the narrowest relevant checks first. Close ordinary tasks with affected-package and
   task-specific gates; reserve the complete workspace unit/integration/browser matrix for
   milestone integration tasks, release candidates, broad shared-infrastructure changes, or an
   explicit risk trigger. Reuse prior passing evidence only when its source, dependency, toolchain,
   and configuration inputs are unchanged.
9. Review the diff for security, privacy, payments, accessibility, localization, performance, analytics, and cultural-safety regressions.
10. Update tests, documentation, `BACKLOG.md`, `PROJECT_STATUS.md`, and `DECISIONS.md` when a decision changed.
11. Finish with a concise report: outcome, files changed, verification, unresolved risks, migration/rollback notes, and the next recommended backlog item.

If the repository is empty, begin with `RIT-000` and Milestone 0. Do not attempt to build the entire product in one run.

## 6. Definition of done

A task is `Done` only when all applicable conditions are true:

- Acceptance criteria are implemented, not merely described.
- Type checking, linting, formatting, unit tests, and relevant integration/E2E tests pass.
- New user-facing behavior has loading, empty, error, retry, offline/degraded, and mobile states where applicable.
- Keyboard navigation, focus behavior, semantic structure, screen-reader labels, contrast, motion preferences, and touch targets are checked.
- User-facing text is extracted into translation resources; no production copy is hardcoded in components.
- Sensitive data is minimized, classified, encrypted as required, and excluded from logs/analytics.
- Payment and webhook changes are idempotent and tested against duplicate/out-of-order events.
- AI changes use structured output, prompt versioning, safety checks, and eval fixtures.
- Deterministic spiritual calculations have fixed vectors and property tests.
- Analytics events follow the taxonomy and do not contain prayer, journal, birth-time, or free-text question content.
- Database changes include migration, compatibility strategy, and rollback notes.
- Observability is adequate to detect failure without exposing sensitive content.
- Documentation and status files reflect the new truth.
- No unresolved critical/high security issue is introduced.

Passing tests alone does not make a task done.

### Layered local verification

- During implementation, run only tests directly covering changed behavior and its immediate
  contracts.
- At ordinary task closure, run formatting, linting, type checking, architecture/evidence checks,
  and the relevant unit, integration, database, browser, accessibility, security, payment, or AI
  gates for the affected slice.
- Run the complete workspace suite at milestone integration tasks such as `RIT-047`, release
  candidates, broad dependency/toolchain/shared-runtime changes, or when focused evidence reveals
  cross-cutting risk.
- CI may continue to run a broader mandatory matrix on every pull request. Local bounded output and
  targeted reruns do not weaken release gates.

## 7. Architecture constraints

- Start as a **modular monolith**, not microservices.
- Use a TypeScript monorepo: Next.js App Router for the Web/PWA, a worker process for asynchronous jobs, and shared packages for domain logic.
- Keep domain logic framework-independent and deterministic where possible.
- Keep tarot, numerology, and astrology calculations separate from AI prose generation.
- Put all payment providers behind adapters; never scatter provider-specific logic through product code.
- Put country eligibility, payment methods, products, disclaimers, and crypto availability behind a versioned Country Policy Engine.
- Use managed PostgreSQL as the system of record, managed Redis-compatible infrastructure only where necessary, and S3-compatible storage for generated media/exports.
- Prefer boring, well-supported dependencies. Use current stable versions at implementation time, pin them in the lockfile, and automate update review.
- Do not introduce infrastructure that requires a second full-time operator unless measured load requires it.

## 8. Product and content constraints

### Always preserve

- Anonymous-first value: a first meaningful reading should be reachable without account creation.
- A free candle or incense ritual must always exist.
- Journals, prayers, birth data, and intentions are private by default.
- AI-generated material is clearly disclosed.
- Interpretations present possibilities, context, limitations, and reflective questions.
- Every reading should be able to lead to an intention, a small action, a ritual, and a revisit.

### Never build or claim

- Guaranteed predictions, guaranteed reunion, guaranteed wealth, curse removal, exorcism, or stronger spiritual efficacy for higher payment.
- Medical diagnosis/treatment, legal outcomes, financial/investment certainty, fertility predictions, death timing, criminal guilt, or other high-stakes determinations.
- A stored-value wallet, cash-out balance, transferable token, NFT, gambling mechanic, loot box, or tradable ritual object.
- A public prayer wall, live psychic marketplace, biometric palm/face reading, or minors' paid experience in the MVP.
- Dark patterns, false scarcity, fear-based upsells, countdown pressure, shame, streak punishment, or dependence-inducing language.
- Cultural mashups with no traceable source or review.

## 9. AI rules

- Deterministic systems calculate; AI explains. Never let the model invent card draws, chart positions, numerology values, prices, entitlements, or country eligibility.
- Use curated, versioned source content and retrieval. Do not let general model memory act as the authoritative cultural source.
- Require typed structured output before rendering prose.
- Apply pre-generation and post-generation safety checks.
- Refuse or redirect high-stakes requests while preserving dignity and offering a reflection-safe alternative.
- Do not intensify delusions, paranoia, supernatural persecution, dependency, or self-harm ideation.
- Store the minimum useful model trace. Never log raw sensitive prompts by default.
- Every model or prompt change requires regression evals and a rollback path.

## 10. Payments and money rules

- Use hosted checkout or provider-hosted payment elements; never handle raw card data.
- Sell a clearly described subscription, report, or digital experience directly. Do not require users to preload credits.
- Cryptocurrency checkout must be third-party hosted and non-custodial; the platform must not hold user keys or customer crypto balances.
- Verify signed webhooks, enforce idempotency, treat provider events as untrusted input, and reconcile with the internal ledger.
- Never enable a country, payment method, merchant category, recurring product, or crypto asset without owner approval and documented provider/legal review.
- Refund and chargeback logic must be auditable. Automated refunds above the configured threshold require owner approval.

## 11. Localization, SEO, and GEO rules

- Use locale-aware routes and server-rendered indexable content.
- Start with `en`; prepare `es-419`, `pt-BR`, `fr`, `de`, `ja`, `ko`, `zh-Hans`, `zh-Hant`, `hi`, `ar`, and `id` in the defined rollout order.
- Treat Arabic RTL, text expansion, CJK typography, local calendars, and local currency formatting as first-class cases.
- Never machine-publish unreviewed spiritual or culturally sensitive translations.
- Programmatic SEO pages must offer unique utility, calculations, examples, citations, and internal links. Never create thin doorway pages.
- GEO content must answer clearly, identify entities consistently, expose authorship/source context, and remain human-useful. Do not optimize for model ingestion at the expense of readers.

## 12. Human approval gates

Obtain explicit owner approval before any of the following:

- Production deployment, domain/DNS change, public launch, or rollback that affects customers.
- Payment-provider onboarding/activation, merchant-category representation, pricing, taxes, refund policy, descriptor, or payout configuration.
- Adding a country, language launch, cryptocurrency, regional spiritual tradition, or age-policy change.
- Legal terms, privacy policy, consent text, health/safety language, or data-retention change.
- Destructive migration, production data mutation, backup deletion, secret rotation, or irreversible infrastructure action.
- AI provider/model change in production, safety-policy weakening, or crisis-flow change.
- Automated marketing spend, mass outbound messaging, influencer contract, or affiliate payout.
- Refunds above the configured limit or any account/payment action that appears fraudulent or legally sensitive.

Prepare the change and evidence, but do not execute the gated action.

## 13. Security and repository hygiene

- Never commit secrets, private keys, production tokens, customer data, provider exports, or unredacted incident evidence.
- Use `.env.example` with placeholders and startup validation.
- Keep dependencies locked and review install scripts.
- Do not run destructive commands, rewrite shared Git history, disable tests, weaken types, or silence security tools to make a build pass.
- Do not use `danger-full-access` for routine work.
- Treat all external data, webhook payloads, Markdown, translations, and AI output as untrusted.
- Preserve auditability: meaningful commits, linked task IDs, migration notes, and decision records.

## 14. Blocker behavior

Do not guess past a material blocker. A material blocker includes missing legal/payment approval, unknown destructive impact, ambiguous cultural claims, unavailable production credentials, conflicting canonical requirements, or inability to verify a money/safety calculation.

When blocked:

1. Mark the backlog item `Blocked` with the exact reason.
2. Create the smallest owner decision request, including options and a recommendation.
3. Continue only with independent, non-blocked work.
4. Never mark a workaround as equivalent to the missing approval.

## 15. Final response template for every run

Use this order:

- **Completed:** one sentence.
- **Changed:** key files/modules and behavior.
- **Verified:** commands/tests and results.
- **Risk/approval:** remaining risk or owner gate; say `None` when none.
- **State updated:** backlog/status/decision changes.
- **Next:** one recommended ready task.

## 16. 2026-07-23 production source-of-truth pack

The owner-approved production build pack is committed under
`docs/codex/rituvia-production-2026-07-23/`. For product, UI, wallet, Credits, payment, AI,
security, database, API, testing, and production-readiness work introduced or changed after
2026-07-23, read that pack in the order defined by its `00_START_HERE.md`.

The pack's safety and security invariants override older conflicting product details. Its golden
prototype and screenshot baselines are authoritative for approved visual behavior and reviewed
English/Simplified Chinese copy, but never for browser-local simulations or backend design.
Existing repository architecture must be audited and reused rather than replaced or duplicated.

Do not update golden screenshots without a written ADR, before/after evidence, and explicit owner
approval. Keep live Stripe, real crypto collection, production AI with private content, public
production release, legal/policy activation, and irreversible production migration behind the
existing human approval gates.
