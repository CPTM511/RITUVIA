# PostgreSQL Backup and Recovery Runbook

This is the canonical RITUVIA database backup and restore runbook. It separates repository-proven
synthetic logical recovery from provider-managed production backup and point-in-time recovery
(PITR). A passing local or CI drill never claims that production infrastructure exists.

## 1. Authority and current state

| Capability | Current state | Evidence or gate |
| --- | --- | --- |
| Repository-owned local logical backup and isolated restore | Implemented and verified with synthetic data | `pnpm test:backup-recovery-database` |
| Digest-pinned GitHub Actions PostgreSQL logical restore | Enforced by the protected database CI job | `PostgreSQL integration` required check |
| Production automated encrypted backup | Required before production use; not configured | Managed PostgreSQL evidence and owner deployment approval |
| Production PITR | Required before beta/production use; not configured | Provider recovery-window and restore evidence |
| Production isolated restore | Required before beta/production use; not performed | Separate provider project/cluster rehearsal and owner approval |
| Production retention/deletion schedule | Not approved | Legal/privacy/owner decision |

The repository drill accepts only invocation-owned local test databases or the exact ephemeral
GitHub Actions database. It rejects preview, staging, production, arbitrary URLs, caller-selected
database names, and caller-selected artifact paths.

## 2. Recovery objectives

The current initial objectives remain:

- primary transactional-data RPO: no more than 15 minutes after the selected managed service can
  prove that recovery window;
- core-service RTO: no more than 4 hours for initial launch; and
- no recovery may duplicate payments, Credits, entitlements, provider events, or private-content
  lifecycle actions.

These are launch objectives, not current production claims. Before beta, the selected provider's
documented and measured backup/PITR capabilities must meet or improve them. RIT-124 owns alerting
and SLO integration; RIT-142 repeats the complete launch and rollback rehearsal.

## 3. Production backup requirements

Before a production database may receive customer data:

1. Use provider-managed automated encrypted backups and PITR with encryption at rest and in
   transit. Do not implement custom backup cryptography.
2. Keep backup storage, encryption authority, service identity, and administrative access
   production-specific. Application runtime credentials receive no backup, restore, retention, or
   deletion authority.
3. Require named human identity, MFA, short-lived elevation, reason/ticket, immutable provider
   audit evidence, and least privilege for backup or restore administration.
4. Replicate or isolate backups according to the provider threat model so a primary database
   compromise or operator error cannot silently destroy every recovery point.
5. Monitor backup completion, PITR continuity, storage/encryption state, oldest/newest recovery
   point, failed jobs, and unexpected retention/deletion changes without logging customer data.
6. Bind infrastructure configuration, provider/project identity, region, PostgreSQL major,
   encryption mode, schedule, recovery window, and access policy to reviewed evidence.
7. Align retention and backup expiry with the separately approved privacy, deletion, financial,
   legal-hold, and incident policies. No duration is activated by this runbook.

Object storage, cache, queues, analytics, provider state, encryption-key recovery, and generated
artifacts require their own recovery controls. A PostgreSQL backup alone does not recover the
whole service.

## 4. Repository rehearsal

`pnpm test:backup-recovery-database`:

1. starts or attests the repository-owned loopback PostgreSQL 17 cluster, or accepts only the exact
   digest-pinned GitHub Actions PostgreSQL 17 service;
2. creates distinct synthetic source and empty restore databases;
3. deploys all committed migrations, applies the synthetic seed, and inserts one bounded sentinel;
4. takes a zstd-compressed PostgreSQL custom-format logical backup as the ephemeral administrator;
5. writes only to an internally generated mode-`0700` directory and mode-`0600` regular file,
   rejects symlinks, verifies the `PGDMP` signature, size, and SHA-256, and rechecks the digest
   immediately before restore;
6. inserts a post-snapshot sentinel to prove the restored state is the captured boundary rather
   than the later source state;
7. restores as the non-superuser migrator into the empty isolated target in one transaction;
8. deploys migrations twice, reapplies local grants or restores and verifies the exact CI ACL,
   and validates the locked Prisma schema-drift fingerprint;
9. compares migration records, tables/row counts, constraints, indexes, owners, RLS/forced-RLS,
   policies, relation/database/schema privileges, role attributes, role membership, and sentinel
   state;
