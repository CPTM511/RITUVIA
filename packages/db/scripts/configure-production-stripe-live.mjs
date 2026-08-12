import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import pg from "pg";

const { Client } = pg;

const resourceName = "rituvia-production";
const databaseName = "neondb";
const appRole = "rituvia_app";
const paymentWebhookRole = "rituvia_payment_webhook";
const catalogReaderRole = "rituvia_catalog_reader";
const catalogWriterRole = "rituvia_catalog_writer";
const countryPolicyReaderRole = "rituvia_country_policy_reader";
const countryPolicyWriterRole = "rituvia_country_policy_writer";
const catalogVersion = "production.us.pack-6.d099.v1";
const countryPolicyVersion = "production.us.stripe-live.pack-6.d099.v1";
const productionPolicyMigration = "202608120001_production_stripe_live";
const productionCatalogMigration = "202608120002_production_catalog_authorization";
const expectedConfirmation = `activate:${resourceName}/stripe-live/pack-6`;
const sourceReference = "docs/codex/rituvia-production-2026-07-23/contracts/catalog.json";
const ownerReference = "D-099:stripe-live:us:pack-6";
const actorId = "owner.production-activation";
const expectedProduct = Object.freeze({
  amountMinor: 599,
  code: "pack_6",
  creditsGranted: 6,
  currencyCode: "USD",
});

const fail = (message) => {
  throw new TypeError(message);
};

const environmentValue = (name) => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const canonicalJson = (value) =>
  JSON.stringify(
    Array.isArray(value)
      ? value.map((entry) => JSON.parse(canonicalJson(entry)))
      : typeof value === "object" && value !== null
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, entry]) => [key, JSON.parse(canonicalJson(entry))]),
          )
        : value,
  );

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u;
const evidencePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const exactInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const runtimeDatabaseRoles = new Set([
  appRole,
  paymentWebhookRole,
  "rituvia_ai_generation",
  "rituvia_privacy_deletion",
]);

const adminDatabaseUrl = environmentValue("RITUVIA_PRODUCTION_ADMIN_DATABASE_URL");
const stripeSecretKey = environmentValue("STRIPE_SECRET_KEY");
const stripeWebhookSecret = environmentValue("STRIPE_WEBHOOK_SECRET");
const stripeAccountId = environmentValue("RITUVIA_STRIPE_ACCOUNT_ID");
const stripePriceIdsSource = environmentValue("RITUVIA_STRIPE_PRICE_IDS");
const stripeWebhookEndpointId = environmentValue("RITUVIA_PRODUCTION_STRIPE_WEBHOOK_ENDPOINT_ID");
const canonicalOrigin = environmentValue("BRAND_CANONICAL_ORIGIN");
const legalSeller = environmentValue("BRAND_LEGAL_ENTITY");
const supportEmail = environmentValue("BRAND_SUPPORT_EMAIL")?.toLowerCase();
const legalReference = environmentValue("RITUVIA_PRODUCTION_LEGAL_EVIDENCE_REFERENCE");
const privacyVersion = environmentValue("RITUVIA_PRODUCTION_PRIVACY_VERSION");
const termsVersion = environmentValue("RITUVIA_PRODUCTION_TERMS_VERSION");
const refundPolicyVersion = environmentValue("RITUVIA_PRODUCTION_REFUND_POLICY_VERSION");
const taxMode = environmentValue("RITUVIA_PRODUCTION_TAX_MODE");
const statementDescriptor = environmentValue("RITUVIA_PRODUCTION_STATEMENT_DESCRIPTOR");
const expectedTaxBehavior = environmentValue("RITUVIA_PRODUCTION_STRIPE_TAX_BEHAVIOR");
const effectiveFrom = environmentValue("RITUVIA_PRODUCTION_EFFECTIVE_FROM");
const nextReviewAt = environmentValue("RITUVIA_PRODUCTION_NEXT_REVIEW_AT");

