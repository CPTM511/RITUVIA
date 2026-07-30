export const backupRecoveryPolicyVersion = "rituvia.backup-recovery.v1";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const REVISION_PATTERN = /^[0-9a-f]{40}$/u;
const LOCAL_DATABASE_PATTERN = /^rituvia_test_[a-f0-9]{24}$/u;
const CI_SOURCE_DATABASE = "rituvia_ci";
const CI_RESTORE_DATABASE_PATTERN = /^rituvia_restore_[0-9]{1,20}_[0-9]{1,10}$/u;

export type BackupRecoveryMode = "ci" | "local";

export type BackupRecoverySnapshot = Readonly<{
  constraintCount: number;
  indexCount: number;
  migrationCount: number;
  privilegeCount: number;
  snapshotSha256: string;
  tableCount: number;
  totalRows: number;
}>;

export type BackupRecoveryEvidence = Readonly<{
  artifact: Readonly<{
    bytes: number;
    format: "postgresql-custom";
    sha256: string;
  }>;
  checks: readonly [
    "artifact-integrity",
    "empty-isolated-target",
    "migration-inventory",
    "schema-inventory",
    "table-row-counts",
    "snapshot-boundary",
    "runtime-least-privilege",
    "cleanup",
  ];
  cleanup: Readonly<{
    artifactRemoved: true;
    sourceReleased: true;
    targetRemoved: true;
  }>;
  dataClassification: "synthetic-only";
  durationsMs: Readonly<{
    backup: number;
    restore: number;
    total: number;
  }>;
  git: Readonly<{
    revision: string;
    workingTreeDirty: boolean;
  }>;
  mode: BackupRecoveryMode;
  policyVersion: typeof backupRecoveryPolicyVersion;
  postgresVersionNumber: number;
  schemaVersion: 1;
  snapshot: BackupRecoverySnapshot;
  sourceDatabaseIdentity: string;
  targetDatabaseIdentity: string;
}>;

const fail = (message: string): never => {
  throw new Error(message);
};

const positiveInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return fail(`${label} must be a positive integer.`);
  }
  return value;
};

const nonnegativeInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(`${label} must be a nonnegative integer.`);
  }
  return value;
};

export const assertBackupDatabaseBoundary = (
  mode: BackupRecoveryMode,
  sourceDatabase: string,
  targetDatabase: string,
): void => {
  const valid =
    sourceDatabase !== targetDatabase &&
    (mode === "local"
      ? LOCAL_DATABASE_PATTERN.test(sourceDatabase) && LOCAL_DATABASE_PATTERN.test(targetDatabase)
      : sourceDatabase === CI_SOURCE_DATABASE && CI_RESTORE_DATABASE_PATTERN.test(targetDatabase));
  if (!valid) fail("Backup recovery database boundary is unsafe.");
};

export const databaseIdentity = async (
  mode: BackupRecoveryMode,
  databaseName: string,
): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${mode}\0${databaseName}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const assertArtifactIntegrity = (
  bytes: number,
  expectedSha256: string,
  observedSha256: string,
  signature: string,
): void => {
  if (
    !Number.isSafeInteger(bytes) ||
    bytes <= 5 ||
    !SHA256_PATTERN.test(expectedSha256) ||
    !SHA256_PATTERN.test(observedSha256) ||
    expectedSha256 !== observedSha256 ||
    signature !== "PGDMP"
  ) {
    fail("Backup artifact integrity verification failed.");
  }
};

export const assertBackupArtifactMetadata = ({
  isFile,
  isSymbolicLink,
  mode,
  size,
}: Readonly<{
  isFile: boolean;
  isSymbolicLink: boolean;
  mode: number;
  size: number;
}>): void => {
  if (
    !isFile ||
    isSymbolicLink ||
    !Number.isSafeInteger(mode) ||
    (mode & 0o077) !== 0 ||
    !Number.isSafeInteger(size) ||
    size <= 5
  ) {
    fail("Backup artifact filesystem boundary is unsafe.");
  }
};

export const assertBackupCleanup = ({
  artifactRemoved,
  sourceReleased,
  targetRemoved,
}: Readonly<{
  artifactRemoved: boolean;
  sourceReleased: boolean;
  targetRemoved: boolean;
}>): void => {
  if (!artifactRemoved || !sourceReleased || !targetRemoved) {
    fail("Backup recovery cleanup verification failed.");
  }
};

