import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, statSync } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

import {
  assertArtifactIntegrity,
  assertBackupArtifactMetadata,
  assertBackupCleanup,
  assertBackupDatabaseBoundary,
  assertEquivalentRestoreSnapshots,
  backupRecoveryPolicyVersion,
  createBackupRecoveryEvidence,
  type BackupRecoveryMode,
  type BackupRecoverySnapshot,
} from "../src/backup-recovery.js";
import { assertCiDatabaseEnvironment, assertCiServiceAddress } from "../src/ci-database-safety.js";
import {
  ensureRuntimeDatabasePrivileges,
  localPostgresConstants,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
  type LocalPostgresLease,
} from "./local-postgres.mjs";
import { verifySchemaDriftBaseline } from "./schema-drift-baseline.js";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const databasePackageRoot = path.join(repositoryRoot, "packages", "db");
const evidenceDirectory = path.join(repositoryRoot, ".local", "evidence", "backup-recovery");
const evidencePath = path.join(evidenceDirectory, "latest.json");
const customDumpSignature = "PGDMP";
const sourceSentinel = "backup-restore-drill";
const afterSnapshotSentinel = "backup-after-snapshot";
const sentinelChecksum = createHash("sha256").update(backupRecoveryPolicyVersion).digest("hex");
const pinnedPostgresImage =
  "postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394";

type DatabaseHandle = Readonly<{
  appUrl: string;
  databaseName: string;
  migrationUrl: string;
  snapshotUrl: string;
}>;

type DrillContext = Readonly<{
  cleanupSource: () => Promise<void>;
  cleanupTarget: () => Promise<void>;
  mode: BackupRecoveryMode;
  postgresCommand: Readonly<{
    dumpArgsPrefix: readonly string[];
    dumpEnvironment: NodeJS.ProcessEnv;
    dumpExecutable: string;
    host: string;
    port: number;
    restoreArgsPrefix: readonly string[];
    restoreEnvironment: NodeJS.ProcessEnv;
    restoreExecutable: string;
  }>;
  runMigrations: (databaseUrl: string) => Promise<void>;
  verifySchema: (databaseUrl: string) => void;
  source: DatabaseHandle;
  target: DatabaseHandle;
}>;

type SnapshotDetail = Readonly<{
  canonicalSha256: string;
  componentDigests: Readonly<Record<string, string>>;
  componentEntryDigests: Readonly<Record<string, Readonly<Record<string, string>>>>;
  postgresVersionNumber: number;
  summary: BackupRecoverySnapshot;
}>;

const fail = (message: string): never => {
  throw new Error(message);
};

const quoteIdentifier = (value: string): string => {
  if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(value)) {
    return fail("Database identifier is unsafe.");
  }
  return `"${value}"`;
};

const safeProcessEnvironment = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  APP_ENV: process.env.APP_ENV,
  CI: process.env.CI,
  GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
  GITHUB_RUN_ATTEMPT: process.env.GITHUB_RUN_ATTEMPT,
  GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
  HOME: process.env.HOME ?? repositoryRoot,
  LANG: "C",
  LC_ALL: "C",
  PATH: [
    path.join(repositoryRoot, "node_modules", ".bin"),
    path.dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ].join(path.delimiter),
  TMPDIR: process.env.TMPDIR ?? os.tmpdir(),
  ...extra,
});

const runFileCommand = ({
  args,
  environment,
  executable,
  inputPath,
  outputPath,
}: Readonly<{
  args: readonly string[];
  environment: NodeJS.ProcessEnv;
  executable: string;
  inputPath?: string;
  outputPath?: string;
}>): void => {
  let inputDescriptor: number | undefined;
  let outputDescriptor: number | undefined;
  try {
    inputDescriptor = inputPath === undefined ? undefined : openSync(inputPath, "r");
    outputDescriptor = outputPath === undefined ? undefined : openSync(outputPath, "wx", 0o600);
    const result = spawnSync(executable, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: safeProcessEnvironment(environment),
      maxBuffer: 64 * 1024,
      shell: false,
      stdio: [inputDescriptor ?? "ignore", outputDescriptor ?? "pipe", "pipe"],
      timeout: 180_000,
    });
    if (result.status !== 0 || result.error !== undefined) {
      fail("Backup recovery PostgreSQL command failed; sensitive diagnostics were suppressed.");
    }
  } finally {
    if (inputDescriptor !== undefined) closeSync(inputDescriptor);
    if (outputDescriptor !== undefined) closeSync(outputDescriptor);
  }
};