if (
  process.env.APP_ENV !== "production" ||
  process.env.VERCEL_ENV !== "production" ||
  process.env.RITUVIA_PAYMENT_PROVIDER !== "stripe" ||
  process.env.RITUVIA_PRODUCTION_RESOURCE_NAME !== resourceName ||
  process.env.RITUVIA_PRODUCTION_STRIPE_CONFIRM !== expectedConfirmation ||
  process.env.RITUVIA_NEW_PURCHASES_ENABLED !== "false" ||
  process.env.RITUVIA_STRIPE_CHECKOUT_ENABLED !== "false" ||
  adminDatabaseUrl === undefined ||
  stripeSecretKey === undefined ||
  stripeWebhookSecret === undefined ||
  stripeAccountId === undefined ||
  stripePriceIdsSource === undefined ||
  stripeWebhookEndpointId === undefined ||
  canonicalOrigin === undefined ||
  legalSeller === undefined ||
  supportEmail === undefined ||
  legalReference === undefined ||
  privacyVersion === undefined ||
  termsVersion === undefined ||
  refundPolicyVersion === undefined ||
  taxMode === undefined ||
  statementDescriptor === undefined ||
  expectedTaxBehavior === undefined ||
  effectiveFrom === undefined ||
  nextReviewAt === undefined
) {
  fail("Production Stripe Live configuration is not explicitly and completely authorized.");
}

if (
  !stripeSecretKey.startsWith("rk_live_") ||
  !/^whsec_[A-Za-z0-9_-]{16,}$/u.test(stripeWebhookSecret) ||
  !/^acct_[A-Za-z0-9]{8,}$/u.test(stripeAccountId) ||
  !/^we_[A-Za-z0-9]{8,}$/u.test(stripeWebhookEndpointId)
) {
  fail("Production Stripe credentials are not restricted live-mode credentials.");
}

let stripePriceIds;
try {
  stripePriceIds = JSON.parse(stripePriceIdsSource);
} catch {
  fail("Production Stripe Price mapping is invalid.");
}
if (
  !isRecord(stripePriceIds) ||
  Object.keys(stripePriceIds).length !== 1 ||
  typeof stripePriceIds.pack_6 !== "string" ||
  !/^price_[A-Za-z0-9]{8,}$/u.test(stripePriceIds.pack_6)
) {
  fail("Production Stripe Price mapping must contain only pack_6.");
}
const stripePriceId = stripePriceIds.pack_6;

let expectedWebhookUrl;
try {
  const parsedOrigin = new URL(canonicalOrigin);
  if (
    parsedOrigin.protocol !== "https:" ||
    parsedOrigin.username !== "" ||
    parsedOrigin.password !== "" ||
    parsedOrigin.search !== "" ||
    parsedOrigin.hash !== "" ||
    parsedOrigin.pathname !== "/"
  ) {
    fail("Production canonical origin is invalid.");
  }
  expectedWebhookUrl = new URL("/api/v1/webhooks/payments/stripe", parsedOrigin).toString();
} catch {
  fail("Production canonical origin is invalid.");
}

if (
  legalSeller.length < 2 ||
  legalSeller.length > 200 ||
  /(?:example|placeholder|test)/iu.test(legalSeller) ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(supportEmail) ||
  /@example\./iu.test(supportEmail) ||
  legalReference !== `D-099:legal:us:${sha256(legalSeller)}` ||
  !evidencePattern.test(legalReference) ||
  !versionPattern.test(privacyVersion) ||
  !versionPattern.test(termsVersion) ||
  !versionPattern.test(refundPolicyVersion) ||
  [privacyVersion, termsVersion, refundPolicyVersion].some((value) =>
    /(?:draft|placeholder|test)/iu.test(value),
  ) ||
  !["merchant", "merchant_of_record"].includes(taxMode) ||
  !["exclusive", "inclusive", "unspecified"].includes(expectedTaxBehavior) ||
  statementDescriptor.length < 5 ||
  statementDescriptor.length > 22 ||
  !/[A-Za-z]/u.test(statementDescriptor) ||
  /[<>\\'"*]/u.test(statementDescriptor)
) {
  fail("Production legal, support, tax, or statement-descriptor facts are invalid.");
}

if (
  !exactInstantPattern.test(effectiveFrom) ||
  !exactInstantPattern.test(nextReviewAt) ||
  !Number.isFinite(Date.parse(effectiveFrom)) ||
  !Number.isFinite(Date.parse(nextReviewAt)) ||
  Date.parse(effectiveFrom) > Date.now() ||
  Date.parse(nextReviewAt) <= Date.now() ||
  Date.parse(nextReviewAt) <= Date.parse(effectiveFrom)
) {
  fail("Production policy effective and review windows are invalid.");
}

let parsedAdminUrl;
try {
  parsedAdminUrl = new URL(adminDatabaseUrl);
} catch {
  fail("Production administrator connection is not the expected Neon TLS target.");
}
if (
  !["postgres:", "postgresql:"].includes(parsedAdminUrl.protocol) ||
  !parsedAdminUrl.hostname.endsWith(".neon.tech") ||
  parsedAdminUrl.pathname !== `/${databaseName}` ||
  parsedAdminUrl.username === "" ||
  runtimeDatabaseRoles.has(decodeURIComponent(parsedAdminUrl.username)) ||
  parsedAdminUrl.password === "" ||
  parsedAdminUrl.searchParams.get("sslmode") !== "require"
) {
  fail("Production administrator connection is not the expected Neon TLS target.");
}

const stripeRequest = async (path) => {
  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    fail("Stripe Live attestation request failed.");
  }
  if (!response.ok) fail("Stripe Live attestation was rejected.");
  const value = await response.json();
  if (!isRecord(value)) fail("Stripe Live attestation returned an invalid response.");
  return value;
};

