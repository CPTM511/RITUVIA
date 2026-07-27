-- Account consent controls. Expand-only; no existing consent or account row is rewritten.
BEGIN;

CREATE TABLE "account_consent_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" VARCHAR(64) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "notice_version" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "decision" VARCHAR(16) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdraws_record_id" UUID,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,

    CONSTRAINT "account_consent_record_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_consent_record_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "account_consent_record_identity_key"
        UNIQUE ("id", "user_id", "purpose"),
    CONSTRAINT "account_consent_record_user_purpose_sequence_key"
        UNIQUE ("user_id", "purpose", "sequence"),
    CONSTRAINT "account_consent_record_user_idempotency_key"
        UNIQUE ("user_id", "idempotency_key_hash"),
    CONSTRAINT "account_consent_record_withdrawal_fkey"
        FOREIGN KEY ("withdraws_record_id", "user_id", "purpose")
        REFERENCES "account_consent_record" ("id", "user_id", "purpose")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "account_consent_record_purpose_check" CHECK (
        "purpose" IN (
            'optional_product_analytics',
            'ai_personalization',
            'model_improvement'
        )
    ),
    CONSTRAINT "account_consent_record_sequence_check" CHECK (
        "sequence" BETWEEN 1 AND 1000000
    ),
    CONSTRAINT "account_consent_record_notice_check" CHECK (
        ("purpose" = 'optional_product_analytics'
         AND "notice_version" = 'rituvia.analytics-notice.v1')
        OR
        ("purpose" = 'ai_personalization'
         AND "notice_version" = 'rituvia.ai-personalization-notice.v1')
        OR
        ("purpose" = 'model_improvement'
         AND "notice_version" = 'rituvia.model-improvement-notice.v1')
    ),
    CONSTRAINT "account_consent_record_locale_check" CHECK (
        "locale" = 'en'
    ),
    CONSTRAINT "account_consent_record_decision_check" CHECK (
        "decision" IN ('granted', 'denied', 'withdrawn')
    ),
    CONSTRAINT "account_consent_record_source_check" CHECK (
        "source" = 'privacy_controls'
    ),
    CONSTRAINT "account_consent_record_withdrawal_check" CHECK (
        ("decision" = 'withdrawn' AND "withdraws_record_id" IS NOT NULL)
        OR
        ("decision" <> 'withdrawn' AND "withdraws_record_id" IS NULL)
    ),
    CONSTRAINT "account_consent_record_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    )
);

CREATE INDEX "account_consent_record_current_idx"
    ON "account_consent_record" ("user_id", "purpose", "sequence" DESC);

COMMIT;
