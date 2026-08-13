import { parseIdentityPolicyVersion } from "@rituvia/domain";

import type { Prisma, PrismaClient } from "./generated/prisma/client.js";

const inviteTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const maximumTokenAttempts = 3;
const minimumInviteTtlSeconds = 300;
const maximumInviteTtlSeconds = 2_592_000;

export type ProtectedBetaInvitePolicy = Readonly<{
  cohortLimit: 25;
  policyVersion: string;
}>;

export const protectedBetaInviteErrorCodes = Object.freeze([
  "PROTECTED_BETA_ADMISSION_REQUIRED",
  "PROTECTED_BETA_INVITE_CAPACITY_REACHED",
  "PROTECTED_BETA_INVITE_CONFLICT",
  "PROTECTED_BETA_INVITE_NOT_FOUND",
  "PROTECTED_BETA_INVITE_REPLAY_REQUIRES_TOKEN",
  "PROTECTED_BETA_INVITE_UNAVAILABLE",
] as const);

export type ProtectedBetaInviteErrorCode = (typeof protectedBetaInviteErrorCodes)[number];

export class ProtectedBetaInviteError extends Error {
  readonly code: ProtectedBetaInviteErrorCode;

  constructor(code: ProtectedBetaInviteErrorCode) {
    super("The protected-Beta invite operation failed.");
    this.name = "ProtectedBetaInviteError";
    this.code = code;
  }
}

export type CreatedProtectedBetaInvite = Readonly<{
  expiresAt: string;
  inviteId: string;
  seatNumber: number;
  token: string;
}>;

export type RevokedProtectedBetaInvite = Readonly<{
  kind: "already_revoked" | "replayed" | "revoked";
}>;

export type ProtectedBetaInviteControlService = Readonly<{
  createInvite(input: {
    idempotencyKey: string;
    ttlSeconds: number;
  }): Promise<CreatedProtectedBetaInvite>;
  revokeInvite(input: {
    idempotencyKey: string;
    inviteId: string;
  }): Promise<RevokedProtectedBetaInvite>;
}>;

const validatePolicy = (input: Readonly<{ cohortLimit: number; policyVersion: string }>) => {
  parseIdentityPolicyVersion(input.policyVersion);
  if (input.cohortLimit !== 25) {
    throw new TypeError("The protected-Beta invite policy is invalid.");
  }
  return Object.freeze({
    cohortLimit: 25 as const,
    policyVersion: input.policyVersion,
  });
};

const parseIdempotencyKey = (value: string): string => {
  if (!idempotencyKeyPattern.test(value)) {
    throw new TypeError("The protected-Beta invite idempotency key is invalid.");
  }
  return value;
};

const parseInviteId = (value: string): string => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) {
    throw new TypeError("The protected-Beta invite identifier is invalid.");
  }
  return value;
};

const parseTtlSeconds = (value: number): number => {
  if (
    !Number.isSafeInteger(value) ||
    value < minimumInviteTtlSeconds ||
    value > maximumInviteTtlSeconds
  ) {
    throw new TypeError("The protected-Beta invite lifetime is invalid.");
  }
  return value;
};

const sha256 = async (value: Uint8Array | string): Promise<Uint8Array<ArrayBuffer>> => {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const bytes = Uint8Array.from(source) as Uint8Array<ArrayBuffer>;
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", bytes),
  ) as Uint8Array<ArrayBuffer>;
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const inviteTokenBytes = (token: string): Uint8Array | null => {
  if (!inviteTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  return bytes.byteLength === 32 && bytes.toString("base64url") === token ? bytes : null;
};

const newInviteToken = (): Readonly<{ bytes: Uint8Array; token: string }> => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const token = Buffer.from(bytes).toString("base64url");
  if (!inviteTokenPattern.test(token)) {
    throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_UNAVAILABLE");
  }
  return Object.freeze({ bytes, token });
};

const isUniqueConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "23505" ||
    error.code === "P2002" ||
    (error.code === "P2010" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("Code: `23505`")));

type InviteControlPrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canDelete: boolean;
  canInsertCohort: boolean;
  canInsertInvite: boolean;
  canReadControl: boolean;
  canReadInviteTokenHash: boolean;
  canReadPrivateSessionColumns: boolean;
  canRevokeInvite: boolean;
  canRevokeSession: boolean;
  canUpdateCohort: boolean;
  canUpdateInviteRestricted: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachableOwnerOrPrivilegedRole: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
}>;

export const assertProtectedBetaInviteControlDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<InviteControlPrivilegeRow[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             ARRAY(
               SELECT relowner
                 FROM pg_class
                WHERE oid = ANY(ARRAY[
                  'public.protected_beta_invite_cohort'::regclass,
                  'public.protected_beta_invite'::regclass,
                  'public.anonymous_session'::regclass
                ])
             ) AS table_owner_oids
    ), reachable_roles AS (
      SELECT role.* FROM pg_roles AS role
       WHERE role.rolname = current_user OR pg_has_role(current_user, role.oid, 'MEMBER')
    )
    SELECT current_user AS "roleName",
           session_user AS "sessionRoleName",
           pg_get_userbyid(owners.database_owner_oid) AS "databaseOwner",
           pg_get_userbyid(owners.schema_owner_oid) AS "schemaOwner",
           has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           (has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'policy_version', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'cohort_limit', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'issued_count', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'id', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'policy_version', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'seat_number', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'creation_key_hash', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_creation_hash', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'expires_at', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'anonymous_session_id', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'revoked_at', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'revocation_key_hash', 'SELECT')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_revocation_hash', 'SELECT')) AS "canReadControl",
           has_column_privilege(current_user, 'public.protected_beta_invite', 'token_hash', 'SELECT') AS "canReadInviteTokenHash",
           has_table_privilege(current_user, 'public.protected_beta_invite_cohort', 'INSERT') AS "canInsertCohort",
           has_column_privilege(current_user, 'public.protected_beta_invite_cohort', 'issued_count', 'UPDATE') AS "canUpdateCohort",
           has_table_privilege(current_user, 'public.protected_beta_invite', 'INSERT') AS "canInsertInvite",
           (has_column_privilege(current_user, 'public.protected_beta_invite', 'revoked_at', 'UPDATE')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'revocation_key_hash', 'UPDATE')
             AND has_column_privilege(current_user, 'public.protected_beta_invite', 'canonical_revocation_hash', 'UPDATE')) AS "canRevokeInvite",
           (has_column_privilege(current_user, 'public.protected_beta_invite', 'token_hash', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'policy_version', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'seat_number', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'consumed_at', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'anonymous_session_id', 'UPDATE')
             OR has_column_privilege(current_user, 'public.protected_beta_invite', 'expires_at', 'UPDATE')) AS "canUpdateInviteRestricted",
           has_column_privilege(current_user, 'public.anonymous_session', 'revoked_at', 'UPDATE') AS "canRevokeSession",
           (has_column_privilege(current_user, 'public.anonymous_session', 'token_hash', 'SELECT')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'issuance_key_hash', 'SELECT')
             OR has_column_privilege(current_user, 'public.anonymous_session', 'canonical_request_hash', 'SELECT')) AS "canReadPrivateSessionColumns",
           (has_table_privilege(current_user, 'public.protected_beta_invite_cohort', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.protected_beta_invite', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.anonymous_session', 'DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')) AS "canDelete",
           (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
              FROM pg_roles WHERE rolname = current_user) AS "privilegedRole",
           EXISTS (
             SELECT 1 FROM reachable_roles AS role
              WHERE role.rolsuper OR role.rolcreatedb OR role.rolcreaterole OR role.rolreplication
                 OR role.rolbypassrls OR role.oid = owners.database_owner_oid
                 OR role.oid = owners.schema_owner_oid OR role.oid = ANY(owners.table_owner_oids)
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
    row.canDelete ||
    !row.canInsertCohort ||
    !row.canInsertInvite ||
    !row.canReadControl ||
    row.canReadInviteTokenHash ||
    row.canReadPrivateSessionColumns ||
    !row.canRevokeInvite ||
    !row.canRevokeSession ||
    !row.canUpdateCohort ||
    row.canUpdateInviteRestricted ||
    row.privilegedRole ||
    row.reachableOwnerOrPrivilegedRole
  ) {
    throw new TypeError("Protected-Beta invite control database privileges are unsafe.");
  }
};

type LockedInvite = Readonly<{ inviteId: string }>;

