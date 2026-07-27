import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const versionPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const sourceCommitPattern = /^[0-9a-f]{40,64}$/u;
const unsafeTextPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u;
const maximumFactsCiphertextBytes = 262_144;
const maximumEngineProvenanceBytes = 4_096;
const defaultListLimit = 50;
const maximumListLimit = 100;

export const astrologyEngineBuildProvenanceVersion =
  "astrology-engine-build-provenance.v1" as const;

export const astrologyCalculationStatuses = Object.freeze([
  "complete",
  "limited_approximate_time",
  "unavailable_engine",
  "unavailable_unknown_time",
  "unavailable_untrusted_engine_output",
] as const);

export type AstrologyCalculationStatus = (typeof astrologyCalculationStatuses)[number];
export type AstrologyCalculationTimeCertainty = "approximate" | "exact" | "unknown";

export const astrologyCalculationPersistenceErrorCodes = Object.freeze([
  "ASTROLOGY_CALCULATION_INVALID",
  "ASTROLOGY_CALCULATION_SESSION_UNAVAILABLE",
  "ASTROLOGY_CALCULATION_PROFILE_NOT_FOUND",
  "ASTROLOGY_CALCULATION_PROFILE_CONFLICT",
  "ASTROLOGY_CALCULATION_NOT_FOUND",
  "ASTROLOGY_CALCULATION_REPLAY_CONFLICT",
  "ASTROLOGY_CALCULATION_UNAVAILABLE",
] as const);

export type AstrologyCalculationPersistenceErrorCode =
  (typeof astrologyCalculationPersistenceErrorCodes)[number];

export class AstrologyCalculationPersistenceError extends Error {
  readonly code: AstrologyCalculationPersistenceErrorCode;

  constructor(code: AstrologyCalculationPersistenceErrorCode) {
    super("The astrology calculation operation is unavailable.");
    this.name = "AstrologyCalculationPersistenceError";
    this.code = code;
  }
}

export type AstrologyFactsCiphertext = Readonly<{
  ciphertext: Uint8Array;
  keyVersion: string;
  nonce: Uint8Array;
  tag: Uint8Array;
}>;

export type AstrologyEngineBuildProvenanceV1 = Readonly<{
  abiVersion: string;
  adapterVersion: string;
  binarySha256: string;
  compilerFlagsSha256: string;
  compilerId: string;
  dataInventorySha256: string;
  libraryVersion: string;
  nativeSbomSha256: string;
  sourceCommit: string;
  sourceInventorySha256: string;
  sourceSnapshotTag: string;
}>;

export type PreparedAstrologyCalculationCreate = Readonly<{
  aspectPolicyVersion: string;
  canonicalRequestDigest: string;
  digestKeyVersion: string;
  encryptedFacts: AstrologyFactsCiphertext;
  engineBuildProvenance: AstrologyEngineBuildProvenanceV1;
  engineProvenanceVersion: typeof astrologyEngineBuildProvenanceVersion;
  idempotencyKeyDigest: string;
  inputSnapshotDigest: string;
  keyedFactsDigest: string;
  methodCatalogDigest: string;
  methodVersion: string;
  status: AstrologyCalculationStatus;
  timeCertainty: AstrologyCalculationTimeCertainty;
  timezoneProvenanceDigest: string;
}>;

export type PersistedAstrologyCalculation = Readonly<{
  aspectPolicyVersion: string;
  birthProfileId: string;
  birthProfilePayloadDigest: string;
  birthProfileRevision: number;
  createdAt: string;
  digestKeyVersion: string;
  encryptedFacts: AstrologyFactsCiphertext;
  engineBuildProvenance: AstrologyEngineBuildProvenanceV1;
  engineProvenanceVersion: typeof astrologyEngineBuildProvenanceVersion;
  id: string;
  inputSnapshotDigest: string;
  keyedFactsDigest: string;
  methodCatalogDigest: string;
  methodVersion: string;
  status: AstrologyCalculationStatus;
  timeCertainty: AstrologyCalculationTimeCertainty;
  timezoneProvenanceDigest: string;
  userId: string;
}>;

