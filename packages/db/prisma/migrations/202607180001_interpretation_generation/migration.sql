-- RIT-033 is expand-only and creates no interpretation, provider, model, policy, or content record.
BEGIN;

ALTER TABLE "reading"
    ADD CONSTRAINT "reading_interpretation_owner_expiry_key"
    UNIQUE ("id", "anonymous_subject_id", "expires_at");

CREATE TABLE "interpretation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reading_id" UUID NOT NULL,
    "anonymous_subject_id" UUID NOT NULL,
    "generation_number" SMALLINT NOT NULL DEFAULT 1,
    "request_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'generating',
    "generation_schema_version" VARCHAR(100) NOT NULL,
    "generation_policy_version" VARCHAR(100) NOT NULL,
    "eligibility_as_of" DATE NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "modality" VARCHAR(16) NOT NULL,
    "reading_type" VARCHAR(24) NOT NULL,
    "theme_code" VARCHAR(40) NOT NULL,
    "tone" VARCHAR(24) NOT NULL,
    "provider_id" VARCHAR(100) NOT NULL,
    "provider_version" VARCHAR(100) NOT NULL,
    "model_id" VARCHAR(100) NOT NULL,
    "model_version" VARCHAR(100) NOT NULL,
    "provider_approval_reference" VARCHAR(200) NOT NULL,
    "prompt_id" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(100) NOT NULL,
    "prompt_checksum_sha256" BYTEA NOT NULL,
    "prompt_approval_reference" VARCHAR(200) NOT NULL,
    "output_schema_version" VARCHAR(100) NOT NULL,
    "safety_policy_version" VARCHAR(100) NOT NULL,
    "retrieval_policy_version" VARCHAR(100) NOT NULL,
    "assembly_policy_version" VARCHAR(100) NOT NULL,
    "fallback_template_id" VARCHAR(100) NOT NULL,
    "fallback_template_version" VARCHAR(100) NOT NULL,
    "fallback_template_checksum_sha256" BYTEA NOT NULL,
    "fallback_template_approval_reference" VARCHAR(200) NOT NULL,
    "deterministic_engine_name" VARCHAR(100) NOT NULL,
    "deterministic_engine_version" VARCHAR(100) NOT NULL,
    "deterministic_algorithm_version" VARCHAR(100) NOT NULL,
    "deterministic_rules_version" VARCHAR(100) NOT NULL,
    "content_versions" VARCHAR(100)[] NOT NULL,
    "generation_provenance" JSONB NOT NULL,
    "max_output_tokens" INTEGER NOT NULL,
    "attempt_timeout_ms" INTEGER NOT NULL,
    "total_timeout_ms" INTEGER NOT NULL,
    "max_attempts" SMALLINT NOT NULL,
    "retry_delay_ms" INTEGER NOT NULL,
    "maximum_estimated_cost_micros" BIGINT NOT NULL,
    "approved_currency_code" CHAR(3) NOT NULL,
    "claim_version" INTEGER NOT NULL DEFAULT 1,
    "claim_token_hash" BYTEA NOT NULL,
    "lease_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "finalization_hash" BYTEA,
    "attempt_count" SMALLINT,
    "failure_code" VARCHAR(32),
    "retry_reason" VARCHAR(32),
    "latency_ms" INTEGER,
    "token_status" VARCHAR(16),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "cost_status" VARCHAR(16),
    "estimated_cost_micros" BIGINT,
    "currency_code" CHAR(3),
    "fallback_output" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interpretation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interpretation_reading_owner_expiry_fkey" FOREIGN KEY (
        "reading_id", "anonymous_subject_id", "expires_at"
    ) REFERENCES "reading" (
        "id", "anonymous_subject_id", "expires_at"
    ) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "interpretation_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "interpretation_generation_number_check" CHECK ("generation_number" = 1),
    CONSTRAINT "interpretation_status_check" CHECK (
        "status" IN ('generating', 'pending_verification', 'fallback', 'failed')
    ),
    CONSTRAINT "interpretation_generation_schema_version_check" CHECK (
        "generation_schema_version" = 'interpretation-generation.v1'
    ),
    CONSTRAINT "interpretation_identifier_fields_check" CHECK (
        "generation_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "idempotency_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "provider_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "model_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "prompt_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "output_schema_version" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
        AND "safety_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "retrieval_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "assembly_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "fallback_template_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "deterministic_engine_name" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "deterministic_algorithm_version" ~ '^[a-z0-9][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "deterministic_rules_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "interpretation_semantic_versions_check" CHECK (
        "provider_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "model_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "prompt_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "fallback_template_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "deterministic_engine_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
    ),
    CONSTRAINT "interpretation_approval_references_check" CHECK (
        "provider_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "prompt_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "fallback_template_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
    ),
    CONSTRAINT "interpretation_request_hashes_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND octet_length("prompt_checksum_sha256") = 32
        AND octet_length("fallback_template_checksum_sha256") = 32
        AND octet_length("claim_token_hash") = 32
        AND ("finalization_hash" IS NULL OR octet_length("finalization_hash") = 32)
    ),
    CONSTRAINT "interpretation_dimensions_check" CHECK (
        "locale" = 'en'
        AND "modality" = 'tarot'
        AND "reading_type" IN ('one_card', 'three_card')
        AND "theme_code" IN (
            'self', 'relationships', 'work', 'creativity', 'transition', 'grief',
            'courage', 'gratitude', 'release', 'open_reflection'
        )
        AND "tone" IN ('concise', 'gentle', 'grounded', 'poetic-light')
    ),
    CONSTRAINT "interpretation_content_versions_check" CHECK (
        cardinality("content_versions") BETWEEN 1 AND 24
        AND array_position("content_versions", NULL) IS NULL
        AND array_to_string("content_versions", ',') ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}(,[A-Za-z0-9][A-Za-z0-9._-]{0,99})*$'
    ),
    CONSTRAINT "interpretation_generation_provenance_check" CHECK (
        jsonb_typeof("generation_provenance") = 'object'
        AND "generation_provenance" ->> 'schemaVersion' = 'interpretation-generation-provenance.v1'
        AND octet_length("generation_provenance"::text) <= 65536
        AND NOT ("generation_provenance" ?| ARRAY[
            'question', 'rawQuestion', 'promptMessages', 'messages', 'providerOutput',
            'outputJson', 'error', 'authorization', 'riskCategories'
        ])
    ),
    CONSTRAINT "interpretation_budget_check" CHECK (
        "max_output_tokens" BETWEEN 1 AND 8192
        AND "attempt_timeout_ms" BETWEEN 100 AND 120000
        AND "total_timeout_ms" BETWEEN "attempt_timeout_ms" AND 240000
        AND "max_attempts" BETWEEN 1 AND 2
        AND "retry_delay_ms" BETWEEN 0 AND 30000
        AND "maximum_estimated_cost_micros" BETWEEN 0 AND 1000000000
        AND "approved_currency_code" ~ '^[A-Z]{3}$'
    ),
    CONSTRAINT "interpretation_claim_check" CHECK (
        "claim_version" >= 1
        AND "lease_expires_at" > "created_at"
        AND "lease_expires_at" <= "expires_at"
    ),
    CONSTRAINT "interpretation_failure_code_check" CHECK (
        "failure_code" IS NULL OR "failure_code" IN (
            'aborted', 'configuration', 'content_filtered', 'invalid_request',
            'invalid_response', 'quota_exceeded', 'rate_limited', 'timeout',
            'unavailable', 'unknown'
        )
    ),
    CONSTRAINT "interpretation_retry_reason_check" CHECK (
        "retry_reason" IS NULL OR "retry_reason" IN (
            'rate_limited', 'unavailable', 'invalid_response'
        )
    ),
    CONSTRAINT "interpretation_operational_metadata_check" CHECK (
        (
            "status" = 'generating'
            AND "finalization_hash" IS NULL
            AND "attempt_count" IS NULL
            AND "failure_code" IS NULL
            AND "retry_reason" IS NULL
            AND "latency_ms" IS NULL
            AND "token_status" IS NULL
            AND "input_tokens" IS NULL
            AND "output_tokens" IS NULL
            AND "total_tokens" IS NULL
            AND "cost_status" IS NULL
            AND "estimated_cost_micros" IS NULL
            AND "currency_code" IS NULL
            AND "fallback_output" IS NULL
            AND "completed_at" IS NULL
        ) OR (
            "status" IN ('pending_verification', 'fallback', 'failed')
            AND "finalization_hash" IS NOT NULL
            AND "attempt_count" BETWEEN 0 AND "max_attempts"
            AND "latency_ms" BETWEEN 0 AND 240000
            AND "token_status" IN ('reported', 'unavailable')
            AND "cost_status" IN ('reported', 'unavailable')
            AND "completed_at" IS NOT NULL
            AND "completed_at" >= "created_at"
            AND "completed_at" <= "expires_at"
            AND (
                ("token_status" = 'reported'
                 AND "input_tokens" BETWEEN 0 AND 2147483647
                 AND "output_tokens" BETWEEN 0 AND 2147483647
                 AND "total_tokens" BETWEEN 0 AND 2147483647
                 AND "total_tokens"::bigint = "input_tokens"::bigint + "output_tokens"::bigint
                 AND "output_tokens" <= "max_output_tokens" * "attempt_count")
                OR
                ("token_status" = 'unavailable'
                 AND "input_tokens" IS NULL
                 AND "output_tokens" IS NULL
                 AND "total_tokens" IS NULL)
            )
            AND (
                ("cost_status" = 'reported'
                 AND "estimated_cost_micros" >= 0
                 AND "estimated_cost_micros" <= "maximum_estimated_cost_micros"
                 AND "currency_code" = "approved_currency_code")
                OR
                ("cost_status" = 'unavailable'
                 AND "estimated_cost_micros" IS NULL
                 AND "currency_code" IS NULL)
            )
            AND (
                ("status" = 'pending_verification'
                 AND "attempt_count" >= 1
                 AND "failure_code" IS NULL
                 AND "fallback_output" IS NULL)
                OR
                ("status" = 'fallback'
                 AND "failure_code" IN (
                     'aborted', 'content_filtered', 'invalid_response', 'quota_exceeded',
                     'rate_limited', 'timeout', 'unavailable'
                 )
                 AND "fallback_output" IS NOT NULL
                 AND jsonb_typeof("fallback_output") = 'object'
                 AND octet_length("fallback_output"::text) <= 65536
                 AND "fallback_output" ->> 'schemaVersion' = '1'
                 AND "fallback_output" ?& ARRAY[
                     'boundaryNote', 'perspectives', 'reflectionQuestions', 'safety',
                     'schemaVersion', 'smallAction', 'sourceRefs', 'summary', 'symbols', 'title'
                 ]
                 AND "fallback_output" - ARRAY[
                     'boundaryNote', 'perspectives', 'reflectionQuestions', 'ritualSuggestion',
                     'safety', 'schemaVersion', 'smallAction', 'sourceRefs', 'summary', 'symbols',
                     'title'
                 ] = '{}'::jsonb
                 AND "fallback_output" -> 'safety' = '{
                     "certaintyLevel":"reflective",
                     "containsGuaranteedOutcome":false,
                     "containsProfessionalAdvice":false
                 }'::jsonb
                 AND jsonb_typeof("fallback_output" -> 'perspectives') = 'array'
                 AND jsonb_typeof("fallback_output" -> 'reflectionQuestions') = 'array'
                 AND jsonb_typeof("fallback_output" -> 'smallAction') = 'object'
                 AND jsonb_typeof("fallback_output" -> 'sourceRefs') = 'array'
                 AND jsonb_typeof("fallback_output" -> 'symbols') = 'array'
                 AND jsonb_typeof("fallback_output" -> 'boundaryNote') = 'string'
                 AND jsonb_typeof("fallback_output" -> 'summary') = 'string'
                 AND jsonb_typeof("fallback_output" -> 'title') = 'string'
                 AND (
                     NOT ("fallback_output" ? 'ritualSuggestion')
                     OR jsonb_typeof("fallback_output" -> 'ritualSuggestion') = 'object'
                 ))
                OR
                ("status" = 'failed'
                 AND "attempt_count" >= 1
                 AND "failure_code" IN ('configuration', 'invalid_request', 'unknown')
                 AND "retry_reason" IS NULL
                 AND "token_status" = 'unavailable'
                 AND "cost_status" = 'unavailable'
                 AND "fallback_output" IS NULL)
            )
            AND (
                "attempt_count" > 0
                OR (
                    "status" = 'fallback'
                    AND "failure_code" = 'aborted'
                    AND "retry_reason" IS NULL
                    AND "token_status" = 'unavailable'
                    AND "cost_status" = 'unavailable'
                )
            )
        )
    ),
    CONSTRAINT "interpretation_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "interpretation_request_id_key" UNIQUE ("request_id"),
    CONSTRAINT "interpretation_reading_generation_key" UNIQUE (
        "reading_id", "generation_number"
    ),
    CONSTRAINT "interpretation_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_version", "idempotency_key_hash"
    )
);

CREATE INDEX "interpretation_reading_created_idx"
    ON "interpretation" ("reading_id", "created_at" DESC, "id" DESC);

CREATE INDEX "interpretation_lease_idx"
    ON "interpretation" ("lease_expires_at", "id");

CREATE INDEX "interpretation_expiry_idx"
    ON "interpretation" ("expires_at", "id");

ALTER TABLE "interpretation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interpretation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "interpretation_read"
    ON "interpretation"
    FOR SELECT
    TO "rituvia_interpretation_reader"
    USING (true);

CREATE POLICY "interpretation_claim_insert"
    ON "interpretation"
    FOR INSERT
    TO "rituvia_interpretation_writer"
    WITH CHECK (
        "status" = 'generating'
        AND "generation_number" = 1
        AND "claim_version" = 1
        AND "finalization_hash" IS NULL
        AND "fallback_output" IS NULL
        AND "completed_at" IS NULL
    );

CREATE POLICY "interpretation_generating_transition"
    ON "interpretation"
    FOR UPDATE
    TO "rituvia_interpretation_writer"
    USING ("status" = 'generating')
    WITH CHECK ("status" IN ('generating', 'pending_verification', 'fallback', 'failed'));

COMMIT;
