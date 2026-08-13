# RITUVIA Project Status

**Last reconciled:** 2026-08-03

## Current product truth

RITUVIA's retained product is one anonymous-first reflection loop: Question/Theme → safe Intake →
Interpretation → Intention → Small Action → always-free Ritual → Private Reflection → Revisit.
English is the only launch language. The nearest approved external milestone is an invite-only,
adult, protected, free closed Beta with at most 25 participants under D-097 and D-104.

The Owner accepted the current core-loop walkthrough under RIT-167 without a prioritized product
discrepancy. The homepage's free-reading controls now pass through safety intake under RIT-166.
Paid product expansion remains frozen: production must sell clearly named reports, subscriptions,
or digital experiences directly and must not require Credit preload. Existing Credit-pack,
subscription, local-checkout, and Stripe Test Mode code is historical integrity/replay evidence,
not an approved production offer.

The detailed route, workflow, state, recovery, and Button guide is
[docs/27_DETAILED_PRODUCT_USER_MANUAL_ZH.md](docs/27_DETAILED_PRODUCT_USER_MANUAL_ZH.md). The
evidence-gated path to launch is
[docs/26_PRE_LAUNCH_EXECUTION_PLAN_ZH.md](docs/26_PRE_LAUNCH_EXECUTION_PLAN_ZH.md).

## Current engineering state

- Modular TypeScript monorepo with Next.js App Router Web/PWA, Worker, shared domain packages,
  PostgreSQL/Prisma, strict architecture boundaries, generated evidence, and pinned Node.js 26.5.1
  plus pnpm 11.13.1.
- The local production artifact completes the six-stage anonymous core loop with no account or
  payment requirement, including private journal and Revisit lifecycle, accessibility checks, and
  safety intake states.
- Account/session, privacy export/deletion, catalog/order/ledger/entitlement, Stripe Test Mode,
  refund, reconciliation, subscription, commerce-admin, astrology, AI-safe-off, localization,
  content, backup/restore, support-case, SLO, cost-report, incident, and Owner-dashboard foundations
  exist at the repository-local evidence levels recorded by their task/decision records.
- RIT-162 removed only two dependency-proven dead artifacts. Active checkout, replay, privacy,
  migrations, Stripe, birth-profile, and reminder paths remain because they have callers or durable
  obligations.
- RIT-129 provides a provider-free eight-control staging/Gate H evidence contract. Its current
  derived result remains blocked/incomplete; it did not create standing staging or activate any
  provider.
- RIT-168 now requires an exact D-104 invite before protected-Beta anonymous-session issuance,
  atomically caps issuance at 25 seats, revokes bound sessions, rejects pre-policy cookies, emits
  raw invites only to private operator files, and provides the private `/en/beta` entry with calm
  recovery. It did not issue a real invitation, create staging, or deploy.

Capability detail and Keep/Freeze/Delete state live in
[docs/24_OWNER_PRODUCT_CAPABILITY_MAP_ZH.md](docs/24_OWNER_PRODUCT_CAPABILITY_MAP_ZH.md), not in this
status file.

## RIT-075 payment safety closure

D-110 now composes the exact country-scoped `market.country_activation` flag, the exact
`payments.fiat_checkout` or `payments.crypto_checkout` flag, and one Country Policy decision at the
same server-owned instant. Authorization is exact for country, currency/asset, provider, method,
payment kind, recurrence, registry/flag versions, and policy version.

The contract rejects every non-empty fallback-provider list and any malformed, forged, expired,
out-of-scope, time/version-drifted, or mismatched control. It runs before new order persistence,
subscription reservation, provider use, or disclosure of an already attached Checkout URL.
Operational checkout/control failures return a redacted unavailable result; eligibility denials
remain calm and non-sensitive.

The new-purchase gate deliberately does not block signed webhooks, refunds, disputes, fulfillment,
entitlement restoration, subscription events, or reconciliation for existing obligations. The
repository cannot revoke a provider URL copied before safe-off. No provider, credential, pricing,
paid UI, migration, deployment, DNS, network call, production payment, or launch was activated.
Operator and user boundaries are in
[docs/runbooks/RIT-075_PAYMENT_PROVIDER_CONTROLS.md](docs/runbooks/RIT-075_PAYMENT_PROVIDER_CONTROLS.md).

## RIT-074 dispute support closure

D-111 keeps the existing immutable, matched `commercial_payment_event_v2` row as the sole dispute
fact. An independent Worker now projects only an applied signed dispute with completed outbox,
current disputed order, and same-version Credit Pack fulfillment into one high-priority, immutable
metadata-only support work item. Ignored, mismatched, stale, unfulfilled, subscription, and
already-refunded observations do not create a current work item.

Projection failure is contained and retried independently, so it cannot roll back payment
ingestion, order state, fulfillment, Credit hold, or review shortfall. The runtime role receives
only exact event/projection columns and cannot read provider-object/amount/payload details or
private journals, or mutate the work item. It is deliberately not a second mutable case state
machine and has no RIT-125 triage/resolve path. There is no user/admin/provider Button, customer
message, chargeback response, production migration, deployment, or provider activation. Exact
workflow and recovery boundaries are in
[docs/runbooks/RIT-074_DISPUTE_SUPPORT.md](docs/runbooks/RIT-074_DISPUTE_SUPPORT.md).

