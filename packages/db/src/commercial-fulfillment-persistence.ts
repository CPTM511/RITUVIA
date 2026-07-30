import { createHash, timingSafeEqual } from "node:crypto";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const failureCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const maximumAttempts = 20;
const fulfillmentIdempotencyKeyVersion = "commercial.fulfillment.v1";

export const commercialFulfillmentPersistenceErrorCodes = Object.freeze([
  "COMMERCIAL_FULFILLMENT_CONFLICT",
  "COMMERCIAL_FULFILLMENT_UNAVAILABLE",
] as const);
export type CommercialFulfillmentPersistenceErrorCode =
  (typeof commercialFulfillmentPersistenceErrorCodes)[number];

export class CommercialFulfillmentPersistenceError extends Error {
  readonly code: CommercialFulfillmentPersistenceErrorCode;

  constructor(code: CommercialFulfillmentPersistenceErrorCode) {
    super("The commercial fulfillment operation could not be completed.");
    this.name = "CommercialFulfillmentPersistenceError";
    this.code = code;
  }
}

export type CommercialFulfillmentOrderStatus =
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

export type CommercialCreditPackFulfillmentPlanner = (input: {
  creditsGranted: number;
  grantedAmount: number;
  heldAmount: number;
  orderStatus: CommercialFulfillmentOrderStatus;
  reversedAmount: number;
  unavailableAmount: number;
}) => Readonly<{
  disposition:
    | "adjusted"
    | "granted"
    | "granted_and_adjusted"
    | "granted_and_held"
    | "held"
    | "review_required"
    | "unchanged";
  convertHeldAmount: number;
  grantAmount: number;
  holdAmount: number;
  reverseAmount: number;
  shortfallAmount: number;
}>;

export type CommercialFulfillmentOutboxClaim = Readonly<{
  attempt: number;
  leaseExpiresAt: string;
  maxAttempts: 20;
  orderId: string;
  orderStatus: CommercialFulfillmentOrderStatus;
  outboxId: string;
  paymentAttemptId: string;
  paymentEventId: string;
  paymentStateVersion: number;
  schemaVersion: "commercial-payment-state-outbox.v1";
}>;

export type CommercialFulfillmentResult = Readonly<{
  creditsGranted: number;
  creditsHeld: number;
  creditsReversed: number;
  disposition:
    | "adjusted"
    | "granted"
    | "granted_and_adjusted"
    | "granted_and_held"
    | "held"
    | "review_required"
    | "unchanged";
  fulfillmentCode: string;
  orderId: string;
  shortfallAmount: number;
  userId: string;
}>;

export type CommercialPurchaseRestoration = Readonly<{
  credits: Readonly<{
    promotional: number;
    purchased: number;
    purchasedHeld: number;
    reserved: number;
    subscription: number;
    total: number;
    version: number;
  }>;
  entitlements: readonly Readonly<{
    fulfillmentCode: string;
    grantedAt: string;
    productCode: string;
    state: "active" | "frozen" | "revoked";
    version: number;
  }>[];
}>;

export type CommercialFulfillmentPersistence = Readonly<{
  claimNextPaymentState(input: {
    claimedAt: string;
    leaseTokenHash: Uint8Array;
    leasedUntil: string;
  }): Promise<CommercialFulfillmentOutboxClaim | null>;
  failPaymentState(input: {
    failedAt: string;
    failureCode: string;
    leaseTokenHash: Uint8Array;
    outboxId: string;
    retryAt: string | null;
  }): Promise<"dead_lettered" | "retry_wait" | null>;
  fulfillPaymentState(
    input: {
      completedAt: string;
      leaseTokenHash: Uint8Array;
      outboxId: string;
    },
    plan: CommercialCreditPackFulfillmentPlanner,
  ): Promise<CommercialFulfillmentResult | null>;
  restorePurchases(userId: string): Promise<CommercialPurchaseRestoration>;
}>;

type FulfillmentRow = Readonly<{
  canonicalRequestHash: Uint8Array;
  catalogVersion: string;
  countryPolicyVersion: string;
  creditsGranted: number | null;
  creditsPerMonth: number | null;
  fulfillmentCode: string;
  fulfillmentKind: string;
  orderId: string;
  orderStatus: CommercialFulfillmentOrderStatus;
  orderPaymentStateVersion: number;
  outboxOrderId: string;
  outboxPaymentAttemptId: string;
  outboxPaymentEventId: string;
  outboxPaymentStateVersion: number;
  outboxSchemaVersion: string;
  outboxStatus: CommercialFulfillmentOrderStatus;
  outboxTopic: string;
  productCode: string;
  productVersion: string;
  refundPolicyVersion: string;
  termsVersion: string;
  userId: string;
}>;

