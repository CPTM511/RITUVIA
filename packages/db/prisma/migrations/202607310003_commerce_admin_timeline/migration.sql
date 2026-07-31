-- RIT-073 adds a separate append-only commerce audit chain without rewriting historical audit.
BEGIN;

CREATE TABLE "commerce_admin_audit_event_v1" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_session_id" UUID NOT NULL,
    "actor_role" VARCHAR(40),
    "request_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "target_type" VARCHAR(64) NOT NULL,
    "target_id" VARCHAR(128) NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "ticket_reference" VARCHAR(64),
    "change_fields" TEXT[] NOT NULL,
    "before_digest" BYTEA,
    "after_digest" BYTEA,
    "previous_event_hash" BYTEA,
    "event_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commerce_admin_audit_event_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_admin_audit_event_v1_actor_session_fkey"
        FOREIGN KEY ("actor_session_id", "actor_user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_admin_audit_event_v1_request_key" UNIQUE ("request_id"),
    CONSTRAINT "commerce_admin_audit_event_v1_hash_key" UNIQUE ("event_hash"),
    CONSTRAINT "commerce_admin_audit_event_v1_role_check"
        CHECK (
            "actor_role" IS NULL
            OR "actor_role" IN (
                'owner',
                'content_editor',
                'support_refund_reviewer',
                'risk_safety_reviewer',
                'analyst_read_only'
            )
        ),
    CONSTRAINT "commerce_admin_audit_event_v1_action_check"
        CHECK (
            "action" IN (
                'admin.commerce.read',
                'admin.commerce.reconcile',
                'admin.refund.execute'
            )
        ),
    CONSTRAINT "commerce_admin_audit_event_v1_outcome_check"
        CHECK ("outcome" IN ('accepted', 'completed', 'denied')),
    CONSTRAINT "commerce_admin_audit_event_v1_identifier_check"
        CHECK (
            "target_type" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND octet_length("target_id") BETWEEN 1 AND 128
            AND "reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND (
                "ticket_reference" IS NULL
                OR "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
            )
        ),
    CONSTRAINT "commerce_admin_audit_event_v1_fields_check"
        CHECK (
            cardinality("change_fields") BETWEEN 0 AND 2
            AND "change_fields" <@ ARRAY['amount_minor', 'currency_code']::TEXT[]
        ),
    CONSTRAINT "commerce_admin_audit_event_v1_digest_check"
        CHECK (
            ("before_digest" IS NULL OR octet_length("before_digest") = 32)
            AND ("after_digest" IS NULL OR octet_length("after_digest") = 32)
            AND ("previous_event_hash" IS NULL OR octet_length("previous_event_hash") = 32)
            AND octet_length("event_hash") = 32
        )
);

CREATE INDEX "commerce_admin_audit_event_v1_chain_idx"
    ON "commerce_admin_audit_event_v1" ("created_at", "id");
