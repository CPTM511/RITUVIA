import { spawnSync } from "node:child_process";

import pg from "pg";

const { Client } = pg;

const resourceName = "rituvia-recovery-staging";
const databaseName = "neondb";
const appRole = "rituvia_app";
const deletionRole = "rituvia_privacy_deletion";
const expectedConfirmation = `rotate:${resourceName}/${deletionRole}`;
const requiredBaselineMigration = "202607300001_commercial_payment_webhook";
const itemNineMigrations = Object.freeze([
  "202608060001_recovery_wallet_identity",
  "202608060002_recovery_wallet_challenge_deletion_rls",
  "202608060003_recovery_privacy_deletion_dependencies",
]);
const privacyExportReadTables = Object.freeze([
  "astrology_calculation",
  "birth_profile",
  "commerce_order",
  "commerce_order_line",
  "interpretation_verification",
  "ledger_entry",
  "payment_attempt",
  "payment_event",
  "revisit_reminder_operation",
  "revisit_reminder_subscription",
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
             SELECT 1 FROM pg_roles WHERE rolname = '${appRole}'
           ) AS "appRoleExists",
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
    facts.databaseName !== databaseName ||
    [appRole, deletionRole].includes(facts.currentUser) ||
    facts.appRoleExists !== true ||
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
    await client.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${deletionRole}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${appRole}, ${deletionRole}`);
    await client.query(
      `GRANT SELECT, INSERT ON TABLE app_user, auth_identity, auth_challenge, account_session TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (status, last_active_at, age_attested_at, age_policy_version, profile_version, display_name, locale, time_zone) ON TABLE app_user TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (last_sign_in_at, provider_subject, verified_email_ciphertext, verified_email_nonce, verified_email_tag, encryption_key_version) ON TABLE auth_identity TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (provider_subject, email_ciphertext, email_nonce, email_tag, encryption_key_version, token_hash, state_hash, previous_session_hash, return_to, consumed_at) ON TABLE auth_challenge TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (token_hash, last_seen_at, revoked_at) ON TABLE account_session TO ${appRole}`,
    );
    await client.query(
      `GRANT SELECT, INSERT ON TABLE wallet_identity, wallet_auth_challenge, wallet_auth_event TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (last_sign_in_at, revoked_at) ON TABLE wallet_identity TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (attempt_count, consumed_at) ON TABLE wallet_auth_challenge TO ${appRole}`,
    );
    await client.query(
      `GRANT SELECT, INSERT ON TABLE account_subject_link, account_consent_record TO ${appRole}`,
    );
    await client.query(
      `GRANT SELECT, INSERT ON TABLE auth_start_rate_limit, passkey_credential TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (window_started_at, request_count) ON TABLE auth_start_rate_limit TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (credential_id, public_key, rp_id, last_used_at, sign_count, revoked_at) ON TABLE passkey_credential TO ${appRole}`,
    );
    await client.query(
      `GRANT SELECT, INSERT ON TABLE privacy_export, privacy_export_artifact, privacy_export_audit TO ${appRole}`,
    );
    await client.query(`GRANT SELECT ON TABLE ${privacyExportReadTables.join(", ")} TO ${appRole}`);
    await client.query(
      `GRANT SELECT ON TABLE auth_identity_suppression, privacy_deletion_request TO ${appRole}`,
    );
    await client.query(`GRANT SELECT ON TABLE privacy_deletion_authorized_user TO ${deletionRole}`);
    await client.query(
      `GRANT SELECT ON TABLE app_user, account_session, account_subject_link, anonymous_session, intention, journal_entry, private_journal_entry, revisit, interpretation, interpretation_verification, privacy_export, privacy_export_artifact, auth_identity, commerce_order, payment_attempt, auth_challenge, passkey_credential, privacy_deletion_request, privacy_deletion_completion, auth_identity_suppression TO ${deletionRole}`,
    );
    await client.query(
      `GRANT SELECT ON TABLE wallet_identity, wallet_auth_challenge, wallet_auth_event TO ${deletionRole}`,
    );
    await client.query(
      `GRANT SELECT ON TABLE birth_profile, astrology_calculation TO ${deletionRole}`,
    );
    await client.query(
      `GRANT SELECT (user_id) ON TABLE revisit_reminder_subscription TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (address, revoked_at) ON TABLE wallet_identity TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (address, message, message_hash, canonical_request_hash) ON TABLE wallet_auth_challenge TO ${deletionRole}`,
    );
    await client.query(
      `GRANT INSERT ON TABLE privacy_deletion_request, privacy_deletion_completion, auth_identity_suppression TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (last_seen_at, token_hash, revoked_at) ON TABLE account_session TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (privacy_deleted_at, privacy_deletion_request_id) ON TABLE account_subject_link TO ${deletionRole}`,
    );
    await client.query(`GRANT UPDATE (revoked_at) ON TABLE anonymous_session TO ${deletionRole}`);
    await client.query(
      `GRANT UPDATE (small_action_ciphertext, small_action_nonce, small_action_tag, intention_text_ciphertext, intention_text_nonce, intention_text_tag, encryption_key_version) ON TABLE intention TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (reflection_ciphertext, reflection_nonce, reflection_tag, encryption_key_version) ON TABLE journal_entry, private_journal_entry TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (intention_text_ciphertext, intention_text_nonce, intention_text_tag, small_action_ciphertext, small_action_nonce, small_action_tag, snapshot_key_version, completion_ciphertext, completion_nonce, completion_tag, completion_key_version) ON TABLE revisit TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (fallback_output, finalization_hash) ON TABLE interpretation TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (output, candidate_digest, output_digest, finalization_digest) ON TABLE interpretation_verification TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (provider_checkout_url) ON TABLE payment_attempt TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (provider_subject, email_ciphertext, email_nonce, email_tag, encryption_key_version, token_hash, state_hash, previous_session_hash, return_to, consumed_at) ON TABLE auth_challenge TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (credential_id, public_key, rp_id, revoked_at) ON TABLE passkey_credential TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (provider_subject, verified_email_ciphertext, verified_email_nonce, verified_email_tag, encryption_key_version) ON TABLE auth_identity TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (status, display_name, locale, time_zone, age_attested_at, age_policy_version, profile_version, last_active_at) ON TABLE app_user TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (preference_state, delivery_state, next_attempt_at, lease_token_hash, leased_until, last_failure_code, provider_message_reference, updated_at, delivered_at, unsubscribed_at, dead_lettered_at) ON TABLE revisit_reminder_subscription TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (payload_ciphertext, payload_nonce, payload_tag, encryption_key_version, canonical_payload_digest, revision, updated_at, deleted_at) ON TABLE birth_profile TO ${deletionRole}`,
    );
    await client.query(
      `GRANT UPDATE (facts_ciphertext, facts_nonce, facts_tag, encryption_key_version, digest_key_version, keyed_facts_digest, privacy_deleted_at) ON TABLE astrology_calculation TO ${deletionRole}`,
    );
    await client.query(`GRANT DELETE ON TABLE privacy_export_artifact TO ${deletionRole}`);

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

    const appRoleResult = await client.query(
      `SELECT rolsuper AS "superuser",
              rolcreatedb AS "createDatabase",
              rolcreaterole AS "createRole",
              rolreplication AS "replication",
              rolbypassrls AS "bypassRls"
         FROM pg_roles
        WHERE rolname = $1`,
      [appRole],
    );
    const applicationRole = appRoleResult.rows[0];
    if (
      applicationRole === undefined ||
      applicationRole.superuser ||
      applicationRole.createDatabase ||
      applicationRole.createRole ||
      applicationRole.replication ||
      applicationRole.bypassRls
    ) {
      fail("Recovery Item 9 application role exceeds the least-privilege boundary.");
    }

    const privilegeResult = await client.query(
      `SELECT has_table_privilege($1, 'app_user', 'INSERT') AS "appUserInsert",
              has_table_privilege($1, 'auth_challenge', 'INSERT') AS "authChallengeInsert",
              has_column_privilege($1, 'auth_challenge', 'consumed_at', 'UPDATE') AS "authChallengeConsumedUpdate",
              has_table_privilege($1, 'auth_start_rate_limit', 'INSERT') AS "authRateLimitInsert",
              has_column_privilege($1, 'auth_start_rate_limit', 'request_count', 'UPDATE') AS "authRateLimitCountUpdate",
              has_table_privilege($1, 'wallet_identity', 'INSERT') AS "appWalletIdentityInsert",
              has_column_privilege($1, 'wallet_identity', 'revoked_at', 'UPDATE') AS "appWalletIdentityRevokedUpdate",
              has_table_privilege($1, 'privacy_export', 'INSERT') AS "privacyExportInsert",
              has_table_privilege($2, 'wallet_identity', 'SELECT') AS "walletIdentitySelect",
              has_column_privilege($2, 'wallet_identity', 'address', 'UPDATE') AS "walletIdentityAddressUpdate",
              has_column_privilege($2, 'wallet_identity', 'revoked_at', 'UPDATE') AS "walletIdentityRevokedUpdate",
              has_table_privilege($2, 'wallet_auth_challenge', 'SELECT') AS "walletChallengeSelect",
              has_column_privilege($2, 'wallet_auth_challenge', 'message', 'UPDATE') AS "walletChallengeMessageUpdate",
              has_table_privilege($2, 'wallet_auth_event', 'SELECT') AS "walletEventSelect",
              has_table_privilege($2, 'privacy_deletion_request', 'INSERT') AS "privacyDeletionRequestInsert",
              has_table_privilege($2, 'privacy_export_artifact', 'DELETE') AS "privacyExportArtifactDelete",
              has_database_privilege($2, current_database(), 'CONNECT') AS "privacyDeletionDatabaseConnect",
              has_column_privilege($2, 'revisit_reminder_subscription', 'user_id', 'SELECT') AS "reminderUserSelect",
              has_column_privilege($2, 'revisit_reminder_subscription', 'preference_state', 'UPDATE') AS "reminderPreferenceUpdate",
              has_table_privilege($2, 'birth_profile', 'SELECT') AS "birthProfileSelect",
              has_column_privilege($2, 'birth_profile', 'payload_ciphertext', 'UPDATE') AS "birthProfilePayloadUpdate",
              has_table_privilege($2, 'astrology_calculation', 'SELECT') AS "astrologyCalculationSelect",
              has_column_privilege($2, 'astrology_calculation', 'facts_ciphertext', 'UPDATE') AS "astrologyCalculationFactsUpdate",
              pg_has_role($1, $2, 'MEMBER') AS "applicationIsMember",
              pg_has_role($2, $1, 'MEMBER') AS "deletionIsMember"`,
      [appRole, deletionRole],
    );
    const privileges = privilegeResult.rows[0];
    if (
      privileges === undefined ||
      Object.entries(privileges).some(([key, value]) =>
        ["applicationIsMember", "deletionIsMember"].includes(key)
          ? value !== false
          : value !== true,
      )
    ) {
      fail("Recovery Item 9 deletion-role privilege attestation failed.");
    }

    const privacyExportPrivilegeResult = await client.query(
      `SELECT bool_and(has_table_privilege($1, relation, 'SELECT')) AS "allReadable"
         FROM unnest($2::text[]) AS relation`,
      [appRole, privacyExportReadTables],
    );
    if (privacyExportPrivilegeResult.rows[0]?.allReadable !== true) {
      fail("Recovery Item 9 privacy-export read privilege attestation failed.");
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