const stripeAccount = await stripeRequest("account");
const stripeAccountSettings = stripeAccount.settings;
const stripePaymentsSettings = isRecord(stripeAccountSettings)
  ? stripeAccountSettings.payments
  : undefined;
const stripeBusinessProfile = stripeAccount.business_profile;
const stripeCapabilities = stripeAccount.capabilities;
if (
  stripeAccount.id !== stripeAccountId ||
  stripeAccount.country !== "US" ||
  stripeAccount.default_currency !== "usd" ||
  stripeAccount.charges_enabled !== true ||
  stripeAccount.details_submitted !== true ||
  !isRecord(stripeCapabilities) ||
  stripeCapabilities.card_payments !== "active" ||
  !isRecord(stripeBusinessProfile) ||
  String(stripeBusinessProfile.support_email ?? "").toLowerCase() !== supportEmail ||
  !isRecord(stripePaymentsSettings) ||
  stripePaymentsSettings.statement_descriptor !== statementDescriptor
) {
  fail("Stripe Live account identity, capability, support, or descriptor attestation failed.");
}

const stripePrice = await stripeRequest(`prices/${encodeURIComponent(stripePriceId)}`);
const stripeProductId =
  typeof stripePrice.product === "string"
    ? stripePrice.product
    : isRecord(stripePrice.product) && typeof stripePrice.product.id === "string"
      ? stripePrice.product.id
      : undefined;
if (
  stripePrice.id !== stripePriceId ||
  stripePrice.object !== "price" ||
  stripePrice.livemode !== true ||
  stripePrice.active !== true ||
  stripePrice.type !== "one_time" ||
  stripePrice.billing_scheme !== "per_unit" ||
  stripePrice.currency !== "usd" ||
  stripePrice.unit_amount !== expectedProduct.amountMinor ||
  stripePrice.tax_behavior !== expectedTaxBehavior ||
  stripeProductId === undefined
) {
  fail("Stripe Live Price does not match the approved pack_6 contract.");
}

const stripeProduct = await stripeRequest(`products/${encodeURIComponent(stripeProductId)}`);
if (
  stripeProduct.id !== stripeProductId ||
  stripeProduct.object !== "product" ||
  stripeProduct.livemode !== true ||
  stripeProduct.active !== true ||
  stripeProduct.name !== "6 Credits" ||
  !isRecord(stripeProduct.metadata) ||
  stripeProduct.metadata.rituvia_product_code !== expectedProduct.code ||
  stripeProduct.metadata.rituvia_credits !== String(expectedProduct.creditsGranted)
) {
  fail("Stripe Live Product does not match the approved pack_6 contract.");
}

const expectedWebhookEventTypes = [
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",
  "charge.dispute.created",
  "charge.refunded",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.succeeded",
].sort();
const stripeWebhookEndpoint = await stripeRequest(
  `webhook_endpoints/${encodeURIComponent(stripeWebhookEndpointId)}`,
);
const actualWebhookEventTypes = Array.isArray(stripeWebhookEndpoint.enabled_events)
  ? [...stripeWebhookEndpoint.enabled_events].sort()
  : [];
const stripeWebhookMetadata = stripeWebhookEndpoint.metadata;
if (
  stripeWebhookEndpoint.id !== stripeWebhookEndpointId ||
  stripeWebhookEndpoint.object !== "webhook_endpoint" ||
  stripeWebhookEndpoint.livemode !== true ||
  stripeWebhookEndpoint.status !== "enabled" ||
  stripeWebhookEndpoint.url !== expectedWebhookUrl ||
  !isRecord(stripeWebhookMetadata) ||
  stripeWebhookMetadata.rituvia_environment !== "production" ||
  stripeWebhookMetadata.rituvia_product_scope !== "pack_6" ||
  stripeWebhookMetadata.rituvia_webhook_secret_sha256 !== sha256(stripeWebhookSecret) ||
  actualWebhookEventTypes.length !== expectedWebhookEventTypes.length ||
  actualWebhookEventTypes.some((value, index) => value !== expectedWebhookEventTypes[index])
) {
  fail("Stripe Live webhook endpoint does not match the approved production contract.");
}

