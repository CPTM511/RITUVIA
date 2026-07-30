import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { planCommercialCreditPackFulfillment } from "../packages/payments/src/commercial-fulfillment.js";
import { evaluateCommercialRefundEligibility } from "../packages/payments/src/commercial-refund.js";
import { reduceCommercialPaymentTimeline } from "../packages/payments/src/commercial-webhook.js";
import { createCommercialCheckoutPersistence } from "../packages/db/src/commercial-checkout-persistence.js";
import { createCommercialFulfillmentPersistence } from "../packages/db/src/commercial-fulfillment-persistence.js";
import {
  createCommercialPaymentEventPersistence,
  type PreparedCommercialPaymentEvent,
} from "../packages/db/src/commercial-payment-event-persistence.js";
import {
  createCommercialRefundPersistence,
  CommercialRefundPersistenceError,
} from "../packages/db/src/commercial-refund-persistence.js";
import { createDatabaseClient } from "../packages/db/src/client.js";
import {
  createLocalPostgresClient,
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "../packages/db/scripts/local-postgres.mjs";

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const expectPostgresError = async (operation: () => Promise<unknown>): Promise<void> => {
  try {
    await operation();
    assert.fail("Expected a least-privilege PostgreSQL denial.");
  } catch (error) {
    assert.equal(String((error as { code?: unknown }).code), "42501");
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
    const paymentWebhook = createDatabaseClient(database.paymentWebhookDatabaseUrl);
    const fulfillmentDatabase = createDatabaseClient(database.paymentFulfillmentDatabaseUrl);
    const migrator = createLocalPostgresClient(database.migrationDatabaseUrl);
    const applicationSql = createLocalPostgresClient(database.databaseUrl);
    await Promise.all([migrator.connect(), applicationSql.connect()]);
    try {
      const checkout = createCommercialCheckoutPersistence(application);
      const paymentEvents = createCommercialPaymentEventPersistence(paymentWebhook);
      const fulfillment = createCommercialFulfillmentPersistence(fulfillmentDatabase);
      const refunds = createCommercialRefundPersistence(application);
      let sequence = 0;
      let clock = Date.parse("2026-07-30T14:00:00.000Z");

      const nextInstant = (): string => {
        clock += 1_000;
        return new Date(clock).toISOString();
      };
      const createUser = async (): Promise<string> => {
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
        return userId;
      };
      const createPaidOrder = async (userId: string) => {
        sequence += 1;
        const current = sequence;
        const createdAt = nextInstant();
        const created = await checkout.createOrReplayStripeCheckout({
          amountMinor: 599,
          canonicalRequestHash: digest(`refund-checkout-${current}`),
          catalogVersion: "local.catalog.2026-07-23.v1",
          countryCode: "US",
          countryPolicyVersion: "local.us.stripe-sandbox.v1",
          createdAt,
          creditsGranted: 6,
          currencyCode: "USD",
          exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
          fulfillmentCode: "credits.pack_6",
          idempotencyKeyHash: digest(`refund-checkout-idempotency-${current}`),
          priceId: "price.pack_6.usd.2026-07-23",
          priceVersion: "2026-07-23",
          productCode: "pack_6",
          productVersion: "2026-07-23",
          providerAccountFingerprint: "acct_12345678",
          provisionalExpiresAt: new Date(Date.parse(createdAt) + 86_400_000).toISOString(),
          refundPolicyVersion: "local.refund.v1",
          termsVersion: "local.terms.v1",
          userId,
        });
        const checkoutId = `cs_test_refund_${current}`;
        const paymentIntentId = `pi_refund_${current}`;
        await checkout.attachStripeCheckout({
          attachedAt: nextInstant(),
          checkoutExpiresAt: new Date(clock + 1_800_000).toISOString(),
          checkoutId,
          checkoutUrl: `https://checkout.stripe.com/c/pay/${checkoutId}`,
          orderId: created.checkout.orderId,
          userId,
        });
        const paid = paymentEvent(
          { checkoutId, orderId: created.checkout.orderId, paymentIntentId },
          "payment_succeeded",
          nextInstant(),
        );
        await paymentEvents.processStripeSandboxEvent(paid, reduceCommercialPaymentTimeline);
        const claim = await claimAndFulfill();
        assert.equal(claim.creditsGranted, 6);
        const grants = await migrator.query<{ id: string }>(
          `
            SELECT ledger.id
            FROM credit_ledger_entry AS ledger
            JOIN commercial_order_v2 AS orders ON orders.id = ledger.order_id
            WHERE orders.public_id = $1::uuid
              AND ledger.direction = 'grant'
          `,
          [created.checkout.orderId],
        );
        const grantId = grants.rows.at(0)?.id;
        assert(grantId);
        return Object.freeze({
          checkoutId,
          grantId,
          orderId: created.checkout.orderId,
          paymentIntentId,
          userId,
        });
      };
      const paymentEvent = (
        order: Readonly<{ checkoutId: string; orderId: string; paymentIntentId: string }>,
        eventType: PreparedCommercialPaymentEvent["eventType"],
        occurredAt: string,
      ): PreparedCommercialPaymentEvent => {
        const providerEventId = `evt_refund_${sequence}_${eventType}_${Date.parse(occurredAt)}`;
        return Object.freeze({
          amountMinor: 599,
          currencyCode: "USD",
          evidenceSource: "signed_webhook",
          eventType,
          normalizationVersion: "stripe-commercial-event.v1",
          occurredAt,
          orderId: order.orderId,
          payloadDigest: digest(providerEventId),
          providerAccountFingerprint: "acct_12345678",
          providerCheckoutId: order.checkoutId,
          providerEventId,
          providerObjectId: order.paymentIntentId,
          providerPaymentIntentId: order.paymentIntentId,
          receivedAt: nextInstant(),
          signatureTimestampSeconds: Math.floor(clock / 1_000),
          verifierVersion: "stripe-signature.v1",
        });
      };
      const claimAndFulfill = async () => {
        const claimedAt = nextInstant();
        const leaseTokenHash = digest(`refund-fulfillment-lease-${clock}`);
        const claim = await fulfillment.claimNextPaymentState({
          claimedAt,
          leaseTokenHash,
          leasedUntil: new Date(Date.parse(claimedAt) + 60_000).toISOString(),
        });
        assert(claim);
        const result = await fulfillment.fulfillPaymentState(
          {
            completedAt: nextInstant(),
            leaseTokenHash,
            outboxId: claim.outboxId,
          },
          planCommercialCreditPackFulfillment,
        );
        assert(result);
        return result;
      };
      const refundInput = (
        order: Readonly<{ orderId: string; userId: string }>,
        idempotency: string,
        refundId = randomUUID(),
      ) =>
        Object.freeze({
          canonicalRequestHash: digest(`refund-request:${order.orderId}`),
          createdAt: nextInstant(),
          idempotencyKeyHash: digest(idempotency),
          orderId: order.orderId,
          providerAccountFingerprint: "acct_12345678",
          refundId,
          userId: order.userId,
        });

      const userId = await createUser();
      const order = await createPaidOrder(userId);
      const sharedInput = refundInput(order, "refund-idempotency-shared");
      const concurrent = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          refunds.prepareStripeSandboxRefund(
            { ...sharedInput, refundId: index === 0 ? sharedInput.refundId : randomUUID() },
            evaluateCommercialRefundEligibility,
          ),
        ),
      );
      assert.equal(concurrent.filter(({ kind }) => kind === "created").length, 1);
      assert.equal(new Set(concurrent.map(({ refundId }) => refundId)).size, 1);
      const prepared = concurrent[0]!;
      const projectionHeld = await migrator.query<{
        purchasedAvailable: number;
        purchasedHeld: number;
      }>(
        `
          SELECT
            purchased_available AS "purchasedAvailable",
            purchased_held AS "purchasedHeld"
          FROM credit_projection
          WHERE user_id = $1::uuid
        `,
        [userId],
      );
      assert.deepEqual(projectionHeld.rows[0], { purchasedAvailable: 0, purchasedHeld: 6 });

      const submitted = await refunds.submitStripeSandboxRefund({
        providerRefundId: "re_refund_12345678",
        refundId: prepared.refundId,
        submittedAt: nextInstant(),
        userId,
      });
      assert.equal(submitted.orderStatus, "refund_requested");
      const duplicateSuccess = await paymentEvents.processStripeSandboxEvent(
        paymentEvent(order, "payment_succeeded", nextInstant()),
        reduceCommercialPaymentTimeline,
      );
      assert.equal(duplicateSuccess.orderStatus, "refund_requested");
      assert.equal(duplicateSuccess.outboxCreated, false);
      const submittedReplay = await refunds.submitStripeSandboxRefund({
        providerRefundId: "re_refund_12345678",
        refundId: prepared.refundId,
        submittedAt: nextInstant(),
        userId,
      });
      assert.equal(submittedReplay.kind, "replayed");
      await assert.rejects(
        refunds.submitStripeSandboxRefund({
          providerRefundId: "re_refund_changed",
          refundId: prepared.refundId,
          submittedAt: nextInstant(),
          userId,
        }),
        (error: unknown) =>
          error instanceof CommercialRefundPersistenceError &&
          error.code === "COMMERCIAL_REFUND_CONFLICT",
      );

      await paymentEvents.processStripeSandboxEvent(
        paymentEvent(order, "payment_refunded", nextInstant()),
        reduceCommercialPaymentTimeline,
      );
      const reversed = await claimAndFulfill();
      assert.deepEqual(
        {
          creditsReversed: reversed.creditsReversed,
          disposition: reversed.disposition,
          shortfallAmount: reversed.shortfallAmount,
        },
        { creditsReversed: 6, disposition: "adjusted", shortfallAmount: 0 },
      );
      const projectionReversed = await migrator.query<{
        purchasedAvailable: number;
        purchasedHeld: number;
      }>(
        `
          SELECT
            purchased_available AS "purchasedAvailable",
            purchased_held AS "purchasedHeld"
          FROM credit_projection
          WHERE user_id = $1::uuid
        `,
        [userId],
      );
      assert.deepEqual(projectionReversed.rows[0], { purchasedAvailable: 0, purchasedHeld: 0 });
      const confirmedRequest = await migrator.query<{
        confirmedPaymentEventId: string | null;
        status: string;
      }>(
        `
          SELECT
            confirmed_payment_event_id AS "confirmedPaymentEventId",
            status
          FROM commercial_refund_request_v1
          WHERE public_id = $1::uuid
        `,
        [prepared.refundId],
      );
      assert.equal(confirmedRequest.rows[0]?.status, "confirmed");
      assert(confirmedRequest.rows[0]?.confirmedPaymentEventId);

      const webhookFirstUserId = await createUser();
      const webhookFirstOrder = await createPaidOrder(webhookFirstUserId);
      const webhookFirstPrepared = await refunds.prepareStripeSandboxRefund(
        refundInput(webhookFirstOrder, "refund-webhook-first"),
        evaluateCommercialRefundEligibility,
      );
      await paymentEvents.processStripeSandboxEvent(
        paymentEvent(webhookFirstOrder, "payment_refunded", nextInstant()),
        reduceCommercialPaymentTimeline,
      );
      const webhookFirstFulfillment = await claimAndFulfill();
      assert.equal(webhookFirstFulfillment.creditsReversed, 6);
      const webhookFirstSubmitted = await refunds.submitStripeSandboxRefund({
        providerRefundId: "re_webhook_first",
        refundId: webhookFirstPrepared.refundId,
        submittedAt: nextInstant(),
        userId: webhookFirstUserId,
      });
      assert.equal(webhookFirstSubmitted.requestStatus, "confirmed");
      assert.equal(webhookFirstSubmitted.orderStatus, "refunded");
      assert.equal(webhookFirstSubmitted.providerRefundId, "re_webhook_first");

      const rejectedUserId = await createUser();
      const rejectedOrder = await createPaidOrder(rejectedUserId);
      const rejectedPrepared = await refunds.prepareStripeSandboxRefund(
        refundInput(rejectedOrder, "refund-rejected"),
        evaluateCommercialRefundEligibility,
      );
      await refunds.rejectStripeSandboxRefund({
        refundId: rejectedPrepared.refundId,
        rejectedAt: nextInstant(),
        userId: rejectedUserId,
      });
      const rejectedEvidence = await migrator.query<{
        purchasedAvailable: number;
        purchasedHeld: number;
        releases: number;
        status: string;
      }>(
        `
          SELECT
            projection.purchased_available AS "purchasedAvailable",
            projection.purchased_held AS "purchasedHeld",
            (
              SELECT count(*)::int
              FROM commercial_refund_credit_hold_v1
              WHERE refund_request_id = refunds.id
                AND status = 'released'
            ) AS releases,
            refunds.status
          FROM commercial_refund_request_v1 AS refunds
          JOIN credit_projection AS projection ON projection.user_id = refunds.user_id
          WHERE refunds.public_id = $1::uuid
        `,
        [rejectedPrepared.refundId],
      );
      assert.deepEqual(rejectedEvidence.rows[0], {
        purchasedAvailable: 6,
        purchasedHeld: 0,
        releases: 1,
        status: "rejected",
      });

      const raceUserId = await createUser();
      const raceOrder = await createPaidOrder(raceUserId);
      const reserveOne = async (): Promise<boolean> => {
        const client = createLocalPostgresClient(database.databaseUrl);
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
            [raceUserId],
          );
          if ((projection.rows[0]?.purchasedAvailable ?? 0) < 1) {
            await client.query("ROLLBACK");
            return false;
          }
          const reservationId = randomUUID();
          const createdAt = nextInstant();
          await client.query(
            `
              INSERT INTO credit_reservation (
                id, user_id, catalog_version, product_code, product_version, amount, status,
                idempotency_key_version, idempotency_key_hash, canonical_request_hash,
                expires_at, created_at
              ) VALUES (
                $1::uuid, $2::uuid, 'local.catalog.2026-07-23.v1', 'pack_6', '2026-07-23',
                1, 'active', 'refund-race.v1', $3, $4, $5::timestamptz, $6::timestamptz
              )
            `,
            [
              reservationId,
              raceUserId,
              Buffer.from(digest("refund-race-reservation")),
              Buffer.from(digest("refund-race-canonical")),
              new Date(Date.parse(createdAt) + 60_000).toISOString(),
              createdAt,
            ],
          );
          await client.query(
            `
              INSERT INTO credit_allocation (
                reservation_id, source_entry_id, user_id, credit_type, amount,
                allocation_order, created_at
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, 'purchased_credit', 1, 1, $4::timestamptz
              )
            `,
            [reservationId, raceOrder.grantId, raceUserId, createdAt],
          );
          await client.query(
            `
              UPDATE credit_projection
              SET purchased_available = purchased_available - 1,
                  reserved = reserved + 1,
                  version = version + 1,
                  updated_at = $2::timestamptz
              WHERE user_id = $1::uuid
                AND purchased_available >= 1
            `,
            [raceUserId, createdAt],
          );
          await client.query("COMMIT");
          return true;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          if (String((error as { code?: unknown }).code) === "40001") return false;
          throw error;
        } finally {
          await client.end();
        }
      };
      const raceResults = await Promise.allSettled([
        refunds.prepareStripeSandboxRefund(
          refundInput(raceOrder, "refund-race"),
          evaluateCommercialRefundEligibility,
        ),
        reserveOne(),
      ]);
      const refundWon = raceResults[0]?.status === "fulfilled";
      const reservationWon =
        raceResults[1]?.status === "fulfilled" && raceResults[1].value === true;
      assert.notEqual(refundWon, reservationWon);
      const raceProjection = await migrator.query<{
        purchasedAvailable: number;
        purchasedHeld: number;
        reserved: number;
      }>(
        `
          SELECT
            purchased_available AS "purchasedAvailable",
            purchased_held AS "purchasedHeld",
            reserved
          FROM credit_projection
          WHERE user_id = $1::uuid
        `,
        [raceUserId],
      );
      const raceState = raceProjection.rows[0]!;
      assert(raceState.purchasedAvailable >= 0);
      assert.equal(raceState.purchasedHeld + raceState.reserved, refundWon ? 6 : 1);

      await expectPostgresError(() =>
        applicationSql.query("DELETE FROM commercial_refund_request_v1"),
      );
      await expectPostgresError(() =>
        applicationSql.query("UPDATE commercial_refund_credit_hold_v1 SET amount = amount"),
      );
    } finally {
      await Promise.all([
        application.$disconnect(),
        paymentWebhook.$disconnect(),
        fulfillmentDatabase.$disconnect(),
        migrator.end(),
        applicationSql.end(),
      ]);
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
  "Verified full unused-Credit refund requests, 12-way idempotency, provider-pending truth, rejection release, signed confirmation reversal, refund-consumption race safety, and append-only evidence.",
);
