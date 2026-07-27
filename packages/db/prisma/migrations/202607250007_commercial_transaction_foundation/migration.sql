-- RIT-062 additive transaction foundation. No provider event or production value activation.
BEGIN;

CREATE TABLE "commercial_order_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'created',
    "currency_code" CHAR(3) NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "country_code" CHAR(2) NOT NULL,
    "country_policy_version" VARCHAR(100) NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "price_id" VARCHAR(200) NOT NULL,
    "price_version" VARCHAR(100) NOT NULL,
    "terms_version" VARCHAR(100) NOT NULL,
    "refund_policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "refund_requested_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_order_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_order_v2_public_id_key" UNIQUE ("public_id"),
    CONSTRAINT "commercial_order_v2_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_order_v2_price_fkey"
        FOREIGN KEY ("catalog_version", "price_id", "price_version")
        REFERENCES "catalog_price" ("catalog_version", "price_id", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_order_v2_user_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "commercial_order_v2_status_check" CHECK (
        "status" IN (
            'created', 'checkout_created', 'pending', 'paid', 'failed', 'expired',
            'refund_requested', 'partially_refunded', 'refunded', 'disputed', 'cancelled'
        )
    ),
    CONSTRAINT "commercial_order_v2_amount_check" CHECK (
        "subtotal_minor" BETWEEN 1 AND 2147483647
        AND "tax_minor" BETWEEN 0 AND 2147483647
        AND "total_minor" = "subtotal_minor" + "tax_minor"
        AND "refunded_minor" BETWEEN 0 AND "total_minor"
    ),
    CONSTRAINT "commercial_order_v2_identifier_check" CHECK (
        "currency_code" ~ '^[A-Z]{3}$'
        AND "country_code" ~ '^[A-Z]{2}$'
        AND "country_policy_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "terms_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "refund_policy_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
        AND "idempotency_key_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$'
    ),
    CONSTRAINT "commercial_order_v2_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "commercial_order_v2_lifecycle_check" CHECK (
        "updated_at" >= "created_at"
        AND ("paid_at" IS NULL OR "paid_at" >= "created_at")
        AND ("refund_requested_at" IS NULL OR "refund_requested_at" >= COALESCE("paid_at", "created_at"))
        AND ("refunded_at" IS NULL OR "refunded_at" >= COALESCE("refund_requested_at", "paid_at", "created_at"))
        AND ("status" <> 'paid' OR "paid_at" IS NOT NULL)
        AND ("status" NOT IN ('refunded', 'partially_refunded') OR "refunded_minor" > 0)
        AND ("status" <> 'refunded' OR ("refunded_at" IS NOT NULL AND "refunded_minor" = "total_minor"))
        AND ("status" <> 'partially_refunded' OR "refunded_minor" < "total_minor")
    )
);

CREATE INDEX "commercial_order_v2_user_created_idx"
    ON "commercial_order_v2" ("user_id", "created_at" DESC, "id" DESC);

CREATE TABLE "commercial_order_item_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "quantity" SMALLINT NOT NULL DEFAULT 1,
    "unit_amount_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "exact_contents_snapshot" VARCHAR(500)[] NOT NULL,
    "fulfillment_kind" VARCHAR(24) NOT NULL,
    "fulfillment_code" VARCHAR(100) NOT NULL,
    "credits_granted" INTEGER,
    "credits_per_month" INTEGER,

    CONSTRAINT "commercial_order_item_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_order_item_v2_order_key" UNIQUE ("order_id"),
    CONSTRAINT "commercial_order_item_v2_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_order_item_v2_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product" ("catalog_version", "code", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_order_item_v2_amount_check" CHECK (
        "quantity" = 1
        AND "unit_amount_minor" BETWEEN 1 AND 2147483647
        AND "total_minor" = "unit_amount_minor" * "quantity"
    ),
    CONSTRAINT "commercial_order_item_v2_contents_check" CHECK (
        cardinality("exact_contents_snapshot") BETWEEN 1 AND 32
        AND array_position("exact_contents_snapshot", NULL) IS NULL
    ),
    CONSTRAINT "commercial_order_item_v2_fulfillment_check" CHECK (
        "fulfillment_code" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND (
            (
                "fulfillment_kind" = 'credit_pack'
                AND "credits_granted" > 0
                AND "credits_per_month" IS NULL
            )
            OR (
                "fulfillment_kind" = 'subscription'
                AND "credits_granted" IS NULL
                AND "credits_per_month" > 0
            )
        )
    )
);