const sourceProduct = rituviaCatalog20260723LocalData.products.find(
  ({ code }) => code === expectedProduct.code,
);
const sourcePrice = rituviaCatalog20260723LocalData.prices.find(
  ({ productCode }) => productCode === expectedProduct.code,
);
if (
  sourceProduct === undefined ||
  sourcePrice === undefined ||
  sourceProduct.kind !== "credit_pack" ||
  sourceProduct.creditsGranted !== expectedProduct.creditsGranted ||
  sourcePrice.amountMinor !== expectedProduct.amountMinor ||
  sourcePrice.currencyCode !== expectedProduct.currencyCode ||
  sourcePrice.billingInterval !== "one_time"
) {
  fail("The repository pack_6 source contract is not the approved production contract.");
}

const product = Object.freeze({
  ...sourceProduct,
  localizations: sourceProduct.localizations.filter(({ locale }) => locale === "en"),
});
const price = Object.freeze({
  ...sourcePrice,
  effectiveFrom,
  priceId: "price.pack_6.usd.production.d099.v1",
  providerEligibility: ["stripe"],
  refundPolicyVersion,
  version: "production.d099.v1",
});
const catalogSource = Object.freeze({
  approvalMode: "written",
  defaultLocale: "en",
  effectiveFrom,
  effectiveUntil: null,
  environment: "production",
  nextReviewAt,
  prices: [price],
  products: [product],
  schemaVersion: "catalog-version.v1",
  status: "active",
  supersedesVersion: null,
  supportedLocales: ["en"],
  version: catalogVersion,
});
const catalog = Object.freeze({
  ...catalogSource,
  evidence: Object.freeze({
    ownerReference,
    sourceChecksumSha256: sha256(canonicalJson(catalogSource)),
    sourceReference,
  }),
});
const countryPolicy = Object.freeze({
  approvalMode: "written",
  countryCode: "US",
  crypto: { assets: [], enabled: false, providerRoute: null },
  dataFlags: ["private_by_default"],
  effectiveFrom,
  effectiveUntil: null,
  environment: "production",
  evidence: {
    cryptoApprovalReference: null,
    fiatApprovalReference: ownerReference,
    legalReference,
    ownerReference: "D-099:owner:limited-production",
    providerReference: `stripe:live:${stripeAccountId}:card-payments-active`,
  },
  fiat: {
    currencies: ["USD"],
    enabled: true,
    methods: ["card"],
    providerRoutes: ["stripe"],
    recurringAllowed: false,
  },
  legalDocumentVersions: [
    { documentCode: "privacy", version: privacyVersion },
    { documentCode: "terms", version: termsVersion },
  ],
  localeTags: ["en"],
  marketingFlags: ["no_fear_upsell"],
  minimumAge: 18,
  modalities: ["ritual"],
  nextReviewAt,
  prohibitedClaims: ["guaranteed_outcome"],
  products: [{ access: "paid", productCode: expectedProduct.code, subscriptionAllowed: false }],
  refundPolicyVersion,
  requiredDisclosures: ["digital_contents", "reflective_not_predictive"],
  schemaVersion: "country-policy-version.v1",
  status: "paid",
  supersedesVersion: null,
  supportAvailable: true,
  taxMode,
  version: countryPolicyVersion,
});

const runMigrations = () => {
  const inheritedNames = [
    "CI",
    "COREPACK_HOME",
    "HOME",
    "NO_COLOR",
    "PATH",
    "PNPM_HOME",
    "PRISMA_HIDE_UPDATE_MESSAGE",
    "SHELL",
    "TMPDIR",
    "USER",
    "XDG_CACHE_HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
  ];
  const migrationEnvironment = Object.fromEntries(
    inheritedNames.flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: new URL("..", import.meta.url),
    env: { ...migrationEnvironment, DATABASE_URL: adminDatabaseUrl },
    encoding: "utf8",
  });
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  if (result.status !== 0) fail("Production Stripe Live database migrations failed.");
};

const client = new Client({
  application_name: "rituvia-production-stripe-live-configuration",
  connectionString: adminDatabaseUrl,
});

