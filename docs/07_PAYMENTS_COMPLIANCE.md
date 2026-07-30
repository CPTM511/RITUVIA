# Payments, Country Policy, and Compliance Architecture

## 1. Scope and disclaimer

This document defines product/engineering controls. It is not legal advice and does not replace written underwriting, tax, consumer-protection, privacy, or local-law review.

## 2. Commercial principles

- Sell clearly named digital content/experience and subscriptions.
- Keep a dignified free ritual path.
- Paid items enhance presentation, persistence, collection, or depth—not claimed spiritual effectiveness.
- No stored-value wallet, prepaid credits, cash-out, exchange, tradable token, NFT, gambling, randomized paid item, or user-to-user transfer.
- No fear-based or high-pressure upsell.
- Display exact digital contents, price, tax, renewal, cancellation, expiration, refund, and support terms before purchase.

## 3. Provider strategy

Use a payment orchestration domain layer with multiple adapters. Do not assume one global provider accepts the business in every market.

### Provider states

- Not reviewed.
- Under review.
- Approved for sandbox only.
- Approved for production with documented countries/products.
- Restricted/paused.
- Terminated.

Provider enablement is configuration tied to Country Policy and owner approval.

Sandbox engineering approval and production underwriting are separate evidence. D-091/OWN-017
approve only Stripe Test Mode development for RIT-063 with synthetic US/USD policy and
server-authoritative one-time prices. OWN-002 continues to require written primary and backup
provider approval before production payment activation; an internal owner instruction cannot be
represented as provider underwriting.

### Written approval dossier

Prepare for every provider:

- Exact product description and screenshots.
- Clear statement that experiences are symbolic/entertainment/self-reflection and not guaranteed outcomes.
- Complete catalog and price range.
- Refund/cancellation policy.
- Customer support flow.
- Country and age policy.
- Marketing examples.
- Data/privacy/security description.
- Chargeback/fraud controls.
- Cryptocurrency architecture if applicable.

Never misrepresent the merchant category or product to obtain approval.

## 4. Country Policy Engine

A server-side policy snapshot controls:

```ts
type CountryPolicy = {
  version: string;
  country: string;
  status: "disabled" | "content_only" | "free_only" | "paid";
  minimumAge: number;
  modalities: string[];
  prohibitedClaims: string[];
  requiredDisclosures: string[];
  legalDocumentVersions: string[];
  products: string[];
  currencies: string[];
  fiat: {
    providerRoutes: string[];
    methods: string[];
    recurringAllowed: boolean;
  };
  crypto: {
    enabled: boolean;
    providerRoute?: string;
    approvedAssets?: string[];
  };
  taxMode: "provider" | "merchant_of_record" | "internal_reviewed";
  refundPolicyVersion: string;
  dataFlags: string[];
  marketingFlags: string[];
};
```

Country is determined using a hierarchy of billing country, account declaration, reliable geolocation signal, and provider evidence. Do not use IP alone to bypass billing/legal facts. Record the policy version on reading/purchase fulfillment.

The implemented V1 registry is append-only and selects one active successor-chain head for the
country/environment. Billing, declared, and reliable geolocation conflicts fail closed; locale and
weak geolocation cannot authorize paid service. Every active version has a mandatory review time.
Fiat and crypto use independent owner-approval references (`OWN-002` and `OWN-006` respectively),
so enabling one route cannot authorize the other. A disabled successor is the kill switch; rollback
is another immutable successor. Only a synthetic local policy is seeded. Staging and production
remain empty and therefore deny paid authorization until separately approved policy publication.

## 5. Order model

Internal order is created before provider checkout and is authoritative for:

- Product/price/version.
- User/anonymous owner.
- Country policy/version.
- Currency and integer minor-unit amounts.
- Tax/discount snapshots.
- Terms/refund version acceptance.
- Idempotency key.

Client-provided amounts or entitlement claims are ignored.

RIT-062 implements this as additive `commercial_order_v2` and `commercial_order_item_v2`
foundations. The obsolete direct-object USD tables remain historical local replay only.

## 6. Payment state machine

```text
created
  -> checkout_created
  -> pending
  -> paid
  -> refund_requested | partially_refunded | refunded | disputed

created/checkout_created/pending
  -> failed | canceled | expired
```

Transitions are explicit, validated, and audit-logged. Provider status does not map one-to-one; adapters normalize it.

Payment attempts use their own smaller
`created -> checkout_created -> pending -> succeeded|failed|expired|cancelled` state machine.
Refund and dispute aggregates remain later tasks and never rewrite an attempt into a refund state.

## 7. Webhook security and idempotency

- Verify provider signature using the raw request body and current/rotating secret.
- Reject stale/replayed invalid events according to provider rules.
- Store provider event ID with a unique constraint before processing.
- Treat delivery as duplicate and out of order.
- Fetch provider object for high-risk reconciliation where appropriate.
- Process state transition and entitlement/ledger update transactionally or with an outbox.
- Return provider-appropriate status quickly; do heavy work asynchronously.
- Log only redacted identifiers.
- Provide manual replay and immutable event timeline.