CREATE INDEX "commercial_order_item_v2_product_idx"
    ON "commercial_order_item_v2" ("catalog_version", "product_code", "product_version");

CREATE TABLE "commercial_payment_attempt_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "attempt_number" SMALLINT NOT NULL,
    "state" VARCHAR(24) NOT NULL DEFAULT 'created',
    "provider_checkout_id" VARCHAR(255),
    "provider_checkout_url" TEXT,
    "provider_payment_intent_id" VARCHAR(255),
    "expected_network" VARCHAR(32),
    "expected_asset" VARCHAR(32),
    "amount_minor" INTEGER NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "commercial_payment_attempt_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_payment_attempt_v2_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_payment_attempt_v2_order_number_key" UNIQUE ("order_id", "attempt_number"),
    CONSTRAINT "commercial_payment_attempt_v2_idempotency_key" UNIQUE (
        "order_id", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "commercial_payment_attempt_v2_checkout_key" UNIQUE (
        "provider", "environment", "provider_checkout_id"
    ),
    CONSTRAINT "commercial_payment_attempt_v2_intent_key" UNIQUE (
        "provider", "environment", "provider_payment_intent_id"
    ),
    CONSTRAINT "commercial_payment_attempt_v2_provider_check" CHECK (
        "provider" IN ('local_test', 'stripe', 'coinbase_usdc_base')
        AND "environment" IN ('local', 'sandbox', 'live')
        AND ("provider" <> 'local_test' OR "environment" = 'local')
    ),
    CONSTRAINT "commercial_payment_attempt_v2_state_check" CHECK (
        "state" IN (
            'created', 'checkout_created', 'pending', 'succeeded', 'failed',
            'expired', 'cancelled'
        )
    ),
    CONSTRAINT "commercial_payment_attempt_v2_amount_check" CHECK (
        "attempt_number" BETWEEN 1 AND 100
        AND "amount_minor" BETWEEN 1 AND 2147483647
        AND "currency_code" ~ '^[A-Z]{3}$'
    ),
    CONSTRAINT "commercial_payment_attempt_v2_crypto_check" CHECK (
        (
            "provider" = 'coinbase_usdc_base'
            AND "expected_network" IS NOT NULL
            AND "expected_asset" IS NOT NULL
            AND "expected_network" = 'base'
            AND "expected_asset" = 'USDC'
        )
        OR (
            "provider" <> 'coinbase_usdc_base'
            AND "expected_network" IS NULL
            AND "expected_asset" IS NULL
        )
    ),
    CONSTRAINT "commercial_payment_attempt_v2_url_check" CHECK (
        "provider_checkout_url" IS NULL
        OR (
            octet_length("provider_checkout_url") BETWEEN 1 AND 2048
            AND "provider_checkout_url" ~ '^https://'
            AND "provider_checkout_url" !~ '[[:cntrl:][:space:]]'
        )
        OR (
            "provider" = 'local_test'
            AND "provider_checkout_url" ~ '^http://127[.]0[.]0[.]1(:[0-9]{1,5})?/'
            AND "provider_checkout_url" !~ '[[:cntrl:][:space:]]'
        )
    ),
    CONSTRAINT "commercial_payment_attempt_v2_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "commercial_payment_attempt_v2_lifecycle_check" CHECK (
        "expires_at" > "created_at"
        AND "updated_at" >= "created_at"
        AND ("completed_at" IS NULL OR "completed_at" >= "created_at")
    )
);

CREATE INDEX "commercial_payment_attempt_v2_order_state_idx"
    ON "commercial_payment_attempt_v2" ("order_id", "state", "id");

CREATE TABLE "credit_reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),

    CONSTRAINT "credit_reservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_reservation_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_reservation_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product" ("catalog_version", "code", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_reservation_user_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "credit_reservation_amount_check" CHECK ("amount" BETWEEN 1 AND 2147483647),
    CONSTRAINT "credit_reservation_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "credit_reservation_lifecycle_check" CHECK (
        "expires_at" > "created_at"
        AND (
            ("status" = 'active' AND "consumed_at" IS NULL AND "released_at" IS NULL AND "expired_at" IS NULL)
            OR ("status" = 'consumed' AND "consumed_at" >= "created_at" AND "released_at" IS NULL AND "expired_at" IS NULL)
            OR ("status" = 'released' AND "released_at" >= "created_at" AND "consumed_at" IS NULL AND "expired_at" IS NULL)
            OR ("status" = 'expired' AND "expired_at" >= "expires_at" AND "consumed_at" IS NULL AND "released_at" IS NULL)
        )
    )
);

