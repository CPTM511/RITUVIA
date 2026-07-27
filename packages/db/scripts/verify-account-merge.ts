import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  AccountIdentityError,
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const anonymousPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.account-merge-anonymous.v1",
  ttlSeconds: 86_400,
});
const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "test.account-merge-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});

const bearer = (): string => randomBytes(32).toString("base64url");

const expectAccountError = async (
  operation: () => Promise<unknown>,
  code: AccountIdentityError["code"],
): Promise<void> => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AccountIdentityError);
    assert.equal(error.code, code);
    return true;
  });
};

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal((error as { code?: unknown }).code, code);
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
    const runtimeSql = new Client({ connectionString: database.databaseUrl });
    await Promise.all([migrator.connect(), runtimeSql.connect()]);
    try {
      const anonymousIdentity = createAnonymousIdentityService(runtime, anonymousPolicy);
      const accountIdentity = createAccountIdentityService(runtime, accountPolicy);
      const createAccount = async (email: string) => {
        const challengeId = randomUUID();
        const state = bearer();
        const token = bearer();
        const sessionToken = bearer();
        await accountIdentity.createChallenge({
          challengeId,
          email,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          providerKey: "local.passwordless.v1",
          returnTo: "/en/account",
          state,
          token,
        });
        const completed = await accountIdentity.consumeChallenge({
          challengeId,
          sessionToken,
          state,
          token,
        });
        assert.equal(completed.mergeStatus, null);
        return Object.freeze({ ...completed.context, sessionToken });
      };
      const createAnonymousSession = async () => {
        const result = await anonymousIdentity.ensureSession({ idempotencyKey: bearer() });
        if (result.kind !== "created") assert.fail("Expected a new anonymous session.");
        return result;
      };

      const firstAccount = await createAccount("first-merge@example.test");
      const firstAnonymous = await createAnonymousSession();
      const historyId = randomUUID();
      await migrator.query(
        `
          INSERT INTO reading (
            id, anonymous_subject_id, reading_type, theme_code, request_schema_version,
            reading_policy_version, catalog_id, catalog_version, catalog_checksum_sha256,
            catalog_approval_reference, idempotency_key_version, idempotency_key_hash,
            client_request_hash, created_at, completed_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, 'one_card', 'self', 'tarot-reading-create.v1',
            'account-merge-test.v1', 'account-merge-catalog', '1.0.0',
            decode(repeat('ab', 32), 'hex'), 'RIT-051:account-merge-test',
            'account-merge-idempotency.v1', decode(repeat('bc', 32), 'hex'),
            decode(repeat('cd', 32), 'hex'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '1 day'
          )
        `,
        [historyId, firstAnonymous.context.subjectId],
      );

      await migrator.query(`
        CREATE FUNCTION fail_account_merge_after_link() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM account_subject_link
             WHERE created_at >= transaction_timestamp()
          ) THEN
            RAISE EXCEPTION 'synthetic account merge failure' USING ERRCODE = '40001';
          END IF;
          RETURN NEW;
        END
        $$
      `);
      await migrator.query(`
        CREATE TRIGGER fail_account_merge_after_link
        BEFORE INSERT ON account_session
        FOR EACH ROW EXECUTE FUNCTION fail_account_merge_after_link()
      `);
      await expectAccountError(
        () =>
          accountIdentity.mergeAnonymousSubject({
            accountSessionToken: firstAccount.sessionToken,
            anonymousSessionToken: firstAnonymous.token,
            idempotencyKey: bearer(),
          }),
        "ACCOUNT_IDENTITY_UNAVAILABLE",
      );
      await migrator.query("DROP TRIGGER fail_account_merge_after_link ON account_session");
      await migrator.query("DROP FUNCTION fail_account_merge_after_link()");
      const rolledBack = await migrator.query<{
        links: number;
        revokedAt: Date | null;
      }>(
        `
          SELECT (SELECT count(*)::int FROM account_subject_link
                   WHERE anonymous_subject_id = $1::uuid) AS links,
                 revoked_at AS "revokedAt"
            FROM anonymous_session
           WHERE id = $2::uuid
        `,
        [firstAnonymous.context.subjectId, firstAnonymous.context.sessionId],
      );
      assert.deepEqual(rolledBack.rows[0], { links: 0, revokedAt: null });
      assert.ok(await accountIdentity.resolveSession(firstAccount.sessionToken));

      const firstMergeKey = bearer();
      const sameRequestRace = await Promise.all(
        Array.from({ length: 8 }, () =>
          accountIdentity.mergeAnonymousSubject({
            accountSessionToken: firstAccount.sessionToken,
            anonymousSessionToken: firstAnonymous.token,
            idempotencyKey: firstMergeKey,
          }),
        ),
      );
      assert.equal(sameRequestRace.filter(({ status }) => status === "created").length, 1);
      assert.equal(sameRequestRace.filter(({ status }) => status === "replayed").length, 7);
      const firstMerge = sameRequestRace[0];
      assert.ok(firstMerge);
      assert.ok(
        sameRequestRace.every(({ sessionToken }) => sessionToken === firstMerge.sessionToken),
      );
      assert.equal(await accountIdentity.resolveSession(firstAccount.sessionToken), null);
      assert.ok(await accountIdentity.resolveSession(firstMerge.sessionToken));
      const history = await accountIdentity.listReadings({
        limit: 10,
        sessionToken: firstMerge.sessionToken,
      });
      assert.deepEqual(
        history.items.map(({ id }) => id),
        [historyId],
      );

      const replay = await accountIdentity.mergeAnonymousSubject({
        accountSessionToken: firstAccount.sessionToken,
        anonymousSessionToken: firstAnonymous.token,
        idempotencyKey: firstMergeKey,
      });
      assert.equal(replay.status, "replayed");
      assert.equal(replay.sessionToken, firstMerge.sessionToken);
      assert.ok(await accountIdentity.resolveSession(replay.sessionToken));
      await expectAccountError(
        () =>
          accountIdentity.mergeAnonymousSubject({
            accountSessionToken: firstAccount.sessionToken,
            anonymousSessionToken: firstAnonymous.token,
            idempotencyKey: bearer(),
          }),
        "ACCOUNT_MERGE_CONFLICT",
      );
      assert.ok(await accountIdentity.resolveSession(firstMerge.sessionToken));

      const secondAccount = await createAccount("second-merge@example.test");
      await expectAccountError(
        () =>
          accountIdentity.mergeAnonymousSubject({
            accountSessionToken: secondAccount.sessionToken,
            anonymousSessionToken: firstAnonymous.token,
            idempotencyKey: bearer(),
          }),
        "ACCOUNT_MERGE_CONFLICT",
      );
      assert.ok(await accountIdentity.resolveSession(secondAccount.sessionToken));
      const provenanceAnonymous = await createAnonymousSession();
      await expectPostgresError(
        () =>
          migrator.query(
            `
              INSERT INTO account_subject_link (
                user_id, anonymous_subject_id, source_session_id,
                source_account_session_id, idempotency_key_hash,
                canonical_request_hash
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                decode(repeat('de', 32), 'hex'), decode(repeat('ef', 32), 'hex')
              )
            `,
            [
              secondAccount.userId,
              provenanceAnonymous.context.subjectId,
              firstAnonymous.context.sessionId,
              secondAccount.sessionId,
            ],
          ),
        "23503",
      );
      await expectPostgresError(
        () =>
          migrator.query(
            `
              INSERT INTO account_subject_link (
                user_id, anonymous_subject_id, source_session_id,
                source_account_session_id, idempotency_key_hash,
                canonical_request_hash
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                decode(repeat('f1', 32), 'hex'), decode(repeat('f2', 32), 'hex')
              )
            `,
            [
              secondAccount.userId,
              provenanceAnonymous.context.subjectId,
              provenanceAnonymous.context.sessionId,
              firstAccount.sessionId,
            ],
          ),
        "23503",
      );

      const concurrentAnonymous = await createAnonymousSession();
      const thirdAccount = await createAccount("third-merge@example.test");
      const fourthAccount = await createAccount("fourth-merge@example.test");
      const concurrent = await Promise.allSettled([
        accountIdentity.mergeAnonymousSubject({
          accountSessionToken: thirdAccount.sessionToken,
          anonymousSessionToken: concurrentAnonymous.token,
          idempotencyKey: bearer(),
        }),
        accountIdentity.mergeAnonymousSubject({
          accountSessionToken: fourthAccount.sessionToken,
          anonymousSessionToken: concurrentAnonymous.token,
          idempotencyKey: bearer(),
        }),
      ]);
      assert.equal(concurrent.filter(({ status }) => status === "fulfilled").length, 1);
      assert.equal(concurrent.filter(({ status }) => status === "rejected").length, 1);
      const rejected = concurrent.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      assert.ok(rejected?.reason instanceof AccountIdentityError);
      assert.equal(rejected.reason.code, "ACCOUNT_MERGE_CONFLICT");
      const concurrentAudit = await migrator.query<{ links: number }>(
        `
          SELECT count(*)::int AS links
            FROM account_subject_link
           WHERE anonymous_subject_id = $1::uuid
        `,
        [concurrentAnonymous.context.subjectId],
      );
      assert.equal(concurrentAudit.rows[0]?.links, 1);

      const countsBeforeAtomicFailure = await migrator.query<{
        identities: number;
        sessions: number;
        users: number;
      }>(
        `
          SELECT (SELECT count(*)::int FROM app_user) AS users,
                 (SELECT count(*)::int FROM auth_identity) AS identities,
                 (SELECT count(*)::int FROM account_session) AS sessions
        `,
      );
      const failingChallengeId = randomUUID();
      const failingState = bearer();
      const failingToken = bearer();
      await accountIdentity.createChallenge({
        challengeId: failingChallengeId,
        email: "atomic-failure@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state: failingState,
        token: failingToken,
      });
      await expectAccountError(
        () =>
          accountIdentity.consumeChallenge({
            anonymousMerge: {
              anonymousSessionToken: firstAnonymous.token,
              idempotencyKey: bearer(),
            },
            challengeId: failingChallengeId,
            sessionToken: bearer(),
            state: failingState,
            token: failingToken,
          }),
        "ACCOUNT_MERGE_CONFLICT",
      );
      const atomicFailure = await migrator.query<{
        consumedAt: Date | null;
        identities: number;
        sessions: number;
        users: number;
      }>(
        `
          SELECT consumed_at AS "consumedAt",
                 (SELECT count(*)::int FROM app_user) AS users,
                 (SELECT count(*)::int FROM auth_identity) AS identities,
                 (SELECT count(*)::int FROM account_session) AS sessions
            FROM auth_challenge
           WHERE id = $1::uuid
        `,
        [failingChallengeId],
      );
      assert.deepEqual(atomicFailure.rows[0], {
        consumedAt: null,
        ...countsBeforeAtomicFailure.rows[0],
      });

      const audit = await migrator.query<{
        canonicalBytes: number;
        idempotencyBytes: number;
        links: number;
        sourceAccountSessionId: string;
        sourceSessionId: string;
        subjectId: string;
        userId: string;
      }>(
        `
          SELECT count(*) OVER ()::int AS links, user_id::text AS "userId",
                 anonymous_subject_id::text AS "subjectId",
                 source_session_id::text AS "sourceSessionId",
                 source_account_session_id::text AS "sourceAccountSessionId",
                 octet_length(idempotency_key_hash) AS "idempotencyBytes",
                 octet_length(canonical_request_hash) AS "canonicalBytes"
            FROM account_subject_link
           WHERE anonymous_subject_id = $1::uuid
        `,
        [firstAnonymous.context.subjectId],
      );
      assert.deepEqual(audit.rows[0], {
        canonicalBytes: 32,
        idempotencyBytes: 32,
        links: 1,
        sourceAccountSessionId: firstAccount.sessionId,
        sourceSessionId: firstAnonymous.context.sessionId,
        subjectId: firstAnonymous.context.subjectId,
        userId: firstAccount.userId,
      });
      assert.equal(JSON.stringify(audit.rows[0]).includes(firstMergeKey), false);
      await expectPostgresError(
        () =>
          runtimeSql.query(
            "UPDATE account_subject_link SET created_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
            [historyId],
          ),
        "42501",
      );
      await expectPostgresError(
        () =>
          runtimeSql.query(
            "DELETE FROM account_subject_link WHERE anonymous_subject_id = $1::uuid",
            [firstAnonymous.context.subjectId],
          ),
        "42501",
      );
    } finally {
      await Promise.all([runtime.$disconnect(), migrator.end(), runtimeSql.end()]);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (primaryError === undefined && cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Account merge persistence cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified atomic anonymous merge, session rotation, one-link concurrency, cross-account denial, history preservation, rollback, hash-only audit evidence, and append-only runtime privileges.\n",
);
