import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { assertCiDatabaseEnvironment, assertCiServiceAddress } from "../src/ci-database-safety.js";

const APP_ROLE = "rituvia_ci_app";
const DATABASE_NAME = "rituvia_ci";
const repositoryRoot = path.resolve("../..");
const prismaEntry = path.resolve("node_modules/prisma/build/index.js");
const generatedClientDirectory = path.resolve("src/generated/prisma");

const environment = assertCiDatabaseEnvironment({
  adminPassword: process.env.RITUVIA_CI_DATABASE_PASSWORD,
  ci: process.env.CI,
  githubActions: process.env.GITHUB_ACTIONS,
  githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  githubRunId: process.env.GITHUB_RUN_ID,
});

let systemIdentifier = "";
let verificationStage = "environment validation";
let expectedMigrationNames: readonly string[] = [];

const readExpectedMigrationNames = async (): Promise<readonly string[]> => {
  const manifest = JSON.parse(
    await readFile(path.resolve("prisma/migration-manifest.json"), "utf8"),
  ) as { files?: Record<string, unknown> };
  const names = Object.keys(manifest.files ?? {})
    .flatMap((filePath) => {
      const match = /^migrations\/([^/]+)\/migration\.sql$/.exec(filePath);
      return match?.[1] === undefined ? [] : [match[1]];
    })
    .sort();
  assert.ok(names.length > 0);
  assert.equal(new Set(names).size, names.length);
  return Object.freeze(names);
};

const hashDirectory = async (root: string, relative = ""): Promise<string> => {
  const digest = createHash("sha256");
  const directory = path.join(root, relative);
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const entryRelative = path.join(relative, entry.name);
    const absolutePath = path.join(root, entryRelative);
    const metadata = await lstat(absolutePath);
    assert.equal(metadata.isSymbolicLink(), false);
    if (metadata.isDirectory()) {
      digest.update(`directory\0${entryRelative}\0${await hashDirectory(root, entryRelative)}`);
    } else if (metadata.isFile()) {
      digest.update(`file\0${entryRelative}\0`);
      digest.update(await readFile(absolutePath));
    } else {
      assert.fail("Generated client contains an unsupported filesystem entry.");
    }
  }
  return digest.digest("hex");
};

const trackedStatus = (): string =>
  execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=no"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

const prismaEnvironment = (): NodeJS.ProcessEnv => ({
  APP_ENV: "test",
  CI: "true",
  DATABASE_URL: environment.appUrl,
  GITHUB_ACTIONS: "true",
  GITHUB_RUN_ATTEMPT: process.env.GITHUB_RUN_ATTEMPT,
  GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
  HOME: process.env.HOME,
  PATH: [
    path.join(repositoryRoot, "node_modules/.bin"),
    path.dirname(process.execPath),
    "/usr/bin",
    "/bin",
  ].join(path.delimiter),
  RITUVIA_CI_POSTGRES_SYSTEM_IDENTIFIER: systemIdentifier,
  RITUVIA_SEED_TARGET: "ci",
  TMPDIR: process.env.TMPDIR,
});