export const assertEquivalentRestoreSnapshots = (
  sourceSnapshotSha256: string,
  restoredSnapshotSha256: string,
): void => {
  if (
    !SHA256_PATTERN.test(sourceSnapshotSha256) ||
    !SHA256_PATTERN.test(restoredSnapshotSha256) ||
    sourceSnapshotSha256 !== restoredSnapshotSha256
  ) {
    fail("Restored database snapshot does not match the backup boundary.");
  }
};

export const createBackupRecoveryEvidence = async ({
  artifactBytes,
  artifactSha256,
  backupDurationMs,
  constraintCount,
  gitRevision,
  indexCount,
  migrationCount,
  mode,
  postgresVersionNumber,
  privilegeCount,
  restoreDurationMs,
  snapshotSha256,
  sourceDatabase,
  tableCount,
  targetDatabase,
  totalDurationMs,
  totalRows,
  workingTreeDirty,
}: Readonly<{
  artifactBytes: number;
  artifactSha256: string;
  backupDurationMs: number;
  constraintCount: number;
  gitRevision: string;
  indexCount: number;
  migrationCount: number;
  mode: BackupRecoveryMode;
  postgresVersionNumber: number;
  privilegeCount: number;
  restoreDurationMs: number;
  snapshotSha256: string;
  sourceDatabase: string;
  tableCount: number;
  targetDatabase: string;
  totalDurationMs: number;
  totalRows: number;
  workingTreeDirty: boolean;
}>): Promise<BackupRecoveryEvidence> => {
  assertBackupDatabaseBoundary(mode, sourceDatabase, targetDatabase);
  if (!SHA256_PATTERN.test(artifactSha256) || !SHA256_PATTERN.test(snapshotSha256)) {
    return fail("Backup recovery evidence digest is invalid.");
  }
  if (!REVISION_PATTERN.test(gitRevision)) {
    return fail("Backup recovery evidence revision is invalid.");
  }
  if (typeof workingTreeDirty !== "boolean") {
    return fail("Backup recovery evidence source state is invalid.");
  }

  const [sourceDatabaseIdentity, targetDatabaseIdentity] = await Promise.all([
    databaseIdentity(mode, sourceDatabase),
    databaseIdentity(mode, targetDatabase),
  ]);
  const evidence = Object.freeze({
    artifact: Object.freeze({
      bytes: positiveInteger(artifactBytes, "Artifact bytes"),
      format: "postgresql-custom" as const,
      sha256: artifactSha256,
    }),
    checks: Object.freeze([
      "artifact-integrity",
      "empty-isolated-target",
      "migration-inventory",
      "schema-inventory",
      "table-row-counts",
      "snapshot-boundary",
      "runtime-least-privilege",
      "cleanup",
    ] as const),
    cleanup: Object.freeze({
      artifactRemoved: true as const,
      sourceReleased: true as const,
      targetRemoved: true as const,
    }),
    dataClassification: "synthetic-only" as const,
    durationsMs: Object.freeze({
      backup: positiveInteger(backupDurationMs, "Backup duration"),
      restore: positiveInteger(restoreDurationMs, "Restore duration"),
      total: positiveInteger(totalDurationMs, "Total duration"),
    }),
    git: Object.freeze({
      revision: gitRevision,
      workingTreeDirty,
    }),
    mode,
    policyVersion: backupRecoveryPolicyVersion,
    postgresVersionNumber: positiveInteger(postgresVersionNumber, "PostgreSQL version"),
    schemaVersion: 1 as const,
    snapshot: Object.freeze({
      constraintCount: positiveInteger(constraintCount, "Constraint count"),
      indexCount: positiveInteger(indexCount, "Index count"),
      migrationCount: positiveInteger(migrationCount, "Migration count"),
      privilegeCount: positiveInteger(privilegeCount, "Privilege count"),
      snapshotSha256,
      tableCount: positiveInteger(tableCount, "Table count"),
      totalRows: nonnegativeInteger(totalRows, "Total rows"),
    }),
    sourceDatabaseIdentity,
    targetDatabaseIdentity,
  });

  const serialized = JSON.stringify(evidence);
  for (const forbidden of [
    "postgresql://",
    "password",
    "secret",
    "private_key",
    "databaseUrl",
    sourceDatabase,
    targetDatabase,
  ]) {
    if (serialized.toLowerCase().includes(forbidden.toLowerCase())) {
      return fail("Backup recovery evidence contains forbidden material.");
    }
  }
  return evidence;
};
