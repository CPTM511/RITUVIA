# AGENTS.md — RITUVIA Production Build Rules

## Mission

Build the production RITUVIA application to match the approved prototype while implementing real server-authoritative functionality and security. Do not produce another local-state demo.

## Authoritative files

Read in this order:

1. `00_START_HERE.md`
2. `01_PRODUCT_SOURCE_OF_TRUTH.md`
3. `02_UI_FIDELITY_CONTRACT.md`
4. `03_PRODUCTION_ARCHITECTURE.md`
5. `04_DOMAIN_MODEL_AND_DATABASE.md` and `.sql`
6. `05_API_CONTRACTS.openapi.yaml`
7. `06_SECURITY_THREAT_MODEL.md`
8. `07_SECURITY_ENGINEERING_REQUIREMENTS.md`
9. `08_AI_SAFETY_AND_EVALS.md`
10. `09_PAYMENTS_WALLET_AND_CREDITS.md`
11. `10_TEST_STRATEGY_AND_ACCEPTANCE.md`
12. `11_PRODUCTION_READINESS_GATES.md`
13. `contracts/*`
14. `source/RITUVIA_WALLET_STRIPE_CRYPTO_AI_UPDATED_PROTOTYPE_2026-07-23.html`

Golden prototype SHA-256: `e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740`.

## Non-negotiable product rules

- Preserve `Question → Interpretation → Intention → Ritual → Journal → Revisit`.
- Core Daily Tarot and basic Tarot remain complete and free.
- AI only powers explicit Deep Readings.
- AI never creates deterministic facts or business authority.
- Free candle and incense always remain.
- Payment cannot be framed as increasing luck or spiritual efficacy.
- Wallet sign-in, wallet linking and crypto payment wallet are separate.
- Plus is Stripe recurring; crypto is USDC/Base for one-time packs only.
- Purchased Credits survive Plus cancellation.
- Permanent objects and consumable rituals have distinct entitlement models.

## Engineering rules

- Inspect and reuse existing architecture; no broad rewrite.
- Never hard-code secrets or expose keys to the browser.
- Client submits product code, never price/Credit/balance/status authority.
- Use append-only Credit ledger, idempotency, transactions and outbox.
- Return URLs never grant payment value.
- Webhooks use raw-body signature verification and event deduplication.
- Private content is encrypted and excluded from logs/analytics/payment metadata.
- All private resources require owner-scoped authorization and cross-user denial tests.
- AI output must pass strict schema and safety validation; no tools or arbitrary HTML.
- Production provider flags default off.
- Do not mark work complete without tests and real browser evidence.

## UI rules

- Treat the prototype and screenshot baselines as golden.
- Preserve copy, spacing, tokens, information hierarchy and responsive behavior.
- No generic AI-chat, crypto-dashboard or bright SaaS redesign.
- No prototype/demo/engineering language in public UI.
- Do not update visual baselines without written ADR and Owner approval.

## Workflow

For each vertical slice:

1. inspect current repository and applicable rules
2. write/refresh plan and threat analysis
3. implement the smallest complete slice
4. add unit, integration, database, browser and security-negative tests
5. run visual/accessibility checks
6. review diff and dependencies
7. update status/backlog/decisions/evidence
8. report exact limitations and next slice

Use subagents only for independent read-only audits or test analysis. Keep one primary writer for overlapping code.

## Stop conditions

Stop and request Owner approval before live payments, live crypto collection, production AI with private content, public production release, irreversible production migration or legal/policy activation.
