# RIT-164 Restored-Schema Drift Review

## Scope and result

The exact Node.js 26.5.1 isolated synthetic backup-recovery drill reproduced the received Prisma
schema-diff fingerprint:

| Evidence | Previous reviewed baseline | Reproduced current output |
| --- | ---: | ---: |
| SHA-256 | `f564815fc5f4c5f8c23fc8b47d98d995e32f5d70a4c72e5c2a36890e6b4ca84c` | `6bcc97a852e3c17d6f79ffe9c03e86cad5cb9ad27f66a52d45f6156630c738c9` |
| Normalized bytes | 18,271 | 23,015 |
| Normalized lines | 371 | 485 |
| Prisma version | 7.8.0 | 7.8.0 |
| Direction | config datasource to Prisma schema | config datasource to Prisma schema |

The complete 485-line normalized SQL was reviewed locally. It contains 161 schema-only statements
and no data, credential, role password, function body, view definition, trigger body, row mutation,
or unknown object:

| Prisma diff category | Count | Meaning in this repository |
| --- | ---: | --- |
| `DropForeignKey` | 70 | Database-enforced foreign keys intentionally defined in immutable SQL migrations but not represented as Prisma relation fields |
| `DropIndex` | 2 | Reviewed database-only indexes absent from the Prisma model |
| `AlterTable` | 1 | Reviewed migration-owned Revisit reminder template defaults absent from Prisma field defaults |
| `RenameForeignKey` | 83 | Name-only differences between reviewed migration constraint names and Prisma-generated names |
| `AddForeignKey` | 5 | Prisma relation expectations whose reviewed database constraints use different or stronger migration-owned forms |
| **Total** | **161** | Exact current expected diff |

The prior baseline was last updated in commit `701d88e2c8cf16eb7fb0d5702ed6012276a881ca`
after `202607300001_commercial_payment_webhook`. Git history shows no other post-baseline schema
migration. The seven later immutable migrations below map exactly 38 new `DropForeignKey`
statements. Their blocks contain 4,743 bytes and 113 lines; the required insertion separator
accounts for the remaining byte and line, exactly matching all 4,744 added bytes and 114 added
normalized lines.

## Exact incremental migration mapping

### `202607300002_commercial_fulfillment` — 11 constraints

- `commercial_entitlement_v2_ledger_user_fkey`
- `commercial_entitlement_v2_order_user_fkey`
- `commercial_fulfillment_v2_grant_user_fkey`
- `commercial_fulfillment_v2_last_outbox_fkey`
- `commercial_fulfillment_v2_order_user_fkey`
- `credit_ledger_entry_order_user_fkey`
- `credit_restriction_entry_order_user_fkey`
- `credit_restriction_entry_outbox_fkey`
- `credit_restriction_entry_parent_fkey`
- `credit_restriction_entry_source_user_fkey`
- `credit_restriction_entry_user_fkey`

These constraints bind fulfillment, entitlements, restrictions, grants, orders, outbox evidence,
and users. The composite user constraints prevent cross-owner references. The Prisma models retain
the scalar identifiers and indexes but intentionally do not declare relation fields for these
transactional database authorities.

### `202607300003_credit_allocation_ownership` — 2 constraints

- `credit_allocation_reservation_user_fkey`
- `credit_allocation_source_user_fkey`

Both are composite ownership constraints added with the bounded ownership backfill/validation
sequence. Prisma cannot express the migration's `NOT VALID` compatibility phase, and the model
retains nullable `user_id` for that reviewed rollout contract.

### `202607300004_commercial_reconciliation` — 3 constraints

- `commercial_reconciliation_case_v1_attempt_fkey`
- `commercial_reconciliation_case_v1_order_fkey`
- `commercial_reconciliation_case_v1_run_fkey`

These bind every reconciliation case to its scan, order, and exact order-scoped payment attempt.
They are database authority for evidence integrity; the Prisma model exposes scalar lookup fields
without relation navigation.