export const lockProtectedBetaInviteForAdmission = async (
  transaction: Prisma.TransactionClient,
  rawPolicy: Readonly<{ cohortLimit: number; policyVersion: string }>,
  token: string | undefined,
): Promise<LockedInvite> => {
  const policy = validatePolicy(rawPolicy);
  const bytes = token === undefined ? null : inviteTokenBytes(token);
  if (bytes === null) {
    throw new ProtectedBetaInviteError("PROTECTED_BETA_ADMISSION_REQUIRED");
  }
  const tokenHash = await sha256(bytes);
  const rows = await transaction.$queryRaw<Array<{ inviteId: string }>>`
    SELECT invite.id AS "inviteId"
      FROM protected_beta_invite AS invite
      JOIN protected_beta_invite_cohort AS cohort
        ON cohort.policy_version = invite.policy_version
     WHERE invite.token_hash = ${tokenHash}
       AND invite.token_hash_version = 1
       AND invite.policy_version = ${policy.policyVersion}
       AND cohort.cohort_limit = ${policy.cohortLimit}
       AND cohort.issued_count <= cohort.cohort_limit
       AND invite.revoked_at IS NULL
       AND invite.consumed_at IS NULL
       AND invite.anonymous_session_id IS NULL
       AND invite.expires_at > CURRENT_TIMESTAMP
     FOR UPDATE OF invite
  `;
  const inviteId = rows[0]?.inviteId;
  if (rows.length !== 1 || inviteId === undefined) {
    throw new ProtectedBetaInviteError("PROTECTED_BETA_ADMISSION_REQUIRED");
  }
  return Object.freeze({ inviteId });
};

export const bindProtectedBetaInviteAdmission = async (
  transaction: Prisma.TransactionClient,
  inviteId: string,
  anonymousSessionId: string,
): Promise<void> => {
  const rows = await transaction.$queryRaw<Array<{ inviteId: string }>>`
    UPDATE protected_beta_invite
       SET consumed_at = CURRENT_TIMESTAMP,
           anonymous_session_id = ${anonymousSessionId}::uuid
     WHERE id = ${inviteId}::uuid
       AND revoked_at IS NULL
       AND consumed_at IS NULL
       AND anonymous_session_id IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     RETURNING id AS "inviteId"
  `;
  if (rows.length !== 1) {
    throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_UNAVAILABLE");
  }
};

type CreationReplayRow = Readonly<{
  canonicalCreationHash: Uint8Array;
}>;

const assertNoCreationReplay = async (
  database: PrismaClient,
  creationKeyHash: Uint8Array,
  canonicalCreationHash: Uint8Array,
): Promise<void> => {
  const rows = await database.$queryRaw<CreationReplayRow[]>`
    SELECT canonical_creation_hash AS "canonicalCreationHash"
      FROM protected_beta_invite
     WHERE creation_key_hash = ${creationKeyHash}
  `;
  const row = rows[0];
  if (row === undefined) return;
  if (!bytesEqual(row.canonicalCreationHash, canonicalCreationHash)) {
    throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_CONFLICT");
  }
  throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_REPLAY_REQUIRES_TOKEN");
};

