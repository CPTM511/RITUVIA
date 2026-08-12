-- Recovery Item 9 restricts reminder cancellation to the authenticated privacy-deletion subject.
BEGIN;

ALTER TABLE "revisit_reminder_subscription" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revisit_reminder_subscription_existing_roles"
    ON "revisit_reminder_subscription"
    TO PUBLIC
    USING (CURRENT_USER <> 'rituvia_privacy_deletion')
    WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

CREATE POLICY "revisit_reminder_subscription_privacy_deletion"
    ON "revisit_reminder_subscription"
    TO "rituvia_privacy_deletion"
    USING (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    )
    WITH CHECK (
        "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
    );

COMMIT;
