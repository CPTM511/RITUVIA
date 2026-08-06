import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const deletionPolicyVersion = "privacy-deletion.local.v1" as const;
const deletedKeyVersion = "privacy-deleted.v1";
const retentionCategories = Object.freeze([
  "derived_reflection_metadata",
  "consent_history",
  "commerce_financial",
  "security_privacy_audit",
] as const);
const deletedInterpretationOutput = Object.freeze({
  boundaryNote: "Private interpretation deleted.",
  perspectives: ["Private interpretation deleted."],
  reflectionQuestions: ["Private interpretation deleted."],
  safety: {
    certaintyLevel: "reflective",
    containsGuaranteedOutcome: false,
    containsProfessionalAdvice: false,
  },
  schemaVersion: "1",
  smallAction: {
    label: "Private interpretation deleted.",
    rationale: "Private interpretation deleted.",
    timeHorizon: "open",
  },
  sourceRefs: ["privacy-deleted"],
  summary: "Private interpretation deleted.",
  symbols: [
    {
      factRef: "privacy-deleted",
      meaning: "Private interpretation deleted.",
      possibility: "Private interpretation deleted.",
    },
  ],
  title: "Private interpretation deleted",
});

export const privacyDeletionScopes = Object.freeze(["private_content", "account"] as const);
export type PrivacyDeletionScope = (typeof privacyDeletionScopes)[number];

export const privacyDeletionErrorCodes = Object.freeze([
  "PRIVACY_DELETION_SESSION_UNAVAILABLE",
  "PRIVACY_DELETION_RECENT_AUTH_REQUIRED",
  "PRIVACY_DELETION_INVALID",
  "PRIVACY_DELETION_CONFLICT",
  "PRIVACY_DELETION_RATE_LIMITED",
  "PRIVACY_DELETION_UNAVAILABLE",
] as const);

export type PrivacyDeletionErrorCode = (typeof privacyDeletionErrorCodes)[number];

export class PrivacyDeletionError extends Error {
  readonly code: PrivacyDeletionErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: PrivacyDeletionErrorCode, retryAfterSeconds?: number) {
    super("The privacy deletion operation is unavailable.");
    this.name = "PrivacyDeletionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type PrivacyDeletionPolicy = Readonly<{
  recentAuthenticationSeconds: number;
  requestWindowSeconds: number;
}>;

export type PrivacyDeletionCounts = Readonly<{
  accountSessions: number;
  astrologyCalculations: number;
  authIdentities: number;
  birthProfiles: number;
  currentJournals: number;
  exportArtifacts: number;
  intentions: number;
  interpretations: number;
  legacyJournals: number;
  passkeys: number;
  revisits: number;
  subjects: number;
  verifications: number;
  wallets: number;
}>;

export type PrivacyDeletionResult = Readonly<{
  completedAt: string;
  counts: PrivacyDeletionCounts;
  id: string;
  policyVersion: typeof deletionPolicyVersion;
  requestedAt: string;
  retentionCategories: typeof retentionCategories;
  scope: PrivacyDeletionScope;
  status: "completed";
}>;

export type PrivacyDeletionPersistence = Readonly<{
  request(input: {
    idempotencyKey: string;
    scope: PrivacyDeletionScope;
    sessionToken: string;
  }): Promise<PrivacyDeletionResult>;
}>;

type ActiveSession = Readonly<{
  authenticatedAt: Date | null;
  sessionId: string;
  userId: string;
}>;

type DeletionRow = Readonly<{
  accountSessionCount: number;
  astrologyCalculationCount: number;
  authIdentityCount: number;
  birthProfileCount: number;
  canonicalRequestHash: Uint8Array;
  completedAt: Date;
  currentJournalCount: number;
  exportArtifactCount: number;
  id: string;
  intentionCount: number;
  interpretationCount: number;
  legacyJournalCount: number;
  passkeyCount: number;
  policyVersion: string;
  requestedAt: Date;
  retentionCategories: string[];
  revisitCount: number;
  scope: string;
  subjectCount: number;
  verificationCount: number;
  walletIdentityCount: number;
}>;

