-- RIT-104 binds every queued Revisit reminder to one approved lifecycle template source.
BEGIN;

ALTER TABLE "revisit_reminder_subscription"
    ADD COLUMN "template_id" VARCHAR(80) NOT NULL DEFAULT 'revisit-reminder',
    ADD COLUMN "template_version" VARCHAR(100) NOT NULL DEFAULT 'revisit-reminder.en.v1',
    ADD COLUMN "template_source_checksum" CHAR(64) NOT NULL
        DEFAULT 'f88307a199976dd59ca9209205b93a746db133636769216f073b7e3ec4fa2b0f',
    ADD COLUMN "template_locale" VARCHAR(35) NOT NULL DEFAULT 'en',
    ADD COLUMN "template_fallback_used" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT "revisit_reminder_subscription_template_check" CHECK (
        "template_id" ~ '^[a-z][a-z0-9-]{0,79}$'
        AND "template_version" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'
        AND "template_source_checksum" ~ '^[0-9a-f]{64}$'
        AND "template_locale" ~ '^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$'
        AND "template_fallback_used" = FALSE
    );

COMMIT;
