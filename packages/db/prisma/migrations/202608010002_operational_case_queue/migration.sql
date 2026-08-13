-- RIT-125 adds source-bound, privacy-minimal operational queues without database routines.
BEGIN;

CREATE TABLE "support_ticket_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "affected_area" VARCHAR(24) NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_ticket_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "support_ticket_v1_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "support_ticket_v1_subject_idempotency_key" UNIQUE (
        "anonymous_subject_id", "idempotency_key_hash"
    ),
    CONSTRAINT "support_ticket_v1_value_check" CHECK (
        "category" IN ('account', 'billing', 'technical', 'other')
        AND "affected_area" IN (
            'intake', 'reading', 'sanctuary', 'revisit', 'account', 'privacy', 'billing', 'other'
        )
        AND "schema_version" = 'support-ticket.v1'
        AND "policy_version" = 'protected-beta-support.local.en.v1'
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND "expires_at" > "created_at"
    )
);

CREATE INDEX "support_ticket_v1_expiry_idx"
    ON "support_ticket_v1" ("expires_at", "id");

CREATE TABLE "operational_case_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "queue_kind" VARCHAR(24) NOT NULL,
    "source_kind" VARCHAR(40) NOT NULL,
    "source_id" UUID NOT NULL,
    "support_ticket_id" UUID,
    "reading_report_id" UUID,
    "privacy_export_id" UUID,
    "privacy_deletion_request_id" UUID,
    "commercial_refund_request_id" UUID,
    "category_code" VARCHAR(64) NOT NULL,
    "priority" VARCHAR(16) NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,
    "draft_template_code" VARCHAR(64) NOT NULL,
    "draft_template_version" VARCHAR(100) NOT NULL,
    "draft_locale" VARCHAR(35) NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL,
    "first_response_due_at" TIMESTAMPTZ(6) NOT NULL,
    "resolution_due_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "operational_case_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_case_v1_source_key" UNIQUE ("source_kind", "source_id"),
    CONSTRAINT "operational_case_v1_support_ticket_fkey" FOREIGN KEY ("support_ticket_id")
        REFERENCES "support_ticket_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_v1_reading_report_fkey" FOREIGN KEY ("reading_report_id")
        REFERENCES "reading_report" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_v1_privacy_export_fkey" FOREIGN KEY ("privacy_export_id")
        REFERENCES "privacy_export" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_v1_privacy_deletion_fkey"
        FOREIGN KEY ("privacy_deletion_request_id")
        REFERENCES "privacy_deletion_request" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_v1_refund_fkey" FOREIGN KEY ("commercial_refund_request_id")
        REFERENCES "commercial_refund_request_v1" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_v1_value_check" CHECK (
        "queue_kind" IN ('support', 'privacy', 'safety', 'content_report')
        AND "source_kind" IN (
            'support_ticket',
            'commercial_refund_request',
            'privacy_deletion_request',
            'privacy_export',
            'reading_report'
        )
        AND "category_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "priority" IN ('normal', 'high', 'urgent')
        AND "policy_version" = 'protected-beta-operations.local.en.v1'
        AND "draft_template_code" IN (
            'content_report_ack',
            'privacy_request_ack',
            'safety_report_ack',
            'support_request_ack',
            'support_refund_ack'
        )
        AND "draft_template_version" = 'operational-case-draft.en.v1'
        AND "draft_locale" = 'en'
        AND "first_response_due_at" > "opened_at"
        AND "resolution_due_at" > "first_response_due_at"
        AND ("expires_at" IS NULL OR "expires_at" > "opened_at")
        AND num_nonnulls(
            "support_ticket_id",
            "reading_report_id",
            "privacy_export_id",
            "privacy_deletion_request_id",
            "commercial_refund_request_id"
        ) = 1
        AND (
            (
                "queue_kind" = 'support'
                AND "source_kind" = 'support_ticket'
                AND "support_ticket_id" = "source_id"
            )
            OR (
                "queue_kind" = 'support'
                AND "source_kind" = 'commercial_refund_request'
                AND "commercial_refund_request_id" = "source_id"
            )
            OR (
                "queue_kind" = 'privacy'
                AND "source_kind" = 'privacy_export'
                AND "privacy_export_id" = "source_id"
            )
            OR (
                "queue_kind" = 'privacy'
                AND "source_kind" = 'privacy_deletion_request'
                AND "privacy_deletion_request_id" = "source_id"
            )
            OR (
                "queue_kind" = 'safety'
                AND "source_kind" = 'reading_report'
                AND "reading_report_id" = "source_id"
                AND "category_code" = 'safety'
            )
            OR (
                "queue_kind" = 'content_report'
                AND "source_kind" = 'reading_report'
                AND "reading_report_id" = "source_id"
                AND "category_code" <> 'safety'
            )
        )
    )
);

