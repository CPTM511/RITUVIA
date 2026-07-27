# RITUVIA Phase 0 Repository Reality Audit

**Date:** 2026-07-23
**Task:** RIT-159
**Decision:** D-045
**Repository commit audited:** `350c936` (`main`)
**Production pack:** `docs/codex/rituvia-production-2026-07-23/`

## Executive result

The owner-supplied production pack is installed with only the repository-required deterministic LF
normalization of its security matrix and passes the updated repository manifest verification. Its
original ZIP and golden prototype match the declared SHA-256 values, and the golden prototype and
screenshots remain byte-identical. The current repository is a strong reusable modular
TypeScript/PostgreSQL base; it must not be replaced by the prototype or proposed SQL.

The repository already has anonymous/account sessions, deterministic Tarot, a complete local
reflection loop, provider-neutral AI contracts and evals, local commerce/order/payment-event/
ledger/entitlement boundaries, observability, feature flags, a Worker, strict CI policy, and a
large test suite. Those capabilities are narrower than the new production contract:

- English is the only implemented locale; Simplified Chinese production routes and reviewed locale
  files do not exist.
- Daily Tarot, numerology, astrology, wallet discovery/linking/SIWE, passkeys, Credits
  reservations/projection, subscriptions, Coinbase checkout, refund/dispute/reconciliation,
  privacy export/deletion, dedicated Revisit, transactional outbox, and the required production
  route inventory are missing.
- Stripe and AI boundaries are local or safe-off. No live payment, real crypto collection,
  production AI with private content, legal-policy activation, or public deployment is approved.
- The current UI is not proven visually equivalent to the new 18-screen golden baseline.

RIT-159 remains In Progress with current dynamic verification blocked because this Codex sandbox
cannot bind `127.0.0.1` and cannot create PostgreSQL shared memory. The unsandboxed approval request
was not executed because the approval reviewer returned an internal unsupported-model error.
Static, unit, AI-eval, secret, type, lint, format, and production-build evidence passes.

## Source integrity

| Evidence | Result |
| --- | --- |
| ZIP SHA-256 | PASS — `f0d068401b13d71934822db38683ef35960eece910d7c56fdf9d2d69ee565e42` |
| Golden prototype SHA-256 | PASS — `e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740` |
| Pack manifest verifier | PASS — `RITUVIA pack verification: PASS` |
| JSON contracts | PASS through pack verifier and repository instruction validation |
| OpenAPI syntax | PASS through the repository-pinned `yaml` parser; 33 operations parsed |
| Golden screenshots | 18 exact PNG files present; four representative desktop/mobile English/Chinese baselines manually inspected |
| Pack secret claim | No provider key or production credential was introduced |

The original ZIP contains a CRLF security-test CSV. The repository enforces LF for deterministic
text, so that one file is normalized and the repository copy of `source-manifest.json` records its
new byte count and SHA-256. This is the only pack-byte adaptation; the source ZIP hash above remains
the archive evidence.

The repository secret policy originally rejected all new PNGs, including files below its previous
large-asset threshold. The policy now recognizes only the 18 exact pack paths plus the existing
reviewed sanctuary asset, each bound to an exact byte length and SHA-256. Any changed byte,
unreviewed path, or unknown binary still fails closed.

## Current repository map

### Runtime and modules

| Area | Current implementation | Reuse decision |
| --- | --- | --- |
| Web/PWA | Next.js App Router in `apps/web`; English locale-prefixed public/private routes | Reuse and extend; do not create another frontend |
| Worker | Cancellable worker runtime in `apps/worker` | Reuse for outbox/reconciliation/privacy jobs |
| Domain | Framework-independent `packages/domain` | Reuse; add bounded aggregates here |
| Tarot | Versioned content and deterministic draw in `packages/divination` | Reuse; add Daily Tarot without moving facts into AI |
| AI | Provider-neutral contracts, retrieval, safety, generation, verification, fixed evals in `packages/ai` | Reuse; add disabled adapters only after Credits foundation |
| Database | Prisma/PostgreSQL in `packages/db`; 19 models and 11 immutable migration files | Extend with expand-only migrations; do not apply pack SQL blindly |
| Payments | Provider boundary in `packages/payments`; Stripe hosted-checkout adapter plus signed local simulator | Reuse; add provider-neutral reconciliation and Coinbase adapter later |
| Country policy | `packages/country-policy` | Reuse and expand for product/payment/age/disclosure eligibility |
| Configuration | Typed server/client config and five safe-off feature flags in `packages/config` | Reuse; add exact pack kill switches through registry lifecycle |
| Observability | Structured redacted telemetry in `packages/observability` | Reuse; add outbox/provider/reconciliation metrics without private text |
| UI | Shared accessible primitives/tokens in `packages/ui` | Reconcile tokens against golden UI; retain semantic/accessibility floor |

