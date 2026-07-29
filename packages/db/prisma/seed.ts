import { rituviaCatalog20260723LocalData } from "@rituvia/domain";

import { createDatabaseClient } from "../src/client.js";
import { assertCiServiceAddress } from "../src/ci-database-safety.js";
import { assertSyntheticSeedTarget } from "../src/local-seed-safety.js";

const FOUNDATION_SEED = Object.freeze({
  id: "6d393ec1-2019-4abc-9cf8-62f58c72efe8",
  datasetKey: "foundation-synthetic",
  version: 1,
  checksumSha256: "921224db98642ee1f9abc307c710066eb3a94a59c3caba29ffda110ee1928937",
  isSynthetic: true,
  createdAt: new Date("2026-07-16T00:00:00.000Z"),
});

const LOCAL_COUNTRY_POLICY_DOCUMENT = Object.freeze({
  approvalMode: "local_test",
  countryCode: "US",
  crypto: { assets: [] as string[], enabled: false, providerRoute: null },
  dataFlags: ["private_by_default"],
  effectiveFrom: "2020-01-01T00:00:00.000Z",
  effectiveUntil: null,
  environment: "local",
  evidence: {
    cryptoApprovalReference: null,
    fiatApprovalReference: "test:local:fiat",
    legalReference: "test:local:legal",
    ownerReference: "test:own-010:local",
    providerReference: "test:local:hosted-checkout",
  },
  fiat: {
    currencies: ["USD"],
    enabled: true,
    methods: ["card"],
    providerRoutes: ["local_hosted"],
    recurringAllowed: false,
  },
  legalDocumentVersions: [
    { documentCode: "privacy", version: "local.privacy.v1" },
    { documentCode: "terms", version: "local.terms.v1" },
  ],
  localeTags: ["en"],
  marketingFlags: ["no_fear_upsell"],
  minimumAge: 18,
  modalities: ["ritual"],
  nextReviewAt: "2099-01-01T00:00:00.000Z",
  prohibitedClaims: ["guaranteed_outcome"],
  products: [
    { access: "paid", productCode: "pack_6", subscriptionAllowed: false },
    { access: "paid", productCode: "pack_15", subscriptionAllowed: false },
    { access: "paid", productCode: "pack_40", subscriptionAllowed: false },
    { access: "paid", productCode: "plus_annual", subscriptionAllowed: true },
    { access: "paid", productCode: "plus_monthly", subscriptionAllowed: true },
  ],
  refundPolicyVersion: "local.refund.v1",
  requiredDisclosures: ["digital_contents", "reflective_not_predictive"],
  schemaVersion: "country-policy-version.v1",
  status: "paid",
  supersedesVersion: null,
  supportAvailable: true,
  taxMode: "not_applicable",
  version: "local.us.commerce.v1",
});

const LOCAL_COUNTRY_POLICY_SEED = Object.freeze({
  id: "f6bec1d4-9e09-4ae8-a059-0397d5302a4a",
  schemaVersion: LOCAL_COUNTRY_POLICY_DOCUMENT.schemaVersion,
  version: LOCAL_COUNTRY_POLICY_DOCUMENT.version,
  supersedesVersion: null,
  countryCode: LOCAL_COUNTRY_POLICY_DOCUMENT.countryCode,
  environment: LOCAL_COUNTRY_POLICY_DOCUMENT.environment,
  status: LOCAL_COUNTRY_POLICY_DOCUMENT.status,
  approvalMode: LOCAL_COUNTRY_POLICY_DOCUMENT.approvalMode,
  effectiveFrom: new Date(LOCAL_COUNTRY_POLICY_DOCUMENT.effectiveFrom),
  effectiveUntil: null,
  nextReviewAt: new Date(LOCAL_COUNTRY_POLICY_DOCUMENT.nextReviewAt),
  legalReference: LOCAL_COUNTRY_POLICY_DOCUMENT.evidence.legalReference,
  ownerReference: LOCAL_COUNTRY_POLICY_DOCUMENT.evidence.ownerReference,
  providerReference: LOCAL_COUNTRY_POLICY_DOCUMENT.evidence.providerReference,
  actorId: "owner.local-mvp",
  policyDocument: LOCAL_COUNTRY_POLICY_DOCUMENT,
  createdAt: new Date("2026-07-25T00:00:00.000Z"),
});

const LOCAL_CATALOG_SEED_MANIFEST = Object.freeze({
  id: "cbfdb21d-07e6-4f8f-af83-0d6d5cc67185",
  datasetKey: "local-catalog-2026-07-23",
  version: 1,
  checksumSha256: rituviaCatalog20260723LocalData.evidence.sourceChecksumSha256,
  isSynthetic: true,
  createdAt: new Date("2026-07-25T00:00:00.000Z"),
});

