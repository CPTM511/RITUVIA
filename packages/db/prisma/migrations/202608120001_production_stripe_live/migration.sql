-- D-099 permits Stripe Live only when production policy, provider, and runtime mode agree.
BEGIN;

DROP POLICY "country_policy_version_append" ON "country_policy_version";
CREATE POLICY "country_policy_version_append"
    ON "country_policy_version"
    FOR INSERT
    TO "rituvia_country_policy_writer"
    WITH CHECK (
        ("environment" = 'local' AND "approval_mode" = 'local_test')
        OR (
            "approval_mode" = 'written'
            AND (
                "status" <> 'paid'
                OR (
                    ("policy_document" #>> '{fiat,enabled}')::boolean = false
                    OR "policy_document" #>> '{evidence,fiatApprovalReference}' LIKE 'OWN-002:%'
                    OR (
                        "environment" = 'staging'
                        AND "policy_document" #>> '{evidence,fiatApprovalReference}'
                            LIKE 'D-098:OWN-017:stripe-test:%'
                    )
                    OR (
                        "environment" = 'production'
                        AND "policy_document" #>> '{evidence,fiatApprovalReference}'
                            LIKE 'D-099:stripe-live:%'
                    )
                )
                AND (
                    ("policy_document" #>> '{crypto,enabled}')::boolean = false
                    OR "policy_document" #>> '{evidence,cryptoApprovalReference}' LIKE 'OWN-006:%'
                )
            )
        )
    );

ALTER TABLE "commercial_subscription_v2"
    DROP CONSTRAINT "commercial_subscription_v2_identity_check";
ALTER TABLE "commercial_subscription_v2"
    ADD CONSTRAINT "commercial_subscription_v2_identity_check" CHECK (
        "provider" = 'stripe'
        AND "environment" IN ('sandbox', 'live')
        AND octet_length("provider_subscription_id") BETWEEN 1 AND 255
        AND "billing_interval" IN ('month', 'year')
        AND "credits_per_month" BETWEEN 1 AND 2147483647
    );

COMMIT;
