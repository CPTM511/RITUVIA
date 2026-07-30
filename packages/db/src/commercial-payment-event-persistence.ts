import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const resourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/u;
const fingerprintPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const currencyPattern = /^[A-Z]{3}$/u;
const maximumMinorAmount = 2_147_483_647;
const maximumTimelineEvents = 100;

export const commercialPaymentEventPersistenceErrorCodes = Object.freeze([
  "COMMERCIAL_PAYMENT_EVENT_CONFLICT",
  "COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE",
] as const);
export type CommercialPaymentEventPersistenceErrorCode =
  (typeof commercialPaymentEventPersistenceErrorCodes)[number];

export class CommercialPaymentEventPersistenceError extends Error {
  readonly code: CommercialPaymentEventPersistenceErrorCode;

  constructor(code: CommercialPaymentEventPersistenceErrorCode) {
    super("The commercial payment event could not be processed.");
    this.name = "CommercialPaymentEventPersistenceError";
    this.code = code;
  }
}

export const commercialVerifiedPaymentEventTypes = Object.freeze([
  "payment_pending",
  "payment_succeeded",
  "payment_failed",
  "payment_expired",
  "payment_refunded",
  "payment_disputed",
] as const);
export type CommercialVerifiedPaymentEventType =
  (typeof commercialVerifiedPaymentEventTypes)[number];

export type PreparedCommercialPaymentEvent = Readonly<{
  amountMinor: number;
  currencyCode: string;
  evidenceSource: "reconciliation_api" | "signed_webhook";
  eventType: CommercialVerifiedPaymentEventType;
  normalizationVersion: string;
  occurredAt: string;
  orderId: string;
  payloadDigest: Uint8Array;
  providerAccountFingerprint: string;
  providerCheckoutId: string;
  providerEventId: string;
  providerObjectId: string;
  providerPaymentIntentId: string | null;
  receivedAt: string;
  signatureTimestampSeconds: number;
  verifierVersion: string;
}>;

export type CommercialPaymentTimelineRecord = Readonly<{
  eventId: string;
  eventType: CommercialVerifiedPaymentEventType;
  occurredAt: string;
  providerEventId: string;
}>;

export type ReducedCommercialPaymentState = Readonly<{
  attemptCompletedAt: string | null;
  attemptState:
    "cancelled" | "checkout_created" | "created" | "expired" | "failed" | "pending" | "succeeded";
  dispositions: readonly Readonly<{
    disposition: "applied" | "ignored_out_of_order";
    eventId: string;
  }>[];
  orderStatus:
    | "cancelled"
    | "checkout_created"
    | "created"
    | "disputed"
    | "expired"
    | "failed"
    | "paid"
    | "partially_refunded"
    | "pending"
    | "refund_requested"
    | "refunded";
  paidAt: string | null;
  refundedAt: string | null;
  refundedMinor: number;
  updatedAt: string | null;
}>;

export type CommercialPaymentEventReducer = (input: {
  events: readonly CommercialPaymentTimelineRecord[];
  totalMinor: number;
}) => ReducedCommercialPaymentState;

export type ProcessedCommercialPaymentEvent = Readonly<{
  disposition: "applied" | "duplicate" | "ignored_out_of_order" | "rejected_mismatch";
  kind: "duplicate" | "processed";
  orderStatus: ReducedCommercialPaymentState["orderStatus"] | null;
  outboxCreated: boolean;
  paymentAttemptState: ReducedCommercialPaymentState["attemptState"] | null;
}>;

export type CommercialPaymentEventPersistence = Readonly<{
  processStripeSandboxEvent(
    input: PreparedCommercialPaymentEvent,
    reduce: CommercialPaymentEventReducer,
  ): Promise<ProcessedCommercialPaymentEvent>;
}>;

type ExistingEventRow = Readonly<{
  amountMinor: number;
  claimedOrderPublicId: string;
  currencyCode: string;
  evidenceSource: string;
  eventType: string;
  id: string;
  normalizationVersion: string;
  payloadDigest: Uint8Array;
  processingDisposition: string | null;
  providerCheckoutId: string | null;
  providerEventId: string;
  providerObjectId: string;
  providerOccurredAt: Date;
  providerPaymentIntentId: string | null;
  signatureTimestampSeconds: bigint;
}>;

