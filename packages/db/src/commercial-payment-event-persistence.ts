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
  providerInvoiceId: string | null;
  providerSubscriptionId: string | null;
  receivedAt: string;
  signatureTimestampSeconds: number;
  subscriptionCancelAtPeriodEnd: boolean | null;
  subscriptionPeriodEnd: string | null;
  subscriptionPeriodStart: string | null;
  subscriptionState: "active" | "cancelled" | "past_due" | null;
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

export type CommercialPaymentStateOutboxClaim = Readonly<{
  attemptCount: number;
  leaseExpiresAt: string;
  orderId: string;
  orderStatus: ReducedCommercialPaymentState["orderStatus"];
  outboxId: string;
  paymentAttemptId: string;
  paymentAttemptState: ReducedCommercialPaymentState["attemptState"];
  paymentEventId: string;
  paymentStateVersion: number;
  schemaVersion: "commercial-payment-state-outbox.v1";
  topic: "commercial.payment_state_changed";
}>;

export type CommercialPaymentEventPersistence = Readonly<{
  claimPaymentStateOutbox(input: {
    claimedAt: string;
    leaseTokenHash: Uint8Array;
    leasedUntil: string;
  }): Promise<CommercialPaymentStateOutboxClaim | null>;
  completePaymentStateOutbox(input: {
    completedAt: string;
    leaseTokenHash: Uint8Array;
    outboxId: string;
  }): Promise<boolean>;
  failPaymentStateOutbox(input: {
    failedAt: string;
    failureCode: string;
    leaseTokenHash: Uint8Array;
    outboxId: string;
    retryAt: string | null;
  }): Promise<"dead_lettered" | "retry_wait" | null>;
  reconcileDueAnnualSubscriptionCredits(input: { asOf: string; userId: string }): Promise<number>;
  processStripeSandboxEvent(
    input: PreparedCommercialPaymentEvent,
    reduce: CommercialPaymentEventReducer,
  ): Promise<ProcessedCommercialPaymentEvent>;
}>;

type AnnualSubscriptionReconciliationRow = Readonly<{
  catalogVersion: string;
  countryPolicyVersion: string;
  creditsPerMonth: number;
  currentPeriodEnd: Date;
  currentPeriodStart: Date;
  orderId: string;
  productCode: string;
  productVersion: string;
  sourcePaymentEventId: string;
  subscriptionId: string;
  termsVersion: string;
  userId: string;
}>;

type ExistingEventRow = Readonly<{
  amountMinor: number;
  claimedOrderPublicId: string;
  currencyCode: string;
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
  providerInvoiceId: string | null;
  providerSubscriptionId: string | null;
  subscriptionCancelAtPeriodEnd: boolean | null;
  subscriptionPeriodEnd: Date | null;
  subscriptionPeriodStart: Date | null;
  subscriptionState: string | null;
}>;

type LockedOrderAttemptRow = Readonly<{
  attemptCompletedAt: Date | null;
  attemptId: string;
  attemptState: ReducedCommercialPaymentState["attemptState"];
  checkoutId: string | null;
  currencyCode: string;
  billingInterval: "month" | "one_time" | "year";
  catalogVersion: string;
  countryPolicyVersion: string;
  creditsGranted: number | null;
  creditsPerMonth: number | null;
  fulfillmentCode: string;
  fulfillmentKind: "credit_pack" | "subscription";
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
  productCode: string;
  productVersion: string;
  providerAccountFingerprint: string | null;
  totalMinor: number;
  termsVersion: string;
  userId: string;
}>;

type TimelineRow = Readonly<{
  eventId: string;
  eventType: CommercialVerifiedPaymentEventType;
  occurredAt: Date;
  providerEventId: string;
}>;

type OutboxClaimRow = Readonly<{
  attemptCount: number;
  leaseExpiresAt: Date;
  orderId: string;
  orderStatus: ReducedCommercialPaymentState["orderStatus"];
  outboxId: string;
  paymentAttemptId: string;
  paymentAttemptState: ReducedCommercialPaymentState["attemptState"];
  paymentEventId: string;
  paymentStateVersion: number;
  schemaVersion: "commercial-payment-state-outbox.v1";
  topic: "commercial.payment_state_changed";
}>;

type PaymentWebhookPrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canInsertEvent: boolean;
  canInsertOutbox: boolean;
  canInsertAudit: boolean;
  canInsertCredit: boolean;
  canInsertEntitlement: boolean;
  canInsertPeriod: boolean;
  canInsertProjection: boolean;
  canInsertSubscription: boolean;
  canReadAttempt: boolean;
  canReadCredit: boolean;
  canReadEntitlement: boolean;
  canReadOrderItem: boolean;
  canReadPeriod: boolean;
  canReadPrice: boolean;
  canReadProjection: boolean;
  canReadSubscription: boolean;
  canReadEvent: boolean;
  canReadOrder: boolean;
  canReadOutbox: boolean;
  canUpdateAttempt: boolean;
  canUpdateEvent: boolean;
  canUpdateOrder: boolean;
  canUpdateOutbox: boolean;
  canUpdateEntitlement: boolean;
  canUpdateProjection: boolean;
  canUpdateSubscription: boolean;
  canDeleteFinancial: boolean;
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
             has_table_privilege(current_user, 'public.commercial_order_item_v2', 'SELECT')
               AS "canReadOrderItem",
             has_table_privilege(current_user, 'public.catalog_price', 'SELECT')
               AS "canReadPrice",
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
             has_any_column_privilege(
               current_user, 'public.commercial_payment_outbox_v2', 'UPDATE'
             ) AS "canUpdateOutbox",
             (
               has_table_privilege(current_user, 'public.credit_ledger_entry', 'SELECT')
               OR has_any_column_privilege(
                 current_user, 'public.credit_ledger_entry', 'SELECT'
               )
             ) AS "canReadCredit",
             has_table_privilege(current_user, 'public.credit_ledger_entry', 'INSERT')
               AS "canInsertCredit",
             has_table_privilege(current_user, 'public.credit_projection', 'SELECT')
               AS "canReadProjection",
             has_table_privilege(current_user, 'public.credit_projection', 'INSERT')
               AS "canInsertProjection",
             has_any_column_privilege(current_user, 'public.credit_projection', 'UPDATE')
               AS "canUpdateProjection",
             (
               has_table_privilege(current_user, 'public.commercial_entitlement_v2', 'SELECT')
               OR has_any_column_privilege(
                 current_user, 'public.commercial_entitlement_v2', 'SELECT'
               )
             ) AS "canReadEntitlement",
             has_table_privilege(current_user, 'public.commercial_entitlement_v2', 'INSERT')
               AS "canInsertEntitlement",
             has_any_column_privilege(current_user, 'public.commercial_entitlement_v2', 'UPDATE')
               AS "canUpdateEntitlement",
             has_table_privilege(current_user, 'public.commercial_subscription_v2', 'SELECT')
               AS "canReadSubscription",
             has_table_privilege(current_user, 'public.commercial_subscription_v2', 'INSERT')
               AS "canInsertSubscription",
             has_any_column_privilege(current_user, 'public.commercial_subscription_v2', 'UPDATE')
               AS "canUpdateSubscription",
             has_table_privilege(current_user, 'public.commercial_subscription_period_v2', 'SELECT')
               AS "canReadPeriod",
             has_table_privilege(current_user, 'public.commercial_subscription_period_v2', 'INSERT')
               AS "canInsertPeriod",
             has_table_privilege(current_user, 'public.commercial_commerce_audit_v2', 'INSERT')
               AS "canInsertAudit",
             (
               has_table_privilege(current_user, 'public.credit_ledger_entry', 'DELETE')
               OR has_table_privilege(current_user, 'public.credit_projection', 'DELETE')
               OR has_table_privilege(current_user, 'public.commercial_entitlement_v2', 'DELETE')
               OR has_table_privilege(current_user, 'public.commercial_subscription_v2', 'DELETE')
               OR has_table_privilege(current_user, 'public.commercial_subscription_period_v2', 'DELETE')
               OR has_table_privilege(current_user, 'public.commercial_commerce_audit_v2', 'DELETE')
             ) AS "canDeleteFinancial",
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
        !privilege.canReadOrderItem ||
        !privilege.canReadPrice ||
        !privilege.canReadAttempt ||
        !privilege.canUpdateAttempt ||
        !privilege.canReadEvent ||
        !privilege.canInsertEvent ||
        !privilege.canUpdateEvent ||
        !privilege.canReadOutbox ||
        !privilege.canInsertOutbox ||
        !privilege.canUpdateOutbox ||
        !privilege.canReadCredit ||
        !privilege.canInsertCredit ||
        !privilege.canReadProjection ||
        !privilege.canInsertProjection ||
        !privilege.canUpdateProjection ||
        !privilege.canReadEntitlement ||
        !privilege.canInsertEntitlement ||
        !privilege.canUpdateEntitlement ||
        !privilege.canReadSubscription ||
        !privilege.canInsertSubscription ||
        !privilege.canUpdateSubscription ||
        !privilege.canReadPeriod ||
        !privilege.canInsertPeriod ||
        !privilege.canInsertAudit ||
        privilege.canDeleteFinancial ||
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
  existing.eventType === input.eventType &&
  digestEquals(existing.payloadDigest, payloadDigest) &&
  existing.providerCheckoutId === input.providerCheckoutId &&
  existing.providerEventId === input.providerEventId &&
  existing.providerObjectId === input.providerObjectId &&
  dateEquals(existing.providerOccurredAt, occurredAt) &&
  existing.providerPaymentIntentId === input.providerPaymentIntentId &&
  existing.providerInvoiceId === input.providerInvoiceId &&
  existing.providerSubscriptionId === input.providerSubscriptionId &&
  existing.subscriptionCancelAtPeriodEnd === input.subscriptionCancelAtPeriodEnd &&
  (existing.subscriptionPeriodStart?.toISOString() ?? null) === input.subscriptionPeriodStart &&
  (existing.subscriptionPeriodEnd?.toISOString() ?? null) === input.subscriptionPeriodEnd &&
  existing.subscriptionState === input.subscriptionState;

