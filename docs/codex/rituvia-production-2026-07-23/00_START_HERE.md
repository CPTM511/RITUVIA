# RITUVIA Production Build Pack — Start Here

> Date: 2026-07-23  
> Audience: Codex, engineering, security, product, QA, payments and operations  
> Golden prototype: `RITUVIA_WALLET_STRIPE_CRYPTO_AI_UPDATED_PROTOTYPE_2026-07-23.html`  
> Golden prototype SHA-256: `e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740`

## Mission

Build the real RITUVIA product, not another demo. The production implementation must preserve the approved prototype's visual language, bilingual copy, information architecture and user journeys while replacing every browser-only simulation with server-authoritative production behavior.

No written package can mathematically guarantee zero defects. This pack reduces ambiguity by making the prototype a golden UI source, freezing business rules in machine-readable contracts, requiring security-negative tests, requiring visual regression evidence, and blocking production activation until independent review is complete.

## Read order

1. `AGENTS.md`
2. `00_START_HERE.md`
3. `01_PRODUCT_SOURCE_OF_TRUTH.md`
4. `02_UI_FIDELITY_CONTRACT.md`
5. `03_PRODUCTION_ARCHITECTURE.md`
6. `04_DOMAIN_MODEL_AND_DATABASE.md`
7. `05_API_CONTRACTS.openapi.yaml`
8. `06_SECURITY_THREAT_MODEL.md`
9. `07_SECURITY_ENGINEERING_REQUIREMENTS.md`
10. `08_AI_SAFETY_AND_EVALS.md`
11. `09_PAYMENTS_WALLET_AND_CREDITS.md`
12. `10_TEST_STRATEGY_AND_ACCEPTANCE.md`
13. `11_PRODUCTION_READINESS_GATES.md`
14. `prompts/00_CODEX_MASTER_START_PROMPT.md`

## Source-of-truth hierarchy

1. Security and safety invariants in this pack.
2. Product and commercial invariants in `source/RITUVIA_COMMERCIAL_MODEL_MASTER_SPEC_2026-07-20.md`.
3. Approved visual behavior and copy in the golden prototype and screenshot baselines.
4. Current repository and browser reality for implementation facts.
5. Provider documentation for external API behavior.
6. Older project documents when they do not conflict with the above.

Repository reality may reveal that an existing component should be reused. It does not authorize changing a product or security invariant. Any deliberate deviation from the golden prototype requires a written ADR, screenshot evidence and Owner approval.

## What Codex may do without further approval

- Audit the repository and current runtime.
- Build or extend sandbox/test-mode implementations.
- Add migrations, tests, observability and security controls.
- Deploy protected preview/staging environments.
- Integrate Stripe Test Mode, Coinbase sandbox/test credentials, wallet authentication and disabled-by-default AI adapters.
- Run SAST, SCA, secret scans, DAST and authorized security tests against local/staging systems.

## Owner gates

Codex must stop before:

- Activating Stripe live mode.
- Activating real crypto collection.
- Sending production emails.
- Enabling production AI requests with private user content.
- Publishing to an unrestricted public production domain.
- Finalizing legal, tax, refund or data-retention policy.
- Deleting or migrating production data irreversibly.

## Definition of production-complete

A feature is complete only when its server-authoritative implementation, database constraints, negative security tests, browser tests, accessibility checks, observability, failure recovery and documentation all pass. Source inspection or a happy-path unit test is insufficient.