export type AstrologyCalculationPersistence = Readonly<{
  create(input: {
    birthProfileId: string;
    calculationId: string;
    expectedBirthProfilePayloadDigest: string;
    expectedBirthProfileRevision: number;
    prepare(context: {
      birthProfileId: string;
      birthProfilePayloadDigest: string;
      birthProfileRevision: number;
      calculationId: string;
      userId: string;
    }): PreparedAstrologyCalculationCreate;
    sessionToken: string;
  }): Promise<PersistedAstrologyCalculation>;
  list(input: {
    limit?: number;
    sessionToken: string;
  }): Promise<readonly PersistedAstrologyCalculation[]>;
  read(input: {
    calculationId: string;
    sessionToken: string;
  }): Promise<PersistedAstrologyCalculation>;
}>;

type ActiveSession = Readonly<{
  sessionId: string;
  userId: string;
}>;

type BirthProfileBindingRow = Readonly<{
  canonicalPayloadDigest: Uint8Array;
  revision: number;
  timeCertainty: string;
}>;

type CalculationRow = Readonly<{
  aspectPolicyVersion: string;
  birthProfileId: string;
  birthProfilePayloadDigest: Uint8Array;
  birthProfileRevision: number;
  createdAt: Date;
  digestKeyVersion: string;
  encryptionKeyVersion: string;
  engineBuildProvenance: unknown;
  engineProvenanceVersion: string;
  factsCiphertext: Uint8Array;
  factsNonce: Uint8Array;
  factsTag: Uint8Array;
  id: string;
  inputSnapshotDigest: Uint8Array;
  keyedFactsDigest: Uint8Array;
  methodCatalogDigest: Uint8Array;
  methodVersion: string;
  privacyDeletedAt: Date | null;
  status: string;
  timeCertainty: string;
  timezoneProvenanceDigest: Uint8Array;
  userId: string;
}>;

type OperationRow = Readonly<
  CalculationRow & {
    action: string;
    canonicalRequestDigest: Uint8Array;
  }
>;

type PrivilegeAttestationRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canInsertCalculation: boolean;
  canInsertOperation: boolean;
  canMutateCalculation: boolean;
  canMutateOperation: boolean;
  canReadAccount: boolean;
  canReadCalculation: boolean;
  canReadOperation: boolean;
  canReadProfile: boolean;
  canReadSession: boolean;
  canTouchSession: boolean;
  databaseOwner: string;
  exactCalculationInsertColumns: boolean;
  exactOperationInsertColumns: boolean;
  privilegedRole: boolean;
  reachableOwnerOrPrivilegedRole: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
}>;

const invalid = (): never => {
  throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_INVALID");
};

const unavailable = (): never => {
  throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
};

const parseUuid = (value: string): string => (uuidV4Pattern.test(value) ? value : invalid());

const parseRevision = (value: number): number =>
  Number.isSafeInteger(value) && value >= 1 ? value : invalid();

const parseLimit = (value: number | undefined): number => {
  if (value === undefined) return defaultListLimit;
  return Number.isSafeInteger(value) && value >= 1 && value <= maximumListLimit ? value : invalid();
};

const parseVersion = (value: unknown): string =>
  typeof value === "string" && value.length <= 100 && versionPattern.test(value)
    ? value
    : invalid();

const parseSafeText = (value: unknown, maximumLength: number): string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    unsafeTextPattern.test(value)
  ) {
    invalid();
  }
  return value as string;
};

const digestBytes = (value: unknown): Uint8Array => {
  if (typeof value !== "string" || !digestPattern.test(value)) invalid();
  const parsed = value as string;
  return Uint8Array.from(Buffer.from(parsed.slice("sha256:".length), "hex"));
};

const digestString = (value: Uint8Array): string => {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) unavailable();
  return `sha256:${Buffer.from(value).toString("hex")}`;
};

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left.at(index)! ^ right.at(index)!;
  }
  return difference === 0;
};

const sessionTokenDigest = async (value: string): Promise<Uint8Array> => {
  if (!opaqueTokenPattern.test(value)) {
    throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_SESSION_UNAVAILABLE");
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== value) {
    throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_SESSION_UNAVAILABLE");
  }
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)));
};

