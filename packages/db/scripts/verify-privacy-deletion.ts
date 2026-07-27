import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Client } from "pg";

import {
  AccountIdentityError,
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";
import { createAnonymousIdentityService } from "../src/anonymous-identity.js";
import { createDatabaseClient } from "../src/client.js";
import { createInterpretationGenerationPersistence } from "../src/interpretation-generation-persistence.js";
import { createPrivacyDeletionPersistence, PrivacyDeletionError } from "../src/privacy-deletion.js";
import { createPrivacyExportPersistence, PrivacyExportError } from "../src/privacy-export.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const anonymousPolicy = Object.freeze({
  issuanceLimit: 100,
  issuanceWindowSeconds: 60,
  policyVersion: "test.privacy-deletion-anonymous.v1",
  ttlSeconds: 86_400,
});
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
const deletionPolicy = Object.freeze({
  recentAuthenticationSeconds: 900,
  requestWindowSeconds: 3_600,
});
const exportPolicy = Object.freeze({
  artifactTtlSeconds: 900,
  encryptionKeyVersion: "privacy-export.v1",
  recentAuthenticationSeconds: 900,
  requestWindowSeconds: 3_600,
});
const interpretationFacts = Object.freeze({
  algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
  catalog: { id: "privacy-deletion", version: "1.0.0" },
  deck: { id: "rituvia.test-deck", version: "1.0.0" },
  engineName: "rituvia.tarot-draw",
  engineVersion: "1.0.0",
  method: "tarot",
  orientationPolicy: "upright_and_reversed",
  positions: [{ cardId: "lantern", order: 1, orientation: "upright", positionId: "perspective" }],
  replacementPolicy: "without_replacement",
  rulesVersion: "tarot-draw-rules.v1",
  schemaVersion: "tarot-draw-facts.v1",
  spread: { id: "one-card-perspective", version: "1.0.0" },
});
const interpretationOutput = Object.freeze({
  boundaryNote: "private interpretation canary",
  perspectives: ["private interpretation canary"],
  reflectionQuestions: ["private interpretation canary"],
  safety: {
    certaintyLevel: "reflective",
    containsGuaranteedOutcome: false,
    containsProfessionalAdvice: false,
  },
  schemaVersion: "1",
  smallAction: {
    label: "private interpretation canary",
    rationale: "private interpretation canary",
    timeHorizon: "today",
  },
  sourceRefs: ["test.source"],
  summary: "private interpretation canary",
  symbols: [],
  title: "private interpretation canary",
});

const bearer = (): string => randomBytes(32).toString("base64url");
const digest = (): Buffer => randomBytes(32);
const tokenHash = (value: string): Buffer =>
  createHash("sha256").update(Buffer.from(value, "base64url")).digest();

