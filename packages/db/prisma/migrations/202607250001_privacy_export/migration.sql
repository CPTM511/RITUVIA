-- RIT-053 adds append-only encrypted, expiring account privacy exports and audit evidence.
BEGIN;

ALTER TABLE "account_session"
    ADD COLUMN "authenticated_at" TIMESTAMPTZ(6),
    ADD CONSTRAINT "account_session_authenticated_lifecycle_check"
    CHECK (
        "authenticated_at" IS NULL
        OR (
            "authenticated_at" <= "created_at"
            AND "created_at" <= "last_seen_at"
            AND "created_at" < "expires_at"
        )
    );

CREATE TABLE "privacy_export" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "requested_by_session_id" UUID NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "encryption_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "privacy_export_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "privacy_export_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_export_session_user_fkey"
        FOREIGN KEY ("requested_by_session_id", "user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_export_user_identity_key" UNIQUE ("id", "user_id"),
    CONSTRAINT "privacy_export_user_idempotency_key" UNIQUE ("user_id", "idempotency_key_hash"),
    CONSTRAINT "privacy_export_version_check"
        CHECK (
            "schema_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND "encryption_key_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        ),
    CONSTRAINT "privacy_export_digest_check"
        CHECK (
            octet_length("idempotency_key_hash") = 32
            AND octet_length("canonical_request_hash") = 32
        ),
    CONSTRAINT "privacy_export_lifecycle_check"
        CHECK ("expires_at" > "created_at")
);

CREATE INDEX "privacy_export_user_created_idx"
    ON "privacy_export" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "privacy_export_expiry_idx"
    ON "privacy_export" ("expires_at", "id");

CREATE TABLE "privacy_export_artifact" (
    "export_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "nonce" BYTEA NOT NULL,
    "authentication_tag" BYTEA NOT NULL,
    "plaintext_sha256" BYTEA NOT NULL,
    "plaintext_bytes" INTEGER NOT NULL,
    "record_count" INTEGER NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_export_artifact_pkey" PRIMARY KEY ("export_id"),
    CONSTRAINT "privacy_export_artifact_export_user_key" UNIQUE ("export_id", "user_id"),
    CONSTRAINT "privacy_export_artifact_export_user_fkey"
        FOREIGN KEY ("export_id", "user_id")
        REFERENCES "privacy_export" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_export_artifact_shape_check"
        CHECK (
            octet_length("ciphertext") BETWEEN 1 AND 16777216
            AND octet_length("nonce") = 12
            AND octet_length("authentication_tag") = 16
            AND octet_length("plaintext_sha256") = 32
            AND "plaintext_bytes" BETWEEN 1 AND 16777216
            AND "record_count" >= 0
        )
);

CREATE INDEX "privacy_export_artifact_user_completed_idx"
    ON "privacy_export_artifact" ("user_id", "completed_at" DESC, "export_id" DESC);

CREATE TABLE "privacy_export_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "export_id" UUID NOT NULL,
    "actor_session_id" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_export_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "privacy_export_audit_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_export_audit_export_user_fkey"
        FOREIGN KEY ("export_id", "user_id")
        REFERENCES "privacy_export" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_export_audit_session_user_fkey"
        FOREIGN KEY ("actor_session_id", "user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_export_audit_action_check"
        CHECK ("action" IN ('requested', 'completed', 'failed', 'download_authorized')),
    CONSTRAINT "privacy_export_audit_metadata_check"
        CHECK (jsonb_typeof("metadata") = 'object' AND octet_length("metadata"::text) <= 2048)
);

CREATE INDEX "privacy_export_audit_export_created_idx"
    ON "privacy_export_audit" ("export_id", "created_at", "id");
CREATE INDEX "privacy_export_audit_user_created_idx"
    ON "privacy_export_audit" ("user_id", "created_at" DESC, "id" DESC);

COMMIT;