const parseCiphertext = (value: AstrologyFactsCiphertext): AstrologyFactsCiphertext => {
  if (
    typeof value !== "object" ||
    value === null ||
    !(value.ciphertext instanceof Uint8Array) ||
    value.ciphertext.byteLength < 1 ||
    value.ciphertext.byteLength > maximumFactsCiphertextBytes ||
    !(value.nonce instanceof Uint8Array) ||
    value.nonce.byteLength !== 12 ||
    !(value.tag instanceof Uint8Array) ||
    value.tag.byteLength !== 16
  ) {
    invalid();
  }
  return Object.freeze({
    ciphertext: Uint8Array.from(value.ciphertext),
    keyVersion: parseVersion(value.keyVersion),
    nonce: Uint8Array.from(value.nonce),
    tag: Uint8Array.from(value.tag),
  });
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...expected].sort().join("\u0000");

const parseEngineBuildProvenance = (value: unknown): AstrologyEngineBuildProvenanceV1 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  const candidate = value as Record<string, unknown>;
  if (
    !exactKeys(candidate, [
      "abiVersion",
      "adapterVersion",
      "binarySha256",
      "compilerFlagsSha256",
      "compilerId",
      "dataInventorySha256",
      "libraryVersion",
      "nativeSbomSha256",
      "sourceCommit",
      "sourceInventorySha256",
      "sourceSnapshotTag",
    ])
  ) {
    invalid();
  }
  const sourceCommit = candidate.sourceCommit;
  if (typeof sourceCommit !== "string" || !sourceCommitPattern.test(sourceCommit)) invalid();
  const parsed = Object.freeze({
    abiVersion: parseSafeText(candidate.abiVersion, 100),
    adapterVersion: parseSafeText(candidate.adapterVersion, 100),
    binarySha256: digestString(digestBytes(candidate.binarySha256)),
    compilerFlagsSha256: digestString(digestBytes(candidate.compilerFlagsSha256)),
    compilerId: parseSafeText(candidate.compilerId, 160),
    dataInventorySha256: digestString(digestBytes(candidate.dataInventorySha256)),
    libraryVersion: parseSafeText(candidate.libraryVersion, 100),
    nativeSbomSha256: digestString(digestBytes(candidate.nativeSbomSha256)),
    sourceCommit: sourceCommit as string,
    sourceInventorySha256: digestString(digestBytes(candidate.sourceInventorySha256)),
    sourceSnapshotTag: parseSafeText(candidate.sourceSnapshotTag, 100),
  });
  if (Buffer.byteLength(JSON.stringify(parsed), "utf8") > maximumEngineProvenanceBytes) invalid();
  return parsed;
};

const parseStatus = (
  status: unknown,
  timeCertainty: unknown,
): Readonly<{
  status: AstrologyCalculationStatus;
  timeCertainty: AstrologyCalculationTimeCertainty;
}> => {
  if (
    !astrologyCalculationStatuses.includes(status as AstrologyCalculationStatus) ||
    !["approximate", "exact", "unknown"].includes(timeCertainty as string) ||
    (status === "complete" && timeCertainty !== "exact") ||
    (status === "limited_approximate_time" && timeCertainty !== "approximate") ||
    (status === "unavailable_unknown_time" && timeCertainty !== "unknown") ||
    (["unavailable_engine", "unavailable_untrusted_engine_output"].includes(status as string) &&
      !["approximate", "exact"].includes(timeCertainty as string))
  ) {
    invalid();
  }
  return Object.freeze({
    status: status as AstrologyCalculationStatus,
    timeCertainty: timeCertainty as AstrologyCalculationTimeCertainty,
  });
};

const parsePrepared = (value: PreparedAstrologyCalculationCreate) => {
  if (
    typeof value !== "object" ||
    value === null ||
    value.engineProvenanceVersion !== astrologyEngineBuildProvenanceVersion
  ) {
    invalid();
  }
  const status = parseStatus(value.status, value.timeCertainty);
  return Object.freeze({
    aspectPolicyVersion: parseVersion(value.aspectPolicyVersion),
    canonicalRequestDigest: digestBytes(value.canonicalRequestDigest),
    digestKeyVersion: parseVersion(value.digestKeyVersion),
    encryptedFacts: parseCiphertext(value.encryptedFacts),
    engineBuildProvenance: parseEngineBuildProvenance(value.engineBuildProvenance),
    idempotencyKeyDigest: digestBytes(value.idempotencyKeyDigest),
    inputSnapshotDigest: digestBytes(value.inputSnapshotDigest),
    keyedFactsDigest: digestBytes(value.keyedFactsDigest),
    methodCatalogDigest: digestBytes(value.methodCatalogDigest),
    methodVersion: parseVersion(value.methodVersion),
    ...status,
    timezoneProvenanceDigest: digestBytes(value.timezoneProvenanceDigest),
  });
};