### Existing user routes

Current page destinations are `/en`, three public trust pages, `/en/intake`,
`/en/tarot/one-card`, `/en/tarot/three-card`, `/en/sanctuary`, `/en/sign-in`,
`/en/account`, and local/return checkout pages. The new source contract requires a larger
destination set under readings, Daily Tarot, Deep Readings, numerology, astrology, journal,
revisit, plans, billing/wallets, orders, privacy/data, and about, in both English and Simplified
Chinese.

Route names may follow the existing App Router conventions, but destination behavior and golden
information architecture must be preserved. Existing private route/noindex and locale-validation
boundaries should be retained.

### Existing API surface

The repository has 29 route handlers covering anonymous session, local account auth/merge/session,
catalog/orders/local and Stripe webhooks, entitlements, Tarot reading/report/interpretation,
intention, ritual session, and journal entry behavior.

The pack OpenAPI contains 33 operations. Its `/v1` prefix is conceptual; the repository should keep
the established `/api/v1` prefix unless a compatibility reason requires an alias. New operations
must call existing services rather than duplicate them.

## Capability and gap matrix

| Contract area | Current capability | Production gap | Security delta / required proof |
| --- | --- | --- | --- |
| Anonymous-first core | Anonymous session, one/three-card Tarot, intention, free ritual, encrypted journal/revisit timestamp | Daily Tarot, full required route hierarchy, dedicated Revisit lifecycle | Retention/legal notice still owner-gated; preserve no raw private analytics |
| English/Chinese UI | English messages and RTL scaffold/pseudolocale tests | Reviewed `zh-Hans` locale, locale switch, all golden screens, visual regression | No runtime machine translation; legal/safety/payment copy requires human review |
| Golden UI fidelity | Existing Lumora-shaped local MVP and accessible design system | New prototype tokens, hierarchy, copy, desktop/mobile parity are unimplemented/unverified | Baselines cannot be updated without ADR, before/after evidence, and owner approval |
| Email/account identity | Local account sessions, encrypted email identity, session rotation/revocation, anonymous merge | Production Magic Link/email provider, OAuth, passkeys, recovery | Enumeration, replay, CSRF, origin, session-fixation, cross-user tests |
| Wallet identity | Crypto feature flag only | EIP-6963, WalletConnect/Reown, SIWE, EOA/ERC-1271, link/unlink/step-up | Nonce atomicity, domain/URI/chain/expiry, malicious metadata, wallet-switch invalidation |
| Wallet/payment separation | Product policy and adapter boundaries recognize separation | No wallet implementation or payment-wallet persistence | Payment wallet must never create an auth identity implicitly |
| Tarot | Versioned 22-card local catalog, deterministic one/three-card draw, immutable facts, limits/report/resume | Daily Tarot uniqueness/local-date behavior and production-approved content publication | Preserve exact historical replay; no AI-drawn or hidden core cards |
| Numerology | None | Transparent calculations, formula evidence, routes, persistence | Fixed vectors/property tests; name/alphabet privacy limitations |
| Astrology | None | Licensed deterministic engine, time-zone/location precision, routes | Blocked by OWN-003; AI cannot invent placements |
| AI Deep Readings | Strong provider-neutral contracts, structured output, safety, fact verifier, 34-case/145-assertion eval; runtime hard safe-off | DeepSeek/Kimi adapters, bilingual product schemas/evals, circuit breaker, cost controls, Credits transaction | No tools/web; reserve/generate/validate/persist/consume; release exactly once on failure |
| Reflection/sanctuary | Intention, encrypted small action, ritual session, encrypted journal, revisit timestamp | Dedicated Revisit aggregate/routes, pause/resume, permanent vs consumable pass model | Owner scope, encryption, delete/export, no efficacy claims, pass concurrency |
| Catalog/orders | Server-authoritative local catalog, integer price, order lines, payment attempts/events | Versioned catalog contract, subscriptions, refunds/disputes, purchase history parity | Client submits product code only; return URL grants nothing |
| Stripe | Hosted-checkout adapter, signed webhook boundary, local simulator | Test-mode provider sessions, Customer Portal, subscriptions, reconciliation | Raw signature, duplicate/out-of-order/replay, refund/dispute, exactly-once grant |
| USDC/Base | Safe-off crypto flag only | Coinbase Business checkout/webhook/refund/reconciliation | OWN-006 plus provider test approval; exact asset/network/amount; no static address |
| Credits | Existing generic append-only `LedgerEntry` and entitlement grant path | Typed Credit grants/allocations, reservations, projection, expiry, reversal, subscription-vs-purchased ordering | PostgreSQL concurrency/idempotency; no overspend; purchased Credits survive cancellation |
| Entitlements | Permanent owned-product entitlement records | Consumable ritual passes and subscription-period access | Permanent and consumable models cannot be conflated; concurrent start once |
| Privacy | Encrypted email, action, journal; minimal redacted telemetry | Export, selective deletion, account deletion, retention exceptions, birth-data encryption | BOLA suite, private canary leakage zero, lawful finance stub only |
| Outbox/operations | Worker and observability boundaries | Transactional outbox, reconciliation jobs, DLQ/admin, provider health, backup/PITR drills | Idempotent jobs, immutable audit, kill switches, no private payload logs |
| Release security | CI policy, migration policy, secret scan, architecture gate, unit/AI/build checks | Current browser matrix, Chinese visual regression, DAST/SBOM/provenance, independent pentest | Critical/High zero; restore/reconciliation/kill-switch evidence required |