const assertNotSymlink = async (targetPath: string, label: string): Promise<void> => {
  try {
    if ((await lstat(targetPath)).isSymbolicLink()) {
      fail(`${label} must not be a symbolic link.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

const createArtifactDirectory = async (): Promise<string> => {
  const root = path.join(repositoryRoot, ".local", "backup-recovery");
  await assertNotSymlink(path.join(repositoryRoot, ".local"), "Local state directory");
  await assertNotSymlink(root, "Backup recovery root");
  await mkdir(root, { mode: 0o700, recursive: true });
  await chmod(root, 0o700);
  await assertNotSymlink(root, "Backup recovery root");
  const directory = await mkdtemp(path.join(root, "drill-"));
  await chmod(directory, 0o700);
  await assertNotSymlink(directory, "Backup recovery invocation directory");
  return directory;
};

const hashFile = async (filePath: string): Promise<string> => {
  const digest = createHash("sha256");
  const contents = await readFile(filePath);
  digest.update(contents);
  return digest.digest("hex");
};

const readArtifactSignature = async (filePath: string): Promise<string> =>
  (await readFile(filePath)).subarray(0, customDumpSignature.length).toString("ascii");

const replaceDatabase = (databaseUrl: string, databaseName: string): string => {
  quoteIdentifier(databaseName);
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> => {
  let observed: unknown;
  try {
    await operation();
  } catch (error) {
    observed = (error as { code?: unknown }).code;
  }
  assert.equal(observed, expectedCode);
};

const insertSentinel = async (databaseUrl: string, key: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO seed_manifest
        (dataset_key, version, checksum_sha256, is_synthetic)
       VALUES ($1, 1, $2, true)`,
      [key, sentinelChecksum],
    );
  } finally {
    await client.end();
  }
};

const deleteSentinels = async (databaseUrl: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("DELETE FROM seed_manifest WHERE dataset_key = ANY($1::text[])", [
      [sourceSentinel, afterSnapshotSentinel],
    ]);
  } finally {
    await client.end();
  }
};