const calculationSelection = Prisma.sql`
  calculation.id, calculation.user_id AS "userId",
  calculation.birth_profile_id AS "birthProfileId",
  calculation.birth_profile_revision AS "birthProfileRevision",
  calculation.birth_profile_payload_digest AS "birthProfilePayloadDigest",
  calculation.status, calculation.time_certainty AS "timeCertainty",
  calculation.method_version AS "methodVersion",
  calculation.aspect_policy_version AS "aspectPolicyVersion",
  calculation.method_catalog_digest AS "methodCatalogDigest",
  calculation.input_snapshot_digest AS "inputSnapshotDigest",
  calculation.timezone_provenance_digest AS "timezoneProvenanceDigest",
  calculation.engine_provenance_version AS "engineProvenanceVersion",
  calculation.engine_build_provenance AS "engineBuildProvenance",
  calculation.facts_ciphertext AS "factsCiphertext",
  calculation.facts_nonce AS "factsNonce", calculation.facts_tag AS "factsTag",
  calculation.encryption_key_version AS "encryptionKeyVersion",
  calculation.digest_key_version AS "digestKeyVersion",
  calculation.keyed_facts_digest AS "keyedFactsDigest",
  calculation.created_at AS "createdAt",
  calculation.privacy_deleted_at AS "privacyDeletedAt"
`;

const result = (row: CalculationRow): PersistedAstrologyCalculation => {
  try {
    if (
      row.engineProvenanceVersion !== astrologyEngineBuildProvenanceVersion ||
      row.privacyDeletedAt !== null ||
      !uuidV4Pattern.test(row.id) ||
      !uuidV4Pattern.test(row.userId) ||
      !uuidV4Pattern.test(row.birthProfileId) ||
      !(row.createdAt instanceof Date) ||
      Number.isNaN(row.createdAt.getTime())
    ) {
      unavailable();
    }
    const status = parseStatus(row.status, row.timeCertainty);
    return Object.freeze({
      aspectPolicyVersion: parseVersion(row.aspectPolicyVersion),
      birthProfileId: row.birthProfileId,
      birthProfilePayloadDigest: digestString(row.birthProfilePayloadDigest),
      birthProfileRevision: parseRevision(row.birthProfileRevision),
      createdAt: row.createdAt.toISOString(),
      digestKeyVersion: parseVersion(row.digestKeyVersion),
      encryptedFacts: parseCiphertext({
        ciphertext: row.factsCiphertext,
        keyVersion: row.encryptionKeyVersion,
        nonce: row.factsNonce,
        tag: row.factsTag,
      }),
      engineBuildProvenance: parseEngineBuildProvenance(row.engineBuildProvenance),
      engineProvenanceVersion: astrologyEngineBuildProvenanceVersion,
      id: row.id,
      inputSnapshotDigest: digestString(row.inputSnapshotDigest),
      keyedFactsDigest: digestString(row.keyedFactsDigest),
      methodCatalogDigest: digestString(row.methodCatalogDigest),
      methodVersion: parseVersion(row.methodVersion),
      ...status,
      timezoneProvenanceDigest: digestString(row.timezoneProvenanceDigest),
      userId: row.userId,
    });
  } catch {
    return unavailable();
  }
};

