# Database migration policy

## RIT-003 foundation classification

The `seed_manifest` table is operational provenance for committed synthetic datasets. It is not a domain-content store and must not contain fixture payloads or user-like records.

| Field | Classification | Purpose |
|---|---|---|
| `id` | Internal | Stable row identity |
| `dataset_key` | Internal | Bounded synthetic dataset identifier |
| `version` | Internal | Positive immutable dataset version |
| `checksum_sha256` | Internal | Integrity digest for the committed dataset definition |
| `is_synthetic` | Internal | Database-enforced proof that the dataset is synthetic |
| `created_at` | Internal | Fixed UTC provenance timestamp |

No field is personal, private, secret, payment, authentication, or content-rights data. There is no user owner and no user deletion workflow. The row is retained while its migration and seed version remain supported.

## Compatibility and recovery

- The initial migration is an explicit transaction and expand-only: it adds one table and indexes atomically, performs no backfill, and does not change an existing read or write path.
- Runtime rollback leaves the additive table unused. Production schema removal requires a later reviewed forward migration, current backup evidence, and owner approval; do not manually drop it.
- Local and isolated test rollback may drop only their guarded database and then reapply committed migrations.
- Standard PostgreSQL logical and physical backups include this table. RIT-003 verifies a custom-format logical dump can restore into a second isolated database; production backup automation, point-in-time recovery, RPO/RTO, and restore operations remain RIT-123.
- Check constraints are committed SQL because the Prisma schema cannot express every PostgreSQL invariant. Integration tests must fail if they are removed or weakened.
