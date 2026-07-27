import type { PrismaClient } from "./generated/prisma/client.js";

export type PersistedCatalogVersion = Readonly<{
  approvalMode: string;
  defaultLocale: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  environment: string;
  evidence: Readonly<{
    ownerReference: string;
    sourceChecksumSha256: string;
    sourceReference: string;
  }>;
  nextReviewAt: string;
  prices: readonly Readonly<{
    amountMinor: number;
    billingInterval: string;
    countryCodes: readonly string[];
    currencyCode: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
    priceId: string;
    productCode: string;
    productVersion: string;
    providerEligibility: readonly string[];
    refundPolicyVersion: string;
    status: string;
    taxCategory: string;
    version: string;
  }>[];
  products: readonly Readonly<{
    code: string;
    creditsCost: number | null;
    creditsGranted: number | null;
    creditsPerMonth: number | null;
    fulfillmentCode: string;
    kind: string;
    localizations: readonly Readonly<{
      description: string;
      exactContents: readonly string[];
      locale: string;
      title: string;
    }>[];
    status: string;
    subscriptionInterval: string | null;
    version: string;
  }>[];
  schemaVersion: string;
  status: string;
  supersedesVersion: string | null;
  supportedLocales: readonly string[];
  version: string;
}>;

type CatalogRuntimePrivilegeAttestation = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canMutateCatalog: boolean;
  canReadCatalog: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachablePrivilegeEscalation: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
  tableOwners: string[];
}>;

export const assertCatalogRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<CatalogRuntimePrivilegeAttestation[]>`
    WITH owners AS (
      SELECT (SELECT datdba FROM pg_database WHERE datname = current_database()) AS database_owner_oid,
             (SELECT nspowner FROM pg_namespace WHERE nspname = 'public') AS schema_owner_oid,
             ARRAY(
               SELECT DISTINCT relowner
                 FROM pg_class
                WHERE oid = ANY (ARRAY[
                  'public.catalog_version'::regclass,
                  'public.catalog_product'::regclass,
                  'public.catalog_product_localization'::regclass,
                  'public.catalog_price'::regclass
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
           ARRAY(
             SELECT pg_get_userbyid(owner_oid)::text
               FROM unnest(owners.table_owner_oids) AS owner_oid
           )::text[]
             AS "tableOwners",
           has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
           has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
           (
             has_table_privilege(current_user, 'public.catalog_version', 'SELECT')
             AND has_table_privilege(current_user, 'public.catalog_product', 'SELECT')
             AND has_table_privilege(current_user, 'public.catalog_product_localization', 'SELECT')
             AND has_table_privilege(current_user, 'public.catalog_price', 'SELECT')
           ) AS "canReadCatalog",
           (
             has_table_privilege(current_user, 'public.catalog_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.catalog_product', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.catalog_product_localization', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_table_privilege(current_user, 'public.catalog_price', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
             OR has_any_column_privilege(current_user, 'public.catalog_version', 'INSERT,UPDATE,REFERENCES')
             OR has_any_column_privilege(current_user, 'public.catalog_product', 'INSERT,UPDATE,REFERENCES')
             OR has_any_column_privilege(current_user, 'public.catalog_product_localization', 'INSERT,UPDATE,REFERENCES')
             OR has_any_column_privilege(current_user, 'public.catalog_price', 'INSERT,UPDATE,REFERENCES')
           ) AS "canMutateCatalog",
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
                 OR role.oid = ANY (owners.table_owner_oids)
                 OR has_database_privilege(role.oid, current_database(), 'CREATE')
                 OR has_schema_privilege(role.oid, 'public', 'CREATE')
                 OR has_table_privilege(role.oid, 'public.catalog_version', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                 OR has_table_privilege(role.oid, 'public.catalog_product', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                 OR has_table_privilege(role.oid, 'public.catalog_product_localization', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                 OR has_table_privilege(role.oid, 'public.catalog_price', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
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
    row.tableOwners.includes(row.roleName) ||
    row.canCreateInDatabase ||
    row.canCreateInSchema ||
    !row.canReadCatalog ||
    row.canMutateCatalog ||
    row.privilegedRole ||
    row.reachablePrivilegeEscalation
  ) {
    throw new TypeError("Catalog runtime database privileges are unsafe.");
  }
};

export const readCatalogVersions = async (
  database: PrismaClient,
  input: Readonly<{ environment: "local" | "preview" | "staging" | "production" }>,
): Promise<readonly PersistedCatalogVersion[]> => {
  const records = await database.catalogVersion.findMany({
    include: {
      products: {
        include: {
          localizations: {
            orderBy: { locale: "asc" },
          },
          prices: {
            orderBy: [{ priceId: "asc" }, { version: "asc" }],
          },
        },
        orderBy: [{ code: "asc" }, { version: "asc" }],
      },
    },
    orderBy: [{ effectiveFrom: "asc" }, { version: "asc" }],
    take: 17,
    where: { environment: input.environment },
  });
  if (records.length > 16) {
    throw new TypeError("Catalog registry exceeds the bounded lookup limit.");
  }
  return Object.freeze(
    records.map((record) =>
      Object.freeze({
        approvalMode: record.approvalMode,
        defaultLocale: record.defaultLocale,
        effectiveFrom: record.effectiveFrom.toISOString(),
        effectiveUntil: record.effectiveUntil?.toISOString() ?? null,
        environment: record.environment,
        evidence: {
          ownerReference: record.ownerReference,
          sourceChecksumSha256: record.sourceChecksumSha256,
          sourceReference: record.sourceReference,
        },
        nextReviewAt: record.nextReviewAt.toISOString(),
        prices: record.products.flatMap((product) =>
          product.prices.map((price) => ({
            amountMinor: price.amountMinor,
            billingInterval: price.billingInterval,
            countryCodes: price.countryCodes,
            currencyCode: price.currencyCode,
            effectiveFrom: price.effectiveFrom.toISOString(),
            effectiveUntil: price.effectiveUntil?.toISOString() ?? null,
            priceId: price.priceId,
            productCode: price.productCode,
            productVersion: price.productVersion,
            providerEligibility: price.providerEligibility,
            refundPolicyVersion: price.refundPolicyVersion,
            status: price.status,
            taxCategory: price.taxCategory,
            version: price.version,
          })),
        ),
        products: record.products.map((product) => ({
          code: product.code,
          creditsCost: product.creditsCost,
          creditsGranted: product.creditsGranted,
          creditsPerMonth: product.creditsPerMonth,
          fulfillmentCode: product.fulfillmentCode,
          kind: product.kind,
          localizations: product.localizations.map((entry) => ({
            description: entry.description,
            exactContents: entry.exactContents,
            locale: entry.locale,
            title: entry.title,
          })),
          status: product.status,
          subscriptionInterval: product.subscriptionInterval,
          version: product.version,
        })),
        schemaVersion: record.schemaVersion,
        status: record.status,
        supersedesVersion: record.supersedesVersion,
        supportedLocales: record.supportedLocales,
        version: record.version,
      }),
    ),
  );
};
