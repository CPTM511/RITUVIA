-- RIT-024 is expand-only and creates no reading, draw, identity, or policy records.
BEGIN;

CREATE TABLE "reading" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "modality" VARCHAR(16) NOT NULL DEFAULT 'tarot',
    "reading_type" VARCHAR(24) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'facts_ready',
    "locale" VARCHAR(35) NOT NULL DEFAULT 'en',
    "theme_code" VARCHAR(40) NOT NULL,
    "request_schema_version" VARCHAR(100) NOT NULL,
    "reading_policy_version" VARCHAR(100) NOT NULL,
    "catalog_id" VARCHAR(100) NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "catalog_checksum_sha256" BYTEA NOT NULL,
    "catalog_approval_reference" VARCHAR(200) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "client_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "reading_modality_check" CHECK ("modality" = 'tarot'),
    CONSTRAINT "reading_type_check" CHECK ("reading_type" IN ('one_card', 'three_card')),
    CONSTRAINT "reading_status_check" CHECK ("status" = 'facts_ready'),
    CONSTRAINT "reading_locale_check" CHECK ("locale" = 'en'),
    CONSTRAINT "reading_theme_code_check" CHECK (
        "theme_code" IN (
            'self', 'relationships', 'work', 'creativity', 'transition', 'grief',
            'courage', 'gratitude', 'release', 'open_reflection'
        )
    ),
    CONSTRAINT "reading_request_schema_version_check" CHECK (
        "request_schema_version" = 'tarot-reading-create.v1'
    ),
    CONSTRAINT "reading_policy_version_check" CHECK (
        "reading_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "reading_catalog_id_check" CHECK (
        "catalog_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "reading_catalog_version_check" CHECK (
        "catalog_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
    ),
    CONSTRAINT "reading_catalog_checksum_sha256_check" CHECK (
        octet_length("catalog_checksum_sha256") = 32
    ),
    CONSTRAINT "reading_catalog_approval_reference_check" CHECK (
        "catalog_approval_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$'
    ),
    CONSTRAINT "reading_idempotency_key_version_check" CHECK (
        "idempotency_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "reading_idempotency_key_hash_check" CHECK (
        octet_length("idempotency_key_hash") = 32
    ),
    CONSTRAINT "reading_client_request_hash_check" CHECK (
        octet_length("client_request_hash") = 32
    ),
    CONSTRAINT "reading_completed_at_check" CHECK ("completed_at" = "created_at"),
    CONSTRAINT "reading_expiry_check" CHECK ("expires_at" > "completed_at"),
    CONSTRAINT "reading_subject_scope_idempotency_key" UNIQUE (
        "anonymous_subject_id", "request_schema_version", "idempotency_key_version",
        "idempotency_key_hash"
    ),
    CONSTRAINT "reading_draw_identity_key" UNIQUE (
        "id", "reading_type", "catalog_id", "catalog_version"
    )
);

CREATE INDEX "reading_subject_created_idx"
    ON "reading" ("anonymous_subject_id", "created_at" DESC, "id" DESC);