const dispositionForDuplicate = (
  value: string | null,
): ProcessedCommercialPaymentEvent["disposition"] => {
  if (value === "applied" || value === "ignored_out_of_order" || value === "rejected_mismatch") {
    return "duplicate";
  }
  throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
};

const sha256Text = async (value: string): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ) as Uint8Array<ArrayBuffer>;

const addUtcMonthsClamped = (value: Date, months: number): Date => {
  const targetMonth = value.getUTCMonth() + months;
  const monthStart = new Date(
    Date.UTC(
      value.getUTCFullYear(),
      targetMonth,
      1,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  monthStart.setUTCDate(Math.min(value.getUTCDate(), lastDay));
  return monthStart;
};

const monthlyAllocationKey = (value: Date): string => value.toISOString().slice(0, 7);

const grantProjectionCredits = async (
  database: Prisma.TransactionClient,
  input: Readonly<{
    amount: number;
    catalogVersion: string;
    createdAt: Date;
    creditType: "purchased_credit" | "subscription_credit";
    eventId: string;
    orderId: string;
    policyVersion: string;
    productCode: string;
    productVersion: string;
    reason: string;
    subscriptionPeriodId: string | null;
    termsVersion: string;
    userId: string;
  }>,
): Promise<string> => {
  const idempotencyKeyHash = await sha256Text(
    `commercial-credit-grant.v1\0${input.eventId}\0${input.subscriptionPeriodId ?? "order"}`,
  );
  const canonicalRequestHash = await sha256Text(
    JSON.stringify({
      amount: input.amount,
      creditType: input.creditType,
      eventId: input.eventId,
      orderId: input.orderId,
      subscriptionPeriodId: input.subscriptionPeriodId,
    }),
  );
  const ledger = await database.creditLedgerEntry.create({
    data: {
      amount: input.amount,
      canonicalRequestHash,
      catalogVersion: input.catalogVersion,
      createdAt: input.createdAt,
      creditType: input.creditType,
      direction: "grant",
      idempotencyKeyHash,
      idempotencyKeyVersion: "commercial-credit-grant.v1",
      operation: input.reason,
      orderId: input.orderId,
      policyVersion: input.policyVersion,
      productCode: input.productCode,
      productVersion: input.productVersion,
      reason: input.reason,
      subscriptionPeriodId: input.subscriptionPeriodId,
      termsVersion: input.termsVersion,
      userId: input.userId,
    },
  });
  const projectionIncrement =
    input.creditType === "subscription_credit"
      ? { subscriptionAvailable: { increment: input.amount } }
      : { purchasedAvailable: { increment: input.amount } };
  await database.creditProjection.upsert({
    create: {
      promotionalAvailable: 0,
      purchasedAvailable: input.creditType === "purchased_credit" ? input.amount : 0,
      reserved: 0,
      subscriptionAvailable: input.creditType === "subscription_credit" ? input.amount : 0,
      updatedAt: input.createdAt,
      userId: input.userId,
      version: 1n,
    },
    update: {
      ...projectionIncrement,
      updatedAt: input.createdAt,
      version: { increment: 1n },
    },
    where: { userId: input.userId },
  });
  return ledger.id;
};

const updatePlusEntitlement = async (
  database: Prisma.TransactionClient,
  input: Readonly<{
    match: LockedOrderAttemptRow;
    status: "active" | "frozen" | "revoked";
    updatedAt: Date;
  }>,
): Promise<void> => {
  const existing = await database.commercialEntitlementV2.findFirst({
    where: {
      entitlementType: "plus",
      fulfillmentCode: input.match.fulfillmentCode,
      userId: input.match.userId,
    },
  });
  if (existing === null) {
    if (input.status !== "active") return;
    await database.commercialEntitlementV2.create({
      data: {
        canonicalRequestHash: await sha256Text(
          `plus-entitlement.v1\0${input.match.orderId}\0${input.match.fulfillmentCode}`,
        ),
        catalogVersion: input.match.catalogVersion,
        entitlementType: "plus",
        fulfillmentCode: input.match.fulfillmentCode,
        grantedAt: input.updatedAt,
        idempotencyKeyHash: await sha256Text(`plus-entitlement.v1\0${input.match.orderId}`),
        idempotencyKeyVersion: "plus-entitlement.v1",
        productCode: input.match.productCode,
        productVersion: input.match.productVersion,
        sourceOrderId: input.match.orderId,
        status: "active",
        userId: input.match.userId,
        version: 1,
      },
    });
    return;
  }
  await database.commercialEntitlementV2.update({
    data: {
      frozenAt: input.status === "frozen" ? input.updatedAt : null,
      revokedAt: input.status === "revoked" ? input.updatedAt : null,
      status: input.status,
      version: { increment: 1 },
    },
    where: { id: existing.id },
  });
};

const applySubscriptionContext = async (
  database: Prisma.TransactionClient,
  input: PreparedCommercialPaymentEvent,
  match: LockedOrderAttemptRow,
  paymentEventId: string,
  receivedAt: Date,
): Promise<string | null> => {
  if (match.fulfillmentKind !== "subscription" || input.providerSubscriptionId === null) {
    return null;
  }
  if (
    match.creditsPerMonth === null ||
    match.creditsPerMonth < 1 ||
    !["month", "year"].includes(match.billingInterval) ||
    input.subscriptionState === null ||
    input.subscriptionPeriodStart === null ||
    input.subscriptionPeriodEnd === null ||
    input.subscriptionCancelAtPeriodEnd === null
  ) {
    throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
  }
  const periodStart = requireInstant(input.subscriptionPeriodStart);
  const periodEnd = requireInstant(input.subscriptionPeriodEnd);
  const cancelled = input.subscriptionState === "cancelled";
  const subscription = await database.commercialSubscriptionV2.upsert({
    create: {
      billingInterval: match.billingInterval,
      cancelAtPeriodEnd: input.subscriptionCancelAtPeriodEnd,
      cancelledAt: cancelled ? receivedAt : null,
      catalogVersion: match.catalogVersion,
      createdAt: receivedAt,
      creditsPerMonth: match.creditsPerMonth,
      currentPeriodEnd: periodEnd,
      currentPeriodStart: periodStart,
      environment: "sandbox",
      productCode: match.productCode,
      productVersion: match.productVersion,
      provider: "stripe",
      providerSubscriptionId: input.providerSubscriptionId,
      sourceOrderId: match.orderId,
      status: input.subscriptionState,
      updatedAt: receivedAt,
      userId: match.userId,
    },
    update: {
      cancelAtPeriodEnd: input.subscriptionCancelAtPeriodEnd,
      cancelledAt: cancelled ? receivedAt : null,
      currentPeriodEnd: periodEnd,
      currentPeriodStart: periodStart,
      providerSubscriptionId: input.providerSubscriptionId,
      status: input.subscriptionState,
      updatedAt: receivedAt,
    },
    where: { sourceOrderId: match.orderId },
  });
  await updatePlusEntitlement(database, {
    match,
    status:
      input.subscriptionState === "active"
        ? "active"
        : input.subscriptionState === "past_due"
          ? "frozen"
          : "revoked",
    updatedAt: receivedAt,
  });
  if (input.eventType !== "payment_succeeded") return subscription.id;

  const allocationKey = monthlyAllocationKey(periodStart);
  const existingPeriod = await database.commercialSubscriptionPeriodV2.findFirst({
    where: { allocationKey, subscriptionId: subscription.id },
  });
  if (existingPeriod !== null) return subscription.id;
  const sourceLedgerEntryId = await grantProjectionCredits(database, {
    amount: match.creditsPerMonth,
    catalogVersion: match.catalogVersion,
    createdAt: receivedAt,
    creditType: "subscription_credit",
    eventId: paymentEventId,
    orderId: match.orderId,
    policyVersion: match.countryPolicyVersion,
    productCode: match.productCode,
    productVersion: match.productVersion,
    reason: "stripe_subscription_period_verified",
    subscriptionPeriodId: allocationKey,
    termsVersion: match.termsVersion,
    userId: match.userId,
  });
  await database.commercialSubscriptionPeriodV2.create({
    data: {
      allocationKey,
      createdAt: receivedAt,
      creditsGranted: match.creditsPerMonth,
      periodEnd:
        match.billingInterval === "year"
          ? new Date(Math.min(addUtcMonthsClamped(periodStart, 1).getTime(), periodEnd.getTime()))
          : periodEnd,
      periodStart,
      providerInvoiceId: input.providerInvoiceId,
      sourceLedgerEntryId,
      sourcePaymentEventId: paymentEventId,
      subscriptionId: subscription.id,
    },
  });
  return subscription.id;
};

const reverseAvailableOrderCredits = async (
  database: Prisma.TransactionClient,
  input: Readonly<{
    eventId: string;
    match: LockedOrderAttemptRow;
    receivedAt: Date;
  }>,
): Promise<number> => {
  const grants = await database.creditLedgerEntry.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: { direction: "grant", orderId: input.match.orderId },
  });
  const projection = await database.creditProjection.findUnique({
    where: { userId: input.match.userId },
  });
  if (projection === null) return 0;
  let purchasedAvailable = projection.purchasedAvailable;
  let subscriptionAvailable = projection.subscriptionAvailable;
  let reversedTotal = 0;
  for (const grant of grants) {
    const existingReversals = await database.creditLedgerEntry.aggregate({
      _sum: { amount: true },
      where: { direction: "reverse", sourceEntryId: grant.id },
    });
    const remainingGrant = Math.max(0, grant.amount - (existingReversals._sum.amount ?? 0));
    const bucket =
      grant.creditType === "purchased_credit" ? purchasedAvailable : subscriptionAvailable;
    const amount = Math.min(remainingGrant, bucket);
    if (amount < 1) continue;
    await database.creditLedgerEntry.create({
      data: {
        amount,
        canonicalRequestHash: await sha256Text(
          `commercial-credit-reversal.v1\0${input.eventId}\0${grant.id}\0${amount}`,
        ),
        createdAt: input.receivedAt,
        creditType: "refund_adjustment",
        direction: "reverse",
        idempotencyKeyHash: await sha256Text(
          `commercial-credit-reversal.v1\0${input.eventId}\0${grant.id}`,
        ),
        idempotencyKeyVersion: "commercial-credit-reversal.v1",
        operation: "stripe_refund_or_dispute",
        orderId: input.match.orderId,
        policyVersion: input.match.countryPolicyVersion,
        reason: "stripe_refund_or_dispute",
        sourceEntryId: grant.id,
        termsVersion: input.match.termsVersion,
        userId: input.match.userId,
      },
    });
    if (grant.creditType === "purchased_credit") purchasedAvailable -= amount;
    else subscriptionAvailable -= amount;
    reversedTotal += amount;
  }
  if (reversedTotal > 0) {
    await database.creditProjection.update({
      data: {
        purchasedAvailable,
        subscriptionAvailable,
        updatedAt: input.receivedAt,
        version: { increment: 1 },
      },
      where: { userId: input.match.userId },
    });
  }
  return reversedTotal;
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
      normalization_version, event_type, provider_object_id, payload_digest,
      signature_timestamp_seconds, verifier_version, provider_occurred_at, received_at,
      claimed_order_public_id, provider_checkout_id, provider_payment_intent_id,
      provider_subscription_id, provider_invoice_id, subscription_period_start,
      subscription_period_end, subscription_cancel_at_period_end, subscription_state,
      amount_minor, currency_code
    ) VALUES (
      'stripe', 'sandbox', ${input.providerAccountFingerprint}, ${input.providerEventId},
      ${input.normalizationVersion}, ${input.eventType}, ${input.providerObjectId},
      ${parsed.payloadDigest}, ${input.signatureTimestampSeconds}, ${input.verifierVersion},
      ${parsed.occurredAt}, ${parsed.receivedAt}, ${input.orderId}::uuid,
      ${input.providerCheckoutId}, ${input.providerPaymentIntentId},
      ${input.providerSubscriptionId}, ${input.providerInvoiceId},
      ${input.subscriptionPeriodStart}::timestamptz, ${input.subscriptionPeriodEnd}::timestamptz,
      ${input.subscriptionCancelAtPeriodEnd}, ${input.subscriptionState},
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
      event_type AS "eventType",
      normalization_version AS "normalizationVersion",
      payload_digest AS "payloadDigest",
      processing_disposition AS "processingDisposition",
      provider_checkout_id AS "providerCheckoutId",
      provider_event_id AS "providerEventId",
      provider_object_id AS "providerObjectId",
      provider_occurred_at AS "providerOccurredAt",
      provider_payment_intent_id AS "providerPaymentIntentId",
      provider_invoice_id AS "providerInvoiceId",
      provider_subscription_id AS "providerSubscriptionId",
      subscription_cancel_at_period_end AS "subscriptionCancelAtPeriodEnd",
      subscription_period_end AS "subscriptionPeriodEnd",
      subscription_period_start AS "subscriptionPeriodStart",
      subscription_state AS "subscriptionState"
  `;
  const created = inserted.at(0);
  if (created === undefined) {
    const duplicates = await database.$queryRaw<ExistingEventRow[]>`
      SELECT
        id,
        amount_minor AS "amountMinor",
        claimed_order_public_id AS "claimedOrderPublicId",
        currency_code AS "currencyCode",
        event_type AS "eventType",
        normalization_version AS "normalizationVersion",
        payload_digest AS "payloadDigest",
        processing_disposition AS "processingDisposition",
        provider_checkout_id AS "providerCheckoutId",
        provider_event_id AS "providerEventId",
        provider_object_id AS "providerObjectId",
        provider_occurred_at AS "providerOccurredAt",
        provider_payment_intent_id AS "providerPaymentIntentId",
        provider_invoice_id AS "providerInvoiceId",
        provider_subscription_id AS "providerSubscriptionId",
        subscription_cancel_at_period_end AS "subscriptionCancelAtPeriodEnd",
        subscription_period_end AS "subscriptionPeriodEnd",
        subscription_period_start AS "subscriptionPeriodStart",
        subscription_state AS "subscriptionState"
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
      prices.billing_interval AS "billingInterval",
      orders.catalog_version AS "catalogVersion",
      orders.country_policy_version AS "countryPolicyVersion",
      items.credits_granted AS "creditsGranted",
      items.credits_per_month AS "creditsPerMonth",
      items.fulfillment_code AS "fulfillmentCode",
      items.fulfillment_kind AS "fulfillmentKind",
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
      items.product_code AS "productCode",
      items.product_version AS "productVersion",
      attempts.provider_account_fingerprint AS "providerAccountFingerprint",
      orders.total_minor AS "totalMinor",
      orders.terms_version AS "termsVersion",
      orders.user_id AS "userId"
    FROM commercial_order_v2 AS orders
    JOIN commercial_payment_attempt_v2 AS attempts
      ON attempts.order_id = orders.id
     AND attempts.attempt_number = 1
    JOIN commercial_order_item_v2 AS items ON items.order_id = orders.id
    JOIN catalog_price AS prices
      ON prices.catalog_version = orders.catalog_version
     AND prices.price_id = orders.price_id
     AND prices.version = orders.price_version
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

  const currentDisposition = reduced.dispositions.find(({ eventId }) => eventId === created.id);
  if (currentDisposition === undefined) {
    throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
  }
  const subscriptionId = await applySubscriptionContext(
    database,
    input,
    match,
    created.id,
    parsed.receivedAt,
  );
  let creditsChanged = 0;
  if (
    match.fulfillmentKind === "credit_pack" &&
    input.eventType === "payment_succeeded" &&
    currentDisposition.disposition === "applied"
  ) {
    if (match.creditsGranted === null || match.creditsGranted < 1) {
      throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
    }
    const existingGrant = await database.creditLedgerEntry.findFirst({
      select: { id: true },
      where: {
        creditType: "purchased_credit",
        direction: "grant",
        orderId: match.orderId,
        reason: "stripe_credit_pack_verified",
        userId: match.userId,
      },
    });
    if (existingGrant === null) {
      await grantProjectionCredits(database, {
        amount: match.creditsGranted,
        catalogVersion: match.catalogVersion,
        createdAt: parsed.receivedAt,
        creditType: "purchased_credit",
        eventId: created.id,
        orderId: match.orderId,
        policyVersion: match.countryPolicyVersion,
        productCode: match.productCode,
        productVersion: match.productVersion,
        reason: "stripe_credit_pack_verified",
        subscriptionPeriodId: null,
        termsVersion: match.termsVersion,
        userId: match.userId,
      });
      creditsChanged = match.creditsGranted;
    }
  }
  if (["disputed", "refunded"].includes(reduced.orderStatus)) {
    creditsChanged = -(await reverseAvailableOrderCredits(database, {
      eventId: created.id,
      match,
      receivedAt: parsed.receivedAt,
    }));
    if (match.fulfillmentKind === "subscription") {
      await updatePlusEntitlement(database, {
        match,
        status: reduced.orderStatus === "disputed" ? "frozen" : "revoked",
        updatedAt: parsed.receivedAt,
      });
      if (subscriptionId !== null) {
        await database.commercialSubscriptionV2.update({
          data: {
            cancelledAt: parsed.receivedAt,
            status: reduced.orderStatus === "disputed" ? "disputed" : "cancelled",
            updatedAt: parsed.receivedAt,
          },
          where: { id: subscriptionId },
        });
      } else {
        await database.commercialSubscriptionV2.updateMany({
          data: {
            cancelledAt: parsed.receivedAt,
            status: reduced.orderStatus === "disputed" ? "disputed" : "cancelled",
            updatedAt: parsed.receivedAt,
          },
          where: { sourceOrderId: match.orderId },
        });
      }
    }
  }
  const auditOutcome =
    currentDisposition.disposition === "applied"
      ? "applied"
      : currentDisposition.disposition === "ignored_out_of_order"
        ? "ignored"
        : "rejected";
  const auditDetails = JSON.stringify({
    creditsChanged,
    disposition: currentDisposition.disposition,
    paymentStateVersion,
    providerEventId: input.providerEventId,
  });
  await database.$executeRaw`
    INSERT INTO commercial_commerce_audit_v2 (
      user_id, order_id, subscription_id, payment_event_id,
      action, outcome, details, created_at
    ) VALUES (
      ${match.userId}::uuid,
      ${match.orderId}::uuid,
      ${subscriptionId}::uuid,
      ${created.id}::uuid,
      ${`stripe_${input.eventType}`},
      ${auditOutcome},
      ${auditDetails}::jsonb,
      ${parsed.receivedAt}
    )
  `;

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
  return Object.freeze({
    disposition: currentDisposition.disposition,
    kind: "processed",
    orderStatus: reduced.orderStatus,
    outboxCreated: changed,
    paymentAttemptState: reduced.attemptState,
  });
};

