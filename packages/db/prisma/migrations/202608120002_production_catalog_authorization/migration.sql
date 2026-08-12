-- D-099 authorizes the exact Stripe-first production catalog without widening other environments.
BEGIN;

DROP POLICY "catalog_version_append" ON "catalog_version";
CREATE POLICY "catalog_version_append"
    ON "catalog_version"
    FOR INSERT
    TO "rituvia_catalog_writer"
    WITH CHECK (
        ("environment" = 'local' AND "approval_mode" = 'local_test')
        OR (
            "approval_mode" = 'written'
            AND (
                "owner_reference" LIKE 'OWN-%'
                OR (
                    "environment" = 'production'
                    AND "owner_reference" = 'D-099:stripe-live:us:pack-6'
                )
            )
        )
    );

ALTER TABLE "catalog_version"
    ADD CONSTRAINT "catalog_version_d099_scope_check" CHECK (
        (
            "version" <> 'production.us.pack-6.d099.v1'
            AND "owner_reference" <> 'D-099:stripe-live:us:pack-6'
        )
        OR (
            "version" = 'production.us.pack-6.d099.v1'
            AND "owner_reference" = 'D-099:stripe-live:us:pack-6'
            AND "environment" = 'production'
            AND "status" = 'active'
            AND "approval_mode" = 'written'
            AND "default_locale" = 'en'
            AND "supported_locales" = ARRAY['en']::VARCHAR(35)[]
            AND "supersedes_version" IS NULL
            AND "effective_until" IS NULL
            AND "effective_from" >= '2026-08-12T00:00:00.000Z'::TIMESTAMPTZ
            AND "source_reference"
                = 'docs/codex/rituvia-production-2026-07-23/contracts/catalog.json'
            AND "actor_id" = 'owner.production-activation'
        )
    );

ALTER TABLE "catalog_product"
    ADD CONSTRAINT "catalog_product_d099_scope_check" CHECK (
        "catalog_version" <> 'production.us.pack-6.d099.v1'
        OR (
            "code" = 'pack_6'
            AND "version" = '2026-07-23'
            AND "kind" = 'credit_pack'
            AND "status" = 'active'
            AND "fulfillment_code" = 'credits.pack_6'
            AND "credits_granted" = 6
            AND "credits_cost" IS NULL
            AND "credits_per_month" IS NULL
            AND "subscription_interval" IS NULL
        )
    );

ALTER TABLE "catalog_product_localization"
    ADD CONSTRAINT "catalog_product_localization_d099_scope_check" CHECK (
        "catalog_version" <> 'production.us.pack-6.d099.v1'
        OR (
            "product_code" = 'pack_6'
            AND "product_version" = '2026-07-23'
            AND "locale" = 'en'
            AND "title" = '6 Credits'
            AND "description"
                = 'A one-time pack of non-transferable RITUVIA service entitlements.'
            AND "exact_contents" = ARRAY[
                '6 Credits',
                'Added once after verified payment',
                'Non-transferable digital service entitlements with no cash value'
            ]::VARCHAR(500)[]
        )
    );

ALTER TABLE "catalog_price"
    ADD CONSTRAINT "catalog_price_d099_scope_check" CHECK (
        "catalog_version" <> 'production.us.pack-6.d099.v1'
        OR (
            "price_id" = 'price.pack_6.usd.production.d099.v1'
            AND "version" = 'production.d099.v1'
            AND "product_code" = 'pack_6'
            AND "product_version" = '2026-07-23'
            AND "status" = 'active'
            AND "currency_code" = 'USD'
            AND "amount_minor" = 599
            AND "billing_interval" = 'one_time'
            AND "country_codes" = ARRAY['US']::CHAR(2)[]
            AND "provider_eligibility" = ARRAY['stripe']::VARCHAR(32)[]
            AND "tax_category" = 'digital_service'
            AND "refund_policy_version" !~* '(test|draft|placeholder)'
            AND "effective_until" IS NULL
        )
    );

COMMIT;
