import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import {
  createCommercialCheckoutPersistence,
  createCommercialSubscriptionPersistence,
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

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const fulfillment = createDatabaseClient(database.paymentFulfillmentDatabaseUrl);
    const webhook = createDatabaseClient(database.paymentWebhookDatabaseUrl);
    const migrator = createLocalPostgresClient(database.migrationDatabaseUrl);
    await migrator.connect();
    try {
      let sequence = 0;
      const createUser = async (): Promise<string> => {
        const userId = randomUUID();
        await migrator.query(
          `INSERT INTO app_user (id, status, locale, time_zone, age_attested_at, age_policy_version, email_verified_at, created_at, last_active_at)
           VALUES ($1::uuid, 'active', 'en', 'UTC', CURRENT_TIMESTAMP, 'test.age.v1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userId],
        );
        return userId;
      };
      const createSubscription = async (interval: "month" | "year") => {
        sequence += 1;
        const current = sequence.toString().padStart(8, "0");
        const userId = await createUser();
        const checkout = createCommercialCheckoutPersistence(application);
        const createdAt = "2026-07-31T00:00:00.000Z";
        const productCode = interval === "month" ? "plus_monthly" : "plus_annual";
        const priceId = `price.${productCode}.usd.2026-07-23`;
        const checkoutCreated = await checkout.createOrReplayStripeCheckout({
          amountMinor: interval === "month" ? 999 : 6999,
          canonicalRequestHash: digest(`subscription-checkout-${current}`),
          catalogVersion: "local.catalog.2026-07-23.v1",
          countryCode: "US",
          countryPolicyVersion: "local.us.commerce.v1",
          createdAt,
          creditsGranted: null,
          creditsPerMonth: 8,
          currencyCode: "USD",
          exactContents: ["Plus membership", "8 Credits allocated each month"],
          fulfillmentCode: `subscription.${productCode}`,
          fulfillmentKind: "subscription",
          idempotencyKeyHash: digest(`subscription-idempotency-${current}`),
          priceId,
          priceVersion: "2026-07-23",
          productCode,
          productVersion: "2026-07-23",
          providerAccountFingerprint: "acct_12345678",
          provisionalExpiresAt: "2026-08-01T00:00:00.000Z",
          refundPolicyVersion: "test:local:refund.v1",
          termsVersion: "local.terms.v1",
          userId,
        });
        const checkoutId = `cs_test_subscription_${current}`;
        const persistence = createCommercialSubscriptionPersistence(application);
        const subscription = await persistence.createOrReplaySubscription({
          catalogVersion: "local.catalog.2026-07-23.v1",
          createdAt,
          fulfillmentCode: `subscription.${productCode}`,
          priceId,
          priceVersion: "2026-07-23",
          productCode,
          productVersion: "2026-07-23",
          providerAccountFingerprint: "acct_12345678",
          sourceOrderId: checkoutCreated.checkout.orderId,
          subscriptionInterval: interval,
          userId,
        });
        await checkout.attachStripeCheckout({
          attachedAt: "2026-07-31T00:01:00.000Z",
          checkoutExpiresAt: "2026-08-01T00:00:00.000Z",
          checkoutId,
          checkoutUrl: `https://checkout.stripe.com/c/pay/${checkoutId}`,
          orderId: checkoutCreated.checkout.orderId,
          userId,
        });
        await persistence.attachStripeCheckout({
          attachedAt: "2026-07-31T00:01:00.000Z",
          providerCheckoutId: checkoutId,
          sourceOrderId: checkoutCreated.checkout.orderId,
          userId,
        });
        return {
          amountMinor: interval === "month" ? 999 : 6999,
          checkoutId,
          current,
          orderId: checkoutCreated.checkout.orderId,
          inbox: createCommercialSubscriptionPersistence(webhook),
          persistence: createCommercialSubscriptionPersistence(fulfillment),
          subscriptionId: subscription.subscriptionId,
          subscriptionInterval: interval,
          productCode,
          userId,
        };
      };
      const paidEvent = (entry: Awaited<ReturnType<typeof createSubscription>>) => ({
        amountMinor: entry.amountMinor,
        cancelAtPeriodEnd: false,
        currencyCode: "USD",
        eventType: "subscription_period_paid" as const,
        occurredAt: "2026-07-31T00:02:00.000Z",
        payloadDigest: digest(`subscription-paid-${entry.current}`),
        periodEndsAt:
          entry.current === "00000002" ? "2027-07-31T00:02:00.000Z" : "2026-08-31T00:02:00.000Z",
        periodStartsAt: "2026-07-31T00:02:00.000Z",
        providerAccountFingerprint: "acct_12345678",
        providerEventId: `evt_subscription_paid_${entry.current}`,
        providerInvoiceId: `in_subscription_${entry.current}`,
        providerSubscriptionId: `sub_subscription_${entry.current}`,
        productCode: entry.productCode,
        receivedAt: "2026-07-31T00:03:00.000Z",
        sourceOrderId: entry.orderId,
        subscriptionInterval: entry.subscriptionInterval,
      });

      const monthly = await createSubscription("month");
      await assert.rejects(
        webhook.commercialSubscriptionV1.update({
          data: { state: "active" },
          where: { id: monthly.subscriptionId },
        }),
      );
      const event = paidEvent(monthly);
      await assert.rejects(
        monthly.inbox.ingestStripeSandboxEvent({
          ...event,
          amountMinor: event.amountMinor - 1,
          payloadDigest: digest("subscription-paid-mismatched-amount"),
          providerEventId: "evt_subscription_amount_mismatch_00000001",
        }),
      );
      const events = await Promise.all(
        Array.from({ length: 20 }, () => monthly.inbox.ingestStripeSandboxEvent(event)),
      );
      assert.equal(events.filter((entry) => entry.disposition === "queued").length, 1);
      assert.equal(events.filter((entry) => entry.disposition === "duplicate").length, 19);
      const processedMonthly = await monthly.persistence.processNextSubscriptionEvent();
      assert.equal(processedMonthly?.disposition, "applied");
      assert.equal(
        (
          await monthly.inbox.ingestStripeSandboxEvent({
            ...event,
            receivedAt: "2026-07-31T00:03:30.000Z",
          })
        ).disposition,
        "duplicate",
      );
      const claim = await monthly.persistence.claimNextAllocation({
        claimedAt: "2026-07-31T00:04:00.000Z",
        leaseTokenHash: digest("subscription-lease-monthly"),
        leasedUntil: "2026-07-31T00:05:00.000Z",
      });
      assert.notEqual(claim, null);
      const fulfillmentResults = await Promise.all(
        Array.from({ length: 20 }, () =>
          monthly.persistence.fulfillAllocation({
            completedAt: "2026-07-31T00:04:30.000Z",
            leaseTokenHash: digest("subscription-lease-monthly"),
            outboxId: claim!.outboxId,
          }),
        ),
      );
      assert.equal(
        fulfillmentResults.filter((entry) => entry?.disposition === "granted").length,
        1,
      );
      const monthlyLedger = await migrator.query<{ count: string; subscription_available: number }>(
        `SELECT COUNT(*)::text AS count, projection.subscription_available
         FROM credit_ledger_entry AS ledger JOIN credit_projection AS projection ON projection.user_id = ledger.user_id
         WHERE ledger.user_id = $1::uuid AND ledger.credit_type = 'subscription_credit' AND ledger.direction = 'grant'
         GROUP BY projection.subscription_available`,
        [monthly.userId],
      );
      assert.deepEqual(monthlyLedger.rows[0], { count: "1", subscription_available: 8 });

      await migrator.query(
        "UPDATE credit_projection SET purchased_available = 5 WHERE user_id = $1::uuid",
        [monthly.userId],
      );
      await monthly.inbox.ingestStripeSandboxEvent({
        ...event,
        amountMinor: null,
        eventType: "subscription_cancelled",
        currencyCode: null,
        payloadDigest: digest("subscription-cancelled-monthly"),
        providerEventId: "evt_subscription_cancelled_00000001",
        providerInvoiceId: null,
        receivedAt: "2026-07-31T00:06:00.000Z",
      });
      assert.equal(
        (await monthly.persistence.processNextSubscriptionEvent())?.disposition,
        "applied",
      );
      const purchased = await migrator.query<{ purchased_available: number }>(
        "SELECT purchased_available FROM credit_projection WHERE user_id = $1::uuid",
        [monthly.userId],
      );
      assert.equal(purchased.rows[0]?.purchased_available, 5);

      const annual = await createSubscription("year");
      const annualEvent = paidEvent(annual);
      await annual.inbox.ingestStripeSandboxEvent(annualEvent);
      assert.equal(
        (await annual.persistence.processNextSubscriptionEvent())?.disposition,
        "applied",
      );
      const annualRows = await migrator.query<{ allocations: string; outbox: string }>(
        `SELECT COUNT(allocation.id)::text AS allocations, COUNT(outbox.id)::text AS outbox
         FROM commercial_subscription_allocation_v1 AS allocation
         LEFT JOIN commercial_subscription_outbox_v1 AS outbox ON outbox.allocation_id = allocation.id
         JOIN commercial_subscription_period_v1 AS period ON period.id = allocation.subscription_period_id
         WHERE period.subscription_id = $1::uuid`,
        [annual.subscriptionId],
      );
      assert.deepEqual(annualRows.rows[0], { allocations: "12", outbox: "1" });
      const annualClaim = await annual.persistence.claimNextAllocation({
        claimedAt: "2026-07-31T00:04:00.000Z",
        leaseTokenHash: digest("subscription-lease-annual"),
        leasedUntil: "2026-07-31T00:05:00.000Z",
      });
      assert.notEqual(annualClaim, null);
      await annual.persistence.fulfillAllocation({
        completedAt: "2026-07-31T00:04:30.000Z",
        leaseTokenHash: digest("subscription-lease-annual"),
        outboxId: annualClaim!.outboxId,
      });
      await annual.inbox.ingestStripeSandboxEvent({
        ...annualEvent,
        eventType: "subscription_refunded",
        payloadDigest: digest("subscription-refund-annual"),
        providerEventId: "evt_subscription_refunded_00000002",
        receivedAt: "2026-07-31T00:06:00.000Z",
      });
      const refunded = await annual.persistence.processNextSubscriptionEvent();
      assert.equal(refunded?.refundDisposition, "reversed");
      const refundProjection = await migrator.query<{ subscription_available: number }>(
        "SELECT subscription_available FROM credit_projection WHERE user_id = $1::uuid",
        [annual.userId],
      );
      assert.equal(refundProjection.rows[0]?.subscription_available, 0);

      const scoped = await createSubscription("month");
      const firstScopedPeriod = paidEvent(scoped);
      await scoped.inbox.ingestStripeSandboxEvent(firstScopedPeriod);
      await scoped.persistence.processNextSubscriptionEvent();
      const firstScopedClaim = await scoped.persistence.claimNextAllocation({
        claimedAt: "2026-07-31T00:04:00.000Z",
        leaseTokenHash: digest("subscription-lease-scoped-first"),
        leasedUntil: "2026-07-31T00:05:00.000Z",
      });
      assert.notEqual(firstScopedClaim, null);
      await scoped.persistence.fulfillAllocation({
        completedAt: "2026-07-31T00:04:30.000Z",
        leaseTokenHash: digest("subscription-lease-scoped-first"),
        outboxId: firstScopedClaim!.outboxId,
      });
      const secondScopedPeriod = {
        ...firstScopedPeriod,
        occurredAt: "2026-08-31T00:02:00.000Z",
        payloadDigest: digest("subscription-paid-scoped-second"),
        periodEndsAt: "2026-09-30T00:02:00.000Z",
        periodStartsAt: "2026-08-31T00:02:00.000Z",
        providerEventId: "evt_subscription_paid_scoped_second",
        providerInvoiceId: "in_subscription_scoped_second",
        receivedAt: "2026-08-31T00:03:00.000Z",
      };
      await scoped.inbox.ingestStripeSandboxEvent(secondScopedPeriod);
      await scoped.persistence.processNextSubscriptionEvent();
      const secondScopedClaim = await scoped.persistence.claimNextAllocation({
        claimedAt: "2026-08-31T00:04:00.000Z",
        leaseTokenHash: digest("subscription-lease-scoped-second"),
        leasedUntil: "2026-08-31T00:05:00.000Z",
      });
      assert.notEqual(secondScopedClaim, null);
      await scoped.persistence.fulfillAllocation({
        completedAt: "2026-08-31T00:04:30.000Z",
        leaseTokenHash: digest("subscription-lease-scoped-second"),
        outboxId: secondScopedClaim!.outboxId,
      });
      await scoped.inbox.ingestStripeSandboxEvent({
        ...secondScopedPeriod,
        eventType: "subscription_refunded",
        occurredAt: "2026-09-01T00:00:00.000Z",
        payloadDigest: digest("subscription-refund-scoped-second"),
        providerEventId: "evt_subscription_refund_scoped_second",
        receivedAt: "2026-09-01T00:01:00.000Z",
      });
      assert.equal(
        (await scoped.persistence.processNextSubscriptionEvent())?.refundDisposition,
        "reversed",
      );
      const scopedProjection = await migrator.query<{ subscription_available: number }>(
        "SELECT subscription_available FROM credit_projection WHERE user_id = $1::uuid",
        [scoped.userId],
      );
      assert.equal(scopedProjection.rows[0]?.subscription_available, 8);
      process.stdout.write(
        "Verified commercial subscription serializable lifecycle and monthly allocation boundary.\n",
      );
    } finally {
      await migrator.end();
      await Promise.all([
        application.$disconnect(),
        fulfillment.$disconnect(),
        webhook.$disconnect(),
      ]);
    }
  } finally {
    await Promise.all(databases.map((database) => database.drop()));
    await stopLeaseOwnedRuntime(lease);
  }
});
