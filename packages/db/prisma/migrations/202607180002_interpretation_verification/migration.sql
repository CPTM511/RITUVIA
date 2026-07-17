-- RIT-034 is expand-only and stores only approved or deterministic safe output.
BEGIN;

ALTER TABLE "interpretation"
    ADD COLUMN "verification_timeout_ms" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "interpretation"
    ADD CONSTRAINT "interpretation_verification_timeout_check"
    CHECK ("verification_timeout_ms" BETWEEN 0 AND 30000);

ALTER TABLE "interpretation"
    ADD CONSTRAINT "interpretation_verification_owner_expiry_status_key"
    UNIQUE ("id", "anonymous_subject_id", "expires_at", "status");

CREATE TABLE "interpretation_verification" (
    "interpretation_id" UUID NOT NULL,
    "anonymous_subject_id" UUID NOT NULL,
    "parent_status" VARCHAR(24) NOT NULL DEFAULT 'pending_verification',
    "status" VARCHAR(24) NOT NULL,
    "result_schema_version" VARCHAR(100) NOT NULL,
    "metadata_schema_version" VARCHAR(100) NOT NULL,
    "deterministic_checks_version" VARCHAR(100) NOT NULL,
    "candidate_digest" BYTEA NOT NULL,
    "candidate_digest_scope" VARCHAR(100) NOT NULL,
    "output_digest" BYTEA NOT NULL,
    "output_digest_scope" VARCHAR(100) NOT NULL,
    "policy_id" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "policy_checksum_sha256" BYTEA NOT NULL,
    "policy_approval_reference" VARCHAR(200) NOT NULL,
    "runtime_id" VARCHAR(100) NOT NULL,
    "runtime_version" VARCHAR(100) NOT NULL,
    "runtime_checksum_sha256" BYTEA NOT NULL,
    "runtime_approval_reference" VARCHAR(200) NOT NULL,
    "reviewer_id" VARCHAR(100) NOT NULL,
    "reviewer_version" VARCHAR(100) NOT NULL,
    "reviewer_checksum_sha256" BYTEA NOT NULL,
    "reviewer_approval_reference" VARCHAR(200) NOT NULL,
    "reviewer_policy_id" VARCHAR(100) NOT NULL,
    "reviewer_policy_version" VARCHAR(100) NOT NULL,
    "reviewer_policy_checksum_sha256" BYTEA NOT NULL,
    "reviewer_policy_approval_reference" VARCHAR(200) NOT NULL,
    "reviewer_provider_id" VARCHAR(100) NOT NULL,
    "reviewer_provider_version" VARCHAR(100) NOT NULL,
    "reviewer_model_id" VARCHAR(100) NOT NULL,
    "reviewer_model_version" VARCHAR(100) NOT NULL,
    "verification_timeout_ms" INTEGER NOT NULL,
    "output_schema_version" VARCHAR(100) NOT NULL,
    "finalization_digest" BYTEA NOT NULL,
    "output" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "interpretation_verification_pkey" PRIMARY KEY ("interpretation_id"),
    CONSTRAINT "interpretation_verification_parent_key" UNIQUE (
        "interpretation_id", "anonymous_subject_id", "expires_at", "parent_status"
    ),
    CONSTRAINT "interpretation_verification_parent_fkey" FOREIGN KEY (
        "interpretation_id", "anonymous_subject_id", "expires_at", "parent_status"
    ) REFERENCES "interpretation" (
        "id", "anonymous_subject_id", "expires_at", "status"
    ) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "interpretation_verification_subject_fkey" FOREIGN KEY (
        "anonymous_subject_id"
    ) REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "interpretation_verification_parent_status_check" CHECK (
        "parent_status" = 'pending_verification'
    ),
    CONSTRAINT "interpretation_verification_status_check" CHECK (
        "status" IN ('verified', 'safe_replacement')
    ),
    CONSTRAINT "interpretation_verification_schema_check" CHECK (
        "result_schema_version" = 'tarot-interpretation-verification-result.v1'
        AND "metadata_schema_version" = 'tarot-verification-operational-metadata.v1'
        AND "deterministic_checks_version" = 'tarot-post-generation-checks.v1'
        AND "candidate_digest_scope" = 'canonical-tarot-verification-candidate-json.v1'
        AND "output_digest_scope" = 'canonical-tarot-verification-output-json.v1'
        AND "output_schema_version" = '1'
    ),
    CONSTRAINT "interpretation_verification_identifiers_check" CHECK (
        "policy_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "runtime_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "reviewer_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "reviewer_policy_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "reviewer_provider_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "reviewer_model_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "policy_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "runtime_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "reviewer_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "reviewer_policy_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "reviewer_provider_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "reviewer_model_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
    ),
    CONSTRAINT "interpretation_verification_approvals_check" CHECK (
        "policy_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "runtime_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "reviewer_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
        AND "reviewer_policy_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
    ),
    CONSTRAINT "interpretation_verification_digests_check" CHECK (
        octet_length("policy_checksum_sha256") = 32
        AND octet_length("runtime_checksum_sha256") = 32
        AND octet_length("reviewer_checksum_sha256") = 32
        AND octet_length("reviewer_policy_checksum_sha256") = 32
        AND octet_length("candidate_digest") = 32
        AND octet_length("output_digest") = 32
        AND octet_length("finalization_digest") = 32
    ),
    CONSTRAINT "interpretation_verification_timeout_check" CHECK (
        "verification_timeout_ms" BETWEEN 100 AND 30000
    ),
    CONSTRAINT "interpretation_verification_output_check" CHECK (
        jsonb_typeof("output") = 'object'
        AND octet_length("output"::text) <= 65536
        AND "output" ->> 'schemaVersion' = "output_schema_version"
        AND "output" ?& ARRAY[
            'boundaryNote', 'perspectives', 'reflectionQuestions', 'safety', 'schemaVersion',
            'smallAction', 'sourceRefs', 'summary', 'symbols', 'title'
        ]
        AND "output" - ARRAY[
            'boundaryNote', 'perspectives', 'reflectionQuestions', 'ritualSuggestion', 'safety',
            'schemaVersion', 'smallAction', 'sourceRefs', 'summary', 'symbols', 'title'
        ] = '{}'::jsonb
        AND jsonb_typeof("output" -> 'boundaryNote') = 'string'
        AND jsonb_typeof("output" -> 'perspectives') = 'array'
        AND jsonb_array_length("output" -> 'perspectives') BETWEEN 1 AND 6
        AND NOT jsonb_path_exists(
            "output", '$.perspectives[*] ? (@.type() != "string")'
        )
        AND jsonb_typeof("output" -> 'reflectionQuestions') = 'array'
        AND jsonb_array_length("output" -> 'reflectionQuestions') BETWEEN 1 AND 4
        AND NOT jsonb_path_exists(
            "output", '$.reflectionQuestions[*] ? (@.type() != "string")'
        )
        AND "output" -> 'safety' = '{
            "certaintyLevel":"reflective",
            "containsGuaranteedOutcome":false,
            "containsProfessionalAdvice":false
        }'::jsonb
        AND jsonb_typeof("output" -> 'smallAction') = 'object'
        AND "output" -> 'smallAction' ?& ARRAY['label', 'rationale', 'timeHorizon']
        AND ("output" -> 'smallAction') - ARRAY['label', 'rationale', 'timeHorizon'] = '{}'::jsonb
        AND jsonb_typeof("output" -> 'smallAction' -> 'label') = 'string'
        AND jsonb_typeof("output" -> 'smallAction' -> 'rationale') = 'string'
        AND "output" -> 'smallAction' ->> 'timeHorizon' IN ('open', 'this_week', 'today')
        AND jsonb_typeof("output" -> 'sourceRefs') = 'array'
        AND jsonb_array_length("output" -> 'sourceRefs') BETWEEN 1 AND 24
        AND NOT jsonb_path_exists("output", '$.sourceRefs[*] ? (@.type() != "string")')
        AND jsonb_typeof("output" -> 'summary') = 'string'
        AND jsonb_typeof("output" -> 'symbols') = 'array'
        AND jsonb_array_length("output" -> 'symbols') BETWEEN 1 AND 12
        AND NOT jsonb_path_exists("output", '$.symbols[*] ? (@.type() != "object")')
        AND NOT jsonb_path_exists(
            "output",
            '$.symbols[*].keyvalue() ? (
                @.key != "factRef" && @.key != "limitation" &&
                @.key != "meaning" && @.key != "possibility"
            )'
        )
        AND NOT jsonb_path_exists(
            "output",
            '$.symbols[*] ? (
                !exists(@.factRef) || !exists(@.meaning) || !exists(@.possibility) ||
                @.factRef.type() != "string" || @.meaning.type() != "string" ||
                @.possibility.type() != "string" ||
                (exists(@.limitation) && @.limitation.type() != "string")
            )'
        )
        AND jsonb_typeof("output" -> 'title') = 'string'
        AND (
            NOT ("output" ? 'ritualSuggestion')
            OR (
                jsonb_typeof("output" -> 'ritualSuggestion') = 'object'
                AND "output" -> 'ritualSuggestion' ?& ARRAY['approvedTemplateCode', 'reason']
                AND ("output" -> 'ritualSuggestion') - ARRAY[
                    'approvedTemplateCode', 'reason'
                ] = '{}'::jsonb
                AND jsonb_typeof(
                    "output" -> 'ritualSuggestion' -> 'approvedTemplateCode'
                ) = 'string'
                AND jsonb_typeof("output" -> 'ritualSuggestion' -> 'reason') = 'string'
            )
        )
    ),
    CONSTRAINT "interpretation_verification_expiry_check" CHECK (
        "expires_at" > "created_at"
    )
);

CREATE INDEX "interpretation_verification_subject_created_idx"
    ON "interpretation_verification" (
        "anonymous_subject_id", "created_at" DESC, "interpretation_id" DESC
    );

CREATE INDEX "interpretation_verification_expiry_idx"
    ON "interpretation_verification" ("expires_at", "interpretation_id");

ALTER TABLE "interpretation_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interpretation_verification" FORCE ROW LEVEL SECURITY;

CREATE POLICY "interpretation_verification_read"
    ON "interpretation_verification"
    FOR SELECT
    TO "rituvia_interpretation_verification_reader"
    USING (true);

CREATE POLICY "interpretation_verification_insert"
    ON "interpretation_verification"
    FOR INSERT
    TO "rituvia_interpretation_verification_writer"
    WITH CHECK ("parent_status" = 'pending_verification');

COMMIT;
