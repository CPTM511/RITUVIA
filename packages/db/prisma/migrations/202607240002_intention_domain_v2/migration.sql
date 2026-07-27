-- RIT-040 expands private intentions without rewriting strict historical v1 rows.
BEGIN;

ALTER TABLE "intention"
    ADD COLUMN "intention_text_ciphertext" BYTEA,
    ADD COLUMN "intention_text_nonce" BYTEA,
    ADD COLUMN "intention_text_tag" BYTEA,
    ADD COLUMN "contract_version" VARCHAR(100) NOT NULL DEFAULT 'reflection-intention.v1',
    ADD COLUMN "privacy_state" VARCHAR(16) NOT NULL DEFAULT 'private',
    ADD COLUMN "reminder_preference" VARCHAR(16) NOT NULL DEFAULT 'none',
    ADD COLUMN "revisit_date" DATE,
    ADD COLUMN "time_zone" VARCHAR(100),
    ADD COLUMN "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "last_mutation_key_hash" BYTEA,
    ADD COLUMN "last_mutation_request_hash" BYTEA,
    ADD COLUMN "archived_at" TIMESTAMPTZ(6),
    ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

ALTER TABLE "intention"
    ADD CONSTRAINT "intention_contract_version_check" CHECK (
        "contract_version" IN ('reflection-intention.v1', 'reflection-intention.v2')
    ),
    ADD CONSTRAINT "intention_v2_contract_check" CHECK (
        (
            "contract_version" = 'reflection-intention.v1'
            AND "intention_text_ciphertext" IS NULL
            AND "intention_text_nonce" IS NULL
            AND "intention_text_tag" IS NULL
            AND "privacy_state" = 'private'
            AND "reminder_preference" = 'none'
            AND "revisit_date" IS NULL
            AND "time_zone" IS NULL
            AND "status" = 'active'
            AND "revision" = 1
            AND "last_mutation_key_hash" IS NULL
            AND "last_mutation_request_hash" IS NULL
            AND "archived_at" IS NULL
            AND "deleted_at" IS NULL
        )
        OR (
            "contract_version" = 'reflection-intention.v2'
            AND "intention_text_ciphertext" IS NOT NULL
            AND "intention_text_nonce" IS NOT NULL
            AND "intention_text_tag" IS NOT NULL
            AND octet_length("intention_text_ciphertext") BETWEEN 1 AND 4096
            AND octet_length("intention_text_nonce") = 12
            AND octet_length("intention_text_tag") = 16
            AND "privacy_state" = 'private'
            AND "reminder_preference" = 'none'
            AND (
                ("revisit_date" IS NULL AND "time_zone" IS NULL)
                OR (
                    "revisit_date" IS NOT NULL
                    AND "time_zone" IS NOT NULL
                    AND length("time_zone") BETWEEN 1 AND 100
                )
            )
            AND "status" IN ('active', 'completed', 'archived')
            AND "revision" >= 1
            AND (
                ("last_mutation_key_hash" IS NULL AND "last_mutation_request_hash" IS NULL)
                OR (
                    octet_length("last_mutation_key_hash") = 32
                    AND octet_length("last_mutation_request_hash") = 32
                )
            )
        )
    ),
    ADD CONSTRAINT "intention_v2_lifecycle_check" CHECK (
        "updated_at" >= "created_at"
        AND "updated_at" <= "expires_at"
        AND "expires_at" > "created_at"
        AND (
            "completed_at" IS NULL
            OR ("completed_at" >= "created_at" AND "completed_at" <= "expires_at")
        )
        AND (
            "archived_at" IS NULL
            OR ("archived_at" >= "created_at" AND "archived_at" <= "expires_at")
        )
        AND (
            "deleted_at" IS NULL
            OR ("deleted_at" >= "created_at" AND "deleted_at" <= "expires_at")
        )
        AND (
            "contract_version" = 'reflection-intention.v1'
            OR "deleted_at" IS NOT NULL
            OR (
                "status" = 'active'
                AND "completed_at" IS NULL
                AND "archived_at" IS NULL
            )
            OR (
                "status" = 'completed'
                AND "completed_at" IS NOT NULL
                AND "archived_at" IS NULL
            )
            OR (
                "status" = 'archived'
                AND "archived_at" IS NOT NULL
            )
        )
    );

CREATE INDEX "intention_subject_status_updated_idx"
    ON "intention" ("anonymous_subject_id", "status", "updated_at" DESC, "id" DESC)
    WHERE "deleted_at" IS NULL;

COMMIT;