const runPrisma = (label: string, args: readonly string[]): void => {
  const result = spawnSync(process.execPath, [prismaEntry, ...args], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: prismaEnvironment(),
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  if (
    result.status !== 0 ||
    result.error !== undefined ||
    result.stdout.includes(environment.appPassword) ||
    result.stderr.includes(environment.appPassword)
  ) {
    throw new Error(`Prisma command failed during ${label}.`);
  }
};

const provisionLeastPrivilegeRole = async (): Promise<void> => {
  verificationStage = "database service connection";
  const admin = new Client({
    connectionString: environment.adminUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  await admin.connect();
  try {
    verificationStage = "database service attestation";
    const attestation = await admin.query<{
      checksums: string;
      databaseName: string;
      inRecovery: boolean;
      serverAddress: string;
      serverPort: number;
      serverVersionNumber: number;
      systemIdentifier: string;
      userName: string;
    }>(`SELECT current_database() AS "databaseName",
              current_user AS "userName",
              host(inet_server_addr()) AS "serverAddress",
              inet_server_port() AS "serverPort",
              current_setting('server_version_num')::int AS "serverVersionNumber",
              current_setting('data_checksums') AS "checksums",
              pg_is_in_recovery() AS "inRecovery",
              (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier"`);
    const row = attestation.rows[0];
    assert.equal(row?.databaseName, DATABASE_NAME);
    assert.equal(row.userName, "rituvia_ci_admin");
    assertCiServiceAddress(row.serverAddress);
    assert.equal(row.serverPort, 5432);
    assert.equal(Math.trunc(row.serverVersionNumber / 10_000), 17);
    assert.equal(row.checksums, "on");
    assert.equal(row.inRecovery, false);
    assert.match(row.systemIdentifier, /^\d{10,}$/);
    systemIdentifier = row.systemIdentifier;

    const tables = await admin.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
    );
    assert.equal(tables.rows[0]?.count, 0);

    verificationStage = "least-privilege role statement formatting";
    const formatted = await admin.query<{ statement: string }>(
      "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS', $1::text, $2::text) AS statement",
      [APP_ROLE, environment.appPassword],
    );
    const statement = formatted.rows[0]?.statement;
    assert.ok(statement);
    verificationStage = "least-privilege role statement execution";
    await admin.query(statement);
    verificationStage = "CI database ownership transfer";
    await admin.query(`ALTER DATABASE ${DATABASE_NAME} OWNER TO ${APP_ROLE}`);
    verificationStage = "public schema privilege revocation";
    await admin.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
    verificationStage = "public schema ownership transfer";
    await admin.query(`ALTER SCHEMA public OWNER TO ${APP_ROLE}`);
    verificationStage = "system identity attestation grant";
    await admin.query(`GRANT EXECUTE ON FUNCTION pg_control_system() TO ${APP_ROLE}`);
  } finally {
    await admin.end();
  }
};

const expectConstraint = async (
  client: Client,
  query: string,
  values: readonly unknown[],
  constraint: string,
): Promise<void> => {
  try {
    await client.query(query, [...values]);
    assert.fail(`Expected constraint ${constraint}.`);
  } catch (error) {
    assert.equal((error as { constraint?: unknown }).constraint, constraint);
  }
};

const verifyMigratedDatabase = async (): Promise<void> => {
  verificationStage = "migrated database connection";
  const app = new Client({
    connectionString: environment.appUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  await app.connect();
  try {
    verificationStage = "migrated database invariants";
    const identity = await app.query<{
      databaseOwner: string;
      schemaOwner: string;
      systemIdentifier: string;
    }>(`SELECT pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())) AS "databaseOwner",
              pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'public')) AS "schemaOwner",
              (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier"`);
    assert.deepEqual(identity.rows[0], {
      databaseOwner: APP_ROLE,
      schemaOwner: APP_ROLE,
      systemIdentifier,
    });

    const role = await app.query<{
      bypassRls: boolean;
      canCreateDatabase: boolean;
      canCreateRole: boolean;
      replication: boolean;
      superuser: boolean;
    }>(`SELECT rolsuper AS "superuser",
              rolcreatedb AS "canCreateDatabase",
              rolcreaterole AS "canCreateRole",
              rolreplication AS "replication",
              rolbypassrls AS "bypassRls"
         FROM pg_roles WHERE rolname = current_user`);
    assert.deepEqual(role.rows[0], {
      bypassRls: false,
      canCreateDatabase: false,
      canCreateRole: false,
      replication: false,
      superuser: false,
    });

    const migrations = await app.query<{ migrationName: string }>(
      `SELECT migration_name AS "migrationName"
         FROM _prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name`,
    );
    assert.deepEqual(
      migrations.rows.map(({ migrationName }) => migrationName),
      expectedMigrationNames,
    );
    const seeds = await app.query<{
      checksumSha256: string;
      count: number;
      synthetic: boolean;
    }>(`SELECT count(*)::int AS count,
              min(checksum_sha256) AS "checksumSha256",
              bool_and(is_synthetic) AS synthetic
         FROM seed_manifest WHERE dataset_key = 'foundation-synthetic' AND version = 1`);
    assert.deepEqual(seeds.rows[0], {
      checksumSha256: "921224db98642ee1f9abc307c710066eb3a94a59c3caba29ffda110ee1928937",
      count: 1,
      synthetic: true,
    });

    await expectConstraint(
      app,
      "INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic) VALUES ($1, 1, $2, true)",
      ["Invalid Key", "a".repeat(64)],
      "seed_manifest_dataset_key_check",
    );
    await expectConstraint(
      app,
      "INSERT INTO seed_manifest (id, dataset_key, version, checksum_sha256, is_synthetic) VALUES ($1, $2, 1, $3, true)",
      ["6d393ec1-2019-4abc-9cf8-62f58c72efe8", "foundation-synthetic", "a".repeat(64)],
      "seed_manifest_pkey",
    );

    await app.query("BEGIN");
    await app.query(
      "INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic) VALUES ($1, 1, $2, true)",
      ["transaction-rollback", "b".repeat(64)],
    );
    await app.query("ROLLBACK");
    const rollback = await app.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = 'transaction-rollback'",
    );
    assert.equal(rollback.rows[0]?.count, 0);
  } finally {
    await app.end();
  }
};

try {
  verificationStage = "migration manifest loading";
  expectedMigrationNames = await readExpectedMigrationNames();
  await provisionLeastPrivilegeRole();
  const statusBeforeGeneration = trackedStatus();
  verificationStage = "client generation";
  runPrisma("client generation", ["generate"]);
  const firstGeneratedHash = await hashDirectory(generatedClientDirectory);
  verificationStage = "idempotent client generation";
  runPrisma("idempotent client generation", ["generate"]);
  assert.equal(await hashDirectory(generatedClientDirectory), firstGeneratedHash);
  assert.equal(trackedStatus(), statusBeforeGeneration);
  verificationStage = "first migration deployment";
  runPrisma("first migration deployment", ["migrate", "deploy"]);
  verificationStage = "idempotent migration deployment";
  runPrisma("idempotent migration deployment", ["migrate", "deploy"]);
  verificationStage = "first synthetic seed";
  runPrisma("first synthetic seed", ["db", "seed"]);
  verificationStage = "idempotent synthetic seed";
  runPrisma("idempotent synthetic seed", ["db", "seed"]);
  verificationStage = "migration status";
  runPrisma("migration status", ["migrate", "status"]);
  verificationStage = "schema drift check";
  runPrisma("schema drift check", [
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--exit-code",
  ]);
  await verifyMigratedDatabase();
  process.stdout.write(
    "Verified ephemeral CI PostgreSQL attestation, least privilege, migration idempotence/drift, seed idempotence, constraints, and transaction rollback.\n",
  );
} catch {
  process.stderr.write(
    `CI database foundation verification failed during ${verificationStage}; sensitive diagnostics were suppressed.\n`,
  );
  process.exitCode = 1;
}
