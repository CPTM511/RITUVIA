import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const addressPattern = /^0x[0-9a-f]{40}$/u;
const idempotencyKeyPattern = /^[A-Za-z0-9_-]{22,128}$/u;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const signaturePattern = /^0x[0-9a-fA-F]{130}$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const walletIdentityErrorCodes = Object.freeze([
  "WALLET_AUTH_INVALID",
  "WALLET_AUTH_EXPIRED",
  "WALLET_AUTH_REPLAYED",
  "WALLET_AUTH_UNAVAILABLE",
  "WALLET_AUTH_CONFLICT",
  "WALLET_SESSION_UNAVAILABLE",
] as const);

export type WalletIdentityErrorCode = (typeof walletIdentityErrorCodes)[number];

export class WalletIdentityError extends Error {
  readonly code: WalletIdentityErrorCode;

  constructor(code: WalletIdentityErrorCode) {
    super("The wallet identity operation is unavailable.");
    this.name = "WalletIdentityError";
    this.code = code;
  }
}

export type WalletIdentityPolicy = Readonly<{
  allowedChainIds: readonly number[];
  challengeTtlSeconds: number;
  recentAuthenticationSeconds: number;
  sessionTtlSeconds: number;
}>;

export type WalletIdentitySummary = Readonly<{
  address: string;
  chainId: number;
  id: string;
  linkedAt: string;
}>;

export type WalletAuthChallengeResult = Readonly<{
  expiresAt: string;
  message: string;
  purpose: "link_wallet" | "sign_in";
  requestId: string;
}>;

export type WalletAuthVerificationResult =
  | Readonly<{
      purpose: "link_wallet";
      wallet: WalletIdentitySummary;
    }>
  | Readonly<{
      expiresAt: string;
      purpose: "sign_in";
      sessionToken: string;
    }>;

export type WalletIdentityService = Readonly<{
  createChallenge(input: {
    address: string;
    chainId: number;
    idempotencyKey: string;
    message: string;
    nonce: string;
    purpose: "link_wallet" | "sign_in";
    requestId: string;
    sessionToken?: string | undefined;
  }): Promise<WalletAuthChallengeResult>;
  listWallets(sessionToken: string): Promise<readonly WalletIdentitySummary[]>;
  recordRejectedVerification(input: {
    reasonCode: "invalid_message" | "invalid_signature";
    requestId: string;
    signature?: string | undefined;
  }): Promise<void>;
  revokeWallet(input: { sessionToken: string; walletIdentityId: string }): Promise<boolean>;
  verifyChallenge(input: {
    message: string;
    requestId: string;
    sessionToken?: string | undefined;
    signature: string;
    successorSessionToken?: string | undefined;
  }): Promise<WalletAuthVerificationResult>;
}>;

type ActiveSession = Readonly<{
  authenticatedAt: Date | null;
  authIdentityId: string;
  sessionId: string;
  userId: string;
}>;

type ChallengeRow = Readonly<{
  address: string;
  chainId: bigint;
  consumedAt: Date | null;
  expiresAt: Date;
  id: string;
  message: string;
  messageHash: Uint8Array;
  purpose: string;
  requestedBySessionId: string | null;
  requestedByUserId: string | null;
}>;

const digest = (scope: string, value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(`rituvia.${scope}.v1\0${value}`, "utf8").digest());

const accountSessionTokenDigest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(Buffer.from(value, "base64url")).digest());

const validatePolicy = (policy: WalletIdentityPolicy): WalletIdentityPolicy => {
  const allowed = [...new Set(policy.allowedChainIds)].sort((left, right) => left - right);
  if (
    allowed.length < 1 ||
    allowed.length > 16 ||
    allowed.some(
      (chainId) => !Number.isSafeInteger(chainId) || chainId < 1 || chainId > 2_147_483_647,
    ) ||
    !Number.isSafeInteger(policy.challengeTtlSeconds) ||
    policy.challengeTtlSeconds < 60 ||
    policy.challengeTtlSeconds > 900 ||
    !Number.isSafeInteger(policy.recentAuthenticationSeconds) ||
    policy.recentAuthenticationSeconds < 60 ||
    policy.recentAuthenticationSeconds > 86_400 ||
    !Number.isSafeInteger(policy.sessionTtlSeconds) ||
    policy.sessionTtlSeconds < 300 ||
    policy.sessionTtlSeconds > 2_592_000
  ) {
    throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
  }
  return Object.freeze({ ...policy, allowedChainIds: Object.freeze(allowed) });
};

