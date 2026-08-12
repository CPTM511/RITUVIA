import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import pg from "pg";

const { Client } = pg;

const resourceName = "rituvia-recovery-staging";
const databaseName = "neondb";
const appRole = "rituvia_app";
const catalogReaderRole = "rituvia_catalog_reader";
const countryPolicyReaderRole = "rituvia_country_policy_reader";
const paymentWebhookRole = "rituvia_payment_webhook";
const catalogVersion = "staging.catalog.2026-08-07.item10.v1";
const countryPolicyVersion = "staging.us.stripe-test.item10.v1";
const itemTenMigration = "202608070001_recovery_item_10_commerce";
const expectedConfirmation = `configure:${resourceName}/item-10`;
const effectiveFrom = "2026-08-07T00:00:00.000Z";
const nextReviewAt = "2026-09-03T00:00:00.000Z";
const productCodes = Object.freeze(["pack_15", "pack_40", "pack_6", "plus_annual", "plus_monthly"]);

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
  .filter(({ productCode }) => productCodes.includes(productCode))
  .map((price) => ({
    ...price,
    effectiveFrom,
    priceId: `price.${price.productCode}.usd.item10`,
    providerEligibility: ["stripe"],
    refundPolicyVersion: "staging.item10.refund.v1",
    version: "2026-08-07.item10",
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
  supersedesVersion: null,
  supportedLocales: ["en"],
  version: catalogVersion,
});
const catalog = Object.freeze({
  ...catalogSource,
  evidence: Object.freeze({
    ownerReference: "OWN-017:D-098:item-10",
    sourceChecksumSha256: sha256(canonicalJson(catalogSource)),
    sourceReference: "docs/recovery/RECOVERY_BACKLOG.md",
  }),
});

const countryPolicy = Object.freeze({
  approvalMode: "written",
  countryCode: "US",
  crypto: { assets: [], enabled: false, providerRoute: null },
  dataFlags: ["private_by_default"],
  effectiveFrom,
  effectiveUntil: null,
  environment: "staging",
  evidence: {
    cryptoApprovalReference: null,
    fiatApprovalReference: "D-098:OWN-017:stripe-test:item-10",
    legalReference: "D-098:protected-staging-no-public-legal-activation",
    ownerReference: "OWN-017:D-098:item-10",
    providerReference: "stripe:test-mode:item-10",
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
    { documentCode: "terms", version: "staging_only.terms.item10.v1" },
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
  refundPolicyVersion: "staging.item10.refund.v1",
  requiredDisclosures: ["digital_contents", "reflective_not_predictive", "stripe_test_mode"],
  schemaVersion: "country-policy-version.v1",
  status: "paid",
  supersedesVersion: null,
  supportAvailable: true,
  taxMode: "not_applicable",
  version: countryPolicyVersion,
});

const adminDatabaseUrl = environmentValue("RITUVIA_ITEM10_ADMIN_DATABASE_URL");
const rolePassword = environmentValue("RITUVIA_ITEM10_PAYMENT_WEBHOOK_ROLE_PASSWORD");
if (
  process.env.APP_ENV !== "staging" ||
  process.env.RITUVIA_STAGING_RESOURCE_NAME !== resourceName ||
  process.env.RITUVIA_ITEM10_STAGING_CONFIRM !== expectedConfirmation ||
  process.env.VERCEL_ENV === "production" ||
  adminDatabaseUrl === undefined ||
  rolePassword === undefined
) {
  fail("Recovery Item 10 staging configuration is not explicitly authorized.");
}
if (!/^[A-Za-z0-9_-]{43}$/u.test(rolePassword)) {
  fail("Recovery Item 10 payment-webhook password must be an exact 32-byte base64url secret.");
}

const parsedAdminUrl = new URL(adminDatabaseUrl);
if (
  !["postgres:", "postgresql:"].includes(parsedAdminUrl.protocol) ||
  !parsedAdminUrl.hostname.endsWith(".neon.tech") ||
  parsedAdminUrl.pathname !== `/${databaseName}` ||
  parsedAdminUrl.username === "" ||
  [appRole, paymentWebhookRole].includes(decodeURIComponent(parsedAdminUrl.username)) ||
  parsedAdminUrl.password === "" ||
  parsedAdminUrl.searchParams.get("sslmode") !== "require"
) {
  fail("Recovery Item 10 administrator connection is not the expected Neon TLS target.");
}

const runMigrations = () => {
  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DATABASE_URL: adminDatabaseUrl },
    encoding: "utf8",
  });
  if (result.stdout !== "") process.stdout.write(result.stdout);
  if (result.stderr !== "") process.stderr.write(result.stderr);
  if (result.status !== 0) fail("Recovery Item 10 staging migrations failed.");
};

