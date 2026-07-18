-- Owner-directed commercial MVP reflection loop. Sensitive free text is ciphertext only.
BEGIN;

CREATE TABLE "intention" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "reading_id" UUID,
    "intention_code" VARCHAR(40) NOT NULL,
    "small_action_ciphertext" BYTEA NOT NULL,
    "small_action_nonce" BYTEA NOT NULL,
    "small_action_tag" BYTEA NOT NULL,
    "encryption_key_version" VARCHAR(100) NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intention_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "intention_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "intention_reading_fkey" FOREIGN KEY ("reading_id", "anonymous_subject_id")
        REFERENCES "reading" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "intention_subject_identity_key" UNIQUE ("id", "anonymous_subject_id"),
    CONSTRAINT "intention_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "intention_code_check" CHECK (
        "intention_code" IN (
            'calm_clarity', 'gratitude_abundance', 'courage_action',
            'connection_understanding', 'release_renewal'
        )
    ),
    CONSTRAINT "intention_cipher_check" CHECK (
        octet_length("small_action_ciphertext") BETWEEN 1 AND 4096
        AND octet_length("small_action_nonce") = 12
        AND octet_length("small_action_tag") = 16
        AND "encryption_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "intention_versions_check" CHECK (
        "schema_version" = 'reflection-intention.v1'
        AND "policy_version" = 'reflection-loop.en.v1'
    ),
    CONSTRAINT "intention_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "intention_lifecycle_check" CHECK (
        "updated_at" >= "created_at"
        AND "expires_at" > "created_at"
        AND (
            "completed_at" IS NULL
            OR ("completed_at" >= "created_at" AND "completed_at" <= "expires_at")
        )
    )
);

CREATE INDEX "intention_subject_created_idx"
    ON "intention" ("anonymous_subject_id", "created_at" DESC, "id" DESC);

CREATE TABLE "ritual_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "intention_id" UUID NOT NULL,
    "object_code" VARCHAR(64) NOT NULL,
    "ritual_date_utc" DATE NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ritual_session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ritual_session_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_session_intention_fkey" FOREIGN KEY (
        "intention_id", "anonymous_subject_id"
    ) REFERENCES "intention" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ritual_session_subject_identity_key" UNIQUE ("id", "anonymous_subject_id"),
    CONSTRAINT "ritual_session_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "ritual_session_subject_daily_key" UNIQUE (
        "anonymous_subject_id", "ritual_date_utc"
    ),
    CONSTRAINT "ritual_session_object_check" CHECK (
        "object_code" IN (
            'candle', 'incense', 'mindful_incense', 'moonlit_lotus',
            'amethyst_guardian', 'golden_intention_bowl'
        )
    ),
    CONSTRAINT "ritual_session_versions_check" CHECK (
        "schema_version" = 'reflection-ritual.v1'
        AND "policy_version" = 'reflection-loop.en.v1'
    ),
    CONSTRAINT "ritual_session_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "ritual_session_lifecycle_check" CHECK (
        "expires_at" > "started_at"
        AND (
            "completed_at" IS NULL
            OR ("completed_at" >= "started_at" AND "completed_at" <= "expires_at")
        )
    )
);

CREATE INDEX "ritual_session_subject_started_idx"
    ON "ritual_session" ("anonymous_subject_id", "started_at" DESC, "id" DESC);

CREATE TABLE "journal_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "intention_id" UUID NOT NULL,
    "ritual_session_id" UUID,
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
    "revisit_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "journal_entry_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "journal_entry_intention_fkey" FOREIGN KEY (
        "intention_id", "anonymous_subject_id"
    ) REFERENCES "intention" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "journal_entry_ritual_fkey" FOREIGN KEY (
        "ritual_session_id", "anonymous_subject_id"
    ) REFERENCES "ritual_session" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "journal_entry_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "journal_entry_cipher_check" CHECK (
        octet_length("reflection_ciphertext") BETWEEN 1 AND 16384
        AND octet_length("reflection_nonce") = 12
        AND octet_length("reflection_tag") = 16
        AND "encryption_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "journal_entry_versions_check" CHECK (
        "schema_version" = 'reflection-journal.v1'
        AND "policy_version" = 'reflection-loop.en.v1'
    ),
    CONSTRAINT "journal_entry_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "journal_entry_lifecycle_check" CHECK (
        "updated_at" >= "created_at"
        AND "expires_at" > "created_at"
        AND ("revisit_at" IS NULL OR "revisit_at" >= "created_at")
        AND (
            "deleted_at" IS NULL
            OR ("deleted_at" >= "created_at" AND "deleted_at" <= "expires_at")
        )
    )
);

CREATE INDEX "journal_entry_subject_created_idx"
    ON "journal_entry" ("anonymous_subject_id", "created_at" DESC, "id" DESC);
CREATE INDEX "journal_entry_revisit_idx"
    ON "journal_entry" ("revisit_at", "id");

COMMIT;