const LOCAL_CATALOG_VERSION_SEED = Object.freeze({
  id: "2f45e207-166f-4213-8da9-21e6cdb1c089",
  schemaVersion: rituviaCatalog20260723LocalData.schemaVersion,
  version: rituviaCatalog20260723LocalData.version,
  supersedesVersion: rituviaCatalog20260723LocalData.supersedesVersion,
  environment: rituviaCatalog20260723LocalData.environment,
  status: rituviaCatalog20260723LocalData.status,
  approvalMode: rituviaCatalog20260723LocalData.approvalMode,
  defaultLocale: rituviaCatalog20260723LocalData.defaultLocale,
  supportedLocales: [...rituviaCatalog20260723LocalData.supportedLocales],
  effectiveFrom: new Date(rituviaCatalog20260723LocalData.effectiveFrom),
  effectiveUntil: null,
  nextReviewAt: new Date(rituviaCatalog20260723LocalData.nextReviewAt),
  sourceReference: rituviaCatalog20260723LocalData.evidence.sourceReference,
  sourceChecksumSha256: rituviaCatalog20260723LocalData.evidence.sourceChecksumSha256,
  ownerReference: rituviaCatalog20260723LocalData.evidence.ownerReference,
  actorId: "owner.local-catalog",
  createdAt: new Date("2026-07-25T00:00:00.000Z"),
});

const LOCAL_CATALOG_PRODUCT_SEEDS = rituviaCatalog20260723LocalData.products.map((product) => ({
  catalogVersion: rituviaCatalog20260723LocalData.version,
  code: product.code,
  version: product.version,
  kind: product.kind,
  status: product.status,
  fulfillmentCode: product.fulfillmentCode,
  creditsGranted: product.creditsGranted,
  creditsCost: product.creditsCost,
  creditsPerMonth: product.creditsPerMonth,
  subscriptionInterval: product.subscriptionInterval,
  createdAt: new Date("2026-07-25T00:00:00.000Z"),
}));

const LOCAL_CATALOG_LOCALIZATION_SEEDS = rituviaCatalog20260723LocalData.products.flatMap(
  (product) =>
    product.localizations.map((entry) => ({
      catalogVersion: rituviaCatalog20260723LocalData.version,
      productCode: product.code,
      productVersion: product.version,
      locale: entry.locale,
      title: entry.title,
      description: entry.description,
      exactContents: [...entry.exactContents],
      createdAt: new Date("2026-07-25T00:00:00.000Z"),
    })),
);

const LOCAL_CATALOG_PRICE_SEEDS = rituviaCatalog20260723LocalData.prices.map((price) => ({
  catalogVersion: rituviaCatalog20260723LocalData.version,
  priceId: price.priceId,
  version: price.version,
  productCode: price.productCode,
  productVersion: price.productVersion,
  status: price.status,
  currencyCode: price.currencyCode,
  amountMinor: price.amountMinor,
  billingInterval: price.billingInterval,
  countryCodes: [...price.countryCodes],
  providerEligibility: [...price.providerEligibility],
  taxCategory: price.taxCategory,
  refundPolicyVersion: price.refundPolicyVersion,
  effectiveFrom: new Date(price.effectiveFrom),
  effectiveUntil: price.effectiveUntil === null ? null : new Date(price.effectiveUntil),
  createdAt: new Date("2026-07-25T00:00:00.000Z"),
}));

const canonicalJson = (value: unknown): string =>
  JSON.stringify(
    Array.isArray(value)
      ? value.map((entry) => JSON.parse(canonicalJson(entry)) as unknown)
      : typeof value === "object" && value !== null
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, entry]) => [key, JSON.parse(canonicalJson(entry)) as unknown]),
          )
        : value,
  );

const databaseUrl = process.env.DATABASE_URL?.trim();
const target = assertSyntheticSeedTarget({
  appEnvironment: process.env.APP_ENV,
  ci: process.env.CI,
  databaseUrl,
  expectedClusterName: process.env.RITUVIA_LOCAL_POSTGRES_CLUSTER_NAME,
  expectedSystemIdentifier: process.env.RITUVIA_CI_POSTGRES_SYSTEM_IDENTIFIER,
  githubActions: process.env.GITHUB_ACTIONS,
  githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  githubRunId: process.env.GITHUB_RUN_ID,
  localPostgresPort: process.env.RITUVIA_LOCAL_POSTGRES_PORT,
  seedTarget: process.env.RITUVIA_SEED_TARGET,
});
if (databaseUrl === undefined) {
  throw new Error("Synthetic seed requires an attested local database target.");
}

const prisma = createDatabaseClient(databaseUrl);

