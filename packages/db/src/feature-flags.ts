import type { PrismaClient } from "./generated/prisma/client.js";

export type PersistedFeatureFlagVersion = Readonly<{
  actorId: string;
  approvalReference: string | null;
  changeReference: string;
  countryCodes: readonly string[];
  createdAt: string;
  effectiveAt: string;
  expiresAt: string | null;
  flagKey: string;
  localeTags: readonly string[];
  registryVersion: number;
  state: string;
  version: number;
}>;

type FeatureFlagRuntimePrivilegeAttestation = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canMutateFeatureFlags: boolean;
  canReadFeatureFlags: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachablePrivilegeEscalation: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
  tableOwner: string;
}>;

export const assertFeatureFlagRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<FeatureFlagRuntimePrivilegeAttestation[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             (SELECT relowner FROM pg_class WHERE oid = 'public.feature_flag_version'::regclass) AS table_owner_oid
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
           pg_get_userbyid(owners.table_owner_oid) AS "tableOwner",
           has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           has_table_privilege(current_user, 'public.feature_flag_version', 'SELECT') AS "canReadFeatureFlags",
           (has_table_privilege(current_user, 'public.feature_flag_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_any_column_privilege(current_user, 'public.feature_flag_version', 'INSERT,UPDATE,REFERENCES')) AS "canMutateFeatureFlags",
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
                 OR role.oid = owners.table_owner_oid
                 OR has_database_privilege(role.oid, current_database(), 'CREATE')
                 OR has_schema_privilege(role.oid, 'public', 'CREATE')
                 OR has_table_privilege(role.oid, 'public.feature_flag_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                 OR has_any_column_privilege(role.oid, 'public.feature_flag_version', 'INSERT,UPDATE,REFERENCES')
           ) AS "reachablePrivilegeEscalation"
      FROM owners
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    row.sessionRoleName !== row.roleName ||
    row.roleName === row.databaseOwner ||
    row.roleName === row.schemaOwner ||
    row.roleName === row.tableOwner ||
    row.canCreateInDatabase ||
    row.canCreateInSchema ||
    !row.canReadFeatureFlags ||
    row.canMutateFeatureFlags ||
    row.privilegedRole ||
    row.reachablePrivilegeEscalation
  ) {
    throw new TypeError("Feature-flag runtime database privileges are unsafe.");
  }
};

export const readFeatureFlagVersions = async (
  database: PrismaClient,
  registryVersion: number,
): Promise<readonly PersistedFeatureFlagVersion[]> => {
  if (
    !Number.isSafeInteger(registryVersion) ||
    registryVersion <= 0 ||
    registryVersion > 2_147_483_647
  ) {
    throw new TypeError("Feature-flag registry version must be a positive 32-bit integer.");
  }
  const records = await database.featureFlagVersion.findMany({
    orderBy: [{ flagKey: "asc" }, { version: "asc" }],
    select: {
      actorId: true,
      approvalReference: true,
      changeReference: true,
      countryCodes: true,
      createdAt: true,
      effectiveAt: true,
      expiresAt: true,
      flagKey: true,
      localeTags: true,
      registryVersion: true,
      state: true,
      version: true,
    },
    take: 10_001,
    where: { registryVersion },
  });

  return Object.freeze(
    records.map((record) =>
      Object.freeze({
        ...record,
        countryCodes: Object.freeze([...record.countryCodes]),
        createdAt: record.createdAt.toISOString(),
        effectiveAt: record.effectiveAt.toISOString(),
        expiresAt: record.expiresAt?.toISOString() ?? null,
        localeTags: Object.freeze([...record.localeTags]),
      }),
    ),
  );
};
