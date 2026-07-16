import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client, Pool } from "pg";

import {
  assertExactLocalDatabaseUrl,
  localPostgresConstants,
  resetDevelopmentDatabase,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyInterruptedLifecycleLockRelease,
  verifyLogicalDumpRestore,
  verifyStaleLifecycleLockRecovery,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const EXPECTED_SEED = Object.freeze({
  id: "6d393ec1-2019-4abc-9cf8-62f58c72efe8",
  datasetKey: "foundation-synthetic",
  version: 1,
  checksumSha256: "921224db98642ee1f9abc307c710066eb3a94a59c3caba29ffda110ee1928937",
  isSynthetic: true,
  createdAt: new Date("2026-07-16T00:00:00.000Z"),
});

const openPools = new Set();
let backgroundPoolError;

const createTrackedPool = (databaseUrl, max) => {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    ...(max === undefined ? {} : { max }),
  });
  pool.on("error", (error) => {
    backgroundPoolError ??= error;
  });
  openPools.add(pool);
  return pool;
};

const closeTrackedPool = async (pool) => {
  if (openPools.delete(pool)) await pool.end();
};

const expectPostgresError = async (operation, code, constraint) => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal(error?.code, code);
    if (constraint !== undefined) {
      assert.equal(error?.constraint, constraint);
    }
  }
};

const verifyTargetGuards = () => {
  const passwordCanary = "password-canary-not-for-output";
  const valid = new URL("postgresql://127.0.0.1");
  valid.username = localPostgresConstants.appRole;
  valid.password = passwordCanary;
  valid.port = String(localPostgresConstants.port);
  valid.pathname = `/${localPostgresConstants.developmentDatabase}`;
  valid.searchParams.set("application_name", "rituvia_local");
  valid.searchParams.set("connect_timeout", "5");
  valid.searchParams.set("schema", "public");
  valid.searchParams.set("sslmode", "disable");

  assert.doesNotThrow(() =>
    assertExactLocalDatabaseUrl(
      valid.toString(),
      localPostgresConstants.developmentDatabase,
      passwordCanary,
    ),
  );

  const mutations = [
    (url) => {
      url.hostname = "localhost";
    },
    (url) => {
      url.hostname = "198.51.100.10";
    },
    (url) => {
      url.port = "5432";
    },
    (url) => {
      url.pathname = "/production";
    },
    (url) => {
      url.username = "postgres";
    },
    (url) => {
      url.hash = "unexpected";
    },
    (url) => {
      url.searchParams.set("options", "-csearch_path=unsafe");
    },
    (url) => {
      url.searchParams.delete("sslmode");
    },
  ];

  for (const mutate of mutations) {
    const candidate = new URL(valid);
    mutate(candidate);
    let message = "";
    try {
      assertExactLocalDatabaseUrl(
        candidate.toString(),
        localPostgresConstants.developmentDatabase,
        passwordCanary,
      );
      assert.fail("Expected exact-target guard rejection.");
    } catch (error) {
      message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    }
    assert.equal(message.includes(passwordCanary), false);
  }
};

const verifySeed = async (pool) => {
  const result = await pool.query(`
    SELECT id::text AS "id",
           dataset_key AS "datasetKey",
           version,
           checksum_sha256 AS "checksumSha256",
           is_synthetic AS "isSynthetic",
           created_at AS "createdAt"
      FROM seed_manifest
     ORDER BY dataset_key, version
  `);
  assert.equal(result.rowCount, 1);
  assert.deepEqual(result.rows[0], EXPECTED_SEED);
};

const verifyMigrationState = async (pool) => {
  const result = await pool.query(`
    SELECT migration_name AS "migrationName", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
      FROM _prisma_migrations
     ORDER BY started_at
  `);
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0]?.migrationName, "202607160001_foundation");
  assert.ok(result.rows[0]?.finishedAt instanceof Date);
  assert.equal(result.rows[0]?.rolledBackAt, null);
};

const verifyRoleRestrictions = async (databaseUrl) => {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const suffix = randomBytes(6).toString("hex");
    await expectPostgresError(() => client.query(`CREATE ROLE forbidden_${suffix}`), "42501");
    await expectPostgresError(() => client.query(`CREATE DATABASE forbidden_${suffix}`), "42501");
  } finally {
    await client.end();
  }
};

