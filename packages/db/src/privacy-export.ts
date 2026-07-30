import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const versionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const privacyExportSchemaVersion = "privacy-export-package.v2" as const;
const maximumArtifactBytes = 16_777_216;
const canonicalRequest = JSON.stringify({
  format: "json+markdown",
  operation: "privacy.export.request.v1",
  schemaVersion: privacyExportSchemaVersion,
});

export const privacyExportErrorCodes = Object.freeze([
  "PRIVACY_EXPORT_SESSION_UNAVAILABLE",
  "PRIVACY_EXPORT_RECENT_AUTH_REQUIRED",
  "PRIVACY_EXPORT_INVALID",
  "PRIVACY_EXPORT_CONFLICT",
  "PRIVACY_EXPORT_RATE_LIMITED",
  "PRIVACY_EXPORT_NOT_FOUND",
  "PRIVACY_EXPORT_EXPIRED",
  "PRIVACY_EXPORT_NOT_READY",
  "PRIVACY_EXPORT_UNAVAILABLE",
] as const);

export type PrivacyExportErrorCode = (typeof privacyExportErrorCodes)[number];

export class PrivacyExportError extends Error {
  readonly code: PrivacyExportErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: PrivacyExportErrorCode, retryAfterSeconds?: number) {
    super("The privacy export operation is unavailable.");
    this.name = "PrivacyExportError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type PrivacyExportPolicy = Readonly<{
  artifactTtlSeconds: number;
  encryptionKeyVersion: string;
  recentAuthenticationSeconds: number;
  requestWindowSeconds: number;
}>;

export type PrivacyExportSnapshot = Readonly<{
  account: unknown;
  astrologyCalculations: unknown;
  birthProfiles: unknown;
  commerce: unknown;
  consents: unknown;
  identities: unknown;
  intentions: unknown;
  interpretations: unknown;
  journals: unknown;
  linkedSubjects: unknown;
  privacyActivity: unknown;
  readings: unknown;
  reports: unknown;
  revisits: unknown;
  rituals: unknown;
  sessions: unknown;
  snapshotAt: string;
}>;

export type PrivacyExportMetadata = Readonly<{
  completedAt: string | null;
  createdAt: string;
  expiresAt: string;
  id: string;
  recordCount: number | null;
  schemaVersion: typeof privacyExportSchemaVersion;
  status: "expired" | "failed" | "pending" | "ready";
}>;

export type PrivacyExportEncryptedArtifact = Readonly<{
  authenticationTag: Uint8Array;
  ciphertext: Uint8Array;
  completedAt: string;
  createdAt: string;
  encryptionKeyVersion: string;
  expiresAt: string;
  id: string;
  nonce: Uint8Array;
  plaintextBytes: number;
  plaintextSha256: Uint8Array;
  recordCount: number;
  schemaVersion: typeof privacyExportSchemaVersion;
  userId: string;
}>;

export type PrivacyExportPersistence = Readonly<{
  authorizeDownload(input: {
    exportId: string;
    sessionToken: string;
  }): Promise<PrivacyExportEncryptedArtifact>;
  complete(input: {
    authenticationTag: Uint8Array;
    ciphertext: Uint8Array;
    exportId: string;
    nonce: Uint8Array;
    plaintextBytes: number;
    plaintextSha256: Uint8Array;
    recordCount: number;
    userId: string;
  }): Promise<PrivacyExportMetadata>;
  fail(input: { exportId: string; failureCode: string; userId: string }): Promise<void>;
  getMetadata(input: { exportId: string; sessionToken: string }): Promise<PrivacyExportMetadata>;
  prepare(input: { idempotencyKey: string; sessionToken: string }): Promise<
    | Readonly<{
        kind: "created";
        metadata: PrivacyExportMetadata;
        snapshot: PrivacyExportSnapshot;
        userId: string;
      }>
    | Readonly<{ kind: "existing"; metadata: PrivacyExportMetadata }>
  >;
}>;

type ActiveSession = Readonly<{
  authenticatedAt: Date | null;
  authIdentityId: string;
  sessionId: string;
  userId: string;
}>;

type ExportRow = Readonly<{
  authenticationTag: Uint8Array | null;
  ciphertext: Uint8Array | null;
  completedAt: Date | null;
  createdAt: Date;
  encryptionKeyVersion: string;
  expiresAt: Date;
  failedAt: Date | null;
  id: string;
  nonce: Uint8Array | null;
  plaintextBytes: number | null;
  plaintextSha256: Uint8Array | null;
  recordCount: number | null;
  schemaVersion: string;
  userId: string;
}>;

const validatePolicy = (policy: PrivacyExportPolicy): PrivacyExportPolicy => {
  if (
    !Number.isSafeInteger(policy.artifactTtlSeconds) ||
    policy.artifactTtlSeconds < 300 ||
    policy.artifactTtlSeconds > 604_800 ||
    !Number.isSafeInteger(policy.recentAuthenticationSeconds) ||
    policy.recentAuthenticationSeconds < 60 ||
    policy.recentAuthenticationSeconds > 86_400 ||
    !Number.isSafeInteger(policy.requestWindowSeconds) ||
    policy.requestWindowSeconds < 60 ||
    policy.requestWindowSeconds > 604_800 ||
    !versionPattern.test(policy.encryptionKeyVersion)
  ) {
    throw new TypeError("Privacy export policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const digest = async (value: string | Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const bytes = Uint8Array.from(source) as Uint8Array<ArrayBuffer>;
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  const leftView = new DataView(left.buffer, left.byteOffset, left.byteLength);
  const rightView = new DataView(right.buffer, right.byteOffset, right.byteLength);
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= leftView.getUint8(index) ^ rightView.getUint8(index);
  }
  return difference === 0;
};

const parseSessionToken = (value: string): Uint8Array => {
  if (!opaqueTokenPattern.test(value))
    throw new PrivacyExportError("PRIVACY_EXPORT_SESSION_UNAVAILABLE");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== value) {
    throw new PrivacyExportError("PRIVACY_EXPORT_SESSION_UNAVAILABLE");
  }
  return Uint8Array.from(bytes);
};

const parseIdempotencyKey = (value: string): string => {
  if (!idempotencyKeyPattern.test(value)) throw new PrivacyExportError("PRIVACY_EXPORT_INVALID");
  return value;
};

const parseExportId = (value: string): string => {
  if (!uuidV4Pattern.test(value)) throw new PrivacyExportError("PRIVACY_EXPORT_NOT_FOUND");
  return value;
};

const metadata = (row: ExportRow, now = new Date()): PrivacyExportMetadata => {
  if (!uuidV4Pattern.test(row.id) || row.schemaVersion !== privacyExportSchemaVersion) {
    throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
  }
  if (row.completedAt !== null && row.failedAt !== null) {
    throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
  }
  const status =
    row.completedAt !== null
      ? row.expiresAt <= now
        ? "expired"
        : "ready"
      : row.failedAt !== null
        ? "failed"
        : "pending";
  return Object.freeze({
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    recordCount: row.recordCount,
    schemaVersion: privacyExportSchemaVersion,
    status,
  });
};

