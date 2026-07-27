import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  createReflectionPersistence,
  type PreparedPrivateIntentionV2Write,
  type ReflectionCiphertext,
  type ReflectionIntentionV2PrepareContext,
} from "../src/reflection-persistence.js";
import {
  assertRevisitRuntimeDatabasePrivileges,
  createRevisitPersistence,
  RevisitPersistenceError,
  type RevisitCiphertext,
} from "../src/revisit-persistence.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const identityPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.revisit-session.v1",
  ttlSeconds: 7_776_000,
});
const reflectionPolicy = Object.freeze({
  policyVersion: "reflection-loop.en.v1" as const,
  retentionSeconds: 2_592_000,
  revisitDelaySeconds: 86_400,
});
const keyVersion = "test.revisit.v1";

const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

const ciphertext = (value: string): RevisitCiphertext =>
  Object.freeze({
    ciphertext: createHash("sha256").update(value, "utf8").digest(),
    keyVersion,
    nonce: createHash("sha256").update(`${value}:nonce`, "utf8").digest().subarray(0, 12),
    tag: createHash("sha256").update(`${value}:tag`, "utf8").digest().subarray(0, 16),
  });

const intentionCiphertext = (value: string): ReflectionCiphertext => ciphertext(value);

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
      encryptedIntentionText: intentionCiphertext(
        `intention:${context.resourceId}:${context.request.intentionText}`,
      ),
      encryptedSmallAction: intentionCiphertext(
        `action:${context.resourceId}:${context.request.smallAction}`,
      ),
      idempotencyKeyDigest: digest(`intention-key:${context.subjectId}:${key}`),
      idempotencyKeyVersion: keyVersion,
    });

const prepareSchedule =
  (key: string) =>
  ({ resourceId, subjectId }: { resourceId: string; subjectId: string }) =>
    Object.freeze({
      canonicalRequestDigest: digest(`schedule:${subjectId}:seven_days:UTC`),
      encryptedIntentionText: ciphertext(`snapshot-intention:${resourceId}`),
      encryptedSmallAction: ciphertext(`snapshot-action:${resourceId}`),
      idempotencyKeyDigest: digest(`revisit-key:${subjectId}:${key}`),
    });

const prepareMutation =
  (key: string, canonical: string, completion?: string) =>
  ({ resourceId, subjectId }: { resourceId: string; subjectId: string }) =>
    Object.freeze({
      canonicalRequestDigest: digest(`mutation:${subjectId}:${resourceId}:${canonical}`),
      ...(completion === undefined
        ? {}
        : { encryptedCompletion: ciphertext(`completion:${resourceId}:${completion}`) }),
      idempotencyKeyDigest: digest(`revisit-key:${subjectId}:${key}`),
    });

