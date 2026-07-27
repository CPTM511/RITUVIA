import { webcrypto } from "node:crypto";

import {
  accountConsentNoticeVersionFor,
  accountConsentPurposes,
  allowsConsentPurpose,
  createConsentRecord,
  parseAccountConsentMutationV1,
  parseConsentLocale,
  parseConsentNoticeVersion,
  parseConsentPurpose,
  parseUtcInstant,
  type AccountConsentPurpose,
  type AccountConsentState,
  type ConsentRecord,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const maximumConsentHistory = 256;

export const accountConsentErrorCodes = Object.freeze([
  "ACCOUNT_CONSENT_INVALID",
  "ACCOUNT_CONSENT_CONFLICT",
  "ACCOUNT_CONSENT_SESSION_UNAVAILABLE",
  "ACCOUNT_CONSENT_UNAVAILABLE",
] as const);

export type AccountConsentErrorCode = (typeof accountConsentErrorCodes)[number];

export class AccountConsentError extends Error {
  readonly code: AccountConsentErrorCode;

  constructor(code: AccountConsentErrorCode) {
    super("The account consent operation failed.");
    this.name = "AccountConsentError";
    this.code = code;
  }
}

export type AccountConsentService = Readonly<{
  allows(input: {
    noticeVersion: string;
    purpose: AccountConsentPurpose;
    sessionToken: string;
  }): Promise<boolean>;
  list(sessionToken: string): Promise<readonly AccountConsentState[]>;
  record(input: {
    idempotencyKey: string;
    request: unknown;
    sessionToken: string;
  }): Promise<AccountConsentState>;
}>;

type ActiveAccountRow = Readonly<{
  locale: string;
  userId: string;
}>;

type ConsentRow = Readonly<{
  canonicalRequestHash: Uint8Array;
  decision: string;
  id: string;
  locale: string;
  noticeVersion: string;
  notFuture?: boolean;
  purpose: string;
  recordedAt: Date;
  sequence: number;
  withdrawsRecordId: string | null;
}>;

type PrivilegeRow = Readonly<{
  canDelete: boolean;
  canInsert: boolean;
  canSelect: boolean;
  canUpdate: boolean;
  isBypassRls: boolean;
  isOwner: boolean;
  isSuperuser: boolean;
}>;

const tokenDigest = async (token: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!opaqueTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  return new Uint8Array(await webcrypto.subtle.digest("SHA-256", bytes)) as Uint8Array<ArrayBuffer>;
};

const sha256 = async (value: string): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ) as Uint8Array<ArrayBuffer>;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

