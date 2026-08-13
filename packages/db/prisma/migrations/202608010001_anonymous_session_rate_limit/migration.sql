-- RIT-122 adds one bounded, privacy-minimal admission row per session and approved scope.
BEGIN;

CREATE TABLE "anonymous_session_rate_limit" (
    "anonymous_session_id" UUID NOT NULL,
    "scope" VARCHAR(64) NOT NULL,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL,
    "policy_version" VARCHAR(100) NOT NULL,

    CONSTRAINT "anonymous_session_rate_limit_pkey"
        PRIMARY KEY ("anonymous_session_id", "scope"),
    CONSTRAINT "anonymous_session_rate_limit_session_fkey"
        FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_session" ("id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "anonymous_session_rate_limit_scope_check" CHECK (
        "scope" IN ('question_intake', 'protected_beta_mutation')
    ),
    CONSTRAINT "anonymous_session_rate_limit_count_check" CHECK ("request_count" > 0),
    CONSTRAINT "anonymous_session_rate_limit_policy_check" CHECK (
        "policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    )
);

COMMIT;
