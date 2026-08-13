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

| Class              | Examples                                                                                | Default handling                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Public             | Published articles, card library, product catalog                                       | Cacheable/indexable after publication                                                             |
| Internal           | Feature flags, aggregate metrics, non-sensitive ops data                                | Authorized staff only                                                                             |
| Personal           | Email, locale, purchase history, account IDs                                            | Access control, encryption in transit/at rest                                                     |
| Sensitive personal | Birth date/time/place, prayer, question, intention, journal, relationship/health themes | Field-level/application encryption where practical, strict access, redacted logs, no ad analytics |
| Payment/security   | Provider customer IDs, event payloads, fraud signals, audit logs                        | Restricted access, integrity controls, retention policy                                           |
| Secret             | API keys, signing secrets, private keys                                                 | Secret manager only; never database/source/log                                                    |

## 3. Core entities

### identity

#### `anonymous_subject`

- `id` UUID.
- `created_at`, fixed `expires_at`, `last_seen_at`, and the approved expiry-policy version.
- `country_policy_version_id` nullable.
- Anonymous-owned history keeps this immutable identifier after account conversion; ownership is
  resolved through one append-only `account_subject_link` rather than rewriting private rows.

Current optional-consent state is derived independently for each purpose from the highest valid
append-only `consent_record` sequence. There is no singular mutable consent pointer on the
anonymous subject; absence, a stale notice version, denial, or withdrawal is not consent.

Signed-in optional consent uses the separate append-only `account_consent_record` authority. The
current controls are `optional_product_analytics`, `ai_personalization`, and `model_improvement`,
each with an exact independent notice version. Account login, anonymous merge, purchase, or another
purpose's grant cannot create consent. Every data-flow check rereads current state; withdrawal
therefore applies after its database commit rather than after a later login or page load.

Do not store fingerprinting data beyond narrowly justified abuse controls.

#### `user`

- `id` UUID.
- `status`: active, suspended, deletion_pending, deleted.
- `primary_email_normalized` (encrypted or provider-referenced according to design).
- `email_verified_at`.
- `locale`, `time_zone`.
- `created_at`, `last_active_at`.
- `age_attestation_at` / verification state where required.
- Personalization and model-improvement state is derived from separate append-only consent
  purposes, not mutable profile booleans.

#### `auth_identity`, `auth_challenge`, `account_session`

- `auth_identity` stores a provider key and keyed provider subject plus encrypted verified email;
  normalized email and provider secrets are never stored in plaintext.
- `auth_challenge` stores only hashes of the one-time token, browser state, and optional previous
  account session, with an absolute short expiry and one consumed timestamp.
- `account_session` stores only a versioned bearer digest, immutable authentication instant, fixed
  expiry, bounded last-seen time, and revocation time. The raw bearer exists only in a host-only
  secure cookie. Merge rotation preserves the source authentication instant rather than treating a
  new bearer as a new authentication.
- Completion creates a fresh session and may revoke only the still-active same-user session whose
  digest was captured when the challenge started.

#### `account_subject_link`

- Exactly one row may bind an anonymous subject to one account.
- Stores only opaque user/subject/session identifiers, a keyed idempotency digest, a canonical
  request digest, and creation time; no bearer, email, private content, or client prose.
- Source anonymous session must belong to the linked subject, and source account session must
  belong to the linked user. Runtime can select/insert but cannot update/delete audit rows.
- Privacy deletion adds a nullable completion-bound deletion request and timestamp. Every account
  authorization query requires both ownership and an absent privacy-deletion timestamp.
- Authentication completion creates the account/session/link and revokes anonymous sessions in one
  transaction. Explicit post-login merge derives one deterministic successor bearer with a
  server-held HMAC key, stores only its digest, revokes the source account session, and returns the
  same successor for an exact same-source/same-key retry.

#### Account history projection

- Account history is a read-time owner-scoped projection over retained readings, intentions,
  legacy/v2 ritual sessions, legacy/v2 journals, and Revisits reachable through
  `account_subject_link`; it is not a copied account-owned history table.
- The projection selects only opaque resource ID, resource type, coarse lifecycle status,
  occurrence time, and reading type/theme where applicable. It excludes ciphertext, decrypted
  prose, account identity, merge evidence, and bearer material.
- Visibility reuses each source row's existing expiry, soft-deletion, parent-deletion, and subject
  expiry rules. Creating the projection does not extend retention or revive deleted data.
