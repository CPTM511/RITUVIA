-- RIT-016 opens the registry v2 compatibility window with public_shell retired safe-off.
BEGIN;

DROP POLICY "feature_flag_version_astrology_append" ON "feature_flag_version";
DROP POLICY "feature_flag_version_append" ON "feature_flag_version";

CREATE POLICY "feature_flag_version_append"
ON "feature_flag_version"
FOR INSERT
TO "rituvia_feature_flag_writer"
WITH CHECK (
  (
    "state" = 'off'
    AND (
      (
        "registry_version" = 1
        AND "flag_key" IN (
          'content.regional_tradition',
          'experience.astrology',
          'experience.public_shell',
          'market.country_activation',
          'payments.crypto_checkout',
          'payments.fiat_checkout'
        )
      )
      OR (
        "registry_version" = 2
        AND "flag_key" IN (
          'content.regional_tradition',
          'experience.astrology',
          'experience.public_shell',
          'market.country_activation',
          'payments.crypto_checkout',
          'payments.fiat_checkout'
        )
      )
    )
  )
  OR (
    "registry_version" = 2
    AND "state" = 'on'
    AND (
      (
        "flag_key" = 'experience.astrology'
        AND "approval_reference" LIKE 'OWN-015:%'
        AND cardinality("country_codes") = 0
        AND cardinality("locale_tags") = 0
      )
      OR (
        "flag_key" = 'market.country_activation'
        AND "approval_reference" LIKE 'OWN-004:%'
        AND cardinality("country_codes") > 0
        AND cardinality("locale_tags") = 0
      )
      OR (
        "flag_key" = 'payments.crypto_checkout'
        AND "approval_reference" LIKE 'OWN-006:%'
        AND cardinality("country_codes") > 0
        AND cardinality("locale_tags") = 0
      )
      OR (
        "flag_key" = 'payments.fiat_checkout'
        AND "approval_reference" LIKE 'OWN-002:%'
        AND cardinality("country_codes") > 0
        AND cardinality("locale_tags") = 0
      )
      OR (
        "flag_key" = 'content.regional_tradition'
        AND "approval_reference" LIKE 'OWN-007:%'
        AND cardinality("country_codes") > 0
        AND cardinality("locale_tags") > 0
      )
    )
  )
);

COMMIT;