CREATE UNIQUE INDEX "operational_case_v1_support_ticket_key"
    ON "operational_case_v1" ("support_ticket_id") WHERE "support_ticket_id" IS NOT NULL;
CREATE UNIQUE INDEX "operational_case_v1_reading_report_key"
    ON "operational_case_v1" ("reading_report_id") WHERE "reading_report_id" IS NOT NULL;
CREATE UNIQUE INDEX "operational_case_v1_privacy_export_key"
    ON "operational_case_v1" ("privacy_export_id") WHERE "privacy_export_id" IS NOT NULL;
CREATE UNIQUE INDEX "operational_case_v1_privacy_deletion_key"
    ON "operational_case_v1" ("privacy_deletion_request_id")
    WHERE "privacy_deletion_request_id" IS NOT NULL;
CREATE UNIQUE INDEX "operational_case_v1_refund_key"
    ON "operational_case_v1" ("commercial_refund_request_id")
    WHERE "commercial_refund_request_id" IS NOT NULL;
CREATE INDEX "operational_case_v1_queue_due_idx"
    ON "operational_case_v1" (
        "queue_kind", "priority", "first_response_due_at", "opened_at", "id"
    );
CREATE INDEX "operational_case_v1_expiry_idx"
    ON "operational_case_v1" ("expires_at", "id");

CREATE TABLE "operational_case_audit_event_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "actor_session_id" UUID NOT NULL,
    "actor_role" VARCHAR(40),
    "request_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "target_type" VARCHAR(40) NOT NULL,
    "target_id" VARCHAR(128) NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "ticket_reference" VARCHAR(64) NOT NULL,
    "change_fields" TEXT[] NOT NULL,
    "before_digest" BYTEA,
    "after_digest" BYTEA,
    "previous_event_hash" BYTEA,
    "event_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_case_audit_event_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_case_audit_event_v1_request_key" UNIQUE ("request_id"),
    CONSTRAINT "operational_case_audit_event_v1_hash_key" UNIQUE ("event_hash"),
    CONSTRAINT "operational_case_audit_event_v1_actor_user_fkey"
        FOREIGN KEY ("actor_user_id") REFERENCES "app_user" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_audit_event_v1_actor_session_user_fkey"
        FOREIGN KEY ("actor_session_id", "actor_user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_audit_event_v1_value_check" CHECK (
        "actor_role" IS NULL OR "actor_role" IN (
            'owner', 'content_editor', 'support_refund_reviewer',
            'risk_safety_reviewer', 'analyst_read_only'
        )
    ),
    CONSTRAINT "operational_case_audit_event_v1_action_check" CHECK (
        "action" IN (
            'admin.content_report.review', 'admin.privacy.review',
            'admin.safety.review', 'admin.support.review'
        )
        AND "outcome" IN ('completed', 'denied')
        AND "target_type" IN ('operational_case', 'operational_queue')
        AND octet_length("target_id") BETWEEN 1 AND 128
        AND "reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
        AND cardinality("change_fields") BETWEEN 0 AND 3
        AND "change_fields" <@ ARRAY['assigned_role', 'priority', 'state']::TEXT[]
        AND ("before_digest" IS NULL OR octet_length("before_digest") = 32)
        AND ("after_digest" IS NULL OR octet_length("after_digest") = 32)
        AND ("previous_event_hash" IS NULL OR octet_length("previous_event_hash") = 32)
        AND octet_length("event_hash") = 32
    )
);

CREATE INDEX "operational_case_audit_event_v1_chain_idx"
    ON "operational_case_audit_event_v1" ("created_at", "id");
CREATE INDEX "operational_case_audit_event_v1_target_idx"
    ON "operational_case_audit_event_v1" (
        "target_type", "target_id", "created_at" DESC, "id" DESC
    );
