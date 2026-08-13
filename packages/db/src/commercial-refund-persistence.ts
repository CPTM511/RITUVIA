import { createHash, timingSafeEqual } from "node:crypto";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import { enqueueOperationalCase } from "./operational-cases.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fingerprintPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const refundIdPattern = /^re_[A-Za-z0-9_]{8,252}$/u;
const idempotencyKeyVersion = "commercial-refund-request.v1";
const eligibilityPolicyVersion = "sandbox-unused-credit-refund.v1";

export const commercialRefundPersistenceErrorCodes = Object.freeze([
  "COMMERCIAL_REFUND_CONFLICT",
  "COMMERCIAL_REFUND_NOT_ELIGIBLE",
  "COMMERCIAL_REFUND_NOT_FOUND",
  "COMMERCIAL_REFUND_UNAVAILABLE",
] as const);
export type CommercialRefundPersistenceErrorCode =
  (typeof commercialRefundPersistenceErrorCodes)[number];

export class CommercialRefundPersistenceError extends Error {
  readonly code: CommercialRefundPersistenceErrorCode;

  constructor(code: CommercialRefundPersistenceErrorCode, options?: ErrorOptions) {
    super("The commercial refund request could not be completed.", options);
    this.name = "CommercialRefundPersistenceError";
    this.code = code;
  }
}

export type CommercialRefundEligibilityPlanner = (input: {
  countryCode: string;
  creditsGranted: number;
  currencyCode: string;
  environment: string;
  fulfillmentKind: string;
  fulfillmentStatus: string;
  grantedAmount: number;
  heldAmount: number;
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
  provider: string;
  refundedMinor: number;
  refundPolicyVersion: string;
  reversedAmount: number;
  shortfallAmount: number;
  totalMinor: number;
  unavailableAmount: number;
}) =>
  | Readonly<{
      amountMinor: number;
      creditsToHold: number;
      eligible: true;
      policyVersion: string;
    }>
  | Readonly<{ eligible: false; reason: string }>;

export type PreparedCommercialRefundRequest = Readonly<{
  canonicalRequestHash: Uint8Array;
  createdAt: string;
  idempotencyKeyHash: Uint8Array;
  orderId: string;
  providerAccountFingerprint: string;
  refundId: string;
  userId: string;
}>;

export type CommercialRefundRequestRecord = Readonly<{
  amountMinor: number;
  currencyCode: string;
  eligibilityPolicyVersion: string;
  kind: "created" | "replayed";
  orderId: string;
  orderStatus: string;
  providerIdempotencyKey: string;
  providerPaymentIntentId: string;
  providerRefundId: string | null;
  refundId: string;
  refundPolicyVersion: string;
  requestStatus: "confirmed" | "prepared" | "submitted";
}>;

export type CommercialRefundPersistence = Readonly<{
  prepareStripeSandboxRefund(
    input: PreparedCommercialRefundRequest,
    evaluate: CommercialRefundEligibilityPlanner,
  ): Promise<CommercialRefundRequestRecord>;
  rejectStripeSandboxRefund(input: {
    refundId: string;
    rejectedAt: string;
    userId: string;
  }): Promise<void>;
  submitStripeSandboxRefund(input: {
    providerRefundId: string;
    refundId: string;
    submittedAt: string;
    userId: string;
  }): Promise<CommercialRefundRequestRecord>;
}>;

type RefundRow = Readonly<{
  amountMinor: number;
  canonicalRequestHash: Uint8Array;
  currencyCode: string;
  eligibilityPolicyVersion: string;
  id: string;
  idempotencyKeyHash: Uint8Array;
  orderId: string;
  orderStatus: string;
  providerAccountFingerprint: string;
  providerIdempotencyKeyHash: Uint8Array;
  providerPaymentIntentId: string | null;
  providerRefundId: string | null;
  publicId: string;
  refundPolicyVersion: string;
  status: string;
  userId: string;
}>;

