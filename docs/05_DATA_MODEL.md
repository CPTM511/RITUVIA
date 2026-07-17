# Data Model and Data Classification

## 1. Principles

- Minimize collection.
- Keep deterministic facts immutable/versioned.
- Keep private reflection content separate from analytics.
- Keep money movement append-only and reconcilable.
- Attach policy/content/prompt/provider versions to important outcomes.
- Support export, selective deletion, account deletion, and legally required retention.
- Never infer additional sensitive traits merely because the product is spiritual.

## 2. Data classes

| Class | Examples | Default handling |
|---|---|---|
| Public | Published articles, card library, product catalog | Cacheable/indexable after publication |
| Internal | Feature flags, aggregate metrics, non-sensitive ops data | Authorized staff only |
| Personal | Email, locale, purchase history, account IDs | Access control, encryption in transit/at rest |
| Sensitive personal | Birth date/time/place, prayer, question, intention, journal, relationship/health themes | Field-level/application encryption where practical, strict access, redacted logs, no ad analytics |
| Payment/security | Provider customer IDs, event payloads, fraud signals, audit logs | Restricted access, integrity controls, retention policy |
| Secret | API keys, signing secrets, private keys | Secret manager only; never database/source/log |

## 3. Core entities

### identity

#### `anonymous_subject`

- `id` UUID.
- `created_at`, fixed `expires_at`, `last_seen_at`, and the approved expiry-policy version.
- `country_policy_version_id` nullable.
- `merged_user_id` nullable.
- `merge_idempotency_key` nullable unique.

Current optional-consent state is derived independently for each purpose from the highest valid
append-only `consent_record` sequence. There is no singular mutable consent pointer on the
anonymous subject; absence, a stale notice version, denial, or withdrawal is not consent.

Do not store fingerprinting data beyond narrowly justified abuse controls.

#### `user`

- `id` UUID.
- `status`: active, suspended, deletion_pending, deleted.
- `primary_email_normalized` (encrypted or provider-referenced according to design).
- `email_verified_at`.
- `locale`, `time_zone`.
- `created_at`, `last_active_at`.
- `age_attestation_at` / verification state where required.
- `personalization_opt_in`, `model_improvement_opt_in` as separate consent fields.

#### `auth_identity`, `session`, `role_assignment`

Store provider subject references, session hashes/metadata, and roles. Never store plaintext magic tokens.

#### `consent_record`

Append-only record of purpose, versioned notice, locale, decision, source, sequence, timestamp,
idempotency digest, canonical request digest, and same-subject/same-purpose withdrawal reference.
The baseline never stores notice copy or treats the strictly necessary session cookie as optional
consent.

### profile

#### `birth_profile`

- User/subject owner.
- Label.
- Original local date/time strings.
- Precision: exact, approximate, unknown_time.
- Normalized UTC instant nullable.
- Place ID, latitude/longitude at appropriate precision, time-zone ID and source/version.
- Encrypted sensitive fields.
- Created/updated/deleted timestamps.

#### `preference_profile`

Locale, tone, reminder, accessibility, audio, motion, and privacy preferences. Do not infer religious affiliation.

### divination

#### `reading`

- `id`, owner subject/user.
- `modality`: tarot, numerology, astrology.
- `reading_type` and `status`.
- Theme code; encrypted raw question reference if stored.
- `country_policy_version_id`.
- `content_version_id`, `engine_name`, `engine_version`.
- `created_at`, `completed_at`, `deleted_at`.
- `is_paid`, `order_line_id` nullable.
- `share_state` and redacted share artifact reference.

#### `tarot_draw`

- Reading ID.
- Deck/version.
- Spread/version.
- Immutable ordered card IDs and orientations.
- Server draw audit/nonce hash sufficient for testing without exposing exploitable randomness state.

#### `numerology_calculation`

- Reading ID.
- Rule-set/version, locale/alphabet mapping.
- Encrypted normalized inputs or one-way derived representation where possible.
- Calculation steps as structured JSON.
- Immutable results.

#### `astrology_calculation`

- Reading ID and birth-profile snapshot ID.
- Engine/license adapter/version.
- Input snapshot hash.
- Structured placements/houses/aspects/degrees.
- Precision/confidence flags.

### AI/content

#### `interpretation`

- Reading ID.
- Status.
- Locale/tone.
- Structured output JSON with schema version.
- Rendered text segments.
- Prompt template/version.
- Model provider/model version identifier.
- Source-content version IDs.
- Safety policy/version and check results.
- Token/latency/cost metadata without raw sensitive content.
- Supersedes interpretation ID for regeneration.

#### `prompt_version`

Template, schema, system rules, locale, active state, author/approver, test/eval version, checksum, publication dates.

#### `content_source`

Title, creator/publisher, URL/identifier, tradition, license/rights, citation, review status, reviewer, dates.

#### `content_unit`

Typed structured content: tarot meaning, astrology symbol, numerology rule, ritual script, glossary, safety copy. Includes tradition, source links, version, locale, editorial status.

