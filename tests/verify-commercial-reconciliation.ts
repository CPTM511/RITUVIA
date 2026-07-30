import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import {
  planCommercialCreditPackFulfillment,
  reduceCommercialPaymentTimeline,
} from "../packages/payments/src/index.js";
import { createCommercialCheckoutPersistence } from "../packages/db/src/commercial-checkout-persistence.js";
import { createDatabaseClient } from "../packages/db/src/client.js";
import { createCommercialFulfillmentPersistence } from "../packages/db/src/commercial-fulfillment-persistence.js";
import { createCommercialPaymentEventPersistence } from "../packages/db/src/commercial-payment-event-persistence.js";
import { createCommercialReconciliationPersistence } from "../packages/db/src/commercial-reconciliation-persistence.js";
import {
  createLocalPostgresClient,
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "../packages/db/scripts/local-postgres.mjs";

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

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
    const fulfillmentDatabase = createDatabaseClient(database.paymentFulfillmentDatabaseUrl);
    const reconciliationDatabase = createDatabaseClient(database.paymentReconciliationDatabaseUrl);
    const paymentEventDatabase = createDatabaseClient(database.paymentWebhookDatabaseUrl);
    const migrator = createLocalPostgresClient(database.migrationDatabaseUrl);
    const reconciliationSql = createLocalPostgresClient(database.paymentReconciliationDatabaseUrl);
    await Promise.all([migrator.connect(), reconciliationSql.connect()]);
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
      const created = await checkout.createOrReplayStripeCheckout({
        amountMinor: 599,
        canonicalRequestHash: digest("reconciliation-checkout"),
        catalogVersion: "local.catalog.2026-07-23.v1",
        countryCode: "US",
        countryPolicyVersion: "local.us.stripe-sandbox.v1",
        createdAt: "2026-07-30T12:00:00.000Z",
        creditsGranted: 6,
        currencyCode: "USD",
        exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
        fulfillmentCode: "credits.pack_6",
        idempotencyKeyHash: digest("reconciliation-idempotency"),
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
      await checkout.attachStripeCheckout({
        attachedAt: "2026-07-30T12:00:01.000Z",
        checkoutExpiresAt: "2026-07-30T12:30:00.000Z",
        checkoutId: "cs_test_reconciliation",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_reconciliation",
        orderId: created.checkout.orderId,
        userId,
      });

      const persistence = createCommercialReconciliationPersistence(reconciliationDatabase);
      const batch = await persistence.listCandidates({
        providerAccountFingerprint: "acct_12345678",
        slotStartedAt: "2026-07-30T00:00:00.000Z",
      });
      assert.equal(batch.truncated, false);
      assert.equal(batch.candidates.length, 1);
      const candidate = batch.candidates[0];
      assert.notEqual(candidate, undefined);
      assert.equal(candidate?.orderStatus, "checkout_created");
      assert.equal(candidate?.creditGrantCount, 0);

      const reconciliationCase = Object.freeze({
        caseType: "internal_payment_pending" as const,
        evidenceDigest: digest("reconciliation-evidence"),
        orderId: candidate!.orderId,
        paymentAttemptId: candidate!.paymentAttemptId,
        severity: "critical" as const,
      });
      const recorded = await persistence.recordRun({
        candidates: 1,
        cases: [reconciliationCase],
        completedAt: "2026-07-30T12:05:00.000Z",
        providerAccountFingerprint: "acct_12345678",
        slotStartedAt: "2026-07-30T00:00:00.000Z",
        truncated: false,
      });
      assert.equal(recorded.disposition, "recorded");
      const paymentEvents = createCommercialPaymentEventPersistence(paymentEventDatabase);
      const reconciliationEvent = {
        amountMinor: 599,
        currencyCode: "USD",
        evidenceSource: "reconciliation_api" as const,
        eventType: "payment_succeeded" as const,
        normalizationVersion: "stripe-reconciliation-event.v1",
        occurredAt: "2026-07-30T12:05:01.000Z",
        orderId: candidate!.orderPublicId,
        payloadDigest: digest("reconciliation-provider-paid"),
        providerAccountFingerprint: "acct_12345678",
        providerCheckoutId: candidate!.providerCheckoutId,
        providerEventId: "reconciliation_event_123",
        providerObjectId: "pi_reconciliation_123",
        providerPaymentIntentId: "pi_reconciliation_123",
        receivedAt: "2026-07-30T12:05:01.000Z",
        signatureTimestampSeconds: 1_785_413_101,
        verifierVersion: "stripe-reconciliation-api.v1",
      };
      const raceResults = await Promise.all([
        paymentEvents.processStripeSandboxEvent(
          reconciliationEvent,
          reduceCommercialPaymentTimeline,
        ),
        paymentEvents.processStripeSandboxEvent(
          {
            ...reconciliationEvent,
            evidenceSource: "signed_webhook",
            normalizationVersion: "stripe-commercial-event.v1",
            payloadDigest: digest("signed-webhook-provider-paid"),
            providerEventId: "evt_signed_race_123",
            verifierVersion: "stripe-signature.v1",
          },
          reduceCommercialPaymentTimeline,
        ),
      ]);
      assert.equal(raceResults.filter(({ outboxCreated }) => outboxCreated).length, 1);
      assert(raceResults.every(({ kind }) => kind === "processed"));

      const fulfillment = createCommercialFulfillmentPersistence(fulfillmentDatabase);
      const leaseTokenHash = digest("reconciliation-race-lease");
      const claim = await fulfillment.claimNextPaymentState({
        claimedAt: "2026-07-30T12:05:02.000Z",
        leasedUntil: "2026-07-30T12:06:02.000Z",
        leaseTokenHash,
      });
      assert.notEqual(claim, null);
      const fulfilled = await fulfillment.fulfillPaymentState(
        {
          completedAt: "2026-07-30T12:05:03.000Z",
          leaseTokenHash,
          outboxId: claim!.outboxId,
        },
        planCommercialCreditPackFulfillment,
      );
      assert.equal(fulfilled?.disposition, "granted");
      const raceEvidence = await migrator.query<{
        creditAmount: number;
        creditGrants: number;
        outboxes: number;
      }>(
        `
          SELECT
            (SELECT count(*)::int
               FROM commercial_payment_outbox_v2
              WHERE order_id = $1::uuid) AS outboxes,
            (SELECT count(*)::int
               FROM credit_ledger_entry
              WHERE order_id = $1::uuid
                AND operation = 'credit.grant.purchase') AS "creditGrants",
            (SELECT COALESCE(sum(amount), 0)::int
               FROM credit_ledger_entry
              WHERE order_id = $1::uuid
                AND operation = 'credit.grant.purchase') AS "creditAmount"
        `,
        [candidate!.orderId],
      );
      assert.deepEqual(raceEvidence.rows[0], { creditAmount: 6, creditGrants: 1, outboxes: 1 });
      assert.equal(
        (
          await persistence.recordRun({
            candidates: 1,
            cases: [reconciliationCase],
            completedAt: "2026-07-30T12:06:00.000Z",
            providerAccountFingerprint: "acct_12345678",
            slotStartedAt: "2026-07-30T00:00:00.000Z",
            truncated: false,
          })
        ).disposition,
        "duplicate",
      );

      const changedObservation = await persistence.recordRun({
        candidates: 1,
        cases: [
          {
            ...reconciliationCase,
            caseType: "provider_api_unavailable",
            evidenceDigest: digest("reconciliation-provider-unavailable"),
            severity: "high",
          },
        ],
        completedAt: "2026-07-30T12:07:00.000Z",
        providerAccountFingerprint: "acct_12345678",
        slotStartedAt: "2026-07-30T00:00:00.000Z",
        truncated: false,
      });
      assert.equal(changedObservation.disposition, "recorded");

      const concurrentRuns = await Promise.all(
        Array.from({ length: 12 }, () =>
          persistence.recordRun({
            candidates: 1,
            cases: [reconciliationCase],
            completedAt: "2026-07-31T12:05:00.000Z",
            providerAccountFingerprint: "acct_12345678",
            slotStartedAt: "2026-07-31T00:00:00.000Z",
            truncated: false,
          }),
        ),
      );
      assert.equal(
        concurrentRuns.filter(({ disposition }) => disposition === "recorded").length,
        1,
      );
      assert.equal(
        concurrentRuns.filter(({ disposition }) => disposition === "duplicate").length,
        11,
      );

      const counts = await migrator.query<{
        cases: number;
        reconciliationEvents: number;
        runs: number;
      }>(
        `
          SELECT
            (SELECT count(*)::int FROM commercial_reconciliation_run_v1) AS runs,
            (SELECT count(*)::int FROM commercial_reconciliation_case_v1) AS cases,
            (SELECT count(*)::int
              FROM commercial_payment_event_v2
              WHERE evidence_source = 'reconciliation_api') AS "reconciliationEvents"
        `,
      );
      assert.deepEqual(counts.rows[0], { cases: 3, reconciliationEvents: 1, runs: 3 });

      await assert.rejects(
        persistence.recordRun({
          candidates: 1,
          cases: [{ ...reconciliationCase, orderId: randomUUID() }],
          completedAt: "2026-08-01T12:05:00.000Z",
          providerAccountFingerprint: "acct_12345678",
          slotStartedAt: "2026-08-01T00:00:00.000Z",
          truncated: false,
        }),
      );
      assert.equal(
        (
          await migrator.query<{ runs: number }>(
            "SELECT count(*)::int AS runs FROM commercial_reconciliation_run_v1",
          )
        ).rows[0]?.runs,
        3,
      );

      await assert.rejects(
        reconciliationSql.query("UPDATE commercial_reconciliation_run_v1 SET case_count = 0"),
        (error: unknown) => String((error as { code?: unknown }).code) === "42501",
      );
      await assert.rejects(
        reconciliationSql.query("UPDATE commercial_order_v2 SET status = 'paid'"),
        (error: unknown) => String((error as { code?: unknown }).code) === "42501",
      );

      for (let index = 0; index < 100; index += 1) {
        const createdAt = new Date(Date.parse("2026-08-02T12:00:00.000Z") + index).toISOString();
        const extra = await checkout.createOrReplayStripeCheckout({
          amountMinor: 599,
          canonicalRequestHash: digest(`rotation-checkout-${index}`),
          catalogVersion: "local.catalog.2026-07-23.v1",
          countryCode: "US",
          countryPolicyVersion: "local.us.stripe-sandbox.v1",
          createdAt,
          creditsGranted: 6,
          currencyCode: "USD",
          exactContents: ["6 Credits", "Credits do not represent cash or stored value"],
          fulfillmentCode: "credits.pack_6",
          idempotencyKeyHash: digest(`rotation-idempotency-${index}`),
          priceId: "price.pack_6.usd.2026-07-23",
          priceVersion: "2026-07-23",
          productCode: "pack_6",
          productVersion: "2026-07-23",
          providerAccountFingerprint: "acct_12345678",
          provisionalExpiresAt: "2026-08-03T12:00:00.000Z",
          refundPolicyVersion: "test:local:refund.v1",
          termsVersion: "local.terms.v1",
          userId,
        });
        await checkout.attachStripeCheckout({
          attachedAt: "2026-08-02T12:01:00.000Z",
          checkoutExpiresAt: "2026-08-02T12:30:00.000Z",
          checkoutId: `cs_test_rotation_${index}`,
          checkoutUrl: `https://checkout.stripe.com/c/pay/cs_test_rotation_${index}`,
          orderId: extra.checkout.orderId,
          userId,
        });
      }
      const firstWindow = await persistence.listCandidates({
        providerAccountFingerprint: "acct_12345678",
        slotStartedAt: "2026-08-02T00:00:00.000Z",
      });
      const secondWindow = await persistence.listCandidates({
        providerAccountFingerprint: "acct_12345678",
        slotStartedAt: "2026-08-03T00:00:00.000Z",
      });
      assert.equal(firstWindow.truncated, true);
      assert.equal(secondWindow.truncated, true);
      assert.equal(firstWindow.candidates.length, 100);
      assert.equal(secondWindow.candidates.length, 100);
      assert.equal(
        new Set(
          [...firstWindow.candidates, ...secondWindow.candidates].map(({ orderId }) => orderId),
        ).size,
        101,
      );

      await migrator.query(
        "GRANT UPDATE (case_count) ON TABLE commercial_reconciliation_run_v1 TO rituvia_payment_reconciliation",
      );
      const driftDatabase = createDatabaseClient(database.paymentReconciliationDatabaseUrl);
      try {
        await assert.rejects(
          createCommercialReconciliationPersistence(driftDatabase).listCandidates({
            providerAccountFingerprint: "acct_12345678",
            slotStartedAt: "2026-07-30T00:00:00.000Z",
          }),
          /database role is unavailable/u,
        );
      } finally {
        await driftDatabase.$disconnect();
        await migrator.query(
          "REVOKE UPDATE (case_count) ON TABLE commercial_reconciliation_run_v1 FROM rituvia_payment_reconciliation",
        );
      }
    } finally {
      await Promise.all([
        application.$disconnect(),
        fulfillmentDatabase.$disconnect(),
        paymentEventDatabase.$disconnect(),
        reconciliationDatabase.$disconnect(),
        migrator.end(),
        reconciliationSql.end(),
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
  "Verified bounded commercial reconciliation candidates, atomic append-only cases, daily idempotency, rollback, and least privilege.",
);