const reconcileAnnualCreditsInTransaction = async (
  database: Prisma.TransactionClient,
  input: Readonly<{ asOf: Date; userId: string }>,
): Promise<number> => {
  const subscriptions = await database.$queryRaw<AnnualSubscriptionReconciliationRow[]>`
    SELECT
      subscriptions.catalog_version AS "catalogVersion",
      orders.country_policy_version AS "countryPolicyVersion",
      subscriptions.credits_per_month AS "creditsPerMonth",
      subscriptions.current_period_end AS "currentPeriodEnd",
      subscriptions.current_period_start AS "currentPeriodStart",
      subscriptions.source_order_id AS "orderId",
      subscriptions.product_code AS "productCode",
      subscriptions.product_version AS "productVersion",
      source.source_payment_event_id AS "sourcePaymentEventId",
      subscriptions.id AS "subscriptionId",
      orders.terms_version AS "termsVersion",
      subscriptions.user_id AS "userId"
    FROM commercial_subscription_v2 AS subscriptions
    JOIN commercial_order_v2 AS orders ON orders.id = subscriptions.source_order_id
    JOIN LATERAL (
      SELECT periods.source_payment_event_id
      FROM commercial_subscription_period_v2 AS periods
      WHERE periods.subscription_id = subscriptions.id
        AND periods.source_payment_event_id IS NOT NULL
      ORDER BY periods.period_start, periods.id
      LIMIT 1
    ) AS source ON true
    WHERE subscriptions.user_id = ${input.userId}::uuid
      AND subscriptions.billing_interval = 'year'
      AND subscriptions.status IN ('active', 'past_due')
      AND subscriptions.current_period_start <= ${input.asOf}
    ORDER BY subscriptions.current_period_start, subscriptions.id
    FOR UPDATE OF subscriptions
  `;
  let allocations = 0;
  for (const subscription of subscriptions) {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const periodStart = addUtcMonthsClamped(subscription.currentPeriodStart, monthIndex);
      if (periodStart > input.asOf || periodStart >= subscription.currentPeriodEnd) break;
      const allocationKey = monthlyAllocationKey(periodStart);
      const existing = await database.commercialSubscriptionPeriodV2.findFirst({
        where: { allocationKey, subscriptionId: subscription.subscriptionId },
      });
      if (existing !== null) continue;
      const periodEnd = new Date(
        Math.min(
          addUtcMonthsClamped(subscription.currentPeriodStart, monthIndex + 1).getTime(),
          subscription.currentPeriodEnd.getTime(),
        ),
      );
      const sourceLedgerEntryId = await grantProjectionCredits(database, {
        amount: subscription.creditsPerMonth,
        catalogVersion: subscription.catalogVersion,
        createdAt: input.asOf,
        creditType: "subscription_credit",
        eventId: subscription.sourcePaymentEventId,
        orderId: subscription.orderId,
        policyVersion: subscription.countryPolicyVersion,
        productCode: subscription.productCode,
        productVersion: subscription.productVersion,
        reason: "stripe_annual_subscription_month_due",
        subscriptionPeriodId: allocationKey,
        termsVersion: subscription.termsVersion,
        userId: subscription.userId,
      });
      await database.commercialSubscriptionPeriodV2.create({
        data: {
          allocationKey,
          createdAt: input.asOf,
          creditsGranted: subscription.creditsPerMonth,
          periodEnd,
          periodStart,
          providerInvoiceId: null,
          sourceLedgerEntryId,
          sourcePaymentEventId: subscription.sourcePaymentEventId,
          subscriptionId: subscription.subscriptionId,
        },
      });
      const details = JSON.stringify({
        allocationKey,
        creditsGranted: subscription.creditsPerMonth,
      });
      await database.$executeRaw`
        INSERT INTO commercial_commerce_audit_v2 (
          user_id, order_id, subscription_id, payment_event_id,
          action, outcome, details, created_at
        ) VALUES (
          ${subscription.userId}::uuid,
          ${subscription.orderId}::uuid,
          ${subscription.subscriptionId}::uuid,
          ${subscription.sourcePaymentEventId}::uuid,
          'stripe_annual_credit_due',
          'applied',
          ${details}::jsonb,
          ${input.asOf}
        )
      `;
      allocations += 1;
    }
  }
  return allocations;
};