const validatePolicy = (policy: PrivacyDeletionPolicy): PrivacyDeletionPolicy => {
  if (
    !Number.isSafeInteger(policy.recentAuthenticationSeconds) ||
    policy.recentAuthenticationSeconds < 60 ||
    policy.recentAuthenticationSeconds > 86_400 ||
    !Number.isSafeInteger(policy.requestWindowSeconds) ||
    policy.requestWindowSeconds < 60 ||
    policy.requestWindowSeconds > 604_800
  ) {
    throw new TypeError("Privacy deletion policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const digest = async (value: string | Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(source)));
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left.at(index)! ^ right.at(index)!;
  }
  return difference === 0;
};

const parseSessionToken = (value: string): Uint8Array => {
  if (!opaqueTokenPattern.test(value)) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_SESSION_UNAVAILABLE");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== value) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_SESSION_UNAVAILABLE");
  }
  return Uint8Array.from(bytes);
};

const parseIdempotencyKey = (value: string): string => {
  if (!idempotencyKeyPattern.test(value)) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_INVALID");
  }
  return value;
};

const parseScope = (value: PrivacyDeletionScope): PrivacyDeletionScope => {
  if (!privacyDeletionScopes.includes(value)) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_INVALID");
  }
  return value;
};

const findActiveSession = async (
  transaction: Prisma.TransactionClient,
  tokenHash: Uint8Array,
): Promise<ActiveSession | null> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    SELECT session.id AS "sessionId", session.user_id AS "userId",
           session.authenticated_at AS "authenticatedAt"
      FROM account_session AS session
      JOIN app_user ON app_user.id = session.user_id
     WHERE session.token_hash = ${tokenHash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND app_user.id = session.user_id
       AND app_user.status = 'active'
  `;
  if (rows.length > 1) throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
  return rows[0] ?? null;
};

const touchActiveSession = async (
  transaction: Prisma.TransactionClient,
  active: ActiveSession,
  tokenHash: Uint8Array,
): Promise<ActiveSession | null> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    UPDATE account_session AS session
       SET last_seen_at = LEAST(CURRENT_TIMESTAMP, session.expires_at)
      FROM app_user
     WHERE session.id = ${active.sessionId}::uuid
       AND session.user_id = ${active.userId}::uuid
       AND session.token_hash = ${tokenHash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND app_user.id = session.user_id
       AND app_user.status = 'active'
     RETURNING session.id AS "sessionId", session.user_id AS "userId",
               session.authenticated_at AS "authenticatedAt"
  `;
  if (rows.length > 1) throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
  return rows[0] ?? null;
};

const assertRecentAuthentication = (
  active: ActiveSession,
  now: Date,
  policy: PrivacyDeletionPolicy,
): void => {
  if (
    active.authenticatedAt === null ||
    active.authenticatedAt.getTime() < now.getTime() - policy.recentAuthenticationSeconds * 1_000
  ) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_RECENT_AUTH_REQUIRED");
  }
};

const canonicalRequest = (scope: PrivacyDeletionScope): string =>
  JSON.stringify({
    operation: "privacy.deletion.request.v1",
    policyVersion: deletionPolicyVersion,
    scope,
  });

