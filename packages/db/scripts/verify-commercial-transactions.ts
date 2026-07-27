import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { Client, type DatabaseError } from "pg";

import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

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

const insertUser = async (client: Client, userId: string): Promise<void> => {
  await client.query(
    `
      INSERT INTO app_user (
        id, status, locale, time_zone, email_verified_at, created_at, last_active_at
      ) VALUES ($1::uuid, 'active', 'en', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [userId],
  );
};

const insertOrder = async (
  client: Client,
  input: Readonly<{
    idempotency: string;
    orderId: string;
    request: string;
    status?: string;
    userId: string;
  }>,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO commercial_order_v2 (
        id, user_id, status, currency_code, subtotal_minor, tax_minor, total_minor,
        refunded_minor, country_code, country_policy_version, catalog_version,
        price_id, price_version, terms_version, refund_policy_version,
        idempotency_key_version, idempotency_key_hash, canonical_request_hash,
        created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, 'USD', 599, 0, 599, 0, 'US',
        'local.us.commerce.v1', 'local.catalog.2026-07-23.v1',
        'price.pack_6.usd.2026-07-23', '2026-07-23', 'local.terms.v1',
        'test:local:refund.v1', 'sha256.v1', $4, $5, CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
    [
      input.orderId,
      input.userId,
      input.status ?? "created",
      digest(input.idempotency),
      digest(input.request),
    ],
  );
};

const insertCreditEntry = async (
  client: Client,
  input: Readonly<{
    direction: "consume" | "grant" | "release" | "reserve";
    idempotency: string;
    operation: string;
    reservationId?: string;
    userId: string;
  }>,
): Promise<string> => {
  const entryId = randomUUID();
  await client.query(
    `
      INSERT INTO credit_ledger_entry (
        id, user_id, credit_type, direction, amount, reason, catalog_version,
        product_code, product_version, reservation_id, operation,
        idempotency_key_version, idempotency_key_hash, canonical_request_hash,
        policy_version, terms_version, created_at
      ) VALUES (
        $1::uuid, $2::uuid, 'purchased_credit', $3, 1, $4,
        'local.catalog.2026-07-23.v1', $5, '2026-07-23', $6::uuid, $7,
        'sha256.v1', $8, $9, 'credit.local.v1', 'local.terms.v1', CURRENT_TIMESTAMP
      )
    `,
    [
      entryId,
      input.userId,
      input.direction,
      input.direction === "grant" ? "purchased_pack" : `reservation_${input.direction}`,
      input.direction === "grant" ? "pack_6" : "deep_one",
      input.reservationId ?? null,
      input.operation,
      digest(input.idempotency),
      digest(`${input.operation}:${input.idempotency}`),
    ],
  );
  return entryId;
};

const reserveOne = async (
  databaseUrl: string,
  userId: string,
  index: number,
  grantEntryId: string,
): Promise<boolean> => {
  for (let retry = 0; retry < 8; retry += 1) {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const projection = await client.query<{ purchasedAvailable: number }>(
        `
          SELECT purchased_available AS "purchasedAvailable"
            FROM credit_projection
           WHERE user_id = $1::uuid
           FOR UPDATE
        `,
        [userId],
      );
      if ((projection.rows[0]?.purchasedAvailable ?? 0) < 1) {
        await client.query("ROLLBACK");
        return false;
      }
      const reservationId = randomUUID();
      await client.query(
        `
          INSERT INTO credit_reservation (
            id, user_id, catalog_version, product_code, product_version, amount,
            status, idempotency_key_version, idempotency_key_hash,
            canonical_request_hash, expires_at, created_at
          ) VALUES (
            $1::uuid, $2::uuid, 'local.catalog.2026-07-23.v1', 'deep_one',
            '2026-07-23', 1, 'active', 'sha256.v1', $3, $4,
            CURRENT_TIMESTAMP + INTERVAL '15 minutes', CURRENT_TIMESTAMP
          )
        `,
        [reservationId, userId, digest(`reservation-${index}`), digest(`deep_one:${index}`)],
      );
      await insertCreditEntry(client, {
        direction: "reserve",
        idempotency: `reserve-${index}`,
        operation: "credit.reserve",
        reservationId,
        userId,
      });
      await client.query(
        `
          INSERT INTO credit_allocation (
            reservation_id, source_entry_id, credit_type, amount, allocation_order
          ) VALUES ($1::uuid, $2::uuid, 'purchased_credit', 1, 1)
        `,
        [reservationId, grantEntryId],
      );
      await client.query(
        `
          UPDATE credit_projection
             SET purchased_available = purchased_available - 1,
                 reserved = reserved + 1,
                 version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1::uuid
        `,
        [userId],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as DatabaseError).code !== "40001" || retry === 7) throw error;
    } finally {
      await client.end();
    }
  }
  return false;
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = new Client({ connectionString: database.databaseUrl });
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await Promise.all([application.connect(), migrator.connect()]);
    try {
      const userId = randomUUID();
      const orderId = randomUUID();
      await insertUser(migrator, userId);
      await insertOrder(application, {
        idempotency: "order-one",
        orderId,
        request: "pack_6",
        userId,
      });
      await application.query(
        `
          INSERT INTO commercial_order_item_v2 (
            order_id, catalog_version, product_code, product_version, quantity,
            unit_amount_minor, total_minor, exact_contents_snapshot, fulfillment_kind,
            fulfillment_code, credits_granted
          ) VALUES (
            $1::uuid, 'local.catalog.2026-07-23.v1', 'pack_6', '2026-07-23',
            1, 599, 599, ARRAY['6 Credits'], 'credit_pack', 'credits.pack_6', 6
          )
        `,
        [orderId],
      );

      await expectPostgresError(
        () =>
          insertOrder(application, {
            idempotency: "order-one",
            orderId: randomUUID(),
            request: "different-request",
            userId,
          }),
        ["23505"],
      );
      await expectPostgresError(
        () =>
          insertOrder(application, {
            idempotency: "invalid-state",
            orderId: randomUUID(),
            request: "pack_6",
            status: "client_paid",
            userId,
          }),
        ["23514"],
      );

      await application.query(
        `
          INSERT INTO commercial_payment_attempt_v2 (
            order_id, provider, environment, attempt_number, state, amount_minor,
            currency_code, idempotency_key_version, idempotency_key_hash,
            canonical_request_hash, expires_at, created_at, updated_at
          ) VALUES (
            $1::uuid, 'local_test', 'local', 1, 'created', 599, 'USD', 'sha256.v1',
            $2, $3, CURRENT_TIMESTAMP + INTERVAL '30 minutes', CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `,
        [orderId, digest("attempt-one"), digest("attempt-request")],
      );
      await expectPostgresError(
        () =>
          application.query(
            `
              INSERT INTO commercial_payment_attempt_v2 (
                order_id, provider, environment, attempt_number, state, amount_minor,
                currency_code, idempotency_key_version, idempotency_key_hash,
                canonical_request_hash, expires_at, created_at, updated_at
              ) VALUES (
                $1::uuid, 'coinbase_usdc_base', 'sandbox', 2, 'created', 599, 'USD',
                'sha256.v1', $2, $3, CURRENT_TIMESTAMP + INTERVAL '30 minutes',
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )
            `,
            [orderId, digest("attempt-crypto"), digest("attempt-crypto-request")],
          ),
        ["23514"],
      );

      await application.query(
        `
          INSERT INTO credit_projection (
            user_id, purchased_available, version, updated_at
          ) VALUES ($1::uuid, 6, 1, CURRENT_TIMESTAMP)
        `,
        [userId],
      );
      const grantEntryId = await insertCreditEntry(application, {
        direction: "grant",
        idempotency: "pack-six-grant",
        operation: "credit.grant",
        userId,
      });

      const reservations = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          reserveOne(database.databaseUrl, userId, index, grantEntryId),
        ),
      );
      assert.equal(
        reservations.filter(Boolean).length,
        6,
        "Concurrent reservations exceeded authoritative availability.",
      );
      const projection = await application.query<{
        purchasedAvailable: number;
        reserved: number;
      }>(
        `
          SELECT purchased_available AS "purchasedAvailable", reserved
            FROM credit_projection
           WHERE user_id = $1::uuid
        `,
        [userId],
      );
      assert.deepEqual(projection.rows[0], { purchasedAvailable: 0, reserved: 6 });

      const activeReservation = await application.query<{ id: string }>(
        `
          SELECT id FROM credit_reservation
           WHERE user_id = $1::uuid AND status = 'active'
           ORDER BY created_at, id LIMIT 1
        `,
        [userId],
      );
      const reservationId = activeReservation.rows[0]?.id;
      assert(reservationId);
      const consumeEntryId = await insertCreditEntry(application, {
        direction: "consume",
        idempotency: "consume-one",
        operation: "credit.consume",
        reservationId,
        userId,
      });
      await application.query(
        `
          UPDATE credit_reservation
             SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
           WHERE id = $1::uuid AND status = 'active'
        `,
        [reservationId],
      );
      await application.query(
        `
          UPDATE credit_projection
             SET reserved = reserved - 1, version = version + 1,
                 updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1::uuid
        `,
        [userId],
      );
      await application.query(
        `
          INSERT INTO commercial_entitlement_v2 (
            user_id, entitlement_type, catalog_version, product_code, product_version,
            fulfillment_code, status, source_ledger_entry_id, idempotency_key_version,
            idempotency_key_hash, canonical_request_hash, granted_at
          ) VALUES (
            $1::uuid, 'permanent_object', 'local.catalog.2026-07-23.v1',
            'mindful_incense', '2026-07-23', 'sanctuary.mindful_incense', 'active',
            $2::uuid, 'sha256.v1', $3, $4, CURRENT_TIMESTAMP
          )
        `,
        [userId, consumeEntryId, digest("entitlement-one"), digest("mindful-incense-entitlement")],
      );

      await expectPostgresError(
        () =>
          application.query(
            `
              INSERT INTO commercial_entitlement_v2 (
                user_id, entitlement_type, catalog_version, product_code,
                product_version, fulfillment_code, status, source_order_id,
                idempotency_key_version, idempotency_key_hash,
                canonical_request_hash, granted_at
              ) VALUES (
                $1::uuid, 'permanent_object', 'local.catalog.2026-07-23.v1',
                'moonlit_lotus', '2026-07-23', 'sanctuary.moonlit_lotus',
                'active', $2::uuid, 'sha256.v1', $3, $4, CURRENT_TIMESTAMP
              )
            `,
            [
              userId,
              orderId,
              digest("invalid-entitlement-source"),
              digest("invalid-entitlement-request"),
            ],
          ),
        ["23514"],
      );

      await expectPostgresError(
        () =>
          insertCreditEntry(application, {
            direction: "grant",
            idempotency: "pack-six-grant",
            operation: "credit.grant",
            userId,
          }),
        ["23505"],
      );
      await expectPostgresError(
        () => application.query("UPDATE credit_ledger_entry SET amount = amount"),
        ["42501"],
      );
      await expectPostgresError(
        () => application.query("DELETE FROM credit_ledger_entry"),
        ["42501"],
      );
      const privileges = await application.query<{
        canDeleteLedger: boolean;
        canInsertLedger: boolean;
        canUpdateLedger: boolean;
      }>(`
        SELECT
          has_table_privilege(current_user, 'credit_ledger_entry', 'INSERT') AS "canInsertLedger",
          has_table_privilege(current_user, 'credit_ledger_entry', 'UPDATE') AS "canUpdateLedger",
          has_table_privilege(current_user, 'credit_ledger_entry', 'DELETE') AS "canDeleteLedger"
      `);
      assert.deepEqual(privileges.rows[0], {
        canDeleteLedger: false,
        canInsertLedger: true,
        canUpdateLedger: false,
      });

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredApplication = new Client({ connectionString: restored.databaseUrl });
      await restoredApplication.connect();
      try {
        const restoredEvidence = await restoredApplication.query<{ grants: number }>(
          `
            SELECT count(*)::int AS grants
              FROM credit_ledger_entry
             WHERE direction = 'grant'
          `,
        );
        assert.equal(restoredEvidence.rows[0]?.grants, 1);
      } finally {
        await restoredApplication.end();
      }
    } finally {
      await Promise.all([application.end(), migrator.end()]);
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
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
  }
  if (primaryError !== undefined) throw primaryError;
});

console.log(
  "Verified canonical commercial states, exact idempotency, append-only Credits, concurrent no-overspend reservations, entitlement sources, least privilege, and logical restore.",
);
