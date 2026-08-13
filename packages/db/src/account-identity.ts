import { webcrypto } from "node:crypto";

import {
  normalizeAccountEmail,
  parseAccountAgeAttestationV1,
  parseAccountProfileUpdateV1,
  parseAccountSessionId,
  parseAccountUtcInstant,
  parseAuthIdentityId,
  parseAuthProviderKey,
  parseAuthProviderSubject,
  parseUserId,
  type AccountAgeAttestationV1,
  type AccountProfileUpdateV1,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const returnToPattern = /^\/en(?:\/(?:account|account\/history))?$/u;
const maximumHistoryPageSize = 50;
const accountHistorySourceTypes = new Set<AccountHistorySourceType>([
  "intention",
  "journal",
  "journal_legacy",
  "reading",
  "revisit",
  "ritual",
  "ritual_legacy",
]);

export const accountIdentityErrorCodes = Object.freeze([
  "ACCOUNT_AUTH_INVALID",
  "ACCOUNT_AUTH_EXPIRED",
  "ACCOUNT_AUTH_REPLAYED",
  "ACCOUNT_AUTH_RATE_LIMITED",
  "ACCOUNT_SESSION_UNAVAILABLE",
  "ACCOUNT_DISABLED",
  "ACCOUNT_PROFILE_INVALID",
  "ACCOUNT_PROFILE_CONFLICT",
  "ACCOUNT_MERGE_CONFLICT",
  "ACCOUNT_RESOURCE_NOT_FOUND",
  "ACCOUNT_IDENTITY_UNAVAILABLE",
] as const);

export type AccountIdentityErrorCode = (typeof accountIdentityErrorCodes)[number];

const errorMessage = (code: AccountIdentityErrorCode): string => {
  switch (code) {
    case "ACCOUNT_AUTH_INVALID":
    case "ACCOUNT_AUTH_EXPIRED":
    case "ACCOUNT_AUTH_REPLAYED":
      return "The sign-in request is unavailable.";
    case "ACCOUNT_AUTH_RATE_LIMITED":
      return "The sign-in request is temporarily unavailable.";
    case "ACCOUNT_SESSION_UNAVAILABLE":
      return "The account session is unavailable.";
    case "ACCOUNT_DISABLED":
      return "The account is unavailable.";
    case "ACCOUNT_PROFILE_INVALID":
      return "The account profile request is invalid.";
    case "ACCOUNT_PROFILE_CONFLICT":
      return "The account profile has changed.";
    case "ACCOUNT_MERGE_CONFLICT":
      return "The account merge conflicts.";
    case "ACCOUNT_RESOURCE_NOT_FOUND":
      return "The account resource is unavailable.";
    case "ACCOUNT_IDENTITY_UNAVAILABLE":
      return "Account identity storage is unavailable.";
  }
};

export class AccountIdentityError extends Error {
  readonly code: AccountIdentityErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: AccountIdentityErrorCode, retryAfterSeconds?: number) {
    super(errorMessage(code));
    this.name = "AccountIdentityError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type AccountIdentityPolicy = Readonly<{
  challengeTtlSeconds: number;
  emailEncryptionKey: Uint8Array;
  encryptionKeyVersion: string;
  providerSubjectHmacKey: Uint8Array;
  sessionTtlSeconds: number;
  startGlobalLimit: number;
  startIdentifierLimit: number;
  startWindowSeconds: number;
}>;

export type AccountSessionContext = Readonly<{
  authIdentityId: string;
  expiresAt: string;
  providerKey: string;
  sessionId: string;
  userId: string;
}>;

export type AccountProfile = Readonly<{
  ageAttested: boolean;
  displayName: string | null;
  emailVerified: boolean;
  id: string;
  locale: "en";
  profileVersion: number;
  status: "active";
  timeZone: string;
}>;

export type AccountSessionSummary = Readonly<{
  createdAt: string;
  current: boolean;
  expiresAt: string;
  id: string;
  lastSeenAt: string;
}>;

export type AccountReadingSummary = Readonly<{
  createdAt: string;
  id: string;
  readingType: "one_card" | "three_card";
  themeCode: string;
}>;

export type AccountReadingPage = Readonly<{
  items: readonly AccountReadingSummary[];
  nextCursor: Readonly<{ createdAt: string; readingId: string }> | null;
}>;

export const accountHistoryResourceTypes = Object.freeze([
  "reading",
  "intention",
  "ritual",
  "journal",
  "revisit",
] as const);

export type AccountHistoryResourceType = (typeof accountHistoryResourceTypes)[number];

export type AccountHistorySourceType =
  "intention" | "journal" | "journal_legacy" | "reading" | "revisit" | "ritual" | "ritual_legacy";

export type AccountHistorySummary = Readonly<{
  occurredAt: string;
  resourceId: string;
  resourceType: AccountHistoryResourceType;
  status:
    "abandoned" | "active" | "archived" | "completed" | "facts_ready" | "paused" | "scheduled";
  readingType: "one_card" | "three_card" | null;
  themeCode: string | null;
}>;

export type AccountHistoryPage = Readonly<{
  items: readonly AccountHistorySummary[];
  nextCursor: Readonly<{
    occurredAt: string;
    resourceId: string;
    sourceType: AccountHistorySourceType;
  }> | null;
}>;

export type AccountMergeStatus = "created" | "replayed";

export type AccountIdentityService = Readonly<{
  consumeChallenge(input: {
    anonymousMerge?:
      | Readonly<{
          anonymousSessionToken: string;
          idempotencyKey: string;
        }>
      | undefined;
    challengeId: string;
    sessionToken: string;
    state: string;
    token: string;
  }): Promise<
    Readonly<{
      context: AccountSessionContext;
      mergeStatus: AccountMergeStatus | null;
      returnTo: string;
    }>
  >;
  createChallenge(input: {
    challengeId: string;
    email: string;
    expiresAt: string;
    previousSessionToken?: string | undefined;
    providerKey: string;
    returnTo: string;
    state: string;
    token: string;
  }): Promise<void>;
  getProfile(sessionToken: string): Promise<AccountProfile>;
  listHistory(input: {
    cursor?:
      | Readonly<{
          occurredAt: string;
          resourceId: string;
          sourceType: AccountHistorySourceType;
        }>
      | undefined;
    limit: number;
    sessionToken: string;
  }): Promise<AccountHistoryPage>;
  listReadings(input: {
    cursor?: Readonly<{ createdAt: string; readingId: string }> | undefined;
    limit: number;
    sessionToken: string;
  }): Promise<AccountReadingPage>;
  listSessions(sessionToken: string): Promise<readonly AccountSessionSummary[]>;
  mergeAnonymousSubject(input: {
    accountSessionToken: string;
    anonymousSessionToken: string;
    idempotencyKey: string;
  }): Promise<
    Readonly<{
      context: AccountSessionContext;
      sessionToken: string;
      status: AccountMergeStatus;
    }>
  >;
  resolveSession(token: string): Promise<AccountSessionContext | null>;
  revokeAllSessions(token: string): Promise<boolean>;
  revokeSession(input: { sessionId: string; token: string }): Promise<boolean>;
  updateProfile(input: { request: unknown; sessionToken: string }): Promise<AccountProfile>;
}>;

type ChallengeRow = Readonly<{
  consumedAt: Date;
  emailCiphertext: Uint8Array;
  emailNonce: Uint8Array;
  emailTag: Uint8Array;
  encryptionKeyVersion: string;
  expiresAt: Date;
  previousSessionHash: Uint8Array | null;
  providerKey: string;
  providerSubject: string;
  returnTo: string;
}>;

type SessionRow = Readonly<{
  authenticatedAt: Date | null;
  authIdentityId: string;
  expiresAt: Date;
  providerKey: string;
  sessionId: string;
  userId: string;
}>;

type ProfileRow = Readonly<{
  ageAttestedAt: Date | null;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  id: string;
  locale: string;
  profileVersion: number;
  status: string;
  timeZone: string;
}>;

type RateLimitRow = Readonly<{
  requestCount: number;
  retryAfterSeconds: number;
}>;

type PreparedAccountMerge = Readonly<{
  anonymousHash: Uint8Array<ArrayBuffer>;
  idempotencyKeyHash: Uint8Array<ArrayBuffer>;
}>;

const validatePolicy = (policy: AccountIdentityPolicy): AccountIdentityPolicy => {
  if (
    !Number.isSafeInteger(policy.challengeTtlSeconds) ||
    policy.challengeTtlSeconds < 60 ||
    policy.challengeTtlSeconds > 3_600 ||
    !Number.isSafeInteger(policy.sessionTtlSeconds) ||
    policy.sessionTtlSeconds < 300 ||
    policy.sessionTtlSeconds > 2_592_000 ||
    !Number.isSafeInteger(policy.startGlobalLimit) ||
    policy.startGlobalLimit < 1 ||
    policy.startGlobalLimit > 100_000 ||
    !Number.isSafeInteger(policy.startIdentifierLimit) ||
    policy.startIdentifierLimit < 1 ||
    policy.startIdentifierLimit > 10_000 ||
    policy.startIdentifierLimit > policy.startGlobalLimit ||
    !Number.isSafeInteger(policy.startWindowSeconds) ||
    policy.startWindowSeconds < 60 ||
    policy.startWindowSeconds > 86_400 ||
    !(policy.emailEncryptionKey instanceof Uint8Array) ||
    policy.emailEncryptionKey.byteLength !== 32 ||
    !(policy.providerSubjectHmacKey instanceof Uint8Array) ||
    policy.providerSubjectHmacKey.byteLength !== 32 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(policy.encryptionKeyVersion) ||
    policy.encryptionKeyVersion.length > 100
  ) {
    throw new TypeError("Account identity policy is invalid.");
  }
  return Object.freeze({
    ...policy,
    emailEncryptionKey: Uint8Array.from(policy.emailEncryptionKey),
    providerSubjectHmacKey: Uint8Array.from(policy.providerSubjectHmacKey),
  });
};

const tokenBytes = (token: string): Uint8Array<ArrayBuffer> | null => {
  if (!opaqueTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  return Uint8Array.from(bytes) as Uint8Array<ArrayBuffer>;
};

const sha256 = async (
  value: Uint8Array<ArrayBuffer> | string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return new Uint8Array(
    await webcrypto.subtle.digest("SHA-256", source),
  ) as Uint8Array<ArrayBuffer>;
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

const parseOpaqueToken = (value: string): Uint8Array<ArrayBuffer> => {
  const bytes = tokenBytes(value);
  if (bytes === null) throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
  return bytes;
};

const parseUuidV4 = (value: unknown): string => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) {
    throw new AccountIdentityError("ACCOUNT_RESOURCE_NOT_FOUND");
  }
  return value;
};

const webCryptoBytes = (value: Uint8Array): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(value) as Uint8Array<ArrayBuffer>;

const importProviderSubjectHmacKey = async (key: Uint8Array): Promise<webcrypto.CryptoKey> =>
  webcrypto.subtle.importKey("raw", webCryptoBytes(key), { hash: "SHA-256", name: "HMAC" }, false, [
    "sign",
  ]);

const keyedIdentifierDigest = async (
  scope: string,
  value: string,
  key: webcrypto.CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await webcrypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`rituvia.${scope}.v1:${value}`),
    ),
  ) as Uint8Array<ArrayBuffer>;

