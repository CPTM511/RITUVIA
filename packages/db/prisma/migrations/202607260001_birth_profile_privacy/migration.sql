-- RIT-092 adds encrypted, owner-scoped birth profiles and extends privacy deletion evidence.
BEGIN;

ALTER TABLE "privacy_deletion_completion"
ADD COLUMN "birth_profile_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "privacy_deletion_completion"
ADD CONSTRAINT "privacy_deletion_completion_birth_profile_count_check"
CHECK ("birth_profile_count" >= 0);

CREATE TABLE "birth_profile" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "time_certainty" VARCHAR(16) NOT NULL,
  "schema_version" VARCHAR(100) NOT NULL,
  "payload_ciphertext" BYTEA NOT NULL,
  "payload_nonce" BYTEA NOT NULL,
  "payload_tag" BYTEA NOT NULL,
  "encryption_key_version" VARCHAR(100) NOT NULL,
  "digest_key_version" VARCHAR(100) NOT NULL,
  "canonical_payload_digest" BYTEA NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "birth_profile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "birth_profile_time_certainty_check"
    CHECK ("time_certainty" IN ('exact', 'approximate', 'unknown')),
  CONSTRAINT "birth_profile_schema_version_check"
    CHECK ("schema_version" = 'birth-profile.v1'),
  CONSTRAINT "birth_profile_payload_ciphertext_check"
    CHECK (octet_length("payload_ciphertext") BETWEEN 1 AND 12000),
  CONSTRAINT "birth_profile_payload_nonce_check"
    CHECK (octet_length("payload_nonce") = 12),
  CONSTRAINT "birth_profile_payload_tag_check"
    CHECK (octet_length("payload_tag") = 16),
  CONSTRAINT "birth_profile_encryption_key_version_check"
    CHECK ("encryption_key_version" ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  CONSTRAINT "birth_profile_digest_key_version_check"
    CHECK ("digest_key_version" ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  CONSTRAINT "birth_profile_canonical_payload_digest_check"
    CHECK (octet_length("canonical_payload_digest") = 32),
  CONSTRAINT "birth_profile_revision_check"
    CHECK ("revision" >= 1),
  CONSTRAINT "birth_profile_timestamps_check"
    CHECK ("updated_at" >= "created_at" AND ("deleted_at" IS NULL OR "deleted_at" >= "created_at")),
  CONSTRAINT "birth_profile_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "birth_profile_user_identity_key"
ON "birth_profile"("id", "user_id");

CREATE INDEX "birth_profile_user_active_idx"
ON "birth_profile"("user_id", "deleted_at", "created_at" DESC, "id" DESC);

CREATE TABLE "birth_profile_operation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "birth_profile_id" UUID NOT NULL,
  "action" VARCHAR(16) NOT NULL,
  "idempotency_key_hash" BYTEA NOT NULL,
  "canonical_request_hash" BYTEA NOT NULL,
  "result_revision" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "birth_profile_operation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "birth_profile_operation_action_check"
    CHECK ("action" IN ('create', 'update', 'delete')),
  CONSTRAINT "birth_profile_operation_idempotency_key_hash_check"
    CHECK (octet_length("idempotency_key_hash") = 32),
  CONSTRAINT "birth_profile_operation_canonical_request_hash_check"
    CHECK (octet_length("canonical_request_hash") = 32),
  CONSTRAINT "birth_profile_operation_result_revision_check"
    CHECK ("result_revision" >= 1),
  CONSTRAINT "birth_profile_operation_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "birth_profile_operation_profile_fkey"
    FOREIGN KEY ("birth_profile_id", "user_id")
    REFERENCES "birth_profile"("id", "user_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "birth_profile_operation_user_idempotency_key"
ON "birth_profile_operation"("user_id", "idempotency_key_hash");

CREATE INDEX "birth_profile_operation_profile_created_idx"
ON "birth_profile_operation"("birth_profile_id", "user_id", "created_at", "id");

ALTER TABLE "birth_profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "birth_profile_existing_roles"
ON "birth_profile"
TO PUBLIC
USING (CURRENT_USER <> 'rituvia_privacy_deletion')
WITH CHECK (CURRENT_USER <> 'rituvia_privacy_deletion');

CREATE POLICY "birth_profile_privacy_deletion"
ON "birth_profile"
TO "rituvia_privacy_deletion"
USING (
  "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
)
WITH CHECK (
  "user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")
);

ALTER TABLE "privacy_deletion_completion"
ALTER COLUMN "birth_profile_count" DROP DEFAULT;

COMMIT;
