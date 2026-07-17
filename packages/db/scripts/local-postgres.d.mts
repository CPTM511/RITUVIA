export type LocalPostgresRuntime = Readonly<Record<string, unknown>>;

export type LocalPostgresTestDatabase = Readonly<{
  attest(): Promise<void>;
  controlDatabaseUrl: string;
  databaseName: string;
  databaseUrl: string;
  drop(): Promise<void>;
  migrationDatabaseUrl: string;
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
) => unknown;

export const stopLeaseOwnedRuntime: (lease: LocalPostgresLease) => Promise<void>;

export const verifyLogicalDumpRestore: (
  runtime: LocalPostgresRuntime,
  sourceHandle: LocalPostgresTestDatabase,
  targetHandle: LocalPostgresTestDatabase,
) => Promise<void>;

export const withLocalPostgresLease: <Value>(
  operation: (lease: LocalPostgresLease) => Promise<Value>,
) => Promise<Value>;
