import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { Client } from "pg";

import {
  AnonymousIdentityPersistenceError,
  assertAnonymousIdentityRuntimeDatabasePrivileges,
  createAnonymousIdentityService,
} from "../src/anonymous-identity.js";
import {
  assertProtectedBetaInviteControlDatabasePrivileges,
  createProtectedBetaInviteControlService,
  ProtectedBetaInviteError,
} from "../src/protected-beta-invite.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const sessionPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.protected-beta-session.v1",
  ttlSeconds: 86_400,
});
const invitePolicy = Object.freeze({
  cohortLimit: 25 as const,
  policyVersion: "test.protected-beta-invite.v1",
});
const idempotencyKey = (): string => randomBytes(24).toString("base64url");

const readProjection = async (connectionString: string) => {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const cohorts = await client.query(`
      SELECT policy_version AS "policyVersion", cohort_limit AS "cohortLimit",
             issued_count AS "issuedCount", created_at AS "createdAt"
        FROM protected_beta_invite_cohort ORDER BY policy_version
    `);
    const invites = await client.query(`
      SELECT id::text AS id, policy_version AS "policyVersion", seat_number AS "seatNumber",
             encode(token_hash, 'hex') AS "tokenHash", token_hash_version AS "tokenHashVersion",
             encode(creation_key_hash, 'hex') AS "creationKeyHash",
             encode(canonical_creation_hash, 'hex') AS "canonicalCreationHash",
             created_at AS "createdAt", expires_at AS "expiresAt", consumed_at AS "consumedAt",
             anonymous_session_id::text AS "anonymousSessionId", revoked_at AS "revokedAt",
             encode(revocation_key_hash, 'hex') AS "revocationKeyHash",
             encode(canonical_revocation_hash, 'hex') AS "canonicalRevocationHash"
        FROM protected_beta_invite ORDER BY policy_version, seat_number
    `);
    const sessions = await client.query(`
      SELECT id::text AS id, revoked_at AS "revokedAt"
        FROM anonymous_session ORDER BY id
    `);
    return { cohorts: cohorts.rows, invites: invites.rows, sessions: sessions.rows };
  } finally {
    await client.end();
  }
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  const temporaryDirectories: string[] = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const runtime = createDatabaseClient(database.databaseUrl);
    const control = createDatabaseClient(database.controlDatabaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      await Promise.all([
        assertAnonymousIdentityRuntimeDatabasePrivileges(runtime),
        assertProtectedBetaInviteControlDatabasePrivileges(control),
      ]);
      const identity = createAnonymousIdentityService(runtime, sessionPolicy, invitePolicy);
      const unprotectedIdentity = createAnonymousIdentityService(runtime, sessionPolicy);
      const inviteControl = createProtectedBetaInviteControlService(control, invitePolicy);

      const operatorDirectory = await mkdtemp(join(tmpdir(), "rituvia-protected-beta-invite-"));
      temporaryDirectories.push(operatorDirectory);
      const createdOutput = join(operatorDirectory, "created.json");
      const createCommand = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/manage-protected-beta-invite.ts",
          "create",
          "--idempotency-key",
          idempotencyKey(),
          "--output",
          createdOutput,
          "--ttl-seconds",
          "604800",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, DATABASE_URL: database.controlDatabaseUrl },
        },
      );
      assert.equal(createCommand.status, 0, createCommand.stderr);
      assert.equal(createCommand.stdout.includes("token"), false);
      assert.equal((await stat(createdOutput)).mode & 0o777, 0o600);
      const operatorInvite = JSON.parse(await readFile(createdOutput, "utf8")) as {
        inviteId: string;
        operation: string;
        token: string;
      };
      assert.equal(operatorInvite.operation, "create");
      assert.match(operatorInvite.token, /^[A-Za-z0-9_-]{43}$/u);
      const revokedOutput = join(operatorDirectory, "revoked.json");
      const revokeCommand = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/manage-protected-beta-invite.ts",
          "revoke",
          "--idempotency-key",
          idempotencyKey(),
          "--invite-id",
          operatorInvite.inviteId,
          "--output",
          revokedOutput,
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, DATABASE_URL: database.controlDatabaseUrl },
        },
      );
      assert.equal(revokeCommand.status, 0, revokeCommand.stderr);
      assert.equal((await stat(revokedOutput)).mode & 0o777, 0o600);

      const unboundSession = await unprotectedIdentity.ensureSession({
        idempotencyKey: idempotencyKey(),
      });
      assert.equal(unboundSession.kind, "created");
      assert.equal(
        await identity.resolveSession(
          unboundSession.kind === "created" ? unboundSession.token : "",
        ),
        null,
      );
      const countsBeforeDeniedAdmission = await migrator.query<{
        sessions: string;
        subjects: string;
      }>(
        `SELECT (SELECT count(*)::text FROM anonymous_session) AS sessions,
                (SELECT count(*)::text FROM anonymous_subject) AS subjects`,
      );
      await assert.rejects(
        identity.ensureSession({
          idempotencyKey: idempotencyKey(),
          token: unboundSession.kind === "created" ? unboundSession.token : "",
        }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_ADMISSION_REQUIRED",
      );
      const countsAfterDeniedAdmission = await migrator.query<{
        sessions: string;
        subjects: string;
      }>(
        `SELECT (SELECT count(*)::text FROM anonymous_session) AS sessions,
                (SELECT count(*)::text FROM anonymous_subject) AS subjects`,
      );
      assert.deepEqual(countsAfterDeniedAdmission.rows, countsBeforeDeniedAdmission.rows);

      const firstCreationKey = idempotencyKey();
      const firstInvite = await inviteControl.createInvite({
        idempotencyKey: firstCreationKey,
        ttlSeconds: 86_400,
      });
      assert.match(firstInvite.token, /^[A-Za-z0-9_-]{43}$/u);
      assert.equal(firstInvite.seatNumber, 1);
      await assert.rejects(
        inviteControl.createInvite({ idempotencyKey: firstCreationKey, ttlSeconds: 86_400 }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_INVITE_REPLAY_REQUIRES_TOKEN",
      );
      await assert.rejects(
        inviteControl.createInvite({ idempotencyKey: firstCreationKey, ttlSeconds: 86_401 }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_INVITE_CONFLICT",
      );

      const firstSessionKey = idempotencyKey();
      const firstSession = await identity.ensureSession({
        idempotencyKey: firstSessionKey,
        inviteToken: firstInvite.token,
      });
      assert.equal(firstSession.kind, "created");
      assert.deepEqual(
        await identity.ensureSession({
          idempotencyKey: firstSessionKey,
          inviteToken: firstInvite.token,
        }),
        firstSession,
      );
      await assert.rejects(
        identity.ensureSession({
          idempotencyKey: idempotencyKey(),
          inviteToken: firstInvite.token,
        }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_ADMISSION_REQUIRED",
      );

      const changedInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 86_400,
      });
      await assert.rejects(
        identity.ensureSession({
          idempotencyKey: firstSessionKey,
          inviteToken: changedInvite.token,
        }),
        (error: unknown) =>
          error instanceof AnonymousIdentityPersistenceError &&
          error.code === "ANONYMOUS_SESSION_IDEMPOTENCY_CONFLICT",
      );

      const concurrentInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 86_400,
      });
      const concurrent = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          identity.ensureSession({
            idempotencyKey: idempotencyKey(),
            inviteToken: concurrentInvite.token,
          }),
        ),
      );
      assert.equal(concurrent.filter(({ status }) => status === "fulfilled").length, 1);
      for (const rejected of concurrent.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      )) {
        assert.ok(rejected.reason instanceof ProtectedBetaInviteError);
        assert.equal(rejected.reason.code, "PROTECTED_BETA_ADMISSION_REQUIRED");
      }

      const raceInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 86_400,
      });
      const admissionRevocationRace = await Promise.allSettled([
        identity.ensureSession({
          idempotencyKey: idempotencyKey(),
          inviteToken: raceInvite.token,
        }),
        inviteControl.revokeInvite({
          idempotencyKey: idempotencyKey(),
          inviteId: raceInvite.inviteId,
        }),
      ]);
      assert.equal(admissionRevocationRace[1]?.status, "fulfilled");
      const admissionRaceResult = admissionRevocationRace[0];
      assert.ok(admissionRaceResult !== undefined);
      if (admissionRaceResult.status === "fulfilled") {
        assert.equal(
          await identity.resolveSession(
            admissionRaceResult.value.kind === "created" ? admissionRaceResult.value.token : "",
          ),
          null,
        );
      } else {
        assert.ok(admissionRaceResult.reason instanceof ProtectedBetaInviteError);
        assert.equal(admissionRaceResult.reason.code, "PROTECTED_BETA_ADMISSION_REQUIRED");
      }

      const revokedUnusedInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 86_400,
      });
      const unusedRevocationKey = idempotencyKey();
      assert.deepEqual(
        await inviteControl.revokeInvite({
          idempotencyKey: unusedRevocationKey,
          inviteId: revokedUnusedInvite.inviteId,
        }),
        { kind: "revoked" },
      );
      assert.deepEqual(
        await inviteControl.revokeInvite({
          idempotencyKey: unusedRevocationKey,
          inviteId: revokedUnusedInvite.inviteId,
        }),
        { kind: "replayed" },
      );
      const changedRevocationInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 86_400,
      });
      await assert.rejects(
        inviteControl.revokeInvite({
          idempotencyKey: unusedRevocationKey,
          inviteId: changedRevocationInvite.inviteId,
        }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_INVITE_CONFLICT",
      );
      await assert.rejects(
        identity.ensureSession({
          idempotencyKey: idempotencyKey(),
          inviteToken: revokedUnusedInvite.token,
        }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_ADMISSION_REQUIRED",
      );

      const consumedThenRevokedInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 86_400,
      });
      const consumedThenRevokedSession = await identity.ensureSession({
        idempotencyKey: idempotencyKey(),
        inviteToken: consumedThenRevokedInvite.token,
      });
      assert.equal(consumedThenRevokedSession.kind, "created");
      await inviteControl.revokeInvite({
        idempotencyKey: idempotencyKey(),
        inviteId: consumedThenRevokedInvite.inviteId,
      });
      assert.equal(
        await identity.resolveSession(
          consumedThenRevokedSession.kind === "created" ? consumedThenRevokedSession.token : "",
        ),
        null,
      );

      const expiredInvite = await inviteControl.createInvite({
        idempotencyKey: idempotencyKey(),
        ttlSeconds: 300,
      });
      await migrator.query(
        `UPDATE protected_beta_invite
            SET created_at = CURRENT_TIMESTAMP - interval '10 minutes',
                expires_at = CURRENT_TIMESTAMP - interval '5 minutes'
          WHERE id = $1::uuid`,
        [expiredInvite.inviteId],
      );
      await assert.rejects(
        identity.ensureSession({
          idempotencyKey: idempotencyKey(),
          inviteToken: expiredInvite.token,
        }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_ADMISSION_REQUIRED",
      );

      const issuedCount = Number(
        (
          await migrator.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM protected_beta_invite WHERE policy_version = $1",
            [invitePolicy.policyVersion],
          )
        ).rows[0]?.count ?? "0",
      );
      for (let index = issuedCount; index < invitePolicy.cohortLimit; index += 1) {
        await inviteControl.createInvite({ idempotencyKey: idempotencyKey(), ttlSeconds: 86_400 });
      }
      await assert.rejects(
        inviteControl.createInvite({ idempotencyKey: idempotencyKey(), ttlSeconds: 86_400 }),
        (error: unknown) =>
          error instanceof ProtectedBetaInviteError &&
          error.code === "PROTECTED_BETA_INVITE_CAPACITY_REACHED",
      );

      const capacityPolicy = Object.freeze({
        cohortLimit: 25 as const,
        policyVersion: "test.protected-beta-capacity.v1",
      });
      const capacityControl = createProtectedBetaInviteControlService(control, capacityPolicy);
      const capacityRace = await Promise.allSettled(
        Array.from({ length: 26 }, () =>
          capacityControl.createInvite({ idempotencyKey: idempotencyKey(), ttlSeconds: 86_400 }),
        ),
      );
      assert.equal(capacityRace.filter(({ status }) => status === "fulfilled").length, 25);
      const capacityRejections = capacityRace.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      assert.equal(capacityRejections.length, 1);
      assert.ok(capacityRejections[0]?.reason instanceof ProtectedBetaInviteError);
      assert.equal(
        (capacityRejections[0]?.reason as ProtectedBetaInviteError).code,
        "PROTECTED_BETA_INVITE_CAPACITY_REACHED",
      );

      const persisted = await readProjection(database.migrationDatabaseUrl);
      assert.equal(
        persisted.cohorts.find(({ policyVersion }) => policyVersion === invitePolicy.policyVersion)
          ?.issuedCount,
        25,
      );
      assert.equal(
        persisted.invites.filter(
          ({ policyVersion }) => policyVersion === invitePolicy.policyVersion,
        ).length,
        25,
      );
      assert.equal(JSON.stringify(persisted).includes(firstInvite.token), false);
      const runtimeClient = new Client({ connectionString: database.databaseUrl });
      const controlClient = new Client({ connectionString: database.controlDatabaseUrl });
      await Promise.all([runtimeClient.connect(), controlClient.connect()]);
      try {
        await assert.rejects(
          runtimeClient.query(
            `INSERT INTO protected_beta_invite_cohort
               (policy_version, cohort_limit, issued_count) VALUES ('test.unsafe', 25, 1)`,
          ),
          (error: unknown) => (error as { code?: string }).code === "42501",
        );
        await assert.rejects(
          runtimeClient.query(
            "UPDATE protected_beta_invite SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
            [firstInvite.inviteId],
          ),
          (error: unknown) => (error as { code?: string }).code === "42501",
        );
        await assert.rejects(
          runtimeClient.query("SELECT canonical_creation_hash FROM protected_beta_invite LIMIT 1"),
          (error: unknown) => (error as { code?: string }).code === "42501",
        );
        await assert.rejects(
          controlClient.query("SELECT token_hash FROM anonymous_session LIMIT 1"),
          (error: unknown) => (error as { code?: string }).code === "42501",
        );
        await assert.rejects(
          controlClient.query("SELECT token_hash FROM protected_beta_invite LIMIT 1"),
          (error: unknown) => (error as { code?: string }).code === "42501",
        );
        await assert.rejects(
          controlClient.query(
            "UPDATE protected_beta_invite SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
            [firstInvite.inviteId],
          ),
          (error: unknown) => (error as { code?: string }).code === "42501",
        );
      } finally {
        await Promise.all([runtimeClient.end(), controlClient.end()]);
      }

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredRuntime = createDatabaseClient(restored.databaseUrl);
      const restoredControl = createDatabaseClient(restored.controlDatabaseUrl);
      try {
        await Promise.all([
          assertAnonymousIdentityRuntimeDatabasePrivileges(restoredRuntime),
          assertProtectedBetaInviteControlDatabasePrivileges(restoredControl),
        ]);
        assert.deepEqual(
          await readProjection(restored.migrationDatabaseUrl),
          await readProjection(database.migrationDatabaseUrl),
        );
        const restoredIdentity = createAnonymousIdentityService(
          restoredRuntime,
          sessionPolicy,
          invitePolicy,
        );
        assert.deepEqual(
          await restoredIdentity.resolveSession(
            firstSession.kind === "created" ? firstSession.token : "",
          ),
          firstSession.context,
        );
        assert.equal(
          await restoredIdentity.resolveSession(
            consumedThenRevokedSession.kind === "created" ? consumedThenRevokedSession.token : "",
          ),
          null,
        );
      } finally {
        await Promise.all([restoredRuntime.$disconnect(), restoredControl.$disconnect()]);
      }
    } finally {
      await Promise.all([runtime.$disconnect(), control.$disconnect(), migrator.end()]);
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
    for (const directory of temporaryDirectories.reverse()) {
      try {
        await rm(directory, { force: true, recursive: true });
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
      throw new AggregateError(cleanupErrors, "Protected-Beta invite cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified protected-Beta invite hashing, atomic admission/revocation, 25-seat capacity, least privilege, and logical restore.\n",
);