CREATE TABLE "tarot_draw" (
    "reading_id" UUID NOT NULL,
    "reading_type" VARCHAR(24) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "draw_request_hash" BYTEA NOT NULL,
    "catalog_id" VARCHAR(100) NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "execution_schema_version" VARCHAR(100) NOT NULL,
    "integrity_scheme" VARCHAR(40) NOT NULL,
    "integrity_key_version" VARCHAR(100) NOT NULL,
    "entropy_commitment" VARCHAR(71) NOT NULL,
    "entropy_bytes_consumed" INTEGER NOT NULL,
    "entropy_rejected_samples" INTEGER NOT NULL,
    "execution" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarot_draw_pkey" PRIMARY KEY ("reading_id"),
    CONSTRAINT "tarot_draw_reading_identity_key" UNIQUE (
        "reading_id", "reading_type", "catalog_id", "catalog_version"
    ),
    CONSTRAINT "tarot_draw_reading_fkey" FOREIGN KEY (
        "reading_id", "reading_type", "catalog_id", "catalog_version"
    ) REFERENCES "reading" (
        "id", "reading_type", "catalog_id", "catalog_version"
    ) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "tarot_draw_reading_type_check" CHECK (
        "reading_type" IN ('one_card', 'three_card')
    ),
    CONSTRAINT "tarot_draw_idempotency_key_hash_check" CHECK (
        octet_length("idempotency_key_hash") = 32
    ),
    CONSTRAINT "tarot_draw_draw_request_hash_check" CHECK (
        octet_length("draw_request_hash") = 32
    ),
    CONSTRAINT "tarot_draw_catalog_reference_check" CHECK (
        "catalog_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "catalog_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
    ),
    CONSTRAINT "tarot_draw_execution_schema_version_check" CHECK (
        "execution_schema_version" = 'tarot-draw-execution.v1'
    ),
    CONSTRAINT "tarot_draw_integrity_scheme_check" CHECK (
        "integrity_scheme" = 'hmac-sha256.tarot-reading.v1'
    ),
    CONSTRAINT "tarot_draw_integrity_key_version_check" CHECK (
        "integrity_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "tarot_draw_entropy_commitment_check" CHECK (
        "entropy_commitment" ~ '^sha256:[0-9a-f]{64}$'
    ),
    CONSTRAINT "tarot_draw_entropy_counts_check" CHECK (
        "entropy_bytes_consumed" >= 0
        AND "entropy_bytes_consumed" <= 1000000
        AND "entropy_rejected_samples" >= 0
        AND "entropy_rejected_samples" <= "entropy_bytes_consumed"
    ),
    CONSTRAINT "tarot_draw_execution_size_check" CHECK (
        octet_length("execution"::text) <= 65536
    ),
    CONSTRAINT "tarot_draw_execution_shape_check" CHECK (
        jsonb_typeof("execution") = 'object'
        AND "execution" - ARRAY['audit', 'facts', 'schemaVersion'] = '{}'::jsonb
        AND "execution" ?& ARRAY['audit', 'facts', 'schemaVersion']
        AND jsonb_typeof("execution" -> 'audit') = 'object'
        AND ("execution" -> 'audit')
            - ARRAY['entropy', 'idempotencyKeyDigest', 'requestDigest'] = '{}'::jsonb
        AND ("execution" -> 'audit')
            ?& ARRAY['entropy', 'idempotencyKeyDigest', 'requestDigest']
        AND jsonb_typeof("execution" #> '{audit,entropy}') = 'object'
        AND ("execution" #> '{audit,entropy}')
            - ARRAY['bytesConsumed', 'commitment', 'rejectedSamples'] = '{}'::jsonb
        AND ("execution" #> '{audit,entropy}')
            ?& ARRAY['bytesConsumed', 'commitment', 'rejectedSamples']
        AND jsonb_typeof("execution" -> 'facts') = 'object'
        AND ("execution" -> 'facts') - ARRAY[
            'algorithmVersion', 'catalog', 'deck', 'engineName', 'engineVersion', 'method',
            'orientationPolicy', 'positions', 'replacementPolicy', 'rulesVersion',
            'schemaVersion', 'spread'
        ] = '{}'::jsonb
        AND ("execution" -> 'facts') ?& ARRAY[
            'algorithmVersion', 'catalog', 'deck', 'engineName', 'engineVersion', 'method',
            'orientationPolicy', 'positions', 'replacementPolicy', 'rulesVersion',
            'schemaVersion', 'spread'
        ]
        AND jsonb_typeof("execution" #> '{facts,positions}') = 'array'
    ),
    CONSTRAINT "tarot_draw_execution_versions_check" CHECK (
        "execution" ->> 'schemaVersion' = "execution_schema_version"
        AND "execution" #>> '{facts,schemaVersion}' = 'tarot-draw-facts.v1'
        AND "execution" #>> '{facts,algorithmVersion}' =
            'partial-fisher-yates-rejection-uint8.v1'
        AND "execution" #>> '{facts,engineName}' = 'rituvia.tarot-draw'
        AND "execution" #>> '{facts,engineVersion}' = '1.0.0'
        AND "execution" #>> '{facts,method}' = 'tarot'
        AND "execution" #>> '{facts,replacementPolicy}' = 'without_replacement'
        AND "execution" #>> '{facts,rulesVersion}' = 'tarot-draw-rules.v1'
        AND "execution" #>> '{facts,orientationPolicy}' IN (
            'upright_only', 'upright_and_reversed'
        )
        AND "execution" #>> '{facts,catalog,id}' = "catalog_id"
        AND "execution" #>> '{facts,catalog,version}' = "catalog_version"
    ),
    CONSTRAINT "tarot_draw_execution_audit_check" CHECK (
        "execution" #>> '{audit,idempotencyKeyDigest}' =
            'sha256:' || encode("idempotency_key_hash", 'hex')
        AND "execution" #>> '{audit,requestDigest}' =
            'sha256:' || encode("draw_request_hash", 'hex')
        AND "execution" #>> '{audit,entropy,commitment}' = "entropy_commitment"
        AND jsonb_typeof("execution" #> '{audit,entropy,bytesConsumed}') = 'number'
        AND "execution" #>> '{audit,entropy,bytesConsumed}' =
            "entropy_bytes_consumed"::text
        AND jsonb_typeof("execution" #> '{audit,entropy,rejectedSamples}') = 'number'
        AND "execution" #>> '{audit,entropy,rejectedSamples}' =
            "entropy_rejected_samples"::text
    ),
    CONSTRAINT "tarot_draw_execution_position_count_check" CHECK (
        jsonb_array_length("execution" #> '{facts,positions}') = CASE "reading_type"
            WHEN 'one_card' THEN 1
            WHEN 'three_card' THEN 3
        END
    )
);

COMMIT;