const expectDeletionError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected privacy deletion error ${code}.`);
  } catch (error) {
    assert(error instanceof PrivacyDeletionError, String(error));
    assert.equal(error.code, code);
  }
};

const expectAccountError = async (
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected account error ${code}.`);
  } catch (error) {
    assert(error instanceof AccountIdentityError, String(error));
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
      `Expected PostgreSQL ${code}, observed ${String(observed)}: ${String(error)}`,
    );
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
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const runtime = createDatabaseClient(database.databaseUrl);
    const deletionRuntime = createDatabaseClient(database.privacyDeletionDatabaseUrl);
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await migrator.connect();
    try {
      const accounts = createAccountIdentityService(runtime, accountPolicy);
      const anonymous = createAnonymousIdentityService(runtime, anonymousPolicy);
      const deletions = createPrivacyDeletionPersistence(deletionRuntime, deletionPolicy);
      const exports = createPrivacyExportPersistence(runtime, exportPolicy);
      const interpretations = createInterpretationGenerationPersistence(runtime, {
        leaseSeconds: 32,
      });
      const challengeId = randomUUID();
      const state = bearer();
      const token = bearer();
      const initialSessionToken = bearer();
      await accounts.createChallenge({
        challengeId,
        email: "owner-privacy-deletion@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state,
        token,
      });
      const completed = await accounts.consumeChallenge({
        challengeId,
        sessionToken: initialSessionToken,
        state,
        token,
      });
      const secondChallengeId = randomUUID();
      const secondState = bearer();
      const secondToken = bearer();
      const secondSessionToken = bearer();
      await accounts.createChallenge({
        challengeId: secondChallengeId,
        email: "owner-privacy-deletion@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state: secondState,
        token: secondToken,
      });
      await accounts.consumeChallenge({
        challengeId: secondChallengeId,
        sessionToken: secondSessionToken,
        state: secondState,
        token: secondToken,
      });
      const otherChallengeId = randomUUID();
      const otherState = bearer();
      const otherToken = bearer();
      await accounts.createChallenge({
        challengeId: otherChallengeId,
        email: "other-privacy-deletion@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state: otherState,
        token: otherToken,
      });
      const other = await accounts.consumeChallenge({
        challengeId: otherChallengeId,
        sessionToken: bearer(),
        state: otherState,
        token: otherToken,
      });
      await deletionRuntime.$transaction(async (transaction) => {
        await transaction.$queryRaw<Array<{ set_config: string }>>`
          SELECT set_config(
            'rituvia.privacy_deletion_token_hash',
            ${tokenHash(initialSessionToken).toString("hex")},
            true
          )
        `;
        const visibleAccounts = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM app_user ORDER BY id
        `;
        assert.deepEqual(visibleAccounts, [{ id: completed.context.userId }]);
        assert.equal(
          await transaction.$executeRaw`
            UPDATE app_user
               SET display_name = 'cross-user-write'
             WHERE id = ${other.context.userId}::uuid
          `,
          0,
        );
      });
      const anonymousOwner = await anonymous.ensureSession({ idempotencyKey: bearer() });
      assert.equal(anonymousOwner.kind, "created");
      if (anonymousOwner.kind !== "created") assert.fail("Expected anonymous owner.");

      const readingId = randomUUID();
      const intentionId = randomUUID();
      const activeExpiry = new Date(Date.now() + 86_400_000);
      const catalogChecksum = digest();
      const drawIdempotencyHash = digest();
      const drawRequestHash = digest();
      const originalCanary = Buffer.from("private-deletion-canary", "utf8");
      await migrator.query(
        `
          INSERT INTO reading (
            id, anonymous_subject_id, reading_type, theme_code, request_schema_version,
            reading_policy_version, catalog_id, catalog_version, catalog_checksum_sha256,
            catalog_approval_reference, idempotency_key_version, idempotency_key_hash,
            client_request_hash, created_at, completed_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, 'one_card', 'self', 'tarot-reading-create.v1',
            'privacy-deletion.v1', 'privacy-deletion', '1.0.0', $3,
            'RIT-054:privacy-deletion', 'privacy-deletion.v1', $4, $5,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6
          )
        `,
        [
          readingId,
          anonymousOwner.context.subjectId,
          catalogChecksum,
          digest(),
          digest(),
          activeExpiry,
        ],
      );
      await migrator.query(
        `
          INSERT INTO tarot_draw (
            reading_id, reading_type, idempotency_key_hash, draw_request_hash,
            catalog_id, catalog_version, execution_schema_version, integrity_scheme,
            integrity_key_version, entropy_commitment, entropy_bytes_consumed,
            entropy_rejected_samples, execution
          ) VALUES (
            $1::uuid, 'one_card', $2, $3, 'privacy-deletion', '1.0.0',
            'tarot-draw-execution.v1', 'hmac-sha256.tarot-reading.v1',
            'test.integrity.v1', $4, 2, 0, $5::jsonb
          )
        `,
        [
          readingId,
          drawIdempotencyHash,
          drawRequestHash,
          `sha256:${"11".repeat(32)}`,
          JSON.stringify({
            audit: {
              entropy: {
                bytesConsumed: 2,
                commitment: `sha256:${"11".repeat(32)}`,
                rejectedSamples: 0,
              },
              idempotencyKeyDigest: `sha256:${drawIdempotencyHash.toString("hex")}`,
              requestDigest: `sha256:${drawRequestHash.toString("hex")}`,
            },
            facts: interpretationFacts,
            schemaVersion: "tarot-draw-execution.v1",
          }),
        ],
      );
      await migrator.query(
        `
          INSERT INTO intention (
            id, anonymous_subject_id, reading_id, intention_code,
            small_action_ciphertext, small_action_nonce, small_action_tag,
            encryption_key_version, schema_version, policy_version,
            idempotency_key_hash, canonical_request_hash, created_at, updated_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, 'calm_clarity',
            $4, $5, $6,
            'private-content.v1', 'reflection-intention.v1', 'reflection-loop.en.v1',
            $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9
          )
        `,
        [
          intentionId,
          anonymousOwner.context.subjectId,
          readingId,
          originalCanary,
          randomBytes(12),
          randomBytes(16),
          digest(),
          digest(),
          activeExpiry,
        ],
      );
      const reference = (id: string, byte: string) => ({
        approvalReference: `OWN-TEST:${id}`,
        checksum: `sha256:${byte.repeat(32)}`,
        id,
        version: "1.0.0",
      });
      const generationClaim = await interpretations.claim({
        canonicalRequestDigest: `sha256:${"21".repeat(32)}`,
        generationSchemaVersion: "interpretation-generation.v1",
        idempotencyKeyDigest: `sha256:${"22".repeat(32)}`,
        idempotencyKeyVersion: "test.interpretation-idempotency.v1",
        provenance: {
          assemblyPolicyVersion: "tarot-prompt-assembly-policy.v1",
          attemptTimeoutMs: 500,
          contentVersions: ["1.0.0"],
          currencyCode: "USD",
          deterministicAlgorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
          deterministicEngineName: "rituvia.tarot-draw",
          deterministicEngineVersion: "1.0.0",
          deterministicRulesVersion: "tarot-draw-rules.v1",
          eligibilityAsOf: "2026-07-18",
          fallbackTemplate: reference("test.fallback", "31"),
          generationPolicyVersion: "test.interpretation-generation.v1",
          generationProvenance: {
            assemblyPolicyVersion: "tarot-prompt-assembly-policy.v1",
            content: {
              catalog: {
                approvalReference: "RIT-054:privacy-deletion",
                checksum: `sha256:${catalogChecksum.toString("hex")}`,
                id: "privacy-deletion",
                version: "1.0.0",
              },
            },
            deterministicEngine: {
              algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
              engineName: "rituvia.tarot-draw",
              engineVersion: "1.0.0",
              rulesVersion: "tarot-draw-rules.v1",
            },
            deterministicFacts: interpretationFacts,
            fallbackTemplate: reference("test.fallback", "31"),
            inputSchemaVersion: "tarot-interpretation-input.v1",
            locale: "en",
            modality: "tarot",
            outputSchema: {
              checksum: `sha256:${"32".repeat(32)}`,
              id: "tarot.interpretation-output",
              version: "1",
            },
            prompt: {
              ...reference("test.prompt", "33"),
              evaluationVersion: "test.prompt-eval.v1",
            },
            retrievalPolicyVersion: "tarot-content-retrieval-policy.v1",
            safetyPolicyVersion: "test.safety.v1",
            schemaVersion: "interpretation-generation-provenance.v1",
            themeCode: "self",
            tone: "grounded",
            tradition: "test.tarot",
          },
          locale: "en",
          maxAttempts: 2,
          maxOutputTokens: 800,
          maximumEstimatedCostMicros: 100_000,
          modality: "tarot",
          model: { id: "test.model", version: "1.0.0" },
          outputSchemaVersion: "1",
          prompt: reference("test.prompt", "33"),
          provider: {
            approvalReference: "OWN-TEST:provider",
            id: "test.provider",
            version: "1.0.0",
          },
          readingType: "one_card",
          retrievalPolicyVersion: "tarot-content-retrieval-policy.v1",
          retryDelayMs: 50,
          safetyPolicyVersion: "test.safety.v1",
          themeCode: "self",
          tone: "grounded",
          totalTimeoutMs: 1_000,
          verificationTimeoutMs: 500,
        },
        readingId,
        requestId: randomUUID(),
        token: anonymousOwner.token,
      });
      assert.equal(generationClaim.kind, "claimed");
      if (generationClaim.kind !== "claimed") assert.fail("Expected interpretation claim.");
      const finalizedInterpretation = await interpretations.finalize({
        claimToken: generationClaim.claimToken,
        claimVersion: generationClaim.claimVersion,
        completion: {
          operational: {
            attemptCount: 0,
            costStatus: "unavailable",
            currencyCode: null,
            estimatedCostMicros: null,
            failureCode: "aborted",
            inputTokens: null,
            latencyMs: 0,
            outputTokens: null,
            retryReason: null,
            tokenStatus: "unavailable",
            totalTokens: null,
          },
          output: interpretationOutput,
          status: "fallback",
        },
        completionDigest: `sha256:${"34".repeat(32)}`,
        interpretationId: generationClaim.interpretationId,
        token: anonymousOwner.token,
      });
      assert.equal(finalizedInterpretation.interpretation.status, "fallback");
      assert(finalizedInterpretation.interpretation.output !== null);
      assert.equal(finalizedInterpretation.interpretation.id, generationClaim.interpretationId);
      const runtimeInterpretations = await runtime.$queryRaw<
        Array<{ databaseName: string; id: string; schemaName: string }>
      >`
        SELECT current_database() AS "databaseName", current_schema() AS "schemaName", id
          FROM interpretation
         WHERE id = ${generationClaim.interpretationId}::uuid
      `;
      assert.equal(runtimeInterpretations.length, 1);

      const merged = await accounts.mergeAnonymousSubject({
        accountSessionToken: initialSessionToken,
        anonymousSessionToken: anonymousOwner.token,
        idempotencyKey: bearer(),
      });
      const revisitId = randomUUID();
      await migrator.query(
        `
          INSERT INTO revisit (
            id, anonymous_subject_id, intention_id, schema_version, policy_version,
            intention_revision, intention_text_ciphertext, intention_text_nonce,
            intention_text_tag, small_action_ciphertext, small_action_nonce,
            small_action_tag, snapshot_key_version, schedule_kind,
            scheduled_local_date, time_zone, reminder_preference, reminder_channel,
            status, revision, updated_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, 'reflection-revisit.v1',
            'reflection-loop.en.v1', 1, $4, $5, $6, $7, $8, $9,
            'private-content.v1', 'next_day', CURRENT_DATE + 1, 'UTC',
            'none', NULL, 'scheduled', 1, CURRENT_TIMESTAMP, $10
          )
        `,
        [
          revisitId,
          anonymousOwner.context.subjectId,
          intentionId,
          originalCanary,
          randomBytes(12),
          randomBytes(16),
          originalCanary,
          randomBytes(12),
          randomBytes(16),
          activeExpiry,
        ],
      );
      const reminderId = randomUUID();
      await migrator.query(
        `
          INSERT INTO revisit_reminder_subscription (
            id, user_id, account_subject_link_id, anonymous_subject_id, revisit_id,
            recipient_identity_id, schema_version, notice_version, channel,
            frequency, locale, preference_state, delivery_state, attempt_count,
            max_attempts, next_attempt_at, updated_at
          )
          SELECT $1::uuid, $2::uuid, link.id, $3::uuid, $4::uuid, $5::uuid,
                 'revisit-reminder-preference.v1',
                 'rituvia.revisit-reminder-notice.v1', 'email', 'once', 'en',
                 'subscribed', 'pending', 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM account_subject_link AS link
           WHERE link.user_id = $2::uuid
             AND link.anonymous_subject_id = $3::uuid
        `,
        [
          reminderId,
          completed.context.userId,
          anonymousOwner.context.subjectId,
          revisitId,
          completed.context.authIdentityId,
        ],
      );
      const linkedInterpretation = await runtime.$queryRaw<
        Array<{
          fallback_present: boolean;
          linked: boolean;
        }>
      >`
          SELECT interpretation.fallback_output IS NOT NULL AS fallback_present,
                 link.anonymous_subject_id IS NOT NULL AS linked
            FROM interpretation
            LEFT JOIN account_subject_link AS link
              ON link.anonymous_subject_id = interpretation.anonymous_subject_id
           WHERE interpretation.reading_id = ${readingId}::uuid
      `;
      assert.deepEqual(linkedInterpretation, [{ fallback_present: true, linked: true }]);
      const exportId = randomUUID();
      await migrator.query(
        `
          INSERT INTO privacy_export (
            id, user_id, requested_by_session_id, schema_version,
            encryption_key_version, idempotency_key_hash, canonical_request_hash,
            created_at, expires_at
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, 'privacy-export-package.v2',
            'privacy-export.v1', $4, $5, CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '15 minutes'
          )
        `,
        [exportId, completed.context.userId, merged.context.sessionId, digest(), digest()],
      );
      await migrator.query(
        `
          INSERT INTO privacy_export_artifact (
            export_id, user_id, ciphertext, nonce, authentication_tag,
            plaintext_sha256, plaintext_bytes, record_count
          ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 32, 1)
        `,
        [
          exportId,
          completed.context.userId,
          randomBytes(32),
          randomBytes(12),
          randomBytes(16),
          digest(),
        ],
      );

      const birthProfileId = randomUUID();
      await migrator.query(
        `
          INSERT INTO birth_profile (
            id, user_id, time_certainty, schema_version,
            payload_ciphertext, payload_nonce, payload_tag,
            encryption_key_version, digest_key_version, canonical_payload_digest
          ) VALUES (
            $1::uuid, $2::uuid, 'exact', 'birth-profile.v1',
            $3, $4, $5, 'private-content.v1', 'private-content.v1', $6
          )
        `,
        [
          birthProfileId,
          completed.context.userId,
          Buffer.from("private-birth-profile-canary", "utf8"),
          randomBytes(12),
          randomBytes(16),
          digest(),
        ],
      );

      const concurrentSelective = await Promise.allSettled([
        deletions.request({
          idempotencyKey: "p".repeat(22),
          scope: "private_content",
          sessionToken: merged.sessionToken,
        }),
        deletions.request({
          idempotencyKey: "q".repeat(22),
          scope: "private_content",
          sessionToken: secondSessionToken,
        }),
      ]);
      const successfulIndex = concurrentSelective.findIndex(({ status }) => status === "fulfilled");
      assert.notEqual(successfulIndex, -1);
      assert.equal(concurrentSelective.filter(({ status }) => status === "fulfilled").length, 1);
      const rejected = concurrentSelective.find(({ status }) => status === "rejected");
      assert(rejected?.status === "rejected");
      assert(rejected.reason instanceof PrivacyDeletionError);
      assert.equal(rejected.reason.code, "PRIVACY_DELETION_RATE_LIMITED");
      const successful = concurrentSelective[successfulIndex];
      assert(successful?.status === "fulfilled");
      const selective = successful.value;
      const selectiveKey = successfulIndex === 0 ? "p".repeat(22) : "q".repeat(22);
      const selectiveSessionToken =
        successfulIndex === 0 ? merged.sessionToken : secondSessionToken;
      assert.equal(selective.status, "completed");
      assert.deepEqual(selective.counts, {
        accountSessions: 0,
        astrologyCalculations: 0,
        authIdentities: 0,
        birthProfiles: 1,
        currentJournals: 0,
        exportArtifacts: 1,
        intentions: 1,
        interpretations: 1,
        legacyJournals: 0,
        passkeys: 0,
        revisits: 1,
        subjects: 1,
        verifications: 0,
      });
      const deletedBirthProfile = await migrator.query<{
        encryption_key_version: string;
        deleted_at: Date | null;
        payload_ciphertext: Buffer;
      }>(
        `
          SELECT encryption_key_version, deleted_at, payload_ciphertext
            FROM birth_profile
           WHERE id = $1::uuid
        `,
        [birthProfileId],
      );
      assert.equal(deletedBirthProfile.rows[0]?.encryption_key_version, "privacy-deleted.v1");
      assert(deletedBirthProfile.rows[0]?.deleted_at instanceof Date);
      assert.equal(
        deletedBirthProfile.rows[0]?.payload_ciphertext.includes(
          Buffer.from("private-birth-profile-canary", "utf8"),
        ),
        false,
      );
      assert.equal(
        (
          await deletions.request({
            idempotencyKey: selectiveKey,
            scope: "private_content",
            sessionToken: selectiveSessionToken,
          })
        ).id,
        selective.id,
      );
      await expectDeletionError(
        () =>
          deletions.request({
            idempotencyKey: selectiveKey,
            scope: "account",
            sessionToken: selectiveSessionToken,
          }),
        "PRIVACY_DELETION_CONFLICT",
      );

      assert((await accounts.resolveSession(merged.sessionToken)) !== null);
      assert.deepEqual(
        await accounts.listHistory({ limit: 10, sessionToken: merged.sessionToken }),
        { items: [], nextCursor: null },
      );
      const privateState = await migrator.query<{
        encryption_key_version: string;
        privacy_deleted_at: Date | null;
        small_action_ciphertext: Buffer;
      }>(
        `
          SELECT intention.encryption_key_version, intention.small_action_ciphertext,
                 link.privacy_deleted_at
            FROM intention
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = intention.anonymous_subject_id
           WHERE intention.id = $1::uuid
        `,
        [intentionId],
      );
      assert.equal(privateState.rows[0]?.encryption_key_version, "privacy-deleted.v1");
      assert(privateState.rows[0]?.privacy_deleted_at instanceof Date);
      assert.notDeepEqual(privateState.rows[0]?.small_action_ciphertext, originalCanary);
      const reminderState = await migrator.query<{
        delivery_state: string;
        lease_token_hash: Buffer | null;
        preference_state: string;
      }>(
        `
          SELECT preference_state, delivery_state, lease_token_hash
            FROM revisit_reminder_subscription
           WHERE id = $1::uuid
        `,
        [reminderId],
      );
      assert.deepEqual(reminderState.rows[0], {
        delivery_state: "cancelled",
        lease_token_hash: null,
        preference_state: "unsubscribed",
      });
      const deletedInterpretation = await runtime.$queryRaw<Array<{ fallback_output: unknown }>>`
        SELECT fallback_output
          FROM interpretation
         WHERE reading_id = ${readingId}::uuid
      `;
      assert.equal(
        JSON.stringify(deletedInterpretation[0]?.fallback_output).includes("canary"),
        false,
      );
      assert.equal(
        (
          await migrator.query("SELECT 1 FROM privacy_export_artifact WHERE export_id = $1::uuid", [
            exportId,
          ])
        ).rowCount,
        0,
      );
      try {
        await exports.complete({
          authenticationTag: randomBytes(16),
          ciphertext: randomBytes(32),
          exportId,
          nonce: randomBytes(12),
          plaintextBytes: 32,
          plaintextSha256: digest(),
          recordCount: 1,
          userId: completed.context.userId,
        });
        assert.fail("A pre-deletion export must not finalize after deletion.");
      } catch (error) {
        assert(error instanceof PrivacyExportError, String(error));
        assert.equal(error.code, "PRIVACY_EXPORT_CONFLICT");
      }

      const account = await deletions.request({
        idempotencyKey: "a".repeat(22),
        scope: "account",
        sessionToken: merged.sessionToken,
      });
      assert.equal(account.counts.subjects, 0);
      assert(account.counts.accountSessions >= 2);
      assert.equal(account.counts.authIdentities, 1);
      assert.equal(
        (
          await deletions.request({
            idempotencyKey: "a".repeat(22),
            scope: "account",
            sessionToken: merged.sessionToken,
          })
        ).id,
        account.id,
        "a dropped account-deletion response must be replayable without restoring the session",
      );
      assert.equal(await accounts.resolveSession(merged.sessionToken), null);
      await expectAccountError(
        () => accounts.getProfile(merged.sessionToken),
        "ACCOUNT_SESSION_UNAVAILABLE",
      );
      const deletedAccount = await migrator.query<{
        challenge_key_version: string;
        identity_key_version: string;
        status: string;
      }>(
        `
          SELECT account.status,
                 identity.encryption_key_version AS identity_key_version,
                 challenge.encryption_key_version AS challenge_key_version
            FROM app_user AS account
            JOIN auth_identity AS identity ON identity.user_id = account.id
            JOIN auth_challenge AS challenge ON challenge.id = $2::uuid
           WHERE account.id = $1::uuid
        `,
        [completed.context.userId, challengeId],
      );
      assert.deepEqual(deletedAccount.rows[0], {
        challenge_key_version: "privacy-deleted.v1",
        identity_key_version: "privacy-deleted.v1",
        status: "deleted",
      });
      const reauthenticationChallengeId = randomUUID();
      const reauthenticationState = bearer();
      const reauthenticationToken = bearer();
      await accounts.createChallenge({
        challengeId: reauthenticationChallengeId,
        email: "owner-privacy-deletion@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state: reauthenticationState,
        token: reauthenticationToken,
      });
      await expectAccountError(
        () =>
          accounts.consumeChallenge({
            challengeId: reauthenticationChallengeId,
            sessionToken: bearer(),
            state: reauthenticationState,
            token: reauthenticationToken,
          }),
        "ACCOUNT_DISABLED",
      );
      assert.equal(
        (
          await migrator.query("SELECT 1 FROM auth_identity_suppression WHERE user_id = $1::uuid", [
            completed.context.userId,
          ])
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await migrator.query(
            `
              SELECT COUNT(*)::int AS count
                FROM privacy_deletion_request AS request
                JOIN privacy_deletion_completion AS completion
                  ON completion.request_id = request.id
               WHERE request.user_id = $1::uuid
            `,
            [completed.context.userId],
          )
        ).rows[0]?.count,
        2,
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`UPDATE privacy_deletion_request
                                SET scope = 'account'
                              WHERE id = ${selective.id}::uuid`,
        "42501",
      );
      await expectPostgresError(
        () =>
          runtime.$executeRaw`DELETE FROM privacy_deletion_completion
                               WHERE request_id = ${selective.id}::uuid`,
        "42501",
      );
      assert.equal(
        (
          await migrator.query(
            "SELECT revoked_at IS NOT NULL AS revoked FROM account_session WHERE token_hash = $1",
            [tokenHash(initialSessionToken)],
          )
        ).rowCount,
        0,
        "account deletion replaces stored session token hashes",
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredRuntime = createDatabaseClient(restored.databaseUrl);
      const restoredDeletionRuntime = createDatabaseClient(restored.privacyDeletionDatabaseUrl);
      try {
        const restoredDeletion = createPrivacyDeletionPersistence(
          restoredDeletionRuntime,
          deletionPolicy,
        );
        assert.equal(
          (
            await restoredDeletion.request({
              idempotencyKey: "a".repeat(22),
              scope: "account",
              sessionToken: merged.sessionToken,
            })
          ).id,
          account.id,
        );
        const restoredPrivateState = await restoredRuntime.$queryRaw<
          Array<{ encryption_key_version: string; fallback_output: unknown }>
        >`
          SELECT intention.encryption_key_version,
                 interpretation.fallback_output
            FROM intention
            JOIN interpretation
              ON interpretation.reading_id = intention.reading_id
           WHERE intention.id = ${intentionId}::uuid
        `;
        assert.equal(restoredPrivateState[0]?.encryption_key_version, "privacy-deleted.v1");
        assert.equal(
          JSON.stringify(restoredPrivateState[0]?.fallback_output).includes("canary"),
          false,
        );
      } finally {
        await Promise.all([restoredDeletionRuntime.$disconnect(), restoredRuntime.$disconnect()]);
      }

      await deletionRuntime.$disconnect();
      await runtime.$disconnect();
    } finally {
      await migrator.end();
    }
  } catch (error) {
    primaryError = error;
  } finally {
    for (const database of databases.reverse()) {
      await database.drop().catch((error: unknown) => {
        if (primaryError === undefined) primaryError = error;
      });
    }
    await stopLeaseOwnedRuntime(lease).catch((error: unknown) => {
      if (primaryError === undefined) primaryError = error;
    });
  }
  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified selective private-content deletion, account deletion, session revocation, ciphertext destruction, lawful-record retention, idempotency, restore, and least privilege.\n",
);
