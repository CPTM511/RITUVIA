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

const EXPECTED_SEEDS = Object.freeze([
  Object.freeze({
    id: "6d393ec1-2019-4abc-9cf8-62f58c72efe8",
    datasetKey: "foundation-synthetic",
    version: 1,
    checksumSha256: "921224db98642ee1f9abc307c710066eb3a94a59c3caba29ffda110ee1928937",
    isSynthetic: true,
    createdAt: new Date("2026-07-16T00:00:00.000Z"),
  }),
  Object.freeze({
    id: "72d0431b-fdc7-4181-97d0-f9e1ae213cc1",
    datasetKey: "local-mvp-feature-flags",
    version: 1,
    checksumSha256: "5d898d56bcb06a0ac5a0871dcd67587ad7be8b319ea8214a6dba848da38f5c9a",
    isSynthetic: true,
    createdAt: new Date("2026-07-18T00:00:00.000Z"),
  }),
]);

const EXPECTED_LOCAL_PUBLIC_SHELL = Object.freeze({
  actorId: "owner.local-mvp",
  approvalReference: null,
  changeReference: "RIT-158",
  countryCodes: [],
  createdAt: new Date("2026-07-18T00:00:00.000Z"),
  effectiveAt: new Date("2026-07-18T00:00:00.000Z"),
  flagKey: "experience.public_shell",
  id: "d35f0bbb-b037-4bc8-8cb4-cb42a413535d",
  localeTags: [],
  registryVersion: 1,
  state: "on",
  version: 1,
});

const MVP_TABLES = Object.freeze([
  "account_session",
  "account_subject_link",
  "app_user",
  "auth_challenge",
  "auth_identity",
  "commerce_order",
  "commerce_order_line",
  "entitlement",
  "intention",
  "journal_entry",
  "ledger_entry",
  "payment_attempt",
  "payment_event",
  "ritual_session",
]);

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
  assert.equal(result.rowCount, EXPECTED_SEEDS.length);
  assert.deepEqual(result.rows, EXPECTED_SEEDS);
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
      "202607180001_interpretation_generation",
      "202607180002_interpretation_verification",
      "202607180003_account_identity",
      "202607180004_reflection_loop",
      "202607180005_commerce",
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

  const criticalRowSecurity = await pool.query(`
    SELECT relation.relname AS "tableName",
           relation.relrowsecurity AS "rowSecurity",
           relation.relforcerowsecurity AS "forceRowSecurity",
           count(policy.oid)::int AS "policyCount"
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      LEFT JOIN pg_policy AS policy ON policy.polrelid = relation.oid
     WHERE namespace.nspname = 'public'
       AND relation.relname IN (
         'feature_flag_version', 'interpretation', 'interpretation_verification'
       )
     GROUP BY relation.relname, relation.relrowsecurity, relation.relforcerowsecurity
     ORDER BY relation.relname
  `);
  assert.deepEqual(criticalRowSecurity.rows, [
    {
      forceRowSecurity: true,
      policyCount: 2,
      rowSecurity: true,
      tableName: "feature_flag_version",
    },
    {
      forceRowSecurity: true,
      policyCount: 3,
      rowSecurity: true,
      tableName: "interpretation",
    },
    {
      forceRowSecurity: true,
      policyCount: 2,
      rowSecurity: true,
      tableName: "interpretation_verification",
    },
  ]);
};

