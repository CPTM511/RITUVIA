import { randomBytes, webcrypto } from "node:crypto";

import {
  parseRevisitReminderMutationV1,
  revisitReminderTemplateBinding,
  revisitReminderBackoffSeconds,
  revisitReminderChannel,
  revisitReminderFrequency,
  revisitReminderNoticeVersion,
  revisitReminderSchemaVersion,
  type RevisitReminderStateV1,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const providerReferencePattern = /^[A-Za-z0-9._:-]{1,200}$/u;

export const revisitReminderErrorCodes = Object.freeze([
  "REVISIT_REMINDER_INVALID",
  "REVISIT_REMINDER_CONFLICT",
  "REVISIT_REMINDER_NOT_FOUND",
  "REVISIT_REMINDER_SESSION_UNAVAILABLE",
  "REVISIT_REMINDER_UNAVAILABLE",
] as const);

export type RevisitReminderErrorCode = (typeof revisitReminderErrorCodes)[number];

export class RevisitReminderError extends Error {
  readonly code: RevisitReminderErrorCode;

  constructor(code: RevisitReminderErrorCode) {
    super("The Revisit reminder operation failed.");
    this.name = "RevisitReminderError";
    this.code = code;
  }
}

export type RevisitReminderDeliveryJob = Readonly<{
  attempt: number;
  leaseToken: string;
  locale: "en";
  maxAttempts: 3;
  quietHours: "none" | "saved";
  recipientIdentityId: string;
  revisitId: string;
  scheduledLocalDate: string;
  subscriptionId: string;
  templateFallbackUsed: boolean;
  templateId: string;
  templateLocale: string;
  templateSourceChecksum: string;
  templateVersion: string;
  timeZone: string;
}>;

export type RevisitReminderService = Readonly<{
  authorizeDelivery(input: {
    leaseToken: string;
    subscriptionId: string;
    templateFallbackUsed: boolean;
    templateId: string;
    templateLocale: string;
    templateSourceChecksum: string;
    templateVersion: string;
  }): Promise<boolean>;
  claimDue(input: { leaseSeconds: number }): Promise<RevisitReminderDeliveryJob | null>;
  completeDelivery(input: {
    leaseToken: string;
    providerMessageReference: string;
    subscriptionId: string;
  }): Promise<boolean>;
  failDelivery(input: {
    failureCode:
      | "provider_disabled"
      | "provider_rejected"
      | "provider_unavailable"
      | "template_unavailable"
      | "timeout";
    leaseToken: string;
    retryable: boolean;
    subscriptionId: string;
  }): Promise<"dead_lettered" | "retry_wait" | null>;
  get(input: { revisitId: string; sessionToken: string }): Promise<RevisitReminderStateV1 | null>;
  list(sessionToken: string): Promise<readonly RevisitReminderStateV1[]>;
  mutate(input: {
    idempotencyKey: string;
    request: unknown;
    revisitId: string;
    sessionToken: string;
  }): Promise<RevisitReminderStateV1>;
}>;

type ActiveAccountRow = Readonly<{
  authIdentityId: string;
  locale: string;
  userId: string;
}>;

type OwnedRevisitRow = Readonly<{
  accountSubjectLinkId: string;
  anonymousSubjectId: string;
  recipientIdentityId: string;
  revisitId: string;
}>;

type ReminderRow = Readonly<{
  attemptCount: number;
  canonicalRequestHash?: Uint8Array;
  createdAt: Date;
  deliveryState: string;
  id: string;
  locale: string;
  maxAttempts: number;
  noticeVersion: string;
  preferenceState: string;
  revisitId: string;
  schemaVersion: string;
  templateId: string;
  templateFallbackUsed: boolean;
  templateLocale: string;
  templateSourceChecksum: string;
  templateVersion: string;
  updatedAt: Date;
}>;

type PrivilegeRow = Readonly<{
  canDeleteOperation: boolean;
  canDeleteSubscription: boolean;
  canInsertOperation: boolean;
  canInsertSubscription: boolean;
  canSelectOperation: boolean;
  canSelectSubscription: boolean;
  canUpdateOperation: boolean;
  canUpdateSubscription: boolean;
  isBypassRls: boolean;
  isOwner: boolean;
  isSuperuser: boolean;
}>;

const sha256 = async (value: string | Uint8Array): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await webcrypto.subtle.digest(
      "SHA-256",
      typeof value === "string" ? new TextEncoder().encode(value) : value,
    ),
  ) as Uint8Array<ArrayBuffer>;