## Release state

**Protected closed Beta: NO-GO. Public or paid production: NO-GO.**

The free Beta profile and repository-local invite enforcement are approved and implemented, but
release still requires exact RIT-127 runtime cost authority, standing isolated staging, actual
invite execution, provider-level backup/restore, external monitoring
and security evidence, support/recovery operation, RIT-130 release evidence, complete Gate H, and
an explicit Owner deployment decision.

Paid production additionally requires approved entity/brand/domain, legal/privacy/consent text,
first country, tax/MoR posture, payment underwriting, exact direct-sale SKU/price/entitlement/refund
language, budget, production provider configuration, full staging/rollback rehearsal, and Owner
go/no-go. Stripe Live, crypto, production AI with private content, public indexing, deployment, and
DNS remain disabled or absent.

## Owner gates and blockers

| Gate    | Current truth                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWN-001 | Brand/domain clearance remains open.                                                                                                               |
| OWN-002 | Production payment underwriting remains open; Stripe Test evidence is not approval.                                                                |
| OWN-004 | Entity, first country, legal-market, and tax posture remain open.                                                                                  |
| OWN-005 | Option A safe-off is approved; exact Option B budgets plus durable atomic enforcement and alert delivery remain missing, so RIT-127 stays Blocked. |
| OWN-006 | Crypto is excluded from the approved first Beta and needs separate future approval.                                                                |
| OWN-018 | Exact direct-sale products, pricing, entitlement, refund, and customer language remain blocked pending legal/provider review.                      |
| OWN-019 | Exact protected-Beta abuse/ingress profile is approved under D-104; deployment is not.                                                             |
| OWN-020 | Three recurring Codex review cards remain paused under D-108 Option A.                                                                             |

All production actions listed in root `AGENTS.md` remain human approval gates.

## Verification state

- RIT-074's isolated PostgreSQL fulfillment gate applies all 42 migrations and proves three
  current one-to-one dispute support projections, refund-before-projection exclusion, fixed local SLA/template,
  existing Credit hold/refund/shortfall behavior, exact role/RLS boundaries, and private-journal
  denial. Three Worker tests prove projected, idle, and contained/retried persistence-failure paths.
- `@rituvia/db` and `@rituvia/worker` type checks/builds, repository lint, 43-file immutable
  migration policy, and the 587-source-file architecture policy pass under Node.js 26.5.1 and pnpm
  11.13.1. Operational-case and commerce-admin PostgreSQL regressions also pass under the final
  additive migration.
- RIT-075 focused verification passes 112 tests across architecture policy, feature flags, the pure
  route-control contract, legacy commerce, Stripe checkout, replay/subscription boundaries, HTTP
  mapping, and the zero-argument Web feature-flag composition.
- `@rituvia/payments` and `@rituvia/web` type checks pass under the pinned Node.js 26.5.1/pnpm
  11.13.1 toolchain.
- Workspace lint and the 584-source-file architecture policy pass. The payments package rebuilds,
  and the Web production build compiles and generates all 61 routes.
- Independent payments-risk review findings for forged activation provenance, independent flags,
  old Checkout URL replay, control-reader failure, subscription safe-off, and 403/503 separation
  were resolved.
- The prior RIT-129 milestone closure passed the complete pinned workspace check and 61-page Web
  build. That earlier result is not substituted for the affected RIT-075 closure gates.
- Generated evidence is synchronized across 196 durable records, index, compiled manual, and
  checksums; the manual remains below the 1 MiB policy limit and secret policy passes 1,228
  tracked/unignored files. No test result authorizes deployment or provider activation.
- RIT-168 focused verification passes 199 unit/route/proxy tests, all 43 migrations with invite
  concurrency/privilege/restore and private operator-output checks, affected type checks and Web
  production build, and a real browser/Axe/mobile/privacy gate for `/en/beta` and its exact
  `Enter protected Beta` Button.

## Queue authority

`BACKLOG.md` is canonical. RIT-075, RIT-074, and RIT-168 are Done. RIT-169 is the sole Ready item:
prepare a disabled, secretless standing-staging deployment preflight without creating or changing
external resources. RIT-127 remains Blocked on the Owner's exact Option B plus durable atomic
budget and fixed alert-delivery evidence; RIT-130 remains Planned behind RIT-127 and actual
standing-staging/Gate H evidence. The recommended bounded Owner choices are in
[docs/reports/RITUVIA_PRE_LAUNCH_BLOCKER_OWNER_DECISION_REQUEST_2026-08-03.md](docs/reports/RITUVIA_PRE_LAUNCH_BLOCKER_OWNER_DECISION_REQUEST_2026-08-03.md).
Paid product expansion remains frozen.

## Update rules

Keep this file as current truth, not a changelog. Historical implementation detail belongs in Git,
`records/tasks/`, `records/decisions/`, reports, and task-specific runbooks. Update this file when
release stage, blockers, executable queue, environments, or verified capability changes.
