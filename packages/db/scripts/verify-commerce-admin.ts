import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import {
  CommerceAdminError,
  assertCommerceAdminRuntimeDatabasePrivileges,
  createCommerceAdminService,
  type CommerceAdminExecutors,
  verifyCommerceAdminAuditEventHash,
  verifyCommerceAdminOperationEventDigest,
} from "../src/commerce-admin.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const accountPolicy: AccountIdentityPolicy = Object.freeze({
  challengeTtlSeconds: 600,
  emailEncryptionKey: new Uint8Array(32).fill(17),
  encryptionKeyVersion: "auth-data.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});
const adminPolicy = Object.freeze({
  executionLeaseSeconds: 60,
  limitPolicyVersion: "commerce-admin-limits.v1",
  maxExecutionAttempts: 2,
  maxInspectionsPerActorPerMinute: 2,
  maxManualReconciliationsPerOrderPerHour: 1,
  maxRefundMinor: 599,
  maxRefundMinorPerActorPerDay: 599,
  maxTimelineEvents: 50,
  recentAuthenticationSeconds: 300,
});
const bearer = (): string => randomBytes(32).toString("base64url");

const expectAdminError = async (operation: () => Promise<unknown>, code: string): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected commerce admin error ${code}.`);
  } catch (error) {
    assert(error instanceof CommerceAdminError, String(error));
    assert.equal(error.code, code);
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
    const observed = (error as { code?: unknown }).code;
    assert(
      observed === code ||
        (observed === "P2010" &&
          (String(error).includes(code) || JSON.stringify(error).includes(code))),
      `Expected PostgreSQL ${code}, observed ${String(observed)}.`,
    );
  }
};

await withLocalPostgresLease(async (lease) => {
  const database = await lease.createTestDatabase();
  let primaryError: unknown;
  try {
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const adminDatabase = createDatabaseClient(database.adminServiceDatabaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    const ordinary = new Client({ connectionString: database.databaseUrl });
    await Promise.all([migrator.connect(), ordinary.connect()]);
    try {
      await assertCommerceAdminRuntimeDatabasePrivileges(adminDatabase);
      const accounts = createAccountIdentityService(application, accountPolicy);
      const createSession = async (email: string) => {
        const challengeId = randomUUID();
        const state = bearer();
        const token = bearer();
        const sessionToken = bearer();
        await accounts.createChallenge({
          challengeId,
          email,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          providerKey: "local.passwordless.v1",
          returnTo: "/en/account",
          state,
          token,
        });
        const completed = await accounts.consumeChallenge({
          challengeId,
          sessionToken,
          state,
          token,
        });
        return Object.freeze({ ...completed.context, sessionToken });
      };
      const owner = await createSession("owner-commerce-admin@example.test");
      const ordinaryUser = await createSession("ordinary-commerce-admin@example.test");
      await migrator.query(
        `
          INSERT INTO admin_role_assignment (
            id, user_id, role, granted_by_user_id, reason_code, created_at
          ) VALUES ($1, $2, 'owner', NULL, 'initial_bootstrap', CURRENT_TIMESTAMP)
        `,
        [randomUUID(), owner.userId],
      );

      const orderId = randomUUID();
      const orderPublicId = randomUUID();
      const attemptId = randomUUID();
      await migrator.query(
        `
          INSERT INTO catalog_version (
            schema_version, version, environment, status, approval_mode,
            default_locale, supported_locales, effective_from, next_review_at,
            source_reference, source_checksum_sha256, owner_reference, actor_id
          ) VALUES (
            'catalog-version.v1', 'catalog.test.v1', 'local', 'active', 'local_test',
            'en', ARRAY['en'], CURRENT_TIMESTAMP - INTERVAL '1 day',
            CURRENT_TIMESTAMP + INTERVAL '30 days', 'test:commerce-admin',
            repeat('a', 64), 'test:RIT-073', 'test.commerce_admin'
          )
        `,
      );
      await migrator.query(
        `
          INSERT INTO catalog_product (
            catalog_version, code, version, kind, status, fulfillment_code, credits_granted
          ) VALUES (
            'catalog.test.v1', 'credit_pack_six', 'credit-pack.test.v1',
            'credit_pack', 'active', 'credits.purchased.6', 6
          )
        `,
      );
      await migrator.query(
        `
          INSERT INTO catalog_price (
            catalog_version, price_id, version, product_code, product_version,
            status, currency_code, amount_minor, billing_interval, country_codes,
            provider_eligibility, tax_category, refund_policy_version, effective_from
          ) VALUES (
            'catalog.test.v1', 'price_test_599', 'price.test.v1',
            'credit_pack_six', 'credit-pack.test.v1', 'active', 'USD', 599,
            'one_time', ARRAY['US'], ARRAY['stripe'], 'digital_service',
            'refund.test.v1', CURRENT_TIMESTAMP - INTERVAL '1 day'
          )
        `,
      );
      await migrator.query(
        `
          INSERT INTO commercial_order_v2 (
            id, public_id, user_id, status, currency_code, subtotal_minor, tax_minor,
            total_minor, refunded_minor, country_code, country_policy_version,
            catalog_version, price_id, price_version, terms_version, refund_policy_version,
            idempotency_key_version, idempotency_key_hash, canonical_request_hash,
            created_at, updated_at, paid_at, payment_state_version
          ) VALUES (
            $1, $2, $3, 'paid', 'USD', 599, 0, 599, 0, 'US',
            'country-policy.test.v1', 'catalog.test.v1', 'price_test_599',
            'price.test.v1', 'terms.test.v1', 'refund.test.v1',
            'checkout.test.v1', $4, $5,
            CURRENT_TIMESTAMP - INTERVAL '5 minutes',
            CURRENT_TIMESTAMP - INTERVAL '4 minutes',
            CURRENT_TIMESTAMP - INTERVAL '4 minutes', 1
          )
        `,
        [orderId, orderPublicId, ordinaryUser.userId, randomBytes(32), randomBytes(32)],
      );
      await migrator.query(
        `
          INSERT INTO commercial_order_item_v2 (
            id, order_id, catalog_version, product_code, product_version, quantity,
            unit_amount_minor, total_minor, exact_contents_snapshot, fulfillment_kind,
            fulfillment_code, credits_granted
          ) VALUES (
            $1, $2, 'catalog.test.v1', 'credit_pack_six', 'credit-pack.test.v1', 1,
            599, 599, ARRAY['Six purchased Credits'], 'credit_pack',
            'credits.purchased.6', 6
          )
        `,
        [randomUUID(), orderId],
      );
      await migrator.query(
        `
          INSERT INTO commercial_payment_attempt_v2 (
            id, order_id, provider, environment, provider_account_fingerprint,
            attempt_number, state, provider_checkout_id, provider_payment_intent_id,
            amount_minor, currency_code, idempotency_key_version, idempotency_key_hash,
            canonical_request_hash, expires_at, created_at, updated_at, completed_at
          ) VALUES (
            $1, $2, 'stripe', 'sandbox', 'acct_test', 1, 'succeeded',
            'cs_test_commerce_admin', 'pi_test_commerce_admin', 599, 'USD',
            'checkout.test.v1', $3, $4,
            CURRENT_TIMESTAMP + INTERVAL '25 minutes',
            CURRENT_TIMESTAMP - INTERVAL '5 minutes',
            CURRENT_TIMESTAMP - INTERVAL '4 minutes',
            CURRENT_TIMESTAMP - INTERVAL '4 minutes'
          )
        `,
        [attemptId, orderId, randomBytes(32), randomBytes(32)],
      );

      let reconciliationCalls = 0;
      let refundCalls = 0;
      const reconciliationRunId = randomUUID();
      const refundId = randomUUID();
      const executors: CommerceAdminExecutors = Object.freeze({
        async reconcile(input) {
          reconciliationCalls += 1;
          assert.equal(input.orderId, orderPublicId);
          assert.equal(input.idempotencyKey, input.operationId);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return Object.freeze({
            cases: 0,
            disposition: "clean" as const,
            runId: reconciliationRunId,
          });
        },
        async refund(input) {
          refundCalls += 1;
          assert.equal(input.orderId, orderPublicId);
          assert.equal(input.userId, ordinaryUser.userId);
          assert.equal(input.amountMinor, 599);
          assert.equal(input.currencyCode, "USD");
          assert.equal(input.idempotencyKey, input.operationId);
          if (refundCalls === 1) throw new Error("Synthetic provider outage.");
          return Object.freeze({
            amountMinor: 599,
            currencyCode: "USD",
            refundId,
            state: "refund_requested" as const,
          });
        },
      });
      const admin = createCommerceAdminService(adminDatabase, adminPolicy, executors);

      await expectAdminError(
        () =>
          admin.inspectOrder({
            orderId: orderPublicId,
            reasonCode: "support_review",
            sessionToken: ordinaryUser.sessionToken,
            ticketReference: "RIT-073",
          }),
        "COMMERCE_ADMIN_FORBIDDEN",
      );
      await expectAdminError(
        () =>
          admin.inspectOrder({
            orderId: orderPublicId,
            reasonCode: "support_review",
            sessionToken: owner.sessionToken,
            ticketReference: "RIT-073",
          }),
        "COMMERCE_ADMIN_MFA_REQUIRED",
      );
      await migrator.query(
        `UPDATE account_session
            SET authenticated_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes',
                created_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes',
                last_seen_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes'
          WHERE id = $1`,
        [owner.sessionId],
      );
      await expectAdminError(
        () =>
          admin.inspectOrder({
            orderId: orderPublicId,
            reasonCode: "support_review",
            sessionToken: owner.sessionToken,
            ticketReference: "RIT-073",
          }),
        "COMMERCE_ADMIN_RECENT_AUTH_REQUIRED",
      );
      await migrator.query(
        `UPDATE account_session
            SET authenticated_at = CURRENT_TIMESTAMP,
                created_at = CURRENT_TIMESTAMP,
                last_seen_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [owner.sessionId],
      );

      const passkeyId = randomUUID();
      await migrator.query(
        `
          INSERT INTO passkey_credential (
            id, auth_identity_id, credential_id, public_key, rp_id,
            sign_count, created_at, last_used_at
          ) VALUES ($1, $2, $3, $4, 'admin.localhost', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [passkeyId, owner.authIdentityId, randomBytes(32), randomBytes(65)],
      );
      await migrator.query(
        `
          INSERT INTO admin_mfa_assertion (
            id, user_id, account_session_id, auth_identity_id,
            passkey_credential_id, challenge_hash, verified_at, expires_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes'
          )
        `,
        [
          randomUUID(),
          owner.userId,
          owner.sessionId,
          owner.authIdentityId,
          passkeyId,
          randomBytes(32),
        ],
      );

      const initialTimeline = await admin.inspectOrder({
        orderId: orderPublicId,
        reasonCode: "support_review",
        sessionToken: owner.sessionToken,
        ticketReference: "RIT-073",
      });
      assert.equal(initialTimeline.order.orderId, orderPublicId);
      assert.equal(initialTimeline.order.accountReference.length, 20);
      assert.equal(initialTimeline.order.amountMinor, 599);
      assert(
        initialTimeline.events.some(
          ({ code, state }) => code === "order.created" && state === "created",
        ),
      );
      assert(
        initialTimeline.events.some(
          ({ code, state }) => code === "payment.attempt.created" && state === "created",
        ),
      );
      assert(initialTimeline.events.some(({ code }) => code === "payment.attempt.completed"));
      assert(!JSON.stringify(initialTimeline).includes(ordinaryUser.userId));

      const reconciliationInput = {
        confirmation: `RECONCILE ${orderPublicId}`,
        idempotencyKey: randomUUID(),
        orderId: orderPublicId,
        reasonCode: "manual_reconciliation",
        sessionToken: owner.sessionToken,
        ticketReference: "RIT-073",
      };
      const concurrentReconciliations = await Promise.all([
        admin.reconcileOrder(reconciliationInput),
        admin.reconcileOrder(reconciliationInput),
      ]);
      assert.equal(
        concurrentReconciliations[0]?.operationId,
        concurrentReconciliations[1]?.operationId,
      );
      assert(concurrentReconciliations.some(({ kind }) => kind === "created"));
      const replayedReconciliation = await admin.reconcileOrder(reconciliationInput);
      assert.equal(replayedReconciliation.kind, "replayed");
      assert.equal(replayedReconciliation.state, "succeeded");
      assert.equal(replayedReconciliation.resultReference, reconciliationRunId);
      assert.equal(reconciliationCalls, 1);
      const policyReplayAdmin = createCommerceAdminService(
        adminDatabase,
        Object.freeze({ ...adminPolicy, limitPolicyVersion: "commerce-admin-limits.v2" }),
        {
          async reconcile() {
            assert.fail("A policy-version replay must not execute again.");
          },
          async refund() {
            assert.fail("A policy-version replay must not execute again.");
          },
        },
      );
      const policyVersionReplay = await policyReplayAdmin.reconcileOrder(reconciliationInput);
      assert.equal(policyVersionReplay.kind, "replayed");
      assert.equal(policyVersionReplay.state, "succeeded");
      await expectAdminError(
        () =>
          admin.reconcileOrder({
            ...reconciliationInput,
            idempotencyKey: randomUUID(),
          }),
        "COMMERCE_ADMIN_LIMIT_EXCEEDED",
      );

      await expectAdminError(
        () =>
          admin.refundOrder({
            amountMinor: 600,
            confirmation: `REFUND ${orderPublicId} 600 USD`,
            currencyCode: "USD",
            idempotencyKey: randomUUID(),
            orderId: orderPublicId,
            reasonCode: "approved_refund",
            sessionToken: owner.sessionToken,
            ticketReference: "RIT-073",
          }),
        "COMMERCE_ADMIN_LIMIT_EXCEEDED",
      );
      const refundInput = {
        amountMinor: 599,
        confirmation: `REFUND ${orderPublicId} 599 USD`,
        currencyCode: "USD",
        idempotencyKey: randomUUID(),
        orderId: orderPublicId,
        reasonCode: "approved_refund",
        sessionToken: owner.sessionToken,
        ticketReference: "RIT-073",
      };
      await expectAdminError(() => admin.refundOrder(refundInput), "COMMERCE_ADMIN_ACTION_FAILED");
      const lowerRefundLimitAdmin = createCommerceAdminService(
        adminDatabase,
        Object.freeze({
          ...adminPolicy,
          limitPolicyVersion: "commerce-admin-limits.v3",
          maxRefundMinor: 1,
        }),
        executors,
      );
      const refund = await lowerRefundLimitAdmin.refundOrder(refundInput);
      assert.equal(refund.kind, "replayed");
      assert.equal(refund.state, "succeeded");
      assert.equal(refund.resultReference, refundId);
      const replayedRefund = await admin.refundOrder(refundInput);
      assert.equal(replayedRefund.kind, "replayed");
      assert.equal(refundCalls, 2);
      await expectAdminError(
        () =>
          admin.refundOrder({
            ...refundInput,
            idempotencyKey: randomUUID(),
          }),
        "COMMERCE_ADMIN_LIMIT_EXCEEDED",
      );
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await expectAdminError(
          () =>
            admin.reconcileOrder({
              ...reconciliationInput,
              idempotencyKey: randomUUID(),
            }),
          "COMMERCE_ADMIN_LIMIT_EXCEEDED",
        );
      }
      const deniedAuditCount = await migrator.query<{ count: string }>(
        `
          SELECT COUNT(*)::text AS count
          FROM commerce_admin_audit_event_v1
          WHERE actor_user_id = $1
            AND outcome = 'denied'
        `,
        [owner.userId],
      );
      assert.equal(Number(deniedAuditCount.rows[0]?.count), 9);

      const completedTimeline = await admin.inspectOrder({
        orderId: orderPublicId,
        reasonCode: "post_action_review",
        sessionToken: owner.sessionToken,
        ticketReference: "RIT-073",
      });
      assert(
        completedTimeline.events.some(
          ({ code, state }) => code === "admin.reconcile_order.succeeded" && state === "succeeded",
        ),
      );
      assert(
        completedTimeline.events.some(
          ({ code, state }) => code === "admin.refund_order.succeeded" && state === "succeeded",
        ),
      );
      await expectAdminError(
        () =>
          admin.inspectOrder({
            orderId: orderPublicId,
            reasonCode: "excessive_review",
            sessionToken: owner.sessionToken,
            ticketReference: "RIT-073",
          }),
        "COMMERCE_ADMIN_LIMIT_EXCEEDED",
      );

      const audit = await migrator.query<{
        action: "admin.commerce.read" | "admin.commerce.reconcile" | "admin.refund.execute";
        actorRole:
          | "analyst_read_only"
          | "content_editor"
          | "owner"
          | "risk_safety_reviewer"
          | "support_refund_reviewer"
          | null;
        actorSessionId: string;
        actorUserId: string;
        afterDigest: Uint8Array | null;
        beforeDigest: Uint8Array | null;
        createdAt: Date;
        eventHash: Uint8Array;
        eventId: string;
        outcome: "accepted" | "completed" | "denied";
        previousEventHash: Uint8Array | null;
        reasonCode: string;
        requestId: string;
        targetId: string;
        targetType: string;
        ticketReference: string | null;
      }>(
        `
          SELECT id AS "eventId", actor_user_id AS "actorUserId",
                 actor_session_id AS "actorSessionId", actor_role AS "actorRole",
                 request_id AS "requestId", action, outcome,
                 target_type AS "targetType", target_id AS "targetId",
                 reason_code AS "reasonCode", ticket_reference AS "ticketReference",
                 before_digest AS "beforeDigest", after_digest AS "afterDigest",
                 previous_event_hash AS "previousEventHash", event_hash AS "eventHash",
                 created_at AS "createdAt"
          FROM commerce_admin_audit_event_v1
          ORDER BY created_at, id
        `,
      );
      assert(audit.rows.length >= 5);
      assert(audit.rows.some(({ actorRole }) => actorRole === "owner"));
      assert(
        audit.rows.some(
          ({ actorRole, reasonCode }) =>
            actorRole === "owner" && reasonCode === "recent_authentication_required",
        ),
      );
      for (const [index, event] of audit.rows.entries()) {
        assert.equal(verifyCommerceAdminAuditEventHash(event), true);
        if (index === 0) assert.equal(event.previousEventHash, null);
        else assert.deepEqual(event.previousEventHash, audit.rows[index - 1]?.eventHash);
      }
      const serializedAudit = JSON.stringify(
        audit.rows.map((event) => ({
          ...event,
          afterDigest:
            event.afterDigest === null ? null : Buffer.from(event.afterDigest).toString("hex"),
          beforeDigest:
            event.beforeDigest === null ? null : Buffer.from(event.beforeDigest).toString("hex"),
          eventHash: Buffer.from(event.eventHash).toString("hex"),
          previousEventHash:
            event.previousEventHash === null
              ? null
              : Buffer.from(event.previousEventHash).toString("hex"),
        })),
      );
      assert(!serializedAudit.includes("owner-commerce-admin@example.test"));
      assert(!serializedAudit.includes(owner.sessionToken));

      const operationEvents = await migrator.query<{
        attemptId: string | null;
        createdAt: Date;
        eventType: "execution_started" | "failed" | "requested" | "succeeded";
        evidenceDigest: Uint8Array;
        operationId: string;
        resultReference: string | null;
      }>(
        `
          SELECT operation_id AS "operationId", attempt_id AS "attemptId",
                 event_type AS "eventType", result_reference AS "resultReference",
                 evidence_digest AS "evidenceDigest", created_at AS "createdAt"
          FROM commerce_admin_operation_event_v1
          ORDER BY created_at, id
        `,
      );
      assert(operationEvents.rows.length >= 7);
      for (const event of operationEvents.rows) {
        assert.equal(verifyCommerceAdminOperationEventDigest(event), true);
      }

      await expectPostgresError(
        () => ordinary.query("SELECT * FROM commerce_admin_operation_v1"),
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$queryRaw`SELECT id FROM commercial_order_v2`,
        "42501",
      );
      await migrator.query(
        "GRANT SELECT (user_id) ON TABLE commercial_order_v2 TO rituvia_admin_service",
      );
      try {
        await expectAdminError(
          () =>
            admin.inspectOrder({
              orderId: orderPublicId,
              reasonCode: "privilege_attestation",
              sessionToken: owner.sessionToken,
              ticketReference: "RIT-073",
            }),
          "COMMERCE_ADMIN_UNAVAILABLE",
        );
      } finally {
        await migrator.query(
          "REVOKE SELECT (user_id) ON TABLE commercial_order_v2 FROM rituvia_admin_service",
        );
      }
      await migrator.query(
        "GRANT UPDATE (refunded_minor) ON TABLE commercial_order_v2 TO rituvia_admin_service",
      );
      try {
        await expectAdminError(
          () => admin.reconcileOrder(reconciliationInput),
          "COMMERCE_ADMIN_UNAVAILABLE",
        );
      } finally {
        await migrator.query(
          "REVOKE UPDATE (refunded_minor) ON TABLE commercial_order_v2 FROM rituvia_admin_service",
        );
      }
      await expectPostgresError(
        () =>
          adminDatabase.$executeRaw`UPDATE commerce_admin_operation_v1 SET reason_code = 'tamper'`,
        "42501",
      );
      await expectPostgresError(
        () =>
          adminDatabase.$executeRaw`UPDATE commerce_admin_audit_event_v1 SET outcome = 'denied'`,
        "42501",
      );
      await expectPostgresError(
        () => adminDatabase.$executeRaw`DELETE FROM commerce_admin_operation_event_v1`,
        "42501",
      );
    } finally {
      await Promise.all([
        application.$disconnect(),
        adminDatabase.$disconnect(),
        migrator.end(),
        ordinary.end(),
      ]);
    }
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      await database.drop();
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
  }
  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified owner-only commerce timelines, recent passkey reauthentication, bounded idempotent reconciliation and refund execution, tamper-evident audit, and immutable least-privilege storage.\n",
);
