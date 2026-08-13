-- RIT-074 projects current fulfilled dispute facts into privacy-minimal support work items.
BEGIN;

CREATE TABLE "commercial_dispute_support_projection_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commercial_payment_event_id" UUID NOT NULL,
    "queue_kind" VARCHAR(24) NOT NULL,
    "category_code" VARCHAR(64) NOT NULL,
    "priority" VARCHAR(16) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "draft_template_code" VARCHAR(64) NOT NULL,
    "draft_template_version" VARCHAR(100) NOT NULL,
    "draft_locale" VARCHAR(35) NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL,
    "first_response_due_at" TIMESTAMPTZ(6) NOT NULL,
    "resolution_due_at" TIMESTAMPTZ(6) NOT NULL,
    "projected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_dispute_support_projection_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_dispute_support_projection_v1_event_key"
        UNIQUE ("commercial_payment_event_id"),
    CONSTRAINT "commercial_dispute_support_projection_v1_event_fkey"
        FOREIGN KEY ("commercial_payment_event_id")
        REFERENCES "commercial_payment_event_v2" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_dispute_support_projection_v1_value_check" CHECK (
        "queue_kind" = 'support'
        AND "category_code" = 'payment_dispute'
        AND "priority" = 'high'
        AND "policy_version" = 'protected-beta-operations.local.en.v1'
        AND "draft_template_code" = 'support_dispute_ack'
        AND "draft_template_version" = 'operational-case-draft.en.v1'
        AND "draft_locale" = 'en'
        AND "first_response_due_at" = "opened_at" + INTERVAL '4 hours'
        AND "resolution_due_at" = "opened_at" + INTERVAL '24 hours'
    )
);

CREATE INDEX "commercial_dispute_support_projection_v1_due_idx"
    ON "commercial_dispute_support_projection_v1"
    ("priority", "first_response_due_at", "opened_at", "id");

ALTER TABLE "commercial_dispute_support_projection_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_dispute_support_projection_v1" FORCE ROW LEVEL SECURITY;

CREATE POLICY "commercial_dispute_support_projection_v1_read"
    ON "commercial_dispute_support_projection_v1"
    FOR SELECT TO "rituvia_payment_fulfillment"
    USING (true);

CREATE POLICY "commercial_dispute_support_projection_v1_insert"
    ON "commercial_dispute_support_projection_v1"
    FOR INSERT TO "rituvia_payment_fulfillment"
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "commercial_payment_event_v2" AS event
            JOIN "commercial_payment_outbox_v2" AS outbox
              ON outbox.payment_event_id = event.id
            JOIN "commercial_order_v2" AS orders
              ON orders.id = outbox.order_id
            JOIN "commercial_fulfillment_v2" AS fulfillment
              ON fulfillment.order_id = orders.id
            WHERE event.id =
                    "commercial_dispute_support_projection_v1"."commercial_payment_event_id"
              AND event.order_id = orders.id
              AND event.payment_attempt_id = outbox.payment_attempt_id
              AND event.event_type = 'payment_disputed'
              AND event.evidence_source = 'signed_webhook'
              AND event.validation_state = 'matched'
              AND event.processing_state = 'processed'
              AND event.processing_disposition = 'applied'
              AND outbox.topic = 'commercial.payment_state_changed'
              AND outbox.schema_version = 'commercial-payment-state-outbox.v1'
              AND outbox.order_status = 'disputed'
              AND outbox.delivery_state = 'completed'
              AND orders.status = 'disputed'
              AND orders.payment_state_version = outbox.payment_state_version
              AND fulfillment.fulfillment_kind = 'credit_pack'
              AND fulfillment.status IN ('disputed', 'review_required')
              AND fulfillment.applied_payment_state_version = outbox.payment_state_version
              AND "commercial_dispute_support_projection_v1"."queue_kind" = 'support'
              AND "commercial_dispute_support_projection_v1"."category_code" =
                  'payment_dispute'
              AND "commercial_dispute_support_projection_v1"."priority" = 'high'
              AND "commercial_dispute_support_projection_v1"."policy_version" =
                  'protected-beta-operations.local.en.v1'
              AND "commercial_dispute_support_projection_v1"."draft_template_code" =
                  'support_dispute_ack'
              AND "commercial_dispute_support_projection_v1"."draft_template_version" =
                  'operational-case-draft.en.v1'
              AND "commercial_dispute_support_projection_v1"."draft_locale" = 'en'
              AND "commercial_dispute_support_projection_v1"."opened_at" =
                  date_trunc('milliseconds', fulfillment.updated_at)
              AND "commercial_dispute_support_projection_v1"."first_response_due_at" =
                  date_trunc('milliseconds', fulfillment.updated_at) + INTERVAL '4 hours'
              AND "commercial_dispute_support_projection_v1"."resolution_due_at" =
                  date_trunc('milliseconds', fulfillment.updated_at) + INTERVAL '24 hours'
        )
    );

COMMIT;
