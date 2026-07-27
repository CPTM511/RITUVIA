import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const versionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

export const birthProfilePersistenceErrorCodes = Object.freeze([
  "BIRTH_PROFILE_INVALID",
  "BIRTH_PROFILE_NOT_FOUND",
  "BIRTH_PROFILE_CONFLICT",
  "BIRTH_PROFILE_LIMIT_REACHED",
  "BIRTH_PROFILE_UNAVAILABLE",
] as const);

export type BirthProfilePersistenceErrorCode = (typeof birthProfilePersistenceErrorCodes)[number];

export class BirthProfilePersistenceError extends Error {
  readonly code: BirthProfilePersistenceErrorCode;

  constructor(code: BirthProfilePersistenceErrorCode) {
    super("The birth profile operation is unavailable.");
    this.name = "BirthProfilePersistenceError";
    this.code = code;
  }
}

export type BirthProfileCiphertext = Readonly<{
  ciphertext: Uint8Array;
  keyVersion: string;
  nonce: Uint8Array;
  tag: Uint8Array;
}>;

export type PersistedBirthProfile = Readonly<{
  canonicalPayloadDigest: string;
  createdAt: string;
  deletedAt: string | null;
  digestKeyVersion: string;
  encryptedPayload: BirthProfileCiphertext;
  id: string;
  revision: number;
  schemaVersion: "birth-profile.v1";
  timeCertainty: "approximate" | "exact" | "unknown";
  updatedAt: string;
  userId: string;
}>;

export type PreparedBirthProfileWrite = Readonly<{
  canonicalPayloadDigest: string;
  canonicalRequestDigest: string;
  digestKeyVersion: string;
  encryptedPayload: BirthProfileCiphertext;
  idempotencyKeyDigest: string;
  timeCertainty: "approximate" | "exact" | "unknown";
}>;

export type BirthProfilePersistence = Readonly<{
  create(input: {
    prepare(context: { profileId: string; userId: string }): PreparedBirthProfileWrite;
    sessionToken: string;
  }): Promise<PersistedBirthProfile>;
  delete(input: {
    expectedRevision: number;
    profileId: string;
    prepare(context: { profileId: string; userId: string }): Readonly<{
      canonicalRequestDigest: string;
      idempotencyKeyDigest: string;
      tombstone: BirthProfileCiphertext;
    }>;
    sessionToken: string;
  }): Promise<PersistedBirthProfile>;
  list(input: { sessionToken: string }): Promise<readonly PersistedBirthProfile[]>;
  read(input: { profileId: string; sessionToken: string }): Promise<PersistedBirthProfile>;
  update(input: {
    expectedRevision: number;
    profileId: string;
    prepare(context: { profileId: string; userId: string }): PreparedBirthProfileWrite;
    sessionToken: string;
  }): Promise<PersistedBirthProfile>;
}>;

type ActiveSession = Readonly<{
  sessionId: string;
  userId: string;
}>;

type ProfileRow = Readonly<{
  canonicalPayloadDigest: Uint8Array;
  createdAt: Date;
  deletedAt: Date | null;
  digestKeyVersion: string;
  encryptionKeyVersion: string;
  id: string;
  payloadCiphertext: Uint8Array;
  payloadNonce: Uint8Array;
  payloadTag: Uint8Array;
  revision: number;
  schemaVersion: string;
  timeCertainty: string;
  updatedAt: Date;
  userId: string;
}>;

type OperationRow = Readonly<{
  action: string;
  canonicalRequestHash: Uint8Array;
  profileId: string;
  resultRevision: number;
}>;

const invalid = (): never => {
  throw new BirthProfilePersistenceError("BIRTH_PROFILE_INVALID");
};

const parseUuid = (value: string): string => (uuidV4Pattern.test(value) ? value : invalid());

const sessionTokenHash = async (value: string): Promise<Uint8Array> => {
  if (!opaqueTokenPattern.test(value)) invalid();
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== value) invalid();
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)));
};

const digestBytes = (value: string): Uint8Array => {
  if (!digestPattern.test(value)) invalid();
  return Uint8Array.from(Buffer.from(value.slice("sha256:".length), "hex"));
};

const digestString = (value: Uint8Array): string => {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) invalid();
  return `sha256:${Buffer.from(value).toString("hex")}`;
};

const parseRevision = (value: number): number =>
  Number.isSafeInteger(value) && value >= 1 ? value : invalid();

