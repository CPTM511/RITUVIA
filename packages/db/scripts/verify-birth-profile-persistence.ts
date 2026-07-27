import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import {
  BirthProfilePersistenceError,
  createBirthProfilePersistence,
  type PreparedBirthProfileWrite,
} from "../src/birth-profile-persistence.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "test.birth-profile-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});

const bearer = (): string => randomBytes(32).toString("base64url");
const digest = (fill: number): string => `sha256:${Buffer.alloc(32, fill).toString("hex")}`;
const write = (
  marker: number,
  timeCertainty: PreparedBirthProfileWrite["timeCertainty"] = "exact",
): PreparedBirthProfileWrite =>
  Object.freeze({
    canonicalPayloadDigest: digest(marker),
    canonicalRequestDigest: digest(marker + 1),
    digestKeyVersion: "private-content.v1",
    encryptedPayload: Object.freeze({
      ciphertext: new Uint8Array(64).fill(marker),
      keyVersion: "private-content.v1",
      nonce: new Uint8Array(12).fill(marker),
      tag: new Uint8Array(16).fill(marker),
    }),
    idempotencyKeyDigest: digest(marker + 2),
    timeCertainty,
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
      const accounts = createAccountIdentityService(runtime, accountPolicy);
      const profiles = createBirthProfilePersistence(runtime);
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

      const owner = await createSession("birth-profile-owner@example.test");
      const other = await createSession("birth-profile-other@example.test");
      const created = await profiles.create({
        prepare: () => write(11),
        sessionToken: owner.sessionToken,
      });
      assert.equal(created.userId, owner.userId);
      assert.equal(created.revision, 1);
      assert.equal(created.timeCertainty, "exact");

      const replay = await profiles.create({
        prepare: () => write(11),
        sessionToken: owner.sessionToken,
      });
      assert.equal(replay.id, created.id);
      assert.equal(
        (
          await migrator.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM birth_profile WHERE user_id = $1::uuid",
            [owner.userId],
          )
        ).rows[0]?.count,
        "1",
      );

      await assert.rejects(
        profiles.read({ profileId: created.id, sessionToken: other.sessionToken }),
        (error: unknown) =>
          error instanceof BirthProfilePersistenceError && error.code === "BIRTH_PROFILE_NOT_FOUND",
      );
      assert.equal((await profiles.list({ sessionToken: other.sessionToken })).length, 0);

      const updated = await profiles.update({
        expectedRevision: 1,
        prepare: () => write(21, "approximate"),
        profileId: created.id,
        sessionToken: owner.sessionToken,
      });
      assert.equal(updated.revision, 2);
      assert.equal(updated.timeCertainty, "approximate");
      await assert.rejects(
        profiles.update({
          expectedRevision: 1,
          prepare: () => write(31, "unknown"),
          profileId: created.id,
          sessionToken: owner.sessionToken,
        }),
        (error: unknown) =>
          error instanceof BirthProfilePersistenceError && error.code === "BIRTH_PROFILE_CONFLICT",
      );

      const deleted = await profiles.delete({
        expectedRevision: 2,
        prepare: () =>
          Object.freeze({
            canonicalRequestDigest: digest(41),
            idempotencyKeyDigest: digest(42),
            tombstone: Object.freeze({
              ciphertext: new Uint8Array(32).fill(41),
              keyVersion: "private-content.v1",
              nonce: new Uint8Array(12).fill(41),
              tag: new Uint8Array(16).fill(41),
            }),
          }),
        profileId: created.id,
        sessionToken: owner.sessionToken,
      });
      assert.equal(deleted.revision, 3);
      assert(deleted.deletedAt !== null);
      assert.equal((await profiles.list({ sessionToken: owner.sessionToken })).length, 0);
      await assert.rejects(
        profiles.read({ profileId: created.id, sessionToken: owner.sessionToken }),
        (error: unknown) =>
          error instanceof BirthProfilePersistenceError && error.code === "BIRTH_PROFILE_NOT_FOUND",
      );

      await assert.rejects(runtime.$executeRawUnsafe(`DELETE FROM birth_profile`));
      await assert.rejects(
        runtime.$executeRawUnsafe(
          `UPDATE birth_profile SET user_id = '${other.userId}'::uuid WHERE id = '${created.id}'::uuid`,
        ),
      );
      const privileges = await migrator.query<{
        appDelete: boolean;
        appInsert: boolean;
        appSelect: boolean;
        operationDelete: boolean;
        operationInsert: boolean;
        operationSelect: boolean;
        operationUpdate: boolean;
      }>(
        `
          SELECT
            has_table_privilege('rituvia_app', 'birth_profile', 'SELECT') AS "appSelect",
            has_table_privilege('rituvia_app', 'birth_profile', 'INSERT') AS "appInsert",
            has_table_privilege('rituvia_app', 'birth_profile', 'DELETE') AS "appDelete",
            has_table_privilege('rituvia_app', 'birth_profile_operation', 'SELECT')
              AS "operationSelect",
            has_table_privilege('rituvia_app', 'birth_profile_operation', 'INSERT')
              AS "operationInsert",
            has_table_privilege('rituvia_app', 'birth_profile_operation', 'UPDATE')
              AS "operationUpdate",
            has_table_privilege('rituvia_app', 'birth_profile_operation', 'DELETE')
              AS "operationDelete"
        `,
      );
      assert.deepEqual(privileges.rows[0], {
        appDelete: false,
        appInsert: true,
        appSelect: true,
        operationDelete: false,
        operationInsert: true,
        operationSelect: true,
        operationUpdate: false,
      });

      console.log(
        "Verified encrypted birth-profile ownership, session authorization, replay, optimistic concurrency, tombstone deletion, and least-privilege access.",
      );
    } finally {
      await migrator.end();
      await runtime.$disconnect();
    }
  } finally {
    if (database !== undefined) await database.drop();
    await stopLeaseOwnedRuntime(lease);
  }
});