type LockedOrderAttemptRow = Readonly<{
  attemptCompletedAt: Date | null;
  attemptId: string;
  attemptState: ReducedCommercialPaymentState["attemptState"];
  checkoutId: string | null;
  currencyCode: string;
  orderCreatedAt: Date;
  orderId: string;
  orderPaidAt: Date | null;
  orderPaymentStateVersion: number;
  orderPublicId: string;
  orderRefundedAt: Date | null;
  orderRefundedMinor: number;
  orderStatus: ReducedCommercialPaymentState["orderStatus"];
  orderUpdatedAt: Date;
  paymentIntentId: string | null;
  providerAccountFingerprint: string | null;
  totalMinor: number;
}>;

type TimelineRow = Readonly<{
  eventId: string;
  eventType: CommercialVerifiedPaymentEventType;
  occurredAt: Date;
  providerEventId: string;
}>;

type PaymentWebhookPrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canInsertEvent: boolean;
  canInsertOutbox: boolean;
  canMutateCredit: boolean;
  canMutateEntitlement: boolean;
  canReadAttempt: boolean;
  canReadCredit: boolean;
  canReadEntitlement: boolean;
  canReadEvent: boolean;
  canReadOrder: boolean;
  canReadOutbox: boolean;
  canUpdateAttempt: boolean;
  canUpdateEvent: boolean;
  canUpdateOrder: boolean;
  privilegedRole: boolean;
  roleName: string;
}>;

const paymentWebhookPrivilegeAttestations = new WeakMap<PrismaClient, Promise<void>>();

export const assertCommercialPaymentWebhookRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const existing = paymentWebhookPrivilegeAttestations.get(database);
  if (existing !== undefined) return existing;

  const attestation = database.$queryRaw<PaymentWebhookPrivilegeRow[]>`
      SELECT current_user AS "roleName",
             has_database_privilege(current_user, current_database(), 'CREATE')
               AS "canCreateInDatabase",
             has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
             has_table_privilege(current_user, 'public.commercial_order_v2', 'SELECT')
               AS "canReadOrder",
             has_any_column_privilege(current_user, 'public.commercial_order_v2', 'UPDATE')
               AS "canUpdateOrder",
             has_table_privilege(current_user, 'public.commercial_payment_attempt_v2', 'SELECT')
               AS "canReadAttempt",
             has_any_column_privilege(
               current_user, 'public.commercial_payment_attempt_v2', 'UPDATE'
             ) AS "canUpdateAttempt",
             has_table_privilege(current_user, 'public.commercial_payment_event_v2', 'SELECT')
               AS "canReadEvent",
             has_table_privilege(current_user, 'public.commercial_payment_event_v2', 'INSERT')
               AS "canInsertEvent",
             has_any_column_privilege(
               current_user, 'public.commercial_payment_event_v2', 'UPDATE'
             ) AS "canUpdateEvent",
             has_table_privilege(current_user, 'public.commercial_payment_outbox_v2', 'SELECT')
               AS "canReadOutbox",
             has_table_privilege(current_user, 'public.commercial_payment_outbox_v2', 'INSERT')
               AS "canInsertOutbox",
             (
               has_table_privilege(current_user, 'public.credit_ledger_entry', 'SELECT')
               OR has_any_column_privilege(
                 current_user, 'public.credit_ledger_entry', 'SELECT'
               )
             ) AS "canReadCredit",
             (
               has_table_privilege(
                 current_user,
                 'public.credit_ledger_entry',
                 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
               )
               OR has_any_column_privilege(
                 current_user, 'public.credit_ledger_entry', 'INSERT,UPDATE,REFERENCES'
               )
             ) AS "canMutateCredit",
             (
               has_table_privilege(current_user, 'public.commercial_entitlement_v2', 'SELECT')
               OR has_any_column_privilege(
                 current_user, 'public.commercial_entitlement_v2', 'SELECT'
               )
             ) AS "canReadEntitlement",
             (
               has_table_privilege(
                 current_user,
                 'public.commercial_entitlement_v2',
                 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
               )
               OR has_any_column_privilege(
                 current_user, 'public.commercial_entitlement_v2', 'INSERT,UPDATE,REFERENCES'
               )
             ) AS "canMutateEntitlement",
             (
               SELECT role.rolsuper OR role.rolcreatedb OR role.rolcreaterole
                 OR role.rolreplication OR role.rolbypassrls
               FROM pg_roles AS role
               WHERE role.rolname = current_user
             ) AS "privilegedRole"
    `
    .then((rows) => {
      const privilege = rows.at(0);
      if (
        rows.length !== 1 ||
        privilege === undefined ||
        privilege.roleName !== "rituvia_payment_webhook" ||
        privilege.canCreateInDatabase ||
        privilege.canCreateInSchema ||
        !privilege.canReadOrder ||
        !privilege.canUpdateOrder ||
        !privilege.canReadAttempt ||
        !privilege.canUpdateAttempt ||
        !privilege.canReadEvent ||
        !privilege.canInsertEvent ||
        !privilege.canUpdateEvent ||
        !privilege.canReadOutbox ||
        !privilege.canInsertOutbox ||
        privilege.canReadCredit ||
        privilege.canMutateCredit ||
        privilege.canReadEntitlement ||
        privilege.canMutateEntitlement ||
        privilege.privilegedRole
      ) {
        throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
      }
    })
    .catch((error: unknown) => {
      paymentWebhookPrivilegeAttestations.delete(database);
      if (error instanceof CommercialPaymentEventPersistenceError) throw error;
      throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
    });
  paymentWebhookPrivilegeAttestations.set(database, attestation);
  return attestation;
};

