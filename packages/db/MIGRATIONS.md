# Database migration policy

## RIT-003 foundation classification

The `seed_manifest` table is operational provenance for committed synthetic datasets. It is not a domain-content store and must not contain fixture payloads or user-like records.

| Field             | Classification | Purpose                                               |
| ----------------- | -------------- | ----------------------------------------------------- |
| `id`              | Internal       | Stable row identity                                   |
| `dataset_key`     | Internal       | Bounded synthetic dataset identifier                  |
| `version`         | Internal       | Positive immutable dataset version                    |
| `checksum_sha256` | Internal       | Integrity digest for the committed dataset definition |
| `is_synthetic`    | Internal       | Database-enforced proof that the dataset is synthetic |
| `created_at`      | Internal       | Fixed UTC provenance timestamp                        |

No field is personal, private, secret, payment, authentication, or content-rights data. There is no user owner and no user deletion workflow. The row is retained while its migration and seed version remain supported.

## Compatibility and recovery

- The initial migration is an explicit transaction and expand-only: it adds one table and indexes atomically, performs no backfill, and does not change an existing read or write path.
- Runtime rollback leaves the additive table unused. Production schema removal requires a later reviewed forward migration, current backup evidence, and owner approval; do not manually drop it.
- Local and isolated test rollback may drop only their guarded database and then reapply committed migrations.
- Standard PostgreSQL logical and physical backups include this table. RIT-003 verifies a custom-format logical dump can restore into a second isolated database; production backup automation, point-in-time recovery, RPO/RTO, and restore operations remain RIT-123.
- Check constraints are committed SQL because the Prisma schema cannot express every PostgreSQL invariant. Integration tests must fail if they are removed or weakened.

## CI enforcement

`prisma/migration-manifest.json` is the immutable checksum inventory for every committed migration
SQL file and `migration_lock.toml`. Any edit, omission, or additional migration must be reviewed and
the manifest updated in the same change. The static policy rejects unlisted and destructive SQL;
there are no blanket exceptions.

The active CI database job starts a fresh digest-pinned PostgreSQL 17 service with data checksums and
SCRAM host authentication. A repository script accepts only the exact GitHub Actions run identity,
derived ephemeral password, loopback host, port 5432, database name, and roles. The service bootstrap
administrator creates a non-superuser migrator owner, a runtime login, and an append-only
feature-flag control login. Prisma migration/seed/status/drift use the migrator; runtime receives
read-only feature-flag access plus exact identity insert/lifecycle-column capabilities, and control
receives only explicit feature-flag post-migration grants. This isolated CI path does not
accept the local 55432 cluster URL and cannot accept a preview, staging, production, or arbitrary
`DATABASE_URL`.

Prisma cannot represent every committed PostgreSQL constraint, explicit foreign-key name, index,
or SQL default used by RITUVIA. The CI job therefore compares Prisma's normalized
`--from-config-datasource --to-schema --script` output against
`prisma/schema-drift-baseline.json` instead of weakening those database invariants or asserting a
false zero-drift state. The baseline is pinned to Prisma 7.8.0 and records the exact SHA-256, byte
length, and line count of a clean migration. Any schema, migration, Prisma-version, normalization,
or output change fails closed. Updating the baseline requires a fresh empty database, review of the
complete SQL diff, migration-policy verification, and the replacement fingerprint in the same
change; never copy a digest from an unreviewed or long-lived database.

## RIT-007 feature-flag registry classification

`feature_flag_version` stores internal operational configuration only: a registry/key version,
safe `off`/`on` state, bounded country/locale scope, activation/expiry instants, ticket and approval
references, a non-personal operator identifier, and creation time. It must never contain customer
identifiers, private text, secrets, legal copy, provider payloads, or arbitrary JSON.