const client = new Client({
  application_name: "rituvia-recovery-item-10-commerce-configuration",
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
            EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $4)
              AS "countryPolicyReaderRoleExists",
            COALESCE(
              (
                SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
                  FROM pg_roles WHERE rolname = $2
              ),
              false
            ) AS "paymentRolePrivileged",
            COALESCE(
              (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user),
              false
            ) AS "currentUserCanCreateRole",
            EXISTS (
              SELECT 1 FROM "_prisma_migrations"
               WHERE finished_at IS NULL AND rolled_back_at IS NULL
            ) AS "incompleteMigrationExists"`,
    [appRole, paymentWebhookRole, catalogReaderRole, countryPolicyReaderRole],
  );
  const facts = before.rows[0];
  if (
    facts === undefined ||
    facts.databaseName !== databaseName ||
    [appRole, paymentWebhookRole].includes(facts.currentUser) ||
    !facts.appRoleExists ||
    !facts.catalogReaderRoleExists ||
    !facts.countryPolicyReaderRoleExists ||
    (!facts.paymentRoleExists && !facts.currentUserCanCreateRole) ||
    facts.paymentRolePrivileged ||
    facts.incompleteMigrationExists
  ) {
    fail("Recovery Item 10 staging database attestation failed.");
  }

  if (!facts.paymentRoleExists) {
    await client.query(
      `CREATE ROLE ${paymentWebhookRole}
         NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
    );
  }

  runMigrations();

  await client.query("BEGIN");
  try {
    await client.query(
      `ALTER ROLE ${paymentWebhookRole}
         LOGIN PASSWORD '${rolePassword}'`,
    );
    await client.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${paymentWebhookRole}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${appRole}, ${paymentWebhookRole}`);
    await client.query(
      `GRANT SELECT ON TABLE catalog_version, catalog_product,
         catalog_product_localization, catalog_price TO ${catalogReaderRole}`,
    );
    await client.query(
      `GRANT SELECT ON TABLE country_policy_version TO ${countryPolicyReaderRole}`,
    );
    await client.query(`GRANT ${catalogReaderRole} TO ${appRole}`);
    await client.query(`GRANT ${countryPolicyReaderRole} TO ${appRole}`);
    await client.query(
      `GRANT SELECT, INSERT ON TABLE commercial_order_v2, commercial_order_item_v2,
         commercial_payment_attempt_v2 TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (status, updated_at) ON TABLE commercial_order_v2 TO ${appRole}`,
    );
    await client.query(
      `GRANT UPDATE (state, provider_checkout_id, provider_checkout_url, expires_at, updated_at)
         ON TABLE commercial_payment_attempt_v2 TO ${appRole}`,
    );
    await client.query(
      `GRANT SELECT ON TABLE credit_ledger_entry, credit_projection,
         commercial_subscription_v2 TO ${appRole}`,
    );
    await client.query(
      `GRANT SELECT ON TABLE commercial_order_v2, commercial_order_item_v2,
         commercial_payment_attempt_v2, commercial_payment_event_v2,
         commercial_payment_outbox_v2, catalog_price, credit_ledger_entry,
         credit_projection, commercial_entitlement_v2, commercial_subscription_v2,
         commercial_subscription_period_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT INSERT ON TABLE commercial_payment_event_v2, commercial_payment_outbox_v2,
         credit_ledger_entry, credit_projection, commercial_entitlement_v2,
         commercial_subscription_v2, commercial_subscription_period_v2,
         commercial_commerce_audit_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (status, refunded_minor, payment_state_version, updated_at, paid_at, refunded_at)
         ON commercial_order_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (state, provider_payment_intent_id, updated_at, completed_at)
         ON commercial_payment_attempt_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (order_id, payment_attempt_id, validation_state, processing_state,
         processing_disposition, processed_at)
         ON commercial_payment_event_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (delivery_state, attempt_count, available_at, lease_token_hash, leased_until,
         completed_at, last_failure_code, dead_lettered_at)
         ON commercial_payment_outbox_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (subscription_available, promotional_available, purchased_available,
         reserved, version, updated_at) ON credit_projection TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (status, frozen_at, revoked_at, version)
         ON commercial_entitlement_v2 TO ${paymentWebhookRole}`,
    );
    await client.query(
      `GRANT UPDATE (provider_subscription_id, status, cancel_at_period_end,
         current_period_start, current_period_end, updated_at, cancelled_at)
         ON commercial_subscription_v2 TO ${paymentWebhookRole}`,
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
         EXISTS (
           SELECT 1 FROM "_prisma_migrations"
            WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL
         ) AS "migrationComplete",
         (SELECT count(*)::integer FROM catalog_version WHERE environment = 'staging')
           AS "stagingCatalogCount",
         (SELECT count(*)::integer FROM country_policy_version
           WHERE environment = 'staging' AND country_code = 'US') AS "stagingPolicyCount",
         (SELECT count(*)::integer FROM catalog_product WHERE catalog_version = $2)
           AS "productCount",
         (SELECT count(*)::integer FROM catalog_price WHERE catalog_version = $2)
           AS "priceCount",
         (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
            FROM pg_roles WHERE rolname = $3) AS "paymentRolePrivileged",
         has_database_privilege($3, current_database(), 'CREATE') AS "paymentCanCreateDatabase",
         has_schema_privilege($3, 'public', 'CREATE') AS "paymentCanCreateSchema",
         has_table_privilege($3, 'commercial_commerce_audit_v2', 'DELETE')
           AS "paymentCanDeleteAudit",
         has_table_privilege($4, 'commercial_subscription_v2', 'INSERT')
           AS "appCanInsertSubscription",
         has_any_column_privilege($4, 'commercial_subscription_v2', 'UPDATE')
           AS "appCanUpdateSubscription",
         has_table_privilege($4, 'commercial_order_v2', 'SELECT')
           AND has_table_privilege($4, 'commercial_order_v2', 'INSERT')
           AND has_table_privilege($4, 'commercial_order_item_v2', 'SELECT')
           AND has_table_privilege($4, 'commercial_order_item_v2', 'INSERT')
           AND has_table_privilege($4, 'commercial_payment_attempt_v2', 'SELECT')
           AND has_table_privilege($4, 'commercial_payment_attempt_v2', 'INSERT')
           AS "appCanCreateCheckout",
         has_column_privilege($4, 'commercial_order_v2', 'status', 'UPDATE')
           AND has_column_privilege($4, 'commercial_order_v2', 'updated_at', 'UPDATE')
           AND has_column_privilege(
             $4,
             'commercial_payment_attempt_v2',
             'state',
             'UPDATE'
           )
           AND has_column_privilege(
             $4,
             'commercial_payment_attempt_v2',
             'provider_checkout_id',
             'UPDATE'
           )
           AND has_column_privilege(
             $4,
             'commercial_payment_attempt_v2',
             'provider_checkout_url',
             'UPDATE'
           )
           AND has_column_privilege(
             $4,
             'commercial_payment_attempt_v2',
             'expires_at',
             'UPDATE'
           )
           AND has_column_privilege(
             $4,
             'commercial_payment_attempt_v2',
             'updated_at',
             'UPDATE'
           ) AS "appCanAttachCheckout",
         has_table_privilege($4, 'credit_ledger_entry', 'SELECT')
           AND has_table_privilege($4, 'credit_projection', 'SELECT')
           AND has_table_privilege($4, 'commercial_subscription_v2', 'SELECT')
           AS "appCanReadCommerceAccount",
         has_table_privilege($4, 'commercial_payment_event_v2', 'INSERT')
           AS "appCanInsertPaymentEvent",
         has_table_privilege($4, 'credit_ledger_entry', 'INSERT')
           AS "appCanInsertCreditLedger",
         pg_has_role($4, $5, 'MEMBER') AS "appIsCatalogReader",
         has_table_privilege($4, 'catalog_version', 'SELECT')
           AND has_table_privilege($4, 'catalog_product', 'SELECT')
           AND has_table_privilege($4, 'catalog_product_localization', 'SELECT')
           AND has_table_privilege($4, 'catalog_price', 'SELECT')
           AS "appCanReadCatalog",
         has_table_privilege(
           $4,
           'catalog_version',
           'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
         )
           OR has_any_column_privilege($4, 'catalog_version', 'INSERT,UPDATE,REFERENCES')
           AS "appCanMutateCatalog",
         pg_has_role($4, $6, 'MEMBER') AS "appIsCountryPolicyReader",
         has_table_privilege($4, 'country_policy_version', 'SELECT')
           AS "appCanReadCountryPolicy",
         has_table_privilege(
           $4,
           'country_policy_version',
           'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
         )
           OR has_any_column_privilege(
             $4,
             'country_policy_version',
             'INSERT,UPDATE,REFERENCES'
           ) AS "appCanMutateCountryPolicy"`,
      [
        itemTenMigration,
        catalogVersion,
        paymentWebhookRole,
        appRole,
        catalogReaderRole,
        countryPolicyReaderRole,
      ],
    );
    const state = attestation.rows[0];
    if (
      state === undefined ||
      !state.migrationComplete ||
      state.stagingCatalogCount !== 1 ||
      state.stagingPolicyCount !== 1 ||
      state.productCount !== productCodes.length ||
      state.priceCount !== productCodes.length ||
      state.paymentRolePrivileged ||
      state.paymentCanCreateDatabase ||
      state.paymentCanCreateSchema ||
      state.paymentCanDeleteAudit ||
      state.appCanInsertSubscription ||
      state.appCanUpdateSubscription ||
      !state.appCanCreateCheckout ||
      !state.appCanAttachCheckout ||
      !state.appCanReadCommerceAccount ||
      state.appCanInsertPaymentEvent ||
      state.appCanInsertCreditLedger ||
      !state.appIsCatalogReader ||
      !state.appCanReadCatalog ||
      state.appCanMutateCatalog ||
      !state.appIsCountryPolicyReader ||
      !state.appCanReadCountryPolicy ||
      state.appCanMutateCountryPolicy
    ) {
      fail("Recovery Item 10 least-privilege or registry attestation failed.");
    }

    const [persistedCatalog, persistedPolicy] = await Promise.all([
      client.query(
        `SELECT source_checksum_sha256 AS "sourceChecksumSha256", owner_reference AS "ownerReference"
           FROM catalog_version WHERE version = $1`,
        [catalogVersion],
      ),
      client.query(
        `SELECT policy_document AS "policyDocument" FROM country_policy_version WHERE version = $1`,
        [countryPolicyVersion],
      ),
    ]);
    if (
      persistedCatalog.rows[0]?.sourceChecksumSha256 !== catalog.evidence.sourceChecksumSha256 ||
      persistedCatalog.rows[0]?.ownerReference !== catalog.evidence.ownerReference ||
      canonicalJson(persistedPolicy.rows[0]?.policyDocument) !== canonicalJson(countryPolicy)
    ) {
      fail("Recovery Item 10 append-only catalog or policy differs from the approved source.");
    }

    await client.query("COMMIT");
    process.stdout.write(
      `${JSON.stringify({
        catalogChecksumSha256: catalog.evidence.sourceChecksumSha256,
        catalogVersion,
        configured: true,
        countryPolicyVersion,
        databaseName,
        itemTenMigration,
        paymentWebhookRole,
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
