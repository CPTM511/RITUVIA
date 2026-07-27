-- RIT-043 adds versioned ritual lifecycle, consumable pass, and private journal tables without rewriting v1 history.
BEGIN;

CREATE TABLE "ritual_session_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "intention_id" UUID NOT NULL,
    "item_code" VARCHAR(64) NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "catalog_id" VARCHAR(100) NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "item_version" VARCHAR(100) NOT NULL,
    "publication_id" VARCHAR(120) NOT NULL,
    "template_code" VARCHAR(100) NOT NULL,
    "template_version" VARCHAR(100) NOT NULL,
    "access_kind" VARCHAR(32) NOT NULL,
    "access_requirement_code" VARCHAR(120),
    "ritual_pass_id" UUID,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "current_step_code" VARCHAR(32) NOT NULL DEFAULT 'prepare',
    "elapsed_seconds" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "paused_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "abandoned_at" TIMESTAMPTZ(6),
    "last_mutation_key_hash" BYTEA,
    "last_mutation_request_hash" BYTEA,

    CONSTRAINT "ritual_session_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ritual_session_v2_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_session_v2_intention_fkey" FOREIGN KEY (
        "intention_id", "anonymous_subject_id"
    ) REFERENCES "intention" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_session_v2_subject_identity_key" UNIQUE (
        "id", "anonymous_subject_id"
    ),
    CONSTRAINT "ritual_session_v2_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "ritual_session_v2_versions_check" CHECK (
        "schema_version" = 'ritual-session.v2'
        AND "policy_version" = 'reflection-loop.en.v1'
    ),
    CONSTRAINT "ritual_session_v2_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND (
            (
                "last_mutation_key_hash" IS NULL
                AND "last_mutation_request_hash" IS NULL
            )
            OR (
                octet_length("last_mutation_key_hash") = 32
                AND octet_length("last_mutation_request_hash") = 32
            )
        )
    ),
    CONSTRAINT "ritual_session_v2_snapshot_check" CHECK (
        "catalog_id" = 'rituvia-original-secular'
        AND "catalog_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "item_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "template_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
        AND "item_code" IN (
            'free_candle', 'free_incense', 'mindful_incense', 'moonlit_lotus',
            'amethyst_guardian', 'golden_bowl', 'guided_light', 'offering',
            'moon_phase', 'relationship_release', 'annual_open_close'
        )
        AND (
            (
                "access_kind" = 'free'
                AND "access_requirement_code" IS NULL
                AND "ritual_pass_id" IS NULL
            )
            OR (
                "access_kind" = 'permanent_entitlement'
                AND "access_requirement_code" IS NOT NULL
                AND "ritual_pass_id" IS NULL
            )
            OR (
                "access_kind" = 'consumable_pass'
                AND "access_requirement_code" IS NOT NULL
                AND "ritual_pass_id" IS NOT NULL
            )
        )
    ),
    CONSTRAINT "ritual_session_v2_lifecycle_check" CHECK (
        "expires_at" > "started_at"
        AND "current_step_code" IN (
            'prepare', 'light', 'place', 'breathe', 'pause', 'complete'
        )
        AND "elapsed_seconds" BETWEEN 0 AND 86400
        AND "revision" >= 1
        AND (
            (
                "status" = 'active'
                AND "paused_at" IS NULL
                AND "completed_at" IS NULL
                AND "abandoned_at" IS NULL
            )
            OR (
                "status" = 'paused'
                AND "paused_at" BETWEEN "started_at" AND "expires_at"
                AND "completed_at" IS NULL
                AND "abandoned_at" IS NULL
            )
            OR (
                "status" = 'completed'
                AND "paused_at" IS NULL
                AND "completed_at" BETWEEN "started_at" AND "expires_at"
                AND "abandoned_at" IS NULL
            )
            OR (
                "status" = 'abandoned'
                AND "paused_at" IS NULL
                AND "completed_at" IS NULL
                AND "abandoned_at" BETWEEN "started_at" AND "expires_at"
            )
        )
    )
);

CREATE UNIQUE INDEX "ritual_session_v2_subject_intention_open_key"
    ON "ritual_session_v2" ("anonymous_subject_id", "intention_id")
    WHERE "status" IN ('active', 'paused');

CREATE INDEX "ritual_session_v2_subject_started_idx"
    ON "ritual_session_v2" ("anonymous_subject_id", "started_at" DESC, "id" DESC);

