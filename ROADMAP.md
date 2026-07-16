# RITUVIA Delivery Roadmap

This is a dependency sequence, not a promise of calendar time. Codex must complete release gates before moving forward, even when AI makes implementation fast. Each milestone should end with a runnable, reviewed increment.

## M0 — Reproducible engineering foundation

**Outcome:** a private repository that any fresh environment can install, test, build, and preview without undocumented state.

Includes:

- Monorepo, strict TypeScript, formatting/linting, package boundaries.
- Environment validation, brand config, feature flags, synthetic seed strategy.
- PostgreSQL/Prisma foundation and local containers.
- CI, test harness, preview smoke, dependency/secret scanning.
- Observability/redaction baseline.
- Status/backlog/ADR discipline.

**Exit:** clean clone → documented setup → database migrate → test → build succeeds; no secrets; CI enforces it.

## M1 — Trustworthy public shell and design system

**Outcome:** accessible English marketing/product shell that communicates the category and can support future locales.

Includes:

- Brand-configured public shell, navigation, footer, trust/methodology/safety pages.
- Core accessible components and responsive layout.
- Locale-prefixed routing, message extraction, metadata/canonical foundation.
- Light/dark/system, reduced motion, error/empty/loading patterns.
- Non-indexable preview environments.

**Exit:** mobile/desktop/keyboard/screen-reader smoke passes; no hardcoded brand/copy; public HTML is useful and indexable only in production.

## M2 — Anonymous deterministic tarot vertical slice

**Outcome:** a user can reach a useful one-card/three-card tarot result anonymously.

Includes:

- Anonymous subject/session and consent baseline.
- Safe question/theme intake.
- Tarot deck/content schema and server-authoritative draw.
- Result UI with deterministic facts, canonical meanings, boundary, reflection question, small action.
- Usage limits, idempotency, save-in-session, report control.

**Exit:** deterministic and E2E tests pass; result is useful without AI, account, or payment.

## M3 — Bounded AI interpretation and evaluation

**Outcome:** AI enriches tarot without inventing facts or crossing safety boundaries.

Includes:

- AI provider adapter, structured output, prompt/content versions.
- Retrieval of curated approved content.
- Pre/post safety pipeline and deterministic fact verifier.
- Fallback templates, streaming/polling, reports, eval dashboard/artifacts.
- Crisis/high-stakes/supernatural-dependency boundaries.

**Exit:** 100% fact/schema validity through fallback and zero critical failures in the release eval set; model/prompt rollback works.

## M4 — Intention, free ritual, journal, and revisit loop

**Outcome:** the full product loop works before monetization.

Includes:

- Intention composer and small action.
- Accessible sanctuary with free candle/incense.
- Ritual completion and private journal.
- Revisit scheduling/completion and consented reminders.
- Privacy-safe core-loop analytics.

**Exit:** anonymous/mobile user can complete Question → Interpretation → Intention → Ritual → Journal → Revisit; no coercive or infinite-engagement design.

## M5 — Accounts and privacy control

**Outcome:** users can safely save/sync and control their data.

Includes:

- Magic link/passkey/provider auth adapter.
- Anonymous-to-account merge.
- History, sessions, preferences, consent.
- Export, selective deletion, account deletion.
- Admin role/authorization/audit foundation.

**Exit:** account/merge/IDOR/privacy E2E and recovery tests pass; sensitive content stays out of logs/analytics.

## M6 — Commerce foundation and fiat sandbox

**Outcome:** named digital products can be purchased safely in provider sandbox.

Includes:

- Catalog/product/price versioning.
- Order, payment attempt, event, ledger, entitlement.
- Country Policy Engine.
- Fiat hosted checkout adapter and signed webhooks.
- Pending/return/reconciliation/refund states.

**Exit:** duplicate/out-of-order/invalid webhook, redirect race, refund, and reconciliation tests prove exactly-once entitlement behavior.

## M7 — Subscription, paid ritual objects, and operations

**Outcome:** subscription and one-time entitlements are usable and supportable.

