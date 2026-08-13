import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import {
  planCommercialCreditPackFulfillment,
  reduceCommercialPaymentTimeline,
} from "../packages/payments/src/index.js";
import {
  createCommercialCheckoutPersistence,
  createCommercialDisputeSupportPersistence,
  createCommercialFulfillmentPersistence,
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
    await migrator.connect();
    try {
      const checkout = createCommercialCheckoutPersistence(application);
      const events = createCommercialPaymentEventPersistence(paymentWebhook);
      const fulfillment = createCommercialFulfillmentPersistence(fulfillmentDatabase);
      const disputeSupport = createCommercialDisputeSupportPersistence(fulfillmentDatabase);
      let sequence = 0;
      let clock = Date.parse("2026-07-30T13:00:00.000Z");

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
      const createOrder = async (userId: string) => {
        sequence += 1;
        const createdAt = nextInstant();
        const created = await checkout.createOrReplayStripeCheckout({
          amountMinor: 599,
          canonicalRequestHash: digest(`fulfillment-checkout-${sequence}`),
          catalogVersion: "local.catalog.2026-07-23.v1",
          countryCode: "US",
          countryPolicyVersion: "local.us.stripe-sandbox.v1",
          createdAt,
          creditsGranted: 6,
          currencyCode: "USD",
          exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
          fulfillmentCode: "credits.pack_6",
          idempotencyKeyHash: digest(`fulfillment-idempotency-${sequence}`),
          priceId: "price.pack_6.usd.2026-07-23",
          priceVersion: "2026-07-23",
          productCode: "pack_6",
          productVersion: "2026-07-23",
          providerAccountFingerprint: "acct_12345678",
          provisionalExpiresAt: new Date(Date.parse(createdAt) + 86_400_000).toISOString(),
          refundPolicyVersion: "test:local:refund.v1",
          termsVersion: "local.terms.v1",
          userId,
        });
        const checkoutId = `cs_test_fulfillment_${sequence}`;
        await checkout.attachStripeCheckout({
          attachedAt: nextInstant(),
          checkoutExpiresAt: new Date(clock + 1_800_000).toISOString(),
          checkoutId,
          checkoutUrl: `https://checkout.stripe.com/c/pay/${checkoutId}`,
          orderId: created.checkout.orderId,
          userId,
        });
        return Object.freeze({ checkoutId, orderId: created.checkout.orderId });
      };
      const paymentEvent = (
        order: Readonly<{ checkoutId: string; orderId: string }>,
        eventType: PreparedCommercialPaymentEvent["eventType"],
      ): PreparedCommercialPaymentEvent => {
        const occurredAt = nextInstant();
        const eventId = `evt_fulfillment_${sequence}_${eventType}_${clock}`;
        return Object.freeze({
          amountMinor: 599,
          currencyCode: "USD",
          evidenceSource: "signed_webhook",
          eventType,
          normalizationVersion: "stripe-commercial-event.v1",
          occurredAt,
          orderId: order.orderId,
          payloadDigest: digest(eventId),
          providerAccountFingerprint: "acct_12345678",
          providerCheckoutId: order.checkoutId,
          providerEventId: eventId,
          providerObjectId: `pi_${order.checkoutId}`,
          providerPaymentIntentId: `pi_${order.checkoutId}`,
          receivedAt: nextInstant(),
          signatureTimestampSeconds: Math.floor(clock / 1_000),
          verifierVersion: "stripe-signature.v1",
        });
      };
      const process = async (
        order: Readonly<{ checkoutId: string; orderId: string }>,
        eventType: PreparedCommercialPaymentEvent["eventType"],
      ) => {
        const prepared = paymentEvent(order, eventType);
        const result = await events.processStripeSandboxEvent(
          prepared,
          reduceCommercialPaymentTimeline,
        );
        assert.equal(result.kind, "processed");
        return prepared;
      };
      const fulfillNext = async () => {
        const claimedAt = nextInstant();
        const leaseTokenHash = digest(`fulfillment-lease-${clock}`);
        const claim = await fulfillment.claimNextPaymentState({
          claimedAt,
          leaseTokenHash,
          leasedUntil: new Date(Date.parse(claimedAt) + 60_000).toISOString(),
        });
        assert.notEqual(claim, null);
        const result = await fulfillment.fulfillPaymentState(
          {
            completedAt: nextInstant(),
            leaseTokenHash,
            outboxId: claim!.outboxId,
          },
          planCommercialCreditPackFulfillment,
        );
        assert.notEqual(result, null);
        return result!;
      };
      const allocatePurchasedCredits = async (input: {
        amount: number;
        grantId: string;
        status: "active" | "consumed";
        userId: string;
      }): Promise<void> => {
        sequence += 1;
        const reservationId = randomUUID();
        const createdAt = nextInstant();
        const consumedAt = input.status === "consumed" ? nextInstant() : null;
        await migrator.query(
          `
            INSERT INTO credit_reservation (
              id, user_id, catalog_version, product_code, product_version, amount, status,
              idempotency_key_version, idempotency_key_hash, canonical_request_hash,
              expires_at, created_at, consumed_at
            ) VALUES (
              $1::uuid, $2::uuid, 'local.catalog.2026-07-23.v1', 'pack_6', '2026-07-23',
              $3, $4, 'commercial.fulfillment.test.v1', $5, $6,
              $7::timestamptz, $8::timestamptz, $9::timestamptz
            )
          `,
          [
            reservationId,
            input.userId,
            input.amount,
            input.status,
            Buffer.from(digest(`reservation-idempotency-${sequence}`)),
            Buffer.from(digest(`reservation-canonical-${sequence}`)),
            new Date(clock + 86_400_000).toISOString(),
            createdAt,
            consumedAt,
          ],
        );
        await migrator.query(
          `
            INSERT INTO credit_allocation (
              reservation_id, source_entry_id, user_id, credit_type, amount, allocation_order,
              created_at
            ) VALUES (
              $1::uuid, $2::uuid, $3::uuid, 'purchased_credit', $4, 1, $5::timestamptz
            )
          `,
          [reservationId, input.grantId, input.userId, input.amount, createdAt],
        );
        await migrator.query(
          `
            UPDATE credit_projection
            SET purchased_available = purchased_available - $2,
                reserved = reserved + $3,
                version = version + 1,
                updated_at = $4::timestamptz
            WHERE user_id = $1::uuid AND purchased_available >= $2
          `,
          [
            input.userId,
            input.amount,
            input.status === "active" ? input.amount : 0,
            consumedAt ?? createdAt,
          ],
        );
      };
      const assertFulfillmentPrivilegeDriftDenied = async (
        grantSql: string,
        revokeSql: string,
      ): Promise<void> => {
        await migrator.query(grantSql);
        const driftDatabase = createDatabaseClient(database.paymentFulfillmentDatabaseUrl);
        try {
          await assert.rejects(
            createCommercialFulfillmentPersistence(driftDatabase).claimNextPaymentState({
              claimedAt: nextInstant(),
              leaseTokenHash: digest(`privilege-drift-${clock}`),
              leasedUntil: new Date(clock + 60_000).toISOString(),
            }),
            (error: unknown) =>
              (error as { code?: unknown }).code === "COMMERCIAL_FULFILLMENT_UNAVAILABLE",
          );
        } finally {
          await driftDatabase.$disconnect();
          await migrator.query(revokeSql);
        }
      };

      const userId = await createUser();
      const otherUserId = await createUser();
      const order = await createOrder(userId);
      await process(order, "payment_pending");
      const pendingResult = await fulfillNext();
      assert.equal(pendingResult.disposition, "unchanged");
      assert.equal((await fulfillment.restorePurchases(userId)).credits.total, 0);
      const pendingStatus = await fulfillment.readPurchaseStatus(userId, order.orderId);
      assert.notEqual(pendingStatus, null);
      assert.match(pendingStatus!.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
      assert.deepEqual(
        {
          ...pendingStatus,
          updatedAt: undefined,
        },
        {
          amountMinor: 599,
          currencyCode: "USD",
          exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
          fulfilled: false,
          orderId: order.orderId,
          productCode: "pack_6",
          refundPolicyVersion: "test:local:refund.v1",
          state: "pending",
          updatedAt: undefined,
        },
      );
      assert.equal(await fulfillment.readPurchaseStatus(otherUserId, order.orderId), null);
      const paid = await process(order, "payment_succeeded");
      const duplicate = await events.processStripeSandboxEvent(
        paid,
        reduceCommercialPaymentTimeline,
      );
      assert.equal(duplicate.kind, "duplicate");

      const claimedAt = nextInstant();
      const concurrentClaims = await Promise.all(
        Array.from({ length: 12 }, async (_, index) => {
          const leaseTokenHash = digest(`concurrent-lease-${index}`);
          const claim = await fulfillment.claimNextPaymentState({
            claimedAt,
            leaseTokenHash,
            leasedUntil: new Date(Date.parse(claimedAt) + 60_000).toISOString(),
          });
          return { claim, leaseTokenHash };
        }),
      );
      const winner = concurrentClaims.find(({ claim }) => claim !== null);
      assert.equal(concurrentClaims.filter(({ claim }) => claim !== null).length, 1);
      assert.notEqual(winner, undefined);
      const paidResult = await fulfillment.fulfillPaymentState(
        {
          completedAt: nextInstant(),
          leaseTokenHash: winner!.leaseTokenHash,
          outboxId: winner!.claim!.outboxId,
        },
        planCommercialCreditPackFulfillment,
      );
      assert.deepEqual(paidResult, {
        creditsGranted: 6,
        creditsHeld: 0,
        creditsReversed: 0,
        disposition: "granted",
        fulfillmentCode: "credits.pack_6",
        orderId: winner!.claim!.orderId,
        shortfallAmount: 0,
        userId,
      });
      assert.equal((await fulfillment.restorePurchases(userId)).credits.purchased, 6);
      assert.equal((await fulfillment.restorePurchases(otherUserId)).credits.total, 0);
      assert.equal((await fulfillment.readPurchaseStatus(userId, order.orderId))?.fulfilled, true);

      const convergedUserId = await createUser();
      const convergedOrder = await createOrder(convergedUserId);
      await process(convergedOrder, "payment_succeeded");
      const convergedClaimedAt = nextInstant();
      const convergedLeaseToken = digest("converged-lease-token");
      const convergedClaim = await fulfillment.claimNextPaymentState({
        claimedAt: convergedClaimedAt,
        leaseTokenHash: convergedLeaseToken,
        leasedUntil: new Date(Date.parse(convergedClaimedAt) + 60_000).toISOString(),
      });
      assert.notEqual(convergedClaim, null);
      await process(convergedOrder, "payment_disputed");
      const converged = await fulfillment.fulfillPaymentState(
        {
          completedAt: nextInstant(),
          leaseTokenHash: convergedLeaseToken,
          outboxId: convergedClaim!.outboxId,
        },
        planCommercialCreditPackFulfillment,
      );
      assert.equal(converged?.disposition, "granted_and_held");
      assert.equal(converged?.creditsHeld, 6);
      assert.equal((await fulfillNext()).disposition, "unchanged");

      await process(order, "payment_disputed");
      const disputed = await fulfillNext();
      assert.equal(disputed.disposition, "held");
      assert.equal(disputed.creditsHeld, 6);
      assert.deepEqual(
        await fulfillment
          .readPurchaseStatus(userId, order.orderId)
          .then((status) =>
            status === null ? null : { fulfilled: status.fulfilled, state: status.state },
          ),
        { fulfilled: false, state: "disputed" },
      );
      assert.deepEqual((await fulfillment.restorePurchases(userId)).credits, {
        promotional: 0,
        purchased: 0,
        purchasedHeld: 6,
        reserved: 0,
        subscription: 0,
        total: 0,
        version: 2,
      });

      await process(order, "payment_refunded");
      const refunded = await fulfillNext();
      assert.equal(refunded.disposition, "adjusted");
      assert.equal(refunded.creditsReversed, 6);
      const restoredAfterRefund = await fulfillment.restorePurchases(userId);
      assert.equal(restoredAfterRefund.credits.purchased, 0);
      assert.equal(restoredAfterRefund.credits.purchasedHeld, 0);

      const shortfallUserId = await createUser();
      const shortfallOrder = await createOrder(shortfallUserId);
      await process(shortfallOrder, "payment_succeeded");
      const retryClaimedAt = nextInstant();
      const retryLeaseToken = digest("retry-lease-token");
      const retryClaim = await fulfillment.claimNextPaymentState({
        claimedAt: retryClaimedAt,
        leaseTokenHash: retryLeaseToken,
        leasedUntil: new Date(Date.parse(retryClaimedAt) + 60_000).toISOString(),
      });
      assert.notEqual(retryClaim, null);
      assert.equal(
        await fulfillment.fulfillPaymentState(
          {
            completedAt: nextInstant(),
            leaseTokenHash: digest("wrong-retry-token"),
            outboxId: retryClaim!.outboxId,
          },
          planCommercialCreditPackFulfillment,
        ),
        null,
      );
      const retryAt = new Date(clock + 10_000).toISOString();
      assert.equal(
        await fulfillment.failPaymentState({
          failedAt: nextInstant(),
          failureCode: "synthetic.retry",
          leaseTokenHash: retryLeaseToken,
          outboxId: retryClaim!.outboxId,
          retryAt,
        }),
        "retry_wait",
      );
      assert.equal(
        await fulfillment.claimNextPaymentState({
          claimedAt: nextInstant(),
          leaseTokenHash: digest("premature-retry-token"),
          leasedUntil: new Date(clock + 60_000).toISOString(),
        }),
        null,
      );
      clock = Date.parse(retryAt);
      await fulfillNext();
      const grant = (
        await migrator.query<{ id: string }>(
          `
            SELECT id FROM credit_ledger_entry
            WHERE order_id = (
              SELECT id FROM commercial_order_v2 WHERE public_id = $1::uuid
            ) AND direction = 'grant'
          `,
          [shortfallOrder.orderId],
        )
      ).rows[0];
      assert.notEqual(grant, undefined);
      const crossAccountReservationId = randomUUID();
      await migrator.query(
        `
          INSERT INTO credit_reservation (
            id, user_id, catalog_version, product_code, product_version, amount, status,
            idempotency_key_version, idempotency_key_hash, canonical_request_hash,
            expires_at, created_at
          ) VALUES (
            $1::uuid, $2::uuid, 'local.catalog.2026-07-23.v1', 'pack_6', '2026-07-23',
            1, 'active', 'commercial.fulfillment.test.v1', $3, $4,
            $5::timestamptz, $6::timestamptz
          )
        `,
        [
          crossAccountReservationId,
          otherUserId,
          Buffer.from(digest("cross-account-reservation-idempotency")),
          Buffer.from(digest("cross-account-reservation-canonical")),
          new Date(clock + 86_400_000).toISOString(),
          nextInstant(),
        ],
      );
      await assert.rejects(
        migrator.query(
          `
            INSERT INTO credit_allocation (
              reservation_id, source_entry_id, user_id, credit_type, amount, allocation_order
            ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'purchased_credit', 1, 1)
          `,
          [crossAccountReservationId, grant!.id, otherUserId],
        ),
        (error: unknown) => (error as { code?: unknown }).code === "23503",
      );
      await allocatePurchasedCredits({
        amount: 2,
        grantId: grant!.id,
        status: "consumed",
        userId: shortfallUserId,
      });
      await process(shortfallOrder, "payment_disputed");
      const shortfall = await fulfillNext();
      assert.equal(shortfall.disposition, "review_required");
      assert.equal(shortfall.creditsHeld, 4);
      assert.equal(shortfall.shortfallAmount, 2);
      const shortfallProjection = await fulfillment.restorePurchases(shortfallUserId);
      assert.equal(shortfallProjection.credits.purchased, 0);
      assert.equal(shortfallProjection.credits.purchasedHeld, 4);

      const reservedUserId = await createUser();
      const reservedOrder = await createOrder(reservedUserId);
      await process(reservedOrder, "payment_succeeded");
      await fulfillNext();
      const reservedGrant = (
        await migrator.query<{ id: string }>(
          `
            SELECT id FROM credit_ledger_entry
            WHERE order_id = (
              SELECT id FROM commercial_order_v2 WHERE public_id = $1::uuid
            ) AND direction = 'grant'
          `,
          [reservedOrder.orderId],
        )
      ).rows[0];
      assert.notEqual(reservedGrant, undefined);
      await allocatePurchasedCredits({
        amount: 2,
        grantId: reservedGrant!.id,
        status: "active",
        userId: reservedUserId,
      });
      await process(reservedOrder, "payment_disputed");
      const reservedShortfall = await fulfillNext();
      assert.equal(reservedShortfall.disposition, "review_required");
      assert.equal(reservedShortfall.creditsHeld, 4);
      assert.equal(reservedShortfall.shortfallAmount, 2);

      assert.equal(
        (
          await migrator.query(
            "SELECT count(*)::int AS count FROM commercial_dispute_support_projection_v1",
          )
        ).rows[0]?.count,
        0,
      );
      assert.equal(await disputeSupport.projectNextDisputeSupportCase(), "projected");
      assert.equal(await disputeSupport.projectNextDisputeSupportCase(), "projected");
      assert.equal(await disputeSupport.projectNextDisputeSupportCase(), "projected");
      assert.equal(await disputeSupport.projectNextDisputeSupportCase(), null);
      const projectionVerifier = createLocalPostgresClient(database.adminDatabaseUrl);
      await projectionVerifier.connect();
      try {
        assert.deepEqual(
          (
            await projectionVerifier.query(
              `SELECT queue_kind, category_code, priority, draft_template_code,
                      first_response_due_at = opened_at + INTERVAL '4 hours' AS first_due,
                      resolution_due_at = opened_at + INTERVAL '24 hours' AS resolution_due
                 FROM commercial_dispute_support_projection_v1
                ORDER BY opened_at, id`,
            )
          ).rows,
          Array.from({ length: 3 }, () => ({
            category_code: "payment_dispute",
            draft_template_code: "support_dispute_ack",
            first_due: true,
            priority: "high",
            queue_kind: "support",
            resolution_due: true,
          })),
        );
      } finally {
        await projectionVerifier.end();
      }

      const counts = (
        await migrator.query<{
          fulfillments: number;
          grants: number;
          restrictions: number;
          reversals: number;
        }>(
          `
            SELECT
              (SELECT count(*)::int FROM commercial_fulfillment_v2) AS fulfillments,
              (SELECT count(*)::int FROM credit_ledger_entry
                WHERE direction = 'grant' AND operation = 'credit.grant.purchase') AS grants,
              (SELECT count(*)::int FROM credit_restriction_entry) AS restrictions,
              (SELECT count(*)::int FROM credit_ledger_entry
                WHERE direction = 'reverse' AND reason = 'payment_refund') AS reversals
          `,
        )
      ).rows[0];
      assert.deepEqual(counts, {
        fulfillments: 4,
        grants: 4,
        restrictions: 5,
        reversals: 1,
      });

      const deadLetterOrder = await createOrder(await createUser());
      await process(deadLetterOrder, "payment_succeeded");
      await migrator.query(
        `
          UPDATE commercial_payment_outbox_v2
          SET attempt_count = 19
          WHERE order_id = (
            SELECT id FROM commercial_order_v2 WHERE public_id = $1::uuid
          )
        `,
        [deadLetterOrder.orderId],
      );
      const deadLetterClaimedAt = nextInstant();
      const deadLetterToken = digest("dead-letter-token");
      const deadLetterClaim = await fulfillment.claimNextPaymentState({
        claimedAt: deadLetterClaimedAt,
        leaseTokenHash: deadLetterToken,
        leasedUntil: new Date(Date.parse(deadLetterClaimedAt) + 60_000).toISOString(),
      });
      assert.equal(deadLetterClaim?.attempt, 20);
      assert.equal(
        await fulfillment.failPaymentState({
          failedAt: nextInstant(),
          failureCode: "synthetic.terminal",
          leaseTokenHash: deadLetterToken,
          outboxId: deadLetterClaim!.outboxId,
          retryAt: null,
        }),
        "dead_lettered",
      );

      await assertFulfillmentPrivilegeDriftDenied(
        "GRANT UPDATE (amount) ON TABLE credit_ledger_entry TO rituvia_payment_fulfillment",
        "REVOKE UPDATE (amount) ON TABLE credit_ledger_entry FROM rituvia_payment_fulfillment",
      );
      await assertFulfillmentPrivilegeDriftDenied(
        "GRANT SELECT ON TABLE commercial_payment_event_v2 TO rituvia_payment_fulfillment",
        "REVOKE SELECT ON TABLE commercial_payment_event_v2 FROM rituvia_payment_fulfillment",
      );

      const webhookSql = createLocalPostgresClient(database.paymentWebhookDatabaseUrl);
      const fulfillmentSql = createLocalPostgresClient(database.paymentFulfillmentDatabaseUrl);
      await webhookSql.connect();
      await fulfillmentSql.connect();
      try {
        await expectPostgresError(() =>
          webhookSql.query("UPDATE commercial_payment_outbox_v2 SET delivery_state = 'completed'"),
        );
        await expectPostgresError(() =>
          webhookSql.query("SELECT count(*) FROM credit_ledger_entry"),
        );
        await expectPostgresError(() =>
          fulfillmentSql.query("SELECT provider_object_id FROM commercial_payment_event_v2"),
        );
        await expectPostgresError(() =>
          fulfillmentSql.query(
            "SELECT category_code FROM commercial_dispute_support_projection_v1",
          ),
        );
        await expectPostgresError(() =>
          fulfillmentSql.query("SELECT count(*) FROM private_journal_entry"),
        );
      } finally {
        await webhookSql.end();
        await fulfillmentSql.end();
      }

      await migrator.query(
        `REVOKE SELECT (
           id, event_type, evidence_source, validation_state, processing_state,
           processing_disposition, order_id, payment_attempt_id
         ) ON TABLE commercial_payment_event_v2 FROM rituvia_payment_fulfillment`,
      );
      await migrator.query(
        `REVOKE SELECT (commercial_payment_event_id)
           ON TABLE commercial_dispute_support_projection_v1
           FROM rituvia_payment_fulfillment`,
      );
      await migrator.query(
        `REVOKE INSERT (
           commercial_payment_event_id, queue_kind, category_code, priority, policy_version,
           draft_template_code, draft_template_version, draft_locale, opened_at,
           first_response_due_at, resolution_due_at
         ) ON TABLE commercial_dispute_support_projection_v1
           FROM rituvia_payment_fulfillment`,
      );
      const fulfillmentWithoutSupport = createDatabaseClient(
        database.paymentFulfillmentDatabaseUrl,
      );
      try {
        assert.equal(
          (
            await createCommercialFulfillmentPersistence(
              fulfillmentWithoutSupport,
            ).restorePurchases(userId)
          ).credits.total,
          0,
        );
        await assert.rejects(
          createCommercialDisputeSupportPersistence(
            fulfillmentWithoutSupport,
          ).projectNextDisputeSupportCase(),
          (error: unknown) =>
            (error as { name?: unknown }).name === "CommercialDisputeSupportPersistenceError",
        );
      } finally {
        await fulfillmentWithoutSupport.$disconnect();
      }
    } finally {
      await application.$disconnect();
      await paymentWebhook.$disconnect();
      await fulfillmentDatabase.$disconnect();
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
  "Verified exactly-once Credit grants, owner-scoped purchase status, dispute holds, asynchronous current-dispute support projection and failure isolation, refund conversion, shortfall review, private restoration, and fulfillment least privilege.",
);
