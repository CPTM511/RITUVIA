-- RIT-061 is expand-only and does not activate production pricing or a payment provider.
BEGIN;

CREATE TABLE "catalog_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schema_version" VARCHAR(100) NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "supersedes_version" VARCHAR(100),
    "environment" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "approval_mode" VARCHAR(16) NOT NULL,
    "default_locale" VARCHAR(35) NOT NULL,
    "supported_locales" VARCHAR(35)[] NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_until" TIMESTAMPTZ(6),
    "next_review_at" TIMESTAMPTZ(6) NOT NULL,
    "source_reference" VARCHAR(300) NOT NULL,
    "source_checksum_sha256" CHAR(64) NOT NULL,
    "owner_reference" VARCHAR(200) NOT NULL,
    "actor_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_version_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_version_version_key" UNIQUE ("version"),
    CONSTRAINT "catalog_version_supersedes_version_key" UNIQUE ("supersedes_version"),
    CONSTRAINT "catalog_version_schema_check" CHECK ("schema_version" = 'catalog-version.v1'),
    CONSTRAINT "catalog_version_version_check" CHECK (
        "version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
    ),
    CONSTRAINT "catalog_version_supersedes_check" CHECK (
        "supersedes_version" IS NULL
        OR (
            "supersedes_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
            AND "supersedes_version" <> "version"
        )
    ),
    CONSTRAINT "catalog_version_environment_check" CHECK (
        "environment" IN ('local', 'preview', 'staging', 'production')
    ),
    CONSTRAINT "catalog_version_status_check" CHECK (
        "status" IN ('active', 'disabled', 'retired')
    ),
    CONSTRAINT "catalog_version_approval_check" CHECK (
        (
            "approval_mode" = 'local_test'
            AND "environment" = 'local'
            AND "owner_reference" LIKE 'test:%'
        )
        OR (
            "approval_mode" = 'written'
            AND "owner_reference" NOT LIKE 'test:%'
        )
    ),
    CONSTRAINT "catalog_version_locales_check" CHECK (
        cardinality("supported_locales") BETWEEN 1 AND 32
        AND "default_locale" = ANY ("supported_locales")
        AND "default_locale" ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    ),
    CONSTRAINT "catalog_version_window_check" CHECK (
        ("effective_until" IS NULL OR "effective_until" > "effective_from")
        AND "next_review_at" > "effective_from"
        AND ("effective_until" IS NULL OR "next_review_at" <= "effective_until")
    ),
    CONSTRAINT "catalog_version_source_check" CHECK (
        "source_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
        AND "source_checksum_sha256" ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT "catalog_version_actor_check" CHECK (
        "actor_id" ~ '^[a-z][a-z0-9._:-]{2,99}$'
    ),
    CONSTRAINT "catalog_version_supersedes_fkey"
        FOREIGN KEY ("supersedes_version") REFERENCES "catalog_version"("version")
);

CREATE INDEX "catalog_version_lookup_idx"
    ON "catalog_version" ("environment", "effective_from");

CREATE TABLE "catalog_product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catalog_version" VARCHAR(100) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "fulfillment_code" VARCHAR(100) NOT NULL,
    "credits_granted" INTEGER,
    "credits_cost" INTEGER,
    "credits_per_month" INTEGER,
    "subscription_interval" VARCHAR(16),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_product_identity_key" UNIQUE ("catalog_version", "code", "version"),
    CONSTRAINT "catalog_product_identifier_check" CHECK (
        "code" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND "version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "fulfillment_code" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
    ),
    CONSTRAINT "catalog_product_status_check" CHECK ("status" IN ('active', 'retired')),
    CONSTRAINT "catalog_product_terms_check" CHECK (
        (
            "kind" = 'credit_pack'
            AND "credits_granted" > 0
            AND "credits_cost" IS NULL
            AND "credits_per_month" IS NULL
            AND "subscription_interval" IS NULL
        )
        OR (
            "kind" = 'plus_plan'
            AND "credits_granted" IS NULL
            AND "credits_cost" IS NULL
            AND "credits_per_month" > 0
            AND "subscription_interval" IN ('month', 'year')
        )
        OR (
            "kind" IN ('deep_reading', 'permanent_object', 'consumable_ritual')
            AND "credits_granted" IS NULL
            AND "credits_cost" > 0
            AND "credits_per_month" IS NULL
            AND "subscription_interval" IS NULL
        )
        OR (
            "kind" = 'free_object'
            AND "credits_granted" IS NULL
            AND "credits_cost" IS NULL
            AND "credits_per_month" IS NULL
            AND "subscription_interval" IS NULL
        )
    ),
    CONSTRAINT "catalog_product_catalog_fkey"
        FOREIGN KEY ("catalog_version") REFERENCES "catalog_version"("version")
);