const findActiveSession = async (
  transaction: Prisma.TransactionClient,
  tokenHash: Uint8Array,
): Promise<ActiveSession | null> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    SELECT session.id AS "sessionId", session.user_id AS "userId",
           session.auth_identity_id AS "authIdentityId",
           session.authenticated_at AS "authenticatedAt"
      FROM account_session AS session
      JOIN app_user AS account ON account.id = session.user_id
      JOIN auth_identity AS identity ON identity.id = session.auth_identity_id
     WHERE session.token_hash = ${tokenHash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.status = 'active'
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const touchActiveSession = async (
  transaction: Prisma.TransactionClient,
  candidate: ActiveSession,
  tokenHash: Uint8Array,
): Promise<ActiveSession | null> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    UPDATE account_session AS session
       SET last_seen_at = LEAST(CURRENT_TIMESTAMP, session.expires_at)
      FROM app_user AS account
     WHERE session.id = ${candidate.sessionId}::uuid
       AND session.user_id = ${candidate.userId}::uuid
       AND session.token_hash = ${tokenHash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.id = session.user_id
       AND account.status = 'active'
     RETURNING session.id AS "sessionId", session.user_id AS "userId",
               session.auth_identity_id AS "authIdentityId",
               session.authenticated_at AS "authenticatedAt"
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const resolveActiveSession = async (
  transaction: Prisma.TransactionClient,
  sessionToken: string,
): Promise<ActiveSession | null> => {
  const tokenHash = await digest(parseSessionToken(sessionToken));
  const candidate = await findActiveSession(transaction, tokenHash);
  return candidate === null ? null : touchActiveSession(transaction, candidate, tokenHash);
};

const assertRecentAuthentication = (
  active: ActiveSession,
  now: Date,
  policy: PrivacyExportPolicy,
): void => {
  if (
    active.authenticatedAt === null ||
    now.getTime() < active.authenticatedAt.getTime() ||
    now.getTime() - active.authenticatedAt.getTime() > policy.recentAuthenticationSeconds * 1_000
  ) {
    throw new PrivacyExportError("PRIVACY_EXPORT_RECENT_AUTH_REQUIRED");
  }
};

const exportColumns = Prisma.sql`
  request.id, request.user_id AS "userId",
  request.schema_version AS "schemaVersion",
  request.encryption_key_version AS "encryptionKeyVersion",
  artifact.ciphertext, artifact.nonce,
  artifact.authentication_tag AS "authenticationTag",
  artifact.plaintext_sha256 AS "plaintextSha256",
  artifact.plaintext_bytes AS "plaintextBytes",
  artifact.record_count AS "recordCount",
  request.created_at AS "createdAt",
  artifact.completed_at AS "completedAt",
  request.expires_at AS "expiresAt",
  failed.failed_at AS "failedAt"
`;

const exportJoins = Prisma.sql`
  FROM privacy_export AS request
  LEFT JOIN privacy_export_artifact AS artifact
    ON artifact.export_id = request.id AND artifact.user_id = request.user_id
  LEFT JOIN LATERAL (
    SELECT MIN(audit.created_at) AS failed_at
      FROM privacy_export_audit AS audit
     WHERE audit.export_id = request.id
       AND audit.user_id = request.user_id
       AND audit.action = 'failed'
  ) AS failed ON TRUE
`;

const readSnapshot = async (
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<PrivacyExportSnapshot> => {
  const rows = await transaction.$queryRaw<Array<PrivacyExportSnapshot>>`
    WITH linked_subjects AS (
      SELECT link.anonymous_subject_id
        FROM account_subject_link AS link
       WHERE link.user_id = ${userId}::uuid
         AND link.privacy_deleted_at IS NULL
    )
    SELECT
      to_char(
        CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS "snapshotAt",
      (
        SELECT jsonb_build_object(
          'id', account.id,
          'status', account.status,
          'locale', account.locale,
          'timeZone', account.time_zone,
          'displayName', account.display_name,
          'emailVerifiedAt', account.email_verified_at,
          'ageAttestedAt', account.age_attested_at,
          'agePolicyVersion', account.age_policy_version,
          'createdAt', account.created_at,
          'lastActiveAt', account.last_active_at,
          'profileVersion', account.profile_version
        )
          FROM app_user AS account
         WHERE account.id = ${userId}::uuid
      ) AS account,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', identity.id,
          'providerKey', identity.provider_key,
          'providerSubject', identity.provider_subject,
          'verifiedAt', identity.verified_at,
          'lastSignInAt', identity.last_sign_in_at,
          'createdAt', identity.created_at,
          'credentials', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', credential.id,
              'rpId', credential.rp_id,
              'signCount', credential.sign_count::text,
              'createdAt', credential.created_at,
              'lastUsedAt', credential.last_used_at,
              'revokedAt', credential.revoked_at
            ) ORDER BY credential.created_at, credential.id)
              FROM passkey_credential AS credential
             WHERE credential.auth_identity_id = identity.id
          ), '[]'::jsonb),
          'verifiedEmail', jsonb_build_object(
            'ciphertext', encode(identity.verified_email_ciphertext, 'base64'),
            'nonce', encode(identity.verified_email_nonce, 'base64'),
            'tag', encode(identity.verified_email_tag, 'base64'),
            'keyVersion', identity.encryption_key_version
          )
        ) ORDER BY identity.created_at, identity.id)
          FROM auth_identity AS identity
         WHERE identity.user_id = ${userId}::uuid
      ), '[]'::jsonb) AS identities,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', session.id,
          'authIdentityId', session.auth_identity_id,
          'authenticatedAt', session.authenticated_at,
          'createdAt', session.created_at,
          'expiresAt', session.expires_at,
          'lastSeenAt', session.last_seen_at,
          'revokedAt', session.revoked_at
        ) ORDER BY session.created_at, session.id)
          FROM account_session AS session
         WHERE session.user_id = ${userId}::uuid
      ), '[]'::jsonb) AS sessions,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', profile.id,
          'timeCertainty', profile.time_certainty,
          'schemaVersion', profile.schema_version,
          'encryptedPayload', jsonb_build_object(
            'ciphertext', encode(profile.payload_ciphertext, 'base64'),
            'nonce', encode(profile.payload_nonce, 'base64'),
            'tag', encode(profile.payload_tag, 'base64'),
            'keyVersion', profile.encryption_key_version
          ),
          'digestKeyVersion', profile.digest_key_version,
          'canonicalPayloadDigest',
            'sha256:' || encode(profile.canonical_payload_digest, 'hex'),
          'revision', profile.revision,
          'createdAt', profile.created_at,
          'updatedAt', profile.updated_at
        ) ORDER BY profile.created_at, profile.id)
          FROM birth_profile AS profile
         WHERE profile.user_id = ${userId}::uuid
           AND profile.deleted_at IS NULL
      ), '[]'::jsonb) AS "birthProfiles",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', calculation.id,
          'birthProfileId', calculation.birth_profile_id,
          'birthProfileRevision', calculation.birth_profile_revision,
          'birthProfilePayloadDigest',
            'sha256:' || encode(calculation.birth_profile_payload_digest, 'hex'),
          'status', calculation.status,
          'timeCertainty', calculation.time_certainty,
          'methodVersion', calculation.method_version,
          'aspectPolicyVersion', calculation.aspect_policy_version,
          'methodCatalogDigest',
            'sha256:' || encode(calculation.method_catalog_digest, 'hex'),
          'inputSnapshotDigest',
            'sha256:' || encode(calculation.input_snapshot_digest, 'hex'),
          'timezoneProvenanceDigest',
            'sha256:' || encode(calculation.timezone_provenance_digest, 'hex'),
          'engineProvenanceVersion', calculation.engine_provenance_version,
          'engineBuildProvenance', calculation.engine_build_provenance,
          'encryptedFacts', jsonb_build_object(
            'ciphertext', encode(calculation.facts_ciphertext, 'base64'),
            'nonce', encode(calculation.facts_nonce, 'base64'),
            'tag', encode(calculation.facts_tag, 'base64'),
            'keyVersion', calculation.encryption_key_version
          ),
          'digestKeyVersion', calculation.digest_key_version,
          'keyedFactsDigest',
            'sha256:' || encode(calculation.keyed_facts_digest, 'hex'),
          'createdAt', calculation.created_at
        ) ORDER BY calculation.created_at, calculation.id)
          FROM astrology_calculation AS calculation
         WHERE calculation.user_id = ${userId}::uuid
           AND calculation.privacy_deleted_at IS NULL
      ), '[]'::jsonb) AS "astrologyCalculations",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'subjectId', subject.id,
          'linkedAt', link.created_at,
          'createdAt', subject.created_at,
          'expiresAt', subject.expires_at,
          'lastSeenAt', subject.last_seen_at,
          'expiryPolicyVersion', subject.expiry_policy_version,
          'sessions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', anonymous_session.id,
              'expiryPolicyVersion', anonymous_session.expiry_policy_version,
              'createdAt', anonymous_session.created_at,
              'expiresAt', anonymous_session.expires_at,
              'lastSeenAt', anonymous_session.last_seen_at,
              'revokedAt', anonymous_session.revoked_at
            ) ORDER BY anonymous_session.created_at, anonymous_session.id)
              FROM anonymous_session
             WHERE anonymous_session.anonymous_subject_id = subject.id
          ), '[]'::jsonb)
        ) ORDER BY link.created_at, subject.id)
          FROM account_subject_link AS link
          JOIN anonymous_subject AS subject ON subject.id = link.anonymous_subject_id
         WHERE link.user_id = ${userId}::uuid
           AND link.privacy_deleted_at IS NULL
      ), '[]'::jsonb) AS "linkedSubjects",
      COALESCE((
        SELECT jsonb_agg(consent.entry ORDER BY consent.recorded_at, consent.id)
          FROM (
            SELECT anonymous_consent.id,
                   anonymous_consent.recorded_at,
                   jsonb_build_object(
                     'id', anonymous_consent.id,
                     'ownerType', 'anonymous_subject',
                     'ownerId', anonymous_consent.anonymous_subject_id,
                     'purpose', anonymous_consent.purpose,
                     'sequence', anonymous_consent.sequence,
                     'noticeVersion', anonymous_consent.notice_version,
                     'locale', anonymous_consent.locale,
                     'decision', anonymous_consent.decision,
                     'source', anonymous_consent.source,
                     'recordedAt', anonymous_consent.recorded_at,
                     'withdrawsRecordId', anonymous_consent.withdraws_record_id
                   ) AS entry
              FROM consent_record AS anonymous_consent
             WHERE anonymous_consent.anonymous_subject_id IN (
               SELECT anonymous_subject_id FROM linked_subjects
             )
            UNION ALL
            SELECT account_consent.id,
                   account_consent.recorded_at,
                   jsonb_build_object(
                     'id', account_consent.id,
                     'ownerType', 'account',
                     'ownerId', account_consent.user_id,
                     'purpose', account_consent.purpose,
                     'sequence', account_consent.sequence,
                     'noticeVersion', account_consent.notice_version,
                     'locale', account_consent.locale,
                     'decision', account_consent.decision,
                     'source', account_consent.source,
                     'recordedAt', account_consent.recorded_at,
                     'withdrawsRecordId', account_consent.withdraws_record_id
                   ) AS entry
              FROM account_consent_record AS account_consent
             WHERE account_consent.user_id = ${userId}::uuid
          ) AS consent
      ), '[]'::jsonb) AS consents,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', audit.id,
          'exportId', audit.export_id,
          'action', audit.action,
          'metadata', audit.metadata,
          'createdAt', audit.created_at
        ) ORDER BY audit.created_at, audit.id)
          FROM privacy_export_audit AS audit
         WHERE audit.user_id = ${userId}::uuid
      ), '[]'::jsonb) AS "privacyActivity",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', reading.id,
          'subjectId', reading.anonymous_subject_id,
          'modality', reading.modality,
          'readingType', reading.reading_type,
          'status', reading.status,
          'locale', reading.locale,
          'themeCode', reading.theme_code,
          'requestSchemaVersion', reading.request_schema_version,
          'readingPolicyVersion', reading.reading_policy_version,
          'catalog', jsonb_build_object(
            'id', reading.catalog_id,
            'version', reading.catalog_version,
            'approvalReference', reading.catalog_approval_reference
          ),
          'createdAt', reading.created_at,
          'completedAt', reading.completed_at,
          'expiresAt', reading.expires_at,
          'draw', CASE WHEN draw.reading_id IS NULL THEN NULL ELSE jsonb_build_object(
            'executionSchemaVersion', draw.execution_schema_version,
            'integrityScheme', draw.integrity_scheme,
            'integrityKeyVersion', draw.integrity_key_version,
            'execution', draw.execution
          ) END
        ) ORDER BY reading.created_at, reading.id)
          FROM reading
          LEFT JOIN tarot_draw AS draw ON draw.reading_id = reading.id
         WHERE reading.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
      ), '[]'::jsonb) AS readings,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', interpretation.id,
          'readingId', interpretation.reading_id,
          'subjectId', interpretation.anonymous_subject_id,
          'generationNumber', interpretation.generation_number,
          'status', interpretation.status,
          'locale', interpretation.locale,
          'readingType', interpretation.reading_type,
          'themeCode', interpretation.theme_code,
          'tone', interpretation.tone,
          'generationSchemaVersion', interpretation.generation_schema_version,
          'generationPolicyVersion', interpretation.generation_policy_version,
          'providerId', interpretation.provider_id,
          'providerVersion', interpretation.provider_version,
          'modelId', interpretation.model_id,
          'modelVersion', interpretation.model_version,
          'outputSchemaVersion', interpretation.output_schema_version,
          'safetyPolicyVersion', interpretation.safety_policy_version,
          'fallbackOutput', interpretation.fallback_output,
          'verifiedOutput', verification.output,
          'verificationStatus', verification.status,
          'createdAt', interpretation.created_at,
          'completedAt', interpretation.completed_at,
          'expiresAt', interpretation.expires_at
        ) ORDER BY interpretation.created_at, interpretation.id)
          FROM interpretation
          LEFT JOIN interpretation_verification AS verification
            ON verification.interpretation_id = interpretation.id
         WHERE interpretation.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
      ), '[]'::jsonb) AS interpretations,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', report.id,
          'readingId', report.reading_id,
          'subjectId', report.anonymous_subject_id,
          'category', report.category,
          'targetKind', report.target_kind,
          'targetPositionId', report.target_position_id,
          'interpretationId', report.interpretation_id,
          'requestSchemaVersion', report.report_request_schema_version,
          'schemaVersion', report.schema_version,
          'reportPolicyVersion', report.report_policy_version,
          'createdAt', report.created_at,
          'expiresAt', report.expires_at
        ) ORDER BY report.created_at, report.id)
          FROM reading_report AS report
         WHERE report.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
      ), '[]'::jsonb) AS reports,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', intention.id,
          'subjectId', intention.anonymous_subject_id,
          'readingId', intention.reading_id,
          'intentionCode', intention.intention_code,
          'intentionText', CASE WHEN intention.intention_text_ciphertext IS NULL THEN NULL ELSE jsonb_build_object(
            'ciphertext', encode(intention.intention_text_ciphertext, 'base64'),
            'nonce', encode(intention.intention_text_nonce, 'base64'),
            'tag', encode(intention.intention_text_tag, 'base64'),
            'keyVersion', intention.encryption_key_version
          ) END,
          'smallAction', jsonb_build_object(
            'ciphertext', encode(intention.small_action_ciphertext, 'base64'),
            'nonce', encode(intention.small_action_nonce, 'base64'),
            'tag', encode(intention.small_action_tag, 'base64'),
            'keyVersion', intention.encryption_key_version
          ),
          'schemaVersion', intention.schema_version,
          'policyVersion', intention.policy_version,
          'privacyState', intention.privacy_state,
          'reminderPreference', intention.reminder_preference,
          'revisitDate', intention.revisit_date,
          'timeZone', intention.time_zone,
          'status', intention.status,
          'revision', intention.revision,
          'createdAt', intention.created_at,
          'updatedAt', intention.updated_at,
          'completedAt', intention.completed_at,
          'archivedAt', intention.archived_at,
          'deletedAt', intention.deleted_at,
          'expiresAt', intention.expires_at
        ) ORDER BY intention.created_at, intention.id)
          FROM intention
         WHERE intention.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
      ), '[]'::jsonb) AS intentions,
      jsonb_build_object(
        'legacy', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ritual.id, 'subjectId', ritual.anonymous_subject_id,
            'intentionId', ritual.intention_id, 'objectCode', ritual.object_code,
            'ritualDateUtc', ritual.ritual_date_utc, 'schemaVersion', ritual.schema_version,
            'policyVersion', ritual.policy_version, 'startedAt', ritual.started_at,
            'completedAt', ritual.completed_at, 'expiresAt', ritual.expires_at
          ) ORDER BY ritual.started_at, ritual.id)
            FROM ritual_session AS ritual
           WHERE ritual.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
        ), '[]'::jsonb),
        'current', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ritual.id, 'subjectId', ritual.anonymous_subject_id,
            'intentionId', ritual.intention_id, 'itemCode', ritual.item_code,
            'schemaVersion', ritual.schema_version, 'policyVersion', ritual.policy_version,
            'catalogId', ritual.catalog_id, 'catalogVersion', ritual.catalog_version,
            'itemVersion', ritual.item_version, 'publicationId', ritual.publication_id,
            'templateCode', ritual.template_code, 'templateVersion', ritual.template_version,
            'accessKind', ritual.access_kind, 'accessRequirementCode', ritual.access_requirement_code,
            'status', ritual.status, 'currentStepCode', ritual.current_step_code,
            'elapsedSeconds', ritual.elapsed_seconds, 'revision', ritual.revision,
            'startedAt', ritual.started_at, 'pausedAt', ritual.paused_at,
            'completedAt', ritual.completed_at, 'abandonedAt', ritual.abandoned_at,
            'expiresAt', ritual.expires_at
          ) ORDER BY ritual.started_at, ritual.id)
            FROM ritual_session_v2 AS ritual
           WHERE ritual.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
        ), '[]'::jsonb)
      ) AS rituals,
      jsonb_build_object(
        'legacy', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', journal.id, 'subjectId', journal.anonymous_subject_id,
            'intentionId', journal.intention_id, 'ritualSessionId', journal.ritual_session_id,
            'reflection', jsonb_build_object(
              'ciphertext', encode(journal.reflection_ciphertext, 'base64'),
              'nonce', encode(journal.reflection_nonce, 'base64'),
              'tag', encode(journal.reflection_tag, 'base64'),
              'keyVersion', journal.encryption_key_version
            ),
            'schemaVersion', journal.schema_version, 'policyVersion', journal.policy_version,
            'createdAt', journal.created_at, 'updatedAt', journal.updated_at,
            'revisitAt', journal.revisit_at, 'expiresAt', journal.expires_at,
            'deletedAt', journal.deleted_at
          ) ORDER BY journal.created_at, journal.id)
            FROM journal_entry AS journal
           WHERE journal.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
        ), '[]'::jsonb),
        'current', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', journal.id, 'subjectId', journal.anonymous_subject_id,
            'intentionId', journal.intention_id, 'ritualSessionId', journal.ritual_session_id,
            'reflection', jsonb_build_object(
              'ciphertext', encode(journal.reflection_ciphertext, 'base64'),
              'nonce', encode(journal.reflection_nonce, 'base64'),
              'tag', encode(journal.reflection_tag, 'base64'),
              'keyVersion', journal.encryption_key_version
            ),
            'schemaVersion', journal.schema_version, 'policyVersion', journal.policy_version,
            'revision', journal.revision, 'createdAt', journal.created_at,
            'updatedAt', journal.updated_at, 'expiresAt', journal.expires_at,
            'deletedAt', journal.deleted_at
          ) ORDER BY journal.created_at, journal.id)
            FROM private_journal_entry AS journal
           WHERE journal.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
        ), '[]'::jsonb)
      ) AS journals,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', revisit.id, 'subjectId', revisit.anonymous_subject_id,
          'intentionId', revisit.intention_id, 'schemaVersion', revisit.schema_version,
          'policyVersion', revisit.policy_version, 'intentionRevision', revisit.intention_revision,
          'intentionText', jsonb_build_object(
            'ciphertext', encode(revisit.intention_text_ciphertext, 'base64'),
            'nonce', encode(revisit.intention_text_nonce, 'base64'),
            'tag', encode(revisit.intention_text_tag, 'base64'),
            'keyVersion', revisit.snapshot_key_version
          ),
          'smallAction', jsonb_build_object(
            'ciphertext', encode(revisit.small_action_ciphertext, 'base64'),
            'nonce', encode(revisit.small_action_nonce, 'base64'),
            'tag', encode(revisit.small_action_tag, 'base64'),
            'keyVersion', revisit.snapshot_key_version
          ),
          'completionReflection', CASE WHEN revisit.completion_ciphertext IS NULL THEN NULL ELSE jsonb_build_object(
            'ciphertext', encode(revisit.completion_ciphertext, 'base64'),
            'nonce', encode(revisit.completion_nonce, 'base64'),
            'tag', encode(revisit.completion_tag, 'base64'),
            'keyVersion', revisit.completion_key_version
          ) END,
          'scheduleKind', revisit.schedule_kind, 'scheduledLocalDate', revisit.scheduled_local_date,
          'timeZone', revisit.time_zone, 'reminderPreference', revisit.reminder_preference,
          'reminderChannel', revisit.reminder_channel, 'quietHoursStart', revisit.quiet_hours_start,
          'quietHoursEnd', revisit.quiet_hours_end, 'outcomeTags', revisit.outcome_tags,
          'status', revisit.status, 'revision', revisit.revision,
          'createdAt', revisit.created_at, 'updatedAt', revisit.updated_at,
          'completedAt', revisit.completed_at, 'archivedAt', revisit.archived_at,
          'deletedAt', revisit.deleted_at,
          'expiresAt', revisit.expires_at,
          'deliveryReminder', (
            SELECT jsonb_build_object(
              'id', reminder.id,
              'schemaVersion', reminder.schema_version,
              'noticeVersion', reminder.notice_version,
              'channel', reminder.channel,
              'frequency', reminder.frequency,
              'locale', reminder.locale,
              'templateId', reminder.template_id,
              'templateVersion', reminder.template_version,
              'templateSourceChecksum', reminder.template_source_checksum,
              'templateLocale', reminder.template_locale,
              'templateFallbackUsed', reminder.template_fallback_used,
              'preferenceState', reminder.preference_state,
              'deliveryState', reminder.delivery_state,
              'attemptCount', reminder.attempt_count,
              'maxAttempts', reminder.max_attempts,
              'lastFailureCode', reminder.last_failure_code,
              'providerMessageReference', reminder.provider_message_reference,
              'createdAt', reminder.created_at,
              'updatedAt', reminder.updated_at,
              'deliveredAt', reminder.delivered_at,
              'unsubscribedAt', reminder.unsubscribed_at,
              'deadLetteredAt', reminder.dead_lettered_at,
              'operations', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', operation.id,
                  'action', operation.action,
                  'resultPreferenceState', operation.result_preference_state,
                  'resultDeliveryState', operation.result_delivery_state,
                  'recordedAt', operation.created_at
                ) ORDER BY operation.created_at, operation.id)
                  FROM revisit_reminder_operation AS operation
                 WHERE operation.subscription_id = reminder.id
                   AND operation.user_id = reminder.user_id
              ), '[]'::jsonb)
            )
              FROM revisit_reminder_subscription AS reminder
             WHERE reminder.revisit_id = revisit.id
               AND reminder.user_id = ${userId}::uuid
          )
        ) ORDER BY revisit.created_at, revisit.id)
          FROM revisit
         WHERE revisit.anonymous_subject_id IN (SELECT anonymous_subject_id FROM linked_subjects)
      ), '[]'::jsonb) AS revisits,
      jsonb_build_object(
        'orders', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', orders.id, 'status', orders.status, 'currency', orders.currency,
            'subtotalMinor', orders.subtotal_minor, 'taxMinor', orders.tax_minor,
            'totalMinor', orders.total_minor, 'refundedMinor', orders.refunded_minor,
            'countryCode', orders.country_code, 'countryPolicyVersion', orders.country_policy_version,
            'termsVersion', orders.terms_version, 'refundPolicyVersion', orders.refund_policy_version,
            'createdAt', orders.created_at, 'updatedAt', orders.updated_at,
            'lines', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', line.id, 'productCode', line.product_code,
                'productVersion', line.product_version, 'priceVersion', line.price_version,
                'unitAmountMinor', line.unit_amount_minor, 'quantity', line.quantity,
                'totalMinor', line.total_minor, 'exactContents', line.exact_contents_snapshot,
                'entitlementCode', line.entitlement_code
              ) ORDER BY line.id)
                FROM commerce_order_line AS line WHERE line.order_id = orders.id
            ), '[]'::jsonb)
          ) ORDER BY orders.created_at, orders.id)
            FROM commerce_order AS orders WHERE orders.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'paymentAttempts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', attempt.id, 'orderId', attempt.order_id, 'provider', attempt.provider,
            'environment', attempt.environment, 'attemptNumber', attempt.attempt_number,
            'state', attempt.state, 'amountMinor', attempt.amount_minor,
            'currency', attempt.currency, 'expiresAt', attempt.expires_at,
            'createdAt', attempt.created_at, 'updatedAt', attempt.updated_at
          ) ORDER BY attempt.created_at, attempt.id)
            FROM payment_attempt AS attempt
            JOIN commerce_order AS orders ON orders.id = attempt.order_id
           WHERE orders.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'paymentEvents', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', event.id, 'orderId', event.order_id,
            'paymentAttemptId', event.payment_attempt_id,
            'provider', event.provider, 'eventType', event.event_type,
            'apiVersion', event.api_version,
            'providerCreatedAt', event.provider_created_at,
            'receivedAt', event.received_at, 'processedAt', event.processed_at,
            'processingState', event.processing_state
          ) ORDER BY event.received_at, event.id)
            FROM payment_event AS event
            JOIN commerce_order AS orders ON orders.id = event.order_id
           WHERE orders.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'ledgerEntries', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ledger.id, 'orderId', ledger.order_id,
            'paymentAttemptId', ledger.payment_attempt_id, 'kind', ledger.kind,
            'amountMinor', ledger.amount_minor, 'currency', ledger.currency,
            'reversalOfId', ledger.reversal_of_id, 'createdAt', ledger.created_at
          ) ORDER BY ledger.created_at, ledger.id)
            FROM ledger_entry AS ledger
            JOIN commerce_order AS orders ON orders.id = ledger.order_id
           WHERE orders.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'entitlements', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', entitlement.id, 'sourceOrderLineId', entitlement.source_order_line_id,
            'entitlementCode', entitlement.entitlement_code, 'status', entitlement.status,
            'grantedAt', entitlement.granted_at, 'revokedAt', entitlement.revoked_at,
            'version', entitlement.version
          ) ORDER BY entitlement.granted_at, entitlement.id)
            FROM entitlement WHERE entitlement.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'commercialOrdersV2', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', orders.public_id, 'status', orders.status,
            'currencyCode', orders.currency_code, 'subtotalMinor', orders.subtotal_minor,
            'taxMinor', orders.tax_minor, 'totalMinor', orders.total_minor,
            'refundedMinor', orders.refunded_minor, 'countryCode', orders.country_code,
            'countryPolicyVersion', orders.country_policy_version,
            'catalogVersion', orders.catalog_version, 'termsVersion', orders.terms_version,
            'refundPolicyVersion', orders.refund_policy_version,
            'createdAt', orders.created_at, 'updatedAt', orders.updated_at,
            'paidAt', orders.paid_at, 'refundedAt', orders.refunded_at,
            'paymentStateVersion', orders.payment_state_version,
            'item', (
              SELECT jsonb_build_object(
                'productCode', item.product_code, 'productVersion', item.product_version,
                'quantity', item.quantity, 'totalMinor', item.total_minor,
                'exactContents', item.exact_contents_snapshot,
                'fulfillmentKind', item.fulfillment_kind,
                'fulfillmentCode', item.fulfillment_code,
                'creditsGranted', item.credits_granted
              )
              FROM commercial_order_item_v2 AS item WHERE item.order_id = orders.id
            )
          ) ORDER BY orders.created_at, orders.id)
          FROM commercial_order_v2 AS orders WHERE orders.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'commercialRefundRequestsV1', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', refunds.public_id, 'orderId', orders.public_id,
            'status', refunds.status, 'amountMinor', refunds.amount_minor,
            'currencyCode', refunds.currency_code,
            'refundPolicyVersion', refunds.refund_policy_version,
            'eligibilityPolicyVersion', refunds.eligibility_policy_version,
            'reasonCode', refunds.reason_code,
            'providerRefundId', refunds.provider_refund_id,
            'createdAt', refunds.created_at, 'submittedAt', refunds.submitted_at,
            'confirmedAt', refunds.confirmed_at,
            'rejectedAt', refunds.rejected_at, 'updatedAt', refunds.updated_at
          ) ORDER BY refunds.created_at, refunds.id)
          FROM commercial_refund_request_v1 AS refunds
          JOIN commercial_order_v2 AS orders ON orders.id = refunds.order_id
          WHERE refunds.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'creditProjectionV2', COALESCE((
          SELECT jsonb_build_object(
            'subscriptionAvailable', projection.subscription_available,
            'promotionalAvailable', projection.promotional_available,
            'purchasedAvailable', projection.purchased_available,
            'purchasedHeld', projection.purchased_held,
            'reserved', projection.reserved, 'version', projection.version,
            'updatedAt', projection.updated_at
          )
          FROM credit_projection AS projection WHERE projection.user_id = ${userId}::uuid
        ), '{}'::jsonb),
        'creditLedgerV2', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ledger.id, 'creditType', ledger.credit_type,
            'direction', ledger.direction, 'amount', ledger.amount, 'reason', ledger.reason,
            'productCode', ledger.product_code, 'orderId', orders.public_id,
            'sourceEntryId', ledger.source_entry_id, 'createdAt', ledger.created_at
          ) ORDER BY ledger.created_at, ledger.id)
          FROM credit_ledger_entry AS ledger
          LEFT JOIN commercial_order_v2 AS orders ON orders.id = ledger.order_id
          WHERE ledger.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'creditRestrictionsV2', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', restriction.id, 'sourceEntryId', restriction.source_entry_id,
            'orderId', orders.public_id, 'kind', restriction.kind,
            'amount', restriction.amount, 'reason', restriction.reason,
            'sourceRestrictionId', restriction.source_restriction_id,
            'createdAt', restriction.created_at
          ) ORDER BY restriction.created_at, restriction.id)
          FROM credit_restriction_entry AS restriction
          JOIN commercial_order_v2 AS orders ON orders.id = restriction.order_id
          WHERE restriction.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'commercialRefundCreditHoldsV1', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', holds.id, 'refundRequestId', refunds.public_id,
            'orderId', orders.public_id, 'sourceEntryId', holds.source_entry_id,
            'amount', holds.amount, 'status', holds.status,
            'createdAt', holds.created_at, 'releasedAt', holds.released_at,
            'convertedAt', holds.converted_at, 'updatedAt', holds.updated_at
          ) ORDER BY holds.created_at, holds.id)
          FROM commercial_refund_credit_hold_v1 AS holds
          JOIN commercial_refund_request_v1 AS refunds ON refunds.id = holds.refund_request_id
          JOIN commercial_order_v2 AS orders ON orders.id = holds.order_id
          WHERE holds.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'commercialFulfillmentsV2', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'orderId', orders.public_id, 'fulfillmentKind', fulfillment.fulfillment_kind,
            'fulfillmentCode', fulfillment.fulfillment_code, 'status', fulfillment.status,
            'grantedAmount', fulfillment.granted_amount, 'heldAmount', fulfillment.held_amount,
            'reversedAmount', fulfillment.reversed_amount,
            'shortfallAmount', fulfillment.shortfall_amount,
            'paymentStateVersion', fulfillment.applied_payment_state_version,
            'version', fulfillment.version, 'grantedAt', fulfillment.granted_at,
            'updatedAt', fulfillment.updated_at
          ) ORDER BY fulfillment.granted_at, fulfillment.order_id)
          FROM commercial_fulfillment_v2 AS fulfillment
          JOIN commercial_order_v2 AS orders ON orders.id = fulfillment.order_id
          WHERE fulfillment.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'commercialEntitlementsV2', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', entitlement.id, 'entitlementType', entitlement.entitlement_type,
            'productCode', entitlement.product_code,
            'fulfillmentCode', entitlement.fulfillment_code, 'status', entitlement.status,
            'grantedAt', entitlement.granted_at, 'frozenAt', entitlement.frozen_at,
            'revokedAt', entitlement.revoked_at, 'version', entitlement.version
          ) ORDER BY entitlement.granted_at, entitlement.id)
          FROM commercial_entitlement_v2 AS entitlement
          WHERE entitlement.user_id = ${userId}::uuid
        ), '[]'::jsonb),
        'ritualPasses', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', pass.id, 'accessRequirementCode', pass.access_requirement_code,
            'sourceOrderLineId', pass.source_order_line_id, 'status', pass.status,
            'grantedAt', pass.granted_at, 'consumedAt', pass.consumed_at,
            'ritualSessionId', pass.ritual_session_id
          ) ORDER BY pass.granted_at, pass.id)
            FROM ritual_pass AS pass WHERE pass.user_id = ${userId}::uuid
        ), '[]'::jsonb)
      ) AS commerce
  `;
  const snapshot = rows[0];
  if (rows.length !== 1 || snapshot === undefined || snapshot.account === null) {
    throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
  }
  return Object.freeze(snapshot);
};

export const assertPrivacyExportRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      artifactDelete: boolean;
      artifactInsert: boolean;
      artifactSelect: boolean;
      artifactUpdate: boolean;
      auditDelete: boolean;
      auditInsert: boolean;
      auditSelect: boolean;
      auditUpdate: boolean;
      exportDelete: boolean;
      exportInsert: boolean;
      exportSelect: boolean;
      exportUpdate: boolean;
    }>
  >`
    SELECT
      has_table_privilege(current_user, 'privacy_export', 'SELECT') AS "exportSelect",
      has_table_privilege(current_user, 'privacy_export', 'INSERT') AS "exportInsert",
      has_table_privilege(current_user, 'privacy_export', 'UPDATE') AS "exportUpdate",
      has_table_privilege(current_user, 'privacy_export', 'DELETE') AS "exportDelete",
      has_table_privilege(current_user, 'privacy_export_artifact', 'SELECT')
        AS "artifactSelect",
      has_table_privilege(current_user, 'privacy_export_artifact', 'INSERT')
        AS "artifactInsert",
      has_table_privilege(current_user, 'privacy_export_artifact', 'UPDATE')
        AS "artifactUpdate",
      has_table_privilege(current_user, 'privacy_export_artifact', 'DELETE')
        AS "artifactDelete",
      has_table_privilege(current_user, 'privacy_export_audit', 'SELECT') AS "auditSelect",
      has_table_privilege(current_user, 'privacy_export_audit', 'INSERT') AS "auditInsert",
      has_table_privilege(current_user, 'privacy_export_audit', 'UPDATE') AS "auditUpdate",
      has_table_privilege(current_user, 'privacy_export_audit', 'DELETE') AS "auditDelete"
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.exportSelect ||
    !row.exportInsert ||
    row.exportUpdate ||
    row.exportDelete ||
    !row.artifactSelect ||
    !row.artifactInsert ||
    row.artifactUpdate ||
    row.artifactDelete ||
    !row.auditSelect ||
    !row.auditInsert ||
    row.auditUpdate ||
    row.auditDelete
  ) {
    throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
  }
};

export const createPrivacyExportPersistence = (
  database: PrismaClient,
  rawPolicy: PrivacyExportPolicy,
): PrivacyExportPersistence => {
  const policy = validatePolicy(rawPolicy);

  const prepare: PrivacyExportPersistence["prepare"] = async (input) => {
    const [idempotencyKeyHash, canonicalRequestHash, sessionTokenHash] = await Promise.all([
      digest(parseIdempotencyKey(input.idempotencyKey)),
      digest(canonicalRequest),
      digest(parseSessionToken(input.sessionToken)),
    ]);
    try {
      return await database.$transaction(async (transaction) => {
        const candidate = await findActiveSession(transaction, sessionTokenHash);
        if (candidate === null) throw new PrivacyExportError("PRIVACY_EXPORT_SESSION_UNAVAILABLE");
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${candidate.userId}, 54054))
        `;
        const active = await touchActiveSession(transaction, candidate, sessionTokenHash);
        if (active === null) throw new PrivacyExportError("PRIVACY_EXPORT_SESSION_UNAVAILABLE");
        const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
        const now = clocks[0]?.now;
        if (now === undefined) throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
        assertRecentAuthentication(active, now, policy);
        const existing = await transaction.$queryRaw<
          Array<ExportRow & { canonicalRequestHash: Uint8Array }>
        >`
          SELECT ${exportColumns},
                 request.canonical_request_hash AS "canonicalRequestHash"
          ${exportJoins}
           WHERE request.user_id = ${active.userId}::uuid
             AND request.idempotency_key_hash = ${idempotencyKeyHash}
        `;
        const replay = existing[0];
        if (existing.length > 1) throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
        if (replay !== undefined) {
          if (!bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)) {
            throw new PrivacyExportError("PRIVACY_EXPORT_CONFLICT");
          }
          return Object.freeze({ kind: "existing" as const, metadata: metadata(replay, now) });
        }
        const recent = await transaction.$queryRaw<Array<{ retryAfterSeconds: number }>>`
          SELECT GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (
              MAX(created_at) + make_interval(secs => ${policy.requestWindowSeconds})
              - CURRENT_TIMESTAMP
            )))::integer
          ) AS "retryAfterSeconds"
            FROM privacy_export
           WHERE user_id = ${active.userId}::uuid
             AND created_at > CURRENT_TIMESTAMP - make_interval(secs => ${policy.requestWindowSeconds})
          HAVING COUNT(*) > 0
        `;
        if (recent[0] !== undefined) {
          throw new PrivacyExportError("PRIVACY_EXPORT_RATE_LIMITED", recent[0].retryAfterSeconds);
        }
        const exportId = globalThis.crypto.randomUUID();
        const inserted = await transaction.$queryRaw<
          Array<{
            createdAt: Date;
            encryptionKeyVersion: string;
            expiresAt: Date;
            id: string;
            schemaVersion: string;
            userId: string;
          }>
        >`
          INSERT INTO privacy_export (
            id, user_id, requested_by_session_id, schema_version,
            encryption_key_version, idempotency_key_hash, canonical_request_hash,
            created_at, expires_at
          ) VALUES (
            ${exportId}::uuid, ${active.userId}::uuid, ${active.sessionId}::uuid,
            ${privacyExportSchemaVersion}, ${policy.encryptionKeyVersion},
            ${idempotencyKeyHash}, ${canonicalRequestHash}, CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + make_interval(secs => ${policy.artifactTtlSeconds})
          )
          RETURNING id, user_id AS "userId", schema_version AS "schemaVersion",
                    encryption_key_version AS "encryptionKeyVersion",
                    created_at AS "createdAt", expires_at AS "expiresAt"
        `;
        const created = inserted[0];
        if (inserted.length !== 1 || created === undefined) {
          throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
        }
        await transaction.$executeRaw`
          INSERT INTO privacy_export_audit (
            user_id, export_id, actor_session_id, action, metadata, created_at
          ) VALUES (
            ${active.userId}::uuid, ${exportId}::uuid, ${active.sessionId}::uuid,
            'requested', ${JSON.stringify({ schemaVersion: privacyExportSchemaVersion })}::jsonb,
            CURRENT_TIMESTAMP
          )
        `;
        return Object.freeze({
          kind: "created" as const,
          metadata: metadata(
            {
              ...created,
              authenticationTag: null,
              ciphertext: null,
              completedAt: null,
              failedAt: null,
              nonce: null,
              plaintextBytes: null,
              plaintextSha256: null,
              recordCount: null,
            },
            now,
          ),
          snapshot: await readSnapshot(transaction, active.userId),
          userId: active.userId,
        });
      });
    } catch (error) {
      if (error instanceof PrivacyExportError) throw error;
      throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
    }
  };

  const complete: PrivacyExportPersistence["complete"] = async (input) => {
    parseExportId(input.exportId);
    if (
      !uuidV4Pattern.test(input.userId) ||
      !(input.ciphertext instanceof Uint8Array) ||
      input.ciphertext.byteLength < 1 ||
      input.ciphertext.byteLength > maximumArtifactBytes ||
      !(input.nonce instanceof Uint8Array) ||
      input.nonce.byteLength !== 12 ||
      !(input.authenticationTag instanceof Uint8Array) ||
      input.authenticationTag.byteLength !== 16 ||
      !(input.plaintextSha256 instanceof Uint8Array) ||
      input.plaintextSha256.byteLength !== 32 ||
      !Number.isSafeInteger(input.plaintextBytes) ||
      input.plaintextBytes < 1 ||
      input.plaintextBytes > maximumArtifactBytes ||
      !Number.isSafeInteger(input.recordCount) ||
      input.recordCount < 0
    ) {
      throw new PrivacyExportError("PRIVACY_EXPORT_INVALID");
    }
    try {
      return await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.userId}, 54054))
        `;
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.exportId}, 53054))
        `;
        const requests = await transaction.$queryRaw<ExportRow[]>`
          SELECT ${exportColumns}
          ${exportJoins}
           WHERE request.id = ${input.exportId}::uuid
             AND request.user_id = ${input.userId}::uuid
             AND EXISTS (
               SELECT 1 FROM app_user AS account
                WHERE account.id = request.user_id AND account.status = 'active'
             )
             AND NOT EXISTS (
               SELECT 1 FROM privacy_deletion_request AS deletion
                WHERE deletion.user_id = request.user_id
                  AND deletion.requested_at >= request.created_at
             )
        `;
        const request = requests[0];
        const nowRows = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
        const now = nowRows[0]?.now;
        if (
          requests.length !== 1 ||
          request === undefined ||
          now === undefined ||
          request.expiresAt <= now ||
          metadata(request, now).status !== "pending"
        ) {
          throw new PrivacyExportError("PRIVACY_EXPORT_CONFLICT");
        }
        await transaction.$executeRaw`
          INSERT INTO privacy_export_artifact (
            export_id, user_id, ciphertext, nonce, authentication_tag,
            plaintext_sha256, plaintext_bytes, record_count, completed_at
          ) VALUES (
            ${input.exportId}::uuid, ${input.userId}::uuid, ${input.ciphertext},
            ${input.nonce}, ${input.authenticationTag}, ${input.plaintextSha256},
            ${input.plaintextBytes}, ${input.recordCount}, CURRENT_TIMESTAMP
          )
        `;
        await transaction.$executeRaw`
          INSERT INTO privacy_export_audit (
            user_id, export_id, actor_session_id, action, metadata, created_at
          )
          SELECT user_id, id, requested_by_session_id, 'completed',
                 ${JSON.stringify({
                   plaintextBytes: input.plaintextBytes,
                   recordCount: input.recordCount,
                   schemaVersion: privacyExportSchemaVersion,
                 })}::jsonb,
                 CURRENT_TIMESTAMP
            FROM privacy_export
           WHERE id = ${input.exportId}::uuid AND user_id = ${input.userId}::uuid
        `;
        const completedRows = await transaction.$queryRaw<ExportRow[]>`
          SELECT ${exportColumns}
          ${exportJoins}
           WHERE request.id = ${input.exportId}::uuid
             AND request.user_id = ${input.userId}::uuid
        `;
        const completed = completedRows[0];
        if (completedRows.length !== 1 || completed === undefined) {
          throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
        }
        return metadata(completed, now);
      });
    } catch (error) {
      if (error instanceof PrivacyExportError) throw error;
      throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
    }
  };

  const fail: PrivacyExportPersistence["fail"] = async (input) => {
    parseExportId(input.exportId);
    if (!uuidV4Pattern.test(input.userId) || !/^[a-z][a-z0-9_]{0,63}$/u.test(input.failureCode)) {
      throw new PrivacyExportError("PRIVACY_EXPORT_INVALID");
    }
    try {
      await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.exportId}, 53054))
        `;
        const requests = await transaction.$queryRaw<ExportRow[]>`
          SELECT ${exportColumns}
          ${exportJoins}
           WHERE request.id = ${input.exportId}::uuid
             AND request.user_id = ${input.userId}::uuid
        `;
        const request = requests[0];
        if (
          requests.length !== 1 ||
          request === undefined ||
          metadata(request).status !== "pending"
        ) {
          return;
        }
        await transaction.$executeRaw`
          INSERT INTO privacy_export_audit (
            user_id, export_id, actor_session_id, action, metadata, created_at
          )
          SELECT user_id, id, requested_by_session_id, 'failed',
                 ${JSON.stringify({ failureCode: input.failureCode })}::jsonb,
                 CURRENT_TIMESTAMP
            FROM privacy_export
           WHERE id = ${input.exportId}::uuid AND user_id = ${input.userId}::uuid
        `;
      });
    } catch (error) {
      if (error instanceof PrivacyExportError) throw error;
      throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
    }
  };

  const getOwned = async (input: {
    exportId: string;
    sessionToken: string;
  }): Promise<{ active: ActiveSession; now: Date; row: ExportRow }> =>
    database.$transaction(async (transaction) => {
      const exportId = parseExportId(input.exportId);
      const active = await resolveActiveSession(transaction, input.sessionToken);
      if (active === null) throw new PrivacyExportError("PRIVACY_EXPORT_SESSION_UNAVAILABLE");
      const rows = await transaction.$queryRaw<ExportRow[]>`
        SELECT ${exportColumns}
        ${exportJoins}
         WHERE request.id = ${exportId}::uuid
           AND request.user_id = ${active.userId}::uuid
      `;
      const row = rows[0];
      if (rows.length !== 1 || row === undefined) {
        throw new PrivacyExportError("PRIVACY_EXPORT_NOT_FOUND");
      }
      const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
        SELECT CURRENT_TIMESTAMP AS now
      `;
      const now = clocks[0]?.now;
      if (now === undefined) throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
      assertRecentAuthentication(active, now, policy);
      return { active, now, row };
    });

  const getMetadata: PrivacyExportPersistence["getMetadata"] = async (input) => {
    try {
      const owned = await getOwned(input);
      return metadata(owned.row, owned.now);
    } catch (error) {
      if (error instanceof PrivacyExportError) throw error;
      throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
    }
  };

  const authorizeDownload: PrivacyExportPersistence["authorizeDownload"] = async (input) => {
    try {
      return await database.$transaction(async (transaction) => {
        const exportId = parseExportId(input.exportId);
        const active = await resolveActiveSession(transaction, input.sessionToken);
        if (active === null) throw new PrivacyExportError("PRIVACY_EXPORT_SESSION_UNAVAILABLE");
        const rows = await transaction.$queryRaw<ExportRow[]>`
          SELECT ${exportColumns}
          ${exportJoins}
           WHERE request.id = ${exportId}::uuid
             AND request.user_id = ${active.userId}::uuid
        `;
        const row = rows[0];
        if (rows.length !== 1 || row === undefined) {
          throw new PrivacyExportError("PRIVACY_EXPORT_NOT_FOUND");
        }
        const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
        const now = clocks[0]?.now;
        if (now === undefined) throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
        assertRecentAuthentication(active, now, policy);
        if (row.expiresAt <= now) throw new PrivacyExportError("PRIVACY_EXPORT_EXPIRED");
        if (metadata(row, now).status !== "ready") {
          throw new PrivacyExportError("PRIVACY_EXPORT_NOT_READY");
        }
        if (
          row.ciphertext === null ||
          row.nonce === null ||
          row.authenticationTag === null ||
          row.plaintextSha256 === null ||
          row.plaintextBytes === null ||
          row.recordCount === null ||
          row.completedAt === null
        ) {
          throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
        }
        await transaction.$executeRaw`
          INSERT INTO privacy_export_audit (
            user_id, export_id, actor_session_id, action, metadata, created_at
          ) VALUES (
            ${active.userId}::uuid, ${row.id}::uuid, ${active.sessionId}::uuid,
            'download_authorized',
            ${JSON.stringify({ schemaVersion: privacyExportSchemaVersion })}::jsonb,
            CURRENT_TIMESTAMP
          )
        `;
        return Object.freeze({
          authenticationTag: row.authenticationTag,
          ciphertext: row.ciphertext,
          completedAt: row.completedAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
          encryptionKeyVersion: row.encryptionKeyVersion,
          expiresAt: row.expiresAt.toISOString(),
          id: row.id,
          nonce: row.nonce,
          plaintextBytes: row.plaintextBytes,
          plaintextSha256: row.plaintextSha256,
          recordCount: row.recordCount,
          schemaVersion: privacyExportSchemaVersion,
          userId: row.userId,
        });
      });
    } catch (error) {
      if (error instanceof PrivacyExportError) throw error;
      throw new PrivacyExportError("PRIVACY_EXPORT_UNAVAILABLE");
    }
  };

  return Object.freeze({ authorizeDownload, complete, fail, getMetadata, prepare });
};