type CandidateRow = Readonly<{
  attemptId: string;
  attemptState: string;
  countryCode: string;
  creditsGranted: number | null;
  currencyCode: string;
  fulfillmentKind: string;
  fulfillmentStatus: string;
  grantAmount: number;
  grantId: string;
  heldAmount: number;
  orderId: string;
  orderStatus: CommercialRefundEligibilityPlanner extends (input: infer Input) => unknown
    ? Input extends { orderStatus: infer Status }
      ? Status
      : never
    : never;
  paymentIntentId: string | null;
  provider: string;
  providerAccountFingerprint: string | null;
  providerEnvironment: string;
  refundPolicyVersion: string;
  refundedMinor: number;
  reversedAmount: number;
  shortfallAmount: number;
  totalMinor: number;
  userId: string;
}>;

const requireUuid = (value: string): string => {
  if (!uuidV4Pattern.test(value)) throw new TypeError("Commercial refund identifier is invalid.");
  return value;
};

const requireFingerprint = (value: string): string => {
  if (!fingerprintPattern.test(value)) {
    throw new TypeError("Commercial refund provider account is invalid.");
  }
  return value;
};

const requireInstant = (value: string): Date => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError("Commercial refund instant is invalid.");
  }
  return parsed;
};

const requireDigest = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
    throw new TypeError("Commercial refund digest is invalid.");
  }
  return new Uint8Array(value);
};

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const digestsEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const providerIdempotencyKey = (refundId: string): string => `stripe:refund:${refundId}:1`;

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

const runSerializable = async <Result>(
  database: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<Result>,
): Promise<Result> => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await database.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5));
    }
  }
  throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
};

const selectRefundByIdempotency = async (
  database: Prisma.TransactionClient,
  userId: string,
  idempotencyKeyHash: Uint8Array,
): Promise<RefundRow | null> => {
  const rows = await database.$queryRaw<RefundRow[]>`
    SELECT
      refunds.amount_minor AS "amountMinor",
      refunds.canonical_request_hash AS "canonicalRequestHash",
      refunds.currency_code AS "currencyCode",
      refunds.eligibility_policy_version AS "eligibilityPolicyVersion",
      refunds.id,
      refunds.idempotency_key_hash AS "idempotencyKeyHash",
      orders.public_id AS "orderId",
      orders.status AS "orderStatus",
      refunds.provider_account_fingerprint AS "providerAccountFingerprint",
      refunds.provider_idempotency_key_hash AS "providerIdempotencyKeyHash",
      attempts.provider_payment_intent_id AS "providerPaymentIntentId",
      refunds.provider_refund_id AS "providerRefundId",
      refunds.public_id AS "publicId",
      refunds.refund_policy_version AS "refundPolicyVersion",
      refunds.status,
      refunds.user_id AS "userId"
    FROM commercial_refund_request_v1 AS refunds
    JOIN commercial_order_v2 AS orders ON orders.id = refunds.order_id
    JOIN commercial_payment_attempt_v2 AS attempts
      ON attempts.id = refunds.payment_attempt_id
     AND attempts.order_id = refunds.order_id
    WHERE refunds.user_id = ${userId}::uuid
      AND refunds.idempotency_key_version = ${idempotencyKeyVersion}
      AND refunds.idempotency_key_hash = ${idempotencyKeyHash}
    FOR UPDATE OF refunds, orders
  `;
  if (rows.length > 1) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
  }
  return rows.at(0) ?? null;
};