const tokenDigest = async (token: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!opaqueTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  return sha256(bytes);
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

const parseState = (row: ReminderRow): RevisitReminderStateV1 => {
  if (
    !uuidV4Pattern.test(row.revisitId) ||
    row.schemaVersion !== revisitReminderSchemaVersion ||
    row.noticeVersion !== revisitReminderNoticeVersion ||
    row.locale !== "en" ||
    !/^[a-z][a-z0-9-]{0,79}$/u.test(row.templateId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(row.templateVersion) ||
    !/^[0-9a-f]{64}$/u.test(row.templateSourceChecksum) ||
    row.templateLocale !== "en" ||
    row.templateFallbackUsed ||
    !["subscribed", "unsubscribed"].includes(row.preferenceState) ||
    !["cancelled", "dead_lettered", "delivered", "leased", "pending", "retry_wait"].includes(
      row.deliveryState,
    ) ||
    !Number.isSafeInteger(row.attemptCount) ||
    row.attemptCount < 0 ||
    row.maxAttempts !== 3 ||
    row.updatedAt.getTime() < row.createdAt.getTime()
  ) {
    throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
  }
  return Object.freeze({
    channel: revisitReminderChannel,
    deliveryState:
      row.deliveryState === "leased"
        ? "pending"
        : (row.deliveryState as RevisitReminderStateV1["deliveryState"]),
    frequency: revisitReminderFrequency,
    locale: "en",
    noticeVersion: revisitReminderNoticeVersion,
    preferenceState: row.preferenceState as RevisitReminderStateV1["preferenceState"],
    recordedAt: row.updatedAt.toISOString(),
    revisitId: row.revisitId,
    schemaVersion: revisitReminderSchemaVersion,
  });
};

const resolveActiveAccount = async (
  transaction: Prisma.TransactionClient,
  sessionToken: string,
): Promise<ActiveAccountRow | null> => {
  const digest = await tokenDigest(sessionToken);
  if (digest === null) return null;
  const rows = await transaction.$queryRaw<ActiveAccountRow[]>`
    SELECT account.id AS "userId", account.locale,
           session.auth_identity_id AS "authIdentityId"
      FROM account_session AS session
      JOIN app_user AS account ON account.id = session.user_id
     WHERE session.token_hash = ${digest}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.status = 'active'
     FOR UPDATE OF session
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const readOwnedRevisit = async (
  transaction: Prisma.TransactionClient,
  account: ActiveAccountRow,
  revisitId: string,
): Promise<OwnedRevisitRow | null> => {
  const rows = await transaction.$queryRaw<OwnedRevisitRow[]>`
    SELECT revisit.id AS "revisitId",
           revisit.anonymous_subject_id AS "anonymousSubjectId",
           link.id AS "accountSubjectLinkId",
           identity.id AS "recipientIdentityId"
      FROM revisit
      JOIN intention
        ON intention.id = revisit.intention_id
       AND intention.anonymous_subject_id = revisit.anonymous_subject_id
      JOIN account_subject_link AS link
        ON link.anonymous_subject_id = revisit.anonymous_subject_id
       AND link.user_id = ${account.userId}::uuid
      JOIN auth_identity AS identity
        ON identity.id = ${account.authIdentityId}::uuid
       AND identity.user_id = ${account.userId}::uuid
     WHERE revisit.id = ${revisitId}::uuid
       AND revisit.status = 'scheduled'
       AND revisit.deleted_at IS NULL
       AND revisit.expires_at > CURRENT_TIMESTAMP
       AND intention.deleted_at IS NULL
       AND link.privacy_deleted_at IS NULL
     FOR UPDATE OF revisit
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const readSubscription = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  revisitId: string,
): Promise<ReminderRow | null> => {
  const rows = await transaction.$queryRaw<ReminderRow[]>`
    SELECT id, revisit_id AS "revisitId", schema_version AS "schemaVersion",
           notice_version AS "noticeVersion", locale,
           template_id AS "templateId", template_version AS "templateVersion",
           template_source_checksum AS "templateSourceChecksum",
           template_locale AS "templateLocale",
           template_fallback_used AS "templateFallbackUsed",
           preference_state AS "preferenceState", delivery_state AS "deliveryState",
           attempt_count AS "attemptCount", max_attempts AS "maxAttempts",
           created_at AS "createdAt", updated_at AS "updatedAt"
      FROM revisit_reminder_subscription
     WHERE user_id = ${userId}::uuid
       AND revisit_id = ${revisitId}::uuid
  `;
  if (rows.length > 1) throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
  return rows[0] ?? null;
};

const isDatabaseConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2002" ||
    error.code === "23505" ||
    (error.code === "P2010" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("Code: `23505`")));

export const assertRevisitReminderRuntimeDatabasePrivileges = async (
  database: Pick<PrismaClient, "$queryRaw">,
): Promise<void> => {
  const rows = await database.$queryRaw<PrivilegeRow[]>`
    SELECT
      has_table_privilege(current_user, 'public.revisit_reminder_subscription', 'SELECT')
        AS "canSelectSubscription",
      has_table_privilege(current_user, 'public.revisit_reminder_subscription', 'INSERT')
        AS "canInsertSubscription",
      has_any_column_privilege(
        current_user, 'public.revisit_reminder_subscription', 'UPDATE'
      ) AS "canUpdateSubscription",
      has_table_privilege(
        current_user,
        'public.revisit_reminder_subscription',
        'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
      ) AS "canDeleteSubscription",
      has_table_privilege(current_user, 'public.revisit_reminder_operation', 'SELECT')
        AS "canSelectOperation",
      has_table_privilege(current_user, 'public.revisit_reminder_operation', 'INSERT')
        AS "canInsertOperation",
      (
        has_table_privilege(current_user, 'public.revisit_reminder_operation', 'UPDATE')
        OR has_any_column_privilege(
          current_user, 'public.revisit_reminder_operation', 'UPDATE'
        )
      ) AS "canUpdateOperation",
      has_table_privilege(
        current_user,
        'public.revisit_reminder_operation',
        'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
      ) AS "canDeleteOperation",
      role.rolsuper AS "isSuperuser",
      role.rolbypassrls AS "isBypassRls",
      pg_get_userbyid(class.relowner) = current_user AS "isOwner"
    FROM pg_roles AS role
    CROSS JOIN pg_class AS class
    WHERE role.rolname = current_user
      AND class.oid = 'public.revisit_reminder_subscription'::regclass
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.canSelectSubscription ||
    !row.canInsertSubscription ||
    !row.canUpdateSubscription ||
    row.canDeleteSubscription ||
    !row.canSelectOperation ||
    !row.canInsertOperation ||
    row.canUpdateOperation ||
    row.canDeleteOperation ||
    row.isSuperuser ||
    row.isBypassRls ||
    row.isOwner
  ) {
    throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
  }
};

export const createRevisitReminderService = (database: PrismaClient): RevisitReminderService => {
  const list: RevisitReminderService["list"] = async (sessionToken) => {
    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    return database.$transaction(async (transaction) => {
      const account = await resolveActiveAccount(transaction, sessionToken);
      if (account === null) {
        throw new RevisitReminderError("REVISIT_REMINDER_SESSION_UNAVAILABLE");
      }
      const rows = await transaction.$queryRaw<ReminderRow[]>`
        SELECT subscription.id, subscription.revisit_id AS "revisitId",
               subscription.schema_version AS "schemaVersion",
               subscription.notice_version AS "noticeVersion", subscription.locale,
               subscription.template_id AS "templateId",
               subscription.template_version AS "templateVersion",
               subscription.template_source_checksum AS "templateSourceChecksum",
               subscription.template_locale AS "templateLocale",
               subscription.template_fallback_used AS "templateFallbackUsed",
               subscription.preference_state AS "preferenceState",
               subscription.delivery_state AS "deliveryState",
               subscription.attempt_count AS "attemptCount",
               subscription.max_attempts AS "maxAttempts",
               subscription.created_at AS "createdAt",
               subscription.updated_at AS "updatedAt"
          FROM revisit_reminder_subscription AS subscription
          JOIN account_subject_link AS link
            ON link.id = subscription.account_subject_link_id
           AND link.user_id = subscription.user_id
           AND link.anonymous_subject_id = subscription.anonymous_subject_id
           AND link.privacy_deleted_at IS NULL
         WHERE subscription.user_id = ${account.userId}::uuid
         ORDER BY subscription.updated_at DESC, subscription.id DESC
         LIMIT 51
      `;
      if (rows.length > 50) {
        throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
      }
      return Object.freeze(rows.map(parseState));
    });
  };

  const get: RevisitReminderService["get"] = async (input) => {
    if (!uuidV4Pattern.test(input.revisitId)) {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    return database.$transaction(async (transaction) => {
      const account = await resolveActiveAccount(transaction, input.sessionToken);
      if (account === null) {
        throw new RevisitReminderError("REVISIT_REMINDER_SESSION_UNAVAILABLE");
      }
      const revisit = await readOwnedRevisit(transaction, account, input.revisitId);
      if (revisit === null) throw new RevisitReminderError("REVISIT_REMINDER_NOT_FOUND");
      const subscription = await readSubscription(transaction, account.userId, revisit.revisitId);
      return subscription === null ? null : parseState(subscription);
    });
  };

  const mutate: RevisitReminderService["mutate"] = async (input) => {
    if (!uuidV4Pattern.test(input.revisitId) || !idempotencyKeyPattern.test(input.idempotencyKey)) {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    let request: ReturnType<typeof parseRevisitReminderMutationV1>;
    try {
      request = parseRevisitReminderMutationV1(input.request);
    } catch {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    const idempotencyKeyHash = await sha256(
      `rituvia.revisit-reminder.idempotency.v1:${input.idempotencyKey}`,
    );
    const canonicalRequestHash = await sha256(
      JSON.stringify({ ...request, revisitId: input.revisitId }),
    );

    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    try {
      return await database.$transaction(async (transaction) => {
        const account = await resolveActiveAccount(transaction, input.sessionToken);
        if (account === null) {
          throw new RevisitReminderError("REVISIT_REMINDER_SESSION_UNAVAILABLE");
        }
        if (account.locale !== "en") {
          throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
        }
        await transaction.$queryRaw`
          SELECT id FROM app_user WHERE id = ${account.userId}::uuid FOR UPDATE
        `;
        const revisit = await readOwnedRevisit(transaction, account, input.revisitId);
        if (revisit === null) throw new RevisitReminderError("REVISIT_REMINDER_NOT_FOUND");

        const replays = await transaction.$queryRaw<ReminderRow[]>`
          SELECT operation.canonical_request_hash AS "canonicalRequestHash",
                 subscription.id, subscription.revisit_id AS "revisitId",
                 subscription.schema_version AS "schemaVersion",
                 subscription.notice_version AS "noticeVersion", subscription.locale,
                 subscription.template_id AS "templateId",
                 subscription.template_version AS "templateVersion",
                 subscription.template_source_checksum AS "templateSourceChecksum",
                 subscription.template_locale AS "templateLocale",
                 subscription.template_fallback_used AS "templateFallbackUsed",
                 operation.result_preference_state AS "preferenceState",
                 operation.result_delivery_state AS "deliveryState",
                 subscription.attempt_count AS "attemptCount",
                 subscription.max_attempts AS "maxAttempts",
                 operation.created_at AS "createdAt",
                 operation.created_at AS "updatedAt"
            FROM revisit_reminder_operation AS operation
            JOIN revisit_reminder_subscription AS subscription
              ON subscription.id = operation.subscription_id
             AND subscription.user_id = operation.user_id
           WHERE operation.user_id = ${account.userId}::uuid
             AND operation.idempotency_key_hash = ${idempotencyKeyHash}
        `;
        if (replays.length > 1) {
          throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
        }
        const replay = replays[0];
        if (replay !== undefined) {
          if (
            replay.canonicalRequestHash === undefined ||
            !bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)
          ) {
            throw new RevisitReminderError("REVISIT_REMINDER_CONFLICT");
          }
          return parseState(replay);
        }

        const current = await readSubscription(transaction, account.userId, revisit.revisitId);
        if (current?.deliveryState === "delivered") {
          throw new RevisitReminderError("REVISIT_REMINDER_CONFLICT");
        }
        const subscribed = request.action === "subscribe";
        const rows =
          current === null
            ? await transaction.$queryRaw<ReminderRow[]>`
                INSERT INTO revisit_reminder_subscription (
                  user_id, account_subject_link_id, anonymous_subject_id, revisit_id,
                  recipient_identity_id, schema_version, notice_version, channel, frequency,
                  locale, template_id, template_version, template_source_checksum,
                  template_locale, template_fallback_used,
                  preference_state, delivery_state, attempt_count, max_attempts,
                  next_attempt_at, updated_at, unsubscribed_at
                ) VALUES (
                  ${account.userId}::uuid, ${revisit.accountSubjectLinkId}::uuid,
                  ${revisit.anonymousSubjectId}::uuid, ${revisit.revisitId}::uuid,
                  ${revisit.recipientIdentityId}::uuid, ${revisitReminderSchemaVersion},
                  ${revisitReminderNoticeVersion}, ${revisitReminderChannel},
                  ${revisitReminderFrequency}, 'en',
                  ${revisitReminderTemplateBinding.templateId},
                  ${revisitReminderTemplateBinding.templateVersion},
                  ${revisitReminderTemplateBinding.sourceChecksum},
                  ${revisitReminderTemplateBinding.locale},
                  ${revisitReminderTemplateBinding.fallbackUsed},
                  ${subscribed ? "subscribed" : "unsubscribed"},
                  ${subscribed ? "pending" : "cancelled"},
                  0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                  ${subscribed ? null : Prisma.sql`CURRENT_TIMESTAMP`}
                )
                RETURNING id, revisit_id AS "revisitId", schema_version AS "schemaVersion",
                          notice_version AS "noticeVersion", locale,
                          template_id AS "templateId", template_version AS "templateVersion",
                          template_source_checksum AS "templateSourceChecksum",
                          template_locale AS "templateLocale",
                          template_fallback_used AS "templateFallbackUsed",
                          preference_state AS "preferenceState",
                          delivery_state AS "deliveryState",
                          attempt_count AS "attemptCount", max_attempts AS "maxAttempts",
                          created_at AS "createdAt", updated_at AS "updatedAt"
              `
            : await transaction.$queryRaw<ReminderRow[]>`
                UPDATE revisit_reminder_subscription
                   SET recipient_identity_id = ${revisit.recipientIdentityId}::uuid,
                       schema_version = ${revisitReminderSchemaVersion},
                       notice_version = ${revisitReminderNoticeVersion},
                       channel = ${revisitReminderChannel},
                       frequency = ${revisitReminderFrequency},
                       locale = 'en',
                       template_id = ${revisitReminderTemplateBinding.templateId},
                       template_version = ${revisitReminderTemplateBinding.templateVersion},
                       template_source_checksum = ${revisitReminderTemplateBinding.sourceChecksum},
                       template_locale = ${revisitReminderTemplateBinding.locale},
                       template_fallback_used = ${revisitReminderTemplateBinding.fallbackUsed},
                       preference_state = ${subscribed ? "subscribed" : "unsubscribed"},
                       delivery_state = ${subscribed ? "pending" : "cancelled"},
                       attempt_count = 0,
                       next_attempt_at = CURRENT_TIMESTAMP,
                       lease_token_hash = NULL,
                       leased_until = NULL,
                       last_failure_code = NULL,
                       provider_message_reference = NULL,
                       updated_at = CURRENT_TIMESTAMP,
                       delivered_at = NULL,
                       unsubscribed_at =
                         ${subscribed ? null : Prisma.sql`CURRENT_TIMESTAMP`},
                       dead_lettered_at = NULL
                 WHERE id = ${current.id}::uuid
                   AND user_id = ${account.userId}::uuid
                RETURNING id, revisit_id AS "revisitId", schema_version AS "schemaVersion",
                          notice_version AS "noticeVersion", locale,
                          template_id AS "templateId", template_version AS "templateVersion",
                          template_source_checksum AS "templateSourceChecksum",
                          template_locale AS "templateLocale",
                          template_fallback_used AS "templateFallbackUsed",
                          preference_state AS "preferenceState",
                          delivery_state AS "deliveryState",
                          attempt_count AS "attemptCount", max_attempts AS "maxAttempts",
                          created_at AS "createdAt", updated_at AS "updatedAt"
              `;
        const result = rows[0];
        if (rows.length !== 1 || result === undefined) {
          throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
        }
        await transaction.$executeRaw`
          INSERT INTO revisit_reminder_operation (
            subscription_id, user_id, revisit_id, action, idempotency_key_hash,
            canonical_request_hash, result_preference_state, result_delivery_state
          ) VALUES (
            ${result.id}::uuid, ${account.userId}::uuid, ${revisit.revisitId}::uuid,
            ${request.action}, ${idempotencyKeyHash}, ${canonicalRequestHash},
            ${result.preferenceState}, ${result.deliveryState}
          )
        `;
        return parseState(result);
      });
    } catch (error) {
      if (error instanceof RevisitReminderError) throw error;
      if (isDatabaseConflict(error)) {
        throw new RevisitReminderError("REVISIT_REMINDER_CONFLICT");
      }
      throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
    }
  };

  const claimDue: RevisitReminderService["claimDue"] = async (input) => {
    if (
      !Number.isSafeInteger(input.leaseSeconds) ||
      input.leaseSeconds < 15 ||
      input.leaseSeconds > 300
    ) {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    const leaseToken = randomBytes(32).toString("base64url");
    const leaseTokenHash = await tokenDigest(leaseToken);
    if (leaseTokenHash === null) {
      throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
    }
    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    return database.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        UPDATE revisit_reminder_subscription
           SET delivery_state =
                 CASE WHEN attempt_count >= max_attempts
                      THEN 'dead_lettered' ELSE 'retry_wait' END,
               next_attempt_at = CURRENT_TIMESTAMP,
               lease_token_hash = NULL,
               leased_until = NULL,
               last_failure_code = 'lease_expired',
               updated_at = CURRENT_TIMESTAMP,
               dead_lettered_at =
                 CASE WHEN attempt_count >= max_attempts
                      THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE delivery_state = 'leased'
           AND leased_until <= CURRENT_TIMESTAMP
      `;
      const rows = await transaction.$queryRaw<
        Array<
          Readonly<{
            attempt: number;
            hasQuietHours: boolean;
            locale: string;
            maxAttempts: number;
            recipientIdentityId: string;
            revisitId: string;
            scheduledLocalDate: string;
            subscriptionId: string;
            templateFallbackUsed: boolean;
            templateId: string;
            templateLocale: string;
            templateSourceChecksum: string;
            templateVersion: string;
            timeZone: string;
          }>
        >
      >`
        WITH candidate AS (
          SELECT subscription.id,
                 revisit.scheduled_local_date::text AS "scheduledLocalDate",
                 revisit.time_zone AS "timeZone",
                 revisit.quiet_hours_start IS NOT NULL AS "hasQuietHours"
            FROM revisit_reminder_subscription AS subscription
            JOIN app_user AS account
              ON account.id = subscription.user_id
             AND account.status = 'active'
             AND account.locale = subscription.locale
            JOIN account_subject_link AS link
              ON link.id = subscription.account_subject_link_id
             AND link.user_id = subscription.user_id
             AND link.anonymous_subject_id = subscription.anonymous_subject_id
             AND link.privacy_deleted_at IS NULL
            JOIN revisit
              ON revisit.id = subscription.revisit_id
             AND revisit.anonymous_subject_id = subscription.anonymous_subject_id
            JOIN intention
              ON intention.id = revisit.intention_id
             AND intention.anonymous_subject_id = revisit.anonymous_subject_id
            JOIN auth_identity AS identity
              ON identity.id = subscription.recipient_identity_id
             AND identity.user_id = subscription.user_id
           WHERE subscription.preference_state = 'subscribed'
             AND subscription.delivery_state IN ('pending', 'retry_wait')
             AND subscription.schema_version = ${revisitReminderSchemaVersion}
             AND subscription.notice_version = ${revisitReminderNoticeVersion}
             AND subscription.channel = ${revisitReminderChannel}
             AND subscription.frequency = ${revisitReminderFrequency}
             AND subscription.locale = 'en'
             AND subscription.next_attempt_at <= CURRENT_TIMESTAMP
             AND subscription.attempt_count < subscription.max_attempts
             AND revisit.status = 'scheduled'
             AND revisit.deleted_at IS NULL
             AND revisit.expires_at > CURRENT_TIMESTAMP
             AND intention.deleted_at IS NULL
             AND (
               (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::date
                 > revisit.scheduled_local_date
               OR (
                 (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::date
                   = revisit.scheduled_local_date
                 AND (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time >= TIME '09:00'
               )
             )
             AND (
               revisit.quiet_hours_start IS NULL
               OR (
                 revisit.quiet_hours_start < revisit.quiet_hours_end
                 AND (
                   (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                     < revisit.quiet_hours_start
                   OR (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                     >= revisit.quiet_hours_end
                 )
               )
               OR (
                 revisit.quiet_hours_start > revisit.quiet_hours_end
                 AND (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                   >= revisit.quiet_hours_end
                 AND (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                   < revisit.quiet_hours_start
               )
             )
           ORDER BY subscription.next_attempt_at, subscription.created_at, subscription.id
           FOR UPDATE OF subscription SKIP LOCKED
           LIMIT 1
        )
        UPDATE revisit_reminder_subscription AS subscription
           SET delivery_state = 'leased',
               attempt_count = subscription.attempt_count + 1,
               lease_token_hash = ${leaseTokenHash},
               leased_until = CURRENT_TIMESTAMP + (${input.leaseSeconds} * INTERVAL '1 second'),
               updated_at = CURRENT_TIMESTAMP
          FROM candidate
         WHERE subscription.id = candidate.id
        RETURNING subscription.id AS "subscriptionId",
                  subscription.revisit_id AS "revisitId",
                  subscription.recipient_identity_id AS "recipientIdentityId",
                  subscription.locale,
                  subscription.template_id AS "templateId",
                  subscription.template_version AS "templateVersion",
                  subscription.template_source_checksum AS "templateSourceChecksum",
                  subscription.template_locale AS "templateLocale",
                  subscription.template_fallback_used AS "templateFallbackUsed",
                  subscription.attempt_count AS attempt,
                  subscription.max_attempts AS "maxAttempts",
                  candidate."scheduledLocalDate",
                  candidate."timeZone",
                  candidate."hasQuietHours"
      `;
      const row = rows[0];
      if (rows.length === 0 || row === undefined) return null;
      try {
        new Intl.DateTimeFormat("en", { timeZone: row.timeZone }).format(0);
      } catch {
        throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
      }
      if (
        rows.length !== 1 ||
        !uuidV4Pattern.test(row.subscriptionId) ||
        !uuidV4Pattern.test(row.revisitId) ||
        !uuidV4Pattern.test(row.recipientIdentityId) ||
        row.locale !== "en" ||
        !/^[a-z][a-z0-9-]{0,79}$/u.test(row.templateId) ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(row.templateVersion) ||
        !/^[0-9a-f]{64}$/u.test(row.templateSourceChecksum) ||
        row.templateLocale !== "en" ||
        row.templateFallbackUsed ||
        !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(row.scheduledLocalDate) ||
        Number.isNaN(Date.parse(`${row.scheduledLocalDate}T00:00:00.000Z`)) ||
        typeof row.hasQuietHours !== "boolean" ||
        !Number.isSafeInteger(row.attempt) ||
        row.attempt < 1 ||
        row.maxAttempts !== 3
      ) {
        throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
      }
      return Object.freeze({
        attempt: row.attempt,
        leaseToken,
        locale: "en",
        maxAttempts: 3,
        quietHours: row.hasQuietHours ? "saved" : "none",
        recipientIdentityId: row.recipientIdentityId,
        revisitId: row.revisitId,
        scheduledLocalDate: row.scheduledLocalDate,
        subscriptionId: row.subscriptionId,
        templateFallbackUsed: row.templateFallbackUsed,
        templateId: row.templateId,
        templateLocale: row.templateLocale,
        templateSourceChecksum: row.templateSourceChecksum,
        templateVersion: row.templateVersion,
        timeZone: row.timeZone,
      });
    });
  };

  const authorizeDelivery: RevisitReminderService["authorizeDelivery"] = async (input) => {
    if (
      !uuidV4Pattern.test(input.subscriptionId) ||
      !/^[a-z][a-z0-9-]{0,79}$/u.test(input.templateId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(input.templateVersion) ||
      !/^[0-9a-f]{64}$/u.test(input.templateSourceChecksum) ||
      input.templateLocale !== "en" ||
      input.templateFallbackUsed
    ) {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    const leaseTokenHash = await tokenDigest(input.leaseToken);
    if (leaseTokenHash === null) return false;
    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    const rows = await database.$queryRaw<Array<Readonly<{ authorized: boolean }>>>`
      SELECT EXISTS (
        SELECT 1
          FROM revisit_reminder_subscription AS subscription
          JOIN app_user AS account
            ON account.id = subscription.user_id
           AND account.status = 'active'
           AND account.locale = subscription.locale
          JOIN account_subject_link AS link
            ON link.id = subscription.account_subject_link_id
           AND link.user_id = subscription.user_id
           AND link.anonymous_subject_id = subscription.anonymous_subject_id
           AND link.privacy_deleted_at IS NULL
          JOIN revisit
            ON revisit.id = subscription.revisit_id
           AND revisit.anonymous_subject_id = subscription.anonymous_subject_id
          JOIN intention
            ON intention.id = revisit.intention_id
           AND intention.anonymous_subject_id = revisit.anonymous_subject_id
          JOIN auth_identity AS identity
            ON identity.id = subscription.recipient_identity_id
           AND identity.user_id = subscription.user_id
         WHERE subscription.id = ${input.subscriptionId}::uuid
           AND subscription.preference_state = 'subscribed'
           AND subscription.delivery_state = 'leased'
           AND subscription.schema_version = ${revisitReminderSchemaVersion}
           AND subscription.notice_version = ${revisitReminderNoticeVersion}
           AND subscription.channel = ${revisitReminderChannel}
           AND subscription.frequency = ${revisitReminderFrequency}
           AND subscription.locale = 'en'
           AND subscription.template_id = ${input.templateId}
           AND subscription.template_version = ${input.templateVersion}
           AND subscription.template_source_checksum = ${input.templateSourceChecksum}
           AND subscription.template_locale = ${input.templateLocale}
           AND subscription.template_fallback_used = ${input.templateFallbackUsed}
           AND subscription.lease_token_hash = ${leaseTokenHash}
           AND subscription.leased_until > CURRENT_TIMESTAMP
           AND revisit.status = 'scheduled'
           AND revisit.deleted_at IS NULL
           AND revisit.expires_at > CURRENT_TIMESTAMP
           AND intention.deleted_at IS NULL
           AND (
             (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::date
               > revisit.scheduled_local_date
             OR (
               (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::date
                 = revisit.scheduled_local_date
               AND (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time >= TIME '09:00'
             )
           )
           AND (
             revisit.quiet_hours_start IS NULL
             OR (
               revisit.quiet_hours_start < revisit.quiet_hours_end
               AND (
                 (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                   < revisit.quiet_hours_start
                 OR (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                   >= revisit.quiet_hours_end
               )
             )
             OR (
               revisit.quiet_hours_start > revisit.quiet_hours_end
               AND (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                 >= revisit.quiet_hours_end
               AND (CURRENT_TIMESTAMP AT TIME ZONE revisit.time_zone)::time
                 < revisit.quiet_hours_start
             )
           )
      ) AS authorized
    `;
    return rows.length === 1 && rows[0]?.authorized === true;
  };

  const completeDelivery: RevisitReminderService["completeDelivery"] = async (input) => {
    if (
      !uuidV4Pattern.test(input.subscriptionId) ||
      !providerReferencePattern.test(input.providerMessageReference)
    ) {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    const leaseTokenHash = await tokenDigest(input.leaseToken);
    if (leaseTokenHash === null) return false;
    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    const changed = await database.$executeRaw`
      UPDATE revisit_reminder_subscription
         SET delivery_state = 'delivered',
             lease_token_hash = NULL,
             leased_until = NULL,
             last_failure_code = NULL,
             provider_message_reference = ${input.providerMessageReference},
             updated_at = CURRENT_TIMESTAMP,
             delivered_at = CURRENT_TIMESTAMP,
             dead_lettered_at = NULL
       WHERE id = ${input.subscriptionId}::uuid
         AND preference_state = 'subscribed'
         AND delivery_state = 'leased'
         AND lease_token_hash = ${leaseTokenHash}
         AND leased_until > CURRENT_TIMESTAMP
    `;
    return changed === 1;
  };

  const failDelivery: RevisitReminderService["failDelivery"] = async (input) => {
    if (!uuidV4Pattern.test(input.subscriptionId)) {
      throw new RevisitReminderError("REVISIT_REMINDER_INVALID");
    }
    const leaseTokenHash = await tokenDigest(input.leaseToken);
    if (leaseTokenHash === null) return null;
    await assertRevisitReminderRuntimeDatabasePrivileges(database);
    return database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<Readonly<{ attemptCount: number; maxAttempts: number }>>
      >`
        SELECT attempt_count AS "attemptCount", max_attempts AS "maxAttempts"
          FROM revisit_reminder_subscription
         WHERE id = ${input.subscriptionId}::uuid
           AND preference_state = 'subscribed'
           AND delivery_state = 'leased'
           AND lease_token_hash = ${leaseTokenHash}
           AND leased_until > CURRENT_TIMESTAMP
         FOR UPDATE
      `;
      const row = rows[0];
      if (rows.length === 0 || row === undefined) return null;
      if (
        rows.length !== 1 ||
        !Number.isSafeInteger(row.attemptCount) ||
        row.attemptCount < 1 ||
        row.maxAttempts !== 3
      ) {
        throw new RevisitReminderError("REVISIT_REMINDER_UNAVAILABLE");
      }
      const retry = input.retryable && row.attemptCount < row.maxAttempts;
      const retryAfterSeconds = retry
        ? revisitReminderBackoffSeconds({
            attempt: row.attemptCount,
            seed: input.subscriptionId,
          })
        : 0;
      const changed = await transaction.$executeRaw`
        UPDATE revisit_reminder_subscription
           SET delivery_state = ${retry ? "retry_wait" : "dead_lettered"},
               next_attempt_at =
                 CURRENT_TIMESTAMP + (${retryAfterSeconds} * INTERVAL '1 second'),
               lease_token_hash = NULL,
               leased_until = NULL,
               last_failure_code = ${input.failureCode},
               updated_at = CURRENT_TIMESTAMP,
               dead_lettered_at = ${retry ? null : Prisma.sql`CURRENT_TIMESTAMP`}
         WHERE id = ${input.subscriptionId}::uuid
           AND delivery_state = 'leased'
           AND lease_token_hash = ${leaseTokenHash}
      `;
      if (changed !== 1) return null;
      return retry ? "retry_wait" : "dead_lettered";
    });
  };

  return Object.freeze({
    authorizeDelivery,
    claimDue,
    completeDelivery,
    failDelivery,
    get,
    list,
    mutate,
  });
};
