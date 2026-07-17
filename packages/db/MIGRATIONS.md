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

## RIT-007 feature-flag registry classification

`feature_flag_version` stores internal operational configuration only: a registry/key version,
safe `off`/`on` state, bounded country/locale scope, activation/expiry instants, ticket and approval
references, a non-personal operator identifier, and creation time. It must never contain customer
identifiers, private text, secrets, legal copy, provider payloads, or arbitrary JSON.

The migration is expand-only and creates no enabled records. Forced RLS grants reads to a common
reader capability and inserts to a common writer capability. Environment provisioning assigns the
reader to runtime and control, but assigns the writer only to control; runtime is never an object
owner. `off` rows are always appendable by control. `on` rows additionally require registry version
1's exact key, gate-prefix reference, and scope shape. Control cannot update/delete/truncate or use
DDL. Owner approval still governs whether a control credential may be used; the database checks
structure and provenance fields, not the external approval record's truth.

The Web composition adapter does not trust the URL or login name alone. Before every registry read,
it queries PostgreSQL's live ownership, role, and privilege catalogs and fails closed unless the
connected identity is a non-owner, non-privileged SELECT-only reader with no database/schema CREATE
or table/column mutation capability and no direct or transitive role-membership path to an owner, writer,
DDL, MAINTAIN, or privileged role. All role membership is traversed even when SET is currently
disabled, preventing membership administration from enabling a post-check upgrade. The
authenticated `session_user` must equal `current_user`, so a
high-privilege login cannot use connection startup options to preselect a safe-looking role.

Uniqueness includes registry version, and readers filter their exact deployed registry, allowing
v1/v2 history to coexist during rolling upgrade and rollback. A key remains a forced-off tombstone
until its cleanup task is Done; only a later registry version removes it. Dropping the table or
policies remains a destructive migration requiring backup evidence and owner approval.

Logical dumps run through the runtime's exact table-read capability with explicit row security and
INSERT-form data. Restore runs
as migrator into an empty isolated database and reapplies grants. The local test preserves non-empty
off, approved-on, and cross-registry history; compares restored rows exactly; and reruns policy,
constraint, owner, DDL/TRUNCATE, and append-only checks.

## RIT-020 anonymous identity classification

The expand-only identity migration creates `anonymous_subject`, `anonymous_session`,
`consent_record`, and the singleton `anonymous_session_issuance_gate`. It creates no user row, token,
consent, enabled feature, or legal-policy value.

| Data | Classification | Baseline handling |
| --- | --- | --- |
| Anonymous subject/session UUIDs and timestamps | Personal pseudonymous | Fixed configured expiry; no email, IP, user-agent, device ID, or fingerprint |
| Token hash and hash version | Security | SHA-256 of 32 random bytes; plaintext token exists only at the cookie boundary |
| Issuance/idempotency and canonical request hashes | Security/internal | Fixed-size digests only; no raw idempotency key or request body |
| Expiry policy version | Internal policy provenance | Required and immutable for issued subject/session |
| Consent purpose, notice version, locale, decision, source, sequence, time | Personal compliance record | Append-only per purpose; no notice copy or private/free text |
| Withdrawal link | Personal compliance record | Restricted to the same subject and purpose; historical row is not mutated |
| Global issuance window/count | Internal security | Singleton aggregate with no subject, network, device, or content dimension |

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
