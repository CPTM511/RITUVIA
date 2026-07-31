-- RIT-070 additive durable review records for subscription events.
BEGIN;

CREATE TABLE "commercial_subscription_review_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_subscription_review_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_subscription_review_v1_event_key" UNIQUE ("event_id"),
    CONSTRAINT "commercial_subscription_review_v1_event_fkey" FOREIGN KEY ("event_id")
        REFERENCES "commercial_subscription_event_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_review_v1_subscription_fkey"
        FOREIGN KEY ("subscription_id") REFERENCES "commercial_subscription_v1" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_subscription_review_v1_value_check" CHECK (
        "reason" IN ('processing_conflict', 'refund_credit_restriction')
    )
);

CREATE INDEX "commercial_subscription_review_v1_subscription_created_idx"
    ON "commercial_subscription_review_v1" ("subscription_id", "created_at", "id");

ALTER TABLE "commercial_subscription_review_v1" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_subscription_review_v1_runtime"
    ON "commercial_subscription_review_v1" TO PUBLIC
    USING (TRUE) WITH CHECK (TRUE);

COMMIT;