const readDeletion = async (
  transaction: Prisma.TransactionClient,
  idempotencyKeyHash: Uint8Array,
  ownership: Prisma.Sql,
): Promise<DeletionRow | null> => {
  const rows = await transaction.$queryRaw<DeletionRow[]>`
    SELECT request.id, request.scope, request.policy_version AS "policyVersion",
           request.canonical_request_hash AS "canonicalRequestHash",
           request.retention_categories AS "retentionCategories",
           request.requested_at AS "requestedAt",
           completion.subject_count AS "subjectCount",
           completion.intention_count AS "intentionCount",
           completion.legacy_journal_count AS "legacyJournalCount",
           completion.current_journal_count AS "currentJournalCount",
           completion.revisit_count AS "revisitCount",
           completion.interpretation_count AS "interpretationCount",
           completion.verification_count AS "verificationCount",
           completion.export_artifact_count AS "exportArtifactCount",
           completion.auth_identity_count AS "authIdentityCount",
           completion.account_session_count AS "accountSessionCount",
           completion.passkey_count AS "passkeyCount",
           completion.wallet_identity_count AS "walletIdentityCount",
           completion.birth_profile_count AS "birthProfileCount",
           completion.astrology_calculation_count AS "astrologyCalculationCount",
           completion.completed_at AS "completedAt"
      FROM privacy_deletion_request AS request
      JOIN privacy_deletion_completion AS completion
        ON completion.request_id = request.id AND completion.user_id = request.user_id
     WHERE request.idempotency_key_hash = ${idempotencyKeyHash}
       AND ${ownership}
  `;
  if (rows.length > 1) throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
  return rows[0] ?? null;
};

const result = (row: DeletionRow): PrivacyDeletionResult => {
  if (
    row.policyVersion !== deletionPolicyVersion ||
    !privacyDeletionScopes.includes(row.scope as PrivacyDeletionScope) ||
    row.retentionCategories.join("\u0000") !== retentionCategories.join("\u0000")
  ) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
  }
  return Object.freeze({
    completedAt: row.completedAt.toISOString(),
    counts: Object.freeze({
      accountSessions: row.accountSessionCount,
      astrologyCalculations: row.astrologyCalculationCount,
      authIdentities: row.authIdentityCount,
      birthProfiles: row.birthProfileCount,
      currentJournals: row.currentJournalCount,
      exportArtifacts: row.exportArtifactCount,
      intentions: row.intentionCount,
      interpretations: row.interpretationCount,
      legacyJournals: row.legacyJournalCount,
      passkeys: row.passkeyCount,
      revisits: row.revisitCount,
      subjects: row.subjectCount,
      verifications: row.verificationCount,
      wallets: row.walletIdentityCount,
    }),
    id: row.id,
    policyVersion: deletionPolicyVersion,
    requestedAt: row.requestedAt.toISOString(),
    retentionCategories,
    scope: row.scope as PrivacyDeletionScope,
    status: "completed" as const,
  });
};

const countRows = async (
  transaction: Prisma.TransactionClient,
  query: Prisma.Sql,
): Promise<number> => {
  const rows = await transaction.$queryRaw<Array<{ count: bigint }>>(query);
  const count = rows[0]?.count;
  if (rows.length !== 1 || count === undefined || count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
  }
  return Number(count);
};

