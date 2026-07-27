import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  assertReflectionRuntimeDatabasePrivileges,
  createReflectionPersistence,
  ReflectionPersistenceError,
  type PreparedPrivateIntentionV2Write,
  type PreparedReflectionCreate,
  type ReflectionCiphertext,
  type ReflectionIntentionV2PrepareContext,
} from "../src/reflection-persistence.js";
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
  policyVersion: "test.intention-session.v1",
  ttlSeconds: 86_400,
});
const reflectionPolicy = Object.freeze({
  policyVersion: "reflection-loop.en.v1" as const,
  retentionSeconds: 604_800,
  revisitDelaySeconds: 86_400,
});
const keyVersion = "test.intention.v1";
const futureRevisitDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../prisma/migrations",
);

const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

const ciphertext = (value: string): ReflectionCiphertext =>
  Object.freeze({
    ciphertext: createHash("sha256").update(value, "utf8").digest(),
    keyVersion,
    nonce: createHash("sha256").update(`${value}:nonce`, "utf8").digest().subarray(0, 12),
    tag: createHash("sha256").update(`${value}:tag`, "utf8").digest().subarray(0, 16),
  });

const prepareCreate =
  (key: string) =>
  (
    context: ReflectionIntentionV2PrepareContext<{
      intentionText: string;
      smallAction: string;
    }>,
  ): PreparedPrivateIntentionV2Write =>
    Object.freeze({
      canonicalRequestDigest: digest(
        `create:${context.subjectId}:${context.request.intentionText}:${context.request.smallAction}`,
      ),
      encryptedIntentionText: ciphertext(
        `text:${context.resourceId}:${context.request.intentionText}`,
      ),
      encryptedSmallAction: ciphertext(
        `action:${context.resourceId}:${context.request.smallAction}`,
      ),
      idempotencyKeyDigest: digest(`key:${context.subjectId}:${key}`),
      idempotencyKeyVersion: keyVersion,
    });

const prepareMutation =
  (key: string) =>
  (
    context: ReflectionIntentionV2PrepareContext<{
      action: string;
      intentionText?: string;
      smallAction?: string;
    }>,
  ): PreparedPrivateIntentionV2Write | PreparedReflectionCreate => {
    const base = Object.freeze({
      canonicalRequestDigest: digest(
        `mutation:${context.subjectId}:${context.resourceId}:${JSON.stringify(context.request)}`,
      ),
      idempotencyKeyDigest: digest(`key:${context.subjectId}:${key}`),
      idempotencyKeyVersion: keyVersion,
    });
    return context.request.action === "edit"
      ? Object.freeze({
          ...base,
          encryptedIntentionText: ciphertext(
            `text:${context.resourceId}:${context.request.intentionText ?? ""}`,
          ),
          encryptedSmallAction: ciphertext(
            `action:${context.resourceId}:${context.request.smallAction ?? ""}`,
          ),
        })
      : base;
  };

const expectPersistenceError = async (
  operation: () => Promise<unknown>,
  code: ReflectionPersistenceError["code"],
): Promise<void> => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof ReflectionPersistenceError);
    assert.equal(error.code, code);
    return true;
  });
};