The migration is expand-only and creates no enabled records. Forced RLS grants reads to a common
reader capability and inserts to a common writer capability. Environment provisioning assigns the
reader to runtime and control, but assigns the writer only to control; runtime is never an object
owner. `off` rows are always appendable by control. Legacy registry v1/v2 rows are restricted to
`off`; registry v3 `on` rows additionally require an exact active key, gate-prefix reference, and
scope shape. Control cannot update/delete/truncate or use DDL. Owner approval still governs whether
a control credential may be used; the database checks structure and provenance fields, not the
external approval record's truth.

The Web composition adapter does not trust the URL or login name alone. Before every registry read,
it queries PostgreSQL's live ownership, role, and privilege catalogs and fails closed unless the
connected identity is a non-owner, non-privileged SELECT-only reader with no database/schema CREATE
or table/column mutation capability and no direct or transitive role-membership path to an owner, writer,
DDL, MAINTAIN, or privileged role. All role membership is traversed even when SET is currently
disabled, preventing membership administration from enabling a post-check upgrade. The
authenticated `session_user` must equal `current_user`, so a
high-privilege login cannot use connection startup options to preselect a safe-looking role.

Uniqueness includes registry version, and readers filter their exact deployed registry, allowing
v1/v2/v3 history to coexist during rolling upgrade and rollback. Registry v3 removes the completed
public-shell tombstone after the protected D-089 compatibility window; v1/v2 history remains
append-only and ignored by v3 readers. Dropping the table or policies remains a destructive
migration requiring backup evidence and owner approval.

Logical dumps run through the runtime's exact table-read capability with explicit row security and
INSERT-form data. Restore runs
as migrator into an empty isolated database and reapplies grants. The local test preserves non-empty
off, approved-on, and cross-registry history; compares restored rows exactly; and reruns policy,
constraint, owner, DDL/TRUNCATE, and append-only checks.

## RIT-020 anonymous identity classification

The expand-only identity migration creates `anonymous_subject`, `anonymous_session`,
`consent_record`, and the singleton `anonymous_session_issuance_gate`. It creates no user row, token,
consent, enabled feature, or legal-policy value.

| Data                                                                      | Classification             | Baseline handling                                                              |
| ------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| Anonymous subject/session UUIDs and timestamps                            | Personal pseudonymous      | Fixed configured expiry; no email, IP, user-agent, device ID, or fingerprint   |
| Token hash and hash version                                               | Security                   | SHA-256 of 32 random bytes; plaintext token exists only at the cookie boundary |
| Issuance/idempotency and canonical request hashes                         | Security/internal          | Fixed-size digests only; no raw idempotency key or request body                |
| Expiry policy version                                                     | Internal policy provenance | Required and immutable for issued subject/session                              |
| Consent purpose, notice version, locale, decision, source, sequence, time | Personal compliance record | Append-only per purpose; no notice copy or private/free text                   |
| Withdrawal link                                                           | Personal compliance record | Restricted to the same subject and purpose; historical row is not mutated      |
| Global issuance window/count                                              | Internal security          | Singleton aggregate with no subject, network, device, or content dimension     |

The anonymous-session TTL is required runtime configuration and intentionally absent from the
migration. Missing configuration disables issuance. Selecting a production retention period,
legal notice, or deletion policy remains an owner/legal gate; the database schema does not imply
that approval.

The application runtime receives exact reads and inserts plus only `last_seen_at`, `revoked_at`, and
issuance-window/count updates. It cannot mutate expiry, subject ownership, token hashes, consent
history, or use delete/truncate/DDL. The migration uses restrictive foreign keys and no cascade.

Rollback is expand-only: disable the route/configuration and revert application/grant usage while
leaving additive tables intact. Removing tables or records requires a later destructive migration,
backup/restore evidence, retention review, and explicit owner approval. Logical backup/restore tests
preserve non-empty session and consent history and re-attest the restored runtime privileges.

## RIT-024 tarot reading persistence classification

The expand-only tarot migration adds immutable `reading` and one-to-one `tarot_draw` tables. It
creates no reading, draw, catalog, policy, approval, identity, or enabled-feature record.

