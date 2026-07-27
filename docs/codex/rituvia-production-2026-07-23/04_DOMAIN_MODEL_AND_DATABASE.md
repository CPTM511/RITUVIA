# 04 — Domain Model and Database

The canonical schema skeleton is `04_DOMAIN_MODEL_AND_DATABASE.sql`. Codex must adapt names to the existing repository instead of creating duplicate tables, but every invariant below must be represented by a database constraint, transaction or authoritative service rule.

## Core aggregates

### Identity

- `users`
- `auth_identities`
- `sessions`
- `email_login_tokens`
- `passkey_credentials`
- `wallet_identities`
- `wallet_auth_nonces`
- `account_merge_requests`

Wallet identity is globally unique by normalized chain family/address. Linking requires recent step-up authentication. Payment wallet addresses are stored on payment attempts/orders and never silently become auth identities.

### Readings and reflection

- `tarot_cards` and versioned reviewed content
- `daily_tarot_draws` unique by user/anonymous subject and local date
- `tarot_readings` and `tarot_draw_items`
- `numerology_readings`
- `astrology_readings`
- `deep_readings`
- `intentions`
- `journal_entries`
- `revisits`
- `ritual_sessions`

Draw facts, calculations and astronomical facts are immutable after creation. Interpretation versions may be added, never silently overwritten.

### AI

- `ai_prompt_versions`
- `ai_safety_policy_versions`
- `ai_generations`
- `ai_provider_attempts`
- `deep_readings`

Store encrypted user context only when needed for user history. Provider requests and responses are not placed in ordinary logs. Persist model/provider/version/usage and a content hash for evidence.

### Commerce and Credits

- `catalog_versions`, `catalog_products`, `catalog_prices`
- `orders`, `order_items`, `payment_attempts`, `provider_events`
- `subscriptions`, `subscription_periods`
- `credit_ledger`, `credit_reservations`, `credit_projection`
- `entitlements`, `ritual_passes`
- `refunds`, `disputes`
- `outbox_events`

## Credit ledger rules

- Append-only entries; no update or delete in application role.
- Credits use integer units.
- Types: subscription, promotional, purchased, refund adjustment.
- Available Credits are derived from posted grants minus consumption/reservations/reversals and expiry.
- Consumption order: subscription → promotional → purchased.
- Reservation has a hard expiry and product/user binding.
- One idempotency key produces at most one business result.
- A consumption references the reservation and exact source grant allocation.
- Reversal references the original entry.

## Ownership and authorization

Every private row has an immutable `user_id`. Public IDs are random UUID/ULID values, never sequential identifiers. Every query must scope by authenticated user; PostgreSQL RLS may be used as defense in depth, not as a substitute for application authorization.

Admin access to private content is denied by default. Exceptional support access requires a ticket, step-up auth, purpose, expiry and immutable audit record.

## Encryption

Field-level envelope encryption is required for:

- raw private questions and relationship context
- journal text
- intentions and actions
- birth date/time/place where retained
- AI input/output where retained

Use a KMS-managed key-encryption key and per-record or per-user data keys. Store key version and ciphertext metadata. Do not implement custom cryptography.

## Deletion

Deletion is a stateful job:

1. Re-authenticate user.
2. Record request and retention exceptions.
3. Revoke sessions and identities.
4. Delete or crypto-shred private content.
5. Preserve minimum lawful financial records with private content removed.
6. remove provider customer data where allowed.
7. produce completion evidence.

## Migration requirements

- Forward-only, reviewed migrations.
- Expand/migrate/contract for breaking changes.
- Backfill jobs are resumable and measured.
- Production migration requires backup/PITR verification and rollback/roll-forward plan.
- Constraints are created before traffic relies on them.
- No destructive migration is bundled with unrelated feature work.