const parseCiphertext = (value: BirthProfileCiphertext): BirthProfileCiphertext => {
  if (
    typeof value !== "object" ||
    value === null ||
    !(value.ciphertext instanceof Uint8Array) ||
    value.ciphertext.byteLength < 1 ||
    value.ciphertext.byteLength > 12_000 ||
    !(value.nonce instanceof Uint8Array) ||
    value.nonce.byteLength !== 12 ||
    !(value.tag instanceof Uint8Array) ||
    value.tag.byteLength !== 16 ||
    !versionPattern.test(value.keyVersion)
  ) {
    invalid();
  }
  return Object.freeze({
    ciphertext: Uint8Array.from(value.ciphertext),
    keyVersion: value.keyVersion,
    nonce: Uint8Array.from(value.nonce),
    tag: Uint8Array.from(value.tag),
  });
};

const parseWrite = (value: PreparedBirthProfileWrite) => {
  if (
    typeof value !== "object" ||
    value === null ||
    !["approximate", "exact", "unknown"].includes(value.timeCertainty) ||
    !versionPattern.test(value.digestKeyVersion)
  ) {
    invalid();
  }
  return Object.freeze({
    canonicalPayloadDigest: digestBytes(value.canonicalPayloadDigest),
    canonicalRequestDigest: digestBytes(value.canonicalRequestDigest),
    digestKeyVersion: value.digestKeyVersion,
    encryptedPayload: parseCiphertext(value.encryptedPayload),
    idempotencyKeyDigest: digestBytes(value.idempotencyKeyDigest),
    timeCertainty: value.timeCertainty,
  });
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left.at(index)! ^ right.at(index)!;
  }
  return difference === 0;
};

const result = (row: ProfileRow): PersistedBirthProfile => {
  if (
    row.schemaVersion !== "birth-profile.v1" ||
    !["approximate", "exact", "unknown"].includes(row.timeCertainty)
  ) {
    throw new BirthProfilePersistenceError("BIRTH_PROFILE_UNAVAILABLE");
  }
  return Object.freeze({
    canonicalPayloadDigest: digestString(row.canonicalPayloadDigest),
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    digestKeyVersion: row.digestKeyVersion,
    encryptedPayload: Object.freeze({
      ciphertext: Uint8Array.from(row.payloadCiphertext),
      keyVersion: row.encryptionKeyVersion,
      nonce: Uint8Array.from(row.payloadNonce),
      tag: Uint8Array.from(row.payloadTag),
    }),
    id: row.id,
    revision: row.revision,
    schemaVersion: "birth-profile.v1",
    timeCertainty: row.timeCertainty as PersistedBirthProfile["timeCertainty"],
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
  });
};

const profileSelection = Prisma.sql`
  profile.id, profile.user_id AS "userId", profile.time_certainty AS "timeCertainty",
  profile.schema_version AS "schemaVersion",
  profile.payload_ciphertext AS "payloadCiphertext",
  profile.payload_nonce AS "payloadNonce", profile.payload_tag AS "payloadTag",
  profile.encryption_key_version AS "encryptionKeyVersion",
  profile.digest_key_version AS "digestKeyVersion",
  profile.canonical_payload_digest AS "canonicalPayloadDigest",
  profile.revision, profile.created_at AS "createdAt",
  profile.updated_at AS "updatedAt", profile.deleted_at AS "deletedAt"
`;

const readProfile = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  profileId: string,
  includeDeleted: boolean,
): Promise<ProfileRow | null> => {
  const rows = await transaction.$queryRaw<ProfileRow[]>`
    SELECT ${profileSelection}
      FROM birth_profile AS profile
     WHERE profile.id = ${profileId}::uuid
       AND profile.user_id = ${userId}::uuid
       AND (${includeDeleted} OR profile.deleted_at IS NULL)
  `;
  if (rows.length > 1) throw new BirthProfilePersistenceError("BIRTH_PROFILE_UNAVAILABLE");
  return rows[0] ?? null;
};

