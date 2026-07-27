-- RIT-057 scopes the privacy-deletion runtime to the account session presented by the request.
BEGIN;

CREATE VIEW "privacy_deletion_authorized_user"
WITH (security_barrier = true)
AS
    WITH presented_token AS (
        SELECT decode(
            current_setting('rituvia.privacy_deletion_token_hash'),
            'hex'
        ) AS token_hash
    )
    SELECT "account_session"."user_id"
      FROM "public"."account_session"
      JOIN "public"."app_user"
        ON "app_user"."id" = "account_session"."user_id"
      CROSS JOIN presented_token
     WHERE "account_session"."token_hash" = presented_token.token_hash
       AND "account_session"."token_hash_version" = 1
       AND "account_session"."revoked_at" IS NULL
       AND "account_session"."expires_at" > CURRENT_TIMESTAMP
       AND "app_user"."status" = 'active'
    UNION
    SELECT "privacy_deletion_request"."user_id"
      FROM "public"."privacy_deletion_request"
      CROSS JOIN presented_token
     WHERE "privacy_deletion_request"."replay_session_token_hash" =
           presented_token.token_hash;

ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_user_existing_roles"
    ON "app_user"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "app_user_privacy_deletion"
    ON "app_user"
    TO "rituvia_privacy_deletion"
    USING (
        "id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "account_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_session_existing_roles"
    ON "account_session"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "account_session_privacy_deletion"
    ON "account_session"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "account_subject_link" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_subject_link_existing_roles"
    ON "account_subject_link"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "account_subject_link_privacy_deletion"
    ON "account_subject_link"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "anonymous_session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anonymous_session_existing_roles"
    ON "anonymous_session"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "anonymous_session_privacy_deletion"
    ON "anonymous_session"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "anonymous_session"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "anonymous_session"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "intention" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intention_existing_roles"
    ON "intention"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "intention_privacy_deletion"
    ON "intention"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "intention"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "intention"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "journal_entry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_entry_existing_roles"
    ON "journal_entry"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "journal_entry_privacy_deletion"
    ON "journal_entry"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "journal_entry"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "journal_entry"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "private_journal_entry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private_journal_entry_existing_roles"
    ON "private_journal_entry"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "private_journal_entry_privacy_deletion"
    ON "private_journal_entry"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "private_journal_entry"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "private_journal_entry"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "revisit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revisit_existing_roles"
    ON "revisit"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "revisit_privacy_deletion"
    ON "revisit"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "revisit"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "revisit"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

DROP POLICY "interpretation_privacy_deletion_read" ON "interpretation";
DROP POLICY "interpretation_privacy_deletion" ON "interpretation";
CREATE POLICY "interpretation_privacy_deletion_read"
    ON "interpretation"
    FOR SELECT
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "interpretation"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );
CREATE POLICY "interpretation_privacy_deletion"
    ON "interpretation"
    FOR UPDATE
    TO "rituvia_privacy_deletion"
    USING (
        "fallback_output" IS NOT NULL
        AND EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "interpretation"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        "status" = 'fallback'
        AND "fallback_output" IS NOT NULL
        AND "finalization_hash" IS NOT NULL
        AND EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "interpretation"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

DROP POLICY "interpretation_verification_privacy_deletion_read"
    ON "interpretation_verification";
DROP POLICY "interpretation_verification_privacy_deletion"
    ON "interpretation_verification";
CREATE POLICY "interpretation_verification_privacy_deletion_read"
    ON "interpretation_verification"
    FOR SELECT
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "interpretation_verification"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );
CREATE POLICY "interpretation_verification_privacy_deletion"
    ON "interpretation_verification"
    FOR UPDATE
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "interpretation_verification"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        "output" IS NOT NULL
        AND "candidate_digest" IS NOT NULL
        AND "output_digest" IS NOT NULL
        AND "finalization_digest" IS NOT NULL
        AND EXISTS (
            SELECT 1
              FROM "account_subject_link"
             WHERE "account_subject_link"."anonymous_subject_id" =
                   "interpretation_verification"."anonymous_subject_id"
               AND "account_subject_link"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "privacy_export" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privacy_export_existing_roles"
    ON "privacy_export"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "privacy_export_privacy_deletion"
    ON "privacy_export"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "privacy_export_artifact" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privacy_export_artifact_existing_roles"
    ON "privacy_export_artifact"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "privacy_export_artifact_privacy_deletion"
    ON "privacy_export_artifact"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "auth_identity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_identity_existing_roles"
    ON "auth_identity"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "auth_identity_privacy_deletion"
    ON "auth_identity"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "commerce_order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commerce_order_existing_roles"
    ON "commerce_order"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "commerce_order_privacy_deletion"
    ON "commerce_order"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "payment_attempt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_attempt_existing_roles"
    ON "payment_attempt"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "payment_attempt_privacy_deletion"
    ON "payment_attempt"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "commerce_order"
             WHERE "commerce_order"."id" = "payment_attempt"."order_id"
               AND "commerce_order"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "commerce_order"
             WHERE "commerce_order"."id" = "payment_attempt"."order_id"
               AND "commerce_order"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "auth_challenge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_challenge_existing_roles"
    ON "auth_challenge"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "auth_challenge_privacy_deletion"
    ON "auth_challenge"
    TO "rituvia_privacy_deletion"
    USING (
        (
            octet_length("provider_subject") = 50
            AND "provider_subject" ~ '^deleted[.]challenge[.][0-9a-f]+$'
        )
        OR EXISTS (
              SELECT 1
                FROM "auth_identity"
               WHERE "auth_identity"."provider_key" = "auth_challenge"."provider_key"
                 AND "auth_identity"."provider_subject" =
                     "auth_challenge"."provider_subject"
                 AND "auth_identity"."user_id" IN (
                     SELECT "user_id" FROM "privacy_deletion_authorized_user"
                 )
        )
    )
    WITH CHECK (
        octet_length("provider_subject") = 50
        AND "provider_subject" ~ '^deleted[.]challenge[.][0-9a-f]+$'
    );

ALTER TABLE "passkey_credential" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "passkey_credential_existing_roles"
    ON "passkey_credential"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "passkey_credential_privacy_deletion"
    ON "passkey_credential"
    TO "rituvia_privacy_deletion"
    USING (
        EXISTS (
            SELECT 1
              FROM "auth_identity"
             WHERE "auth_identity"."id" =
                   "passkey_credential"."auth_identity_id"
               AND "auth_identity"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
              FROM "auth_identity"
             WHERE "auth_identity"."id" =
                   "passkey_credential"."auth_identity_id"
               AND "auth_identity"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
    );

ALTER TABLE "privacy_deletion_request" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privacy_deletion_request_existing_roles"
    ON "privacy_deletion_request"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "privacy_deletion_request_privacy_deletion"
    ON "privacy_deletion_request"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "privacy_deletion_completion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privacy_deletion_completion_existing_roles"
    ON "privacy_deletion_completion"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "privacy_deletion_completion_privacy_deletion"
    ON "privacy_deletion_completion"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

ALTER TABLE "auth_identity_suppression" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_identity_suppression_existing_roles"
    ON "auth_identity_suppression"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');
CREATE POLICY "auth_identity_suppression_privacy_deletion"
    ON "auth_identity_suppression"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

COMMIT;
