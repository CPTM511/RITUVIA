import {
  parseTarotReadingCreateRequestV1,
  type TarotReadingCreateRequestV1,
  type TarotReadingType,
} from "@rituvia/domain";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { assertAnonymousIdentityRuntimeDatabasePrivileges } from "./anonymous-identity.js";

const requestSchemaVersion = "tarot-reading-create.v1" as const;
const executionSchemaVersion = "tarot-draw-execution.v1" as const;
const integrityScheme = "hmac-sha256.tarot-reading.v1" as const;
const maximumDigestCandidates = 8;
const maximumExecutionBytes = 65_536;
const maximumJsonDepth = 20;
const maximumJsonNodes = 4_096;

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const approvalReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export const tarotReadingPersistenceErrorCodes = Object.freeze([
  "TAROT_READING_SESSION_UNAVAILABLE",
  "TAROT_READING_IDEMPOTENCY_CONFLICT",
  "TAROT_READING_RATE_LIMITED",
  "TAROT_READING_EXECUTION_INVALID",
  "TAROT_READING_PERSISTENCE_UNAVAILABLE",
] as const);

export type TarotReadingPersistenceErrorCode = (typeof tarotReadingPersistenceErrorCodes)[number];

const persistenceMessage = (code: TarotReadingPersistenceErrorCode): string => {
  switch (code) {
    case "TAROT_READING_SESSION_UNAVAILABLE":
      return "The anonymous reading session is unavailable.";
    case "TAROT_READING_IDEMPOTENCY_CONFLICT":
      return "The tarot reading request conflicts.";
    case "TAROT_READING_RATE_LIMITED":
      return "Tarot reading capacity is temporarily limited.";
    case "TAROT_READING_EXECUTION_INVALID":
      return "The tarot reading execution is invalid.";
    case "TAROT_READING_PERSISTENCE_UNAVAILABLE":
      return "Tarot reading storage is unavailable.";
  }
};

export class TarotReadingPersistenceError extends Error {
  readonly code: TarotReadingPersistenceErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: TarotReadingPersistenceErrorCode, retryAfterSeconds?: number) {
    super(persistenceMessage(code));
    this.name = "TarotReadingPersistenceError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type TarotReadingPersistencePolicy = Readonly<{
  readingLimit: number;
  readingPolicyVersion: string;
  windowSeconds: number;
}>;

export type TarotReadingDigestCandidate = Readonly<{
  clientRequestDigest: string;
  idempotencyKeyDigest: string;
  idempotencyKeyVersion: string;
}>;

export type TarotReadingCatalogProvenance = Readonly<{
  approvalReference: string;
  checksumSha256: string;
  id: string;
  version: string;
}>;

export type TarotReadingExecutionContext = Readonly<{
  catalog: TarotReadingCatalogProvenance;
  idempotencyKeyDigest: string;
  integrityKeyVersion: string;
  readingId: string;
  subjectId: string;
}>;

export type PreparedTarotReadingCreate = Readonly<{
  activeIdempotencyKeyVersion: string;
  candidates: readonly TarotReadingDigestCandidate[];
  catalog: TarotReadingCatalogProvenance;
  createExecution: (context: TarotReadingExecutionContext) => Promise<unknown> | unknown;
  integrityKeyVersion: string;
  integrityScheme: typeof integrityScheme;
}>;

export type TarotReadingPrepareContext = Readonly<{
  readingPolicyVersion: string;
  request: TarotReadingCreateRequestV1;
  subjectId: string;
}>;

export type PersistedTarotReading = Readonly<{
  catalog: TarotReadingCatalogProvenance;
  clientRequestDigest: string;
  completedAt: string;
  createdAt: string;
  drawRequestDigest: string;
  execution: unknown;
  expiresAt: string;
  id: string;
  idempotencyKeyDigest: string;
  idempotencyKeyVersion: string;
  integrityKeyVersion: string;
  integrityScheme: typeof integrityScheme;
  locale: "en";
  readingPolicyVersion: string;
  readingType: TarotReadingType;
  requestSchemaVersion: typeof requestSchemaVersion;
  status: "facts_ready";
  subjectId: string;
  themeCode: TarotReadingCreateRequestV1["themeCode"];
}>;