### `202607300005_commercial_refund_request` — 7 constraints

- `commercial_refund_credit_hold_v1_order_user_fkey`
- `commercial_refund_credit_hold_v1_request_fkey`
- `commercial_refund_credit_hold_v1_source_user_fkey`
- `commercial_refund_request_v1_attempt_order_fkey`
- `commercial_refund_request_v1_confirmed_event_fkey`
- `commercial_refund_request_v1_order_user_fkey`
- `commercial_refund_request_v1_user_fkey`

These enforce owner, order, attempt, signed-event, source-ledger, request, and hold convergence. The
multi-column references are intentionally stronger than unscoped Prisma navigation and prevent a
refund or hold from crossing owner/order/payment boundaries.

### `202607310001_commercial_subscription_lifecycle` — 8 constraints

- `commercial_subscription_allocation_v1_ledger_fkey`
- `commercial_subscription_allocation_v1_period_fkey`
- `commercial_subscription_outbox_v1_allocation_fkey`
- `commercial_subscription_outbox_v1_event_fkey`
- `commercial_subscription_period_v1_subscription_fkey`
- `commercial_subscription_v1_order_user_fkey`
- `commercial_subscription_v1_price_fkey`
- `commercial_subscription_v1_product_fkey`

These bind the Test Mode subscription root, period, allocation, outbox, source event, catalog
product/price, and owner-scoped source order. D-097 freezes this as a production product contract,
but historical replay and database integrity still require these constraints to remain until a
separate evidence-bound retirement task.

### `202607310002_subscription_event_review` — 2 constraints

- `commercial_subscription_review_v1_event_fkey`
- `commercial_subscription_review_v1_subscription_fkey`

Every review record remains attached to the exact subscription event and subscription root. These
are retained Test Mode audit/replay obligations under D-097.

### `202607310003_commerce_admin_timeline` — 5 constraints

- `commerce_admin_audit_event_v1_actor_session_fkey`
- `commerce_admin_operation_event_v1_operation_fkey`
- `commerce_admin_operation_v1_actor_session_fkey`
- `commerce_admin_operation_v1_audit_fkey`
- `commerce_admin_operation_v1_order_fkey`

These bind actor identity/session, audit acceptance, order target, durable operation, and execution
timeline. Removing them would weaken administrative attribution and append-only command evidence.

## Why the baseline, not migrations or Prisma, changes

The diff direction asks what SQL would make the migrated database match the Prisma schema. In this
repository, immutable migrations deliberately add stronger database constraints, compatibility
phases, explicit names, and audit relationships that are not used as Prisma Client relation
navigation. Therefore Prisma proposes dropping or renaming reviewed database authority even though
the database is correct.

The baseline is a fail-closed fingerprint of that reviewed, non-empty expected diff. Updating its
three fingerprint fields does not execute the SQL, remove a constraint, change a migration, weaken
the restored database, or permit an unknown object. Any future added, removed, renamed, or reordered
statement still changes the fingerprint and fails both CI database foundation and backup recovery.

The smallest reversible correction is therefore:

1. keep all 39 migration SQL files and the migration manifest unchanged;
2. keep `prisma/schema.prisma` unchanged;
3. keep normalization and exact SHA/byte/line verification unchanged; and
4. replace only the reviewed baseline SHA-256, byte count, and line count.

## Validation and boundaries

Required closure evidence is:

- exact baseline unit tests;
- immutable migration policy;
- isolated synthetic backup and restore with schema verification;
- CI database foundation drift verification;
- database type/build gates and repository format/lint/type checks; and
- task, status, record index, compiled manual, and checksum synchronization.

This review accessed no production database, backup, credential, provider, deployment, DNS,
customer data, golden screenshot, or real-value transaction. The temporary local schema-only debug
log is not a durable artifact and must be deleted after verification.