| Data                                                       | Classification                           | Baseline handling                                                                            |
| ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Reading/anonymous-subject UUIDs and timestamps             | Personal pseudonymous                    | Owner-filtered reads; expiry equals the owning anonymous subject expiry                      |
| Reading type, locale, theme, request/policy version        | Personal categorical/internal provenance | Exact bounded values; no raw question, intake risk, or interpretation text                   |
| Catalog reference, checksum, approval reference            | Internal content provenance              | Exact historical snapshot selected by a server-owned approved mapping                        |
| Idempotency key version/hash and client request hash       | Security/internal                        | Keyed 32-byte digests only; no raw key or request body                                       |
| Complete tarot execution JSON and draw request hash        | Personal symbolic result/internal audit  | Strict bounded V1 facts/execution shape; no private question, key, nonce, or raw entropy     |
| Integrity scheme/key version and entropy commitment/counts | Security/internal provenance             | Keyed verifier metadata and SHA-256-shaped commitment only; key material remains server-only |

An active anonymous session is rechecked inside each transaction. The repository locks its subject
before checking every retained idempotency-key version, so same-key retries replay before limits or
entropy and same-key/different-client-request attempts conflict. The same lock serializes bounded
owner-window counts for different keys; only the winning new request inserts a reading before its
execution callback can consume entropy, and callback failure rolls the transaction back. Historical
replay uses the stored catalog reference/checksum and stored key versions rather than current policy.

Runtime receives `SELECT` and `INSERT` through dedicated tarot reader/writer capabilities. It has no
reading/draw `UPDATE`, `DELETE`, `TRUNCATE`, DDL, ownership, or role-administration path. Every
service invocation performs a live privilege attestation and every private query includes the
active subject predicate. PostgreSQL cannot use a trustworthy per-request subject setting without a
separate privileged context setter, and the migration policy forbids adding such a function; this
slice therefore uses the reviewed repository owner-filtering boundary and does not claim fake RLS.

Rollback is expand-only: disable the route/service and revoke the two tarot capabilities while
leaving immutable rows and exact V1 parsers available for historical replay. Dropping either table,
changing retention, or deleting production rows requires a later destructive migration, backup and
restore evidence, privacy/legal review, and explicit owner approval. The local integration suite
verifies non-empty logical dump/restore and reapplies/reattests the exact runtime grants.

## RIT-027 tarot reading report classification

The expand-only report migration adds `reading_report` and an owner-binding uniqueness constraint
to `reading`. It creates no report, reading, identity, policy, retention value, or enabled feature.

| Data                                                 | Classification                      | Baseline handling                                                                                      |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Report, reading, and anonymous-subject UUIDs         | Personal pseudonymous               | Composite foreign key binds every report to the reading owner; runtime queries also require that owner |
| Category and whole-reading/canonical-position target | Personal categorical feedback       | Six bounded categories and no free text, question, interpretation, card payload, or arbitrary target   |
| Schema/report-policy/idempotency-key versions        | Internal policy/security provenance | Exact bounded identifiers; the schema does not select a production policy                              |
| Keyed idempotency and canonical-request hashes       | Security/internal                   | Fixed 32-byte digests only; no raw key or request body                                                 |
| Created and expiry timestamps                        | Personal operational metadata       | Report expiry is bounded by the existing owning reading expiry; no independent retention extension     |

Report creation locks and revalidates the active anonymous subject, loads only an unexpired reading
for that subject, and validates a position target against the immutable stored draw. An unknown,
expired, cross-owner, or invalid-position target uses the same not-found result and performs no
insert. Historical keyed requests replay before insertion; the same key with a different canonical
request conflicts. Reporting does not call the reading-create limit path and therefore neither
consumes nor bypasses reading quota.

Runtime receives only `SELECT` and `INSERT` on `reading_report` through the existing tarot
reader/writer capabilities. It cannot update, delete, truncate, maintain, reference, trigger, own,
or administer the table, and the live tarot privilege attestation includes the report table.
Reports are append-only operational feedback; triage access and deletion/export jobs remain outside
this slice and must receive their own reviewed privileges and owner/legal approval.