export const createCommercialPaymentEventPersistence = (
  database: PrismaClient,
): CommercialPaymentEventPersistence =>
  Object.freeze({
    async claimPaymentStateOutbox(input) {
      await assertCommercialPaymentWebhookRuntimeDatabasePrivileges(database);
      const claimedAt = requireInstant(input.claimedAt);
      const leasedUntil = requireInstant(input.leasedUntil);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      if (
        leasedUntil <= claimedAt ||
        leasedUntil.getTime() - claimedAt.getTime() > 5 * 60 * 1_000
      ) {
        throw new TypeError("Commercial payment outbox lease is invalid.");
      }
      const claimed = await database.$queryRaw<OutboxClaimRow[]>`
        WITH exhausted AS (
          UPDATE commercial_payment_outbox_v2
          SET delivery_state = 'dead_lettered',
              lease_token_hash = NULL,
              leased_until = NULL,
              last_failure_code = 'max_attempts',
              dead_lettered_at = ${claimedAt}
          WHERE delivery_state = 'leased'
            AND leased_until <= ${claimedAt}
            AND attempt_count >= 20
          RETURNING id
        ),
        candidate AS (
          SELECT id
          FROM commercial_payment_outbox_v2
          WHERE attempt_count < 20
            AND (
              (
                delivery_state = 'pending'
                AND available_at <= ${claimedAt}
              )
              OR (
                delivery_state = 'leased'
                AND leased_until <= ${claimedAt}
              )
            )
          ORDER BY available_at, created_at, id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE commercial_payment_outbox_v2 AS outbox
        SET delivery_state = 'leased',
            attempt_count = outbox.attempt_count + 1,
            lease_token_hash = ${leaseTokenHash},
            leased_until = ${leasedUntil},
            last_failure_code = NULL
        FROM candidate
        WHERE outbox.id = candidate.id
        RETURNING
          outbox.attempt_count AS "attemptCount",
          outbox.leased_until AS "leaseExpiresAt",
          outbox.order_id AS "orderId",
          outbox.order_status AS "orderStatus",
          outbox.id AS "outboxId",
          outbox.payment_attempt_id AS "paymentAttemptId",
          outbox.payment_attempt_state AS "paymentAttemptState",
          outbox.payment_event_id AS "paymentEventId",
          outbox.payment_state_version AS "paymentStateVersion",
          outbox.schema_version AS "schemaVersion",
          outbox.topic
      `;
      const claim = claimed.at(0);
      return claim === undefined
        ? null
        : Object.freeze({
            ...claim,
            leaseExpiresAt: claim.leaseExpiresAt.toISOString(),
          });
    },

    async completePaymentStateOutbox(input) {
      await assertCommercialPaymentWebhookRuntimeDatabasePrivileges(database);
      if (!uuidV4Pattern.test(input.outboxId)) {
        throw new TypeError("Commercial payment outbox ID is invalid.");
      }
      const completedAt = requireInstant(input.completedAt);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      const completed = await database.$executeRaw`
        UPDATE commercial_payment_outbox_v2
        SET delivery_state = 'completed',
            lease_token_hash = NULL,
            leased_until = NULL,
            completed_at = ${completedAt},
            last_failure_code = NULL
        WHERE id = ${input.outboxId}::uuid
          AND delivery_state = 'leased'
          AND lease_token_hash = ${leaseTokenHash}
          AND leased_until >= ${completedAt}
      `;
      return completed === 1;
    },

    async failPaymentStateOutbox(input) {
      await assertCommercialPaymentWebhookRuntimeDatabasePrivileges(database);
      if (
        !uuidV4Pattern.test(input.outboxId) ||
        !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(input.failureCode)
      ) {
        throw new TypeError("Commercial payment outbox failure is invalid.");
      }
      const failedAt = requireInstant(input.failedAt);
      const retryAt = input.retryAt === null ? null : requireInstant(input.retryAt);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      if (retryAt !== null && retryAt <= failedAt) {
        throw new TypeError("Commercial payment outbox retry is invalid.");
      }
      const failed = await database.$queryRaw<Readonly<{ deliveryState: string }>[]>`
        UPDATE commercial_payment_outbox_v2
        SET delivery_state =
              CASE
                WHEN ${retryAt}::timestamptz IS NOT NULL AND attempt_count < 20
                  THEN 'pending'
                ELSE 'dead_lettered'
              END,
            available_at = COALESCE(${retryAt}::timestamptz, available_at),
            lease_token_hash = NULL,
            leased_until = NULL,
            last_failure_code = ${input.failureCode},
            dead_lettered_at =
              CASE
                WHEN ${retryAt}::timestamptz IS NOT NULL AND attempt_count < 20
                  THEN NULL::timestamptz
                ELSE ${failedAt}::timestamptz
              END
        WHERE id = ${input.outboxId}::uuid
          AND delivery_state = 'leased'
          AND lease_token_hash = ${leaseTokenHash}
          AND leased_until >= ${failedAt}
        RETURNING delivery_state AS "deliveryState"
      `;
      const state = failed.at(0)?.deliveryState;
      return state === undefined ? null : state === "pending" ? "retry_wait" : "dead_lettered";
    },

    async reconcileDueAnnualSubscriptionCredits(input) {
      await assertCommercialPaymentWebhookRuntimeDatabasePrivileges(database);
      if (!uuidV4Pattern.test(input.userId)) {
        throw new TypeError("Commercial subscription user ID is invalid.");
      }
      const asOf = requireInstant(input.asOf);
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          return await database.$transaction(
            (transaction) =>
              reconcileAnnualCreditsInTransaction(transaction, { asOf, userId: input.userId }),
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 5) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new CommercialPaymentEventPersistenceError("COMMERCIAL_PAYMENT_EVENT_UNAVAILABLE");
    },

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
      if (input.providerInvoiceId !== null) requireResource(input.providerInvoiceId);
      if (input.providerSubscriptionId !== null) requireResource(input.providerSubscriptionId);
      const hasSubscriptionContext = input.providerSubscriptionId !== null;
      if (
        hasSubscriptionContext !== (input.subscriptionState !== null) ||
        hasSubscriptionContext !== (input.subscriptionCancelAtPeriodEnd !== null) ||
        hasSubscriptionContext !== (input.subscriptionPeriodStart !== null) ||
        hasSubscriptionContext !== (input.subscriptionPeriodEnd !== null) ||
        (input.providerInvoiceId !== null && !hasSubscriptionContext)
      ) {
        throw new TypeError("Commercial payment subscription context is invalid.");
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