CREATE UNIQUE INDEX "operational_case_audit_event_v1_previous_hash_key"
    ON "operational_case_audit_event_v1" ("previous_event_hash")
    WHERE "previous_event_hash" IS NOT NULL;
CREATE UNIQUE INDEX "operational_case_audit_event_v1_single_genesis_idx"
    ON "operational_case_audit_event_v1" (("previous_event_hash" IS NULL))
    WHERE "previous_event_hash" IS NULL;

CREATE TABLE "operational_case_event_v1" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "audit_event_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_session_id" UUID NOT NULL,
    "actor_role" VARCHAR(40) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "from_state" VARCHAR(16) NOT NULL,
    "to_state" VARCHAR(16) NOT NULL,
    "from_priority" VARCHAR(16) NOT NULL,
    "to_priority" VARCHAR(16) NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "ticket_reference" VARCHAR(64) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_case_event_v1_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "operational_case_event_v1_audit_key" UNIQUE ("audit_event_id"),
    CONSTRAINT "operational_case_event_v1_actor_idempotency_key" UNIQUE (
        "actor_user_id", "action", "idempotency_key_hash"
    ),
    CONSTRAINT "operational_case_event_v1_case_fkey" FOREIGN KEY ("case_id")
        REFERENCES "operational_case_v1" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_event_v1_audit_fkey" FOREIGN KEY ("audit_event_id")
        REFERENCES "operational_case_audit_event_v1" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_event_v1_actor_user_fkey" FOREIGN KEY ("actor_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_event_v1_actor_session_user_fkey"
        FOREIGN KEY ("actor_session_id", "actor_user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "operational_case_event_v1_value_check" CHECK (
        "actor_role" IN ('owner', 'content_editor', 'support_refund_reviewer', 'risk_safety_reviewer')
        AND "action" IN ('triage', 'escalate', 'resolve')
        AND "from_state" IN ('open', 'triaged', 'escalated')
        AND "to_state" IN ('triaged', 'escalated', 'resolved')
        AND "from_priority" IN ('normal', 'high', 'urgent')
        AND "to_priority" IN ('normal', 'high', 'urgent')
        AND "reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
        AND "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
        AND octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
        AND (
            ("action" = 'triage' AND "from_state" = 'open'
                AND "to_state" = 'triaged' AND "from_priority" = "to_priority")
            OR ("action" = 'escalate' AND "from_state" IN ('open', 'triaged')
                AND "to_state" = 'escalated' AND "to_priority" = 'urgent')
            OR ("action" = 'resolve' AND "from_state" IN ('triaged', 'escalated')
                AND "to_state" = 'resolved' AND "from_priority" = "to_priority")
        )
    )
);

CREATE INDEX "operational_case_event_v1_case_timeline_idx"
    ON "operational_case_event_v1" ("case_id", "created_at", "id");

ALTER TABLE "support_ticket_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operational_case_v1" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_ticket_v1_runtime" ON "support_ticket_v1" TO "rituvia_app"
    USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "operational_case_v1_admin_read" ON "operational_case_v1"
    FOR SELECT TO "rituvia_admin_service" USING (TRUE);

CREATE POLICY "operational_case_v1_reading_intake" ON "operational_case_v1"
    FOR INSERT TO "rituvia_tarot_reading_writer" WITH CHECK (
        "source_kind" = 'reading_report'
        AND "reading_report_id" = "source_id"
        AND EXISTS (
            SELECT 1 FROM "reading_report" AS report
            WHERE report.id = "reading_report_id"
              AND report.category = "category_code"
              AND date_trunc('milliseconds', report.created_at) = "opened_at"
              AND date_trunc('milliseconds', report.expires_at)
                  = "operational_case_v1"."expires_at"
              AND (
                  (report.category = 'safety' AND "queue_kind" = 'safety'
                    AND "priority" = 'urgent' AND "draft_template_code" = 'safety_report_ack'
                    AND "first_response_due_at" = date_trunc('milliseconds', report.created_at)
                        + INTERVAL '15 minutes'
                    AND "resolution_due_at" = date_trunc('milliseconds', report.created_at)
                        + INTERVAL '4 hours')
                  OR (report.category = 'rights' AND "queue_kind" = 'content_report'
                    AND "priority" = 'high' AND "draft_template_code" = 'content_report_ack'
                    AND "first_response_due_at" = date_trunc('milliseconds', report.created_at)
                        + INTERVAL '4 hours'
                    AND "resolution_due_at" = date_trunc('milliseconds', report.created_at)
                        + INTERVAL '24 hours')
                  OR (report.category NOT IN ('safety', 'rights')
                    AND "queue_kind" = 'content_report' AND "priority" = 'normal'
                    AND "draft_template_code" = 'content_report_ack'
                    AND "first_response_due_at" = date_trunc('milliseconds', report.created_at)
                        + INTERVAL '24 hours'
                    AND "resolution_due_at" = date_trunc('milliseconds', report.created_at)
                        + INTERVAL '72 hours')
              )
        )
    );

