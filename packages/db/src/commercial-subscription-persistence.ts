import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const checkoutPattern = /^cs_test_[A-Za-z0-9_]{8,247}$/u;
const subscriptionPattern = /^sub_[A-Za-z0-9_]{8,251}$/u;
const invoicePattern = /^in_[A-Za-z0-9_]{8,252}$/u;
const providerEventPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,254}$/u;
const resourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const maximumLeaseMilliseconds = 5 * 60 * 1_000;
const subscriptionIdempotencyKeyVersion = "commercial.subscription.v1";
const subscriptionTermsVersion = "commercial.subscription.terms.v1";
const subscriptionPolicyVersion = "commercial.subscription.lifecycle.v1";

export const commercialSubscriptionEventTypes = Object.freeze([
  "subscription_created",
  "subscription_period_paid",
  "subscription_payment_failed",
  "subscription_grace_expired",
  "subscription_changed",
  "subscription_cancel_scheduled",
  "subscription_cancelled",
  "subscription_refunded",
  "subscription_disputed",
] as const);
export type CommercialSubscriptionEventType = (typeof commercialSubscriptionEventTypes)[number];

export const commercialSubscriptionPersistenceErrorCodes = Object.freeze([
  "COMMERCIAL_SUBSCRIPTION_CONFLICT",
  "COMMERCIAL_SUBSCRIPTION_NOT_FOUND",
  "COMMERCIAL_SUBSCRIPTION_UNAVAILABLE",
] as const);
export type CommercialSubscriptionPersistenceErrorCode =
  (typeof commercialSubscriptionPersistenceErrorCodes)[number];

export class CommercialSubscriptionPersistenceError extends Error {
  readonly code: CommercialSubscriptionPersistenceErrorCode;
  readonly eventId: string | null;

  constructor(code: CommercialSubscriptionPersistenceErrorCode, eventId: string | null = null) {
    super("The commercial subscription operation could not be completed.");
    this.name = "CommercialSubscriptionPersistenceError";
    this.code = code;
    this.eventId = eventId;
  }
}

export type CommercialSubscriptionState =
  | "pending"
  | "active"
  | "grace_period"
  | "past_due"
  | "cancel_at_period_end"
  | "cancelled"
  | "refunded"
  | "disputed";

export type PreparedCommercialSubscription = Readonly<{
  catalogVersion: string;
  createdAt: string;
  fulfillmentCode: string;
  priceId: string;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerAccountFingerprint: string;
  sourceOrderId: string;
  subscriptionInterval: "month" | "year";
  userId: string;
}>;

export type PreparedCommercialSubscriptionEvent = Readonly<{
  amountMinor: number | null;
  cancelAtPeriodEnd: boolean;
  currencyCode: string | null;
  eventType: CommercialSubscriptionEventType;
  occurredAt: string;
  payloadDigest: Uint8Array;
  periodEndsAt: string | null;
  periodStartsAt: string | null;
  providerAccountFingerprint: string;
  providerEventId: string;
  providerInvoiceId: string | null;
  providerSubscriptionId: string;
  productCode: string;
  receivedAt: string;
  sourceOrderId: string;
  subscriptionInterval: "month" | "year";
}>;

export type CommercialSubscriptionAllocationClaim = Readonly<{
  allocationId: string;
  amount: 8;
  attempt: number;
  leaseExpiresAt: string;
  outboxId: string;
  subscriptionPeriodId: string;
}>;

export type ProcessedCommercialSubscriptionEvent = Readonly<{
  allocationsScheduled: number;
  disposition: "applied" | "duplicate" | "ignored_out_of_order" | "review_required";
  refundDisposition: "not_applicable" | "reversed" | "review_required";
  state: CommercialSubscriptionState;
  subscriptionId: string;
}>;

export type IngestedCommercialSubscriptionEvent = Readonly<{
  disposition: "duplicate" | "queued";
  eventId: string;
}>;

export type CommercialSubscriptionAllocationResult = Readonly<{
  allocationId: string;
  disposition: "duplicate" | "granted" | "skipped";
  subscriptionId: string;
  userId: string;
}>;

export type CommercialSubscriptionPersistence = Readonly<{
  attachStripeCheckout(input: {
    attachedAt: string;
    providerCheckoutId: string;
    sourceOrderId: string;
    userId: string;
  }): Promise<Readonly<{ kind: "attached" | "replayed"; subscriptionId: string }>>;
  fulfillAllocation(input: {
    completedAt: string;
    leaseTokenHash: Uint8Array;
    outboxId: string;
  }): Promise<CommercialSubscriptionAllocationResult | null>;
  claimNextAllocation(input: {
    claimedAt: string;
    leaseTokenHash: Uint8Array;
    leasedUntil: string;
  }): Promise<CommercialSubscriptionAllocationClaim | null>;
  createOrReplaySubscription(
    input: PreparedCommercialSubscription,
  ): Promise<Readonly<{ kind: "created" | "replayed"; subscriptionId: string }>>;
  ingestStripeSandboxEvent(
    input: PreparedCommercialSubscriptionEvent,
  ): Promise<IngestedCommercialSubscriptionEvent>;
  processNextSubscriptionEvent(): Promise<ProcessedCommercialSubscriptionEvent | null>;
  quarantineSubscriptionEvent(input: {
    eventId: string;
    processedAt: string;
  }): Promise<Readonly<{ eventId: string }> | null>;
  failAllocation(input: {
    failedAt: string;
    leaseTokenHash: Uint8Array;
    outboxId: string;
    retryAt: string | null;
  }): Promise<"dead_lettered" | "retry_wait" | null>;
}>;

type SubscriptionRow = Readonly<{
  amountMinor: number;
  cancelAtPeriodEnd: boolean;
  catalogVersion: string;
  createdAt: Date;
  currentPeriodEndsAt: Date | null;
  currentPeriodStartsAt: Date | null;
  currencyCode: string;
  fulfillmentCode: string;
  id: string;
  priceId: string;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerAccountFingerprint: string;
  providerCheckoutId: string;
  providerSubscriptionId: string | null;
  sourceOrderId: string;
  state: CommercialSubscriptionState;
  subscriptionInterval: "month" | "year";
  updatedAt: Date;
  userId: string;
  version: number;
}>;

type EventRow = Readonly<{
  cancelAtPeriodEnd: boolean;
  eventType: CommercialSubscriptionEventType;
  id: string;
  occurredAt: Date;
  periodEndsAt: Date | null;
  periodStartsAt: Date | null;
  providerEventId: string;
  providerInvoiceId: string | null;
}>;

type PendingEventRow = Readonly<{
  amountMinor: number;
  cancelAtPeriodEnd: boolean;
  currencyCode: string;
  eventType: CommercialSubscriptionEventType;
  id: string;
  occurredAt: Date;
  payloadDigest: Uint8Array;
  periodEndsAt: Date | null;
  periodStartsAt: Date | null;
  providerAccountFingerprint: string;
  providerCheckoutId: string;
  providerEventId: string;
  providerInvoiceId: string | null;
  providerSubscriptionId: string;
  productCode: string;
  receivedAt: Date;
  sourceOrderId: string;
  subscriptionInterval: "month" | "year";
}>;

type SubscriptionWebhookPrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canInsertEvent: boolean;
  canMutateCredit: boolean;
  canMutateEntitlement: boolean;
  canReadCredit: boolean;
  canReadEntitlement: boolean;
  canReadEvent: boolean;
  canReadOrder: boolean;
  canReadSubscription: boolean;
  canUpdateEvent: boolean;
  canUpdateSubscription: boolean;
  privilegedRole: boolean;
  roleName: string;
}>;