10. proves the runtime can read the restored sentinel but cannot create a table or delete it; and
11. removes the artifact and invocation-owned databases on success or failure.

The ignored `.local/evidence/backup-recovery/latest.json` report contains only schema-versioned
metadata, hashes, counts, durations, source revision/state, and cleanup results. It contains no
connection URL, database name, password, secret, SQL, table row, private content, or customer
identifier.

The current reviewed non-empty Prisma drift fingerprint and its complete object-level rationale are
recorded in `docs/reports/RITUVIA_RIT_164_SCHEMA_DRIFT_REVIEW_2026-07-31.md`. A future fingerprint
change remains a failure until its SQL receives the same migration/object review; the report is not
permission to accept a hash without inspecting the diff.

This custom-format logical drill proves repository recovery behavior. It does not prove physical
backup, WAL archiving, PITR, geographic isolation, provider retention, KMS recovery, or a production
RPO/RTO.

## 5. Production restore procedure

Production restore is a human-gated incident or rehearsal:

1. Open an incident/change record with reason, scope, incident commander, owner approval,
   privacy/security contacts, and expected user impact.
2. Freeze risky writes through maintenance/read-only mode and provider/worker kill switches when
   required. Preserve payment/webhook idempotency and queue evidence.
3. Select the recovery point using database, application, migration, provider-event, and
   encryption-key timelines. Record expected data loss against the RPO.
4. Create a new isolated production-authority restore target in a separate approved provider
   project/cluster or equivalent failure boundary. Never restore production data into local,
   preview, ordinary staging, developer devices, or shared analytics.
5. Use the provider restore operation with a dedicated short-lived restore identity. Never expose
   backup bytes or credentials in shell history, logs, CI artifacts, chat, or tickets.
6. Verify PostgreSQL major/extensions, checksums, encryption, database/schema ownership, roles,
   grants, RLS/policies, migration manifest, table/index/constraint health, and key availability.
7. Run privacy-safe integrity checks, application smoke, authorization negatives, payment/Credit
   reconciliation, provider-event reconciliation, worker/outbox checks, and observability
   verification against the isolated target.
8. Measure achieved recovery point and elapsed restore time. Stop if RPO/RTO or integrity
   expectations fail.
9. Obtain the required owner go/no-go before changing production routing or credentials.
10. Promote by controlled connection/routing change with monitoring and a rollback/forward-fix
    plan. Do not overwrite the damaged source until evidence and incident needs are resolved.
11. Reconcile events arriving across the recovery boundary before enabling all writes and workers.
12. Revoke temporary access, preserve immutable evidence, apply approved cleanup/retention, and
    complete a post-action review.

An application rollback is forbidden when the old application cannot safely read the restored
schema. Use the reviewed forward fix or compatible revision.

## 6. Evidence and schedule

Each provider-level rehearsal must record:

- exact source and restored environment/project/cluster references without credentials;
- exact application revision, migration manifest, PostgreSQL/provider versions, configuration and
  infrastructure evidence;
- selected recovery point, oldest/newest available points, measured RPO and RTO;
- backup/PITR encryption, isolation, access, audit, and retention evidence;
- integrity, authorization, schema, application, payment/Credit, provider-event, worker, and
  observability results;
- every participant and owner approval;
- cleanup/revocation result, findings, remediation owner, and next due date.

RIT-129 accepts only a clean-revision, digest-bound protected-staging
`provider_restore_attestation`; local logical restore remains contextual only.

Run the provider-level isolated restore before beta, before production launch, after a material
database/provider/recovery-policy change, after a recovery incident, and at least quarterly until
evidence justifies a different reviewed cadence. CI continues to run the synthetic logical drill
on every protected change.

## 7. Owner gates

Explicit owner approval remains required before:

- selecting or creating production PostgreSQL/backup infrastructure;
- installing production credentials or backup/KMS authority;
- choosing or changing retention, backup deletion, legal hold, region, or recovery policy;
- restoring, mutating, deleting, routing, or replacing production data;
- destructive migration, key destruction, or customer-impacting rollback; and
- declaring Gate H, beta readiness, production readiness, or public launch complete.
