import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { Client, type DatabaseError } from "pg";

import {
  CommercialCheckoutPersistenceError,
  createCommercialCheckoutPersistence,
} from "../src/commercial-checkout-persistence.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

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

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      const userId = randomUUID();
      await migrator.query(
        `
          INSERT INTO app_user (
            id, status, locale, time_zone, age_attested_at, age_policy_version,
            email_verified_at, created_at, last_active_at
          ) VALUES (
            $1::uuid, 'active', 'en', 'UTC', CURRENT_TIMESTAMP, 'test.age.v1',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `,
        [userId],
      );

      const persistence = createCommercialCheckoutPersistence(application);
      const prepared = Object.freeze({
        amountMinor: 599,
        billingInterval: "one_time" as const,
        canonicalRequestHash: digest("pack_6:/en/checkout/return:/en/store"),
        catalogVersion: "local.catalog.2026-07-23.v1",
        countryCode: "US",
        countryPolicyVersion: "local.us.stripe-sandbox.v1",
        createdAt: "2026-07-30T12:00:00.000Z",
        creditsGranted: 6,
        creditsPerMonth: null,
        currencyCode: "USD",
        exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
        fulfillmentCode: "credits.pack_6",
        fulfillmentKind: "credit_pack" as const,
        idempotencyKeyHash: digest("checkout-key-one"),
        priceId: "price.pack_6.usd.2026-07-23",
        priceVersion: "2026-07-23",
        productCode: "pack_6",
        productVersion: "2026-07-23",
        providerAccountFingerprint: "acct_12345678",
        provisionalExpiresAt: "2026-07-31T12:00:00.000Z",
        refundPolicyVersion: "test:local:refund.v1",
        termsVersion: "local.terms.v1",
        userId,
      });

      const created = await persistence.createOrReplayStripeCheckout(prepared);
      assert.equal(created.kind, "created");
      assert.equal(created.checkout.state, "created");
      assert.match(created.checkout.providerIdempotencyKey, /^stripe:[0-9a-f-]{36}:1$/u);

      const replayed = await persistence.createOrReplayStripeCheckout(prepared);
      assert.equal(replayed.kind, "replayed");
      assert.equal(replayed.checkout.orderId, created.checkout.orderId);

      await assert.rejects(
        persistence.createOrReplayStripeCheckout({
          ...prepared,
          canonicalRequestHash: digest("changed-request"),
        }),
        (error: unknown) =>
          error instanceof CommercialCheckoutPersistenceError &&
          error.code === "COMMERCIAL_CHECKOUT_CONFLICT",
      );

      const concurrentPrepared = Object.freeze({
        ...prepared,
        canonicalRequestHash: digest("concurrent-request"),
        idempotencyKeyHash: digest("checkout-key-concurrent"),
      });
      const concurrent = await Promise.all(
        Array.from({ length: 12 }, () =>
          persistence.createOrReplayStripeCheckout(concurrentPrepared),
        ),
      );
      assert.equal(
        concurrent.filter(({ kind }) => kind === "created").length,
        1,
        "Concurrent requests created more than one commercial order.",
      );
      assert.equal(new Set(concurrent.map(({ checkout }) => checkout.orderId)).size, 1);

      const attached = await persistence.attachStripeCheckout({
        attachedAt: "2026-07-30T12:00:01.000Z",
        checkoutExpiresAt: "2026-07-30T12:30:00.000Z",
        checkoutId: "cs_test_12345678",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_12345678",
        orderId: created.checkout.orderId,
        userId,
      });
      assert.equal(attached.state, "checkout_created");
      assert.equal(attached.checkoutId, "cs_test_12345678");
      assert.equal(
        (
          await persistence.attachStripeCheckout({
            attachedAt: "2026-07-30T12:00:02.000Z",
            checkoutExpiresAt: "2026-07-30T12:30:00.000Z",
            checkoutId: "cs_test_12345678",
            checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_12345678",
            orderId: created.checkout.orderId,
            userId,
          })
        ).checkoutId,
        "cs_test_12345678",
      );
      await assert.rejects(
        persistence.attachStripeCheckout({
          attachedAt: "2026-07-30T12:00:02.000Z",
          checkoutExpiresAt: "2026-07-30T12:30:00.000Z",
          checkoutId: "cs_test_changed",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_changed",
          orderId: created.checkout.orderId,
          userId,
        }),
        (error: unknown) =>
          error instanceof CommercialCheckoutPersistenceError &&
          error.code === "COMMERCIAL_CHECKOUT_CONFLICT",
      );

      const counts = await migrator.query<{
        attempts: number;
        credits: number;
        entitlements: number;
        orders: number;
        paidOrders: number;
      }>(
        `
          SELECT
            (SELECT count(*)::int FROM commercial_order_v2 WHERE user_id = $1::uuid) AS orders,
            (SELECT count(*)::int
               FROM commercial_payment_attempt_v2 AS attempts
               JOIN commercial_order_v2 AS orders ON orders.id = attempts.order_id
              WHERE orders.user_id = $1::uuid) AS attempts,
            (SELECT count(*)::int
               FROM commercial_order_v2
              WHERE user_id = $1::uuid AND status = 'paid') AS "paidOrders",
            (SELECT count(*)::int FROM credit_ledger_entry WHERE user_id = $1::uuid) AS credits,
            (SELECT count(*)::int FROM commercial_entitlement_v2 WHERE user_id = $1::uuid)
              AS entitlements
        `,
        [userId],
      );
      assert.deepEqual(counts.rows[0], {
        attempts: 2,
        credits: 0,
        entitlements: 0,
        orders: 2,
        paidOrders: 0,
      });

      const applicationSql = new Client({ connectionString: database.databaseUrl });
      await applicationSql.connect();
      try {
        await expectPostgresError(
          () =>
            applicationSql.query(
              `
                UPDATE commercial_payment_attempt_v2
                   SET amount_minor = amount_minor + 1
                 WHERE provider_checkout_id = 'cs_test_12345678'
              `,
            ),
          ["42501"],
        );
        await expectPostgresError(
          () =>
            applicationSql.query(
              `
                DELETE FROM commercial_order_v2
                 WHERE public_id = $1::uuid
              `,
              [created.checkout.orderId],
            ),
          ["42501"],
        );
      } finally {
        await applicationSql.end();
      }
    } finally {
      await application.$disconnect();
      await migrator.end();
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
  "Verified Stripe sandbox commercial checkout idempotency, atomic attachment, least privilege, and zero fulfillment side effects.",
);
