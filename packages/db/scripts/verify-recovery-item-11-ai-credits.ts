import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client, type DatabaseError } from "pg";

import { createDatabaseClient } from "../src/client.js";
import {
  assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges,
  createRecoveryItem11AiCreditPersistence,
} from "../src/recovery-item-11-ai-credit-persistence.js";
import {
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const aiGenerationRole = "rituvia_ai_generation";
const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  codes: readonly string[],
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${codes.join(" or ")}.`);
  } catch (error) {
    const code = String((error as DatabaseError).code);
    assert(codes.includes(code), `Observed unexpected PostgreSQL error ${code}.`);
  }
};

const roleDatabaseUrl = (adminDatabaseUrl: string, password: string): string => {
  const parsed = new URL(adminDatabaseUrl);
  parsed.username = aiGenerationRole;
  parsed.password = password;
  parsed.searchParams.set("application_name", "rituvia-item11-ai-credit-verification");
  return parsed.toString();
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let cleanupAdminUrl: string | undefined;
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    const postgresUrl = new URL(database.adminDatabaseUrl);
    postgresUrl.pathname = "/postgres";
    cleanupAdminUrl = postgresUrl.toString();

    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);

    const password = randomBytes(32).toString("base64url");
    const admin = new Client({ connectionString: database.adminDatabaseUrl });
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await admin.connect();
    await migrator.connect();
    try {
      const existingRole = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [
        aiGenerationRole,
      ]);
      if (existingRole.rowCount === 0) {
        await admin.query(
          `CREATE ROLE ${aiGenerationRole}
             NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
        );
      }
      await admin.query(
        `ALTER ROLE ${aiGenerationRole}
           NOINHERIT LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
           PASSWORD '${password}'`,
      );
      await admin.query(
        `REVOKE ALL PRIVILEGES ON DATABASE ${database.databaseName} FROM ${aiGenerationRole}`,
      );
      await admin.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${aiGenerationRole}`);
      await admin.query(
        `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${aiGenerationRole}`,
      );
      await admin.query(
        `GRANT CONNECT ON DATABASE ${database.databaseName} TO ${aiGenerationRole}`,
      );
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${aiGenerationRole}`);
      await admin.query(
        `GRANT SELECT, INSERT ON TABLE credit_reservation, credit_ledger_entry,
           credit_allocation TO ${aiGenerationRole}`,
      );
      await admin.query(`GRANT SELECT ON TABLE credit_projection TO ${aiGenerationRole}`);
      await admin.query(
        `GRANT UPDATE (status, consumed_at, released_at)
           ON credit_reservation TO ${aiGenerationRole}`,
      );
      await admin.query(
        `GRANT UPDATE (subscription_available, promotional_available, purchased_available,
           reserved, version, updated_at) ON credit_projection TO ${aiGenerationRole}`,
      );

      const userId = randomUUID();
      await admin.query(
        `INSERT INTO catalog_version (
           schema_version, version, environment, status, approval_mode, default_locale,
           supported_locales, effective_from, next_review_at, source_reference,
           source_checksum_sha256, owner_reference, actor_id
         ) VALUES (
           'catalog-version.v1', 'recovery.item11.2026-08-08.v1', 'staging', 'active',
           'written', 'en', ARRAY['en']::varchar[], '2026-08-08T00:00:00.000Z',
           '2026-09-03T00:00:00.000Z', 'test:item11', repeat('0', 64),
           'D-098:OWNER:item-11:protected-staging', 'test.item11'
         )`,
      );
      await admin.query(
        `INSERT INTO catalog_product (
           catalog_version, code, version, kind, status, fulfillment_code, credits_granted,
           credits_cost, credits_per_month, subscription_interval
         ) VALUES
           ('recovery.item11.2026-08-08.v1', 'pack_6', '2026-07-23', 'credit_pack',
            'active', 'credits.pack_6', 6, NULL, NULL, NULL),
           ('recovery.item11.2026-08-08.v1', 'deep_one', '2026-07-23', 'deep_reading',
            'active', 'deep_reading.deep_one', NULL, 1, NULL, NULL)`,
      );
      await migrator.query(
        `INSERT INTO app_user (
           id, status, locale, time_zone, age_attested_at, age_policy_version,
           email_verified_at, created_at, last_active_at
         ) VALUES (
           $1::uuid, 'active', 'en', 'UTC', CURRENT_TIMESTAMP, 'test.age.v1',
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )`,
        [userId],
      );
      const grantId = randomUUID();
      await migrator.query(
        `INSERT INTO credit_ledger_entry (
           id, user_id, credit_type, direction, amount, reason, catalog_version,
           product_code, product_version, operation, idempotency_key_version,
           idempotency_key_hash, canonical_request_hash, policy_version, terms_version
         ) VALUES (
           $1::uuid, $2::uuid, 'promotional_credit', 'grant', 2, 'item11_test_fixture',
           'recovery.item11.2026-08-08.v1', 'pack_6', '2026-07-23',
           'test.item11.credit.grant', 'test.item11.v1', $3, $4,
           'recovery.item11.ai-credit.v1', 'staging_only.terms.item11.v1'
         )`,
        [grantId, userId, Buffer.from(digest("grant-key")), Buffer.from(digest("grant-request"))],
      );
      await migrator.query(
        `INSERT INTO credit_projection (
           user_id, subscription_available, promotional_available, purchased_available,
           reserved, version
         ) VALUES ($1::uuid, 0, 2, 0, 0, 1)`,
        [userId],
      );

      const aiDatabaseUrl = roleDatabaseUrl(database.adminDatabaseUrl, password);
      const aiDatabase = createDatabaseClient(aiDatabaseUrl);
      const aiSql = new Client({ connectionString: aiDatabaseUrl });
      await aiSql.connect();
      try {
        await assertRecoveryItem11AiGenerationRuntimeDatabasePrivileges(aiDatabase);
        const persistence = createRecoveryItem11AiCreditPersistence(aiDatabase);
        assert.equal(
          await persistence.countConsumedToday({
            asOf: "2026-08-08T12:00:00.000Z",
            recoveryScope,
            userId,
          }),
          0,
        );

        const firstReservationInput = Object.freeze({
          asOf: "2026-08-08T12:00:00.000Z",
          canonicalRequestHash: digest("first-request"),
          catalogVersion: "recovery.item11.2026-08-08.v1",
          expiresAt: "2026-08-08T12:10:00.000Z",
          idempotencyKeyHash: digest("first-idempotency-key"),
          productCode: "deep_one" as const,
          productVersion: "2026-07-23",
          recoveryScope,
          userId,
        });
        const firstReservation = await persistence.reserve(firstReservationInput);
        assert.equal(firstReservation.kind, "created");
        assert.equal(
          (await persistence.reserve(firstReservationInput)).reservationId,
          firstReservation.reservationId,
        );
        assert.equal(
          await persistence.consume({
            asOf: "2026-08-08T12:00:01.000Z",
            generationId: randomUUID(),
            recoveryScope,
            reservationId: firstReservation.reservationId,
            userId,
          }),
          "consumed",
        );
        assert.equal(
          await persistence.consume({
            asOf: "2026-08-08T12:00:02.000Z",
            generationId: randomUUID(),
            recoveryScope,
            reservationId: firstReservation.reservationId,
            userId,
          }),
          "replayed",
        );
        assert.equal(
          await persistence.countConsumedToday({
            asOf: "2026-08-08T12:00:03.000Z",
            recoveryScope,
            userId,
          }),
          1,
        );

        const secondReservation = await persistence.reserve({
          ...firstReservationInput,
          asOf: "2026-08-08T12:01:00.000Z",
          canonicalRequestHash: digest("second-request"),
          expiresAt: "2026-08-08T12:11:00.000Z",
          idempotencyKeyHash: digest("second-idempotency-key"),
        });
        assert.equal(
          await persistence.release({
            asOf: "2026-08-08T12:01:01.000Z",
            recoveryScope,
            reservationId: secondReservation.reservationId,
            userId,
          }),
          "released",
        );
        assert.equal(
          await persistence.release({
            asOf: "2026-08-08T12:01:02.000Z",
            recoveryScope,
            reservationId: secondReservation.reservationId,
            userId,
          }),
          "replayed",
        );

        await expectPostgresError(() => aiSql.query("SELECT id FROM app_user LIMIT 1"), ["42501"]);
        await expectPostgresError(
          () => aiSql.query("DELETE FROM credit_reservation WHERE user_id = $1::uuid", [userId]),
          ["42501"],
        );

        const state = await migrator.query<{
          consumes: number;
          promotionalAvailable: number;
          releases: number;
          reserves: number;
          reserved: number;
        }>(
          `SELECT
             (SELECT promotional_available FROM credit_projection WHERE user_id = $1::uuid)
               AS "promotionalAvailable",
             (SELECT reserved FROM credit_projection WHERE user_id = $1::uuid) AS reserved,
             count(*) FILTER (WHERE direction = 'reserve')::integer AS reserves,
             count(*) FILTER (WHERE direction = 'consume')::integer AS consumes,
             count(*) FILTER (WHERE direction = 'release')::integer AS releases
           FROM credit_ledger_entry
          WHERE user_id = $1::uuid
          GROUP BY user_id`,
          [userId],
        );
        assert.deepEqual(state.rows[0], {
          consumes: 1,
          promotionalAvailable: 1,
          releases: 1,
          reserved: 0,
          reserves: 2,
        });
      } finally {
        await aiSql.end();
        await aiDatabase.$disconnect();
      }
    } finally {
      await migrator.end();
      await admin.end();
    }
  } catch (error) {
    primaryError = error;
  } finally {
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (cleanupError) {
        primaryError ??= cleanupError;
      }
    }
    if (cleanupAdminUrl !== undefined) {
      const cleanup = new Client({ connectionString: cleanupAdminUrl });
      try {
        await cleanup.connect();
        await cleanup.query(`DROP ROLE IF EXISTS ${aiGenerationRole}`);
      } catch (cleanupError) {
        primaryError ??= cleanupError;
      } finally {
        await cleanup.end().catch(() => undefined);
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
  }
  if (primaryError !== undefined) throw primaryError;
});

console.log(
  "Verified Item 11 AI Credit reserve, consume, release, replay, and least privilege on PostgreSQL.",
);