export const createPrivacyDeletionPersistence = (
  database: PrismaClient,
  rawPolicy: PrivacyDeletionPolicy,
): PrivacyDeletionPersistence => {
  const policy = validatePolicy(rawPolicy);

  const request: PrivacyDeletionPersistence["request"] = async (input) => {
    const scope = parseScope(input.scope);
    const [idempotencyKeyHash, canonicalRequestHash, replaySessionTokenHash] = await Promise.all([
      digest(parseIdempotencyKey(input.idempotencyKey)),
      digest(canonicalRequest(scope)),
      digest(parseSessionToken(input.sessionToken)),
    ]);
    try {
      return await database.$transaction(async (transaction) => {
        await transaction.$queryRaw<Array<{ set_config: string }>>`
          SELECT set_config(
            'rituvia.privacy_deletion_token_hash',
            ${Buffer.from(replaySessionTokenHash).toString("hex")},
            true
          )
        `;
        const tokenReplay = await readDeletion(
          transaction,
          idempotencyKeyHash,
          Prisma.sql`request.replay_session_token_hash = ${replaySessionTokenHash}::bytea`,
        );
        if (tokenReplay !== null) {
          if (!bytesEqual(tokenReplay.canonicalRequestHash, canonicalRequestHash)) {
            throw new PrivacyDeletionError("PRIVACY_DELETION_CONFLICT");
          }
          return result(tokenReplay);
        }
        const candidate = await findActiveSession(transaction, replaySessionTokenHash);
        if (candidate === null) {
          throw new PrivacyDeletionError("PRIVACY_DELETION_SESSION_UNAVAILABLE");
        }
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${candidate.userId}, 54054))
        `;
        const active = await touchActiveSession(transaction, candidate, replaySessionTokenHash);
        if (active === null) {
          throw new PrivacyDeletionError("PRIVACY_DELETION_SESSION_UNAVAILABLE");
        }
        const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
        const now = clocks[0]?.now;
        if (now === undefined) throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
        assertRecentAuthentication(active, now, policy);
        const replay = await readDeletion(
          transaction,
          idempotencyKeyHash,
          Prisma.sql`request.user_id = ${active.userId}::uuid`,
        );
        if (replay !== null) {
          if (!bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)) {
            throw new PrivacyDeletionError("PRIVACY_DELETION_CONFLICT");
          }
          return result(replay);
        }

        const recent = await transaction.$queryRaw<Array<{ retryAfterSeconds: number }>>`
          SELECT GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (
              MAX(requested_at) + make_interval(secs => ${policy.requestWindowSeconds})
              - CURRENT_TIMESTAMP
            )))::integer
          ) AS "retryAfterSeconds"
            FROM privacy_deletion_request
           WHERE user_id = ${active.userId}::uuid
             AND scope = ${scope}
             AND requested_at >
                 CURRENT_TIMESTAMP - make_interval(secs => ${policy.requestWindowSeconds})
          HAVING COUNT(*) > 0
        `;
        if (recent[0] !== undefined) {
          throw new PrivacyDeletionError(
            "PRIVACY_DELETION_RATE_LIMITED",
            recent[0].retryAfterSeconds,
          );
        }

        const requestId = globalThis.crypto.randomUUID();
        const tombstoneCiphertext = globalThis.crypto.getRandomValues(new Uint8Array(32));
        const tombstoneNonce = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const tombstoneTag = globalThis.crypto.getRandomValues(new Uint8Array(16));
        const tombstoneSalt = globalThis.crypto.randomUUID();
        const inserted = await transaction.$queryRaw<Array<{ requestedAt: Date }>>`
          INSERT INTO privacy_deletion_request (
            id, user_id, requested_by_session_id, scope, policy_version,
            idempotency_key_hash, canonical_request_hash, replay_session_token_hash,
            retention_categories, requested_at
          ) VALUES (
            ${requestId}::uuid, ${active.userId}::uuid, ${active.sessionId}::uuid,
            ${scope}, ${deletionPolicyVersion}, ${idempotencyKeyHash},
            ${canonicalRequestHash}, ${replaySessionTokenHash}::bytea,
            ${[...retentionCategories]}::text[], CURRENT_TIMESTAMP
          )
          RETURNING requested_at AS "requestedAt"
        `;
        const requestedAt = inserted[0]?.requestedAt;
        if (inserted.length !== 1 || requestedAt === undefined) {
          throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
        }

        const subjectCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE account_subject_link
                 SET privacy_deleted_at = CURRENT_TIMESTAMP,
                     privacy_deletion_request_id = ${requestId}::uuid
               WHERE user_id = ${active.userId}::uuid
                 AND privacy_deleted_at IS NULL
               RETURNING anonymous_subject_id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        await transaction.$executeRaw`
          UPDATE revisit_reminder_subscription AS subscription
             SET preference_state = 'unsubscribed',
                 delivery_state = 'cancelled',
                 next_attempt_at = CURRENT_TIMESTAMP,
                 lease_token_hash = NULL,
                 leased_until = NULL,
                 last_failure_code = NULL,
                 provider_message_reference = NULL,
                 updated_at = CURRENT_TIMESTAMP,
                 delivered_at = NULL,
                 unsubscribed_at = CURRENT_TIMESTAMP,
                 dead_lettered_at = NULL
           WHERE subscription.user_id = ${active.userId}::uuid
        `;

        await transaction.$executeRaw`
          UPDATE anonymous_session AS session
             SET revoked_at = COALESCE(
               session.revoked_at,
               LEAST(CURRENT_TIMESTAMP, session.expires_at)
             )
            FROM account_subject_link AS link
           WHERE link.privacy_deletion_request_id = ${requestId}::uuid
             AND link.anonymous_subject_id = session.anonymous_subject_id
        `;

        const intentionCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE intention
                 SET intention_text_ciphertext = CASE
                       WHEN intention_text_ciphertext IS NULL THEN NULL
                       ELSE ${tombstoneCiphertext}::bytea
                     END,
                     intention_text_nonce = CASE
                       WHEN intention_text_nonce IS NULL THEN NULL
                       ELSE ${tombstoneNonce}::bytea
                     END,
                     intention_text_tag = CASE
                       WHEN intention_text_tag IS NULL THEN NULL
                       ELSE ${tombstoneTag}::bytea
                     END,
                     small_action_ciphertext = ${tombstoneCiphertext}::bytea,
                     small_action_nonce = ${tombstoneNonce}::bytea,
                     small_action_tag = ${tombstoneTag}::bytea,
                     encryption_key_version = ${deletedKeyVersion}
                FROM account_subject_link AS link
               WHERE link.privacy_deletion_request_id = ${requestId}::uuid
                 AND link.anonymous_subject_id = intention.anonymous_subject_id
               RETURNING intention.id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const legacyJournalCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE journal_entry AS journal
                 SET reflection_ciphertext = ${tombstoneCiphertext}::bytea,
                     reflection_nonce = ${tombstoneNonce}::bytea,
                     reflection_tag = ${tombstoneTag}::bytea,
                     encryption_key_version = ${deletedKeyVersion}
                FROM account_subject_link AS link
               WHERE link.privacy_deletion_request_id = ${requestId}::uuid
                 AND link.anonymous_subject_id = journal.anonymous_subject_id
               RETURNING journal.id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const currentJournalCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE private_journal_entry AS journal
                 SET reflection_ciphertext = ${tombstoneCiphertext}::bytea,
                     reflection_nonce = ${tombstoneNonce}::bytea,
                     reflection_tag = ${tombstoneTag}::bytea,
                     encryption_key_version = ${deletedKeyVersion}
                FROM account_subject_link AS link
               WHERE link.privacy_deletion_request_id = ${requestId}::uuid
                 AND link.anonymous_subject_id = journal.anonymous_subject_id
               RETURNING journal.id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const revisitCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE revisit
                 SET intention_text_ciphertext = ${tombstoneCiphertext}::bytea,
                     intention_text_nonce = ${tombstoneNonce}::bytea,
                     intention_text_tag = ${tombstoneTag}::bytea,
                     small_action_ciphertext = ${tombstoneCiphertext}::bytea,
                     small_action_nonce = ${tombstoneNonce}::bytea,
                     small_action_tag = ${tombstoneTag}::bytea,
                     snapshot_key_version = ${deletedKeyVersion},
                     completion_ciphertext = CASE
                       WHEN completion_ciphertext IS NULL THEN NULL
                       ELSE ${tombstoneCiphertext}::bytea
                     END,
                     completion_nonce = CASE
                       WHEN completion_nonce IS NULL THEN NULL
                       ELSE ${tombstoneNonce}::bytea
                     END,
                     completion_tag = CASE
                       WHEN completion_tag IS NULL THEN NULL
                       ELSE ${tombstoneTag}::bytea
                     END,
                     completion_key_version = CASE
                       WHEN completion_key_version IS NULL THEN NULL
                       ELSE ${deletedKeyVersion}
                     END
                FROM account_subject_link AS link
               WHERE link.privacy_deletion_request_id = ${requestId}::uuid
                 AND link.anonymous_subject_id = revisit.anonymous_subject_id
               RETURNING revisit.id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const deletedOutputDigest = await digest(JSON.stringify(deletedInterpretationOutput));
        const interpretationCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE interpretation
                 SET fallback_output = ${JSON.stringify(deletedInterpretationOutput)}::jsonb,
                     finalization_hash = ${deletedOutputDigest}::bytea
                FROM account_subject_link AS link
               WHERE link.privacy_deletion_request_id = ${requestId}::uuid
                 AND link.anonymous_subject_id = interpretation.anonymous_subject_id
                 AND interpretation.fallback_output IS NOT NULL
               RETURNING interpretation.id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const verificationCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE interpretation_verification AS verification
                 SET output = ${JSON.stringify(deletedInterpretationOutput)}::jsonb,
                     candidate_digest = ${deletedOutputDigest}::bytea,
                     output_digest = ${deletedOutputDigest}::bytea,
                     finalization_digest = ${deletedOutputDigest}::bytea
                FROM account_subject_link AS link
               WHERE link.privacy_deletion_request_id = ${requestId}::uuid
                 AND link.anonymous_subject_id = verification.anonymous_subject_id
               RETURNING verification.interpretation_id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const exportArtifactCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              DELETE FROM privacy_export_artifact AS artifact
               USING privacy_export AS request
               WHERE request.user_id = ${active.userId}::uuid
                 AND request.id = artifact.export_id
                 AND request.user_id = artifact.user_id
               RETURNING artifact.export_id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const astrologyCalculationCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE astrology_calculation
                 SET facts_ciphertext = ${tombstoneCiphertext}::bytea,
                     facts_nonce = ${tombstoneNonce}::bytea,
                     facts_tag = ${tombstoneTag}::bytea,
                     encryption_key_version = ${deletedKeyVersion},
                     digest_key_version = ${deletedKeyVersion},
                     keyed_facts_digest = ${tombstoneCiphertext}::bytea,
                     privacy_deleted_at = CURRENT_TIMESTAMP
               WHERE user_id = ${active.userId}::uuid
                 AND privacy_deleted_at IS NULL
               RETURNING id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        const birthProfileCount = await countRows(
          transaction,
          Prisma.sql`
            WITH changed AS (
              UPDATE birth_profile
                 SET payload_ciphertext = ${tombstoneCiphertext}::bytea,
                     payload_nonce = ${tombstoneNonce}::bytea,
                     payload_tag = ${tombstoneTag}::bytea,
                     encryption_key_version = ${deletedKeyVersion},
                     canonical_payload_digest = ${tombstoneCiphertext}::bytea,
                     revision = revision + 1,
                     updated_at = CURRENT_TIMESTAMP,
                     deleted_at = CURRENT_TIMESTAMP
               WHERE user_id = ${active.userId}::uuid
                 AND deleted_at IS NULL
               RETURNING id
            )
            SELECT COUNT(*)::bigint AS count FROM changed
          `,
        );

        let authIdentityCount = 0;
        let accountSessionCount = 0;
        let passkeyCount = 0;
        let walletIdentityCount = 0;
        if (scope === "account") {
          const identitySubjects = await transaction.$queryRaw<
            Array<{ providerKey: string; providerSubject: string }>
          >`
            SELECT provider_key AS "providerKey", provider_subject AS "providerSubject"
              FROM auth_identity
             WHERE user_id = ${active.userId}::uuid
             ORDER BY provider_key, provider_subject
          `;
          for (const identity of identitySubjects) {
            await transaction.$executeRaw`
              SELECT pg_advisory_xact_lock(
                hashtextextended(${`${identity.providerKey}:${identity.providerSubject}`}, 54055)
              )
            `;
            const providerSubjectHash = await digest(
              `${identity.providerKey}:${identity.providerSubject}`,
            );
            await transaction.$executeRaw`
              INSERT INTO auth_identity_suppression (
                provider_key, provider_subject_hash, user_id, deletion_request_id, created_at
              ) VALUES (
                ${identity.providerKey}, ${providerSubjectHash}::bytea, ${active.userId}::uuid,
                ${requestId}::uuid, CURRENT_TIMESTAMP
              )
            `;
          }
          await transaction.$executeRaw`
            UPDATE payment_attempt AS attempt
               SET provider_checkout_url = NULL
              FROM commerce_order AS orders
             WHERE orders.user_id = ${active.userId}::uuid
               AND orders.id = attempt.order_id
               AND attempt.provider_checkout_url IS NOT NULL
          `;
          await transaction.$executeRaw`
            UPDATE auth_challenge AS challenge
               SET provider_subject =
                     'deleted.challenge.' || replace(challenge.id::text, '-', ''),
                   email_ciphertext = ${tombstoneCiphertext}::bytea,
                   email_nonce = ${tombstoneNonce}::bytea,
                   email_tag = ${tombstoneTag}::bytea,
                   encryption_key_version = ${deletedKeyVersion},
                   token_hash = decode(
                     md5(${tombstoneSalt} || ':challenge-token:' || challenge.id::text) ||
                     md5(challenge.id::text || ':challenge-token:' || ${tombstoneSalt}),
                     'hex'
                   ),
                   state_hash = decode(
                     md5(${tombstoneSalt} || ':challenge-state:' || challenge.id::text) ||
                     md5(challenge.id::text || ':challenge-state:' || ${tombstoneSalt}),
                     'hex'
                   ),
                   previous_session_hash = NULL,
                   return_to = '/en',
                   consumed_at = COALESCE(
                     challenge.consumed_at,
                     LEAST(CURRENT_TIMESTAMP, challenge.expires_at)
                   )
              FROM auth_identity AS identity
             WHERE identity.user_id = ${active.userId}::uuid
               AND identity.provider_key = challenge.provider_key
               AND identity.provider_subject = challenge.provider_subject
          `;

          passkeyCount = await countRows(
            transaction,
            Prisma.sql`
              WITH changed AS (
                UPDATE passkey_credential AS credential
                   SET credential_id = decode(
                         md5(${tombstoneSalt} || ':passkey:' || credential.id::text) ||
                         md5(credential.id::text || ':passkey:' || ${tombstoneSalt}),
                         'hex'
                       ),
                       public_key = ${tombstoneCiphertext}::bytea,
                       rp_id = 'deleted.invalid',
                       revoked_at = COALESCE(credential.revoked_at, CURRENT_TIMESTAMP)
                  FROM auth_identity AS identity
                 WHERE identity.user_id = ${active.userId}::uuid
                   AND identity.id = credential.auth_identity_id
                 RETURNING credential.id
              )
              SELECT COUNT(*)::bigint AS count FROM changed
            `,
          );

          await transaction.$executeRaw`
            UPDATE wallet_auth_challenge AS challenge
               SET address = '0x' || substr(
                     md5(${tombstoneSalt} || ':wallet-challenge:' || challenge.id::text) ||
                     md5(challenge.id::text || ':wallet-challenge:' || ${tombstoneSalt}),
                     1,
                     40
                   ),
                   message = 'Private wallet challenge deleted.',
                   message_hash = ${tombstoneCiphertext}::bytea,
                   canonical_request_hash = ${tombstoneCiphertext}::bytea
              FROM wallet_identity AS wallet
             WHERE wallet.user_id = ${active.userId}::uuid
               AND wallet.address = challenge.address
          `;

          walletIdentityCount = await countRows(
            transaction,
            Prisma.sql`
              WITH changed AS (
                UPDATE wallet_identity AS wallet
                   SET address = '0x' || substr(
                         md5(${tombstoneSalt} || ':wallet:' || wallet.id::text) ||
                         md5(wallet.id::text || ':wallet:' || ${tombstoneSalt}),
                         1,
                         40
                       ),
                       revoked_at = COALESCE(wallet.revoked_at, CURRENT_TIMESTAMP)
                 WHERE wallet.user_id = ${active.userId}::uuid
                 RETURNING wallet.id
              )
              SELECT COUNT(*)::bigint AS count FROM changed
            `,
          );

          accountSessionCount = await countRows(
            transaction,
            Prisma.sql`
              WITH changed AS (
                UPDATE account_session
                   SET token_hash = decode(
                         md5(${tombstoneSalt} || ':session:' || id::text) ||
                         md5(id::text || ':session:' || ${tombstoneSalt}),
                         'hex'
                       ),
                       revoked_at = COALESCE(
                         revoked_at,
                         LEAST(CURRENT_TIMESTAMP, expires_at)
                       )
                 WHERE user_id = ${active.userId}::uuid
                 RETURNING id
              )
              SELECT COUNT(*)::bigint AS count FROM changed
            `,
          );

          authIdentityCount = await countRows(
            transaction,
            Prisma.sql`
              WITH changed AS (
                UPDATE auth_identity
                   SET provider_subject =
                         'deleted.' || replace(user_id::text, '-', '') || '.' ||
                         replace(id::text, '-', ''),
                       verified_email_ciphertext = ${tombstoneCiphertext}::bytea,
                       verified_email_nonce = ${tombstoneNonce}::bytea,
                       verified_email_tag = ${tombstoneTag}::bytea,
                       encryption_key_version = ${deletedKeyVersion}
                 WHERE user_id = ${active.userId}::uuid
                 RETURNING id
              )
              SELECT COUNT(*)::bigint AS count FROM changed
            `,
          );

          const updatedAccounts = await transaction.$executeRaw`
            UPDATE app_user
               SET status = 'deleted',
                   display_name = NULL,
                   locale = 'en',
                   time_zone = 'UTC',
                   age_attested_at = NULL,
                   age_policy_version = NULL,
                   profile_version = profile_version + 1,
                   last_active_at = CURRENT_TIMESTAMP
             WHERE id = ${active.userId}::uuid
               AND status = 'active'
          `;
          if (updatedAccounts !== 1) {
            throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
          }
        }

        const counts: PrivacyDeletionCounts = Object.freeze({
          accountSessions: accountSessionCount,
          astrologyCalculations: astrologyCalculationCount,
          authIdentities: authIdentityCount,
          birthProfiles: birthProfileCount,
          currentJournals: currentJournalCount,
          exportArtifacts: exportArtifactCount,
          intentions: intentionCount,
          interpretations: interpretationCount,
          legacyJournals: legacyJournalCount,
          passkeys: passkeyCount,
          revisits: revisitCount,
          subjects: subjectCount,
          verifications: verificationCount,
          wallets: walletIdentityCount,
        });
        const evidenceSha256 = await digest(
          JSON.stringify({
            counts,
            policyVersion: deletionPolicyVersion,
            requestId,
            retentionCategories,
            scope,
            userId: active.userId,
          }),
        );
        const completions = await transaction.$queryRaw<Array<{ completedAt: Date }>>`
          INSERT INTO privacy_deletion_completion (
            request_id, user_id, subject_count, intention_count, legacy_journal_count,
            current_journal_count, revisit_count, export_artifact_count,
            interpretation_count, verification_count,
            auth_identity_count, account_session_count, passkey_count,
            wallet_identity_count, birth_profile_count, astrology_calculation_count,
            evidence_sha256, completed_at
          ) VALUES (
            ${requestId}::uuid, ${active.userId}::uuid, ${subjectCount}, ${intentionCount},
            ${legacyJournalCount}, ${currentJournalCount}, ${revisitCount},
            ${exportArtifactCount}, ${interpretationCount}, ${verificationCount},
            ${authIdentityCount}, ${accountSessionCount},
            ${passkeyCount}, ${walletIdentityCount}, ${birthProfileCount},
            ${astrologyCalculationCount},
            ${evidenceSha256}, CURRENT_TIMESTAMP
          )
          RETURNING completed_at AS "completedAt"
        `;
        const completedAt = completions[0]?.completedAt;
        if (completions.length !== 1 || completedAt === undefined) {
          throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
        }
        return Object.freeze({
          completedAt: completedAt.toISOString(),
          counts,
          id: requestId,
          policyVersion: deletionPolicyVersion,
          requestedAt: requestedAt.toISOString(),
          retentionCategories,
          scope,
          status: "completed" as const,
        });
      });
    } catch (error) {
      if (error instanceof PrivacyDeletionError) throw error;
      throw new PrivacyDeletionError("PRIVACY_DELETION_UNAVAILABLE");
    }
  };

  return Object.freeze({ request });
};
