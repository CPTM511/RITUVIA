-- Additive commercial fulfillment evidence and purchased-Credit restriction accounting.
BEGIN;

ALTER TABLE "credit_projection"
    ADD COLUMN "purchased_held" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "credit_projection"
    ADD CONSTRAINT "credit_projection_held_value_check"
        CHECK ("purchased_held" BETWEEN 0 AND 2147483647);

ALTER TABLE "commercial_order_v2"
    ADD CONSTRAINT "commercial_order_v2_id_user_key" UNIQUE ("id", "user_id");
ALTER TABLE "credit_ledger_entry"
    ADD CONSTRAINT "credit_ledger_entry_id_user_key" UNIQUE ("id", "user_id");
ALTER TABLE "credit_ledger_entry"
    ADD CONSTRAINT "credit_ledger_entry_order_user_fkey"
        FOREIGN KEY ("order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "commercial_entitlement_v2"
    ADD CONSTRAINT "commercial_entitlement_v2_order_user_fkey"
        FOREIGN KEY ("source_order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "commercial_entitlement_v2_ledger_user_fkey"
        FOREIGN KEY ("source_ledger_entry_id", "user_id")
        REFERENCES "credit_ledger_entry" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "credit_restriction_entry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_entry_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "outbox_id" UUID NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "source_restriction_id" UUID,
    "operation" VARCHAR(100) NOT NULL,
    "idempotency_key_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credit_restriction_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_restriction_entry_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_restriction_entry_source_user_fkey"
        FOREIGN KEY ("source_entry_id", "user_id")
        REFERENCES "credit_ledger_entry" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_restriction_entry_order_user_fkey"
        FOREIGN KEY ("order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_restriction_entry_outbox_fkey" FOREIGN KEY ("outbox_id")
        REFERENCES "commercial_payment_outbox_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_restriction_entry_parent_fkey" FOREIGN KEY ("source_restriction_id")
        REFERENCES "credit_restriction_entry" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "credit_restriction_entry_user_idempotency_key" UNIQUE (
        "user_id", "operation", "idempotency_key_version", "idempotency_key_hash"
    ),
    CONSTRAINT "credit_restriction_entry_value_check" CHECK (
        "kind" IN ('hold', 'convert_to_reverse')
        AND "reason" IN ('payment_dispute', 'payment_refund')
        AND "amount" BETWEEN 1 AND 2147483647
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND (
            ("kind" = 'hold' AND "reason" = 'payment_dispute' AND "source_restriction_id" IS NULL)
            OR (
                "kind" = 'convert_to_reverse'
                AND "reason" = 'payment_refund'
                AND "source_restriction_id" IS NOT NULL
            )
        )
    )
);

CREATE INDEX "credit_restriction_entry_source_idx"
    ON "credit_restriction_entry" ("source_entry_id", "created_at", "id");

CREATE TABLE "commercial_fulfillment_v2" (
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fulfillment_kind" VARCHAR(24) NOT NULL,
    "fulfillment_code" VARCHAR(100) NOT NULL,
    "source_grant_entry_id" UUID NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "granted_amount" INTEGER NOT NULL,
    "held_amount" INTEGER NOT NULL,
    "reversed_amount" INTEGER NOT NULL,
    "shortfall_amount" INTEGER NOT NULL,
    "applied_payment_state_version" INTEGER NOT NULL,
    "last_outbox_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "granted_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_fulfillment_v2_pkey" PRIMARY KEY ("order_id"),
    CONSTRAINT "commercial_fulfillment_v2_order_user_fkey"
        FOREIGN KEY ("order_id", "user_id")
        REFERENCES "commercial_order_v2" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_fulfillment_v2_grant_user_fkey"
        FOREIGN KEY ("source_grant_entry_id", "user_id")
        REFERENCES "credit_ledger_entry" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_fulfillment_v2_last_outbox_fkey" FOREIGN KEY ("last_outbox_id")
        REFERENCES "commercial_payment_outbox_v2" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_fulfillment_v2_last_outbox_key" UNIQUE ("last_outbox_id"),
    CONSTRAINT "commercial_fulfillment_v2_value_check" CHECK (
        "fulfillment_kind" = 'credit_pack'
        AND "fulfillment_code" ~ '^[a-z][a-z0-9]*(\.[a-z0-9]+|_[a-z0-9]+|-[a-z0-9]+)*$'
        AND "status" IN ('active', 'disputed', 'refunded', 'review_required')
        AND "granted_amount" BETWEEN 1 AND 2147483647
        AND "held_amount" BETWEEN 0 AND "granted_amount"
        AND "reversed_amount" BETWEEN 0 AND "granted_amount"
        AND "shortfall_amount" BETWEEN 0 AND "granted_amount"
        AND "held_amount" + "reversed_amount" + "shortfall_amount" <= "granted_amount"
        AND "applied_payment_state_version" BETWEEN 1 AND 2147483647
        AND "version" > 0
        AND "updated_at" >= "granted_at"
    )
);

CREATE INDEX "commercial_fulfillment_v2_user_status_idx"
    ON "commercial_fulfillment_v2" ("user_id", "status", "updated_at" DESC, "order_id");

ALTER TABLE "credit_restriction_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_fulfillment_v2" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_restriction_entry_runtime"
    ON "credit_restriction_entry" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "credit_restriction_entry_privacy_deletion"
    ON "credit_restriction_entry" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));
CREATE POLICY "commercial_fulfillment_v2_runtime"
    ON "commercial_fulfillment_v2" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_fulfillment_v2_privacy_deletion"
    ON "commercial_fulfillment_v2" TO "rituvia_privacy_deletion"
    USING ("user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user"));

COMMIT;
