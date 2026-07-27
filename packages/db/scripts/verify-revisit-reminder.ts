import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  createReflectionPersistence,
  type PreparedPrivateIntentionV2Write,
  type ReflectionCiphertext,
  type ReflectionIntentionV2PrepareContext,
} from "../src/reflection-persistence.js";
import { createRevisitPersistence, type RevisitCiphertext } from "../src/revisit-persistence.js";
import {
  assertRevisitReminderRuntimeDatabasePrivileges,
  createRevisitReminderService,
  RevisitReminderError,
} from "../src/revisit-reminder.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const anonymousPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.revisit-reminder-session.v1",
  ttlSeconds: 7_776_000,
});
const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "test.revisit-reminder-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});
const reflectionPolicy = Object.freeze({
  policyVersion: "reflection-loop.en.v1" as const,
  retentionSeconds: 2_592_000,
  revisitDelaySeconds: 86_400,
});
const keyVersion = "test.revisit-reminder.v1";

const bearer = (): string => randomBytes(32).toString("base64url");
const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
const ciphertext = (value: string): RevisitCiphertext =>
  Object.freeze({
    ciphertext: createHash("sha256").update(value, "utf8").digest(),
    keyVersion,
    nonce: createHash("sha256").update(`${value}:nonce`, "utf8").digest().subarray(0, 12),
    tag: createHash("sha256").update(`${value}:tag`, "utf8").digest().subarray(0, 16),
  });
const prepareIntention =
  (key: string) =>
  (
    context: ReflectionIntentionV2PrepareContext<{
      intentionText: string;
      smallAction: string;
    }>,
  ): PreparedPrivateIntentionV2Write =>
    Object.freeze({
      canonicalRequestDigest: digest(
        `intention:${context.subjectId}:${context.request.intentionText}:${context.request.smallAction}`,
      ),
      encryptedIntentionText: ciphertext(`intention:${context.resourceId}`) as ReflectionCiphertext,
      encryptedSmallAction: ciphertext(`action:${context.resourceId}`) as ReflectionCiphertext,
      idempotencyKeyDigest: digest(`intention-key:${context.subjectId}:${key}`),
      idempotencyKeyVersion: keyVersion,
    });
const prepareSchedule =
  (key: string) =>
  ({ resourceId, subjectId }: { resourceId: string; subjectId: string }) =>
    Object.freeze({
      canonicalRequestDigest: digest(`schedule:${subjectId}:next_day:UTC`),
      encryptedIntentionText: ciphertext(`snapshot-intention:${resourceId}`),
      encryptedSmallAction: ciphertext(`snapshot-action:${resourceId}`),
      idempotencyKeyDigest: digest(`revisit-key:${subjectId}:${key}`),
    });
const reminderRequest = (action: "subscribe" | "unsubscribe") =>
  Object.freeze({
    action,
    channel: "email" as const,
    frequency: "once" as const,
    noticeVersion: "rituvia.revisit-reminder-notice.v1" as const,
    schemaVersion: "revisit-reminder-preference.v1" as const,
  });

