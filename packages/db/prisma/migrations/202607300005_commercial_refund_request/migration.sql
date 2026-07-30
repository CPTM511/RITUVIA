-- Additive Stripe sandbox refund requests and request-time purchased-Credit holds.
BEGIN;

CREATE TABLE "commercial_refund_request_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "provider_refund_id" VARCHAR(255),
    "status" VARCHAR(24) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "refund_policy_version" VARCHAR(100) NOT NULL,
    "eligibility_policy_version" VARCHAR(100) NOT NULL,
    "reason_code" VARCHAR(100) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "provider_idempotency_key_hash" BYTEA NOT NULL,
    "provider_rejection_code" VARCHAR(100),
    "confirmed_payment_event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "submitted_at" TIMESTAMPTZ(6),
    "confirmed_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_refund_request_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_refund_request_v1_public_id_key" UNIQUE ("public_id"),
    CONSTRAINT "commercial_refund_request_v1_order_key" UNIQUE ("order_id"),
    CONSTRAINT "commercial_refund_request_v1_id_user_order_key" UNIQUE (
        "id", "user_id", "order_id"
    ),
    CONSTRAINT "commercial_refund_request_v1_user_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "commercial_refund_request_v1_provider_refund_key" UNIQUE (
        "provider", "environment", "provider_account_fingerprint", "provider_refund_id"
    ),
    CONSTRAINT "commercial_refund_request_v1_confirmed_event_key"
        UNIQUE ("confirmed_payment_event_id"),
    CONSTRAINT "commercial_refund_request_v1_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_request_v1_order_user_fkey"
        FOREIGN KEY ("order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_request_v1_attempt_order_fkey"
        FOREIGN KEY ("payment_attempt_id", "order_id")
        REFERENCES "commercial_payment_attempt_v2" ("id", "order_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_request_v1_confirmed_event_fkey"
        FOREIGN KEY ("confirmed_payment_event_id", "order_id", "payment_attempt_id")
        REFERENCES "commercial_payment_event_v2" ("id", "order_id", "payment_attempt_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_request_v1_value_check" CHECK (
        "provider" = 'stripe'
        AND "environment" = 'sandbox'
        AND "status" IN ('prepared', 'submitted', 'confirmed', 'rejected')
        AND "amount_minor" BETWEEN 1 AND 2147483647
        AND "currency_code" ~ '^[A-Z]{3}$'
        AND "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        AND "refund_policy_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "eligibility_policy_version" = 'sandbox-unused-credit-refund.v1'
        AND "reason_code" = 'unused_credit_pack'
        AND "idempotency_key_version" = 'commercial-refund-request.v1'
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND octet_length("provider_idempotency_key_hash") = 32
        AND "updated_at" >= "created_at"
        AND (
            (
                "status" = 'prepared'
                AND "provider_refund_id" IS NULL
                AND "provider_rejection_code" IS NULL
                AND "confirmed_payment_event_id" IS NULL
                AND "submitted_at" IS NULL
                AND "confirmed_at" IS NULL
                AND "rejected_at" IS NULL
            )
            OR (
                "status" = 'submitted'
                AND "provider_refund_id" ~ '^re_[A-Za-z0-9_]{8,252}$'
                AND "provider_rejection_code" IS NULL
                AND "confirmed_payment_event_id" IS NULL
                AND "submitted_at" IS NOT NULL
                AND "submitted_at" >= "created_at"
                AND "confirmed_at" IS NULL
                AND "rejected_at" IS NULL
            )
            OR (
                "status" = 'confirmed'
                AND "provider_rejection_code" IS NULL
                AND "confirmed_payment_event_id" IS NOT NULL
                AND "confirmed_at" IS NOT NULL
                AND "confirmed_at" >= "created_at"
                AND "rejected_at" IS NULL
                AND (
                    (
                        "provider_refund_id" IS NULL
                        AND "submitted_at" IS NULL
                    )
                    OR (
                        "provider_refund_id" ~ '^re_[A-Za-z0-9_]{8,252}$'
                        AND "submitted_at" IS NOT NULL
                        AND "submitted_at" >= "created_at"
                    )
                )
            )
            OR (
                "status" = 'rejected'
                AND "provider_refund_id" IS NULL
                AND "provider_rejection_code" = 'provider_rejected'
                AND "confirmed_payment_event_id" IS NULL
                AND "submitted_at" IS NULL
                AND "confirmed_at" IS NULL
                AND "rejected_at" IS NOT NULL
                AND "rejected_at" >= "created_at"
            )
        )
    )
);

CREATE TABLE "commercial_refund_credit_hold_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "refund_request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "source_entry_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "released_at" TIMESTAMPTZ(6),
    "converted_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_refund_credit_hold_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_refund_credit_hold_v1_request_key" UNIQUE ("refund_request_id"),
    CONSTRAINT "commercial_refund_credit_hold_v1_user_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "commercial_refund_credit_hold_v1_request_fkey"
        FOREIGN KEY ("refund_request_id", "user_id", "order_id")
        REFERENCES "commercial_refund_request_v1" ("id", "user_id", "order_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_credit_hold_v1_order_user_fkey"
        FOREIGN KEY ("order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_credit_hold_v1_source_user_fkey"
        FOREIGN KEY ("source_entry_id", "user_id")
        REFERENCES "credit_ledger_entry" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_refund_credit_hold_v1_value_check" CHECK (
        "amount" BETWEEN 1 AND 2147483647
        AND "status" IN ('active', 'released', 'converted')
        AND "idempotency_key_version" = 'commercial-refund-request.v1'
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND "updated_at" >= "created_at"
        AND (
            (
                "status" = 'active'
                AND "released_at" IS NULL
                AND "converted_at" IS NULL
            )
            OR (
                "status" = 'released'
                AND "released_at" IS NOT NULL
                AND "released_at" >= "created_at"
                AND "converted_at" IS NULL
            )
            OR (
                "status" = 'converted'
                AND "released_at" IS NULL
                AND "converted_at" IS NOT NULL
                AND "converted_at" >= "created_at"
            )
        )
    )
);

CREATE INDEX "commercial_refund_request_v1_user_created_idx"
    ON "commercial_refund_request_v1" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "commercial_refund_request_v1_status_created_idx"
    ON "commercial_refund_request_v1" ("status", "created_at", "id");
CREATE INDEX "commercial_refund_credit_hold_v1_source_status_idx"
    ON "commercial_refund_credit_hold_v1" ("source_entry_id", "status", "created_at", "id");

ALTER TABLE "commercial_refund_request_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_refund_credit_hold_v1" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_refund_request_v1_runtime"
    ON "commercial_refund_request_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_refund_request_v1_privacy_deletion"
    ON "commercial_refund_request_v1" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));
CREATE POLICY "commercial_refund_credit_hold_v1_runtime"
    ON "commercial_refund_credit_hold_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_refund_credit_hold_v1_privacy_deletion"
    ON "commercial_refund_credit_hold_v1" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));

COMMIT;