#### `translation_unit`

Source unit/version, locale, translated content, machine/human origin, reviewer, QA status, publication state.

### reflection

#### `intention`

- Owner.
- Encrypted text.
- Theme code.
- Reading link nullable.
- Small action text encrypted.
- Status and privacy state.
- Revisit date/time-zone.

#### `ritual_session`

- Owner, intention/reading link.
- Ritual template/version.
- Object IDs and entitlement snapshots.
- Started/completed timestamps; coarse duration bucket rather than invasive event stream.
- Accessibility/audio/motion mode categorical values.
- Optional encrypted closing reflection.

#### `journal_entry`

- Owner.
- Encrypted title/body.
- Links to reading/intention/ritual/revisit.
- User tags; non-clinical mood code optional.
- Created/updated/deleted timestamps.
- Search index strategy must preserve privacy and deletion.

#### `revisit`

Original resource links, scheduled state, reminder consent/channel, completion reflection, outcome tags owned by user.

### catalog and commerce

#### `catalog_product`

Stable product code, type, entitlement definition, status, country/locale constraints, exact digital contents, tax category, refund class, and immutable versions.

#### `price`

Product version, currency, amount minor units, billing cadence, provider references, country scope, tax behavior, effective dates. Never use floating point for money.

#### `order`, `order_line`

- Immutable price/product/policy snapshots.
- User/anonymous owner.
- Amounts in minor units: subtotal, discount, tax, total, refunded.
- Currency and states.
- Idempotency key.
- Provider customer/payment references (not secrets).

#### `payment_attempt`

Provider, checkout/session reference, state, amount/currency, quote expiry, failure code category, timestamps.

#### `payment_event`

Immutable signed-webhook receipt metadata, provider event ID unique, payload encrypted/restricted, received/verified/processed timestamps, processing outcome.

#### `ledger_entry`

Append-only debit/credit or balanced event representation for internal money/entitlement reconciliation. Never update historical entries; reverse them.

#### `subscription`

Provider subscription reference, plan/price snapshot, status, periods, cancel state, trial/grace/dunning state.

#### `entitlement`

Owner, capability/object/product, source order/subscription, grant/revoke times, policy, and state. Unique constraints prevent double grants.

#### `refund`, `dispute`

Provider/internal references, amount, reason category, evidence/audit, approval state, impact on entitlements.

### policy and operations

#### `country_policy_version`

Country/region, effective dates, age, modalities, products, providers, methods, currencies, crypto, disclosures, legal docs, data flags, support/marketing constraints, status, approver.

#### `feature_flag`, `experiment`, `experiment_assignment`

Server-side scope and immutable assignment. Do not put sensitive free text in variants or event payloads.

#### `analytics_event`

Prefer external event pipeline with a strict allowlist. Internal copy, if any, stores pseudonymous subject, event name/version, safe categorical properties, timestamp, consent/purpose—not raw content.

#### `safety_event`

Minimal category/severity/action/policy version, encrypted evidence reference if necessary, retention, reviewer state. Avoid storing unnecessary raw crisis content.

#### `privacy_request`

Type, identity verification, scope, state, deadlines, export artifact, deletion tombstone, audit.

#### `audit_log`

Append-only actor, role, action, resource, before/after safe diff or encrypted reference, reason, request/trace ID, timestamp. Never include secrets.

## 4. Relationships and ownership

- Every private record has exactly one owning `user_id` or `anonymous_subject_id` during pre-account use.
- Account merge is a transaction/workflow that transfers allowed records and records provenance.
- Shared/gift resources use explicit grants rather than changing ownership implicitly.
- Deletion cascades are explicit by data category; money/audit records may be retained/pseudonymized where legally required.

## 5. Encryption and search

- Use database/storage encryption plus application/field-level encryption for sensitive free text and birth details where feasible.
- Key versions and rotation are managed outside the database.
- Never build plaintext full-text indexes over prayers/journals without a reviewed threat model.
- If private search is needed, prefer client-side/local indexing or a narrowly scoped encrypted/search-token design after security review.

## 6. Retention defaults to decide before launch

Specify exact periods by jurisdiction and legal basis for:

- Anonymous sessions.
- Raw questions and generated interpretations.
- Journals/intentions/rituals.
- AI request traces.
- Payment events, orders, tax records, disputes.
- Security/access/audit logs.
- Support tickets and attachments.
- Deleted-account backups.

Do not invent final periods in code. Use policy configuration and legal approval.

## 7. Database standards

- UUID/ULID identifiers; never sequential public IDs.
- UTC timestamps plus stored user time-zone context where behavior depends on local time.
- Money in integer minor units with ISO currency.
- Version every JSON schema and validate before read/write.
- Use partial/unique indexes for idempotency and active-state invariants.
- Use database constraints for states/foreign keys, not application checks alone.
- Migrations are forward-compatible, reviewed, tested on production-like volume, and include rollback/roll-forward notes.
- Seed data is synthetic and clearly marked.