- Pagination is stable and bounded by descending occurrence time, internal source discriminator,
  and UUID. The discriminator exists only inside the opaque cursor and is not client authority.
- Session listings are a projection of active, unrevoked `account_session` rows and expose only
  opaque session ID plus created, last-seen, and expiry timestamps. Targeted revocation excludes
  the current session and remains owner-scoped.

#### `auth_start_rate_limit`

- Database-atomic fixed-window counters keyed by scope plus a 32-byte keyed digest.
- One global row and a re-HMACed 16-bit identifier bucket bound storage to 65,537 rows.
- No plaintext email, IP address, user agent, device fingerprint, or free text.
- Runtime may insert/read and update only window/count columns; it cannot delete or alter the key.

#### `passkey_credential`

- Provider-neutral owner identity, globally unique credential ID, bounded public-key material,
  canonical RP ID, nonnegative sign count, created/last-used/revoked timestamps.
- The current capability is schema-ready only. No WebAuthn ceremony, attestation policy, or
  production passkey activation is implied.

#### `consent_record`

Append-only record of purpose, versioned notice, locale, decision, source, sequence, timestamp,
idempotency digest, canonical request digest, and same-subject/same-purpose withdrawal reference.
The baseline never stores notice copy or treats the strictly necessary session cookie as optional
consent.

#### `account_consent_record`

Append-only account-owned purpose/version ledger with a contiguous per-purpose sequence,
idempotency and canonical-request digests, and same-account/same-purpose withdrawal references.
The application runtime can select and insert but cannot update or delete these records. Histories
over the bounded evaluation limit fail closed. Privacy exports include both anonymous-subject and
account-owned consent records with explicit owner type; privacy deletion retains this evidence
under the existing consent-history category.

### profile

#### `birth_profile`

- User/subject owner.
- Label.
- Original local date/time strings.
- Precision: exact, approximate, unknown_time.
- Normalized UTC instant nullable.
- Opaque place ID, latitude/longitude at appropriate precision, IANA time-zone ID, and exact
  provider/adapter/data-source/version/SHA-256 provenance.
- Historical time-zone runtime ID plus exact Node, ICU, and tzdata versions; resolved offset,
  ambiguity choice, and pre-1970 confidence where applicable.
- A fold remains unresolved until the user chooses the earlier or later instant. A clock gap stores
  no fabricated UTC instant. Unknown-time profiles do not invoke local-time resolution.
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

- Owner account, calculation ID, birth-profile ID, expected profile revision, and exact keyed
  encrypted-profile digest.
- Engine selection ID/version, adapter ID/version, library version/release date, separate source
  snapshot tag/date/commit, independently authorized effective-license evidence references, source
  archive digest, exact ephemeris-data artifact digests, native ABI, compiler/flags, and SBOM.
- Checksummed method catalog, input snapshot, and exact time-zone provenance digests.
- Encrypted structured placements/houses/aspects/degrees with nonce, authentication tag, key
  version, and separately keyed facts digest; birth time and place are never stored as plaintext
  calculation metadata.
- Requested and returned ephemeris flags including explicit `SEFLG_SWIEPH` verification, house
  system, precision/confidence flags, and unknown/approximate-time suppression evidence.
- Failure is stored as unavailable metadata without invented or partially trusted placements;
  historical rows retain their original engine/data versions after an adapter successor.
- Rows and replay evidence are append-only for the application runtime. Privacy deletion
  cryptographically shreds ciphertext and digests instead of rewriting derived facts.

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
- Active/completed/archived status, optimistic revision, soft-deletion timestamp, and private-only
  privacy state.
- Revisit date/time-zone.
- Explicit reminder preference; `none` is the only RIT-040 value and does not activate delivery.
- Historical v1 rows retain their original contract and ciphertext unchanged through the additive
  v2 migration.
- Soft deletion is terminal for owner reads and create replay. Row locking serializes lifecycle
  mutation with ritual creation so a committed archive/delete cannot be bypassed by an older
  transaction.
- A revisit date is validated as future at create/edit time in its IANA time zone; a date becoming
  historical never blocks complete, archive, or delete.

#### Ritual catalog source

- Git-authored `ritual-catalog.v1` definitions use production-pack codes and immutable versions.
- Every template references approved English original-secular publication evidence with author,
  reviewer/approval, rights, safety class, effective date, review date, and source references.