Includes:

- Subscription lifecycle/cancellation.
- Paid sanctuary themes/objects with exact product terms.
- Purchase history and self-service management.
- Refund/dispute/support/admin operations.
- Daily payment reconciliation and alerts.

**Exit:** paid enhancements remain non-efficacy-based; all commerce/support/audit flows pass sandbox rehearsal.

## M8 — Numerology

**Outcome:** transparent life-path/birthday/personal-year calculators and interpretations.

Includes:

- Versioned formulas and worked test vectors.
- Public calculators/SEO pages.
- Persisted readings and AI interpretation.
- Locale/alphabet limitations and name privacy.

**Exit:** formula transparency, deterministic tests, accessibility, and content-source review pass.

## M9 — Western astrology after license decision

**Outcome:** reproducible natal facts and bounded interpretation.

Includes:

- Licensed engine adapter.
- Location/historical time-zone handling.
- Birth profile, precision/unknown-time UX.
- Natal calculation, chart/table UI, interpretation/evals.

**Exit:** engine/license evidence, reference-chart tests, uncertainty UX, privacy deletion, and AI fact verification pass.

## M10 — Localization platform and first localized beta

**Outcome:** full translation workflow and RTL-capable product.

Includes:

- ICU messages, localized content, glossary, review states.
- Arabic RTL, CJK, Devanagari and text-expansion QA.
- Locale metadata, sitemap/hreflang, email/notification localization.
- One Tier 1 locale closed beta selected by evidence.

**Exit:** no mixed-language critical flow, legal/safety/payment content reviewed, locale support and country policy aligned.

## M11 — SEO, GEO, sharing, and content engine

**Outcome:** a durable organic acquisition system, not thin generated pages.

Includes:

- Card/number/astrology libraries, calculators, ritual/reflection guides.
- Structured data, sitemap, canonical/hreflang, redirects.
- Editorial/source/license workflow and internal linking.
- Redacted share cards and generative-engine-friendly answer structure.
- Search quality/coverage monitoring.

**Exit:** curated indexable inventory passes quality/duplicate/source/performance/accessibility review; no private data leaks.

## M12 — Security, reliability, admin, and autonomous operations

**Outcome:** one owner can observe, recover, and govern production safely.

Includes:

- Complete admin, roles/MFA/audit.
- Threat model, security scans, rate/abuse, provider kill switches.
- Backups/restore, SLO/alerts, incident/runbooks/status.
- Daily/weekly/monthly Codex automation and cost guardrails.
- Support/privacy/safety queues.

**Exit:** release evidence, restore test, incident tabletop, permission review, and owner dashboard pass.

## M13 — Closed English beta

**Outcome:** validate trust, activation, loop completion, safety, retention, and operations with invited adults.

Includes:

- Free and sandbox/tightly approved payment cohorts.
- Qualitative interviews and accessibility feedback.
- Metric data-quality verification.
- AI/content/support issue remediation.

**Exit:** no critical safety/payment/privacy issue; first-value and full-loop behavior validated; owner accepts remaining risks.

## M14 — Limited paid launch

**Outcome:** one or a small set of approved countries can pay reliably.

Requires:

- Formal brand/domain clearance.
- Company, tax/MoR, legal documents, country policy.
- Written primary/backup payment underwriting.
- Production provider, support, refund/dispute, reconciliation.
- Full release and rollback rehearsal.

**Exit:** recorded owner go/no-go, progressive rollout, stable monitoring, and contribution economics measured.

## M15 — Evidence-led global expansion

**Outcome:** expand only where product and risk data support it.

Possible work:

- Tier 1/2 locales and country payment routes.
- Hosted non-custodial crypto pilot.
- Additional spreads/reports/ritual collections.
- Regional tradition packs with dedicated experts/sources.
- Native apps only if PWA behavior/economics justify them.
- Selective service extraction only after measured architectural pressure.

**Exit for each expansion:** its own country, culture, content, payment, legal, safety, support, and rollback gate.
