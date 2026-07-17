-- RIT-027 is expand-only and creates no report, reading, identity, or policy records.
BEGIN;

ALTER TABLE "reading"
    ADD CONSTRAINT "reading_subject_identity_key" UNIQUE ("id", "anonymous_subject_id");

CREATE TABLE "reading_report" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reading_id" UUID NOT NULL,
    "anonymous_subject_id" UUID NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "target_kind" VARCHAR(16) NOT NULL,
    "target_position_id" VARCHAR(100),
    "schema_version" VARCHAR(100) NOT NULL,
    "report_policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reading_report_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_report_reading_subject_fkey" FOREIGN KEY (
        "reading_id", "anonymous_subject_id"
    ) REFERENCES "reading" (
        "id", "anonymous_subject_id"
    ) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "reading_report_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "reading_report_category_check" CHECK (
        "category" IN ('factual', 'cultural', 'safety', 'translation', 'rights', 'accessibility')
    ),
    CONSTRAINT "reading_report_target_check" CHECK (
        ("target_kind" = 'reading' AND "target_position_id" IS NULL)
        OR (
            "target_kind" = 'position'
            AND "target_position_id" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        )
    ),
    CONSTRAINT "reading_report_schema_version_check" CHECK (
        "schema_version" = 'tarot-reading-report.v1'
    ),
    CONSTRAINT "reading_report_policy_version_check" CHECK (
        "report_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "reading_report_idempotency_key_version_check" CHECK (
        "idempotency_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "reading_report_idempotency_key_hash_check" CHECK (
        octet_length("idempotency_key_hash") = 32
    ),
    CONSTRAINT "reading_report_request_hash_check" CHECK (
        octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "reading_report_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "reading_report_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_version", "idempotency_key_hash"
    )
);

CREATE INDEX "reading_report_reading_created_idx"
    ON "reading_report" ("reading_id", "created_at" DESC, "id" DESC);

CREATE INDEX "reading_report_expiry_idx"
    ON "reading_report" ("expires_at", "id");

COMMIT;
