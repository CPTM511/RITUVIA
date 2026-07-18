-- Owner-directed commercial MVP commerce ledger. One-time digital entitlements only.
BEGIN;

CREATE TABLE "commerce_order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'pending_checkout',
    "currency" CHAR(3) NOT NULL,
    "subtotal_minor" INTEGER NOT NULL,
    "tax_minor" INTEGER NOT NULL DEFAULT 0,
    "total_minor" INTEGER NOT NULL,
    "refunded_minor" INTEGER NOT NULL DEFAULT 0,
    "country_code" CHAR(2) NOT NULL,
    "country_policy_version" VARCHAR(100) NOT NULL,
    "terms_version" VARCHAR(100) NOT NULL,
    "refund_policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commerce_order_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_order_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_order_user_idempotency_key" UNIQUE (
        "user_id", "idempotency_key_hash"
    ),
    CONSTRAINT "commerce_order_status_check" CHECK (
        "status" IN (
            'pending_checkout', 'checkout_created', 'processing', 'paid',
            'payment_failed', 'canceled', 'refunded', 'disputed'
        )
    ),
    CONSTRAINT "commerce_order_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "commerce_order_country_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
    CONSTRAINT "commerce_order_amount_check" CHECK (
        "subtotal_minor" BETWEEN 0 AND 2147483647
        AND "tax_minor" BETWEEN 0 AND 2147483647
        AND "total_minor" = "subtotal_minor" + "tax_minor"
        AND "refunded_minor" BETWEEN 0 AND "total_minor"
    ),
    CONSTRAINT "commerce_order_versions_check" CHECK (
        "country_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "terms_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "refund_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "commerce_order_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "commerce_order_lifecycle_check" CHECK ("updated_at" >= "created_at")
);

CREATE INDEX "commerce_order_user_created_idx"
    ON "commerce_order" ("user_id", "created_at" DESC, "id" DESC);

CREATE TABLE "commerce_order_line" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_code" VARCHAR(100) NOT NULL,
    "product_version" VARCHAR(100) NOT NULL,
    "price_version" VARCHAR(100) NOT NULL,
    "unit_amount_minor" INTEGER NOT NULL,
    "quantity" SMALLINT NOT NULL DEFAULT 1,
    "total_minor" INTEGER NOT NULL,
    "exact_contents_snapshot" JSONB NOT NULL,
    "entitlement_code" VARCHAR(100) NOT NULL,

    CONSTRAINT "commerce_order_line_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_order_line_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commerce_order" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_order_line_product_key" UNIQUE ("order_id", "product_code"),
    CONSTRAINT "commerce_order_line_product_check" CHECK (
        "product_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "product_version" ~ '^[a-z0-9][a-z0-9._-]{0,99}$'
        AND "price_version" ~ '^[a-z0-9][a-z0-9._-]{0,99}$'
        AND "entitlement_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "commerce_order_line_amount_check" CHECK (
        "unit_amount_minor" BETWEEN 1 AND 2147483647
        AND "quantity" = 1
        AND "total_minor" = "unit_amount_minor" * "quantity"
    ),
    CONSTRAINT "commerce_order_line_snapshot_check" CHECK (
        jsonb_typeof("exact_contents_snapshot") = 'array'
        AND octet_length("exact_contents_snapshot"::text) <= 16384
    )
);

CREATE INDEX "commerce_order_line_order_idx"
    ON "commerce_order_line" ("order_id", "id");

CREATE TABLE "payment_attempt" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(24) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "attempt_number" SMALLINT NOT NULL,
    "state" VARCHAR(24) NOT NULL DEFAULT 'created',
    "provider_checkout_session_id" VARCHAR(255),
    "provider_checkout_url" TEXT,
    "provider_payment_intent_id" VARCHAR(255),
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_attempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_attempt_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commerce_order" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "payment_attempt_order_number_key" UNIQUE ("order_id", "attempt_number"),
    CONSTRAINT "payment_attempt_checkout_session_key" UNIQUE (
        "provider_checkout_session_id"
    ),
    CONSTRAINT "payment_attempt_payment_intent_key" UNIQUE (
        "provider_payment_intent_id"
    ),
    CONSTRAINT "payment_attempt_provider_check" CHECK (
        "provider" IN ('local_hosted', 'stripe')
        AND "environment" IN ('local', 'sandbox', 'live')
        AND "attempt_number" BETWEEN 1 AND 100
    ),
    CONSTRAINT "payment_attempt_state_check" CHECK (
        "state" IN (
            'created', 'checkout_created', 'processing', 'paid',
            'payment_failed', 'expired', 'refunded', 'disputed'
        )
    ),
    CONSTRAINT "payment_attempt_checkout_url_check" CHECK (
        "provider_checkout_url" IS NULL
        OR (
            octet_length("provider_checkout_url") BETWEEN 1 AND 2048
            AND "provider_checkout_url" ~ '^https?://'
            AND "provider_checkout_url" !~ '[[:cntrl:][:space:]]'
        )
    ),
    CONSTRAINT "payment_attempt_amount_check" CHECK (
        "amount_minor" BETWEEN 1 AND 2147483647
        AND "currency" ~ '^[A-Z]{3}$'
    ),
    CONSTRAINT "payment_attempt_lifecycle_check" CHECK (
        "expires_at" > "created_at" AND "updated_at" >= "created_at"
    )
);