- Every item is exactly one of `free_object`, `permanent_object`, or `consumable_ritual`, with a
  matching free, permanent-entitlement, or consumable-pass requirement.
- Contracts expose localization keys and closed interaction/presentation enums, not arbitrary
  ritual prose, price, Credit cost, payment authority, ownership, efficacy, or outcome fields.
- `reflection-ritual.v1` codes remain historical. Exact replay mappings include `candle` to
  `free_candle`, `incense` to `free_incense`, and `golden_intention_bowl` to `golden_bowl`.

#### `ritual_session`

- Historical `reflection-ritual.v1` rows remain unchanged, including their daily uniqueness and
  exact legacy object codes.

#### `ritual_session_v2`

- Owner and intention composite identity.
- Exact catalog, item, publication, template, and access snapshots fixed at start.
- Active, paused, completed, or abandoned state; current step, coarse elapsed seconds, optimistic
  revision, and timestamp-consistent lifecycle fields.
- Free starts require only an active owner. Permanent starts resolve an active account
  entitlement. Consumable starts reference one `ritual_pass`.
- One owner/intention can have at most one active or paused v2 session.
- The browser does not persist private intention, journal, or ritual progress content in Web
  Storage; visible exit records a durable pause.

#### `ritual_pass`

- Linked account owner, exact access-requirement code, and immutable commerce order-line source.
- Available, consumed, or reversed lifecycle with one optional v2 ritual-session reference.
- Runtime has read and narrow consume-only update privileges; issuance and reversal remain outside
  RIT-043.
- Pass selection, v2 session insertion, and pass consumption share one database transaction, so a
  failed start leaves the pass available.

#### `journal_entry`

- Historical `reflection-journal.v1` rows remain unchanged and readable through their exact
  historical contract.

#### `private_journal_entry`

- Owner, linked intention, and required completed `ritual_session_v2`.
- AES-256-GCM ciphertext, nonce, tag, and key version; authenticated context binds owner and
  journal resource ID.
- Owner-scoped idempotency digests, optimistic revision, updated timestamp, inherited expiry, and
  immediately hidden soft deletion.
- Runtime can update only ciphertext and lifecycle columns and cannot physically delete rows.
- Journal prose is excluded from URLs, logs, analytics, browser storage, and public metadata.

#### `revisit`

- Owner and intention composite identity, with at most one scheduled row per owner/intention.
- Exact intention text, small action, and intention revision snapshot under owner/resource-bound
  AES-256-GCM authenticated encryption and an explicit snapshot key version.
- Next-day, seven-day, or custom schedule kind; local calendar date and validated IANA time zone
  are stored separately so daylight-saving transitions cannot move the chosen day.
- Reminder preference is fixed to `none` and channel to null. Optional start/end local quiet hours
  are inert policy data only and do not create an outbox or delivery request.
- Scheduled, completed, and archived lifecycle with optimistic revision, inherited expiry,
  terminal soft deletion, and database-clock `isDue` projection. Due state is informational:
  completion remains valid before, on, or after the selected date.
- Completion reflection uses independent owner/resource-bound ciphertext and key version; outcome
  tags are a duplicate-free bounded set of non-clinical user-owned codes.
- Deleting the linked intention immediately hides the Revisit. Runtime roles cannot physically
  delete rows or read ciphertext columns directly.

#### `revisit_operation`

- Append-only owner/resource-scoped idempotency ledger for schedule, reschedule, complete, archive,
  and soft-delete operations.
- Each row binds operation kind, key, canonical request digest, resulting revision, status, and
  creation time. Same-key exact replay returns the recorded resource while changed reuse conflicts.
- Runtime can insert but cannot update or delete ledger rows; schedule and mutation writes share one
  transaction with the corresponding operation record.

#### `revisit_reminder_subscription`

- One optional account-owned row per Revisit; RIT-044 remains fixed to `reminderPreference: none`
  and does not itself create delivery authority.
- Exact `revisit-reminder-preference.v1`, English locale, email channel, and once-only frequency;
  current preference is subscribed or unsubscribed and delivery is pending, leased, retry-wait,
  delivered, dead-lettered, or cancelled.
- Queue payload is the row identity plus account, ownership-link, Revisit, and recipient-identity
  identifiers. It contains no email address, question, intention, action, ritual, journal,
  relationship, or generated prose.
