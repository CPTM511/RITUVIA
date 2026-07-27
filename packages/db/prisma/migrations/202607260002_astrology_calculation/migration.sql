-- RIT-093 adds immutable, owner-scoped encrypted astrology calculations and replay evidence.
BEGIN;

ALTER TABLE "privacy_deletion_completion"
ADD COLUMN "astrology_calculation_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "privacy_deletion_completion"
ADD CONSTRAINT "privacy_deletion_completion_astrology_calculation_count_check"
CHECK ("astrology_calculation_count" >= 0);

CREATE TABLE "astrology_calculation" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "birth_profile_id" UUID NOT NULL,
  "birth_profile_revision" INTEGER NOT NULL,
  "birth_profile_payload_digest" BYTEA NOT NULL,
  "status" VARCHAR(48) NOT NULL,
  "time_certainty" VARCHAR(16) NOT NULL,
  "method_version" VARCHAR(100) NOT NULL,
  "aspect_policy_version" VARCHAR(100) NOT NULL,
  "method_catalog_digest" BYTEA NOT NULL,
  "input_snapshot_digest" BYTEA NOT NULL,
  "timezone_provenance_digest" BYTEA NOT NULL,
  "engine_provenance_version" VARCHAR(100) NOT NULL,
  "engine_build_provenance" JSONB NOT NULL,
  "facts_ciphertext" BYTEA NOT NULL,
  "facts_nonce" BYTEA NOT NULL,
  "facts_tag" BYTEA NOT NULL,
  "encryption_key_version" VARCHAR(100) NOT NULL,
  "digest_key_version" VARCHAR(100) NOT NULL,
  "keyed_facts_digest" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "privacy_deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "astrology_calculation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "astrology_calculation_birth_profile_revision_check"
    CHECK ("birth_profile_revision" >= 1),
  CONSTRAINT "astrology_calculation_birth_profile_payload_digest_check"
    CHECK (octet_length("birth_profile_payload_digest") = 32),
  CONSTRAINT "astrology_calculation_status_check"
    CHECK (
      "status" IN (
        'complete',
        'limited_approximate_time',
        'unavailable_engine',
        'unavailable_unknown_time',
        'unavailable_untrusted_engine_output'
      )
    ),
  CONSTRAINT "astrology_calculation_time_certainty_check"
    CHECK ("time_certainty" IN ('exact', 'approximate', 'unknown')),
  CONSTRAINT "astrology_calculation_status_time_certainty_check"
    CHECK (
      ("status" = 'complete' AND "time_certainty" = 'exact')
      OR ("status" = 'limited_approximate_time' AND "time_certainty" = 'approximate')
      OR ("status" = 'unavailable_unknown_time' AND "time_certainty" = 'unknown')
      OR (
        "status" IN ('unavailable_engine', 'unavailable_untrusted_engine_output')
        AND "time_certainty" IN ('exact', 'approximate')
      )
    ),
  CONSTRAINT "astrology_calculation_method_version_check"
    CHECK ("method_version" ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  CONSTRAINT "astrology_calculation_aspect_policy_version_check"
    CHECK ("aspect_policy_version" ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  CONSTRAINT "astrology_calculation_method_catalog_digest_check"
    CHECK (octet_length("method_catalog_digest") = 32),
  CONSTRAINT "astrology_calculation_input_snapshot_digest_check"
    CHECK (octet_length("input_snapshot_digest") = 32),
  CONSTRAINT "astrology_calculation_timezone_provenance_digest_check"
    CHECK (octet_length("timezone_provenance_digest") = 32),
  CONSTRAINT "astrology_calculation_engine_provenance_version_check"
    CHECK ("engine_provenance_version" = 'astrology-engine-build-provenance.v1'),
  CONSTRAINT "astrology_calculation_engine_build_provenance_size_check"
    CHECK (
      jsonb_typeof("engine_build_provenance") = 'object'
      AND octet_length("engine_build_provenance"::text) BETWEEN 2 AND 4096
    ),
  CONSTRAINT "astrology_calculation_engine_build_provenance_fields_check"
    CHECK (
      "engine_build_provenance" ?& ARRAY[
        'abiVersion',
        'adapterVersion',
        'binarySha256',
        'compilerFlagsSha256',
        'compilerId',
        'dataInventorySha256',
        'libraryVersion',
        'nativeSbomSha256',
        'sourceCommit',
        'sourceInventorySha256',
        'sourceSnapshotTag'
      ]
      AND (
        "engine_build_provenance" - ARRAY[
          'abiVersion',
          'adapterVersion',
          'binarySha256',
          'compilerFlagsSha256',
          'compilerId',
          'dataInventorySha256',
          'libraryVersion',
          'nativeSbomSha256',
          'sourceCommit',
          'sourceInventorySha256',
          'sourceSnapshotTag'
        ]::text[]
      ) = '{}'::jsonb
      AND jsonb_typeof("engine_build_provenance" -> 'abiVersion') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'adapterVersion') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'binarySha256') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'compilerFlagsSha256') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'compilerId') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'dataInventorySha256') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'libraryVersion') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'nativeSbomSha256') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'sourceCommit') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'sourceInventorySha256') = 'string'
      AND jsonb_typeof("engine_build_provenance" -> 'sourceSnapshotTag') = 'string'
      AND length("engine_build_provenance" ->> 'abiVersion') BETWEEN 1 AND 100
      AND length("engine_build_provenance" ->> 'adapterVersion') BETWEEN 1 AND 100
      AND ("engine_build_provenance" ->> 'binarySha256') ~ '^sha256:[0-9a-f]{64}$'
      AND ("engine_build_provenance" ->> 'compilerFlagsSha256') ~ '^sha256:[0-9a-f]{64}$'
      AND length("engine_build_provenance" ->> 'compilerId') BETWEEN 1 AND 160
      AND ("engine_build_provenance" ->> 'dataInventorySha256') ~ '^sha256:[0-9a-f]{64}$'
      AND length("engine_build_provenance" ->> 'libraryVersion') BETWEEN 1 AND 100
      AND ("engine_build_provenance" ->> 'nativeSbomSha256') ~ '^sha256:[0-9a-f]{64}$'
      AND ("engine_build_provenance" ->> 'sourceCommit') ~ '^[0-9a-f]{40,64}$'
      AND ("engine_build_provenance" ->> 'sourceInventorySha256') ~ '^sha256:[0-9a-f]{64}$'
      AND length("engine_build_provenance" ->> 'sourceSnapshotTag') BETWEEN 1 AND 100
    ),
  CONSTRAINT "astrology_calculation_facts_ciphertext_check"
    CHECK (octet_length("facts_ciphertext") BETWEEN 1 AND 262144),
  CONSTRAINT "astrology_calculation_facts_nonce_check"
    CHECK (octet_length("facts_nonce") = 12),
  CONSTRAINT "astrology_calculation_facts_tag_check"
    CHECK (octet_length("facts_tag") = 16),
  CONSTRAINT "astrology_calculation_encryption_key_version_check"
    CHECK ("encryption_key_version" ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  CONSTRAINT "astrology_calculation_digest_key_version_check"
    CHECK ("digest_key_version" ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  CONSTRAINT "astrology_calculation_keyed_facts_digest_check"
    CHECK (octet_length("keyed_facts_digest") = 32),
  CONSTRAINT "astrology_calculation_privacy_deleted_at_check"
    CHECK ("privacy_deleted_at" IS NULL OR "privacy_deleted_at" >= "created_at"),
  CONSTRAINT "astrology_calculation_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "astrology_calculation_birth_profile_fkey"
    FOREIGN KEY ("birth_profile_id", "user_id")
    REFERENCES "birth_profile"("id", "user_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "astrology_calculation_user_identity_key"
ON "astrology_calculation"("id", "user_id");

CREATE INDEX "astrology_calculation_user_active_created_idx"
ON "astrology_calculation"("user_id", "privacy_deleted_at", "created_at" DESC, "id" DESC);

CREATE INDEX "astrology_calculation_profile_created_idx"
ON "astrology_calculation"(
  "birth_profile_id",
  "user_id",
  "birth_profile_revision",
  "created_at" DESC,
  "id" DESC
);

CREATE TABLE "astrology_calculation_operation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "astrology_calculation_id" UUID NOT NULL,
  "action" VARCHAR(16) NOT NULL,
  "idempotency_key_digest" BYTEA NOT NULL,
  "canonical_request_digest" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "astrology_calculation_operation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "astrology_calculation_operation_action_check"
    CHECK ("action" = 'create'),
  CONSTRAINT "astrology_calculation_operation_idempotency_key_digest_check"
    CHECK (octet_length("idempotency_key_digest") = 32),
  CONSTRAINT "astrology_calculation_operation_canonical_request_digest_check"
    CHECK (octet_length("canonical_request_digest") = 32),
  CONSTRAINT "astrology_calculation_operation_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "astrology_calculation_operation_calculation_fkey"
    FOREIGN KEY ("astrology_calculation_id", "user_id")
    REFERENCES "astrology_calculation"("id", "user_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "astrology_calculation_operation_user_idempotency_key"
ON "astrology_calculation_operation"("user_id", "idempotency_key_digest");

CREATE UNIQUE INDEX "astrology_calculation_operation_calculation_key"
ON "astrology_calculation_operation"("astrology_calculation_id", "user_id");

ALTER TABLE "astrology_calculation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "astrology_calculation_existing_roles"
ON "astrology_calculation"
TO PUBLIC
USING (CURRENT_USER <> 'rituvia_privacy_deletion')
WITH CHECK (
  CURRENT_USER <> 'rituvia_privacy_deletion'
  AND EXISTS (
    SELECT 1
      FROM "birth_profile" AS profile
     WHERE profile."id" = "birth_profile_id"
       AND profile."user_id" = "user_id"
       AND profile."revision" = "birth_profile_revision"
       AND profile."canonical_payload_digest" = "birth_profile_payload_digest"
       AND profile."time_certainty" = "time_certainty"
       AND profile."deleted_at" IS NULL
  )
);

CREATE POLICY "astrology_calculation_privacy_deletion"
ON "astrology_calculation"
TO "rituvia_privacy_deletion"
USING (
  "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
)
WITH CHECK (
  "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
);

ALTER TABLE "privacy_deletion_completion"
ALTER COLUMN "astrology_calculation_count" DROP DEFAULT;

COMMIT;