const verifyProductTablesStartEmpty = async (pool) => {
  const result = await pool.query(`
    SELECT (SELECT count(*)::int FROM anonymous_subject) AS "anonymousSubjects",
           (SELECT count(*)::int FROM anonymous_session) AS "anonymousSessions",
           (SELECT count(*)::int FROM consent_record) AS consents,
           (SELECT count(*)::int FROM anonymous_session_issuance_gate) AS "issuanceGates",
           (SELECT count(*)::int FROM reading) AS readings,
           (SELECT count(*)::int FROM tarot_draw) AS draws,
           (SELECT count(*)::int FROM reading_report) AS reports,
           (SELECT count(*)::int FROM interpretation) AS interpretations,
           (SELECT count(*)::int FROM interpretation_verification) AS verifications,
           (SELECT count(*)::int FROM app_user) AS users,
           (SELECT count(*)::int FROM auth_identity) AS "authIdentities",
           (SELECT count(*)::int FROM auth_challenge) AS "authChallenges",
           (SELECT count(*)::int FROM account_session) AS "accountSessions",
           (SELECT count(*)::int FROM account_subject_link) AS "accountSubjectLinks",
           (SELECT count(*)::int FROM intention) AS intentions,
           (SELECT count(*)::int FROM ritual_session) AS "ritualSessions",
           (SELECT count(*)::int FROM journal_entry) AS "journalEntries",
           (SELECT count(*)::int FROM commerce_order) AS "commerceOrders",
           (SELECT count(*)::int FROM commerce_order_line) AS "commerceOrderLines",
           (SELECT count(*)::int FROM payment_attempt) AS "paymentAttempts",
           (SELECT count(*)::int FROM payment_event) AS "paymentEvents",
           (SELECT count(*)::int FROM ledger_entry) AS "ledgerEntries",
           (SELECT count(*)::int FROM entitlement) AS entitlements
  `);
  assert.deepEqual(result.rows[0], {
    accountSessions: 0,
    accountSubjectLinks: 0,
    anonymousSessions: 0,
    anonymousSubjects: 0,
    authChallenges: 0,
    authIdentities: 0,
    commerceOrderLines: 0,
    commerceOrders: 0,
    consents: 0,
    draws: 0,
    entitlements: 0,
    issuanceGates: 0,
    intentions: 0,
    interpretations: 0,
    journalEntries: 0,
    ledgerEntries: 0,
    paymentAttempts: 0,
    paymentEvents: 0,
    readings: 0,
    reports: 0,
    ritualSessions: 0,
    users: 0,
    verifications: 0,
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

    const rolePosture = await client.query(`
      SELECT rolsuper AS "superuser", rolcreatedb AS "createDatabase",
             rolcreaterole AS "createRole", rolreplication AS replication,
             rolbypassrls AS "bypassRowSecurity"
        FROM pg_roles
       WHERE rolname = current_user
    `);
    assert.deepEqual(rolePosture.rows[0], {
      bypassRowSecurity: false,
      createDatabase: false,
      createRole: false,
      replication: false,
      superuser: false,
    });

    const mvpOwners = await client.query(
      `SELECT relation.relname AS "tableName", pg_get_userbyid(relation.relowner) AS owner
         FROM pg_class AS relation
         JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public' AND relation.relname = ANY($1::text[])
        ORDER BY relation.relname`,
      [MVP_TABLES],
    );
    assert.deepEqual(
      mvpOwners.rows,
      MVP_TABLES.map((tableName) => ({
        owner: localPostgresConstants.migratorRole,
        tableName,
      })),
    );

    const tablePrivileges = await client.query(
      `SELECT table_name AS "tableName",
              json_agg(privilege_type ORDER BY privilege_type) AS privileges
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee = current_user
          AND table_name = ANY($1::text[])
        GROUP BY table_name
        ORDER BY table_name`,
      [MVP_TABLES],
    );
    assert.deepEqual(
      tablePrivileges.rows,
      MVP_TABLES.map((tableName) => ({ privileges: ["INSERT", "SELECT"], tableName })),
    );

    const updatePrivileges = await client.query(
      `SELECT table_name AS "tableName",
              json_agg(column_name ORDER BY column_name) AS columns
         FROM information_schema.column_privileges
        WHERE table_schema = 'public'
          AND grantee = current_user
          AND privilege_type = 'UPDATE'
          AND table_name = ANY($1::text[])
        GROUP BY table_name
        ORDER BY table_name`,
      [MVP_TABLES],
    );
    assert.deepEqual(updatePrivileges.rows, [
      { columns: ["last_seen_at", "revoked_at"], tableName: "account_session" },
      {
        columns: [
          "age_attested_at",
          "age_policy_version",
          "display_name",
          "last_active_at",
          "locale",
          "profile_version",
          "time_zone",
        ],
        tableName: "app_user",
      },
      { columns: ["consumed_at"], tableName: "auth_challenge" },
      { columns: ["last_sign_in_at"], tableName: "auth_identity" },
      {
        columns: ["refunded_minor", "status", "updated_at"],
        tableName: "commerce_order",
      },
      {
        columns: ["granted_at", "revoked_at", "source_order_line_id", "status", "version"],
        tableName: "entitlement",
      },
      { columns: ["state", "updated_at"], tableName: "payment_attempt" },
      {
        columns: ["order_id", "payment_attempt_id", "processed_at", "processing_state"],
        tableName: "payment_event",
      },
    ]);

    const destructivePrivileges = await client.query(
      `SELECT table_name AS "tableName",
              has_table_privilege(current_user, format('public.%I', table_name), 'DELETE') AS "canDelete",
              has_table_privilege(current_user, format('public.%I', table_name), 'TRUNCATE') AS "canTruncate",
              has_table_privilege(current_user, format('public.%I', table_name), 'REFERENCES') AS "canReference",
              has_table_privilege(current_user, format('public.%I', table_name), 'TRIGGER') AS "canTrigger",
              has_table_privilege(current_user, format('public.%I', table_name), 'UPDATE') AS "canUpdateTable"
         FROM unnest($1::text[]) AS table_name
        ORDER BY table_name`,
      [MVP_TABLES],
    );
    for (const privilege of destructivePrivileges.rows) {
      assert.deepEqual(privilege, {
        canDelete: false,
        canReference: false,
        canTrigger: false,
        canTruncate: false,
        canUpdateTable: false,
        tableName: privilege.tableName,
      });
    }
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
  const initial = await runtimePool.query(`
    SELECT id::text AS id, registry_version AS "registryVersion", flag_key AS "flagKey",
           version, state, country_codes AS "countryCodes", locale_tags AS "localeTags",
           effective_at AS "effectiveAt", approval_reference AS "approvalReference",
           change_reference AS "changeReference", actor_id AS "actorId",
           created_at AS "createdAt"
      FROM feature_flag_version
     ORDER BY registry_version, flag_key, version
  `);
  assert.deepEqual(initial.rows, [EXPECTED_LOCAL_PUBLIC_SHELL]);

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
      version: 2,
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
    version: 1,
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
  await insert({ registryVersion: 2, version: 1 });

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
      state: "on",
      version: 1,
    },
    {
      approvalReference: null,
      countryCodes: [],
      flagKey: "experience.public_shell",
      registryVersion: 1,
      state: "off",
      version: 2,
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
    await verifyProductTablesStartEmpty(pool);
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
    await verifyProductTablesStartEmpty(pool);
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
    await verifyProductTablesStartEmpty(restoredPool);
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
  "Verified local PostgreSQL attestation, all MVP migrations, seed, least privileges, RLS, empty product tables, constraints, transaction, race, reset, and logical restore.\n",
);
