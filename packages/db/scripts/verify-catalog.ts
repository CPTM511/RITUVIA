import assert from "node:assert/strict";

import { Client } from "pg";

import { assertCatalogRuntimeDatabasePrivileges, readCatalogVersions } from "../src/catalogs.js";
import { createDatabaseClient } from "../src/client.js";
import {
  ensureRuntimeDatabasePrivileges,
  runLocalPrisma,
  stopLeaseOwnedRuntime,
  verifyLogicalDumpRestore,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const expectPostgresError = async (
  operation: () => Promise<unknown>,
  codes: readonly string[],
): Promise<void> => {
  try {
    await operation();
    assert.fail(`Expected PostgreSQL error ${codes.join(" or ")}.`);
  } catch (error) {
    const observed = (error as { code?: unknown }).code;
    const serialized = `${String(error)} ${JSON.stringify(error)}`;
    assert(
      codes.includes(String(observed)) ||
        (observed === "P2010" && codes.some((code) => serialized.includes(code))),
      `Observed unexpected PostgreSQL error ${String(observed)}.`,
    );
  }
};

await withLocalPostgresLease(async (lease) => {
  const databases: Array<Awaited<ReturnType<typeof lease.createTestDatabase>>> = [];
  let primaryError: unknown;
  try {
    const database = await lease.createTestDatabase();
    databases.push(database);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["generate"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["migrate", "deploy"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    runLocalPrisma(lease.runtime, database.migrationDatabaseUrl, ["db", "seed"]);
    await ensureRuntimeDatabasePrivileges(lease.runtime, database.databaseName);

    const application = createDatabaseClient(database.databaseUrl);
    const control = new Client({ connectionString: database.controlDatabaseUrl });
    const migrator = new Client({ connectionString: database.migrationDatabaseUrl });
    await Promise.all([control.connect(), migrator.connect()]);
    try {
      await assertCatalogRuntimeDatabasePrivileges(application);
      const loaded = await readCatalogVersions(application, { environment: "local" });
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0]?.version, "local.catalog.2026-07-23.v1");
      assert.equal(loaded[0]?.environment, "local");
      assert.equal(loaded[0]?.approvalMode, "local_test");
      assert.equal(
        loaded[0]?.evidence.sourceChecksumSha256,
        "723e3d723dc237c9eb496ccd2045150859000741915d5a0dd7f7199ee796a708",
      );
      assert.equal(loaded[0]?.products.length, 21);
      assert.equal(loaded[0]?.prices.length, 5);
      assert.equal(
        loaded[0]?.products.find(({ code }) => code === "plus_annual")?.creditsPerMonth,
        8,
      );
      assert.equal(loaded[0]?.products.find(({ code }) => code === "golden_bowl")?.creditsCost, 8);
      assert.deepEqual(
        loaded[0]?.prices.find(({ productCode }) => productCode === "pack_40"),
        {
          amountMinor: 2_499,
          billingInterval: "one_time",
          countryCodes: ["US"],
          currencyCode: "USD",
          effectiveFrom: "2026-07-23T00:00:00.000Z",
          effectiveUntil: null,
          priceId: "price.pack_40.usd.2026-07-23",
          productCode: "pack_40",
          productVersion: "2026-07-23",
          providerEligibility: ["stripe", "coinbase_usdc_base"],
          refundPolicyVersion: "test:local:refund.v1",
          status: "active",
          taxCategory: "digital_service",
          version: "2026-07-23",
        },
      );
      assert(Object.isFrozen(loaded));
      assert(Object.isFrozen(loaded[0]));

      const counts = await migrator.query<{
        localizations: number;
        prices: number;
        products: number;
        versions: number;
      }>(`
        SELECT
          (SELECT count(*)::int FROM catalog_version) AS versions,
          (SELECT count(*)::int FROM catalog_product) AS products,
          (SELECT count(*)::int FROM catalog_product_localization) AS localizations,
          (SELECT count(*)::int FROM catalog_price) AS prices
      `);
      assert.deepEqual(counts.rows[0], {
        localizations: 42,
        prices: 5,
        products: 21,
        versions: 1,
      });

      for (const table of [
        "catalog_version",
        "catalog_product",
        "catalog_product_localization",
        "catalog_price",
      ]) {
        await expectPostgresError(
          () => application.$executeRawUnsafe(`UPDATE ${table} SET created_at = created_at`),
          ["42501"],
        );
        await expectPostgresError(
          () => application.$executeRawUnsafe(`DELETE FROM ${table}`),
          ["42501"],
        );
        await expectPostgresError(
          () => application.$executeRawUnsafe(`TRUNCATE ${table}`),
          ["42501"],
        );
        await expectPostgresError(
          () => control.query(`UPDATE ${table} SET created_at = created_at`),
          ["42501"],
        );
        await expectPostgresError(() => control.query(`DELETE FROM ${table}`), ["42501"]);
        await expectPostgresError(() => control.query(`TRUNCATE ${table}`), ["42501"]);
      }

      await expectPostgresError(
        () =>
          application.$executeRaw`
            INSERT INTO catalog_version (
              schema_version, version, environment, status, approval_mode, default_locale,
              supported_locales, effective_from, next_review_at, source_reference,
              source_checksum_sha256, owner_reference, actor_id
            ) VALUES (
              'catalog-version.v1', 'local.forbidden.v1', 'local', 'disabled', 'local_test',
              'en', ARRAY['en'], '2026-07-25T00:00:00.000Z', '2027-07-25T00:00:00.000Z',
              'test/catalog.json', repeat('a', 64), 'test:owner', 'catalog.test'
            )
          `,
        ["42501"],
      );

      await expectPostgresError(
        () =>
          control.query(`
            INSERT INTO catalog_product (
              catalog_version, code, version, kind, status, fulfillment_code, credits_cost
            ) VALUES (
              'local.catalog.2026-07-23.v1', 'invalid_free', '2026-07-23',
              'free_object', 'active', 'sanctuary.invalid_free', 1
            )
          `),
        ["23514"],
      );

      await expectPostgresError(
        () =>
          control.query(`
            INSERT INTO catalog_product_localization (
              catalog_version, product_code, product_version, locale, title,
              description, exact_contents
            ) VALUES (
              'local.catalog.2026-07-23.v1', 'pack_6', '2026-07-23', 'not_locale',
              'Six Credits', 'Invalid locale', ARRAY['Six Credits']
            )
          `),
        ["23514"],
      );

      await expectPostgresError(
        () =>
          control.query(`
            INSERT INTO catalog_price (
              catalog_version, price_id, version, product_code, product_version, status,
              currency_code, amount_minor, billing_interval, country_codes,
              provider_eligibility, tax_category, refund_policy_version, effective_from
            ) VALUES (
              'local.catalog.2026-07-23.v1', 'price.pack_6.zero', 'zero',
              'pack_6', '2026-07-23', 'active', 'EUR', 0, 'one_time', ARRAY['DE'],
              ARRAY['stripe'], 'digital_service', 'test:local:refund.v1',
              '2026-07-24T00:00:00.000Z'
            )
          `),
        ["23514"],
      );

      await expectPostgresError(
        () =>
          control.query(`
            INSERT INTO catalog_price (
              catalog_version, price_id, version, product_code, product_version, status,
              currency_code, amount_minor, billing_interval, country_codes,
              provider_eligibility, tax_category, refund_policy_version, effective_from
            ) VALUES (
              'local.catalog.2026-07-23.v1', 'price.pack_6.provider', 'provider',
              'pack_6', '2026-07-23', 'active', 'EUR', 600, 'one_time', ARRAY['DE'],
              ARRAY['paypal'], 'digital_service',
              'test:local:refund.v1', '2026-07-24T00:00:00.000Z'
            )
          `),
        ["23514"],
      );

      await expectPostgresError(
        () =>
          control.query(`
            INSERT INTO catalog_version (
              schema_version, version, environment, status, approval_mode, default_locale,
              supported_locales, effective_from, next_review_at, source_reference,
              source_checksum_sha256, owner_reference, actor_id
            ) VALUES (
              'catalog-version.v1', 'production.test-forbidden.v1', 'production', 'active',
              'local_test', 'en', ARRAY['en'], '2026-07-25T00:00:00.000Z',
              '2027-07-25T00:00:00.000Z', 'test/catalog.json', repeat('b', 64),
              'test:owner', 'catalog.test'
            )
          `),
        ["23514", "42501"],
      );

      await control.query(`
          INSERT INTO public.catalog_version (
            schema_version, version, environment, status, approval_mode, default_locale,
            supported_locales, effective_from, next_review_at, source_reference,
            source_checksum_sha256, owner_reference, actor_id
          ) VALUES (
            'catalog-version.v1', 'production.us.pack-6.d099.v1', 'production',
            'active', 'written', 'en', ARRAY['en'], '2026-08-12T00:00:00.000Z',
            '2027-08-12T00:00:00.000Z',
            'docs/codex/rituvia-production-2026-07-23/contracts/catalog.json', repeat('c', 64),
            'D-099:stripe-live:us:pack-6', 'owner.production-activation'
          )
        `);
      await control.query(`
          INSERT INTO public.catalog_product (
            catalog_version, code, version, kind, status, fulfillment_code, credits_granted,
            credits_cost, credits_per_month, subscription_interval
          ) VALUES (
            'production.us.pack-6.d099.v1', 'pack_6', '2026-07-23', 'credit_pack', 'active',
            'credits.pack_6', 6, NULL, NULL, NULL
          )
        `);
      await control.query(`
          INSERT INTO public.catalog_product_localization (
            catalog_version, product_code, product_version, locale, title, description,
            exact_contents
          ) VALUES (
            'production.us.pack-6.d099.v1', 'pack_6', '2026-07-23', 'en', '6 Credits',
            'A one-time pack of non-transferable RITUVIA service entitlements.',
            ARRAY[
              '6 Credits', 'Added once after verified payment',
              'Non-transferable digital service entitlements with no cash value'
            ]
          )
        `);
      await control.query(`
          INSERT INTO public.catalog_price (
            catalog_version, price_id, version, product_code, product_version, status,
            currency_code, amount_minor, billing_interval, country_codes,
            provider_eligibility, tax_category, refund_policy_version, effective_from
          ) VALUES (
            'production.us.pack-6.d099.v1', 'price.pack_6.usd.production.d099.v1',
            'production.d099.v1', 'pack_6', '2026-07-23', 'active', 'USD', 599,
            'one_time', ARRAY['US'], ARRAY['stripe'], 'digital_service',
            'production.refund.v1', '2026-08-12T00:00:00.000Z'
          )
        `);
      await expectPostgresError(
        () =>
          control.query(`
              INSERT INTO public.catalog_product (
                catalog_version, code, version, kind, status, fulfillment_code, credits_granted,
                credits_cost, credits_per_month, subscription_interval
              ) VALUES (
                'production.us.pack-6.d099.v1', 'pack_15', '2026-07-23', 'credit_pack',
                'active', 'credits.pack_15', 15, NULL, NULL, NULL
              )
            `),
        ["23514"],
      );
      await expectPostgresError(
        () =>
          control.query(`
              INSERT INTO public.catalog_price (
                catalog_version, price_id, version, product_code, product_version, status,
                currency_code, amount_minor, billing_interval, country_codes,
                provider_eligibility, tax_category, refund_policy_version, effective_from
              ) VALUES (
                'production.us.pack-6.d099.v1', 'price.pack_6.usd.production.d099.wrong',
                'production.d099.wrong', 'pack_6', '2026-07-23', 'active', 'USD', 699,
                'one_time', ARRAY['US'], ARRAY['stripe'], 'digital_service',
                'production.refund.v1', '2026-08-12T00:00:00.000Z'
              )
            `),
        ["23514"],
      );
      await expectPostgresError(
        () =>
          control.query(`
              INSERT INTO public.catalog_version (
                schema_version, version, environment, status, approval_mode, default_locale,
                supported_locales, effective_from, next_review_at, source_reference,
                source_checksum_sha256, owner_reference, actor_id
              ) VALUES (
                'catalog-version.v1', 'staging.d099-forbidden.v1', 'staging', 'disabled',
                'written', 'en', ARRAY['en'], '2026-08-12T00:00:00.000Z',
                '2027-08-12T00:00:00.000Z', 'records/decisions/D-099.md', repeat('d', 64),
                'D-099:stripe-live:us:pack-6', 'owner.production-activation'
              )
            `),
        ["42501"],
      );
      await expectPostgresError(
        () =>
          control.query(`
              INSERT INTO public.catalog_version (
                schema_version, version, environment, status, approval_mode, default_locale,
                supported_locales, effective_from, next_review_at, source_reference,
                source_checksum_sha256, owner_reference, actor_id
              ) VALUES (
                'catalog-version.v1', 'production.d099-wrong-scope.v1', 'production', 'disabled',
                'written', 'en', ARRAY['en'], '2026-08-12T00:00:00.000Z',
                '2027-08-12T00:00:00.000Z', 'records/decisions/D-099.md', repeat('e', 64),
                'D-099:stripe-live:plus-monthly', 'owner.production-activation'
              )
            `),
        ["42501"],
      );

      const restored = await lease.createTestDatabase();
      databases.push(restored);
      await verifyLogicalDumpRestore(lease.runtime, database, restored);
      runLocalPrisma(lease.runtime, restored.migrationDatabaseUrl, ["migrate", "deploy"]);
      await ensureRuntimeDatabasePrivileges(lease.runtime, restored.databaseName);
      const restoredApplication = createDatabaseClient(restored.databaseUrl);
      try {
        await assertCatalogRuntimeDatabasePrivileges(restoredApplication);
        const restoredCatalogs = await readCatalogVersions(restoredApplication, {
          environment: "local",
        });
        assert.equal(restoredCatalogs.length, 1);
        assert.equal(restoredCatalogs[0]?.products.length, 21);
        assert.equal(restoredCatalogs[0]?.prices.length, 5);
      } finally {
        await restoredApplication.$disconnect();
      }
    } finally {
      await Promise.all([application.$disconnect(), control.end(), migrator.end()]);
    }
  } catch (error) {
    primaryError = error;
  } finally {
    for (const database of databases.reverse()) {
      try {
        await database.drop();
      } catch (cleanupError) {
        primaryError ??= cleanupError;
      }
    }
    try {
      await stopLeaseOwnedRuntime(lease);
    } catch (cleanupError) {
      primaryError ??= cleanupError;
    }
  }
  if (primaryError !== undefined) throw primaryError;
});

process.stdout.write(
  "Verified immutable catalog versions, exact products/prices, local-only seed, database constraints, least privileges, and logical restore.\n",
);
