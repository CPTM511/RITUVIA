import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import { AccountConsentError, createAccountConsentService } from "../src/account-consent.js";
import {
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
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
  encryptionKeyVersion: "test.account-consent-email.v1",
  providerSubjectHmacKey: new Uint8Array(32).fill(29),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 20,
  startWindowSeconds: 600,
});

const bearer = (): string => randomBytes(32).toString("base64url");
const mutation = (
  purpose: "ai_personalization" | "model_improvement" | "optional_product_analytics",
  granted: boolean,
) =>
  Object.freeze({
    granted,
    noticeVersion:
      purpose === "optional_product_analytics"
        ? "rituvia.analytics-notice.v1"
        : purpose === "ai_personalization"
          ? "rituvia.ai-personalization-notice.v1"
          : "rituvia.model-improvement-notice.v1",
    purpose,
    schemaVersion: 1,
  });

await withLocalPostgresLease(async (lease) => {
  let database: Awaited<ReturnType<typeof lease.createTestDatabase>> | undefined;
  try {
    database = await lease.createTestDatabase();
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const runtime = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      const identity = createAccountIdentityService(runtime, accountPolicy);
      const consent = createAccountConsentService(runtime);
      const createAccountSession = async (email: string) => {
        const challengeId = randomUUID();
        const state = bearer();
        const token = bearer();
        const sessionToken = bearer();
        await identity.createChallenge({
          challengeId,
          email,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          providerKey: "local.passwordless.v1",
          returnTo: "/en/account",
          state,
          token,
        });
        const completed = await identity.consumeChallenge({
          challengeId,
          sessionToken,
          state,
          token,
        });
        return Object.freeze({ ...completed.context, sessionToken });
      };

      const ownerSession = await createAccountSession("consent-owner@example.test");
      const ownerSecondSession = await createAccountSession("consent-owner@example.test");
      const otherSession = await createAccountSession("consent-other@example.test");

      const defaults = await consent.list(ownerSession.sessionToken);
      assert.deepEqual(
        defaults.map((control) => [control.purpose, control.granted, control.recordedAt]),
        [
          ["optional_product_analytics", false, null],
          ["ai_personalization", false, null],
          ["model_improvement", false, null],
        ],
      );

      const analyticsKey = bearer();
      const analytics = await consent.record({
        idempotencyKey: analyticsKey,
        request: mutation("optional_product_analytics", true),
        sessionToken: ownerSession.sessionToken,
      });
      assert.equal(analytics.granted, true);
      assert.equal(
        await consent.allows({
          noticeVersion: "rituvia.analytics-notice.v1",
          purpose: "optional_product_analytics",
          sessionToken: ownerSession.sessionToken,
        }),
        true,
      );
      assert.equal(
        await consent.allows({
          noticeVersion: "rituvia.analytics-notice.v0",
          purpose: "optional_product_analytics",
          sessionToken: ownerSession.sessionToken,
        }),
        false,
      );

      await consent.record({
        idempotencyKey: analyticsKey,
        request: mutation("optional_product_analytics", true),
        sessionToken: ownerSession.sessionToken,
      });
      const analyticsCount = await migrator.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM account_consent_record
          WHERE user_id = $1::uuid
            AND purpose = 'optional_product_analytics'`,
        [ownerSession.userId],
      );
      assert.equal(analyticsCount.rows[0]?.count, "1");

      await assert.rejects(
        consent.record({
          idempotencyKey: analyticsKey,
          request: mutation("optional_product_analytics", false),
          sessionToken: ownerSession.sessionToken,
        }),
        (error: unknown) =>
          error instanceof AccountConsentError && error.code === "ACCOUNT_CONSENT_CONFLICT",
      );

      await consent.record({
        idempotencyKey: bearer(),
        request: mutation("ai_personalization", true),
        sessionToken: ownerSession.sessionToken,
      });
      assert.equal(
        (await consent.list(ownerSecondSession.sessionToken)).find(
          (control) => control.purpose === "ai_personalization",
        )?.granted,
        true,
      );
      assert.equal(
        (await consent.list(otherSession.sessionToken)).find(
          (control) => control.purpose === "ai_personalization",
        )?.granted,
        false,
      );

      await consent.record({
        idempotencyKey: bearer(),
        request: mutation("ai_personalization", false),
        sessionToken: ownerSecondSession.sessionToken,
      });
      assert.equal(
        await consent.allows({
          noticeVersion: "rituvia.ai-personalization-notice.v1",
          purpose: "ai_personalization",
          sessionToken: ownerSession.sessionToken,
        }),
        false,
      );
      assert.equal(
        (await consent.list(ownerSession.sessionToken)).find(
          (control) => control.purpose === "model_improvement",
        )?.granted,
        false,
      );

      await Promise.all(
        [ownerSession.sessionToken, ownerSecondSession.sessionToken].map((sessionToken) =>
          consent.record({
            idempotencyKey: bearer(),
            request: mutation("model_improvement", true),
            sessionToken,
          }),
        ),
      );
      const concurrentRows = await migrator.query<{ sequence: number }>(
        `SELECT sequence
           FROM account_consent_record
          WHERE user_id = $1::uuid
            AND purpose = 'model_improvement'
          ORDER BY sequence`,
        [ownerSession.userId],
      );
      assert.deepEqual(
        concurrentRows.rows.map((row) => row.sequence),
        [1, 2],
      );

      const boundedSession = await createAccountSession("consent-bound@example.test");
      await migrator.query(
        `
          INSERT INTO account_consent_record (
            user_id, purpose, sequence, notice_version, locale, decision, source,
            idempotency_key_hash, canonical_request_hash
          )
          SELECT $1::uuid, 'ai_personalization', sequence,
                 'rituvia.ai-personalization-notice.v1', 'en', 'granted',
                 'privacy_controls',
                 decode(
                   md5('consent-idempotency-a-' || sequence::text)
                   || md5('consent-idempotency-b-' || sequence::text),
                   'hex'
                 ),
                 decode(
                   md5('consent-request-a-' || sequence::text)
                   || md5('consent-request-b-' || sequence::text),
                   'hex'
                 )
            FROM generate_series(1, 257) AS sequence
        `,
        [boundedSession.userId],
      );
      assert.equal(
        await consent.allows({
          noticeVersion: "rituvia.ai-personalization-notice.v1",
          purpose: "ai_personalization",
          sessionToken: boundedSession.sessionToken,
        }),
        false,
      );

      const futureSession = await createAccountSession("consent-future@example.test");
      await migrator.query(
        `
          INSERT INTO account_consent_record (
            user_id, purpose, sequence, notice_version, locale, decision, source,
            recorded_at, idempotency_key_hash, canonical_request_hash
          ) VALUES (
            $1::uuid, 'ai_personalization', 1,
            'rituvia.ai-personalization-notice.v1', 'en', 'granted',
            'privacy_controls', CURRENT_TIMESTAMP + INTERVAL '1 day',
            $2, $3
          )
        `,
        [futureSession.userId, randomBytes(32), randomBytes(32)],
      );
      assert.equal(
        await consent.allows({
          noticeVersion: "rituvia.ai-personalization-notice.v1",
          purpose: "ai_personalization",
          sessionToken: futureSession.sessionToken,
        }),
        false,
      );

      assert.equal(
        await consent.allows({
          noticeVersion: "rituvia.ai-personalization-notice.v1",
          purpose: "ai_personalization",
          sessionToken: "invalid",
        }),
        false,
      );
      await assert.rejects(
        runtime.$executeRawUnsafe(`UPDATE account_consent_record SET decision = 'denied'`),
      );
      await assert.rejects(runtime.$executeRawUnsafe(`DELETE FROM account_consent_record`));

      const withdrawal = await migrator.query<{
        decision: string;
        withdrawsRecordId: string | null;
      }>(
        `SELECT decision, withdraws_record_id AS "withdrawsRecordId"
           FROM account_consent_record
          WHERE user_id = $1::uuid
            AND purpose = 'ai_personalization'
          ORDER BY sequence DESC
          LIMIT 1`,
        [ownerSession.userId],
      );
      assert.equal(withdrawal.rows[0]?.decision, "withdrawn");
      assert.notEqual(withdrawal.rows[0]?.withdrawsRecordId, null);

      console.log(
        "Verified account consent purpose/version isolation, replay, concurrency, immediate withdrawal, bounded fail-closed evaluation, and append-only runtime privileges.",
      );
    } finally {
      await migrator.end();
      await runtime.$disconnect();
    }
  } finally {
    if (database !== undefined) {
      await database.drop();
    }
    await stopLeaseOwnedRuntime(lease);
  }
});
