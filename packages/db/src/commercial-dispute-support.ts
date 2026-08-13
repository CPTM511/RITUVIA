import type { PrismaClient } from "./generated/prisma/client.js";

import { assertCommercialFulfillmentRuntimeDatabasePrivileges } from "./commercial-fulfillment-persistence.js";

export class CommercialDisputeSupportPersistenceError extends Error {
  constructor() {
    super("The commercial dispute support projection is unavailable.");
    this.name = "CommercialDisputeSupportPersistenceError";
  }
}

export type CommercialDisputeSupportPersistence = Readonly<{
  projectNextDisputeSupportCase(): Promise<"projected" | null>;
}>;

type PrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canInsertSupportProjection: boolean;
  canMutateSupportProjection: boolean;
  canMutatePaymentEvent: boolean;
  canReadSupportProjection: boolean;
  canReadPaymentEvent: boolean;
  hasExactSupportProjectionInsertColumns: boolean;
  hasExactSupportProjectionSelectColumns: boolean;
  hasExactPaymentEventSelectColumns: boolean;
  privilegedRole: boolean;
  roleName: string;
}>;

const privilegeAttestations = new WeakMap<PrismaClient, Promise<void>>();

const assertCommercialDisputeSupportRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const existing = privilegeAttestations.get(database);
  if (existing !== undefined) return existing;
  const attestation = (async () => {
    await assertCommercialFulfillmentRuntimeDatabasePrivileges(database);
    const rows = await database.$queryRaw<readonly PrivilegeRow[]>`
      SELECT
        rolname AS "roleName",
        rolsuper OR rolcreaterole OR rolreplication OR rolbypassrls AS "privilegedRole",
        has_database_privilege(current_user, current_database(), 'CREATE')
          AS "canCreateInDatabase",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
        has_any_column_privilege(
          current_user, 'public.commercial_payment_event_v2', 'SELECT'
        ) AS "canReadPaymentEvent",
        NOT EXISTS (
          SELECT 1
          FROM pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.commercial_payment_event_v2'::regclass
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND has_column_privilege(
              current_user, attribute.attrelid, attribute.attname, 'SELECT'
            ) IS DISTINCT FROM (
              attribute.attname = ANY(ARRAY[
                'id', 'event_type', 'evidence_source', 'validation_state',
                'processing_state', 'processing_disposition', 'order_id',
                'payment_attempt_id'
              ])
            )
        ) AS "hasExactPaymentEventSelectColumns",
        has_table_privilege(
          current_user, 'public.commercial_payment_event_v2',
          'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
        ) OR has_any_column_privilege(
          current_user, 'public.commercial_payment_event_v2', 'INSERT,UPDATE,REFERENCES'
        ) AS "canMutatePaymentEvent",
        has_any_column_privilege(
          current_user, 'public.commercial_dispute_support_projection_v1', 'SELECT'
        ) AS "canReadSupportProjection",
        NOT EXISTS (
          SELECT 1
          FROM pg_attribute AS attribute
          WHERE attribute.attrelid =
                  'public.commercial_dispute_support_projection_v1'::regclass
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND has_column_privilege(
              current_user, attribute.attrelid, attribute.attname, 'SELECT'
            ) IS DISTINCT FROM (
              attribute.attname = 'commercial_payment_event_id'
            )
        ) AS "hasExactSupportProjectionSelectColumns",
        has_any_column_privilege(
          current_user, 'public.commercial_dispute_support_projection_v1', 'INSERT'
        ) AS "canInsertSupportProjection",
        NOT EXISTS (
          SELECT 1
          FROM pg_attribute AS attribute
          WHERE attribute.attrelid =
                  'public.commercial_dispute_support_projection_v1'::regclass
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND has_column_privilege(
              current_user, attribute.attrelid, attribute.attname, 'INSERT'
            ) IS DISTINCT FROM (
              attribute.attname = ANY(ARRAY[
                'commercial_payment_event_id', 'queue_kind',
                'category_code', 'priority', 'policy_version', 'draft_template_code',
                'draft_template_version', 'draft_locale', 'opened_at',
                'first_response_due_at', 'resolution_due_at'
              ])
            )
        ) AS "hasExactSupportProjectionInsertColumns",
        has_table_privilege(
          current_user, 'public.commercial_dispute_support_projection_v1',
          'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
        ) OR has_any_column_privilege(
          current_user, 'public.commercial_dispute_support_projection_v1',
          'UPDATE,REFERENCES'
        ) AS "canMutateSupportProjection"
      FROM pg_roles
      WHERE rolname = current_user
    `;
    const privilege = rows.at(0);
    if (
      rows.length !== 1 ||
      privilege === undefined ||
      privilege.roleName !== "rituvia_payment_fulfillment" ||
      privilege.privilegedRole ||
      privilege.canCreateInDatabase ||
      privilege.canCreateInSchema ||
      !privilege.canReadPaymentEvent ||
      !privilege.hasExactPaymentEventSelectColumns ||
      privilege.canMutatePaymentEvent ||
      !privilege.canReadSupportProjection ||
      !privilege.hasExactSupportProjectionSelectColumns ||
      !privilege.canInsertSupportProjection ||
      !privilege.hasExactSupportProjectionInsertColumns ||
      privilege.canMutateSupportProjection
    ) {
      throw new CommercialDisputeSupportPersistenceError();
    }
  })().catch((error: unknown) => {
    privilegeAttestations.delete(database);
    if (error instanceof CommercialDisputeSupportPersistenceError) throw error;
    throw new CommercialDisputeSupportPersistenceError();
  });
  privilegeAttestations.set(database, attestation);
  return attestation;
};