CREATE INDEX "payment_attempt_order_state_idx"
    ON "payment_attempt" ("order_id", "state", "id");

CREATE TABLE "payment_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(24) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "object_id" VARCHAR(255) NOT NULL,
    "api_version" VARCHAR(40),
    "payload_digest" BYTEA NOT NULL,
    "provider_created_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "processing_state" VARCHAR(24) NOT NULL DEFAULT 'received',
    "order_id" UUID,
    "payment_attempt_id" UUID,

    CONSTRAINT "payment_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_event_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commerce_order" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "payment_event_attempt_fkey" FOREIGN KEY ("payment_attempt_id")
        REFERENCES "payment_attempt" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "payment_event_provider_event_key" UNIQUE (
        "provider", "provider_account_fingerprint", "provider_event_id"
    ),
    CONSTRAINT "payment_event_provider_check" CHECK (
        "provider" IN ('local_hosted', 'stripe')
        AND octet_length("provider_account_fingerprint") BETWEEN 8 AND 128
        AND "provider_account_fingerprint" !~ '[[:cntrl:][:space:]]'
    ),
    CONSTRAINT "payment_event_digest_check" CHECK (octet_length("payload_digest") = 32),
    CONSTRAINT "payment_event_state_check" CHECK (
        "processing_state" IN (
            'received', 'applied', 'ignored_out_of_order',
            'rejected_mismatch', 'not_found'
        )
    ),
    CONSTRAINT "payment_event_lifecycle_check" CHECK (
        "provider_created_at" <= "received_at" + INTERVAL '5 minutes'
        AND ("processed_at" IS NULL OR "processed_at" >= "received_at")
    )
);

CREATE INDEX "payment_event_processing_idx"
    ON "payment_event" ("processing_state", "received_at", "id");

CREATE TABLE "ledger_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID,
    "payment_event_id" UUID NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reversal_of_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ledger_entry_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commerce_order" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ledger_entry_attempt_fkey" FOREIGN KEY ("payment_attempt_id")
        REFERENCES "payment_attempt" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ledger_entry_event_fkey" FOREIGN KEY ("payment_event_id")
        REFERENCES "payment_event" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ledger_entry_reversal_fkey" FOREIGN KEY ("reversal_of_id")
        REFERENCES "ledger_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ledger_entry_event_kind_key" UNIQUE ("payment_event_id", "kind"),
    CONSTRAINT "ledger_entry_kind_check" CHECK (
        "kind" IN ('charge', 'refund', 'dispute', 'reversal')
    ),
    CONSTRAINT "ledger_entry_amount_check" CHECK (
        "amount_minor" BETWEEN 1 AND 2147483647
        AND "currency" ~ '^[A-Z]{3}$'
    ),
    CONSTRAINT "ledger_entry_reversal_check" CHECK (
        ("kind" = 'reversal' AND "reversal_of_id" IS NOT NULL)
        OR ("kind" <> 'reversal' AND "reversal_of_id" IS NULL)
    )
);

CREATE INDEX "ledger_entry_order_created_idx"
    ON "ledger_entry" ("order_id", "created_at", "id");

CREATE TABLE "entitlement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "entitlement_code" VARCHAR(100) NOT NULL,
    "source_order_line_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entitlement_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "entitlement_order_line_fkey" FOREIGN KEY ("source_order_line_id")
        REFERENCES "commerce_order_line" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "entitlement_source_code_key" UNIQUE (
        "source_order_line_id", "entitlement_code"
    ),
    CONSTRAINT "entitlement_user_code_key" UNIQUE ("user_id", "entitlement_code"),
    CONSTRAINT "entitlement_code_check" CHECK (
        "entitlement_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "entitlement_status_check" CHECK (
        "status" IN ('active', 'revoked')
    ),
    CONSTRAINT "entitlement_lifecycle_check" CHECK (
        "version" > 0
        AND (
            ("status" = 'active' AND "revoked_at" IS NULL)
            OR (
                "status" = 'revoked'
                AND "revoked_at" IS NOT NULL
                AND "revoked_at" >= "granted_at"
            )
        )
    )
);

CREATE INDEX "entitlement_user_status_idx"
    ON "entitlement" ("user_id", "status", "granted_at" DESC, "id" DESC);

COMMIT;