await withLocalPostgresLease(async (lease) => {
  let database: Awaited<ReturnType<typeof lease.createTestDatabase>> | undefined;
  try {
    database = await lease.createTestDatabase();
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const runtime = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      await assertRevisitReminderRuntimeDatabasePrivileges(runtime);
      const anonymousIdentity = createAnonymousIdentityService(runtime, anonymousPolicy);
      const accountIdentity = createAccountIdentityService(runtime, accountPolicy);
      const reflection = createReflectionPersistence(runtime, reflectionPolicy);
      const revisitPersistence = createRevisitPersistence(runtime);
      const reminders = createRevisitReminderService(runtime);

      const anonymous = await anonymousIdentity.ensureSession({ idempotencyKey: bearer() });
      assert.equal(anonymous.kind, "created");
      if (anonymous.kind !== "created") assert.fail("Expected a new anonymous owner.");
      const intention = await reflection.resolveIntentionV2({
        prepare: prepareIntention(bearer()),
        principal: { anonymousSessionToken: anonymous.token },
        request: {
          intentionCode: "calm_clarity",
          intentionText: "Private intention canary.",
          locale: "en",
          privacyState: "private",
          readingId: null,
          reminderPreference: "none",
          revisitDate: null,
          schemaVersion: "reflection-intention.v2",
          smallAction: "Private action canary.",
          timeZone: null,
        },
      });
      const revisitId = randomUUID();
      await revisitPersistence.schedule({
        expectedIntentionRevision: intention.intention.revision,
        prepare: prepareSchedule(bearer()),
        principal: { anonymousSessionToken: anonymous.token },
        request: {
          customDate: null,
          intentionId: intention.intention.id,
          quietHours: null,
          reminderChannel: null,
          reminderPreference: "none",
          scheduleKind: "next_day",
          schemaVersion: "reflection-revisit.v1",
          timeZone: "UTC",
        },
        resourceId: revisitId,
      });

      const createAccountSession = async (email: string, mergeToken?: string) => {
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
          ...(mergeToken === undefined
            ? {}
            : {
                anonymousMerge: {
                  anonymousSessionToken: mergeToken,
                  idempotencyKey: bearer(),
                },
              }),
          challengeId,
          sessionToken,
          state,
          token,
        });
        return Object.freeze({ ...completed.context, sessionToken });
      };
      const owner = await createAccountSession("reminder-owner@example.test", anonymous.token);
      const other = await createAccountSession("reminder-other@example.test");

      assert.equal(await reminders.get({ revisitId, sessionToken: owner.sessionToken }), null);
      await assert.rejects(
        reminders.get({ revisitId, sessionToken: other.sessionToken }),
        (error: unknown) =>
          error instanceof RevisitReminderError && error.code === "REVISIT_REMINDER_NOT_FOUND",
      );

      const subscribeKey = bearer();
      const subscribed = await reminders.mutate({
        idempotencyKey: subscribeKey,
        request: reminderRequest("subscribe"),
        revisitId,
        sessionToken: owner.sessionToken,
      });
      assert.equal(subscribed.preferenceState, "subscribed");
      assert.equal(subscribed.deliveryState, "pending");
      assert.deepEqual(
        await reminders.mutate({
          idempotencyKey: subscribeKey,
          request: reminderRequest("subscribe"),
          revisitId,
          sessionToken: owner.sessionToken,
        }),
        subscribed,
      );
      await assert.rejects(
        reminders.mutate({
          idempotencyKey: subscribeKey,
          request: reminderRequest("unsubscribe"),
          revisitId,
          sessionToken: owner.sessionToken,
        }),
        (error: unknown) =>
          error instanceof RevisitReminderError && error.code === "REVISIT_REMINDER_CONFLICT",
      );
      assert.equal((await reminders.list(owner.sessionToken)).length, 1);
      assert.equal((await reminders.list(other.sessionToken)).length, 0);

      await migrator.query(
        `UPDATE revisit
            SET scheduled_local_date = CURRENT_DATE - 1,
                quiet_hours_start = TIME '00:00',
                quiet_hours_end = TIME '23:59',
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::uuid`,
        [revisitId],
      );
      assert.equal(await reminders.claimDue({ leaseSeconds: 60 }), null);
      await migrator.query(
        `UPDATE revisit
            SET quiet_hours_start = NULL, quiet_hours_end = NULL,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::uuid`,
        [revisitId],
      );
      await migrator.query(`UPDATE app_user SET locale = 'fr' WHERE id = $1::uuid`, [owner.userId]);
      assert.equal(await reminders.claimDue({ leaseSeconds: 60 }), null);
      await migrator.query(`UPDATE app_user SET locale = 'en' WHERE id = $1::uuid`, [owner.userId]);

      const claims = await Promise.all([
        reminders.claimDue({ leaseSeconds: 60 }),
        reminders.claimDue({ leaseSeconds: 60 }),
      ]);
      const firstJob = claims.find((job) => job !== null);
      assert.ok(firstJob);
      assert.equal(claims.filter((job) => job !== null).length, 1);
      assert.equal(
        (await reminders.get({ revisitId, sessionToken: owner.sessionToken }))?.deliveryState,
        "pending",
      );
      assert.equal(
        await reminders.authorizeDelivery({
          leaseToken: firstJob.leaseToken,
          subscriptionId: firstJob.subscriptionId,
        }),
        true,
      );
      assert.equal(
        await reminders.completeDelivery({
          leaseToken: bearer(),
          providerMessageReference: "local.invalid",
          subscriptionId: firstJob.subscriptionId,
        }),
        false,
      );
      assert.equal(
        await reminders.failDelivery({
          failureCode: "provider_unavailable",
          leaseToken: firstJob.leaseToken,
          retryable: true,
          subscriptionId: firstJob.subscriptionId,
        }),
        "retry_wait",
      );

      await reminders.mutate({
        idempotencyKey: bearer(),
        request: reminderRequest("unsubscribe"),
        revisitId,
        sessionToken: owner.sessionToken,
      });
      assert.deepEqual(
        await reminders.mutate({
          idempotencyKey: subscribeKey,
          request: reminderRequest("subscribe"),
          revisitId,
          sessionToken: owner.sessionToken,
        }),
        subscribed,
      );
      assert.equal(await reminders.claimDue({ leaseSeconds: 60 }), null);

      await reminders.mutate({
        idempotencyKey: bearer(),
        request: reminderRequest("subscribe"),
        revisitId,
        sessionToken: owner.sessionToken,
      });
      const deadLetterJob = await reminders.claimDue({ leaseSeconds: 60 });
      assert.ok(deadLetterJob);
      assert.equal(
        await reminders.failDelivery({
          failureCode: "provider_rejected",
          leaseToken: deadLetterJob.leaseToken,
          retryable: false,
          subscriptionId: deadLetterJob.subscriptionId,
        }),
        "dead_lettered",
      );
      await reminders.mutate({
        idempotencyKey: bearer(),
        request: reminderRequest("subscribe"),
        revisitId,
        sessionToken: owner.sessionToken,
      });
      const deliveryJob = await reminders.claimDue({ leaseSeconds: 60 });
      assert.ok(deliveryJob);
      assert.equal(
        await reminders.completeDelivery({
          leaseToken: deliveryJob.leaseToken,
          providerMessageReference: "local.message.1",
          subscriptionId: deliveryJob.subscriptionId,
        }),
        true,
      );
      assert.equal(await reminders.claimDue({ leaseSeconds: 60 }), null);
      assert.equal(
        (await reminders.get({ revisitId, sessionToken: owner.sessionToken }))?.deliveryState,
        "delivered",
      );
      await assert.rejects(
        reminders.mutate({
          idempotencyKey: bearer(),
          request: reminderRequest("subscribe"),
          revisitId,
          sessionToken: owner.sessionToken,
        }),
        (error: unknown) =>
          error instanceof RevisitReminderError && error.code === "REVISIT_REMINDER_CONFLICT",
      );
      await assert.rejects(
        reminders.mutate({
          idempotencyKey: bearer(),
          request: reminderRequest("unsubscribe"),
          revisitId,
          sessionToken: owner.sessionToken,
        }),
        (error: unknown) =>
          error instanceof RevisitReminderError && error.code === "REVISIT_REMINDER_CONFLICT",
      );

      const privateLeak = await migrator.query<{ leaked: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM revisit_reminder_subscription
            WHERE row_to_json(revisit_reminder_subscription)::text
              ~* 'Private intention canary|Private action canary|reminder-owner@example'
         ) AS leaked`,
      );
      assert.equal(privateLeak.rows[0]?.leaked, false);
      const operationCount = await migrator.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM revisit_reminder_operation`,
      );
      assert.equal(operationCount.rows[0]?.count, 4);

      await assert.rejects(
        runtime.$executeRaw`UPDATE revisit_reminder_operation SET action = 'subscribe'`,
      );
      await assert.rejects(runtime.$executeRaw`DELETE FROM revisit_reminder_subscription`);
    } finally {
      await Promise.all([runtime.$disconnect(), migrator.end()]);
    }
  } finally {
    if (database !== undefined) await database.drop();
    await stopLeaseOwnedRuntime(lease);
  }
});

process.stdout.write(
  "Verified account-owned one-time Revisit reminder opt-in, replay, owner isolation, quiet-hours suppression, concurrent claim, bounded failure, immediate unsubscribe, once-only delivery, privacy minimization, and runtime privileges.\n",
);