const requireInstant = (value: string): Date => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError("Commercial payment event instant is invalid.");
  }
  return new Date(milliseconds);
};

const requireResource = (value: string): string => {
  if (!resourcePattern.test(value)) {
    throw new TypeError("Commercial payment event resource is invalid.");
  }
  return value;
};

const requireDigest = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
    throw new TypeError("Commercial payment event digest is invalid.");
  }
  return Uint8Array.from(value);
};

const digestEquals = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= (left.at(index) ?? 0) ^ (right.at(index) ?? 0);
  }
  return difference === 0;
};

const dateEquals = (left: Date, right: Date): boolean => left.getTime() === right.getTime();

const isSerializationFailure = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2034") return true;
  if (error.code !== "P2010" || typeof error.meta !== "object" || error.meta === null) return false;
  const adapter = (error.meta as Record<string, unknown>).driverAdapterError;
  if (typeof adapter !== "object" || adapter === null) return false;
  const cause = (adapter as Record<string, unknown>).cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as Record<string, unknown>).originalCode === "40001"
  );
};

const eventMatches = (
  existing: ExistingEventRow,
  input: PreparedCommercialPaymentEvent,
  payloadDigest: Uint8Array,
  occurredAt: Date,
): boolean =>
  existing.amountMinor === input.amountMinor &&
  existing.claimedOrderPublicId === input.orderId &&
  existing.currencyCode === input.currencyCode &&
  existing.evidenceSource === input.evidenceSource &&
  existing.eventType === input.eventType &&
  digestEquals(existing.payloadDigest, payloadDigest) &&
  existing.providerCheckoutId === input.providerCheckoutId &&
  existing.providerEventId === input.providerEventId &&
  existing.providerObjectId === input.providerObjectId &&
  dateEquals(existing.providerOccurredAt, occurredAt) &&
  existing.providerPaymentIntentId === input.providerPaymentIntentId &&
  existing.signatureTimestampSeconds === BigInt(input.signatureTimestampSeconds);

const dispositionForDuplicate = (
  value: string | null,
): ProcessedCommercialPaymentEvent["disposition"] => {
  if (value === "applied" || value === "ignored_out_of_order" || value === "rejected_mismatch") {
    return "duplicate";
  }
  throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
};