export type ResolvedTarotReading = Readonly<{
  kind: "created" | "replayed";
  reading: PersistedTarotReading;
}>;

export type TarotReadingPersistence = Readonly<{
  get(input: Readonly<{ readingId: string; token: string }>): Promise<PersistedTarotReading | null>;
  resolveCreate(
    input: Readonly<{
      prepare: (
        context: TarotReadingPrepareContext,
      ) => Promise<PreparedTarotReadingCreate> | PreparedTarotReadingCreate;
      request: unknown;
      token: string;
    }>,
  ): Promise<ResolvedTarotReading>;
}>;

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonArray | JsonObject;
type JsonArray = readonly JsonValue[];
interface JsonObject {
  readonly [key: string]: JsonValue;
}

type ReadingRow = Readonly<{
  catalogApprovalReference: string;
  catalogChecksumSha256: Uint8Array;
  catalogId: string;
  catalogVersion: string;
  clientRequestHash: Uint8Array;
  completedAt: Date;
  createdAt: Date;
  drawIdempotencyKeyHash: Uint8Array | null;
  drawRequestHash: Uint8Array | null;
  entropyBytesConsumed: number | null;
  entropyCommitment: string | null;
  entropyRejectedSamples: number | null;
  execution: unknown | null;
  executionSchemaVersion: string | null;
  expiresAt: Date;
  id: string;
  idempotencyKeyHash: Uint8Array;
  idempotencyKeyVersion: string;
  integrityKeyVersion: string | null;
  integrityScheme: string | null;
  locale: string;
  readingPolicyVersion: string;
  readingType: string;
  requestSchemaVersion: string;
  status: string;
  subjectId: string;
  themeCode: string;
}>;

type ActiveSessionRow = Readonly<{
  expiresAt: Date;
  observedAt: Date;
  subjectId: string;
}>;

type ExecutionSnapshot = Readonly<{
  bytesConsumed: number;
  catalogId: string;
  catalogVersion: string;
  commitment: string;
  drawRequestDigest: string;
  idempotencyKeyDigest: string;
  rejectedSamples: number;
  serialized: string;
  value: JsonValue;
}>;

type TarotPrivilegeAttestation = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canInsertDraw: boolean;
  canInsertReading: boolean;
  canMutateDraw: boolean;
  canMutateReading: boolean;
  canReadDraw: boolean;
  canReadIdentity: boolean;
  canReadReading: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachableOwnerOrPrivilegedRole: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
}>;