const keyedRateBucketDigest = async (
  value: string,
  key: webcrypto.CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> => {
  const identifierDigest = await keyedIdentifierDigest("auth-start-rate-identifier", value, key);
  const bucket = Buffer.from(identifierDigest.slice(0, 2)).toString("hex");
  return keyedIdentifierDigest("auth-start-rate-bucket", bucket, key);
};

const providerSubjectForEmail = async (
  email: string,
  key: webcrypto.CryptoKey,
): Promise<string> => {
  const digest = await keyedIdentifierDigest("local-passwordless", email, key);
  const suffix = Buffer.from(digest).toString("hex");
  return parseAuthProviderSubject(`local.${suffix}`);
};

const importEmailKey = async (key: Uint8Array): Promise<webcrypto.CryptoKey> =>
  webcrypto.subtle.importKey("raw", webCryptoBytes(key), "AES-GCM", false, ["decrypt", "encrypt"]);

const encryptEmail = async (
  email: string,
  key: webcrypto.CryptoKey,
  scope: string,
): Promise<
  Readonly<{
    ciphertext: Uint8Array<ArrayBuffer>;
    nonce: Uint8Array<ArrayBuffer>;
    tag: Uint8Array<ArrayBuffer>;
  }>
> => {
  const nonce = webcrypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const sealed = new Uint8Array(
    await webcrypto.subtle.encrypt(
      {
        additionalData: new TextEncoder().encode(scope),
        iv: nonce,
        name: "AES-GCM",
        tagLength: 128,
      },
      key,
      new TextEncoder().encode(email),
    ),
  ) as Uint8Array<ArrayBuffer>;
  if (sealed.byteLength <= 16) throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
  return Object.freeze({
    ciphertext: sealed.slice(0, -16) as Uint8Array<ArrayBuffer>,
    nonce,
    tag: sealed.slice(-16) as Uint8Array<ArrayBuffer>,
  });
};

const decryptEmail = async (
  input: Readonly<{ ciphertext: Uint8Array; nonce: Uint8Array; tag: Uint8Array }>,
  key: webcrypto.CryptoKey,
  scope: string,
): Promise<string> => {
  if (
    input.nonce.byteLength !== 12 ||
    input.tag.byteLength !== 16 ||
    input.ciphertext.byteLength < 3
  ) {
    throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
  }
  const sealed = new Uint8Array(input.ciphertext.byteLength + input.tag.byteLength);
  sealed.set(input.ciphertext, 0);
  sealed.set(input.tag, input.ciphertext.byteLength);
  try {
    const plaintext = await webcrypto.subtle.decrypt(
      {
        additionalData: new TextEncoder().encode(scope),
        iv: webCryptoBytes(input.nonce),
        name: "AES-GCM",
        tagLength: 128,
      },
      key,
      sealed,
    );
    return normalizeAccountEmail(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
  } catch {
    throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
  }
};

const context = (row: SessionRow): AccountSessionContext =>
  Object.freeze({
    authIdentityId: parseAuthIdentityId(row.authIdentityId),
    expiresAt: parseAccountUtcInstant(row.expiresAt.toISOString()),
    providerKey: parseAuthProviderKey(row.providerKey),
    sessionId: parseAccountSessionId(row.sessionId),
    userId: parseUserId(row.userId),
  });

const profile = (row: ProfileRow): AccountProfile => {
  if (
    row.status !== "active" ||
    row.locale !== "en" ||
    typeof row.timeZone !== "string" ||
    row.timeZone.length < 1 ||
    row.timeZone.length > 64 ||
    !Number.isSafeInteger(row.profileVersion) ||
    row.profileVersion < 1
  ) {
    throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
  }
  return Object.freeze({
    ageAttested: row.ageAttestedAt !== null,
    displayName: row.displayName,
    emailVerified: row.emailVerifiedAt !== null,
    id: parseUserId(row.id),
    locale: "en",
    profileVersion: row.profileVersion,
    status: "active",
    timeZone: row.timeZone,
  });
};

const resolveActiveSession = async (
  transaction: Prisma.TransactionClient,
  token: string,
): Promise<SessionRow | null> => {
  const bytes = tokenBytes(token);
  if (bytes === null) return null;
  const hash = await sha256(bytes);
  const rows = await transaction.$queryRaw<SessionRow[]>`
    WITH active AS (
      SELECT session.id AS "sessionId",
             session.user_id AS "userId",
             session.auth_identity_id AS "authIdentityId",
             session.authenticated_at AS "authenticatedAt",
             session.expires_at AS "expiresAt",
             identity.provider_key AS "providerKey"
        FROM account_session AS session
        JOIN app_user AS account ON account.id = session.user_id
        JOIN auth_identity AS identity ON identity.id = session.auth_identity_id
       WHERE session.token_hash = ${hash}
         AND session.token_hash_version = 1
         AND session.revoked_at IS NULL
         AND session.expires_at > CURRENT_TIMESTAMP
         AND account.status = 'active'
       FOR UPDATE OF session
    ), touched AS (
      UPDATE account_session AS session
         SET last_seen_at = CURRENT_TIMESTAMP
        FROM active
       WHERE session.id = active."sessionId"
       RETURNING session.id
    )
    SELECT active.* FROM active JOIN touched ON touched.id = active."sessionId"
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
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

export const createAccountIdentityService = (
  database: PrismaClient,
  rawPolicy: AccountIdentityPolicy,
): AccountIdentityService => {
  const policy = validatePolicy(rawPolicy);
  const emailKeyPromise = importEmailKey(policy.emailEncryptionKey);
  const providerSubjectHmacKeyPromise = importProviderSubjectHmacKey(policy.providerSubjectHmacKey);

  const enforceStartLimit = async (
    transaction: Prisma.TransactionClient,
    input: Readonly<{
      keyHash: Uint8Array<ArrayBuffer>;
      limit: number;
      scope: "global" | "identifier";
    }>,
  ): Promise<void> => {
    const rows = await transaction.$queryRaw<RateLimitRow[]>`
      INSERT INTO auth_start_rate_limit (
        scope, key_hash, window_started_at, request_count
      ) VALUES (
        ${input.scope}, ${input.keyHash}, CURRENT_TIMESTAMP, 1
      )
      ON CONFLICT (scope, key_hash) DO UPDATE
         SET window_started_at = CASE
               WHEN auth_start_rate_limit.window_started_at
                    + make_interval(secs => ${policy.startWindowSeconds}) <= CURRENT_TIMESTAMP
                 THEN CURRENT_TIMESTAMP
               ELSE auth_start_rate_limit.window_started_at
             END,
             request_count = CASE
               WHEN auth_start_rate_limit.window_started_at
                    + make_interval(secs => ${policy.startWindowSeconds}) <= CURRENT_TIMESTAMP
                 THEN 1
               ELSE auth_start_rate_limit.request_count + 1
             END
      RETURNING request_count AS "requestCount",
                GREATEST(
                  1,
                  CEIL(EXTRACT(EPOCH FROM (
                    window_started_at + make_interval(secs => ${policy.startWindowSeconds})
                    - CURRENT_TIMESTAMP
                  )))::integer
                ) AS "retryAfterSeconds"
    `;
    const row = rows[0];
    if (
      rows.length !== 1 ||
      row === undefined ||
      !Number.isSafeInteger(row.requestCount) ||
      !Number.isSafeInteger(row.retryAfterSeconds)
    ) {
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
    if (row.requestCount > input.limit) {
      throw new AccountIdentityError("ACCOUNT_AUTH_RATE_LIMITED", row.retryAfterSeconds);
    }
  };

  const createChallenge: AccountIdentityService["createChallenge"] = async (input) => {
    if (!uuidV4Pattern.test(input.challengeId) || !returnToPattern.test(input.returnTo)) {
      throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
    }
    const providerKey = parseAuthProviderKey(input.providerKey);
    const email = normalizeAccountEmail(input.email);
    const providerSubjectHmacKey = await providerSubjectHmacKeyPromise;
    const providerSubject = await providerSubjectForEmail(email, providerSubjectHmacKey);
    const token = parseOpaqueToken(input.token);
    const state = parseOpaqueToken(input.state);
    const expiresAt = new Date(parseAccountUtcInstant(input.expiresAt));
    if (
      expiresAt.getTime() <= Date.now() ||
      expiresAt.getTime() - Date.now() > policy.challengeTtlSeconds * 1_000 + 5_000
    ) {
      throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
    }
    const previousSessionBytes =
      input.previousSessionToken === undefined ? null : tokenBytes(input.previousSessionToken);
    const [
      tokenHash,
      stateHash,
      encryptedEmail,
      globalRateKeyHash,
      identifierRateKeyHash,
      previousSessionHash,
    ] = await Promise.all([
      sha256(token),
      sha256(state),
      emailKeyPromise.then((key) =>
        encryptEmail(
          email,
          key,
          `rituvia.account-email.v1:challenge:${input.challengeId}:${providerKey}:${providerSubject}:${policy.encryptionKeyVersion}`,
        ),
      ),
      keyedIdentifierDigest("auth-start-rate", "global", providerSubjectHmacKey),
      keyedRateBucketDigest(email, providerSubjectHmacKey),
      previousSessionBytes === null ? Promise.resolve(null) : sha256(previousSessionBytes),
    ]);
    try {
      await database.$transaction(async (transaction) => {
        await enforceStartLimit(transaction, {
          keyHash: globalRateKeyHash,
          limit: policy.startGlobalLimit,
          scope: "global",
        });
        await enforceStartLimit(transaction, {
          keyHash: identifierRateKeyHash,
          limit: policy.startIdentifierLimit,
          scope: "identifier",
        });
        await transaction.$executeRaw`
          INSERT INTO auth_challenge (
            id, provider_key, provider_subject, email_ciphertext, email_nonce, email_tag,
            encryption_key_version, token_hash, token_hash_version, state_hash,
            previous_session_hash, return_to, created_at, expires_at, attempt_count
          ) VALUES (
            ${input.challengeId}::uuid, ${providerKey}, ${providerSubject},
            ${encryptedEmail.ciphertext}, ${encryptedEmail.nonce}, ${encryptedEmail.tag},
            ${policy.encryptionKeyVersion}, ${tokenHash}, 1, ${stateHash},
            ${previousSessionHash},
            ${input.returnTo}, CURRENT_TIMESTAMP, ${expiresAt}, 0
          )
        `;
      });
    } catch (error) {
      if (error instanceof AccountIdentityError) throw error;
      if (isDatabaseConflict(error)) throw new AccountIdentityError("ACCOUNT_AUTH_REPLAYED");
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
  };

  const prepareAccountMerge = async (
    anonymousSessionToken: string,
    idempotencyKey: string,
  ): Promise<PreparedAccountMerge> => {
    if (!idempotencyKeyPattern.test(idempotencyKey)) {
      throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
    }
    const anonymousToken = tokenBytes(anonymousSessionToken);
    if (anonymousToken === null) throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
    const [anonymousHash, idempotencyKeyHash] = await Promise.all([
      sha256(anonymousToken),
      sha256(idempotencyKey),
    ]);
    return Object.freeze({ anonymousHash, idempotencyKeyHash });
  };

  const mergePreparedAnonymousSubject = async (
    transaction: Prisma.TransactionClient,
    account: SessionRow,
    prepared: PreparedAccountMerge,
  ): Promise<AccountMergeStatus> => {
    const anonymous = await transaction.$queryRaw<
      Array<
        Readonly<{
          anonymousSubjectId: string;
          revokedAt: Date | null;
          sourceSessionId: string;
        }>
      >
    >`
      SELECT session.id AS "sourceSessionId",
             session.anonymous_subject_id AS "anonymousSubjectId",
             session.revoked_at AS "revokedAt"
        FROM anonymous_session AS session
        JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
       WHERE session.token_hash = ${prepared.anonymousHash}
         AND session.token_hash_version = 1
         AND session.expires_at > CURRENT_TIMESTAMP
         AND subject.expires_at > CURRENT_TIMESTAMP
       FOR UPDATE OF session, subject
    `;
    const subject = anonymous[0];
    if (anonymous.length !== 1 || subject === undefined) {
      throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
    }
    const canonicalRequestHash = await sha256(
      `rituvia.account-subject-link.v1:${subject.anonymousSubjectId}`,
    );
    const findExisting = () =>
      transaction.$queryRaw<
        Array<
          Readonly<{
            anonymousSubjectId: string;
            canonicalRequestHash: Uint8Array;
            idempotencyKeyHash: Uint8Array;
            privacyDeletedAt: Date | null;
            sourceAccountSessionId: string | null;
            userId: string;
          }>
        >
      >`
        SELECT user_id AS "userId", anonymous_subject_id AS "anonymousSubjectId",
               idempotency_key_hash AS "idempotencyKeyHash",
               canonical_request_hash AS "canonicalRequestHash",
               privacy_deleted_at AS "privacyDeletedAt",
               source_account_session_id AS "sourceAccountSessionId"
          FROM account_subject_link
         WHERE anonymous_subject_id = ${subject.anonymousSubjectId}::uuid
            OR (
              user_id = ${account.userId}::uuid
              AND idempotency_key_hash = ${prepared.idempotencyKeyHash}
            )
      `;
    const validateReplay = (
      existing: Awaited<ReturnType<typeof findExisting>>,
    ): AccountMergeStatus => {
      const replay = existing[0];
      if (
        existing.length !== 1 ||
        replay === undefined ||
        replay.userId !== account.userId ||
        replay.anonymousSubjectId !== subject.anonymousSubjectId ||
        replay.sourceAccountSessionId !== account.sessionId ||
        replay.privacyDeletedAt !== null ||
        !bytesEqual(replay.idempotencyKeyHash, prepared.idempotencyKeyHash) ||
        !bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)
      ) {
        throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
      }
      return "replayed";
    };

    const existing = await findExisting();
    let status: AccountMergeStatus;
    if (existing.length > 0) {
      status = validateReplay(existing);
    } else {
      if (subject.revokedAt !== null) {
        throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
      }
      const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
        INSERT INTO account_subject_link (
          user_id, anonymous_subject_id, idempotency_key_hash,
          canonical_request_hash, source_session_id, source_account_session_id, created_at
        ) VALUES (
          ${account.userId}::uuid, ${subject.anonymousSubjectId}::uuid,
          ${prepared.idempotencyKeyHash}, ${canonicalRequestHash},
          ${subject.sourceSessionId}::uuid, ${account.sessionId}::uuid, CURRENT_TIMESTAMP
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      status = inserted.length === 1 ? "created" : validateReplay(await findExisting());
    }
    await transaction.$executeRaw`
      UPDATE anonymous_session SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
       WHERE anonymous_subject_id = ${subject.anonymousSubjectId}::uuid
         AND revoked_at IS NULL
    `;
    return status;
  };

  const consumeChallenge: AccountIdentityService["consumeChallenge"] = async (input) => {
    if (!uuidV4Pattern.test(input.challengeId)) {
      throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
    }
    const [challengeHash, stateHash, sessionHash, preparedMerge] = await Promise.all([
      sha256(parseOpaqueToken(input.token)),
      sha256(parseOpaqueToken(input.state)),
      sha256(parseOpaqueToken(input.sessionToken)),
      input.anonymousMerge === undefined
        ? Promise.resolve(null)
        : prepareAccountMerge(
            input.anonymousMerge.anonymousSessionToken,
            input.anonymousMerge.idempotencyKey,
          ),
    ]);
    try {
      return await database.$transaction(async (transaction) => {
        const challenges = await transaction.$queryRaw<ChallengeRow[]>`
          UPDATE auth_challenge
             SET consumed_at = CURRENT_TIMESTAMP
           WHERE id = ${input.challengeId}::uuid
             AND token_hash = ${challengeHash}
             AND token_hash_version = 1
             AND state_hash = ${stateHash}
             AND consumed_at IS NULL
             AND expires_at > CURRENT_TIMESTAMP
           RETURNING provider_key AS "providerKey", provider_subject AS "providerSubject",
                     email_ciphertext AS "emailCiphertext", email_nonce AS "emailNonce",
                     email_tag AS "emailTag", encryption_key_version AS "encryptionKeyVersion",
                     previous_session_hash AS "previousSessionHash",
                     return_to AS "returnTo", expires_at AS "expiresAt", consumed_at AS "consumedAt"
        `;
        const challenge = challenges[0];
        if (challenges.length !== 1 || challenge === undefined) {
          throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
        }
        if (!returnToPattern.test(challenge.returnTo)) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        const providerKey = parseAuthProviderKey(challenge.providerKey);
        const providerSubject = parseAuthProviderSubject(challenge.providerSubject);
        if (challenge.encryptionKeyVersion !== policy.encryptionKeyVersion) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        const email = await decryptEmail(
          {
            ciphertext: challenge.emailCiphertext,
            nonce: challenge.emailNonce,
            tag: challenge.emailTag,
          },
          await emailKeyPromise,
          `rituvia.account-email.v1:challenge:${input.challengeId}:${providerKey}:${providerSubject}:${policy.encryptionKeyVersion}`,
        );
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`${providerKey}:${providerSubject}`}, 54055)
          )
        `;
        const providerSubjectSuppressionHash = await sha256(`${providerKey}:${providerSubject}`);
        const suppressions = await transaction.$queryRaw<Array<{ blocked: boolean }>>`
          SELECT TRUE AS blocked
            FROM auth_identity_suppression
           WHERE provider_key = ${providerKey}
             AND provider_subject_hash = ${providerSubjectSuppressionHash}
        `;
        if (suppressions.length > 1) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        if (suppressions.length === 1) {
          throw new AccountIdentityError("ACCOUNT_DISABLED");
        }
        const existing = await transaction.$queryRaw<
          Array<Readonly<{ authIdentityId: string; status: string; userId: string }>>
        >`
          SELECT identity.id AS "authIdentityId", identity.user_id AS "userId", account.status
            FROM auth_identity AS identity
            JOIN app_user AS account ON account.id = identity.user_id
           WHERE identity.provider_key = ${providerKey}
             AND identity.provider_subject = ${providerSubject}
           FOR UPDATE OF identity, account
        `;
        let userId: string;
        let authIdentityId: string;
        if (existing.length === 0) {
          const users = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO app_user (
              status, locale, time_zone, email_verified_at, created_at, last_active_at,
              profile_version
            ) VALUES ('active', 'en', 'UTC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
            RETURNING id
          `;
          userId = users[0]?.id ?? "";
          if (!uuidV4Pattern.test(userId)) {
            throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
          }
          const encryptedIdentityEmail = await encryptEmail(
            email,
            await emailKeyPromise,
            `rituvia.account-email.v1:identity:${userId}:${providerKey}:${providerSubject}:${policy.encryptionKeyVersion}`,
          );
          const identities = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO auth_identity (
              user_id, provider_key, provider_subject, verified_email_ciphertext,
              verified_email_nonce, verified_email_tag, encryption_key_version,
              verified_at, created_at, last_sign_in_at
            ) VALUES (
              ${userId}::uuid, ${providerKey}, ${providerSubject},
              ${encryptedIdentityEmail.ciphertext}, ${encryptedIdentityEmail.nonce},
              ${encryptedIdentityEmail.tag}, ${policy.encryptionKeyVersion}, CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING id
          `;
          authIdentityId = identities[0]?.id ?? "";
        } else {
          const identity = existing[0];
          if (existing.length !== 1 || identity === undefined || identity.status !== "active") {
            throw new AccountIdentityError("ACCOUNT_DISABLED");
          }
          userId = identity.userId;
          authIdentityId = identity.authIdentityId;
          await transaction.$executeRaw`
            UPDATE auth_identity SET last_sign_in_at = CURRENT_TIMESTAMP
             WHERE id = ${authIdentityId}::uuid
          `;
          await transaction.$executeRaw`
            UPDATE app_user SET last_active_at = CURRENT_TIMESTAMP WHERE id = ${userId}::uuid
          `;
        }
        parseUserId(userId);
        parseAuthIdentityId(authIdentityId);
        if (challenge.previousSessionHash !== null) {
          await transaction.$executeRaw`
            UPDATE account_session
               SET revoked_at = CURRENT_TIMESTAMP
             WHERE token_hash = ${challenge.previousSessionHash}
               AND user_id = ${userId}::uuid
               AND revoked_at IS NULL
               AND expires_at >= CURRENT_TIMESTAMP
          `;
        }
        const sessions = await transaction.$queryRaw<SessionRow[]>`
          INSERT INTO account_session (
            user_id, auth_identity_id, token_hash, token_hash_version,
            authenticated_at, created_at, expires_at, last_seen_at
          ) VALUES (
            ${userId}::uuid, ${authIdentityId}::uuid, ${sessionHash}, 1,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + make_interval(secs => ${policy.sessionTtlSeconds}),
            CURRENT_TIMESTAMP
          )
          RETURNING id AS "sessionId", user_id AS "userId",
                    auth_identity_id AS "authIdentityId",
                    authenticated_at AS "authenticatedAt", expires_at AS "expiresAt",
                    ${providerKey}::text AS "providerKey"
        `;
        const session = sessions[0];
        if (sessions.length !== 1 || session === undefined) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        const mergeStatus =
          preparedMerge === null
            ? null
            : await mergePreparedAnonymousSubject(transaction, session, preparedMerge);
        return Object.freeze({
          context: context(session),
          mergeStatus,
          returnTo: challenge.returnTo,
        });
      });
    } catch (error) {
      if (error instanceof AccountIdentityError) throw error;
      if (isDatabaseConflict(error)) throw new AccountIdentityError("ACCOUNT_AUTH_REPLAYED");
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
  };

  const resolveSession: AccountIdentityService["resolveSession"] = async (token) => {
    try {
      return await database.$transaction(async (transaction) => {
        const row = await resolveActiveSession(transaction, token);
        return row === null ? null : context(row);
      });
    } catch {
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
  };

  const getProfileForContext = async (
    transaction: Prisma.TransactionClient,
    active: SessionRow,
  ): Promise<AccountProfile> => {
    const rows = await transaction.$queryRaw<ProfileRow[]>`
      SELECT id, status, locale, time_zone AS "timeZone", display_name AS "displayName",
             email_verified_at AS "emailVerifiedAt", age_attested_at AS "ageAttestedAt",
             profile_version AS "profileVersion"
        FROM app_user WHERE id = ${active.userId}::uuid
    `;
    if (rows.length !== 1 || rows[0] === undefined) {
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
    return profile(rows[0]);
  };

  const getProfile: AccountIdentityService["getProfile"] = async (sessionToken) =>
    database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, sessionToken);
      if (active === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
      return getProfileForContext(transaction, active);
    });

  const parseProfileMutation = (
    request: unknown,
  ): AccountAgeAttestationV1 | AccountProfileUpdateV1 => {
    try {
      if (
        typeof request === "object" &&
        request !== null &&
        !Array.isArray(request) &&
        (Object.hasOwn(request, "ageAttested") || Object.hasOwn(request, "agePolicyVersion"))
      ) {
        return parseAccountAgeAttestationV1(request);
      }
      return parseAccountProfileUpdateV1(request);
    } catch {
      throw new AccountIdentityError("ACCOUNT_PROFILE_INVALID");
    }
  };

  const updateProfile: AccountIdentityService["updateProfile"] = async (input) => {
    const request = parseProfileMutation(input.request);
    return database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, input.sessionToken);
      if (active === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
      if ("ageAttested" in request) {
        const rows = await transaction.$queryRaw<ProfileRow[]>`
          UPDATE app_user
             SET age_attested_at = CURRENT_TIMESTAMP,
                 age_policy_version = ${request.agePolicyVersion},
                 profile_version = profile_version + 1,
                 last_active_at = CURRENT_TIMESTAMP
           WHERE id = ${active.userId}::uuid
             AND status = 'active'
           RETURNING id, status, locale, time_zone AS "timeZone", display_name AS "displayName",
                     email_verified_at AS "emailVerifiedAt", age_attested_at AS "ageAttestedAt",
                     profile_version AS "profileVersion"
        `;
        if (rows.length !== 1 || rows[0] === undefined) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        return profile(rows[0]);
      }
      const rows = await transaction.$queryRaw<ProfileRow[]>`
        UPDATE app_user
           SET display_name = ${request.displayName}, locale = ${request.locale},
               time_zone = ${request.timeZone}, profile_version = profile_version + 1,
               last_active_at = CURRENT_TIMESTAMP
         WHERE id = ${active.userId}::uuid
           AND status = 'active'
           AND profile_version = ${request.profileVersion}
         RETURNING id, status, locale, time_zone AS "timeZone", display_name AS "displayName",
                   email_verified_at AS "emailVerifiedAt", age_attested_at AS "ageAttestedAt",
                   profile_version AS "profileVersion"
      `;
      if (rows.length === 0) throw new AccountIdentityError("ACCOUNT_PROFILE_CONFLICT");
      if (rows.length !== 1 || rows[0] === undefined) {
        throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
      }
      return profile(rows[0]);
    });
  };

  const listSessions: AccountIdentityService["listSessions"] = async (sessionToken) =>
    database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, sessionToken);
      if (active === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
      const rows = await transaction.$queryRaw<
        Array<Readonly<{ createdAt: Date; expiresAt: Date; id: string; lastSeenAt: Date }>>
      >`
        SELECT id, created_at AS "createdAt", expires_at AS "expiresAt", last_seen_at AS "lastSeenAt"
          FROM account_session
         WHERE user_id = ${active.userId}::uuid
           AND revoked_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC, id DESC
         LIMIT 100
      `;
      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            createdAt: parseAccountUtcInstant(row.createdAt.toISOString()),
            current: row.id === active.sessionId,
            expiresAt: parseAccountUtcInstant(row.expiresAt.toISOString()),
            id: parseAccountSessionId(row.id),
            lastSeenAt: parseAccountUtcInstant(row.lastSeenAt.toISOString()),
          }),
        ),
      );
    });

  const revokeSession: AccountIdentityService["revokeSession"] = async (input) => {
    if (!uuidV4Pattern.test(input.sessionId)) return false;
    return database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, input.token);
      if (active === null) return false;
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        UPDATE account_session SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = ${input.sessionId}::uuid
           AND user_id = ${active.userId}::uuid
           AND id <> ${active.sessionId}::uuid
           AND revoked_at IS NULL
           AND expires_at >= CURRENT_TIMESTAMP
         RETURNING id
      `;
      return rows.length === 1;
    });
  };

  const revokeAllSessions: AccountIdentityService["revokeAllSessions"] = async (token) =>
    database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, token);
      if (active === null) return false;
      const count = await transaction.$executeRaw`
        UPDATE account_session SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ${active.userId}::uuid
           AND revoked_at IS NULL
           AND expires_at >= CURRENT_TIMESTAMP
      `;
      return count > 0;
    });

  const mergeAnonymousSubject: AccountIdentityService["mergeAnonymousSubject"] = async (input) => {
    const accountToken = tokenBytes(input.accountSessionToken);
    if (accountToken === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
    const providerSubjectHmacKey = await providerSubjectHmacKeyPromise;
    const [preparedMerge, accountSessionHash, replacementSessionBytes] = await Promise.all([
      prepareAccountMerge(input.anonymousSessionToken, input.idempotencyKey),
      sha256(accountToken),
      keyedIdentifierDigest(
        "account-merge-session",
        [input.accountSessionToken, input.anonymousSessionToken, input.idempotencyKey].join(
          "\u0000",
        ),
        providerSubjectHmacKey,
      ),
    ]);
    const sessionToken = Buffer.from(replacementSessionBytes).toString("base64url");
    const replacementSessionHash = await sha256(replacementSessionBytes);
    try {
      return await database.$transaction(async (transaction) => {
        const accounts = await transaction.$queryRaw<
          Array<SessionRow & Readonly<{ revokedAt: Date | null }>>
        >`
          SELECT session.id AS "sessionId", session.user_id AS "userId",
                 session.auth_identity_id AS "authIdentityId",
                 session.authenticated_at AS "authenticatedAt",
                 session.expires_at AS "expiresAt", session.revoked_at AS "revokedAt",
                 identity.provider_key AS "providerKey"
            FROM account_session AS session
            JOIN app_user AS account ON account.id = session.user_id
            JOIN auth_identity AS identity ON identity.id = session.auth_identity_id
           WHERE session.token_hash = ${accountSessionHash}
             AND session.token_hash_version = 1
             AND session.expires_at > CURRENT_TIMESTAMP
             AND account.status = 'active'
           FOR UPDATE OF session
        `;
        const account = accounts[0];
        if (accounts.length !== 1 || account === undefined) {
          throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
        }
        const status = await mergePreparedAnonymousSubject(transaction, account, preparedMerge);
        const sessions =
          status === "created"
            ? await transaction.$queryRaw<SessionRow[]>`
                INSERT INTO account_session (
                  user_id, auth_identity_id, token_hash, token_hash_version,
                  authenticated_at, created_at, expires_at, last_seen_at
                ) VALUES (
                  ${account.userId}::uuid, ${account.authIdentityId}::uuid,
                  ${replacementSessionHash}, 1, ${account.authenticatedAt}, CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP + make_interval(secs => ${policy.sessionTtlSeconds}),
                  CURRENT_TIMESTAMP
                )
                RETURNING id AS "sessionId", user_id AS "userId",
                          auth_identity_id AS "authIdentityId", expires_at AS "expiresAt",
                          authenticated_at AS "authenticatedAt",
                          ${account.providerKey}::text AS "providerKey"
              `
            : await transaction.$queryRaw<SessionRow[]>`
                SELECT session.id AS "sessionId", session.user_id AS "userId",
                       session.auth_identity_id AS "authIdentityId",
                       session.authenticated_at AS "authenticatedAt",
                       session.expires_at AS "expiresAt",
                       ${account.providerKey}::text AS "providerKey"
                  FROM account_session AS session
                 WHERE session.token_hash = ${replacementSessionHash}
                   AND session.token_hash_version = 1
                   AND session.user_id = ${account.userId}::uuid
                   AND session.revoked_at IS NULL
                   AND session.expires_at > CURRENT_TIMESTAMP
                 FOR UPDATE
              `;
        const replacement = sessions[0];
        if (sessions.length !== 1 || replacement === undefined) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        if (status === "created") {
          if (account.revokedAt !== null) {
            throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
          }
          const revoked = await transaction.$executeRaw`
            UPDATE account_session SET revoked_at = CURRENT_TIMESTAMP
             WHERE id = ${account.sessionId}::uuid
               AND user_id = ${account.userId}::uuid
               AND revoked_at IS NULL
               AND expires_at > CURRENT_TIMESTAMP
          `;
          if (revoked !== 1) {
            throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
          }
        }
        return Object.freeze({ context: context(replacement), sessionToken, status });
      });
    } catch (error) {
      if (error instanceof AccountIdentityError) throw error;
      if (isDatabaseConflict(error)) throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
  };

  const listHistory: AccountIdentityService["listHistory"] = async (input) => {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > maximumHistoryPageSize
    ) {
      throw new TypeError("Account history page size is invalid.");
    }
    const cursor =
      input.cursor === undefined
        ? undefined
        : Object.freeze({
            occurredAt: new Date(parseAccountUtcInstant(input.cursor.occurredAt)),
            resourceId: parseUuidV4(input.cursor.resourceId),
            sourceType: accountHistorySourceTypes.has(input.cursor.sourceType)
              ? input.cursor.sourceType
              : (() => {
                  throw new TypeError("Account history cursor source is invalid.");
                })(),
          });
    type HistoryRow = Readonly<{
      occurredAt: Date;
      readingType: string | null;
      resourceId: string;
      resourceType: string;
      sourceType: string;
      status: string;
      themeCode: string | null;
    }>;
    return database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, input.sessionToken);
      if (active === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
      const rows = await transaction.$queryRaw<HistoryRow[]>`
        WITH account_history AS (
          SELECT reading.id AS resource_id, reading.created_at AS occurred_at,
                 'reading'::text AS source_type, 'reading'::text AS resource_type,
                 reading.status::text AS status, reading.reading_type::text AS reading_type,
                 reading.theme_code::text AS theme_code
            FROM reading
            JOIN anonymous_subject AS subject ON subject.id = reading.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = reading.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND reading.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
          UNION ALL
          SELECT intention.id, intention.created_at, 'intention'::text, 'intention'::text,
                 intention.status::text, NULL::text, NULL::text
            FROM intention
            JOIN anonymous_subject AS subject ON subject.id = intention.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = intention.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND intention.deleted_at IS NULL
             AND intention.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
          UNION ALL
          SELECT ritual.id, ritual.started_at, 'ritual_legacy'::text, 'ritual'::text,
                 CASE WHEN ritual.completed_at IS NULL THEN 'active' ELSE 'completed' END,
                 NULL::text, NULL::text
            FROM ritual_session AS ritual
            JOIN anonymous_subject AS subject ON subject.id = ritual.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = ritual.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND ritual.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
          UNION ALL
          SELECT ritual.id, ritual.started_at, 'ritual'::text, 'ritual'::text,
                 ritual.status::text, NULL::text, NULL::text
            FROM ritual_session_v2 AS ritual
            JOIN anonymous_subject AS subject ON subject.id = ritual.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = ritual.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND ritual.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
          UNION ALL
          SELECT journal.id, journal.created_at, 'journal_legacy'::text, 'journal'::text,
                 'active'::text, NULL::text, NULL::text
            FROM journal_entry AS journal
            JOIN anonymous_subject AS subject ON subject.id = journal.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = journal.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND journal.deleted_at IS NULL
             AND journal.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
          UNION ALL
          SELECT journal.id, journal.created_at, 'journal'::text, 'journal'::text,
                 'active'::text, NULL::text, NULL::text
            FROM private_journal_entry AS journal
            JOIN anonymous_subject AS subject ON subject.id = journal.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = journal.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND journal.deleted_at IS NULL
             AND journal.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
          UNION ALL
          SELECT revisit.id, revisit.created_at, 'revisit'::text, 'revisit'::text,
                 revisit.status::text, NULL::text, NULL::text
            FROM revisit
            JOIN intention ON intention.id = revisit.intention_id
                          AND intention.anonymous_subject_id = revisit.anonymous_subject_id
            JOIN anonymous_subject AS subject ON subject.id = revisit.anonymous_subject_id
            JOIN account_subject_link AS link
              ON link.anonymous_subject_id = revisit.anonymous_subject_id
           WHERE link.user_id = ${active.userId}::uuid
             AND link.privacy_deleted_at IS NULL
             AND revisit.deleted_at IS NULL
             AND intention.deleted_at IS NULL
             AND revisit.expires_at > CURRENT_TIMESTAMP
             AND subject.expires_at > CURRENT_TIMESTAMP
        )
        SELECT resource_id AS "resourceId", occurred_at AS "occurredAt",
               source_type AS "sourceType", resource_type AS "resourceType",
               status, reading_type AS "readingType", theme_code AS "themeCode"
          FROM account_history
         WHERE (
           ${cursor?.occurredAt ?? null}::timestamptz IS NULL
           OR (occurred_at, source_type, resource_id) <
              (${cursor?.occurredAt ?? null}::timestamptz,
               ${cursor?.sourceType ?? null}::text,
               ${cursor?.resourceId ?? null}::uuid)
         )
         ORDER BY occurred_at DESC, source_type DESC, resource_id DESC
         LIMIT ${input.limit + 1}
      `;
      const hasMore = rows.length > input.limit;
      const selected = rows.slice(0, input.limit);
      const items = selected.map((row): AccountHistorySummary => {
        if (
          !accountHistoryResourceTypes.includes(row.resourceType as AccountHistoryResourceType) ||
          !accountHistorySourceTypes.has(row.sourceType as AccountHistorySourceType)
        ) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        const resourceType = row.resourceType as AccountHistoryResourceType;
        const validStatus =
          (resourceType === "reading" && row.status === "facts_ready") ||
          (resourceType === "intention" &&
            ["active", "archived", "completed"].includes(row.status)) ||
          (resourceType === "ritual" &&
            ["abandoned", "active", "completed", "paused"].includes(row.status)) ||
          (resourceType === "journal" && row.status === "active") ||
          (resourceType === "revisit" &&
            ["archived", "completed", "scheduled"].includes(row.status));
        if (
          !validStatus ||
          (resourceType === "reading" &&
            row.readingType !== "one_card" &&
            row.readingType !== "three_card") ||
          (resourceType === "reading" &&
            (row.themeCode === null || !identifierPattern.test(row.themeCode))) ||
          (resourceType !== "reading" && (row.readingType !== null || row.themeCode !== null))
        ) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        return Object.freeze({
          occurredAt: parseAccountUtcInstant(row.occurredAt.toISOString()),
          readingType:
            row.readingType === "one_card" || row.readingType === "three_card"
              ? row.readingType
              : null,
          resourceId: parseUuidV4(row.resourceId),
          resourceType,
          status: row.status as AccountHistorySummary["status"],
          themeCode: row.themeCode,
        });
      });
      const last = selected.at(-1);
      return Object.freeze({
        items: Object.freeze(items),
        nextCursor:
          hasMore && last !== undefined
            ? Object.freeze({
                occurredAt: parseAccountUtcInstant(last.occurredAt.toISOString()),
                resourceId: parseUuidV4(last.resourceId),
                sourceType: last.sourceType as AccountHistorySourceType,
              })
            : null,
      });
    });
  };

  const listReadings: AccountIdentityService["listReadings"] = async (input) => {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > maximumHistoryPageSize
    ) {
      throw new TypeError("Account reading page size is invalid.");
    }
    const cursor =
      input.cursor === undefined
        ? undefined
        : Object.freeze({
            createdAt: new Date(parseAccountUtcInstant(input.cursor.createdAt)),
            readingId: parseUuidV4(input.cursor.readingId),
          });
    return database.$transaction(async (transaction) => {
      const active = await resolveActiveSession(transaction, input.sessionToken);
      if (active === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
      const rows = await transaction.$queryRaw<
        Array<Readonly<{ createdAt: Date; id: string; readingType: string; themeCode: string }>>
      >`
        SELECT reading.id, reading.created_at AS "createdAt",
               reading.reading_type AS "readingType", reading.theme_code AS "themeCode"
          FROM reading
          JOIN account_subject_link AS link
            ON link.anonymous_subject_id = reading.anonymous_subject_id
         WHERE link.user_id = ${active.userId}::uuid
           AND link.privacy_deleted_at IS NULL
           AND reading.expires_at > CURRENT_TIMESTAMP
           AND (
             ${cursor?.createdAt ?? null}::timestamptz IS NULL
             OR (reading.created_at, reading.id) <
                (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.readingId ?? null}::uuid)
           )
         ORDER BY reading.created_at DESC, reading.id DESC
         LIMIT ${input.limit + 1}
      `;
      const hasMore = rows.length > input.limit;
      const page = rows.slice(0, input.limit).map((row): AccountReadingSummary => {
        if (row.readingType !== "one_card" && row.readingType !== "three_card") {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        return Object.freeze({
          createdAt: parseAccountUtcInstant(row.createdAt.toISOString()),
          id: parseUuidV4(row.id),
          readingType: row.readingType,
          themeCode: row.themeCode,
        });
      });
      const last = page.at(-1);
      return Object.freeze({
        items: Object.freeze(page),
        nextCursor:
          hasMore && last !== undefined
            ? Object.freeze({ createdAt: last.createdAt, readingId: last.id })
            : null,
      });
    });
  };

  return Object.freeze({
    consumeChallenge,
    createChallenge,
    getProfile,
    listHistory,
    listReadings,
    listSessions,
    mergeAnonymousSubject,
    resolveSession,
    revokeAllSessions,
    revokeSession,
    updateProfile,
  });
};
