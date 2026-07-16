-- RIT-003 is expand-only: this operational table contains no user or personal data.
BEGIN;

CREATE TABLE "seed_manifest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dataset_key" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "is_synthetic" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seed_manifest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "seed_manifest_dataset_key_check"
        CHECK ("dataset_key" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT "seed_manifest_version_check" CHECK ("version" > 0),
    CONSTRAINT "seed_manifest_checksum_sha256_check"
        CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "seed_manifest_is_synthetic_check" CHECK ("is_synthetic" IS TRUE)
);

CREATE UNIQUE INDEX "seed_manifest_dataset_key_version_key"
    ON "seed_manifest"("dataset_key", "version");

COMMIT;
