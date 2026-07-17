import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Client, Pool } from "pg";

import {
  assertExactLocalDatabaseUrl,
  ensureRuntimeDatabasePrivileges,
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
  assert.deepEqual(
    result.rows.map(({ migrationName }) => migrationName),
    [
      "202607160001_foundation",
      "202607170001_feature_flag_registry",
      "202607170002_anonymous_identity_baseline",
      "202607170003_tarot_reading_persistence",
      "202607170004_tarot_reading_report",
    ],
  );
  for (const row of result.rows) {
    assert.ok(row.finishedAt instanceof Date);
    assert.equal(row.rolledBackAt, null);
  }

  const appendOnlyPolicies = await pool.query(`
    SELECT c.relrowsecurity AS "rowSecurity",
           c.relforcerowsecurity AS "forceRowSecurity",
           array_agg(p.cmd ORDER BY p.cmd) AS commands
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
     WHERE n.nspname = 'public' AND c.relname = 'feature_flag_version'
     GROUP BY c.relrowsecurity, c.relforcerowsecurity
  `);
  assert.deepEqual(appendOnlyPolicies.rows[0], {
    commands: ["INSERT", "SELECT"],
    forceRowSecurity: true,
    rowSecurity: true,
  });
  const policyRoles = await pool.query(`
    SELECT policyname AS "policyName", cmd AS command, to_json(roles) AS roles
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'feature_flag_version'
     ORDER BY policyname
  `);
  assert.deepEqual(policyRoles.rows, [
    {
      command: "INSERT",
      policyName: "feature_flag_version_append",
      roles: ["rituvia_feature_flag_writer"],
    },
    {
      command: "SELECT",
      policyName: "feature_flag_version_read",
      roles: ["rituvia_feature_flag_reader"],
    },
  ]);
};

const verifyIdentityTablesStartEmpty = async (pool) => {
  const result = await pool.query(`
    SELECT (SELECT count(*)::int FROM anonymous_subject) AS subjects,
           (SELECT count(*)::int FROM anonymous_session) AS sessions,
           (SELECT count(*)::int FROM consent_record) AS consents,
           (SELECT count(*)::int FROM anonymous_session_issuance_gate) AS issuance_gates,
           (SELECT count(*)::int FROM reading) AS readings,
           (SELECT count(*)::int FROM tarot_draw) AS draws,
           (SELECT count(*)::int FROM reading_report) AS reports
  `);
  assert.deepEqual(result.rows[0], {
    consents: 0,
    draws: 0,
    issuance_gates: 0,
    reports: 0,
    readings: 0,
    sessions: 0,
    subjects: 0,
  });
};

