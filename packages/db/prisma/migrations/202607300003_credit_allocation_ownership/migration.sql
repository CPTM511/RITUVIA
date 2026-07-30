-- Bind every Credit allocation to one account across its reservation and source grant.
BEGIN;

ALTER TABLE "credit_reservation"
    ADD CONSTRAINT "credit_reservation_id_user_key" UNIQUE ("id", "user_id");

ALTER TABLE "credit_allocation"
    ADD COLUMN "user_id" UUID,
    ADD CONSTRAINT "credit_allocation_user_required_check"
        CHECK ("user_id" IS NOT NULL) NOT VALID,
    ADD CONSTRAINT "credit_allocation_reservation_user_fkey"
        FOREIGN KEY ("reservation_id", "user_id")
        REFERENCES "credit_reservation" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT
        NOT VALID,
    ADD CONSTRAINT "credit_allocation_source_user_fkey"
        FOREIGN KEY ("source_entry_id", "user_id")
        REFERENCES "credit_ledger_entry" ("id", "user_id")
        ON DELETE RESTRICT ON UPDATE RESTRICT
        NOT VALID;

COMMIT;
