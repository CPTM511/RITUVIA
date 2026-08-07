-- Founder Acceptance Recovery Item 10 protected-staging commerce lifecycle.
BEGIN;

DROP POLICY "country_policy_version_append" ON "country_policy_version";
CREATE POLICY "country_policy_version_append"
    ON "country_policy_version"
    FOR INSERT
    TO "rituvia_country_policy_writer"
    WITH CHECK (
        ("environment" = 'local' AND "approval_mode" = 'local_test')
        OR (
            "approval_mode" = 'written'
            AND (
                "status" <> 'paid'
                OR (
                    ("policy_document" #>> '{fiat,enabled}')::boolean = false
                    OR "policy_document" #>> '{evidence,fiatApprovalReference}' LIKE 'OWN-002:%'
                    OR (
                        "environment" = 'staging'
                        AND "policy_document" #>> '{evidence,fiatApprovalReference}'
                            LIKE 'D-098:OWN-017:stripe-test:%'
                    )
                )
                AND (
                    ("policy_document" #>> '{crypto,enabled}')::boolean = false
                    OR "policy_document" #>> '{evidence,cryptoApprovalReference}' LIKE 'OWN-006:%'
                )
            )
        )
    );

ALTER TABLE "commercial_payment_event_v2"
    ADD COLUMN "provider_subscription_id" VARCHAR(255),
    ADD COLUMN "provider_invoice_id" VARCHAR(255),
    ADD COLUMN "subscription_period_start" TIMESTAMPTZ(6),
    ADD COLUMN "subscription_period_end" TIMESTAMPTZ(6),
    ADD COLUMN "subscription_cancel_at_period_end" BOOLEAN,
    ADD COLUMN "subscription_state" VARCHAR(24);

ALTER TABLE "commercial_payment_event_v2"
    ADD CONSTRAINT "commercial_payment_event_v2_subscription_context_check" CHECK (
        (
            "provider_subscription_id" IS NULL
            AND "provider_invoice_id" IS NULL
            AND "subscription_period_start" IS NULL
            AND "subscription_period_end" IS NULL
            AND "subscription_cancel_at_period_end" IS NULL
            AND "subscription_state" IS NULL
        )
        OR (
            "provider_subscription_id" IS NOT NULL
            AND octet_length("provider_subscription_id") BETWEEN 1 AND 255
            AND "subscription_state" IN ('active', 'past_due', 'cancelled')
            AND ("provider_invoice_id" IS NULL OR octet_length("provider_invoice_id") BETWEEN 1 AND 255)
            AND (
                ("subscription_period_start" IS NULL AND "subscription_period_end" IS NULL)
                OR (
                    "subscription_period_start" IS NOT NULL
                    AND "subscription_period_end" > "subscription_period_start"
                )
            )
        )
    );

CREATE TABLE "commercial_subscription_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_order_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_subscription_id" VARCHAR(255) NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "billing_interval" VARCHAR(16) NOT NULL,
    "credits_per_month" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_subscription_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_v2_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_v2_order_fkey" FOREIGN KEY ("source_order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_v2_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product" ("catalog_version", "code", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_v2_order_key" UNIQUE ("source_order_id"),
    CONSTRAINT "commercial_subscription_v2_provider_key" UNIQUE (
        "provider", "environment", "provider_subscription_id"
    ),
    CONSTRAINT "commercial_subscription_v2_identity_check" CHECK (
        "provider" = 'stripe'
        AND "environment" = 'sandbox'
        AND octet_length("provider_subscription_id") BETWEEN 1 AND 255
        AND "billing_interval" IN ('month', 'year')
        AND "credits_per_month" BETWEEN 1 AND 2147483647
    ),
    CONSTRAINT "commercial_subscription_v2_lifecycle_check" CHECK (
        "status" IN ('active', 'past_due', 'cancelled', 'disputed')
        AND "current_period_end" > "current_period_start"
        AND "updated_at" >= "created_at"
        AND (
            ("status" IN ('active', 'past_due') AND "cancelled_at" IS NULL)
            OR ("status" IN ('cancelled', 'disputed') AND "cancelled_at" >= "created_at")
        )
    )
);

CREATE INDEX "commercial_subscription_v2_user_status_idx"
    ON "commercial_subscription_v2" ("user_id", "status", "updated_at" DESC, "id" DESC);

CREATE TABLE "commercial_subscription_period_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "source_payment_event_id" UUID,
    "provider_invoice_id" VARCHAR(255),
    "allocation_key" VARCHAR(255) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "credits_granted" INTEGER NOT NULL,
    "source_ledger_entry_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_subscription_period_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_period_v2_subscription_fkey" FOREIGN KEY ("subscription_id")
        REFERENCES "commercial_subscription_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_period_v2_event_fkey" FOREIGN KEY ("source_payment_event_id")
        REFERENCES "commercial_payment_event_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_period_v2_ledger_fkey" FOREIGN KEY ("source_ledger_entry_id")
        REFERENCES "credit_ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_period_v2_allocation_key" UNIQUE (
        "subscription_id", "allocation_key"
    ),
    CONSTRAINT "commercial_subscription_period_v2_invoice_key" UNIQUE ("provider_invoice_id"),
    CONSTRAINT "commercial_subscription_period_v2_value_check" CHECK (
        octet_length("allocation_key") BETWEEN 1 AND 255
        AND ("provider_invoice_id" IS NULL OR octet_length("provider_invoice_id") BETWEEN 1 AND 255)
        AND "period_end" > "period_start"
        AND "credits_granted" BETWEEN 1 AND 2147483647
    )
);

CREATE INDEX "commercial_subscription_period_v2_subscription_period_idx"
    ON "commercial_subscription_period_v2" ("subscription_id", "period_start", "id");

CREATE TABLE "commercial_commerce_audit_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "subscription_id" UUID,
    "payment_event_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_commerce_audit_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_commerce_audit_v2_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_commerce_audit_v2_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_commerce_audit_v2_subscription_fkey" FOREIGN KEY ("subscription_id")
        REFERENCES "commercial_subscription_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_commerce_audit_v2_event_fkey" FOREIGN KEY ("payment_event_id")
        REFERENCES "commercial_payment_event_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_commerce_audit_v2_value_check" CHECK (
        "action" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND "outcome" IN ('applied', 'duplicate', 'ignored', 'rejected')
        AND jsonb_typeof("details") = 'object'
        AND octet_length("details"::text) <= 8192
    )
);

CREATE INDEX "commercial_commerce_audit_v2_user_created_idx"
    ON "commercial_commerce_audit_v2" ("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "commercial_commerce_audit_v2_order_created_idx"
    ON "commercial_commerce_audit_v2" ("order_id", "created_at", "id");

CREATE POLICY "catalog_price_payment_webhook_read"
    ON "catalog_price"
    FOR SELECT
    TO "rituvia_payment_webhook"
    USING (true);

ALTER TABLE "commercial_subscription_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_subscription_period_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_commerce_audit_v2" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_subscription_v2_existing_roles"
    ON "commercial_subscription_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_subscription_period_v2_existing_roles"
    ON "commercial_subscription_period_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_commerce_audit_v2_existing_roles"
    ON "commercial_commerce_audit_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

COMMIT;
