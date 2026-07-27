import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { assertAdminSecurityRuntimeDatabasePrivileges } from "../src/admin-security.js";
import {
  assertAnonymousIdentityRuntimeDatabasePrivileges,
  createAnonymousIdentityService,
} from "../src/anonymous-identity.js";
import { assertCiDatabaseEnvironment, assertCiServiceAddress } from "../src/ci-database-safety.js";
import { createDatabaseClient } from "../src/client.js";
import { assertFeatureFlagRuntimeDatabasePrivileges } from "../src/feature-flags.js";
import { assertInterpretationGenerationRuntimeDatabasePrivileges } from "../src/interpretation-generation-persistence.js";
import { assertTarotReadingRuntimeDatabasePrivileges } from "../src/tarot-reading-persistence.js";

const APP_ROLE = "rituvia_ci_app";
const CONTROL_ROLE = "rituvia_ci_config_writer";
const PRIVACY_DELETION_ROLE = "rituvia_privacy_deletion";
const ADMIN_SERVICE_ROLE = "rituvia_admin_service";
const MIGRATOR_ROLE = "rituvia_ci_migrator";
const FLAG_READER_ROLE = "rituvia_feature_flag_reader";
const FLAG_WRITER_ROLE = "rituvia_feature_flag_writer";
const COUNTRY_POLICY_READER_ROLE = "rituvia_country_policy_reader";
const COUNTRY_POLICY_WRITER_ROLE = "rituvia_country_policy_writer";
const CATALOG_READER_ROLE = "rituvia_catalog_reader";
const CATALOG_WRITER_ROLE = "rituvia_catalog_writer";
const IDENTITY_READER_ROLE = "rituvia_identity_reader";
const IDENTITY_WRITER_ROLE = "rituvia_identity_writer";
const READING_READER_ROLE = "rituvia_tarot_reading_reader";
const READING_WRITER_ROLE = "rituvia_tarot_reading_writer";
const INTERPRETATION_READER_ROLE = "rituvia_interpretation_reader";
const INTERPRETATION_WRITER_ROLE = "rituvia_interpretation_writer";
const VERIFICATION_READER_ROLE = "rituvia_interpretation_verification_reader";
const VERIFICATION_WRITER_ROLE = "rituvia_interpretation_verification_writer";
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
  DATABASE_URL: environment.migratorUrl,
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
    [
      environment.appPassword,
      environment.adminServicePassword,
      environment.controlPassword,
      environment.privacyDeletionPassword,
      environment.migratorPassword,
    ].some((secret) => result.stdout.includes(secret) || result.stderr.includes(secret))
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
    for (const roleName of [
      FLAG_READER_ROLE,
      FLAG_WRITER_ROLE,
      COUNTRY_POLICY_READER_ROLE,
      COUNTRY_POLICY_WRITER_ROLE,
      CATALOG_READER_ROLE,
      CATALOG_WRITER_ROLE,
      IDENTITY_READER_ROLE,
      IDENTITY_WRITER_ROLE,
      READING_READER_ROLE,
      READING_WRITER_ROLE,
      INTERPRETATION_READER_ROLE,
      INTERPRETATION_WRITER_ROLE,
      VERIFICATION_READER_ROLE,
      VERIFICATION_WRITER_ROLE,
    ]) {
      const formatted = await admin.query<{ statement: string }>(
        "SELECT format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text) AS statement",
        [roleName],
      );
      assert.ok(formatted.rows[0]?.statement);
      await admin.query(formatted.rows[0]!.statement);
    }
    for (const [roleName, password] of [
      [APP_ROLE, environment.appPassword],
      [CONTROL_ROLE, environment.controlPassword],
      [PRIVACY_DELETION_ROLE, environment.privacyDeletionPassword],
      [ADMIN_SERVICE_ROLE, environment.adminServicePassword],
      [MIGRATOR_ROLE, environment.migratorPassword],
    ] as const) {
      const formatted = await admin.query<{ statement: string }>(
        "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS', $1::text, $2::text) AS statement",
        [roleName, password],
      );
      assert.ok(formatted.rows[0]?.statement);
      await admin.query(formatted.rows[0]!.statement);
    }
    verificationStage = "least-privilege role membership";
    await admin.query(`GRANT ${FLAG_READER_ROLE} TO ${APP_ROLE}, ${CONTROL_ROLE}`);
    await admin.query(`GRANT ${FLAG_WRITER_ROLE} TO ${CONTROL_ROLE}`);
    await admin.query(`GRANT ${FLAG_READER_ROLE}, ${FLAG_WRITER_ROLE} TO ${MIGRATOR_ROLE}`);
    await admin.query(`GRANT ${COUNTRY_POLICY_READER_ROLE} TO ${APP_ROLE}, ${CONTROL_ROLE}`);
    await admin.query(`GRANT ${COUNTRY_POLICY_WRITER_ROLE} TO ${CONTROL_ROLE}`);
    await admin.query(
      `GRANT ${COUNTRY_POLICY_READER_ROLE}, ${COUNTRY_POLICY_WRITER_ROLE} TO ${MIGRATOR_ROLE}`,
    );
    await admin.query(`GRANT ${CATALOG_READER_ROLE} TO ${APP_ROLE}, ${CONTROL_ROLE}`);
    await admin.query(`GRANT ${CATALOG_WRITER_ROLE} TO ${CONTROL_ROLE}`);
    await admin.query(`GRANT ${CATALOG_READER_ROLE}, ${CATALOG_WRITER_ROLE} TO ${MIGRATOR_ROLE}`);
    await admin.query(`GRANT ${IDENTITY_READER_ROLE}, ${IDENTITY_WRITER_ROLE} TO ${APP_ROLE}`);
    await admin.query(`GRANT ${READING_READER_ROLE}, ${READING_WRITER_ROLE} TO ${APP_ROLE}`);
    await admin.query(
      `GRANT ${INTERPRETATION_READER_ROLE}, ${INTERPRETATION_WRITER_ROLE} TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT ${VERIFICATION_READER_ROLE}, ${VERIFICATION_WRITER_ROLE} TO ${APP_ROLE}`,
    );
    verificationStage = "CI database ownership transfer";
    await admin.query(`ALTER DATABASE ${DATABASE_NAME} OWNER TO ${MIGRATOR_ROLE}`);
    verificationStage = "public schema privilege revocation";
    await admin.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
    verificationStage = "public schema ownership transfer";
    await admin.query(`ALTER SCHEMA public OWNER TO ${MIGRATOR_ROLE}`);
    verificationStage = "system identity attestation grant";
    await admin.query(
      `GRANT EXECUTE ON FUNCTION pg_control_system() TO ${APP_ROLE}, ${MIGRATOR_ROLE}`,
    );
  } finally {
    await admin.end();
  }
};