Rollback is expand-only: disable the report route and revoke/reapply the tarot capabilities while
leaving the additive table and owner constraint intact. Dropping the table or constraint, changing
retention, or deleting production reports requires a later forward migration, current recovery
evidence, privacy/legal review, and explicit owner approval. The focused integration suite preserves
non-empty reports through logical dump/restore and reattests exact runtime grants.

## RIT-060 country policy registry classification

The expand-only migration adds one immutable `country_policy_version` registry. It activates no
production country, product, provider, currency, crypto asset, legal text, tax mode, or refund
policy. The only seeded row is a synthetic local-only policy guarded by the existing attested
local/CI seed boundary.

| Data                                                         | Classification                    | Baseline handling                                           |
| ------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------- |
| Country, environment, status, effective/review windows       | Internal policy                   | Mirrored indexed selectors; exact database constraints      |
| Complete policy document                                     | Internal compliance configuration | Versioned JSONB; strict application parser; no user content |
| Legal, owner, provider, fiat, and crypto approval references | Internal audit provenance         | References only; independent payment gates; no secrets      |
| Actor, creation time, predecessor version                    | Internal audit provenance         | Append-only successor chain; no update/delete/truncate      |

The application runtime inherits only the dedicated reader capability and performs a live
ownership/privilege attestation before relying on the registry. The control identity may append
rows but cannot mutate history. Row-level policy permits local synthetic rows only in `local`;
written paid rows require the exact fiat and/or crypto owner-gate reference in the policy document.
The strict parser still validates every field and fails closed if database data is malformed,
overlapping without one successor head, stale, future, review-overdue, disabled, or unsupported.

Rollback appends a new immutable successor that copies a prior approved policy and supersedes the
disabled version. Emergency shutdown appends a disabled successor. Do not edit or delete the
historical row. Production publication, legal/provider approval, credential use, deployment, and
public launch remain explicit owner gates.

## RIT-061 catalog registry classification

The expand-only migration adds immutable `catalog_version`, `catalog_product`,
`catalog_product_localization`, and `catalog_price` registries. It activates no production price,
country, tax/refund policy, Stripe account, crypto route, subscription, Credit ledger, checkout, or
entitlement. The only seeded catalog is synthetic and local/CI-only; its values are derived from the
owner-approved production-pack contract but are not live pricing approval.

| Data                                                          | Classification                           | Baseline handling                                                             |
| ------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Product, version, kind, status, fulfillment code              | Public configuration                     | Strict finite values; immutable exact product version                         |
| English/Simplified Chinese title, description, exact contents | Public product content                   | Locale-bound rows; no user or private reflection content                      |
| Credit cost/grant/monthly allocation                          | Public service-entitlement configuration | Positive integers; Credits are non-transferable and have no cash value        |
| USD amount, cadence, countries, provider eligibility          | Restricted commercial configuration      | Positive integer minor units; Country Policy remains the authorization source |
| Tax category, refund policy, effective window                 | Restricted compliance configuration      | Version/reference only; no legal or production activation implied             |
| Source checksum/reference, owner reference, actor/time        | Internal audit provenance                | Append-only immutable evidence                                                |

The application runtime inherits only the dedicated catalog reader capability and performs live
ownership/privilege attestation. The control identity can append reviewed successors but cannot
update, delete, truncate, own, or administer catalog tables. Database constraints reject malformed
identifiers/locales, invalid product Credit-term unions, non-positive/non-integer money, unknown
provider codes, invalid effective windows, and broken product/version references. The mandatory
application publication parser rejects unknown fields, product/price mismatches, duplicate
identities, incomplete supported localizations, crypto subscription pricing, overlapping active
country scopes, and ambiguous active catalogs before Web use.

Rollback selects no active catalog or appends an immutable disabled/retired successor. Do not edit
or delete catalog history. Production pricing, countries, taxes, refunds, providers, credentials,
deployment, and public launch remain explicit owner gates.

## RIT-062 commercial transaction foundation classification

