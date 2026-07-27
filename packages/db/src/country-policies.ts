import type { PrismaClient } from "./generated/prisma/client.js";

export type PersistedCountryPolicyVersion = Readonly<{
  actorId: string;
  approvalMode: string;
  countryCode: string;
  createdAt: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  environment: string;
  legalReference: string;
  nextReviewAt: string;
  ownerReference: string;
  policyDocument: unknown;
  providerReference: string;
  schemaVersion: string;
  status: string;
  supersedesVersion: string | null;
  version: string;
}>;

type CountryPolicyRuntimePrivilegeAttestation = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canMutateCountryPolicies: boolean;
  canReadCountryPolicies: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachablePrivilegeEscalation: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
  tableOwner: string;
}>;

export const assertCountryPolicyRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<CountryPolicyRuntimePrivilegeAttestation[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             (SELECT relowner FROM pg_class WHERE oid = 'public.country_policy_version'::regclass) AS table_owner_oid
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
           has_table_privilege(current_user, 'public.country_policy_version', 'SELECT') AS "canReadCountryPolicies",
           (has_table_privilege(current_user, 'public.country_policy_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_any_column_privilege(current_user, 'public.country_policy_version', 'INSERT,UPDATE,REFERENCES')) AS "canMutateCountryPolicies",
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
                 OR has_table_privilege(role.oid, 'public.country_policy_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                 OR has_any_column_privilege(role.oid, 'public.country_policy_version', 'INSERT,UPDATE,REFERENCES')
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
    !row.canReadCountryPolicies ||
    row.canMutateCountryPolicies ||
    row.privilegedRole ||
    row.reachablePrivilegeEscalation
  ) {
    throw new TypeError("Country-policy runtime database privileges are unsafe.");
  }
};

export const readCountryPolicyVersions = async (
  database: PrismaClient,
  input: Readonly<{
    countryCode: string;
    environment: string;
  }>,
): Promise<readonly PersistedCountryPolicyVersion[]> => {
  if (
    !/^[A-Z]{2}$/u.test(input.countryCode) ||
    !["local", "preview", "staging", "production"].includes(input.environment)
  ) {
    throw new TypeError("Country-policy lookup is invalid.");
  }
  const records = await database.countryPolicyVersion.findMany({
    orderBy: [{ effectiveFrom: "asc" }, { version: "asc" }],
    select: {
      actorId: true,
      approvalMode: true,
      countryCode: true,
      createdAt: true,
      effectiveFrom: true,
      effectiveUntil: true,
      environment: true,
      legalReference: true,
      nextReviewAt: true,
      ownerReference: true,
      policyDocument: true,
      providerReference: true,
      schemaVersion: true,
      status: true,
      supersedesVersion: true,
      version: true,
    },
    take: 257,
    where: {
      countryCode: input.countryCode,
      environment: input.environment,
    },
  });
  if (records.length > 256) {
    throw new TypeError("Country-policy registry exceeds the bounded lookup limit.");
  }
  return Object.freeze(
    records.map((record) =>
      Object.freeze({
        ...record,
        createdAt: record.createdAt.toISOString(),
        effectiveFrom: record.effectiveFrom.toISOString(),
        effectiveUntil: record.effectiveUntil?.toISOString() ?? null,
        nextReviewAt: record.nextReviewAt.toISOString(),
      }),
    ),
  );
};
