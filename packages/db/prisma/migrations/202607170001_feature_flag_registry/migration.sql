-- RIT-007 is expand-only: no flag is enabled by this migration.
BEGIN;

CREATE TABLE "feature_flag_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "registry_version" INTEGER NOT NULL,
    "flag_key" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL,
    "state" VARCHAR(16) NOT NULL DEFAULT 'off',
    "country_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "locale_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "change_reference" VARCHAR(200) NOT NULL,
    "approval_reference" VARCHAR(200),
    "actor_id" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_version_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_flag_version_registry_version_check" CHECK ("registry_version" > 0),
    CONSTRAINT "feature_flag_version_flag_key_check" CHECK ("flag_key" ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$'),
    CONSTRAINT "feature_flag_version_version_check" CHECK ("version" > 0),
    CONSTRAINT "feature_flag_version_state_check" CHECK ("state" IN ('off', 'on')),
    CONSTRAINT "feature_flag_version_country_codes_check" CHECK (
        cardinality("country_codes") <= 64
        AND (
            cardinality("country_codes") = 0
            OR array_to_string("country_codes", ',') ~ '^[A-Z]{2}(,[A-Z]{2})*$'
        )
    ),
    CONSTRAINT "feature_flag_version_locale_tags_check" CHECK (
        cardinality("locale_tags") <= 64
        AND (
            cardinality("locale_tags") = 0
            OR array_to_string("locale_tags", ',') ~ '^[A-Za-z0-9]{2,8}(-[A-Za-z0-9]{1,8})*(,[A-Za-z0-9]{2,8}(-[A-Za-z0-9]{1,8})*)*$'
        )
    ),
    CONSTRAINT "feature_flag_version_expiry_check" CHECK (
        "expires_at" IS NULL OR "expires_at" > "effective_at"
    ),
    CONSTRAINT "feature_flag_version_effective_at_check" CHECK (
        "effective_at" >= "created_at"
    ),
    CONSTRAINT "feature_flag_version_change_reference_check" CHECK (
        "change_reference" ~ '^[A-Z][A-Z0-9-]{1,63}(:[A-Za-z0-9._-]{1,128})?$'
    ),
    CONSTRAINT "feature_flag_version_approval_reference_check" CHECK (
        "approval_reference" IS NULL
        OR "approval_reference" ~ '^OWN-[0-9]{3}:[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    ),
    CONSTRAINT "feature_flag_version_actor_id_check" CHECK (
        "actor_id" ~ '^[a-z][a-z0-9._:-]{2,99}$'
    ),
    CONSTRAINT "feature_flag_version_registry_flag_key_version_key" UNIQUE ("registry_version", "flag_key", "version")
);

CREATE INDEX "feature_flag_version_lookup_idx"
    ON "feature_flag_version" ("registry_version", "flag_key", "effective_at");

ALTER TABLE "feature_flag_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_flag_version" FORCE ROW LEVEL SECURITY;

CREATE POLICY "feature_flag_version_read"
    ON "feature_flag_version"
    FOR SELECT
    TO "rituvia_feature_flag_reader"
    USING (true);

CREATE POLICY "feature_flag_version_append"
    ON "feature_flag_version"
    FOR INSERT
    TO "rituvia_feature_flag_writer"
    WITH CHECK (
        "state" = 'off'
        OR (
            "registry_version" = 1
            AND (
                (
                    "flag_key" = 'experience.public_shell'
                    AND "approval_reference" IS NULL
                    AND cardinality("country_codes") = 0
                    AND cardinality("locale_tags") = 0
                )
                OR (
                    "flag_key" = 'market.country_activation'
                    AND "approval_reference" LIKE 'OWN-004:%'
                    AND cardinality("country_codes") > 0
                    AND cardinality("locale_tags") = 0
                )
                OR (
                    "flag_key" = 'payments.crypto_checkout'
                    AND "approval_reference" LIKE 'OWN-006:%'
                    AND cardinality("country_codes") > 0
                    AND cardinality("locale_tags") = 0
                )
                OR (
                    "flag_key" = 'payments.fiat_checkout'
                    AND "approval_reference" LIKE 'OWN-002:%'
                    AND cardinality("country_codes") > 0
                    AND cardinality("locale_tags") = 0
                )
                OR (
                    "flag_key" = 'content.regional_tradition'
                    AND "approval_reference" LIKE 'OWN-007:%'
                    AND cardinality("country_codes") > 0
                    AND cardinality("locale_tags") > 0
                )
            )
        )
    );

COMMIT;
