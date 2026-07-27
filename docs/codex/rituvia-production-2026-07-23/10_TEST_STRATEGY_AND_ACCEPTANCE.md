# 10 — Test Strategy and Acceptance

## 1. Test pyramid

- Unit: deterministic engines, policies, state transitions, copy helpers.
- Property tests: Credit ledger arithmetic, allocation order, idempotency and state-machine invariants.
- Database integration: migrations, constraints, transactions, concurrency, RLS/ownership.
- Contract: OpenAPI, provider adapters, webhook fixtures and AI output schemas.
- Component: forms, modals, errors, accessibility states.
- Browser E2E: complete product journeys on Chromium, Firefox and WebKit.
- Visual: golden screenshots.
- Security: negative authorization, replay, CSRF, XSS, SSRF, injection, provider forgery, prompt injection.
- Resilience: timeouts, duplicate/out-of-order events, provider outages and worker restarts.
- Operations: backup/restore, reconciliation, key rotation and kill switches.

## 2. Required end-to-end journeys

1. Anonymous Daily Tarot → revisit same daily card → intention → free candle → journal → account creation → data merged once → Revisit.
2. Anonymous three-card Tarot → all basic meanings visible free → sign in → 2-Credit synthesis → AI success → exact Credit consumption.
3. AI timeout/malformed/safety failure → reservation released → retry → no double charge.
4. Relationship Reflection refuses mind-reading/control framing and returns user-centered content.
5. Numerology calculation matches fixed vectors and shows formula.
6. Astrology uses licensed deterministic engine; unknown time exposes uncertainty; provider failure returns unavailable, never invented placements.
7. Email sign-in, Google, Apple, passkey and wallet sign-in create secure sessions.
8. Wallet link/unlink with step-up; account/chain/provider change invalidates stale wallet authority.
9. Stripe 15-Credit pack → pending return → verified webhook → one issuance → order history.
10. Stripe Plus Monthly/Annual → paid period → 8 monthly Credits → portal cancellation → purchased Credits remain.
11. USDC/Base Credit pack → unique Coinbase checkout → verified completion → one issuance.
12. Permanent object Credit purchase → available across sessions.
13. Consumable ritual pass → one atomic start → cannot be reused.
14. Refund unused pack → provider confirmation → linked reversal.
15. Cross-user reads/updates/deletes denied for every private resource type.
16. Export then account deletion → sessions revoked and private content unavailable.

## 3. Concurrency tests

Run with real PostgreSQL transactions:

- 20 simultaneous reservations for a user with insufficient Credits: accepted total never exceeds availability.
- duplicate Deep Reading request with one idempotency key: one reservation and one result.
- two provider success webhooks: one order transition and one grant.
- refund and consumption racing: deterministic policy, no silent negative balance.
- two ritual starts against one pass: one session succeeds.
- two account creations for one wallet: one account/identity.
- monthly allocation worker retried: one allocation per subscription period.

## 4. Security-negative suite

Use `contracts/security-test-matrix.csv` as minimum coverage. Seed unique private canary strings and assert they never appear in:

- browser URL/history
- analytics events
- application logs
- error reporting
- provider payment metadata
- generic traces
- AI telemetry
- screenshots

## 5. Browser matrix

- Chromium latest supported.
- Firefox latest supported.
- WebKit/Safari equivalent.
- Desktop 1440×1000 and 1024×768.
- Mobile 390×844 and 320×700.
- English and Chinese.
- keyboard only.
- reduced motion.
- 200% and 400% zoom.
- VoiceOver and NVDA manual checks.

## 6. Visual regression

Use `02_UI_FIDELITY_CONTRACT.md` and `evidence/screenshots`. Freeze test data, date, locale and provider fixtures. Never auto-update baselines in CI.

## 7. Provider testing

Stripe:

- official test cards/payment methods
- Checkout and subscription webhook fixture tests
- duplicate/out-of-order/replay/invalid signature
- payment failure, SCA/action required, cancellation, refund and dispute
- Customer Portal

Coinbase:

- checkout create/get/refund
- success/failure/expiry/refund webhook fixtures
- invalid signature/timestamp
- wrong amount/currency/network
- reconciliation after missed webhook

AI:

- provider adapter contract fixtures
- timeout/rate-limit/malformed JSON/empty response
- fallback policy
- prompt injection and unsafe claims
- Credit release and no duplicate consumption

## 8. Release acceptance numbers

- Unit/contract/integration: 100% pass.
- Typecheck/lint/format: pass with zero warnings unless documented.
- Browser required journeys: 100% pass.
- Axe serious/critical: 0.
- Unexpected console/page/request errors: 0.
- Security Critical/High findings: 0 open.
- Private canary leakage: 0.
- Duplicate/lost Credit or entitlement test: 0.
- Visual baseline within approved threshold.
- Restore and reconciliation drill: pass.

## 9. Evidence format

Every completed phase records:

- commit SHA
- exact commands and exit codes
- changed files
- database migrations
- screenshots and traces
- console/network results
- security scan reports
- provider fixture IDs (never secrets)
- limitations and remaining gates
