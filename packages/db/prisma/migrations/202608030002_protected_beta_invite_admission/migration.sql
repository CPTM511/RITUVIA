-- RIT-168 adds bounded, opaque protected-Beta invite admission without creating any invite.
BEGIN;

CREATE TABLE "protected_beta_invite_cohort" (
    "policy_version" VARCHAR(100) NOT NULL,
    "cohort_limit" SMALLINT NOT NULL,
    "issued_count" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protected_beta_invite_cohort_pkey" PRIMARY KEY ("policy_version"),
    CONSTRAINT "protected_beta_invite_cohort_policy_check" CHECK (
        "policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "protected_beta_invite_cohort_limit_check" CHECK ("cohort_limit" = 25),
    CONSTRAINT "protected_beta_invite_cohort_count_check" CHECK (
        "issued_count" > 0 AND "issued_count" <= "cohort_limit"
    )
);

CREATE TABLE "protected_beta_invite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "policy_version" VARCHAR(100) NOT NULL,
    "seat_number" SMALLINT NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "token_hash_version" SMALLINT NOT NULL DEFAULT 1,
    "creation_key_hash" BYTEA NOT NULL,
    "canonical_creation_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "anonymous_session_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "revocation_key_hash" BYTEA,
    "canonical_revocation_hash" BYTEA,

    CONSTRAINT "protected_beta_invite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "protected_beta_invite_cohort_fkey" FOREIGN KEY ("policy_version")
        REFERENCES "protected_beta_invite_cohort" ("policy_version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "protected_beta_invite_session_fkey" FOREIGN KEY ("anonymous_session_id")
        REFERENCES "anonymous_session" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "protected_beta_invite_policy_seat_key" UNIQUE ("policy_version", "seat_number"),
    CONSTRAINT "protected_beta_invite_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "protected_beta_invite_creation_key_hash_key" UNIQUE ("creation_key_hash"),
    CONSTRAINT "protected_beta_invite_session_key" UNIQUE ("anonymous_session_id"),
    CONSTRAINT "protected_beta_invite_revocation_key_hash_key" UNIQUE ("revocation_key_hash"),
    CONSTRAINT "protected_beta_invite_policy_check" CHECK (
        "policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "protected_beta_invite_seat_check" CHECK (
        "seat_number" > 0 AND "seat_number" <= 25
    ),
    CONSTRAINT "protected_beta_invite_token_hash_check" CHECK (octet_length("token_hash") = 32),
    CONSTRAINT "protected_beta_invite_token_hash_version_check" CHECK ("token_hash_version" = 1),
    CONSTRAINT "protected_beta_invite_creation_key_hash_check" CHECK (
        octet_length("creation_key_hash") = 32
    ),
    CONSTRAINT "protected_beta_invite_canonical_creation_hash_check" CHECK (
        octet_length("canonical_creation_hash") = 32
    ),
    CONSTRAINT "protected_beta_invite_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "protected_beta_invite_consumption_check" CHECK (
        ("consumed_at" IS NULL AND "anonymous_session_id" IS NULL)
        OR (
            "consumed_at" IS NOT NULL
            AND "anonymous_session_id" IS NOT NULL
            AND "consumed_at" >= "created_at"
            AND "consumed_at" <= "expires_at"
        )
    ),
    CONSTRAINT "protected_beta_invite_revocation_check" CHECK (
        ("revoked_at" IS NULL AND "revocation_key_hash" IS NULL
            AND "canonical_revocation_hash" IS NULL)
        OR (
            "revoked_at" IS NOT NULL
            AND "revocation_key_hash" IS NOT NULL
            AND octet_length("revocation_key_hash") = 32
            AND "canonical_revocation_hash" IS NOT NULL
            AND octet_length("canonical_revocation_hash") = 32
            AND "revoked_at" >= "created_at"
        )
    )
);

CREATE INDEX "protected_beta_invite_expiry_idx"
    ON "protected_beta_invite" ("policy_version", "expires_at", "id");
CREATE INDEX "protected_beta_invite_state_idx"
    ON "protected_beta_invite" ("policy_version", "revoked_at", "consumed_at", "id");

COMMIT;