export const assertAccountConsentRuntimeDatabasePrivileges = async (
  database: Pick<PrismaClient, "$queryRaw">,
): Promise<void> => {
  const rows = await database.$queryRaw<PrivilegeRow[]>`
    SELECT
      has_table_privilege(current_user, 'public.account_consent_record', 'SELECT')
        AS "canSelect",
      has_table_privilege(current_user, 'public.account_consent_record', 'INSERT')
        AS "canInsert",
      (
        has_table_privilege(current_user, 'public.account_consent_record', 'UPDATE')
        OR has_any_column_privilege(current_user, 'public.account_consent_record', 'UPDATE')
      ) AS "canUpdate",
      has_table_privilege(
        current_user,
        'public.account_consent_record',
        'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
      ) AS "canDelete",
      role.rolsuper AS "isSuperuser",
      role.rolbypassrls AS "isBypassRls",
      pg_get_userbyid(class.relowner) = current_user AS "isOwner"
    FROM pg_roles AS role
    CROSS JOIN pg_class AS class
    WHERE role.rolname = current_user
      AND class.oid = 'public.account_consent_record'::regclass
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.canSelect ||
    !row.canInsert ||
    row.canUpdate ||
    row.canDelete ||
    row.isSuperuser ||
    row.isBypassRls ||
    row.isOwner
  ) {
    throw new AccountConsentError("ACCOUNT_CONSENT_UNAVAILABLE");
  }
};

const resolveActiveAccount = async (
  transaction: Prisma.TransactionClient,
  sessionToken: string,
): Promise<ActiveAccountRow | null> => {
  const digest = await tokenDigest(sessionToken);
  if (digest === null) return null;
  const rows = await transaction.$queryRaw<ActiveAccountRow[]>`
    SELECT account.id AS "userId", account.locale
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

const readPurposeState = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  purpose: AccountConsentPurpose,
): Promise<AccountConsentState> => {
  const rows = await transaction.$queryRaw<ConsentRow[]>`
    SELECT id, purpose, sequence, notice_version AS "noticeVersion", locale, decision,
           recorded_at AS "recordedAt", withdraws_record_id AS "withdrawsRecordId",
           canonical_request_hash AS "canonicalRequestHash",
           recorded_at <= CURRENT_TIMESTAMP AS "notFuture"
      FROM account_consent_record
     WHERE user_id = ${userId}::uuid
       AND purpose = ${purpose}
     ORDER BY sequence
     LIMIT ${maximumConsentHistory + 1}
  `;
  if (rows.length > maximumConsentHistory) {
    return Object.freeze({
      granted: false,
      noticeVersion: accountConsentNoticeVersionFor(purpose),
      purpose,
      recordedAt: rows.at(-1)?.recordedAt.toISOString() ?? null,
    });
  }

  let previous: (ConsentRecord & Readonly<{ id: string }>) | null = null;
  for (const row of rows) {
    if (
      row.purpose !== purpose ||
      row.notFuture !== true ||
      (previous !== null && row.recordedAt.getTime() < Date.parse(previous.recordedAt))
    ) {
      throw new AccountConsentError("ACCOUNT_CONSENT_UNAVAILABLE");
    }
    const record = createConsentRecord({
      decision: row.decision,
      locale: row.locale,
      noticeVersion: row.noticeVersion,
      previous,
      purpose: row.purpose,
      recordedAt: row.recordedAt.toISOString(),
      sequence: row.sequence,
      source: "privacy_controls",
    });
    if (
      (record.decision === "withdrawn" && row.withdrawsRecordId !== previous?.id) ||
      (record.decision !== "withdrawn" && row.withdrawsRecordId !== null)
    ) {
      throw new AccountConsentError("ACCOUNT_CONSENT_UNAVAILABLE");
    }
    previous = Object.freeze({ ...record, id: row.id });
  }

  const noticeVersion = accountConsentNoticeVersionFor(purpose);
  return Object.freeze({
    granted: allowsConsentPurpose(
      previous,
      parseConsentPurpose(purpose),
      parseConsentNoticeVersion(noticeVersion),
    ),
    noticeVersion,
    purpose,
    recordedAt: previous?.recordedAt ?? null,
  });
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

export const createAccountConsentService = (database: PrismaClient): AccountConsentService => {
  const list: AccountConsentService["list"] = async (sessionToken) => {
    await assertAccountConsentRuntimeDatabasePrivileges(database);
    return database.$transaction(async (transaction) => {
      const account = await resolveActiveAccount(transaction, sessionToken);
      if (account === null) {
        throw new AccountConsentError("ACCOUNT_CONSENT_SESSION_UNAVAILABLE");
      }
      if (account.locale !== parseConsentLocale(account.locale)) {
        throw new AccountConsentError("ACCOUNT_CONSENT_UNAVAILABLE");
      }
      return Object.freeze(
        await Promise.all(
          accountConsentPurposes.map((purpose) =>
            readPurposeState(transaction, account.userId, purpose),
          ),
        ),
      );
    });
  };

  const allows: AccountConsentService["allows"] = async (input) => {
    if (input.noticeVersion !== accountConsentNoticeVersionFor(input.purpose)) return false;
    try {
      const states = await list(input.sessionToken);
      return states.find((state) => state.purpose === input.purpose)?.granted === true;
    } catch {
      return false;
    }
  };

  const record: AccountConsentService["record"] = async (input) => {
    if (!idempotencyKeyPattern.test(input.idempotencyKey)) {
      throw new AccountConsentError("ACCOUNT_CONSENT_INVALID");
    }
    let request: ReturnType<typeof parseAccountConsentMutationV1>;
    try {
      request = parseAccountConsentMutationV1(input.request);
    } catch {
      throw new AccountConsentError("ACCOUNT_CONSENT_INVALID");
    }
    const idempotencyKeyHash = await sha256(
      `rituvia.account-consent.idempotency.v1:${input.idempotencyKey}`,
    );
    const canonicalRequestHash = await sha256(
      JSON.stringify({
        granted: request.granted,
        noticeVersion: request.noticeVersion,
        purpose: request.purpose,
        schemaVersion: request.schemaVersion,
      }),
    );

    await assertAccountConsentRuntimeDatabasePrivileges(database);
    try {
      return await database.$transaction(async (transaction) => {
        const account = await resolveActiveAccount(transaction, input.sessionToken);
        if (account === null) {
          throw new AccountConsentError("ACCOUNT_CONSENT_SESSION_UNAVAILABLE");
        }
        await transaction.$queryRaw`
            SELECT id FROM app_user WHERE id = ${account.userId}::uuid FOR UPDATE
          `;
        const replays = await transaction.$queryRaw<ConsentRow[]>`
            SELECT id, purpose, sequence, notice_version AS "noticeVersion", locale, decision,
                   recorded_at AS "recordedAt", withdraws_record_id AS "withdrawsRecordId",
                   canonical_request_hash AS "canonicalRequestHash"
              FROM account_consent_record
             WHERE user_id = ${account.userId}::uuid
               AND idempotency_key_hash = ${idempotencyKeyHash}
          `;
        if (replays.length > 1) {
          throw new AccountConsentError("ACCOUNT_CONSENT_UNAVAILABLE");
        }
        const replay = replays[0];
        if (replay !== undefined) {
          if (!bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)) {
            throw new AccountConsentError("ACCOUNT_CONSENT_CONFLICT");
          }
          return readPurposeState(transaction, account.userId, request.purpose);
        }

        const previousRows = await transaction.$queryRaw<ConsentRow[]>`
            SELECT id, purpose, sequence, notice_version AS "noticeVersion", locale, decision,
                   recorded_at AS "recordedAt", withdraws_record_id AS "withdrawsRecordId",
                   canonical_request_hash AS "canonicalRequestHash"
              FROM account_consent_record
             WHERE user_id = ${account.userId}::uuid
               AND purpose = ${request.purpose}
             ORDER BY sequence DESC
             LIMIT 1
          `;
        const previousRow = previousRows[0];
        const previous =
          previousRow === undefined
            ? null
            : Object.freeze({
                decision: previousRow.decision as ConsentRecord["decision"],
                id: previousRow.id,
                locale: parseConsentLocale(previousRow.locale),
                noticeVersion: parseConsentNoticeVersion(previousRow.noticeVersion),
                purpose: parseConsentPurpose(previousRow.purpose),
                recordedAt: parseUtcInstant(previousRow.recordedAt.toISOString()),
                sequence: previousRow.sequence,
                source: "privacy_controls" as const,
              });
        const decision = request.granted
          ? "granted"
          : previousRow?.decision === "granted"
            ? "withdrawn"
            : "denied";
        const sequence = (previousRow?.sequence ?? 0) + 1;
        await transaction.$executeRaw`
            INSERT INTO account_consent_record (
              user_id, purpose, sequence, notice_version, locale, decision, source,
              withdraws_record_id, idempotency_key_hash, canonical_request_hash
            ) VALUES (
              ${account.userId}::uuid, ${request.purpose}, ${sequence},
              ${request.noticeVersion}, ${account.locale}, ${decision}, 'privacy_controls',
              ${decision === "withdrawn" ? previous?.id : null}::uuid,
              ${idempotencyKeyHash}, ${canonicalRequestHash}
            )
          `;
        return readPurposeState(transaction, account.userId, request.purpose);
      });
    } catch (error) {
      if (error instanceof AccountConsentError) throw error;
      if (isDatabaseConflict(error)) {
        throw new AccountConsentError("ACCOUNT_CONSENT_CONFLICT");
      }
      throw new AccountConsentError("ACCOUNT_CONSENT_UNAVAILABLE");
    }
  };

  return Object.freeze({ allows, list, record });
};
