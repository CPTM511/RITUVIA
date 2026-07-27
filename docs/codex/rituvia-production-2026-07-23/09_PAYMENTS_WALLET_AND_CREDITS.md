# 09 — Payments, Wallet Authentication and Credits

## 1. Wallet authentication

Use EIP-6963 to discover multiple injected EIP-1193 providers and WalletConnect/Reown for mobile/QR connections. Provider metadata is self-attested and must not be trusted for authorization or unsafe icon rendering.

Use SIWE/EIP-4361:

1. Server creates one-time nonce/request ID bound to domain, URI, chain ID, purpose, session and expiry.
2. Client asks the selected wallet to sign the exact human-readable SIWE message.
3. Server parses and validates message syntax and exact fields.
4. Verify EOA signature or ERC-1271 on the specified chain.
5. Atomically consume the nonce.
6. Create/rotate a secure application session.

Wallet events update UI, but only the server session grants authority. On account/provider/chain change, clear client wallet state and require re-verification for wallet-bound actions. If ERC-1271 authority can change, define session revalidation/revocation policy.

Linking a wallet to an existing account requires recent step-up authentication and explicit confirmation. A wallet can belong to only one account unless a controlled merge flow is approved. Payment wallet connections never become identities automatically.

## 2. Stripe

Use Stripe-hosted Checkout Sessions:

- Credit packs: one-time payment.
- Plus Monthly/Annual: subscription.
- Apple Pay, Google Pay, Link and cards appear when Stripe and device/country eligibility allow them.
- Use Stripe Customer and Customer Portal for saved payment methods and subscription management.
- Store provider IDs and safe display fields only; never PAN/CVC.

Flow:

1. Client submits product code + app idempotency key.
2. Server resolves catalogue, country policy and terms.
3. Create internal order.
4. Create Stripe Checkout with a provider idempotency key derived from the internal order.
5. Redirect to hosted page.
6. Return route displays pending server state.
7. Raw-body verified webhook records event and transitions order.
8. In one transaction, issue Credits/activate subscription and create outbox/audit entries.
9. Reconciliation compares provider and internal state.

Stripe subscription state is webhook-driven. Provision monthly Credits on confirmed paid subscription periods, not merely on subscription creation. Annual subscribers receive 8 Credits each month.

## 3. Crypto checkout

MVP provider: Coinbase Business Checkouts.

- Accepted product: one-time Credit packs only.
- Asset: USDC.
- Network: Base.
- Create a unique single-use checkout for every internal order.
- Persist provider checkout ID before redirect.
- Verify webhook signature/timestamp and provider event ID.
- Confirm expected amount, currency, network and terminal status.
- Reconcile through the provider Get Checkout API.
- Do not use a static deposit address.
- Do not trust user-submitted transaction hashes.
- Do not place private user content on-chain or in provider metadata.
- Crypto payment wallet remains separate from authentication identity.

Plus remains Stripe-only because recurring crypto billing is outside the approved MVP.

## 4. Order state machine

```text
created
 → checkout_created
 → pending
 → paid
 ↘ failed / expired / cancelled
paid
 → refund_requested
 → refunded / partially_refunded
 ↘ disputed
```

Define allowed transitions in code and database tests. Provider events that arrive out of order are stored and reconciled; they do not force invalid transitions.

## 5. Credits

Credits are integer, append-only, non-transferable service entitlements.

Grant sources:

- subscription Credit allocation
- purchased pack
- promotional grant
- refund/reversal adjustment

Consumption order:

1. subscription Credits
2. promotional Credits
3. purchased Credits

Deep Reading flow:

1. authoritative quote
2. atomic reservation
3. generation and safety
4. persist result
5. consume reservation
6. release on every failed path

Permanent object flow:

1. quote
2. reserve Credits
3. grant unique entitlement and consume
4. duplicate purchase is rejected/idempotent

Consumable ritual flow:

1. buy a pass by Credit consumption
2. pass remains `available`
3. starting a ritual atomically consumes/reserves one pass and creates session
4. opening preview or checkout never consumes a pass
5. failed start restores pass

## 6. Refunds and disputes

- Provider refund is not final until provider confirmation.
- Unused purchased Credits can be reversed according to approved policy.
- Consumed AI/ritual content follows jurisdiction-specific digital-content rules.
- Never silently create a negative balance. Use linked reversal/debt/review state according to policy.
- Purchased Credits are not removed because Plus is cancelled.
- Disputes freeze relevant unspent value or flag for review without exposing journal/private content.
- Every refund/reversal references the original order and ledger entries.

## 7. Reconciliation

Scheduled reconciliation must identify:

- provider paid / internal pending
- internal paid / provider not paid
- duplicate or missing Credit issuance
- subscription periods without allocation
- refunds/disputes without reversal
- stale reservations
- Coinbase checkout amount/network/token mismatch

Differences create an auditable operations case and alert; reconciliation code must never guess or silently overwrite evidence.