- Each row also persists the immutable lifecycle-template ID, positive version, source SHA-256,
  resolved template locale, and fallback-used flag. The existing `locale` remains the requested
  account locale; `template_locale` records the exact rendered catalog. Current delivery requires
  English and `template_fallback_used = false`, while format-level database constraints allow a
  future registry to retain older referenced versions during rollout or rollback.
- Claiming uses database date/time-zone, 09:00 local due threshold, stored quiet hours,
  `SKIP LOCKED`, hashed bounded leases, three attempts, and deterministic retry. Delivery requires a
  second live authorization check that also re-evaluates the scheduled local date, current time
  zone, due threshold, quiet hours, and exact template binding; committed unsubscribe and privacy
  deletion clear any lease.
- Runtime can update only finite preference/queue columns and cannot delete the row. Privacy export
  includes user-visible preference, template provenance, delivery, failure, provider-reference,
  timestamp, and operation evidence while excluding lease and idempotency hashes.

#### `revisit_reminder_operation`

- Append-only account/Revisit-scoped subscribe and unsubscribe evidence with hashed idempotency key,
  canonical request hash, exact resulting preference/delivery state, and database timestamp.
- Exact same-key replay returns the recorded result even after later preference changes; changed
  reuse conflicts. Runtime can select/insert but cannot update or delete history.

### catalog and commerce

#### `catalog_version`, `catalog_product`, `catalog_product_localization`, `catalog_price`

- `catalog_version` is an immutable environment-scoped publication with source checksum/reference,
  owner evidence, supported/default locales, effective/review windows, and predecessor version.
- `catalog_product` uses a strict product kind and term union: packs grant Credits; Plus allocates
  Credits monthly; Deep Readings/permanent objects/consumable rituals cost Credits; free objects
  have no price or Credit cost.
- `catalog_product_localization` binds each exact product version to one reviewed BCP 47 locale,
  title, description, and non-empty exact-digital-contents list.
- `catalog_price` exists only for Credit packs and Plus plans and binds positive integer minor
  units, ISO currency, cadence, country/provider eligibility, tax category, refund-policy version,
  and an effective `[from, until)` window.
- The RIT-061 seed is synthetic local/CI-only. Production pricing, countries, tax/refund policy, and
  providers remain empty until their owner gates are satisfied.

#### `commercial_order_v2`, `commercial_order_item_v2`

- Additive successor to the quarantined legacy local-commerce replay tables.
- Immutable catalog/price/product/Country Policy/terms/refund and exact-content snapshots.
- Account owner; paid anonymous fulfillment remains unsupported.
- Amounts in minor units: subtotal, discount, tax, total, refunded.
- Canonical created/checkout/pending/paid/failure/refund/dispute states and lifecycle timestamps.
- Versioned idempotency digest plus canonical request digest; changed-key reuse conflicts.

#### `commercial_payment_attempt_v2`

Provider/environment, exact order, attempt number, checkout/payment reference, integer
amount/currency, expected crypto network/asset where applicable, hard expiry, and exact
idempotency. Attempts terminate at payment success/failure/expiry/cancellation; refunds and
disputes are not attempt states.

#### `commercial_payment_event_v2`, `commercial_payment_outbox_v2`

Immutable, account-bound signed-webhook receipt metadata and one transactional state-change outbox
row per applied provider event. The webhook role may append events/outbox rows and update bounded
payment state, but cannot lease, complete, grant, hold, or reverse value. A separate fulfillment
role owns bounded outbox delivery state. A matched, applied `payment_disputed` event is the durable
dispute fact; RIT-074 deliberately does not copy it into a second dispute table.

#### `credit_ledger_entry`, `credit_reservation`, `credit_allocation`, `credit_projection`

- Credits are positive integers, non-transferable service entitlements and never cash, stored
  value, cryptocurrency, or a client-authoritative balance.
- Ledger facts are append-only grant/reserve/release/consume/reverse/expire operations with exact
  user, product/order/reservation/source, policy/terms, expiry, and idempotency evidence.
- Reservations bind one exact product and hard expiry. Allocations reference exact grants and
  consume subscription, then promotional, then purchased Credits. Every allocation carries the
  same immutable owner as both its reservation and source grant, enforced by composite foreign
  keys. The additive ownership migration enforces this for every new allocation without rewriting
  historical rows; any legacy row without the binding makes fulfillment fail closed until a
  separately approved audited backfill and constraint validation.
