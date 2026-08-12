import { createHash } from "node:crypto";

import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import pg from "pg";

const { Client } = pg;

const resourceName = "rituvia-recovery-staging";
const databaseName = "neondb";
const appRole = "rituvia_app";
const paymentWebhookRole = "rituvia_payment_webhook";
const aiGenerationRole = "rituvia_ai_generation";
const previousCatalogVersion = "staging.catalog.2026-08-07.item10.v1";
const previousCountryPolicyVersion = "staging.us.stripe-test.item10.v1";
const catalogVersion = "recovery.item11.2026-08-08.v1";
const countryPolicyVersion = "staging.us.coinbase-sandbox.item11.v1";
const expectedConfirmation = `configure:${resourceName}/item-11`;
const effectiveFrom = "2026-08-08T00:00:00.000Z";
const nextReviewAt = "2026-09-03T00:00:00.000Z";
const paidProductCodes = Object.freeze([
  "pack_15",
  "pack_40",
  "pack_6",
  "plus_annual",
  "plus_monthly",
]);
const productCodes = Object.freeze(["deep_one", ...paidProductCodes]);

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

const products = rituviaCatalog20260723LocalData.products
  .filter(({ code }) => productCodes.includes(code))
  .map((product) => ({
    ...product,
    localizations: product.localizations.filter(({ locale }) => locale === "en"),
  }))
  .sort(({ code: left }, { code: right }) => left.localeCompare(right));
const prices = rituviaCatalog20260723LocalData.prices
  .filter(({ productCode }) => paidProductCodes.includes(productCode))
  .map((price) => ({
    ...price,
    effectiveFrom,
    priceId: `price.${price.productCode}.usd.item11`,
    providerEligibility:
      price.productCode === "pack_6" ? ["stripe", "coinbase_usdc_base"] : ["stripe"],
    refundPolicyVersion: "staging.item11.refund.v1",
    version: "2026-08-08.item11",
  }))
  .sort(({ productCode: left }, { productCode: right }) => left.localeCompare(right));

const catalogSource = Object.freeze({
  approvalMode: "written",
  defaultLocale: "en",
  effectiveFrom,
  effectiveUntil: null,
  environment: "staging",
  nextReviewAt,
  prices,
  products,
  schemaVersion: "catalog-version.v1",
  status: "active",
  supersedesVersion: previousCatalogVersion,
  supportedLocales: ["en"],
  version: catalogVersion,
});
const catalog = Object.freeze({
  ...catalogSource,
  evidence: Object.freeze({
    ownerReference: "D-098:OWNER:item-11:protected-staging",
    sourceChecksumSha256: sha256(canonicalJson(catalogSource)),
    sourceReference: "docs/recovery/RECOVERY_BACKLOG.md",
  }),
});

const countryPolicy = Object.freeze({
  approvalMode: "written",
  countryCode: "US",
  crypto: {
    assets: ["USDC"],
    enabled: true,
    providerRoute: "coinbase_usdc_base",
  },
  dataFlags: ["private_by_default"],
  effectiveFrom,
  effectiveUntil: null,
  environment: "staging",
  evidence: {
    cryptoApprovalReference: "D-098:OWNER:item-11:coinbase-sandbox:2026-08-08",
    fiatApprovalReference: "D-098:OWN-017:stripe-test:item-10",
    legalReference: "D-098:protected-staging-no-public-legal-activation",
    ownerReference: "D-098:OWNER:item-11:protected-staging",
    providerReference: "coinbase-business:sandbox:usdc-base:item-11",
  },
  fiat: {
    currencies: ["USD"],
    enabled: true,
    methods: ["card"],
    providerRoutes: ["stripe"],
    recurringAllowed: true,
  },
  legalDocumentVersions: [
    { documentCode: "privacy", version: "staging_only.privacy.item9.v1" },
    { documentCode: "terms", version: "staging_only.terms.item11.v1" },
  ],
  localeTags: ["en"],
  marketingFlags: ["no_fear_upsell"],
  minimumAge: 18,
  modalities: ["ritual"],
  nextReviewAt,
  prohibitedClaims: ["guaranteed_outcome"],
  products: productCodes.map((productCode) => ({
    access: "paid",
    productCode,
    subscriptionAllowed: productCode.startsWith("plus_"),
  })),
  refundPolicyVersion: "staging.item11.refund.v1",
  requiredDisclosures: [
    "ai_generated",
    "coinbase_sandbox",
    "digital_contents",
    "reflective_not_predictive",
    "stripe_test_mode",
  ],
  schemaVersion: "country-policy-version.v1",
  status: "paid",
  supersedesVersion: previousCountryPolicyVersion,
  supportAvailable: true,
  taxMode: "not_applicable",
  version: countryPolicyVersion,
});

