import { parseIdentityPolicyVersion } from "@rituvia/domain";

import type { PrismaClient } from "./generated/prisma/client.js";
import { assertAnonymousIdentityRuntimeDatabasePrivileges } from "./anonymous-identity.js";

const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export const anonymousSessionRateLimitScopes = Object.freeze([
  "question_intake",
  "protected_beta_mutation",
] as const);

export type AnonymousSessionRateLimitScope = (typeof anonymousSessionRateLimitScopes)[number];

export type AnonymousSessionRateLimitPolicy = Readonly<{
  limit: number;
  policyVersion: string;
  scope: AnonymousSessionRateLimitScope;
  windowSeconds: number;
}>;

export class AnonymousSessionRateLimitError extends Error {
  readonly code: "rate_limited" | "session_unavailable" | "unavailable";
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: "rate_limited" | "session_unavailable" | "unavailable",
    retryAfterSeconds?: number,
  ) {
    super("The anonymous session admission operation failed.");
    this.name = "AnonymousSessionRateLimitError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const validatePolicy = (policy: AnonymousSessionRateLimitPolicy) => {
  parseIdentityPolicyVersion(policy.policyVersion);
  if (
    !anonymousSessionRateLimitScopes.includes(policy.scope) ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    policy.limit > 100_000 ||
    !Number.isSafeInteger(policy.windowSeconds) ||
    policy.windowSeconds < 1 ||
    policy.windowSeconds > 86_400
  ) {
    throw new TypeError("The anonymous session rate-limit policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const tokenBytes = (token: string): Uint8Array | null => {
  if (!sessionTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  return bytes.byteLength === 32 && bytes.toString("base64url") === token ? bytes : null;
};

const sha256 = async (bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
  const source = Uint8Array.from(bytes) as Uint8Array<ArrayBuffer>;
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", source),
  ) as Uint8Array<ArrayBuffer>;
};

type AdmissionRow = Readonly<{
  allowed: boolean;
  observedAt: Date;
  windowStartedAt: Date;
}>;

export const consumeAnonymousSessionRateLimit = async (
  database: PrismaClient,
  rawPolicy: AnonymousSessionRateLimitPolicy,
  token: string,
): Promise<void> => {
  const policy = validatePolicy(rawPolicy);
  const bytes = tokenBytes(token);
  if (bytes === null) throw new AnonymousSessionRateLimitError("session_unavailable");
  const tokenHash = await sha256(bytes);
  try {
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    const rows = await database.$queryRaw<AdmissionRow[]>`
      WITH active AS MATERIALIZED (
        SELECT session.id
          FROM anonymous_session AS session
          JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
         WHERE session.token_hash = ${tokenHash}
           AND session.token_hash_version = 1
           AND session.revoked_at IS NULL
           AND session.expires_at > CURRENT_TIMESTAMP
           AND subject.expires_at > CURRENT_TIMESTAMP
         FOR UPDATE OF session, subject
      ), attempted AS (
        INSERT INTO anonymous_session_rate_limit (
          anonymous_session_id, scope, window_started_at, request_count, policy_version
        )
        SELECT active.id, ${policy.scope}, CURRENT_TIMESTAMP, 1, ${policy.policyVersion}
          FROM active
        ON CONFLICT (anonymous_session_id, scope) DO UPDATE
          SET window_started_at = CASE
                WHEN anonymous_session_rate_limit.policy_version <> ${policy.policyVersion}
                  OR anonymous_session_rate_limit.window_started_at
                       + make_interval(secs => ${policy.windowSeconds}) <= CURRENT_TIMESTAMP
                  THEN CURRENT_TIMESTAMP
                ELSE anonymous_session_rate_limit.window_started_at
              END,
              request_count = CASE
                WHEN anonymous_session_rate_limit.policy_version <> ${policy.policyVersion}
                  OR anonymous_session_rate_limit.window_started_at
                       + make_interval(secs => ${policy.windowSeconds}) <= CURRENT_TIMESTAMP
                  THEN 1
                ELSE anonymous_session_rate_limit.request_count + 1
              END,
              policy_version = ${policy.policyVersion}
        WHERE anonymous_session_rate_limit.policy_version <> ${policy.policyVersion}
           OR anonymous_session_rate_limit.window_started_at
                + make_interval(secs => ${policy.windowSeconds}) <= CURRENT_TIMESTAMP
           OR anonymous_session_rate_limit.request_count < ${policy.limit}
        RETURNING true AS allowed,
                  CURRENT_TIMESTAMP AS "observedAt",
                  window_started_at AS "windowStartedAt"
      )
      SELECT allowed, "observedAt", "windowStartedAt" FROM attempted
      UNION ALL
      SELECT false AS allowed,
             CURRENT_TIMESTAMP AS "observedAt",
             rate_limit.window_started_at AS "windowStartedAt"
        FROM anonymous_session_rate_limit AS rate_limit
        JOIN active ON active.id = rate_limit.anonymous_session_id
       WHERE rate_limit.scope = ${policy.scope}
         AND NOT EXISTS (SELECT 1 FROM attempted)
      LIMIT 1
    `;
    const row = rows[0];
    if (row === undefined) throw new AnonymousSessionRateLimitError("session_unavailable");
    if (!row.allowed) {
      const retryAt = row.windowStartedAt.getTime() + policy.windowSeconds * 1_000;
      const retryAfterSeconds = Math.min(
        policy.windowSeconds,
        Math.max(1, Math.ceil((retryAt - row.observedAt.getTime()) / 1_000)),
      );
      throw new AnonymousSessionRateLimitError("rate_limited", retryAfterSeconds);
    }
  } catch (error) {
    if (error instanceof AnonymousSessionRateLimitError) throw error;
    throw new AnonymousSessionRateLimitError("unavailable");
  }
};
