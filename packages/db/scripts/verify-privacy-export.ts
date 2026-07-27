import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  assertPrivacyExportRuntimeDatabasePrivileges,
  createPrivacyExportPersistence,
  PrivacyExportError,
} from "../src/privacy-export.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const anonymousPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.privacy-export-anonymous.v1",
  ttlSeconds: 86_400,
});
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
const exportPolicy = Object.freeze({
  artifactTtlSeconds: 900,
  encryptionKeyVersion: "privacy-export.v1",
  recentAuthenticationSeconds: 900,
  requestWindowSeconds: 3_600,
});

const bearer = (): string => randomBytes(32).toString("base64url");
const sha256 = (value: string): Buffer =>
  createHash("sha256").update(Buffer.from(value, "base64url")).digest();

const expectPrivacyError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected privacy export error ${code}.`);
  } catch (error) {
    assert(error instanceof PrivacyExportError, String(error));
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
      `Expected PostgreSQL ${code}, observed ${String(observed)}: ${String(error)}`,
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

    const runtime = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      await assertPrivacyExportRuntimeDatabasePrivileges(runtime);
      const accounts = createAccountIdentityService(runtime, accountPolicy);
      const anonymous = createAnonymousIdentityService(runtime, anonymousPolicy);
      const exports = createPrivacyExportPersistence(runtime, exportPolicy);
      const createAccountSession = async (email: string) => {
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

      const originalOwner = await createAccountSession("owner-privacy-export@example.test");
      const anonymousOwner = await anonymous.ensureSession({ idempotencyKey: bearer() });
      assert.equal(anonymousOwner.kind, "created");
      if (anonymousOwner.kind !== "created") assert.fail("Expected anonymous owner.");
      const originalAuthentication = await migrator.query<{ authenticated_at: Date | null }>(
        "SELECT authenticated_at FROM account_session WHERE token_hash = $1",
        [sha256(originalOwner.sessionToken)],
      );
      const merged = await accounts.mergeAnonymousSubject({
        accountSessionToken: originalOwner.sessionToken,
        anonymousSessionToken: anonymousOwner.token,
        idempotencyKey: bearer(),
      });
      const successorAuthentication = await migrator.query<{ authenticated_at: Date | null }>(
        "SELECT authenticated_at FROM account_session WHERE token_hash = $1",
        [sha256(merged.sessionToken)],
      );
      assert(originalAuthentication.rows[0]?.authenticated_at instanceof Date);
      assert(successorAuthentication.rows[0]?.authenticated_at instanceof Date);
      assert.equal(
        successorAuthentication.rows[0].authenticated_at.toISOString(),
        originalAuthentication.rows[0].authenticated_at.toISOString(),
        "merge rotation must preserve the authentication instant",
      );
      assert.equal(originalAuthentication.rowCount, 1);
      assert.equal(successorAuthentication.rowCount, 1);

      await migrator.query(
        `
          INSERT INTO birth_profile (
            id, user_id, time_certainty, schema_version,
            payload_ciphertext, payload_nonce, payload_tag,
            encryption_key_version, digest_key_version, canonical_payload_digest
          ) VALUES (
            $1::uuid, $2::uuid, 'unknown', 'birth-profile.v1',
            $3, $4, $5, 'private-content.v1', 'private-content.v1', $6
          )
        `,
        [
          randomUUID(),
          originalOwner.userId,
          randomBytes(64),
          randomBytes(12),
          randomBytes(16),
          randomBytes(32),
        ],
      );

      const first = await exports.prepare({
        idempotencyKey: "p".repeat(22),
        sessionToken: merged.sessionToken,
      });
      assert.equal(first.kind, "created");
      if (first.kind !== "created") assert.fail("Expected a newly prepared export.");
      assert.equal(first.metadata.status, "pending");
      assert.equal((first.snapshot.account as { id?: unknown }).id, originalOwner.userId);
      assert.equal((first.snapshot.linkedSubjects as unknown[]).length, 1);
      assert.deepEqual(Object.keys(first.snapshot).sort(), [
        "account",
        "astrologyCalculations",
        "birthProfiles",
        "commerce",
        "consents",
        "identities",
        "intentions",
        "interpretations",
        "journals",
        "linkedSubjects",
        "privacyActivity",
        "readings",
        "reports",
        "revisits",
        "rituals",
        "sessions",
        "snapshotAt",
      ]);
      assert.equal((first.snapshot.astrologyCalculations as unknown[]).length, 0);
      assert.equal((first.snapshot.birthProfiles as unknown[]).length, 1);
      const snapshotText = JSON.stringify(first.snapshot);
      assert(!snapshotText.includes(merged.sessionToken));
      assert(!snapshotText.includes(originalOwner.sessionToken));
      assert(!snapshotText.includes("idempotencyKeyHash"));
      assert(!snapshotText.includes("tokenHash"));

      const completed = await exports.complete({
        authenticationTag: randomBytes(16),
        ciphertext: randomBytes(128),
        exportId: first.metadata.id,
        nonce: randomBytes(12),
        plaintextBytes: 128,
        plaintextSha256: randomBytes(32),
        recordCount: 5,
        userId: first.userId,
      });
      assert.equal(completed.status, "ready");
      const replay = await exports.prepare({
        idempotencyKey: "p".repeat(22),
        sessionToken: merged.sessionToken,
      });
      assert.equal(replay.kind, "existing");
      assert.equal(replay.metadata.id, first.metadata.id);

      const artifact = await exports.authorizeDownload({
        exportId: first.metadata.id,
        sessionToken: merged.sessionToken,
      });
      assert.equal(artifact.userId, first.userId);
      assert.equal(artifact.recordCount, 5);
      assert.equal(
        (
          await migrator.query<{ action: string }>(
            "SELECT action FROM privacy_export_audit WHERE export_id = $1 ORDER BY created_at, id",
            [first.metadata.id],
          )
        ).rows
          .map(({ action }) => action)
          .join(","),
        "requested,completed,download_authorized",
      );

      await expectPrivacyError(
        () =>
          exports.prepare({
            idempotencyKey: "q".repeat(22),
            sessionToken: merged.sessionToken,
          }),
        "PRIVACY_EXPORT_RATE_LIMITED",
      );

      const other = await createAccountSession("other-privacy-export@example.test");
      await expectPrivacyError(
        () =>
          exports.getMetadata({
            exportId: first.metadata.id,
            sessionToken: other.sessionToken,
          }),
        "PRIVACY_EXPORT_NOT_FOUND",
      );
      const expiredId = randomUUID();
      await migrator.query(
        `
          INSERT INTO privacy_export (
            id, user_id, requested_by_session_id, schema_version,
            encryption_key_version, idempotency_key_hash, canonical_request_hash,
            created_at, expires_at
          ) VALUES (
            $1, $2, $3, 'privacy-export-package.v2',
            'privacy-export.v1', $4, $5,
            CURRENT_TIMESTAMP - INTERVAL '20 minutes',
            CURRENT_TIMESTAMP - INTERVAL '1 minute'
          )
        `,
        [expiredId, other.userId, other.sessionId, randomBytes(32), randomBytes(32)],
      );
      await migrator.query(
        `
          INSERT INTO privacy_export_artifact (
            export_id, user_id, ciphertext, nonce, authentication_tag,
            plaintext_sha256, plaintext_bytes, record_count, completed_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 32, 0,
            CURRENT_TIMESTAMP - INTERVAL '19 minutes'
          )
        `,
        [
          expiredId,
          other.userId,
          randomBytes(32),
          randomBytes(12),
          randomBytes(16),
          randomBytes(32),
        ],
      );
      await expectPrivacyError(
        () =>
          exports.authorizeDownload({
            exportId: expiredId,
            sessionToken: other.sessionToken,
          }),
        "PRIVACY_EXPORT_EXPIRED",
      );

      const concurrent = await createAccountSession("concurrent-privacy-export@example.test");
      const concurrentResults = await Promise.allSettled([
        exports.prepare({
          idempotencyKey: "x".repeat(22),
          sessionToken: concurrent.sessionToken,
        }),
        exports.prepare({
          idempotencyKey: "y".repeat(22),
          sessionToken: concurrent.sessionToken,
        }),
      ]);
      assert.equal(concurrentResults.filter(({ status }) => status === "fulfilled").length, 1);
      const concurrentFailure = concurrentResults.find(({ status }) => status === "rejected");
      assert(concurrentFailure?.status === "rejected");
      assert(concurrentFailure.reason instanceof PrivacyExportError);
      assert.equal(concurrentFailure.reason.code, "PRIVACY_EXPORT_RATE_LIMITED");

      await migrator.query(
        "UPDATE account_session SET authenticated_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' WHERE token_hash = $1",
        [sha256(merged.sessionToken)],
      );
      await expectPrivacyError(
        () =>
          exports.getMetadata({
            exportId: first.metadata.id,
            sessionToken: merged.sessionToken,
          }),
        "PRIVACY_EXPORT_RECENT_AUTH_REQUIRED",
      );
      await migrator.query(
        "UPDATE account_session SET authenticated_at = NULL WHERE token_hash = $1",
        [sha256(merged.sessionToken)],
      );
      await expectPrivacyError(
        () =>
          exports.getMetadata({
            exportId: first.metadata.id,
            sessionToken: merged.sessionToken,
          }),
        "PRIVACY_EXPORT_RECENT_AUTH_REQUIRED",
      );

      const failedOwner = await createAccountSession("failed-privacy-export@example.test");
      const failed = await exports.prepare({
        idempotencyKey: "f".repeat(22),
        sessionToken: failedOwner.sessionToken,
      });
      assert.equal(failed.kind, "created");
      if (failed.kind !== "created") assert.fail("Expected a pending failure export.");
      await exports.fail({
        exportId: failed.metadata.id,
        failureCode: "synthetic_failure",
        userId: failed.userId,
      });
      const failedMetadata = await exports.getMetadata({
        exportId: failed.metadata.id,
        sessionToken: failedOwner.sessionToken,
      });
      assert.equal(failedMetadata.status, "failed");

      const pendingId = randomUUID();
      await migrator.query(
        `
          INSERT INTO privacy_export (
            id, user_id, requested_by_session_id, schema_version,
            encryption_key_version, idempotency_key_hash, canonical_request_hash,
            created_at, expires_at
          ) VALUES (
            $1, $2, $3, 'privacy-export-package.v2',
            'privacy-export.v1', $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '15 minutes'
          )
        `,
        [
          pendingId,
          originalOwner.userId,
          merged.context.sessionId,
          randomBytes(32),
          randomBytes(32),
        ],
      );
      await expectPostgresError(
        () =>
          migrator.query(
            `
              INSERT INTO privacy_export_artifact (
                export_id, user_id, ciphertext, nonce, authentication_tag,
                plaintext_sha256, plaintext_bytes, record_count
              ) VALUES ($1, $2, NULL, $3, $4, $5, 1, 0)
            `,
            [pendingId, originalOwner.userId, randomBytes(12), randomBytes(16), randomBytes(32)],
          ),
        "23502",
      );
      await migrator.query(
        `
          INSERT INTO privacy_export_artifact (
            export_id, user_id, ciphertext, nonce, authentication_tag,
            plaintext_sha256, plaintext_bytes, record_count
          ) VALUES ($1, $2, $3, $4, $5, $6, 1, 0)
        `,
        [
          pendingId,
          originalOwner.userId,
          randomBytes(1),
          randomBytes(12),
          randomBytes(16),
          randomBytes(32),
        ],
      );
      await expectPostgresError(
        () =>
          migrator.query(
            `
              INSERT INTO privacy_export_artifact (
                export_id, user_id, ciphertext, nonce, authentication_tag,
                plaintext_sha256, plaintext_bytes, record_count
              ) VALUES ($1, $2, $3, $4, $5, $6, 1, 0)
            `,
            [
              pendingId,
              originalOwner.userId,
              randomBytes(1),
              randomBytes(12),
              randomBytes(16),
              randomBytes(32),
            ],
          ),
        "23505",
      );

      await expectPostgresError(
        () => runtime.$executeRaw`DELETE FROM privacy_export WHERE id = ${first.metadata.id}::uuid`,
        "42501",
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`UPDATE privacy_export SET expires_at = CURRENT_TIMESTAMP WHERE id = ${first.metadata.id}::uuid`,
        "42501",
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`UPDATE privacy_export_artifact SET record_count = 0 WHERE export_id = ${first.metadata.id}::uuid`,
        "42501",
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`DELETE FROM privacy_export_artifact WHERE export_id = ${first.metadata.id}::uuid`,
        "42501",
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`UPDATE privacy_export_audit SET action = 'failed' WHERE export_id = ${first.metadata.id}::uuid`,
        "42501",
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`DELETE FROM privacy_export_audit WHERE export_id = ${first.metadata.id}::uuid`,
        "42501",
      );

      await runtime.$disconnect();
    } finally {
      await migrator.end();
    }
  } catch (error) {
    primaryError = error;
  } finally {
    for (const database of databases.reverse()) {
      await database.drop().catch((error: unknown) => {
        if (primaryError === undefined) primaryError = error;
      });
    }
    await stopLeaseOwnedRuntime(lease).catch((error: unknown) => {
      if (primaryError === undefined) primaryError = error;
    });
  }
  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified privacy export migrations, preserved authentication time, owner scope, idempotency, rate limits, expiry policy, append-only artifacts and audit, and least privilege.\n",
);
