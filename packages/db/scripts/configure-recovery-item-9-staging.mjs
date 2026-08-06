import { spawnSync } from "node:child_process";

import pg from "pg";

const { Client } = pg;

const resourceName = "rituvia-recovery-staging";
const deletionRole = "rituvia_privacy_deletion";
const expectedConfirmation = `rotate:${resourceName}/${deletionRole}`;
const requiredBaselineMigration = "202607300001_commercial_payment_webhook";
const itemNineMigrations = Object.freeze([
  "202608060001_recovery_wallet_identity",
  "202608060002_recovery_wallet_challenge_deletion_rls",
]);

const fail = (message) => {
  throw new TypeError(message);
};

const environmentValue = (name) => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const adminDatabaseUrl = environmentValue("RITUVIA_STAGING_ADMIN_DATABASE_URL");
const rolePassword = environmentValue("RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD");
if (
  process.env.APP_ENV !== "staging" ||
  process.env.RITUVIA_STAGING_RESOURCE_NAME !== resourceName ||
  process.env.RITUVIA_STAGING_ROLE_ROTATION_CONFIRM !== expectedConfirmation ||
  process.env.VERCEL_ENV === "production" ||
  adminDatabaseUrl === undefined ||
  rolePassword === undefined
) {
  fail("Recovery Item 9 staging role configuration is not explicitly authorized.");
}
if (!/^[A-Za-z0-9_-]{43}$/u.test(rolePassword)) {
  fail("Recovery Item 9 deletion-role password must be an exact 32-byte base64url secret.");
}

const parsedAdminUrl = new URL(adminDatabaseUrl);
if (
  !["postgres:", "postgresql:"].includes(parsedAdminUrl.protocol) ||
  !parsedAdminUrl.hostname.endsWith(".neon.tech") ||
  parsedAdminUrl.username === "" ||
  parsedAdminUrl.password === "" ||
  parsedAdminUrl.searchParams.get("sslmode") !== "require"
) {
  fail("Recovery Item 9 administrator connection is not the expected Neon TLS target.");
}

const runMigrations = () => {
  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DATABASE_URL: adminDatabaseUrl },
    encoding: "utf8",
  });
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  if (result.status !== 0) fail("Recovery Item 9 staging migrations failed.");
};

const client = new Client({
  application_name: "rituvia-recovery-item-9-role-configuration",
  connectionString: adminDatabaseUrl,
});

try {
  await client.connect();
  const attestation = await client.query(`
    SELECT current_database() AS "databaseName",
           current_user AS "currentUser",
           EXISTS (
             SELECT 1 FROM pg_roles WHERE rolname = '${deletionRole}'
           ) AS "deletionRoleExists",
           EXISTS (
             SELECT 1
               FROM "_prisma_migrations"
              WHERE migration_name = '${requiredBaselineMigration}'
                AND finished_at IS NOT NULL
                AND rolled_back_at IS NULL
           ) AS "baselineMigrationExists",
           EXISTS (
             SELECT 1
               FROM "_prisma_migrations"
              WHERE finished_at IS NULL
                AND rolled_back_at IS NULL
           ) AS "incompleteMigrationExists"
  `);
  const facts = attestation.rows[0];
  if (
    facts === undefined ||
    ["rituvia_app", deletionRole].includes(facts.currentUser) ||
    facts.deletionRoleExists !== true ||
    facts.baselineMigrationExists !== true ||
    facts.incompleteMigrationExists !== false
  ) {
    fail("Recovery Item 9 staging database attestation failed.");
  }

  runMigrations();

  const migrationResult = await client.query(
    `SELECT migration_name AS "migrationName"
       FROM "_prisma_migrations"
      WHERE migration_name = ANY($1::text[])
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      ORDER BY migration_name`,
    [itemNineMigrations],
  );
  if (
    migrationResult.rows.map(({ migrationName }) => migrationName).join("\0") !==
    itemNineMigrations.join("\0")
  ) {
    fail("Recovery Item 9 migrations are not complete on protected staging.");
  }

  await client.query("BEGIN");
  try {
    await client.query(`ALTER ROLE ${deletionRole} WITH LOGIN PASSWORD '${rolePassword}'`);
    await client.query(
      `GRANT SELECT ON TABLE wallet_identity, wallet_auth_challenge, wallet_auth_event TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (address, revoked_at) ON TABLE wallet_identity TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (address, message, message_hash, canonical_request_hash) ON TABLE wallet_auth_challenge TO ${deletionRole}`,
    );

    const roleResult = await client.query(
      `SELECT rolsuper AS "superuser",
              rolcreatedb AS "createDatabase",
              rolcreaterole AS "createRole",
              rolreplication AS "replication",
              rolbypassrls AS "bypassRls"
         FROM pg_roles
        WHERE rolname = $1`,
      [deletionRole],
    );
    const role = roleResult.rows[0];
    if (
      role === undefined ||
      role.superuser ||
      role.createDatabase ||
      role.createRole ||
      role.replication ||
      role.bypassRls
    ) {
      fail("Recovery Item 9 deletion role exceeds the least-privilege boundary.");
    }

    const privilegeResult = await client.query(
      `SELECT has_table_privilege($1, 'wallet_identity', 'SELECT') AS "walletIdentitySelect",
              has_column_privilege($1, 'wallet_identity', 'address', 'UPDATE') AS "walletIdentityAddressUpdate",
              has_column_privilege($1, 'wallet_identity', 'revoked_at', 'UPDATE') AS "walletIdentityRevokedUpdate",
              has_table_privilege($1, 'wallet_auth_challenge', 'SELECT') AS "walletChallengeSelect",
              has_column_privilege($1, 'wallet_auth_challenge', 'message', 'UPDATE') AS "walletChallengeMessageUpdate",
              has_table_privilege($1, 'wallet_auth_event', 'SELECT') AS "walletEventSelect",
              pg_has_role('rituvia_app', $1, 'MEMBER') AS "applicationIsMember"`,
      [deletionRole],
    );
    const privileges = privilegeResult.rows[0];
    if (
      privileges === undefined ||
      Object.entries(privileges).some(([key, value]) =>
        key === "applicationIsMember" ? value !== false : value !== true,
      )
    ) {
      fail("Recovery Item 9 deletion-role privilege attestation failed.");
    }
    await client.query("COMMIT");

    const migrationCount = await client.query(
      `SELECT count(*)::integer AS count
         FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL
          AND rolled_back_at IS NULL`,
    );
    process.stdout.write(
      `${JSON.stringify({
        configured: true,
        databaseName: facts.databaseName,
        deletionRole,
        itemNineMigrations,
        migrationCount: migrationCount.rows[0]?.count,
        resourceName,
      })}\n`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  await client.end().catch(() => undefined);
}
