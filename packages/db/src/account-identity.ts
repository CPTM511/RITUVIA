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
const returnToPattern = /^\/en(?:\/(?:account|account\/history))?$/u;
const maximumHistoryPageSize = 50;

export const accountIdentityErrorCodes = Object.freeze([
  "ACCOUNT_AUTH_INVALID",
  "ACCOUNT_AUTH_EXPIRED",
  "ACCOUNT_AUTH_REPLAYED",
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

  constructor(code: AccountIdentityErrorCode) {
    super(errorMessage(code));
    this.name = "AccountIdentityError";
    this.code = code;
  }
}

export type AccountIdentityPolicy = Readonly<{
  challengeTtlSeconds: number;
  emailEncryptionKey: Uint8Array;
  encryptionKeyVersion: string;
  providerSubjectHmacKey: Uint8Array;
  sessionTtlSeconds: number;
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

export type AccountIdentityService = Readonly<{
  consumeChallenge(input: {
    challengeId: string;
    previousSessionToken?: string | undefined;
    sessionToken: string;
    state: string;
    token: string;
  }): Promise<Readonly<{ context: AccountSessionContext; returnTo: string }>>;
  createChallenge(input: {
    challengeId: string;
    email: string;
    expiresAt: string;
    providerKey: string;
    returnTo: string;
    state: string;
    token: string;
  }): Promise<void>;
  getProfile(sessionToken: string): Promise<AccountProfile>;
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
  }): Promise<"created" | "replayed">;
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
  providerKey: string;
  providerSubject: string;
  returnTo: string;
}>;