## 8. Internal ledger and reconciliation

The RIT-062/RIT-065 Credit foundation uses append-only grant/reserve/release/consume/reverse/expire
entries, hard-expiry reservations, exact source allocations, append-only dispute restrictions, and
a nonnegative transactionally maintained projection. Subscription Credits are allocated before
promotional and purchased Credits. The application role can insert ordinary ledger facts but
cannot update or delete them. A separate exact-role fulfillment worker consumes signed
payment-state outbox rows in order, rereads current order authority, and grants a purchased pack
once.

Disputes move only unspent source value from purchased available to purchased held. Refunds convert
active holds to source-linked reversal entries and directly reverse remaining available source
value. Reserved or consumed source value never makes the projection negative; it becomes an
explicit `review_required` shortfall for later operations/reconciliation. Active refund initiation
and provider dispute ingestion remain RIT-068/RIT-069 scope.

Use append-only ledger/reconciliation records for:

- Gross order.
- Tax.
- Discount.
- Provider fee where available.
- Refund.
- Dispute/chargeback.
- Net settlement.
- Entitlement grant/reversal linkage.

Daily reconciliation compares internal paid orders, provider payments, refunds, disputes, and payouts. Differences create a high-priority operations case; never silently “fix” balances.

## 9. Subscription requirements

- Explicit cadence, price, currency, trial, renewal, cancellation, access end, and refund behavior.
- Provider subscription reference is not the entitlement itself.
- Handle asynchronous activation, failed renewal, grace, retry, cancel-at-period-end, immediate cancellation, plan changes, tax changes, refunds, and disputes.
- Provide self-service management and accessible cancellation.
- Dunning communication is neutral and frequency-limited.
- Any trial/intro price requires owner and legal approval.

## 10. Refunds and disputes

- Refund eligibility is a versioned product/country rule.
- Automated low-value refunds may be permitted only after an owner sets limits and abuse controls.
- High-value, repeated, fraud-suspected, privacy/safety, or disputed cases require owner review.
- Revoke or adjust entitlements consistently with published terms.
- Preserve legally required order/ledger records while deleting unnecessary sensitive content.
- Prepare evidence from order/product/consent/delivery facts, never from invasive journal/prayer content.

## 11. Tax and invoicing

Choose one reviewed path by country:

- Merchant of Record.
- Payment provider tax service plus merchant registration obligations.
- Internal tax engine/accounting process.

Engineering must support tax-inclusive/exclusive pricing, VAT/GST IDs where needed, invoice/receipt references, currency rounding, location evidence, and corrections. Do not launch paid sales until the tax path is approved.

## 12. Cryptocurrency checkout

### Architecture

- Redirect or embed a licensed third-party hosted checkout.
- Provider handles wallet/address, screening, confirmations, conversion, and settlement.
- RITUVIA stores provider references and normalized payment state only.
- No custody, exchange, transfer, staking, user crypto balance, private key, or seed phrase.

### UX and controls

- Country and product allowlist.
- Approved provider and asset/network allowlist.
- Quote expiry and amount clearly shown.
- Network mismatch warnings handled by provider.
- Refund method disclosed before payment; do not promise on-chain reversal.
- Confirmation delay and settlement state shown accurately.
- Separate provider webhook verification/reconciliation.
- No production activation without owner/legal/provider approval.

## 13. Fraud and abuse

Use proportional controls:

- Rate limits and bot defense.
- Provider fraud tools.
- Velocity by account/device/payment token/hashed signals without invasive fingerprinting.
- Duplicate order and promotion checks.
- Gift/refund abuse controls.
- Account takeover monitoring.
- Manual review queue for material risk.

Do not discriminate based on spiritual belief, ethnicity, or other protected/sensitive traits. Do not expose fraud rules to the client.

## 14. Consumer trust requirements

- Accurate merchant name and statement descriptor.
- Clear customer support contact.
- Easy cancellation.
- Receipts and order history.
- Product delivery confirmation.
- No misleading “donation” label for commercial products.
- No paid guarantee, urgency, or hidden recurring billing.
- Honest restoration behavior across devices/accounts.

## 15. Age and vulnerable-user policy

The initial paid product is adult-only. Implement age attestation and country-specific verification requirements. Do not target minors, build school-oriented acquisition, or use child-directed creative. Escalate changes to legal/owner approval.

## 16. Privacy and data processing

- Keep provider data references minimal.
- Never collect full card numbers or CVV.
- Restrict payment event payloads and define retention.
- Separate payment/support permissions from content/journal access.
- Maintain processor/subprocessor inventory and data-flow documentation.
- Support user requests without deleting legally required financial records; pseudonymize where appropriate.

## 17. Launch gate

Paid launch in a country requires all of:

- Country policy approved and active.
- Provider written approval for exact product/country.
- Tax/MoR path configured and tested.
- Legal terms/privacy/refund/cancellation approved and localized.
- End-to-end sandbox tests, webhook replay tests, refund/dispute simulations, and reconciliation.
- Support and incident runbooks.
- Owner go/no-go recorded.
