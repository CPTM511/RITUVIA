export type LocalPostgresRuntime = Readonly<{
  binaries: Readonly<{
    pg_dump: string;
    pg_restore: string;
  }>;
  credentials: Readonly<{
    adminPassword: string;
    migratorPassword: string;
  }>;
}>;

export type LocalPostgresTestDatabase = Readonly<{
  adminDatabaseUrl: string;
  attest(): Promise<void>;
  controlDatabaseUrl: string;
  databaseName: string;
  databaseUrl: string;
  drop(): Promise<void>;
  migrationDatabaseUrl: string;
  privacyDeletionDatabaseUrl: string;
  adminServiceDatabaseUrl: string;
}>;

export type LocalPostgresLease = Readonly<{
  createTestDatabase(): Promise<LocalPostgresTestDatabase>;
  developmentControlDatabaseUrl: string;
  developmentDatabaseUrl: string;
  developmentMigrationDatabaseUrl: string;
  runtime: LocalPostgresRuntime;
  startedByInvocation: boolean;
}>;

export const ensureRuntimeDatabasePrivileges: (
  runtime: LocalPostgresRuntime,
  databaseName: string,
) => Promise<void>;

export const runLocalPrisma: (
  runtime: LocalPostgresRuntime,
  databaseUrl: string,
  arguments_: readonly string[],
  options?: Readonly<{ stdio?: "inherit" | "pipe"; timeout?: number }>,
) => Readonly<{
  status: number | null;
  stderr: string;
  stdout: string;
}>;

export const stopLeaseOwnedRuntime: (lease: LocalPostgresLease) => Promise<void>;

export const localPostgresConstants: Readonly<{
  host: string;
  port: number;
}>;

export const verifyLogicalDumpRestore: (
  runtime: LocalPostgresRuntime,
  sourceHandle: LocalPostgresTestDatabase,
  targetHandle: LocalPostgresTestDatabase,
) => Promise<void>;

export const withLocalPostgresLease: <Value>(
  operation: (lease: LocalPostgresLease) => Promise<Value>,
) => Promise<Value>;