const expectPostgresConstraint = async (
  operation: () => Promise<unknown>,
  constraint: string,
): Promise<void> => {
  await assert.rejects(operation, (error: unknown) => {
    assert.equal((error as { code?: unknown }).code, "23514");
    assert.equal((error as { constraint?: unknown }).constraint, constraint);
    return true;
  });
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const compatibilityDatabase = await lease.createTestDatabase();
    databases.push(compatibilityDatabase);
    const compatibilityClient = new Client({
      connectionString: compatibilityDatabase.migrationDatabaseUrl,
    });
    await compatibilityClient.connect();
    try {
      const migrationDirectories = readdirSync(migrationsDirectory)
        .filter((entry) => /^[0-9]{12}_[a-z0-9_]+$/u.test(entry))
        .sort();
      const intentionMigrationIndex = migrationDirectories.indexOf(
        "202607240002_intention_domain_v2",
      );
      assert.ok(intentionMigrationIndex > 0);
      for (const migrationDirectory of migrationDirectories.slice(0, intentionMigrationIndex)) {
        await compatibilityClient.query(
          readFileSync(resolve(migrationsDirectory, migrationDirectory, "migration.sql"), "utf8"),
        );
      }
      const legacySubjectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const legacyIntentionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      await compatibilityClient.query(
        `
          INSERT INTO anonymous_subject (
            id, expiry_policy_version, created_at, expires_at, last_seen_at
          ) VALUES ($1::uuid, 'test.intention-session.v1', CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP)
        `,
        [legacySubjectId],
      );
      await compatibilityClient.query(
        `
          INSERT INTO intention (
            id, anonymous_subject_id, reading_id, intention_code,
            small_action_ciphertext, small_action_nonce, small_action_tag,
            encryption_key_version, schema_version, policy_version,
            idempotency_key_hash, canonical_request_hash, created_at, updated_at, expires_at
          ) VALUES (
            $2::uuid, $1::uuid, NULL, 'calm_clarity',
            decode('01', 'hex'), decode(repeat('02', 12), 'hex'), decode(repeat('03', 16), 'hex'),
            'test.intention.v1', 'reflection-intention.v1', 'reflection-loop.en.v1',
            decode(repeat('04', 32), 'hex'), decode(repeat('05', 32), 'hex'),
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days'
          )
        `,
        [legacySubjectId, legacyIntentionId],
      );
      await compatibilityClient.query(
        readFileSync(
          resolve(migrationsDirectory, "202607240002_intention_domain_v2", "migration.sql"),
          "utf8",
        ),
      );
      const legacyRows = await compatibilityClient.query<{
        contractVersion: string;
        intentionTextCiphertext: Buffer | null;
        revision: number;
        smallActionCiphertext: Buffer;
        status: string;
      }>(
        `
          SELECT contract_version AS "contractVersion",
                 intention_text_ciphertext AS "intentionTextCiphertext",
                 revision,
                 small_action_ciphertext AS "smallActionCiphertext",
                 status
            FROM intention
           WHERE id = $1::uuid
        `,
        [legacyIntentionId],
      );
      assert.equal(legacyRows.rows.length, 1);
      assert.equal(legacyRows.rows[0]?.contractVersion, "reflection-intention.v1");
      assert.equal(legacyRows.rows[0]?.intentionTextCiphertext, null);
      assert.equal(legacyRows.rows[0]?.revision, 1);
      assert.equal(legacyRows.rows[0]?.status, "active");
      assert.deepEqual(legacyRows.rows[0]?.smallActionCiphertext, Buffer.from([1]));
    } finally {
      await compatibilityClient.end();
    }

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
      await assertReflectionRuntimeDatabasePrivileges(runtime);
      const identity = createAnonymousIdentityService(runtime, identityPolicy);
      const owner = await identity.ensureSession({
        idempotencyKey: randomBytes(24).toString("base64url"),
      });
      const otherOwner = await identity.ensureSession({
        idempotencyKey: randomBytes(24).toString("base64url"),
      });
      assert.equal(owner.kind, "created");
      assert.equal(otherOwner.kind, "created");
      if (owner.kind !== "created" || otherOwner.kind !== "created") {
        assert.fail("Expected distinct intention owners.");
      }
      const persistence = createReflectionPersistence(runtime, reflectionPolicy);
      const createKey = randomBytes(24).toString("base64url");
      const createRequest = Object.freeze({
        intentionCode: "calm_clarity" as const,
        intentionText: "I intend to pause before I respond.",
        locale: "en" as const,
        privacyState: "private" as const,
        readingId: null,
        reminderPreference: "none" as const,
        revisitDate: futureRevisitDate,
        schemaVersion: "reflection-intention.v2" as const,
        smallAction: "Take three slow breaths.",
        timeZone: "Asia/Shanghai",
      });
      const createInput = Object.freeze({
        prepare: prepareCreate(createKey),
        principal: { anonymousSessionToken: owner.token },
        request: createRequest,
      });
      const race = await Promise.all(
        Array.from({ length: 8 }, () => persistence.resolveIntentionV2(createInput)),
      );
      const intentionIds = new Set(race.map(({ intention }) => intention.id));
      assert.equal(intentionIds.size, 1);
      assert.equal(race.filter(({ kind }) => kind === "created").length, 1);
      const intention = race[0]?.intention;
      assert.ok(intention);
      assert.equal(intention.revision, 1);
      assert.equal(
        await persistence.getIntentionV2({
          id: intention.id,
          principal: { anonymousSessionToken: otherOwner.token },
        }),
        null,
      );

      const editKey = randomBytes(24).toString("base64url");
      const editRequest = Object.freeze({
        action: "edit" as const,
        expectedRevision: 1,
        intentionCode: "courage_action" as const,
        intentionText: "I intend to take the action I can take.",
        privacyState: "private" as const,
        reminderPreference: "none" as const,
        revisitDate: null,
        schemaVersion: "reflection-intention-mutation.v1" as const,
        smallAction: "Write the first sentence.",
        timeZone: null,
      });
      const editInput = Object.freeze({
        id: intention.id,
        prepare: prepareMutation(editKey),
        principal: { anonymousSessionToken: owner.token },
        request: editRequest,
      });
      const edited = await persistence.mutateIntentionV2(editInput);
      assert.equal(edited.kind, "mutated");
      assert.equal(edited.intention?.revision, 2);
      const replayedEdit = await persistence.mutateIntentionV2(editInput);
      assert.equal(replayedEdit.kind, "replayed");
      assert.equal(replayedEdit.intention?.revision, 2);
      await expectPersistenceError(
        () =>
          persistence.mutateIntentionV2({
            ...editInput,
            request: { ...editRequest, smallAction: "Changed reuse." },
          }),
        "REFLECTION_IDEMPOTENCY_CONFLICT",
      );
      await expectPersistenceError(
        () =>
          persistence.mutateIntentionV2({
            ...editInput,
            prepare: prepareMutation(randomBytes(24).toString("base64url")),
          }),
        "REFLECTION_MUTATION_CONFLICT",
      );

      const archived = await persistence.mutateIntentionV2({
        id: intention.id,
        prepare: prepareMutation(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "archive",
          expectedRevision: 2,
          schemaVersion: "reflection-intention-mutation.v1",
        },
      });
      assert.equal(archived.intention?.status, "archived");
      assert.equal(archived.intention?.revision, 3);

      await expectPersistenceError(
        () =>
          persistence.resolveRitual({
            prepare: () => ({
              canonicalRequestDigest: digest("archived-ritual-request"),
              idempotencyKeyDigest: digest("archived-ritual-key"),
              idempotencyKeyVersion: keyVersion,
            }),
            principal: { anonymousSessionToken: owner.token },
            request: {
              intentionId: intention.id,
              objectCode: "candle",
              schemaVersion: "reflection-ritual.v1",
            },
          }),
        "REFLECTION_NOT_FOUND",
      );

      const deleted = await persistence.mutateIntentionV2({
        id: intention.id,
        prepare: prepareMutation(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "delete",
          expectedRevision: 3,
          schemaVersion: "reflection-intention-mutation.v1",
        },
      });
      assert.equal(deleted.intention, null);
      assert.equal(
        await persistence.getIntentionV2({
          id: intention.id,
          principal: { anonymousSessionToken: owner.token },
        }),
        null,
      );
      await expectPersistenceError(
        () => persistence.resolveIntentionV2(createInput),
        "REFLECTION_IDEMPOTENCY_CONFLICT",
      );
      const stored = await migrator.query<{
        deleted: boolean;
        intentionText: string;
        rows: number;
        smallAction: string;
      }>(
        `
          SELECT count(*)::int AS rows,
                 bool_and(deleted_at IS NOT NULL) AS deleted,
                 string_agg(encode(intention_text_ciphertext, 'hex'), '') AS "intentionText",
                 string_agg(encode(small_action_ciphertext, 'hex'), '') AS "smallAction"
            FROM intention
           WHERE id = $1::uuid
        `,
        [intention.id],
      );
      assert.equal(stored.rows[0]?.rows, 1);
      assert.equal(stored.rows[0]?.deleted, true);
      assert.equal(stored.rows[0]?.intentionText.includes(createRequest.intentionText), false);
      assert.equal(stored.rows[0]?.smallAction.includes(createRequest.smallAction), false);

      const todayInShanghai = new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Asia/Shanghai",
        year: "numeric",
      }).format(new Date());
      await expectPersistenceError(
        () =>
          persistence.resolveIntentionV2({
            prepare: prepareCreate(randomBytes(24).toString("base64url")),
            principal: { anonymousSessionToken: owner.token },
            request: { ...createRequest, revisitDate: todayInShanghai },
          }),
        "REFLECTION_SCHEDULE_INVALID",
      );

      const lifecycleKey = randomBytes(24).toString("base64url");
      const lifecycleCreated = await persistence.resolveIntentionV2({
        prepare: prepareCreate(lifecycleKey),
        principal: { anonymousSessionToken: owner.token },
        request: {
          ...createRequest,
          intentionText: "I intend to finish what remains within my control.",
          smallAction: "Write one closing sentence.",
        },
      });
      await migrator.query(
        "UPDATE intention SET revisit_date = CURRENT_DATE - 1 WHERE id = $1::uuid",
        [lifecycleCreated.intention.id],
      );
      const lifecycleCompleted = await persistence.mutateIntentionV2({
        id: lifecycleCreated.intention.id,
        prepare: prepareMutation(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "complete",
          expectedRevision: 1,
          schemaVersion: "reflection-intention-mutation.v1",
        },
      });
      assert.equal(lifecycleCompleted.intention?.status, "completed");
      const lifecycleArchived = await persistence.mutateIntentionV2({
        id: lifecycleCreated.intention.id,
        prepare: prepareMutation(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "archive",
          expectedRevision: 2,
          schemaVersion: "reflection-intention-mutation.v1",
        },
      });
      assert.equal(lifecycleArchived.intention?.status, "archived");
      const lifecycleDeleted = await persistence.mutateIntentionV2({
        id: lifecycleCreated.intention.id,
        prepare: prepareMutation(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "delete",
          expectedRevision: 3,
          schemaVersion: "reflection-intention-mutation.v1",
        },
      });
      assert.equal(lifecycleDeleted.intention, null);

      const concurrentCreated = await persistence.resolveIntentionV2({
        prepare: prepareCreate(randomBytes(24).toString("base64url")),
        principal: { anonymousSessionToken: owner.token },
        request: {
          ...createRequest,
          intentionText: "I intend to choose one calm next step.",
          smallAction: "Write down that one step.",
        },
      });
      const concurrentEditKey = randomBytes(24).toString("base64url");
      const concurrentEditInput = Object.freeze({
        id: concurrentCreated.intention.id,
        prepare: prepareMutation(concurrentEditKey),
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "edit" as const,
          expectedRevision: 1,
          intentionCode: "calm_clarity" as const,
          intentionText: "I intend to take one calm next step.",
          privacyState: "private" as const,
          reminderPreference: "none" as const,
          revisitDate: null,
          schemaVersion: "reflection-intention-mutation.v1" as const,
          smallAction: "Write down the next step now.",
          timeZone: null,
        },
      });
      const concurrentEdits = await Promise.all([
        persistence.mutateIntentionV2(concurrentEditInput),
        persistence.mutateIntentionV2(concurrentEditInput),
      ]);
      assert.equal(concurrentEdits.filter(({ kind }) => kind === "mutated").length, 1);
      assert.equal(concurrentEdits.filter(({ kind }) => kind === "replayed").length, 1);
      assert.ok(concurrentEdits.every(({ intention: value }) => value?.revision === 2));
      let releaseArchive: (() => void) | undefined;
      let markArchiveLocked: (() => void) | undefined;
      const archiveLocked = new Promise<void>((resolve) => {
        markArchiveLocked = resolve;
      });
      const archiveRelease = new Promise<void>((resolve) => {
        releaseArchive = resolve;
      });
      const concurrentArchive = persistence.mutateIntentionV2({
        id: concurrentCreated.intention.id,
        prepare: async (context) => {
          markArchiveLocked?.();
          await archiveRelease;
          return prepareMutation(randomBytes(24).toString("base64url"))(context);
        },
        principal: { anonymousSessionToken: owner.token },
        request: {
          action: "archive",
          expectedRevision: 2,
          schemaVersion: "reflection-intention-mutation.v1",
        },
      });
      await archiveLocked;
      const concurrentRitual = persistence.resolveRitual({
        prepare: () => ({
          canonicalRequestDigest: digest("concurrent-ritual-request"),
          idempotencyKeyDigest: digest("concurrent-ritual-key"),
          idempotencyKeyVersion: keyVersion,
        }),
        principal: { anonymousSessionToken: owner.token },
        request: {
          intentionId: concurrentCreated.intention.id,
          objectCode: "candle",
          schemaVersion: "reflection-ritual.v1",
        },
      });
      releaseArchive?.();
      const archivedBeforeRitual = await concurrentArchive;
      assert.equal(archivedBeforeRitual.intention?.status, "archived");
      await expectPersistenceError(() => concurrentRitual, "REFLECTION_NOT_FOUND");

      await expectPostgresConstraint(
        () =>
          migrator.query("UPDATE intention SET privacy_state = 'public' WHERE id = $1::uuid", [
            intention.id,
          ]),
        "intention_v2_contract_check",
      );
      await expectPostgresConstraint(
        () =>
          migrator.query("UPDATE intention SET intention_text_nonce = NULL WHERE id = $1::uuid", [
            intention.id,
          ]),
        "intention_v2_contract_check",
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredRuntime = createDatabaseClient(restored.databaseUrl);
      try {
        await assertReflectionRuntimeDatabasePrivileges(restoredRuntime);
        const restoredRows = await restoredRuntime.$queryRaw<Array<{ deletedAt: Date | null }>>`
          SELECT deleted_at AS "deletedAt" FROM intention WHERE id = ${intention.id}::uuid
        `;
        assert.equal(restoredRows.length, 1);
        assert.ok(restoredRows[0]?.deletedAt instanceof Date);
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
      throw new AggregateError(cleanupErrors, "Intention persistence cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified v1 migration compatibility plus private intention v2 ownership, encryption storage, deleted replay denial, keyed races, optimistic edits, time-zone scheduling, archive/ritual serialization, lifecycle constraints, least privilege, and non-empty logical restore.\n",
);