const requireActiveSession = async (
  transaction: Prisma.TransactionClient,
  tokenHash: Uint8Array,
): Promise<ActiveSession> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    UPDATE account_session AS session
       SET last_seen_at = LEAST(CURRENT_TIMESTAMP, session.expires_at)
      FROM app_user AS account
     WHERE session.token_hash = ${tokenHash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.id = session.user_id
       AND account.status = 'active'
     RETURNING session.id AS "sessionId", session.user_id AS "userId"
  `;
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new BirthProfilePersistenceError("BIRTH_PROFILE_NOT_FOUND");
  }
  return rows[0];
};

const readOperation = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  idempotencyKeyHash: Uint8Array,
): Promise<OperationRow | null> => {
  const rows = await transaction.$queryRaw<OperationRow[]>`
    SELECT action, birth_profile_id AS "profileId",
           canonical_request_hash AS "canonicalRequestHash",
           result_revision AS "resultRevision"
      FROM birth_profile_operation
     WHERE user_id = ${userId}::uuid
       AND idempotency_key_hash = ${idempotencyKeyHash}
  `;
  if (rows.length > 1) throw new BirthProfilePersistenceError("BIRTH_PROFILE_UNAVAILABLE");
  return rows[0] ?? null;
};

const replay = async (
  transaction: Prisma.TransactionClient,
  input: {
    action: "create" | "delete" | "update";
    canonicalRequestHash: Uint8Array;
    idempotencyKeyHash: Uint8Array;
    profileId: string | null;
    userId: string;
  },
): Promise<PersistedBirthProfile | null> => {
  const operation = await readOperation(transaction, input.userId, input.idempotencyKeyHash);
  if (operation === null) return null;
  if (
    operation.action !== input.action ||
    (input.profileId !== null && operation.profileId !== input.profileId) ||
    !bytesEqual(operation.canonicalRequestHash, input.canonicalRequestHash)
  ) {
    throw new BirthProfilePersistenceError("BIRTH_PROFILE_CONFLICT");
  }
  const profile = await readProfile(transaction, input.userId, operation.profileId, true);
  if (profile === null || profile.revision !== operation.resultRevision) {
    throw new BirthProfilePersistenceError("BIRTH_PROFILE_CONFLICT");
  }
  return result(profile);
};

const insertOperation = async (
  transaction: Prisma.TransactionClient,
  input: {
    action: "create" | "delete" | "update";
    canonicalRequestHash: Uint8Array;
    idempotencyKeyHash: Uint8Array;
    profileId: string;
    resultRevision: number;
    userId: string;
  },
): Promise<void> => {
  const changed = await transaction.$executeRaw`
    INSERT INTO birth_profile_operation (
      user_id, birth_profile_id, action, idempotency_key_hash,
      canonical_request_hash, result_revision, created_at
    ) VALUES (
      ${input.userId}::uuid, ${input.profileId}::uuid, ${input.action},
      ${input.idempotencyKeyHash}, ${input.canonicalRequestHash},
      ${input.resultRevision}, CURRENT_TIMESTAMP
    )
  `;
  if (changed !== 1) throw new BirthProfilePersistenceError("BIRTH_PROFILE_UNAVAILABLE");
};

export const createBirthProfilePersistence = (database: PrismaClient): BirthProfilePersistence => {
  const create: BirthProfilePersistence["create"] = async (input) => {
    const tokenHash = await sessionTokenHash(input.sessionToken);
    return database.$transaction(
      async (transaction) => {
        const active = await requireActiveSession(transaction, tokenHash);
        const userId = active.userId;
        const profileId = globalThis.crypto.randomUUID();
        const write = parseWrite(input.prepare({ profileId, userId }));
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${`birth-profile:${userId}`}, 92092))
        `;
        const existing = await replay(transaction, {
          action: "create",
          canonicalRequestHash: write.canonicalRequestDigest,
          idempotencyKeyHash: write.idempotencyKeyDigest,
          profileId: null,
          userId,
        });
        if (existing !== null) return existing;
        const rows = await transaction.$queryRaw<ProfileRow[]>`
          INSERT INTO birth_profile AS profile (
            id, user_id, time_certainty, schema_version,
            payload_ciphertext, payload_nonce, payload_tag,
            encryption_key_version, digest_key_version, canonical_payload_digest,
            revision, created_at, updated_at
          ) VALUES (
            ${profileId}::uuid, ${userId}::uuid, ${write.timeCertainty}, 'birth-profile.v1',
            ${write.encryptedPayload.ciphertext}, ${write.encryptedPayload.nonce},
            ${write.encryptedPayload.tag}, ${write.encryptedPayload.keyVersion},
            ${write.digestKeyVersion}, ${write.canonicalPayloadDigest},
            1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING ${profileSelection}
        `;
        const profile = rows[0];
        if (rows.length !== 1 || profile === undefined) {
          throw new BirthProfilePersistenceError("BIRTH_PROFILE_UNAVAILABLE");
        }
        await insertOperation(transaction, {
          action: "create",
          canonicalRequestHash: write.canonicalRequestDigest,
          idempotencyKeyHash: write.idempotencyKeyDigest,
          profileId,
          resultRevision: profile.revision,
          userId,
        });
        return result(profile);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  };

  const update: BirthProfilePersistence["update"] = async (input) => {
    const profileId = parseUuid(input.profileId);
    const expectedRevision = parseRevision(input.expectedRevision);
    const tokenHash = await sessionTokenHash(input.sessionToken);
    return database.$transaction(
      async (transaction) => {
        const active = await requireActiveSession(transaction, tokenHash);
        const userId = active.userId;
        const write = parseWrite(input.prepare({ profileId, userId }));
        const existing = await replay(transaction, {
          action: "update",
          canonicalRequestHash: write.canonicalRequestDigest,
          idempotencyKeyHash: write.idempotencyKeyDigest,
          profileId,
          userId,
        });
        if (existing !== null) return existing;
        const rows = await transaction.$queryRaw<ProfileRow[]>`
          UPDATE birth_profile AS profile
             SET time_certainty = ${write.timeCertainty},
                 payload_ciphertext = ${write.encryptedPayload.ciphertext},
                 payload_nonce = ${write.encryptedPayload.nonce},
                 payload_tag = ${write.encryptedPayload.tag},
                 encryption_key_version = ${write.encryptedPayload.keyVersion},
                 digest_key_version = ${write.digestKeyVersion},
                 canonical_payload_digest = ${write.canonicalPayloadDigest},
                 revision = profile.revision + 1,
                 updated_at = CURRENT_TIMESTAMP
           WHERE profile.id = ${profileId}::uuid
             AND profile.user_id = ${userId}::uuid
             AND profile.deleted_at IS NULL
             AND profile.revision = ${expectedRevision}
          RETURNING ${profileSelection}
        `;
        const profile = rows[0];
        if (rows.length !== 1 || profile === undefined) {
          const current = await readProfile(transaction, userId, profileId, false);
          throw new BirthProfilePersistenceError(
            current === null ? "BIRTH_PROFILE_NOT_FOUND" : "BIRTH_PROFILE_CONFLICT",
          );
        }
        await insertOperation(transaction, {
          action: "update",
          canonicalRequestHash: write.canonicalRequestDigest,
          idempotencyKeyHash: write.idempotencyKeyDigest,
          profileId,
          resultRevision: profile.revision,
          userId,
        });
        return result(profile);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  };

  const deleteProfile: BirthProfilePersistence["delete"] = async (input) => {
    const profileId = parseUuid(input.profileId);
    const expectedRevision = parseRevision(input.expectedRevision);
    const tokenHash = await sessionTokenHash(input.sessionToken);
    return database.$transaction(
      async (transaction) => {
        const active = await requireActiveSession(transaction, tokenHash);
        const userId = active.userId;
        const prepared = input.prepare({ profileId, userId });
        const canonicalRequestHash = digestBytes(prepared.canonicalRequestDigest);
        const idempotencyKeyHash = digestBytes(prepared.idempotencyKeyDigest);
        const tombstone = parseCiphertext(prepared.tombstone);
        const existing = await replay(transaction, {
          action: "delete",
          canonicalRequestHash,
          idempotencyKeyHash,
          profileId,
          userId,
        });
        if (existing !== null) return existing;
        const rows = await transaction.$queryRaw<ProfileRow[]>`
          UPDATE birth_profile AS profile
             SET payload_ciphertext = ${tombstone.ciphertext},
                 payload_nonce = ${tombstone.nonce},
                 payload_tag = ${tombstone.tag},
                 encryption_key_version = ${tombstone.keyVersion},
                 canonical_payload_digest = ${canonicalRequestHash},
                 revision = profile.revision + 1,
                 updated_at = CURRENT_TIMESTAMP,
                 deleted_at = CURRENT_TIMESTAMP
           WHERE profile.id = ${profileId}::uuid
             AND profile.user_id = ${userId}::uuid
             AND profile.deleted_at IS NULL
             AND profile.revision = ${expectedRevision}
          RETURNING ${profileSelection}
        `;
        const profile = rows[0];
        if (rows.length !== 1 || profile === undefined) {
          const current = await readProfile(transaction, userId, profileId, false);
          throw new BirthProfilePersistenceError(
            current === null ? "BIRTH_PROFILE_NOT_FOUND" : "BIRTH_PROFILE_CONFLICT",
          );
        }
        await insertOperation(transaction, {
          action: "delete",
          canonicalRequestHash,
          idempotencyKeyHash,
          profileId,
          resultRevision: profile.revision,
          userId,
        });
        return result(profile);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  };

  return Object.freeze({
    create,
    delete: deleteProfile,
    async list(input) {
      const tokenHash = await sessionTokenHash(input.sessionToken);
      return database.$transaction(async (transaction) => {
        const active = await requireActiveSession(transaction, tokenHash);
        const rows = await transaction.$queryRaw<ProfileRow[]>`
          SELECT ${profileSelection}
            FROM birth_profile AS profile
           WHERE profile.user_id = ${active.userId}::uuid
             AND profile.deleted_at IS NULL
           ORDER BY profile.created_at DESC, profile.id DESC
        `;
        return Object.freeze(rows.map(result));
      });
    },
    async read(input) {
      const profileId = parseUuid(input.profileId);
      const tokenHash = await sessionTokenHash(input.sessionToken);
      const profile = await database.$transaction(async (transaction) => {
        const active = await requireActiveSession(transaction, tokenHash);
        return readProfile(transaction, active.userId, profileId, false);
      });
      if (profile === null) throw new BirthProfilePersistenceError("BIRTH_PROFILE_NOT_FOUND");
      return result(profile);
    },
    update,
  });
};