export const createCommercialDisputeSupportPersistence = (
  database: PrismaClient,
): CommercialDisputeSupportPersistence =>
  Object.freeze({
    async projectNextDisputeSupportCase() {
      try {
        await assertCommercialDisputeSupportRuntimeDatabasePrivileges(database);
        const inserted = await database.$executeRaw`
          INSERT INTO commercial_dispute_support_projection_v1 (
            commercial_payment_event_id, queue_kind, category_code, priority,
            policy_version, draft_template_code,
            draft_template_version, draft_locale, opened_at,
            first_response_due_at, resolution_due_at
          )
          SELECT
            event.id, 'support', 'payment_dispute', 'high',
            'protected-beta-operations.local.en.v1',
            'support_dispute_ack', 'operational-case-draft.en.v1', 'en',
            date_trunc('milliseconds', fulfillment.updated_at),
            date_trunc('milliseconds', fulfillment.updated_at) + INTERVAL '4 hours',
            date_trunc('milliseconds', fulfillment.updated_at) + INTERVAL '24 hours'
          FROM commercial_payment_event_v2 AS event
          JOIN commercial_payment_outbox_v2 AS outbox
            ON outbox.payment_event_id = event.id
          JOIN commercial_order_v2 AS orders
            ON orders.id = outbox.order_id
          JOIN commercial_fulfillment_v2 AS fulfillment
            ON fulfillment.order_id = orders.id
          LEFT JOIN commercial_dispute_support_projection_v1 AS existing
            ON existing.commercial_payment_event_id = event.id
          WHERE event.event_type = 'payment_disputed'
            AND event.evidence_source = 'signed_webhook'
            AND event.validation_state = 'matched'
            AND event.processing_state = 'processed'
            AND event.processing_disposition = 'applied'
            AND event.order_id = orders.id
            AND event.payment_attempt_id = outbox.payment_attempt_id
            AND outbox.topic = 'commercial.payment_state_changed'
            AND outbox.schema_version = 'commercial-payment-state-outbox.v1'
            AND outbox.order_status = 'disputed'
            AND outbox.delivery_state = 'completed'
            AND orders.status = 'disputed'
            AND orders.payment_state_version = outbox.payment_state_version
            AND fulfillment.fulfillment_kind = 'credit_pack'
            AND fulfillment.status IN ('disputed', 'review_required')
            AND fulfillment.applied_payment_state_version = outbox.payment_state_version
            AND existing.commercial_payment_event_id IS NULL
          ORDER BY fulfillment.updated_at, event.id
          LIMIT 1
          ON CONFLICT (commercial_payment_event_id) DO NOTHING
        `;
        if (inserted === 0) return null;
        if (inserted === 1) return "projected";
        throw new CommercialDisputeSupportPersistenceError();
      } catch (error) {
        if (error instanceof CommercialDisputeSupportPersistenceError) throw error;
        throw new CommercialDisputeSupportPersistenceError();
      }
    },
  });
