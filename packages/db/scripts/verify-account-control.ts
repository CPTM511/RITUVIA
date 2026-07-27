import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  AccountIdentityError,
  createAccountIdentityService,
  type AccountHistorySourceType,
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
  policyVersion: "test.account-control-anonymous.v1",
  ttlSeconds: 86_400,
});
const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "test.account-control-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});

const bearer = (): string => randomBytes(32).toString("base64url");
const digest = (): Buffer => randomBytes(32);

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const runtime = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      const anonymousIdentity = createAnonymousIdentityService(runtime, anonymousPolicy);
      const accountIdentity = createAccountIdentityService(runtime, accountPolicy);
      const createAccountSession = async (email: string) => {
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
        return Object.freeze({ ...completed.context, sessionToken });
      };
      const createAnonymousSession = async () => {
        const result = await anonymousIdentity.ensureSession({ idempotencyKey: bearer() });
        if (result.kind !== "created") assert.fail("Expected a new anonymous session.");
        return result;
      };

      const ownerAnonymous = await createAnonymousSession();
      const otherAnonymous = await createAnonymousSession();
      const ownerReadingId = randomUUID();
      const ownerIntentionId = randomUUID();
      const ownerRitualId = randomUUID();
      const ownerJournalId = randomUUID();
      const ownerRevisitId = randomUUID();
      const deletedJournalId = randomUUID();
      const expiredReadingId = randomUUID();
      const otherReadingId = randomUUID();
      const base = Date.now() - 60_000;
      const occurredAt = (offset: number) => new Date(base + offset * 1_000);
      const activeExpiry = new Date(Date.now() + 86_400_000);
      const privateCanary = Buffer.from("private-account-history-canary", "utf8");

      const insertReading = async (
        id: string,
        subjectId: string,
        createdAt: Date,
        expiresAt: Date,
      ) =>
        migrator.query(
          `
            INSERT INTO reading (
              id, anonymous_subject_id, reading_type, theme_code, request_schema_version,
              reading_policy_version, catalog_id, catalog_version, catalog_checksum_sha256,
              catalog_approval_reference, idempotency_key_version, idempotency_key_hash,
              client_request_hash, created_at, completed_at, expires_at
            ) VALUES (
              $1::uuid, $2::uuid, 'one_card', 'self', 'tarot-reading-create.v1',
              'account-control.v1', 'account-control', '1.0.0', $3,
              'RIT-052:account-control', 'account-control.v1', $4, $5, $6, $6, $7
            )
          `,
          [id, subjectId, digest(), digest(), digest(), createdAt, expiresAt],
        );

      await insertReading(
        ownerReadingId,
        ownerAnonymous.context.subjectId,
        occurredAt(5),
        activeExpiry,
      );
      await insertReading(
        otherReadingId,
        otherAnonymous.context.subjectId,
        occurredAt(6),
        activeExpiry,
      );
      await insertReading(
        expiredReadingId,
        ownerAnonymous.context.subjectId,
        new Date(Date.now() - 259_200_000),
        new Date(Date.now() - 172_800_000),
      );
      await migrator.query(
        `
          INSERT INTO intention (
            id, anonymous_subject_id, reading_id, intention_code,
            small_action_ciphertext, small_action_nonce, small_action_tag,
            encryption_key_version, schema_version, policy_version,
            idempotency_key_hash, canonical_request_hash, created_at, updated_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, 'calm_clarity',
            $4, decode(repeat('02', 12), 'hex'), decode(repeat('03', 16), 'hex'),
            'account-control.v1', 'reflection-intention.v1', 'reflection-loop.en.v1',
            $5, $6, $7, $7, $8
          )
        `,
        [
          ownerIntentionId,
          ownerAnonymous.context.subjectId,
          ownerReadingId,
          privateCanary,
          digest(),
          digest(),
          occurredAt(4),
          activeExpiry,
        ],
      );
      await migrator.query(
        `
          INSERT INTO ritual_session (
            id, anonymous_subject_id, intention_id, object_code, ritual_date_utc,
            schema_version, policy_version, idempotency_key_hash, canonical_request_hash,
            started_at, completed_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, 'candle', CURRENT_DATE,
            'reflection-ritual.v1', 'reflection-loop.en.v1', $4, $5, $6, $6, $7
          )
        `,
        [
          ownerRitualId,
          ownerAnonymous.context.subjectId,
          ownerIntentionId,
          digest(),
          digest(),
          occurredAt(3),
          activeExpiry,
        ],
      );
      await migrator.query(
        `
          INSERT INTO journal_entry (
            id, anonymous_subject_id, intention_id, ritual_session_id,
            reflection_ciphertext, reflection_nonce, reflection_tag,
            encryption_key_version, schema_version, policy_version,
            idempotency_key_hash, canonical_request_hash, created_at, updated_at,
            expires_at, deleted_at
          ) VALUES
            (
              $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
              decode(repeat('12', 12), 'hex'), decode(repeat('13', 16), 'hex'),
              'account-control.v1', 'reflection-journal.v1', 'reflection-loop.en.v1',
              $6, $7, $8, $8, $9, NULL
            ),
            (
              $10::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
              decode(repeat('22', 12), 'hex'), decode(repeat('23', 16), 'hex'),
              'account-control.v1', 'reflection-journal.v1', 'reflection-loop.en.v1',
              $11, $12, $13, $13, $9, $14
            )
        `,
        [
          ownerJournalId,
          ownerAnonymous.context.subjectId,
          ownerIntentionId,
          ownerRitualId,
          privateCanary,
          digest(),
          digest(),
          occurredAt(2),
          activeExpiry,
          deletedJournalId,
          digest(),
          digest(),
          occurredAt(1),
          occurredAt(1),
        ],
      );
      await migrator.query(
        `
          INSERT INTO revisit (
            id, anonymous_subject_id, intention_id, schema_version, policy_version,
            intention_revision, intention_text_ciphertext, intention_text_nonce,
            intention_text_tag, small_action_ciphertext, small_action_nonce, small_action_tag,
            snapshot_key_version, schedule_kind, scheduled_local_date, time_zone,
            reminder_preference, status, revision, created_at, updated_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, 'reflection-revisit.v1',
            'reflection-loop.en.v1', 1, $4, decode(repeat('32', 12), 'hex'),
            decode(repeat('33', 16), 'hex'), $4, decode(repeat('42', 12), 'hex'),
            decode(repeat('43', 16), 'hex'), 'account-control.v1', 'seven_days',
            CURRENT_DATE + 7, 'UTC', 'none', 'scheduled', 1, $5, $5, $6
          )
        `,
        [
          ownerRevisitId,
          ownerAnonymous.context.subjectId,
          ownerIntentionId,
          privateCanary,
          occurredAt(1),
          activeExpiry,
        ],
      );

      const ownerInitial = await createAccountSession("owner-account-control@example.test");
      const ownerMerge = await accountIdentity.mergeAnonymousSubject({
        accountSessionToken: ownerInitial.sessionToken,
        anonymousSessionToken: ownerAnonymous.token,
        idempotencyKey: bearer(),
      });
      const ownerToken = ownerMerge.sessionToken;
      const otherInitial = await createAccountSession("other-account-control@example.test");
      const otherMerge = await accountIdentity.mergeAnonymousSubject({
        accountSessionToken: otherInitial.sessionToken,
        anonymousSessionToken: otherAnonymous.token,
        idempotencyKey: bearer(),
      });
      const otherToken = otherMerge.sessionToken;

      const collected = [];
      let cursor:
        | Readonly<{
            occurredAt: string;
            resourceId: string;
            sourceType: AccountHistorySourceType;
          }>
        | undefined;
      do {
        const page = await accountIdentity.listHistory({
          cursor,
          limit: 2,
          sessionToken: ownerToken,
        });
        collected.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
      assert.deepEqual(collected.map(({ resourceType }) => resourceType).sort(), [
        "intention",
        "journal",
        "reading",
        "revisit",
        "ritual",
      ]);
      assert.equal(new Set(collected.map(({ resourceId }) => resourceId)).size, 5);
      assert.equal(
        collected.some(({ resourceId }) => resourceId === otherReadingId),
        false,
      );
      assert.equal(
        collected.some(({ resourceId }) => resourceId === expiredReadingId),
        false,
      );
      assert.equal(
        collected.some(({ resourceId }) => resourceId === deletedJournalId),
        false,
      );
      assert.equal(JSON.stringify(collected).includes(privateCanary.toString("utf8")), false);
      const otherHistory = await accountIdentity.listHistory({
        limit: 10,
        sessionToken: otherToken,
      });
      assert.deepEqual(
        otherHistory.items.map(({ resourceId }) => resourceId),
        [otherReadingId],
      );

      const staleProfile = await accountIdentity.getProfile(ownerToken);
      const updatedProfile = await accountIdentity.updateProfile({
        request: {
          displayName: "Quiet Lantern",
          locale: "en",
          profileVersion: staleProfile.profileVersion,
          schemaVersion: 1,
          timeZone: "Asia/Shanghai",
        },
        sessionToken: ownerToken,
      });
      assert.equal(updatedProfile.displayName, "Quiet Lantern");
      assert.equal(updatedProfile.timeZone, "Asia/Shanghai");
      await assert.rejects(
        () =>
          accountIdentity.updateProfile({
            request: {
              displayName: "Stale update",
              locale: "en",
              profileVersion: staleProfile.profileVersion,
              schemaVersion: 1,
              timeZone: "UTC",
            },
            sessionToken: ownerToken,
          }),
        (error: unknown) =>
          error instanceof AccountIdentityError && error.code === "ACCOUNT_PROFILE_CONFLICT",
      );

      const ownerSecond = await createAccountSession("owner-account-control@example.test");
      const ownerSessions = await accountIdentity.listSessions(ownerToken);
      assert.equal(ownerSessions.length, 2);
      const current = ownerSessions.find(({ current }) => current);
      const other = ownerSessions.find(({ current }) => !current);
      assert.equal(current?.id, ownerMerge.context.sessionId);
      assert.equal(other?.id, ownerSecond.sessionId);
      assert.equal(
        await accountIdentity.revokeSession({
          sessionId: ownerMerge.context.sessionId,
          token: ownerToken,
        }),
        false,
      );
      assert.equal(
        await accountIdentity.revokeSession({
          sessionId: ownerSecond.sessionId,
          token: otherToken,
        }),
        false,
      );
      assert.ok(await accountIdentity.resolveSession(ownerSecond.sessionToken));
      assert.equal(
        await accountIdentity.revokeSession({
          sessionId: ownerSecond.sessionId,
          token: ownerToken,
        }),
        true,
      );
      assert.equal(await accountIdentity.resolveSession(ownerSecond.sessionToken), null);
      assert.equal(await accountIdentity.revokeAllSessions(ownerToken), true);
      assert.equal(await accountIdentity.resolveSession(ownerToken), null);
      assert.ok(await accountIdentity.resolveSession(otherToken));
    } finally {
      await Promise.allSettled([runtime.$disconnect(), migrator.end()]);
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
      throw new AggregateError(cleanupErrors, "Account control persistence cleanup failed.");
    }
  }
});

console.log(
  "Verified private account history pagination, owner isolation, profile conflicts, and durable session controls.",
);
