import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import {
  createReflectionPersistence,
  type ReflectionCiphertext,
} from "../src/reflection-persistence.js";
import {
  assertRitualJournalRuntimeDatabasePrivileges,
  createRitualJournalPersistence,
  RitualJournalPersistenceError,
  type RitualJournalCiphertext,
} from "../src/ritual-journal-persistence.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const identityPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.ritual-journal-session.v1",
  ttlSeconds: 86_400,
});
const reflectionPolicy = Object.freeze({
  policyVersion: "reflection-loop.en.v1" as const,
  retentionSeconds: 604_800,
  revisitDelaySeconds: 86_400,
});
const keyVersion = "test.ritual-journal.v1";

const digest = (value: string): string =>
  `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;

const ciphertext = (value: string): ReflectionCiphertext =>
  Object.freeze({
    ciphertext: createHash("sha256").update(value, "utf8").digest(),
    keyVersion,
    nonce: createHash("sha256").update(`${value}:nonce`, "utf8").digest().subarray(0, 12),
    tag: createHash("sha256").update(`${value}:tag`, "utf8").digest().subarray(0, 16),
  });

const journalCiphertext = (value: string): RitualJournalCiphertext =>
  Object.freeze({
    ciphertext: Buffer.from(value, "utf8"),
    keyVersion,
    nonce: createHash("sha256").update(`${value}:nonce`, "utf8").digest().subarray(0, 12),
    tag: createHash("sha256").update(`${value}:tag`, "utf8").digest().subarray(0, 16),
  });

const prepared = (subjectId: string, key: string, request: unknown) =>
  Object.freeze({
    canonicalRequestDigest: digest(`${subjectId}:${JSON.stringify(request)}`),
    idempotencyKeyDigest: digest(`${subjectId}:${key}`),
    keyVersion,
  });

const expectRitualError = async (
  operation: () => Promise<unknown>,
  code: RitualJournalPersistenceError["code"],
): Promise<void> => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof RitualJournalPersistenceError);
    assert.equal(error.code, code);
    return true;
  });
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const runtime = createDatabaseClient(database.databaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      await assertRitualJournalRuntimeDatabasePrivileges(runtime);
      const identity = createAnonymousIdentityService(runtime, identityPolicy);
      const owner = await identity.ensureSession({
        idempotencyKey: randomBytes(24).toString("base64url"),
      });
      const otherOwner = await identity.ensureSession({
        idempotencyKey: randomBytes(24).toString("base64url"),
      });
      assert.equal(owner.kind, "created");
      assert.equal(otherOwner.kind, "created");
      if (owner.kind !== "created" || otherOwner.kind !== "created") {
        assert.fail("Expected distinct ritual owners.");
      }

      const reflection = createReflectionPersistence(runtime, reflectionPolicy);
      const intentionRequest = Object.freeze({
        intentionCode: "calm_clarity" as const,
        intentionText: "I intend to pause before I answer.",
        locale: "en" as const,
        privacyState: "private" as const,
        readingId: null,
        reminderPreference: "none" as const,
        revisitDate: null,
        schemaVersion: "reflection-intention.v2" as const,
        smallAction: "Take one slow breath.",
        timeZone: null,
      });
      const intention = await reflection.resolveIntentionV2({
        prepare: ({ resourceId, subjectId }) => ({
          canonicalRequestDigest: digest(`${subjectId}:intention`),
          encryptedIntentionText: ciphertext(`${resourceId}:intention`),
          encryptedSmallAction: ciphertext(`${resourceId}:action`),
          idempotencyKeyDigest: digest(`${subjectId}:intention-key`),
          idempotencyKeyVersion: keyVersion,
        }),
        principal: { anonymousSessionToken: owner.token },
        request: intentionRequest,
      });

      const persistence = createRitualJournalPersistence(runtime);
      const freeRequest = Object.freeze({
        intentionId: intention.intention.id,
        itemCode: "free_candle" as const,
        schemaVersion: "ritual-session.v2" as const,
      });
      const freeSnapshot = Object.freeze({
        access: Object.freeze({ kind: "free" as const, requirementCode: null }),
        catalogId: "rituvia-original-secular" as const,
        catalogVersion: "1.0.0",
        itemCode: "free_candle" as const,
        itemVersion: "1.0.0",
        publicationId: "rituvia-original.en.2026-07-23",
        schemaVersion: "ritual-session-snapshot.v1" as const,
        templateCode: "free-candle-pause" as const,
        templateVersion: "1.0.0",
      });
      const freeKey = randomUUID();
      const freeInput = Object.freeze({
        prepare: ({ subjectId }: { subjectId: string }) =>
          prepared(subjectId, freeKey, freeRequest),
        principal: { anonymousSessionToken: owner.token },
        request: freeRequest,
        snapshot: freeSnapshot,
      });
      const free = await persistence.startSession(freeInput);
      assert.equal(free.kind, "created");
      assert.equal(free.resource.status, "active");
      assert.equal((await persistence.startSession(freeInput)).kind, "replayed");

      const ownerTokenHash = createHash("sha256")
        .update(Buffer.from(owner.token, "base64url"))
        .digest();
      const ownerSession = await migrator.query<{
        sessionId: string;
        subjectId: string;
      }>(
        `SELECT id AS "sessionId", anonymous_subject_id AS "subjectId"
           FROM anonymous_session
          WHERE token_hash = $1`,
        [ownerTokenHash],
      );
      const ownerIdentity = ownerSession.rows[0];
      assert.ok(ownerIdentity);
      const userId = randomUUID();
      const authIdentityId = randomUUID();
      const accountSessionId = randomUUID();
      const orderId = randomUUID();
      const orderLineId = randomUUID();
      const passId = randomUUID();
      const accountToken = randomBytes(32).toString("base64url");
      const accountTokenHash = createHash("sha256")
        .update(Buffer.from(accountToken, "base64url"))
        .digest();
      await migrator.query("BEGIN");
      await migrator.query(
        `INSERT INTO app_user (id, email_verified_at)
         VALUES ($1::uuid, CURRENT_TIMESTAMP)`,
        [userId],
      );
      await migrator.query(
        `INSERT INTO auth_identity (
           id, user_id, provider_key, provider_subject, verified_email_ciphertext,
           verified_email_nonce, verified_email_tag, encryption_key_version,
           verified_at, last_sign_in_at
         ) VALUES (
           $1::uuid, $2::uuid, 'test', 'ritual-journal-owner',
           decode('01', 'hex'), decode(repeat('02', 12), 'hex'),
           decode(repeat('03', 16), 'hex'), $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )`,
        [authIdentityId, userId, keyVersion],
      );
      await migrator.query(
        `INSERT INTO account_session (
           id, user_id, auth_identity_id, token_hash, expires_at
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4,
           CURRENT_TIMESTAMP + INTERVAL '1 day'
         )`,
        [accountSessionId, userId, authIdentityId, accountTokenHash],
      );
      await migrator.query(
        `INSERT INTO account_subject_link (
           user_id, anonymous_subject_id, source_session_id, source_account_session_id,
           idempotency_key_hash, canonical_request_hash
         ) VALUES (
           $1::uuid, $2::uuid, $3::uuid, $4::uuid,
           decode(repeat('04', 32), 'hex'), decode(repeat('05', 32), 'hex')
         )`,
        [userId, ownerIdentity.subjectId, ownerIdentity.sessionId, accountSessionId],
      );
      await migrator.query(
        `INSERT INTO commerce_order (
           id, user_id, status, currency, subtotal_minor, total_minor,
           country_code, country_policy_version, terms_version, refund_policy_version,
           idempotency_key_hash, canonical_request_hash, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, 'paid', 'USD', 100, 100,
           'US', 'test.country.v1', 'test.terms.v1', 'test.refund.v1',
           decode(repeat('06', 32), 'hex'), decode(repeat('07', 32), 'hex'),
           CURRENT_TIMESTAMP
         )`,
        [orderId, userId],
      );
      await migrator.query(
        `INSERT INTO commerce_order_line (
           id, order_id, product_code, product_version, price_version,
           unit_amount_minor, total_minor, exact_contents_snapshot, entitlement_code
         ) VALUES (
           $1::uuid, $2::uuid, 'ritual.guided_light', '1.0.0', '1.0.0',
           100, 100, '["guided light pass"]'::jsonb, 'ritual-pass.guided_light'
         )`,
        [orderLineId, orderId],
      );
      await migrator.query(
        `INSERT INTO ritual_pass (
           id, user_id, access_requirement_code, source_order_line_id
         ) VALUES ($1::uuid, $2::uuid, 'ritual-pass.guided_light', $3::uuid)`,
        [passId, userId, orderLineId],
      );
      await migrator.query("COMMIT");

      const passRequest = Object.freeze({
        intentionId: intention.intention.id,
        itemCode: "guided_light" as const,
        schemaVersion: "ritual-session.v2" as const,
      });
      const passSnapshot = Object.freeze({
        access: Object.freeze({
          kind: "consumable_pass" as const,
          requirementCode: "ritual-pass.guided_light",
        }),
        catalogId: "rituvia-original-secular" as const,
        catalogVersion: "1.0.0",
        itemCode: "guided_light" as const,
        itemVersion: "1.0.0",
        publicationId: "rituvia-original.en.2026-07-23",
        schemaVersion: "ritual-session-snapshot.v1" as const,
        templateCode: "guided-light" as const,
        templateVersion: "1.0.0",
      });
      const passKey = randomUUID();
      const passInput = Object.freeze({
        prepare: ({ subjectId }: { subjectId: string }) =>
          prepared(subjectId, passKey, passRequest),
        principal: { accountSessionToken: accountToken },
        request: passRequest,
        snapshot: passSnapshot,
      });
      await expectRitualError(() => persistence.startSession(passInput), "RITUAL_JOURNAL_CONFLICT");
      const availableAfterRollback = await migrator.query<{ status: string }>(
        "SELECT status FROM ritual_pass WHERE id = $1::uuid",
        [passId],
      );
      assert.equal(availableAfterRollback.rows[0]?.status, "available");

      const completeFreeRequest = Object.freeze({
        action: "complete" as const,
        currentStepCode: "complete" as const,
        elapsedSeconds: 30,
        expectedRevision: 1,
        schemaVersion: "ritual-session-mutation.v1" as const,
      });
      const completeFree = await persistence.mutateSession({
        id: free.resource.id,
        prepare: ({ subjectId }) => prepared(subjectId, randomUUID(), completeFreeRequest),
        principal: { anonymousSessionToken: owner.token },
        request: completeFreeRequest,
      });
      assert.equal(completeFree.resource?.status, "completed");

      const competingPassInput = Object.freeze({
        ...passInput,
        prepare: ({ subjectId }: { subjectId: string }) =>
          prepared(subjectId, randomUUID(), passRequest),
      });
      const passRace = await Promise.allSettled([
        persistence.startSession(passInput),
        persistence.startSession(competingPassInput),
      ]);
      const paidResults = passRace.filter(
        (
          result,
        ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof persistence.startSession>>> =>
          result.status === "fulfilled",
      );
      const rejectedResults = passRace.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      assert.equal(paidResults.length, 1);
      assert.equal(rejectedResults.length, 1);
      assert.ok(rejectedResults[0]?.reason instanceof RitualJournalPersistenceError);
      assert.equal(
        (rejectedResults[0]?.reason as RitualJournalPersistenceError).code,
        "RITUAL_JOURNAL_ACCESS_REQUIRED",
      );
      const paidResult = paidResults[0];
      if (paidResult === undefined) assert.fail("Expected one consumed-pass session.");
      const paid = paidResult.value;
      assert.equal(paid.resource.status, "active");
      const consumed = await migrator.query<{
        ritualSessionId: string | null;
        status: string;
      }>(
        `SELECT status, ritual_session_id AS "ritualSessionId"
           FROM ritual_pass WHERE id = $1::uuid`,
        [passId],
      );
      assert.equal(consumed.rows[0]?.status, "consumed");
      assert.equal(consumed.rows[0]?.ritualSessionId, paid.resource.id);

      const completePaidRequest = Object.freeze({
        action: "complete" as const,
        currentStepCode: "complete" as const,
        elapsedSeconds: 45,
        expectedRevision: 1,
        schemaVersion: "ritual-session-mutation.v1" as const,
      });
      const completedPaid = await persistence.mutateSession({
        id: paid.resource.id,
        prepare: ({ subjectId }) => prepared(subjectId, randomUUID(), completePaidRequest),
        principal: { accountSessionToken: accountToken },
        request: completePaidRequest,
      });
      assert.equal(completedPaid.resource?.status, "completed");

      const permanentRequest = Object.freeze({
        intentionId: intention.intention.id,
        itemCode: "mindful_incense" as const,
        schemaVersion: "ritual-session.v2" as const,
      });
      const permanentSnapshot = Object.freeze({
        access: Object.freeze({
          kind: "permanent_entitlement" as const,
          requirementCode: "permanent-object.mindful_incense",
        }),
        catalogId: "rituvia-original-secular" as const,
        catalogVersion: "1.0.0",
        itemCode: "mindful_incense" as const,
        itemVersion: "1.0.0",
        publicationId: "rituvia-original.en.2026-07-23",
        schemaVersion: "ritual-session-snapshot.v1" as const,
        templateCode: "permanent-object-pause" as const,
        templateVersion: "1.0.0",
      });
      const permanentKey = randomUUID();
      const permanentInput = Object.freeze({
        prepare: ({ subjectId }: { subjectId: string }) =>
          prepared(subjectId, permanentKey, permanentRequest),
        principal: { accountSessionToken: accountToken },
        request: permanentRequest,
        snapshot: permanentSnapshot,
      });
      await expectRitualError(
        () => persistence.startSession(permanentInput),
        "RITUAL_JOURNAL_ACCESS_REQUIRED",
      );
      const permanentOrderLineId = randomUUID();
      await migrator.query(
        `INSERT INTO commerce_order_line (
           id, order_id, product_code, product_version, price_version,
           unit_amount_minor, total_minor, exact_contents_snapshot, entitlement_code
         ) VALUES (
           $1::uuid, $2::uuid, 'ritual.mindful_incense', '1.0.0', '1.0.0',
           200, 200, '["mindful incense"]'::jsonb, 'permanent-object.mindful_incense'
         )`,
        [permanentOrderLineId, orderId],
      );
      await migrator.query(
        `INSERT INTO entitlement (
           user_id, entitlement_code, source_order_line_id
         ) VALUES ($1::uuid, 'permanent-object.mindful_incense', $2::uuid)`,
        [userId, permanentOrderLineId],
      );
      const permanent = await persistence.startSession(permanentInput);
      assert.equal(permanent.resource.access.kind, "permanent_entitlement");

      const journalRequest = Object.freeze({
        intentionId: intention.intention.id,
        reflection: "private-journal-canary",
        ritualSessionId: paid.resource.id,
        schemaVersion: "private-journal.v2" as const,
      });
      const journalId = randomUUID();
      const journalKey = randomUUID();
      const journalInput = Object.freeze({
        prepare: ({ subjectId }: { resourceId: string; subjectId: string }) => ({
          ...prepared(subjectId, journalKey, journalRequest),
          encryptedReflection: journalCiphertext("encrypted-journal-v1"),
        }),
        principal: { accountSessionToken: accountToken },
        request: journalRequest,
        resourceId: journalId,
      });
      const journal = await persistence.createJournal(journalInput);
      assert.equal(journal.kind, "created");
      assert.equal((await persistence.createJournal(journalInput)).kind, "replayed");
      assert.equal(
        await persistence.getJournal({
          id: journalId,
          principal: { anonymousSessionToken: otherOwner.token },
        }),
        null,
      );

      const updateRequest = Object.freeze({
        action: "update" as const,
        expectedRevision: 1,
        reflection: "updated-private-journal-canary",
        schemaVersion: "private-journal-mutation.v1" as const,
      });
      const updated = await persistence.mutateJournal({
        id: journalId,
        prepare: ({ subjectId }) => ({
          ...prepared(subjectId, randomUUID(), updateRequest),
          encryptedReflection: journalCiphertext("encrypted-journal-v2"),
        }),
        principal: { accountSessionToken: accountToken },
        request: updateRequest,
      });
      assert.equal(updated.resource?.revision, 2);

      const deleteRequest = Object.freeze({
        action: "delete" as const,
        expectedRevision: 2,
        schemaVersion: "private-journal-mutation.v1" as const,
      });
      const deleted = await persistence.mutateJournal({
        id: journalId,
        prepare: ({ subjectId }) => prepared(subjectId, randomUUID(), deleteRequest),
        principal: { accountSessionToken: accountToken },
        request: deleteRequest,
      });
      assert.equal(deleted.resource, null);
      assert.equal(
        await persistence.getJournal({
          id: journalId,
          principal: { accountSessionToken: accountToken },
        }),
        null,
      );
      const storedJournal = await migrator.query<{
        ciphertext: Buffer;
        deletedAt: Date | null;
      }>(
        `SELECT reflection_ciphertext AS ciphertext, deleted_at AS "deletedAt"
           FROM private_journal_entry WHERE id = $1::uuid`,
        [journalId],
      );
      assert.ok(storedJournal.rows[0]?.deletedAt instanceof Date);
      assert.equal(
        storedJournal.rows[0]?.ciphertext.includes(Buffer.from(journalRequest.reflection)),
        false,
      );
    } finally {
      await Promise.all([runtime.$disconnect(), migrator.end()]);
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (primaryError === undefined && cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Ritual journal persistence cleanup failed.");
    }
  }
});

process.stdout.write(
  "Verified additive v2 ritual and journal persistence, exact snapshots, owner isolation, idempotent replay, lifecycle revisions, pass rollback/consumption atomicity, ciphertext storage, soft deletion, and least privilege.\n",
);