const selectRefundByPublicId = async (
  database: Prisma.TransactionClient,
  userId: string,
  refundId: string,
): Promise<RefundRow | null> => {
  const rows = await database.$queryRaw<RefundRow[]>`
    SELECT
      refunds.amount_minor AS "amountMinor",
      refunds.canonical_request_hash AS "canonicalRequestHash",
      refunds.currency_code AS "currencyCode",
      refunds.eligibility_policy_version AS "eligibilityPolicyVersion",
      refunds.id,
      refunds.idempotency_key_hash AS "idempotencyKeyHash",
      orders.public_id AS "orderId",
      orders.status AS "orderStatus",
      refunds.provider_account_fingerprint AS "providerAccountFingerprint",
      refunds.provider_idempotency_key_hash AS "providerIdempotencyKeyHash",
      attempts.provider_payment_intent_id AS "providerPaymentIntentId",
      refunds.provider_refund_id AS "providerRefundId",
      refunds.public_id AS "publicId",
      refunds.refund_policy_version AS "refundPolicyVersion",
      refunds.status,
      refunds.user_id AS "userId"
    FROM commercial_refund_request_v1 AS refunds
    JOIN commercial_order_v2 AS orders ON orders.id = refunds.order_id
    JOIN commercial_payment_attempt_v2 AS attempts
      ON attempts.id = refunds.payment_attempt_id
     AND attempts.order_id = refunds.order_id
    WHERE refunds.user_id = ${userId}::uuid
      AND refunds.public_id = ${refundId}::uuid
    FOR UPDATE OF refunds, orders
  `;
  if (rows.length > 1) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
  }
  return rows.at(0) ?? null;
};

const mapRefund = (
  row: RefundRow,
  kind: CommercialRefundRequestRecord["kind"],
): CommercialRefundRequestRecord => {
  if (
    row.userId.length === 0 ||
    row.providerPaymentIntentId === null ||
    row.eligibilityPolicyVersion !== eligibilityPolicyVersion ||
    !["confirmed", "prepared", "submitted"].includes(row.status) ||
    (row.status === "prepared" && row.providerRefundId !== null) ||
    (row.status === "submitted" &&
      (row.providerRefundId === null || !refundIdPattern.test(row.providerRefundId))) ||
    (row.status === "confirmed" &&
      row.providerRefundId !== null &&
      !refundIdPattern.test(row.providerRefundId)) ||
    !digestsEqual(row.providerIdempotencyKeyHash, digest(providerIdempotencyKey(row.publicId)))
  ) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
  }
  return Object.freeze({
    amountMinor: row.amountMinor,
    currencyCode: row.currencyCode,
    eligibilityPolicyVersion: row.eligibilityPolicyVersion,
    kind,
    orderId: row.orderId,
    orderStatus: row.orderStatus,
    providerIdempotencyKey: providerIdempotencyKey(row.publicId),
    providerPaymentIntentId: row.providerPaymentIntentId,
    providerRefundId: row.providerRefundId,
    refundId: row.publicId,
    refundPolicyVersion: row.refundPolicyVersion,
    requestStatus: row.status as CommercialRefundRequestRecord["requestStatus"],
  });
};