CREATE POLICY "operational_case_v1_app_intake" ON "operational_case_v1"
    FOR INSERT TO "rituvia_app" WITH CHECK (
        (
            "source_kind" = 'support_ticket' AND "support_ticket_id" = "source_id"
            AND EXISTS (
                SELECT 1 FROM "support_ticket_v1" AS ticket
                WHERE ticket.id = "support_ticket_id"
                  AND "queue_kind" = 'support'
                  AND "category_code" = 'support.' || ticket.category
                  AND "priority" = 'normal'
                  AND "draft_template_code" = 'support_request_ack'
                  AND "opened_at" = date_trunc('milliseconds', ticket.created_at)
                  AND "first_response_due_at" = date_trunc('milliseconds', ticket.created_at)
                      + INTERVAL '24 hours'
                  AND "resolution_due_at" = date_trunc('milliseconds', ticket.created_at)
                      + INTERVAL '72 hours'
                  AND "operational_case_v1"."expires_at"
                      = date_trunc('milliseconds', ticket.expires_at)
            )
        ) OR (
            "source_kind" = 'privacy_export' AND "privacy_export_id" = "source_id"
            AND EXISTS (
                SELECT 1 FROM "privacy_export" AS export
                WHERE export.id = "privacy_export_id"
                  AND "queue_kind" = 'privacy' AND "category_code" = 'privacy_export'
                  AND "priority" = 'normal' AND "draft_template_code" = 'privacy_request_ack'
                  AND "opened_at" = date_trunc('milliseconds', export.created_at)
                  AND "first_response_due_at" = date_trunc('milliseconds', export.created_at)
                      + INTERVAL '24 hours'
                  AND "resolution_due_at" = date_trunc('milliseconds', export.created_at)
                      + INTERVAL '72 hours'
                  AND "operational_case_v1"."expires_at"
                      = date_trunc('milliseconds', export.expires_at)
            )
        ) OR (
            "source_kind" = 'commercial_refund_request'
            AND "commercial_refund_request_id" = "source_id"
            AND EXISTS (
                SELECT 1 FROM "commercial_refund_request_v1" AS refund
                WHERE refund.id = "commercial_refund_request_id"
                  AND "queue_kind" = 'support' AND "category_code" = 'refund_request'
                  AND "priority" = 'high' AND "draft_template_code" = 'support_refund_ack'
                  AND "opened_at" = date_trunc('milliseconds', refund.created_at)
                  AND "first_response_due_at" = date_trunc('milliseconds', refund.created_at)
                      + INTERVAL '4 hours'
                  AND "resolution_due_at" = date_trunc('milliseconds', refund.created_at)
                      + INTERVAL '24 hours'
                  AND "expires_at" IS NULL
            )
        )
    );

CREATE POLICY "operational_case_v1_privacy_deletion_intake" ON "operational_case_v1"
    FOR INSERT TO "rituvia_privacy_deletion" WITH CHECK (
        "source_kind" = 'privacy_deletion_request'
        AND "privacy_deletion_request_id" = "source_id"
        AND EXISTS (
            SELECT 1 FROM "privacy_deletion_request" AS deletion
            WHERE deletion.id = "privacy_deletion_request_id"
              AND "queue_kind" = 'privacy' AND "category_code" = 'privacy_deletion'
              AND "priority" = 'high' AND "draft_template_code" = 'privacy_request_ack'
              AND "opened_at" = date_trunc('milliseconds', deletion.requested_at)
              AND "first_response_due_at" = date_trunc('milliseconds', deletion.requested_at)
                  + INTERVAL '4 hours'
              AND "resolution_due_at" = date_trunc('milliseconds', deletion.requested_at)
                  + INTERVAL '24 hours'
              AND "expires_at" IS NULL
        )
    );

COMMIT;