const subscriptionWebhookPrivilegeAttestations = new WeakMap<PrismaClient, Promise<void>>();

const assertSubscriptionWebhookRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const existing = subscriptionWebhookPrivilegeAttestations.get(database);
  if (existing !== undefined) return existing;
  const attestation = database.$queryRaw<SubscriptionWebhookPrivilegeRow[]>`
      SELECT current_user AS "roleName",
        has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateInDatabase",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
        has_table_privilege(current_user, 'public.commercial_order_v2', 'SELECT') AS "canReadOrder",
        has_table_privilege(current_user, 'public.commercial_subscription_v1', 'SELECT') AS "canReadSubscription",
        has_any_column_privilege(current_user, 'public.commercial_subscription_v1', 'UPDATE') AS "canUpdateSubscription",
        has_table_privilege(current_user, 'public.commercial_subscription_event_v1', 'SELECT') AS "canReadEvent",
        has_table_privilege(current_user, 'public.commercial_subscription_event_v1', 'INSERT') AS "canInsertEvent",
        has_any_column_privilege(current_user, 'public.commercial_subscription_event_v1', 'UPDATE') AS "canUpdateEvent",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'SELECT') AS "canReadCredit",
        has_any_column_privilege(current_user, 'public.credit_ledger_entry', 'INSERT,UPDATE') AS "canMutateCredit",
        has_table_privilege(current_user, 'public.commercial_entitlement_v2', 'SELECT') AS "canReadEntitlement",
        has_any_column_privilege(current_user, 'public.commercial_entitlement_v2', 'INSERT,UPDATE') AS "canMutateEntitlement",
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
        !privilege.canReadSubscription ||
        privilege.canUpdateSubscription ||
        !privilege.canReadEvent ||
        !privilege.canInsertEvent ||
        privilege.canUpdateEvent ||
        privilege.canReadCredit ||
        privilege.canMutateCredit ||
        privilege.canReadEntitlement ||
        privilege.canMutateEntitlement ||
        privilege.privilegedRole
      ) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_UNAVAILABLE");
      }
    })
    .catch((error: unknown) => {
      subscriptionWebhookPrivilegeAttestations.delete(database);
      if (error instanceof CommercialSubscriptionPersistenceError) throw error;
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_UNAVAILABLE");
    });
  subscriptionWebhookPrivilegeAttestations.set(database, attestation);
  return attestation;
};

const requireUuid = (value: string): string => {
  if (!uuidV4Pattern.test(value))
    throw new TypeError("Commercial subscription identifier is invalid.");
  return value;
};

const requireInstant = (value: string): Date => {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== value) {
    throw new TypeError("Commercial subscription instant is invalid.");
  }
  return instant;
};

const requireDigest = (value: Uint8Array): Uint8Array => {
  if (value.byteLength !== 32) throw new TypeError("Commercial subscription digest is invalid.");
  return new Uint8Array(value);
};

const requireResource = (value: string): string => {
  if (!resourcePattern.test(value))
    throw new TypeError("Commercial subscription reference is invalid.");
  return value;
};

const digest = async (value: string): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const digestsEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left.at(index)! ^ right.at(index)!;
  }
  return difference === 0;
};

const isSerializationFailure = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2034" ||
    (error.code === "P2010" &&
      (error.meta as { driverAdapterError?: { cause?: { originalCode?: unknown } } } | undefined)
        ?.driverAdapterError?.cause?.originalCode === "40001"));

const eventRank = new Map<CommercialSubscriptionEventType, number>([
  ["subscription_created", 0],
  ["subscription_period_paid", 1],
  ["subscription_changed", 2],
  ["subscription_payment_failed", 3],
  ["subscription_grace_expired", 4],
  ["subscription_cancel_scheduled", 5],
  ["subscription_cancelled", 6],
  ["subscription_refunded", 7],
  ["subscription_disputed", 8],
]);

const reduceSubscriptionEvents = (
  events: readonly EventRow[],
): Readonly<{
  cancelAtPeriodEnd: boolean;
  currentPeriodEndsAt: Date | null;
  currentPeriodStartsAt: Date | null;
  state: CommercialSubscriptionState;
}> => {
  let state: CommercialSubscriptionState = "pending";
  let cancelAtPeriodEnd = false;
  let currentPeriodStartsAt: Date | null = null;
  let currentPeriodEndsAt: Date | null = null;
  for (const event of [...events].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() ||
      eventRank.get(left.eventType)! - eventRank.get(right.eventType)! ||
      left.providerEventId.localeCompare(right.providerEventId),
  )) {
    if (event.eventType === "subscription_period_paid") {
      state = event.cancelAtPeriodEnd ? "cancel_at_period_end" : "active";
      cancelAtPeriodEnd = event.cancelAtPeriodEnd;
      currentPeriodStartsAt = event.periodStartsAt;
      currentPeriodEndsAt = event.periodEndsAt;
    } else if (event.eventType === "subscription_payment_failed") {
      if (["pending", "active", "cancel_at_period_end", "grace_period"].includes(state))
        state = "grace_period";
    } else if (event.eventType === "subscription_grace_expired") {
      if (state === "grace_period") state = "past_due";
    } else if (event.eventType === "subscription_cancel_scheduled") {
      if (!["cancelled", "refunded", "disputed"].includes(state)) {
        state = "cancel_at_period_end";
        cancelAtPeriodEnd = true;
      }
    } else if (event.eventType === "subscription_changed") {
      if (!["cancelled", "refunded", "disputed"].includes(state)) {
        cancelAtPeriodEnd = event.cancelAtPeriodEnd;
        state = cancelAtPeriodEnd
          ? "cancel_at_period_end"
          : state === "pending"
            ? "pending"
            : "active";
      }
    } else if (event.eventType === "subscription_cancelled") {
      if (!["refunded", "disputed"].includes(state)) state = "cancelled";
    } else if (event.eventType === "subscription_refunded") {
      state = "refunded";
    } else if (event.eventType === "subscription_disputed") {
      state = "disputed";
    }
  }
  return Object.freeze({ cancelAtPeriodEnd, currentPeriodEndsAt, currentPeriodStartsAt, state });
};

const subscriptionRowsMatch = (
  row: SubscriptionRow,
  input: PreparedCommercialSubscription,
  sourceOrderId: string,
): boolean =>
  row.userId === input.userId &&
  row.sourceOrderId === sourceOrderId &&
  row.providerAccountFingerprint === input.providerAccountFingerprint &&
  row.catalogVersion === input.catalogVersion &&
  row.productCode === input.productCode &&
  row.productVersion === input.productVersion &&
  row.priceId === input.priceId &&
  row.priceVersion === input.priceVersion &&
  row.fulfillmentCode === input.fulfillmentCode &&
  row.subscriptionInterval === input.subscriptionInterval;

const pendingCheckoutId = (sourceOrderId: string): string =>
  `cs_test_pending_${sourceOrderId.replaceAll("-", "")}`;

const addUtcMonths = (start: Date, months: number): Date => {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const day = start.getUTCDate();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      Math.min(day, lastDay),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
};

const entitlementState = (
  state: CommercialSubscriptionState,
): "active" | "frozen" | "revoked" | null =>
  state === "active" || state === "cancel_at_period_end"
    ? "active"
    : state === "grace_period" || state === "past_due" || state === "disputed"
      ? "frozen"
      : state === "cancelled" || state === "refunded"
        ? "revoked"
        : null;

const subscriptionFromDatabase = (row: {
  amountMinor?: number;
  cancelAtPeriodEnd: boolean;
  catalogVersion: string;
  createdAt: Date;
  currentPeriodEndsAt: Date | null;
  currentPeriodStartsAt: Date | null;
  currencyCode?: string;
  fulfillmentCode: string;
  id: string;
  priceId: string;
  priceVersion: string;
  productCode: string;
  productVersion: string;
  providerAccountFingerprint: string;
  providerCheckoutId: string;
  providerSubscriptionId: string | null;
  sourceOrderId: string;
  state: string;
  subscriptionInterval: string;
  updatedAt: Date;
  userId: string;
  version: number;
}): SubscriptionRow =>
  Object.freeze({
    ...row,
    amountMinor: row.amountMinor ?? 0,
    currencyCode: row.currencyCode ?? "",
    state: row.state as CommercialSubscriptionState,
    subscriptionInterval: row.subscriptionInterval as "month" | "year",
  });

const loadSubscriptionForEvent = async (
  database: Prisma.TransactionClient,
  input: PreparedCommercialSubscriptionEvent,
): Promise<SubscriptionRow> => {
  const rows = await database.$queryRaw<SubscriptionRow[]>`
    SELECT
      subscription.id, subscription.user_id AS "userId",
      source_order.total_minor AS "amountMinor", source_order.currency_code AS "currencyCode",
      subscription.source_order_id AS "sourceOrderId",
      subscription.catalog_version AS "catalogVersion",
      subscription.product_code AS "productCode",
      subscription.product_version AS "productVersion",
      subscription.price_id AS "priceId", subscription.price_version AS "priceVersion",
      subscription.fulfillment_code AS "fulfillmentCode",
      subscription.provider_account_fingerprint AS "providerAccountFingerprint",
      subscription.provider_checkout_id AS "providerCheckoutId",
      subscription.provider_subscription_id AS "providerSubscriptionId",
      subscription.subscription_interval AS "subscriptionInterval", subscription.state,
      subscription.cancel_at_period_end AS "cancelAtPeriodEnd",
      subscription.current_period_starts_at AS "currentPeriodStartsAt",
      subscription.current_period_ends_at AS "currentPeriodEndsAt",
      subscription.created_at AS "createdAt", subscription.updated_at AS "updatedAt",
      subscription.version
    FROM commercial_subscription_v1 AS subscription
    JOIN commercial_order_v2 AS source_order ON source_order.id = subscription.source_order_id
    WHERE subscription.provider = 'stripe'
      AND subscription.environment = 'sandbox'
      AND subscription.provider_account_fingerprint = ${input.providerAccountFingerprint}
      AND source_order.public_id = ${input.sourceOrderId}::uuid
  `;
  const row = rows.at(0);
  if (row === undefined)
    throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_NOT_FOUND");
  if (
    row.providerSubscriptionId !== null &&
    row.providerSubscriptionId !== input.providerSubscriptionId
  ) {
    throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
  }
  if (
    row.productCode !== input.productCode ||
    row.subscriptionInterval !== input.subscriptionInterval ||
    (input.amountMinor !== null &&
      (row.amountMinor !== input.amountMinor || row.currencyCode !== input.currencyCode))
  ) {
    throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
  }
  return subscriptionFromDatabase(row);
};

const loadSubscriptionByCheckoutForUpdate = async (
  database: Prisma.TransactionClient,
  providerAccountFingerprint: string,
  providerCheckoutId: string,
): Promise<SubscriptionRow> => {
  const rows = await database.$queryRaw<SubscriptionRow[]>`
    SELECT
      subscription.id, subscription.user_id AS "userId",
      source_order.total_minor AS "amountMinor", source_order.currency_code AS "currencyCode",
      subscription.source_order_id AS "sourceOrderId",
      subscription.catalog_version AS "catalogVersion",
      subscription.product_code AS "productCode",
      subscription.product_version AS "productVersion",
      subscription.price_id AS "priceId", subscription.price_version AS "priceVersion",
      subscription.fulfillment_code AS "fulfillmentCode",
      subscription.provider_account_fingerprint AS "providerAccountFingerprint",
      subscription.provider_checkout_id AS "providerCheckoutId",
      subscription.provider_subscription_id AS "providerSubscriptionId",
      subscription.subscription_interval AS "subscriptionInterval", subscription.state,
      subscription.cancel_at_period_end AS "cancelAtPeriodEnd",
      subscription.current_period_starts_at AS "currentPeriodStartsAt",
      subscription.current_period_ends_at AS "currentPeriodEndsAt",
      subscription.created_at AS "createdAt", subscription.updated_at AS "updatedAt",
      subscription.version
    FROM commercial_subscription_v1 AS subscription
    JOIN commercial_order_v2 AS source_order ON source_order.id = subscription.source_order_id
    WHERE subscription.provider = 'stripe'
      AND subscription.environment = 'sandbox'
      AND subscription.provider_account_fingerprint = ${providerAccountFingerprint}
      AND subscription.provider_checkout_id = ${providerCheckoutId}
    FOR UPDATE OF subscription
  `;
  const row = rows.at(0);
  if (row === undefined)
    throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_NOT_FOUND");
  return subscriptionFromDatabase(row);
};

const syncEntitlement = async (
  database: Prisma.TransactionClient,
  subscription: SubscriptionRow,
  state: CommercialSubscriptionState,
  updatedAt: Date,
): Promise<void> => {
  const nextState = entitlementState(state);
  if (nextState === null) return;
  const identityDigest = await digest(`subscription-entitlement:${subscription.id}`);
  const frozenAt = nextState === "frozen" ? updatedAt : null;
  const revokedAt = nextState === "revoked" ? updatedAt : null;
  await database.$executeRaw`
    INSERT INTO commercial_entitlement_v2 (
      user_id, entitlement_type, catalog_version, product_code, product_version, fulfillment_code,
      status, source_order_id, source_ledger_entry_id, idempotency_key_version, idempotency_key_hash,
      canonical_request_hash, granted_at, frozen_at, revoked_at, version
    ) VALUES (
      ${subscription.userId}::uuid, 'plus', ${subscription.catalogVersion},
      ${subscription.productCode}, ${subscription.productVersion}, 'plus.membership', ${nextState},
      ${subscription.sourceOrderId}::uuid, NULL, ${subscriptionIdempotencyKeyVersion}, ${identityDigest},
      ${identityDigest}, ${subscription.createdAt}, ${frozenAt}, ${revokedAt}, 1
    ) ON CONFLICT (user_id, entitlement_type, fulfillment_code) DO UPDATE
    SET catalog_version = EXCLUDED.catalog_version,
        product_code = EXCLUDED.product_code,
        product_version = EXCLUDED.product_version,
        status = EXCLUDED.status,
        source_order_id = EXCLUDED.source_order_id,
        frozen_at = EXCLUDED.frozen_at,
        revoked_at = EXCLUDED.revoked_at,
        version = commercial_entitlement_v2.version + 1
  `;
};

const schedulePaidPeriod = async (
  database: Prisma.TransactionClient,
  subscription: SubscriptionRow,
  event: PreparedCommercialSubscriptionEvent,
  eventId: string,
): Promise<number> => {
  if (
    event.providerInvoiceId === null ||
    event.periodStartsAt === null ||
    event.periodEndsAt === null ||
    event.eventType !== "subscription_period_paid"
  ) {
    return 0;
  }
  const periodStartsAt = requireInstant(event.periodStartsAt);
  const periodEndsAt = requireInstant(event.periodEndsAt);
  const periodRows = await database.$queryRaw<Readonly<{ id: string }>[]>`
    INSERT INTO commercial_subscription_period_v1 (
      subscription_id, provider, environment, provider_account_fingerprint, provider_invoice_id,
      period_starts_at, period_ends_at, state, created_at
    ) VALUES (
      ${subscription.id}::uuid, 'stripe', 'sandbox', ${event.providerAccountFingerprint},
      ${event.providerInvoiceId}, ${periodStartsAt}, ${periodEndsAt}, 'paid', ${requireInstant(event.receivedAt)}
    ) ON CONFLICT (subscription_id, provider_invoice_id) DO NOTHING
    RETURNING id
  `;
  const period = periodRows.at(0);
  if (period === undefined) return 0;
  const allocations = subscription.subscriptionInterval === "year" ? 12 : 1;
  for (let allocationIndex = 0; allocationIndex < allocations; allocationIndex += 1) {
    const availableAt = addUtcMonths(periodStartsAt, allocationIndex);
    const expiresAt =
      allocationIndex + 1 === allocations
        ? periodEndsAt
        : addUtcMonths(periodStartsAt, allocationIndex + 1);
    const allocationRows = await database.$queryRaw<Readonly<{ id: string }>[]>`
      INSERT INTO commercial_subscription_allocation_v1 (
        subscription_period_id, allocation_index, amount, available_at, expires_at, state, created_at
      ) VALUES (
        ${period.id}::uuid, ${allocationIndex}, 8, ${availableAt}, ${expiresAt}, 'pending',
        ${requireInstant(event.receivedAt)}
      ) RETURNING id
    `;
    const allocation = allocationRows.at(0);
    if (allocation !== undefined && availableAt <= requireInstant(event.receivedAt)) {
      await database.$executeRaw`
        INSERT INTO commercial_subscription_outbox_v1 (
          allocation_id, source_event_id, delivery_state, available_at, created_at
        ) VALUES (
          ${allocation.id}::uuid, ${eventId}::uuid, 'pending', ${availableAt}, ${requireInstant(event.receivedAt)}
        ) ON CONFLICT (allocation_id) DO NOTHING
      `;
    }
  }
  return allocations;
};

const cancelPendingAllocations = async (
  database: Prisma.TransactionClient,
  subscriptionId: string,
  providerInvoiceId: string | null = null,
): Promise<void> => {
  await database.$executeRaw`
    UPDATE commercial_subscription_allocation_v1 AS allocation
    SET state = 'cancelled'
    FROM commercial_subscription_period_v1 AS period
    WHERE allocation.subscription_period_id = period.id
      AND period.subscription_id = ${subscriptionId}::uuid
      AND (${providerInvoiceId}::text IS NULL OR period.provider_invoice_id = ${providerInvoiceId})
      AND allocation.state = 'pending'
  `;
};

const reverseRefundableCredits = async (
  database: Prisma.TransactionClient,
  subscription: SubscriptionRow,
  providerInvoiceId: string,
  refundedAt: Date,
): Promise<"reversed" | "review_required"> => {
  const periods = await database.commercialSubscriptionPeriodV1.count({
    where: { providerInvoiceId, subscriptionId: subscription.id },
  });
  if (periods !== 1) {
    throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
  }
  await cancelPendingAllocations(database, subscription.id, providerInvoiceId);
  const grants = await database.$queryRaw<
    Readonly<{
      allocationId: string;
      amount: number;
      sourceLedgerEntryId: string;
      restrictedAmount: number;
      reversed: boolean;
    }>[]
  >`
    SELECT
      allocation.id AS "allocationId", allocation.amount, allocation.source_ledger_entry_id AS "sourceLedgerEntryId",
      COALESCE(SUM(CASE WHEN reservation.status IN ('active', 'consumed') THEN credit_allocation.amount ELSE 0 END), 0)::integer AS "restrictedAmount",
      EXISTS (
        SELECT 1 FROM credit_ledger_entry AS reversed
        WHERE reversed.source_entry_id = allocation.source_ledger_entry_id
          AND reversed.direction = 'reverse'
      ) AS reversed
    FROM commercial_subscription_allocation_v1 AS allocation
    JOIN commercial_subscription_period_v1 AS period ON period.id = allocation.subscription_period_id
    LEFT JOIN credit_allocation ON credit_allocation.source_entry_id = allocation.source_ledger_entry_id
    LEFT JOIN credit_reservation AS reservation ON reservation.id = credit_allocation.reservation_id
    WHERE period.subscription_id = ${subscription.id}::uuid
      AND period.provider_invoice_id = ${providerInvoiceId}
      AND allocation.state = 'granted'
    GROUP BY allocation.id, allocation.amount, allocation.source_ledger_entry_id
    ORDER BY allocation.id
  `;
  if (
    grants.some(
      (grant) =>
        grant.sourceLedgerEntryId.length === 0 || grant.restrictedAmount > 0 || grant.reversed,
    )
  ) {
    return "review_required";
  }
  for (const grant of grants) {
    const reversalDigest = await digest(`subscription-refund:${grant.allocationId}`);
    const inserted = await database.$queryRaw<Readonly<{ id: string }>[]>`
      INSERT INTO credit_ledger_entry (
        user_id, credit_type, direction, amount, reason, catalog_version, product_code, product_version,
        order_id, subscription_period_id, reservation_id, generation_id, source_entry_id, operation,
        idempotency_key_version, idempotency_key_hash, canonical_request_hash, policy_version,
        terms_version, created_at
      ) VALUES (
        ${subscription.userId}::uuid, 'subscription_credit', 'reverse', ${grant.amount},
        'subscription_refund', ${subscription.catalogVersion}, ${subscription.productCode},
        ${subscription.productVersion}, ${subscription.sourceOrderId}::uuid, NULL, NULL, NULL,
        ${grant.sourceLedgerEntryId}::uuid, 'credit.reverse.subscription_refund',
        ${subscriptionIdempotencyKeyVersion}, ${reversalDigest}, ${reversalDigest},
        ${subscriptionPolicyVersion}, ${subscriptionTermsVersion}, ${refundedAt}
      ) ON CONFLICT (user_id, operation, idempotency_key_version, idempotency_key_hash) DO NOTHING
      RETURNING id
    `;
    if (inserted.length !== 1) return "review_required";
    const updated = await database.$executeRaw`
      UPDATE credit_projection
      SET subscription_available = subscription_available - ${grant.amount},
          version = version + 1,
          updated_at = ${refundedAt}
      WHERE user_id = ${subscription.userId}::uuid
        AND subscription_available >= ${grant.amount}
    `;
    if (updated !== 1)
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
  }
  return "reversed";
};

const eventsMatch = (
  row: {
    cancelAtPeriodEnd: boolean;
    eventType: string;
    occurredAt: Date;
    payloadDigest: Uint8Array;
    periodEndsAt: Date | null;
    periodStartsAt: Date | null;
    providerInvoiceId: string | null;
    providerSubscriptionId: string;
  },
  input: PreparedCommercialSubscriptionEvent,
): boolean =>
  row.eventType === input.eventType &&
  row.providerSubscriptionId === input.providerSubscriptionId &&
  row.providerInvoiceId === input.providerInvoiceId &&
  row.cancelAtPeriodEnd === input.cancelAtPeriodEnd &&
  row.periodStartsAt?.getTime() ===
    (input.periodStartsAt === null ? undefined : requireInstant(input.periodStartsAt).getTime()) &&
  row.periodEndsAt?.getTime() ===
    (input.periodEndsAt === null ? undefined : requireInstant(input.periodEndsAt).getTime()) &&
  row.occurredAt.getTime() === requireInstant(input.occurredAt).getTime() &&
  digestsEqual(row.payloadDigest, input.payloadDigest);

const validateEvent = (input: PreparedCommercialSubscriptionEvent): void => {
  const financialEvent = [
    "subscription_disputed",
    "subscription_payment_failed",
    "subscription_period_paid",
    "subscription_refunded",
  ].includes(input.eventType);
  if (
    !commercialSubscriptionEventTypes.includes(input.eventType) ||
    !uuidV4Pattern.test(input.sourceOrderId) ||
    !subscriptionPattern.test(input.providerSubscriptionId) ||
    !providerEventPattern.test(input.providerEventId) ||
    (input.providerInvoiceId !== null && !invoicePattern.test(input.providerInvoiceId)) ||
    ((input.eventType === "subscription_period_paid" ||
      input.eventType === "subscription_refunded" ||
      input.eventType === "subscription_disputed") &&
      input.providerInvoiceId === null) ||
    !resourcePattern.test(input.productCode) ||
    (input.subscriptionInterval !== "month" && input.subscriptionInterval !== "year") ||
    (financialEvent &&
      (!Number.isSafeInteger(input.amountMinor) ||
        input.amountMinor === null ||
        input.amountMinor <= 0 ||
        input.amountMinor > 2_147_483_647 ||
        input.currencyCode === null ||
        !/^[A-Z]{3}$/u.test(input.currencyCode))) ||
    (!financialEvent && (input.amountMinor !== null || input.currencyCode !== null))
  ) {
    throw new TypeError("Commercial subscription event is invalid.");
  }
  requireResource(input.providerAccountFingerprint);
  requireDigest(input.payloadDigest);
  const occurredAt = requireInstant(input.occurredAt);
  const receivedAt = requireInstant(input.receivedAt);
  const startsAt = input.periodStartsAt === null ? null : requireInstant(input.periodStartsAt);
  const endsAt = input.periodEndsAt === null ? null : requireInstant(input.periodEndsAt);
  if (
    receivedAt < occurredAt ||
    (startsAt === null) !== (endsAt === null) ||
    (startsAt !== null && endsAt! <= startsAt)
  ) {
    throw new TypeError("Commercial subscription event is invalid.");
  }
};

const ingestEvent = async (
  database: Prisma.TransactionClient,
  input: PreparedCommercialSubscriptionEvent,
): Promise<IngestedCommercialSubscriptionEvent> => {
  const subscription = await loadSubscriptionForEvent(database, input);
  const inserted = await database.$queryRaw<Readonly<{ id: string }>[]>`
    INSERT INTO commercial_subscription_event_v1 (
      provider, environment, provider_account_fingerprint, provider_event_id, event_type,
      provider_checkout_id, provider_subscription_id, provider_invoice_id, period_starts_at,
      period_ends_at, cancel_at_period_end, payload_digest, occurred_at, received_at
    ) VALUES (
      'stripe', 'sandbox', ${input.providerAccountFingerprint}, ${input.providerEventId}, ${input.eventType},
      ${subscription.providerCheckoutId}, ${input.providerSubscriptionId}, ${input.providerInvoiceId},
      ${input.periodStartsAt === null ? null : requireInstant(input.periodStartsAt)},
      ${input.periodEndsAt === null ? null : requireInstant(input.periodEndsAt)}, ${input.cancelAtPeriodEnd},
      ${input.payloadDigest}, ${requireInstant(input.occurredAt)}, ${requireInstant(input.receivedAt)}
    ) ON CONFLICT (provider, environment, provider_account_fingerprint, provider_event_id) DO NOTHING
    RETURNING id
  `;
  if (inserted.length === 0) {
    const existing = await database.commercialSubscriptionEventV1.findUnique({
      where: {
        provider_environment_providerAccountFingerprint_providerEventId: {
          environment: "sandbox",
          provider: "stripe",
          providerAccountFingerprint: input.providerAccountFingerprint,
          providerEventId: input.providerEventId,
        },
      },
    });
    if (existing === null)
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_UNAVAILABLE");
    if (!eventsMatch(existing, input)) {
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
    }
    return Object.freeze({
      disposition: "duplicate",
      eventId: existing.id,
    });
  }
  return Object.freeze({ disposition: "queued", eventId: inserted[0]!.id });
};

const applyStoredEvent = async (
  database: Prisma.TransactionClient,
  input: PreparedCommercialSubscriptionEvent,
  eventId: string,
  subscription: SubscriptionRow,
): Promise<ProcessedCommercialSubscriptionEvent> => {
  const previousEvents = await database.$queryRaw<EventRow[]>`
    SELECT id, event_type AS "eventType", provider_event_id AS "providerEventId",
      cancel_at_period_end AS "cancelAtPeriodEnd", period_starts_at AS "periodStartsAt",
      period_ends_at AS "periodEndsAt", provider_invoice_id AS "providerInvoiceId", occurred_at AS "occurredAt"
    FROM commercial_subscription_event_v1
    WHERE provider = 'stripe'
      AND environment = 'sandbox'
      AND provider_account_fingerprint = ${input.providerAccountFingerprint}
      AND provider_checkout_id = ${subscription.providerCheckoutId}
      AND (processing_state = 'processed' OR id = ${eventId}::uuid)
  `;
  const reduced = reduceSubscriptionEvents(previousEvents);
  const allocationsScheduled = await schedulePaidPeriod(database, subscription, input, eventId);
  let refundDisposition: ProcessedCommercialSubscriptionEvent["refundDisposition"] =
    "not_applicable";
  if (input.eventType === "subscription_cancelled")
    await cancelPendingAllocations(database, subscription.id);
  if (input.eventType === "subscription_refunded") {
    refundDisposition = await reverseRefundableCredits(
      database,
      subscription,
      input.providerInvoiceId!,
      requireInstant(input.receivedAt),
    );
  }
  const changed =
    subscription.state !== reduced.state ||
    subscription.cancelAtPeriodEnd !== reduced.cancelAtPeriodEnd ||
    subscription.providerSubscriptionId !== input.providerSubscriptionId ||
    subscription.currentPeriodStartsAt?.getTime() !== reduced.currentPeriodStartsAt?.getTime() ||
    subscription.currentPeriodEndsAt?.getTime() !== reduced.currentPeriodEndsAt?.getTime();
  await database.$executeRaw`
    UPDATE commercial_subscription_v1
    SET provider_subscription_id = ${input.providerSubscriptionId}, state = ${reduced.state},
        cancel_at_period_end = ${reduced.cancelAtPeriodEnd},
        current_period_starts_at = ${reduced.currentPeriodStartsAt},
        current_period_ends_at = ${reduced.currentPeriodEndsAt}, updated_at = ${requireInstant(input.receivedAt)},
        version = version + CASE WHEN ${changed} THEN 1 ELSE 0 END
    WHERE id = ${subscription.id}::uuid
  `;
  const updatedSubscription = Object.freeze({
    ...subscription,
    ...reduced,
    providerSubscriptionId: input.providerSubscriptionId,
    updatedAt: requireInstant(input.receivedAt),
    version: subscription.version + (changed ? 1 : 0),
  });
  await syncEntitlement(
    database,
    updatedSubscription,
    reduced.state,
    requireInstant(input.receivedAt),
  );
  await database.commercialSubscriptionEventV1.update({
    data: {
      processedAt: requireInstant(input.receivedAt),
      processingDisposition:
        changed || allocationsScheduled > 0 || refundDisposition !== "not_applicable"
          ? "applied"
          : "ignored_out_of_order",
      processingState: "processed",
    },
    where: { id: eventId },
  });
  if (refundDisposition === "review_required") {
    await database.commercialSubscriptionReviewV1.upsert({
      create: {
        createdAt: requireInstant(input.receivedAt),
        eventId,
        reason: "refund_credit_restriction",
        subscriptionId: subscription.id,
      },
      update: {},
      where: { eventId },
    });
  }
  return Object.freeze({
    allocationsScheduled,
    disposition:
      refundDisposition === "review_required"
        ? "review_required"
        : changed || allocationsScheduled > 0 || refundDisposition !== "not_applicable"
          ? "applied"
          : "ignored_out_of_order",
    refundDisposition,
    state: reduced.state,
    subscriptionId: subscription.id,
  });
};

const processNextEvent = async (
  database: Prisma.TransactionClient,
): Promise<ProcessedCommercialSubscriptionEvent | null> => {
  const pending = await database.$queryRaw<PendingEventRow[]>`
    SELECT
      event.id, event.provider_account_fingerprint AS "providerAccountFingerprint",
      source_order.total_minor AS "amountMinor", source_order.currency_code AS "currencyCode",
      event.provider_event_id AS "providerEventId", event.event_type AS "eventType",
      event.provider_checkout_id AS "providerCheckoutId",
      event.provider_subscription_id AS "providerSubscriptionId",
      event.provider_invoice_id AS "providerInvoiceId",
      event.period_starts_at AS "periodStartsAt", event.period_ends_at AS "periodEndsAt",
      event.cancel_at_period_end AS "cancelAtPeriodEnd", event.payload_digest AS "payloadDigest",
      event.occurred_at AS "occurredAt", event.received_at AS "receivedAt",
      source_order.public_id AS "sourceOrderId", subscription.product_code AS "productCode",
      subscription.subscription_interval AS "subscriptionInterval"
    FROM commercial_subscription_event_v1 AS event
    JOIN commercial_subscription_v1 AS subscription
      ON subscription.provider = event.provider
      AND subscription.environment = event.environment
      AND subscription.provider_account_fingerprint = event.provider_account_fingerprint
      AND subscription.provider_checkout_id = event.provider_checkout_id
    JOIN commercial_order_v2 AS source_order ON source_order.id = subscription.source_order_id
    WHERE event.processing_state = 'received'
    ORDER BY event.received_at, event.id
    LIMIT 1
    FOR UPDATE OF event SKIP LOCKED
  `;
  const event = pending.at(0);
  if (event === undefined) return null;
  const input: PreparedCommercialSubscriptionEvent = Object.freeze({
    amountMinor: event.amountMinor,
    cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    currencyCode: event.currencyCode,
    eventType: event.eventType,
    occurredAt: event.occurredAt.toISOString(),
    payloadDigest: new Uint8Array(event.payloadDigest),
    periodEndsAt: event.periodEndsAt?.toISOString() ?? null,
    periodStartsAt: event.periodStartsAt?.toISOString() ?? null,
    providerAccountFingerprint: event.providerAccountFingerprint,
    providerEventId: event.providerEventId,
    providerInvoiceId: event.providerInvoiceId,
    providerSubscriptionId: event.providerSubscriptionId,
    productCode: event.productCode,
    receivedAt: event.receivedAt.toISOString(),
    sourceOrderId: event.sourceOrderId,
    subscriptionInterval: event.subscriptionInterval,
  });
  try {
    const subscription = await loadSubscriptionByCheckoutForUpdate(
      database,
      input.providerAccountFingerprint,
      event.providerCheckoutId,
    );
    if (
      subscription.providerSubscriptionId !== null &&
      subscription.providerSubscriptionId !== input.providerSubscriptionId
    ) {
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
    }
    return await applyStoredEvent(database, input, event.id, subscription);
  } catch (error) {
    if (
      error instanceof CommercialSubscriptionPersistenceError &&
      (error.code === "COMMERCIAL_SUBSCRIPTION_CONFLICT" ||
        error.code === "COMMERCIAL_SUBSCRIPTION_NOT_FOUND")
    ) {
      throw new CommercialSubscriptionPersistenceError(error.code, event.id);
    }
    throw error;
  }
};

export const createCommercialSubscriptionPersistence = (
  database: PrismaClient,
): CommercialSubscriptionPersistence =>
  Object.freeze({
    async attachStripeCheckout(input) {
      requireUuid(input.userId);
      requireUuid(input.sourceOrderId);
      if (!checkoutPattern.test(input.providerCheckoutId)) {
        throw new TypeError("Commercial subscription checkout is invalid.");
      }
      const attachedAt = requireInstant(input.attachedAt);
      const order = await database.commercialOrderV2.findFirst({
        where: { publicId: input.sourceOrderId, userId: input.userId },
      });
      if (order === null) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_NOT_FOUND");
      }
      const attempt = await database.commercialPaymentAttemptV2.findUnique({
        where: { orderId_attemptNumber: { attemptNumber: 1, orderId: order.id } },
      });
      if (
        attempt === null ||
        attempt.providerCheckoutId !== input.providerCheckoutId ||
        attempt.state !== "checkout_created"
      ) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
      }
      const subscription = await database.commercialSubscriptionV1.findUnique({
        where: { sourceOrderId: order.id },
      });
      if (subscription === null) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_NOT_FOUND");
      }
      if (subscription.providerCheckoutId === input.providerCheckoutId) {
        return Object.freeze({ kind: "replayed", subscriptionId: subscription.id });
      }
      if (subscription.providerCheckoutId !== pendingCheckoutId(input.sourceOrderId)) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
      }
      const attached = await database.commercialSubscriptionV1.updateMany({
        data: { providerCheckoutId: input.providerCheckoutId, updatedAt: attachedAt },
        where: {
          id: subscription.id,
          providerCheckoutId: pendingCheckoutId(input.sourceOrderId),
          state: "pending",
        },
      });
      if (attached.count !== 1) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
      }
      return Object.freeze({ kind: "attached", subscriptionId: subscription.id });
    },

    async createOrReplaySubscription(input) {
      requireUuid(input.userId);
      requireUuid(input.sourceOrderId);
      if (input.subscriptionInterval !== "month" && input.subscriptionInterval !== "year") {
        throw new TypeError("Commercial subscription checkout is invalid.");
      }
      for (const value of [
        input.catalogVersion,
        input.fulfillmentCode,
        input.priceId,
        input.priceVersion,
        input.productCode,
        input.productVersion,
        input.providerAccountFingerprint,
      ])
        requireResource(value);
      const createdAt = requireInstant(input.createdAt);
      const order = await database.commercialOrderV2.findFirst({
        where: { publicId: input.sourceOrderId, userId: input.userId },
      });
      if (order === null) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_NOT_FOUND");
      }
      const [item, attemptRecord] = await Promise.all([
        database.commercialOrderItemV2.findUnique({ where: { orderId: order.id } }),
        database.commercialPaymentAttemptV2.findUnique({
          where: { orderId_attemptNumber: { attemptNumber: 1, orderId: order.id } },
        }),
      ]);
      if (
        item === null ||
        attemptRecord === null ||
        order.catalogVersion !== input.catalogVersion ||
        order.priceId !== input.priceId ||
        order.priceVersion !== input.priceVersion ||
        item.productCode !== input.productCode ||
        item.productVersion !== input.productVersion ||
        item.fulfillmentKind !== "subscription" ||
        item.fulfillmentCode !== input.fulfillmentCode ||
        item.creditsGranted !== null ||
        item.creditsPerMonth !== 8 ||
        attemptRecord.provider !== "stripe" ||
        attemptRecord.environment !== "sandbox" ||
        attemptRecord.providerAccountFingerprint !== input.providerAccountFingerprint ||
        !["checkout_created", "created"].includes(attemptRecord.state)
      ) {
        throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
      }
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        try {
          const existing = await database.commercialSubscriptionV1.findUnique({
            where: { sourceOrderId: order.id },
          });
          if (existing !== null) {
            const subscription = subscriptionFromDatabase(existing);
            if (!subscriptionRowsMatch(subscription, input, order.id)) {
              throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
            }
            return Object.freeze({ kind: "replayed" as const, subscriptionId: subscription.id });
          }
          const created = await database.commercialSubscriptionV1.create({
            data: {
              catalogVersion: input.catalogVersion,
              createdAt,
              creditsPerMonth: 8,
              environment: "sandbox",
              fulfillmentCode: input.fulfillmentCode,
              priceId: input.priceId,
              priceVersion: input.priceVersion,
              productCode: input.productCode,
              productVersion: input.productVersion,
              provider: "stripe",
              providerAccountFingerprint: input.providerAccountFingerprint,
              providerCheckoutId: pendingCheckoutId(input.sourceOrderId),
              sourceOrderId: order.id,
              subscriptionInterval: input.subscriptionInterval,
              updatedAt: createdAt,
              userId: input.userId,
            },
          });
          return Object.freeze({ kind: "created" as const, subscriptionId: created.id });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const openSubscription = await database.commercialSubscriptionV1.findFirst({
              where: {
                state: {
                  in: ["active", "cancel_at_period_end", "grace_period", "past_due", "pending"],
                },
                userId: input.userId,
              },
            });
            if (openSubscription !== null && openSubscription.sourceOrderId !== order.id) {
              throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_CONFLICT");
            }
          }
          if (
            error instanceof CommercialSubscriptionPersistenceError ||
            (!isSerializationFailure(error) &&
              !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) ||
            attempt === 10
          )
            throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_UNAVAILABLE");
    },

    async ingestStripeSandboxEvent(input) {
      await assertSubscriptionWebhookRuntimeDatabasePrivileges(database);
      validateEvent(input);
      return database.$transaction((transaction) => ingestEvent(transaction, input));
    },

    async processNextSubscriptionEvent() {
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        try {
          return await database.$transaction((transaction) => processNextEvent(transaction), {
            isolationLevel: "Serializable",
          });
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 10) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_UNAVAILABLE");
    },

    async quarantineSubscriptionEvent(input) {
      requireUuid(input.eventId);
      const processedAt = requireInstant(input.processedAt);
      return database.$transaction(async (transaction) => {
        const events = await transaction.$queryRaw<
          Readonly<{ id: string; subscriptionId: string }>[]
        >`
          SELECT event.id, subscription.id AS "subscriptionId"
          FROM commercial_subscription_event_v1 AS event
          JOIN commercial_subscription_v1 AS subscription
            ON subscription.provider = event.provider
            AND subscription.environment = event.environment
            AND subscription.provider_account_fingerprint = event.provider_account_fingerprint
            AND subscription.provider_checkout_id = event.provider_checkout_id
          WHERE event.id = ${input.eventId}::uuid
            AND event.processing_state = 'received'
          FOR UPDATE OF event SKIP LOCKED
        `;
        const event = events.at(0);
        if (event === undefined) return null;
        await transaction.commercialSubscriptionEventV1.update({
          data: {
            processedAt,
            processingDisposition: "applied",
            processingState: "processed",
          },
          where: { id: event.id },
        });
        await transaction.commercialSubscriptionReviewV1.upsert({
          create: {
            createdAt: processedAt,
            eventId: event.id,
            reason: "processing_conflict",
            subscriptionId: event.subscriptionId,
          },
          update: {},
          where: { eventId: event.id },
        });
        return Object.freeze({ eventId: event.id });
      });
    },

    async claimNextAllocation(input) {
      const claimedAt = requireInstant(input.claimedAt);
      const leasedUntil = requireInstant(input.leasedUntil);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      if (
        leasedUntil <= claimedAt ||
        leasedUntil.getTime() - claimedAt.getTime() > maximumLeaseMilliseconds
      ) {
        throw new TypeError("Commercial subscription lease is invalid.");
      }
      const claimed = await database.$queryRaw<
        Readonly<{
          allocationId: string;
          attempt: number;
          leaseExpiresAt: Date;
          outboxId: string;
          subscriptionPeriodId: string;
        }>[]
      >`
        WITH due AS (
          INSERT INTO commercial_subscription_outbox_v1 (allocation_id, source_event_id, delivery_state, available_at, created_at)
          SELECT allocation.id, event.id, 'pending', allocation.available_at, ${claimedAt}
          FROM commercial_subscription_allocation_v1 AS allocation
          JOIN commercial_subscription_period_v1 AS period ON period.id = allocation.subscription_period_id
          JOIN commercial_subscription_v1 AS subscription ON subscription.id = period.subscription_id
          JOIN commercial_subscription_event_v1 AS event
            ON event.provider = period.provider
            AND event.environment = period.environment
            AND event.provider_account_fingerprint = period.provider_account_fingerprint
            AND event.provider_invoice_id = period.provider_invoice_id
            AND event.event_type = 'subscription_period_paid'
            AND event.processing_state = 'processed'
          WHERE allocation.state = 'pending'
            AND allocation.available_at <= ${claimedAt}
            AND subscription.state IN ('active', 'cancel_at_period_end')
          ON CONFLICT (allocation_id) DO NOTHING
          RETURNING allocation_id
        ),
        candidate AS (
          SELECT outbox.id
          FROM commercial_subscription_outbox_v1 AS outbox
          JOIN commercial_subscription_allocation_v1 AS allocation ON allocation.id = outbox.allocation_id
          WHERE allocation.state = 'pending'
            AND outbox.attempt_count < 20
            AND (
              (outbox.delivery_state = 'pending' AND outbox.available_at <= ${claimedAt})
              OR (outbox.delivery_state = 'leased' AND outbox.leased_until <= ${claimedAt})
            )
            AND NOT EXISTS (
              SELECT 1 FROM commercial_subscription_allocation_v1 AS earlier
              WHERE earlier.subscription_period_id = allocation.subscription_period_id
                AND earlier.allocation_index < allocation.allocation_index
                AND earlier.state = 'pending'
            )
          ORDER BY outbox.available_at, outbox.created_at, outbox.id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE commercial_subscription_outbox_v1 AS outbox
        SET delivery_state = 'leased', attempt_count = outbox.attempt_count + 1,
            lease_token_hash = ${leaseTokenHash}, leased_until = ${leasedUntil}
        FROM candidate, commercial_subscription_allocation_v1 AS allocation
        WHERE outbox.id = candidate.id
          AND allocation.id = outbox.allocation_id
        RETURNING allocation.id AS "allocationId", outbox.attempt_count AS attempt,
          outbox.leased_until AS "leaseExpiresAt", outbox.id AS "outboxId",
          allocation.subscription_period_id AS "subscriptionPeriodId"
      `;
      const claim = claimed.at(0);
      return claim === undefined
        ? null
        : Object.freeze({
            ...claim,
            amount: 8 as const,
            leaseExpiresAt: claim.leaseExpiresAt.toISOString(),
          });
    },

    async fulfillAllocation(input) {
      requireUuid(input.outboxId);
      const completedAt = requireInstant(input.completedAt);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        try {
          return await database.$transaction(
            async (transaction) => {
              const rows = await transaction.$queryRaw<
                Readonly<{
                  allocationId: string;
                  allocationState: string;
                  amount: number;
                  catalogVersion: string;
                  fulfillmentCode: string;
                  leaseTokenHash: Uint8Array | null;
                  leasedUntil: Date | null;
                  outboxState: string;
                  productCode: string;
                  productVersion: string;
                  sourceOrderId: string;
                  subscriptionId: string;
                  subscriptionPeriodId: string;
                  userId: string;
                }>[]
              >`
              SELECT allocation.id AS "allocationId", allocation.state AS "allocationState", allocation.amount,
                subscription.catalog_version AS "catalogVersion", subscription.fulfillment_code AS "fulfillmentCode",
                outbox.lease_token_hash AS "leaseTokenHash", outbox.leased_until AS "leasedUntil",
                outbox.delivery_state AS "outboxState", subscription.product_code AS "productCode",
                subscription.product_version AS "productVersion", subscription.source_order_id AS "sourceOrderId",
                subscription.id AS "subscriptionId", allocation.subscription_period_id AS "subscriptionPeriodId",
                subscription.user_id AS "userId"
              FROM commercial_subscription_outbox_v1 AS outbox
              JOIN commercial_subscription_allocation_v1 AS allocation ON allocation.id = outbox.allocation_id
              JOIN commercial_subscription_period_v1 AS period ON period.id = allocation.subscription_period_id
              JOIN commercial_subscription_v1 AS subscription ON subscription.id = period.subscription_id
              WHERE outbox.id = ${input.outboxId}::uuid
              FOR UPDATE OF outbox, allocation, subscription
            `;
              const row = rows.at(0);
              if (row === undefined) return null;
              if (row.outboxState === "completed" || row.allocationState === "granted") {
                return Object.freeze({
                  allocationId: row.allocationId,
                  disposition: "duplicate" as const,
                  subscriptionId: row.subscriptionId,
                  userId: row.userId,
                });
              }
              if (
                row.outboxState !== "leased" ||
                row.leaseTokenHash === null ||
                !digestsEqual(row.leaseTokenHash, leaseTokenHash) ||
                row.leasedUntil === null ||
                row.leasedUntil < completedAt
              )
                return null;
              if (row.allocationState === "cancelled") {
                await transaction.$executeRaw`
                UPDATE commercial_subscription_outbox_v1
                SET delivery_state = 'completed', lease_token_hash = NULL, leased_until = NULL, completed_at = ${completedAt}
                WHERE id = ${input.outboxId}::uuid
              `;
                return Object.freeze({
                  allocationId: row.allocationId,
                  disposition: "skipped" as const,
                  subscriptionId: row.subscriptionId,
                  userId: row.userId,
                });
              }
              const grantDigest = await digest(`subscription-grant:${row.allocationId}`);
              const grants = await transaction.$queryRaw<Readonly<{ id: string }>[]>`
              INSERT INTO credit_ledger_entry (
                user_id, credit_type, direction, amount, reason, catalog_version, product_code, product_version,
                order_id, subscription_period_id, reservation_id, generation_id, source_entry_id, operation,
                idempotency_key_version, idempotency_key_hash, canonical_request_hash, policy_version,
                terms_version, created_at
              ) VALUES (
                ${row.userId}::uuid, 'subscription_credit', 'grant', ${row.amount}, 'subscription_monthly_allocation',
                ${row.catalogVersion}, ${row.productCode}, ${row.productVersion}, ${row.sourceOrderId}::uuid,
                ${row.subscriptionPeriodId}, NULL, NULL, NULL, 'credit.grant.subscription_month',
                ${subscriptionIdempotencyKeyVersion}, ${grantDigest}, ${grantDigest}, ${subscriptionPolicyVersion},
                ${subscriptionTermsVersion}, ${completedAt}
              ) ON CONFLICT (user_id, operation, idempotency_key_version, idempotency_key_hash) DO NOTHING
              RETURNING id
            `;
              const grant = grants.at(0);
              if (grant === undefined) {
                await transaction.$executeRaw`
                UPDATE commercial_subscription_outbox_v1
                SET delivery_state = 'completed', lease_token_hash = NULL, leased_until = NULL, completed_at = ${completedAt}
                WHERE id = ${input.outboxId}::uuid
              `;
                return Object.freeze({
                  allocationId: row.allocationId,
                  disposition: "duplicate" as const,
                  subscriptionId: row.subscriptionId,
                  userId: row.userId,
                });
              }
              await transaction.$executeRaw`
              INSERT INTO credit_projection (
                user_id, subscription_available, promotional_available, purchased_available, purchased_held, reserved, version, updated_at
              ) VALUES (${row.userId}::uuid, ${row.amount}, 0, 0, 0, 0, 1, ${completedAt})
              ON CONFLICT (user_id) DO UPDATE
              SET subscription_available = credit_projection.subscription_available + EXCLUDED.subscription_available,
                  version = credit_projection.version + 1, updated_at = EXCLUDED.updated_at
            `;
              const allocationUpdated = await transaction.$executeRaw`
              UPDATE commercial_subscription_allocation_v1
              SET state = 'granted', source_ledger_entry_id = ${grant.id}::uuid, granted_at = ${completedAt}
              WHERE id = ${row.allocationId}::uuid AND state = 'pending'
            `;
              if (allocationUpdated !== 1)
                throw new CommercialSubscriptionPersistenceError(
                  "COMMERCIAL_SUBSCRIPTION_CONFLICT",
                );
              await transaction.$executeRaw`
              UPDATE commercial_subscription_outbox_v1
              SET delivery_state = 'completed', lease_token_hash = NULL, leased_until = NULL, completed_at = ${completedAt}
              WHERE id = ${input.outboxId}::uuid
            `;
              return Object.freeze({
                allocationId: row.allocationId,
                disposition: "granted" as const,
                subscriptionId: row.subscriptionId,
                userId: row.userId,
              });
            },
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 10) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new CommercialSubscriptionPersistenceError("COMMERCIAL_SUBSCRIPTION_UNAVAILABLE");
    },

    async failAllocation(input) {
      requireUuid(input.outboxId);
      const failedAt = requireInstant(input.failedAt);
      const retryAt = input.retryAt === null ? null : requireInstant(input.retryAt);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      if (retryAt !== null && retryAt <= failedAt) {
        throw new TypeError("Commercial subscription retry is invalid.");
      }
      const rows = await database.$queryRaw<Readonly<{ deliveryState: string }>[]>`
        UPDATE commercial_subscription_outbox_v1
        SET delivery_state = CASE
              WHEN ${retryAt}::timestamptz IS NOT NULL AND attempt_count < 20 THEN 'pending'
              ELSE 'dead_lettered'
            END,
            available_at = COALESCE(${retryAt}::timestamptz, available_at),
            lease_token_hash = NULL,
            leased_until = NULL
        WHERE id = ${input.outboxId}::uuid
          AND delivery_state = 'leased'
          AND lease_token_hash = ${leaseTokenHash}
          AND leased_until >= ${failedAt}
        RETURNING delivery_state AS "deliveryState"
      `;
      const state = rows.at(0)?.deliveryState;
      return state === undefined ? null : state === "pending" ? "retry_wait" : "dead_lettered";
    },
  });