## Database adaptation plan

The pack SQL is a schema skeleton, not a migration. Use the following mappings:

| Pack aggregate | Existing repository mapping | Adaptation |
| --- | --- | --- |
| `users` | `AppUser` | Extend; do not add a second user table |
| `sessions` | `AnonymousSession`, `AccountSession` | Preserve separate anonymous/account lifecycles |
| `auth_identities` | `AuthIdentity` | Extend with provider-kind contracts |
| `email_login_tokens` | `AuthChallenge` | Reuse token/state hashing and atomic consume |
| passkey/wallet tables | Missing | Add behind identity adapters in separate expand-only migrations |
| `readings` | `Reading`, `TarotDraw`, `Interpretation`, `InterpretationVerification` | Reuse immutable fact/provenance/fencing design |
| `tarot_cards` | Versioned Git-authored content package | Keep content source-governed unless runtime evidence proves DB publication is needed |
| `daily_tarot_draws` | Missing | Add unique subject/user + local-date + policy/time-zone evidence |
| `deep_readings` | Existing interpretation persistence is narrower | Extend only after Credits reservation contract; do not duplicate interpretation history |
| intention/journal/ritual | `Intention`, `JournalEntry`, `RitualSession` | Extend owner migration and lifecycle behavior |
| `revisits` | Journal `revisitAt` only | Add dedicated aggregate when scheduling/completion requirements land |
| catalog/order/payment | `CommerceOrder`, `CommerceOrderLine`, `PaymentAttempt`, `PaymentEvent` | Extend provider-neutral states/versioning/reconciliation |
| `credit_ledger` | `LedgerEntry` | Specialize with immutable Credit entry/allocation/reversal contracts |
| reservations/projection | Missing | Add transactionally with concurrency tests before paid AI |
| `entitlements` | `Entitlement` | Keep permanent ownership; add separate ritual pass model |
| subscriptions/refunds/disputes | Missing | Add only with Stripe Test Mode slice |
| outbox/audit/deletion | Missing or partial observability only | Add explicit transactional/audited aggregates; never infer from logs |

Every future migration must be expand-only, least-privilege, RLS/owner-scoped where applicable,
idempotent in CI, and accompanied by compatibility and rollback/forward-fix notes.

## OpenAPI adaptation plan

1. Keep `/api/v1` as the repository HTTP prefix.
2. Map pack email start/verify to the existing `/auth/start` and `/auth/callback` service boundary.
3. Extend existing `/readings/tarot`, owner-scoped reading GET, report, and interpretation routes
   rather than adding parallel Tarot services.
4. Reuse `/catalog`, `/orders`, `/orders/{id}/checkout`, provider webhook, and entitlement services;
   add Stripe/crypto/portal/refund/reconciliation operations behind adapters.
5. Add wallet challenge/verify/link resources only after the identity threat tests and server-side
   nonce model exist.
6. Add Credits quote/reserve/ledger APIs only after database constraints and concurrency tests.
7. Add Daily Tarot, numerology, astrology, dedicated Revisit, privacy export, and deletion as
   separate dependency-ordered vertical slices.
8. Normalize every private-object response to existing indistinguishable owner-scoped failure
   rules and keep return URLs non-authoritative.

## Threat delta

The new pack materially adds attack surfaces not present in the current local MVP:

- SIWE replay, phishing-domain/URI/chain mismatch, malicious EIP-6963 metadata, ERC-1271 validation,
  wallet-switch invalidation, and account-link takeover.
- Credit double-spend, reservation leakage, grant/reversal races, subscription allocation drift,
  and permanent-versus-consumable entitlement confusion.
- Coinbase webhook forgery, wrong asset/network/amount, stale timestamp, missed events, and refund
  reconciliation.
- Production email/passkey/OAuth enumeration, replay, origin, CSRF, recovery, and session-fixation
  paths.
- Prompt injection and cost denial of service using private Deep Reading context in two locales.
- Broader BOLA exposure across orders, ledger, wallet, journal, revisit, export, deletion, ritual
  pass, and admin records.
