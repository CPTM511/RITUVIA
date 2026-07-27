import {
  parsePrivateJournalCreateRequestV2,
  parsePrivateJournalMutationRequestV1,
  parseRitualSessionMutationRequestV1,
  parseRitualSessionResourceV2,
  parseRitualSessionSnapshotV1,
  parseRitualSessionStartRequestV2,
  privateJournalSchemaVersion,
  reflectionIntentionV2SchemaVersion,
  reflectionPolicyVersion,
  ritualSessionSchemaVersion,
  transitionRitualSessionStateV1,
  type RitualInteractionCode,
  type RitualSessionSnapshotV1,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

export const ritualJournalPersistenceErrorCodes = Object.freeze([
  "RITUAL_JOURNAL_ACCESS_REQUIRED",
  "RITUAL_JOURNAL_CONFLICT",
  "RITUAL_JOURNAL_NOT_FOUND",
  "RITUAL_JOURNAL_SESSION_REQUIRED",
  "RITUAL_JOURNAL_UNAVAILABLE",
] as const);

export type RitualJournalPersistenceErrorCode = (typeof ritualJournalPersistenceErrorCodes)[number];

export class RitualJournalPersistenceError extends Error {
  readonly code: RitualJournalPersistenceErrorCode;

  constructor(code: RitualJournalPersistenceErrorCode) {
    super("The ritual and private journal persistence operation failed.");
    this.name = "RitualJournalPersistenceError";
    this.code = code;
  }
}

export type RitualJournalPrincipalTokens = Readonly<{
  accountSessionToken?: string | undefined;
  anonymousSessionToken?: string | undefined;
}>;

export type RitualJournalPreparedDigests = Readonly<{
  canonicalRequestDigest: string;
  idempotencyKeyDigest: string;
  keyVersion: string;
}>;

export type RitualJournalCiphertext = Readonly<{
  ciphertext: Uint8Array;
  keyVersion: string;
  nonce: Uint8Array;
  tag: Uint8Array;
}>;

export type PersistedRitualSessionV2 = Readonly<{
  abandonedAt: string | null;
  access: RitualSessionSnapshotV1["access"];
  catalogId: "rituvia-original-secular";
  catalogVersion: string;
  completedAt: string | null;
  currentStepCode: RitualInteractionCode;
  elapsedSeconds: number;
  expiresAt: string;
  id: string;
  intentionId: string;
  itemCode: RitualSessionSnapshotV1["itemCode"];
  itemVersion: string;
  pausedAt: string | null;
  policyVersion: typeof reflectionPolicyVersion;
  publicationId: string;
  revision: number;
  schemaVersion: typeof ritualSessionSchemaVersion;
  startedAt: string;
  status: "active" | "paused" | "completed" | "abandoned";
  templateCode: RitualSessionSnapshotV1["templateCode"];
  templateVersion: string;
}>;

export type PersistedPrivateJournalV2 = Readonly<{
  createdAt: string;
  encryptedReflection: RitualJournalCiphertext;
  expiresAt: string;
  id: string;
  intentionId: string;
  revision: number;
  ritualSessionId: string;
  schemaVersion: typeof privateJournalSchemaVersion;
  subjectId: string;
  updatedAt: string;
}>;

export type RitualJournalResolution<Resource> = Readonly<{
  kind: "created" | "replayed";
  resource: Resource;
}>;

export type RitualJournalMutationResolution<Resource> = Readonly<{
  kind: "mutated" | "replayed";
  resource: Resource | null;
}>;

export type RitualJournalPersistence = Readonly<{
  createJournal(input: {
    prepare(context: { resourceId: string; subjectId: string }): RitualJournalPreparedDigests & {
      encryptedReflection: RitualJournalCiphertext;
    };
    principal: RitualJournalPrincipalTokens;
    request: unknown;
    resourceId: string;
  }): Promise<RitualJournalResolution<PersistedPrivateJournalV2>>;
  getJournal(input: {
    id: string;
    principal: RitualJournalPrincipalTokens;
  }): Promise<PersistedPrivateJournalV2 | null>;
  getSession(input: {
    id: string;
    principal: RitualJournalPrincipalTokens;
  }): Promise<PersistedRitualSessionV2 | null>;
  mutateJournal(input: {
    id: string;
    prepare(context: { resourceId: string; subjectId: string }): RitualJournalPreparedDigests & {
      encryptedReflection?: RitualJournalCiphertext | undefined;
    };
    principal: RitualJournalPrincipalTokens;
    request: unknown;
  }): Promise<RitualJournalMutationResolution<PersistedPrivateJournalV2>>;
  mutateSession(input: {
    id: string;
    prepare(context: { resourceId: string; subjectId: string }): RitualJournalPreparedDigests;
    principal: RitualJournalPrincipalTokens;
    request: unknown;
  }): Promise<RitualJournalMutationResolution<PersistedRitualSessionV2>>;
  startSession(input: {
    prepare(context: { subjectId: string }): RitualJournalPreparedDigests;
    principal: RitualJournalPrincipalTokens;
    request: unknown;
    snapshot: unknown;
  }): Promise<RitualJournalResolution<PersistedRitualSessionV2>>;
}>;

type ActiveAnonymousPrincipal = Readonly<{
  kind: "anonymous";
  observedAt: Date;
  subjectId: string;
}>;

type ActiveAccountPrincipal = Readonly<{
  kind: "account";
  observedAt: Date;
  userId: string;
}>;

type ActivePrincipal = ActiveAnonymousPrincipal | ActiveAccountPrincipal;

type IntentionOwnerRow = Readonly<{
  expiresAt: Date;
  id: string;
  subjectId: string;
}>;

type SessionRow = Readonly<{
  abandonedAt: Date | null;
  accessKind: string | null;
  accessRequirementCode: string | null;
  canonicalRequestHash: Uint8Array;
  catalogVersion: string | null;
  catalogId: string | null;
  completedAt: Date | null;
  currentStepCode: string;
  elapsedSeconds: number;
  expiresAt: Date;
  id: string;
  idempotencyKeyHash: Uint8Array;
  intentionId: string;
  itemCode: string;
  itemVersion: string | null;
  lastMutationKeyHash: Uint8Array | null;
  lastMutationRequestHash: Uint8Array | null;
  pausedAt: Date | null;
  policyVersion: string;
  publicationId: string | null;
  revision: number;
  ritualPassId: string | null;
  schemaVersion: string;
  startedAt: Date;
  status: string;
  subjectId: string;
  templateCode: string | null;
  templateVersion: string | null;
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
  lastMutationKeyHash: Uint8Array | null;
  lastMutationRequestHash: Uint8Array | null;
  reflectionCiphertext: Uint8Array;
  reflectionNonce: Uint8Array;
  reflectionTag: Uint8Array;
  revision: number;
  ritualSessionId: string | null;
  schemaVersion: string;
  subjectId: string;
  updatedAt: Date;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

const fail = (code: RitualJournalPersistenceErrorCode): never => {
  throw new RitualJournalPersistenceError(code);
};

const digestBytes = (digest: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(Buffer.from(digest.slice("sha256:".length), "hex")) as Uint8Array<ArrayBuffer>;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const parsePrepared = (value: RitualJournalPreparedDigests): RitualJournalPreparedDigests => {
  if (
    !digestPattern.test(value.canonicalRequestDigest) ||
    !digestPattern.test(value.idempotencyKeyDigest) ||
    !identifierPattern.test(value.keyVersion)
  ) {
    return fail("RITUAL_JOURNAL_UNAVAILABLE");
  }
  return Object.freeze({ ...value });
};

const parseCiphertext = (value: RitualJournalCiphertext): RitualJournalCiphertext => {
  if (
    !(value.ciphertext instanceof Uint8Array) ||
    value.ciphertext.byteLength < 1 ||
    value.ciphertext.byteLength > 16_384 ||
    !(value.nonce instanceof Uint8Array) ||
    value.nonce.byteLength !== 12 ||
    !(value.tag instanceof Uint8Array) ||
    value.tag.byteLength !== 16 ||
    !identifierPattern.test(value.keyVersion)
  ) {
    return fail("RITUAL_JOURNAL_UNAVAILABLE");
  }
  return Object.freeze({ ...value });
};

const tokenHash = async (token: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!sessionTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  return new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      Uint8Array.from(bytes) as Uint8Array<ArrayBuffer>,
    ),
  );
};

const resolvePrincipal = async (
  transaction: Prisma.TransactionClient,
  tokens: RitualJournalPrincipalTokens,
): Promise<ActivePrincipal | null> => {
  if (tokens.accountSessionToken !== undefined) {
    const hash = await tokenHash(tokens.accountSessionToken);
    if (hash !== null) {
      const accountRows = await transaction.$queryRaw<Array<{ observedAt: Date; userId: string }>>`
        SELECT account_session.user_id AS "userId",
               CURRENT_TIMESTAMP AS "observedAt"
          FROM account_session
          JOIN app_user ON app_user.id = account_session.user_id
         WHERE account_session.token_hash = ${hash}
           AND account_session.token_hash_version = 1
           AND account_session.revoked_at IS NULL
           AND account_session.expires_at > CURRENT_TIMESTAMP
           AND app_user.status = 'active'
         FOR UPDATE OF account_session, app_user
      `;
      if (accountRows.length === 1 && accountRows[0] !== undefined) {
        return Object.freeze({ ...accountRows[0], kind: "account" as const });
      }
    }
  }
  if (tokens.anonymousSessionToken !== undefined) {
    const hash = await tokenHash(tokens.anonymousSessionToken);
    if (hash !== null) {
      const anonymousRows = await transaction.$queryRaw<
        Array<{ observedAt: Date; subjectId: string }>
      >`
        SELECT anonymous_subject.id AS "subjectId",
               CURRENT_TIMESTAMP AS "observedAt"
          FROM anonymous_session
          JOIN anonymous_subject
            ON anonymous_subject.id = anonymous_session.anonymous_subject_id
         WHERE anonymous_session.token_hash = ${hash}
           AND anonymous_session.token_hash_version = 1
           AND anonymous_session.revoked_at IS NULL
           AND anonymous_session.expires_at > CURRENT_TIMESTAMP
           AND anonymous_subject.expires_at > CURRENT_TIMESTAMP
         FOR UPDATE OF anonymous_session, anonymous_subject
      `;
      if (anonymousRows.length === 1 && anonymousRows[0] !== undefined) {
        return Object.freeze({ ...anonymousRows[0], kind: "anonymous" as const });
      }
    }
  }
  return null;
};

const ownershipPredicate = (principal: ActivePrincipal, subjectColumn: Prisma.Sql): Prisma.Sql =>
  principal.kind === "anonymous"
    ? Prisma.sql`${subjectColumn} = ${principal.subjectId}::uuid`
    : Prisma.sql`EXISTS (
        SELECT 1
         FROM account_subject_link
         WHERE account_subject_link.user_id = ${principal.userId}::uuid
           AND account_subject_link.anonymous_subject_id = ${subjectColumn}
           AND account_subject_link.privacy_deleted_at IS NULL
      )`;

const lookupActiveIntention = async (
  transaction: Prisma.TransactionClient,
  principal: ActivePrincipal,
  intentionId: string,
): Promise<IntentionOwnerRow | null> => {
  const owner = ownershipPredicate(principal, Prisma.sql`intention.anonymous_subject_id`);
  const rows = await transaction.$queryRaw<IntentionOwnerRow[]>`
    SELECT intention.id,
           intention.anonymous_subject_id AS "subjectId",
           intention.expires_at AS "expiresAt"
      FROM intention
     WHERE intention.id = ${intentionId}::uuid
       AND intention.contract_version = ${reflectionIntentionV2SchemaVersion}
       AND intention.status = 'active'
       AND intention.deleted_at IS NULL
       AND intention.expires_at > CURRENT_TIMESTAMP
       AND ${owner}
     FOR UPDATE OF intention
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const sessionSelect = Prisma.sql`
  SELECT ritual_session_v2.id,
         ritual_session_v2.anonymous_subject_id AS "subjectId",
         ritual_session_v2.intention_id AS "intentionId",
         ritual_session_v2.item_code AS "itemCode",
         ritual_session_v2.schema_version AS "schemaVersion",
         ritual_session_v2.policy_version AS "policyVersion",
         ritual_session_v2.idempotency_key_hash AS "idempotencyKeyHash",
         ritual_session_v2.canonical_request_hash AS "canonicalRequestHash",
         ritual_session_v2.started_at AS "startedAt",
         ritual_session_v2.completed_at AS "completedAt",
         ritual_session_v2.expires_at AS "expiresAt",
         ritual_session_v2.catalog_version AS "catalogVersion",
         ritual_session_v2.catalog_id AS "catalogId",
         ritual_session_v2.item_version AS "itemVersion",
         ritual_session_v2.publication_id AS "publicationId",
         ritual_session_v2.template_code AS "templateCode",
         ritual_session_v2.template_version AS "templateVersion",
         ritual_session_v2.access_kind AS "accessKind",
         ritual_session_v2.access_requirement_code AS "accessRequirementCode",
         ritual_session_v2.ritual_pass_id AS "ritualPassId",
         ritual_session_v2.status,
         ritual_session_v2.current_step_code AS "currentStepCode",
         ritual_session_v2.elapsed_seconds AS "elapsedSeconds",
         ritual_session_v2.revision,
         ritual_session_v2.paused_at AS "pausedAt",
         ritual_session_v2.abandoned_at AS "abandonedAt",
         ritual_session_v2.last_mutation_key_hash AS "lastMutationKeyHash",
         ritual_session_v2.last_mutation_request_hash AS "lastMutationRequestHash"
    FROM ritual_session_v2
`;

const journalSelect = Prisma.sql`
  SELECT private_journal_entry.id,
         private_journal_entry.anonymous_subject_id AS "subjectId",
         private_journal_entry.intention_id AS "intentionId",
         private_journal_entry.ritual_session_id AS "ritualSessionId",
         private_journal_entry.reflection_ciphertext AS "reflectionCiphertext",
         private_journal_entry.reflection_nonce AS "reflectionNonce",
         private_journal_entry.reflection_tag AS "reflectionTag",
         private_journal_entry.encryption_key_version AS "encryptionKeyVersion",
         private_journal_entry.schema_version AS "schemaVersion",
         private_journal_entry.idempotency_key_hash AS "idempotencyKeyHash",
         private_journal_entry.canonical_request_hash AS "canonicalRequestHash",
         private_journal_entry.created_at AS "createdAt",
         private_journal_entry.updated_at AS "updatedAt",
         private_journal_entry.expires_at AS "expiresAt",
         private_journal_entry.deleted_at AS "deletedAt",
         private_journal_entry.revision,
         private_journal_entry.last_mutation_key_hash AS "lastMutationKeyHash",
         private_journal_entry.last_mutation_request_hash AS "lastMutationRequestHash"
    FROM private_journal_entry
`;

const parseSessionRow = (row: SessionRow): PersistedRitualSessionV2 => {
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    !uuidPattern.test(row.intentionId) ||
    row.schemaVersion !== ritualSessionSchemaVersion ||
    row.policyVersion !== reflectionPolicyVersion ||
    row.catalogVersion === null ||
    row.catalogId !== "rituvia-original-secular" ||
    row.itemVersion === null ||
    row.publicationId === null ||
    row.templateCode === null ||
    row.templateVersion === null ||
    (row.status !== "active" &&
      row.status !== "paused" &&
      row.status !== "completed" &&
      row.status !== "abandoned") ||
    row.expiresAt <= row.startedAt ||
    !Number.isSafeInteger(row.elapsedSeconds) ||
    !Number.isSafeInteger(row.revision)
  ) {
    return fail("RITUAL_JOURNAL_UNAVAILABLE");
  }
  const snapshot = parseRitualSessionSnapshotV1({
    access: { kind: row.accessKind, requirementCode: row.accessRequirementCode },
    catalogId: row.catalogId,
    catalogVersion: row.catalogVersion,
    itemCode: row.itemCode,
    itemVersion: row.itemVersion,
    publicationId: row.publicationId,
    schemaVersion: "ritual-session-snapshot.v1",
    templateCode: row.templateCode,
    templateVersion: row.templateVersion,
  });
  return parseRitualSessionResourceV2({
    abandonedAt: row.abandonedAt?.toISOString() ?? null,
    access: snapshot.access,
    catalogId: snapshot.catalogId,
    catalogVersion: snapshot.catalogVersion,
    completedAt: row.completedAt?.toISOString() ?? null,
    currentStepCode: row.currentStepCode,
    elapsedSeconds: row.elapsedSeconds,
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    intentionId: row.intentionId,
    itemCode: snapshot.itemCode,
    itemVersion: snapshot.itemVersion,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    policyVersion: reflectionPolicyVersion,
    publicationId: snapshot.publicationId,
    revision: row.revision,
    schemaVersion: ritualSessionSchemaVersion,
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    templateCode: snapshot.templateCode,
    templateVersion: snapshot.templateVersion,
  });
};

const parseJournalRow = (row: JournalRow): PersistedPrivateJournalV2 => {
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    !uuidPattern.test(row.intentionId) ||
    row.ritualSessionId === null ||
    !uuidPattern.test(row.ritualSessionId) ||
    row.schemaVersion !== privateJournalSchemaVersion ||
    row.deletedAt !== null ||
    row.expiresAt <= row.updatedAt ||
    !Number.isSafeInteger(row.revision)
  ) {
    return fail("RITUAL_JOURNAL_UNAVAILABLE");
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
    revision: row.revision,
    ritualSessionId: row.ritualSessionId,
    schemaVersion: privateJournalSchemaVersion,
    subjectId: row.subjectId,
    updatedAt: row.updatedAt.toISOString(),
  });
};

const lookupSession = async (
  transaction: Prisma.TransactionClient,
  principal: ActivePrincipal,
  id: string,
  forUpdate = false,
): Promise<SessionRow | null> => {
  const owner = ownershipPredicate(principal, Prisma.sql`ritual_session_v2.anonymous_subject_id`);
  const lock = forUpdate ? Prisma.sql`FOR UPDATE OF ritual_session_v2` : Prisma.empty;
  const rows = await transaction.$queryRaw<SessionRow[]>`
    ${sessionSelect}
     WHERE ritual_session_v2.id = ${id}::uuid
       AND ritual_session_v2.schema_version = ${ritualSessionSchemaVersion}
       AND ritual_session_v2.expires_at > CURRENT_TIMESTAMP
       AND ${owner}
     ${lock}
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const lookupJournal = async (
  transaction: Prisma.TransactionClient,
  principal: ActivePrincipal,
  id: string,
  includeDeleted: boolean,
  forUpdate = false,
): Promise<JournalRow | null> => {
  const owner = ownershipPredicate(
    principal,
    Prisma.sql`private_journal_entry.anonymous_subject_id`,
  );
  const deleted = includeDeleted
    ? Prisma.empty
    : Prisma.sql`AND private_journal_entry.deleted_at IS NULL`;
  const lock = forUpdate ? Prisma.sql`FOR UPDATE OF private_journal_entry` : Prisma.empty;
  const rows = await transaction.$queryRaw<JournalRow[]>`
    ${journalSelect}
     WHERE private_journal_entry.id = ${id}::uuid
       AND private_journal_entry.schema_version = ${privateJournalSchemaVersion}
       AND private_journal_entry.expires_at > CURRENT_TIMESTAMP
       AND ${owner}
       ${deleted}
     ${lock}
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

export const assertRitualJournalRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      canDeleteJournal: boolean;
      canDeletePass: boolean;
      canDeleteSession: boolean;
      canInsertJournal: boolean;
      canInsertPass: boolean;
      canInsertSession: boolean;
      canReadAccountSession: boolean;
      canReadAccountSubjectLink: boolean;
      canReadAppUser: boolean;
      canReadEntitlement: boolean;
      canReadIntention: boolean;
      canReadJournal: boolean;
      canReadPass: boolean;
      canReadSession: boolean;
      canUpdateJournalLifecycle: boolean;
      canUpdatePassLifecycle: boolean;
      canUpdateSessionLifecycle: boolean;
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
           has_table_privilege(current_user, 'public.entitlement', 'SELECT') AS "canReadEntitlement",
           has_table_privilege(current_user, 'public.ritual_pass', 'SELECT') AS "canReadPass",
           has_table_privilege(current_user, 'public.ritual_pass', 'INSERT') AS "canInsertPass",
           has_table_privilege(current_user, 'public.ritual_pass', 'DELETE') AS "canDeletePass",
           has_table_privilege(current_user, 'public.ritual_session_v2', 'SELECT') AS "canReadSession",
           has_table_privilege(current_user, 'public.ritual_session_v2', 'INSERT') AS "canInsertSession",
           has_table_privilege(current_user, 'public.ritual_session_v2', 'DELETE') AS "canDeleteSession",
           has_table_privilege(current_user, 'public.private_journal_entry', 'SELECT') AS "canReadJournal",
           has_table_privilege(current_user, 'public.private_journal_entry', 'INSERT') AS "canInsertJournal",
           has_table_privilege(current_user, 'public.private_journal_entry', 'DELETE') AS "canDeleteJournal",
           (
             has_column_privilege(current_user, 'public.ritual_session_v2', 'status', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'current_step_code', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'elapsed_seconds', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'revision', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'paused_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'completed_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'abandoned_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'last_mutation_key_hash', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_session_v2', 'last_mutation_request_hash', 'UPDATE')
           ) AS "canUpdateSessionLifecycle",
           (
             has_column_privilege(current_user, 'public.private_journal_entry', 'reflection_ciphertext', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'reflection_nonce', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'reflection_tag', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'encryption_key_version', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'revision', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'last_mutation_key_hash', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'last_mutation_request_hash', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'updated_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.private_journal_entry', 'deleted_at', 'UPDATE')
           ) AS "canUpdateJournalLifecycle",
           (
             has_column_privilege(current_user, 'public.ritual_pass', 'status', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_pass', 'consumed_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.ritual_pass', 'ritual_session_id', 'UPDATE')
           ) AS "canUpdatePassLifecycle"
  `);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.canUseSchema ||
    !row.canReadAccountSession ||
    !row.canReadAccountSubjectLink ||
    !row.canReadAppUser ||
    !row.canReadIntention ||
    !row.canReadEntitlement ||
    !row.canReadPass ||
    row.canInsertPass ||
    row.canDeletePass ||
    !row.canReadSession ||
    !row.canInsertSession ||
    row.canDeleteSession ||
    !row.canReadJournal ||
    !row.canInsertJournal ||
    row.canDeleteJournal ||
    !row.canUpdateSessionLifecycle ||
    !row.canUpdateJournalLifecycle ||
    !row.canUpdatePassLifecycle
  ) {
    return fail("RITUAL_JOURNAL_UNAVAILABLE");
  }
};

