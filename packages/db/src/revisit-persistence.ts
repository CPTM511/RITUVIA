import {
  isRevisitScheduleWithinWindowV1,
  parseRevisitMutationRequestV1,
  parseRevisitScheduleRequestV1,
  reflectionIntentionV2SchemaVersion,
  reflectionPolicyVersion,
  resolveRevisitScheduledLocalDateV1,
  revisitSchemaVersion,
  transitionRevisitStateV1,
  type RevisitOutcomeTag,
  type RevisitQuietHoursV1,
  type RevisitScheduleKind,
  type RevisitStatus,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

export const revisitPersistenceErrorCodes = Object.freeze([
  "REVISIT_CONFLICT",
  "REVISIT_NOT_FOUND",
  "REVISIT_SCHEDULE_INVALID",
  "REVISIT_SESSION_REQUIRED",
  "REVISIT_UNAVAILABLE",
] as const);

export type RevisitPersistenceErrorCode = (typeof revisitPersistenceErrorCodes)[number];

export class RevisitPersistenceError extends Error {
  readonly code: RevisitPersistenceErrorCode;

  constructor(code: RevisitPersistenceErrorCode) {
    super("The private Revisit persistence operation failed.");
    this.name = "RevisitPersistenceError";
    this.code = code;
  }
}

export type RevisitPrincipalTokens = Readonly<{
  accountSessionToken?: string | undefined;
  anonymousSessionToken?: string | undefined;
}>;

export type RevisitCiphertext = Readonly<{
  ciphertext: Uint8Array;
  keyVersion: string;
  nonce: Uint8Array;
  tag: Uint8Array;
}>;

export type RevisitPreparedDigests = Readonly<{
  canonicalRequestDigest: string;
  idempotencyKeyDigest: string;
}>;

export type PersistedRevisit = Readonly<{
  archivedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  encryptedCompletion: RevisitCiphertext | null;
  encryptedIntentionText: RevisitCiphertext;
  encryptedSmallAction: RevisitCiphertext;
  expiresAt: string;
  id: string;
  intentionId: string;
  intentionRevision: number;
  isDue: boolean;
  outcomeTags: readonly RevisitOutcomeTag[];
  policyVersion: typeof reflectionPolicyVersion;
  quietHours: RevisitQuietHoursV1 | null;
  reminderChannel: null;
  reminderPreference: "none";
  revision: number;
  scheduledLocalDate: string;
  scheduleKind: RevisitScheduleKind;
  schemaVersion: typeof revisitSchemaVersion;
  status: RevisitStatus;
  subjectId: string;
  timeZone: string;
  updatedAt: string;
}>;

export type RevisitResolution = Readonly<{
  kind: "created" | "replayed";
  resource: PersistedRevisit;
}>;

export type RevisitMutationResolution = Readonly<{
  kind: "mutated" | "replayed";
  resource: PersistedRevisit | null;
}>;

export type RevisitPersistence = Readonly<{
  get(input: { id: string; principal: RevisitPrincipalTokens }): Promise<PersistedRevisit | null>;
  list(input: { principal: RevisitPrincipalTokens }): Promise<readonly PersistedRevisit[]>;
  mutate(input: {
    id: string;
    prepare(context: { resourceId: string; subjectId: string }): RevisitPreparedDigests & {
      encryptedCompletion?: RevisitCiphertext | undefined;
    };
    principal: RevisitPrincipalTokens;
    request: unknown;
  }): Promise<RevisitMutationResolution>;
  schedule(input: {
    expectedIntentionRevision: number;
    prepare(context: { resourceId: string; subjectId: string }): RevisitPreparedDigests & {
      encryptedIntentionText: RevisitCiphertext;
      encryptedSmallAction: RevisitCiphertext;
    };
    principal: RevisitPrincipalTokens;
    request: unknown;
    resourceId: string;
  }): Promise<RevisitResolution>;
}>;

type ActivePrincipal =
  | Readonly<{ kind: "anonymous"; subjectId: string }>
  | Readonly<{ kind: "account"; userId: string }>;

type IntentionRow = Readonly<{
  expiresAt: Date;
  revision: number;
  subjectId: string;
}>;

type RevisitRow = Readonly<{
  archivedAt: Date | null;
  completedAt: Date | null;
  completionCiphertext: Uint8Array | null;
  completionKeyVersion: string | null;
  completionNonce: Uint8Array | null;
  completionTag: Uint8Array | null;
  createdAt: Date;
  deletedAt: Date | null;
  expiresAt: Date;
  id: string;
  intentionId: string;
  intentionRevision: number;
  intentionTextCiphertext: Uint8Array;
  intentionTextNonce: Uint8Array;
  intentionTextTag: Uint8Array;
  isDue: boolean;
  outcomeTags: string[];
  policyVersion: string;
  quietHoursEnd: string | null;
  quietHoursStart: string | null;
  reminderChannel: string | null;
  reminderPreference: string;
  revision: number;
  scheduleKind: string;
  scheduledLocalDate: string;
  schemaVersion: string;
  smallActionCiphertext: Uint8Array;
  smallActionNonce: Uint8Array;
  smallActionTag: Uint8Array;
  snapshotKeyVersion: string;
  status: string;
  subjectId: string;
  timeZone: string;
  updatedAt: Date;
}>;

type OperationRow = Readonly<{
  action: string;
  canonicalRequestHash: Uint8Array;
  resultDeleted: boolean;
  resultRevision: number;
  resultStatus: string;
  revisitId: string;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const keyVersionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const statuses = new Set<RevisitStatus>(["scheduled", "completed", "archived"]);
const scheduleKinds = new Set<RevisitScheduleKind>(["next_day", "seven_days", "custom"]);
const outcomeTags = new Set<RevisitOutcomeTag>([
  "action_taken",
  "partial_progress",
  "changed_direction",
  "not_yet",
  "released",
]);

const fail = (code: RevisitPersistenceErrorCode): never => {
  throw new RevisitPersistenceError(code);
};

const digestBytes = (digest: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(Buffer.from(digest.slice("sha256:".length), "hex")) as Uint8Array<ArrayBuffer>;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const parseDigests = (value: RevisitPreparedDigests): RevisitPreparedDigests => {
  if (
    !digestPattern.test(value.canonicalRequestDigest) ||
    !digestPattern.test(value.idempotencyKeyDigest)
  ) {
    return fail("REVISIT_UNAVAILABLE");
  }
  return Object.freeze({ ...value });
};

const parseCiphertext = (value: RevisitCiphertext): RevisitCiphertext => {
  if (
    !(value.ciphertext instanceof Uint8Array) ||
    value.ciphertext.byteLength < 1 ||
    value.ciphertext.byteLength > 16_384 ||
    !(value.nonce instanceof Uint8Array) ||
    value.nonce.byteLength !== 12 ||
    !(value.tag instanceof Uint8Array) ||
    value.tag.byteLength !== 16 ||
    !keyVersionPattern.test(value.keyVersion)
  ) {
    return fail("REVISIT_UNAVAILABLE");
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
  tokens: RevisitPrincipalTokens,
): Promise<ActivePrincipal | null> => {
  if (tokens.accountSessionToken !== undefined) {
    const hash = await tokenHash(tokens.accountSessionToken);
    if (hash !== null) {
      const rows = await transaction.$queryRaw<Array<{ userId: string }>>`
        SELECT account_session.user_id AS "userId"
          FROM account_session
          JOIN app_user ON app_user.id = account_session.user_id
         WHERE account_session.token_hash = ${hash}
           AND account_session.token_hash_version = 1
           AND account_session.revoked_at IS NULL
           AND account_session.expires_at > CURRENT_TIMESTAMP
           AND app_user.status = 'active'
         FOR UPDATE OF account_session, app_user
      `;
      if (rows.length === 1 && rows[0] !== undefined) {
        return Object.freeze({ ...rows[0], kind: "account" as const });
      }
    }
  }
  if (tokens.anonymousSessionToken !== undefined) {
    const hash = await tokenHash(tokens.anonymousSessionToken);
    if (hash !== null) {
      const rows = await transaction.$queryRaw<Array<{ subjectId: string }>>`
        SELECT anonymous_subject.id AS "subjectId"
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
      if (rows.length === 1 && rows[0] !== undefined) {
        return Object.freeze({ ...rows[0], kind: "anonymous" as const });
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

const revisitSelect = Prisma.sql`
  SELECT revisit.id,
         revisit.anonymous_subject_id AS "subjectId",
         revisit.intention_id AS "intentionId",
         revisit.schema_version AS "schemaVersion",
         revisit.policy_version AS "policyVersion",
         revisit.intention_revision AS "intentionRevision",
         revisit.intention_text_ciphertext AS "intentionTextCiphertext",
         revisit.intention_text_nonce AS "intentionTextNonce",
         revisit.intention_text_tag AS "intentionTextTag",
         revisit.small_action_ciphertext AS "smallActionCiphertext",
         revisit.small_action_nonce AS "smallActionNonce",
         revisit.small_action_tag AS "smallActionTag",
         revisit.snapshot_key_version AS "snapshotKeyVersion",
         revisit.schedule_kind AS "scheduleKind",
         to_char(revisit.scheduled_local_date, 'YYYY-MM-DD') AS "scheduledLocalDate",
         revisit.time_zone AS "timeZone",
         revisit.reminder_preference AS "reminderPreference",
         revisit.reminder_channel AS "reminderChannel",
         CASE WHEN revisit.quiet_hours_start IS NULL
              THEN NULL
              ELSE to_char(revisit.quiet_hours_start, 'HH24:MI')
          END AS "quietHoursStart",
         CASE WHEN revisit.quiet_hours_end IS NULL
              THEN NULL
              ELSE to_char(revisit.quiet_hours_end, 'HH24:MI')
          END AS "quietHoursEnd",
         revisit.completion_ciphertext AS "completionCiphertext",
         revisit.completion_nonce AS "completionNonce",
         revisit.completion_tag AS "completionTag",
         revisit.completion_key_version AS "completionKeyVersion",
         revisit.outcome_tags AS "outcomeTags",
         revisit.status,
         revisit.revision,
         revisit.created_at AS "createdAt",
         revisit.updated_at AS "updatedAt",
         revisit.completed_at AS "completedAt",
         revisit.archived_at AS "archivedAt",
         revisit.deleted_at AS "deletedAt",
         revisit.expires_at AS "expiresAt",
         (
           revisit.status = 'scheduled'
           AND revisit.scheduled_local_date <=
               (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::date
         ) AS "isDue"
    FROM revisit
    JOIN intention
      ON intention.id = revisit.intention_id
     AND intention.anonymous_subject_id = revisit.anonymous_subject_id
`;

const parseRow = (row: RevisitRow): PersistedRevisit => {
  const status = statuses.has(row.status as RevisitStatus)
    ? (row.status as RevisitStatus)
    : fail("REVISIT_UNAVAILABLE");
  const scheduleKind = scheduleKinds.has(row.scheduleKind as RevisitScheduleKind)
    ? (row.scheduleKind as RevisitScheduleKind)
    : fail("REVISIT_UNAVAILABLE");
  const parsedTags =
    Array.isArray(row.outcomeTags) &&
    row.outcomeTags.length <= 3 &&
    row.outcomeTags.every((tag) => outcomeTags.has(tag as RevisitOutcomeTag))
      ? (row.outcomeTags as RevisitOutcomeTag[])
      : fail("REVISIT_UNAVAILABLE");
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    !uuidPattern.test(row.intentionId) ||
    row.schemaVersion !== revisitSchemaVersion ||
    row.policyVersion !== reflectionPolicyVersion ||
    !Number.isSafeInteger(row.intentionRevision) ||
    row.intentionRevision < 1 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    !datePattern.test(row.scheduledLocalDate) ||
    row.reminderPreference !== "none" ||
    row.reminderChannel !== null ||
    (row.quietHoursStart === null) !== (row.quietHoursEnd === null) ||
    (row.quietHoursStart !== null && !timePattern.test(row.quietHoursStart)) ||
    (row.quietHoursEnd !== null && !timePattern.test(row.quietHoursEnd))
  ) {
    return fail("REVISIT_UNAVAILABLE");
  }
  const encryptedIntentionText = parseCiphertext({
    ciphertext: row.intentionTextCiphertext,
    keyVersion: row.snapshotKeyVersion,
    nonce: row.intentionTextNonce,
    tag: row.intentionTextTag,
  });
  const encryptedSmallAction = parseCiphertext({
    ciphertext: row.smallActionCiphertext,
    keyVersion: row.snapshotKeyVersion,
    nonce: row.smallActionNonce,
    tag: row.smallActionTag,
  });
  const completionParts = [
    row.completionCiphertext,
    row.completionNonce,
    row.completionTag,
    row.completionKeyVersion,
  ];
  if (
    completionParts.some((part) => part === null) &&
    completionParts.some((part) => part !== null)
  ) {
    return fail("REVISIT_UNAVAILABLE");
  }
  const encryptedCompletion =
    row.completionCiphertext === null ||
    row.completionNonce === null ||
    row.completionTag === null ||
    row.completionKeyVersion === null
      ? null
      : parseCiphertext({
          ciphertext: row.completionCiphertext,
          keyVersion: row.completionKeyVersion,
          nonce: row.completionNonce,
          tag: row.completionTag,
        });
  return Object.freeze({
    archivedAt: row.archivedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    encryptedCompletion,
    encryptedIntentionText,
    encryptedSmallAction,
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    intentionId: row.intentionId,
    intentionRevision: row.intentionRevision,
    isDue: row.isDue,
    outcomeTags: Object.freeze([...parsedTags]),
    policyVersion: reflectionPolicyVersion,
    quietHours:
      row.quietHoursStart === null || row.quietHoursEnd === null
        ? null
        : Object.freeze({
            endLocalTime: row.quietHoursEnd,
            startLocalTime: row.quietHoursStart,
          }),
    reminderChannel: null,
    reminderPreference: "none",
    revision: row.revision,
    scheduledLocalDate: row.scheduledLocalDate,
    scheduleKind,
    schemaVersion: revisitSchemaVersion,
    status,
    subjectId: row.subjectId,
    timeZone: row.timeZone,
    updatedAt: row.updatedAt.toISOString(),
  });
};

const lookupIntention = async (
  transaction: Prisma.TransactionClient,
  principal: ActivePrincipal,
  intentionId: string,
): Promise<IntentionRow | null> => {
  const owner = ownershipPredicate(principal, Prisma.sql`intention.anonymous_subject_id`);
  const rows = await transaction.$queryRaw<IntentionRow[]>`
    SELECT intention.anonymous_subject_id AS "subjectId",
           intention.revision,
           intention.expires_at AS "expiresAt"
      FROM intention
     WHERE intention.id = ${intentionId}::uuid
       AND intention.contract_version = ${reflectionIntentionV2SchemaVersion}
       AND intention.status IN ('active', 'completed')
       AND intention.deleted_at IS NULL
       AND intention.expires_at > CURRENT_TIMESTAMP
       AND ${owner}
     FOR UPDATE OF intention
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const lookupRevisit = async (
  transaction: Prisma.TransactionClient,
  principal: ActivePrincipal,
  id: string,
  options: Readonly<{ allowDeleted?: boolean; lock?: boolean }> = {},
): Promise<RevisitRow | null> => {
  const owner = ownershipPredicate(principal, Prisma.sql`revisit.anonymous_subject_id`);
  const rows = await transaction.$queryRaw<RevisitRow[]>`
    ${revisitSelect}
     WHERE revisit.id = ${id}::uuid
       AND revisit.schema_version = ${revisitSchemaVersion}
       AND revisit.expires_at > CURRENT_TIMESTAMP
       AND intention.deleted_at IS NULL
       AND intention.expires_at > CURRENT_TIMESTAMP
       AND ${options.allowDeleted === true ? Prisma.sql`TRUE` : Prisma.sql`revisit.deleted_at IS NULL`}
       AND ${owner}
     ${options.lock === true ? Prisma.sql`FOR UPDATE OF revisit, intention` : Prisma.empty}
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const lookupOperation = async (
  transaction: Prisma.TransactionClient,
  subjectId: string,
  keyHash: Uint8Array,
): Promise<OperationRow | null> => {
  const rows = await transaction.$queryRaw<OperationRow[]>`
    SELECT revisit_id AS "revisitId",
           action,
           canonical_request_hash AS "canonicalRequestHash",
           result_revision AS "resultRevision",
           result_status AS "resultStatus",
           result_deleted AS "resultDeleted"
      FROM revisit_operation
     WHERE anonymous_subject_id = ${subjectId}::uuid
       AND idempotency_key_hash = ${keyHash}
     LIMIT 2
  `;
  if (rows.length > 1) return fail("REVISIT_UNAVAILABLE");
  return rows[0] ?? null;
};

const validateReplay = (
  operation: OperationRow,
  input: Readonly<{
    action: string;
    current: RevisitRow | null;
    requestHash: Uint8Array;
    revisitId: string;
  }>,
): RevisitMutationResolution | RevisitResolution => {
  if (
    operation.action !== input.action ||
    operation.revisitId !== input.revisitId ||
    !bytesEqual(operation.canonicalRequestHash, input.requestHash)
  ) {
    return fail("REVISIT_CONFLICT");
  }
  if (operation.resultDeleted) {
    if (input.action !== "delete") return fail("REVISIT_CONFLICT");
    return Object.freeze({ kind: "replayed" as const, resource: null });
  }
  if (
    input.current === null ||
    input.current.deletedAt !== null ||
    input.current.revision !== operation.resultRevision ||
    input.current.status !== operation.resultStatus
  ) {
    return fail("REVISIT_CONFLICT");
  }
  return Object.freeze({
    kind: "replayed" as const,
    resource: parseRow(input.current),
  });
};

export const assertRevisitRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      canDeleteOperation: boolean;
      canDeleteRevisit: boolean;
      canInsertOperation: boolean;
      canInsertRevisit: boolean;
      canReadOperation: boolean;
      canReadRevisit: boolean;
      canUpdateLifecycle: boolean;
      canUpdateOperation: boolean;
      canUseSchema: boolean;
    }>
  >(Prisma.sql`
    SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS "canUseSchema",
           has_table_privilege(current_user, 'public.revisit', 'SELECT') AS "canReadRevisit",
           has_table_privilege(current_user, 'public.revisit', 'INSERT') AS "canInsertRevisit",
           has_table_privilege(current_user, 'public.revisit', 'DELETE') AS "canDeleteRevisit",
           has_table_privilege(current_user, 'public.revisit_operation', 'SELECT') AS "canReadOperation",
           has_table_privilege(current_user, 'public.revisit_operation', 'INSERT') AS "canInsertOperation",
           has_table_privilege(current_user, 'public.revisit_operation', 'UPDATE') AS "canUpdateOperation",
           has_table_privilege(current_user, 'public.revisit_operation', 'DELETE') AS "canDeleteOperation",
           (
             has_column_privilege(current_user, 'public.revisit', 'schedule_kind', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'scheduled_local_date', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'time_zone', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'quiet_hours_start', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'quiet_hours_end', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'completion_ciphertext', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'completion_nonce', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'completion_tag', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'completion_key_version', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'outcome_tags', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'status', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'revision', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'updated_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'completed_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'archived_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.revisit', 'deleted_at', 'UPDATE')
           ) AS "canUpdateLifecycle"
  `);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.canUseSchema ||
    !row.canReadRevisit ||
    !row.canInsertRevisit ||
    row.canDeleteRevisit ||
    !row.canReadOperation ||
    !row.canInsertOperation ||
    row.canUpdateOperation ||
    row.canDeleteOperation ||
    !row.canUpdateLifecycle
  ) {
    return fail("REVISIT_UNAVAILABLE");
  }
};

export const createRevisitPersistence = (database: PrismaClient): RevisitPersistence => {
  const attest = () => assertRevisitRuntimeDatabasePrivileges(database);

  const schedule: RevisitPersistence["schedule"] = async (input) => {
    if (
      !uuidPattern.test(input.resourceId) ||
      !Number.isSafeInteger(input.expectedIntentionRevision) ||
      input.expectedIntentionRevision < 1
    ) {
      return fail("REVISIT_UNAVAILABLE");
    }
    const request = parseRevisitScheduleRequestV1(input.request);
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const principal = await resolvePrincipal(transaction, input.principal);
          if (principal === null) return fail("REVISIT_SESSION_REQUIRED");
          const intention = await lookupIntention(transaction, principal, request.intentionId);
          if (intention === null) return fail("REVISIT_NOT_FOUND");
          const preparation = input.prepare({
            resourceId: input.resourceId,
            subjectId: intention.subjectId,
          });
          const prepared = parseDigests(preparation);
          const encryptedIntentionText = parseCiphertext(preparation.encryptedIntentionText);
          const encryptedSmallAction = parseCiphertext(preparation.encryptedSmallAction);
          if (encryptedIntentionText.keyVersion !== encryptedSmallAction.keyVersion) {
            return fail("REVISIT_UNAVAILABLE");
          }
          const keyHash = digestBytes(prepared.idempotencyKeyDigest);
          const requestHash = digestBytes(prepared.canonicalRequestDigest);
          const historical = await lookupOperation(transaction, intention.subjectId, keyHash);
          if (historical !== null) {
            const current = await lookupRevisit(transaction, principal, historical.revisitId, {
              allowDeleted: true,
            });
            return validateReplay(historical, {
              action: "schedule",
              current,
              requestHash,
              revisitId: historical.revisitId,
            }) as RevisitResolution;
          }
          if (intention.revision !== input.expectedIntentionRevision) {
            return fail("REVISIT_CONFLICT");
          }
          const zones = await transaction.$queryRaw<Array<{ observedDate: string }>>`
            SELECT to_char(
                     (CURRENT_TIMESTAMP AT TIME ZONE name)::date,
                     'YYYY-MM-DD'
                   ) AS "observedDate"
              FROM pg_timezone_names
             WHERE name = ${request.timeZone}
             LIMIT 2
          `;
          if (zones.length !== 1 || zones[0] === undefined) {
            return fail("REVISIT_SCHEDULE_INVALID");
          }
          const scheduledDate = resolveRevisitScheduledLocalDateV1(request, zones[0].observedDate);
          const expiryRows = await transaction.$queryRaw<Array<{ expiryDate: string }>>`
            SELECT to_char(
                     (${intention.expiresAt}::timestamptz AT TIME ZONE ${request.timeZone})::date,
                     'YYYY-MM-DD'
                   ) AS "expiryDate"
          `;
          const expiryDate = expiryRows[0]?.expiryDate;
          if (
            expiryRows.length !== 1 ||
            expiryDate === undefined ||
            !isRevisitScheduleWithinWindowV1(zones[0].observedDate, scheduledDate, expiryDate)
          ) {
            return fail("REVISIT_SCHEDULE_INVALID");
          }
          const quietStart = request.quietHours?.startLocalTime ?? null;
          const quietEnd = request.quietHours?.endLocalTime ?? null;
          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO revisit (
              id, anonymous_subject_id, intention_id, schema_version, policy_version,
              intention_revision, intention_text_ciphertext, intention_text_nonce,
              intention_text_tag, small_action_ciphertext, small_action_nonce,
              small_action_tag, snapshot_key_version, schedule_kind,
              scheduled_local_date, time_zone, reminder_preference, reminder_channel,
              quiet_hours_start, quiet_hours_end, outcome_tags, status, revision,
              created_at, updated_at, expires_at
            ) VALUES (
              ${input.resourceId}::uuid, ${intention.subjectId}::uuid,
              ${request.intentionId}::uuid, ${revisitSchemaVersion},
              ${reflectionPolicyVersion}, ${intention.revision},
              ${encryptedIntentionText.ciphertext}, ${encryptedIntentionText.nonce},
              ${encryptedIntentionText.tag}, ${encryptedSmallAction.ciphertext},
              ${encryptedSmallAction.nonce}, ${encryptedSmallAction.tag},
              ${encryptedIntentionText.keyVersion}, ${request.scheduleKind},
              ${scheduledDate}::date, ${request.timeZone}, 'none', NULL,
              ${quietStart}::time, ${quietEnd}::time, ARRAY[]::text[], 'scheduled', 1,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${intention.expiresAt}
            ) ON CONFLICT DO NOTHING
            RETURNING id
          `;
          if (inserted.length !== 1) return fail("REVISIT_CONFLICT");
          const operation = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO revisit_operation (
              anonymous_subject_id, revisit_id, action, idempotency_key_hash,
              canonical_request_hash, result_revision, result_status, result_deleted
            ) VALUES (
              ${intention.subjectId}::uuid, ${input.resourceId}::uuid, 'schedule',
              ${keyHash}, ${requestHash}, 1, 'scheduled', FALSE
            ) ON CONFLICT DO NOTHING
            RETURNING id
          `;
          if (operation.length !== 1) return fail("REVISIT_CONFLICT");
          const row = await lookupRevisit(transaction, principal, input.resourceId);
          if (row === null) return fail("REVISIT_UNAVAILABLE");
          return Object.freeze({ kind: "created" as const, resource: parseRow(row) });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof RevisitPersistenceError) throw error;
      throw new RevisitPersistenceError("REVISIT_UNAVAILABLE");
    }
  };

  const mutate: RevisitPersistence["mutate"] = async (input) => {
    if (!uuidPattern.test(input.id)) return fail("REVISIT_NOT_FOUND");
    const request = parseRevisitMutationRequestV1(input.request);
    await attest();
    try {
      return await database.$transaction(
        async (transaction) => {
          const principal = await resolvePrincipal(transaction, input.principal);
          if (principal === null) return fail("REVISIT_NOT_FOUND");
          const current = await lookupRevisit(transaction, principal, input.id, {
            allowDeleted: true,
            lock: true,
          });
          if (current === null) return fail("REVISIT_NOT_FOUND");
          const preparation = input.prepare({
            resourceId: current.id,
            subjectId: current.subjectId,
          });
          const prepared = parseDigests(preparation);
          const keyHash = digestBytes(prepared.idempotencyKeyDigest);
          const requestHash = digestBytes(prepared.canonicalRequestDigest);
          const historical = await lookupOperation(transaction, current.subjectId, keyHash);
          if (historical !== null) {
            return validateReplay(historical, {
              action: request.action,
              current,
              requestHash,
              revisitId: input.id,
            }) as RevisitMutationResolution;
          }
          if (current.deletedAt !== null) return fail("REVISIT_NOT_FOUND");
          let nextState;
          try {
            nextState = transitionRevisitStateV1(
              {
                completionPresent: current.completionCiphertext !== null,
                deleted: false,
                revision: current.revision,
                status: current.status as RevisitStatus,
              },
              request,
            );
          } catch {
            return fail("REVISIT_CONFLICT");
          }
          let encryptedCompletion: RevisitCiphertext | null = null;
          if (request.action === "complete") {
            if (preparation.encryptedCompletion === undefined) {
              return fail("REVISIT_UNAVAILABLE");
            }
            encryptedCompletion = parseCiphertext(preparation.encryptedCompletion);
          } else if (preparation.encryptedCompletion !== undefined) {
            return fail("REVISIT_UNAVAILABLE");
          }
          let scheduledDate = current.scheduledLocalDate;
          let scheduleKind = current.scheduleKind;
          let timeZone = current.timeZone;
          let quietStart = current.quietHoursStart;
          let quietEnd = current.quietHoursEnd;
          if (request.action === "reschedule") {
            const zones = await transaction.$queryRaw<Array<{ observedDate: string }>>`
              SELECT to_char(
                       (CURRENT_TIMESTAMP AT TIME ZONE name)::date,
                       'YYYY-MM-DD'
                     ) AS "observedDate"
                FROM pg_timezone_names
               WHERE name = ${request.timeZone}
               LIMIT 2
            `;
            if (zones.length !== 1 || zones[0] === undefined) {
              return fail("REVISIT_SCHEDULE_INVALID");
            }
            scheduledDate = resolveRevisitScheduledLocalDateV1(request, zones[0].observedDate);
            const expiryRows = await transaction.$queryRaw<Array<{ expiryDate: string }>>`
              SELECT to_char(
                       (${current.expiresAt}::timestamptz AT TIME ZONE ${request.timeZone})::date,
                       'YYYY-MM-DD'
                     ) AS "expiryDate"
            `;
            const expiryDate = expiryRows[0]?.expiryDate;
            if (
              expiryRows.length !== 1 ||
              expiryDate === undefined ||
              !isRevisitScheduleWithinWindowV1(zones[0].observedDate, scheduledDate, expiryDate)
            ) {
              return fail("REVISIT_SCHEDULE_INVALID");
            }
            scheduleKind = request.scheduleKind;
            timeZone = request.timeZone;
            quietStart = request.quietHours?.startLocalTime ?? null;
            quietEnd = request.quietHours?.endLocalTime ?? null;
          }
          const completionCiphertext = encryptedCompletion?.ciphertext ?? null;
          const completionNonce = encryptedCompletion?.nonce ?? null;
          const completionTag = encryptedCompletion?.tag ?? null;
          const completionKeyVersion = encryptedCompletion?.keyVersion ?? null;
          const tags = request.action === "complete" ? [...request.outcomeTags] : [];
          const updated = await transaction.$queryRaw<Array<{ id: string }>>`
            UPDATE revisit
               SET schedule_kind = ${scheduleKind},
                   scheduled_local_date = ${scheduledDate}::date,
                   time_zone = ${timeZone},
                   quiet_hours_start = ${quietStart}::time,
                   quiet_hours_end = ${quietEnd}::time,
                   completion_ciphertext = CASE
                     WHEN ${request.action} = 'complete' THEN ${completionCiphertext}
                     ELSE completion_ciphertext
                   END,
                   completion_nonce = CASE
                     WHEN ${request.action} = 'complete' THEN ${completionNonce}
                     ELSE completion_nonce
                   END,
                   completion_tag = CASE
                     WHEN ${request.action} = 'complete' THEN ${completionTag}
                     ELSE completion_tag
                   END,
                   completion_key_version = CASE
                     WHEN ${request.action} = 'complete' THEN ${completionKeyVersion}
                     ELSE completion_key_version
                   END,
                   outcome_tags = CASE
                     WHEN ${request.action} = 'complete' THEN ${tags}::text[]
                     ELSE outcome_tags
                   END,
                   status = ${nextState.status},
                   revision = ${nextState.revision},
                   completed_at = CASE
                     WHEN ${request.action} = 'complete' THEN CURRENT_TIMESTAMP
                     ELSE completed_at
                   END,
                   archived_at = CASE
                     WHEN ${request.action} = 'archive' THEN CURRENT_TIMESTAMP
                     ELSE archived_at
                   END,
                   deleted_at = CASE
                     WHEN ${request.action} = 'delete' THEN CURRENT_TIMESTAMP
                     ELSE deleted_at
                   END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE id = ${input.id}::uuid
               AND revision = ${request.expectedRevision}
               AND deleted_at IS NULL
               AND expires_at > CURRENT_TIMESTAMP
             RETURNING id
          `;
          if (updated.length !== 1) return fail("REVISIT_CONFLICT");
          const operation = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO revisit_operation (
              anonymous_subject_id, revisit_id, action, idempotency_key_hash,
              canonical_request_hash, result_revision, result_status, result_deleted
            ) VALUES (
              ${current.subjectId}::uuid, ${input.id}::uuid, ${request.action},
              ${keyHash}, ${requestHash}, ${nextState.revision}, ${nextState.status},
              ${request.action === "delete"}
            ) ON CONFLICT DO NOTHING
            RETURNING id
          `;
          if (operation.length !== 1) return fail("REVISIT_CONFLICT");
          if (request.action === "delete") {
            return Object.freeze({ kind: "mutated" as const, resource: null });
          }
          const row = await lookupRevisit(transaction, principal, input.id);
          if (row === null) return fail("REVISIT_UNAVAILABLE");
          return Object.freeze({ kind: "mutated" as const, resource: parseRow(row) });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof RevisitPersistenceError) throw error;
      throw new RevisitPersistenceError("REVISIT_UNAVAILABLE");
    }
  };

  const get: RevisitPersistence["get"] = async (input) => {
    if (!uuidPattern.test(input.id)) return null;
    await attest();
    try {
      return await database.$transaction(async (transaction) => {
        const principal = await resolvePrincipal(transaction, input.principal);
        if (principal === null) return null;
        const row = await lookupRevisit(transaction, principal, input.id);
        return row === null ? null : parseRow(row);
      });
    } catch {
      throw new RevisitPersistenceError("REVISIT_UNAVAILABLE");
    }
  };

  const list: RevisitPersistence["list"] = async (input) => {
    await attest();
    try {
      return await database.$transaction(async (transaction) => {
        const principal = await resolvePrincipal(transaction, input.principal);
        if (principal === null) return [];
        const owner = ownershipPredicate(principal, Prisma.sql`revisit.anonymous_subject_id`);
        const rows = await transaction.$queryRaw<RevisitRow[]>`
          ${revisitSelect}
           WHERE revisit.schema_version = ${revisitSchemaVersion}
             AND revisit.deleted_at IS NULL
             AND revisit.expires_at > CURRENT_TIMESTAMP
             AND intention.deleted_at IS NULL
             AND intention.expires_at > CURRENT_TIMESTAMP
             AND ${owner}
           ORDER BY
             CASE revisit.status
               WHEN 'scheduled' THEN 0
               WHEN 'completed' THEN 1
               ELSE 2
             END,
             revisit.scheduled_local_date,
             revisit.created_at DESC,
             revisit.id DESC
           LIMIT 50
        `;
        return Object.freeze(rows.map(parseRow));
      });
    } catch {
      throw new RevisitPersistenceError("REVISIT_UNAVAILABLE");
    }
  };

  return Object.freeze({ get, list, mutate, schedule });
};
