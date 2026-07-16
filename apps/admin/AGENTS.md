# Administration Application Instructions

These instructions apply to `apps/admin/**`.

## Purpose

The admin surface exists for the solo owner to operate RITUVIA safely: content/version management, country policy, feature flags, payment/reconciliation review, support triage, safety queues, localization status, experiments, incidents, and audit evidence.

## Security floor

- Admin is separate from the public application boundary where practical.
- Require phishing-resistant MFA/passkeys, short sessions, secure reauthentication for high-risk actions, and strict allow-listed roles.
- Default deny. Every action performs server-side authorization; hidden UI is not authorization.
- Record tamper-evident audit events for reads of sensitive records and all writes/high-risk actions.
- Never build “view all private journals/prayers.” Sensitive content access requires a narrow case, explicit reason, reauthentication, and auditable break-glass flow.
- Mask payment and personal data by default. Never expose full card, wallet credential, secrets, or raw provider tokens.

## High-risk actions

Require preview, impact summary, typed confirmation, owner approval state, and rollback plan for:

- Publishing legal/safety/payment/country-policy changes.
- Enabling a payment or crypto provider/country.
- Price, tax, refund, subscription, entitlement, or product changes.
- Bulk messaging, bulk data exports, account suspension, deletion override.
- Feature-flag rollout beyond approved thresholds.
- Prompt/model/content version promotion.

## UX and operations

- Build an exception-first dashboard, not a vanity analytics wall.
- Show source timestamp, environment, denominator, filters, and data-quality status.
- Make empty queues and healthy states explicit.
- Provide safe links to source systems and runbooks without embedding secrets.
- Support keyboard operation and WCAG 2.2 AA.

## Testing

Add authorization matrix tests, audit-log assertions, CSRF/session tests, bulk-action safeguards, environment banners, destructive-action confirmations, and E2E tests proving a normal user cannot access admin routes.
