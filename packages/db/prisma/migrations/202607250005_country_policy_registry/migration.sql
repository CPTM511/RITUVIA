-- RIT-060 is expand-only and does not activate any country, product, or payment provider.
BEGIN;

CREATE TABLE "country_policy_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schema_version" VARCHAR(100) NOT NULL,
    "version" VARCHAR(100) NOT NULL,
    "supersedes_version" VARCHAR(100),
    "country_code" CHAR(2) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "approval_mode" VARCHAR(16) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_until" TIMESTAMPTZ(6),
    "next_review_at" TIMESTAMPTZ(6) NOT NULL,
    "legal_reference" VARCHAR(200) NOT NULL,
    "owner_reference" VARCHAR(200) NOT NULL,
    "provider_reference" VARCHAR(200) NOT NULL,
    "actor_id" VARCHAR(100) NOT NULL,
    "policy_document" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_policy_version_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "country_policy_version_version_key" UNIQUE ("version"),
    CONSTRAINT "country_policy_version_supersedes_version_key" UNIQUE ("supersedes_version"),
    CONSTRAINT "country_policy_version_schema_check" CHECK ("schema_version" = 'country-policy-version.v1'),
    CONSTRAINT "country_policy_version_version_check" CHECK ("version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'),
    CONSTRAINT "country_policy_version_supersedes_check" CHECK (
        "supersedes_version" IS NULL
        OR (
            "supersedes_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
            AND "supersedes_version" <> "version"
        )
    ),
    CONSTRAINT "country_policy_version_country_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "country_policy_version_environment_check" CHECK (
        "environment" IN ('local', 'preview', 'staging', 'production')
    ),
    CONSTRAINT "country_policy_version_status_check" CHECK (
        "status" IN ('disabled', 'content_only', 'free_only', 'paid')
    ),
    CONSTRAINT "country_policy_version_approval_mode_check" CHECK (
        "approval_mode" IN ('local_test', 'written')
    ),
    CONSTRAINT "country_policy_version_window_check" CHECK (
        ("effective_until" IS NULL OR "effective_until" > "effective_from")
        AND "next_review_at" > "effective_from"
        AND ("effective_until" IS NULL OR "next_review_at" <= "effective_until")
    ),
    CONSTRAINT "country_policy_version_evidence_check" CHECK (
        "legal_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "owner_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "provider_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND (
            (
                "approval_mode" = 'local_test'
                AND "environment" = 'local'
                AND "legal_reference" LIKE 'test:%'
                AND "owner_reference" LIKE 'test:%'
                AND "provider_reference" LIKE 'test:%'
            )
            OR (
                "approval_mode" = 'written'
                AND "legal_reference" NOT LIKE 'test:%'
                AND "owner_reference" NOT LIKE 'test:%'
                AND "provider_reference" NOT LIKE 'test:%'
            )
        )
    ),
    CONSTRAINT "country_policy_version_actor_check" CHECK (
        "actor_id" ~ '^[a-z][a-z0-9._:-]{2,99}$'
    ),
    CONSTRAINT "country_policy_version_document_check" CHECK (
        jsonb_typeof("policy_document") = 'object'
        AND "policy_document" ->> 'schemaVersion' = "schema_version"
        AND "policy_document" ->> 'version' = "version"
        AND ("policy_document" ->> 'supersedesVersion') IS NOT DISTINCT FROM "supersedes_version"
        AND "policy_document" ->> 'countryCode' = "country_code"
        AND "policy_document" ->> 'environment' = "environment"
        AND "policy_document" ->> 'status' = "status"
        AND "policy_document" ->> 'approvalMode' = "approval_mode"
        AND "policy_document" ->> 'effectiveFrom' = to_char("effective_from" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        AND (
            ("effective_until" IS NULL AND "policy_document" -> 'effectiveUntil' = 'null'::jsonb)
            OR "policy_document" ->> 'effectiveUntil' = to_char("effective_until" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        )
        AND "policy_document" ->> 'nextReviewAt' = to_char("next_review_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        AND "policy_document" #>> '{evidence,legalReference}' = "legal_reference"
        AND "policy_document" #>> '{evidence,ownerReference}' = "owner_reference"
        AND "policy_document" #>> '{evidence,providerReference}' = "provider_reference"
    ),
    CONSTRAINT "country_policy_version_supersedes_fkey"
        FOREIGN KEY ("supersedes_version") REFERENCES "country_policy_version"("version")
);

CREATE INDEX "country_policy_version_lookup_idx"
    ON "country_policy_version" ("environment", "country_code", "effective_from");

ALTER TABLE "country_policy_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "country_policy_version" FORCE ROW LEVEL SECURITY;

CREATE POLICY "country_policy_version_read"
    ON "country_policy_version"
    FOR SELECT
    TO "rituvia_country_policy_reader"
    USING (true);

CREATE POLICY "country_policy_version_append"
    ON "country_policy_version"
    FOR INSERT
    TO "rituvia_country_policy_writer"
    WITH CHECK (
        "environment" = 'local'
        AND "approval_mode" = 'local_test'
        OR (
            "approval_mode" = 'written'
            AND (
                "status" <> 'paid'
                OR (
                    ("policy_document" #>> '{fiat,enabled}')::boolean = false
                    OR "policy_document" #>> '{evidence,fiatApprovalReference}' LIKE 'OWN-002:%'
                )
                AND (
                    ("policy_document" #>> '{crypto,enabled}')::boolean = false
                    OR "policy_document" #>> '{evidence,cryptoApprovalReference}' LIKE 'OWN-006:%'
                )
            )
        )
    );

COMMIT;
