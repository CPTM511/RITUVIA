-- RIT-037 adds exact displayable interpretation report targets without rewriting prior rows.
BEGIN;

ALTER TABLE "interpretation"
    ADD CONSTRAINT "interpretation_report_target_key" UNIQUE (
        "id", "reading_id", "anonymous_subject_id", "expires_at", "status"
    );

ALTER TABLE "interpretation_verification"
    ADD CONSTRAINT "interpretation_report_verification_key" UNIQUE (
        "interpretation_id", "anonymous_subject_id", "expires_at", "parent_status", "status"
    );

ALTER TABLE "reading_report"
    ADD COLUMN "interpretation_id" UUID,
    ADD COLUMN "interpretation_parent_status" VARCHAR(24),
    ADD COLUMN "interpretation_verification_status" VARCHAR(24),
    ADD COLUMN "report_request_schema_version" VARCHAR(100);

ALTER TABLE "reading_report"
    ADD CONSTRAINT "reading_report_request_schema_check" CHECK (
        "report_request_schema_version" IS NULL
        OR "report_request_schema_version" IN (
            'tarot-reading-report.v1',
            'tarot-reading-report.v2'
        )
    ),
    ADD CONSTRAINT "reading_report_interpretation_target_check" CHECK (
        (
            (
                "report_request_schema_version" IS NULL
                OR "report_request_schema_version" = 'tarot-reading-report.v1'
            )
            AND "interpretation_id" IS NULL
            AND "interpretation_parent_status" IS NULL
            AND "interpretation_verification_status" IS NULL
        )
        OR (
            "report_request_schema_version" = 'tarot-reading-report.v2'
            AND "schema_version" = 'tarot-reading-report.v1'
            AND "target_kind" = 'reading'
            AND "target_position_id" IS NULL
            AND "interpretation_id" IS NOT NULL
            AND (
                (
                    "interpretation_parent_status" = 'fallback'
                    AND "interpretation_verification_status" IS NULL
                )
                OR (
                    "interpretation_parent_status" = 'pending_verification'
                    AND "interpretation_verification_status" IS NOT NULL
                    AND "interpretation_verification_status" IN (
                        'verified',
                        'safe_replacement'
                    )
                )
            )
        )
    ),
    ADD CONSTRAINT "reading_report_interpretation_fkey" FOREIGN KEY (
        "interpretation_id",
        "reading_id",
        "anonymous_subject_id",
        "expires_at",
        "interpretation_parent_status"
    ) REFERENCES "interpretation" (
        "id",
        "reading_id",
        "anonymous_subject_id",
        "expires_at",
        "status"
    ) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "reading_report_verification_fkey" FOREIGN KEY (
        "interpretation_id",
        "anonymous_subject_id",
        "expires_at",
        "interpretation_parent_status",
        "interpretation_verification_status"
    ) REFERENCES "interpretation_verification" (
        "interpretation_id",
        "anonymous_subject_id",
        "expires_at",
        "parent_status",
        "status"
    ) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "reading_report_interpretation_created_idx"
    ON "reading_report" ("interpretation_id", "created_at" DESC, "id" DESC);

COMMIT;