CREATE INDEX "credit_reservation_user_status_idx"
    ON "credit_reservation" ("user_id", "status", "expires_at", "id");

CREATE TABLE "credit_ledger_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "credit_type" VARCHAR(24) NOT NULL,
    "direction" VARCHAR(16) NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "catalog_version" VARCHAR(100),
    "product_code" VARCHAR(100),
    "product_version" VARCHAR(100),
    "order_id" UUID,
    "subscription_period_id" VARCHAR(200),
    "reservation_id" UUID,
    "generation_id" UUID,
    "source_entry_id" UUID,
    "operation" VARCHAR(100) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "terms_version" VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_ledger_entry_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_ledger_entry_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_ledger_entry_reservation_fkey" FOREIGN KEY ("reservation_id")
        REFERENCES "credit_reservation" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_ledger_entry_source_fkey" FOREIGN KEY ("source_entry_id")
        REFERENCES "credit_ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_ledger_entry_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product" ("catalog_version", "code", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_ledger_entry_user_idempotency_key" UNIQUE (
        "user_id", "operation", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "credit_ledger_entry_type_check" CHECK (
        "credit_type" IN (
            'subscription_credit', 'promotional_credit', 'purchased_credit', 'refund_adjustment'
        )
        AND "direction" IN ('grant', 'reserve', 'release', 'consume', 'reverse', 'expire')
        AND "amount" BETWEEN 1 AND 2147483647
    ),
    CONSTRAINT "credit_ledger_entry_link_check" CHECK (
        (
            "direction" = 'grant'
            AND "reservation_id" IS NULL
            AND "source_entry_id" IS NULL
        )
        OR (
            "direction" = 'reserve'
            AND "reservation_id" IS NOT NULL
            AND "source_entry_id" IS NULL
        )
        OR (
            "direction" IN ('release', 'consume')
            AND "reservation_id" IS NOT NULL
            AND "source_entry_id" IS NULL
        )
        OR (
            "direction" IN ('reverse', 'expire')
            AND "reservation_id" IS NULL
            AND "source_entry_id" IS NOT NULL
        )
    ),
    CONSTRAINT "credit_ledger_entry_product_check" CHECK (
        (
            "catalog_version" IS NULL
            AND "product_code" IS NULL
            AND "product_version" IS NULL
        )
        OR (
            "catalog_version" IS NOT NULL
            AND "product_code" IS NOT NULL
            AND "product_version" IS NOT NULL
        )
    ),
    CONSTRAINT "credit_ledger_entry_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "credit_ledger_entry_expiry_check" CHECK (
        "expires_at" IS NULL OR "expires_at" > "created_at"
    )
);

CREATE INDEX "credit_ledger_entry_user_created_idx"
    ON "credit_ledger_entry" ("user_id", "created_at", "id");
CREATE INDEX "credit_ledger_entry_source_idx"
    ON "credit_ledger_entry" ("source_entry_id", "id");

CREATE TABLE "credit_allocation" (
    "reservation_id" UUID NOT NULL,
    "source_entry_id" UUID NOT NULL,
    "credit_type" VARCHAR(24) NOT NULL,
    "amount" INTEGER NOT NULL,
    "allocation_order" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_allocation_pkey" PRIMARY KEY ("reservation_id", "source_entry_id"),
    CONSTRAINT "credit_allocation_order_key" UNIQUE ("reservation_id", "allocation_order"),
    CONSTRAINT "credit_allocation_reservation_fkey" FOREIGN KEY ("reservation_id")
        REFERENCES "credit_reservation" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_allocation_source_fkey" FOREIGN KEY ("source_entry_id")
        REFERENCES "credit_ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_allocation_value_check" CHECK (
        "credit_type" IN ('subscription_credit', 'promotional_credit', 'purchased_credit')
        AND "amount" BETWEEN 1 AND 2147483647
        AND "allocation_order" BETWEEN 1 AND 100
    )
);

CREATE INDEX "credit_allocation_source_idx"
    ON "credit_allocation" ("source_entry_id", "reservation_id");

CREATE TABLE "credit_projection" (
    "user_id" UUID NOT NULL,
    "subscription_available" INTEGER NOT NULL DEFAULT 0,
    "promotional_available" INTEGER NOT NULL DEFAULT 0,
    "purchased_available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_projection_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "credit_projection_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_projection_value_check" CHECK (
        "subscription_available" BETWEEN 0 AND 2147483647
        AND "promotional_available" BETWEEN 0 AND 2147483647
        AND "purchased_available" BETWEEN 0 AND 2147483647
        AND "reserved" BETWEEN 0 AND 2147483647
        AND "version" >= 0
    )
);