const processInTransaction = async (
  database: Prisma.TransactionClient,
  input: PreparedCommercialPaymentEvent,
  reduce: CommercialPaymentEventReducer,
  parsed: Readonly<{
    occurredAt: Date;
    payloadDigest: Uint8Array<ArrayBuffer>;
    receivedAt: Date;
  }>,
): Promise<ProcessedCommercialPaymentEvent> => {
  const inserted = await database.$queryRaw<ExistingEventRow[]>`
    INSERT INTO commercial_payment_event_v2 (
      provider, environment, provider_account_fingerprint, provider_event_id,
      normalization_version, evidence_source, event_type, provider_object_id, payload_digest,
      signature_timestamp_seconds, verifier_version, provider_occurred_at, received_at,
      claimed_order_public_id, provider_checkout_id, provider_payment_intent_id,
      amount_minor, currency_code
    ) VALUES (
      'stripe', 'sandbox', ${input.providerAccountFingerprint}, ${input.providerEventId},
      ${input.normalizationVersion}, ${input.evidenceSource}, ${input.eventType},
      ${input.providerObjectId},
      ${parsed.payloadDigest}, ${input.signatureTimestampSeconds}, ${input.verifierVersion},
      ${parsed.occurredAt}, ${parsed.receivedAt}, ${input.orderId}::uuid,
      ${input.providerCheckoutId}, ${input.providerPaymentIntentId},
      ${input.amountMinor}, ${input.currencyCode}
    )
    ON CONFLICT (
      provider, environment, provider_account_fingerprint, provider_event_id
    ) DO NOTHING
    RETURNING
      id,
      amount_minor AS "amountMinor",
      claimed_order_public_id AS "claimedOrderPublicId",
      currency_code AS "currencyCode",
      evidence_source AS "evidenceSource",
      event_type AS "eventType",
      normalization_version AS "normalizationVersion",
      payload_digest AS "payloadDigest",
      processing_disposition AS "processingDisposition",
      provider_checkout_id AS "providerCheckoutId",
      provider_event_id AS "providerEventId",
      provider_object_id AS "providerObjectId",
      provider_occurred_at AS "providerOccurredAt",
      provider_payment_intent_id AS "providerPaymentIntentId",
      signature_timestamp_seconds AS "signatureTimestampSeconds"
  `;
  const created = inserted.at(0);
  if (created === undefined) {
    const duplicates = await database.$queryRaw<ExistingEventRow[]>`
      SELECT
        id,
        amount_minor AS "amountMinor",
        claimed_order_public_id AS "claimedOrderPublicId",
        currency_code AS "currencyCode",
        evidence_source AS "evidenceSource",
        event_type AS "eventType",
        normalization_version AS "normalizationVersion",
        payload_digest AS "payloadDigest",
        processing_disposition AS "processingDisposition",
        provider_checkout_id AS "providerCheckoutId",
        provider_event_id AS "providerEventId",
        provider_object_id AS "providerObjectId",
        provider_occurred_at AS "providerOccurredAt",
        provider_payment_intent_id AS "providerPaymentIntentId",
        signature_timestamp_seconds AS "signatureTimestampSeconds"
      FROM commercial_payment_event_v2
      WHERE provider = 'stripe'
        AND environment = 'sandbox'
        AND provider_account_fingerprint = ${input.providerAccountFingerprint}
        AND provider_event_id = ${input.providerEventId}
      FOR UPDATE
    `;
    const duplicate = duplicates.at(0);
    if (
      duplicate === undefined ||
      !eventMatches(duplicate, input, parsed.payloadDigest, parsed.occurredAt)
    ) {
      throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_CONFLICT");
    }
    return Object.freeze({
      disposition: dispositionForDuplicate(duplicate.processingDisposition),
      kind: "duplicate",
      orderStatus: null,
      outboxCreated: false,
      paymentAttemptState: null,
    });
  }

  const matches = await database.$queryRaw<LockedOrderAttemptRow[]>`
    SELECT
      attempts.completed_at AS "attemptCompletedAt",
      attempts.id AS "attemptId",
      attempts.state AS "attemptState",
      attempts.provider_checkout_id AS "checkoutId",
      orders.currency_code AS "currencyCode",
      orders.created_at AS "orderCreatedAt",
      orders.id AS "orderId",
      orders.paid_at AS "orderPaidAt",
      orders.payment_state_version AS "orderPaymentStateVersion",
      orders.public_id AS "orderPublicId",
      orders.refunded_at AS "orderRefundedAt",
      orders.refunded_minor AS "orderRefundedMinor",
      orders.status AS "orderStatus",
      orders.updated_at AS "orderUpdatedAt",
      attempts.provider_payment_intent_id AS "paymentIntentId",
      attempts.provider_account_fingerprint AS "providerAccountFingerprint",
      orders.total_minor AS "totalMinor"
    FROM commercial_order_v2 AS orders
    JOIN commercial_payment_attempt_v2 AS attempts
      ON attempts.order_id = orders.id
     AND attempts.attempt_number = 1
    WHERE orders.public_id = ${input.orderId}::uuid
      AND attempts.provider = 'stripe'
      AND attempts.environment = 'sandbox'
    FOR UPDATE OF orders, attempts
  `;
  const match = matches.at(0);
  const mismatch =
    match === undefined ||
    match.providerAccountFingerprint !== input.providerAccountFingerprint ||
    match.checkoutId !== input.providerCheckoutId ||
    match.totalMinor !== input.amountMinor ||
    match.currencyCode !== input.currencyCode ||
    (match.paymentIntentId !== null &&
      input.providerPaymentIntentId !== null &&
      match.paymentIntentId !== input.providerPaymentIntentId);
  if (mismatch) {
    await database.commercialPaymentEventV2.update({
      data: {
        processedAt: parsed.receivedAt,
        processingDisposition: "rejected_mismatch",
        processingState: "processed",
        validationState: "rejected_mismatch",
      },
      where: { id: created.id },
    });
    return Object.freeze({
      disposition: "rejected_mismatch",
      kind: "processed",
      orderStatus: null,
      outboxCreated: false,
      paymentAttemptState: null,
    });
  }

  const persistedTimeline = await database.$queryRaw<TimelineRow[]>`
    SELECT
      id AS "eventId",
      event_type AS "eventType",
      provider_occurred_at AS "occurredAt",
      provider_event_id AS "providerEventId"
    FROM commercial_payment_event_v2
    WHERE order_id = ${match.orderId}::uuid
      AND validation_state = 'matched'
    ORDER BY provider_occurred_at, event_type, provider_event_id
    FOR UPDATE
  `;
  const timeline = [
    ...persistedTimeline,
    Object.freeze({
      eventId: created.id,
      eventType: input.eventType,
      occurredAt: parsed.occurredAt,
      providerEventId: input.providerEventId,
    }),
  ];
  if (timeline.length === 0 || timeline.length > maximumTimelineEvents) {
    throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
  }
  const reduced = reduce({
    events: timeline.map((event) =>
      Object.freeze({
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
        providerEventId: event.providerEventId,
      }),
    ),
    totalMinor: match.totalMinor,
  });
  if (
    reduced.dispositions.length !== timeline.length ||
    new Set(reduced.dispositions.map(({ eventId }) => eventId)).size !== timeline.length
  ) {
    throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
  }

  for (const disposition of reduced.dispositions) {
    await database.commercialPaymentEventV2.update({
      data: {
        ...(disposition.eventId === created.id
          ? {
              orderId: match.orderId,
              paymentAttemptId: match.attemptId,
              validationState: "matched",
            }
          : {}),
        processedAt: parsed.receivedAt,
        processingDisposition: disposition.disposition,
        processingState: "processed",
      },
      where:
        disposition.eventId === created.id
          ? { id: disposition.eventId }
          : { id: disposition.eventId, orderId: match.orderId },
    });
  }

  const reducedUpdatedAt =
    reduced.updatedAt === null ? match.orderUpdatedAt : requireInstant(reduced.updatedAt);
  const orderUpdatedAt =
    reducedUpdatedAt > match.orderUpdatedAt ? reducedUpdatedAt : match.orderUpdatedAt;
  const paidAt = reduced.paidAt === null ? null : requireInstant(reduced.paidAt);
  const refundedAt = reduced.refundedAt === null ? null : requireInstant(reduced.refundedAt);
  const completedAt =
    reduced.attemptCompletedAt === null ? null : requireInstant(reduced.attemptCompletedAt);
  const paymentIntentId = match.paymentIntentId ?? input.providerPaymentIntentId;
  const changed =
    match.orderStatus !== reduced.orderStatus ||
    match.orderRefundedMinor !== reduced.refundedMinor ||
    (match.orderPaidAt?.getTime() ?? null) !== (paidAt?.getTime() ?? null) ||
    (match.orderRefundedAt?.getTime() ?? null) !== (refundedAt?.getTime() ?? null) ||
    match.attemptState !== reduced.attemptState ||
    (match.attemptCompletedAt?.getTime() ?? null) !== (completedAt?.getTime() ?? null);
  const paymentStateVersion = match.orderPaymentStateVersion + (changed ? 1 : 0);

  await database.commercialOrderV2.update({
    data: {
      paidAt,
      paymentStateVersion,
      refundedAt,
      refundedMinor: reduced.refundedMinor,
      status: reduced.orderStatus,
      updatedAt: orderUpdatedAt,
    },
    where: { id: match.orderId },
  });
  await database.commercialPaymentAttemptV2.update({
    data: {
      completedAt,
      providerPaymentIntentId: paymentIntentId,
      state: reduced.attemptState,
      updatedAt: orderUpdatedAt,
    },
    where: { id: match.attemptId },
  });

  if (changed) {
    await database.commercialPaymentOutboxV2.create({
      data: {
        availableAt: parsed.receivedAt,
        createdAt: parsed.receivedAt,
        orderId: match.orderId,
        orderStatus: reduced.orderStatus,
        paymentAttemptId: match.attemptId,
        paymentAttemptState: reduced.attemptState,
        paymentEventId: created.id,
        paymentStateVersion,
        schemaVersion: "commercial-payment-state-outbox.v1",
        topic: "commercial.payment_state_changed",
      },
    });
  }
  const currentDisposition = reduced.dispositions.find(({ eventId }) => eventId === created.id);
  if (currentDisposition === undefined) {
    throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
  }
  return Object.freeze({
    disposition: currentDisposition.disposition,
    kind: "processed",
    orderStatus: reduced.orderStatus,
    outboxCreated: changed,
    paymentAttemptState: reduced.attemptState,
  });
};