export const assertTarotReadingRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<TarotPrivilegeAttestation[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             ARRAY(
               SELECT relowner
                 FROM pg_class
                WHERE oid = ANY(ARRAY[
                  'public.reading'::regclass,
                  'public.tarot_draw'::regclass
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
           has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           (has_table_privilege(current_user, 'public.anonymous_subject', 'SELECT')
             AND has_table_privilege(current_user, 'public.anonymous_session', 'SELECT')) AS "canReadIdentity",
           has_table_privilege(current_user, 'public.reading', 'SELECT') AS "canReadReading",
           has_table_privilege(current_user, 'public.reading', 'INSERT') AS "canInsertReading",
           (has_table_privilege(current_user, 'public.reading', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_any_column_privilege(current_user, 'public.reading', 'UPDATE')) AS "canMutateReading",
           has_table_privilege(current_user, 'public.tarot_draw', 'SELECT') AS "canReadDraw",
           has_table_privilege(current_user, 'public.tarot_draw', 'INSERT') AS "canInsertDraw",
           (has_table_privilege(current_user, 'public.tarot_draw', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_any_column_privilege(current_user, 'public.tarot_draw', 'UPDATE')) AS "canMutateDraw",
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
    !row.canInsertDraw ||
    !row.canInsertReading ||
    row.canMutateDraw ||
    row.canMutateReading ||
    !row.canReadDraw ||
    !row.canReadIdentity ||
    !row.canReadReading ||
    row.privilegedRole ||
    row.reachableOwnerOrPrivilegedRole
  ) {
    throw new TypeError("Tarot reading runtime database privileges are unsafe.");
  }
};

function failExecution(): never {
  throw new TarotReadingPersistenceError("TAROT_READING_EXECUTION_INVALID");
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  return actual === [...expected].sort().join("\u0000");
};

const snapshotJson = (input: unknown): Readonly<{ serialized: string; value: JsonValue }> => {
  try {
    let nodes = 0;
    const visit = (value: unknown, depth: number): JsonValue => {
      nodes += 1;
      if (nodes > maximumJsonNodes || depth > maximumJsonDepth) failExecution();
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
      ) {
        return value as JsonPrimitive;
      }
      if (typeof value !== "object") failExecution();
      if (Array.isArray(value)) {
        if (value.length > maximumJsonNodes) failExecution();
        for (const item of value) {
          visit(item, depth + 1);
        }
        return Object.freeze(value) as JsonArray;
      }
      for (const [key, item] of Object.entries(value)) {
        if (key.length === 0 || key.length > 128 || /[\u0000-\u001f\u007f]/u.test(key)) {
          failExecution();
        }
        visit(item, depth + 1);
      }
      return Object.freeze(value) as JsonObject;
    };
    const serialized = JSON.stringify(input);
    if (serialized === undefined) failExecution();
    if (Buffer.byteLength(serialized, "utf8") > maximumExecutionBytes) failExecution();
    const value = visit(JSON.parse(serialized) as unknown, 0);
    return Object.freeze({ serialized, value });
  } catch (error) {
    if (error instanceof TarotReadingPersistenceError) throw error;
    return failExecution();
  }
};

const parseDigest = (value: unknown): string => {
  if (typeof value !== "string" || !sha256DigestPattern.test(value)) failExecution();
  return value;
};

const parseReference = (value: unknown): Readonly<{ id: string; version: string }> => {
  const candidate = record(value);
  if (candidate === null) failExecution();
  if (!exactKeys(candidate, ["id", "version"])) failExecution();
  const id = candidate.id;
  const version = candidate.version;
  if (
    typeof id !== "string" ||
    !identifierPattern.test(id) ||
    typeof version !== "string" ||
    !versionPattern.test(version)
  ) {
    failExecution();
  }
  return Object.freeze({ id, version });
};

const parseExecution = (input: unknown, readingType: TarotReadingType): ExecutionSnapshot => {
  const snapshot = snapshotJson(input);
  const root = record(snapshot.value);
  if (root === null) failExecution();
  if (!exactKeys(root, ["audit", "facts", "schemaVersion"])) failExecution();
  if (root.schemaVersion !== executionSchemaVersion) failExecution();

  const audit = record(root.audit);
  if (audit === null) failExecution();
  if (!exactKeys(audit, ["entropy", "idempotencyKeyDigest", "requestDigest"])) failExecution();
  const entropy = record(audit.entropy);
  if (entropy === null) failExecution();
  if (!exactKeys(entropy, ["bytesConsumed", "commitment", "rejectedSamples"])) failExecution();
  const bytesConsumed = entropy.bytesConsumed;
  const rejectedSamples = entropy.rejectedSamples;
  if (
    !Number.isSafeInteger(bytesConsumed) ||
    (bytesConsumed as number) < 0 ||
    (bytesConsumed as number) > 1_000_000 ||
    !Number.isSafeInteger(rejectedSamples) ||
    (rejectedSamples as number) < 0 ||
    (rejectedSamples as number) > (bytesConsumed as number)
  ) {
    failExecution();
  }

  const facts = record(root.facts);
  if (facts === null) failExecution();
  if (
    !exactKeys(facts, [
      "algorithmVersion",
      "catalog",
      "deck",
      "engineName",
      "engineVersion",
      "method",
      "orientationPolicy",
      "positions",
      "replacementPolicy",
      "rulesVersion",
      "schemaVersion",
      "spread",
    ]) ||
    facts.algorithmVersion !== "partial-fisher-yates-rejection-uint8.v1" ||
    facts.engineName !== "rituvia.tarot-draw" ||
    facts.engineVersion !== "1.0.0" ||
    facts.method !== "tarot" ||
    facts.replacementPolicy !== "without_replacement" ||
    facts.rulesVersion !== "tarot-draw-rules.v1" ||
    facts.schemaVersion !== "tarot-draw-facts.v1" ||
    (facts.orientationPolicy !== "upright_only" &&
      facts.orientationPolicy !== "upright_and_reversed") ||
    !Array.isArray(facts.positions)
  ) {
    failExecution();
  }
  const expectedPositions = readingType === "one_card" ? 1 : 3;
  const positions = facts.positions;
  if (!Array.isArray(positions) || positions.length !== expectedPositions) failExecution();
  const cards = new Set<string>();
  const positionIds = new Set<string>();
  for (const [index, value] of positions.entries()) {
    const position = record(value);
    if (position === null) failExecution();
    if (
      !exactKeys(position, ["cardId", "order", "orientation", "positionId"]) ||
      typeof position.cardId !== "string" ||
      !identifierPattern.test(position.cardId) ||
      position.order !== index + 1 ||
      (position.orientation !== "upright" && position.orientation !== "reversed") ||
      (facts.orientationPolicy === "upright_only" && position.orientation !== "upright") ||
      typeof position.positionId !== "string" ||
      !identifierPattern.test(position.positionId) ||
      cards.has(position.cardId) ||
      positionIds.has(position.positionId)
    ) {
      failExecution();
    }
    cards.add(position.cardId);
    positionIds.add(position.positionId);
  }

  const catalog = parseReference(facts.catalog);
  parseReference(facts.deck);
  parseReference(facts.spread);
  return Object.freeze({
    bytesConsumed: bytesConsumed as number,
    catalogId: catalog.id,
    catalogVersion: catalog.version,
    commitment: parseDigest(entropy.commitment),
    drawRequestDigest: parseDigest(audit.requestDigest),
    idempotencyKeyDigest: parseDigest(audit.idempotencyKeyDigest),
    rejectedSamples: rejectedSamples as number,
    serialized: snapshot.serialized,
    value: snapshot.value,
  });
};

const digestBytes = (digest: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(Buffer.from(digest.slice("sha256:".length), "hex")) as Uint8Array<ArrayBuffer>;

const digestFromBytes = (bytes: Uint8Array): string =>
  `sha256:${Buffer.from(bytes).toString("hex")}`;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  Buffer.from(left).equals(Buffer.from(right));

const tokenHash = async (token: string): Promise<Uint8Array<ArrayBuffer> | null> => {
  if (!sessionTokenPattern.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.byteLength !== 32 || bytes.toString("base64url") !== token) return null;
  const input = Uint8Array.from(bytes) as Uint8Array<ArrayBuffer>;
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", input));
};

const validatePolicy = (policy: TarotReadingPersistencePolicy): TarotReadingPersistencePolicy => {
  if (
    !identifierPattern.test(policy.readingPolicyVersion) ||
    !Number.isSafeInteger(policy.readingLimit) ||
    policy.readingLimit < 1 ||
    policy.readingLimit > 1_000 ||
    !Number.isSafeInteger(policy.windowSeconds) ||
    policy.windowSeconds < 60 ||
    policy.windowSeconds > 604_800
  ) {
    throw new TypeError("Tarot reading persistence policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const parsePrepared = (value: PreparedTarotReadingCreate): PreparedTarotReadingCreate => {
  const candidates = Array.from(value.candidates ?? []);
  if (
    candidates.length < 1 ||
    candidates.length > maximumDigestCandidates ||
    typeof value.createExecution !== "function" ||
    value.integrityScheme !== integrityScheme ||
    !identifierPattern.test(value.integrityKeyVersion) ||
    !identifierPattern.test(value.activeIdempotencyKeyVersion)
  ) {
    throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
  }
  const versions = new Set<string>();
  const frozenCandidates = candidates.map((candidate) => {
    if (
      !identifierPattern.test(candidate.idempotencyKeyVersion) ||
      versions.has(candidate.idempotencyKeyVersion) ||
      !sha256DigestPattern.test(candidate.idempotencyKeyDigest) ||
      !sha256DigestPattern.test(candidate.clientRequestDigest)
    ) {
      throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
    }
    versions.add(candidate.idempotencyKeyVersion);
    return Object.freeze({ ...candidate });
  });
  if (!versions.has(value.activeIdempotencyKeyVersion)) {
    throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
  }
  const catalog = value.catalog;
  if (
    !identifierPattern.test(catalog.id) ||
    !versionPattern.test(catalog.version) ||
    !sha256DigestPattern.test(catalog.checksumSha256) ||
    !approvalReferencePattern.test(catalog.approvalReference)
  ) {
    throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({
    activeIdempotencyKeyVersion: value.activeIdempotencyKeyVersion,
    candidates: Object.freeze(frozenCandidates),
    catalog: Object.freeze({ ...catalog }),
    createExecution: value.createExecution,
    integrityKeyVersion: value.integrityKeyVersion,
    integrityScheme,
  });
};

const readingSelect = Prisma.sql`
  SELECT reading.id,
         reading.anonymous_subject_id AS "subjectId",
         reading.reading_type AS "readingType",
         reading.status,
         reading.locale,
         reading.theme_code AS "themeCode",
         reading.request_schema_version AS "requestSchemaVersion",
         reading.reading_policy_version AS "readingPolicyVersion",
         reading.catalog_id AS "catalogId",
         reading.catalog_version AS "catalogVersion",
         reading.catalog_checksum_sha256 AS "catalogChecksumSha256",
         reading.catalog_approval_reference AS "catalogApprovalReference",
         reading.idempotency_key_version AS "idempotencyKeyVersion",
         reading.idempotency_key_hash AS "idempotencyKeyHash",
         reading.client_request_hash AS "clientRequestHash",
         reading.created_at AS "createdAt",
         reading.completed_at AS "completedAt",
         reading.expires_at AS "expiresAt",
         draw.idempotency_key_hash AS "drawIdempotencyKeyHash",
         draw.draw_request_hash AS "drawRequestHash",
         draw.execution_schema_version AS "executionSchemaVersion",
         draw.integrity_scheme AS "integrityScheme",
         draw.integrity_key_version AS "integrityKeyVersion",
         draw.entropy_commitment AS "entropyCommitment",
         draw.entropy_bytes_consumed AS "entropyBytesConsumed",
         draw.entropy_rejected_samples AS "entropyRejectedSamples",
         draw.execution
    FROM reading
    LEFT JOIN tarot_draw AS draw ON draw.reading_id = reading.id
`;

const persistedReading = (row: ReadingRow): PersistedTarotReading => {
  let request: TarotReadingCreateRequestV1;
  try {
    request = parseTarotReadingCreateRequestV1({
      locale: row.locale,
      readingType: row.readingType,
      schemaVersion: row.requestSchemaVersion,
      themeCode: row.themeCode,
    });
  } catch {
    throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
  }
  if (
    !uuidPattern.test(row.id) ||
    !uuidPattern.test(row.subjectId) ||
    row.status !== "facts_ready" ||
    !identifierPattern.test(row.readingPolicyVersion) ||
    !identifierPattern.test(row.idempotencyKeyVersion) ||
    !identifierPattern.test(row.catalogId) ||
    !versionPattern.test(row.catalogVersion) ||
    row.catalogChecksumSha256.byteLength !== 32 ||
    !approvalReferencePattern.test(row.catalogApprovalReference) ||
    row.idempotencyKeyHash.byteLength !== 32 ||
    row.clientRequestHash.byteLength !== 32 ||
    row.execution === null ||
    row.drawIdempotencyKeyHash === null ||
    row.drawRequestHash === null ||
    !bytesEqual(row.idempotencyKeyHash, row.drawIdempotencyKeyHash) ||
    row.executionSchemaVersion !== executionSchemaVersion ||
    row.integrityScheme !== integrityScheme ||
    row.integrityKeyVersion === null ||
    !identifierPattern.test(row.integrityKeyVersion) ||
    row.entropyCommitment === null ||
    row.entropyBytesConsumed === null ||
    row.entropyRejectedSamples === null ||
    !(row.createdAt instanceof Date) ||
    !(row.completedAt instanceof Date) ||
    !(row.expiresAt instanceof Date) ||
    row.createdAt.getTime() !== row.completedAt.getTime() ||
    row.expiresAt.getTime() <= row.completedAt.getTime()
  ) {
    throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
  }
  const execution = parseExecution(row.execution, request.readingType);
  if (
    execution.catalogId !== row.catalogId ||
    execution.catalogVersion !== row.catalogVersion ||
    execution.idempotencyKeyDigest !== digestFromBytes(row.idempotencyKeyHash) ||
    execution.drawRequestDigest !== digestFromBytes(row.drawRequestHash) ||
    execution.commitment !== row.entropyCommitment ||
    execution.bytesConsumed !== row.entropyBytesConsumed ||
    execution.rejectedSamples !== row.entropyRejectedSamples
  ) {
    throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
  }
  return Object.freeze({
    catalog: Object.freeze({
      approvalReference: row.catalogApprovalReference,
      checksumSha256: digestFromBytes(row.catalogChecksumSha256),
      id: row.catalogId,
      version: row.catalogVersion,
    }),
    clientRequestDigest: digestFromBytes(row.clientRequestHash),
    completedAt: row.completedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    drawRequestDigest: execution.drawRequestDigest,
    execution: execution.value,
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    idempotencyKeyDigest: execution.idempotencyKeyDigest,
    idempotencyKeyVersion: row.idempotencyKeyVersion,
    integrityKeyVersion: row.integrityKeyVersion,
    integrityScheme,
    locale: "en",
    readingPolicyVersion: row.readingPolicyVersion,
    readingType: request.readingType,
    requestSchemaVersion,
    status: "facts_ready",
    subjectId: row.subjectId,
    themeCode: request.themeCode,
  });
};

const resolveActiveSession = async (
  transaction: Prisma.TransactionClient,
  token: string,
): Promise<ActiveSessionRow | null> => {
  const hash = await tokenHash(token);
  if (hash === null) return null;
  const rows = await transaction.$queryRaw<ActiveSessionRow[]>`
    SELECT subject.id AS "subjectId",
           subject.expires_at AS "expiresAt",
           CURRENT_TIMESTAMP AS "observedAt"
      FROM anonymous_session AS session
      JOIN anonymous_subject AS subject ON subject.id = session.anonymous_subject_id
     WHERE session.token_hash = ${hash}
       AND session.token_hash_version = 1
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND subject.expires_at > CURRENT_TIMESTAMP
     FOR UPDATE OF session, subject
  `;
  return rows.length === 1 && rows[0] !== undefined ? rows[0] : null;
};

export const createTarotReadingPersistence = (
  database: PrismaClient,
  rawPolicy: TarotReadingPersistencePolicy,
): TarotReadingPersistence => {
  const policy = validatePolicy(rawPolicy);

  const attest = async (): Promise<void> => {
    await assertAnonymousIdentityRuntimeDatabasePrivileges(database);
    await assertTarotReadingRuntimeDatabasePrivileges(database);
  };

  const get: TarotReadingPersistence["get"] = async ({ readingId, token }) => {
    if (!uuidPattern.test(readingId)) return null;
    await attest();
    try {
      return await database.$transaction(async (transaction) => {
        const active = await resolveActiveSession(transaction, token);
        if (active === null) return null;
        const rows = await transaction.$queryRaw<ReadingRow[]>`
          ${readingSelect}
           WHERE reading.id = ${readingId}::uuid
             AND reading.anonymous_subject_id = ${active.subjectId}::uuid
           LIMIT 2
        `;
        if (rows.length === 0) return null;
        if (rows.length !== 1 || rows[0] === undefined) {
          throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
        }
        return persistedReading(rows[0]);
      });
    } catch (error) {
      if (error instanceof TarotReadingPersistenceError) throw error;
      throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
    }
  };

  const resolveCreate: TarotReadingPersistence["resolveCreate"] = async (input) => {
    const request = parseTarotReadingCreateRequestV1(input.request);
    await attest();
    let callbackFailure: unknown;
    try {
      return await database.$transaction(
        async (transaction) => {
          const active = await resolveActiveSession(transaction, input.token);
          if (active === null) {
            throw new TarotReadingPersistenceError("TAROT_READING_SESSION_UNAVAILABLE");
          }
          let prepared: PreparedTarotReadingCreate;
          try {
            prepared = parsePrepared(
              await input.prepare({
                readingPolicyVersion: policy.readingPolicyVersion,
                request,
                subjectId: active.subjectId,
              }),
            );
          } catch (error) {
            callbackFailure = error;
            throw error;
          }

          let historical: Readonly<{
            candidate: TarotReadingDigestCandidate;
            row: ReadingRow;
          }> | null = null;
          for (const candidate of prepared.candidates) {
            const idempotencyKeyHash = digestBytes(candidate.idempotencyKeyDigest);
            const rows = await transaction.$queryRaw<ReadingRow[]>`
              ${readingSelect}
               WHERE reading.anonymous_subject_id = ${active.subjectId}::uuid
                 AND reading.request_schema_version = ${requestSchemaVersion}
                 AND reading.idempotency_key_version = ${candidate.idempotencyKeyVersion}
                 AND reading.idempotency_key_hash = ${idempotencyKeyHash}
               LIMIT 2
            `;
            if (rows.length > 1 || (rows.length === 1 && historical !== null)) {
              throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
            }
            if (rows[0] !== undefined) historical = Object.freeze({ candidate, row: rows[0] });
          }
          if (historical !== null) {
            if (
              !bytesEqual(
                historical.row.clientRequestHash,
                digestBytes(historical.candidate.clientRequestDigest),
              )
            ) {
              throw new TarotReadingPersistenceError("TAROT_READING_IDEMPOTENCY_CONFLICT");
            }
            return Object.freeze({
              kind: "replayed" as const,
              reading: persistedReading(historical.row),
            });
          }

          const recent = await transaction.$queryRaw<Array<{ createdAt: Date }>>`
            SELECT reading.created_at AS "createdAt"
              FROM reading
             WHERE reading.anonymous_subject_id = ${active.subjectId}::uuid
               AND reading.created_at >
                   CURRENT_TIMESTAMP - make_interval(secs => ${policy.windowSeconds})
             ORDER BY reading.created_at DESC, reading.id DESC
             LIMIT ${policy.readingLimit}
          `;
          if (recent.length >= policy.readingLimit) {
            const oldest = recent.at(-1)?.createdAt;
            if (!(oldest instanceof Date)) {
              throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
            }
            const retryAt = oldest.getTime() + policy.windowSeconds * 1_000;
            const retryAfterSeconds = Math.max(
              1,
              Math.ceil((retryAt - active.observedAt.getTime()) / 1_000),
            );
            throw new TarotReadingPersistenceError("TAROT_READING_RATE_LIMITED", retryAfterSeconds);
          }

          const activeCandidate = prepared.candidates.find(
            ({ idempotencyKeyVersion }) =>
              idempotencyKeyVersion === prepared.activeIdempotencyKeyVersion,
          );
          if (activeCandidate === undefined) {
            throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
          }
          const idempotencyKeyHash = digestBytes(activeCandidate.idempotencyKeyDigest);
          const clientRequestHash = digestBytes(activeCandidate.clientRequestDigest);
          const catalogChecksumSha256 = digestBytes(prepared.catalog.checksumSha256);
          const inserted = await transaction.$queryRaw<Array<{ id: string }>>`
            INSERT INTO reading (
              anonymous_subject_id, modality, reading_type, status, locale, theme_code,
              request_schema_version, reading_policy_version, catalog_id, catalog_version,
              catalog_checksum_sha256, catalog_approval_reference, idempotency_key_version,
              idempotency_key_hash, client_request_hash, created_at, completed_at, expires_at
            ) VALUES (
              ${active.subjectId}::uuid, 'tarot', ${request.readingType}, 'facts_ready', 'en',
              ${request.themeCode}, ${requestSchemaVersion}, ${policy.readingPolicyVersion},
              ${prepared.catalog.id}, ${prepared.catalog.version}, ${catalogChecksumSha256},
              ${prepared.catalog.approvalReference}, ${activeCandidate.idempotencyKeyVersion},
              ${idempotencyKeyHash}, ${clientRequestHash}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
              ${active.expiresAt}
            )
            RETURNING id
          `;
          const readingId = inserted[0]?.id;
          if (inserted.length !== 1 || readingId === undefined || !uuidPattern.test(readingId)) {
            throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
          }

          let rawExecution: unknown;
          try {
            rawExecution = await prepared.createExecution({
              catalog: prepared.catalog,
              idempotencyKeyDigest: activeCandidate.idempotencyKeyDigest,
              integrityKeyVersion: prepared.integrityKeyVersion,
              readingId,
              subjectId: active.subjectId,
            });
          } catch (error) {
            callbackFailure = error;
            throw error;
          }
          const execution = parseExecution(rawExecution, request.readingType);
          if (
            execution.idempotencyKeyDigest !== activeCandidate.idempotencyKeyDigest ||
            execution.catalogId !== prepared.catalog.id ||
            execution.catalogVersion !== prepared.catalog.version
          ) {
            failExecution();
          }
          const drawRequestHash = digestBytes(execution.drawRequestDigest);
          await transaction.$executeRaw`
            INSERT INTO tarot_draw (
              reading_id, reading_type, idempotency_key_hash, draw_request_hash, catalog_id,
              catalog_version, execution_schema_version, integrity_scheme, integrity_key_version,
              entropy_commitment, entropy_bytes_consumed, entropy_rejected_samples, execution,
              created_at
            ) VALUES (
              ${readingId}::uuid, ${request.readingType}, ${idempotencyKeyHash},
              ${drawRequestHash}, ${prepared.catalog.id}, ${prepared.catalog.version},
              ${executionSchemaVersion}, ${integrityScheme}, ${prepared.integrityKeyVersion},
              ${execution.commitment}, ${execution.bytesConsumed}, ${execution.rejectedSamples},
              CAST(${execution.serialized} AS JSONB), CURRENT_TIMESTAMP
            )
          `;
          const rows = await transaction.$queryRaw<ReadingRow[]>`
            ${readingSelect}
             WHERE reading.id = ${readingId}::uuid
               AND reading.anonymous_subject_id = ${active.subjectId}::uuid
             LIMIT 2
          `;
          if (rows.length !== 1 || rows[0] === undefined) {
            throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
          }
          return Object.freeze({ kind: "created" as const, reading: persistedReading(rows[0]) });
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error === callbackFailure) throw error;
      if (error instanceof TarotReadingPersistenceError) throw error;
      throw new TarotReadingPersistenceError("TAROT_READING_PERSISTENCE_UNAVAILABLE");
    }
  };

  return Object.freeze({ get, resolveCreate });
};
