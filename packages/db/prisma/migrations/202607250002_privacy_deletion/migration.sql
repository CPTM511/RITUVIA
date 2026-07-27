-- RIT-054 adds append-only privacy-deletion requests/completions and reversible schema state only.
BEGIN;

CREATE TABLE "privacy_deletion_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "requested_by_session_id" UUID NOT NULL,
    "scope" VARCHAR(24) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "replay_session_token_hash" BYTEA NOT NULL,
    "retention_categories" TEXT[] NOT NULL,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_deletion_request_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "privacy_deletion_request_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_deletion_request_session_user_fkey"
        FOREIGN KEY ("requested_by_session_id", "user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_deletion_request_user_identity_key" UNIQUE ("id", "user_id"),
    CONSTRAINT "privacy_deletion_request_user_idempotency_key"
        UNIQUE ("user_id", "idempotency_key_hash"),
    CONSTRAINT "privacy_deletion_request_scope_check"
        CHECK ("scope" IN ('private_content', 'account')),
    CONSTRAINT "privacy_deletion_request_policy_check"
        CHECK ("policy_version" = 'privacy-deletion.local.v1'),
    CONSTRAINT "privacy_deletion_request_digest_check"
        CHECK (
            octet_length("idempotency_key_hash") = 32
            AND octet_length("canonical_request_hash") = 32
            AND octet_length("replay_session_token_hash") = 32
        ),
    CONSTRAINT "privacy_deletion_request_retention_check"
        CHECK (
            "retention_categories" = ARRAY[
                'derived_reflection_metadata',
                'consent_history',
                'commerce_financial',
                'security_privacy_audit'
            ]::TEXT[]
        )
);

CREATE INDEX "privacy_deletion_request_user_requested_idx"
    ON "privacy_deletion_request" ("user_id", "requested_at" DESC, "id" DESC);

CREATE TABLE "privacy_deletion_completion" (
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subject_count" INTEGER NOT NULL,
    "intention_count" INTEGER NOT NULL,
    "legacy_journal_count" INTEGER NOT NULL,
    "current_journal_count" INTEGER NOT NULL,
    "revisit_count" INTEGER NOT NULL,
    "interpretation_count" INTEGER NOT NULL,
    "verification_count" INTEGER NOT NULL,
    "export_artifact_count" INTEGER NOT NULL,
    "auth_identity_count" INTEGER NOT NULL,
    "account_session_count" INTEGER NOT NULL,
    "passkey_count" INTEGER NOT NULL,
    "evidence_sha256" BYTEA NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_deletion_completion_pkey" PRIMARY KEY ("request_id"),
    CONSTRAINT "privacy_deletion_completion_request_user_key"
        UNIQUE ("request_id", "user_id"),
    CONSTRAINT "privacy_deletion_completion_request_user_fkey"
        FOREIGN KEY ("request_id", "user_id")
        REFERENCES "privacy_deletion_request" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "privacy_deletion_completion_counts_check"
        CHECK (
            "subject_count" >= 0
            AND "intention_count" >= 0
            AND "legacy_journal_count" >= 0
            AND "current_journal_count" >= 0
            AND "revisit_count" >= 0
            AND "interpretation_count" >= 0
            AND "verification_count" >= 0
            AND "export_artifact_count" >= 0
            AND "auth_identity_count" >= 0
            AND "account_session_count" >= 0
            AND "passkey_count" >= 0
        ),
    CONSTRAINT "privacy_deletion_completion_digest_check"
        CHECK (octet_length("evidence_sha256") = 32)
);

CREATE INDEX "privacy_deletion_completion_user_completed_idx"
    ON "privacy_deletion_completion" ("user_id", "completed_at" DESC, "request_id" DESC);

CREATE TABLE "auth_identity_suppression" (
    "provider_key" VARCHAR(40) NOT NULL,
    "provider_subject_hash" BYTEA NOT NULL,
    "user_id" UUID NOT NULL,
    "deletion_request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identity_suppression_pkey"
        PRIMARY KEY ("provider_key", "provider_subject_hash"),
    CONSTRAINT "auth_identity_suppression_request_user_fkey"
        FOREIGN KEY ("deletion_request_id", "user_id")
        REFERENCES "privacy_deletion_request" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "auth_identity_suppression_provider_check"
        CHECK (
            octet_length("provider_key") <= 40
            AND "provider_key" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND octet_length("provider_subject_hash") = 32
        )
);

CREATE INDEX "auth_identity_suppression_user_created_idx"
    ON "auth_identity_suppression" ("user_id", "created_at" DESC, "provider_key");

ALTER TABLE "account_subject_link"
    ADD COLUMN "privacy_deleted_at" TIMESTAMPTZ(6),
    ADD COLUMN "privacy_deletion_request_id" UUID,
    ADD CONSTRAINT "account_subject_link_privacy_deletion_request_fkey"
        FOREIGN KEY ("privacy_deletion_request_id", "user_id")
        REFERENCES "privacy_deletion_request" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "account_subject_link_privacy_deletion_state_check"
        CHECK (
            (
                "privacy_deleted_at" IS NULL
                AND "privacy_deletion_request_id" IS NULL
            )
            OR (
                "privacy_deleted_at" IS NOT NULL
                AND "privacy_deletion_request_id" IS NOT NULL
                AND "privacy_deleted_at" >= "created_at"
            )
        );

CREATE INDEX "account_subject_link_privacy_deletion_idx"
    ON "account_subject_link" (
        "user_id", "privacy_deleted_at", "created_at" DESC, "id" DESC
    );

CREATE POLICY "interpretation_privacy_deletion_read"
    ON "interpretation"
    FOR SELECT
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                       "interpretation"."anonymous_subject_id"
               AND "account_subject_link"."privacy_deletion_request_id" IS NOT NULL
        )
    );

CREATE POLICY "interpretation_privacy_deletion"
    ON "interpretation"
    FOR UPDATE
    TO "rituvia_privacy_deletion"
    USING (
        "fallback_output" IS NOT NULL
        AND EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                       "interpretation"."anonymous_subject_id"
               AND "account_subject_link"."privacy_deletion_request_id" IS NOT NULL
        )
    )
    WITH CHECK (
        "status" = 'fallback'
        AND "fallback_output" IS NOT NULL
        AND "finalization_hash" IS NOT NULL
        AND EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                       "interpretation"."anonymous_subject_id"
               AND "account_subject_link"."privacy_deletion_request_id" IS NOT NULL
        )
    );

CREATE POLICY "interpretation_verification_privacy_deletion_read"
    ON "interpretation_verification"
    FOR SELECT
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                       "interpretation_verification"."anonymous_subject_id"
               AND "account_subject_link"."privacy_deletion_request_id" IS NOT NULL
        )
    );

CREATE POLICY "interpretation_verification_privacy_deletion"
    ON "interpretation_verification"
    FOR UPDATE
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                       "interpretation_verification"."anonymous_subject_id"
               AND "account_subject_link"."privacy_deletion_request_id" IS NOT NULL
        )
    )
    WITH CHECK (
        "output" IS NOT NULL
        AND "candidate_digest" IS NOT NULL
        AND "output_digest" IS NOT NULL
        AND "finalization_digest" IS NOT NULL
        AND EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                       "interpretation_verification"."anonymous_subject_id"
               AND "account_subject_link"."privacy_deletion_request_id" IS NOT NULL
        )
    );

COMMIT;