CREATE TABLE "commercial_entitlement_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "entitlement_type" VARCHAR(24) NOT NULL,
    "catalog_version" VARCHAR(100) NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "fulfillment_code" VARCHAR(100) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "source_order_id" UUID,
    "source_ledger_entry_id" UUID,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "commercial_entitlement_v2_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_entitlement_v2_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_entitlement_v2_product_fkey"
        FOREIGN KEY ("catalog_version", "product_code", "product_version")
        REFERENCES "catalog_product" ("catalog_version", "code", "version")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_entitlement_v2_order_fkey" FOREIGN KEY ("source_order_id")
        REFERENCES "commercial_order_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_entitlement_v2_ledger_fkey" FOREIGN KEY ("source_ledger_entry_id")
        REFERENCES "credit_ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_entitlement_v2_user_code_key" UNIQUE (
        "user_id", "entitlement_type", "fulfillment_code"
    ),
    CONSTRAINT "commercial_entitlement_v2_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "commercial_entitlement_v2_type_check" CHECK (
        (
            "entitlement_type" = 'plus'
            AND "source_order_id" IS NOT NULL
            AND "source_ledger_entry_id" IS NULL
        )
        OR (
            "entitlement_type" = 'permanent_object'
            AND "source_order_id" IS NULL
            AND "source_ledger_entry_id" IS NOT NULL
        )
    ),
    CONSTRAINT "commercial_entitlement_v2_identifier_check" CHECK (
        "fulfillment_code" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "commercial_entitlement_v2_lifecycle_check" CHECK (
        "version" > 0
        AND (
            ("status" = 'active' AND "frozen_at" IS NULL AND "revoked_at" IS NULL)
            OR ("status" = 'frozen' AND "frozen_at" >= "granted_at" AND "revoked_at" IS NULL)
            OR ("status" = 'revoked' AND "revoked_at" >= "granted_at")
        )
    )
);

CREATE INDEX "commercial_entitlement_v2_user_status_idx"
    ON "commercial_entitlement_v2" ("user_id", "status", "granted_at" DESC, "id" DESC);

ALTER TABLE "commercial_order_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_order_item_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_payment_attempt_v2" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_order_v2_existing_roles"
    ON "commercial_order_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_order_v2_privacy_deletion"
    ON "commercial_order_v2" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));
CREATE POLICY "commercial_order_item_v2_existing_roles"
    ON "commercial_order_item_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_order_item_v2_privacy_deletion"
    ON "commercial_order_item_v2" TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1 FROM "commercial_order_v2"
             WHERE "commercial_order_v2"."id" = "commercial_order_item_v2"."order_id"
               AND "commercial_order_v2"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );
CREATE POLICY "commercial_payment_attempt_v2_existing_roles"
    ON "commercial_payment_attempt_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_payment_attempt_v2_privacy_deletion"
    ON "commercial_payment_attempt_v2" TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1 FROM "commercial_order_v2"
             WHERE "commercial_order_v2"."id" = "commercial_payment_attempt_v2"."order_id"
               AND "commercial_order_v2"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "credit_reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_ledger_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_allocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_projection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_entitlement_v2" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_reservation_existing_roles"
    ON "credit_reservation" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "credit_ledger_entry_existing_roles"
    ON "credit_ledger_entry" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "credit_projection_existing_roles"
    ON "credit_projection" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "credit_allocation_existing_roles"
    ON "credit_allocation" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_entitlement_v2_existing_roles"
    ON "commercial_entitlement_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

CREATE POLICY "credit_reservation_privacy_deletion"
    ON "credit_reservation" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));
CREATE POLICY "credit_ledger_entry_privacy_deletion"
    ON "credit_ledger_entry" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));
CREATE POLICY "credit_projection_privacy_deletion"
    ON "credit_projection" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));
CREATE POLICY "credit_allocation_privacy_deletion"
    ON "credit_allocation" TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1 FROM "credit_reservation"
             WHERE "credit_reservation"."id" = "credit_allocation"."reservation_id"
               AND "credit_reservation"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );
CREATE POLICY "commercial_entitlement_v2_privacy_deletion"
    ON "commercial_entitlement_v2" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));

COMMIT;