export const createRitualJournalPersistence = (
  database: PrismaClient,
): RitualJournalPersistence => {
  const attest = () => assertRitualJournalRuntimeDatabasePrivileges(database);

  const startSession: RitualJournalPersistence["startSession"] = async (input) => {
    const request = parseRitualSessionStartRequestV2(input.request);
    const snapshot = parseRitualSessionSnapshotV1(input.snapshot);
    if (snapshot.itemCode !== request.itemCode) return fail("RITUAL_JOURNAL_UNAVAILABLE");
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const principal = await resolvePrincipal(transaction, input.principal);
          if (principal === null) return fail("RITUAL_JOURNAL_SESSION_REQUIRED");
          const intention = await lookupActiveIntention(
            transaction,
            principal,
            request.intentionId,
          );
          if (intention === null) return fail("RITUAL_JOURNAL_NOT_FOUND");
          const prepared = parsePrepared(input.prepare({ subjectId: intention.subjectId }));
          const idempotencyHash = digestBytes(prepared.idempotencyKeyDigest);
          const requestHash = digestBytes(prepared.canonicalRequestDigest);
          const historical = await transaction.$queryRaw<SessionRow[]>`
            ${sessionSelect}
             WHERE ritual_session_v2.anonymous_subject_id = ${intention.subjectId}::uuid
               AND ritual_session_v2.idempotency_key_hash = ${idempotencyHash}
             LIMIT 2
          `;
          if (historical.length > 1) return fail("RITUAL_JOURNAL_UNAVAILABLE");
          if (historical[0] !== undefined) {
            if (
              historical[0].schemaVersion !== ritualSessionSchemaVersion ||
              !bytesEqual(historical[0].canonicalRequestHash, requestHash)
            ) {
              return fail("RITUAL_JOURNAL_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              resource: parseSessionRow(historical[0]),
            });
          }

          let passId: string | null = null;
          if (snapshot.access.kind !== "free") {
            if (principal.kind !== "account") return fail("RITUAL_JOURNAL_ACCESS_REQUIRED");
            if (snapshot.access.kind === "permanent_entitlement") {
              const legacyEntitlementCode = `sanctuary.${snapshot.itemCode}`;
              const entitlement = await transaction.$queryRaw<Array<{ id: string }>>`
                SELECT id
                  FROM entitlement
                 WHERE user_id = ${principal.userId}::uuid
                   AND status = 'active'
                   AND revoked_at IS NULL
                   AND entitlement_code IN (
                       ${snapshot.access.requirementCode},
                       ${legacyEntitlementCode}
                   )
                 LIMIT 1
              `;
              if (entitlement.length !== 1) return fail("RITUAL_JOURNAL_ACCESS_REQUIRED");
            } else {
              const passes = await transaction.$queryRaw<Array<{ id: string }>>`
                SELECT id
                  FROM ritual_pass
                 WHERE user_id = ${principal.userId}::uuid
                   AND access_requirement_code = ${snapshot.access.requirementCode}
                   AND status = 'available'
                   AND ritual_session_id IS NULL
                 ORDER BY granted_at, id
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
              `;
              passId = passes[0]?.id ?? null;
              if (passId === null) return fail("RITUAL_JOURNAL_ACCESS_REQUIRED");
            }
          }

          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO ritual_session_v2 (
              anonymous_subject_id, intention_id, item_code, schema_version,
              policy_version, idempotency_key_hash, canonical_request_hash, started_at,
              expires_at, catalog_id, catalog_version, item_version, publication_id,
              template_code, template_version, access_kind, access_requirement_code,
              ritual_pass_id, status, current_step_code, elapsed_seconds, revision
            ) VALUES (
              ${intention.subjectId}::uuid, ${request.intentionId}::uuid, ${snapshot.itemCode},
              ${ritualSessionSchemaVersion}, ${reflectionPolicyVersion},
              ${idempotencyHash}, ${requestHash}, CURRENT_TIMESTAMP, ${intention.expiresAt},
              ${snapshot.catalogId}, ${snapshot.catalogVersion}, ${snapshot.itemVersion}, ${snapshot.publicationId},
              ${snapshot.templateCode}, ${snapshot.templateVersion}, ${snapshot.access.kind},
              ${snapshot.access.requirementCode}, ${passId}::uuid, 'active', 'prepare', 0, 1
            ) ON CONFLICT DO NOTHING
            RETURNING id
          `;
          const id = inserted[0]?.id;
          if (inserted.length !== 1 || id === undefined || !uuidPattern.test(id)) {
            return fail("RITUAL_JOURNAL_CONFLICT");
          }
          if (passId !== null) {
            const consumed = await transaction.$queryRaw<Array<{ id: string }>>`
              UPDATE ritual_pass
                 SET status = 'consumed',
                     consumed_at = CURRENT_TIMESTAMP,
                     ritual_session_id = ${id}::uuid
               WHERE id = ${passId}::uuid
                 AND status = 'available'
                 AND ritual_session_id IS NULL
               RETURNING id
            `;
            if (consumed.length !== 1) return fail("RITUAL_JOURNAL_ACCESS_REQUIRED");
          }
          const row = await lookupSession(transaction, principal, id);
          if (row === null) return fail("RITUAL_JOURNAL_UNAVAILABLE");
          return Object.freeze({
            kind: "created" as const,
            resource: parseSessionRow(row),
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof RitualJournalPersistenceError) throw error;
      throw new RitualJournalPersistenceError("RITUAL_JOURNAL_UNAVAILABLE");
    }
  };

  const mutateSession: RitualJournalPersistence["mutateSession"] = async (input) => {
    if (!uuidPattern.test(input.id)) return fail("RITUAL_JOURNAL_NOT_FOUND");
    const request = parseRitualSessionMutationRequestV1(input.request);
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const principal = await resolvePrincipal(transaction, input.principal);
          if (principal === null) return fail("RITUAL_JOURNAL_NOT_FOUND");
          const current = await lookupSession(transaction, principal, input.id, true);
          if (current === null) return fail("RITUAL_JOURNAL_NOT_FOUND");
          const prepared = parsePrepared(
            input.prepare({ resourceId: current.id, subjectId: current.subjectId }),
          );
          const keyHash = digestBytes(prepared.idempotencyKeyDigest);
          const requestHash = digestBytes(prepared.canonicalRequestDigest);
          if (current.lastMutationKeyHash !== null) {
            if (bytesEqual(current.lastMutationKeyHash, keyHash)) {
              if (
                current.lastMutationRequestHash === null ||
                !bytesEqual(current.lastMutationRequestHash, requestHash)
              ) {
                return fail("RITUAL_JOURNAL_CONFLICT");
              }
              return Object.freeze({
                kind: "replayed" as const,
                resource: parseSessionRow(current),
              });
            }
          }
          const currentResource = parseSessionRow(current);
          let nextState;
          try {
            nextState = transitionRitualSessionStateV1(
              {
                currentStepCode: currentResource.currentStepCode,
                elapsedSeconds: currentResource.elapsedSeconds,
                revision: currentResource.revision,
                status: currentResource.status,
              },
              request,
            );
          } catch {
            return fail("RITUAL_JOURNAL_CONFLICT");
          }
          const updated = await transaction.$queryRaw<Array<{ id: string }>>`
            UPDATE ritual_session_v2
               SET status = ${nextState.status},
                   current_step_code = ${nextState.currentStepCode},
                   elapsed_seconds = ${nextState.elapsedSeconds},
                   revision = ${nextState.revision},
                   paused_at = CASE
                       WHEN ${request.action} = 'pause' THEN CURRENT_TIMESTAMP
                       ELSE NULL
                   END,
                   completed_at = CASE
                       WHEN ${request.action} = 'complete' THEN CURRENT_TIMESTAMP
                       ELSE completed_at
                   END,
                   abandoned_at = CASE
                       WHEN ${request.action} = 'abandon' THEN CURRENT_TIMESTAMP
                       ELSE abandoned_at
                   END,
                   last_mutation_key_hash = ${keyHash},
                   last_mutation_request_hash = ${requestHash}
             WHERE id = ${input.id}::uuid
               AND revision = ${request.expectedRevision}
               AND expires_at > CURRENT_TIMESTAMP
             RETURNING id
          `;
          if (updated.length !== 1) return fail("RITUAL_JOURNAL_CONFLICT");
          const row = await lookupSession(transaction, principal, input.id);
          if (row === null) return fail("RITUAL_JOURNAL_UNAVAILABLE");
          return Object.freeze({
            kind: "mutated" as const,
            resource: parseSessionRow(row),
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof RitualJournalPersistenceError) throw error;
      throw new RitualJournalPersistenceError("RITUAL_JOURNAL_UNAVAILABLE");
    }
  };

  const getSession: RitualJournalPersistence["getSession"] = async (input) => {
    if (!uuidPattern.test(input.id)) return null;
    await attest();
    try {
      return await database.$transaction(async (transaction) => {
        const principal = await resolvePrincipal(transaction, input.principal);
        if (principal === null) return null;
        const row = await lookupSession(transaction, principal, input.id);
        return row === null ? null : parseSessionRow(row);
      });
    } catch {
      throw new RitualJournalPersistenceError("RITUAL_JOURNAL_UNAVAILABLE");
    }
  };

  const createJournal: RitualJournalPersistence["createJournal"] = async (input) => {
    const request = parsePrivateJournalCreateRequestV2(input.request);
    if (!uuidPattern.test(input.resourceId)) return fail("RITUAL_JOURNAL_UNAVAILABLE");
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const principal = await resolvePrincipal(transaction, input.principal);
          if (principal === null) return fail("RITUAL_JOURNAL_SESSION_REQUIRED");
          const owner = ownershipPredicate(
            principal,
            Prisma.sql`ritual_session_v2.anonymous_subject_id`,
          );
          const chain = await transaction.$queryRaw<Array<{ expiresAt: Date; subjectId: string }>>`
            SELECT ritual_session_v2.anonymous_subject_id AS "subjectId",
                   LEAST(ritual_session_v2.expires_at, intention.expires_at) AS "expiresAt"
              FROM ritual_session_v2
              JOIN intention
                ON intention.id = ritual_session_v2.intention_id
               AND intention.anonymous_subject_id = ritual_session_v2.anonymous_subject_id
             WHERE ritual_session_v2.id = ${request.ritualSessionId}::uuid
               AND ritual_session_v2.intention_id = ${request.intentionId}::uuid
               AND ritual_session_v2.schema_version = ${ritualSessionSchemaVersion}
               AND ritual_session_v2.status = 'completed'
               AND ritual_session_v2.expires_at > CURRENT_TIMESTAMP
               AND intention.deleted_at IS NULL
               AND intention.expires_at > CURRENT_TIMESTAMP
               AND ${owner}
             FOR UPDATE OF ritual_session_v2, intention
          `;
          const linked = chain[0];
          if (chain.length !== 1 || linked === undefined) {
            return fail("RITUAL_JOURNAL_NOT_FOUND");
          }
          const preparation = input.prepare({
            resourceId: input.resourceId,
            subjectId: linked.subjectId,
          });
          const prepared = parsePrepared(preparation);
          const encrypted = parseCiphertext(preparation.encryptedReflection);
          if (encrypted.keyVersion !== prepared.keyVersion) {
            return fail("RITUAL_JOURNAL_UNAVAILABLE");
          }
          const keyHash = digestBytes(prepared.idempotencyKeyDigest);
          const requestHash = digestBytes(prepared.canonicalRequestDigest);
          const historical = await transaction.$queryRaw<JournalRow[]>`
            ${journalSelect}
             WHERE private_journal_entry.anonymous_subject_id = ${linked.subjectId}::uuid
               AND private_journal_entry.idempotency_key_hash = ${keyHash}
             LIMIT 2
          `;
          if (historical.length > 1) return fail("RITUAL_JOURNAL_UNAVAILABLE");
          if (historical[0] !== undefined) {
            if (
              historical[0].schemaVersion !== privateJournalSchemaVersion ||
              !bytesEqual(historical[0].canonicalRequestHash, requestHash)
            ) {
              return fail("RITUAL_JOURNAL_CONFLICT");
            }
            if (historical[0].deletedAt !== null) return fail("RITUAL_JOURNAL_NOT_FOUND");
            return Object.freeze({
              kind: "replayed" as const,
              resource: parseJournalRow(historical[0]),
            });
          }
          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO private_journal_entry (
              id, anonymous_subject_id, intention_id, ritual_session_id,
              reflection_ciphertext, reflection_nonce, reflection_tag,
              encryption_key_version, schema_version, policy_version,
              idempotency_key_hash, canonical_request_hash, created_at, updated_at,
              expires_at, revision
            ) VALUES (
              ${input.resourceId}::uuid, ${linked.subjectId}::uuid,
              ${request.intentionId}::uuid, ${request.ritualSessionId}::uuid,
              ${encrypted.ciphertext}, ${encrypted.nonce}, ${encrypted.tag},
              ${encrypted.keyVersion}, ${privateJournalSchemaVersion},
              ${reflectionPolicyVersion}, ${keyHash}, ${requestHash},
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${linked.expiresAt}, 1
            ) ON CONFLICT DO NOTHING
            RETURNING id
          `;
          if (inserted.length !== 1) return fail("RITUAL_JOURNAL_CONFLICT");
          const row = await lookupJournal(transaction, principal, input.resourceId, false);
          if (row === null) return fail("RITUAL_JOURNAL_UNAVAILABLE");
          return Object.freeze({
            kind: "created" as const,
            resource: parseJournalRow(row),
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof RitualJournalPersistenceError) throw error;
      throw new RitualJournalPersistenceError("RITUAL_JOURNAL_UNAVAILABLE");
    }
  };

  const mutateJournal: RitualJournalPersistence["mutateJournal"] = async (input) => {
    if (!uuidPattern.test(input.id)) return fail("RITUAL_JOURNAL_NOT_FOUND");
    const request = parsePrivateJournalMutationRequestV1(input.request);
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const principal = await resolvePrincipal(transaction, input.principal);
          if (principal === null) return fail("RITUAL_JOURNAL_NOT_FOUND");
          const current = await lookupJournal(transaction, principal, input.id, true, true);
          if (current === null) return fail("RITUAL_JOURNAL_NOT_FOUND");
          const preparation = input.prepare({
            resourceId: current.id,
            subjectId: current.subjectId,
          });
          const prepared = parsePrepared(preparation);
          const encrypted =
            request.action === "update" && preparation.encryptedReflection !== undefined
              ? parseCiphertext(preparation.encryptedReflection)
              : null;
          if (
            (request.action === "update" &&
              (encrypted === null || encrypted.keyVersion !== prepared.keyVersion)) ||
            (request.action === "delete" && preparation.encryptedReflection !== undefined)
          ) {
            return fail("RITUAL_JOURNAL_UNAVAILABLE");
          }
          const keyHash = digestBytes(prepared.idempotencyKeyDigest);
          const requestHash = digestBytes(prepared.canonicalRequestDigest);
          if (
            current.lastMutationKeyHash !== null &&
            bytesEqual(current.lastMutationKeyHash, keyHash)
          ) {
            if (
              current.lastMutationRequestHash === null ||
              !bytesEqual(current.lastMutationRequestHash, requestHash)
            ) {
              return fail("RITUAL_JOURNAL_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              resource: current.deletedAt === null ? parseJournalRow(current) : null,
            });
          }
          if (current.deletedAt !== null) return fail("RITUAL_JOURNAL_NOT_FOUND");
          if (current.revision !== request.expectedRevision) {
            return fail("RITUAL_JOURNAL_CONFLICT");
          }
          if (request.action === "update" && encrypted !== null) {
            const updated = await transaction.$queryRaw<Array<{ id: string }>>`
              UPDATE private_journal_entry
                 SET reflection_ciphertext = ${encrypted.ciphertext},
                     reflection_nonce = ${encrypted.nonce},
                     reflection_tag = ${encrypted.tag},
                     encryption_key_version = ${encrypted.keyVersion},
                     revision = revision + 1,
                     last_mutation_key_hash = ${keyHash},
                     last_mutation_request_hash = ${requestHash},
                     updated_at = CURRENT_TIMESTAMP
               WHERE id = ${input.id}::uuid
                 AND revision = ${request.expectedRevision}
                 AND deleted_at IS NULL
                 AND expires_at > CURRENT_TIMESTAMP
               RETURNING id
            `;
            if (updated.length !== 1) return fail("RITUAL_JOURNAL_CONFLICT");
          } else {
            const deleted = await transaction.$queryRaw<Array<{ id: string }>>`
              UPDATE private_journal_entry
                 SET deleted_at = CURRENT_TIMESTAMP,
                     revision = revision + 1,
                     last_mutation_key_hash = ${keyHash},
                     last_mutation_request_hash = ${requestHash},
                     updated_at = CURRENT_TIMESTAMP
               WHERE id = ${input.id}::uuid
                 AND revision = ${request.expectedRevision}
                 AND deleted_at IS NULL
                 AND expires_at > CURRENT_TIMESTAMP
               RETURNING id
            `;
            if (deleted.length !== 1) return fail("RITUAL_JOURNAL_CONFLICT");
          }
          const row = await lookupJournal(transaction, principal, input.id, true);
          if (row === null) return fail("RITUAL_JOURNAL_UNAVAILABLE");
          return Object.freeze({
            kind: "mutated" as const,
            resource: row.deletedAt === null ? parseJournalRow(row) : null,
          });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof RitualJournalPersistenceError) throw error;
      throw new RitualJournalPersistenceError("RITUAL_JOURNAL_UNAVAILABLE");
    }
  };

  const getJournal: RitualJournalPersistence["getJournal"] = async (input) => {
    if (!uuidPattern.test(input.id)) return null;
    await attest();
    try {
      return await database.$transaction(async (transaction) => {
        const principal = await resolvePrincipal(transaction, input.principal);
        if (principal === null) return null;
        const row = await lookupJournal(transaction, principal, input.id, false);
        return row === null ? null : parseJournalRow(row);
      });
    } catch {
      throw new RitualJournalPersistenceError("RITUAL_JOURNAL_UNAVAILABLE");
    }
  };

  return Object.freeze({
    createJournal,
    getJournal,
    getSession,
    mutateJournal,
    mutateSession,
    startSession,
  });
};