- Projection rows are transactionally mutable for bounded reads but never negative and remain
  reconstructable from ledger/reservation/allocation/restriction facts. `purchased_held` is
  excluded from spendable balance and records dispute-frozen purchased Credits.

#### `credit_restriction_entry`, `commercial_fulfillment_v2`

- Restriction entries are append-only source-linked dispute holds and refund conversions. A
  dispute moves only currently unspent purchased Credits from available to held; it does not
  pretend that a refund occurred.
- Refund conversion links each active hold to a refund reversal. Direct refund reversals affect
  only currently available source value. Consumed or reserved source value becomes an explicit
  nonnegative review shortfall.
- The fulfillment projection binds one order/owner/source grant, current status, granted/held/
  reversed/shortfall amounts, applied payment-state version, last outbox, and optimistic version.
  It can be rebuilt from append-only payment, ledger, allocation, and restriction evidence.

#### `subscription`

Provider subscription reference, plan/price snapshot, status, periods, cancel state, trial/grace/dunning state.

#### `commercial_entitlement_v2`

Owner, exact product/fulfillment, authoritative source, active/frozen/revoked timestamps, and exact
idempotency. Plus must originate from an order; permanent objects must originate from a Credit
consumption. Composite owner/source constraints and unique owner/type/fulfillment constraints
prevent cross-account or double grants.

#### `commercial_refund_request_v1`, dispute support

Refund requests are separate owner/order/attempt/provider-bound aggregates with policy,
idempotency, provider execution, confirmation, and Credit-hold evidence. Current Credit Pack
disputes remain immutable payment events. After the matching outbox and fulfillment complete and
the order still remains disputed, an independent idempotent projector creates one immutable
metadata-only `commercial_dispute_support_projection_v1` work item linked directly to the payment
event. It does not create a second dispute aggregate or a second mutable case state machine.
Ignored-out-of-order, mismatched, unfulfilled, stale-version, subscription, and already-refunded
observations do not open a current support work item. The projection stores no amount, provider
object, payload, journal, prayer, question, reading, intention, birth data, attachment, or support
free text.

### policy and operations

#### `country_policy_version`

Immutable country/environment version with effective and mandatory review windows; predecessor
version; service status; minimum age; modalities and prohibited claims; products/subscriptions;
fiat providers, methods, currencies, and recurring permission; crypto provider/assets; required
disclosures and legal-document versions; tax/refund configuration; data, locale, support, and
marketing flags; independent legal, owner, provider, fiat, and crypto approval references; actor;
and the complete strict versioned JSON policy document. Runtime access is bounded read-only.
Kill-switch and rollback behavior append a successor rather than mutating history.

#### `feature_flag`, `experiment`, `experiment_assignment`

Server-side scope and immutable assignment. Do not put sensitive free text in variants or event payloads.

#### `analytics_event`

Prefer external event pipeline with a strict allowlist. Internal copy, if any, stores pseudonymous subject, event name/version, safe categorical properties, timestamp, consent/purpose—not raw content.

RIT-046 creates no database table or retained event row. Its bounded ledger is test-only; a future
internal table or external pipeline requires approved retention, deletion/suppression, consent
notice, transactional delivery, and production activation.

#### `safety_event`

Minimal category/severity/action/policy version, encrypted evidence reference if necessary, retention, reviewer state. Avoid storing unnecessary raw crisis content.

#### `privacy_export`, `privacy_export_artifact`, `privacy_export_audit`

- One immutable account/session-owned idempotent request records explicit schema/key versions and
  database-clock creation/expiry, with no user prose, bearer, or raw request key.
- A separate one-per-request append-only artifact records AES-256-GCM ciphertext plus plaintext
  integrity/size/count evidence and completion time. Authenticated data binds account, export ID,
  schema, key version, creation, and expiry. Runtime has no update/delete privilege on requests,
  requests or audit. The deletion workflow alone may physically remove encrypted artifacts;
  ready/failed state is derived from artifact/audit existence and a post-request deletion fence
  prevents an older export snapshot from finalizing afterward.
- Export snapshots include every retained implemented account-linked category, including rows
  hidden from ordinary product history by soft deletion or expiry. Explicit allowlists omit bearer,
  token/idempotency/claim hashes, provider checkout URLs, credential public keys, and internal
  payment object identifiers.