const expectRevisitError = async (
  operation: () => Promise<unknown>,
  code: RevisitPersistenceError["code"],
): Promise<void> => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof RevisitPersistenceError);
    assert.equal(error.code, code);
    return true;
  });
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
      await assertRevisitRuntimeDatabasePrivileges(runtime);
      const identity = createAnonymousIdentityService(runtime, identityPolicy);
      const owner = await identity.ensureSession({
        idempotencyKey: randomBytes(24).toString("base64url"),
      });
      const other = await identity.ensureSession({
        idempotencyKey: randomBytes(24).toString("base64url"),
      });
      assert.equal(owner.kind, "created");
      assert.equal(other.kind, "created");
      if (owner.kind !== "created" || other.kind !== "created") {
        assert.fail("Expected distinct Revisit owners.");
      }

      const reflection = createReflectionPersistence(runtime, reflectionPolicy);
      const intention = await reflection.resolveIntentionV2({
        prepare: prepareIntention(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          intentionCode: "calm_clarity",
          intentionText: "I intend to pause before I respond.",
          locale: "en",
          privacyState: "private",
          readingId: null,
          reminderPreference: "none",
          revisitDate: null,
          schemaVersion: "reflection-intention.v2",
          smallAction: "Take three slow breaths.",
          timeZone: null,
        },
      });

      const persistence = createRevisitPersistence(runtime);
      const resourceId = randomUUID();
      const scheduleKey = randomBytes(24).toString("base64url");
      const scheduleRequest = Object.freeze({
        customDate: null,
        intentionId: intention.intention.id,
        quietHours: { endLocalTime: "08:00", startLocalTime: "22:00" },
        reminderChannel: null,
        reminderPreference: "none" as const,
        scheduleKind: "seven_days" as const,
        schemaVersion: "reflection-revisit.v1" as const,
        timeZone: "UTC",
      });
      const scheduleInput = Object.freeze({
        expectedIntentionRevision: intention.intention.revision,
        prepare: prepareSchedule(scheduleKey),
        principal: { anonymousSessionToken: owner.token },
        request: scheduleRequest,
        resourceId,
      });
      const scheduleRace = await Promise.all(
        Array.from({ length: 6 }, () => persistence.schedule(scheduleInput)),
      );
      assert.equal(scheduleRace.filter(({ kind }) => kind === "created").length, 1);
      assert.equal(scheduleRace.filter(({ kind }) => kind === "replayed").length, 5);
      assert.ok(scheduleRace.every(({ resource }) => resource.id === resourceId));
      assert.equal(scheduleRace[0]?.resource.isDue, false);
      assert.deepEqual(scheduleRace[0]?.resource.quietHours, {
        endLocalTime: "08:00",
        startLocalTime: "22:00",
      });
      assert.equal(
        await persistence.get({
          id: resourceId,
          principal: { anonymousSessionToken: other.token },
        }),
        null,
      );
      assert.equal(
        (
          await persistence.list({
            principal: { anonymousSessionToken: other.token },
          })
        ).length,
        0,
      );

      await expectRevisitError(
        () =>
          persistence.schedule({
            ...scheduleInput,
            prepare: prepareSchedule(randomBytes(24).toString("base64url")),
            resourceId: randomUUID(),
          }),
        "REVISIT_CONFLICT",
      );

      const completionRequest = Object.freeze({
        action: "complete" as const,
        expectedRevision: 1,
        outcomeTags: ["action_taken", "partial_progress"] as const,
        reflection: "I took the action and noticed what changed.",
        schemaVersion: "reflection-revisit-mutation.v1" as const,
      });
      const completionKey = randomBytes(24).toString("base64url");
      const completionInput = Object.freeze({
        id: resourceId,
        prepare: prepareMutation(
          completionKey,
          JSON.stringify(completionRequest),
          completionRequest.reflection,
        ),
        principal: { anonymousSessionToken: owner.token },
        request: completionRequest,
      });
      const completed = await persistence.mutate(completionInput);
      assert.equal(completed.kind, "mutated");
      assert.equal(completed.resource?.status, "completed");
      assert.equal(completed.resource?.revision, 2);
      assert.equal(completed.resource?.encryptedCompletion?.keyVersion, keyVersion);
      const completionReplay = await persistence.mutate(completionInput);
      assert.equal(completionReplay.kind, "replayed");
      assert.equal(completionReplay.resource?.revision, 2);
      await expectRevisitError(
        () =>
          persistence.mutate({
            ...completionInput,
            prepare: prepareMutation(
              completionKey,
              JSON.stringify({ ...completionRequest, reflection: "Changed reuse." }),
              "Changed reuse.",
            ),
            request: { ...completionRequest, reflection: "Changed reuse." },
          }),
        "REVISIT_CONFLICT",
      );

      const archived = await persistence.mutate({
        id: resourceId,
        prepare: prepareMutation(randomBytes(24).toString("base64url"), "archive:2"),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "archive",
          expectedRevision: 2,
          schemaVersion: "reflection-revisit-mutation.v1",
        },
      });
      assert.equal(archived.resource?.status, "archived");
      assert.equal(archived.resource?.revision, 3);

      const deleteKey = randomBytes(24).toString("base64url");
      const deleteInput = Object.freeze({
        id: resourceId,
        prepare: prepareMutation(deleteKey, "delete:3"),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "delete" as const,
          expectedRevision: 3,
          schemaVersion: "reflection-revisit-mutation.v1" as const,
        },
      });
      const deleted = await persistence.mutate(deleteInput);
      assert.equal(deleted.resource, null);
      const deleteReplay = await persistence.mutate(deleteInput);
      assert.equal(deleteReplay.kind, "replayed");
      assert.equal(deleteReplay.resource, null);
      assert.equal(
        await persistence.get({
          id: resourceId,
          principal: { anonymousSessionToken: owner.token },
        }),
        null,
      );

      const stored = await migrator.query<{
        completionKeyVersion: string;
        operations: number;
        snapshotKeyVersion: string;
      }>(
        `
          SELECT revisit.snapshot_key_version AS "snapshotKeyVersion",
                 revisit.completion_key_version AS "completionKeyVersion",
                 count(revisit_operation.id)::int AS operations
            FROM revisit
            JOIN revisit_operation ON revisit_operation.revisit_id = revisit.id
           WHERE revisit.id = $1::uuid
           GROUP BY revisit.id
        `,
        [resourceId],
      );
      assert.deepEqual(stored.rows[0], {
        completionKeyVersion: keyVersion,
        operations: 4,
        snapshotKeyVersion: keyVersion,
      });
      await assert.rejects(
        () =>
          migrator.query("UPDATE revisit SET time_zone = 'Mars/Olympus' WHERE id = $1::uuid", [
            resourceId,
          ]),
        (error: unknown) => {
          assert.equal((error as { code?: unknown }).code, "22023");
          return true;
        },
      );

      const parentHidden = await reflection.resolveIntentionV2({
        prepare: prepareIntention(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          intentionCode: "courage_action",
          intentionText: "I intend to make one grounded choice.",
          locale: "en",
          privacyState: "private",
          readingId: null,
          reminderPreference: "none",
          revisitDate: null,
          schemaVersion: "reflection-intention.v2",
          smallAction: "Write down the choice.",
          timeZone: null,
        },
      });
      const hiddenRevisitId = randomUUID();
      await persistence.schedule({
        expectedIntentionRevision: 1,
        prepare: prepareSchedule(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: { ...scheduleRequest, intentionId: parentHidden.intention.id },
        resourceId: hiddenRevisitId,
      });
      await migrator.query(
        "UPDATE intention SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
        [parentHidden.intention.id],
      );
      assert.equal(
        await persistence.get({
          id: hiddenRevisitId,
          principal: { anonymousSessionToken: owner.token },
        }),
        null,
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredRuntime = createDatabaseClient(restored.databaseUrl);
      try {
        await assertRevisitRuntimeDatabasePrivileges(restoredRuntime);
        const rows = await restoredRuntime.$queryRaw<Array<{ operations: number }>>`
          SELECT count(*)::int AS operations FROM revisit_operation
        `;
        assert.equal(rows[0]?.operations, 5);
      } finally {
        await restoredRuntime.$disconnect();
      }
    } finally {
      await Promise.all([runtime.$disconnect(), migrator.end()]);
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
      throw new AggregateError(cleanupErrors, "Revisit persistence cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified private Revisit scheduling, local-calendar and time-zone enforcement, owner isolation, append-only replay, early completion, archive/delete lifecycle, parent-deletion hiding, least privilege, and logical restore.\n",
);
