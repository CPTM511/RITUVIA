-- Owner-directed commercial MVP account foundation. Expand-only; no existing rows are rewritten.
BEGIN;

CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "locale" VARCHAR(35) NOT NULL DEFAULT 'en',
    "time_zone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "display_name" VARCHAR(120),
    "email_verified_at" TIMESTAMPTZ(6) NOT NULL,
    "age_attested_at" TIMESTAMPTZ(6),
    "age_policy_version" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "app_user_status_check" CHECK (
        "status" IN ('active', 'suspended', 'deletion_pending', 'deleted')
    ),
    CONSTRAINT "app_user_locale_check" CHECK (
        "locale" ~ '^[A-Za-z0-9]{2,8}(-[A-Za-z0-9]{1,8})*$'
    ),
    CONSTRAINT "app_user_time_zone_check" CHECK (
        octet_length("time_zone") BETWEEN 1 AND 64
        AND "time_zone" !~ '[[:cntrl:]]'
    ),
    CONSTRAINT "app_user_age_attestation_check" CHECK (
        ("age_attested_at" IS NULL AND "age_policy_version" IS NULL)
        OR (
            "age_attested_at" IS NOT NULL
            AND "age_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        )
    ),
    CONSTRAINT "app_user_activity_check" CHECK (
        "last_active_at" >= "created_at"
        AND "email_verified_at" <= "last_active_at"
    ),
    CONSTRAINT "app_user_profile_version_check" CHECK ("profile_version" > 0)
);

CREATE INDEX "app_user_status_activity_idx"
    ON "app_user" ("status", "last_active_at" DESC, "id");

CREATE TABLE "auth_identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider_key" VARCHAR(40) NOT NULL,
    "provider_subject" VARCHAR(200) NOT NULL,
    "verified_email_ciphertext" BYTEA NOT NULL,
    "verified_email_nonce" BYTEA NOT NULL,
    "verified_email_tag" BYTEA NOT NULL,
    "encryption_key_version" VARCHAR(100) NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL,
    "last_sign_in_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_identity_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "auth_identity_provider_subject_key" UNIQUE (
        "provider_key", "provider_subject"
    ),
    CONSTRAINT "auth_identity_provider_check" CHECK (
        octet_length("provider_key") <= 40
        AND "provider_key" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND octet_length("provider_subject") BETWEEN 16 AND 200
        AND "provider_subject" !~ '[[:cntrl:][:space:]]'
    ),
    CONSTRAINT "auth_identity_email_cipher_check" CHECK (
        octet_length("verified_email_ciphertext") BETWEEN 1 AND 512
        AND octet_length("verified_email_nonce") = 12
        AND octet_length("verified_email_tag") = 16
        AND "encryption_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "auth_identity_timestamps_check" CHECK (
        "verified_at" <= "created_at"
        AND "last_sign_in_at" >= "verified_at"
    )
);

CREATE INDEX "auth_identity_user_created_idx"
    ON "auth_identity" ("user_id", "created_at", "id");

CREATE TABLE "auth_challenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_key" VARCHAR(40) NOT NULL,
    "provider_subject" VARCHAR(200) NOT NULL,
    "email_ciphertext" BYTEA NOT NULL,
    "email_nonce" BYTEA NOT NULL,
    "email_tag" BYTEA NOT NULL,
    "encryption_key_version" VARCHAR(100) NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "token_hash_version" SMALLINT NOT NULL DEFAULT 1,
    "state_hash" BYTEA NOT NULL,
    "return_to" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "auth_challenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_challenge_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "auth_challenge_state_hash_key" UNIQUE ("state_hash"),
    CONSTRAINT "auth_challenge_provider_check" CHECK (
        octet_length("provider_key") <= 40
        AND "provider_key" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND octet_length("provider_subject") BETWEEN 16 AND 200
        AND "provider_subject" !~ '[[:cntrl:][:space:]]'
    ),
    CONSTRAINT "auth_challenge_email_cipher_check" CHECK (
        octet_length("email_ciphertext") BETWEEN 1 AND 512
        AND octet_length("email_nonce") = 12
        AND octet_length("email_tag") = 16
        AND "encryption_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "auth_challenge_hash_check" CHECK (
        octet_length("token_hash") = 32
        AND octet_length("state_hash") = 32
        AND "token_hash_version" = 1
    ),
    CONSTRAINT "auth_challenge_return_to_check" CHECK (
        "return_to" ~ '^/en(?:/|$)'
        AND "return_to" !~ '[[:cntrl:]]'
    ),
    CONSTRAINT "auth_challenge_lifecycle_check" CHECK (
        "expires_at" > "created_at"
        AND (
            "consumed_at" IS NULL
            OR ("consumed_at" >= "created_at" AND "consumed_at" <= "expires_at")
        )
        AND "attempt_count" BETWEEN 0 AND 10
    )
);

CREATE INDEX "auth_challenge_expiry_idx"
    ON "auth_challenge" ("expires_at", "id");

CREATE TABLE "account_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "auth_identity_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "token_hash_version" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "account_session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_session_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "account_session_identity_fkey" FOREIGN KEY ("auth_identity_id")
        REFERENCES "auth_identity" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "account_session_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "account_session_token_check" CHECK (
        octet_length("token_hash") = 32 AND "token_hash_version" = 1
    ),
    CONSTRAINT "account_session_lifecycle_check" CHECK (
        "expires_at" > "created_at"
        AND "last_seen_at" >= "created_at"
        AND "last_seen_at" <= "expires_at"
        AND (
            "revoked_at" IS NULL
            OR ("revoked_at" >= "created_at" AND "revoked_at" <= "expires_at")
        )
    )
);

CREATE INDEX "account_session_user_expiry_idx"
    ON "account_session" ("user_id", "expires_at", "id");
CREATE INDEX "account_session_expiry_idx"
    ON "account_session" ("expires_at", "id");

CREATE TABLE "account_subject_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "anonymous_subject_id" UUID NOT NULL,
    "source_session_id" UUID NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_subject_link_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_subject_link_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "account_subject_link_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "account_subject_link_subject_key" UNIQUE ("anonymous_subject_id"),
    CONSTRAINT "account_subject_link_user_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_hash"
    ),
    CONSTRAINT "account_subject_link_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    )
);

CREATE INDEX "account_subject_link_user_created_idx"
    ON "account_subject_link" ("user_id", "created_at" DESC, "id" DESC);

COMMIT;
