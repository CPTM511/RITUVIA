-- RIT-056 adds append-only admin role, passkey-MFA assertion, and tamper-evident audit foundations.
BEGIN;

ALTER TABLE "auth_identity"
    ADD CONSTRAINT "auth_identity_user_identity_key" UNIQUE ("id", "user_id");

ALTER TABLE "account_session"
    ADD CONSTRAINT "account_session_user_auth_identity_key"
        UNIQUE ("id", "user_id", "auth_identity_id"),
    ADD CONSTRAINT "account_session_identity_user_fkey"
        FOREIGN KEY ("auth_identity_id", "user_id")
        REFERENCES "auth_identity" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "passkey_credential"
    ADD CONSTRAINT "passkey_credential_auth_identity_key"
        UNIQUE ("id", "auth_identity_id");

CREATE TABLE "admin_role_assignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" VARCHAR(40) NOT NULL,
    "granted_by_user_id" UUID,
    "reason_code" VARCHAR(64) NOT NULL,
    "ticket_reference" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_role_assignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_role_assignment_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_role_assignment_grantor_fkey" FOREIGN KEY ("granted_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_role_assignment_user_identity_key" UNIQUE ("id", "user_id"),
    CONSTRAINT "admin_role_assignment_role_check"
        CHECK (
            "role" IN (
                'owner',
                'content_editor',
                'support_refund_reviewer',
                'risk_safety_reviewer',
                'analyst_read_only'
            )
        ),
    CONSTRAINT "admin_role_assignment_reason_check"
        CHECK ("reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
    CONSTRAINT "admin_role_assignment_ticket_check"
        CHECK (
            "ticket_reference" IS NULL
            OR "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
        ),
    CONSTRAINT "admin_role_assignment_lifecycle_check"
        CHECK ("expires_at" IS NULL OR "expires_at" > "created_at"),
    CONSTRAINT "admin_role_assignment_bootstrap_check"
        CHECK (
            ("granted_by_user_id" IS NULL AND "role" = 'owner')
            OR "granted_by_user_id" IS NOT NULL
        )
);

CREATE INDEX "admin_role_assignment_user_role_idx"
    ON "admin_role_assignment" ("user_id", "role", "created_at" DESC, "id" DESC);
CREATE INDEX "admin_role_assignment_active_idx"
    ON "admin_role_assignment" ("role", "expires_at", "created_at" DESC, "id" DESC);
CREATE UNIQUE INDEX "admin_role_assignment_single_bootstrap_idx"
    ON "admin_role_assignment" (("granted_by_user_id" IS NULL))
    WHERE "granted_by_user_id" IS NULL;

CREATE TABLE "admin_role_revocation" (
    "assignment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "revoked_by_user_id" UUID NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "ticket_reference" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_revocation_pkey" PRIMARY KEY ("assignment_id"),
    CONSTRAINT "admin_role_revocation_assignment_user_key"
        UNIQUE ("assignment_id", "user_id"),
    CONSTRAINT "admin_role_revocation_assignment_user_fkey"
        FOREIGN KEY ("assignment_id", "user_id")
        REFERENCES "admin_role_assignment" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_role_revocation_revoker_fkey" FOREIGN KEY ("revoked_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_role_revocation_reason_check"
        CHECK ("reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
    CONSTRAINT "admin_role_revocation_ticket_check"
        CHECK (
            "ticket_reference" IS NULL
            OR "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
        )
);

CREATE INDEX "admin_role_revocation_user_created_idx"
    ON "admin_role_revocation" ("user_id", "created_at" DESC, "assignment_id" DESC);

CREATE TABLE "admin_mfa_assertion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_session_id" UUID NOT NULL,
    "auth_identity_id" UUID NOT NULL,
    "passkey_credential_id" UUID NOT NULL,
    "challenge_hash" BYTEA NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_mfa_assertion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_mfa_assertion_user_fkey" FOREIGN KEY ("user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_mfa_assertion_session_user_identity_fkey"
        FOREIGN KEY ("account_session_id", "user_id", "auth_identity_id")
        REFERENCES "account_session" ("id", "user_id", "auth_identity_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_mfa_assertion_passkey_identity_fkey"
        FOREIGN KEY ("passkey_credential_id", "auth_identity_id")
        REFERENCES "passkey_credential" ("id", "auth_identity_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_mfa_assertion_challenge_key" UNIQUE ("challenge_hash"),
    CONSTRAINT "admin_mfa_assertion_challenge_check"
        CHECK (octet_length("challenge_hash") = 32),
    CONSTRAINT "admin_mfa_assertion_lifecycle_check"
        CHECK ("verified_at" <= "expires_at" AND "expires_at" > "verified_at")
);

CREATE INDEX "admin_mfa_assertion_session_verified_idx"
    ON "admin_mfa_assertion" ("account_session_id", "verified_at" DESC, "id" DESC);
CREATE INDEX "admin_mfa_assertion_expiry_idx"
    ON "admin_mfa_assertion" ("expires_at", "id");

CREATE TABLE "admin_audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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

    CONSTRAINT "admin_audit_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_audit_event_actor_user_fkey" FOREIGN KEY ("actor_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_audit_event_actor_session_user_fkey"
        FOREIGN KEY ("actor_session_id", "actor_user_id")
        REFERENCES "account_session" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "admin_audit_event_hash_key" UNIQUE ("event_hash"),
    CONSTRAINT "admin_audit_event_request_key" UNIQUE ("request_id"),
    CONSTRAINT "admin_audit_event_role_check"
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
    CONSTRAINT "admin_audit_event_action_check"
        CHECK (
            "action" IN (
                'admin.role.assign',
                'admin.role.revoke',
                'admin.audit.read'
            )
        ),
    CONSTRAINT "admin_audit_event_outcome_check"
        CHECK ("outcome" IN ('completed', 'denied')),
    CONSTRAINT "admin_audit_event_identifier_check"
        CHECK (
            "target_type" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND octet_length("target_id") BETWEEN 1 AND 128
            AND "reason_code" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'
            AND (
                "ticket_reference" IS NULL
                OR "ticket_reference" ~ '^[A-Z][A-Z0-9_-]{2,63}$'
            )
        ),
    CONSTRAINT "admin_audit_event_fields_check"
        CHECK (
            cardinality("change_fields") BETWEEN 0 AND 16
            AND "change_fields" <@ ARRAY['role', 'expires_at']::TEXT[]
        ),
    CONSTRAINT "admin_audit_event_digest_check"
        CHECK (
            ("before_digest" IS NULL OR octet_length("before_digest") = 32)
            AND ("after_digest" IS NULL OR octet_length("after_digest") = 32)
            AND ("previous_event_hash" IS NULL OR octet_length("previous_event_hash") = 32)
            AND octet_length("event_hash") = 32
        )
);

CREATE INDEX "admin_audit_event_chain_idx"
    ON "admin_audit_event" ("created_at", "id");
CREATE INDEX "admin_audit_event_actor_idx"
    ON "admin_audit_event" ("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "admin_audit_event_target_idx"
    ON "admin_audit_event" ("target_type", "target_id", "created_at" DESC, "id" DESC);
CREATE UNIQUE INDEX "admin_audit_event_previous_hash_key"
    ON "admin_audit_event" ("previous_event_hash")
    WHERE "previous_event_hash" IS NOT NULL;
CREATE UNIQUE INDEX "admin_audit_event_single_genesis_idx"
    ON "admin_audit_event" (("previous_event_hash" IS NULL))
    WHERE "previous_event_hash" IS NULL;

COMMIT;