const requireActiveSession = async (
  transaction: Prisma.TransactionClient,
  tokenDigest: Uint8Array,
): Promise<ActiveSession> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    UPDATE account_session AS session
       SET last_seen_at = LEAST(CURRENT_TIMESTAMP, session.expires_at)
      FROM app_user AS account
     WHERE session.token_hash = ${tokenDigest}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND account.id = session.user_id
       AND account.status = 'active'
     RETURNING session.id AS "sessionId", session.user_id AS "userId"
  `;
  if (rows.length !== 1 || rows[0] === undefined) {
    throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_SESSION_UNAVAILABLE");
  }
  return rows[0];
};

const readCalculation = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  calculationId: string,
): Promise<CalculationRow | null> => {
  const rows = await transaction.$queryRaw<CalculationRow[]>`
    SELECT ${calculationSelection}
      FROM astrology_calculation AS calculation
     WHERE calculation.id = ${calculationId}::uuid
       AND calculation.user_id = ${userId}::uuid
       AND calculation.privacy_deleted_at IS NULL
  `;
  if (rows.length > 1) unavailable();
  return rows[0] ?? null;
};

const readReplay = async (
  transaction: Prisma.TransactionClient,
  userId: string,
  idempotencyKeyDigest: Uint8Array,
): Promise<OperationRow | null> => {
  const rows = await transaction.$queryRaw<OperationRow[]>`
    SELECT operation.action,
           operation.canonical_request_digest AS "canonicalRequestDigest",
           ${calculationSelection}
      FROM astrology_calculation_operation AS operation
      JOIN astrology_calculation AS calculation
        ON calculation.id = operation.astrology_calculation_id
       AND calculation.user_id = operation.user_id
     WHERE operation.user_id = ${userId}::uuid
       AND operation.idempotency_key_digest = ${idempotencyKeyDigest}
  `;
  if (rows.length > 1) unavailable();
  return rows[0] ?? null;
};

const readActiveProfileBinding = async (
  transaction: Prisma.TransactionClient,
  input: {
    birthProfileId: string;
    expectedDigest: Uint8Array;
    expectedRevision: number;
    expectedTimeCertainty: AstrologyCalculationTimeCertainty;
    userId: string;
  },
): Promise<BirthProfileBindingRow> => {
  const rows = await transaction.$queryRaw<BirthProfileBindingRow[]>`
    SELECT profile.revision,
           profile.canonical_payload_digest AS "canonicalPayloadDigest",
           profile.time_certainty AS "timeCertainty"
      FROM birth_profile AS profile
     WHERE profile.id = ${input.birthProfileId}::uuid
       AND profile.user_id = ${input.userId}::uuid
       AND profile.deleted_at IS NULL
     FOR SHARE
  `;
  const profile = rows[0];
  if (rows.length !== 1 || profile === undefined) {
    throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_PROFILE_NOT_FOUND");
  }
  if (
    profile.revision !== input.expectedRevision ||
    !bytesEqual(profile.canonicalPayloadDigest, input.expectedDigest) ||
    profile.timeCertainty !== input.expectedTimeCertainty
  ) {
    throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_PROFILE_CONFLICT");
  }
  return profile;
};

export const assertAstrologyCalculationRuntimeDatabasePrivileges = async (
  database: Pick<PrismaClient, "$queryRaw">,
): Promise<void> => {
  const rows = await database.$queryRaw<PrivilegeAttestationRow[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             ARRAY(
               SELECT relowner
                 FROM pg_class
                WHERE oid = ANY(ARRAY[
                  'public.app_user'::regclass,
                  'public.account_session'::regclass,
                  'public.birth_profile'::regclass,
                  'public.astrology_calculation'::regclass,
                  'public.astrology_calculation_operation'::regclass
                ])
             ) AS table_owner_oids
    ), reachable_roles AS (
      SELECT role.*
        FROM pg_roles AS role
       WHERE role.rolname = current_user
          OR pg_has_role(current_user, role.oid, 'MEMBER')
    )
    SELECT current_user AS "roleName",
           session_user AS "sessionRoleName",
           pg_get_userbyid(owners.database_owner_oid) AS "databaseOwner",
           pg_get_userbyid(owners.schema_owner_oid) AS "schemaOwner",
           has_database_privilege(current_user, current_database(), 'CREATE')
             AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           has_table_privilege(current_user, 'public.app_user', 'SELECT') AS "canReadAccount",
           has_table_privilege(current_user, 'public.account_session', 'SELECT')
             AS "canReadSession",
           has_column_privilege(
             current_user,
             'public.account_session',
             'last_seen_at',
             'UPDATE'
           ) AS "canTouchSession",
           has_table_privilege(current_user, 'public.birth_profile', 'SELECT')
             AS "canReadProfile",
           has_table_privilege(current_user, 'public.astrology_calculation', 'SELECT')
             AS "canReadCalculation",
           has_any_column_privilege(current_user, 'public.astrology_calculation', 'INSERT')
             AS "canInsertCalculation",
           NOT EXISTS (
             SELECT 1
               FROM pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.astrology_calculation'::regclass
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped
                AND has_column_privilege(
                  current_user,
                  attribute.attrelid,
                  attribute.attname,
                  'INSERT'
                ) IS DISTINCT FROM (
                  attribute.attname = ANY(ARRAY[
                    'id',
                    'user_id',
                    'birth_profile_id',
                    'birth_profile_revision',
                    'birth_profile_payload_digest',
                    'status',
                    'time_certainty',
                    'method_version',
                    'aspect_policy_version',
                    'method_catalog_digest',
                    'input_snapshot_digest',
                    'timezone_provenance_digest',
                    'engine_provenance_version',
                    'engine_build_provenance',
                    'facts_ciphertext',
                    'facts_nonce',
                    'facts_tag',
                    'encryption_key_version',
                    'digest_key_version',
                    'keyed_facts_digest',
                    'created_at'
                  ])
                )
           ) AS "exactCalculationInsertColumns",
           (
             has_table_privilege(
               current_user,
               'public.astrology_calculation',
               'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
             )
             OR has_any_column_privilege(
               current_user,
               'public.astrology_calculation',
               'UPDATE'
             )
           ) AS "canMutateCalculation",
           has_table_privilege(
             current_user,
             'public.astrology_calculation_operation',
             'SELECT'
           ) AS "canReadOperation",
           has_any_column_privilege(
             current_user,
             'public.astrology_calculation_operation',
             'INSERT'
           ) AS "canInsertOperation",
           NOT EXISTS (
             SELECT 1
               FROM pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.astrology_calculation_operation'::regclass
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped
                AND has_column_privilege(
                  current_user,
                  attribute.attrelid,
                  attribute.attname,
                  'INSERT'
                ) IS DISTINCT FROM (
                  attribute.attname = ANY(ARRAY[
                    'user_id',
                    'astrology_calculation_id',
                    'action',
                    'idempotency_key_digest',
                    'canonical_request_digest',
                    'created_at'
                  ])
                )
           ) AS "exactOperationInsertColumns",
           (
             has_table_privilege(
               current_user,
               'public.astrology_calculation_operation',
               'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
             )
             OR has_any_column_privilege(
               current_user,
               'public.astrology_calculation_operation',
               'UPDATE'
             )
           ) AS "canMutateOperation",
           (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
              FROM pg_roles WHERE rolname = current_user) AS "privilegedRole",
           EXISTS (
             SELECT 1
               FROM reachable_roles AS role
              WHERE role.rolsuper
                 OR role.rolcreatedb
                 OR role.rolcreaterole
                 OR role.rolreplication
                 OR role.rolbypassrls
                 OR role.oid = owners.database_owner_oid
                 OR role.oid = owners.schema_owner_oid
                 OR role.oid = ANY(owners.table_owner_oids)
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
    !row.canReadAccount ||
    !row.canReadSession ||
    !row.canTouchSession ||
    !row.canReadProfile ||
    !row.canReadCalculation ||
    !row.canInsertCalculation ||
    !row.exactCalculationInsertColumns ||
    row.canMutateCalculation ||
    !row.canReadOperation ||
    !row.canInsertOperation ||
    !row.exactOperationInsertColumns ||
    row.canMutateOperation ||
    row.privilegedRole ||
    row.reachableOwnerOrPrivilegedRole
  ) {
    throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
  }
};

export const createAstrologyCalculationPersistence = (
  database: PrismaClient,
): AstrologyCalculationPersistence => {
  const create: AstrologyCalculationPersistence["create"] = async (input) => {
    const calculationId = parseUuid(input.calculationId);
    const birthProfileId = parseUuid(input.birthProfileId);
    const expectedRevision = parseRevision(input.expectedBirthProfileRevision);
    const expectedDigest = digestBytes(input.expectedBirthProfilePayloadDigest);
    const tokenDigest = await sessionTokenDigest(input.sessionToken);
    await assertAstrologyCalculationRuntimeDatabasePrivileges(database);
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await requireActiveSession(transaction, tokenDigest);
          const prepared = parsePrepared(
            input.prepare({
              birthProfileId,
              birthProfilePayloadDigest: digestString(expectedDigest),
              birthProfileRevision: expectedRevision,
              calculationId,
              userId: active.userId,
            }),
          );
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${`astrology-calculation:${active.userId}`}, 93093)
            )
          `;
          const replay = await readReplay(
            transaction,
            active.userId,
            prepared.idempotencyKeyDigest,
          );
          if (replay !== null) {
            if (
              replay.action !== "create" ||
              replay.id !== calculationId ||
              replay.birthProfileId !== birthProfileId ||
              replay.birthProfileRevision !== expectedRevision ||
              !bytesEqual(replay.birthProfilePayloadDigest, expectedDigest) ||
              !bytesEqual(replay.canonicalRequestDigest, prepared.canonicalRequestDigest) ||
              replay.privacyDeletedAt !== null
            ) {
              throw new AstrologyCalculationPersistenceError(
                "ASTROLOGY_CALCULATION_REPLAY_CONFLICT",
              );
            }
            return result(replay);
          }

          await readActiveProfileBinding(transaction, {
            birthProfileId,
            expectedDigest,
            expectedRevision,
            expectedTimeCertainty: prepared.timeCertainty,
            userId: active.userId,
          });

          const rows = await transaction.$queryRaw<CalculationRow[]>`
            INSERT INTO astrology_calculation AS calculation (
              id, user_id, birth_profile_id, birth_profile_revision,
              birth_profile_payload_digest, status, time_certainty,
              method_version, aspect_policy_version, method_catalog_digest,
              input_snapshot_digest, timezone_provenance_digest,
              engine_provenance_version, engine_build_provenance,
              facts_ciphertext, facts_nonce, facts_tag,
              encryption_key_version, digest_key_version, keyed_facts_digest,
              created_at
            ) VALUES (
              ${calculationId}::uuid, ${active.userId}::uuid, ${birthProfileId}::uuid,
              ${expectedRevision}, ${expectedDigest}, ${prepared.status},
              ${prepared.timeCertainty}, ${prepared.methodVersion},
              ${prepared.aspectPolicyVersion}, ${prepared.methodCatalogDigest},
              ${prepared.inputSnapshotDigest}, ${prepared.timezoneProvenanceDigest},
              ${astrologyEngineBuildProvenanceVersion},
              ${JSON.stringify(prepared.engineBuildProvenance)}::jsonb,
              ${prepared.encryptedFacts.ciphertext}, ${prepared.encryptedFacts.nonce},
              ${prepared.encryptedFacts.tag}, ${prepared.encryptedFacts.keyVersion},
              ${prepared.digestKeyVersion}, ${prepared.keyedFactsDigest}, CURRENT_TIMESTAMP
            )
            RETURNING ${calculationSelection}
          `;
          const calculation = rows[0];
          if (calculation === undefined || rows.length !== 1) unavailable();

          const operationCount = await transaction.$executeRaw`
            INSERT INTO astrology_calculation_operation (
              user_id, astrology_calculation_id, action,
              idempotency_key_digest, canonical_request_digest, created_at
            ) VALUES (
              ${active.userId}::uuid, ${calculationId}::uuid, 'create',
              ${prepared.idempotencyKeyDigest}, ${prepared.canonicalRequestDigest},
              CURRENT_TIMESTAMP
            )
          `;
          if (operationCount !== 1) unavailable();
          return result(calculation as CalculationRow);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof AstrologyCalculationPersistenceError) throw error;
      throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_UNAVAILABLE");
    }
  };

  return Object.freeze({
    create,
    async list(input) {
      const limit = parseLimit(input.limit);
      const tokenDigest = await sessionTokenDigest(input.sessionToken);
      await assertAstrologyCalculationRuntimeDatabasePrivileges(database);
      return database.$transaction(async (transaction) => {
        const active = await requireActiveSession(transaction, tokenDigest);
        const rows = await transaction.$queryRaw<CalculationRow[]>`
          SELECT ${calculationSelection}
            FROM astrology_calculation AS calculation
           WHERE calculation.user_id = ${active.userId}::uuid
             AND calculation.privacy_deleted_at IS NULL
           ORDER BY calculation.created_at DESC, calculation.id DESC
           LIMIT ${limit}
        `;
        return Object.freeze(rows.map(result));
      });
    },
    async read(input) {
      const calculationId = parseUuid(input.calculationId);
      const tokenDigest = await sessionTokenDigest(input.sessionToken);
      await assertAstrologyCalculationRuntimeDatabasePrivileges(database);
      const calculation = await database.$transaction(async (transaction) => {
        const active = await requireActiveSession(transaction, tokenDigest);
        return readCalculation(transaction, active.userId, calculationId);
      });
      if (calculation === null) {
        throw new AstrologyCalculationPersistenceError("ASTROLOGY_CALCULATION_NOT_FOUND");
      }
      return result(calculation);
    },
  });
};