CREATE TABLE "ritual_pass" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "access_requirement_code" VARCHAR(120) NOT NULL,
    "source_order_line_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'available',
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),
    "reversed_at" TIMESTAMPTZ(6),
    "ritual_session_id" UUID,

    CONSTRAINT "ritual_pass_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ritual_pass_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_pass_order_line_fkey" FOREIGN KEY ("source_order_line_id")
        REFERENCES "commerce_order_line" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_pass_session_fkey" FOREIGN KEY ("ritual_session_id")
        REFERENCES "ritual_session_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_pass_source_order_line_key" UNIQUE ("source_order_line_id"),
    CONSTRAINT "ritual_pass_session_key" UNIQUE ("ritual_session_id"),
    CONSTRAINT "ritual_pass_requirement_check" CHECK (
        "access_requirement_code" ~ '^ritual-pass\.[a-z][a-z0-9_]{0,79}$'
    ),
    CONSTRAINT "ritual_pass_status_check" CHECK (
        "status" IN ('available', 'consumed', 'reversed')
    ),
    CONSTRAINT "ritual_pass_lifecycle_check" CHECK (
        (
            "status" = 'available'
            AND "consumed_at" IS NULL
            AND "reversed_at" IS NULL
            AND "ritual_session_id" IS NULL
        )
        OR (
            "status" = 'consumed'
            AND "consumed_at" IS NOT NULL
            AND "consumed_at" >= "granted_at"
            AND "reversed_at" IS NULL
            AND "ritual_session_id" IS NOT NULL
        )
        OR (
            "status" = 'reversed'
            AND "reversed_at" IS NOT NULL
            AND "reversed_at" >= "granted_at"
        )
    )
);

CREATE INDEX "ritual_pass_user_requirement_status_idx"
    ON "ritual_pass" (
        "user_id", "access_requirement_code", "status", "granted_at", "id"
    );

ALTER TABLE "ritual_session_v2"
    ADD CONSTRAINT "ritual_session_v2_pass_fkey" FOREIGN KEY ("ritual_pass_id")
        REFERENCES "ritual_pass" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "ritual_session_v2_pass_key" UNIQUE ("ritual_pass_id");

CREATE TABLE "private_journal_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "intention_id" UUID NOT NULL,
    "ritual_session_id" UUID NOT NULL,
    "reflection_ciphertext" BYTEA NOT NULL,
    "reflection_nonce" BYTEA NOT NULL,
    "reflection_tag" BYTEA NOT NULL,
    "encryption_key_version" VARCHAR(100) NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "last_mutation_key_hash" BYTEA,
    "last_mutation_request_hash" BYTEA,

    CONSTRAINT "private_journal_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "private_journal_entry_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "private_journal_entry_intention_fkey" FOREIGN KEY (
        "intention_id", "anonymous_subject_id"
    ) REFERENCES "intention" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "private_journal_entry_session_fkey" FOREIGN KEY (
        "ritual_session_id", "anonymous_subject_id"
    ) REFERENCES "ritual_session_v2" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "private_journal_entry_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "private_journal_entry_versions_check" CHECK (
        "schema_version" = 'private-journal.v2'
        AND "policy_version" = 'reflection-loop.en.v1'
    ),
    CONSTRAINT "private_journal_entry_cipher_check" CHECK (
        octet_length("reflection_ciphertext") BETWEEN 1 AND 16384
        AND octet_length("reflection_nonce") = 12
        AND octet_length("reflection_tag") = 16
        AND "encryption_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "private_journal_entry_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND (
            (
                "last_mutation_key_hash" IS NULL
                AND "last_mutation_request_hash" IS NULL
            )
            OR (
                octet_length("last_mutation_key_hash") = 32
                AND octet_length("last_mutation_request_hash") = 32
            )
        )
    ),
    CONSTRAINT "private_journal_entry_lifecycle_check" CHECK (
        "updated_at" >= "created_at"
        AND "expires_at" > "updated_at"
        AND "revision" >= 1
        AND (
            "deleted_at" IS NULL
            OR ("deleted_at" >= "created_at" AND "deleted_at" <= "expires_at")
        )
    )
);

CREATE INDEX "private_journal_entry_subject_created_idx"
    ON "private_journal_entry" ("anonymous_subject_id", "created_at" DESC, "id" DESC);

COMMIT;