const adminDatabaseUrl = environmentValue("RITUVIA_ITEM11_ADMIN_DATABASE_URL");
const rolePassword = environmentValue("RITUVIA_ITEM11_AI_GENERATION_ROLE_PASSWORD");
if (
  process.env.APP_ENV !== "staging" ||
  process.env.RITUVIA_STAGING_RESOURCE_NAME !== resourceName ||
  process.env.RITUVIA_ITEM11_STAGING_CONFIRM !== expectedConfirmation ||
  process.env.VERCEL_ENV === "production" ||
  adminDatabaseUrl === undefined ||
  rolePassword === undefined
) {
  fail("Recovery Item 11 staging configuration is not explicitly authorized.");
}
if (!/^[A-Za-z0-9_-]{43}$/u.test(rolePassword)) {
  fail("Recovery Item 11 AI-generation password must be an exact 32-byte base64url secret.");
}

const parsedAdminUrl = new URL(adminDatabaseUrl);
if (
  !["postgres:", "postgresql:"].includes(parsedAdminUrl.protocol) ||
  !parsedAdminUrl.hostname.endsWith(".neon.tech") ||
  parsedAdminUrl.pathname !== `/${databaseName}` ||
  parsedAdminUrl.username === "" ||
  [appRole, paymentWebhookRole, aiGenerationRole].includes(
    decodeURIComponent(parsedAdminUrl.username),
  ) ||
  parsedAdminUrl.password === "" ||
  parsedAdminUrl.searchParams.get("sslmode") !== "require"
) {
  fail("Recovery Item 11 administrator connection is not the expected Neon TLS target.");
}

const client = new Client({
  application_name: "rituvia-recovery-item-11-sandbox-ai-configuration",
  connectionString: adminDatabaseUrl,
});

