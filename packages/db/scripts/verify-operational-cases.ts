import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import {
  OperationalCaseError,
  assertOperationalCaseRuntimeDatabasePrivileges,
  createOperationalCaseService,
  enqueueOperationalCase,
  verifyOperationalCaseAuditEventHash,
} from "../src/operational-cases.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "auth-data.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});
const operationalPolicy = Object.freeze({
  maximumListSize: 50,
  recentAuthenticationSeconds: 300,
});
const bearer = (): string => randomBytes(32).toString("base64url");

const expectCaseError = async (operation: () => Promise<unknown>, code: string): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected operational case error ${code}.`);
  } catch (error) {
    assert(error instanceof OperationalCaseError, String(error));
    assert.equal(error.code, code);
  }
};

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    const observed = (error as { code?: unknown }).code;
    assert(
      observed === code ||
        (observed === "P2010" &&
          (String(error).includes(code) || JSON.stringify(error).includes(code))),
      `Expected PostgreSQL ${code}, observed ${String(observed)}.`,
    );
  }
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const adminDatabase = createDatabaseClient(database.adminServiceDatabaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    const ordinary = new Client({ connectionString: database.databaseUrl });
    await Promise.all([migrator.connect(), ordinary.connect()]);
    try {
      await assertOperationalCaseRuntimeDatabasePrivileges(adminDatabase);
      await expectCaseError(
        () => assertOperationalCaseRuntimeDatabasePrivileges(application),
        "OPERATIONAL_CASE_UNAVAILABLE",
      );
      const routineInventory = await migrator.query<{ count: number }>(
        `
          SELECT COUNT(*)::integer AS count
          FROM pg_proc
          WHERE proname LIKE '%operational_case%'
        `,
      );
      assert.equal(routineInventory.rows[0]?.count, 0);

      const accounts = createAccountIdentityService(application, accountPolicy);
      const createSession = async (email: string) => {
        const challengeId = randomUUID();
        const state = bearer();
        const token = bearer();
        const sessionToken = bearer();
        await accounts.createChallenge({
          challengeId,
          email,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          providerKey: "local.passwordless.v1",
          returnTo: "/en/account",
          state,
          token,
        });
        const completed = await accounts.consumeChallenge({
          challengeId,
          sessionToken,
          state,
          token,
        });
        return Object.freeze({ ...completed.context, sessionToken });
      };
      const owner = await createSession("owner-operational-cases@example.test");
      const support = await createSession("support-operational-cases@example.test");
      const safety = await createSession("safety-operational-cases@example.test");
      const content = await createSession("content-operational-cases@example.test");
      const ordinaryUser = await createSession("ordinary-operational-cases@example.test");

      await migrator.query(
        `
          INSERT INTO admin_role_assignment (
            id, user_id, role, granted_by_user_id, reason_code, created_at
          ) VALUES ($1, $2, 'owner', NULL, 'initial_bootstrap', CURRENT_TIMESTAMP)
        `,
        [randomUUID(), owner.userId],
      );
      for (const assignment of [
        [support.userId, "support_refund_reviewer"],
        [safety.userId, "risk_safety_reviewer"],
        [content.userId, "content_editor"],
      ] as const) {
        await migrator.query(
          `
            INSERT INTO admin_role_assignment (
              id, user_id, role, granted_by_user_id, reason_code, ticket_reference, created_at
            ) VALUES ($1, $2, $3, $4, 'operational_case_review', 'RIT-125', CURRENT_TIMESTAMP)
          `,
          [randomUUID(), assignment[0], assignment[1], owner.userId],
        );
      }

      const addMfa = async (session: typeof owner): Promise<void> => {
        const passkeyId = randomUUID();
        await migrator.query(
          `
            INSERT INTO passkey_credential (
              id, auth_identity_id, credential_id, public_key, rp_id,
              sign_count, created_at, last_used_at
            ) VALUES ($1, $2, $3, $4, 'admin.localhost', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          [passkeyId, session.authIdentityId, randomBytes(32), randomBytes(65)],
        );
        await migrator.query(
          `
            INSERT INTO admin_mfa_assertion (
              id, user_id, account_session_id, auth_identity_id,
              passkey_credential_id, challenge_hash, verified_at, expires_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes'
            )
          `,
          [
            randomUUID(),
            session.userId,
            session.sessionId,
            session.authIdentityId,
            passkeyId,
            randomBytes(32),
          ],
        );
      };
      for (const session of [owner, support, safety, content]) {
        await addMfa(session);
      }

      const subjectId = randomUUID();
      const readingId = randomUUID();
      const sources = {
        content: randomUUID(),
        privacy: randomUUID(),
        safety: randomUUID(),
        stalePrivacy: randomUUID(),
        support: "",
      };
      await migrator.query(
        `
          INSERT INTO anonymous_subject (
            id, expiry_policy_version, created_at, expires_at, last_seen_at
          ) VALUES (
            $1, 'anonymous-retention.local.v1', CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
          )
        `,
        [subjectId],
      );
      await migrator.query(
        `
          INSERT INTO reading (
            id, anonymous_subject_id, modality, reading_type, status, locale, theme_code,
            request_schema_version, reading_policy_version, catalog_id, catalog_version,
            catalog_checksum_sha256, catalog_approval_reference, idempotency_key_version,
            idempotency_key_hash, client_request_hash, created_at, completed_at, expires_at
          ) VALUES (
            $2, $1, 'tarot', 'one_card', 'facts_ready', 'en', 'self',
            'tarot-reading-create.v1', 'tarot-reading.local.en.v2',
            'rituvia.major-arcana', '1.0.0', $3, 'OWN-010:option-a:2026-07-17',
            'tarot-reading.idempotency.v1', $4, $5,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days'
          )
        `,
        [subjectId, readingId, randomBytes(32), randomBytes(32), randomBytes(32)],
      );
      await migrator.query(
        `
          INSERT INTO reading_report (
            id, reading_id, anonymous_subject_id, category, target_kind,
            schema_version, report_policy_version, idempotency_key_version,
            idempotency_key_hash, canonical_request_hash, created_at, expires_at
          ) VALUES
            ($1, $2, $3, 'safety', 'reading', 'tarot-reading-report.v1',
              'tarot-reading-report.local.en.v1', 'tarot-report.idempotency.v1',
              $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days'),
            ($6, $2, $3, 'rights', 'reading', 'tarot-reading-report.v1',
              'tarot-reading-report.local.en.v1', 'tarot-report.idempotency.v1',
              $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')
        `,
        [
          sources.safety,
          readingId,
          subjectId,
          randomBytes(32),
          randomBytes(32),
          sources.content,
          randomBytes(32),
          randomBytes(32),
        ],
      );
      await application.$transaction(async (transaction) => {
        const ticketRows = await transaction.$queryRaw<
          Array<{ createdAt: Date; expiresAt: Date; id: string }>
        >`
          INSERT INTO support_ticket_v1 (
            anonymous_subject_id, category, affected_area, schema_version,
            policy_version, idempotency_key_hash, canonical_request_hash, expires_at
          ) VALUES (
            ${subjectId}::uuid, 'technical', 'reading',
            'support-ticket.v1', 'protected-beta-support.local.en.v1',
            ${randomBytes(32)}, ${randomBytes(32)}, CURRENT_TIMESTAMP + INTERVAL '7 days'
          ) RETURNING id, created_at AS "createdAt", expires_at AS "expiresAt"
        `;
        const ticket = ticketRows[0];
        assert(ticket);
        sources.support = ticket.id;
        await enqueueOperationalCase(transaction, {
          sourceId: ticket.id,
          sourceKind: "support_ticket",
        });
        for (const privacySource of [
          { id: sources.privacy, openedAt: new Date(), stale: false },
          { id: sources.stalePrivacy, openedAt: new Date(Date.now() - 345_600_000), stale: true },
        ]) {
          const exportRows = await transaction.$queryRaw<
            Array<{ createdAt: Date; expiresAt: Date; id: string }>
          >`
            INSERT INTO privacy_export (
              id, user_id, requested_by_session_id, schema_version, encryption_key_version,
              idempotency_key_hash, canonical_request_hash, created_at, expires_at
            ) VALUES (
              ${privacySource.id}::uuid, ${owner.userId}::uuid, ${owner.sessionId}::uuid,
              'privacy-export-package.v2', 'privacy-export.test.v1',
              ${randomBytes(32)}, ${randomBytes(32)}, ${privacySource.openedAt},
              ${new Date(Date.now() + 432_000_000)}
            ) RETURNING id, created_at AS "createdAt", expires_at AS "expiresAt"
          `;
          const exportRow = exportRows[0];
          assert(exportRow);
          await enqueueOperationalCase(transaction, {
            sourceId: exportRow.id,
            sourceKind: "privacy_export",
          });
        }
        const reportRows = await transaction.$queryRaw<
          Array<{ categoryCode: string; createdAt: Date; expiresAt: Date; id: string }>
        >`
          SELECT id, category AS "categoryCode", created_at AS "createdAt",
                 expires_at AS "expiresAt"
          FROM reading_report
          WHERE id IN (${sources.safety}::uuid, ${sources.content}::uuid)
          ORDER BY id
        `;
        assert.equal(reportRows.length, 2);
        for (const report of reportRows) {
          await enqueueOperationalCase(transaction, {
            sourceId: report.id,
            sourceKind: "reading_report",
          });
        }
      });
      const cases = await migrator.query<{ id: string; queueKind: string; sourceId: string }>(
        `
          SELECT id, queue_kind AS "queueKind", source_id AS "sourceId"
          FROM operational_case_v1
          ORDER BY queue_kind, source_id
        `,
      );
      assert.equal(cases.rows.length, 5);
      const caseId = (sourceId: string): string => {
        const row = cases.rows.find((candidate) => candidate.sourceId === sourceId);
        assert(row);
        return row.id;
      };

      const service = createOperationalCaseService(adminDatabase, operationalPolicy);
      await expectCaseError(
        () =>
          service.list({
            queue: "support",
            reasonCode: "beta_support_review",
            sessionToken: ordinaryUser.sessionToken,
            ticketReference: "RIT-125",
          }),
        "OPERATIONAL_CASE_FORBIDDEN",
      );
      await expectCaseError(
        () =>
          service.list({
            queue: "safety",
            reasonCode: "cross_queue_attempt",
            sessionToken: support.sessionToken,
            ticketReference: "RIT-125",
          }),
        "OPERATIONAL_CASE_FORBIDDEN",
      );

      const supportCases = await service.list({
        queue: "support",
        reasonCode: "beta_support_review",
        sessionToken: support.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(supportCases.length, 1);
      assert.equal(supportCases[0]?.categoryCode, "support.technical");
      assert.equal(supportCases[0]?.draft.status, "draft_only_not_sent");
      assert.match(supportCases[0]?.draft.body ?? "", /has not been sent/u);
      assert(!JSON.stringify(supportCases).includes("private-canary"));

      const privacyCases = await service.list({
        queue: "privacy",
        reasonCode: "beta_privacy_review",
        sessionToken: support.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(privacyCases.length, 2);
      const stalePrivacy = privacyCases.find(({ id }) => id === caseId(sources.stalePrivacy));
      assert.equal(stalePrivacy?.firstResponseSla, "breached");
      assert.equal(stalePrivacy?.resolutionSla, "breached");
      assert.equal(stalePrivacy?.escalationRequired, true);

      const safetyCases = await service.list({
        queue: "safety",
        reasonCode: "beta_safety_review",
        sessionToken: safety.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(safetyCases.length, 1);
      assert.equal(safetyCases[0]?.priority, "urgent");
      const contentCases = await service.list({
        queue: "content_report",
        reasonCode: "beta_content_review",
        sessionToken: content.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(contentCases.length, 1);

      const triageKey = randomUUID();
      const triaged = await service.transition({
        action: "triage",
        caseId: caseId(sources.support),
        idempotencyKey: triageKey,
        queue: "support",
        reasonCode: "ownership_accepted",
        sessionToken: support.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(triaged.state, "triaged");
      assert.equal(triaged.assignedRole, "support_refund_reviewer");
      assert.deepEqual(
        await service.transition({
          action: "triage",
          caseId: caseId(sources.support),
          idempotencyKey: triageKey,
          queue: "support",
          reasonCode: "ownership_accepted",
          sessionToken: support.sessionToken,
          ticketReference: "RIT-125",
        }),
        triaged,
      );
      await expectCaseError(
        () =>
          service.transition({
            action: "triage",
            caseId: caseId(sources.support),
            idempotencyKey: triageKey,
            queue: "support",
            reasonCode: "changed_authority",
            sessionToken: support.sessionToken,
            ticketReference: "RIT-125",
          }),
        "OPERATIONAL_CASE_CONFLICT",
      );
      const resolved = await service.transition({
        action: "resolve",
        caseId: caseId(sources.support),
        idempotencyKey: randomUUID(),
        queue: "support",
        reasonCode: "review_complete",
        sessionToken: support.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(resolved.state, "resolved");
      assert.equal(
        (
          await service.list({
            queue: "support",
            reasonCode: "post_resolution_review",
            sessionToken: support.sessionToken,
            ticketReference: "RIT-125",
          })
        ).length,
        0,
      );

      const escalated = await service.transition({
        action: "escalate",
        caseId: caseId(sources.safety),
        idempotencyKey: randomUUID(),
        queue: "safety",
        reasonCode: "urgent_safety_review",
        sessionToken: safety.sessionToken,
        ticketReference: "RIT-125",
      });
      assert.equal(escalated.state, "escalated");
      assert.equal(escalated.priority, "urgent");

      await expectPostgresError(() => ordinary.query("SELECT * FROM operational_case_v1"), "42501");
      await expectPostgresError(
        () => adminDatabase.$executeRaw`SELECT * FROM reading_report`,
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`UPDATE operational_case_v1 SET priority = 'urgent'`,
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`DELETE FROM operational_case_event_v1`,
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`TRUNCATE operational_case_audit_event_v1`,
        "42501",
      );

      const audit = await migrator.query<{
        action:
          | "admin.content_report.review"
          | "admin.privacy.review"
          | "admin.safety.review"
          | "admin.support.review";
        actorRole:
          | "owner"
          | "content_editor"
          | "support_refund_reviewer"
          | "risk_safety_reviewer"
          | "analyst_read_only"
          | null;
        actorSessionId: string;
        actorUserId: string;
        afterDigest: Buffer | null;
        beforeDigest: Buffer | null;
        changeFields: string[];
        createdAt: Date;
        eventHash: Buffer;
        eventId: string;
        outcome: "completed" | "denied";
        previousEventHash: Buffer | null;
        reasonCode: string;
        requestId: string;
        targetId: string;
        targetType: "operational_case" | "operational_queue";
        ticketReference: string;
      }>(
        `
          SELECT
            id AS "eventId", actor_user_id AS "actorUserId",
            actor_session_id AS "actorSessionId", actor_role AS "actorRole",
            request_id AS "requestId", action, outcome, target_type AS "targetType",
            target_id AS "targetId", reason_code AS "reasonCode",
            ticket_reference AS "ticketReference", change_fields AS "changeFields",
            before_digest AS "beforeDigest", after_digest AS "afterDigest",
            previous_event_hash AS "previousEventHash", event_hash AS "eventHash",
            created_at AS "createdAt"
          FROM operational_case_audit_event_v1
          ORDER BY created_at, id
        `,
      );
      assert(audit.rows.length >= 11);
      assert(audit.rows.some(({ outcome }) => outcome === "denied"));
      for (const [index, event] of audit.rows.entries()) {
        assert.equal(verifyOperationalCaseAuditEventHash(event), true);
        assert.deepEqual(
          event.previousEventHash,
          index === 0 ? null : audit.rows[index - 1]?.eventHash,
        );
      }
      const serialized = JSON.stringify(
        audit.rows.map((event) => ({
          ...event,
          afterDigest: event.afterDigest?.toString("hex") ?? null,
          beforeDigest: event.beforeDigest?.toString("hex") ?? null,
          eventHash: event.eventHash.toString("hex"),
          previousEventHash: event.previousEventHash?.toString("hex") ?? null,
        })),
      );
      assert(!serialized.includes("owner-operational-cases@example.test"));
      assert(!serialized.includes(owner.sessionToken));
      assert(!serialized.includes("private-canary"));

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredAdmin = createDatabaseClient(restored.adminServiceDatabaseUrl);
      try {
        await assertOperationalCaseRuntimeDatabasePrivileges(restoredAdmin);
        const restoredCounts = await restoredAdmin.$queryRaw<
          Array<{ auditCount: bigint; caseCount: bigint; eventCount: bigint }>
        >`
          SELECT
            (SELECT COUNT(*) FROM operational_case_v1) AS "caseCount",
            (SELECT COUNT(*) FROM operational_case_event_v1) AS "eventCount",
            (SELECT COUNT(*) FROM operational_case_audit_event_v1) AS "auditCount"
        `;
        assert.equal(restoredCounts[0]?.caseCount, 5n);
        assert.equal(restoredCounts[0]?.eventCount, 3n);
        assert.equal(restoredCounts[0]?.auditCount, BigInt(audit.rows.length));
      } finally {
        await restoredAdmin.$disconnect();
      }
    } finally {
      await Promise.all([
        application.$disconnect(),
        adminDatabase.$disconnect(),
        migrator.end(),
        ordinary.end(),
      ]);
    }
  } catch (error) {
    primaryError = error;
  } finally {
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (cleanupError) {
        primaryError ??= cleanupError;
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
  }
  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified metadata-only support, privacy, safety, and content-report queues with fixed SLA/drafts, step-up role isolation, append-only transitions, tamper-evident audit, and logical restore.\n",
);
