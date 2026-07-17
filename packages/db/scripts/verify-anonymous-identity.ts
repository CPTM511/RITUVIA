import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  AnonymousIdentityPersistenceError,
  assertAnonymousIdentityRuntimeDatabasePrivileges,
  createAnonymousIdentityService,
} from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const policy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.anonymous-session.v1",
  ttlSeconds: 86_400,
});

const idempotencyKey = (): string => randomBytes(24).toString("base64url");

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
  constraint?: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal((error as { code?: unknown }).code, code);
    if (constraint !== undefined) {
      assert.equal((error as { constraint?: unknown }).constraint, constraint);
    }
  }
};

const readIdentityProjection = async (connectionString: string) => {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const subjects = await client.query(`
        SELECT id::text AS id, expiry_policy_version AS "expiryPolicyVersion",
               created_at AS "createdAt", expires_at AS "expiresAt", last_seen_at AS "lastSeenAt"
          FROM anonymous_subject ORDER BY id
      `);
    const sessions = await client.query(`
        SELECT id::text AS id, anonymous_subject_id::text AS "anonymousSubjectId",
               encode(token_hash, 'hex') AS "tokenHash",
               token_hash_version AS "tokenHashVersion",
               encode(issuance_key_hash, 'hex') AS "issuanceKeyHash",
               encode(canonical_request_hash, 'hex') AS "canonicalRequestHash",
               expiry_policy_version AS "expiryPolicyVersion", created_at AS "createdAt",
               expires_at AS "expiresAt", last_seen_at AS "lastSeenAt",
               revoked_at AS "revokedAt"
          FROM anonymous_session ORDER BY id
      `);
    const consents = await client.query(`
        SELECT id::text AS id, anonymous_subject_id::text AS "anonymousSubjectId", purpose,
               sequence, notice_version AS "noticeVersion", locale, decision, source,
               recorded_at AS "recordedAt", withdraws_record_id::text AS "withdrawsRecordId",
               encode(idempotency_key_hash, 'hex') AS "idempotencyKeyHash",
               encode(canonical_request_hash, 'hex') AS "canonicalRequestHash"
          FROM consent_record ORDER BY anonymous_subject_id, purpose, sequence
      `);
    const issuanceGate = await client.query(`
        SELECT id, window_started_at AS "windowStartedAt", issued_count AS "issuedCount"
          FROM anonymous_session_issuance_gate ORDER BY id
      `);
    return {
      consents: consents.rows,
      issuanceGate: issuanceGate.rows,
      sessions: sessions.rows,
      subjects: subjects.rows,
    };
  } finally {
    await client.end();
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
    const control = new Client({ connectionString: database.controlDatabaseUrl });
    await Promise.all([migrator.connect(), control.connect()]);
    try {
      await assertAnonymousIdentityRuntimeDatabasePrivileges(runtime);
      const identity = createAnonymousIdentityService(runtime, policy);
      const firstKey = idempotencyKey();
      const first = await identity.ensureSession({ idempotencyKey: firstKey });
      assert.equal(first.kind, "created");
      assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
      assert.match(first.context.subjectId, /^[0-9a-f-]{36}$/);
      assert.match(first.context.sessionId, /^[0-9a-f-]{36}$/);

      const persisted = await migrator.query<{
        canonicalRequestBytes: number;
        consents: number;
        expiryPolicyVersion: string;
        issuanceKeyBytes: number;
        sessions: number;
        subjects: number;
        tokenHashHex: string;
        tokenHashVersion: number;
      }>(
        `
        SELECT (SELECT count(*)::int FROM anonymous_subject) AS subjects,
               (SELECT count(*)::int FROM anonymous_session) AS sessions,
               (SELECT count(*)::int FROM consent_record) AS consents,
               encode(token_hash, 'hex') AS "tokenHashHex",
               token_hash_version AS "tokenHashVersion",
               octet_length(issuance_key_hash) AS "issuanceKeyBytes",
               octet_length(canonical_request_hash) AS "canonicalRequestBytes",
               expiry_policy_version AS "expiryPolicyVersion"
          FROM anonymous_session
         WHERE id = $1::uuid
      `,
        [first.context.sessionId],
      );
      assert.deepEqual(persisted.rows[0], {
        canonicalRequestBytes: 32,
        consents: 0,
        expiryPolicyVersion: policy.policyVersion,
        issuanceKeyBytes: 32,
        sessions: 1,
        subjects: 1,
        tokenHashHex: createHash("sha256")
          .update(Buffer.from(first.token, "base64url"))
          .digest("hex"),
        tokenHashVersion: 1,
      });
      assert.equal(JSON.stringify(persisted.rows[0]).includes(first.token), false);

      const resumed = await identity.ensureSession({
        idempotencyKey: idempotencyKey(),
        token: first.token,
      });
      assert.equal(resumed.kind, "resumed");
      assert.deepEqual(resumed.context, first.context);
      await assert.rejects(
        identity.ensureSession({ idempotencyKey: firstKey }),
        (error: unknown) =>
          error instanceof AnonymousIdentityPersistenceError &&
          error.code === "ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE",
      );

      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.analytics-notice.v1",
          purpose: "optional_product_analytics",
          token: first.token,
        }),
        false,
      );
      const grantKey = idempotencyKey();
      const grant = await identity.recordConsent({
        decision: "granted",
        idempotencyKey: grantKey,
        locale: "en",
        noticeVersion: "test.analytics-notice.v1",
        purpose: "optional_product_analytics",
        source: "first_party_consent_surface",
        token: first.token,
      });
      assert.equal(grant.sequence, 1);
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.analytics-notice.v1",
          purpose: "optional_product_analytics",
          token: first.token,
        }),
        true,
      );
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.analytics-notice.v2",
          purpose: "optional_product_analytics",
          token: first.token,
        }),
        false,
      );
      assert.deepEqual(
        await identity.recordConsent({
          decision: "granted",
          idempotencyKey: grantKey,
          locale: "en",
          noticeVersion: "test.analytics-notice.v1",
          purpose: "optional_product_analytics",
          source: "first_party_consent_surface",
          token: first.token,
        }),
        grant,
      );
      await assert.rejects(
        identity.recordConsent({
          decision: "denied",
          idempotencyKey: grantKey,
          locale: "en",
          noticeVersion: "test.analytics-notice.v1",
          purpose: "optional_product_analytics",
          source: "privacy_controls",
          token: first.token,
        }),
        (error: unknown) =>
          error instanceof AnonymousIdentityPersistenceError &&
          error.code === "CONSENT_STATE_CONFLICT",
      );
      const withdrawal = await identity.recordConsent({
        decision: "withdrawn",
        idempotencyKey: idempotencyKey(),
        locale: "en",
        noticeVersion: "test.analytics-notice.v1",
        purpose: "optional_product_analytics",
        source: "privacy_controls",
        token: first.token,
      });
      assert.equal(withdrawal.sequence, 2);
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.analytics-notice.v1",
          purpose: "optional_product_analytics",
          token: first.token,
        }),
        false,
      );

      const malformed = await identity.ensureSession({ idempotencyKey: idempotencyKey() });
      if (malformed.kind !== "created") {
        assert.fail("Malformed-history verification requires a newly created session.");
      }
      await migrator.query(
        `INSERT INTO consent_record
           (anonymous_subject_id, purpose, sequence, notice_version, locale, decision, source,
            recorded_at, idempotency_key_hash, canonical_request_hash)
         VALUES ($1::uuid, 'optional_product_analytics', 999, 'test.analytics-notice.v1',
                 'en', 'granted', 'first_party_consent_surface', CURRENT_TIMESTAMP,
                 decode($2, 'hex'), decode($3, 'hex')),
                ($1::uuid, 'optional_marketing_analytics', 1, 'test.marketing-notice.v1',
                 'en', 'granted', 'first_party_consent_surface',
                 CURRENT_TIMESTAMP + interval '1 hour', decode($4, 'hex'), decode($5, 'hex'))`,
        [
          malformed.context.subjectId,
          randomBytes(32).toString("hex"),
          randomBytes(32).toString("hex"),
          randomBytes(32).toString("hex"),
          randomBytes(32).toString("hex"),
        ],
      );
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.analytics-notice.v1",
          purpose: "optional_product_analytics",
          token: malformed.token,
        }),
        false,
      );
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.marketing-notice.v1",
          purpose: "optional_marketing_analytics",
          token: malformed.token,
        }),
        false,
      );

      const consentCapacity = await identity.ensureSession({ idempotencyKey: idempotencyKey() });
      if (consentCapacity.kind !== "created") {
        assert.fail("Consent-capacity verification requires a newly created session.");
      }
      await migrator.query(
        `INSERT INTO consent_record
           (anonymous_subject_id, purpose, sequence, notice_version, locale, decision, source,
            recorded_at, idempotency_key_hash, canonical_request_hash)
         SELECT $1::uuid, 'optional_product_analytics', sequence,
                'test.capacity-notice.v1', 'en', 'granted',
                'first_party_consent_surface', CURRENT_TIMESTAMP - interval '1 second',
                decode(lpad(to_hex(sequence), 64, '0'), 'hex'),
                decode(repeat('ab', 32), 'hex')
           FROM generate_series(1, 256) AS sequence`,
        [consentCapacity.context.subjectId],
      );
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.capacity-notice.v1",
          purpose: "optional_product_analytics",
          token: consentCapacity.token,
        }),
        true,
      );
      const capacityWithdrawal = await identity.recordConsent({
        decision: "withdrawn",
        idempotencyKey: idempotencyKey(),
        locale: "en",
        noticeVersion: "test.capacity-notice.v1",
        purpose: "optional_product_analytics",
        source: "privacy_controls",
        token: consentCapacity.token,
      });
      assert.equal(capacityWithdrawal.sequence, 257);
      assert.equal(
        await identity.allowsConsent({
          noticeVersion: "test.capacity-notice.v1",
          purpose: "optional_product_analytics",
          token: consentCapacity.token,
        }),
        false,
      );

      const concurrentKey = idempotencyKey();
      const concurrent = await Promise.allSettled(
        Array.from({ length: 8 }, () => identity.ensureSession({ idempotencyKey: concurrentKey })),
      );
      assert.equal(concurrent.filter(({ status }) => status === "fulfilled").length, 1);
      assert.equal(concurrent.filter(({ status }) => status === "rejected").length, 7);
      for (const rejected of concurrent.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      )) {
        assert.ok(rejected.reason instanceof AnonymousIdentityPersistenceError);
        assert.equal(rejected.reason.code, "ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE");
      }

      await expectPostgresError(
        () =>
          migrator.query(
            `INSERT INTO anonymous_subject (expiry_policy_version, expires_at)
             VALUES ('test.anonymous-session.v1', CURRENT_TIMESTAMP)`,
          ),
        "23514",
        "anonymous_subject_expiry_check",
      );
      await expectPostgresError(
        () =>
          migrator.query(
            `INSERT INTO anonymous_session
               (anonymous_subject_id, token_hash, issuance_key_hash, canonical_request_hash,
                expiry_policy_version, expires_at)
             VALUES ($1::uuid, decode('aa', 'hex'), decode($2, 'hex'), decode($3, 'hex'),
                     'test.anonymous-session.v1', CURRENT_TIMESTAMP + interval '1 hour')`,
            [first.context.subjectId, "b".repeat(64), "c".repeat(64)],
          ),
        "23514",
        "anonymous_session_token_hash_check",
      );

      const runtimeClient = new Client({ connectionString: database.databaseUrl });
      await runtimeClient.connect();
      try {
        await expectPostgresError(
          () =>
            runtimeClient.query(
              "UPDATE anonymous_subject SET expires_at = expires_at + interval '1 hour' WHERE id = $1::uuid",
              [first.context.subjectId],
            ),
          "42501",
        );
        await expectPostgresError(
          () => runtimeClient.query("UPDATE consent_record SET decision = 'denied'"),
          "42501",
        );
        await expectPostgresError(() => runtimeClient.query("DELETE FROM consent_record"), "42501");
        await expectPostgresError(() => runtimeClient.query("TRUNCATE anonymous_session"), "42501");
      } finally {
        await runtimeClient.end();
      }
      await expectPostgresError(() => control.query("SELECT * FROM anonymous_subject"), "42501");

      await migrator.query(
        "GRANT UPDATE (token_hash_version) ON TABLE anonymous_session TO rituvia_identity_writer",
      );
      try {
        await assert.rejects(
          assertAnonymousIdentityRuntimeDatabasePrivileges(runtime),
          /runtime database privileges are unsafe/u,
        );
      } finally {
        await migrator.query(
          "REVOKE UPDATE (token_hash_version) ON TABLE anonymous_session FROM rituvia_identity_writer",
        );
      }
      await assertAnonymousIdentityRuntimeDatabasePrivileges(runtime);

      await migrator.query(
        `UPDATE anonymous_session_issuance_gate
            SET window_started_at = CURRENT_TIMESTAMP - interval '2 hours', issued_count = 1
          WHERE id = 1`,
      );
      const limited = createAnonymousIdentityService(runtime, {
        ...policy,
        issuanceLimit: 2,
        issuanceWindowSeconds: 3_600,
      });
      const firstLimited = await limited.ensureSession({ idempotencyKey: idempotencyKey() });
      const secondLimited = await limited.ensureSession({ idempotencyKey: idempotencyKey() });
      if (firstLimited.kind !== "created" || secondLimited.kind !== "created") {
        assert.fail("Capacity verification requires two newly created sessions.");
      }
      await limited.recordConsent({
        decision: "granted",
        idempotencyKey: idempotencyKey(),
        locale: "en",
        noticeVersion: "test.restore-notice.v1",
        purpose: "optional_product_analytics",
        source: "first_party_consent_surface",
        token: firstLimited.token,
      });
      await assert.rejects(
        limited.ensureSession({ idempotencyKey: idempotencyKey() }),
        (error: unknown) =>
          error instanceof AnonymousIdentityPersistenceError &&
          error.code === "ANONYMOUS_SESSION_RATE_LIMITED" &&
          typeof error.retryAfterSeconds === "number" &&
          error.retryAfterSeconds > 0,
      );

      assert.equal(await identity.revokeSession(first.token), true);
      assert.equal(await identity.revokeSession(first.token), false);
      assert.equal(await identity.resolveSession(first.token), null);

      const expiredToken = randomBytes(32).toString("base64url");
      const expiredSubjectId = randomUUID();
      await migrator.query(
        `INSERT INTO anonymous_subject
           (id, expiry_policy_version, created_at, expires_at, last_seen_at)
         VALUES ($1::uuid, 'test.anonymous-session.v1',
                 CURRENT_TIMESTAMP - interval '2 hours',
                 CURRENT_TIMESTAMP - interval '1 hour',
                 CURRENT_TIMESTAMP - interval '2 hours')`,
        [expiredSubjectId],
      );
      await migrator.query(
        `INSERT INTO anonymous_session
           (anonymous_subject_id, token_hash, issuance_key_hash, canonical_request_hash,
            expiry_policy_version, created_at, expires_at, last_seen_at)
         VALUES ($1::uuid, decode($2, 'hex'), decode($3, 'hex'), decode($4, 'hex'),
                 'test.anonymous-session.v1', CURRENT_TIMESTAMP - interval '2 hours',
                 CURRENT_TIMESTAMP - interval '1 hour', CURRENT_TIMESTAMP - interval '2 hours')`,
        [
          expiredSubjectId,
          createHash("sha256").update(Buffer.from(expiredToken, "base64url")).digest("hex"),
          randomBytes(32).toString("hex"),
          randomBytes(32).toString("hex"),
        ],
      );
      assert.equal(await identity.resolveSession(expiredToken), null);

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredRuntime = createDatabaseClient(restored.databaseUrl);
      try {
        await assertAnonymousIdentityRuntimeDatabasePrivileges(restoredRuntime);
        const [sourceProjection, restoredProjection] = await Promise.all([
          readIdentityProjection(database.migrationDatabaseUrl),
          readIdentityProjection(restored.migrationDatabaseUrl),
        ]);
        assert.deepEqual(restoredProjection, sourceProjection);

        const restoredIdentity = createAnonymousIdentityService(restoredRuntime, policy);
        assert.deepEqual(
          await restoredIdentity.resolveSession(firstLimited.token),
          firstLimited.context,
        );
        assert.equal(
          await restoredIdentity.allowsConsent({
            noticeVersion: "test.restore-notice.v1",
            purpose: "optional_product_analytics",
            token: firstLimited.token,
          }),
          true,
        );
        assert.equal(await restoredIdentity.resolveSession(first.token), null);
        assert.equal(
          await restoredIdentity.allowsConsent({
            noticeVersion: "test.analytics-notice.v1",
            purpose: "optional_product_analytics",
            token: malformed.token,
          }),
          false,
        );

        const restoredRuntimeClient = new Client({ connectionString: restored.databaseUrl });
        await restoredRuntimeClient.connect();
        try {
          await expectPostgresError(
            () => restoredRuntimeClient.query("UPDATE consent_record SET decision = 'denied'"),
            "42501",
          );
          await expectPostgresError(
            () =>
              restoredRuntimeClient.query(
                "UPDATE anonymous_session SET token_hash_version = 1 WHERE id = $1::uuid",
                [firstLimited.context.sessionId],
              ),
            "42501",
          );
        } finally {
          await restoredRuntimeClient.end();
        }
      } finally {
        await restoredRuntime.$disconnect();
      }
    } finally {
      await Promise.all([runtime.$disconnect(), migrator.end(), control.end()]);
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
      throw new AggregateError(cleanupErrors, "Anonymous identity verification cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified anonymous session token hashing, expiry/revocation, consent fail-closed history, idempotency races, issuance capacity, least privilege, and logical restore.\n",
);
