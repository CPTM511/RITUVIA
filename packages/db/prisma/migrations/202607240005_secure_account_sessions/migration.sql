-- Secure account-session hardening. Expand-only; no existing identity row is rewritten.
BEGIN;

ALTER TABLE "auth_challenge"
    ADD COLUMN "previous_session_hash" BYTEA;

ALTER TABLE "auth_challenge"
    ADD CONSTRAINT "auth_challenge_previous_session_hash_check"
    CHECK (
        "previous_session_hash" IS NULL
        OR octet_length("previous_session_hash") = 32
    );

CREATE TABLE "auth_start_rate_limit" (
    "scope" VARCHAR(16) NOT NULL,
    "key_hash" BYTEA NOT NULL,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL,

    CONSTRAINT "auth_start_rate_limit_pkey" PRIMARY KEY ("scope", "key_hash"),
    CONSTRAINT "auth_start_rate_limit_scope_check" CHECK (
        "scope" IN ('global', 'identifier')
    ),
    CONSTRAINT "auth_start_rate_limit_key_check" CHECK (
        octet_length("key_hash") = 32
    ),
    CONSTRAINT "auth_start_rate_limit_count_check" CHECK (
        "request_count" BETWEEN 1 AND 1000000
    )
);

CREATE INDEX "auth_start_rate_limit_window_idx"
    ON "auth_start_rate_limit" ("window_started_at", "scope");

CREATE TABLE "passkey_credential" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth_identity_id" UUID NOT NULL,
    "credential_id" BYTEA NOT NULL,
    "public_key" BYTEA NOT NULL,
    "rp_id" VARCHAR(253) NOT NULL,
    "sign_count" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "passkey_credential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "passkey_credential_identity_fkey" FOREIGN KEY ("auth_identity_id")
        REFERENCES "auth_identity" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "passkey_credential_credential_id_key" UNIQUE ("credential_id"),
    CONSTRAINT "passkey_credential_material_check" CHECK (
        octet_length("credential_id") BETWEEN 16 AND 1024
        AND octet_length("public_key") BETWEEN 32 AND 4096
    ),
    CONSTRAINT "passkey_credential_rp_check" CHECK (
        octet_length("rp_id") BETWEEN 1 AND 253
        AND "rp_id" = lower("rp_id")
        AND "rp_id" !~ '[[:cntrl:][:space:]]'
        AND "rp_id" !~ '\.\.'
        AND "rp_id" ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
    ),
    CONSTRAINT "passkey_credential_lifecycle_check" CHECK (
        "sign_count" >= 0
        AND ("last_used_at" IS NULL OR "last_used_at" >= "created_at")
        AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
    )
);

CREATE INDEX "passkey_credential_identity_created_idx"
    ON "passkey_credential" ("auth_identity_id", "created_at", "id");

COMMIT;