CREATE INDEX "commerce_admin_audit_event_v1_actor_idx"
    ON "commerce_admin_audit_event_v1" ("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "commerce_admin_audit_event_v1_target_idx"
    ON "commerce_admin_audit_event_v1" ("target_type", "target_id", "created_at" DESC, "id" DESC);
CREATE UNIQUE INDEX "commerce_admin_audit_event_v1_previous_hash_key"
    ON "commerce_admin_audit_event_v1" ("previous_event_hash")
    WHERE "previous_event_hash" IS NOT NULL;
CREATE UNIQUE INDEX "commerce_admin_audit_event_v1_single_genesis_idx"
    ON "commerce_admin_audit_event_v1" (("previous_event_hash" IS NULL))
    WHERE "previous_event_hash" IS NULL;

CREATE TABLE "commerce_admin_operation_v1" (
    "id" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "order_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_session_id" UUID NOT NULL,
    "audit_event_id" UUID NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "ticket_reference" VARCHAR(64) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "limit_policy_version" VARCHAR(100) NOT NULL,
    "amount_minor" INTEGER,
    "currency_code" CHAR(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commerce_admin_operation_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_admin_operation_v1_order_fkey"
        FOREIGN KEY ("order_id") REFERENCES "commercial_order_v2" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_admin_operation_v1_actor_session_fkey"
        FOREIGN KEY ("actor_session_id", "actor_user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_admin_operation_v1_audit_fkey"
        FOREIGN KEY ("audit_event_id") REFERENCES "commerce_admin_audit_event_v1" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_admin_operation_v1_audit_key" UNIQUE ("audit_event_id"),
    CONSTRAINT "commerce_admin_operation_v1_actor_idempotency_key"
        UNIQUE ("actor_user_id", "action", "idempotency_key_hash"),
    CONSTRAINT "commerce_admin_operation_v1_action_check"
        CHECK ("action" IN ('reconcile_order', 'refund_order')),
    CONSTRAINT "commerce_admin_operation_v1_identifier_check"
        CHECK (
            "reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
            AND "limit_policy_version" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        ),
    CONSTRAINT "commerce_admin_operation_v1_digest_check"
        CHECK (
            octet_length("idempotency_key_hash") = 32
            AND octet_length("canonical_request_hash") = 32
        ),
    CONSTRAINT "commerce_admin_operation_v1_amount_check"
        CHECK (
            (
                "action" = 'refund_order'
                AND "amount_minor" BETWEEN 1 AND 2147483647
                AND "currency_code" ~ '^[A-Z]{3}$'
            )
            OR (
                "action" = 'reconcile_order'
                AND "amount_minor" IS NULL
                AND "currency_code" IS NULL
            )
        )
);

CREATE INDEX "commerce_admin_operation_v1_order_created_idx"
    ON "commerce_admin_operation_v1" ("order_id", "created_at" DESC, "id" DESC);
CREATE INDEX "commerce_admin_operation_v1_actor_created_idx"
    ON "commerce_admin_operation_v1" ("actor_user_id", "created_at" DESC, "id" DESC);

CREATE TABLE "commerce_admin_operation_event_v1" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "attempt_id" UUID,
    "event_type" VARCHAR(32) NOT NULL,
    "result_reference" VARCHAR(128),
    "evidence_digest" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commerce_admin_operation_event_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commerce_admin_operation_event_v1_operation_fkey"
        FOREIGN KEY ("operation_id") REFERENCES "commerce_admin_operation_v1" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commerce_admin_operation_event_v1_event_check"
        CHECK (
            (
                "event_type" = 'requested'
                AND "attempt_id" IS NULL
                AND "result_reference" IS NULL
            )
            OR (
                "event_type" = 'execution_started'
                AND "attempt_id" IS NOT NULL
                AND "result_reference" IS NULL
            )
            OR (
                "event_type" IN ('succeeded', 'failed')
                AND "attempt_id" IS NOT NULL
            )
        ),
    CONSTRAINT "commerce_admin_operation_event_v1_reference_check"
        CHECK (
            "result_reference" IS NULL
            OR "result_reference" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        ),
    CONSTRAINT "commerce_admin_operation_event_v1_digest_check"
        CHECK (octet_length("evidence_digest") = 32),
    CONSTRAINT "commerce_admin_operation_event_v1_attempt_event_key"
        UNIQUE ("operation_id", "attempt_id", "event_type")
);

CREATE UNIQUE INDEX "commerce_admin_operation_event_v1_requested_key"
    ON "commerce_admin_operation_event_v1" ("operation_id")
    WHERE "event_type" = 'requested';
CREATE UNIQUE INDEX "commerce_admin_operation_event_v1_succeeded_key"
    ON "commerce_admin_operation_event_v1" ("operation_id")
    WHERE "event_type" = 'succeeded';
CREATE INDEX "commerce_admin_operation_event_v1_timeline_idx"
    ON "commerce_admin_operation_event_v1" ("operation_id", "created_at", "id");

CREATE VIEW "commerce_admin_order_summary_v1"
WITH (security_barrier = true) AS
SELECT
    orders.id,
    orders.public_id,
    orders.user_id,
    orders.status,
    orders.total_minor,
    orders.currency_code,
    items.product_code,
    attempts.provider,
    attempts.environment
FROM "commercial_order_v2" AS orders
JOIN LATERAL (
    SELECT product_code
    FROM "commercial_order_item_v2"
    WHERE order_id = orders.id
    ORDER BY id
    LIMIT 1
) AS items ON TRUE
JOIN LATERAL (
    SELECT provider, environment
    FROM "commercial_payment_attempt_v2"
    WHERE order_id = orders.id
    ORDER BY attempt_number DESC, id DESC
    LIMIT 1
) AS attempts ON TRUE;

CREATE VIEW "commerce_admin_timeline_v1"
WITH (security_barrier = true) AS
SELECT orders.id AS order_id, 'order'::text AS source, 'order.created'::text AS code,
       orders.created_at AS occurred_at, orders.public_id::text AS reference,
       'created'::text AS state, orders.total_minor AS amount_minor,
       orders.currency_code::text AS currency_code
FROM "commercial_order_v2" AS orders
UNION ALL
SELECT orders.id, 'order', 'order.paid', orders.paid_at, orders.public_id::text,
       'paid', orders.total_minor, orders.currency_code::text
FROM "commercial_order_v2" AS orders WHERE orders.paid_at IS NOT NULL
UNION ALL
SELECT orders.id, 'order', 'order.refund_requested', orders.refund_requested_at,
       orders.public_id::text, 'refund_requested', NULL::integer,
       orders.currency_code::text
FROM "commercial_order_v2" AS orders WHERE orders.refund_requested_at IS NOT NULL
UNION ALL
SELECT orders.id, 'order', 'order.refunded', orders.refunded_at, orders.public_id::text,
       'refunded', NULL::integer, orders.currency_code::text
FROM "commercial_order_v2" AS orders WHERE orders.refunded_at IS NOT NULL
UNION ALL
SELECT attempts.order_id, 'payment', 'payment.attempt.created', attempts.created_at,
       attempts.id::text, 'created', attempts.amount_minor, attempts.currency_code::text
FROM "commercial_payment_attempt_v2" AS attempts
UNION ALL
SELECT attempts.order_id, 'payment', 'payment.attempt.completed', attempts.completed_at,
       attempts.id::text, 'completed', attempts.amount_minor, attempts.currency_code::text
FROM "commercial_payment_attempt_v2" AS attempts WHERE attempts.completed_at IS NOT NULL
UNION ALL
SELECT events.order_id, 'payment', 'payment.' || events.event_type,
       events.provider_occurred_at, events.id::text,
       'recorded',
       events.amount_minor, events.currency_code::text
FROM "commercial_payment_event_v2" AS events WHERE events.order_id IS NOT NULL
UNION ALL
SELECT ledger.order_id, 'credit', ledger.operation, ledger.created_at, ledger.id::text,
       ledger.direction, ledger.amount, NULL::text
FROM "credit_ledger_entry" AS ledger WHERE ledger.order_id IS NOT NULL
UNION ALL
SELECT restrictions.order_id, 'credit', restrictions.operation, restrictions.created_at,
       restrictions.id::text, restrictions.kind, restrictions.amount, NULL::text
FROM "credit_restriction_entry" AS restrictions
UNION ALL
SELECT refunds.order_id, 'refund', 'refund.requested', refunds.created_at,
       refunds.public_id::text, 'requested', refunds.amount_minor,
       refunds.currency_code::text
FROM "commercial_refund_request_v1" AS refunds
UNION ALL
SELECT refunds.order_id, 'refund', 'refund.submitted', refunds.submitted_at,
       refunds.public_id::text, 'submitted', refunds.amount_minor, refunds.currency_code::text
FROM "commercial_refund_request_v1" AS refunds WHERE refunds.submitted_at IS NOT NULL
UNION ALL
SELECT refunds.order_id, 'refund', 'refund.confirmed', refunds.confirmed_at,
       refunds.public_id::text, 'confirmed', refunds.amount_minor, refunds.currency_code::text
FROM "commercial_refund_request_v1" AS refunds WHERE refunds.confirmed_at IS NOT NULL
UNION ALL
SELECT refunds.order_id, 'refund', 'refund.rejected', refunds.rejected_at,
       refunds.public_id::text, 'rejected', refunds.amount_minor, refunds.currency_code::text
FROM "commercial_refund_request_v1" AS refunds WHERE refunds.rejected_at IS NOT NULL
UNION ALL
SELECT cases.order_id, 'reconciliation', 'reconciliation.' || cases.case_type,
       cases.created_at, cases.id::text, cases.severity, NULL::integer, NULL::text
FROM "commercial_reconciliation_case_v1" AS cases
UNION ALL
SELECT subscriptions.source_order_id, 'subscription',
       'subscription.' || events.event_type, events.occurred_at, events.id::text,
       'recorded',
       NULL::integer, NULL::text
FROM "commercial_subscription_event_v1" AS events
JOIN "commercial_subscription_v1" AS subscriptions
  ON subscriptions.provider_subscription_id = events.provider_subscription_id
 AND subscriptions.provider = events.provider
 AND subscriptions.environment = events.environment
 AND subscriptions.provider_account_fingerprint = events.provider_account_fingerprint
UNION ALL
SELECT subscriptions.source_order_id, 'subscription',
       'subscription.review.' || reviews.reason, reviews.created_at, reviews.id::text,
       'review_required', NULL::integer, NULL::text
FROM "commercial_subscription_review_v1" AS reviews
JOIN "commercial_subscription_v1" AS subscriptions ON subscriptions.id = reviews.subscription_id
UNION ALL
SELECT operations.order_id, 'admin',
       'admin.' || operations.action || '.' || events.event_type,
       events.created_at, events.id::text, events.event_type,
       operations.amount_minor, operations.currency_code::text
FROM "commerce_admin_operation_v1" AS operations
JOIN "commerce_admin_operation_event_v1" AS events ON events.operation_id = operations.id;

COMMIT;