CREATE INDEX "catalog_product_lookup_idx"
    ON "catalog_product" ("catalog_version", "status", "kind", "code");

CREATE TABLE "catalog_product_localization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catalog_version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "exact_contents" VARCHAR(500)[] NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_product_localization_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_product_localization_identity_key"
        UNIQUE ("catalog_version", "product_code", "product_version", "locale"),
    CONSTRAINT "catalog_product_localization_locale_check" CHECK (
        "locale" ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    ),
    CONSTRAINT "catalog_product_localization_content_check" CHECK (
        char_length(btrim("title")) BETWEEN 1 AND 160
        AND char_length(btrim("description")) BETWEEN 1 AND 1000
        AND cardinality("exact_contents") BETWEEN 1 AND 16
        AND array_position("exact_contents", '') IS NULL
    ),
    CONSTRAINT "catalog_product_localization_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product"("catalog_version", "code", "version")
);

CREATE INDEX "catalog_product_localization_lookup_idx"
    ON "catalog_product_localization" ("catalog_version", "locale", "product_code");

CREATE TABLE "catalog_price" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catalog_version" VARCHAR(100) NOT NULL,
    "price_id" VARCHAR(200) NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "billing_interval" VARCHAR(16) NOT NULL,
    "country_codes" CHAR(2)[] NOT NULL,
    "provider_eligibility" VARCHAR(32)[] NOT NULL,
    "tax_category" VARCHAR(100) NOT NULL,
    "refund_policy_version" VARCHAR(100) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_price_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_price_identity_key" UNIQUE ("catalog_version", "price_id", "version"),
    CONSTRAINT "catalog_price_identifier_check" CHECK (
        "price_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "currency_code" ~ '^[A-Z]{3}$'
        AND "tax_category" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND "refund_policy_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
    ),
    CONSTRAINT "catalog_price_value_check" CHECK (
        "amount_minor" BETWEEN 1 AND 2147483647
        AND "status" IN ('active', 'retired')
        AND "billing_interval" IN ('one_time', 'month', 'year')
        AND cardinality("country_codes") BETWEEN 1 AND 249
        AND cardinality("provider_eligibility") BETWEEN 1 AND 2
        AND "provider_eligibility" <@ ARRAY['stripe', 'coinbase_usdc_base']::VARCHAR(32)[]
        AND ("effective_until" IS NULL OR "effective_until" > "effective_from")
    ),
    CONSTRAINT "catalog_price_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product"("catalog_version", "code", "version")
);

CREATE INDEX "catalog_price_lookup_idx"
    ON "catalog_price" ("catalog_version", "product_code", "currency_code", "effective_from");

ALTER TABLE "catalog_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_version" FORCE ROW LEVEL SECURITY;
ALTER TABLE "catalog_product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_product" FORCE ROW LEVEL SECURITY;
ALTER TABLE "catalog_product_localization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_product_localization" FORCE ROW LEVEL SECURITY;
ALTER TABLE "catalog_price" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_price" FORCE ROW LEVEL SECURITY;

CREATE POLICY "catalog_version_read"
    ON "catalog_version"
    FOR SELECT
    TO "rituvia_catalog_reader"
    USING (true);

CREATE POLICY "catalog_version_append"
    ON "catalog_version"
    FOR INSERT
    TO "rituvia_catalog_writer"
    WITH CHECK (
        ("environment" = 'local' AND "approval_mode" = 'local_test')
        OR (
            "approval_mode" = 'written'
            AND "owner_reference" LIKE 'OWN-%'
        )
    );

CREATE POLICY "catalog_product_read"
    ON "catalog_product"
    FOR SELECT
    TO "rituvia_catalog_reader"
    USING (true);

CREATE POLICY "catalog_product_append"
    ON "catalog_product"
    FOR INSERT
    TO "rituvia_catalog_writer"
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "catalog_version"
             WHERE "catalog_version"."version" = "catalog_product"."catalog_version"
        )
    );

CREATE POLICY "catalog_product_localization_read"
    ON "catalog_product_localization"
    FOR SELECT
    TO "rituvia_catalog_reader"
    USING (true);

CREATE POLICY "catalog_product_localization_append"
    ON "catalog_product_localization"
    FOR INSERT
    TO "rituvia_catalog_writer"
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "catalog_version"
             WHERE "catalog_version"."version" = "catalog_product_localization"."catalog_version"
        )
    );

CREATE POLICY "catalog_price_read"
    ON "catalog_price"
    FOR SELECT
    TO "rituvia_catalog_reader"
    USING (true);

CREATE POLICY "catalog_price_append"
    ON "catalog_price"
    FOR INSERT
    TO "rituvia_catalog_writer"
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "catalog_version"
             WHERE "catalog_version"."version" = "catalog_price"."catalog_version"
        )
    );

COMMIT;
