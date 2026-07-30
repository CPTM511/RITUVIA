-- RIT-067 append-only commercial reconciliation runs and discrepancy cases.
BEGIN;

ALTER TABLE "commercial_payment_event_v2"
    ADD COLUMN "evidence_source" VARCHAR(32) NOT NULL DEFAULT 'signed_webhook',
    ADD CONSTRAINT "commercial_payment_event_v2_evidence_source_check"
        CHECK ("evidence_source" IN ('signed_webhook', 'reconciliation_api'));

CREATE TABLE "commercial_reconciliation_run_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "provider_account_fingerprint" VARCHAR(128) NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "slot_started_at" TIMESTAMPTZ(6) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "candidate_count" SMALLINT NOT NULL,
    "case_count" SMALLINT NOT NULL,
    "scan_state" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_reconciliation_run_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_reconciliation_run_v1_idempotency_key" UNIQUE (
        "provider", "environment", "provider_account_fingerprint",
        "schema_version", "idempotency_key_hash"
    ),
    CONSTRAINT "commercial_reconciliation_run_v1_value_check" CHECK (
        "provider" = 'stripe'
        AND "environment" = 'sandbox'
        AND "provider_account_fingerprint" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
        AND "schema_version" = 'commercial-reconciliation.v1'
        AND octet_length("idempotency_key_hash") = 32
        AND "candidate_count" BETWEEN 0 AND 100
        AND "case_count" BETWEEN 0 AND 1200
        AND "scan_state" IN ('complete', 'truncated')
        AND "created_at" >= "slot_started_at"
    )
);

CREATE INDEX "commercial_reconciliation_run_v1_schedule_idx"
    ON "commercial_reconciliation_run_v1" (
        "provider", "environment", "provider_account_fingerprint", "slot_started_at" DESC
    );

CREATE TABLE "commercial_reconciliation_case_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "case_type" VARCHAR(48) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "evidence_digest" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_reconciliation_case_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commercial_reconciliation_case_v1_run_fkey" FOREIGN KEY ("run_id")
        REFERENCES "commercial_reconciliation_run_v1" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_reconciliation_case_v1_order_fkey" FOREIGN KEY ("order_id")
        REFERENCES "commercial_order_v2" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_reconciliation_case_v1_attempt_fkey" FOREIGN KEY (
        "payment_attempt_id", "order_id"
    ) REFERENCES "commercial_payment_attempt_v2" ("id", "order_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "commercial_reconciliation_case_v1_run_order_type_key" UNIQUE (
        "run_id", "order_id", "case_type"
    ),
    CONSTRAINT "commercial_reconciliation_case_v1_value_check" CHECK (
        "case_type" IN (
            'provider_api_unavailable', 'provider_payment_missing',
            'internal_payment_pending', 'payment_state_mismatch',
            'payment_amount_mismatch', 'payment_currency_mismatch',
            'payment_reference_mismatch', 'credit_issuance_missing',
            'credit_issuance_duplicate', 'credit_issuance_amount_mismatch',
            'fulfillment_state_mismatch', 'settlement_availability_missing'
        )
        AND "severity" IN ('critical', 'high')
        AND octet_length("evidence_digest") = 32
        AND "created_at" > '2020-01-01T00:00:00.000Z'::timestamptz
    )
);

CREATE INDEX "commercial_reconciliation_case_v1_open_idx"
    ON "commercial_reconciliation_case_v1" ("severity", "created_at" DESC, "id");
CREATE INDEX "commercial_reconciliation_case_v1_order_idx"
    ON "commercial_reconciliation_case_v1" ("order_id", "created_at" DESC, "id");

ALTER TABLE "commercial_reconciliation_run_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commercial_reconciliation_case_v1" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_reconciliation_run_v1_runtime"
    ON "commercial_reconciliation_run_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commercial_reconciliation_case_v1_runtime"
    ON "commercial_reconciliation_case_v1" TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

COMMIT;
