-- RIT-016 advances the active registry to v3 after the verified compatibility window.
BEGIN;

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
        "registry_version" IN (1, 2)
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
        "registry_version" = 3
        AND "flag_key" IN (
          'content.regional_tradition',
          'experience.astrology',
          'market.country_activation',
          'payments.crypto_checkout',
          'payments.fiat_checkout'
        )
      )
    )
  )
  OR (
    "registry_version" = 3
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