const activeSession = async (
  transaction: Prisma.TransactionClient,
  sessionToken: string | undefined,
): Promise<ActiveSession | null> => {
  if (sessionToken === undefined || !opaqueTokenPattern.test(sessionToken)) return null;
  const tokenHash = accountSessionTokenDigest(sessionToken);
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    SELECT session.id AS "sessionId", session.user_id AS "userId",
           session.auth_identity_id AS "authIdentityId",
           session.authenticated_at AS "authenticatedAt"
      FROM account_session AS session
      JOIN app_user AS account ON account.id = session.user_id
     WHERE session.token_hash = ${tokenHash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.status = 'active'
     FOR UPDATE OF session
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

const walletSummary = (row: {
  address: string;
  chainId: bigint;
  createdAt: Date;
  id: string;
}): WalletIdentitySummary => {
  const chainId = Number(row.chainId);
  if (
    !uuidV4Pattern.test(row.id) ||
    !addressPattern.test(row.address) ||
    !Number.isSafeInteger(chainId)
  ) {
    throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
  }
  return Object.freeze({
    address: row.address,
    chainId,
    id: row.id,
    linkedAt: row.createdAt.toISOString(),
  });
};

const challengeFrom = (row: ChallengeRow): WalletAuthChallengeResult => {
  if (
    !uuidV4Pattern.test(row.id) ||
    (row.purpose !== "link_wallet" && row.purpose !== "sign_in") ||
    row.message.length < 1 ||
    row.message.length > 2_048
  ) {
    throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
  }
  return Object.freeze({
    expiresAt: row.expiresAt.toISOString(),
    message: row.message,
    purpose: row.purpose,
    requestId: row.id,
  });
};

export const createWalletIdentityService = (
  database: PrismaClient,
  rawPolicy: WalletIdentityPolicy,
): WalletIdentityService => {
  const policy = validatePolicy(rawPolicy);

  const createChallenge: WalletIdentityService["createChallenge"] = async (input) => {
    if (
      !addressPattern.test(input.address) ||
      !policy.allowedChainIds.includes(input.chainId) ||
      !idempotencyKeyPattern.test(input.idempotencyKey) ||
      !uuidV4Pattern.test(input.requestId) ||
      !/^[A-Za-z0-9]{8,128}$/u.test(input.nonce) ||
      input.message.length < 1 ||
      input.message.length > 2_048
    ) {
      throw new WalletIdentityError("WALLET_AUTH_INVALID");
    }
    const idempotencyKeyHash = digest("wallet-idempotency", input.idempotencyKey);
    const canonicalRequestHash = digest(
      "wallet-challenge-request",
      JSON.stringify({
        address: input.address,
        chainId: input.chainId,
        purpose: input.purpose,
      }),
    );
    const messageHash = digest("wallet-message", input.message);
    const nonceHash = digest("wallet-nonce", input.nonce);
    try {
      return await database.$transaction(async (transaction) => {
        let requester: ActiveSession | null = null;
        if (input.purpose === "link_wallet") {
          requester = await activeSession(transaction, input.sessionToken);
          if (
            requester === null ||
            requester.authenticatedAt === null ||
            requester.authenticatedAt.getTime() <
              Date.now() - policy.recentAuthenticationSeconds * 1_000
          ) {
            throw new WalletIdentityError("WALLET_SESSION_UNAVAILABLE");
          }
        } else if (input.purpose !== "sign_in" || input.sessionToken !== undefined) {
          throw new WalletIdentityError("WALLET_AUTH_INVALID");
        }
        const existing = await transaction.$queryRaw<ChallengeRow[]>`
          SELECT id, address, chain_id AS "chainId", purpose, message,
                 message_hash AS "messageHash", requested_by_user_id AS "requestedByUserId",
                 requested_by_session_id AS "requestedBySessionId", expires_at AS "expiresAt",
                 consumed_at AS "consumedAt"
            FROM wallet_auth_challenge
           WHERE idempotency_key_hash = ${idempotencyKeyHash}
           FOR UPDATE
        `;
        if (existing.length === 1 && existing[0] !== undefined) {
          const row = existing[0];
          if (
            !Buffer.from(row.messageHash).equals(Buffer.from(messageHash)) ||
            row.requestedByUserId !== requester?.userId ||
            row.requestedBySessionId !== requester?.sessionId ||
            row.consumedAt !== null ||
            row.expiresAt.getTime() <= Date.now()
          ) {
            throw new WalletIdentityError("WALLET_AUTH_CONFLICT");
          }
          return challengeFrom(row);
        }
        if (existing.length !== 0) throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
        const rows = await transaction.$queryRaw<ChallengeRow[]>`
          INSERT INTO wallet_auth_challenge (
            id, address, chain_id, purpose, message, message_hash, nonce_hash,
            idempotency_key_hash, canonical_request_hash, requested_by_user_id,
            requested_by_session_id, created_at, expires_at
          ) VALUES (
            ${input.requestId}::uuid, ${input.address}, ${input.chainId}, ${input.purpose},
            ${input.message}, ${messageHash}, ${nonceHash}, ${idempotencyKeyHash},
            ${canonicalRequestHash}, ${requester?.userId ?? null}::uuid,
            ${requester?.sessionId ?? null}::uuid, CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + make_interval(secs => ${policy.challengeTtlSeconds})
          )
          RETURNING id, address, chain_id AS "chainId", purpose, message,
                    message_hash AS "messageHash", requested_by_user_id AS "requestedByUserId",
                    requested_by_session_id AS "requestedBySessionId", expires_at AS "expiresAt",
                    consumed_at AS "consumedAt"
        `;
        if (rows.length !== 1 || rows[0] === undefined) {
          throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
        }
        return challengeFrom(rows[0]);
      });
    } catch (error) {
      if (error instanceof WalletIdentityError) throw error;
      throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
    }
  };

  const recordRejectedVerification: WalletIdentityService["recordRejectedVerification"] = async (
    input,
  ) => {
    if (
      !uuidV4Pattern.test(input.requestId) ||
      (input.signature !== undefined && !signaturePattern.test(input.signature))
    ) {
      return;
    }
    const signatureHash =
      input.signature === undefined
        ? null
        : digest("wallet-signature", input.signature.toLowerCase());
    await database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        UPDATE wallet_auth_challenge
           SET attempt_count = attempt_count + 1
         WHERE id = ${input.requestId}::uuid
           AND attempt_count < 10
         RETURNING id
      `;
      if (rows.length !== 1) return;
      await transaction.$executeRaw`
        INSERT INTO wallet_auth_event (
          challenge_id, outcome, reason_code, signature_hash, created_at
        ) VALUES (
          ${input.requestId}::uuid, 'rejected', ${input.reasonCode}, ${signatureHash},
          CURRENT_TIMESTAMP
        )
      `;
    });
  };

  const verifyChallenge: WalletIdentityService["verifyChallenge"] = async (input) => {
    if (
      !uuidV4Pattern.test(input.requestId) ||
      !signaturePattern.test(input.signature) ||
      input.message.length < 1 ||
      input.message.length > 2_048
    ) {
      throw new WalletIdentityError("WALLET_AUTH_INVALID");
    }
    const signatureHash = digest("wallet-signature", input.signature.toLowerCase());
    const messageHash = digest("wallet-message", input.message);
    const successorHash =
      input.successorSessionToken === undefined
        ? null
        : opaqueTokenPattern.test(input.successorSessionToken)
          ? accountSessionTokenDigest(input.successorSessionToken)
          : null;
    if (input.successorSessionToken !== undefined && successorHash === null) {
      throw new WalletIdentityError("WALLET_AUTH_INVALID");
    }
    const result = await database.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<ChallengeRow[]>`
        SELECT id, address, chain_id AS "chainId", purpose, message,
               message_hash AS "messageHash", requested_by_user_id AS "requestedByUserId",
               requested_by_session_id AS "requestedBySessionId", expires_at AS "expiresAt",
               consumed_at AS "consumedAt"
          FROM wallet_auth_challenge
         WHERE id = ${input.requestId}::uuid
         FOR UPDATE
      `;
      const challenge = rows[0];
      if (rows.length !== 1 || challenge === undefined) {
        return Object.freeze({ error: "WALLET_AUTH_INVALID" as const });
      }
      const rejection = async (reasonCode: string, error: WalletIdentityErrorCode) => {
        if (challenge.consumedAt === null && challenge.expiresAt.getTime() > Date.now()) {
          await transaction.$executeRaw`
            UPDATE wallet_auth_challenge SET attempt_count = attempt_count + 1
             WHERE id = ${challenge.id}::uuid AND attempt_count < 10
          `;
        }
        await transaction.$executeRaw`
          INSERT INTO wallet_auth_event (
            challenge_id, outcome, reason_code, signature_hash, created_at
          ) VALUES (
            ${challenge.id}::uuid, 'rejected', ${reasonCode}, ${signatureHash}, CURRENT_TIMESTAMP
          )
        `;
        return Object.freeze({ error });
      };
      if (challenge.consumedAt !== null) return rejection("replayed", "WALLET_AUTH_REPLAYED");
      if (challenge.expiresAt.getTime() <= Date.now()) {
        return rejection("expired", "WALLET_AUTH_EXPIRED");
      }
      if (
        challenge.message !== input.message ||
        !Buffer.from(challenge.messageHash).equals(Buffer.from(messageHash))
      ) {
        return rejection("message_mismatch", "WALLET_AUTH_INVALID");
      }
      if (challenge.purpose === "link_wallet") {
        const requester = await activeSession(transaction, input.sessionToken);
        if (
          requester === null ||
          requester.userId !== challenge.requestedByUserId ||
          requester.sessionId !== challenge.requestedBySessionId ||
          requester.authenticatedAt === null ||
          requester.authenticatedAt.getTime() <
            Date.now() - policy.recentAuthenticationSeconds * 1_000
        ) {
          return rejection("session_mismatch", "WALLET_SESSION_UNAVAILABLE");
        }
        const existing = await transaction.$queryRaw<
          Array<{ id: string; revokedAt: Date | null; userId: string }>
        >`
          SELECT id, user_id AS "userId", revoked_at AS "revokedAt"
            FROM wallet_identity
           WHERE chain_family = 'eip155' AND address = ${challenge.address}
           FOR UPDATE
        `;
        if (existing.length > 0) {
          return rejection("wallet_conflict", "WALLET_AUTH_CONFLICT");
        }
        const wallets = await transaction.$queryRaw<
          Array<{ address: string; chainId: bigint; createdAt: Date; id: string }>
        >`
          INSERT INTO wallet_identity (
            user_id, chain_family, chain_id, address, linked_by_session_id,
            verified_at, created_at
          ) VALUES (
            ${requester.userId}::uuid, 'eip155', ${challenge.chainId}, ${challenge.address},
            ${requester.sessionId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING id, address, chain_id AS "chainId", created_at AS "createdAt"
        `;
        const wallet = wallets[0];
        if (wallets.length !== 1 || wallet === undefined) {
          throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
        }
        await transaction.$executeRaw`
          UPDATE wallet_auth_challenge SET consumed_at = CURRENT_TIMESTAMP
           WHERE id = ${challenge.id}::uuid
        `;
        await transaction.$executeRaw`
          INSERT INTO wallet_auth_event (
            challenge_id, user_id, wallet_identity_id, outcome, reason_code,
            signature_hash, created_at
          ) VALUES (
            ${challenge.id}::uuid, ${requester.userId}::uuid, ${wallet.id}::uuid,
            'accepted', 'wallet_linked', ${signatureHash}, CURRENT_TIMESTAMP
          )
        `;
        return Object.freeze({
          value: { purpose: "link_wallet" as const, wallet: walletSummary(wallet) },
        });
      }
      if (
        challenge.purpose !== "sign_in" ||
        input.sessionToken !== undefined ||
        successorHash === null
      ) {
        return rejection("purpose_mismatch", "WALLET_AUTH_INVALID");
      }
      const wallets = await transaction.$queryRaw<
        Array<{ authIdentityId: string; id: string; userId: string }>
      >`
        SELECT wallet.id, wallet.user_id AS "userId", identity.id AS "authIdentityId"
          FROM wallet_identity AS wallet
          JOIN app_user AS account ON account.id = wallet.user_id
          JOIN LATERAL (
            SELECT auth_identity.id FROM auth_identity
             WHERE auth_identity.user_id = wallet.user_id
             ORDER BY auth_identity.created_at, auth_identity.id LIMIT 1
          ) AS identity ON TRUE
         WHERE wallet.chain_family = 'eip155'
           AND wallet.address = ${challenge.address}
           AND wallet.revoked_at IS NULL
           AND account.status = 'active'
         FOR UPDATE OF wallet, account
      `;
      const wallet = wallets[0];
      if (wallets.length !== 1 || wallet === undefined) {
        return rejection("wallet_unlinked", "WALLET_AUTH_INVALID");
      }
      const sessions = await transaction.$queryRaw<Array<{ expiresAt: Date }>>`
        INSERT INTO account_session (
          user_id, auth_identity_id, wallet_identity_id, token_hash, token_hash_version,
          authenticated_at, created_at, expires_at, last_seen_at
        ) VALUES (
          ${wallet.userId}::uuid, ${wallet.authIdentityId}::uuid, ${wallet.id}::uuid,
          ${successorHash}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + make_interval(secs => ${policy.sessionTtlSeconds}), CURRENT_TIMESTAMP
        ) RETURNING expires_at AS "expiresAt"
      `;
      if (sessions.length !== 1 || sessions[0] === undefined) {
        throw new WalletIdentityError("WALLET_AUTH_UNAVAILABLE");
      }
      await transaction.$executeRaw`
        UPDATE wallet_identity SET last_sign_in_at = CURRENT_TIMESTAMP WHERE id = ${wallet.id}::uuid
      `;
      await transaction.$executeRaw`
        UPDATE wallet_auth_challenge SET consumed_at = CURRENT_TIMESTAMP
         WHERE id = ${challenge.id}::uuid
      `;
      await transaction.$executeRaw`
        INSERT INTO wallet_auth_event (
          challenge_id, user_id, wallet_identity_id, outcome, reason_code,
          signature_hash, created_at
        ) VALUES (
          ${challenge.id}::uuid, ${wallet.userId}::uuid, ${wallet.id}::uuid,
          'accepted', 'wallet_signed_in', ${signatureHash}, CURRENT_TIMESTAMP
        )
      `;
      return Object.freeze({
        value: {
          expiresAt: sessions[0].expiresAt.toISOString(),
          purpose: "sign_in" as const,
          sessionToken: input.successorSessionToken!,
        },
      });
    });
    if ("error" in result) throw new WalletIdentityError(result.error);
    return result.value;
  };

  const listWallets: WalletIdentityService["listWallets"] = async (sessionToken) =>
    database.$transaction(async (transaction) => {
      const session = await activeSession(transaction, sessionToken);
      if (session === null) throw new WalletIdentityError("WALLET_SESSION_UNAVAILABLE");
      const rows = await transaction.$queryRaw<
        Array<{ address: string; chainId: bigint; createdAt: Date; id: string }>
      >`
        SELECT id, address, chain_id AS "chainId", created_at AS "createdAt"
          FROM wallet_identity
         WHERE user_id = ${session.userId}::uuid AND revoked_at IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 20
      `;
      return Object.freeze(rows.map(walletSummary));
    });

  const revokeWallet: WalletIdentityService["revokeWallet"] = async (input) => {
    if (!uuidV4Pattern.test(input.walletIdentityId)) return false;
    return database.$transaction(async (transaction) => {
      const session = await activeSession(transaction, input.sessionToken);
      if (
        session === null ||
        session.authenticatedAt === null ||
        session.authenticatedAt.getTime() < Date.now() - policy.recentAuthenticationSeconds * 1_000
      ) {
        throw new WalletIdentityError("WALLET_SESSION_UNAVAILABLE");
      }
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        UPDATE wallet_identity SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = ${input.walletIdentityId}::uuid
           AND user_id = ${session.userId}::uuid
           AND revoked_at IS NULL
         RETURNING id
      `;
      if (rows.length !== 1) return false;
      await transaction.$executeRaw`
        UPDATE account_session SET revoked_at = CURRENT_TIMESTAMP
         WHERE wallet_identity_id = ${input.walletIdentityId}::uuid
           AND user_id = ${session.userId}::uuid
           AND id <> ${session.sessionId}::uuid
           AND revoked_at IS NULL
      `;
      return true;
    });
  };

  return Object.freeze({
    createChallenge,
    listWallets,
    recordRejectedVerification,
    revokeWallet,
    verifyChallenge,
  });
};