const verifyConstraintsAndTransactions = async (pool) => {
  const checksum = "a".repeat(64);
  await expectPostgresError(
    () =>
      pool.query(
        `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
         VALUES ('invalid key', 1, $1, true)`,
        [checksum],
      ),
    "23514",
    "seed_manifest_dataset_key_check",
  );
  await expectPostgresError(
    () =>
      pool.query(
        `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
         VALUES ('invalid-version', 0, $1, true)`,
        [checksum],
      ),
    "23514",
    "seed_manifest_version_check",
  );
  await expectPostgresError(
    () =>
      pool.query(`INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
                  VALUES ('invalid-checksum', 1, 'ABC', true)`),
    "23514",
    "seed_manifest_checksum_sha256_check",
  );
  await expectPostgresError(
    () =>
      pool.query(
        `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
         VALUES ('not-synthetic', 1, $1, false)`,
        [checksum],
      ),
    "23514",
    "seed_manifest_is_synthetic_check",
  );

  const transaction = await pool.connect();
  try {
    await transaction.query("BEGIN");
    await transaction.query(
      `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
       VALUES ('transaction-rollback', 1, $1, true)`,
      [checksum],
    );
    await transaction.query("ROLLBACK");
  } finally {
    transaction.release();
  }
  const rolledBack = await pool.query(
    "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = 'transaction-rollback'",
  );
  assert.equal(rolledBack.rows[0]?.count, 0);

  const raceKey = `race-${randomBytes(6).toString("hex")}`;
  const contenders = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      pool.query(
        `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
         VALUES ($1, 1, $2, true)`,
        [raceKey, checksum],
      ),
    ),
  );
  assert.equal(contenders.filter(({ status }) => status === "fulfilled").length, 1);
  const failures = contenders.filter(({ status }) => status === "rejected");
  assert.equal(failures.length, 7);
  for (const failure of failures) {
    assert.equal(failure.reason?.code, "23505");
    assert.equal(failure.reason?.constraint, "seed_manifest_dataset_key_version_key");
  }

  const logCanary = `private-log-canary-${randomBytes(8).toString("hex")}-INVALID`;
  await expectPostgresError(
    () =>
      pool.query(
        `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
         VALUES ($1, 1, $2, true)`,
        [logCanary, checksum],
      ),
    "23514",
    "seed_manifest_dataset_key_check",
  );
  const serverLog = await readFile(localPostgresConstants.logPath, "utf8");
  assert.equal(serverLog.includes(logCanary), false);
};

const migrateAndSeed = (lease, databaseUrl) => {
  runLocalPrisma(lease.runtime, databaseUrl, ["generate"]);
  runLocalPrisma(lease.runtime, databaseUrl, ["migrate", "deploy"]);
  runLocalPrisma(lease.runtime, databaseUrl, ["migrate", "deploy"]);
  runLocalPrisma(lease.runtime, databaseUrl, ["db", "seed"]);
  runLocalPrisma(lease.runtime, databaseUrl, ["db", "seed"]);
};

verifyTargetGuards();
await verifyInterruptedLifecycleLockRelease();
await verifyStaleLifecycleLockRecovery();

await withLocalPostgresLease(async (lease) => {
  let primaryError;
  const databases = [];
  try {
    const hba = await readFile(`${localPostgresConstants.dataDirectory}/pg_hba.conf`, "utf8");
    assert.match(hba, /scram-sha-256/);
    assert.equal(/\btrust\b/.test(hba), false);
    await assert.rejects(
      resetDevelopmentDatabase(lease.runtime, "wrong-confirmation"),
      /reset confirmation or environment guard failed/,
    );
    const originalAppEnvironment = process.env.APP_ENV;
    const originalDatabaseUrl = process.env.DATABASE_URL;
    try {
      process.env.APP_ENV = "production";
      await assert.rejects(
        resetDevelopmentDatabase(lease.runtime, localPostgresConstants.resetConfirmation),
        /reset confirmation or environment guard failed/,
      );
      process.env.APP_ENV = "local";
      process.env.DATABASE_URL = "postgresql://remote.example/production";
      await assert.rejects(
        resetDevelopmentDatabase(lease.runtime, localPostgresConstants.resetConfirmation),
        /reset confirmation or environment guard failed/,
      );
    } finally {
      if (originalAppEnvironment === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = originalAppEnvironment;
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }

    const database = await lease.createTestDatabase();
    databases.push(database);
    migrateAndSeed(lease, database.databaseUrl);

    let pool = createTrackedPool(database.databaseUrl, 10);
    await verifyMigrationState(pool);
    await verifySeed(pool);
    await verifyRoleRestrictions(database.databaseUrl);
    await verifyConstraintsAndTransactions(pool);

    await pool.query(
      `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
       VALUES ('reset-marker', 1, $1, true)`,
      ["b".repeat(64)],
    );
    await closeTrackedPool(pool);
    await database.reset();
    migrateAndSeed(lease, database.databaseUrl);
    pool = createTrackedPool(database.databaseUrl);
    await verifyMigrationState(pool);
    await verifySeed(pool);
    const resetMarker = await pool.query(
      "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = 'reset-marker'",
    );
    assert.equal(resetMarker.rows[0]?.count, 0);
    await closeTrackedPool(pool);

    const restored = await lease.createTestDatabase();
    databases.push(restored);
    assert.notEqual(database.databaseName, restored.databaseName);
    await verifyLogicalDumpRestore(lease.runtime, database, restored);
    runLocalPrisma(lease.runtime, restored.databaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, restored.databaseUrl, ["db", "seed"]);
    const restoredPool = createTrackedPool(restored.databaseUrl);
    await verifyMigrationState(restoredPool);
    await verifySeed(restoredPool);
    await closeTrackedPool(restoredPool);
  } catch (error) {
    primaryError = error;
  }

  for (const pool of [...openPools]) {
    try {
      await closeTrackedPool(pool);
    } catch (cleanupError) {
      if (primaryError === undefined) primaryError = cleanupError;
    }
  }
  if (primaryError === undefined && backgroundPoolError !== undefined) {
    primaryError = backgroundPoolError;
  }

  for (const database of databases.reverse()) {
    try {
      await database.drop();
    } catch (cleanupError) {
      if (primaryError === undefined) primaryError = cleanupError;
    }
  }

  try {
    await stopLeaseOwnedRuntime(lease);
  } catch (cleanupError) {
    if (primaryError === undefined) primaryError = cleanupError;
  }

  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified local PostgreSQL attestation, migration, seed, constraints, transaction, race, reset, and logical restore.\n",
);
