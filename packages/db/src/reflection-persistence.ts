import {
  parseReflectionIntentionCreateRequestV1,
  parseReflectionJournalCreateRequestV1,
  parseReflectionRitualCreateRequestV1,
  reflectionIntentionSchemaVersion,
  reflectionJournalSchemaVersion,
  reflectionPolicyVersion,
  reflectionRitualSchemaVersion,
  type ReflectionIntentionCreateRequestV1,
  type ReflectionIntentionCode,
  type ReflectionJournalCreateRequestV1,
  type ReflectionRitualCreateRequestV1,
  type ReflectionRitualObjectCode,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { assertAnonymousIdentityRuntimeDatabasePrivileges } from "./anonymous-identity.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const maximumCiphertextBytes = 4_096;

export const reflectionPersistenceErrorCodes = Object.freeze([
  "REFLECTION_SESSION_UNAVAILABLE",
  "REFLECTION_NOT_FOUND",
  "REFLECTION_CHAIN_INVALID",
  "REFLECTION_IDEMPOTENCY_CONFLICT",
  "REFLECTION_RITUAL_DAILY_LIMIT",
  "REFLECTION_PERSISTENCE_UNAVAILABLE",
] as const);

export type ReflectionPersistenceErrorCode = (typeof reflectionPersistenceErrorCodes)[number];

export class ReflectionPersistenceError extends Error {
  readonly code: ReflectionPersistenceErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ReflectionPersistenceErrorCode, retryAfterSeconds?: number) {
    super("The private reflection operation is unavailable.");
    this.name = "ReflectionPersistenceError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type ReflectionPersistencePolicy = Readonly<{
  policyVersion: typeof reflectionPolicyVersion;
  retentionSeconds: number;
  revisitDelaySeconds: number;
}>;

export type ReflectionCiphertext = Readonly<{
  ciphertext: Uint8Array;
  keyVersion: string;
  nonce: Uint8Array;
  tag: Uint8Array;
}>;

export type PreparedReflectionCreate = Readonly<{
  canonicalRequestDigest: string;
  idempotencyKeyDigest: string;
  idempotencyKeyVersion: string;
}>;

export type PreparedPrivateReflectionCreate = PreparedReflectionCreate &
  Readonly<{ encrypted: ReflectionCiphertext }>;

export type ReflectionPrepareContext<Request> = Readonly<{
  request: Request;
  subjectId: string;
}>;

export type ReflectionPrincipalTokens = Readonly<{
  accountSessionToken?: string | undefined;
  anonymousSessionToken?: string | undefined;
}>;

export type PersistedReflectionIntention = Readonly<{
  createdAt: string;
  encryptedSmallAction: ReflectionCiphertext;
  expiresAt: string;
  id: string;
  intentionCode: ReflectionIntentionCode;
  locale: "en";
  policyVersion: typeof reflectionPolicyVersion;
  readingId: string | null;
  schemaVersion: typeof reflectionIntentionSchemaVersion;
  subjectId: string;
}>;

export type PersistedReflectionRitual = Readonly<{
  completedAt: string;
  expiresAt: string;
  id: string;
  intentionId: string;
  objectCode: ReflectionRitualObjectCode;
  policyVersion: typeof reflectionPolicyVersion;
  ritualDateUtc: string;
  schemaVersion: typeof reflectionRitualSchemaVersion;
  subjectId: string;
}>;

export type PersistedReflectionJournal = Readonly<{
  createdAt: string;
  encryptedReflection: ReflectionCiphertext;
  expiresAt: string;
  id: string;
  intentionId: string;
  policyVersion: typeof reflectionPolicyVersion;
  revisitAt: string;
  ritualSessionId: string;
  schemaVersion: typeof reflectionJournalSchemaVersion;
  subjectId: string;
}>;

export type ResolvedReflectionIntention = Readonly<{
  intention: PersistedReflectionIntention;
  kind: "created" | "replayed";
}>;
export type ResolvedReflectionRitual = Readonly<{
  kind: "created" | "replayed";
  ritual: PersistedReflectionRitual;
}>;
export type ResolvedReflectionJournal = Readonly<{
  journal: PersistedReflectionJournal;
  kind: "created" | "replayed";
}>;

export type ReflectionPersistence = Readonly<{
  getIntention(
    input: Readonly<{ id: string; principal: ReflectionPrincipalTokens }>,
  ): Promise<PersistedReflectionIntention | null>;
  getJournal(
    input: Readonly<{ id: string; principal: ReflectionPrincipalTokens }>,
  ): Promise<PersistedReflectionJournal | null>;
  getRitual(
    input: Readonly<{ id: string; principal: ReflectionPrincipalTokens }>,
  ): Promise<PersistedReflectionRitual | null>;
  resolveIntention(
    input: Readonly<{
      prepare: (
        context: ReflectionPrepareContext<ReflectionIntentionCreateRequestV1>,
      ) => Promise<PreparedPrivateReflectionCreate> | PreparedPrivateReflectionCreate;
      request: unknown;
      principal: ReflectionPrincipalTokens;
    }>,
  ): Promise<ResolvedReflectionIntention>;
  resolveJournal(
    input: Readonly<{
      prepare: (
        context: ReflectionPrepareContext<ReflectionJournalCreateRequestV1>,
      ) => Promise<PreparedPrivateReflectionCreate> | PreparedPrivateReflectionCreate;
      request: unknown;
      principal: ReflectionPrincipalTokens;
    }>,
  ): Promise<ResolvedReflectionJournal>;
  resolveRitual(
    input: Readonly<{
      prepare: (
        context: ReflectionPrepareContext<ReflectionRitualCreateRequestV1>,
      ) => Promise<PreparedReflectionCreate> | PreparedReflectionCreate;
      request: unknown;
      principal: ReflectionPrincipalTokens;
    }>,
  ): Promise<ResolvedReflectionRitual>;
}>;

type ActiveSessionRow = Readonly<{
  expiresAt: Date;
  observedAt: Date;
  subjectId: string;
}>;

type ActiveAccountSessionRow = Readonly<{
  expiresAt: Date;
  observedAt: Date;
  userId: string;
}>;

type ActiveReflectionPrincipal =
  | Readonly<{
      expiresAt: Date;
      kind: "anonymous";
      observedAt: Date;
      subjectId: string;
    }>
  | Readonly<{
      expiresAt: Date;
      kind: "account";
      observedAt: Date;
      userId: string;
    }>;

type ReadingOwnerRow = Readonly<{ expiresAt: Date; id: string; subjectId: string }>;
type IntentionOwnerRow = Readonly<{ expiresAt: Date; subjectId: string }>;

type IntentionRow = Readonly<{
  canonicalRequestHash: Uint8Array;
  createdAt: Date;
  encryptionKeyVersion: string;
  expiresAt: Date;
  id: string;
  idempotencyKeyHash: Uint8Array;
  intentionCode: string;
  locale: string;
  policyVersion: string;
  readingId: string | null;
  schemaVersion: string;
  smallActionCiphertext: Uint8Array;
  smallActionNonce: Uint8Array;
  smallActionTag: Uint8Array;
  subjectId: string;
}>;

type RitualRow = Readonly<{
  canonicalRequestHash: Uint8Array;
  completedAt: Date | null;
  expiresAt: Date;
  id: string;
  idempotencyKeyHash: Uint8Array;
  intentionId: string;
  objectCode: string;
  policyVersion: string;
  ritualDateUtc: Date;
  schemaVersion: string;
  subjectId: string;
}>;

type JournalRow = Readonly<{
  canonicalRequestHash: Uint8Array;
  createdAt: Date;
  deletedAt: Date | null;
  encryptionKeyVersion: string;
  expiresAt: Date;
  id: string;
  idempotencyKeyHash: Uint8Array;
  intentionId: string;
  policyVersion: string;
  reflectionCiphertext: Uint8Array;
  reflectionNonce: Uint8Array;
  reflectionTag: Uint8Array;
  revisitAt: Date | null;
  ritualSessionId: string | null;
  schemaVersion: string;
  subjectId: string;
}>;

const intentionSelect = Prisma.sql`
  SELECT intention.id,
         intention.anonymous_subject_id AS "subjectId",
         intention.reading_id AS "readingId",
         intention.intention_code AS "intentionCode",
         intention.small_action_ciphertext AS "smallActionCiphertext",
         intention.small_action_nonce AS "smallActionNonce",
         intention.small_action_tag AS "smallActionTag",
         intention.encryption_key_version AS "encryptionKeyVersion",
         intention.schema_version AS "schemaVersion",
         intention.policy_version AS "policyVersion",
         intention.idempotency_key_hash AS "idempotencyKeyHash",
         intention.canonical_request_hash AS "canonicalRequestHash",
         intention.created_at AS "createdAt",
         intention.expires_at AS "expiresAt",
         COALESCE(reading.locale, 'en') AS locale
    FROM intention
    LEFT JOIN reading ON reading.id = intention.reading_id
                     AND reading.anonymous_subject_id = intention.anonymous_subject_id
`;

const ritualSelect = Prisma.sql`
  SELECT ritual_session.id,
         ritual_session.anonymous_subject_id AS "subjectId",
         ritual_session.intention_id AS "intentionId",
         ritual_session.object_code AS "objectCode",
         ritual_session.ritual_date_utc AS "ritualDateUtc",
         ritual_session.schema_version AS "schemaVersion",
         ritual_session.policy_version AS "policyVersion",
         ritual_session.idempotency_key_hash AS "idempotencyKeyHash",
         ritual_session.canonical_request_hash AS "canonicalRequestHash",
         ritual_session.completed_at AS "completedAt",
         ritual_session.expires_at AS "expiresAt"
    FROM ritual_session
`;

const journalSelect = Prisma.sql`
  SELECT journal_entry.id,
         journal_entry.anonymous_subject_id AS "subjectId",
         journal_entry.intention_id AS "intentionId",
         journal_entry.ritual_session_id AS "ritualSessionId",
         journal_entry.reflection_ciphertext AS "reflectionCiphertext",
         journal_entry.reflection_nonce AS "reflectionNonce",
         journal_entry.reflection_tag AS "reflectionTag",
         journal_entry.encryption_key_version AS "encryptionKeyVersion",
         journal_entry.schema_version AS "schemaVersion",
         journal_entry.policy_version AS "policyVersion",
         journal_entry.idempotency_key_hash AS "idempotencyKeyHash",
         journal_entry.canonical_request_hash AS "canonicalRequestHash",
         journal_entry.created_at AS "createdAt",
         journal_entry.revisit_at AS "revisitAt",
         journal_entry.expires_at AS "expiresAt",
         journal_entry.deleted_at AS "deletedAt"
    FROM journal_entry
`;

const fail = (code: ReflectionPersistenceErrorCode, retryAfterSeconds?: number): never => {
  throw new ReflectionPersistenceError(code, retryAfterSeconds);
};

const digestBytes = (digest: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(Buffer.from(digest.slice("sha256:".length), "hex")) as Uint8Array<ArrayBuffer>;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const tokenHash = async (token: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!sessionTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  const input = Uint8Array.from(bytes) as Uint8Array<ArrayBuffer>;
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", input));
};

const resolveActiveAnonymousSession = async (
  transaction: Prisma.TransactionClient,
  token: string,
): Promise<ActiveSessionRow | null> => {
  const hash = await tokenHash(token);
  if (hash === null) return null;
  const rows = await transaction.$queryRaw<ActiveSessionRow[]>`
    SELECT subject.id AS "subjectId",
           LEAST(subject.expires_at, session.expires_at) AS "expiresAt",
           CURRENT_TIMESTAMP AS "observedAt"
      FROM anonymous_session AS session
      JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
     WHERE session.token_hash = ${hash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND subject.expires_at > CURRENT_TIMESTAMP
     FOR UPDATE OF session, subject
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const resolveActiveAccountSession = async (
  transaction: Prisma.TransactionClient,
  token: string,
): Promise<ActiveAccountSessionRow | null> => {
  const hash = await tokenHash(token);
  if (hash === null) return null;
  const rows = await transaction.$queryRaw<ActiveAccountSessionRow[]>`
    SELECT session.user_id AS "userId",
           session.expires_at AS "expiresAt",
           CURRENT_TIMESTAMP AS "observedAt"
      FROM account_session AS session
      JOIN app_user AS account ON account.id = session.user_id
     WHERE session.token_hash = ${hash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.status = 'active'
     FOR UPDATE OF session, account
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const resolveActivePrincipal = async (
  transaction: Prisma.TransactionClient,
  tokens: ReflectionPrincipalTokens,
): Promise<ActiveReflectionPrincipal | null> => {
  if (tokens.accountSessionToken !== undefined) {
    const account = await resolveActiveAccountSession(transaction, tokens.accountSessionToken);
    if (account !== null) return Object.freeze({ ...account, kind: "account" as const });
  }
  if (tokens.anonymousSessionToken !== undefined) {
    const anonymous = await resolveActiveAnonymousSession(
      transaction,
      tokens.anonymousSessionToken,
    );
    if (anonymous !== null) return Object.freeze({ ...anonymous, kind: "anonymous" as const });
  }
  return null;
};

const validatePolicy = (value: ReflectionPersistencePolicy): ReflectionPersistencePolicy => {
  if (
    value.policyVersion !== reflectionPolicyVersion ||
    !Number.isSafeInteger(value.retentionSeconds) ||
    value.retentionSeconds <= value.revisitDelaySeconds ||
    value.retentionSeconds > 34_560_000 ||
    !Number.isSafeInteger(value.revisitDelaySeconds) ||
    value.revisitDelaySeconds < 3_600 ||
    value.revisitDelaySeconds > 2_592_000
  ) {
    throw new TypeError("Reflection persistence policy is invalid.");
  }
  return Object.freeze({ ...value });
};

const parsePrepared = (value: PreparedReflectionCreate): PreparedReflectionCreate => {
  if (
    typeof value !== "object" ||
    value === null ||
    !sha256DigestPattern.test(value.canonicalRequestDigest) ||
    !sha256DigestPattern.test(value.idempotencyKeyDigest) ||
    !identifierPattern.test(value.idempotencyKeyVersion)
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({ ...value });
};

const parsePreparedPrivate = (
  value: PreparedPrivateReflectionCreate,
): PreparedPrivateReflectionCreate => {
  const prepared = parsePrepared(value);
  const encrypted = value.encrypted;
  if (
    typeof encrypted !== "object" ||
    encrypted === null ||
    !(encrypted.ciphertext instanceof Uint8Array) ||
    encrypted.ciphertext.byteLength === 0 ||
    encrypted.ciphertext.byteLength > maximumCiphertextBytes ||
    !(encrypted.nonce instanceof Uint8Array) ||
    encrypted.nonce.byteLength !== 12 ||
    !(encrypted.tag instanceof Uint8Array) ||
    encrypted.tag.byteLength !== 16 ||
    !identifierPattern.test(encrypted.keyVersion) ||
    encrypted.keyVersion !== prepared.idempotencyKeyVersion
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({ ...prepared, encrypted: Object.freeze({ ...encrypted }) });
};

const parseIntentionRow = (row: IntentionRow): PersistedReflectionIntention => {
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    (row.readingId !== null && !uuidPattern.test(row.readingId)) ||
    row.locale !== "en" ||
    row.schemaVersion !== reflectionIntentionSchemaVersion ||
    row.policyVersion !== reflectionPolicyVersion ||
    !identifierPattern.test(row.encryptionKeyVersion) ||
    !reflectionIntentionCode(row.intentionCode) ||
    row.expiresAt <= row.createdAt
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
  const encryptedSmallAction = parseCiphertext({
    ciphertext: row.smallActionCiphertext,
    keyVersion: row.encryptionKeyVersion,
    nonce: row.smallActionNonce,
    tag: row.smallActionTag,
  });
  return Object.freeze({
    createdAt: row.createdAt.toISOString(),
    encryptedSmallAction,
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    intentionCode: row.intentionCode,
    locale: "en",
    policyVersion: reflectionPolicyVersion,
    readingId: row.readingId,
    schemaVersion: reflectionIntentionSchemaVersion,
    subjectId: row.subjectId,
  });
};

const reflectionIntentionCode = (value: string): value is ReflectionIntentionCode =>
  value === "calm_clarity" ||
  value === "gratitude_abundance" ||
  value === "courage_action" ||
  value === "connection_understanding" ||
  value === "release_renewal";

const reflectionRitualObjectCode = (value: string): value is ReflectionRitualObjectCode =>
  value === "candle" ||
  value === "incense" ||
  value === "mindful_incense" ||
  value === "moonlit_lotus" ||
  value === "amethyst_guardian" ||
  value === "golden_intention_bowl";

const parseCiphertext = (value: ReflectionCiphertext): ReflectionCiphertext => {
  if (
    !(value.ciphertext instanceof Uint8Array) ||
    value.ciphertext.byteLength === 0 ||
    value.ciphertext.byteLength > maximumCiphertextBytes ||
    !(value.nonce instanceof Uint8Array) ||
    value.nonce.byteLength !== 12 ||
    !(value.tag instanceof Uint8Array) ||
    value.tag.byteLength !== 16 ||
    !identifierPattern.test(value.keyVersion)
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({ ...value });
};

const parseRitualRow = (row: RitualRow): PersistedReflectionRitual => {
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    !uuidPattern.test(row.intentionId) ||
    row.completedAt === null ||
    !reflectionRitualObjectCode(row.objectCode) ||
    row.schemaVersion !== reflectionRitualSchemaVersion ||
    row.policyVersion !== reflectionPolicyVersion ||
    row.expiresAt <= row.completedAt
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({
    completedAt: row.completedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    intentionId: row.intentionId,
    objectCode: row.objectCode,
    policyVersion: reflectionPolicyVersion,
    ritualDateUtc: row.ritualDateUtc.toISOString().slice(0, 10),
    schemaVersion: reflectionRitualSchemaVersion,
    subjectId: row.subjectId,
  });
};

const parseJournalRow = (row: JournalRow): PersistedReflectionJournal => {
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    !uuidPattern.test(row.intentionId) ||
    row.ritualSessionId === null ||
    !uuidPattern.test(row.ritualSessionId) ||
    row.deletedAt !== null ||
    row.revisitAt === null ||
    row.schemaVersion !== reflectionJournalSchemaVersion ||
    row.policyVersion !== reflectionPolicyVersion ||
    !identifierPattern.test(row.encryptionKeyVersion) ||
    row.revisitAt <= row.createdAt ||
    row.expiresAt <= row.revisitAt
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({
    createdAt: row.createdAt.toISOString(),
    encryptedReflection: parseCiphertext({
      ciphertext: row.reflectionCiphertext,
      keyVersion: row.encryptionKeyVersion,
      nonce: row.reflectionNonce,
      tag: row.reflectionTag,
    }),
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    intentionId: row.intentionId,
    policyVersion: reflectionPolicyVersion,
    revisitAt: row.revisitAt.toISOString(),
    ritualSessionId: row.ritualSessionId,
    schemaVersion: reflectionJournalSchemaVersion,
    subjectId: row.subjectId,
  });
};

const retryAfterUtcMidnight = (observedAt: Date): number => {
  const next = Date.UTC(
    observedAt.getUTCFullYear(),
    observedAt.getUTCMonth(),
    observedAt.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((next - observedAt.getTime()) / 1_000));
};

const lookupIntention = async (
  transaction: Prisma.TransactionClient,
  principal: ActiveReflectionPrincipal,
  id: string,
): Promise<IntentionRow | null> => {
  const ownership =
    principal.kind === "anonymous"
      ? Prisma.sql`intention.anonymous_subject_id = ${principal.subjectId}::uuid`
      : Prisma.sql`EXISTS (
          SELECT 1
            FROM account_subject_link AS link
            JOIN anonymous_subject AS subject ON subject.id = link.anonymous_subject_id
           WHERE link.user_id = ${principal.userId}::uuid
             AND link.anonymous_subject_id = intention.anonymous_subject_id
             AND subject.expires_at > CURRENT_TIMESTAMP
        )`;
  const rows = await transaction.$queryRaw<IntentionRow[]>`
    ${intentionSelect}
     WHERE intention.id = ${id}::uuid
       AND ${ownership}
       AND intention.expires_at > CURRENT_TIMESTAMP
     LIMIT 2
  `;
  if (rows.length > 1) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  return rows[0] ?? null;
};

const lookupRitual = async (
  transaction: Prisma.TransactionClient,
  principal: ActiveReflectionPrincipal,
  id: string,
): Promise<RitualRow | null> => {
  const ownership =
    principal.kind === "anonymous"
      ? Prisma.sql`ritual_session.anonymous_subject_id = ${principal.subjectId}::uuid`
      : Prisma.sql`EXISTS (
          SELECT 1
            FROM account_subject_link AS link
            JOIN anonymous_subject AS subject ON subject.id = link.anonymous_subject_id
           WHERE link.user_id = ${principal.userId}::uuid
             AND link.anonymous_subject_id = ritual_session.anonymous_subject_id
             AND subject.expires_at > CURRENT_TIMESTAMP
        )`;
  const rows = await transaction.$queryRaw<RitualRow[]>`
    ${ritualSelect}
     WHERE ritual_session.id = ${id}::uuid
       AND ${ownership}
       AND ritual_session.expires_at > CURRENT_TIMESTAMP
     LIMIT 2
  `;
  if (rows.length > 1) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  return rows[0] ?? null;
};

const lookupJournal = async (
  transaction: Prisma.TransactionClient,
  principal: ActiveReflectionPrincipal,
  id: string,
): Promise<JournalRow | null> => {
  const ownership =
    principal.kind === "anonymous"
      ? Prisma.sql`journal_entry.anonymous_subject_id = ${principal.subjectId}::uuid`
      : Prisma.sql`EXISTS (
          SELECT 1
            FROM account_subject_link AS link
            JOIN anonymous_subject AS subject ON subject.id = link.anonymous_subject_id
           WHERE link.user_id = ${principal.userId}::uuid
             AND link.anonymous_subject_id = journal_entry.anonymous_subject_id
             AND subject.expires_at > CURRENT_TIMESTAMP
        )`;
  const rows = await transaction.$queryRaw<JournalRow[]>`
    ${journalSelect}
     WHERE journal_entry.id = ${id}::uuid
       AND ${ownership}
       AND journal_entry.deleted_at IS NULL
       AND journal_entry.expires_at > CURRENT_TIMESTAMP
     LIMIT 2
  `;
  if (rows.length > 1) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  return rows[0] ?? null;
};

export const assertReflectionRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      canInsertIntention: boolean;
      canInsertJournal: boolean;
      canInsertRitual: boolean;
      canReadAccountSession: boolean;
      canReadAccountSubjectLink: boolean;
      canReadAppUser: boolean;
      canReadIntention: boolean;
      canReadJournal: boolean;
      canReadRitual: boolean;
      canUseSchema: boolean;
    }>
  >(Prisma.sql`
    SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS "canUseSchema",
           has_table_privilege(current_user, 'public.account_session', 'SELECT')
             AS "canReadAccountSession",
           has_table_privilege(current_user, 'public.account_subject_link', 'SELECT')
             AS "canReadAccountSubjectLink",
           has_table_privilege(current_user, 'public.app_user', 'SELECT') AS "canReadAppUser",
           has_table_privilege(current_user, 'public.intention', 'SELECT') AS "canReadIntention",
           has_table_privilege(current_user, 'public.intention', 'INSERT') AS "canInsertIntention",
           has_table_privilege(current_user, 'public.ritual_session', 'SELECT') AS "canReadRitual",
           has_table_privilege(current_user, 'public.ritual_session', 'INSERT') AS "canInsertRitual",
           has_table_privilege(current_user, 'public.journal_entry', 'SELECT') AS "canReadJournal",
           has_table_privilege(current_user, 'public.journal_entry', 'INSERT') AS "canInsertJournal"
  `);
  const [row] = rows;
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.canUseSchema ||
    !row.canReadAccountSession ||
    !row.canReadAccountSubjectLink ||
    !row.canReadAppUser ||
    !row.canReadIntention ||
    !row.canInsertIntention ||
    !row.canReadRitual ||
    !row.canInsertRitual ||
    !row.canReadJournal ||
    !row.canInsertJournal
  ) {
    return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
  }
};

export const createReflectionPersistence = (
  database: PrismaClient,
  rawPolicy: ReflectionPersistencePolicy,
): ReflectionPersistence => {
  const policy = validatePolicy(rawPolicy);

  const attest = async (): Promise<void> => {
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    await assertReflectionRuntimeDatabasePrivileges(database);
  };

  const privateGet = async <Value>(input: {
    id: string;
    lookup: (
      transaction: Prisma.TransactionClient,
      principal: ActiveReflectionPrincipal,
      id: string,
    ) => Promise<Value | null>;
    parse: (row: Value) => unknown;
    principal: ReflectionPrincipalTokens;
  }): Promise<unknown | null> => {
    if (!uuidPattern.test(input.id)) return null;
    await attest();
    try {
      return await database.$transaction(async (transaction) => {
        const active = await resolveActivePrincipal(transaction, input.principal);
        if (active === null) return null;
        const row = await input.lookup(transaction, active, input.id);
        return row === null ? null : input.parse(row);
      });
    } catch (error) {
      if (error instanceof ReflectionPersistenceError) throw error;
      throw new ReflectionPersistenceError("REFLECTION_PERSISTENCE_UNAVAILABLE");
    }
  };

  const getIntention: ReflectionPersistence["getIntention"] = async ({ id, principal }) =>
    (await privateGet({
      id,
      lookup: lookupIntention,
      parse: parseIntentionRow,
      principal,
    })) as PersistedReflectionIntention | null;
  const getRitual: ReflectionPersistence["getRitual"] = async ({ id, principal }) =>
    (await privateGet({
      id,
      lookup: lookupRitual,
      parse: parseRitualRow,
      principal,
    })) as PersistedReflectionRitual | null;
  const getJournal: ReflectionPersistence["getJournal"] = async ({ id, principal }) =>
    (await privateGet({
      id,
      lookup: lookupJournal,
      parse: parseJournalRow,
      principal,
    })) as PersistedReflectionJournal | null;

  const resolveIntention: ReflectionPersistence["resolveIntention"] = async (input) => {
    const request = parseReflectionIntentionCreateRequestV1(input.request);
    await attest();
    let callbackFailure: unknown;
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await resolveActivePrincipal(transaction, input.principal);
          if (active === null) return fail("REFLECTION_SESSION_UNAVAILABLE");
          let owner: IntentionOwnerRow;
          if (request.readingId === null) {
            if (active.kind === "anonymous") {
              owner = Object.freeze({ expiresAt: active.expiresAt, subjectId: active.subjectId });
            } else {
              const owners = await transaction.$queryRaw<IntentionOwnerRow[]>`
                SELECT subject.id AS "subjectId", subject.expires_at AS "expiresAt"
                  FROM account_subject_link AS link
                  JOIN anonymous_subject AS subject ON subject.id = link.anonymous_subject_id
                 WHERE link.user_id = ${active.userId}::uuid
                   AND subject.expires_at > CURRENT_TIMESTAMP
                 ORDER BY link.created_at DESC, link.id DESC
                 LIMIT 1
              `;
              if (owners[0] === undefined) return fail("REFLECTION_SESSION_UNAVAILABLE");
              owner = owners[0];
            }
          } else {
            const readingOwnership =
              active.kind === "anonymous"
                ? Prisma.sql`reading.anonymous_subject_id = ${active.subjectId}::uuid`
                : Prisma.sql`EXISTS (
                    SELECT 1
                      FROM account_subject_link AS link
                      JOIN anonymous_subject AS subject
                        ON subject.id = link.anonymous_subject_id
                     WHERE link.user_id = ${active.userId}::uuid
                       AND link.anonymous_subject_id = reading.anonymous_subject_id
                       AND subject.expires_at > CURRENT_TIMESTAMP
                  )`;
            const readingRows = await transaction.$queryRaw<ReadingOwnerRow[]>`
              SELECT id, anonymous_subject_id AS "subjectId", expires_at AS "expiresAt"
                FROM reading
               WHERE id = ${request.readingId}::uuid
                 AND ${readingOwnership}
                 AND status = 'facts_ready'
                 AND expires_at > CURRENT_TIMESTAMP
               LIMIT 2
            `;
            if (readingRows.length !== 1 || readingRows[0] === undefined) {
              return fail(
                readingRows.length === 0
                  ? "REFLECTION_NOT_FOUND"
                  : "REFLECTION_PERSISTENCE_UNAVAILABLE",
              );
            }
            owner = readingRows[0];
          }
          const subjectId = owner.subjectId;
          let prepared: PreparedPrivateReflectionCreate;
          try {
            prepared = parsePreparedPrivate(await input.prepare({ request, subjectId }));
          } catch (error) {
            callbackFailure = error;
            throw error;
          }
          const idempotencyHash = digestBytes(prepared.idempotencyKeyDigest);
          const historical = await transaction.$queryRaw<IntentionRow[]>`
            ${intentionSelect}
             WHERE intention.anonymous_subject_id = ${subjectId}::uuid
               AND intention.idempotency_key_hash = ${idempotencyHash}
               AND intention.expires_at > CURRENT_TIMESTAMP
             LIMIT 2
          `;
          if (historical.length > 1) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          if (historical[0] !== undefined) {
            if (
              !bytesEqual(
                historical[0].canonicalRequestHash,
                digestBytes(prepared.canonicalRequestDigest),
              )
            ) {
              return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              intention: parseIntentionRow(historical[0]),
            });
          }
          const retentionExpiresAt = new Date(
            active.observedAt.getTime() + policy.retentionSeconds * 1_000,
          );
          const principalExpiresAt =
            active.kind === "anonymous" && active.expiresAt < owner.expiresAt
              ? active.expiresAt
              : owner.expiresAt;
          const expiresAt =
            retentionExpiresAt < principalExpiresAt ? retentionExpiresAt : principalExpiresAt;
          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO intention (
              anonymous_subject_id, reading_id, intention_code, small_action_ciphertext,
              small_action_nonce, small_action_tag, encryption_key_version, schema_version,
              policy_version, idempotency_key_hash, canonical_request_hash, created_at,
              updated_at, expires_at
            ) VALUES (
              ${subjectId}::uuid, ${request.readingId}::uuid, ${request.intentionCode},
              ${prepared.encrypted.ciphertext}, ${prepared.encrypted.nonce}, ${prepared.encrypted.tag},
              ${prepared.encrypted.keyVersion}, ${reflectionIntentionSchemaVersion},
              ${policy.policyVersion}, ${idempotencyHash},
              ${digestBytes(prepared.canonicalRequestDigest)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
              ${expiresAt}
            ) ON CONFLICT (anonymous_subject_id, idempotency_key_hash) DO NOTHING
            RETURNING id
          `;
          const id = inserted[0]?.id;
          if (inserted.length === 0) {
            const replay = await transaction.$queryRaw<IntentionRow[]>`
              ${intentionSelect}
               WHERE intention.anonymous_subject_id = ${subjectId}::uuid
                 AND intention.idempotency_key_hash = ${idempotencyHash}
                 AND intention.expires_at > CURRENT_TIMESTAMP
               LIMIT 2
            `;
            if (replay.length === 0) return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            if (replay.length !== 1 || replay[0] === undefined)
              return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
            if (
              !bytesEqual(
                replay[0].canonicalRequestHash,
                digestBytes(prepared.canonicalRequestDigest),
              )
            ) {
              return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              intention: parseIntentionRow(replay[0]),
            });
          }
          if (inserted.length !== 1 || id === undefined || !uuidPattern.test(id))
            return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          const row = await lookupIntention(transaction, active, id);
          if (row === null) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          return Object.freeze({ kind: "created" as const, intention: parseIntentionRow(row) });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error === callbackFailure) throw error;
      if (error instanceof ReflectionPersistenceError) throw error;
      throw new ReflectionPersistenceError("REFLECTION_PERSISTENCE_UNAVAILABLE");
    }
  };

  const resolveRitual: ReflectionPersistence["resolveRitual"] = async (input) => {
    const request = parseReflectionRitualCreateRequestV1(input.request);
    await attest();
    let callbackFailure: unknown;
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await resolveActivePrincipal(transaction, input.principal);
          if (active === null) return fail("REFLECTION_SESSION_UNAVAILABLE");
          const intention = await lookupIntention(transaction, active, request.intentionId);
          if (intention === null) return fail("REFLECTION_NOT_FOUND");
          const subjectId = intention.subjectId;
          let prepared: PreparedReflectionCreate;
          try {
            prepared = parsePrepared(await input.prepare({ request, subjectId }));
          } catch (error) {
            callbackFailure = error;
            throw error;
          }
          const idempotencyHash = digestBytes(prepared.idempotencyKeyDigest);
          const historical = await transaction.$queryRaw<RitualRow[]>`
            ${ritualSelect}
             WHERE ritual_session.anonymous_subject_id = ${subjectId}::uuid
               AND ritual_session.idempotency_key_hash = ${idempotencyHash}
               AND ritual_session.expires_at > CURRENT_TIMESTAMP
             LIMIT 2
          `;
          if (historical.length > 1) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          if (historical[0] !== undefined) {
            if (
              !bytesEqual(
                historical[0].canonicalRequestHash,
                digestBytes(prepared.canonicalRequestDigest),
              )
            ) {
              return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              ritual: parseRitualRow(historical[0]),
            });
          }
          const ritualDateUtc = active.observedAt.toISOString().slice(0, 10);
          const daily = await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM ritual_session
             WHERE anonymous_subject_id = ${subjectId}::uuid
               AND ritual_date_utc = ${ritualDateUtc}::date
             LIMIT 1
          `;
          if (daily.length !== 0) {
            return fail("REFLECTION_RITUAL_DAILY_LIMIT", retryAfterUtcMidnight(active.observedAt));
          }
          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO ritual_session (
              anonymous_subject_id, intention_id, object_code, ritual_date_utc, schema_version,
              policy_version, idempotency_key_hash, canonical_request_hash, started_at,
              completed_at, expires_at
            ) VALUES (
              ${subjectId}::uuid, ${request.intentionId}::uuid, ${request.objectCode},
              ${ritualDateUtc}::date, ${reflectionRitualSchemaVersion}, ${policy.policyVersion},
              ${idempotencyHash}, ${digestBytes(prepared.canonicalRequestDigest)},
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${intention.expiresAt}
            ) ON CONFLICT DO NOTHING
            RETURNING id
          `;
          const id = inserted[0]?.id;
          if (inserted.length === 0) {
            const replay = await transaction.$queryRaw<RitualRow[]>`
              ${ritualSelect}
               WHERE ritual_session.anonymous_subject_id = ${subjectId}::uuid
                 AND ritual_session.idempotency_key_hash = ${idempotencyHash}
                 AND ritual_session.expires_at > CURRENT_TIMESTAMP
               LIMIT 2
            `;
            if (replay.length === 1 && replay[0] !== undefined) {
              if (
                !bytesEqual(
                  replay[0].canonicalRequestHash,
                  digestBytes(prepared.canonicalRequestDigest),
                )
              ) {
                return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
              }
              return Object.freeze({
                kind: "replayed" as const,
                ritual: parseRitualRow(replay[0]),
              });
            }
            return fail("REFLECTION_RITUAL_DAILY_LIMIT", retryAfterUtcMidnight(active.observedAt));
          }
          if (inserted.length !== 1 || id === undefined || !uuidPattern.test(id))
            return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          const row = await lookupRitual(transaction, active, id);
          if (row === null) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          return Object.freeze({ kind: "created" as const, ritual: parseRitualRow(row) });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error === callbackFailure) throw error;
      if (error instanceof ReflectionPersistenceError) throw error;
      throw new ReflectionPersistenceError("REFLECTION_PERSISTENCE_UNAVAILABLE");
    }
  };

  const resolveJournal: ReflectionPersistence["resolveJournal"] = async (input) => {
    const request = parseReflectionJournalCreateRequestV1(input.request);
    await attest();
    let callbackFailure: unknown;
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await resolveActivePrincipal(transaction, input.principal);
          if (active === null) return fail("REFLECTION_SESSION_UNAVAILABLE");
          const intention = await lookupIntention(transaction, active, request.intentionId);
          const ritual = await lookupRitual(transaction, active, request.ritualSessionId);
          if (intention === null || ritual === null) return fail("REFLECTION_NOT_FOUND");
          if (
            ritual.subjectId !== intention.subjectId ||
            ritual.intentionId !== intention.id ||
            ritual.completedAt === null
          ) {
            return fail("REFLECTION_CHAIN_INVALID");
          }
          const subjectId = intention.subjectId;
          let prepared: PreparedPrivateReflectionCreate;
          try {
            prepared = parsePreparedPrivate(await input.prepare({ request, subjectId }));
          } catch (error) {
            callbackFailure = error;
            throw error;
          }
          const idempotencyHash = digestBytes(prepared.idempotencyKeyDigest);
          const historical = await transaction.$queryRaw<JournalRow[]>`
            ${journalSelect}
             WHERE journal_entry.anonymous_subject_id = ${subjectId}::uuid
               AND journal_entry.idempotency_key_hash = ${idempotencyHash}
               AND journal_entry.deleted_at IS NULL
               AND journal_entry.expires_at > CURRENT_TIMESTAMP
             LIMIT 2
          `;
          if (historical.length > 1) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          if (historical[0] !== undefined) {
            if (
              !bytesEqual(
                historical[0].canonicalRequestHash,
                digestBytes(prepared.canonicalRequestDigest),
              )
            ) {
              return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              journal: parseJournalRow(historical[0]),
            });
          }
          const revisitAt = new Date(
            active.observedAt.getTime() + policy.revisitDelaySeconds * 1_000,
          );
          if (revisitAt >= intention.expiresAt) return fail("REFLECTION_CHAIN_INVALID");
          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO journal_entry (
              anonymous_subject_id, intention_id, ritual_session_id, reflection_ciphertext,
              reflection_nonce, reflection_tag, encryption_key_version, schema_version,
              policy_version, idempotency_key_hash, canonical_request_hash, created_at,
              updated_at, revisit_at, expires_at
            ) VALUES (
              ${subjectId}::uuid, ${request.intentionId}::uuid,
              ${request.ritualSessionId}::uuid, ${prepared.encrypted.ciphertext},
              ${prepared.encrypted.nonce}, ${prepared.encrypted.tag}, ${prepared.encrypted.keyVersion},
              ${reflectionJournalSchemaVersion}, ${policy.policyVersion}, ${idempotencyHash},
              ${digestBytes(prepared.canonicalRequestDigest)}, CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP, ${revisitAt}, ${intention.expiresAt}
            ) ON CONFLICT (anonymous_subject_id, idempotency_key_hash) DO NOTHING
            RETURNING id
          `;
          const id = inserted[0]?.id;
          if (inserted.length === 0) {
            const replay = await transaction.$queryRaw<JournalRow[]>`
              ${journalSelect}
               WHERE journal_entry.anonymous_subject_id = ${subjectId}::uuid
                 AND journal_entry.idempotency_key_hash = ${idempotencyHash}
                 AND journal_entry.deleted_at IS NULL
                 AND journal_entry.expires_at > CURRENT_TIMESTAMP
               LIMIT 2
            `;
            if (replay.length === 0) return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            if (replay.length !== 1 || replay[0] === undefined)
              return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
            if (
              !bytesEqual(
                replay[0].canonicalRequestHash,
                digestBytes(prepared.canonicalRequestDigest),
              )
            ) {
              return fail("REFLECTION_IDEMPOTENCY_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              journal: parseJournalRow(replay[0]),
            });
          }
          if (inserted.length !== 1 || id === undefined || !uuidPattern.test(id))
            return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          const row = await lookupJournal(transaction, active, id);
          if (row === null) return fail("REFLECTION_PERSISTENCE_UNAVAILABLE");
          return Object.freeze({ kind: "created" as const, journal: parseJournalRow(row) });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error === callbackFailure) throw error;
      if (error instanceof ReflectionPersistenceError) throw error;
      throw new ReflectionPersistenceError("REFLECTION_PERSISTENCE_UNAVAILABLE");
    }
  };

  return Object.freeze({
    getIntention,
    getJournal,
    getRitual,
    resolveIntention,
    resolveJournal,
    resolveRitual,
  });
};