type GrantRow = Readonly<{
  amount: number;
  canonicalRequestHash: Uint8Array;
  createdAt: Date;
  creditType: string;
  direction: string;
  id: string;
  orderId: string | null;
}>;

type RestrictionRow = Readonly<{
  amount: number;
  id: string;
}>;

type PrivilegeRow = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canDeleteLedger: boolean;
  canInsertLedger: boolean;
  canReadAllocation: boolean;
  canReadEntitlement: boolean;
  canReadItem: boolean;
  canReadLedger: boolean;
  canReadOrder: boolean;
  canReadOutbox: boolean;
  canReadProjection: boolean;
  canReadRestriction: boolean;
  canReadReservation: boolean;
  canUpdateLedger: boolean;
  canUpdateOutbox: boolean;
  canUpdateProjection: boolean;
  canInsertFulfillment: boolean;
  canInsertRestriction: boolean;
  canReadFulfillment: boolean;
  canUpdateFulfillment: boolean;
  privilegedRole: boolean;
  roleName: string;
}>;

const fulfillmentPrivilegeAttestations = new WeakMap<PrismaClient, Promise<void>>();

const requireUuid = (value: string): string => {
  if (!uuidV4Pattern.test(value)) {
    throw new TypeError("Commercial fulfillment identifier is invalid.");
  }
  return value;
};

const requireInstant = (value: string): Date => {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== value) {
    throw new TypeError("Commercial fulfillment instant is invalid.");
  }
  return instant;
};

const requireDigest = (value: Uint8Array): Uint8Array => {
  if (value.byteLength !== 32) {
    throw new TypeError("Commercial fulfillment digest is invalid.");
  }
  return value;
};

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const digestsEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const isSerializationFailure = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";

const safeVersion = (value: bigint): number => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_UNAVAILABLE");
  }
  return version;
};

export const assertCommercialFulfillmentRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  let attestation = fulfillmentPrivilegeAttestations.get(database);
  if (attestation !== undefined) return attestation;
  attestation = (async () => {
    const rows = await database.$queryRaw<PrivilegeRow[]>`
      SELECT
        current_user AS "roleName",
        rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls
          AS "privilegedRole",
        has_database_privilege(current_user, current_database(), 'CREATE')
          AS "canCreateInDatabase",
        has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
        has_table_privilege(current_user, 'public.commercial_order_v2', 'SELECT')
          AS "canReadOrder",
        has_table_privilege(current_user, 'public.commercial_order_item_v2', 'SELECT')
          AS "canReadItem",
        has_table_privilege(current_user, 'public.commercial_payment_outbox_v2', 'SELECT')
          AS "canReadOutbox",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'SELECT')
          AS "canReadLedger",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'INSERT')
          AS "canInsertLedger",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'UPDATE')
          AS "canUpdateLedger",
        has_table_privilege(current_user, 'public.credit_ledger_entry', 'DELETE')
          AS "canDeleteLedger",
        has_table_privilege(current_user, 'public.credit_allocation', 'SELECT')
          AS "canReadAllocation",
        has_table_privilege(current_user, 'public.credit_reservation', 'SELECT')
          AS "canReadReservation",
        has_table_privilege(current_user, 'public.credit_projection', 'SELECT')
          AS "canReadProjection",
        has_table_privilege(current_user, 'public.credit_restriction_entry', 'SELECT')
          AS "canReadRestriction",
        has_column_privilege(
          current_user, 'public.credit_projection', 'purchased_available', 'UPDATE'
        ) AS "canUpdateProjection",
        has_table_privilege(current_user, 'public.commercial_entitlement_v2', 'SELECT')
          AS "canReadEntitlement",
        has_table_privilege(current_user, 'public.credit_restriction_entry', 'INSERT')
          AS "canInsertRestriction",
        has_table_privilege(current_user, 'public.commercial_fulfillment_v2', 'SELECT')
          AS "canReadFulfillment",
        has_table_privilege(current_user, 'public.commercial_fulfillment_v2', 'INSERT')
          AS "canInsertFulfillment",
        has_column_privilege(
          current_user, 'public.commercial_fulfillment_v2', 'status', 'UPDATE'
        ) AS "canUpdateFulfillment",
        has_column_privilege(
          current_user, 'public.commercial_payment_outbox_v2', 'delivery_state', 'UPDATE'
        ) AS "canUpdateOutbox"
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
      !privilege.canReadOrder ||
      !privilege.canReadItem ||
      !privilege.canReadOutbox ||
      !privilege.canReadLedger ||
      !privilege.canInsertLedger ||
      privilege.canUpdateLedger ||
      privilege.canDeleteLedger ||
      !privilege.canReadAllocation ||
      !privilege.canReadReservation ||
      !privilege.canReadProjection ||
      !privilege.canReadRestriction ||
      !privilege.canUpdateProjection ||
      !privilege.canReadEntitlement ||
      !privilege.canInsertRestriction ||
      !privilege.canReadFulfillment ||
      !privilege.canInsertFulfillment ||
      !privilege.canUpdateFulfillment ||
      !privilege.canUpdateOutbox
    ) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_UNAVAILABLE");
    }
  })().catch((error: unknown) => {
    fulfillmentPrivilegeAttestations.delete(database);
    throw error;
  });
  fulfillmentPrivilegeAttestations.set(database, attestation);
  return attestation;
};

const completeLeasedOutbox = async (
  database: Prisma.TransactionClient,
  input: {
    completedAt: Date;
    leaseTokenHash: Uint8Array;
    outboxId: string;
  },
): Promise<void> => {
  const completed = await database.$executeRaw`
    UPDATE commercial_payment_outbox_v2
    SET delivery_state = 'completed',
        lease_token_hash = NULL,
        leased_until = NULL,
        completed_at = ${input.completedAt},
        last_failure_code = NULL
    WHERE id = ${input.outboxId}::uuid
      AND delivery_state = 'leased'
      AND lease_token_hash = ${input.leaseTokenHash}
      AND leased_until >= ${input.completedAt}
  `;
  if (completed !== 1) {
    throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
  }
};

const processFulfillment = async (
  database: Prisma.TransactionClient,
  input: {
    completedAt: Date;
    leaseTokenHash: Uint8Array;
    outboxId: string;
  },
  plan: CommercialCreditPackFulfillmentPlanner,
): Promise<CommercialFulfillmentResult | null> => {
  const rows = await database.$queryRaw<FulfillmentRow[]>`
    SELECT
      orders.canonical_request_hash AS "canonicalRequestHash",
      orders.catalog_version AS "catalogVersion",
      orders.country_policy_version AS "countryPolicyVersion",
      items.credits_granted AS "creditsGranted",
      items.credits_per_month AS "creditsPerMonth",
      items.fulfillment_code AS "fulfillmentCode",
      items.fulfillment_kind AS "fulfillmentKind",
      orders.id AS "orderId",
      orders.status AS "orderStatus",
      orders.payment_state_version AS "orderPaymentStateVersion",
      outbox.order_id AS "outboxOrderId",
      outbox.payment_attempt_id AS "outboxPaymentAttemptId",
      outbox.payment_event_id AS "outboxPaymentEventId",
      outbox.payment_state_version AS "outboxPaymentStateVersion",
      outbox.schema_version AS "outboxSchemaVersion",
      outbox.order_status AS "outboxStatus",
      outbox.topic AS "outboxTopic",
      items.product_code AS "productCode",
      items.product_version AS "productVersion",
      orders.refund_policy_version AS "refundPolicyVersion",
      orders.terms_version AS "termsVersion",
      orders.user_id AS "userId"
    FROM commercial_payment_outbox_v2 AS outbox
    JOIN commercial_order_v2 AS orders ON orders.id = outbox.order_id
    JOIN commercial_order_item_v2 AS items ON items.order_id = orders.id
    WHERE outbox.id = ${input.outboxId}::uuid
      AND outbox.delivery_state = 'leased'
      AND outbox.lease_token_hash = ${input.leaseTokenHash}
      AND outbox.leased_until >= ${input.completedAt}
    FOR UPDATE OF outbox
  `;
  const row = rows.at(0);
  if (row === undefined) return null;
  if (
    rows.length !== 1 ||
    row.outboxTopic !== "commercial.payment_state_changed" ||
    row.outboxSchemaVersion !== "commercial-payment-state-outbox.v1" ||
    row.outboxOrderId !== row.orderId ||
    row.fulfillmentKind !== "credit_pack" ||
    row.creditsGranted === null ||
    row.creditsPerMonth !== null
  ) {
    throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
  }

  const grantIdempotencyHash = digest(`credit.grant.purchase:${row.orderId}`);
  const grantCanonicalHash = digest(
    JSON.stringify({
      catalogVersion: row.catalogVersion,
      creditsGranted: row.creditsGranted,
      fulfillmentCode: row.fulfillmentCode,
      orderId: row.orderId,
      orderRequestHash: Buffer.from(row.canonicalRequestHash).toString("hex"),
      productCode: row.productCode,
      productVersion: row.productVersion,
      schemaVersion: fulfillmentIdempotencyKeyVersion,
      userId: row.userId,
    }),
  );
  const existingGrants = await database.$queryRaw<GrantRow[]>`
    SELECT
      id,
      amount,
      canonical_request_hash AS "canonicalRequestHash",
      created_at AS "createdAt",
      credit_type AS "creditType",
      direction,
      order_id AS "orderId"
    FROM credit_ledger_entry
    WHERE user_id = ${row.userId}::uuid
      AND operation = 'credit.grant.purchase'
      AND idempotency_key_version = ${fulfillmentIdempotencyKeyVersion}
      AND idempotency_key_hash = ${grantIdempotencyHash}
  `;
  const existingGrant = existingGrants.at(0);
  if (
    existingGrants.length > 1 ||
    (existingGrant !== undefined &&
      (existingGrant.amount !== row.creditsGranted ||
        existingGrant.creditType !== "purchased_credit" ||
        existingGrant.direction !== "grant" ||
        existingGrant.orderId !== row.orderId ||
        !digestsEqual(existingGrant.canonicalRequestHash, grantCanonicalHash)))
  ) {
    throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
  }

  let reversedAmount = 0;
  let unavailableAmount = 0;
  let activeHolds: readonly RestrictionRow[] = [];
  if (existingGrant !== undefined) {
    const [adjustments, unavailable, holds] = await Promise.all([
      database.$queryRaw<Readonly<{ amount: number }>[]>`
        SELECT COALESCE(SUM(amount), 0)::int AS amount
        FROM credit_ledger_entry
        WHERE source_entry_id = ${existingGrant.id}::uuid
          AND direction IN ('reverse', 'expire')
      `,
      database.$queryRaw<Readonly<{ amount: number }>[]>`
        SELECT COALESCE(SUM(allocations.amount), 0)::int AS amount
        FROM credit_allocation AS allocations
        JOIN credit_reservation AS reservations ON reservations.id = allocations.reservation_id
        WHERE allocations.source_entry_id = ${existingGrant.id}::uuid
          AND reservations.status IN ('active', 'consumed')
      `,
      database.$queryRaw<RestrictionRow[]>`
        SELECT holds.id, holds.amount
        FROM credit_restriction_entry AS holds
        WHERE holds.source_entry_id = ${existingGrant.id}::uuid
          AND holds.kind = 'hold'
          AND NOT EXISTS (
            SELECT 1
            FROM credit_restriction_entry AS conversions
            WHERE conversions.source_restriction_id = holds.id
              AND conversions.kind = 'convert_to_reverse'
        )
        ORDER BY holds.created_at, holds.id
      `,
    ]);
    reversedAmount = adjustments.at(0)?.amount ?? 0;
    unavailableAmount = unavailable.at(0)?.amount ?? 0;
    activeHolds = holds;
  }
  const heldAmount = activeHolds.reduce((sum, hold) => sum + hold.amount, 0);

  const fulfillmentPlan = plan({
    creditsGranted: row.creditsGranted,
    grantedAmount: existingGrant?.amount ?? 0,
    heldAmount,
    orderStatus: row.orderStatus,
    reversedAmount,
    unavailableAmount,
  });
  if (!["paid", "disputed", "refunded"].includes(row.orderStatus)) {
    if (
      fulfillmentPlan.disposition !== "unchanged" ||
      fulfillmentPlan.convertHeldAmount !== 0 ||
      fulfillmentPlan.grantAmount !== 0 ||
      fulfillmentPlan.holdAmount !== 0 ||
      fulfillmentPlan.reverseAmount !== 0 ||
      fulfillmentPlan.shortfallAmount !== 0
    ) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
    }
    await completeLeasedOutbox(database, input);
    return Object.freeze({
      creditsGranted: 0,
      creditsHeld: 0,
      creditsReversed: 0,
      disposition: "unchanged",
      fulfillmentCode: row.fulfillmentCode,
      orderId: row.orderId,
      shortfallAmount: 0,
      userId: row.userId,
    });
  }
  let grantId = existingGrant?.id;
  let grantCreatedAt = existingGrant?.createdAt;
  if (fulfillmentPlan.grantAmount > 0) {
    if (fulfillmentPlan.grantAmount !== row.creditsGranted || grantId !== undefined) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
    }
    const inserted = await database.$queryRaw<Readonly<{ id: string }>[]>`
      INSERT INTO credit_ledger_entry (
        user_id, credit_type, direction, amount, reason, catalog_version, product_code,
        product_version, order_id, operation, idempotency_key_version, idempotency_key_hash,
        canonical_request_hash, policy_version, terms_version, expires_at, created_at
      ) VALUES (
        ${row.userId}::uuid, 'purchased_credit', 'grant', ${fulfillmentPlan.grantAmount},
        'purchased_pack', ${row.catalogVersion}, ${row.productCode}, ${row.productVersion},
        ${row.orderId}::uuid, 'credit.grant.purchase', ${fulfillmentIdempotencyKeyVersion},
        ${grantIdempotencyHash}, ${grantCanonicalHash}, ${row.countryPolicyVersion},
        ${row.termsVersion}, NULL, ${input.completedAt}
      )
      RETURNING id
    `;
    grantId = inserted.at(0)?.id;
    if (inserted.length !== 1 || grantId === undefined) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_UNAVAILABLE");
    }
    grantCreatedAt = input.completedAt;
    await database.$executeRaw`
      INSERT INTO credit_projection (
        user_id, purchased_available, version, updated_at
      ) VALUES (
        ${row.userId}::uuid, ${fulfillmentPlan.grantAmount}, 1, ${input.completedAt}
      )
      ON CONFLICT (user_id) DO UPDATE
      SET purchased_available =
            credit_projection.purchased_available + EXCLUDED.purchased_available,
          version = credit_projection.version + 1,
          updated_at = EXCLUDED.updated_at
    `;
  }

  if (grantId === undefined || grantCreatedAt === undefined) {
    throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
  }

  if (fulfillmentPlan.holdAmount > 0) {
    const holdIdempotencyHash = digest(`credit.hold.purchase:${row.orderId}:${input.outboxId}`);
    const holdCanonicalHash = digest(
      JSON.stringify({
        amount: fulfillmentPlan.holdAmount,
        orderId: row.orderId,
        orderStatus: row.orderStatus,
        outboxId: input.outboxId,
        paymentStateVersion: row.orderPaymentStateVersion,
        sourceEntryId: grantId,
      }),
    );
    const inserted = await database.$executeRaw`
      INSERT INTO credit_restriction_entry (
        user_id, source_entry_id, order_id, outbox_id, kind, amount, reason,
        source_restriction_id, operation, idempotency_key_version, idempotency_key_hash,
        canonical_request_hash, created_at
      ) VALUES (
        ${row.userId}::uuid, ${grantId}::uuid, ${row.orderId}::uuid, ${input.outboxId}::uuid,
        'hold', ${fulfillmentPlan.holdAmount}, 'payment_dispute', NULL,
        'credit.hold.purchase', ${fulfillmentIdempotencyKeyVersion}, ${holdIdempotencyHash},
        ${holdCanonicalHash}, ${input.completedAt}
      )
    `;
    if (inserted !== 1) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_UNAVAILABLE");
    }
    const updated = await database.$executeRaw`
      UPDATE credit_projection
      SET purchased_available = purchased_available - ${fulfillmentPlan.holdAmount},
          purchased_held = purchased_held + ${fulfillmentPlan.holdAmount},
          version = version + 1,
          updated_at = ${input.completedAt}
      WHERE user_id = ${row.userId}::uuid
        AND purchased_available >= ${fulfillmentPlan.holdAmount}
    `;
    if (updated !== 1) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
    }
  }

  if (fulfillmentPlan.convertHeldAmount > 0) {
    if (fulfillmentPlan.convertHeldAmount !== heldAmount || activeHolds.length === 0) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
    }
    for (const hold of activeHolds) {
      const conversionIdempotencyHash = digest(
        `credit.convert-hold.purchase:${row.orderId}:${hold.id}:${input.outboxId}`,
      );
      const conversionCanonicalHash = digest(
        JSON.stringify({
          amount: hold.amount,
          orderId: row.orderId,
          orderStatus: row.orderStatus,
          outboxId: input.outboxId,
          paymentStateVersion: row.orderPaymentStateVersion,
          sourceEntryId: grantId,
          sourceRestrictionId: hold.id,
        }),
      );
      await database.$executeRaw`
        INSERT INTO credit_restriction_entry (
          user_id, source_entry_id, order_id, outbox_id, kind, amount, reason,
          source_restriction_id, operation, idempotency_key_version, idempotency_key_hash,
          canonical_request_hash, created_at
        ) VALUES (
          ${row.userId}::uuid, ${grantId}::uuid, ${row.orderId}::uuid, ${input.outboxId}::uuid,
          'convert_to_reverse', ${hold.amount}, 'payment_refund', ${hold.id}::uuid,
          'credit.convert-hold.purchase', ${fulfillmentIdempotencyKeyVersion},
          ${conversionIdempotencyHash}, ${conversionCanonicalHash}, ${input.completedAt}
        )
      `;
      const reversalIdempotencyHash = digest(
        `credit.reverse.held-purchase:${row.orderId}:${hold.id}:${input.outboxId}`,
      );
      const reversalCanonicalHash = digest(
        JSON.stringify({
          amount: hold.amount,
          orderId: row.orderId,
          outboxId: input.outboxId,
          sourceEntryId: grantId,
          sourceRestrictionId: hold.id,
        }),
      );
      await database.$executeRaw`
        INSERT INTO credit_ledger_entry (
          user_id, credit_type, direction, amount, reason, catalog_version, product_code,
          product_version, order_id, source_entry_id, operation, idempotency_key_version,
          idempotency_key_hash, canonical_request_hash, policy_version, terms_version,
          expires_at, created_at
        ) VALUES (
          ${row.userId}::uuid, 'refund_adjustment', 'reverse', ${hold.amount}, 'payment_refund',
          ${row.catalogVersion}, ${row.productCode}, ${row.productVersion}, ${row.orderId}::uuid,
          ${grantId}::uuid, 'credit.reverse.held-purchase', ${fulfillmentIdempotencyKeyVersion},
          ${reversalIdempotencyHash}, ${reversalCanonicalHash}, ${row.refundPolicyVersion},
          ${row.termsVersion}, NULL, ${input.completedAt}
        )
      `;
    }
    const updated = await database.$executeRaw`
      UPDATE credit_projection
      SET purchased_held = purchased_held - ${fulfillmentPlan.convertHeldAmount},
          version = version + 1,
          updated_at = ${input.completedAt}
      WHERE user_id = ${row.userId}::uuid
        AND purchased_held >= ${fulfillmentPlan.convertHeldAmount}
    `;
    if (updated !== 1) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
    }
  }

  if (fulfillmentPlan.reverseAmount > 0) {
    const reversalIdempotencyHash = digest(
      `credit.reverse.purchase:${row.orderId}:${input.outboxId}`,
    );
    const reversalCanonicalHash = digest(
      JSON.stringify({
        amount: fulfillmentPlan.reverseAmount,
        orderId: row.orderId,
        orderStatus: row.orderStatus,
        outboxId: input.outboxId,
        paymentStateVersion: row.outboxPaymentStateVersion,
        sourceEntryId: grantId,
      }),
    );
    const inserted = await database.$queryRaw<Readonly<{ id: string }>[]>`
      INSERT INTO credit_ledger_entry (
        user_id, credit_type, direction, amount, reason, catalog_version, product_code,
        product_version, order_id, source_entry_id, operation, idempotency_key_version,
        idempotency_key_hash, canonical_request_hash, policy_version, terms_version,
        expires_at, created_at
      ) VALUES (
        ${row.userId}::uuid, 'refund_adjustment', 'reverse',
        ${fulfillmentPlan.reverseAmount},
        'payment_refund',
        ${row.catalogVersion}, ${row.productCode}, ${row.productVersion}, ${row.orderId}::uuid,
        ${grantId}::uuid, 'credit.reverse.purchase', ${fulfillmentIdempotencyKeyVersion},
        ${reversalIdempotencyHash}, ${reversalCanonicalHash}, ${row.refundPolicyVersion},
        ${row.termsVersion}, NULL, ${input.completedAt}
      )
      RETURNING id
    `;
    if (inserted.length !== 1) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_UNAVAILABLE");
    }
    const updated = await database.$executeRaw`
      UPDATE credit_projection
      SET purchased_available = purchased_available - ${fulfillmentPlan.reverseAmount},
          version = version + 1,
          updated_at = ${input.completedAt}
      WHERE user_id = ${row.userId}::uuid
        AND purchased_available >= ${fulfillmentPlan.reverseAmount}
    `;
    if (updated !== 1) {
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
    }
  }

  const fulfillmentStatus =
    fulfillmentPlan.shortfallAmount > 0
      ? "review_required"
      : row.orderStatus === "disputed"
        ? "disputed"
        : row.orderStatus === "refunded"
          ? "refunded"
          : "active";
  const resultingHeldAmount =
    heldAmount + fulfillmentPlan.holdAmount - fulfillmentPlan.convertHeldAmount;
  const resultingReversedAmount =
    reversedAmount + fulfillmentPlan.reverseAmount + fulfillmentPlan.convertHeldAmount;
  const fulfillmentUpdated = await database.$executeRaw`
    INSERT INTO commercial_fulfillment_v2 (
      order_id, user_id, fulfillment_kind, fulfillment_code, source_grant_entry_id, status,
      granted_amount, held_amount, reversed_amount, shortfall_amount,
      applied_payment_state_version, last_outbox_id, version, granted_at, updated_at
    ) VALUES (
      ${row.orderId}::uuid, ${row.userId}::uuid, 'credit_pack', ${row.fulfillmentCode},
      ${grantId}::uuid, ${fulfillmentStatus}, ${row.creditsGranted}, ${resultingHeldAmount},
      ${resultingReversedAmount}, ${fulfillmentPlan.shortfallAmount},
      ${row.orderPaymentStateVersion}, ${input.outboxId}::uuid, 1, ${grantCreatedAt},
      ${input.completedAt}
    )
    ON CONFLICT (order_id) DO UPDATE
    SET status = EXCLUDED.status,
        held_amount = EXCLUDED.held_amount,
        reversed_amount = EXCLUDED.reversed_amount,
        shortfall_amount = EXCLUDED.shortfall_amount,
        applied_payment_state_version = EXCLUDED.applied_payment_state_version,
        last_outbox_id = EXCLUDED.last_outbox_id,
        version = commercial_fulfillment_v2.version + 1,
        updated_at = EXCLUDED.updated_at
    WHERE commercial_fulfillment_v2.user_id = EXCLUDED.user_id
      AND commercial_fulfillment_v2.fulfillment_kind = EXCLUDED.fulfillment_kind
      AND commercial_fulfillment_v2.fulfillment_code = EXCLUDED.fulfillment_code
      AND commercial_fulfillment_v2.source_grant_entry_id = EXCLUDED.source_grant_entry_id
      AND commercial_fulfillment_v2.granted_amount = EXCLUDED.granted_amount
      AND commercial_fulfillment_v2.applied_payment_state_version <=
        EXCLUDED.applied_payment_state_version
  `;
  if (fulfillmentUpdated !== 1) {
    throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_CONFLICT");
  }

  await completeLeasedOutbox(database, input);
  return Object.freeze({
    creditsGranted: fulfillmentPlan.grantAmount,
    creditsHeld: fulfillmentPlan.holdAmount,
    creditsReversed: fulfillmentPlan.reverseAmount + fulfillmentPlan.convertHeldAmount,
    disposition: fulfillmentPlan.disposition,
    fulfillmentCode: row.fulfillmentCode,
    orderId: row.orderId,
    shortfallAmount: fulfillmentPlan.shortfallAmount,
    userId: row.userId,
  });
};

export const createCommercialFulfillmentPersistence = (
  database: PrismaClient,
): CommercialFulfillmentPersistence =>
  Object.freeze({
    async claimNextPaymentState(input) {
      await assertCommercialFulfillmentRuntimeDatabasePrivileges(database);
      const claimedAt = requireInstant(input.claimedAt);
      const leasedUntil = requireInstant(input.leasedUntil);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      if (
        leasedUntil <= claimedAt ||
        leasedUntil.getTime() - claimedAt.getTime() > 5 * 60 * 1_000
      ) {
        throw new TypeError("Commercial fulfillment lease is invalid.");
      }
      const claimed = await database.$queryRaw<
        Readonly<{
          attempt: number;
          leaseExpiresAt: Date;
          orderId: string;
          orderStatus: CommercialFulfillmentOrderStatus;
          outboxId: string;
          paymentAttemptId: string;
          paymentEventId: string;
          paymentStateVersion: number;
          schemaVersion: "commercial-payment-state-outbox.v1";
        }>[]
      >`
        WITH exhausted AS (
          UPDATE commercial_payment_outbox_v2
          SET delivery_state = 'dead_lettered',
              lease_token_hash = NULL,
              leased_until = NULL,
              last_failure_code = 'max_attempts',
              dead_lettered_at = ${claimedAt}
          WHERE delivery_state = 'leased'
            AND leased_until <= ${claimedAt}
            AND attempt_count >= ${maximumAttempts}
          RETURNING id
        ),
        candidate AS (
          SELECT id
          FROM commercial_payment_outbox_v2
          WHERE attempt_count < ${maximumAttempts}
            AND (
              (delivery_state = 'pending' AND available_at <= ${claimedAt})
              OR (delivery_state = 'leased' AND leased_until <= ${claimedAt})
            )
            AND NOT EXISTS (
              SELECT 1
              FROM commercial_payment_outbox_v2 AS earlier
              WHERE earlier.order_id = commercial_payment_outbox_v2.order_id
                AND earlier.payment_state_version <
                  commercial_payment_outbox_v2.payment_state_version
                AND earlier.delivery_state <> 'completed'
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
          outbox.attempt_count AS attempt,
          outbox.leased_until AS "leaseExpiresAt",
          outbox.order_id AS "orderId",
          outbox.order_status AS "orderStatus",
          outbox.id AS "outboxId",
          outbox.payment_attempt_id AS "paymentAttemptId",
          outbox.payment_event_id AS "paymentEventId",
          outbox.payment_state_version AS "paymentStateVersion",
          outbox.schema_version AS "schemaVersion"
      `;
      const claim = claimed.at(0);
      return claim === undefined
        ? null
        : Object.freeze({
            ...claim,
            leaseExpiresAt: claim.leaseExpiresAt.toISOString(),
            maxAttempts: maximumAttempts,
          });
    },

    async failPaymentState(input) {
      await assertCommercialFulfillmentRuntimeDatabasePrivileges(database);
      requireUuid(input.outboxId);
      if (!failureCodePattern.test(input.failureCode)) {
        throw new TypeError("Commercial fulfillment failure code is invalid.");
      }
      const failedAt = requireInstant(input.failedAt);
      const retryAt = input.retryAt === null ? null : requireInstant(input.retryAt);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      if (retryAt !== null && retryAt <= failedAt) {
        throw new TypeError("Commercial fulfillment retry is invalid.");
      }
      const failed = await database.$queryRaw<Readonly<{ deliveryState: string }>[]>`
        UPDATE commercial_payment_outbox_v2
        SET delivery_state =
              CASE
                WHEN ${retryAt}::timestamptz IS NOT NULL AND attempt_count < ${maximumAttempts}
                  THEN 'pending'
                ELSE 'dead_lettered'
              END,
            available_at = COALESCE(${retryAt}::timestamptz, available_at),
            lease_token_hash = NULL,
            leased_until = NULL,
            last_failure_code = ${input.failureCode},
            dead_lettered_at =
              CASE
                WHEN ${retryAt}::timestamptz IS NOT NULL AND attempt_count < ${maximumAttempts}
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

    async fulfillPaymentState(input, plan) {
      await assertCommercialFulfillmentRuntimeDatabasePrivileges(database);
      requireUuid(input.outboxId);
      if (typeof plan !== "function") {
        throw new TypeError("Commercial fulfillment planner is invalid.");
      }
      const completedAt = requireInstant(input.completedAt);
      const leaseTokenHash = requireDigest(input.leaseTokenHash);
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          return await database.$transaction(
            (transaction) =>
              processFulfillment(
                transaction,
                { completedAt, leaseTokenHash, outboxId: input.outboxId },
                plan,
              ),
            { isolationLevel: "Serializable" },
          );
        } catch (error) {
          if (!isSerializationFailure(error) || attempt === 5) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 5));
        }
      }
      throw new CommercialFulfillmentPersistenceError("COMMERCIAL_FULFILLMENT_UNAVAILABLE");
    },

    async restorePurchases(userId) {
      requireUuid(userId);
      const [projections, entitlements] = await Promise.all([
        database.$queryRaw<
          Readonly<{
            promotional: number;
            purchased: number;
            purchasedHeld: number;
            reserved: number;
            subscription: number;
            version: bigint;
          }>[]
        >`
          SELECT
            promotional_available AS promotional,
            purchased_available AS purchased,
            purchased_held AS "purchasedHeld",
            reserved,
            subscription_available AS subscription,
            version
          FROM credit_projection
          WHERE user_id = ${userId}::uuid
        `,
        database.$queryRaw<
          Readonly<{
            fulfillmentCode: string;
            grantedAt: Date;
            productCode: string;
            state: "active" | "frozen" | "revoked";
            version: number;
          }>[]
        >`
          SELECT
            fulfillment_code AS "fulfillmentCode",
            granted_at AS "grantedAt",
            product_code AS "productCode",
            status AS state,
            version
          FROM commercial_entitlement_v2
          WHERE user_id = ${userId}::uuid
          ORDER BY granted_at, id
        `,
      ]);
      const projection = projections.at(0);
      const credits =
        projection === undefined
          ? Object.freeze({
              promotional: 0,
              purchased: 0,
              purchasedHeld: 0,
              reserved: 0,
              subscription: 0,
              total: 0,
              version: 0,
            })
          : Object.freeze({
              promotional: projection.promotional,
              purchased: projection.purchased,
              purchasedHeld: projection.purchasedHeld,
              reserved: projection.reserved,
              subscription: projection.subscription,
              total: projection.promotional + projection.purchased + projection.subscription,
              version: safeVersion(projection.version),
            });
      return Object.freeze({
        credits,
        entitlements: Object.freeze(
          entitlements.map((entitlement) =>
            Object.freeze({
              ...entitlement,
              grantedAt: entitlement.grantedAt.toISOString(),
            }),
          ),
        ),
      });
    },
  });