const prepareRefund = async (
  database: Prisma.TransactionClient,
  input: Omit<
    PreparedCommercialRefundRequest,
    "canonicalRequestHash" | "createdAt" | "idempotencyKeyHash"
  > & {
    canonicalRequestHash: Uint8Array<ArrayBuffer>;
    createdAt: Date;
    idempotencyKeyHash: Uint8Array<ArrayBuffer>;
  },
  evaluate: CommercialRefundEligibilityPlanner,
): Promise<CommercialRefundRequestRecord> => {
  const existing = await selectRefundByIdempotency(
    database,
    input.userId,
    input.idempotencyKeyHash,
  );
  if (existing !== null) {
    if (
      existing.status === "rejected" ||
      !digestsEqual(existing.canonicalRequestHash, input.canonicalRequestHash) ||
      existing.providerAccountFingerprint !== input.providerAccountFingerprint
    ) {
      throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
    }
    return mapRefund(existing, "replayed");
  }

  const existingOrderRequests = await database.$queryRaw<Readonly<{ id: string }>[]>`
    SELECT refunds.id
    FROM commercial_refund_request_v1 AS refunds
    JOIN commercial_order_v2 AS orders ON orders.id = refunds.order_id
    WHERE orders.public_id = ${input.orderId}::uuid
      AND refunds.user_id = ${input.userId}::uuid
    FOR UPDATE OF refunds
  `;
  if (existingOrderRequests.length > 0) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
  }

  const candidates = await database.$queryRaw<CandidateRow[]>`
    SELECT
      attempts.id AS "attemptId",
      attempts.state AS "attemptState",
      orders.country_code AS "countryCode",
      items.credits_granted AS "creditsGranted",
      orders.currency_code AS "currencyCode",
      items.fulfillment_kind AS "fulfillmentKind",
      fulfillment.status AS "fulfillmentStatus",
      fulfillment.granted_amount AS "grantAmount",
      fulfillment.source_grant_entry_id AS "grantId",
      fulfillment.held_amount AS "heldAmount",
      orders.id AS "orderId",
      orders.status AS "orderStatus",
      attempts.provider_payment_intent_id AS "paymentIntentId",
      attempts.provider,
      attempts.provider_account_fingerprint AS "providerAccountFingerprint",
      attempts.environment AS "providerEnvironment",
      orders.refund_policy_version AS "refundPolicyVersion",
      orders.refunded_minor AS "refundedMinor",
      fulfillment.reversed_amount AS "reversedAmount",
      fulfillment.shortfall_amount AS "shortfallAmount",
      orders.total_minor AS "totalMinor",
      orders.user_id AS "userId"
    FROM commercial_order_v2 AS orders
    JOIN commercial_order_item_v2 AS items ON items.order_id = orders.id
    JOIN commercial_payment_attempt_v2 AS attempts
      ON attempts.order_id = orders.id
     AND attempts.attempt_number = 1
    JOIN commercial_fulfillment_v2 AS fulfillment
      ON fulfillment.order_id = orders.id
     AND fulfillment.user_id = orders.user_id
    JOIN credit_ledger_entry AS ledger_grant
      ON ledger_grant.id = fulfillment.source_grant_entry_id
     AND ledger_grant.user_id = orders.user_id
    WHERE orders.public_id = ${input.orderId}::uuid
      AND orders.user_id = ${input.userId}::uuid
      AND items.fulfillment_kind = 'credit_pack'
      AND ledger_grant.direction = 'grant'
      AND ledger_grant.credit_type = 'purchased_credit'
      AND ledger_grant.order_id = orders.id
    FOR UPDATE OF orders, attempts
  `;
  const candidate = candidates.at(0);
  if (candidates.length !== 1 || candidate === undefined) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_NOT_ELIGIBLE");
  }
  if (
    candidate.userId !== input.userId ||
    candidate.creditsGranted === null ||
    candidate.attemptState !== "succeeded" ||
    candidate.paymentIntentId === null ||
    candidate.providerAccountFingerprint !== input.providerAccountFingerprint
  ) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_NOT_ELIGIBLE");
  }

  const projections = await database.$queryRaw<
    Readonly<{ purchasedAvailable: number; purchasedHeld: number }>[]
  >`
    SELECT
      purchased_available AS "purchasedAvailable",
      purchased_held AS "purchasedHeld"
    FROM credit_projection
    WHERE user_id = ${input.userId}::uuid
    FOR UPDATE
  `;
  const projection = projections.at(0);
  if (projections.length !== 1 || projection === undefined) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_NOT_ELIGIBLE");
  }

  const [unavailable, activeHolds, reversed] = await Promise.all([
    database.$queryRaw<Readonly<{ amount: number }>[]>`
      SELECT COALESCE(SUM(allocations.amount), 0)::int AS amount
      FROM credit_allocation AS allocations
      JOIN credit_reservation AS reservations ON reservations.id = allocations.reservation_id
      WHERE allocations.source_entry_id = ${candidate.grantId}::uuid
        AND allocations.user_id = ${input.userId}::uuid
        AND reservations.user_id = ${input.userId}::uuid
        AND reservations.status IN ('active', 'consumed')
    `,
    database.$queryRaw<Readonly<{ amount: number }>[]>`
      SELECT COALESCE(SUM(active.amount), 0)::int AS amount
      FROM (
        SELECT holds.amount
        FROM credit_restriction_entry AS holds
        WHERE holds.source_entry_id = ${candidate.grantId}::uuid
          AND holds.kind = 'hold'
          AND NOT EXISTS (
            SELECT 1
            FROM credit_restriction_entry AS resolution
            WHERE resolution.source_restriction_id = holds.id
              AND resolution.kind = 'convert_to_reverse'
          )
        UNION ALL
        SELECT holds.amount
        FROM commercial_refund_credit_hold_v1 AS holds
        WHERE holds.source_entry_id = ${candidate.grantId}::uuid
          AND holds.status = 'active'
      ) AS active
    `,
    database.$queryRaw<Readonly<{ amount: number }>[]>`
      SELECT COALESCE(SUM(amount), 0)::int AS amount
      FROM credit_ledger_entry
      WHERE source_entry_id = ${candidate.grantId}::uuid
        AND direction IN ('reverse', 'expire')
    `,
  ]);
  const heldAmount = activeHolds.at(0)?.amount ?? 0;
  const reversedAmount = reversed.at(0)?.amount ?? 0;
  const unavailableAmount = unavailable.at(0)?.amount ?? 0;
  if (
    heldAmount !== candidate.heldAmount ||
    reversedAmount !== candidate.reversedAmount ||
    projection.purchasedHeld < heldAmount
  ) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
  }

  const eligibility = evaluate({
    countryCode: candidate.countryCode,
    creditsGranted: candidate.creditsGranted,
    currencyCode: candidate.currencyCode,
    environment: candidate.providerEnvironment,
    fulfillmentKind: candidate.fulfillmentKind,
    fulfillmentStatus: candidate.fulfillmentStatus,
    grantedAmount: candidate.grantAmount,
    heldAmount,
    orderStatus: candidate.orderStatus,
    provider: candidate.provider,
    refundedMinor: candidate.refundedMinor,
    refundPolicyVersion: candidate.refundPolicyVersion,
    reversedAmount,
    shortfallAmount: candidate.shortfallAmount,
    totalMinor: candidate.totalMinor,
    unavailableAmount,
  });
  if (
    !eligibility.eligible ||
    eligibility.policyVersion !== eligibilityPolicyVersion ||
    eligibility.amountMinor !== candidate.totalMinor ||
    eligibility.creditsToHold !== candidate.creditsGranted ||
    projection.purchasedAvailable < eligibility.creditsToHold
  ) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_NOT_ELIGIBLE");
  }

  const providerKey = providerIdempotencyKey(input.refundId);
  const requests = await database.$queryRaw<Readonly<{ id: string }>[]>`
    INSERT INTO commercial_refund_request_v1 (
      public_id, user_id, order_id, payment_attempt_id, provider, environment,
      provider_account_fingerprint, provider_refund_id, status, amount_minor, currency_code,
      refund_policy_version, eligibility_policy_version, reason_code, idempotency_key_version,
      idempotency_key_hash, canonical_request_hash, provider_idempotency_key_hash,
      provider_rejection_code, created_at, submitted_at, rejected_at, updated_at
    ) VALUES (
      ${input.refundId}::uuid, ${input.userId}::uuid, ${candidate.orderId}::uuid,
      ${candidate.attemptId}::uuid, 'stripe', 'sandbox', ${input.providerAccountFingerprint},
      NULL, 'prepared', ${eligibility.amountMinor}, ${candidate.currencyCode},
      ${candidate.refundPolicyVersion}, ${eligibility.policyVersion}, 'unused_credit_pack',
      ${idempotencyKeyVersion}, ${input.idempotencyKeyHash}, ${input.canonicalRequestHash},
      ${digest(providerKey)}, NULL, ${input.createdAt}, NULL, NULL, ${input.createdAt}
    )
    RETURNING id
  `;
  const requestId = requests.at(0)?.id;
  if (requests.length !== 1 || requestId === undefined) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
  }
  await enqueueOperationalCase(database, {
    sourceId: requestId,
    sourceKind: "commercial_refund_request",
  });

  const holdCanonicalHash = digest(
    JSON.stringify({
      amount: eligibility.creditsToHold,
      orderId: candidate.orderId,
      refundId: input.refundId,
      sourceEntryId: candidate.grantId,
    }),
  );
  const holdInserted = await database.$executeRaw`
    INSERT INTO commercial_refund_credit_hold_v1 (
      refund_request_id, user_id, order_id, source_entry_id, amount, status,
      idempotency_key_version, idempotency_key_hash, canonical_request_hash,
      created_at, released_at, converted_at, updated_at
    ) VALUES (
      ${requestId}::uuid, ${input.userId}::uuid, ${candidate.orderId}::uuid,
      ${candidate.grantId}::uuid, ${eligibility.creditsToHold}, 'active',
      ${idempotencyKeyVersion},
      ${digest(`credit.hold.refund-request:${input.refundId}`)}, ${holdCanonicalHash},
      ${input.createdAt}, NULL, NULL, ${input.createdAt}
    )
  `;
  const projectionUpdated = await database.$executeRaw`
    UPDATE credit_projection
    SET purchased_available = purchased_available - ${eligibility.creditsToHold},
        purchased_held = purchased_held + ${eligibility.creditsToHold},
        version = version + 1,
        updated_at = ${input.createdAt}
    WHERE user_id = ${input.userId}::uuid
      AND purchased_available >= ${eligibility.creditsToHold}
  `;
  if (holdInserted !== 1 || projectionUpdated !== 1) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
  }
  const created = await selectRefundByPublicId(database, input.userId, input.refundId);
  if (created === null) {
    throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
  }
  return mapRefund(created, "created");
};

