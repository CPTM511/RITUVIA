# 11 — Production Readiness Gates

## Gate A — Repository reality

- Current code, docs, routes, modules and tests audited.
- No duplicate architecture introduced.
- Status/backlog/decisions updated with evidence.
- Golden prototype and contracts committed unchanged.

## Gate B — Foundation and UI fidelity

- Production routes reproduce approved prototype.
- English/Chinese copy reviewed.
- Anonymous flow, responsive behavior and accessibility pass.
- Visual regression baselines pass.
- No developer/demo language visible.

## Gate C — Identity and private data

- Email/OAuth/passkey/wallet auth complete in staging.
- SIWE replay/domain/chain/EOA/ERC-1271 tests pass.
- Account linking and merge protections pass.
- Session/CSRF/authorization tests pass.
- Field encryption, export and deletion verified.

## Gate D — Credits and entitlements

- Append-only ledger, projection, reservation, release, consumption and reversal complete.
- Concurrency/idempotency tests pass.
- Permanent and consumable entitlement behavior passes.
- No client authority over prices/balances/access.

## Gate E — Stripe Test Mode

- Hosted Checkout, Plus, Customer Portal, webhook and reconciliation complete.
- Duplicate/out-of-order/replay/failure/refund/dispute tests pass.
- Credits are issued only after verified provider state.
- Live mode remains disabled.

## Gate F — USDC/Base test integration

- Coinbase Business account/integration approved for testing.
- Single-use checkout, signed webhook, reconciliation and refund paths pass.
- Wrong token/network/amount tests pass.
- No static address and no user tx-hash authority.
- Live crypto collection remains disabled.

## Gate G — AI test integration

- Provider adapters, versioned prompts/schemas and safety validators complete.
- Eval set passes in both languages.
- Private data logging tests pass.
- Timeout/fallback/circuit breaker/cost controls pass.
- Failed generation cannot permanently consume Credits.
- Production AI remains disabled.

## Gate H — Operational and security beta

- Protected staging, monitoring, alerts and runbooks complete.
- Backup/PITR restore drill passes.
- Kill-switch and provider outage exercises pass.
- Independent penetration test has no open Critical/High findings.
- Support/refund/admin workflows and audit logs pass.

## Gate I — Legal/commercial owner approval

Written approval for:

- legal seller and countries
- payment-provider underwriting
- tax/MoR approach
- terms, privacy, refund and digital-content policy
- 18+ policy
- AI provider/privacy terms
- astrology license
- prices and descriptor
- support contact and SLA

## Gate J — Limited production launch

- Live keys installed through secret manager.
- Production flags enabled one provider at a time.
- Synthetic transaction and reconciliation verified.
- Rollback and emergency disable tested.
- Limited cohort/country caps applied.
- Daily review of payments, AI, safety and support during launch period.

Codex may complete Gates A–H with sandbox/test services. It must not self-approve Gates I–J.