try {
  await client.connect();
  const before = await client.query(
    `SELECT current_database() AS "databaseName",
            current_user AS "currentUser",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS "appRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $2) AS "paymentRoleExists",
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $3) AS "aiRoleExists",
            COALESCE(
              (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user),
              false
            ) AS "currentUserCanCreateRole",
            EXISTS (
              SELECT 1 FROM "_prisma_migrations"
               WHERE finished_at IS NULL AND rolled_back_at IS NULL
            ) AS "incompleteMigrationExists",
            EXISTS (SELECT 1 FROM catalog_version WHERE version = $4)
              AS "previousCatalogExists",
            EXISTS (SELECT 1 FROM country_policy_version WHERE version = $5)
              AS "previousPolicyExists"`,
    [
      appRole,
      paymentWebhookRole,
      aiGenerationRole,
      previousCatalogVersion,
      previousCountryPolicyVersion,
    ],
  );
  const facts = before.rows[0];
  if (
    facts === undefined ||
    facts.databaseName !== databaseName ||
    [appRole, paymentWebhookRole, aiGenerationRole].includes(facts.currentUser) ||
    !facts.appRoleExists ||
    !facts.paymentRoleExists ||
    (!facts.aiRoleExists && !facts.currentUserCanCreateRole) ||
    facts.incompleteMigrationExists ||
    !facts.previousCatalogExists ||
    !facts.previousPolicyExists
  ) {
    fail("Recovery Item 11 staging database attestation failed.");
  }

  if (!facts.aiRoleExists) {
    await client.query(
      `CREATE ROLE ${aiGenerationRole}
         NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
  }

  await client.query("BEGIN");
  try {
    await client.query(`ALTER ROLE ${aiGenerationRole} NOINHERIT LOGIN PASSWORD '${rolePassword}'`);
    await client.query(
      `REVOKE ALL PRIVILEGES ON DATABASE ${databaseName} FROM ${aiGenerationRole}`,
    );
    await client.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${aiGenerationRole}`);
    await client.query(
      `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${aiGenerationRole}`,
    );
    await client.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${aiGenerationRole}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${aiGenerationRole}`);
    await client.query(
      `GRANT SELECT, INSERT ON TABLE credit_reservation, credit_ledger_entry,
         credit_allocation TO ${aiGenerationRole}`,
    );
    await client.query(`GRANT SELECT ON TABLE credit_projection TO ${aiGenerationRole}`);
    await client.query(
      `GRANT UPDATE (status, consumed_at, released_at)
         ON credit_reservation TO ${aiGenerationRole}`,
    );
    await client.query(
      `GRANT UPDATE (subscription_available, promotional_available, purchased_available,
         reserved, version, updated_at) ON credit_projection TO ${aiGenerationRole}`,
    );

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
        "owner.founder-acceptance-recovery",
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
        "owner.founder-acceptance-recovery",
      ],
    );
    for (const product of catalog.products) {
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
      for (const localization of product.localizations) {
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
            localization.locale,
            localization.title,
            localization.description,
            localization.exactContents,
          ],
        );
      }
    }
    for (const price of catalog.prices) {
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
    }

    const attestation = await client.query(
      `SELECT
         (SELECT count(*)::integer FROM catalog_product WHERE catalog_version = $1)
           AS "productCount",
         (SELECT count(*)::integer FROM catalog_price WHERE catalog_version = $1)
           AS "priceCount",
         (SELECT provider_eligibility FROM catalog_price
           WHERE catalog_version = $1 AND product_code = 'pack_6')
           AS "packSixProviderEligibility",
         (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
            FROM pg_roles WHERE rolname = $2) AS "aiRolePrivileged",
         (SELECT rolinherit FROM pg_roles WHERE rolname = $2) AS "aiRoleInherits",
         has_database_privilege($2, current_database(), 'CREATE') AS "aiCanCreateDatabase",
         has_schema_privilege($2, 'public', 'CREATE') AS "aiCanCreateSchema",
         has_table_privilege($2, 'credit_reservation', 'SELECT')
           AND has_table_privilege($2, 'credit_reservation', 'INSERT')
           AND has_any_column_privilege($2, 'credit_reservation', 'UPDATE')
           AND has_table_privilege($2, 'credit_ledger_entry', 'SELECT')
           AND has_table_privilege($2, 'credit_ledger_entry', 'INSERT')
           AND has_table_privilege($2, 'credit_allocation', 'SELECT')
           AND has_table_privilege($2, 'credit_allocation', 'INSERT')
           AND has_table_privilege($2, 'credit_projection', 'SELECT')
           AND has_any_column_privilege($2, 'credit_projection', 'UPDATE')
           AS "aiCanUseCredits",
         has_table_privilege($2, 'credit_reservation', 'DELETE')
           OR has_table_privilege($2, 'credit_ledger_entry', 'DELETE')
           OR has_table_privilege($2, 'credit_allocation', 'DELETE')
           OR has_table_privilege($2, 'credit_projection', 'DELETE')
           AS "aiCanDeleteCredits",
         has_table_privilege(
           $2,
           'app_user',
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
         ) OR has_any_column_privilege($2, 'app_user', 'SELECT,INSERT,UPDATE,REFERENCES')
           OR has_table_privilege(
             $2,
             'commercial_payment_event_v2',
             'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
           )
           AS "aiCanAccessProtectedTables"`,
      [catalogVersion, aiGenerationRole],
    );
    const state = attestation.rows[0];
    if (
      state === undefined ||
      state.productCount !== productCodes.length ||
      state.priceCount !== paidProductCodes.length ||
      canonicalJson(state.packSixProviderEligibility) !==
        canonicalJson(["stripe", "coinbase_usdc_base"]) ||
      state.aiRolePrivileged ||
      state.aiRoleInherits ||
      state.aiCanCreateDatabase ||
      state.aiCanCreateSchema ||
      !state.aiCanUseCredits ||
      state.aiCanDeleteCredits ||
      state.aiCanAccessProtectedTables
    ) {
      fail("Recovery Item 11 least-privilege or registry attestation failed.");
    }

    const [persistedCatalog, persistedPolicy] = await Promise.all([
      client.query(
        `SELECT source_checksum_sha256 AS "sourceChecksumSha256",
                owner_reference AS "ownerReference", supersedes_version AS "supersedesVersion"
           FROM catalog_version WHERE version = $1`,
        [catalogVersion],
      ),
      client.query(
        `SELECT policy_document AS "policyDocument", supersedes_version AS "supersedesVersion"
           FROM country_policy_version WHERE version = $1`,
        [countryPolicyVersion],
      ),
    ]);
    if (
      persistedCatalog.rows[0]?.sourceChecksumSha256 !== catalog.evidence.sourceChecksumSha256 ||
      persistedCatalog.rows[0]?.ownerReference !== catalog.evidence.ownerReference ||
      persistedCatalog.rows[0]?.supersedesVersion !== previousCatalogVersion ||
      persistedPolicy.rows[0]?.supersedesVersion !== previousCountryPolicyVersion ||
      canonicalJson(persistedPolicy.rows[0]?.policyDocument) !== canonicalJson(countryPolicy)
    ) {
      fail("Recovery Item 11 append-only catalog or policy differs from the approved source.");
    }

    await client.query("COMMIT");
    process.stdout.write(
      `${JSON.stringify({
        aiGenerationRole,
        catalogChecksumSha256: catalog.evidence.sourceChecksumSha256,
        catalogVersion,
        configured: true,
        countryPolicyVersion,
        databaseName,
        migrationsApplied: 0,
        resourceName,
      })}\n`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  await client.end().catch(() => undefined);
}