export const createCommercialRefundPersistence = (
  database: PrismaClient,
): CommercialRefundPersistence =>
  Object.freeze({
    async prepareStripeSandboxRefund(input, evaluate) {
      requireUuid(input.userId);
      requireUuid(input.orderId);
      requireUuid(input.refundId);
      requireFingerprint(input.providerAccountFingerprint);
      if (typeof evaluate !== "function") {
        throw new TypeError("Commercial refund eligibility planner is invalid.");
      }
      const canonicalRequestHash = requireDigest(input.canonicalRequestHash);
      const idempotencyKeyHash = requireDigest(input.idempotencyKeyHash);
      const createdAt = requireInstant(input.createdAt);
      try {
        return await runSerializable(database, (transaction) =>
          prepareRefund(
            transaction,
            { ...input, canonicalRequestHash, createdAt, idempotencyKeyHash },
            evaluate,
          ),
        );
      } catch (error) {
        if (error instanceof CommercialRefundPersistenceError) throw error;
        throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE", {
          cause: error,
        });
      }
    },

    async rejectStripeSandboxRefund(input) {
      requireUuid(input.userId);
      requireUuid(input.refundId);
      const rejectedAt = requireInstant(input.rejectedAt);
      try {
        await runSerializable(database, async (transaction) => {
          const refund = await selectRefundByPublicId(transaction, input.userId, input.refundId);
          if (refund === null) {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_NOT_FOUND");
          }
          if (refund.status === "rejected") return;
          if (refund.status !== "prepared") {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
          }
          if (refund.orderStatus === "paid") {
            const holds = await transaction.$queryRaw<Readonly<{ amount: number; id: string }>[]>`
              SELECT holds.amount, holds.id
              FROM commercial_refund_credit_hold_v1 AS holds
              WHERE holds.refund_request_id = ${refund.id}::uuid
                AND holds.status = 'active'
              FOR UPDATE OF holds
            `;
            const hold = holds.at(0);
            if (holds.length !== 1 || hold === undefined) {
              throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
            }
            const released = await transaction.$executeRaw`
              UPDATE commercial_refund_credit_hold_v1
              SET status = 'released',
                  released_at = ${rejectedAt},
                  updated_at = ${rejectedAt}
              WHERE id = ${hold.id}::uuid
                AND status = 'active'
            `;
            const restored = await transaction.$executeRaw`
              UPDATE credit_projection
              SET purchased_available = purchased_available + ${hold.amount},
                  purchased_held = purchased_held - ${hold.amount},
                  version = version + 1,
                  updated_at = ${rejectedAt}
              WHERE user_id = ${input.userId}::uuid
                AND purchased_held >= ${hold.amount}
            `;
            if (released !== 1 || restored !== 1) {
              throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
            }
          }
          const rejected = await transaction.$executeRaw`
            UPDATE commercial_refund_request_v1
            SET status = 'rejected',
                provider_rejection_code = 'provider_rejected',
                rejected_at = ${rejectedAt},
                updated_at = ${rejectedAt}
            WHERE id = ${refund.id}::uuid
              AND status = 'prepared'
          `;
          if (rejected !== 1) {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
          }
        });
      } catch (error) {
        if (error instanceof CommercialRefundPersistenceError) throw error;
        throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
      }
    },

    async submitStripeSandboxRefund(input) {
      requireUuid(input.userId);
      requireUuid(input.refundId);
      if (!refundIdPattern.test(input.providerRefundId)) {
        throw new TypeError("Commercial provider refund identifier is invalid.");
      }
      const submittedAt = requireInstant(input.submittedAt);
      try {
        return await runSerializable(database, async (transaction) => {
          const refund = await selectRefundByPublicId(transaction, input.userId, input.refundId);
          if (refund === null) {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_NOT_FOUND");
          }
          if (refund.status === "submitted") {
            if (refund.providerRefundId !== input.providerRefundId) {
              throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
            }
            return mapRefund(refund, "replayed");
          }
          if (refund.status === "confirmed") {
            if (
              refund.providerRefundId !== null &&
              refund.providerRefundId !== input.providerRefundId
            ) {
              throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
            }
            if (refund.providerRefundId === null) {
              const attached = await transaction.$executeRaw`
                UPDATE commercial_refund_request_v1
                SET provider_refund_id = ${input.providerRefundId},
                    submitted_at = ${submittedAt},
                    updated_at = GREATEST(updated_at, ${submittedAt})
                WHERE id = ${refund.id}::uuid
                  AND status = 'confirmed'
                  AND provider_refund_id IS NULL
              `;
              if (attached !== 1) {
                throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
              }
              const updated = await selectRefundByPublicId(
                transaction,
                input.userId,
                input.refundId,
              );
              if (updated === null) {
                throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
              }
              return mapRefund(updated, "created");
            }
            return mapRefund(refund, "replayed");
          }
          if (refund.status !== "prepared") {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
          }
          const submitted = await transaction.$executeRaw`
            UPDATE commercial_refund_request_v1
            SET status = 'submitted',
                provider_refund_id = ${input.providerRefundId},
                submitted_at = ${submittedAt},
                updated_at = ${submittedAt}
            WHERE id = ${refund.id}::uuid
              AND status = 'prepared'
          `;
          if (submitted !== 1) {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
          }
          if (refund.orderStatus === "paid") {
            const orderUpdated = await transaction.$executeRaw`
              UPDATE commercial_order_v2
              SET status = 'refund_requested',
                  refund_requested_at = ${submittedAt},
                  updated_at = ${submittedAt}
              WHERE public_id = ${refund.orderId}::uuid
                AND user_id = ${input.userId}::uuid
                AND status = 'paid'
            `;
            if (orderUpdated !== 1) {
              throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
            }
          } else if (!["refund_requested", "disputed", "refunded"].includes(refund.orderStatus)) {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_CONFLICT");
          }
          const updated = await selectRefundByPublicId(transaction, input.userId, input.refundId);
          if (updated === null) {
            throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
          }
          return mapRefund(updated, "created");
        });
      } catch (error) {
        if (error instanceof CommercialRefundPersistenceError) throw error;
        throw new CommercialRefundPersistenceError("COMMERCIAL_REFUND_UNAVAILABLE");
      }
    },
  });