export const createProtectedBetaInviteControlService = (
  database: PrismaClient,
  rawPolicy: Readonly<{ cohortLimit: number; policyVersion: string }>,
): ProtectedBetaInviteControlService => {
  const policy = validatePolicy(rawPolicy);

  const createInvite: ProtectedBetaInviteControlService["createInvite"] = async (input) => {
    const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
    const ttlSeconds = parseTtlSeconds(input.ttlSeconds);
    await assertProtectedBetaInviteControlDatabasePrivileges(database);
    const [creationKeyHash, canonicalCreationHash] = await Promise.all([
      sha256(idempotencyKey),
      sha256(
        JSON.stringify({
          cohortLimit: policy.cohortLimit,
          policyVersion: policy.policyVersion,
          ttlSeconds,
        }),
      ),
    ]);
    await assertNoCreationReplay(database, creationKeyHash, canonicalCreationHash);

    for (let attempt = 0; attempt < maximumTokenAttempts; attempt += 1) {
      const material = newInviteToken();
      const tokenHash = await sha256(material.bytes);
      try {
        const rows = await database.$queryRaw<
          Array<{ expiresAt: Date; inviteId: string; seatNumber: number }>
        >`
          WITH cohort AS (
            INSERT INTO protected_beta_invite_cohort (
              policy_version, cohort_limit, issued_count, created_at
            ) VALUES (${policy.policyVersion}, ${policy.cohortLimit}, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (policy_version) DO UPDATE
              SET issued_count = protected_beta_invite_cohort.issued_count + 1
            WHERE protected_beta_invite_cohort.cohort_limit = ${policy.cohortLimit}
              AND protected_beta_invite_cohort.issued_count
                    < protected_beta_invite_cohort.cohort_limit
            RETURNING issued_count AS "seatNumber", CURRENT_TIMESTAMP AS "observedAt"
          )
          INSERT INTO protected_beta_invite (
            policy_version, seat_number, token_hash, token_hash_version, creation_key_hash,
            canonical_creation_hash, created_at, expires_at
          )
          SELECT ${policy.policyVersion}, cohort."seatNumber", ${tokenHash}, 1,
                 ${creationKeyHash}, ${canonicalCreationHash}, cohort."observedAt",
                 cohort."observedAt" + make_interval(secs => ${ttlSeconds})
            FROM cohort
          RETURNING id AS "inviteId", seat_number AS "seatNumber", expires_at AS "expiresAt"
        `;
        const row = rows[0];
        if (row === undefined) {
          throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_CAPACITY_REACHED");
        }
        return Object.freeze({
          expiresAt: row.expiresAt.toISOString(),
          inviteId: row.inviteId,
          seatNumber: row.seatNumber,
          token: material.token,
        });
      } catch (error) {
        if (error instanceof ProtectedBetaInviteError) throw error;
        if (isUniqueConflict(error)) {
          await assertNoCreationReplay(database, creationKeyHash, canonicalCreationHash);
          continue;
        }
        throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_UNAVAILABLE");
      }
    }
    throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_UNAVAILABLE");
  };

  const revokeInvite: ProtectedBetaInviteControlService["revokeInvite"] = async (input) => {
    const inviteId = parseInviteId(input.inviteId);
    const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
    await assertProtectedBetaInviteControlDatabasePrivileges(database);
    const [revocationKeyHash, canonicalRevocationHash] = await Promise.all([
      sha256(idempotencyKey),
      sha256(JSON.stringify({ inviteId, policyVersion: policy.policyVersion })),
    ]);
    try {
      return await database.$transaction(async (transaction) => {
        const keyRows = await transaction.$queryRaw<
          Array<{ canonicalRevocationHash: Uint8Array; inviteId: string }>
        >`
          SELECT id AS "inviteId", canonical_revocation_hash AS "canonicalRevocationHash"
            FROM protected_beta_invite
           WHERE revocation_key_hash = ${revocationKeyHash}
           FOR UPDATE
        `;
        const keyRow = keyRows[0];
        if (keyRow !== undefined) {
          if (
            keyRow.inviteId !== inviteId ||
            !bytesEqual(keyRow.canonicalRevocationHash, canonicalRevocationHash)
          ) {
            throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_CONFLICT");
          }
          return Object.freeze({ kind: "replayed" as const });
        }

        const rows = await transaction.$queryRaw<
          Array<{ anonymousSessionId: string | null; revokedAt: Date | null }>
        >`
          SELECT anonymous_session_id AS "anonymousSessionId", revoked_at AS "revokedAt"
            FROM protected_beta_invite
           WHERE id = ${inviteId}::uuid
             AND policy_version = ${policy.policyVersion}
           FOR UPDATE
        `;
        const row = rows[0];
        if (row === undefined) {
          throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_NOT_FOUND");
        }
        if (row.revokedAt !== null) {
          return Object.freeze({ kind: "already_revoked" as const });
        }
        await transaction.$executeRaw`
          UPDATE protected_beta_invite
             SET revoked_at = CURRENT_TIMESTAMP,
                 revocation_key_hash = ${revocationKeyHash},
                 canonical_revocation_hash = ${canonicalRevocationHash}
           WHERE id = ${inviteId}::uuid
        `;
        if (row.anonymousSessionId !== null) {
          await transaction.$executeRaw`
            UPDATE anonymous_session
               SET revoked_at = CURRENT_TIMESTAMP
             WHERE id = ${row.anonymousSessionId}::uuid
               AND revoked_at IS NULL
               AND expires_at > CURRENT_TIMESTAMP
          `;
        }
        return Object.freeze({ kind: "revoked" as const });
      });
    } catch (error) {
      if (error instanceof ProtectedBetaInviteError) throw error;
      throw new ProtectedBetaInviteError("PROTECTED_BETA_INVITE_UNAVAILABLE");
    }
  };

  return Object.freeze({ createInvite, revokeInvite });
};
