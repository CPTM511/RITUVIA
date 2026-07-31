-- RIT-070 additive Stripe Test subscription lifecycle foundation.
BEGIN;

CREATE TABLE "commercial_subscription_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_order_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "provider_checkout_id" VARCHAR(255) NOT NULL,
    "provider_subscription_id" VARCHAR(255),
    "catalog_version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "price_id" VARCHAR(200) NOT NULL,
    "price_version" VARCHAR(100) NOT NULL,
    "fulfillment_code" VARCHAR(100) NOT NULL,
    "subscription_interval" VARCHAR(16) NOT NULL,
    "credits_per_month" INTEGER NOT NULL,
    "state" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
    "current_period_starts_at" TIMESTAMPTZ(6),
    "current_period_ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "commercial_subscription_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_v1_source_order_key" UNIQUE ("source_order_id"),
    CONSTRAINT "commercial_subscription_v1_checkout_key" UNIQUE ("provider_checkout_id"),
    CONSTRAINT "commercial_subscription_v1_provider_subscription_key" UNIQUE (
        "provider", "environment", "provider_account_fingerprint", "provider_subscription_id"
    ),
    CONSTRAINT "commercial_subscription_v1_order_user_fkey" FOREIGN KEY ("source_order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_v1_product_fkey" FOREIGN KEY (
        "catalog_version", "product_code", "product_version"
    ) REFERENCES "catalog_product" ("catalog_version", "code", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_v1_price_fkey" FOREIGN KEY (
        "catalog_version", "price_id", "price_version"
    ) REFERENCES "catalog_price" ("catalog_version", "price_id", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_v1_value_check" CHECK (
        "provider" = 'stripe'
        AND "environment" = 'sandbox'
        AND "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        AND "provider_checkout_id" ~ '^cs_test_[A-Za-z0-9_]{8,247}$'
        AND (
            "provider_subscription_id" IS NULL
            OR "provider_subscription_id" ~ '^sub_[A-Za-z0-9_]{8,251}$'
        )
        AND "fulfillment_code" ~ '^subscription[.][a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND "subscription_interval" IN ('month', 'year')
        AND "credits_per_month" = 8
        AND "state" IN (
            'pending', 'active', 'grace_period', 'past_due',
            'cancel_at_period_end', 'cancelled', 'refunded', 'disputed'
        )
        AND "version" > 0
        AND "updated_at" >= "created_at"
        AND (
            ("current_period_starts_at" IS NULL AND "current_period_ends_at" IS NULL)
            OR (
                "current_period_starts_at" IS NOT NULL
                AND "current_period_ends_at" > "current_period_starts_at"
            )
        )
        AND (
            "state" = 'pending'
            OR "provider_subscription_id" IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX "commercial_subscription_v1_user_open_key"
    ON "commercial_subscription_v1" ("user_id")
    WHERE "state" IN ('pending', 'active', 'grace_period', 'past_due', 'cancel_at_period_end');
CREATE INDEX "commercial_subscription_v1_user_state_idx"
    ON "commercial_subscription_v1" ("user_id", "state", "updated_at" DESC, "id");

CREATE TABLE "commercial_subscription_period_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "provider_invoice_id" VARCHAR(255) NOT NULL,
    "period_starts_at" TIMESTAMPTZ(6) NOT NULL,
    "period_ends_at" TIMESTAMPTZ(6) NOT NULL,
    "state" VARCHAR(24) NOT NULL DEFAULT 'paid',
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_subscription_period_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_period_v1_subscription_invoice_key" UNIQUE (
        "subscription_id", "provider_invoice_id"
    ),
    CONSTRAINT "commercial_subscription_period_v1_provider_invoice_key" UNIQUE (
        "provider", "environment", "provider_account_fingerprint", "provider_invoice_id"
    ),
    CONSTRAINT "commercial_subscription_period_v1_subscription_fkey" FOREIGN KEY ("subscription_id")
        REFERENCES "commercial_subscription_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_period_v1_value_check" CHECK (
        "provider" = 'stripe'
        AND "environment" = 'sandbox'
        AND "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        AND "provider_invoice_id" ~ '^in_[A-Za-z0-9_]{8,252}$'
        AND "period_ends_at" > "period_starts_at"
        AND "state" = 'paid'
    )
);
CREATE INDEX "commercial_subscription_period_v1_subscription_period_idx"
    ON "commercial_subscription_period_v1" ("subscription_id", "period_starts_at", "id");

CREATE TABLE "commercial_subscription_event_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(40) NOT NULL,
    "provider_checkout_id" VARCHAR(255) NOT NULL,
    "provider_subscription_id" VARCHAR(255) NOT NULL,
    "provider_invoice_id" VARCHAR(255),
    "period_starts_at" TIMESTAMPTZ(6),
    "period_ends_at" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
    "payload_digest" BYTEA NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "processing_state" VARCHAR(24) NOT NULL DEFAULT 'received',
    "processing_disposition" VARCHAR(32),
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_subscription_event_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_event_v1_provider_event_key" UNIQUE (
        "provider", "environment", "provider_account_fingerprint", "provider_event_id"
    ),
    CONSTRAINT "commercial_subscription_event_v1_value_check" CHECK (
        "provider" = 'stripe'
        AND "environment" = 'sandbox'
        AND "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        AND "provider_checkout_id" ~ '^cs_test_[A-Za-z0-9_]{8,247}$'
        AND "provider_subscription_id" ~ '^sub_[A-Za-z0-9_]{8,251}$'
        AND (
            "provider_invoice_id" IS NULL
            OR "provider_invoice_id" ~ '^in_[A-Za-z0-9_]{8,252}$'
        )
        AND "event_type" IN (
            'subscription_created', 'subscription_period_paid', 'subscription_payment_failed',
            'subscription_grace_expired', 'subscription_changed',
            'subscription_cancel_scheduled', 'subscription_cancelled',
            'subscription_refunded', 'subscription_disputed'
        )
        AND octet_length("payload_digest") = 32
        AND "received_at" >= "occurred_at"
        AND (
            ("period_starts_at" IS NULL AND "period_ends_at" IS NULL)
            OR ("period_starts_at" IS NOT NULL AND "period_ends_at" > "period_starts_at")
        )
        AND (
            ("event_type" = 'subscription_period_paid' AND "provider_invoice_id" IS NOT NULL)
            OR "event_type" <> 'subscription_period_paid'
        )
        AND "processing_state" IN ('received', 'processed')
        AND (
            ("processing_state" = 'received' AND "processing_disposition" IS NULL AND "processed_at" IS NULL)
            OR (
                "processing_state" = 'processed'
                AND "processing_disposition" IN ('applied', 'ignored_out_of_order')
                AND "processed_at" IS NOT NULL
            )
        )
    )
);
CREATE INDEX "commercial_subscription_event_v1_processing_idx"
    ON "commercial_subscription_event_v1" ("processing_state", "received_at", "id");