const grantRuntimePrivileges = async (): Promise<void> => {
  verificationStage = "runtime database privilege grants";
  const admin = new Client({
    connectionString: environment.adminUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  await admin.connect();
  try {
    await admin.query(`REVOKE ALL ON DATABASE ${DATABASE_NAME} FROM PUBLIC`);
    await admin.query(
      `REVOKE ALL ON DATABASE ${DATABASE_NAME} FROM ${APP_ROLE}, ${CONTROL_ROLE}, ${PRIVACY_DELETION_ROLE}, ${ADMIN_SERVICE_ROLE}`,
    );
    await admin.query(
      `GRANT CONNECT ON DATABASE ${DATABASE_NAME} TO ${APP_ROLE}, ${CONTROL_ROLE}, ${PRIVACY_DELETION_ROLE}, ${ADMIN_SERVICE_ROLE}`,
    );
    await admin.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
    await admin.query(
      `REVOKE ALL ON SCHEMA public FROM ${APP_ROLE}, ${CONTROL_ROLE}, ${PRIVACY_DELETION_ROLE}, ${ADMIN_SERVICE_ROLE}`,
    );
    await admin.query(
      `GRANT USAGE ON SCHEMA public TO ${APP_ROLE}, ${CONTROL_ROLE}, ${PRIVACY_DELETION_ROLE}, ${ADMIN_SERVICE_ROLE}`,
    );
    await admin.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, ${APP_ROLE}, ${CONTROL_ROLE}, ${PRIVACY_DELETION_ROLE}, ${ADMIN_SERVICE_ROLE}, ${FLAG_READER_ROLE}, ${FLAG_WRITER_ROLE}, ${COUNTRY_POLICY_READER_ROLE}, ${COUNTRY_POLICY_WRITER_ROLE}, ${CATALOG_READER_ROLE}, ${CATALOG_WRITER_ROLE}, ${IDENTITY_READER_ROLE}, ${IDENTITY_WRITER_ROLE}, ${READING_READER_ROLE}, ${READING_WRITER_ROLE}, ${INTERPRETATION_READER_ROLE}, ${INTERPRETATION_WRITER_ROLE}, ${VERIFICATION_READER_ROLE}, ${VERIFICATION_WRITER_ROLE}`,
    );
    await admin.query(`GRANT SELECT ON TABLE "_prisma_migrations", seed_manifest TO ${APP_ROLE}`);
    await admin.query(`GRANT SELECT ON TABLE feature_flag_version TO ${FLAG_READER_ROLE}`);
    await admin.query(`GRANT INSERT ON TABLE feature_flag_version TO ${FLAG_WRITER_ROLE}`);
    await admin.query(
      `GRANT SELECT ON TABLE country_policy_version TO ${COUNTRY_POLICY_READER_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT ON TABLE country_policy_version TO ${COUNTRY_POLICY_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT ON TABLE catalog_version, catalog_product, catalog_product_localization, catalog_price TO ${CATALOG_READER_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT ON TABLE catalog_version, catalog_product, catalog_product_localization, catalog_price TO ${CATALOG_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT ON TABLE anonymous_subject, anonymous_session, consent_record, anonymous_session_issuance_gate TO ${IDENTITY_READER_ROLE}`,
    );
    await admin.query(`GRANT INSERT ON TABLE anonymous_subject TO ${IDENTITY_WRITER_ROLE}`);
    await admin.query(
      `GRANT UPDATE (last_seen_at) ON TABLE anonymous_subject TO ${IDENTITY_WRITER_ROLE}`,
    );
    await admin.query(`GRANT INSERT ON TABLE anonymous_session TO ${IDENTITY_WRITER_ROLE}`);
    await admin.query(
      `GRANT UPDATE (last_seen_at, revoked_at) ON TABLE anonymous_session TO ${IDENTITY_WRITER_ROLE}`,
    );
    await admin.query(`GRANT INSERT ON TABLE consent_record TO ${IDENTITY_WRITER_ROLE}`);
    await admin.query(
      `GRANT INSERT ON TABLE anonymous_session_issuance_gate TO ${IDENTITY_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (window_started_at, issued_count) ON TABLE anonymous_session_issuance_gate TO ${IDENTITY_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT ON TABLE reading, tarot_draw, reading_report TO ${READING_READER_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT ON TABLE reading, tarot_draw, reading_report TO ${READING_WRITER_ROLE}`,
    );
    await admin.query(`GRANT SELECT ON TABLE interpretation TO ${INTERPRETATION_READER_ROLE}`);
    await admin.query(
      `GRANT INSERT (anonymous_subject_id, approved_currency_code, assembly_policy_version, attempt_timeout_ms, canonical_request_hash, claim_token_hash, content_versions, deterministic_algorithm_version, deterministic_engine_name, deterministic_engine_version, deterministic_rules_version, eligibility_as_of, expires_at, fallback_template_approval_reference, fallback_template_checksum_sha256, fallback_template_id, fallback_template_version, generation_policy_version, generation_provenance, generation_schema_version, idempotency_key_hash, idempotency_key_version, lease_expires_at, locale, max_attempts, max_output_tokens, maximum_estimated_cost_micros, modality, model_id, model_version, output_schema_version, prompt_approval_reference, prompt_checksum_sha256, prompt_id, prompt_version, provider_approval_reference, provider_id, provider_version, reading_id, reading_type, request_id, retrieval_policy_version, retry_delay_ms, safety_policy_version, theme_code, tone, total_timeout_ms, verification_timeout_ms) ON TABLE interpretation TO ${INTERPRETATION_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (attempt_count, claim_token_hash, claim_version, completed_at, cost_status, currency_code, estimated_cost_micros, failure_code, fallback_output, finalization_hash, input_tokens, latency_ms, lease_expires_at, output_tokens, retry_reason, status, token_status, total_tokens) ON TABLE interpretation TO ${INTERPRETATION_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT (anonymous_subject_id, candidate_digest, candidate_digest_scope, created_at, deterministic_checks_version, expires_at, finalization_digest, interpretation_id, metadata_schema_version, output, output_digest, output_digest_scope, output_schema_version, parent_status, policy_approval_reference, policy_checksum_sha256, policy_id, policy_version, result_schema_version, reviewer_approval_reference, reviewer_checksum_sha256, reviewer_id, reviewer_model_id, reviewer_model_version, reviewer_policy_approval_reference, reviewer_policy_checksum_sha256, reviewer_policy_id, reviewer_policy_version, reviewer_provider_id, reviewer_provider_version, reviewer_version, runtime_approval_reference, runtime_checksum_sha256, runtime_id, runtime_version, status, verification_timeout_ms) ON TABLE interpretation_verification TO ${VERIFICATION_READER_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT (anonymous_subject_id, candidate_digest, candidate_digest_scope, deterministic_checks_version, expires_at, finalization_digest, interpretation_id, metadata_schema_version, output, output_digest, output_digest_scope, output_schema_version, policy_approval_reference, policy_checksum_sha256, policy_id, policy_version, result_schema_version, reviewer_approval_reference, reviewer_checksum_sha256, reviewer_id, reviewer_model_id, reviewer_model_version, reviewer_policy_approval_reference, reviewer_policy_checksum_sha256, reviewer_policy_id, reviewer_policy_version, reviewer_provider_id, reviewer_provider_version, reviewer_version, runtime_approval_reference, runtime_checksum_sha256, runtime_id, runtime_version, status, verification_timeout_ms) ON TABLE interpretation_verification TO ${VERIFICATION_WRITER_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT, INSERT ON TABLE app_user, auth_identity, auth_challenge, auth_start_rate_limit, account_session, passkey_credential TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (status, last_active_at, age_attested_at, age_policy_version, profile_version, display_name, locale, time_zone) ON TABLE app_user TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (last_sign_in_at, provider_subject, verified_email_ciphertext, verified_email_nonce, verified_email_tag, encryption_key_version) ON TABLE auth_identity TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (provider_subject, email_ciphertext, email_nonce, email_tag, encryption_key_version, token_hash, state_hash, previous_session_hash, return_to, consumed_at) ON TABLE auth_challenge TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (window_started_at, request_count) ON TABLE auth_start_rate_limit TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (token_hash, last_seen_at, revoked_at) ON TABLE account_session TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (credential_id, public_key, rp_id, last_used_at, sign_count, revoked_at) ON TABLE passkey_credential TO ${APP_ROLE}`,
    );
    await admin.query(`GRANT SELECT, INSERT ON TABLE account_subject_link TO ${APP_ROLE}`);
    await admin.query(
      `GRANT UPDATE (privacy_deleted_at, privacy_deletion_request_id) ON TABLE account_subject_link TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT, INSERT ON TABLE intention, ritual_session, journal_entry TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (intention_code, intention_text_ciphertext, intention_text_nonce, intention_text_tag, small_action_ciphertext, small_action_nonce, small_action_tag, encryption_key_version, privacy_state, reminder_preference, revisit_date, time_zone, status, revision, last_mutation_key_hash, last_mutation_request_hash, updated_at, completed_at, archived_at, deleted_at) ON TABLE intention TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (reflection_ciphertext, reflection_nonce, reflection_tag, encryption_key_version) ON TABLE journal_entry TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT, INSERT ON TABLE ritual_session_v2, private_journal_entry TO ${APP_ROLE}`,
    );
    await admin.query(`GRANT SELECT ON TABLE ritual_pass TO ${APP_ROLE}`);
    await admin.query(
      `GRANT UPDATE (status, current_step_code, elapsed_seconds, revision, paused_at, completed_at, abandoned_at, last_mutation_key_hash, last_mutation_request_hash) ON TABLE ritual_session_v2 TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (reflection_ciphertext, reflection_nonce, reflection_tag, encryption_key_version, revision, last_mutation_key_hash, last_mutation_request_hash, updated_at, deleted_at) ON TABLE private_journal_entry TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (status, consumed_at, ritual_session_id) ON TABLE ritual_pass TO ${APP_ROLE}`,
    );
    await admin.query(`GRANT SELECT, INSERT ON TABLE revisit, revisit_operation TO ${APP_ROLE}`);
    await admin.query(
      `GRANT UPDATE (intention_text_ciphertext, intention_text_nonce, intention_text_tag, small_action_ciphertext, small_action_nonce, small_action_tag, snapshot_key_version, schedule_kind, scheduled_local_date, time_zone, quiet_hours_start, quiet_hours_end, completion_ciphertext, completion_nonce, completion_tag, completion_key_version, outcome_tags, status, revision, updated_at, completed_at, archived_at, deleted_at) ON TABLE revisit TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT ON TABLE commerce_order, commerce_order_line, payment_attempt, payment_event, ledger_entry, entitlement TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT ON TABLE commerce_order, commerce_order_line, payment_attempt, payment_event, ledger_entry, entitlement TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (status, refunded_minor, updated_at) ON TABLE commerce_order TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (state, provider_checkout_url, updated_at) ON TABLE payment_attempt TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (order_id, payment_attempt_id, processed_at, processing_state) ON TABLE payment_event TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (source_order_line_id, status, granted_at, revoked_at, version) ON TABLE entitlement TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT, INSERT ON TABLE privacy_export, privacy_export_artifact, privacy_export_audit TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT ON TABLE auth_identity_suppression, privacy_deletion_request TO ${APP_ROLE}`,
    );
    await admin.query(
      `GRANT SELECT ON TABLE app_user, account_session, account_subject_link, anonymous_session, intention, journal_entry, private_journal_entry, revisit, interpretation, interpretation_verification, privacy_export, privacy_export_artifact, auth_identity, commerce_order, payment_attempt, auth_challenge, passkey_credential, privacy_deletion_request, privacy_deletion_completion, auth_identity_suppression TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT ON TABLE privacy_deletion_request, privacy_deletion_completion, auth_identity_suppression TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (last_seen_at, token_hash, revoked_at) ON TABLE account_session TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (privacy_deleted_at, privacy_deletion_request_id) ON TABLE account_subject_link TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (revoked_at) ON TABLE anonymous_session TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (small_action_ciphertext, small_action_nonce, small_action_tag, intention_text_ciphertext, intention_text_nonce, intention_text_tag, encryption_key_version) ON TABLE intention TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (reflection_ciphertext, reflection_nonce, reflection_tag, encryption_key_version) ON TABLE journal_entry, private_journal_entry TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (intention_text_ciphertext, intention_text_nonce, intention_text_tag, small_action_ciphertext, small_action_nonce, small_action_tag, snapshot_key_version, completion_ciphertext, completion_nonce, completion_tag, completion_key_version) ON TABLE revisit TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (fallback_output, finalization_hash) ON TABLE interpretation TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (output, candidate_digest, output_digest, finalization_digest) ON TABLE interpretation_verification TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (provider_checkout_url) ON TABLE payment_attempt TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (provider_subject, email_ciphertext, email_nonce, email_tag, encryption_key_version, token_hash, state_hash, previous_session_hash, return_to, consumed_at) ON TABLE auth_challenge TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (credential_id, public_key, rp_id, revoked_at) ON TABLE passkey_credential TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (provider_subject, verified_email_ciphertext, verified_email_nonce, verified_email_tag, encryption_key_version) ON TABLE auth_identity TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(
      `GRANT UPDATE (status, display_name, locale, time_zone, age_attested_at, age_policy_version, profile_version, last_active_at) ON TABLE app_user TO ${PRIVACY_DELETION_ROLE}`,
    );
    await admin.query(`GRANT DELETE ON TABLE privacy_export_artifact TO ${PRIVACY_DELETION_ROLE}`);
    await admin.query(
      `GRANT SELECT ON TABLE app_user, account_session, passkey_credential, admin_role_assignment, admin_role_revocation, admin_mfa_assertion, admin_audit_event TO ${ADMIN_SERVICE_ROLE}`,
    );
    await admin.query(
      `GRANT INSERT ON TABLE admin_role_assignment, admin_role_revocation, admin_audit_event TO ${ADMIN_SERVICE_ROLE}`,
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATOR_ROLE} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATOR_ROLE} IN SCHEMA public REVOKE ALL ON TABLES FROM ${APP_ROLE}, ${CONTROL_ROLE}, ${PRIVACY_DELETION_ROLE}, ${ADMIN_SERVICE_ROLE}, ${FLAG_READER_ROLE}, ${FLAG_WRITER_ROLE}, ${COUNTRY_POLICY_READER_ROLE}, ${COUNTRY_POLICY_WRITER_ROLE}, ${CATALOG_READER_ROLE}, ${CATALOG_WRITER_ROLE}, ${IDENTITY_READER_ROLE}, ${IDENTITY_WRITER_ROLE}, ${READING_READER_ROLE}, ${READING_WRITER_ROLE}, ${INTERPRETATION_READER_ROLE}, ${INTERPRETATION_WRITER_ROLE}, ${VERIFICATION_READER_ROLE}, ${VERIFICATION_WRITER_ROLE}`,
    );
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

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${code}.`);
  } catch (error) {
    assert.equal((error as { code?: unknown }).code, code);
  }
};

const verifyMigratedDatabase = async (): Promise<void> => {
  verificationStage = "migrated database connection";
  const app = new Client({
    connectionString: environment.appUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  const control = new Client({
    connectionString: environment.controlUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  const migrator = new Client({
    connectionString: environment.migratorUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
  const runtimeDatabase = createDatabaseClient(environment.appUrl);
  const adminServiceDatabase = createDatabaseClient(environment.adminServiceUrl);
  const controlDatabase = createDatabaseClient(environment.controlUrl);
  const migratorDatabase = createDatabaseClient(environment.migratorUrl);
  const preselectedRuntimeUrl = new URL(environment.adminUrl);
  preselectedRuntimeUrl.searchParams.set("options", `-c role=${APP_ROLE}`);
  const preselectedRuntimeDatabase = createDatabaseClient(preselectedRuntimeUrl.toString());
  await Promise.all([app.connect(), control.connect(), migrator.connect()]);
  try {
    verificationStage = "migrated database invariants";
    await assertFeatureFlagRuntimeDatabasePrivileges(runtimeDatabase);
    await assertAnonymousIdentityRuntimeDatabasePrivileges(runtimeDatabase);
    await assertTarotReadingRuntimeDatabasePrivileges(runtimeDatabase);
    await assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase);
    await assertAdminSecurityRuntimeDatabasePrivileges(adminServiceDatabase);
    await assert.rejects(
      assertAdminSecurityRuntimeDatabasePrivileges(runtimeDatabase),
      /Admin security storage is unavailable/u,
    );
    await assert.rejects(
      assertFeatureFlagRuntimeDatabasePrivileges(controlDatabase),
      /runtime database privileges are unsafe/u,
    );
    await assert.rejects(
      assertFeatureFlagRuntimeDatabasePrivileges(migratorDatabase),
      /runtime database privileges are unsafe/u,
    );
    await assert.rejects(
      assertFeatureFlagRuntimeDatabasePrivileges(preselectedRuntimeDatabase),
      /runtime database privileges are unsafe/u,
    );
    for (const unsafeIdentityDatabase of [
      controlDatabase,
      migratorDatabase,
      preselectedRuntimeDatabase,
    ]) {
      await assert.rejects(
        assertAnonymousIdentityRuntimeDatabasePrivileges(unsafeIdentityDatabase),
        /runtime database privileges are unsafe/u,
      );
    }
    for (const unsafeReadingDatabase of [
      controlDatabase,
      migratorDatabase,
      preselectedRuntimeDatabase,
    ]) {
      await assert.rejects(
        assertTarotReadingRuntimeDatabasePrivileges(unsafeReadingDatabase),
        /runtime database privileges are unsafe/u,
      );
    }
    for (const unsafeInterpretationDatabase of [
      controlDatabase,
      migratorDatabase,
      preselectedRuntimeDatabase,
    ]) {
      await assert.rejects(
        assertInterpretationGenerationRuntimeDatabasePrivileges(unsafeInterpretationDatabase),
        /runtime database privileges are unsafe/u,
      );
    }
    await migrator.query(
      `GRANT INSERT (status) ON TABLE interpretation TO ${INTERPRETATION_WRITER_ROLE}`,
    );
    try {
      await assert.rejects(
        assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase),
        /runtime database privileges are unsafe/u,
      );
    } finally {
      await migrator.query(
        `REVOKE INSERT (status) ON TABLE interpretation FROM ${INTERPRETATION_WRITER_ROLE}`,
      );
    }
    await migrator.query(`GRANT DELETE ON TABLE interpretation TO ${INTERPRETATION_WRITER_ROLE}`);
    try {
      await assert.rejects(
        assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase),
        /runtime database privileges are unsafe/u,
      );
    } finally {
      await migrator.query(
        `REVOKE DELETE ON TABLE interpretation FROM ${INTERPRETATION_WRITER_ROLE}`,
      );
    }
    await migrator.query(
      `GRANT INSERT (parent_status) ON TABLE interpretation_verification TO ${VERIFICATION_WRITER_ROLE}`,
    );
    try {
      await assert.rejects(
        assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase),
        /runtime database privileges are unsafe/u,
      );
    } finally {
      await migrator.query(
        `REVOKE INSERT (parent_status) ON TABLE interpretation_verification FROM ${VERIFICATION_WRITER_ROLE}`,
      );
    }
    await migrator.query(
      `GRANT UPDATE (status) ON TABLE interpretation_verification TO ${VERIFICATION_WRITER_ROLE}`,
    );
    try {
      await assert.rejects(
        assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase),
        /runtime database privileges are unsafe/u,
      );
    } finally {
      await migrator.query(
        `REVOKE UPDATE (status) ON TABLE interpretation_verification FROM ${VERIFICATION_WRITER_ROLE}`,
      );
    }
    await migrator.query(
      `GRANT DELETE ON TABLE interpretation_verification TO ${VERIFICATION_WRITER_ROLE}`,
    );
    try {
      await assert.rejects(
        assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase),
        /runtime database privileges are unsafe/u,
      );
    } finally {
      await migrator.query(
        `REVOKE DELETE ON TABLE interpretation_verification FROM ${VERIFICATION_WRITER_ROLE}`,
      );
    }
    await assertInterpretationGenerationRuntimeDatabasePrivileges(runtimeDatabase);
    const systemIdentity = await app.query<{
      canCreateInDatabase: boolean;
      canCreateInSchema: boolean;
      databaseOwner: string;
      schemaOwner: string;
      systemIdentifier: string;
      tableOwner: string;
    }>(`SELECT pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())) AS "databaseOwner",
              pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname = 'public')) AS "schemaOwner",
              pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.feature_flag_version'::regclass)) AS "tableOwner",
              has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
              has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
              (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier"`);
    assert.deepEqual(systemIdentity.rows[0], {
      canCreateInDatabase: false,
      canCreateInSchema: false,
      databaseOwner: MIGRATOR_ROLE,
      schemaOwner: MIGRATOR_ROLE,
      systemIdentifier,
      tableOwner: MIGRATOR_ROLE,
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

    const featureFlags = await app.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM feature_flag_version",
    );
    assert.equal(featureFlags.rows[0]?.count, 0);
    const emptyIdentity = await app.query<{
      consents: number;
      draws: number;
      interpretations: number;
      reports: number;
      readings: number;
      sessions: number;
      subjects: number;
      verifications: number;
    }>(`SELECT (SELECT count(*)::int FROM anonymous_subject) AS subjects,
              (SELECT count(*)::int FROM anonymous_session) AS sessions,
              (SELECT count(*)::int FROM consent_record) AS consents,
              (SELECT count(*)::int FROM reading) AS readings,
              (SELECT count(*)::int FROM tarot_draw) AS draws,
              (SELECT count(*)::int FROM reading_report) AS reports,
              (SELECT count(*)::int FROM interpretation) AS interpretations,
              (SELECT count(*)::int FROM interpretation_verification) AS verifications`);
    assert.deepEqual(emptyIdentity.rows[0], {
      consents: 0,
      draws: 0,
      interpretations: 0,
      reports: 0,
      readings: 0,
      sessions: 0,
      subjects: 0,
      verifications: 0,
    });
    await expectPostgresError(
      () => app.query("INSERT INTO interpretation (status) VALUES ('fallback')"),
      "42501",
    );
    await expectPostgresError(
      () => app.query("UPDATE interpretation SET generation_provenance = '{}'::jsonb"),
      "42501",
    );
    await expectPostgresError(() => app.query("DELETE FROM interpretation"), "42501");
    await expectPostgresError(() => app.query("TRUNCATE interpretation"), "42501");
    await expectPostgresError(
      () =>
        app.query(
          "INSERT INTO interpretation_verification (parent_status) VALUES ('pending_verification')",
        ),
      "42501",
    );
    await expectPostgresError(
      () => app.query("UPDATE interpretation_verification SET status = 'safe_replacement'"),
      "42501",
    );
    await expectPostgresError(() => app.query("DELETE FROM interpretation_verification"), "42501");
    await expectPostgresError(() => app.query("TRUNCATE interpretation_verification"), "42501");
    const interpretationPolicies = await app.query<{
      command: string;
      forceRowSecurity: boolean;
      policyName: string;
      roles: string[];
      rowSecurity: boolean;
    }>(`
      SELECT policy.policyname AS "policyName", policy.cmd AS command,
             to_json(policy.roles) AS roles, relation.relrowsecurity AS "rowSecurity",
             relation.relforcerowsecurity AS "forceRowSecurity"
        FROM pg_policies AS policy
        JOIN pg_class AS relation
          ON relation.oid = 'public.interpretation'::regclass
       WHERE policy.schemaname = 'public' AND policy.tablename = 'interpretation'
       ORDER BY policy.policyname
    `);
    assert.deepEqual(interpretationPolicies.rows, [
      {
        command: "INSERT",
        forceRowSecurity: true,
        policyName: "interpretation_claim_insert",
        roles: [INTERPRETATION_WRITER_ROLE],
        rowSecurity: true,
      },
      {
        command: "UPDATE",
        forceRowSecurity: true,
        policyName: "interpretation_generating_transition",
        roles: [INTERPRETATION_WRITER_ROLE],
        rowSecurity: true,
      },
      {
        command: "SELECT",
        forceRowSecurity: true,
        policyName: "interpretation_read",
        roles: [INTERPRETATION_READER_ROLE],
        rowSecurity: true,
      },
    ]);
    const verificationPolicies = await app.query<{
      command: string;
      forceRowSecurity: boolean;
      policyName: string;
      roles: string[];
      rowSecurity: boolean;
    }>(`
      SELECT policy.policyname AS "policyName", policy.cmd AS command,
             to_json(policy.roles) AS roles, relation.relrowsecurity AS "rowSecurity",
             relation.relforcerowsecurity AS "forceRowSecurity"
        FROM pg_policies AS policy
        JOIN pg_class AS relation
          ON relation.oid = 'public.interpretation_verification'::regclass
       WHERE policy.schemaname = 'public'
         AND policy.tablename = 'interpretation_verification'
       ORDER BY policy.policyname
    `);
    assert.deepEqual(verificationPolicies.rows, [
      {
        command: "INSERT",
        forceRowSecurity: true,
        policyName: "interpretation_verification_insert",
        roles: [VERIFICATION_WRITER_ROLE],
        rowSecurity: true,
      },
      {
        command: "SELECT",
        forceRowSecurity: true,
        policyName: "interpretation_verification_read",
        roles: [VERIFICATION_READER_ROLE],
        rowSecurity: true,
      },
    ]);

    const identity = createAnonymousIdentityService(runtimeDatabase, {
      issuanceLimit: 10,
      issuanceWindowSeconds: 60,
      policyVersion: "test.ci-anonymous-session.v1",
      ttlSeconds: 3_600,
    });
    const issued = await identity.ensureSession({
      idempotencyKey: "ci_anonymous_identity_key_1234",
    });
    assert.equal(issued.kind, "created");
    assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/u);
    assert.deepEqual(await identity.resolveSession(issued.token), issued.context);
    assert.equal(
      await identity.allowsConsent({
        noticeVersion: "test.ci-notice.v1",
        purpose: "optional_product_analytics",
        token: issued.token,
      }),
      false,
    );
    assert.equal(await identity.revokeSession(issued.token), true);
    assert.equal(await identity.resolveSession(issued.token), null);
    await expectPostgresError(() => control.query("SELECT * FROM anonymous_subject"), "42501");
    await expectPostgresError(
      () =>
        app.query(
          "UPDATE anonymous_subject SET expires_at = expires_at + interval '1 hour' WHERE id = $1::uuid",
          [issued.context.subjectId],
        ),
      "42501",
    );
    await expectPostgresError(
      () => app.query("UPDATE consent_record SET decision = 'denied'"),
      "42501",
    );
    const appendOnlyPolicies = await app.query<{
      commands: string[];
      forceRowSecurity: boolean;
      rowSecurity: boolean;
    }>(`
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
    const policyRoles = await app.query<{
      command: string;
      policyName: string;
      roles: string[];
    }>(`SELECT policyname AS "policyName", cmd AS command, to_json(roles) AS roles
          FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'feature_flag_version'
         ORDER BY policyname`);
    assert.deepEqual(policyRoles.rows, [
      {
        command: "INSERT",
        policyName: "feature_flag_version_append",
        roles: [FLAG_WRITER_ROLE],
      },
      {
        command: "INSERT",
        policyName: "feature_flag_version_astrology_append",
        roles: [FLAG_WRITER_ROLE],
      },
      {
        command: "SELECT",
        policyName: "feature_flag_version_read",
        roles: [FLAG_READER_ROLE],
      },
    ]);

    await expectConstraint(
      migrator,
      "INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic) VALUES ($1, 1, $2, true)",
      ["Invalid Key", "a".repeat(64)],
      "seed_manifest_dataset_key_check",
    );
    await expectConstraint(
      migrator,
      "INSERT INTO seed_manifest (id, dataset_key, version, checksum_sha256, is_synthetic) VALUES ($1, $2, 1, $3, true)",
      ["6d393ec1-2019-4abc-9cf8-62f58c72efe8", "foundation-synthetic", "a".repeat(64)],
      "seed_manifest_pkey",
    );
    await expectConstraint(
      control,
      `INSERT INTO feature_flag_version
         (registry_version, flag_key, version, effective_at, change_reference, actor_id)
       VALUES (0, $1, 1, $2, 'RIT-007', 'ci.verifier')`,
      ["experience.public_shell", new Date("2026-07-17T11:00:00.000Z")],
      "feature_flag_version_registry_version_check",
    );

    const inserted = await control.query<{ id: string }>(
      `INSERT INTO feature_flag_version
         (registry_version, flag_key, version, effective_at, change_reference, actor_id)
       VALUES (1, $1, 1, $2, 'RIT-007', 'ci.verifier')
       RETURNING id::text AS id`,
      ["experience.public_shell", new Date("2026-07-17T11:00:00.000Z")],
    );
    await expectPostgresError(
      () =>
        control.query(
          `INSERT INTO feature_flag_version
             (registry_version, flag_key, version, state, country_codes, effective_at,
              change_reference, approval_reference, actor_id)
           VALUES (1, 'payments.fiat_checkout', 1, 'on', ARRAY['US'], $1,
                   'RIT-063', 'OWN-004:wrong-gate', 'ci.verifier')`,
          [new Date("2026-07-17T12:00:00.000Z")],
        ),
      "42501",
    );
    await control.query(
      `INSERT INTO feature_flag_version
         (registry_version, flag_key, version, state, country_codes, effective_at,
          change_reference, approval_reference, actor_id)
       VALUES (1, 'payments.fiat_checkout', 1, 'on', ARRAY['US'], $1,
               'RIT-063', 'OWN-002:ci-owner-record', 'ci.verifier')`,
      [new Date("2026-07-17T12:00:00.000Z")],
    );
    await control.query(
      `INSERT INTO feature_flag_version
         (registry_version, flag_key, version, effective_at, change_reference, actor_id)
       VALUES (2, 'experience.public_shell', 1, $1, 'RIT-007', 'ci.verifier')`,
      [new Date("2026-07-17T12:00:00.000Z")],
    );
    await expectPostgresError(
      () =>
        app.query(
          `INSERT INTO feature_flag_version
             (registry_version, flag_key, version, effective_at, change_reference, actor_id)
           VALUES (1, 'experience.public_shell', 99, now(), 'RIT-007', 'ci.runtime')`,
        ),
      "42501",
    );
    await expectPostgresError(
      () =>
        control.query("UPDATE feature_flag_version SET state = 'on' WHERE id = $1::uuid", [
          inserted.rows[0]?.id,
        ]),
      "42501",
    );
    const unchanged = await app.query<{ state: string }>(
      "SELECT state FROM feature_flag_version WHERE id = $1::uuid",
      [inserted.rows[0]?.id],
    );
    assert.deepEqual(unchanged.rows, [{ state: "off" }]);
    const persisted = await app.query<{
      countryCodes: string[];
      flagKey: string;
      registryVersion: number;
      state: string;
      version: number;
    }>(`SELECT registry_version AS "registryVersion", flag_key AS "flagKey", version, state,
               country_codes AS "countryCodes"
          FROM feature_flag_version
         ORDER BY registry_version, flag_key, version`);
    assert.deepEqual(persisted.rows, [
      {
        countryCodes: [],
        flagKey: "experience.public_shell",
        registryVersion: 1,
        state: "off",
        version: 1,
      },
      {
        countryCodes: ["US"],
        flagKey: "payments.fiat_checkout",
        registryVersion: 1,
        state: "on",
        version: 1,
      },
      {
        countryCodes: [],
        flagKey: "experience.public_shell",
        registryVersion: 2,
        state: "off",
        version: 1,
      },
    ]);

    await expectPostgresError(
      () => app.query("ALTER TABLE feature_flag_version DISABLE ROW LEVEL SECURITY"),
      "42501",
    );
    await expectPostgresError(
      () => app.query("DROP POLICY feature_flag_version_read ON feature_flag_version"),
      "42501",
    );
    await expectPostgresError(() => app.query("TRUNCATE feature_flag_version"), "42501");

    await migrator.query("BEGIN");
    await migrator.query(
      "INSERT INTO seed_manifest (dataset_key, version, checksum_sha256, is_synthetic) VALUES ($1, 1, $2, true)",
      ["transaction-rollback", "b".repeat(64)],
    );
    await migrator.query("ROLLBACK");
    const rollback = await app.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM seed_manifest WHERE dataset_key = 'transaction-rollback'",
    );
    assert.equal(rollback.rows[0]?.count, 0);
  } finally {
    await Promise.all([
      app.end(),
      control.end(),
      migrator.end(),
      runtimeDatabase.$disconnect(),
      adminServiceDatabase.$disconnect(),
      controlDatabase.$disconnect(),
      migratorDatabase.$disconnect(),
      preselectedRuntimeDatabase.$disconnect(),
    ]);
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
  await grantRuntimePrivileges();
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
    "Verified ephemeral CI PostgreSQL attestation, least privilege, migration idempotence/drift, seed idempotence, feature-flag immutability, constraints, and transaction rollback.\n",
  );
} catch {
  process.stderr.write(
    `CI database foundation verification failed during ${verificationStage}; sensitive diagnostics were suppressed.\n`,
  );
  process.exitCode = 1;
}
