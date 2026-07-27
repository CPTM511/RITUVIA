-- RIT-051 binds future merge evidence to both source sessions without rewriting existing links.
BEGIN;

ALTER TABLE "anonymous_session"
    ADD CONSTRAINT "anonymous_session_subject_identity_key"
    UNIQUE ("id", "anonymous_subject_id");

ALTER TABLE "account_session"
    ADD CONSTRAINT "account_session_user_identity_key"
    UNIQUE ("id", "user_id");

ALTER TABLE "account_subject_link"
    ADD COLUMN "source_account_session_id" UUID,
    ADD CONSTRAINT "account_subject_link_source_session_fkey"
        FOREIGN KEY ("source_session_id", "anonymous_subject_id")
        REFERENCES "anonymous_session" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT
        NOT VALID,
    ADD CONSTRAINT "account_subject_link_source_account_session_fkey"
        FOREIGN KEY ("source_account_session_id", "user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT
        NOT VALID,
    ADD CONSTRAINT "account_subject_link_source_account_session_required"
        CHECK ("source_account_session_id" IS NOT NULL)
        NOT VALID;

CREATE INDEX "account_subject_link_source_account_session_idx"
    ON "account_subject_link" ("source_account_session_id");

COMMIT;