CREATE TABLE "commercial_subscription_allocation_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_period_id" UUID NOT NULL,
    "allocation_index" SMALLINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "state" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "source_ledger_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "granted_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_subscription_allocation_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_allocation_v1_period_index_key" UNIQUE (
        "subscription_period_id", "allocation_index"
    ),
    CONSTRAINT "commercial_subscription_allocation_v1_ledger_key" UNIQUE ("source_ledger_entry_id"),
    CONSTRAINT "commercial_subscription_allocation_v1_period_fkey" FOREIGN KEY ("subscription_period_id")
        REFERENCES "commercial_subscription_period_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_allocation_v1_ledger_fkey" FOREIGN KEY ("source_ledger_entry_id")
        REFERENCES "credit_ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_allocation_v1_value_check" CHECK (
        "allocation_index" BETWEEN 0 AND 11
        AND "amount" = 8
        AND "expires_at" > "available_at"
        AND "state" IN ('pending', 'granted', 'cancelled')
        AND (
            ("state" = 'pending' AND "source_ledger_entry_id" IS NULL AND "granted_at" IS NULL)
            OR ("state" = 'granted' AND "source_ledger_entry_id" IS NOT NULL AND "granted_at" IS NOT NULL)
            OR ("state" = 'cancelled' AND "source_ledger_entry_id" IS NULL AND "granted_at" IS NULL)
        )
    )
);
CREATE INDEX "commercial_subscription_allocation_v1_due_idx"
    ON "commercial_subscription_allocation_v1" ("state", "available_at", "id");

CREATE TABLE "commercial_subscription_outbox_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "allocation_id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "delivery_state" VARCHAR(24) NOT NULL DEFAULT 'pending',
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "lease_token_hash" BYTEA,
    "leased_until" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_subscription_outbox_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_outbox_v1_allocation_key" UNIQUE ("allocation_id"),
    CONSTRAINT "commercial_subscription_outbox_v1_allocation_fkey" FOREIGN KEY ("allocation_id")
        REFERENCES "commercial_subscription_allocation_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_outbox_v1_event_fkey" FOREIGN KEY ("source_event_id")
        REFERENCES "commercial_subscription_event_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_outbox_v1_value_check" CHECK (
        "attempt_count" BETWEEN 0 AND 20
        AND "delivery_state" IN ('pending', 'leased', 'completed', 'dead_lettered')
        AND ("lease_token_hash" IS NULL OR octet_length("lease_token_hash") = 32)
        AND (
            ("delivery_state" = 'pending' AND "lease_token_hash" IS NULL AND "leased_until" IS NULL AND "completed_at" IS NULL)
            OR ("delivery_state" = 'leased' AND "lease_token_hash" IS NOT NULL AND "leased_until" > "created_at" AND "completed_at" IS NULL)
            OR ("delivery_state" = 'completed' AND "lease_token_hash" IS NULL AND "leased_until" IS NULL AND "completed_at" >= "created_at")
            OR ("delivery_state" = 'dead_lettered' AND "lease_token_hash" IS NULL AND "leased_until" IS NULL AND "completed_at" IS NULL)
        )
    )
);
CREATE INDEX "commercial_subscription_outbox_v1_delivery_idx"
    ON "commercial_subscription_outbox_v1" ("delivery_state", "available_at", "created_at", "id");

ALTER TABLE "commercial_subscription_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_subscription_period_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_subscription_event_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_subscription_allocation_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_subscription_outbox_v1" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_subscription_v1_runtime" ON "commercial_subscription_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion') WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_subscription_period_v1_runtime" ON "commercial_subscription_period_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion') WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_subscription_event_v1_runtime" ON "commercial_subscription_event_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion') WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_subscription_allocation_v1_runtime" ON "commercial_subscription_allocation_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion') WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_subscription_outbox_v1_runtime" ON "commercial_subscription_outbox_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion') WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

COMMIT;
