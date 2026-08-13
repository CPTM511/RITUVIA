import {
  allowsConsentPurpose,
  createConsentRecord,
  parseConsentLocale,
  parseConsentNoticeVersion,
  parseConsentPurpose,
  parseIdentityPolicyVersion,
  parseUtcInstant,
  type ConsentDecision,
  type ConsentRecord,
  type ConsentSource,
} from "@rituvia/domain";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";
import {
  bindProtectedBetaInviteAdmission,
  lockProtectedBetaInviteForAdmission,
  ProtectedBetaInviteError,
  type ProtectedBetaInvitePolicy,
} from "./protected-beta-invite.js";

const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const issuanceCanonicalInput = "rituvia.anonymous-session.create.v1:{}";
const maximumTokenAttempts = 3;
const maximumConsentHistoryRecords = 256;

export const anonymousIdentityPersistenceErrorCodes = Object.freeze([
  "ANONYMOUS_IDENTITY_UNAVAILABLE",
  "ANONYMOUS_SESSION_RATE_LIMITED",
  "ANONYMOUS_SESSION_IDEMPOTENCY_CONFLICT",
  "ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE",
  "ANONYMOUS_SESSION_UNAVAILABLE",
  "CONSENT_STATE_CONFLICT",
] as const);

export type AnonymousIdentityPersistenceErrorCode =
  (typeof anonymousIdentityPersistenceErrorCodes)[number];

const persistenceMessage = (code: AnonymousIdentityPersistenceErrorCode): string => {
  switch (code) {
    case "ANONYMOUS_IDENTITY_UNAVAILABLE":
      return "Anonymous identity storage is unavailable.";
    case "ANONYMOUS_SESSION_RATE_LIMITED":
      return "Anonymous session capacity is temporarily limited.";
    case "ANONYMOUS_SESSION_IDEMPOTENCY_CONFLICT":
      return "The anonymous session request conflicts.";
    case "ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE":
      return "The anonymous session request cannot be replayed without its session cookie.";
    case "ANONYMOUS_SESSION_UNAVAILABLE":
      return "The anonymous session is unavailable.";
    case "CONSENT_STATE_CONFLICT":
      return "The consent state conflicts with a concurrent request.";
  }
};

export class AnonymousIdentityPersistenceError extends Error {
  readonly code: AnonymousIdentityPersistenceErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: AnonymousIdentityPersistenceErrorCode, retryAfterSeconds?: number) {
    super(persistenceMessage(code));
    this.name = "AnonymousIdentityPersistenceError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type AnonymousSessionPolicy = Readonly<{
  issuanceLimit: number;
  issuanceWindowSeconds: number;
  policyVersion: string;
  ttlSeconds: number;
}>;

export type AnonymousSessionContext = Readonly<{
  expiresAt: string;
  sessionId: string;
  subjectId: string;
}>;

export type EnsuredAnonymousSession =
  | Readonly<{
      context: AnonymousSessionContext;
      kind: "created";
      token: string;
    }>
  | Readonly<{
      context: AnonymousSessionContext;
      kind: "resumed";
    }>;

export type AnonymousIdentityService = Readonly<{
  allowsConsent(input: { noticeVersion: string; purpose: string; token: string }): Promise<boolean>;
  ensureSession(input: {
    idempotencyKey: string;
    inviteToken?: string | undefined;
    token?: string | undefined;
  }): Promise<EnsuredAnonymousSession>;
  recordConsent(input: {
    decision: ConsentDecision;
    idempotencyKey: string;
    locale: string;
    noticeVersion: string;
    purpose: string;
    source: ConsentSource;
    token: string;
  }): Promise<ConsentRecord>;
  revokeSession(token: string): Promise<boolean>;
  resolveSession(token: string): Promise<AnonymousSessionContext | null>;
}>;

