import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import {
  AdminSecurityError,
  assertAdminSecurityRuntimeDatabasePrivileges,
  createAdminSecurityService,
  verifyAdminAuditEventHash,
} from "../src/admin-security.js";
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
const adminPolicy = Object.freeze({ recentAuthenticationSeconds: 300 });
const bearer = (): string => randomBytes(32).toString("base64url");

const expectAdminError = async (operation: () => Promise<unknown>, code: string): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected admin security error ${code}.`);
  } catch (error) {
    assert(error instanceof AdminSecurityError, String(error));
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
      await assertAdminSecurityRuntimeDatabasePrivileges(adminDatabase);
      await expectAdminError(
        () => assertAdminSecurityRuntimeDatabasePrivileges(application),
        "ADMIN_SECURITY_UNAVAILABLE",
      );
      const accounts = createAccountIdentityService(application, accountPolicy);
      const admin = createAdminSecurityService(adminDatabase, adminPolicy);
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
      const owner = await createSession("owner-admin-security@example.test");
      const target = await createSession("target-admin-security@example.test");
      const ordinaryUser = await createSession("ordinary-admin-security@example.test");

      const ownerAssignmentId = randomUUID();
      await migrator.query(
        `
          INSERT INTO admin_role_assignment (
            id, user_id, role, granted_by_user_id, reason_code, created_at
          ) VALUES ($1, $2, 'owner', NULL, 'initial_bootstrap', CURRENT_TIMESTAMP)
        `,
        [ownerAssignmentId, owner.userId],
      );
      await expectPostgresError(
        () =>
          migrator.query(
            `
              INSERT INTO admin_role_assignment (
                user_id, role, granted_by_user_id, reason_code, created_at
              ) VALUES ($1, 'owner', NULL, 'duplicate_bootstrap', CURRENT_TIMESTAMP)
            `,
            [target.userId],
          ),
        "23505",
      );

      const request = {
        confirmation: "ASSIGN content_editor",
        reasonCode: "least_privilege_change",
        role: "content_editor" as const,
        targetUserId: target.userId,
        ticketReference: "RIT-056",
      };
      await expectAdminError(
        () => admin.assignRole({ ...request, sessionToken: ordinaryUser.sessionToken }),
        "ADMIN_FORBIDDEN",
      );
      await expectAdminError(
        () => admin.assignRole({ ...request, sessionToken: owner.sessionToken }),
        "ADMIN_MFA_REQUIRED",
      );

      const passkeyId = randomUUID();
      await migrator.query(
        `
          INSERT INTO passkey_credential (
            id, auth_identity_id, credential_id, public_key, rp_id,
            sign_count, created_at, last_used_at
          ) VALUES ($1, $2, $3, $4, 'admin.localhost', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [passkeyId, owner.authIdentityId, randomBytes(32), randomBytes(65)],
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
          owner.userId,
          owner.sessionId,
          owner.authIdentityId,
          passkeyId,
          randomBytes(32),
        ],
      );
      await expectPostgresError(
        () =>
          migrator.query(
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
              target.userId,
              target.sessionId,
              target.authIdentityId,
              passkeyId,
              randomBytes(32),
            ],
          ),
        "23503",
      );

      const assigned = await admin.assignRole({ ...request, sessionToken: owner.sessionToken });
      assert.equal(assigned.userId, target.userId);
      assert.equal(assigned.role, "content_editor");
      await expectAdminError(
        () => admin.assignRole({ ...request, sessionToken: owner.sessionToken }),
        "ADMIN_ROLE_CONFLICT",
      );

      await migrator.query(`REVOKE INSERT ON TABLE admin_audit_event FROM rituvia_admin_service`);
      try {
        await expectAdminError(
          () =>
            admin.assignRole({
              confirmation: "ASSIGN analyst_read_only",
              reasonCode: "atomic_audit_test",
              role: "analyst_read_only",
              sessionToken: owner.sessionToken,
              targetUserId: ordinaryUser.userId,
            }),
          "ADMIN_SECURITY_UNAVAILABLE",
        );
      } finally {
        await migrator.query(`GRANT INSERT ON TABLE admin_audit_event TO rituvia_admin_service`);
      }
      const rolledBack = await migrator.query<{ count: number }>(
        `
          SELECT COUNT(*)::integer AS count
            FROM admin_role_assignment
           WHERE user_id = $1 AND role = 'analyst_read_only'
        `,
        [ordinaryUser.userId],
      );
      assert.equal(rolledBack.rows[0]?.count, 0);

      await admin.revokeRole({
        assignmentId: assigned.assignmentId,
        confirmation: `REVOKE ${assigned.assignmentId}`,
        reasonCode: "least_privilege_change",
        sessionToken: owner.sessionToken,
        ticketReference: "RIT-056",
      });
      await expectAdminError(
        () =>
          admin.revokeRole({
            assignmentId: ownerAssignmentId,
            confirmation: `REVOKE ${ownerAssignmentId}`,
            reasonCode: "owner_rotation",
            sessionToken: owner.sessionToken,
          }),
        "ADMIN_LAST_OWNER",
      );

      const concurrentRoleRequests = await Promise.allSettled([
        admin.assignRole({
          confirmation: "ASSIGN analyst_read_only",
          reasonCode: "concurrent_role_test",
          role: "analyst_read_only",
          sessionToken: owner.sessionToken,
          targetUserId: ordinaryUser.userId,
        }),
        admin.assignRole({
          confirmation: "ASSIGN analyst_read_only",
          reasonCode: "concurrent_role_test",
          role: "analyst_read_only",
          sessionToken: owner.sessionToken,
          targetUserId: ordinaryUser.userId,
        }),
      ]);
      const concurrentSuccess = concurrentRoleRequests.find(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof admin.assignRole>>> =>
          result.status === "fulfilled",
      );
      const concurrentFailure = concurrentRoleRequests.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      assert(concurrentSuccess !== undefined);
      assert(concurrentFailure?.reason instanceof AdminSecurityError);
      assert(
        ["ADMIN_ROLE_CONFLICT", "ADMIN_SECURITY_UNAVAILABLE"].includes(
          concurrentFailure.reason.code,
        ),
      );
      assert.equal(
        (
          await migrator.query<{ count: number }>(
            `
              SELECT COUNT(*)::integer AS count
                FROM admin_role_assignment AS assignment
                LEFT JOIN admin_role_revocation AS revocation
                  ON revocation.assignment_id = assignment.id
               WHERE assignment.user_id = $1
                 AND assignment.role = 'analyst_read_only'
                 AND revocation.assignment_id IS NULL
            `,
            [ordinaryUser.userId],
          )
        ).rows[0]?.count,
        1,
      );
      await admin.revokeRole({
        assignmentId: concurrentSuccess.value.assignmentId,
        confirmation: `REVOKE ${concurrentSuccess.value.assignmentId}`,
        reasonCode: "concurrent_role_test",
        sessionToken: owner.sessionToken,
      });

      await migrator.query(
        `
          UPDATE account_session
             SET authenticated_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes'
           WHERE id = $1
        `,
        [owner.sessionId],
      );
      await expectAdminError(
        () =>
          admin.assignRole({
            confirmation: "ASSIGN analyst_read_only",
            reasonCode: "stale_auth_test",
            role: "analyst_read_only",
            sessionToken: owner.sessionToken,
            targetUserId: target.userId,
          }),
        "ADMIN_RECENT_AUTH_REQUIRED",
      );

      const audit = await migrator.query<{
        action: "admin.role.assign" | "admin.role.revoke";
        actorRole: "owner" | null;
        actorSessionId: string;
        actorUserId: string;
        afterDigest: Uint8Array | null;
        beforeDigest: Uint8Array | null;
        changeFields: Array<"expires_at" | "role">;
        createdAt: Date;
        eventHash: Uint8Array;
        eventId: string;
        outcome: "completed" | "denied";
        previousEventHash: Uint8Array | null;
        reasonCode: string;
        requestId: string;
        targetId: string;
        targetType: string;
        ticketReference: string | null;
      }>(
        `
          SELECT
            id AS "eventId", actor_user_id AS "actorUserId",
            actor_session_id AS "actorSessionId", actor_role AS "actorRole",
            request_id AS "requestId", action, outcome,
            target_type AS "targetType", target_id AS "targetId",
            reason_code AS "reasonCode",
            ticket_reference AS "ticketReference", change_fields AS "changeFields",
            before_digest AS "beforeDigest", after_digest AS "afterDigest",
            previous_event_hash AS "previousEventHash", event_hash AS "eventHash",
            created_at AS "createdAt"
          FROM admin_audit_event
          ORDER BY created_at, id
        `,
      );
      assert([9, 10].includes(audit.rows.length));
      assert.equal(audit.rows.filter(({ outcome }) => outcome === "completed").length, 4);
      assert([5, 6].includes(audit.rows.filter(({ outcome }) => outcome === "denied").length));
      for (const [index, event] of audit.rows.entries()) {
        assert.equal(verifyAdminAuditEventHash(event), true);
        if (index === 0) {
          assert.equal(event.previousEventHash, null);
        } else {
          assert.deepEqual(event.previousEventHash, audit.rows[index - 1]?.eventHash);
        }
        assert.deepEqual(event.changeFields, ["expires_at", "role"]);
      }
      const serializedAudit = JSON.stringify(
        audit.rows.map((event) => ({
          ...event,
          afterDigest:
            event.afterDigest === null ? null : Buffer.from(event.afterDigest).toString("hex"),
          beforeDigest:
            event.beforeDigest === null ? null : Buffer.from(event.beforeDigest).toString("hex"),
          eventHash: Buffer.from(event.eventHash).toString("hex"),
          previousEventHash:
            event.previousEventHash === null
              ? null
              : Buffer.from(event.previousEventHash).toString("hex"),
        })),
      );
      assert(!serializedAudit.includes("owner-admin-security@example.test"));
      assert(!serializedAudit.includes(owner.sessionToken));

      await expectPostgresError(
        () => ordinary.query("SELECT * FROM admin_role_assignment"),
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`UPDATE admin_audit_event SET outcome = 'denied'`,
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`DELETE FROM admin_audit_event`,
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`TRUNCATE admin_audit_event`,
        "42501",
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredAdmin = createDatabaseClient(restored.adminServiceDatabaseUrl);
      try {
        await assertAdminSecurityRuntimeDatabasePrivileges(restoredAdmin);
        const restoredHashes = await restoredAdmin.$queryRaw<Array<{ eventHash: string }>>`
          SELECT encode(event_hash, 'hex') AS "eventHash"
            FROM admin_audit_event
           ORDER BY created_at, id
        `;
        assert.deepEqual(
          restoredHashes.map(({ eventHash }) => eventHash),
          audit.rows.map(({ eventHash }) => Buffer.from(eventHash).toString("hex")),
        );
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
  "Verified admin role isolation, passkey MFA binding, recent reauthentication, atomic audit rollback, last-owner safety, and tamper-evident append-only evidence.\n",
);
