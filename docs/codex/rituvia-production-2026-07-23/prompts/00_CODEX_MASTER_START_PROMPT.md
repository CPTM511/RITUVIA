# CODEX MASTER START PROMPT — RITUVIA Production Build

## Goal

Develop the real production-capable RITUVIA application so that the visible product matches the golden prototype and the full functionality is server-authoritative, secure, testable and operational. Do not build another demo or localStorage simulation.

## Required context

Read every applicable repository `AGENTS.md`, then read this complete RITUVIA production pack in the order defined by `00_START_HERE.md`. Verify the golden prototype hash and inspect the screenshot baselines. Also read current repository status, backlog, roadmap, decisions, product, architecture, payment, privacy, API and testing documents.

The current repository and running browser are authoritative for implementation reality. They do not override the product/security invariants in this pack.

## Working mode

Proceed through the phases below sequentially. Do not wait between ordinary engineering phases when tests and gates pass. Stop only at explicit Owner gates or when a finding materially changes architecture, legal scope or security.

For each phase:

1. inspect current code and runtime
2. create a concise implementation plan and threat delta
3. implement one complete vertical slice
4. add database, unit, integration, contract, browser, accessibility and security-negative tests
5. run the real application on desktop and mobile
6. compare against golden screenshots
7. review diff, dependencies, logs and network behavior
8. update status/backlog/decisions/evidence
9. commit with a precise message if repository policy permits
10. report what is proven, what remains disabled and the next slice

Never claim completion from source inspection alone.

## Phase 0 — Reality audit and plan

- Map repository modules, routes, database, auth, wallet, payment, Credit, entitlement, AI and test systems.
- Run all current checks and browser flows.
- Compare repository and browser behavior to every golden route.
- Produce capability/gap/security matrix.
- Identify reuse vs migration; do not duplicate existing modules.
- Validate or adapt the proposed schema and OpenAPI contract.
- Update truthful project status.
- Continue to Phase 1 if no Owner decision is required.

## Phase 1 — Production foundation and UI fidelity

- Implement real locale routes and component architecture matching the prototype.
- Move reviewed copy into typed locale files.
- Preserve anonymous-first flows and interrupted-task return.
- Replace browser-only authoritative state with API/repository state.
- Add visual, responsive, keyboard and accessibility regression tests.
- Do not expose developer/demo language.

## Phase 2 — Identity and wallet security

- Implement email Magic Link, current OAuth providers and passkeys using repository-approved libraries.
- Implement EIP-6963 and WalletConnect/Reown wallet selection.
- Implement SIWE EIP-4361 challenge/verify with nonce, domain, URI, chain, issued-at, expiry and atomic consume.
- Verify EOA and approved ERC-1271 signatures.
- Implement link/unlink, recent step-up, uniqueness, session rotation and account/chain/provider change invalidation.
- Keep wallet payment connection separate from identity.
- Complete replay, phishing, linking takeover, BOLA and session tests.

## Phase 3 — Private data, Credits and entitlements

- Implement field encryption and owner-scoped storage for readings/context/intentions/journal/revisits/birth data.
- Implement append-only Credit ledger, projection, allocations, reservations, release, consumption, expiry and reversal.
- Implement permanent object entitlements and consumable ritual passes.
- Implement transaction/outbox consistency and concurrency tests.
- Implement export and deletion workflows.

## Phase 4 — Stripe Test Mode

- Implement authoritative catalogue and internal order first.
- Implement Stripe Customer, hosted Checkout for packs and Plus, saved payment methods and Customer Portal.
- Implement raw-body signed webhooks, duplicate/out-of-order/replay/failure/refund/dispute handling.
- Issue Credits and Plus access only from verified provider state.
- Implement reconciliation and operations evidence.
- Keep live mode disabled.

## Phase 5 — USDC on Base test integration

- Implement `CryptoCheckoutProvider` with Coinbase Business Checkouts.
- One single-use checkout per internal Credit-pack order.
- Validate USDC, Base, amount, status, webhook signature/timestamp and event identity.
- Reconcile through provider API.
- Implement refund and Credit reversal.
- No static addresses, no user tx-hash authority, no private metadata, no subscription crypto.
- Keep live collection disabled.

## Phase 6 — AI Deep Readings

- Implement provider-neutral AI interface and versioned model policy.
- Implement DeepSeek and Kimi adapters with secrets server-side.
- Implement product-specific prompt and strict output schemas.
- Implement input policy, prompt-injection defenses, output safety and deterministic-fact validation.
- Implement reserve → generate → validate → persist → consume; release on every failure.
- Add limits, timeout, one bounded retry, circuit breaker, fallback policy, cost telemetry and spend kill switch.
- Run bilingual eval suite and private-data leakage tests.
- Keep production AI disabled.

## Phase 7 — Operational beta and security hardening

- Protected staging with production-like database and isolated secrets.
- Monitoring, alerts, runbooks, reconciliation dashboards and admin least privilege.
- CI SAST/SCA/secret scanning/SBOM/provenance/DAST.
- Backup/PITR restore, key rotation, kill-switch and provider-outage exercises.
- Full browser matrix and WCAG 2.2 AA evidence.
- Independent penetration-test preparation and remediation.

## Non-negotiable invariants

- Free Daily Tarot/core Tarot remains complete before payment.
- AI never draws cards, changes calculations or decides financial/access facts.
- Client never controls price, Credit amount/balance, entitlement, payment/refund success or ownership.
- Return URLs never grant value.
- Private content never enters generic logs, analytics, payment metadata or URLs.
- Every provider side effect is idempotent and reconciled.
- Cross-user access is denied and tested for every private object.
- Permanent and consumable entitlements cannot be confused.
- Purchased Credits survive Plus cancellation.
- Production providers default disabled.

## Owner stop gates

Stop before live Stripe, live crypto, live production AI with private content, unrestricted public production launch, irreversible production migration or legal/policy activation.

## Required phase report

```md
# PHASE RESULT

## Completed
## User-visible behavior
## Architecture and schema changes
## Security controls and threat delta
## Tests and exact commands
## Browser / visual / accessibility evidence
## Provider and reconciliation evidence
## Files changed
## Commit
## Remaining limitations and disabled flags
## Risks and Owner decisions
## Next vertical slice
```

Begin now with Phase 0. If Phase 0 reveals no blocking Owner decision, continue through sandbox-complete phases automatically, preserving the required evidence after each phase.
