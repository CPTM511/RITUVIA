-- Recovery Item 9: additive non-custodial SIWE identity and audit foundation.
BEGIN;

CREATE TABLE "wallet_identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "chain_family" VARCHAR(16) NOT NULL DEFAULT 'eip155',
    "chain_id" BIGINT NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "linked_by_session_id" UUID NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sign_in_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_identity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_identity_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "wallet_identity_linking_session_fkey"
        FOREIGN KEY ("linked_by_session_id", "user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "wallet_identity_id_user_key" UNIQUE ("id", "user_id"),
    CONSTRAINT "wallet_identity_chain_address_key" UNIQUE ("chain_family", "address"),
    CONSTRAINT "wallet_identity_chain_check" CHECK (
        "chain_family" = 'eip155'
        AND "chain_id" BETWEEN 1 AND 2147483647
    ),
    CONSTRAINT "wallet_identity_address_check" CHECK (
        "address" = lower("address")
        AND "address" ~ '^0x[0-9a-f]{40}$'
    ),
    CONSTRAINT "wallet_identity_lifecycle_check" CHECK (
        "verified_at" >= "created_at"
        AND ("last_sign_in_at" IS NULL OR "last_sign_in_at" >= "verified_at")
        AND ("revoked_at" IS NULL OR "revoked_at" >= "verified_at")
    )
);

CREATE INDEX "wallet_identity_user_created_idx"
    ON "wallet_identity" ("user_id", "created_at" DESC, "id" DESC);

ALTER TABLE "account_session"
    ADD COLUMN "wallet_identity_id" UUID;

ALTER TABLE "account_session"
    ADD CONSTRAINT "account_session_wallet_identity_fkey"
    FOREIGN KEY ("wallet_identity_id", "user_id")
    REFERENCES "wallet_identity" ("id", "user_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "account_session_wallet_identity_idx"
    ON "account_session" ("wallet_identity_id", "expires_at", "id")
    WHERE "wallet_identity_id" IS NOT NULL;

CREATE TABLE "wallet_auth_challenge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "address" VARCHAR(42) NOT NULL,
    "chain_id" BIGINT NOT NULL,
    "purpose" VARCHAR(16) NOT NULL,
    "message" VARCHAR(2048) NOT NULL,
    "message_hash" BYTEA NOT NULL,
    "nonce_hash" BYTEA NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "requested_by_user_id" UUID,
    "requested_by_session_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "wallet_auth_challenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_auth_challenge_idempotency_key" UNIQUE ("idempotency_key_hash"),
    CONSTRAINT "wallet_auth_challenge_nonce_key" UNIQUE ("nonce_hash"),
    CONSTRAINT "wallet_auth_challenge_requester_fkey"
        FOREIGN KEY ("requested_by_session_id", "requested_by_user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "wallet_auth_challenge_user_fkey"
        FOREIGN KEY ("requested_by_user_id") REFERENCES "app_user" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "wallet_auth_challenge_address_check" CHECK (
        "address" = lower("address")
        AND "address" ~ '^0x[0-9a-f]{40}$'
    ),
    CONSTRAINT "wallet_auth_challenge_chain_check" CHECK (
        "chain_id" BETWEEN 1 AND 2147483647
    ),
    CONSTRAINT "wallet_auth_challenge_purpose_check" CHECK (
        ("purpose" = 'sign_in' AND "requested_by_user_id" IS NULL
            AND "requested_by_session_id" IS NULL)
        OR
        ("purpose" = 'link_wallet' AND "requested_by_user_id" IS NOT NULL
            AND "requested_by_session_id" IS NOT NULL)
    ),
    CONSTRAINT "wallet_auth_challenge_hash_check" CHECK (
        octet_length("message_hash") = 32
        AND octet_length("nonce_hash") = 32
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "wallet_auth_challenge_lifecycle_check" CHECK (
        "expires_at" > "created_at"
        AND ("consumed_at" IS NULL OR
            ("consumed_at" >= "created_at" AND "consumed_at" <= "expires_at"))
        AND "attempt_count" BETWEEN 0 AND 10
    )
);

CREATE INDEX "wallet_auth_challenge_expiry_idx"
    ON "wallet_auth_challenge" ("expires_at", "id");

CREATE TABLE "wallet_auth_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenge_id" UUID NOT NULL,
    "user_id" UUID,
    "wallet_identity_id" UUID,
    "outcome" VARCHAR(16) NOT NULL,
    "reason_code" VARCHAR(40) NOT NULL,
    "signature_hash" BYTEA,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_auth_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_auth_event_challenge_fkey" FOREIGN KEY ("challenge_id")
        REFERENCES "wallet_auth_challenge" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "wallet_auth_event_wallet_fkey"
        FOREIGN KEY ("wallet_identity_id", "user_id")
        REFERENCES "wallet_identity" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "wallet_auth_event_outcome_check" CHECK (
        "outcome" IN ('accepted', 'rejected')
        AND "reason_code" ~ '^[a-z][a-z0-9_]{1,39}$'
    ),
    CONSTRAINT "wallet_auth_event_signature_check" CHECK (
        "signature_hash" IS NULL OR octet_length("signature_hash") = 32
    ),
    CONSTRAINT "wallet_auth_event_wallet_user_check" CHECK (
        ("wallet_identity_id" IS NULL AND "user_id" IS NULL)
        OR ("wallet_identity_id" IS NOT NULL AND "user_id" IS NOT NULL)
    )
);

CREATE INDEX "wallet_auth_event_challenge_created_idx"
    ON "wallet_auth_event" ("challenge_id", "created_at", "id");

ALTER TABLE "privacy_deletion_completion"
    ADD COLUMN "wallet_identity_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "privacy_deletion_completion"
    ADD CONSTRAINT "privacy_deletion_completion_wallet_identity_count_check"
    CHECK ("wallet_identity_count" >= 0);

ALTER TABLE "privacy_deletion_completion"
    ALTER COLUMN "wallet_identity_count" DROP DEFAULT;

ALTER TABLE "wallet_identity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_identity_existing_roles"
    ON "wallet_identity"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "wallet_identity_privacy_deletion"
    ON "wallet_identity"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "wallet_auth_challenge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_auth_challenge_existing_roles"
    ON "wallet_auth_challenge"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "wallet_auth_challenge_privacy_deletion"
    ON "wallet_auth_challenge"
    TO "rituvia_privacy_deletion"
    USING (
        "requested_by_user_id" IN (
            SELECT "user_id" FROM "privacy_deletion_authorized_user"
        )
        OR EXISTS (
            SELECT 1
              FROM "wallet_identity"
             WHERE "wallet_identity"."address" = "wallet_auth_challenge"."address"
               AND "wallet_identity"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        "requested_by_user_id" IN (
            SELECT "user_id" FROM "privacy_deletion_authorized_user"
        )
        OR "message" = 'Private wallet challenge deleted.'
    );

ALTER TABLE "wallet_auth_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_auth_event_existing_roles"
    ON "wallet_auth_event"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "wallet_auth_event_privacy_deletion"
    ON "wallet_auth_event"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

COMMIT;
