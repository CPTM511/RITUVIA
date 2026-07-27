-- RIT-044 adds a private local-calendar Revisit lifecycle and append-only idempotency ledger.
BEGIN;

CREATE TABLE "revisit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "intention_id" UUID NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "intention_revision" INTEGER NOT NULL,
    "intention_text_ciphertext" BYTEA NOT NULL,
    "intention_text_nonce" BYTEA NOT NULL,
    "intention_text_tag" BYTEA NOT NULL,
    "small_action_ciphertext" BYTEA NOT NULL,
    "small_action_nonce" BYTEA NOT NULL,
    "small_action_tag" BYTEA NOT NULL,
    "snapshot_key_version" VARCHAR(100) NOT NULL,
    "schedule_kind" VARCHAR(16) NOT NULL,
    "scheduled_local_date" DATE NOT NULL,
    "time_zone" VARCHAR(100) NOT NULL,
    "reminder_preference" VARCHAR(16) NOT NULL DEFAULT 'none',
    "reminder_channel" VARCHAR(32),
    "quiet_hours_start" TIME,
    "quiet_hours_end" TIME,
    "completion_ciphertext" BYTEA,
    "completion_nonce" BYTEA,
    "completion_tag" BYTEA,
    "completion_key_version" VARCHAR(100),
    "outcome_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(16) NOT NULL DEFAULT 'scheduled',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "revisit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "revisit_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_intention_fkey" FOREIGN KEY (
        "intention_id", "anonymous_subject_id"
    ) REFERENCES "intention" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_subject_identity_key" UNIQUE (
        "id", "anonymous_subject_id"
    ),
    CONSTRAINT "revisit_versions_check" CHECK (
        "schema_version" = 'reflection-revisit.v1'
        AND "policy_version" = 'reflection-loop.en.v1'
    ),
    CONSTRAINT "revisit_snapshot_check" CHECK (
        "intention_revision" >= 1
        AND octet_length("intention_text_ciphertext") BETWEEN 1 AND 16384
        AND octet_length("intention_text_nonce") = 12
        AND octet_length("intention_text_tag") = 16
        AND octet_length("small_action_ciphertext") BETWEEN 1 AND 16384
        AND octet_length("small_action_nonce") = 12
        AND octet_length("small_action_tag") = 16
        AND "snapshot_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "revisit_schedule_check" CHECK (
        "schedule_kind" IN ('next_day', 'seven_days', 'custom')
        AND timezone(
            "time_zone",
            TIMESTAMPTZ '2000-01-01 00:00:00+00'
        ) IS NOT NULL
        AND "reminder_preference" = 'none'
        AND "reminder_channel" IS NULL
        AND (
            (
                "quiet_hours_start" IS NULL
                AND "quiet_hours_end" IS NULL
            )
            OR (
                "quiet_hours_start" IS NOT NULL
                AND "quiet_hours_end" IS NOT NULL
                AND "quiet_hours_start" <> "quiet_hours_end"
            )
        )
    ),
    CONSTRAINT "revisit_completion_check" CHECK (
        (
            "completion_ciphertext" IS NULL
            AND "completion_nonce" IS NULL
            AND "completion_tag" IS NULL
            AND "completion_key_version" IS NULL
            AND cardinality("outcome_tags") = 0
            AND "completed_at" IS NULL
        )
        OR (
            octet_length("completion_ciphertext") BETWEEN 1 AND 16384
            AND octet_length("completion_nonce") = 12
            AND octet_length("completion_tag") = 16
            AND "completion_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND "completed_at" IS NOT NULL
            AND cardinality("outcome_tags") BETWEEN 0 AND 3
            AND "outcome_tags" <@ ARRAY[
                'action_taken', 'partial_progress', 'changed_direction',
                'not_yet', 'released'
            ]::TEXT[]
            AND (
                cardinality("outcome_tags") < 2
                OR "outcome_tags"[1] <> "outcome_tags"[2]
            )
            AND (
                cardinality("outcome_tags") < 3
                OR (
                    "outcome_tags"[1] <> "outcome_tags"[3]
                    AND "outcome_tags"[2] <> "outcome_tags"[3]
                )
            )
        )
    ),
    CONSTRAINT "revisit_lifecycle_check" CHECK (
        "updated_at" >= "created_at"
        AND "expires_at" > "updated_at"
        AND "revision" >= 1
        AND (
            (
                "status" = 'scheduled'
                AND "completed_at" IS NULL
                AND "archived_at" IS NULL
            )
            OR (
                "status" = 'completed'
                AND "completed_at" BETWEEN "created_at" AND "updated_at"
                AND "archived_at" IS NULL
            )
            OR (
                "status" = 'archived'
                AND "archived_at" BETWEEN "created_at" AND "updated_at"
                AND (
                    "completed_at" IS NULL
                    OR "completed_at" <= "archived_at"
                )
            )
        )
        AND (
            "deleted_at" IS NULL
            OR "deleted_at" BETWEEN "created_at" AND "updated_at"
        )
    )
);

CREATE UNIQUE INDEX "revisit_subject_intention_scheduled_key"
    ON "revisit" ("anonymous_subject_id", "intention_id")
    WHERE "status" = 'scheduled' AND "deleted_at" IS NULL;

CREATE INDEX "revisit_subject_schedule_idx"
    ON "revisit" (
        "anonymous_subject_id", "scheduled_local_date", "created_at" DESC, "id" DESC
    );

CREATE TABLE "revisit_operation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "revisit_id" UUID NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "result_revision" INTEGER NOT NULL,
    "result_status" VARCHAR(16) NOT NULL,
    "result_deleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisit_operation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "revisit_operation_revisit_fkey" FOREIGN KEY (
        "revisit_id", "anonymous_subject_id"
    ) REFERENCES "revisit" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_operation_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "revisit_operation_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "revisit_operation_result_check" CHECK (
        "action" IN ('schedule', 'reschedule', 'complete', 'archive', 'delete')
        AND "result_revision" >= 1
        AND "result_status" IN ('scheduled', 'completed', 'archived')
        AND ("action" = 'delete') = "result_deleted"
    )
);

CREATE INDEX "revisit_operation_revisit_created_idx"
    ON "revisit_operation" ("revisit_id", "created_at", "id");

COMMIT;