The expand-only migration creates empty provider-neutral v2 order/item/payment-attempt tables plus
append-only Credit ledger, reservation, allocation, nonnegative projection, and source-specific
entitlement records. It does not copy or reinterpret legacy local-commerce rows and does not
activate a provider, country, price, webhook, fulfillment, subscription, refund, or production
migration.

| Data                                             | Classification               | Baseline handling                                               |
| ------------------------------------------------ | ---------------------------- | --------------------------------------------------------------- |
| Exact order/catalog/price/policy/terms snapshots | Restricted commercial        | Integer minor units; server-authoritative versions              |
| Payment attempt/provider references              | Restricted operational       | No card, key, private content, or client success authority      |
| Credit ledger/reservation/allocation             | Personal service entitlement | Positive integers; append-only; non-transferable; no cash value |
| Credit projection                                | Personal derived operational | Nonnegative; transactionally maintained; rebuildable            |
| Plus/permanent entitlement                       | Personal service entitlement | Exact source kind and unique owner/fulfillment                  |
| Idempotency/canonical request digests            | Security/internal            | Fixed 32-byte digests only; no raw request key                  |

Application runtime can insert authoritative transaction facts and update only finite projection
columns. It cannot update or delete Credit ledger/allocation evidence. Privacy-deletion reads are
restricted by request-scoped RLS through the owning order/reservation/user. Rollback stops all v2
writes and retains rows for evidence; no destructive down migration is defined.

## RIT-055 account consent controls classification

The expand-only migration adds one account-owned append-only consent ledger. It does not alter
anonymous consent history, activate analytics, send private content to an AI provider, enable
model training, create marketing/service-notification permission, or approve legal notice text.

| Data                                  | Classification              | Baseline handling                                           |
| ------------------------------------- | --------------------------- | ----------------------------------------------------------- |
| Account/purpose/sequence              | Personal privacy evidence   | Owner-scoped service reads; finite exact purposes           |
| Notice version, locale, decision      | Restricted consent evidence | Exact current version; absence/stale/withdrawn fails closed |
| Withdrawal reference and timestamp    | Restricted audit evidence   | Same-account/purpose append-only chain                      |
| Idempotency/canonical request digests | Security/internal           | Fixed 32-byte digests; raw key/body excluded                |

Application runtime receives `SELECT` and `INSERT` only and is attested before use; it cannot
update, delete, truncate, own, or administer the ledger. Each mutation serializes on the account,
and each data-flow decision rereads the bounded current history. Histories over 256 records fail
closed while still permitting a later withdrawal record. Privacy export includes account and
linked-anonymous consent evidence with explicit owner type.

Rollback removes the Web/API/data-flow composition and stops new writes while retaining the
append-only evidence. Dropping or rewriting consent history, changing retention, activating
production analytics/AI/model improvement, publishing legal consent text, or deploying publicly
requires a later reviewed decision and explicit owner approval.

## RIT-045 transactional Revisit reminder classification

The expand-only migration adds one account-owned reminder preference/queue row per Revisit and one
append-only operation ledger. It does not change historical Revisit v1 rows, activate another
locale, configure an email provider/domain, approve legal copy, or send a production message.

| Data                                              | Classification                | Baseline handling                                               |
| ------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Account/link/Revisit/recipient identity IDs       | Personal operational          | Exact composite ownership; no email or private prose            |
| Preference/channel/frequency/locale/version       | Restricted service preference | English email once-only; unsupported/stale state fails closed   |
| Delivery/attempt/lease/failure/provider reference | Restricted operational        | Hashed lease; three attempts; bounded codes and terminal states |
| Subscribe/unsubscribe operation history           | Restricted consent evidence   | Append-only exact result and database time                      |
| Idempotency/canonical request digests             | Security/internal             | Fixed 32-byte digests; raw key/body excluded                    |

Application runtime receives select/insert plus finite queue-state updates and cannot delete
subscription rows or mutate/delete operation history. Privacy deletion receives only the columns
needed to cancel and minimize delivery state. Privacy export includes user-visible reminder and
operation evidence while excluding lease/idempotency hashes. Rollback disables routes/worker
composition and stops claims while retaining rows; no destructive down migration is defined.