- Golden UI supply-chain drift and baseline laundering.

No implementation slice may activate one of these surfaces before its exact negative and
concurrency tests exist.

## Recommended implementation sequence

Phase 0 does not authorize a whole-product rewrite. With current verification complete, split
execution into dependency-ordered tasks:

1. Golden English/Chinese route and visual-regression foundation using existing Web/UI/i18n.
2. Production identity provider abstraction, email flow, sessions, and cross-user authorization.
3. Wallet discovery/SIWE/linking with complete replay/phishing/takeover tests.
4. Credit ledger/reservation/projection plus permanent/consumable entitlement concurrency.
5. Stripe Test Mode packs/Plus/portal/webhook/reconciliation with live mode off.
6. Coinbase USDC/Base test integration only after explicit provider/legal test approval.
7. Deep Reading provider adapters and bilingual evals only after Credits transaction safety.
8. Operational staging, restore, kill-switch, browser matrix, DAST/SBOM/provenance, and pentest.

RIT-037 must be re-scoped or superseded after RIT-159 because regeneration/version history now
depends on the new Deep Reading/Credits model rather than the prior free safe-off interpretation
contract alone.

## Verification evidence

### Passed

- `python3 -B docs/codex/rituvia-production-2026-07-23/scripts/verify_pack.py`
- `pnpm check:evidence` using a temporary Git index containing only the intended changes:
  CI contract, 288-file architecture policy, 51 durable records, 11 immutable migrations,
  generated evidence, instruction validation, and secret scan passed.
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck` — 11/11 workspace tasks.
- `pnpm exec vitest run tests/secret-policy.test.ts` — 6/6.
- `pnpm test:unit` — 1,440 tests in 105 files.
- `pnpm test:ai-evals` — 34/34 cases, 145 assertions, zero critical failures, zero paid calls.
- `BRAND_CANONICAL_ORIGIN=http://127.0.0.1:4175 pnpm build` — 11/11 build tasks,
  80 verified artifacts/exports, four public and three private experience pages.

The obsolete untracked `apps/web/server/tarot-reading-state 2.ts` file was compared with the
canonical implementation, confirmed to be an earlier 336-byte safe-off stub fully superseded by
the current 2,580-byte catalog-backed implementation, and removed with explicit owner approval.
The two D-030-excluded QA report copies remain untouched.

### Current environment-dependent verification

The owner ran the three environment-dependent commands in an unrestricted shell with Node.js
24.18.0 and pnpm 11.13.1 after Codex's approved execution path failed before process creation:

- `pnpm test:configuration-boundary` passed typed environment parsing, fail-closed startup,
  server-only imports, and client-delivery secret isolation.
- `BRAND_CANONICAL_ORIGIN=http://127.0.0.1:4175 pnpm test:accessibility` passed four public and
  three private routes with 31 axe scans and 381 reviewed color-contrast nodes, forward/reverse
  keyboard focus, 40% expanded text, desktop/mobile RTL mirroring, online/offline recovery,
  interpretation retry/polling/verified/fallback/offline acceptance, 44px targets,
  dark/reduced-motion/no-JavaScript states, screenshots, and local-only requests.
- `pnpm test:database-foundation` passed local PostgreSQL attestation, all MVP migrations, seed,
  least privilege, RLS, empty product tables, constraints, transactions, races, reset and logical
  restore; anonymous token hashing, expiry/revocation, consent history, idempotency and issuance
  races; and owner-scoped tarot/report/interpretation claim, replay, fencing, fallback,
  position-validation, quota-independence, and non-empty restore behavior.

The accessibility reruns first exposed real or stale acceptance defects. The repository now uses
the actual Web palette in contrast proofs, covers combined gradients and sticky-header
backgrounds, preserves the Sanctuary artwork aspect ratio under RTL, waits on deterministic account
readiness instead of `networkidle`, validates the exact account response, mirrors the production
CSP in the artifact server, and allows only the one reviewed local image optimization request.
Unknown APIs, images, console failures, and local request failures remain fail-closed.

## Completion conclusion

RIT-159 is Done. Pack integrity, repository reconciliation, static gates, dynamic configuration,
browser accessibility/responsiveness, PostgreSQL foundation behavior, and duplicate-file cleanup
all pass without activating a production provider. RIT-037 may now enter scope reconciliation; it
must not introduce regeneration spend or a parallel interpretation history before the production
Credits and Deep Reading transaction model exists.

## Rollback

No migration, provider, secret, payment, deployment, DNS, or customer state changed. Rollback
removes the dated documentation pack, restores the obsolete untracked safe-off stub if still
wanted, and reverts D-045/RIT-159, the generated manual/checksums, and the exact static-asset
secret-policy entries. The two D-030-excluded QA report copies remain under owner control.