type IdentityPrivilegeAttestation = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canDeleteIdentity: boolean;
  canInsertConsent: boolean;
  canInsertGate: boolean;
  canInsertRateLimit: boolean;
  canInsertInvite: boolean;
  canInsertInviteCohort: boolean;
  canInsertSession: boolean;
  canInsertSubject: boolean;
  canReadIdentity: boolean;
  canReadRateLimit: boolean;
  canReadInvite: boolean;
  canReadRestrictedInvite: boolean;
  canUpdateConsent: boolean;
  canUpdateGate: boolean;
  canUpdateRestrictedGate: boolean;
  canUpdateRateLimit: boolean;
  canUpdateRestrictedRateLimit: boolean;
  canUpdateInviteConsumption: boolean;
  canUpdateRestrictedInvite: boolean;
  canUpdateInviteCohort: boolean;
  canUpdateRestrictedSession: boolean;
  canUpdateRestrictedSubject: boolean;
  canUpdateSessionLifecycle: boolean;
  canUpdateSubjectLastSeen: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachableOwnerOrPrivilegedRole: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
}>;

export const assertAnonymousIdentityRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<IdentityPrivilegeAttestation[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             ARRAY(
               SELECT relowner
                 FROM pg_class
                WHERE oid = ANY(ARRAY[
                  'public.anonymous_subject'::regclass,
                  'public.anonymous_session'::regclass,
                  'public.consent_record'::regclass,
                  'public.anonymous_session_issuance_gate'::regclass,
                  'public.anonymous_session_rate_limit'::regclass,
                  'public.protected_beta_invite_cohort'::regclass,
                  'public.protected_beta_invite'::regclass
                ])
             ) AS table_owner_oids
    ), reachable_roles AS (
      SELECT role.*
        FROM pg_roles AS role
       WHERE role.rolname = current_user
          OR pg_has_role(current_user, role.oid, 'MEMBER')
    )
    SELECT current_user AS "roleName",
           session_user AS "sessionRoleName",
           pg_get_userbyid(owners.database_owner_oid) AS "databaseOwner",
           pg_get_userbyid(owners.schema_owner_oid) AS "schemaOwner",
           has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           (has_table_privilege(current_user, 'public.anonymous_subject', 'SELECT')
             AND has_table_privilege(current_user, 'public.anonymous_session', 'SELECT')
             AND has_table_privilege(current_user, 'public.consent_record', 'SELECT')
             AND has_table_privilege(current_user, 'public.anonymous_session_issuance_gate', 'SELECT')) AS "canReadIdentity",
           has_table_privilege(current_user, 'public.anonymous_session_rate_limit', 'SELECT') AS "canReadRateLimit",
           (has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'policy_version', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'cohort_limit', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'issued_count', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'id', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'policy_version', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'token_hash', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'token_hash_version', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'expires_at', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'consumed_at', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'anonymous_session_id', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'revoked_at', 'SELECT')) AS "canReadInvite",
           (has_column_privilege(current_user, 'public.protected_beta_invite', 'creation_key_hash', 'SELECT')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_creation_hash', 'SELECT')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'revocation_key_hash', 'SELECT')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_revocation_hash', 'SELECT')) AS "canReadRestrictedInvite",
           has_table_privilege(current_user, 'public.anonymous_subject', 'INSERT') AS "canInsertSubject",
           has_column_privilege(current_user, 'public.anonymous_subject', 'last_seen_at', 'UPDATE') AS "canUpdateSubjectLastSeen",
           (has_column_privilege(current_user, 'public.anonymous_subject', 'expires_at', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_subject', 'expiry_policy_version', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_subject', 'id', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_subject', 'created_at', 'UPDATE')) AS "canUpdateRestrictedSubject",
           has_table_privilege(current_user, 'public.anonymous_session', 'INSERT') AS "canInsertSession",
           (has_column_privilege(current_user, 'public.anonymous_session', 'last_seen_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.anonymous_session', 'revoked_at', 'UPDATE')) AS "canUpdateSessionLifecycle",
           (has_column_privilege(current_user, 'public.anonymous_session', 'token_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'anonymous_subject_id', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'expires_at', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'id', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'token_hash_version', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'issuance_key_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'canonical_request_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'expiry_policy_version', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'created_at', 'UPDATE')) AS "canUpdateRestrictedSession",
           has_table_privilege(current_user, 'public.consent_record', 'INSERT') AS "canInsertConsent",
           (has_table_privilege(current_user, 'public.consent_record', 'UPDATE')
             OR has_any_column_privilege(current_user, 'public.consent_record', 'UPDATE')) AS "canUpdateConsent",
           has_table_privilege(current_user, 'public.anonymous_session_issuance_gate', 'INSERT') AS "canInsertGate",
           (has_column_privilege(current_user, 'public.anonymous_session_issuance_gate', 'window_started_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.anonymous_session_issuance_gate', 'issued_count', 'UPDATE')) AS "canUpdateGate",
           has_column_privilege(current_user, 'public.anonymous_session_issuance_gate', 'id', 'UPDATE') AS "canUpdateRestrictedGate",
           has_table_privilege(current_user, 'public.anonymous_session_rate_limit', 'INSERT') AS "canInsertRateLimit",
           (has_column_privilege(current_user, 'public.anonymous_session_rate_limit', 'window_started_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.anonymous_session_rate_limit', 'request_count', 'UPDATE')
             AND has_column_privilege(current_user, 'public.anonymous_session_rate_limit', 'policy_version', 'UPDATE')) AS "canUpdateRateLimit",
           (has_column_privilege(current_user, 'public.anonymous_session_rate_limit', 'anonymous_session_id', 'UPDATE')
             OR has_column_privilege(current_user, 'public.anonymous_session_rate_limit', 'scope', 'UPDATE')) AS "canUpdateRestrictedRateLimit",
           has_table_privilege(current_user, 'public.protected_beta_invite_cohort', 'INSERT') AS "canInsertInviteCohort",
           (has_table_privilege(current_user, 'public.protected_beta_invite_cohort', 'UPDATE')
             OR has_any_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'UPDATE')) AS "canUpdateInviteCohort",
           has_table_privilege(current_user, 'public.protected_beta_invite', 'INSERT') AS "canInsertInvite",
           (has_column_privilege(current_user, 'public.protected_beta_invite', 'consumed_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'anonymous_session_id', 'UPDATE')) AS "canUpdateInviteConsumption",
           (has_column_privilege(current_user, 'public.protected_beta_invite', 'token_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'token_hash_version', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'policy_version', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'seat_number', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'creation_key_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_creation_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'created_at', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'expires_at', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'revoked_at', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'revocation_key_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_revocation_hash', 'UPDATE')) AS "canUpdateRestrictedInvite",
           (has_table_privilege(current_user, 'public.anonymous_subject', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.anonymous_session', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.consent_record', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.anonymous_session_issuance_gate', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.anonymous_session_rate_limit', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.protected_beta_invite_cohort', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.protected_beta_invite', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')) AS "canDeleteIdentity",
           (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
              FROM pg_roles WHERE rolname = current_user) AS "privilegedRole",
           EXISTS (
             SELECT 1
               FROM reachable_roles AS role
              WHERE role.rolsuper
                 OR role.rolcreatedb
                 OR role.rolcreaterole
                 OR role.rolreplication
                 OR role.rolbypassrls
                 OR role.oid = owners.database_owner_oid
                 OR role.oid = owners.schema_owner_oid
                 OR role.oid = ANY(owners.table_owner_oids)
                 OR has_database_privilege(role.oid, current_database(), 'CREATE')
                 OR has_schema_privilege(role.oid, 'public', 'CREATE')
           ) AS "reachableOwnerOrPrivilegedRole"
      FROM owners
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    row.sessionRoleName !== row.roleName ||
    row.roleName === row.databaseOwner ||
    row.roleName === row.schemaOwner ||
    row.canCreateInDatabase ||
    row.canCreateInSchema ||
    row.canDeleteIdentity ||
    !row.canInsertConsent ||
    !row.canInsertGate ||
    !row.canInsertRateLimit ||
    row.canInsertInvite ||
    row.canInsertInviteCohort ||
    !row.canInsertSession ||
    !row.canInsertSubject ||
    !row.canReadIdentity ||
    !row.canReadRateLimit ||
    !row.canReadInvite ||
    row.canReadRestrictedInvite ||
    row.canUpdateConsent ||
    !row.canUpdateGate ||
    row.canUpdateRestrictedGate ||
    !row.canUpdateRateLimit ||
    row.canUpdateRestrictedRateLimit ||
    !row.canUpdateInviteConsumption ||
    row.canUpdateRestrictedInvite ||
    row.canUpdateInviteCohort ||
    row.canUpdateRestrictedSession ||
    row.canUpdateRestrictedSubject ||
    !row.canUpdateSessionLifecycle ||
    !row.canUpdateSubjectLastSeen ||
    row.privilegedRole ||
    row.reachableOwnerOrPrivilegedRole
  ) {
    throw new TypeError("Anonymous identity runtime database privileges are unsafe.");
  }
};

const validatePolicy = (policy: AnonymousSessionPolicy): AnonymousSessionPolicy => {
  parseIdentityPolicyVersion(policy.policyVersion);
  if (
    !Number.isSafeInteger(policy.ttlSeconds) ||
    policy.ttlSeconds < 1 ||
    policy.ttlSeconds > 34_560_000 ||
    !Number.isSafeInteger(policy.issuanceLimit) ||
    policy.issuanceLimit < 1 ||
    policy.issuanceLimit > 100_000 ||
    !Number.isSafeInteger(policy.issuanceWindowSeconds) ||
    policy.issuanceWindowSeconds < 1 ||
    policy.issuanceWindowSeconds > 3_600
  ) {
    throw new TypeError("Anonymous session policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const tokenBytes = (token: string): Uint8Array | null => {
  if (!sessionTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  return bytes.byteLength === 32 && bytes.toString("base64url") === token ? bytes : null;
};

const newToken = (): Readonly<{ bytes: Uint8Array; token: string }> => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const token = Buffer.from(bytes).toString("base64url");
  if (!sessionTokenPattern.test(token)) {
    throw new AnonymousIdentityPersistenceError("ANONYMOUS_IDENTITY_UNAVAILABLE");
  }
  return Object.freeze({ bytes, token });
};

const protectedBetaSessionToken = async (
  inviteToken: string,
): Promise<Readonly<{ bytes: Uint8Array; token: string }>> => {
  const bytes = await sha256(`rituvia.protected-beta.session-token.v1:${inviteToken}`);
  return Object.freeze({ bytes, token: Buffer.from(bytes).toString("base64url") });
};

const sha256 = async (value: Uint8Array | string): Promise<Uint8Array<ArrayBuffer>> => {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const bytes = Uint8Array.from(source) as Uint8Array<ArrayBuffer>;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest) as Uint8Array<ArrayBuffer>;
};

const parseIdempotencyKey = (value: string): string => {
  if (!idempotencyKeyPattern.test(value)) {
    throw new TypeError("Idempotency key is invalid.");
  }
  return value;
};

const context = (row: {
  expiresAt: Date;
  sessionId: string;
  subjectId: string;
}): AnonymousSessionContext =>
  Object.freeze({
    expiresAt: row.expiresAt.toISOString(),
    sessionId: row.sessionId,
    subjectId: row.subjectId,
  });

type ActiveSessionRow = Readonly<{
  expiresAt: Date;
  sessionId: string;
  subjectId: string;
}>;

const resolveActiveSession = async (
  database: PrismaClient | Prisma.TransactionClient,
  token: string,
  requiredInvitePolicyVersion?: string | undefined,
): Promise<AnonymousSessionContext | null> => {
  const bytes = tokenBytes(token);
  if (bytes === null) return null;
  const hash = await sha256(bytes);
  const rows = await database.$queryRaw<ActiveSessionRow[]>`
    WITH active AS MATERIALIZED (
      SELECT session.id AS "sessionId",
             session.anonymous_subject_id AS "subjectId",
             session.expires_at AS "expiresAt"
        FROM anonymous_session AS session
        JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
       WHERE session.token_hash = ${hash}
         AND session.token_hash_version = 1
         AND session.revoked_at IS NULL
         AND session.expires_at > CURRENT_TIMESTAMP
         AND subject.expires_at > CURRENT_TIMESTAMP
         AND (
           ${requiredInvitePolicyVersion ?? null}::text IS NULL
           OR EXISTS (
             SELECT 1
               FROM protected_beta_invite AS invite
              WHERE invite.anonymous_session_id = session.id
                AND invite.policy_version = ${requiredInvitePolicyVersion ?? null}::text
                AND invite.consumed_at IS NOT NULL
                AND invite.revoked_at IS NULL
           )
         )
       FOR UPDATE OF session, subject
    ), touched_subject AS (
      UPDATE anonymous_subject AS subject
         SET last_seen_at = CURRENT_TIMESTAMP
        FROM active
       WHERE subject.id = active."subjectId"
       RETURNING subject.id
    ), touched_session AS (
      UPDATE anonymous_session AS session
         SET last_seen_at = CURRENT_TIMESTAMP
        FROM active
       WHERE session.id = active."sessionId"
       RETURNING session.id
    )
    SELECT active."sessionId", active."subjectId", active."expiresAt"
      FROM active
      JOIN touched_subject ON touched_subject.id = active."subjectId"
      JOIN touched_session ON touched_session.id = active."sessionId"
  `;
  return rows.length === 1 && rows[0] !== undefined ? context(rows[0]) : null;
};

type GateRow = Readonly<{
  allowed: boolean;
  observedAt: Date;
  windowStartedAt: Date;
}>;

const consumeIssuanceCapacity = async (
  transaction: Prisma.TransactionClient,
  policy: AnonymousSessionPolicy,
): Promise<Date> => {
  const rows = await transaction.$queryRaw<GateRow[]>`
    WITH attempted AS (
      INSERT INTO anonymous_session_issuance_gate (id, window_started_at, issued_count)
      VALUES (1, CURRENT_TIMESTAMP, 1)
      ON CONFLICT (id) DO UPDATE
        SET window_started_at = CASE
              WHEN anonymous_session_issuance_gate.window_started_at
                   + make_interval(secs => ${policy.issuanceWindowSeconds}) <= CURRENT_TIMESTAMP
                THEN CURRENT_TIMESTAMP
              ELSE anonymous_session_issuance_gate.window_started_at
            END,
            issued_count = CASE
              WHEN anonymous_session_issuance_gate.window_started_at
                   + make_interval(secs => ${policy.issuanceWindowSeconds}) <= CURRENT_TIMESTAMP
                THEN 1
              ELSE anonymous_session_issuance_gate.issued_count + 1
            END
      WHERE anonymous_session_issuance_gate.window_started_at
                + make_interval(secs => ${policy.issuanceWindowSeconds}) <= CURRENT_TIMESTAMP
         OR anonymous_session_issuance_gate.issued_count < ${policy.issuanceLimit}
      RETURNING true AS allowed,
                CURRENT_TIMESTAMP AS "observedAt",
                window_started_at AS "windowStartedAt"
    )
    SELECT allowed, "observedAt", "windowStartedAt" FROM attempted
    UNION ALL
    SELECT false AS allowed,
           CURRENT_TIMESTAMP AS "observedAt",
           window_started_at AS "windowStartedAt"
      FROM anonymous_session_issuance_gate
     WHERE NOT EXISTS (SELECT 1 FROM attempted)
     LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) {
    throw new AnonymousIdentityPersistenceError("ANONYMOUS_IDENTITY_UNAVAILABLE");
  }
  if (!row.allowed) {
    const retryAt = row.windowStartedAt.getTime() + policy.issuanceWindowSeconds * 1_000;
    const retryAfterSeconds = Math.max(1, Math.ceil((retryAt - row.observedAt.getTime()) / 1_000));
    throw new AnonymousIdentityPersistenceError(
      "ANONYMOUS_SESSION_RATE_LIMITED",
      retryAfterSeconds,
    );
  }
  return row.observedAt;
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const persistedConsent = (record: {
  decision: string;
  locale: string;
  noticeVersion: string;
  purpose: string;
  recordedAt: Date;
  sequence: number;
  source: string;
}): ConsentRecord => {
  if (
    !(["granted", "denied", "withdrawn"] as const).includes(record.decision as ConsentDecision) ||
    !(["first_party_consent_surface", "privacy_controls"] as const).includes(
      record.source as ConsentSource,
    ) ||
    !Number.isSafeInteger(record.sequence) ||
    record.sequence <= 0
  ) {
    throw new AnonymousIdentityPersistenceError("ANONYMOUS_IDENTITY_UNAVAILABLE");
  }
  return Object.freeze({
    decision: record.decision as ConsentDecision,
    locale: parseConsentLocale(record.locale),
    noticeVersion: parseConsentNoticeVersion(record.noticeVersion),
    purpose: parseConsentPurpose(record.purpose),
    recordedAt: parseUtcInstant(record.recordedAt.toISOString()),
    sequence: record.sequence,
    source: record.source as ConsentSource,
  });
};

const isUniqueConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2002" ||
    error.code === "23505" ||
    (error.code === "P2010" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("Code: `23505`")));

export const createAnonymousIdentityService = (
  database: PrismaClient,
  rawPolicy: AnonymousSessionPolicy,
  protectedBetaInvitePolicy?: ProtectedBetaInvitePolicy | undefined,
): AnonymousIdentityService => {
  const policy = validatePolicy(rawPolicy);

  const resolveSession = async (token: string): Promise<AnonymousSessionContext | null> => {
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    return database.$transaction((transaction) =>
      resolveActiveSession(transaction, token, protectedBetaInvitePolicy?.policyVersion),
    );
  };

  const revokeSession = async (token: string): Promise<boolean> => {
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    const bytes = tokenBytes(token);
    if (bytes === null) return false;
    const tokenHash = await sha256(bytes);
    const rows = await database.$queryRaw<Array<{ sessionId: string }>>`
      UPDATE anonymous_session AS session
         SET revoked_at = CURRENT_TIMESTAMP
       WHERE session.token_hash = ${tokenHash}
         AND session.token_hash_version = 1
         AND session.revoked_at IS NULL
         AND session.expires_at > CURRENT_TIMESTAMP
         AND EXISTS (
           SELECT 1
             FROM anonymous_subject AS subject
            WHERE subject.id = session.anonymous_subject_id
              AND subject.expires_at > CURRENT_TIMESTAMP
         )
       RETURNING session.id AS "sessionId"
    `;
    return rows.length === 1;
  };

  const ensureSession: AnonymousIdentityService["ensureSession"] = async ({
    idempotencyKey: rawIdempotencyKey,
    inviteToken,
    token,
  }) => {
    const idempotencyKey = parseIdempotencyKey(rawIdempotencyKey);
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    if (token !== undefined) {
      const active = await database.$transaction((transaction) =>
        resolveActiveSession(transaction, token, protectedBetaInvitePolicy?.policyVersion),
      );
      if (active !== null) return Object.freeze({ context: active, kind: "resumed" });
    }

    const protectedSessionMaterial =
      protectedBetaInvitePolicy === undefined || inviteToken === undefined
        ? undefined
        : await protectedBetaSessionToken(inviteToken);

    const canonicalInput =
      protectedBetaInvitePolicy === undefined
        ? issuanceCanonicalInput
        : JSON.stringify({
            inviteTokenEvidence: Buffer.from(await sha256(inviteToken ?? "")).toString("hex"),
            policyVersion: protectedBetaInvitePolicy.policyVersion,
            schemaVersion: "rituvia.anonymous-session.protected-beta.v1",
          });
    const [issuanceKeyHash, canonicalRequestHash] = await Promise.all([
      sha256(idempotencyKey),
      sha256(canonicalInput),
    ]);
    const replay = await database.anonymousSession.findUnique({
      select: { canonicalRequestHash: true },
      where: { issuanceKeyHash },
    });
    if (replay !== null) {
      if (!bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)) {
        throw new AnonymousIdentityPersistenceError("ANONYMOUS_SESSION_IDEMPOTENCY_CONFLICT");
      }
      if (protectedSessionMaterial !== undefined) {
        const recovered = await database.$transaction((transaction) =>
          resolveActiveSession(
            transaction,
            protectedSessionMaterial.token,
            protectedBetaInvitePolicy?.policyVersion,
          ),
        );
        if (recovered !== null) {
          return Object.freeze({
            context: recovered,
            kind: "created",
            token: protectedSessionMaterial.token,
          });
        }
      }
      throw new AnonymousIdentityPersistenceError("ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE");
    }

    for (let attempt = 0; attempt < maximumTokenAttempts; attempt += 1) {
      const material = protectedSessionMaterial ?? newToken();
      const tokenHash = await sha256(material.bytes);
      try {
        const created = await database.$transaction(async (transaction) => {
          const lockedInvite =
            protectedBetaInvitePolicy === undefined
              ? undefined
              : await lockProtectedBetaInviteForAdmission(
                  transaction,
                  protectedBetaInvitePolicy,
                  inviteToken,
                );
          const observedAt = await consumeIssuanceCapacity(transaction, policy);
          const expiresAt = new Date(observedAt.getTime() + policy.ttlSeconds * 1_000);
          const subject = await transaction.anonymousSubject.create({
            data: {
              createdAt: observedAt,
              expiresAt,
              expiryPolicyVersion: policy.policyVersion,
              lastSeenAt: observedAt,
            },
            select: { id: true },
          });
          const session = await transaction.anonymousSession.create({
            data: {
              anonymousSubjectId: subject.id,
              canonicalRequestHash,
              createdAt: observedAt,
              expiresAt,
              expiryPolicyVersion: policy.policyVersion,
              issuanceKeyHash,
              lastSeenAt: observedAt,
              tokenHash,
            },
            select: { expiresAt: true, id: true },
          });
          if (lockedInvite !== undefined) {
            await bindProtectedBetaInviteAdmission(transaction, lockedInvite.inviteId, session.id);
          }
          return context({
            expiresAt: session.expiresAt,
            sessionId: session.id,
            subjectId: subject.id,
          });
        });
        return Object.freeze({ context: created, kind: "created", token: material.token });
      } catch (error) {
        if (
          error instanceof AnonymousIdentityPersistenceError ||
          error instanceof ProtectedBetaInviteError
        ) {
          throw error;
        }
        if (isUniqueConflict(error)) {
          const existing = await database.anonymousSession.findUnique({
            select: { canonicalRequestHash: true },
            where: { issuanceKeyHash },
          });
          if (existing !== null) {
            if (!bytesEqual(existing.canonicalRequestHash, canonicalRequestHash)) {
              throw new AnonymousIdentityPersistenceError("ANONYMOUS_SESSION_IDEMPOTENCY_CONFLICT");
            }
            if (protectedSessionMaterial !== undefined) {
              const recovered = await database.$transaction((transaction) =>
                resolveActiveSession(
                  transaction,
                  protectedSessionMaterial.token,
                  protectedBetaInvitePolicy?.policyVersion,
                ),
              );
              if (recovered !== null) {
                return Object.freeze({
                  context: recovered,
                  kind: "created",
                  token: protectedSessionMaterial.token,
                });
              }
            }
            throw new AnonymousIdentityPersistenceError("ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE");
          }
          continue;
        }
        throw new AnonymousIdentityPersistenceError("ANONYMOUS_IDENTITY_UNAVAILABLE");
      }
    }
    throw new AnonymousIdentityPersistenceError("ANONYMOUS_IDENTITY_UNAVAILABLE");
  };

  const recordConsent: AnonymousIdentityService["recordConsent"] = async (input) => {
    const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
    const purpose = parseConsentPurpose(input.purpose);
    const noticeVersion = parseConsentNoticeVersion(input.noticeVersion);
    const locale = parseConsentLocale(input.locale);
    if (!(["granted", "denied", "withdrawn"] as const).includes(input.decision)) {
      throw new TypeError("Consent decision is invalid.");
    }
    if (!(["first_party_consent_surface", "privacy_controls"] as const).includes(input.source)) {
      throw new TypeError("Consent source is invalid.");
    }
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    const token = tokenBytes(input.token);
    if (token === null) {
      throw new AnonymousIdentityPersistenceError("ANONYMOUS_SESSION_UNAVAILABLE");
    }
    const [tokenHash, idempotencyKeyHash] = await Promise.all([
      sha256(token),
      sha256(idempotencyKey),
    ]);
    const canonicalRequestHash = await sha256(
      JSON.stringify({
        decision: input.decision,
        locale,
        noticeVersion,
        purpose,
        source: input.source,
      }),
    );

    return database.$transaction(async (transaction) => {
      const active = await transaction.$queryRaw<Array<Readonly<{ subjectId: string }>>>`
        SELECT subject.id AS "subjectId"
          FROM anonymous_session AS session
          JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
         WHERE session.token_hash = ${tokenHash}
           AND session.revoked_at IS NULL
           AND session.expires_at > CURRENT_TIMESTAMP
           AND subject.expires_at > CURRENT_TIMESTAMP
         FOR UPDATE OF subject
      `;
      const subjectId = active[0]?.subjectId;
      if (active.length !== 1 || subjectId === undefined) {
        throw new AnonymousIdentityPersistenceError("ANONYMOUS_SESSION_UNAVAILABLE");
      }
      const replay = await transaction.consentRecord.findUnique({
        select: {
          canonicalRequestHash: true,
          decision: true,
          locale: true,
          noticeVersion: true,
          purpose: true,
          recordedAt: true,
          sequence: true,
          source: true,
        },
        where: {
          anonymousSubjectId_idempotencyKeyHash: {
            anonymousSubjectId: subjectId,
            idempotencyKeyHash,
          },
        },
      });
      if (replay !== null) {
        if (!bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)) {
          throw new AnonymousIdentityPersistenceError("CONSENT_STATE_CONFLICT");
        }
        return persistedConsent(replay);
      }
      const previous = await transaction.consentRecord.findFirst({
        orderBy: { sequence: "desc" },
        select: {
          decision: true,
          id: true,
          locale: true,
          noticeVersion: true,
          purpose: true,
          recordedAt: true,
          sequence: true,
          source: true,
        },
        where: { anonymousSubjectId: subjectId, purpose },
      });
      const [databaseTime] = await transaction.$queryRaw<Array<{ recordedAt: Date }>>`
        SELECT CURRENT_TIMESTAMP AS "recordedAt"
      `;
      if (databaseTime === undefined) {
        throw new AnonymousIdentityPersistenceError("ANONYMOUS_IDENTITY_UNAVAILABLE");
      }
      const next = createConsentRecord({
        decision: input.decision,
        locale,
        noticeVersion,
        previous: previous === null ? null : persistedConsent(previous),
        purpose,
        recordedAt: databaseTime.recordedAt.toISOString(),
        sequence: (previous?.sequence ?? 0) + 1,
        source: input.source,
      });
      const persisted = await transaction.consentRecord.create({
        data: {
          anonymousSubjectId: subjectId,
          canonicalRequestHash,
          decision: next.decision,
          idempotencyKeyHash,
          locale: next.locale,
          noticeVersion: next.noticeVersion,
          purpose: next.purpose,
          sequence: next.sequence,
          source: next.source,
          withdrawsRecordId: next.decision === "withdrawn" ? (previous?.id ?? null) : null,
        },
        select: { recordedAt: true },
      });
      return Object.freeze({
        ...next,
        recordedAt: parseUtcInstant(persisted.recordedAt.toISOString()),
      });
    });
  };

  const allowsConsent: AnonymousIdentityService["allowsConsent"] = async (input) => {
    const purpose = parseConsentPurpose(input.purpose);
    const noticeVersion = parseConsentNoticeVersion(input.noticeVersion);
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    return database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(
        transaction,
        input.token,
        protectedBetaInvitePolicy?.policyVersion,
      );
      if (active === null) return false;
      const databaseTimes = await transaction.$queryRaw<Array<{ observedAt: Date }>>`
        SELECT CURRENT_TIMESTAMP AS "observedAt"
      `;
      const observedAt = databaseTimes[0]?.observedAt;
      if (observedAt === undefined) return false;
      const history = await transaction.consentRecord.findMany({
        orderBy: { sequence: "asc" },
        select: {
          decision: true,
          id: true,
          locale: true,
          noticeVersion: true,
          purpose: true,
          recordedAt: true,
          sequence: true,
          source: true,
          withdrawsRecordId: true,
        },
        take: maximumConsentHistoryRecords + 1,
        where: { anonymousSubjectId: active.subjectId, purpose },
      });
      if (history.length > maximumConsentHistoryRecords) return false;

      let current: ConsentRecord | null = null;
      let currentId: string | null = null;
      let expectedSequence = 1;
      for (const row of history) {
        if (
          row.sequence !== expectedSequence ||
          row.recordedAt.getTime() > observedAt.getTime() ||
          (current !== null && row.recordedAt.toISOString() < current.recordedAt) ||
          (row.decision === "withdrawn"
            ? currentId === null || row.withdrawsRecordId !== currentId
            : row.withdrawsRecordId !== null)
        ) {
          return false;
        }
        try {
          current = createConsentRecord({
            decision: row.decision,
            locale: row.locale,
            noticeVersion: row.noticeVersion,
            previous: current,
            purpose: row.purpose,
            recordedAt: row.recordedAt.toISOString(),
            sequence: row.sequence,
            source: row.source,
          });
        } catch {
          return false;
        }
        currentId = row.id;
        expectedSequence += 1;
      }
      return allowsConsentPurpose(current, purpose, noticeVersion);
    });
  };

  return Object.freeze({
    allowsConsent,
    ensureSession,
    recordConsent,
    resolveSession,
    revokeSession,
  });
};