const readSnapshot = async (databaseUrl: string): Promise<SnapshotDetail> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const version = await client.query<{ value: string }>(
      "SELECT current_setting('server_version_num') AS value",
    );
    const migrations = await client.query<{
      checksum: string;
      finished: boolean;
      migrationName: string;
      rolledBack: boolean;
    }>(`SELECT checksum,
              finished_at IS NOT NULL AS finished,
              migration_name AS "migrationName",
              rolled_back_at IS NOT NULL AS "rolledBack"
         FROM "_prisma_migrations"
        ORDER BY migration_name`);
    const tableResult = await client.query<{
      forceRowSecurity: boolean;
      owner: string;
      rowSecurity: boolean;
      tableName: string;
    }>(`SELECT relation.relforcerowsecurity AS "forceRowSecurity",
              pg_get_userbyid(relation.relowner) AS owner,
              relation.relrowsecurity AS "rowSecurity",
              relation.relname AS "tableName"
         FROM pg_class AS relation
         JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p')
        ORDER BY relation.relname`);
    const tables = [];
    for (const { forceRowSecurity, owner, rowSecurity, tableName } of tableResult.rows) {
      const rowCount = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${quoteIdentifier(tableName)}`,
      );
      tables.push(
        Object.freeze({
          forceRowSecurity,
          owner,
          rowCount: rowCount.rows[0]?.count ?? -1,
          rowSecurity,
          tableName,
        }),
      );
    }
    const constraints = await client.query<{
      constraintName: string;
      constraintType: string;
      relationName: string | null;
      validated: boolean;
    }>(`SELECT constraint_item.conname AS "constraintName",
              constraint_item.contype::text AS "constraintType",
              relation.relname AS "relationName",
              constraint_item.convalidated AS validated
         FROM pg_constraint AS constraint_item
         JOIN pg_namespace AS namespace ON namespace.oid = constraint_item.connamespace
         LEFT JOIN pg_class AS relation ON relation.oid = constraint_item.conrelid
        WHERE namespace.nspname = 'public'
        ORDER BY relation.relname NULLS FIRST, constraint_item.conname`);
    const indexes = await client.query<{
      indexName: string;
      isPrimary: boolean;
      isReady: boolean;
      isUnique: boolean;
      isValid: boolean;
      tableName: string;
    }>(
      `SELECT index_class.relname AS "indexName",
              index.indisprimary AS "isPrimary",
              index.indisready AS "isReady",
              index.indisunique AS "isUnique",
              index.indisvalid AS "isValid",
              table_class.relname AS "tableName"
         FROM pg_index AS index
         JOIN pg_class AS index_class ON index_class.oid = index.indexrelid
         JOIN pg_class AS table_class ON table_class.oid = index.indrelid
         JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
        WHERE namespace.nspname = 'public'
        ORDER BY index_class.relname`,
    );
    const privileges = await client.query<{
      grantee: string;
      privilege: string;
      relationName: string;
    }>(`SELECT COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
              acl.privilege_type AS privilege,
              relation.relname AS "relationName"
         FROM pg_class AS relation
         JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         CROSS JOIN LATERAL
              aclexplode(
                COALESCE(
                  relation.relacl,
                  acldefault(
                    CASE WHEN relation.relkind = 'S' THEN 'S'::"char" ELSE 'r'::"char" END,
                    relation.relowner
                  )
                )
              ) AS acl
         LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p', 'S')
        ORDER BY relation.relname, grantee, privilege`);
    const databasePrivileges = await client.query<{
      grantee: string;
      owner: string;
      privilege: string;
    }>(`SELECT COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
              pg_get_userbyid(database.datdba) AS owner,
              acl.privilege_type AS privilege
         FROM pg_database AS database
         CROSS JOIN LATERAL
              aclexplode(COALESCE(database.datacl, acldefault('d'::"char", database.datdba))) AS acl
         LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
        WHERE database.datname = current_database()
        ORDER BY grantee, privilege`);
    const schemaPrivileges = await client.query<{
      grantee: string;
      owner: string;
      privilege: string;
    }>(`SELECT COALESCE(grantee.rolname, 'PUBLIC') AS grantee,
              pg_get_userbyid(namespace.nspowner) AS owner,
              acl.privilege_type AS privilege
         FROM pg_namespace AS namespace
         CROSS JOIN LATERAL
              aclexplode(COALESCE(namespace.nspacl, acldefault('n'::"char", namespace.nspowner))) AS acl
         LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
        WHERE namespace.nspname = 'public'
        ORDER BY grantee, privilege`);
    const policies = await client.query<{
      command: string;
      permissive: string;
      policyName: string;
      roles: string[];
      tableName: string;
    }>(`SELECT cmd AS command,
              permissive,
              policyname AS "policyName",
              roles,
              tablename AS "tableName"
         FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname`);
    const roleAttributes = await client.query<{
      bypassRowSecurity: boolean;
      canCreateDatabase: boolean;
      canCreateRole: boolean;
      canLogin: boolean;
      canReplicate: boolean;
      isSuperuser: boolean;
      roleName: string;
    }>(`SELECT rolbypassrls AS "bypassRowSecurity",
              rolcreatedb AS "canCreateDatabase",
              rolcreaterole AS "canCreateRole",
              rolcanlogin AS "canLogin",
              rolreplication AS "canReplicate",
              rolsuper AS "isSuperuser",
              rolname AS "roleName"
         FROM pg_roles
        WHERE rolname LIKE 'rituvia_%'
        ORDER BY rolname`);
    const roleMembership = await client.query<{ member: string; roleName: string }>(
      `SELECT member_role.rolname AS member,
              granted_role.rolname AS "roleName"
         FROM pg_auth_members AS membership
         JOIN pg_roles AS member_role ON member_role.oid = membership.member
         JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
        WHERE member_role.rolname LIKE 'rituvia_%'
           OR granted_role.rolname LIKE 'rituvia_%'
        ORDER BY member_role.rolname, granted_role.rolname`,
    );
    const sentinels = await client.query<{
      checksumSha256: string;
      datasetKey: string;
      isSynthetic: boolean;
      version: number;
    }>(
      `SELECT checksum_sha256 AS "checksumSha256",
              dataset_key AS "datasetKey",
              is_synthetic AS "isSynthetic",
              version
         FROM seed_manifest
        WHERE dataset_key = ANY($1::text[])
        ORDER BY dataset_key`,
      [[sourceSentinel, afterSnapshotSentinel]],
    );
    const components = {
      constraints: constraints.rows,
      databasePrivileges: databasePrivileges.rows,
      indexes: indexes.rows,
      migrations: migrations.rows,
      policies: policies.rows,
      privileges: privileges.rows,
      roleAttributes: roleAttributes.rows,
      roleMembership: roleMembership.rows,
      schemaPrivileges: schemaPrivileges.rows,
      sentinels: sentinels.rows,
      tables,
    };
    const canonical = JSON.stringify(components);
    const snapshotSha256 = createHash("sha256").update(canonical).digest("hex");
    const componentDigests = Object.freeze(
      Object.fromEntries(
        Object.entries(components).map(([name, value]) => [
          name,
          createHash("sha256").update(JSON.stringify(value)).digest("hex"),
        ]),
      ),
    );
    const digestEntries = (
      rows: readonly Record<string, unknown>[],
      identity: (row: Record<string, unknown>) => string,
    ): Readonly<Record<string, string>> =>
      Object.freeze(
        Object.fromEntries(
          rows.map((row) => [
            identity(row),
            createHash("sha256").update(JSON.stringify(row)).digest("hex"),
          ]),
        ),
      );
    const componentEntryDigests = Object.freeze({
      constraints: digestEntries(
        constraints.rows,
        (row) => `${String(row.relationName)}:${String(row.constraintName)}`,
      ),
      indexes: digestEntries(indexes.rows, (row) => String(row.indexName)),
      policies: digestEntries(
        policies.rows,
        (row) => `${String(row.tableName)}:${String(row.policyName)}`,
      ),
    });
    const totalRows = tables.reduce((total, table) => total + table.rowCount, 0);
    const summary = Object.freeze({
      constraintCount: constraints.rowCount ?? 0,
      indexCount: indexes.rowCount ?? 0,
      migrationCount: migrations.rowCount ?? 0,
      privilegeCount: privileges.rowCount ?? 0,
      snapshotSha256,
      tableCount: tables.length,
      totalRows,
    });
    assert.ok(summary.migrationCount > 0);
    assert.ok(summary.tableCount > 0);
    assert.ok(summary.constraintCount > 0);
    assert.ok(summary.indexCount > 0);
    assert.ok(summary.privilegeCount > 0);
    assert.deepEqual(sentinels.rows, [
      {
        checksumSha256: sentinelChecksum,
        datasetKey: sourceSentinel,
        isSynthetic: true,
        version: 1,
      },
    ]);
    return Object.freeze({
      canonicalSha256: snapshotSha256,
      componentDigests,
      componentEntryDigests,
      postgresVersionNumber: Number(version.rows[0]?.value),
      summary,
    });
  } finally {
    await client.end();
  }
};

const assertTargetEmpty = async (databaseUrl: string): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM pg_class AS relation
         JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')`,
    );
    assert.equal(result.rows[0]?.count, 0);
  } finally {
    await client.end();
  }
};

