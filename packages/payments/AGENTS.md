# Payments and Commerce Instructions

These instructions apply to `packages/payments/**`.

## Role

Own products, prices, orders, checkout sessions, provider adapters, webhooks, entitlements, subscriptions, refunds, disputes, reconciliation, and transaction evidence. Correctness, auditability, provider approval, and country policy outrank conversion.

## Product constraints

- Sell specific digital goods/services or subscriptions. Do not create a stored-value wallet, cash-equivalent balance, transferable credit, wagering, NFT, or custodial crypto flow.
- A free ritual path must remain usable.
- Paid ritual objects enhance presentation/ambience/persistence/personalization—not outcome probability or spiritual power.
- Product copy and descriptors must match what is delivered and what the payment provider approved.

## Architecture

- Provider-neutral domain model; adapters isolate provider SDK/API behavior.
- Server creates authoritative orders/prices; never trust client amount, currency, product, tax, country, entitlement, or success state.
- Hosted/tokenized checkout minimizes payment-data scope.
- Webhooks are signature-verified, timestamp/replay checked, stored once, processed idempotently, and safe out of order.
- Entitlements derive from confirmed ledger/order state, never redirect URLs alone.
- Maintain immutable transaction/event evidence plus reversible business state.

## Country and provider policy

- Every checkout asks the versioned Country Policy Engine for eligibility, products, currency, provider, disclaimers, crypto availability, taxes, and age/consent rules.
- A country/provider/product combination is disabled until written underwriting/contract evidence is recorded.
- Never route around a provider prohibition by misclassification, misleading descriptors, alternate merchant identity, or hidden product language.
- Crypto checkout, if enabled, is third-party hosted and non-custodial; the platform does not hold keys or balances. Treat refunds, sanctions, chain/network, and tax treatment explicitly.

## Required correctness

- Amounts are integer minor units plus ISO currency; no floating-point money.
- Every operation has idempotency and concurrency behavior.
- Subscription state handles trial, active, grace, past-due, canceled, refunded, disputed, and provider disagreement.
- Refund/chargeback actions are policy-driven, auditable, and do not erase transaction history.
- Daily reconciliation can explain every provider transaction, fee, refund, dispute, order, and entitlement difference.

## Tests and release gate

Test duplicate/out-of-order webhooks, stale sessions, replay, signature failure, partial refund, dispute, subscription race, provider outage, country denial, currency rounding, tax mismatch, entitlement recovery, and reconciliation differences. Production activation is an owner gate and requires provider approval evidence, legal/tax review, runbook, monitoring, kill switch, and rollback.