const verifyRoleRestrictions = async (databaseUrl) => {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const ownership = await client.query(`
      SELECT pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())) AS "databaseOwner",
             pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'public')) AS "schemaOwner",
             pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.feature_flag_version'::regclass)) AS "tableOwner",
             has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
             has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
             has_table_privilege(current_user, 'public.feature_flag_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS "canMutateFeatureFlags"
    `);
    assert.deepEqual(ownership.rows[0], {
      canCreateInDatabase: false,
      canCreateInSchema: false,
      canMutateFeatureFlags: false,
      databaseOwner: localPostgresConstants.migratorRole,
      schemaOwner: localPostgresConstants.migratorRole,
      tableOwner: localPostgresConstants.migratorRole,
    });
    const suffix = randomBytes(6).toString("hex");
    await expectPostgresError(() => client.query(`CREATE ROLE forbidden_${suffix}`), "42501");
    await expectPostgresError(() => client.query(`CREATE DATABASE forbidden_${suffix}`), "42501");
    await expectPostgresError(
      () => client.query(`CREATE TABLE forbidden_${suffix} (id int)`),
      "42501",
    );
    for (const statement of [
      "ALTER TABLE feature_flag_version DISABLE ROW LEVEL SECURITY",
      "DROP POLICY feature_flag_version_read ON feature_flag_version",
      "TRUNCATE feature_flag_version",
    ]) {
      await expectPostgresError(() => client.query(statement), "42501");
    }
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

const verifyFeatureFlagVersions = async (runtimePool, controlPool) => {
  const initial = await runtimePool.query(
    "SELECT count(*)::int AS count FROM feature_flag_version",
  );
  assert.equal(initial.rows[0]?.count, 0);

  const insert = (overrides = {}) => {
    const record = {
      actorId: "codex.local",
      approvalReference: null,
      changeReference: "RIT-007",
      countryCodes: [],
      createdAt: new Date("2026-07-17T10:00:00.000Z"),
      effectiveAt: new Date("2026-07-17T11:00:00.000Z"),
      expiresAt: null,
      flagKey: "experience.public_shell",
      localeTags: [],
      registryVersion: 1,
      state: "off",
      version: 1,
      ...overrides,
    };
    return controlPool.query(
      `INSERT INTO feature_flag_version
         (registry_version, flag_key, version, state, country_codes, locale_tags,
          effective_at, expires_at, change_reference, approval_reference, actor_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id::text AS id`,
      [
        record.registryVersion,
        record.flagKey,
        record.version,
        record.state,
        record.countryCodes,
        record.localeTags,
        record.effectiveAt,
        record.expiresAt,
        record.changeReference,
        record.approvalReference,
        record.actorId,
        record.createdAt,
      ],
    );
  };

  await expectPostgresError(
    () => insert({ registryVersion: 0 }),
    "23514",
    "feature_flag_version_registry_version_check",
  );
  await expectPostgresError(
    () => insert({ flagKey: "Invalid Key" }),
    "23514",
    "feature_flag_version_flag_key_check",
  );
  await expectPostgresError(
    () => insert({ version: 0 }),
    "23514",
    "feature_flag_version_version_check",
  );
  await expectPostgresError(
    () => insert({ state: "partial" }),
    "23514",
    "feature_flag_version_state_check",
  );
  await expectPostgresError(
    () => insert({ countryCodes: ["usa"] }),
    "23514",
    "feature_flag_version_country_codes_check",
  );
  await expectPostgresError(
    () => insert({ localeTags: ["not_a_locale"] }),
    "23514",
    "feature_flag_version_locale_tags_check",
  );
  await expectPostgresError(
    () =>
      insert({
        expiresAt: new Date("2026-07-17T11:00:00.000Z"),
      }),
    "23514",
    "feature_flag_version_expiry_check",
  );
  await expectPostgresError(
    () => insert({ createdAt: new Date("2026-07-17T12:00:00.000Z") }),
    "23514",
    "feature_flag_version_effective_at_check",
  );
  await expectPostgresError(
    () => insert({ changeReference: "private free text" }),
    "23514",
    "feature_flag_version_change_reference_check",
  );
  await expectPostgresError(
    () => insert({ approvalReference: "approved" }),
    "23514",
    "feature_flag_version_approval_reference_check",
  );
  await expectPostgresError(
    () => insert({ actorId: "Invalid Actor" }),
    "23514",
    "feature_flag_version_actor_id_check",
  );

  const created = await insert();
  const id = created.rows[0]?.id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  await expectPostgresError(
    () => insert(),
    "23505",
    "feature_flag_version_registry_flag_key_version_key",
  );

  await expectPostgresError(
    () =>
      insert({
        countryCodes: ["US"],
        flagKey: "payments.fiat_checkout",
        state: "on",
      }),
    "42501",
  );
  const approved = await insert({
    approvalReference: "OWN-002:local-owner-record",
    countryCodes: ["US"],
    flagKey: "payments.fiat_checkout",
    state: "on",
  });
  assert.match(approved.rows[0]?.id, /^[0-9a-f-]{36}$/);
  await expectPostgresError(
    () =>
      insert({
        approvalReference: "OWN-004:wrong-gate",
        countryCodes: ["US"],
        flagKey: "payments.fiat_checkout",
        state: "on",
        version: 2,
      }),
    "42501",
  );
  await insert({ registryVersion: 2 });

  await expectPostgresError(
    () =>
      runtimePool.query(
        `INSERT INTO feature_flag_version
           (registry_version, flag_key, version, effective_at, change_reference, actor_id)
         VALUES (1, 'experience.public_shell', 99, now(), 'RIT-007', 'runtime.denied')`,
      ),
    "42501",
  );

  for (const [statement, values] of [
    ["UPDATE feature_flag_version SET state = 'on' WHERE id = $1::uuid", [id]],
    ["DELETE FROM feature_flag_version WHERE id = $1::uuid", [id]],
    ["TRUNCATE feature_flag_version", []],
  ]) {
    await expectPostgresError(() => controlPool.query(statement, values), "42501");
  }
  const unchanged = await runtimePool.query(
    "SELECT state FROM feature_flag_version WHERE id = $1::uuid",
    [id],
  );
  assert.deepEqual(unchanged.rows, [{ state: "off" }]);
  const histories = await runtimePool.query(
    `SELECT registry_version AS "registryVersion", flag_key AS "flagKey", version, state,
            country_codes AS "countryCodes", approval_reference AS "approvalReference"
       FROM feature_flag_version
      ORDER BY registry_version, flag_key, version`,
  );
  assert.deepEqual(histories.rows, [
    {
      approvalReference: null,
      countryCodes: [],
      flagKey: "experience.public_shell",
      registryVersion: 1,
      state: "off",
      version: 1,
    },
    {
      approvalReference: "OWN-002:local-owner-record",
      countryCodes: ["US"],
      flagKey: "payments.fiat_checkout",
      registryVersion: 1,
      state: "on",
      version: 1,
    },
    {
      approvalReference: null,
      countryCodes: [],
      flagKey: "experience.public_shell",
      registryVersion: 2,
      state: "off",
      version: 1,
    },
  ]);
  return histories.rows;
};

const migrateAndSeed = async (lease, database) => {
  runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
  runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
  runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
  await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);
  runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
  runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
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
    await migrateAndSeed(lease, database);

    let pool = createTrackedPool(database.databaseUrl, 10);
    let migrationPool = createTrackedPool(database.migrationDatabaseUrl, 10);
    let controlPool = createTrackedPool(database.controlDatabaseUrl, 10);
    await verifyMigrationState(pool);
    await verifySeed(pool);
    await verifyIdentityTablesStartEmpty(pool);
    await verifyRoleRestrictions(database.databaseUrl);
    await verifyConstraintsAndTransactions(migrationPool);
    await verifyFeatureFlagVersions(pool, controlPool);

    await migrationPool.query(
      `INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic)
       VALUES ('reset-marker', 1, $1, true)`,
      ["b".repeat(64)],
    );
    await closeTrackedPool(pool);
    await closeTrackedPool(migrationPool);
    await closeTrackedPool(controlPool);
    await database.reset();
    await migrateAndSeed(lease, database);
    pool = createTrackedPool(database.databaseUrl);
    controlPool = createTrackedPool(database.controlDatabaseUrl);
    await verifyMigrationState(pool);
    await verifySeed(pool);
    await verifyIdentityTablesStartEmpty(pool);
    const resetMarker = await pool.query(
      "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = 'reset-marker'",
    );
    assert.equal(resetMarker.rows[0]?.count, 0);
    const sourceHistory = await verifyFeatureFlagVersions(pool, controlPool);
    await closeTrackedPool(pool);
    await closeTrackedPool(controlPool);

    const restored = await lease.createTestDatabase();
    databases.push(restored);
    assert.notEqual(database.databaseName, restored.databaseName);
    await verifyLogicalDumpRestore(lease.runtime, database, restored);
    runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
    runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["db", "seed"]);
    const restoredPool = createTrackedPool(restored.databaseUrl);
    const restoredControlPool = createTrackedPool(restored.controlDatabaseUrl);
    await verifyMigrationState(restoredPool);
    await verifySeed(restoredPool);
    const restoredHistory = await restoredPool.query(
      `SELECT registry_version AS "registryVersion", flag_key AS "flagKey", version, state,
              country_codes AS "countryCodes", approval_reference AS "approvalReference"
         FROM feature_flag_version
        ORDER BY registry_version, flag_key, version`,
    );
    assert.deepEqual(restoredHistory.rows, sourceHistory);
    await verifyRoleRestrictions(restored.databaseUrl);
    await expectPostgresError(
      () =>
        restoredControlPool.query(
          "UPDATE feature_flag_version SET state = 'off' WHERE state = 'on'",
        ),
      "42501",
    );
    await closeTrackedPool(restoredPool);
    await closeTrackedPool(restoredControlPool);
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
  "Verified local PostgreSQL attestation, migration, seed, feature-flag immutability, constraints, transaction, race, reset, and logical restore.\n",
);
