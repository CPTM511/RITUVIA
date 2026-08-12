-- RIT-064 signed commercial payment event inbox and transactional outbox.
BEGIN;

ALTER TABLE "commercial_payment_attempt_v2"
    ADD COLUMN "provider_account_fingerprint" VARCHAR(128);
ALTER TABLE "commercial_order_v2"
    ADD COLUMN "payment_state_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "commercial_payment_attempt_v2"
    ADD CONSTRAINT "commercial_payment_attempt_v2_account_fingerprint_check" CHECK (
        "provider_account_fingerprint" IS NULL
        OR "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    );
ALTER TABLE "commercial_order_v2"
    ADD CONSTRAINT "commercial_order_v2_id_public_id_key" UNIQUE ("id", "public_id");
ALTER TABLE "commercial_order_v2"
    ADD CONSTRAINT "commercial_order_v2_payment_state_version_check" CHECK (
        "payment_state_version" BETWEEN 0 AND 2147483647
    );
ALTER TABLE "commercial_payment_attempt_v2"
    ADD CONSTRAINT "commercial_payment_attempt_v2_id_order_key" UNIQUE ("id", "order_id");

CREATE TABLE "commercial_payment_event_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "normalization_version" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "provider_object_id" VARCHAR(255) NOT NULL,
    "payload_digest" BYTEA NOT NULL,
    "signature_timestamp_seconds" BIGINT NOT NULL,
    "verifier_version" VARCHAR(100) NOT NULL,
    "provider_occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_order_public_id" UUID NOT NULL,
    "order_id" UUID,
    "payment_attempt_id" UUID,
    "provider_checkout_id" VARCHAR(255),
    "provider_payment_intent_id" VARCHAR(255),
    "amount_minor" INTEGER NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "validation_state" VARCHAR(24) NOT NULL DEFAULT 'received',
    "processing_state" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "processing_disposition" VARCHAR(32),
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_payment_event_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_payment_event_v2_order_fkey" FOREIGN KEY (
        "order_id", "claimed_order_public_id"
    ) REFERENCES "commercial_order_v2" ("id", "public_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_payment_event_v2_attempt_fkey" FOREIGN KEY (
        "payment_attempt_id", "order_id"
    ) REFERENCES "commercial_payment_attempt_v2" ("id", "order_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_payment_event_v2_provider_event_key" UNIQUE (
        "provider", "environment", "provider_account_fingerprint", "provider_event_id"
    ),
    CONSTRAINT "commercial_payment_event_v2_outbox_identity_key" UNIQUE (
        "id", "order_id", "payment_attempt_id"
    ),
    CONSTRAINT "commercial_payment_event_v2_identifier_check" CHECK (
        "provider" IN ('stripe', 'coinbase_usdc_base')
        AND "environment" IN ('sandbox', 'live')
        AND "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        AND "normalization_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "verifier_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "signature_timestamp_seconds" BETWEEN 1 AND 999999999999
        AND octet_length("provider_event_id") BETWEEN 1 AND 255
        AND octet_length("provider_object_id") BETWEEN 1 AND 255
        AND (
            "provider_checkout_id" IS NULL
            OR octet_length("provider_checkout_id") BETWEEN 1 AND 255
        )
        AND (
            "provider_payment_intent_id" IS NULL
            OR octet_length("provider_payment_intent_id") BETWEEN 1 AND 255
        )
    ),
    CONSTRAINT "commercial_payment_event_v2_event_check" CHECK (
        "event_type" IN (
            'payment_pending', 'payment_succeeded', 'payment_failed', 'payment_expired',
            'payment_refunded', 'payment_disputed'
        )
        AND "amount_minor" BETWEEN 1 AND 2147483647
        AND "currency_code" ~ '^[A-Z]{3}$'
        AND octet_length("payload_digest") = 32
    ),
    CONSTRAINT "commercial_payment_event_v2_processing_check" CHECK (
        "validation_state" IN ('received', 'matched', 'rejected_mismatch')
        AND "processing_state" IN ('pending', 'processed')
        AND (
            (
                "validation_state" = 'received'
                AND "processing_state" = 'pending'
                AND "order_id" IS NULL
                AND "payment_attempt_id" IS NULL
                AND "processing_disposition" IS NULL
                AND "processed_at" IS NULL
            )
            OR (
                "validation_state" = 'matched'
                AND "processing_state" = 'processed'
                AND "order_id" IS NOT NULL
                AND "payment_attempt_id" IS NOT NULL
                AND "processing_disposition" IN ('applied', 'ignored_out_of_order')
                AND "processed_at" IS NOT NULL
            )
            OR (
                "validation_state" = 'rejected_mismatch'
                AND "processing_state" = 'processed'
                AND "processing_disposition" = 'rejected_mismatch'
                AND "processed_at" IS NOT NULL
            )
        )
    )
);

CREATE INDEX "commercial_payment_event_v2_order_timeline_idx"
    ON "commercial_payment_event_v2" (
        "order_id", "provider_occurred_at", "event_type", "provider_event_id"
    )
    WHERE "validation_state" = 'matched';
CREATE INDEX "commercial_payment_event_v2_processing_idx"
    ON "commercial_payment_event_v2" ("processing_state", "received_at", "id");

CREATE TABLE "commercial_payment_outbox_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_event_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "order_status" VARCHAR(24) NOT NULL,
    "payment_attempt_state" VARCHAR(24) NOT NULL,
    "payment_state_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_state" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "lease_token_hash" BYTEA,
    "leased_until" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "last_failure_code" VARCHAR(100),
    "dead_lettered_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_payment_outbox_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_payment_outbox_v2_event_key" UNIQUE ("payment_event_id"),
    CONSTRAINT "commercial_payment_outbox_v2_event_fkey" FOREIGN KEY (
        "payment_event_id", "order_id", "payment_attempt_id"
    ) REFERENCES "commercial_payment_event_v2" ("id", "order_id", "payment_attempt_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_payment_outbox_v2_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_payment_outbox_v2_attempt_fkey" FOREIGN KEY (
        "payment_attempt_id", "order_id"
    ) REFERENCES "commercial_payment_attempt_v2" ("id", "order_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_payment_outbox_v2_topic_check" CHECK (
        "topic" = 'commercial.payment_state_changed'
        AND "schema_version" = 'commercial-payment-state-outbox.v1'
    ),
    CONSTRAINT "commercial_payment_outbox_v2_state_check" CHECK (
        "order_status" IN (
            'created', 'checkout_created', 'pending', 'paid', 'failed', 'expired',
            'refund_requested', 'partially_refunded', 'refunded', 'disputed', 'cancelled'
        )
        AND "payment_attempt_state" IN (
            'created', 'checkout_created', 'pending', 'succeeded', 'failed',
            'expired', 'cancelled'
        )
        AND "payment_state_version" BETWEEN 1 AND 2147483647
        AND "delivery_state" IN ('pending', 'leased', 'completed', 'dead_lettered')
        AND "attempt_count" BETWEEN 0 AND 20
        AND ("lease_token_hash" IS NULL OR octet_length("lease_token_hash") = 32)
        AND (
            (
                "delivery_state" = 'pending'
                AND "lease_token_hash" IS NULL
                AND "leased_until" IS NULL
                AND "completed_at" IS NULL
                AND "dead_lettered_at" IS NULL
            )
            OR (
                "delivery_state" = 'leased'
                AND "lease_token_hash" IS NOT NULL
                AND "leased_until" > "created_at"
                AND "completed_at" IS NULL
                AND "dead_lettered_at" IS NULL
            )
            OR (
                "delivery_state" = 'completed'
                AND "lease_token_hash" IS NULL
                AND "leased_until" IS NULL
                AND "completed_at" >= "created_at"
                AND "dead_lettered_at" IS NULL
            )
            OR (
                "delivery_state" = 'dead_lettered'
                AND "lease_token_hash" IS NULL
                AND "leased_until" IS NULL
                AND "completed_at" IS NULL
                AND "dead_lettered_at" >= "created_at"
            )
        )
    )
);

CREATE INDEX "commercial_payment_outbox_v2_delivery_idx"
    ON "commercial_payment_outbox_v2" ("delivery_state", "available_at", "created_at", "id");

ALTER TABLE "commercial_payment_event_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_payment_outbox_v2" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_payment_event_v2_runtime"
    ON "commercial_payment_event_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_payment_outbox_v2_runtime"
    ON "commercial_payment_outbox_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

COMMIT;