const assertRuntimeLeastPrivilege = async (database: DatabaseHandle): Promise<void> => {
  const client = new Client({ connectionString: database.appUrl });
  await client.connect();
  try {
    const identity = await client.query<{ userName: string }>('SELECT current_user AS "userName"');
    assert.match(identity.rows[0]?.userName ?? "", /^rituvia_(?:ci_)?app$/u);
    const sentinel = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = $1",
      [sourceSentinel],
    );
    assert.equal(sentinel.rows[0]?.count, 1);
    const postSnapshot = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = $1",
      [afterSnapshotSentinel],
    );
    assert.equal(postSnapshot.rows[0]?.count, 0);
    await expectPostgresError(
      () => client.query("CREATE TABLE backup_recovery_escape (id integer)"),
      "42501",
    );
    await expectPostgresError(
      () => client.query("DELETE FROM seed_manifest WHERE dataset_key = $1", [sourceSentinel]),
      "42501",
    );
  } finally {
    await client.end();
  }
};

const runBackup = (context: DrillContext, artifactPath: string): void => {
  runFileCommand({
    args: [
      ...context.postgresCommand.dumpArgsPrefix,
      "--host",
      context.postgresCommand.host,
      "--port",
      String(context.postgresCommand.port),
      "--username",
      context.mode === "ci" ? "rituvia_ci_admin" : "rituvia_local_admin",
      "--dbname",
      context.source.databaseName,
      "--format",
      "custom",
      "--compress",
      "zstd:level=6",
      "--no-owner",
    ],
    environment: context.postgresCommand.dumpEnvironment,
    executable: context.postgresCommand.dumpExecutable,
    outputPath: artifactPath,
  });
};

const runRestore = (context: DrillContext, artifactPath: string): void => {
  runFileCommand({
    args: [
      ...context.postgresCommand.restoreArgsPrefix,
      "--host",
      context.postgresCommand.host,
      "--port",
      String(context.postgresCommand.port),
      "--username",
      context.mode === "ci" ? "rituvia_ci_migrator" : "rituvia_migrator",
      "--dbname",
      context.target.databaseName,
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
    ],
    environment: context.postgresCommand.restoreEnvironment,
    executable: context.postgresCommand.restoreExecutable,
    inputPath: artifactPath,
  });
};

