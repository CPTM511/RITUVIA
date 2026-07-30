import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { reduceCommercialPaymentTimeline } from "../packages/payments/src/index.js";
import {
  createCommercialCheckoutPersistence,
  CommercialPaymentEventPersistenceError,
  createCommercialPaymentEventPersistence,
  type PreparedCommercialPaymentEvent,
} from "../packages/db/src/index.js";
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

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  codes: readonly string[],
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${codes.join(" or ")}.`);
  } catch (error) {
    const code = String((error as { code?: unknown }).code);
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
    const paymentWebhook = createDatabaseClient(database.paymentWebhookDatabaseUrl);
    const migrator = createLocalPostgresClient(database.migrationDatabaseUrl);
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

      const checkout = createCommercialCheckoutPersistence(application);
      const events = createCommercialPaymentEventPersistence(paymentWebhook);
      const wronglyPrivilegedEvents = createCommercialPaymentEventPersistence(application);
      let sequence = 0;
      const createCheckout = async () => {
        sequence += 1;
        const created = await checkout.createOrReplayStripeCheckout({
          amountMinor: 599,
          canonicalRequestHash: digest(`checkout-request-${sequence}`),
          catalogVersion: "local.catalog.2026-07-23.v1",
          countryCode: "US",
          countryPolicyVersion: "local.us.stripe-sandbox.v1",
          createdAt: "2026-07-30T12:00:00.000Z",
          creditsGranted: 6,
          currencyCode: "USD",
          exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
          fulfillmentCode: "credits.pack_6",
          idempotencyKeyHash: digest(`checkout-idempotency-${sequence}`),
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
        const checkoutId = `cs_test_${String(sequence).padStart(8, "0")}`;
        await checkout.attachStripeCheckout({
          attachedAt: "2026-07-30T12:00:01.000Z",
          checkoutExpiresAt: "2026-07-30T12:30:00.000Z",
          checkoutId,
          checkoutUrl: `https://checkout.stripe.com/c/pay/${checkoutId}`,
          orderId: created.checkout.orderId,
          userId,
        });
        return Object.freeze({ checkoutId, orderId: created.checkout.orderId });
      };
      const event = (
        order: Readonly<{ checkoutId: string; orderId: string }>,
        input: Readonly<{
          amountMinor?: number;
          eventId: string;
          eventType: PreparedCommercialPaymentEvent["eventType"];
          occurredAt: string;
          paymentIntentId?: string | null;
          receivedAt: string;
        }>,
      ): PreparedCommercialPaymentEvent =>
        Object.freeze({
          amountMinor: input.amountMinor ?? 599,
          currencyCode: "USD",
          eventType: input.eventType,
          normalizationVersion: "stripe-commercial-event.v1",
          occurredAt: input.occurredAt,
          orderId: order.orderId,
          payloadDigest: digest(
            JSON.stringify({
              amountMinor: input.amountMinor ?? 599,
              eventId: input.eventId,
              eventType: input.eventType,
              orderId: order.orderId,
              paymentIntentId: input.paymentIntentId ?? "pi_00000001",
            }),
          ),
          providerAccountFingerprint: "acct_12345678",
          providerCheckoutId: order.checkoutId,
          providerEventId: input.eventId,
          providerObjectId: input.paymentIntentId ?? order.checkoutId,
          providerPaymentIntentId: input.paymentIntentId ?? "pi_00000001",
          receivedAt: input.receivedAt,
          signatureTimestampSeconds: Math.floor(Date.parse(input.receivedAt) / 1_000),
          verifierVersion: "stripe-signature.v1",
        });

      const firstOrder = await createCheckout();
      await assert.rejects(
        wronglyPrivilegedEvents.processStripeSandboxEvent(
          event(firstOrder, {
            eventId: "evt_wrong_role",
            eventType: "payment_pending",
            occurredAt: "2026-07-30T12:01:00.000Z",
            receivedAt: "2026-07-30T12:01:01.000Z",
          }),
          reduceCommercialPaymentTimeline,
        ),
        (error: unknown) =>
          error instanceof CommercialPaymentEventPersistenceError &&
          error.code === "COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE",
      );

      await migrator.query(
        "GRANT SELECT (id) ON TABLE credit_ledger_entry TO rituvia_payment_webhook",
      );
      const columnDriftDatabase = createDatabaseClient(database.paymentWebhookDatabaseUrl);
      try {
        const columnDriftEvents = createCommercialPaymentEventPersistence(columnDriftDatabase);
        await assert.rejects(
          columnDriftEvents.processStripeSandboxEvent(
            event(firstOrder, {
              eventId: "evt_column_privilege_drift",
              eventType: "payment_pending",
              occurredAt: "2026-07-30T12:01:00.000Z",
              receivedAt: "2026-07-30T12:01:01.000Z",
            }),
            reduceCommercialPaymentTimeline,
          ),
          (error: unknown) =>
            error instanceof CommercialPaymentEventPersistenceError &&
            error.code === "COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE",
        );
      } finally {
        await columnDriftDatabase.$disconnect();
        await migrator.query(
          "REVOKE SELECT (id) ON TABLE credit_ledger_entry FROM rituvia_payment_webhook",
        );
      }

      const pending = event(firstOrder, {
        eventId: "evt_pending",
        eventType: "payment_pending",
        occurredAt: "2026-07-30T12:01:00.000Z",
        receivedAt: "2026-07-30T12:01:01.000Z",
      });
      assert.deepEqual(
        await events.processStripeSandboxEvent(pending, reduceCommercialPaymentTimeline),
        {
          disposition: "applied",
          kind: "processed",
          orderStatus: "pending",
          outboxCreated: true,
          paymentAttemptState: "pending",
        },
      );
      assert.equal(
        (await events.processStripeSandboxEvent(pending, reduceCommercialPaymentTimeline)).kind,
        "duplicate",
      );
      assert.equal(
        (
          await events.processStripeSandboxEvent(
            { ...pending, normalizationVersion: "stripe-commercial-event.v2" },
            reduceCommercialPaymentTimeline,
          )
        ).kind,
        "duplicate",
      );
      await assert.rejects(
        events.processStripeSandboxEvent(
          { ...pending, payloadDigest: digest("altered-payload") },
          reduceCommercialPaymentTimeline,
        ),
        (error: unknown) =>
          error instanceof CommercialPaymentEventPersistenceError &&
          error.code === "COMMERCIAL_PAYMENT_EVENT_CONFLICT",
      );

      const concurrentOrder = await createCheckout();
      const concurrentSuccess = event(concurrentOrder, {
        eventId: "evt_concurrent_success",
        eventType: "payment_succeeded",
        occurredAt: "2026-07-30T12:01:00.000Z",
        paymentIntentId: "pi_concurrent",
        receivedAt: "2026-07-30T12:01:01.000Z",
      });
      const concurrent = await Promise.all(
        Array.from({ length: 12 }, () =>
          events.processStripeSandboxEvent(concurrentSuccess, reduceCommercialPaymentTimeline),
        ),
      );
      assert.equal(concurrent.filter(({ kind }) => kind === "processed").length, 1);
      assert.equal(concurrent.filter(({ kind }) => kind === "duplicate").length, 11);

      const outOfOrder = await createCheckout();
      const earlyRefundArrival = event(outOfOrder, {
        eventId: "evt_refund_first",
        eventType: "payment_refunded",
        occurredAt: "2026-07-30T12:02:00.000Z",
        paymentIntentId: "pi_out_of_order",
        receivedAt: "2026-07-30T12:02:01.000Z",
      });
      assert.deepEqual(
        await events.processStripeSandboxEvent(earlyRefundArrival, reduceCommercialPaymentTimeline),
        {
          disposition: "ignored_out_of_order",
          kind: "processed",
          orderStatus: "checkout_created",
          outboxCreated: false,
          paymentAttemptState: "checkout_created",
        },
      );
      const lateSuccessArrival = event(outOfOrder, {
        eventId: "evt_success_second",
        eventType: "payment_succeeded",
        occurredAt: "2026-07-30T12:01:00.000Z",
        paymentIntentId: "pi_out_of_order",
        receivedAt: "2026-07-30T12:03:00.000Z",
      });
      assert.deepEqual(
        await events.processStripeSandboxEvent(lateSuccessArrival, reduceCommercialPaymentTimeline),
        {
          disposition: "applied",
          kind: "processed",
          orderStatus: "refunded",
          outboxCreated: true,
          paymentAttemptState: "succeeded",
        },
      );

      const mismatchOrder = await createCheckout();
      assert.equal(
        (
          await events.processStripeSandboxEvent(
            event(mismatchOrder, {
              amountMinor: 500,
              eventId: "evt_amount_mismatch",
              eventType: "payment_succeeded",
              occurredAt: "2026-07-30T12:01:00.000Z",
              paymentIntentId: "pi_mismatch",
              receivedAt: "2026-07-30T12:01:01.000Z",
            }),
            reduceCommercialPaymentTimeline,
          )
        ).disposition,
        "rejected_mismatch",
      );
      assert.equal(
        (
          await events.processStripeSandboxEvent(
            {
              ...event(mismatchOrder, {
                eventId: "evt_account_mismatch",
                eventType: "payment_succeeded",
                occurredAt: "2026-07-30T12:01:02.000Z",
                paymentIntentId: "pi_account_mismatch",
                receivedAt: "2026-07-30T12:01:03.000Z",
              }),
              providerAccountFingerprint: "acct_87654321",
            },
            reduceCommercialPaymentTimeline,
          )
        ).disposition,
        "rejected_mismatch",
      );

      const outboxClaimToken = digest("outbox-claim-one");
      const claim = await events.claimPaymentStateOutbox({
        claimedAt: "2026-07-30T12:10:00.000Z",
        leaseTokenHash: outboxClaimToken,
        leasedUntil: "2026-07-30T12:11:00.000Z",
      });
      assert.notEqual(claim, null);
      assert.equal(claim?.topic, "commercial.payment_state_changed");
      assert.equal(claim?.paymentStateVersion, 1);
      assert.equal(
        await events.completePaymentStateOutbox({
          completedAt: "2026-07-30T12:10:30.000Z",
          leaseTokenHash: digest("wrong-token"),
          outboxId: claim!.outboxId,
        }),
        false,
      );
      assert.equal(
        await events.completePaymentStateOutbox({
          completedAt: "2026-07-30T12:10:30.000Z",
          leaseTokenHash: outboxClaimToken,
          outboxId: claim!.outboxId,
        }),
        true,
      );

      const retryToken = digest("outbox-claim-retry");
      const retryClaim = await events.claimPaymentStateOutbox({
        claimedAt: "2026-07-30T12:10:31.000Z",
        leaseTokenHash: retryToken,
        leasedUntil: "2026-07-30T12:11:31.000Z",
      });
      assert.notEqual(retryClaim, null);
      assert.equal(
        await events.failPaymentStateOutbox({
          failedAt: "2026-07-30T12:10:40.000Z",
          failureCode: "synthetic.retry",
          leaseTokenHash: retryToken,
          outboxId: retryClaim!.outboxId,
          retryAt: "2026-07-30T12:12:00.000Z",
        }),
        "retry_wait",
      );
      await migrator.query(
        `
          UPDATE commercial_payment_outbox_v2
             SET delivery_state = 'completed',
                 completed_at = '2026-07-30T12:11:59.000Z',
                 lease_token_hash = NULL,
                 leased_until = NULL
           WHERE id <> $1::uuid
             AND delivery_state = 'pending'
        `,
        [retryClaim!.outboxId],
      );
      await migrator.query(
        `
          UPDATE commercial_payment_outbox_v2
             SET attempt_count = 19,
                 available_at = '2026-07-30T12:12:00.000Z'
           WHERE id = $1::uuid
        `,
        [retryClaim!.outboxId],
      );
      const finalLeaseToken = digest("outbox-final-lease");
      const finalClaim = await events.claimPaymentStateOutbox({
        claimedAt: "2026-07-30T12:12:00.000Z",
        leaseTokenHash: finalLeaseToken,
        leasedUntil: "2026-07-30T12:13:00.000Z",
      });
      assert.equal(finalClaim?.outboxId, retryClaim!.outboxId);
      assert.equal(finalClaim?.attemptCount, 20);
      assert.equal(
        await events.claimPaymentStateOutbox({
          claimedAt: "2026-07-30T12:13:01.000Z",
          leaseTokenHash: digest("outbox-after-final-lease"),
          leasedUntil: "2026-07-30T12:14:01.000Z",
        }),
        null,
      );
      const finalLeaseState = (
        await migrator.query<{ deliveryState: string; lastFailureCode: string }>(
          `
              SELECT delivery_state AS "deliveryState",
                     last_failure_code AS "lastFailureCode"
                FROM commercial_payment_outbox_v2
               WHERE id = $1::uuid
            `,
          [retryClaim!.outboxId],
        )
      ).rows[0];
      assert.deepEqual(finalLeaseState, {
        deliveryState: "dead_lettered",
        lastFailureCode: "max_attempts",
      });

      const counts = await migrator.query<{
        accountBoundAttempts: number;
        credits: number;
        entitlements: number;
        events: number;
        outboxes: number;
        paidOrRefundedOrders: number;
        rejectedEvents: number;
        signatureEvidence: number;
      }>(
        `
          SELECT
            (SELECT count(*)::int FROM commercial_payment_event_v2) AS events,
            (SELECT count(*)::int FROM commercial_payment_event_v2
              WHERE signature_timestamp_seconds > 0
                AND verifier_version = 'stripe-signature.v1') AS "signatureEvidence",
            (SELECT count(*)::int FROM commercial_payment_event_v2
              WHERE processing_disposition = 'rejected_mismatch') AS "rejectedEvents",
            (SELECT count(*)::int FROM commercial_payment_outbox_v2) AS outboxes,
            (SELECT count(*)::int FROM commercial_payment_attempt_v2
              WHERE provider_account_fingerprint = 'acct_12345678') AS "accountBoundAttempts",
            (SELECT count(*)::int FROM commercial_order_v2
              WHERE status IN ('paid', 'refunded')) AS "paidOrRefundedOrders",
            (SELECT count(*)::int FROM credit_ledger_entry WHERE user_id = $1::uuid) AS credits,
            (SELECT count(*)::int FROM commercial_entitlement_v2 WHERE user_id = $1::uuid)
              AS entitlements
        `,
        [userId],
      );
      assert.deepEqual(counts.rows[0], {
        accountBoundAttempts: 4,
        credits: 0,
        entitlements: 0,
        events: 6,
        outboxes: 3,
        paidOrRefundedOrders: 2,
        rejectedEvents: 2,
        signatureEvidence: 6,
      });
      await expectPostgresError(
        () =>
          migrator.query(
            `
              INSERT INTO commercial_payment_outbox_v2 (
                payment_event_id, order_id, payment_attempt_id, topic, schema_version,
                order_status, payment_attempt_state, payment_state_version, available_at
              )
              SELECT events.id, orders.id, attempts.id,
                     'commercial.payment_state_changed',
                     'commercial-payment-state-outbox.v1',
                     'checkout_created', 'checkout_created', 1, CURRENT_TIMESTAMP
                FROM commercial_payment_event_v2 AS events
                JOIN commercial_order_v2 AS orders ON orders.public_id = $1::uuid
                JOIN commercial_payment_attempt_v2 AS attempts
                  ON attempts.order_id = orders.id
               WHERE events.provider_event_id = 'evt_refund_first'
            `,
            [mismatchOrder.orderId],
          ),
        ["23503"],
      );

      const paymentWebhookSql = createLocalPostgresClient(database.paymentWebhookDatabaseUrl);
      await paymentWebhookSql.connect();
      try {
        await expectPostgresError(
          () =>
            paymentWebhookSql.query(
              `
                UPDATE commercial_payment_event_v2
                   SET order_id = (
                     SELECT id FROM commercial_order_v2 WHERE public_id = $1::uuid
                   )
                 WHERE provider_event_id = 'evt_pending'
              `,
              [mismatchOrder.orderId],
            ),
          ["23503"],
        );
        await expectPostgresError(
          () =>
            paymentWebhookSql.query(
              `
                UPDATE commercial_payment_event_v2
                   SET payment_attempt_id = (
                     SELECT attempts.id
                       FROM commercial_payment_attempt_v2 AS attempts
                       JOIN commercial_order_v2 AS orders ON orders.id = attempts.order_id
                      WHERE orders.public_id = $1::uuid
                   )
                 WHERE provider_event_id = 'evt_pending'
              `,
              [mismatchOrder.orderId],
            ),
          ["23503"],
        );
        await expectPostgresError(
          () => paymentWebhookSql.query("SELECT count(*) FROM credit_ledger_entry"),
          ["42501"],
        );
        await expectPostgresError(
          () => paymentWebhookSql.query("SELECT count(*) FROM commercial_entitlement_v2"),
          ["42501"],
        );
      } finally {
        await paymentWebhookSql.end();
      }

      const applicationSql = createLocalPostgresClient(database.databaseUrl);
      await applicationSql.connect();
      try {
        await expectPostgresError(
          () =>
            applicationSql.query(
              "UPDATE commercial_payment_event_v2 SET amount_minor = amount_minor + 1",
            ),
          ["42501"],
        );
        await expectPostgresError(
          () => applicationSql.query("DELETE FROM commercial_payment_event_v2"),
          ["42501"],
        );
        await expectPostgresError(
          () =>
            applicationSql.query("UPDATE commercial_payment_outbox_v2 SET order_status = 'paid'"),
          ["42501"],
        );
      } finally {
        await applicationSql.end();
      }
    } finally {
      await application.$disconnect();
      await paymentWebhook.$disconnect();
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
  "Verified Stripe sandbox signed-event idempotency, deterministic out-of-order replay, mismatch isolation, transactional outbox, least privilege, and zero fulfillment.",
);
