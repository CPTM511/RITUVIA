-- RIT-045 adds account-owned Revisit reminder preference evidence and a privacy-minimal delivery queue.
BEGIN;

ALTER TABLE "account_subject_link"
    ADD CONSTRAINT "account_subject_link_identity_key"
    UNIQUE ("id", "user_id", "anonymous_subject_id");

CREATE TABLE "revisit_reminder_subscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_subject_link_id" UUID NOT NULL,
    "anonymous_subject_id" UUID NOT NULL,
    "revisit_id" UUID NOT NULL,
    "recipient_identity_id" UUID NOT NULL,
    "schema_version" VARCHAR(100) NOT NULL,
    "notice_version" VARCHAR(100) NOT NULL,
    "channel" VARCHAR(16) NOT NULL,
    "frequency" VARCHAR(16) NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "preference_state" VARCHAR(16) NOT NULL,
    "delivery_state" VARCHAR(24) NOT NULL,
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "max_attempts" SMALLINT NOT NULL DEFAULT 3,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_token_hash" BYTEA,
    "leased_until" TIMESTAMPTZ(6),
    "last_failure_code" VARCHAR(40),
    "provider_message_reference" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),
    "dead_lettered_at" TIMESTAMPTZ(6),

    CONSTRAINT "revisit_reminder_subscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "revisit_reminder_subscription_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_reminder_subscription_owner_fkey" FOREIGN KEY (
        "account_subject_link_id", "user_id", "anonymous_subject_id"
    ) REFERENCES "account_subject_link" ("id", "user_id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_reminder_subscription_revisit_fkey" FOREIGN KEY (
        "revisit_id", "anonymous_subject_id"
    ) REFERENCES "revisit" ("id", "anonymous_subject_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_reminder_subscription_identity_fkey" FOREIGN KEY (
        "recipient_identity_id", "user_id"
    ) REFERENCES "auth_identity" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_reminder_subscription_identity_key"
        UNIQUE ("id", "user_id"),
    CONSTRAINT "revisit_reminder_subscription_revisit_key"
        UNIQUE ("revisit_id"),
    CONSTRAINT "revisit_reminder_subscription_contract_check" CHECK (
        "schema_version" = 'revisit-reminder-preference.v1'
        AND "notice_version" = 'rituvia.revisit-reminder-notice.v1'
        AND "channel" = 'email'
        AND "frequency" = 'once'
        AND "locale" = 'en'
        AND "max_attempts" = 3
        AND "attempt_count" BETWEEN 0 AND "max_attempts"
        AND "updated_at" >= "created_at"
    ),
    CONSTRAINT "revisit_reminder_subscription_state_check" CHECK (
        "preference_state" IN ('subscribed', 'unsubscribed')
        AND "delivery_state" IN (
            'pending', 'leased', 'retry_wait', 'delivered', 'dead_lettered', 'cancelled'
        )
        AND (
            (
                "preference_state" = 'subscribed'
                AND "delivery_state" IN (
                    'pending', 'leased', 'retry_wait', 'delivered', 'dead_lettered'
                )
                AND "unsubscribed_at" IS NULL
            )
            OR (
                "preference_state" = 'unsubscribed'
                AND "delivery_state" = 'cancelled'
                AND "unsubscribed_at" IS NOT NULL
            )
        )
        AND (
            (
                "delivery_state" = 'leased'
                AND octet_length("lease_token_hash") = 32
                AND "leased_until" > "updated_at"
            )
            OR (
                "delivery_state" <> 'leased'
                AND "lease_token_hash" IS NULL
                AND "leased_until" IS NULL
            )
        )
        AND (
            (
                "delivery_state" = 'delivered'
                AND "delivered_at" IS NOT NULL
                AND "provider_message_reference" IS NOT NULL
                AND "last_failure_code" IS NULL
                AND "dead_lettered_at" IS NULL
            )
            OR (
                "delivery_state" = 'dead_lettered'
                AND "dead_lettered_at" IS NOT NULL
                AND "last_failure_code" IS NOT NULL
                AND "delivered_at" IS NULL
                AND "provider_message_reference" IS NULL
            )
            OR (
                "delivery_state" NOT IN ('delivered', 'dead_lettered')
                AND "delivered_at" IS NULL
                AND "dead_lettered_at" IS NULL
                AND "provider_message_reference" IS NULL
            )
        )
    )
);

CREATE INDEX "revisit_reminder_subscription_due_idx"
    ON "revisit_reminder_subscription" (
        "delivery_state", "next_attempt_at", "created_at", "id"
    );
CREATE INDEX "revisit_reminder_subscription_user_idx"
    ON "revisit_reminder_subscription" ("user_id", "created_at" DESC, "id" DESC);

CREATE TABLE "revisit_reminder_operation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "revisit_id" UUID NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "result_preference_state" VARCHAR(16) NOT NULL,
    "result_delivery_state" VARCHAR(24) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisit_reminder_operation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "revisit_reminder_operation_subscription_fkey" FOREIGN KEY (
        "subscription_id", "user_id"
    ) REFERENCES "revisit_reminder_subscription" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "revisit_reminder_operation_user_idempotency_key"
        UNIQUE ("user_id", "idempotency_key_hash"),
    CONSTRAINT "revisit_reminder_operation_digest_check" CHECK (
        octet_length("idempotency_key_hash") = 32
        AND octet_length("canonical_request_hash") = 32
    ),
    CONSTRAINT "revisit_reminder_operation_result_check" CHECK (
        "action" IN ('subscribe', 'unsubscribe')
        AND "result_preference_state" IN ('subscribed', 'unsubscribed')
        AND "result_delivery_state" IN (
            'pending', 'leased', 'retry_wait', 'delivered', 'dead_lettered', 'cancelled'
        )
        AND (
            ("action" = 'subscribe' AND "result_preference_state" = 'subscribed')
            OR (
                "action" = 'unsubscribe'
                AND "result_preference_state" = 'unsubscribed'
                AND "result_delivery_state" = 'cancelled'
            )
        )
    )
);

CREATE INDEX "revisit_reminder_operation_subscription_idx"
    ON "revisit_reminder_operation" ("subscription_id", "created_at", "id");

COMMIT;