type SessionRow = Readonly<{
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

const validatePolicy = (policy: AccountIdentityPolicy): AccountIdentityPolicy => {
  if (
    !Number.isSafeInteger(policy.challengeTtlSeconds) ||
    policy.challengeTtlSeconds < 60 ||
    policy.challengeTtlSeconds > 3_600 ||
    !Number.isSafeInteger(policy.sessionTtlSeconds) ||
    policy.sessionTtlSeconds < 300 ||
    policy.sessionTtlSeconds > 2_592_000 ||
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

const importProviderSubjectHmacKey = async (key: Uint8Array): Promise<webcrypto.CryptoKey> =>
  webcrypto.subtle.importKey("raw", key, { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);

const providerSubjectForEmail = async (
  email: string,
  key: webcrypto.CryptoKey,
): Promise<string> => {
  const digest = new Uint8Array(
    await webcrypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`rituvia.local-passwordless.v1:${email}`),
    ),
  );
  const suffix = Buffer.from(digest).toString("hex");
  return parseAuthProviderSubject(`local.${suffix}`);
};

const importEmailKey = async (key: Uint8Array): Promise<webcrypto.CryptoKey> =>
  webcrypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt", "encrypt"]);

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
        iv: input.nonce,
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
  (error.code === "P2002" || error.code === "23505");

export const createAccountIdentityService = (
  database: PrismaClient,
  rawPolicy: AccountIdentityPolicy,
): AccountIdentityService => {
  const policy = validatePolicy(rawPolicy);
  const emailKeyPromise = importEmailKey(policy.emailEncryptionKey);
  const providerSubjectHmacKeyPromise = importProviderSubjectHmacKey(policy.providerSubjectHmacKey);

  const createChallenge: AccountIdentityService["createChallenge"] = async (input) => {
    if (!uuidV4Pattern.test(input.challengeId) || !returnToPattern.test(input.returnTo)) {
      throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
    }
    const providerKey = parseAuthProviderKey(input.providerKey);
    const email = normalizeAccountEmail(input.email);
    const providerSubject = await providerSubjectForEmail(
      email,
      await providerSubjectHmacKeyPromise,
    );
    const token = parseOpaqueToken(input.token);
    const state = parseOpaqueToken(input.state);
    const expiresAt = new Date(parseAccountUtcInstant(input.expiresAt));
    if (
      expiresAt.getTime() <= Date.now() ||
      expiresAt.getTime() - Date.now() > policy.challengeTtlSeconds * 1_000 + 5_000
    ) {
      throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
    }
    const [tokenHash, stateHash, encryptedEmail] = await Promise.all([
      sha256(token),
      sha256(state),
      emailKeyPromise.then((key) =>
        encryptEmail(
          email,
          key,
          `rituvia.account-email.v1:challenge:${input.challengeId}:${providerKey}:${providerSubject}:${policy.encryptionKeyVersion}`,
        ),
      ),
    ]);
    try {
      await database.$executeRaw`
        INSERT INTO auth_challenge (
          id, provider_key, provider_subject, email_ciphertext, email_nonce, email_tag,
          encryption_key_version, token_hash, token_hash_version, state_hash,
          return_to, created_at, expires_at, attempt_count
        ) VALUES (
          ${input.challengeId}::uuid, ${providerKey}, ${providerSubject},
          ${encryptedEmail.ciphertext}, ${encryptedEmail.nonce}, ${encryptedEmail.tag},
          ${policy.encryptionKeyVersion}, ${tokenHash}, 1, ${stateHash},
          ${input.returnTo}, CURRENT_TIMESTAMP, ${expiresAt}, 0
        )
      `;
    } catch (error) {
      if (isDatabaseConflict(error)) throw new AccountIdentityError("ACCOUNT_AUTH_REPLAYED");
      throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
  };

  const consumeChallenge: AccountIdentityService["consumeChallenge"] = async (input) => {
    if (!uuidV4Pattern.test(input.challengeId)) {
      throw new AccountIdentityError("ACCOUNT_AUTH_INVALID");
    }
    const [challengeHash, stateHash, sessionHash, previousHash] = await Promise.all([
      sha256(parseOpaqueToken(input.token)),
      sha256(parseOpaqueToken(input.state)),
      sha256(parseOpaqueToken(input.sessionToken)),
      input.previousSessionToken === undefined
        ? Promise.resolve(null)
        : tokenBytes(input.previousSessionToken) === null
          ? Promise.resolve(null)
          : sha256(tokenBytes(input.previousSessionToken)!),
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
        if (previousHash !== null) {
          await transaction.$executeRaw`
            UPDATE account_session
               SET revoked_at = CURRENT_TIMESTAMP
             WHERE token_hash = ${previousHash}
               AND user_id = ${userId}::uuid
               AND revoked_at IS NULL
               AND expires_at >= CURRENT_TIMESTAMP
          `;
        }
        const sessions = await transaction.$queryRaw<SessionRow[]>`
          INSERT INTO account_session (
            user_id, auth_identity_id, token_hash, token_hash_version,
            created_at, expires_at, last_seen_at
          ) VALUES (
            ${userId}::uuid, ${authIdentityId}::uuid, ${sessionHash}, 1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + make_interval(secs => ${policy.sessionTtlSeconds}),
            CURRENT_TIMESTAMP
          )
          RETURNING id AS "sessionId", user_id AS "userId",
                    auth_identity_id AS "authIdentityId", expires_at AS "expiresAt",
                    ${providerKey}::text AS "providerKey"
        `;
        const session = sessions[0];
        if (sessions.length !== 1 || session === undefined) {
          throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
        }
        return Object.freeze({ context: context(session), returnTo: challenge.returnTo });
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
    if (!idempotencyKeyPattern.test(input.idempotencyKey)) {
      throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
    }
    const anonymousToken = tokenBytes(input.anonymousSessionToken);
    if (anonymousToken === null) throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
    const [anonymousHash, idempotencyKeyHash] = await Promise.all([
      sha256(anonymousToken),
      sha256(input.idempotencyKey),
    ]);
    let conflictRetried = false;
    for (;;) {
      try {
        return await database.$transaction(async (transaction) => {
          const account = await resolveActiveSession(transaction, input.accountSessionToken);
          if (account === null) throw new AccountIdentityError("ACCOUNT_SESSION_UNAVAILABLE");
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
           WHERE session.token_hash = ${anonymousHash}
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
          const existing = await transaction.$queryRaw<
            Array<
              Readonly<{
                anonymousSubjectId: string;
                canonicalRequestHash: Uint8Array;
                idempotencyKeyHash: Uint8Array;
                userId: string;
              }>
            >
          >`
          SELECT user_id AS "userId", anonymous_subject_id AS "anonymousSubjectId",
                 idempotency_key_hash AS "idempotencyKeyHash",
                 canonical_request_hash AS "canonicalRequestHash"
            FROM account_subject_link
           WHERE anonymous_subject_id = ${subject.anonymousSubjectId}::uuid
              OR (user_id = ${account.userId}::uuid AND idempotency_key_hash = ${idempotencyKeyHash})
        `;
          if (existing.length > 0) {
            const replay = existing[0];
            if (
              existing.length !== 1 ||
              replay === undefined ||
              replay.userId !== account.userId ||
              replay.anonymousSubjectId !== subject.anonymousSubjectId ||
              !bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)
            ) {
              throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
            }
            return "replayed" as const;
          }
          if (subject.revokedAt !== null) {
            throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
          }
          await transaction.$executeRaw`
          INSERT INTO account_subject_link (
            user_id, anonymous_subject_id, idempotency_key_hash,
            canonical_request_hash, source_session_id, created_at
          ) VALUES (
            ${account.userId}::uuid, ${subject.anonymousSubjectId}::uuid, ${idempotencyKeyHash},
            ${canonicalRequestHash}, ${subject.sourceSessionId}::uuid, CURRENT_TIMESTAMP
          )
        `;
          await transaction.$executeRaw`
          UPDATE anonymous_session SET revoked_at = CURRENT_TIMESTAMP
           WHERE anonymous_subject_id = ${subject.anonymousSubjectId}::uuid
             AND revoked_at IS NULL
        `;
          return "created" as const;
        });
      } catch (error) {
        if (error instanceof AccountIdentityError) throw error;
        if (isDatabaseConflict(error) && !conflictRetried) {
          conflictRetried = true;
          continue;
        }
        if (isDatabaseConflict(error)) throw new AccountIdentityError("ACCOUNT_MERGE_CONFLICT");
        throw new AccountIdentityError("ACCOUNT_IDENTITY_UNAVAILABLE");
      }
    }
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
    listReadings,
    listSessions,
    mergeAnonymousSubject,
    resolveSession,
    revokeAllSessions,
    revokeSession,
    updateProfile,
  });
};