try {
  if (target.kind === "local") {
    const [attestation] = await prisma.$queryRaw<
      Array<{
        clusterName: string;
        databaseName: string;
        serverAddress: string;
        serverPort: number;
        userName: string;
      }>
    >`SELECT current_database() AS "databaseName",
             current_user AS "userName",
             current_setting('cluster_name') AS "clusterName",
             host(inet_server_addr()) AS "serverAddress",
             inet_server_port() AS "serverPort"`;

    if (
      attestation?.databaseName !== target.databaseName ||
      attestation.userName !== "rituvia_migrator" ||
      attestation.clusterName !== target.expectedClusterName ||
      attestation.serverAddress !== "127.0.0.1" ||
      attestation.serverPort !== target.expectedPort
    ) {
      throw new Error("Synthetic seed requires an attested local database target.");
    }
  } else {
    const [attestation] = await prisma.$queryRaw<
      Array<{
        databaseName: string;
        inRecovery: boolean;
        serverAddress: string;
        serverPort: number;
        serverVersionNumber: number;
        systemIdentifier: string;
        userName: string;
      }>
    >`SELECT current_database() AS "databaseName",
             current_user AS "userName",
             host(inet_server_addr()) AS "serverAddress",
             inet_server_port() AS "serverPort",
             current_setting('server_version_num')::int AS "serverVersionNumber",
             pg_is_in_recovery() AS "inRecovery",
             (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier"`;

    if (
      attestation?.databaseName !== target.databaseName ||
      attestation.userName !== "rituvia_ci_migrator" ||
      attestation.serverPort !== 5432 ||
      Math.trunc(attestation.serverVersionNumber / 10_000) !== 17 ||
      attestation.inRecovery ||
      attestation.systemIdentifier !== target.expectedSystemIdentifier
    ) {
      throw new Error("Synthetic seed requires an attested local database target.");
    }
    assertCiServiceAddress(attestation.serverAddress);
  }

  await prisma.seedManifest.createMany({
    data: [FOUNDATION_SEED, LOCAL_CATALOG_SEED_MANIFEST],
    skipDuplicates: true,
  });
  await prisma.countryPolicyVersion.createMany({
    data: [LOCAL_COUNTRY_POLICY_SEED],
    skipDuplicates: true,
  });
  await prisma.catalogVersion.createMany({
    data: [LOCAL_CATALOG_VERSION_SEED],
    skipDuplicates: true,
  });
  await prisma.catalogProduct.createMany({
    data: LOCAL_CATALOG_PRODUCT_SEEDS,
    skipDuplicates: true,
  });
  await prisma.catalogProductLocalization.createMany({
    data: LOCAL_CATALOG_LOCALIZATION_SEEDS,
    skipDuplicates: true,
  });
  await prisma.catalogPrice.createMany({
    data: LOCAL_CATALOG_PRICE_SEEDS,
    skipDuplicates: true,
  });

  const persisted = await prisma.seedManifest.findUniqueOrThrow({
    where: {
      datasetKey_version: {
        datasetKey: FOUNDATION_SEED.datasetKey,
        version: FOUNDATION_SEED.version,
      },
    },
  });

  if (
    persisted.id !== FOUNDATION_SEED.id ||
    persisted.checksumSha256 !== FOUNDATION_SEED.checksumSha256 ||
    persisted.isSynthetic !== FOUNDATION_SEED.isSynthetic ||
    persisted.createdAt.getTime() !== FOUNDATION_SEED.createdAt.getTime()
  ) {
    throw new Error("Synthetic seed provenance does not match the committed dataset.");
  }

  const countryPolicy = await prisma.countryPolicyVersion.findUniqueOrThrow({
    where: { version: LOCAL_COUNTRY_POLICY_SEED.version },
  });
  if (
    countryPolicy.id !== LOCAL_COUNTRY_POLICY_SEED.id ||
    countryPolicy.countryCode !== "US" ||
    countryPolicy.environment !== "local" ||
    countryPolicy.approvalMode !== "local_test" ||
    countryPolicy.actorId !== LOCAL_COUNTRY_POLICY_SEED.actorId ||
    canonicalJson(countryPolicy.policyDocument) !== canonicalJson(LOCAL_COUNTRY_POLICY_DOCUMENT)
  ) {
    throw new Error("Synthetic seed provenance does not match the committed dataset.");
  }

  const catalogVersion = await prisma.catalogVersion.findUniqueOrThrow({
    where: { version: LOCAL_CATALOG_VERSION_SEED.version },
  });
  const [catalogProducts, catalogLocalizations, catalogPrices] = await Promise.all([
    prisma.catalogProduct.count({
      where: { catalogVersion: LOCAL_CATALOG_VERSION_SEED.version },
    }),
    prisma.catalogProductLocalization.count({
      where: { catalogVersion: LOCAL_CATALOG_VERSION_SEED.version },
    }),
    prisma.catalogPrice.count({
      where: { catalogVersion: LOCAL_CATALOG_VERSION_SEED.version },
    }),
  ]);
  if (
    catalogVersion.id !== LOCAL_CATALOG_VERSION_SEED.id ||
    catalogVersion.environment !== "local" ||
    catalogVersion.approvalMode !== "local_test" ||
    catalogVersion.sourceChecksumSha256 !==
      rituviaCatalog20260723LocalData.evidence.sourceChecksumSha256 ||
    catalogProducts !== rituviaCatalog20260723LocalData.products.length ||
    catalogLocalizations !==
      rituviaCatalog20260723LocalData.products.length *
        rituviaCatalog20260723LocalData.supportedLocales.length ||
    catalogPrices !== rituviaCatalog20260723LocalData.prices.length
  ) {
    throw new Error("Synthetic catalog seed does not match the committed dataset.");
  }
} finally {
  await prisma.$disconnect();
}
