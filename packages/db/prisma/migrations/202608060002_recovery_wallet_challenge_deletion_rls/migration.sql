-- Recovery Item 9: keep fully tombstoned wallet challenges visible to the deletion role.
BEGIN;

DROP POLICY "wallet_auth_challenge_privacy_deletion" ON "wallet_auth_challenge";
CREATE POLICY "wallet_auth_challenge_privacy_deletion"
    ON "wallet_auth_challenge"
    TO "rituvia_privacy_deletion"
    USING (
        "requested_by_user_id" IN (
            SELECT "user_id" FROM "privacy_deletion_authorized_user"
        )
        OR EXISTS (
            SELECT 1
              FROM "wallet_identity"
             WHERE "wallet_identity"."address" = "wallet_auth_challenge"."address"
               AND "wallet_identity"."user_id" IN (
                   SELECT "user_id" FROM "privacy_deletion_authorized_user"
               )
        )
        OR "message" = 'Private wallet challenge deleted.'
    )
    WITH CHECK (
        "requested_by_user_id" IN (
            SELECT "user_id" FROM "privacy_deletion_authorized_user"
        )
        OR "message" = 'Private wallet challenge deleted.'
    );

COMMIT;