try {
  await client.connect();
  const before = await client.query(
    `SELECT current_database() AS "databaseName",
            current_user AS "currentUser",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS "appRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $2) AS "paymentRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $3) AS "catalogReaderRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $4) AS "catalogWriterRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $5)
              AS "countryPolicyReaderRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $6)
              AS "countryPolicyWriterRoleExists",
            EXISTS (
              SELECT 1 FROM "_prisma_migrations"
               WHERE finished_at IS NULL AND rolled_back_at IS NULL
            ) AS "incompleteMigrationExists",
            (SELECT count(*)::integer FROM catalog_version WHERE environment = 'production')
              AS "productionCatalogCount",
            (SELECT count(*)::integer FROM catalog_version WHERE version = $7)
              AS "exactCatalogCount",
            (SELECT count(*)::integer FROM country_policy_version
              WHERE environment = 'production' AND country_code = 'US')
              AS "productionPolicyCount",
            (SELECT count(*)::integer FROM country_policy_version WHERE version = $8)
              AS "exactPolicyCount"`,
    [
      appRole,
      paymentWebhookRole,
      catalogReaderRole,
      catalogWriterRole,
      countryPolicyReaderRole,
      countryPolicyWriterRole,
      catalogVersion,
      countryPolicyVersion,
    ],
  );
  const facts = before.rows[0];
  if (
    facts === undefined ||
    facts.databaseName !== databaseName ||
    [appRole, paymentWebhookRole].includes(facts.currentUser) ||
    !facts.appRoleExists ||
    !facts.paymentRoleExists ||
    !facts.catalogReaderRoleExists ||
    !facts.catalogWriterRoleExists ||
    !facts.countryPolicyReaderRoleExists ||
    !facts.countryPolicyWriterRoleExists ||
    facts.incompleteMigrationExists ||
    !(
      (facts.productionCatalogCount === 0 && facts.exactCatalogCount === 0) ||
      (facts.productionCatalogCount === 1 && facts.exactCatalogCount === 1)
    ) ||
    !(
      (facts.productionPolicyCount === 0 && facts.exactPolicyCount === 0) ||
      (facts.productionPolicyCount === 1 && facts.exactPolicyCount === 1)
    )
  ) {
    fail("Production database identity, roles, migrations, or registry baseline is invalid.");
  }

  runMigrations();

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO country_policy_version (
         schema_version, version, supersedes_version, country_code, environment, status,
         approval_mode, effective_from, effective_until, next_review_at, legal_reference,
         owner_reference, provider_reference, actor_id, policy_document
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz,
         $10::timestamptz, $11, $12, $13, $14, $15::jsonb)
       ON CONFLICT (version) DO NOTHING`,
      [
        countryPolicy.schemaVersion,
        countryPolicy.version,
        countryPolicy.supersedesVersion,
        countryPolicy.countryCode,
        countryPolicy.environment,
        countryPolicy.status,
        countryPolicy.approvalMode,
        countryPolicy.effectiveFrom,
        countryPolicy.effectiveUntil,
        countryPolicy.nextReviewAt,
        countryPolicy.evidence.legalReference,
        countryPolicy.evidence.ownerReference,
        countryPolicy.evidence.providerReference,
        actorId,
        canonicalJson(countryPolicy),
      ],
    );
    await client.query(
      `INSERT INTO catalog_version (
         schema_version, version, supersedes_version, environment, status, approval_mode,
         default_locale, supported_locales, effective_from, effective_until, next_review_at,
         source_reference, source_checksum_sha256, owner_reference, actor_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::varchar[], $9::timestamptz,
         $10::timestamptz, $11::timestamptz, $12, $13, $14, $15)
       ON CONFLICT (version) DO NOTHING`,
      [
        catalog.schemaVersion,
        catalog.version,
        catalog.supersedesVersion,
        catalog.environment,
        catalog.status,
        catalog.approvalMode,
        catalog.defaultLocale,
        catalog.supportedLocales,
        catalog.effectiveFrom,
        catalog.effectiveUntil,
        catalog.nextReviewAt,
        catalog.evidence.sourceReference,
        catalog.evidence.sourceChecksumSha256,
        catalog.evidence.ownerReference,
        actorId,
      ],
    );
    await client.query(
      `INSERT INTO catalog_product (
         catalog_version, code, version, kind, status, fulfillment_code, credits_granted,
         credits_cost, credits_per_month, subscription_interval
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (catalog_version, code, version) DO NOTHING`,
      [
        catalog.version,
        product.code,
        product.version,
        product.kind,
        product.status,
        product.fulfillmentCode,
        product.creditsGranted,
        product.creditsCost,
        product.creditsPerMonth,
        product.subscriptionInterval,
      ],
    );
    for (const entry of product.localizations) {
      await client.query(
        `INSERT INTO catalog_product_localization (
           catalog_version, product_code, product_version, locale, title, description,
           exact_contents
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::varchar[])
         ON CONFLICT (catalog_version, product_code, product_version, locale) DO NOTHING`,
        [
          catalog.version,
          product.code,
          product.version,
          entry.locale,
          entry.title,
          entry.description,
          entry.exactContents,
        ],
      );
    }
    await client.query(
      `INSERT INTO catalog_price (
         catalog_version, price_id, version, product_code, product_version, status,
         currency_code, amount_minor, billing_interval, country_codes, provider_eligibility,
         tax_category, refund_policy_version, effective_from, effective_until
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::char(2)[], $11::varchar[],
         $12, $13, $14::timestamptz, $15::timestamptz)
       ON CONFLICT (catalog_version, price_id, version) DO NOTHING`,
      [
        catalog.version,
        price.priceId,
        price.version,
        price.productCode,
        price.productVersion,
        price.status,
        price.currencyCode,
        price.amountMinor,
        price.billingInterval,
        price.countryCodes,
        price.providerEligibility,
        price.taxCategory,
        price.refundPolicyVersion,
        price.effectiveFrom,
        price.effectiveUntil,
      ],
    );

    const attestation = await client.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM "_prisma_migrations"
            WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL
         ) AS "policyMigrationComplete",
         EXISTS (
           SELECT 1 FROM "_prisma_migrations"
            WHERE migration_name = $2 AND finished_at IS NOT NULL AND rolled_back_at IS NULL
         ) AS "catalogMigrationComplete",
         (SELECT count(*)::integer FROM catalog_version WHERE environment = 'production')
           AS "productionCatalogCount",
         (SELECT count(*)::integer FROM country_policy_version
           WHERE environment = 'production' AND country_code = 'US')
           AS "productionPolicyCount",
         (SELECT count(*)::integer FROM catalog_product WHERE catalog_version = $3)
           AS "productCount",
         (SELECT count(*)::integer FROM catalog_product_localization WHERE catalog_version = $3)
           AS "localizationCount",
         (SELECT count(*)::integer FROM catalog_price WHERE catalog_version = $3)
           AS "priceCount",
         pg_has_role($4, $5, 'MEMBER') AS "appIsCatalogReader",
         pg_has_role($4, $6, 'MEMBER') AS "appIsCatalogWriter",
         pg_has_role($4, $7, 'MEMBER') AS "appIsCountryPolicyReader",
         pg_has_role($4, $8, 'MEMBER') AS "appIsCountryPolicyWriter",
         has_table_privilege($4, 'catalog_version', 'SELECT')
           AND has_table_privilege($4, 'catalog_product', 'SELECT')
           AND has_table_privilege($4, 'catalog_product_localization', 'SELECT')
           AND has_table_privilege($4, 'catalog_price', 'SELECT') AS "appCanReadCatalog",
         has_table_privilege($4, 'country_policy_version', 'SELECT')
           AS "appCanReadCountryPolicy",
         has_table_privilege(
           $4,
           'catalog_version',
           'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
         ) OR has_any_column_privilege($4, 'catalog_version', 'INSERT,UPDATE,REFERENCES')
           AS "appCanMutateCatalog",
         has_table_privilege(
           $4,
           'country_policy_version',
           'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
         ) OR has_any_column_privilege(
           $4,
           'country_policy_version',
           'INSERT,UPDATE,REFERENCES'
         ) AS "appCanMutateCountryPolicy",
         COALESCE(
           (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
              FROM pg_roles WHERE rolname = $9),
           true
         ) AS "paymentRolePrivileged",
         has_database_privilege($9, current_database(), 'CREATE') AS "paymentCanCreateDatabase",
         has_schema_privilege($9, 'public', 'CREATE') AS "paymentCanCreateSchema",
         has_table_privilege($9, 'commercial_order_v2', 'SELECT')
           AND has_any_column_privilege($9, 'commercial_order_v2', 'UPDATE')
           AND has_table_privilege($9, 'commercial_order_item_v2', 'SELECT')
           AND has_table_privilege($9, 'catalog_price', 'SELECT')
           AND has_table_privilege($9, 'commercial_payment_attempt_v2', 'SELECT')
           AND has_any_column_privilege($9, 'commercial_payment_attempt_v2', 'UPDATE')
           AND has_table_privilege($9, 'commercial_payment_event_v2', 'SELECT')
           AND has_table_privilege($9, 'commercial_payment_event_v2', 'INSERT')
           AND has_any_column_privilege($9, 'commercial_payment_event_v2', 'UPDATE')
           AND has_table_privilege($9, 'commercial_payment_outbox_v2', 'SELECT')
           AND has_table_privilege($9, 'commercial_payment_outbox_v2', 'INSERT')
           AND has_any_column_privilege($9, 'commercial_payment_outbox_v2', 'UPDATE')
           AND has_table_privilege($9, 'credit_ledger_entry', 'SELECT')
           AND has_table_privilege($9, 'credit_ledger_entry', 'INSERT')
           AND has_table_privilege($9, 'credit_projection', 'SELECT')
           AND has_table_privilege($9, 'credit_projection', 'INSERT')
           AND has_any_column_privilege($9, 'credit_projection', 'UPDATE')
           AND has_table_privilege($9, 'commercial_entitlement_v2', 'SELECT')
           AND has_table_privilege($9, 'commercial_entitlement_v2', 'INSERT')
           AND has_any_column_privilege($9, 'commercial_entitlement_v2', 'UPDATE')
           AND has_table_privilege($9, 'commercial_subscription_v2', 'SELECT')
           AND has_table_privilege($9, 'commercial_subscription_v2', 'INSERT')
           AND has_any_column_privilege($9, 'commercial_subscription_v2', 'UPDATE')
           AND has_table_privilege($9, 'commercial_subscription_period_v2', 'SELECT')
           AND has_table_privilege($9, 'commercial_subscription_period_v2', 'INSERT')
           AND has_table_privilege($9, 'commercial_commerce_audit_v2', 'INSERT')
           AS "paymentCanProcessWebhook",
         has_table_privilege($9, 'credit_ledger_entry', 'DELETE')
           OR has_table_privilege($9, 'credit_projection', 'DELETE')
           OR has_table_privilege($9, 'commercial_entitlement_v2', 'DELETE')
           OR has_table_privilege($9, 'commercial_subscription_v2', 'DELETE')
           OR has_table_privilege($9, 'commercial_subscription_period_v2', 'DELETE')
           OR has_table_privilege($9, 'commercial_commerce_audit_v2', 'DELETE')
           AS "paymentCanDeleteFinancial"`,
      [
        productionPolicyMigration,
        productionCatalogMigration,
        catalogVersion,
        appRole,
        catalogReaderRole,
        catalogWriterRole,
        countryPolicyReaderRole,
        countryPolicyWriterRole,
        paymentWebhookRole,
      ],
    );
    const state = attestation.rows[0];
    if (
      state === undefined ||
      !state.policyMigrationComplete ||
      !state.catalogMigrationComplete ||
      state.productionCatalogCount !== 1 ||
      state.productionPolicyCount !== 1 ||
      state.productCount !== 1 ||
      state.localizationCount !== 1 ||
      state.priceCount !== 1 ||
      !state.appIsCatalogReader ||
      state.appIsCatalogWriter ||
      !state.appIsCountryPolicyReader ||
      state.appIsCountryPolicyWriter ||
      !state.appCanReadCatalog ||
      !state.appCanReadCountryPolicy ||
      state.appCanMutateCatalog ||
      state.appCanMutateCountryPolicy ||
      state.paymentRolePrivileged ||
      state.paymentCanCreateDatabase ||
      state.paymentCanCreateSchema ||
      !state.paymentCanProcessWebhook ||
      state.paymentCanDeleteFinancial
    ) {
      fail("Production registry or least-privilege attestation failed.");
    }

    const [persistedCatalog, persistedPolicy] = await Promise.all([
      client.query(
        `SELECT cv.schema_version AS "catalogSchemaVersion",
                cv.version AS "catalogVersion",
                cv.supersedes_version AS "catalogSupersedesVersion",
                cv.environment AS "catalogEnvironment",
                cv.status AS "catalogStatus",
                cv.approval_mode AS "catalogApprovalMode",
                cv.default_locale AS "catalogDefaultLocale",
                cv.supported_locales AS "catalogSupportedLocales",
                to_char(
                  cv.effective_from AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS "catalogEffectiveFrom",
                cv.effective_until AS "catalogEffectiveUntil",
                to_char(
                  cv.next_review_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS "catalogNextReviewAt",
                cv.source_reference AS "catalogSourceReference",
                cv.source_checksum_sha256 AS "catalogSourceChecksumSha256",
                cv.owner_reference AS "catalogOwnerReference",
                cv.actor_id AS "catalogActorId",
                cp.code AS "productCode",
                cp.version AS "productVersion",
                cp.kind AS "productKind",
                cp.status AS "productStatus",
                cp.fulfillment_code AS "productFulfillmentCode",
                cp.credits_granted AS "productCreditsGranted",
                cp.credits_cost AS "productCreditsCost",
                cp.credits_per_month AS "productCreditsPerMonth",
                cp.subscription_interval AS "productSubscriptionInterval",
                cpl.locale AS "localizationLocale",
                cpl.title AS "localizationTitle",
                cpl.description AS "localizationDescription",
                cpl.exact_contents AS "localizationExactContents",
                pr.price_id AS "priceId",
                pr.version AS "priceVersion",
                pr.status AS "priceStatus",
                pr.currency_code AS "priceCurrencyCode",
                pr.amount_minor AS "priceAmountMinor",
                pr.billing_interval AS "priceBillingInterval",
                pr.country_codes AS "priceCountryCodes",
                pr.provider_eligibility AS "priceProviderEligibility",
                pr.tax_category AS "priceTaxCategory",
                pr.refund_policy_version AS "priceRefundPolicyVersion",
                to_char(
                  pr.effective_from AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ) AS "priceEffectiveFrom",
                pr.effective_until AS "priceEffectiveUntil"
           FROM catalog_version cv
           JOIN catalog_product cp ON cp.catalog_version = cv.version
           JOIN catalog_product_localization cpl
             ON cpl.catalog_version = cp.catalog_version
            AND cpl.product_code = cp.code
            AND cpl.product_version = cp.version
           JOIN catalog_price pr
             ON pr.catalog_version = cp.catalog_version
            AND pr.product_code = cp.code
            AND pr.product_version = cp.version
          WHERE cv.version = $1`,
        [catalogVersion],
      ),
      client.query(
        `SELECT policy_document AS "policyDocument"
           FROM country_policy_version WHERE version = $1`,
        [countryPolicyVersion],
      ),
    ]);
    const persistedCatalogRow = persistedCatalog.rows[0];
    const expectedCatalogRow = {
      catalogActorId: actorId,
      catalogApprovalMode: catalog.approvalMode,
      catalogDefaultLocale: catalog.defaultLocale,
      catalogEffectiveFrom: catalog.effectiveFrom,
      catalogEffectiveUntil: catalog.effectiveUntil,
      catalogEnvironment: catalog.environment,
      catalogNextReviewAt: catalog.nextReviewAt,
      catalogOwnerReference: catalog.evidence.ownerReference,
      catalogSchemaVersion: catalog.schemaVersion,
      catalogSourceChecksumSha256: catalog.evidence.sourceChecksumSha256,
      catalogSourceReference: catalog.evidence.sourceReference,
      catalogStatus: catalog.status,
      catalogSupersedesVersion: catalog.supersedesVersion,
      catalogSupportedLocales: catalog.supportedLocales,
      catalogVersion: catalog.version,
      localizationDescription: product.localizations[0]?.description,
      localizationExactContents: product.localizations[0]?.exactContents,
      localizationLocale: product.localizations[0]?.locale,
      localizationTitle: product.localizations[0]?.title,
      priceAmountMinor: price.amountMinor,
      priceBillingInterval: price.billingInterval,
      priceCountryCodes: price.countryCodes,
      priceCurrencyCode: price.currencyCode,
      priceEffectiveFrom: price.effectiveFrom,
      priceEffectiveUntil: price.effectiveUntil,
      priceId: price.priceId,
      priceProviderEligibility: price.providerEligibility,
      priceRefundPolicyVersion: price.refundPolicyVersion,
      priceStatus: price.status,
      priceTaxCategory: price.taxCategory,
      priceVersion: price.version,
      productCode: product.code,
      productCreditsCost: product.creditsCost,
      productCreditsGranted: product.creditsGranted,
      productCreditsPerMonth: product.creditsPerMonth,
      productFulfillmentCode: product.fulfillmentCode,
      productKind: product.kind,
      productStatus: product.status,
      productSubscriptionInterval: product.subscriptionInterval,
      productVersion: product.version,
    };
    if (
      persistedCatalog.rows.length !== 1 ||
      canonicalJson(persistedCatalogRow) !== canonicalJson(expectedCatalogRow) ||
      canonicalJson(persistedPolicy.rows[0]?.policyDocument) !== canonicalJson(countryPolicy)
    ) {
      fail("Production append-only catalog or policy differs from the authorized source.");
    }

    await client.query("COMMIT");
    process.stdout.write(
      `${JSON.stringify({
        catalogChecksumSha256: catalog.evidence.sourceChecksumSha256,
        catalogVersion,
        configured: true,
        countryPolicyVersion,
        databaseName,
        productionCatalogMigration,
        productionPolicyMigration,
        resourceName,
        stripeAccountId,
        stripePriceId,
        stripeWebhookEndpointId,
      })}\n`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  await client.end().catch(() => undefined);
}
