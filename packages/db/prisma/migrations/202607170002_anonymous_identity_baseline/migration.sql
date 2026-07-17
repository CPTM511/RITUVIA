-- RIT-020 is expand-only and creates no anonymous or consent records.
BEGIN;

CREATE TABLE "anonymous_subject" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expiry_policy_version" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_subject_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anonymous_subject_expiry_policy_version_check" CHECK (
        "expiry_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "anonymous_subject_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "anonymous_subject_last_seen_check" CHECK (
        "last_seen_at" >= "created_at" AND "last_seen_at" <= "expires_at"
    )
);

CREATE INDEX "anonymous_subject_expiry_idx"
    ON "anonymous_subject" ("expires_at", "id");

CREATE TABLE "anonymous_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "token_hash_version" SMALLINT NOT NULL DEFAULT 1,
    "issuance_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,
    "expiry_policy_version" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "anonymous_session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anonymous_session_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "anonymous_session_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "anonymous_session_issuance_key_hash_key" UNIQUE ("issuance_key_hash"),
    CONSTRAINT "anonymous_session_token_hash_check" CHECK (octet_length("token_hash") = 32),
    CONSTRAINT "anonymous_session_token_hash_version_check" CHECK ("token_hash_version" = 1),
    CONSTRAINT "anonymous_session_issuance_key_hash_check" CHECK (octet_length("issuance_key_hash") = 32),
    CONSTRAINT "anonymous_session_canonical_request_hash_check" CHECK (octet_length("canonical_request_hash") = 32),
    CONSTRAINT "anonymous_session_expiry_policy_version_check" CHECK (
        "expiry_policy_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "anonymous_session_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "anonymous_session_last_seen_check" CHECK (
        "last_seen_at" >= "created_at" AND "last_seen_at" <= "expires_at"
    ),
    CONSTRAINT "anonymous_session_revoked_check" CHECK (
        "revoked_at" IS NULL OR ("revoked_at" >= "created_at" AND "revoked_at" <= "expires_at")
    )
);

CREATE INDEX "anonymous_session_subject_expiry_idx"
    ON "anonymous_session" ("anonymous_subject_id", "expires_at", "id");
CREATE INDEX "anonymous_session_expiry_idx"
    ON "anonymous_session" ("expires_at", "id");

CREATE TABLE "consent_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anonymous_subject_id" UUID NOT NULL,
    "purpose" VARCHAR(64) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "notice_version" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(35) NOT NULL,
    "decision" VARCHAR(16) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdraws_record_id" UUID,
    "idempotency_key_hash" BYTEA NOT NULL,
    "canonical_request_hash" BYTEA NOT NULL,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "consent_record_subject_fkey" FOREIGN KEY ("anonymous_subject_id")
        REFERENCES "anonymous_subject" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "consent_record_purpose_check" CHECK (
        "purpose" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "consent_record_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "consent_record_notice_version_check" CHECK (
        "notice_version" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
    ),
    CONSTRAINT "consent_record_locale_check" CHECK (
        "locale" ~ '^[A-Za-z0-9]{2,8}(-[A-Za-z0-9]{1,8})*$'
    ),
    CONSTRAINT "consent_record_decision_check" CHECK (
        "decision" IN ('granted', 'denied', 'withdrawn')
    ),
    CONSTRAINT "consent_record_source_check" CHECK (
        "source" IN ('first_party_consent_surface', 'privacy_controls')
    ),
    CONSTRAINT "consent_record_withdrawal_check" CHECK (
        ("decision" = 'withdrawn' AND "withdraws_record_id" IS NOT NULL)
        OR ("decision" <> 'withdrawn' AND "withdraws_record_id" IS NULL)
    ),
    CONSTRAINT "consent_record_idempotency_key_hash_check" CHECK (octet_length("idempotency_key_hash") = 32),
    CONSTRAINT "consent_record_canonical_request_hash_check" CHECK (octet_length("canonical_request_hash") = 32),
    CONSTRAINT "consent_record_identity_key" UNIQUE ("id", "anonymous_subject_id", "purpose"),
    CONSTRAINT "consent_record_subject_purpose_sequence_key" UNIQUE ("anonymous_subject_id", "purpose", "sequence"),
    CONSTRAINT "consent_record_subject_idempotency_key" UNIQUE ("anonymous_subject_id", "idempotency_key_hash"),
    CONSTRAINT "consent_record_withdraws_fkey" FOREIGN KEY (
        "withdraws_record_id", "anonymous_subject_id", "purpose"
    ) REFERENCES "consent_record" ("id", "anonymous_subject_id", "purpose")
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "consent_record_current_idx"
    ON "consent_record" ("anonymous_subject_id", "purpose", "sequence" DESC);

CREATE TABLE "anonymous_session_issuance_gate" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "window_started_at" TIMESTAMPTZ(6) NOT NULL,
    "issued_count" INTEGER NOT NULL,

    CONSTRAINT "anonymous_session_issuance_gate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anonymous_session_issuance_gate_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "anonymous_session_issuance_gate_count_check" CHECK ("issued_count" > 0)
);

COMMIT;