const runPrismaForCi = (
  databaseUrl: string,
  systemIdentifier: string,
  arguments_: readonly string[],
): string => {
  const prismaEntry = path.join(databasePackageRoot, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [prismaEntry, ...arguments_], {
    cwd: databasePackageRoot,
    encoding: "utf8",
    env: safeProcessEnvironment({
      APP_ENV: "test",
      DATABASE_URL: databaseUrl,
      RITUVIA_CI_POSTGRES_SYSTEM_IDENTIFIER: systemIdentifier,
      RITUVIA_SEED_TARGET: "ci",
    }),
    maxBuffer: 64 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  if (result.status !== 0 || result.error !== undefined) {
    fail("Restored database migration verification failed; diagnostics were suppressed.");
  }
  return result.stdout;
};

const verifyRestoredSchema = (schemaDriftOutput: string): void => {
  const baseline = JSON.parse(
    readFileSync(path.join(databasePackageRoot, "prisma", "schema-drift-baseline.json"), "utf8"),
  ) as unknown;
  const prismaManifest = JSON.parse(
    readFileSync(path.join(databasePackageRoot, "node_modules", "prisma", "package.json"), "utf8"),
  ) as { version?: unknown };
  if (typeof prismaManifest.version !== "string") {
    throw new Error("Installed Prisma version is invalid.");
  }
  verifySchemaDriftBaseline(schemaDriftOutput, baseline, prismaManifest.version);
};

const discoverCiPostgresContainer = (): string => {
  const runningContainers = execFileSync("docker", ["ps", "--format", "{{.ID}}"], {
    encoding: "utf8",
    env: safeProcessEnvironment(),
    maxBuffer: 64 * 1024,
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const matchingContainers = runningContainers.filter((containerId) => {
    if (!/^[0-9a-f]{12,64}$/u.test(containerId)) return false;
    const configuredImage = JSON.parse(
      execFileSync("docker", ["inspect", "--format", "{{json .Config.Image}}", containerId], {
        encoding: "utf8",
        env: safeProcessEnvironment(),
        maxBuffer: 64 * 1024,
      }).trim(),
    ) as unknown;
    return configuredImage === pinnedPostgresImage;
  });
  if (matchingContainers.length !== 1) {
    return fail("Exact ephemeral PostgreSQL service container was not found.");
  }
  return matchingContainers[0] as string;
};

const createCiContext = async (): Promise<DrillContext> => {
  const environment = assertCiDatabaseEnvironment({
    adminPassword: process.env.RITUVIA_CI_DATABASE_PASSWORD,
    ci: process.env.CI,
    githubActions: process.env.GITHUB_ACTIONS,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    githubRunId: process.env.GITHUB_RUN_ID,
  });
  const runId = process.env.GITHUB_RUN_ID as string;
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT as string;
  const targetDatabaseName = `rituvia_restore_${runId}_${runAttempt}`;
  assertBackupDatabaseBoundary("ci", "rituvia_ci", targetDatabaseName);
  const admin = new Client({ connectionString: environment.adminUrl });
  await admin.connect();
  let targetCreated = false;
  try {
    const source = await admin.query<{
      checksums: string;
      databaseName: string;
      inRecovery: boolean;
      serverAddress: string;
      serverPort: number;
      serverVersionNumber: number;
      systemIdentifier: string;
      userName: string;
    }>(`SELECT current_database() AS "databaseName",
              current_setting('data_checksums') AS checksums,
              pg_is_in_recovery() AS "inRecovery",
              host(inet_server_addr()) AS "serverAddress",
              inet_server_port() AS "serverPort",
              current_setting('server_version_num')::int AS "serverVersionNumber",
              (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier",
              current_user AS "userName"`);
    assert.equal(source.rows[0]?.databaseName, "rituvia_ci");
    assert.equal(source.rows[0]?.userName, "rituvia_ci_admin");
    assertCiServiceAddress(source.rows[0]?.serverAddress);
    assert.equal(source.rows[0]?.serverPort, 5432);
    assert.equal(Math.trunc((source.rows[0]?.serverVersionNumber ?? 0) / 10_000), 17);
    assert.equal(source.rows[0]?.checksums, "on");
    assert.equal(source.rows[0]?.inRecovery, false);
    assert.match(source.rows[0]?.systemIdentifier ?? "", /^\d{10,}$/u);
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      targetDatabaseName,
    ]);
    assert.equal(existing.rowCount, 0);
    await admin.query(
      `CREATE DATABASE ${quoteIdentifier(targetDatabaseName)} OWNER rituvia_ci_migrator TEMPLATE template0`,
    );
    targetCreated = true;
    await admin.query(`REVOKE ALL ON DATABASE ${quoteIdentifier(targetDatabaseName)} FROM PUBLIC`);
    await admin.query(
      `GRANT CONNECT ON DATABASE ${quoteIdentifier(targetDatabaseName)}
         TO rituvia_ci_app, rituvia_ci_config_writer, rituvia_privacy_deletion, rituvia_admin_service`,
    );
    const targetMigrationUrl = replaceDatabase(environment.migratorUrl, targetDatabaseName);
    const targetAppUrl = replaceDatabase(environment.appUrl, targetDatabaseName);
    const targetAdminUrl = replaceDatabase(environment.adminUrl, targetDatabaseName);
    const containerId = discoverCiPostgresContainer();
    const cleanupTarget = async (): Promise<void> => {
      if (!targetCreated) return;
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [targetDatabaseName],
      );
      await admin.query(`DROP DATABASE ${quoteIdentifier(targetDatabaseName)}`);
      targetCreated = false;
    };
    const cleanupSource = async (): Promise<void> => {
      await deleteSentinels(environment.migratorUrl);
      await admin.end();
    };
    const normalizeTargetPrivileges = async (): Promise<void> => {
      const targetAdmin = new Client({ connectionString: targetAdminUrl });
      await targetAdmin.connect();
      try {
        await targetAdmin.query("ALTER SCHEMA public OWNER TO rituvia_ci_migrator");
        await targetAdmin.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
        await targetAdmin.query(
          `REVOKE ALL ON SCHEMA public
             FROM rituvia_ci_app, rituvia_ci_config_writer, rituvia_privacy_deletion, rituvia_admin_service`,
        );
        await targetAdmin.query(
          `GRANT USAGE ON SCHEMA public
             TO rituvia_ci_app, rituvia_ci_config_writer, rituvia_privacy_deletion, rituvia_admin_service`,
        );
      } finally {
        await targetAdmin.end();
      }
    };
    return Object.freeze({
      cleanupSource,
      cleanupTarget,
      mode: "ci" as const,
      postgresCommand: Object.freeze({
        dumpArgsPrefix: Object.freeze(["exec", "--env", "PGPASSWORD", containerId, "pg_dump"]),
        dumpEnvironment: Object.freeze({
          PGPASSWORD: process.env.RITUVIA_CI_DATABASE_PASSWORD,
        }),
        dumpExecutable: "docker",
        host: "127.0.0.1",
        port: 5432,
        restoreArgsPrefix: Object.freeze([
          "exec",
          "--interactive",
          "--env",
          "PGPASSWORD",
          containerId,
          "pg_restore",
        ]),
        restoreEnvironment: Object.freeze({ PGPASSWORD: environment.migratorPassword }),
        restoreExecutable: "docker",
      }),
      runMigrations: async (databaseUrl: string) => {
        runPrismaForCi(databaseUrl, source.rows[0]?.systemIdentifier ?? "", ["migrate", "deploy"]);
        runPrismaForCi(databaseUrl, source.rows[0]?.systemIdentifier ?? "", ["migrate", "deploy"]);
        await normalizeTargetPrivileges();
      },
      verifySchema: (databaseUrl: string) => {
        verifyRestoredSchema(
          runPrismaForCi(databaseUrl, source.rows[0]?.systemIdentifier ?? "", [
            "migrate",
            "diff",
            "--from-config-datasource",
            "--to-schema",
            "prisma/schema.prisma",
            "--script",
          ]),
        );
      },
      source: Object.freeze({
        appUrl: environment.appUrl,
        databaseName: "rituvia_ci",
        migrationUrl: environment.migratorUrl,
        snapshotUrl: environment.adminUrl,
      }),
      target: Object.freeze({
        appUrl: targetAppUrl,
        databaseName: targetDatabaseName,
        migrationUrl: targetMigrationUrl,
        snapshotUrl: targetAdminUrl,
      }),
    });
  } catch (error) {
    if (targetCreated) {
      await admin
        .query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [targetDatabaseName],
        )
        .catch(() => undefined);
      await admin
        .query(`DROP DATABASE IF EXISTS ${quoteIdentifier(targetDatabaseName)}`)
        .catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
    throw error;
  }
};

const createLocalContext = async (lease: LocalPostgresLease): Promise<DrillContext> => {
  if (
    process.env.CI === "true" ||
    process.env.GITHUB_ACTIONS === "true" ||
    ![undefined, "", "local"].includes(process.env.APP_ENV)
  ) {
    fail("Local backup recovery rehearsal environment is unsafe.");
  }
  const source = await lease.createTestDatabase();
  let target: Awaited<ReturnType<LocalPostgresLease["createTestDatabase"]>> | undefined;
  try {
    target = await lease.createTestDatabase();
    assertBackupDatabaseBoundary("local", source.databaseName, target.databaseName);
    runLocalPrisma(lease.runtime, source.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, source.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, source.migrationDatabaseUrl, ["db", "seed"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, source.databaseName);
    let sourceActive = true;
    let targetActive = true;
    return Object.freeze({
      cleanupSource: async () => {
        if (!sourceActive) return;
        await source.drop();
        sourceActive = false;
      },
      cleanupTarget: async () => {
        if (!targetActive || target === undefined) return;
        await target.drop();
        targetActive = false;
      },
      mode: "local" as const,
      postgresCommand: Object.freeze({
        dumpArgsPrefix: Object.freeze([]),
        dumpEnvironment: Object.freeze({
          PGPASSWORD: lease.runtime.credentials.adminPassword,
        }),
        dumpExecutable: lease.runtime.binaries.pg_dump,
        host: localPostgresConstants.host,
        port: localPostgresConstants.port,
        restoreArgsPrefix: Object.freeze([]),
        restoreEnvironment: Object.freeze({
          PGPASSWORD: lease.runtime.credentials.migratorPassword,
        }),
        restoreExecutable: lease.runtime.binaries.pg_restore,
      }),
      runMigrations: async (databaseUrl: string) => {
        runLocalPrisma(lease.runtime, databaseUrl, ["migrate", "deploy"]);
        runLocalPrisma(lease.runtime, databaseUrl, ["migrate", "deploy"]);
        if (target !== undefined) {
          await ensureRuntimeDatabasePrivileges(lease.runtime, target.databaseName);
        }
      },
      verifySchema: (databaseUrl: string) => {
        const result = runLocalPrisma(
          lease.runtime,
          databaseUrl,
          [
            "migrate",
            "diff",
            "--from-config-datasource",
            "--to-schema",
            "prisma/schema.prisma",
            "--script",
          ],
          { stdio: "pipe" },
        );
        verifyRestoredSchema(result.stdout);
      },
      source: Object.freeze({
        appUrl: source.databaseUrl,
        databaseName: source.databaseName,
        migrationUrl: source.migrationDatabaseUrl,
        snapshotUrl: source.adminDatabaseUrl,
      }),
      target: Object.freeze({
        appUrl: target.databaseUrl,
        databaseName: target.databaseName,
        migrationUrl: target.migrationDatabaseUrl,
        snapshotUrl: target.adminDatabaseUrl,
      }),
    });
  } catch (error) {
    await target?.drop().catch(() => undefined);
    await source.drop().catch(() => undefined);
    throw error;
  }
};

const writeEvidence = async (evidence: unknown): Promise<void> => {
  await assertNotSymlink(path.join(repositoryRoot, ".local"), "Local evidence state");
  await mkdir(evidenceDirectory, { mode: 0o700, recursive: true });
  await chmod(evidenceDirectory, 0o700);
  await assertNotSymlink(evidenceDirectory, "Backup recovery evidence directory");
  await assertNotSymlink(evidencePath, "Backup recovery evidence file");
  const temporaryPath = path.join(
    evidenceDirectory,
    `.latest-${process.pid}-${randomBytes(6).toString("hex")}.json`,
  );
  await writeFile(temporaryPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, evidencePath);
  await chmod(evidencePath, 0o600);
};

const readGitState = (): Readonly<{ revision: string; workingTreeDirty: boolean }> => {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const status = execFileSync("git", ["status", "--porcelain=v1"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (process.env.CI === "true" && process.env.GITHUB_SHA !== revision) {
    fail("CI backup recovery revision does not match GITHUB_SHA.");
  }
  return Object.freeze({ revision, workingTreeDirty: status !== "" });
};

const runDrill = async (context: DrillContext): Promise<void> => {
  assertBackupDatabaseBoundary(
    context.mode,
    context.source.databaseName,
    context.target.databaseName,
  );
  const startedAt = Date.now();
  const artifactDirectory = await createArtifactDirectory();
  const artifactPath = path.join(artifactDirectory, "backup.dump");
  let artifactRemoved = false;
  let sourceReleased = false;
  let targetRemoved = false;
  let primaryError: unknown;
  let backupDurationMs = 0;
  let restoreDurationMs = 0;
  let artifactBytes = 0;
  let artifactSha256 = "";
  let sourceSnapshot: SnapshotDetail | undefined;

  try {
    await assertTargetEmpty(context.target.snapshotUrl);
    await insertSentinel(context.source.migrationUrl, sourceSentinel);
    sourceSnapshot = await readSnapshot(context.source.snapshotUrl);

    const backupStartedAt = Date.now();
    runBackup(context, artifactPath);
    backupDurationMs = Math.max(1, Date.now() - backupStartedAt);
    await chmod(artifactPath, 0o600);
    await assertNotSymlink(artifactPath, "Backup recovery artifact");
    const artifactMetadata = statSync(artifactPath);
    assertBackupArtifactMetadata({
      isFile: artifactMetadata.isFile(),
      isSymbolicLink: (await lstat(artifactPath)).isSymbolicLink(),
      mode: artifactMetadata.mode,
      size: artifactMetadata.size,
    });
    artifactBytes = artifactMetadata.size;
    artifactSha256 = await hashFile(artifactPath);
    assertArtifactIntegrity(
      artifactBytes,
      artifactSha256,
      await hashFile(artifactPath),
      await readArtifactSignature(artifactPath),
    );

    await insertSentinel(context.source.migrationUrl, afterSnapshotSentinel);
    assertArtifactIntegrity(
      artifactBytes,
      artifactSha256,
      await hashFile(artifactPath),
      await readArtifactSignature(artifactPath),
    );
    const restoreStartedAt = Date.now();
    runRestore(context, artifactPath);
    await context.runMigrations(context.target.migrationUrl);
    context.verifySchema(context.target.migrationUrl);
    restoreDurationMs = Math.max(1, Date.now() - restoreStartedAt);
    const restoredSnapshot = await readSnapshot(context.target.snapshotUrl);
    const changedComponents = Object.keys(sourceSnapshot.componentDigests).filter(
      (name) => sourceSnapshot?.componentDigests[name] !== restoredSnapshot.componentDigests[name],
    );
    if (changedComponents.length > 0) {
      const changedEntries = changedComponents.flatMap((component) => {
        const sourceEntries = sourceSnapshot?.componentEntryDigests[component] ?? {};
        const restoredEntries = restoredSnapshot.componentEntryDigests[component] ?? {};
        return [...new Set([...Object.keys(sourceEntries), ...Object.keys(restoredEntries)])]
          .filter((entry) => sourceEntries[entry] !== restoredEntries[entry])
          .map((entry) => `${component}:${entry}`);
      });
      fail(
        `Restored database snapshot components differ: ${changedComponents.join(", ")}; entries: ${changedEntries.join(", ")}.`,
      );
    }
    assertEquivalentRestoreSnapshots(
      sourceSnapshot.canonicalSha256,
      restoredSnapshot.canonicalSha256,
    );
    assert.deepEqual(restoredSnapshot.summary, sourceSnapshot.summary);
    await assertRuntimeLeastPrivilege(context.target);
  } catch (error) {
    primaryError = error;
  } finally {
    await rm(artifactDirectory, { force: true, recursive: true })
      .then(() => {
        artifactRemoved = !existsSync(artifactPath);
      })
      .catch((error) => {
        primaryError ??= error;
      });
    await context
      .cleanupTarget()
      .then(() => {
        targetRemoved = true;
      })
      .catch((error) => {
        primaryError ??= error;
      });
    await context
      .cleanupSource()
      .then(() => {
        sourceReleased = true;
      })
      .catch((error) => {
        primaryError ??= error;
      });
  }

  if (primaryError !== undefined) throw primaryError;
  const verifiedSourceSnapshot = sourceSnapshot;
  if (verifiedSourceSnapshot === undefined) {
    throw new Error("Backup recovery source snapshot is unavailable.");
  }
  assertBackupCleanup({ artifactRemoved, sourceReleased, targetRemoved });

  const git = readGitState();
  const evidence = await createBackupRecoveryEvidence({
    artifactBytes,
    artifactSha256,
    backupDurationMs,
    constraintCount: verifiedSourceSnapshot.summary.constraintCount,
    gitRevision: git.revision,
    indexCount: verifiedSourceSnapshot.summary.indexCount,
    migrationCount: verifiedSourceSnapshot.summary.migrationCount,
    mode: context.mode,
    postgresVersionNumber: verifiedSourceSnapshot.postgresVersionNumber,
    privilegeCount: verifiedSourceSnapshot.summary.privilegeCount,
    restoreDurationMs,
    snapshotSha256: verifiedSourceSnapshot.summary.snapshotSha256,
    sourceDatabase: context.source.databaseName,
    tableCount: verifiedSourceSnapshot.summary.tableCount,
    targetDatabase: context.target.databaseName,
    totalDurationMs: Math.max(1, Date.now() - startedAt),
    totalRows: verifiedSourceSnapshot.summary.totalRows,
    workingTreeDirty: git.workingTreeDirty,
  });
  await writeEvidence(evidence);
  process.stdout.write(
    `Verified ${context.mode} synthetic custom-format backup, isolated restore, snapshot equality, least privilege, and cleanup. Evidence: ${path.relative(repositoryRoot, evidencePath)}\n`,
  );
};

if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
  const context = await createCiContext();
  await runDrill(context);
} else {
  await withLocalPostgresLease(async (lease) => {
    try {
      const context = await createLocalContext(lease);
      await runDrill(context);
    } finally {
      await stopLeaseOwnedRuntime(lease);
    }
  });
}
