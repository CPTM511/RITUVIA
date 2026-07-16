# Database Instructions

These instructions apply to `packages/db/**`, schema files, and migrations.

## Principles

- PostgreSQL is the system of record. Model durable facts, explicit state transitions, version provenance, and auditability.
- Use database constraints for invariants that matter to money, identity, ownership, uniqueness, and state.
- Classify every field using `docs/05_DATA_MODEL.md`; minimize collection before optimizing storage.
- Private question, prayer, journal, birth details, safety flags, and support evidence require strict access paths, encryption decisions, retention, and deletion semantics.

## Migrations

- Use expand/migrate/contract for breaking changes.
- Migrations must be deterministic, reviewed, tested on representative synthetic data, and compatible with rolling deploys.
- Backfills are resumable, idempotent, observable, bounded, and separate from request latency.
- Never rewrite or delete production data merely to make a migration convenient.
- Include rollback/forward-fix notes and backup/restore implications.

## Query rules

- Avoid N+1 and unbounded scans; make pagination and ordering stable.
- Use explicit transactions and locking/optimistic concurrency for money, entitlements, idempotency, and state machines.
- Tenant/user ownership filters are mandatory in every private-data access path.
- Raw SQL is parameterized and justified; generated SQL is inspected for sensitive or high-volume paths.

## Tests

Add constraint, migration, transaction/race, ownership, retention/deletion, and backup/restore-compatible tests. No production database connection is permitted in test or local Codex runs.
