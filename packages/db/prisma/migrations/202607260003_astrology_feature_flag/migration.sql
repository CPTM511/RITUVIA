-- RIT-093 registers the canonical persisted astrology kill switch without enabling it.
BEGIN;

CREATE POLICY "feature_flag_version_astrology_append"
ON "feature_flag_version"
FOR INSERT
TO "rituvia_feature_flag_writer"
WITH CHECK (
  "registry_version" = 1
  AND "flag_key" = 'experience.astrology'
  AND "approval_reference" LIKE 'OWN-015:%'
  AND cardinality("country_codes") = 0
  AND cardinality("locale_tags") = 0
);

COMMIT;