- `privacy_export_audit` is append-only requested/completed/failed/download-authorized evidence
  bound by composite account/export/session foreign keys. It contains no private content.
- Legal retention periods, production object storage, worker delivery, and deletion remain
  separately owner-gated.

#### `privacy_deletion_request`, `privacy_deletion_completion`, `auth_identity_suppression`

- One immutable request binds account, requesting session, exact scope, policy, replay-only session
  digest, idempotency/canonical digests, fixed retained-category codes, and database time.
- One append-only completion records only affected-row counts, completion time, and an evidence
  digest. Exact account-scope replay can return this result after all ordinary sessions are revoked.
- Deletion privacy-marks existing subject links, revokes linked anonymous sessions, replaces
  private intention/journal/Revisit ciphertext and generated interpretation prose with fixed
  non-user tombstones, destroys export artifacts, and removes temporary checkout capability URLs.
- Account scope additionally tombstones profile/authentication material, revokes every account
  session/passkey, and records an irreversible provider-subject suppression digest before changing
  the stored identity. Suppression is checked under the same provider lock before account creation.
- Stable account/subject IDs, derived reading metadata, consent history, commerce/ledger facts, and
  security/privacy evidence remain under their existing source retention. No final legal duration
  is introduced.

#### `audit_log`

Append-only actor, role, action, resource, before/after safe diff or encrypted reference, reason, request/trace ID, timestamp. Never include secrets.

The RIT-056 admin foundation implements this as append-only `admin_audit_event` rows with finite
actions/reasons, server-generated request ID, actor session and effective role, allow-listed
changed field names, SHA-256 before/after state digests, and a serialized predecessor/event hash
chain. Raw field values are not stored. `admin_role_assignment` and `admin_role_revocation`
preserve grant history; one
operator-only bootstrap owner is allowed, and the runtime service cannot create another
unattributed owner. `admin_mfa_assertion` is bound by composite foreign keys to one matching
user/session/auth identity/passkey and is read-only to the admin runtime. Production WebAuthn
issuance, RP/origin policy, and retention remain safe-off owner gates.

## 4. Relationships and ownership

- Every private record has exactly one immutable `user_id` or `anonymous_subject_id`; current
  anonymous-first features retain subject ownership after account conversion.
- Account authorization resolves linked anonymous subjects through `account_subject_link`; it does
  not copy or rewrite history. A different account, source session, or idempotency key conflicts.
- Shared/gift resources use explicit grants rather than changing ownership implicitly.
- Deletion cascades are explicit by data category; money/audit records may be retained/pseudonymized where legally required.

## 5. Encryption and search

- Use database/storage encryption plus application/field-level encryption for sensitive free text and birth details where feasible.
- Key versions and rotation are managed outside the database.
- Private-content encryption may rotate to a new active key while idempotency and canonical-request
  HMACs remain on a separately selected retained digest key version for the full record lifetime.
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

## 8. RIT-125 operational case classification

RIT-125 adds one source-bound operational case kernel and no private evidence store.

| Data                                                             | Classification                 | Handling                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Support ticket and source UUIDs                                  | Personal pseudonymous          | Foreign-key-bound to one existing anonymous/user source; never shown as a public identifier                            |
| Bounded support/report/privacy category                          | Sensitive personal categorical | Fixed allowlist only; no question, reading prose, journal, prayer, birth data, email, attachment, or arbitrary message |
| Queue, priority, state, SLA timestamps, policy/template versions | Restricted operational         | Database-derived from source and reviewed local policy; not a public production promise                                |
| Operator user/session/role, reason, ticket                       | Restricted security/operations | Recent-auth and same-session passkey required; append-only audit; no free-form operator notes                          |
| Idempotency, canonical, before/after, and chain hashes           | Security/internal              | Fixed 32-byte digests; no raw key or private payload                                                                   |
| Fixed English draft                                              | Internal support content       | Versioned allowlisted acknowledgement, always `draft_only_not_sent`                                                    |

`support_ticket_v1` inherits the owning anonymous-subject expiry. Reading-report and privacy-export
cases inherit their source expiry. Privacy-deletion and refund cases do not create an independent
retention period; they remain bound to the existing source/audit obligation until an approved
retention policy exists. No historical source row is backfilled by the migration. Deletion,
retention changes, private evidence, attachments, or historical replay require separate review and
applicable Owner/legal approval.