## RIT-093 astrology calculation persistence classification

The expand-only migration adds owner-scoped `astrology_calculation` rows and one append-only
`astrology_calculation_operation` replay ledger. It creates no calculation, enables no astrology
feature, changes no method, invokes no native engine, and performs no production activation.

| Data                                                | Classification                     | Baseline handling                                                                             |
| --------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Account, calculation, and birth-profile UUIDs       | Personal pseudonymous              | Composite ownership and owner-filtered reads                                                  |
| Birth-profile revision and canonical payload digest | Restricted private provenance      | Insert trigger requires the current active owned profile snapshot                             |
| Status, time certainty, method/aspect versions      | Personal derived metadata          | Finite checksummed method semantics; no prediction or prose                                   |
| Method catalog, input, and time-zone digests        | Restricted integrity provenance    | Fixed 32-byte digests only; no birth-place or birth-time plaintext                            |
| Engine build provenance                             | Internal supply-chain provenance   | Exact bounded V1 JSON fields for engine, source/data, adapter, compiler, ABI, and SBOM replay |
| Natal facts                                         | Restricted private derived content | AES-GCM ciphertext, nonce, tag, key version, and separately keyed facts digest only           |
| Idempotency and canonical-request digests           | Security/internal                  | Fixed 32-byte digests; raw keys and request payloads are excluded                             |
| Creation and privacy-deletion timestamps            | Personal operational metadata      | Database time; deletion is terminal for owner reads                                           |

The application runtime receives exact `SELECT` and column-scoped `INSERT` capabilities on the two
tables. It receives no update, delete, truncate, reference, trigger, maintain, ownership, schema
create, database create, or role-administration path. Every persistence operation performs a live
least-privilege attestation. Creation revalidates an active account session, locks the account replay
scope, returns only exact same-key/same-request replay, and requires the active owned birth profile's
expected revision, canonical encrypted-payload digest, and time certainty. The serializable
transaction holds a share lock on that profile row through calculation and operation insertion;
an RLS `WITH CHECK` independently rejects a direct insert whose active owned profile snapshot does
not match. Database routines are intentionally not introduced because migration policy prohibits
them. Calculations and operation evidence are never updated by the application runtime.

Privacy export includes active encrypted calculation rows and complete replay provenance while
excluding idempotency digests. Privacy deletion has a separate request-scoped RLS path that may only
replace facts ciphertext, nonce, tag, keyed digest, and their key versions with deletion tombstones
and set `privacy_deleted_at`. Completion evidence includes the affected calculation count.

Adding `astrologyCalculations` changes the pre-release export contract from
`privacy-export-package.v1` to `privacy-export-package.v2`. The application and isolated database
fixtures create and consume V2 only; no production V1 artifact migration is executed or implied.
If V1 artifacts exist in a later environment, a separately reviewed compatibility reader or
forward re-export operation is required before activation.

Rollback disables calculation composition and revokes/reapplies the runtime grants while retaining
immutable encrypted history and operation evidence. The migration is additive and has no down
migration. Dropping rows or tables, rewriting historical facts, changing retention, or running an
irreversible production migration requires a later forward migration, current backup/restore
evidence, privacy/legal review, and explicit owner approval.

## RIT-093 astrology feature-flag registration

The additive migration adds one insert policy for the canonical `experience.astrology` key. It
does not insert a flag version or enable any environment. The key is carried forward in registry
v3; an `on` version requires `OWN-015:` approval evidence and empty country/locale scopes. The
safe-off policy permits a newer emergency `off` version without waiting for approval; the
append-only table, hierarchical key constraint, and reader/writer least-privilege roles remain
unchanged.

Historical `astrology_enabled` text is a superseded semantic label under D-071, not a valid
PostgreSQL key. The isolated drill applies all 28 migrations, rejects the historical key and
invalid activation evidence, records off-to-on-to-emergency-off history, proves runtime/control
least privilege, and restores the same latest-off state from a logical dump. Rollback stops the
writer and appends a newer off version if necessary; immutable flag history is not deleted.