export const createCommercialPaymentEventPersistence = (
  database: PrismaClient,
): CommercialPaymentEventPersistence =>
  Object.freeze({
    async processStripeSandboxEvent(input, reduce) {
      await assertCommercialPaymentWebhookRuntimeDatabasePrivileges(database);
      if (
        !uuidV4Pattern.test(input.orderId) ||
        !fingerprintPattern.test(input.providerAccountFingerprint) ||
        !commercialVerifiedPaymentEventTypes.includes(input.eventType) ||
        !currencyPattern.test(input.currencyCode) ||
        !Number.isSafeInteger(input.amountMinor) ||
        input.amountMinor < 1 ||
        input.amountMinor > maximumMinorAmount ||
        !Number.isSafeInteger(input.signatureTimestampSeconds) ||
        input.signatureTimestampSeconds < 1 ||
        typeof reduce !== "function"
      ) {
        throw new TypeError("Commercial payment event is invalid.");
      }
      requireResource(input.providerEventId);
      requireResource(input.providerObjectId);
      requireResource(input.providerCheckoutId);
      if (input.providerPaymentIntentId !== null) {
        requireResource(input.providerPaymentIntentId);
      }
      requireResource(input.normalizationVersion);
      requireResource(input.verifierVersion);
      const parsed = Object.freeze({
        occurredAt: requireInstant(input.occurredAt),
        payloadDigest: requireDigest(input.payloadDigest),
        receivedAt: requireInstant(input.receivedAt),
      });
      if (parsed.occurredAt.getTime() - parsed.receivedAt.getTime() > 300_000) {
        throw new TypeError("Commercial payment event occurrence exceeds clock tolerance.");
      }

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          return await database.$transaction(
            (transaction) => processInTransaction(transaction, input, reduce, parsed),
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 5) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
    },
  });
