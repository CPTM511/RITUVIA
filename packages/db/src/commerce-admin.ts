import { createHash, timingSafeEqual } from "node:crypto";

import { adminSafeDiffFieldsFor, type AdminRole } from "@rituvia/security";
import { Prisma, type PrismaClient } from "./generated/prisma/client.js";
import {
  AdminSecurityError,
  authorizeAdminOwnerOperation,
  type AdminSecurityErrorCode,
  type AdminTransactionClient,
  type AuthorizedAdminSession,
} from "./admin-security.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const idempotencyKeyPattern =
  /^(?:[A-Za-z0-9_-]{22,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u;
const reasonCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const ticketReferencePattern = /^[A-Z][A-Z0-9_-]{2,63}$/u;
const policyVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u;
const resultReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export const commerceAdminErrorCodes = Object.freeze([
  "COMMERCE_ADMIN_UNAVAILABLE",
  "COMMERCE_ADMIN_SESSION_UNAVAILABLE",
  "COMMERCE_ADMIN_RECENT_AUTH_REQUIRED",
  "COMMERCE_ADMIN_MFA_REQUIRED",
  "COMMERCE_ADMIN_FORBIDDEN",
  "COMMERCE_ADMIN_REQUEST_INVALID",
  "COMMERCE_ADMIN_NOT_FOUND",
  "COMMERCE_ADMIN_CONFLICT",
  "COMMERCE_ADMIN_LIMIT_EXCEEDED",
  "COMMERCE_ADMIN_ACTION_FAILED",
] as const);

export type CommerceAdminErrorCode = (typeof commerceAdminErrorCodes)[number];

export class CommerceAdminError extends Error {
  readonly code: CommerceAdminErrorCode;

  constructor(code: CommerceAdminErrorCode, options?: ErrorOptions) {
    super("The commerce administration operation could not be completed.", options);
    this.name = "CommerceAdminError";
    this.code = code;
  }
}

export type CommerceAdminPolicy = Readonly<{
  executionLeaseSeconds: number;
  limitPolicyVersion: string;
  maxExecutionAttempts: number;
  maxInspectionsPerActorPerMinute: number;
  maxManualReconciliationsPerOrderPerHour: number;
  maxRefundMinor: number;
  maxRefundMinorPerActorPerDay: number;
  maxTimelineEvents: number;
  recentAuthenticationSeconds: number;
}>;

export type CommerceAdminTimelineEvent = Readonly<{
  amountMinor: number | null;
  code: string;
  currencyCode: string | null;
  occurredAt: string;
  reference: string;
  source: "admin" | "credit" | "order" | "payment" | "reconciliation" | "refund" | "subscription";
  state: string | null;
}>;

export type CommerceAdminOrderTimeline = Readonly<{
  events: readonly CommerceAdminTimelineEvent[];
  order: Readonly<{
    accountReference: string;
    amountMinor: number;
    currencyCode: string;
    environment: string;
    orderId: string;
    productCode: string;
    provider: string;
    status: string;
  }>;
  truncated: boolean;
}>;

export type CommerceAdminActionResult = Readonly<{
  kind: "created" | "replayed";
  operationId: string;
  resultReference: string | null;
  state: "failed" | "pending" | "succeeded";
}>;

export type CommerceAdminExecutors = Readonly<{
  reconcile(input: { idempotencyKey: string; operationId: string; orderId: string }): Promise<
    Readonly<{
      cases: number;
      disposition: "cases_found" | "clean" | "duplicate" | "truncated";
      runId: string;
    }>
  >;
  refund(input: {
    amountMinor: number;
    currencyCode: string;
    idempotencyKey: string;
    operationId: string;
    orderId: string;
    userId: string;
  }): Promise<
    Readonly<{
      amountMinor: number;
      currencyCode: string;
      refundId: string;
      state: "disputed" | "refund_requested" | "refunded";
    }>
  >;
}>;

type AdminOperationAction = "reconcile_order" | "refund_order";
type CommerceAdminAuditAction =
  "admin.commerce.read" | "admin.commerce.reconcile" | "admin.refund.execute";
type CommerceAdminAuditInput = Readonly<{
  action: CommerceAdminAuditAction;
  actorRole: AdminRole | null;
  afterDigest: Uint8Array | null;
  beforeDigest: Uint8Array | null;
  outcome: "accepted" | "completed" | "denied";
  reasonCode: string;
  session: AuthorizedAdminSession;
  targetId: string;
  targetType: string;
  ticketReference: string | null;
}>;
type OperationRow = Readonly<{
  action: AdminOperationAction;
  amountMinor: number | null;
  currencyCode: string | null;
  id: string;
  orderId: string;
  orderPublicId: string;
  userId: string;
}>;
type OrderRow = Readonly<{
  amountMinor: number;
  currencyCode: string;
  environment: string;
  id: string;
  productCode: string;
  provider: string;
  publicId: string;
  status: string;
  userId: string;
}>;
type TimelineRow = Readonly<{
  amountMinor: number | null;
  code: string;
  currencyCode: string | null;
  occurredAt: Date;
  reference: string;
  source: CommerceAdminTimelineEvent["source"];
  state: string | null;
}>;
type PreparedOperation = Readonly<{
  kind: "created" | "replayed";
  operation: OperationRow;
}>;
type TransactionResult<Value> =
  Readonly<{ error: CommerceAdminErrorCode }> | Readonly<{ value: Value }>;

const validatePolicy = (policy: CommerceAdminPolicy): CommerceAdminPolicy => {
  if (
    !policyVersionPattern.test(policy.limitPolicyVersion) ||
    !Number.isSafeInteger(policy.recentAuthenticationSeconds) ||
    policy.recentAuthenticationSeconds < 60 ||
    policy.recentAuthenticationSeconds > 3_600 ||
    !Number.isSafeInteger(policy.maxTimelineEvents) ||
    policy.maxTimelineEvents < 1 ||
    policy.maxTimelineEvents > 100 ||
    !Number.isSafeInteger(policy.maxRefundMinor) ||
    policy.maxRefundMinor < 1 ||
    !Number.isSafeInteger(policy.maxRefundMinorPerActorPerDay) ||
    policy.maxRefundMinorPerActorPerDay < policy.maxRefundMinor ||
    !Number.isSafeInteger(policy.maxManualReconciliationsPerOrderPerHour) ||
    policy.maxManualReconciliationsPerOrderPerHour < 1 ||
    policy.maxManualReconciliationsPerOrderPerHour > 10 ||
    !Number.isSafeInteger(policy.maxInspectionsPerActorPerMinute) ||
    policy.maxInspectionsPerActorPerMinute < 1 ||
    policy.maxInspectionsPerActorPerMinute > 100 ||
    !Number.isSafeInteger(policy.maxExecutionAttempts) ||
    policy.maxExecutionAttempts < 1 ||
    policy.maxExecutionAttempts > 5 ||
    !Number.isSafeInteger(policy.executionLeaseSeconds) ||
    policy.executionLeaseSeconds < 30 ||
    policy.executionLeaseSeconds > 3_600
  ) {
    throw new TypeError("Commerce administration policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(createHash("sha256").update(value, "utf8").digest());

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const accountReference = (userId: string): string =>
  createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 20);

const commerceAuditPayload = (input: {
  audit: CommerceAdminAuditInput;
  createdAt: Date;
  eventId: string;
  previousEventHash: Uint8Array | null;
  requestId: string;
}): string =>
  JSON.stringify({
    action: input.audit.action,
    actorRole: input.audit.actorRole,
    actorSessionId: input.audit.session.sessionId,
    actorUserId: input.audit.session.userId,
    afterDigest:
      input.audit.afterDigest === null
        ? null
        : Buffer.from(input.audit.afterDigest).toString("hex"),
    beforeDigest:
      input.audit.beforeDigest === null
        ? null
        : Buffer.from(input.audit.beforeDigest).toString("hex"),
    changeFields: adminSafeDiffFieldsFor(input.audit.action),
    createdAt: input.createdAt.toISOString(),
    eventId: input.eventId,
    outcome: input.audit.outcome,
    previousEventHash:
      input.previousEventHash === null
        ? null
        : Buffer.from(input.previousEventHash).toString("hex"),
    reasonCode: input.audit.reasonCode,
    requestId: input.requestId,
    targetId: input.audit.targetId,
    targetType: input.audit.targetType,
    ticketReference: input.audit.ticketReference,
  });

const appendCommerceAdminAuditEvent = async (
  transaction: AdminTransactionClient,
  audit: CommerceAdminAuditInput,
): Promise<string> => {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended('commerce_admin_audit_event_v1', 56073))
  `;
  const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT CURRENT_TIMESTAMP AS now
  `;
  const previous = await transaction.$queryRaw<Array<{ eventHash: Uint8Array }>>`
    SELECT event_hash AS "eventHash"
    FROM commerce_admin_audit_event_v1
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;
  const createdAt = clocks[0]?.now;
  if (createdAt === undefined || previous.length > 1) {
    throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
  }
  const eventId = globalThis.crypto.randomUUID();
  const requestId = globalThis.crypto.randomUUID();
  const previousEventHash = previous[0]?.eventHash ?? null;
  const eventHash = digest(
    commerceAuditPayload({ audit, createdAt, eventId, previousEventHash, requestId }),
  );
  const inserted = await transaction.$executeRaw`
    INSERT INTO commerce_admin_audit_event_v1 (
      id, actor_user_id, actor_session_id, actor_role, request_id, action, outcome,
      target_type, target_id, reason_code, ticket_reference, change_fields,
      before_digest, after_digest, previous_event_hash, event_hash, created_at
    ) VALUES (
      ${eventId}::uuid, ${audit.session.userId}::uuid, ${audit.session.sessionId}::uuid,
      ${audit.actorRole}, ${requestId}::uuid, ${audit.action}, ${audit.outcome}, ${audit.targetType},
      ${audit.targetId}, ${audit.reasonCode}, ${audit.ticketReference},
      ${[...adminSafeDiffFieldsFor(audit.action)]}::text[], ${audit.beforeDigest},
      ${audit.afterDigest}, ${previousEventHash}, ${eventHash}, ${createdAt}
    )
  `;
  if (inserted !== 1) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
  return eventId;
};

export const verifyCommerceAdminAuditEventHash = (event: {
  action: CommerceAdminAuditAction;
  actorRole: AdminRole | null;
  actorSessionId: string;
  actorUserId: string;
  afterDigest: Uint8Array | null;
  beforeDigest: Uint8Array | null;
  createdAt: Date;
  eventHash: Uint8Array;
  eventId: string;
  outcome: "accepted" | "completed" | "denied";
  previousEventHash: Uint8Array | null;
  reasonCode: string;
  requestId: string;
  targetId: string;
  targetType: string;
  ticketReference: string | null;
}): boolean => {
  const expected = digest(
    commerceAuditPayload({
      audit: {
        action: event.action,
        actorRole: event.actorRole,
        afterDigest: event.afterDigest,
        beforeDigest: event.beforeDigest,
        outcome: event.outcome,
        reasonCode: event.reasonCode,
        session: {
          authenticatedAt: null,
          authIdentityId: "",
          sessionId: event.actorSessionId,
          userId: event.actorUserId,
        },
        targetId: event.targetId,
        targetType: event.targetType,
        ticketReference: event.ticketReference,
      },
      createdAt: event.createdAt,
      eventId: event.eventId,
      previousEventHash: event.previousEventHash,
      requestId: event.requestId,
    }),
  );
  return bytesEqual(expected, event.eventHash);
};

const requireUuid = (value: unknown): string => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) {
    throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
  }
  return value;
};

const requireIdempotencyKey = (value: unknown): string => {
  if (typeof value !== "string" || !idempotencyKeyPattern.test(value)) {
    throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
  }
  return value;
};

const requireReasonCode = (value: unknown): string => {
  if (typeof value !== "string" || !reasonCodePattern.test(value)) {
    throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
  }
  return value;
};

const requireTicketReference = (value: unknown): string => {
  if (typeof value !== "string" || !ticketReferencePattern.test(value)) {
    throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
  }
  return value;
};

const mapAdminError = (error: AdminSecurityErrorCode): CommerceAdminErrorCode => {
  switch (error) {
    case "ADMIN_SESSION_UNAVAILABLE":
      return "COMMERCE_ADMIN_SESSION_UNAVAILABLE";
    case "ADMIN_RECENT_AUTH_REQUIRED":
      return "COMMERCE_ADMIN_RECENT_AUTH_REQUIRED";
    case "ADMIN_MFA_REQUIRED":
      return "COMMERCE_ADMIN_MFA_REQUIRED";
    case "ADMIN_FORBIDDEN":
      return "COMMERCE_ADMIN_FORBIDDEN";
    case "ADMIN_REQUEST_INVALID":
      return "COMMERCE_ADMIN_REQUEST_INVALID";
    case "ADMIN_SECURITY_UNAVAILABLE":
    case "ADMIN_ROLE_CONFLICT":
    case "ADMIN_LAST_OWNER":
      return "COMMERCE_ADMIN_UNAVAILABLE";
  }
};

const throwIfError = <Value>(result: TransactionResult<Value>): Value => {
  if ("error" in result) throw new CommerceAdminError(result.error);
  return result.value;
};

const runCommerceAdminTransaction = async <Value>(
  database: PrismaClient,
  callback: (transaction: AdminTransactionClient) => Promise<Value>,
): Promise<Value> => {
  try {
    return await database.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  } catch (error) {
    if (error instanceof CommerceAdminError || error instanceof AdminSecurityError) throw error;
    throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE", { cause: error });
  }
};

const appendDeniedAudit = async (
  transaction: AdminTransactionClient,
  input: Omit<CommerceAdminAuditInput, "outcome">,
): Promise<void> =>
  appendCommerceAdminAuditEvent(transaction, { ...input, outcome: "denied" }).then(() => undefined);

const authorize = async (
  transaction: AdminTransactionClient,
  input: {
    action: CommerceAdminAuditAction;
    orderId: string;
    policy: CommerceAdminPolicy;
    sessionToken: string;
  },
): Promise<
  Readonly<{ error: CommerceAdminErrorCode }> | Readonly<{ session: AuthorizedAdminSession }>
> => {
  const authorization = await authorizeAdminOwnerOperation(transaction, {
    action: input.action,
    policy: input.policy,
    sessionToken: input.sessionToken,
  });
  if (authorization.authorized) return Object.freeze({ session: authorization.session });
  if (authorization.session !== null) {
    const denialReason =
      authorization.error === "ADMIN_RECENT_AUTH_REQUIRED"
        ? "recent_authentication_required"
        : authorization.error === "ADMIN_MFA_REQUIRED"
          ? "passkey_mfa_required"
          : authorization.error === "ADMIN_FORBIDDEN"
            ? "owner_role_required"
            : "authorization_denied";
    await appendDeniedAudit(transaction, {
      action: input.action,
      actorRole: authorization.role,
      afterDigest: null,
      beforeDigest: null,
      reasonCode: denialReason,
      session: authorization.session,
      targetId: input.orderId,
      targetType: "commercial_order",
      ticketReference: null,
    });
  }
  return Object.freeze({ error: mapAdminError(authorization.error) });
};

const readOrder = async (
  transaction: AdminTransactionClient,
  orderPublicId: string,
): Promise<OrderRow | null> => {
  const rows = await transaction.$queryRaw<OrderRow[]>`
    SELECT
      id, public_id AS "publicId", user_id AS "userId", status,
      total_minor AS "amountMinor", currency_code AS "currencyCode",
      product_code AS "productCode", provider, environment
    FROM commerce_admin_order_summary_v1
    WHERE public_id = ${orderPublicId}::uuid
  `;
  if (rows.length > 1) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
  return rows[0] ?? null;
};

const readTimeline = async (
  transaction: AdminTransactionClient,
  order: OrderRow,
  limit: number,
): Promise<Readonly<{ events: readonly TimelineRow[]; truncated: boolean }>> => {
  const rows = await transaction.$queryRaw<TimelineRow[]>`
    SELECT source, code, occurred_at AS "occurredAt", reference, state,
           amount_minor AS "amountMinor", currency_code AS "currencyCode"
    FROM commerce_admin_timeline_v1
    WHERE order_id = ${order.id}::uuid
      AND occurred_at IS NOT NULL
    ORDER BY occurred_at DESC, reference DESC
    LIMIT ${limit + 1}
  `;
  return Object.freeze({
    events: Object.freeze(rows.slice(0, limit)),
    truncated: rows.length > limit,
  });
};

const operationCanonicalRequest = (input: {
  action: AdminOperationAction;
  amountMinor: number | null;
  currencyCode: string | null;
  limitPolicyVersion: string;
  orderId: string;
}): string =>
  JSON.stringify({
    action: input.action,
    amountMinor: input.amountMinor,
    currencyCode: input.currencyCode,
    limitPolicyVersion: input.limitPolicyVersion,
    orderId: input.orderId,
    schemaVersion: "commerce-admin-operation.v1",
  });

const eventEvidence = (input: {
  attemptId: string | null;
  createdAt: Date;
  eventType: "execution_started" | "failed" | "requested" | "succeeded";
  operationId: string;
  resultReference: string | null;
}): Uint8Array<ArrayBuffer> =>
  digest(
    JSON.stringify({
      attemptId: input.attemptId,
      createdAt: input.createdAt.toISOString(),
      eventType: input.eventType,
      operationId: input.operationId,
      resultReference: input.resultReference,
      schemaVersion: "commerce-admin-operation-event.v1",
    }),
  );

export const verifyCommerceAdminOperationEventDigest = (event: {
  attemptId: string | null;
  createdAt: Date;
  eventType: "execution_started" | "failed" | "requested" | "succeeded";
  evidenceDigest: Uint8Array;
  operationId: string;
  resultReference: string | null;
}): boolean => bytesEqual(eventEvidence(event), event.evidenceDigest);

const insertOperationEvent = async (
  transaction: AdminTransactionClient,
  input: {
    attemptId: string | null;
    eventType: "execution_started" | "failed" | "requested" | "succeeded";
    operationId: string;
    resultReference: string | null;
  },
): Promise<string> => {
  const eventId = globalThis.crypto.randomUUID();
  const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT CURRENT_TIMESTAMP AS now
  `;
  const createdAt = clocks[0]?.now;
  if (createdAt === undefined) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
  const inserted = await transaction.$executeRaw`
    INSERT INTO commerce_admin_operation_event_v1 (
      id, operation_id, attempt_id, event_type, result_reference,
      evidence_digest, created_at
    ) VALUES (
      ${eventId}::uuid, ${input.operationId}::uuid, ${input.attemptId}::uuid,
      ${input.eventType}, ${input.resultReference},
      ${eventEvidence({ ...input, createdAt })}, ${createdAt}
    )
  `;
  if (inserted !== 1) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
  return eventId;
};

const prepareOperation = async (
  database: PrismaClient,
  input: {
    action: AdminOperationAction;
    amountMinor: number | null;
    auditedAction: CommerceAdminAuditAction;
    currencyCode: string | null;
    idempotencyKey: string;
    orderPublicId: string;
    policy: CommerceAdminPolicy;
    reasonCode: string;
    sessionToken: string;
    ticketReference: string;
  },
): Promise<PreparedOperation> => {
  const canonicalRequestHash = digest(
    operationCanonicalRequest({
      action: input.action,
      amountMinor: input.amountMinor,
      currencyCode: input.currencyCode,
      limitPolicyVersion: input.policy.limitPolicyVersion,
      orderId: input.orderPublicId,
    }),
  );
  const idempotencyKeyHash = digest(input.idempotencyKey);
  const result = await runCommerceAdminTransaction<TransactionResult<PreparedOperation>>(
    database,
    async (transaction) => {
      const authorization = await authorize(transaction, {
        action: input.auditedAction,
        orderId: input.orderPublicId,
        policy: input.policy,
        sessionToken: input.sessionToken,
      });
      if ("error" in authorization) return authorization;
      const order = await readOrder(transaction, input.orderPublicId);
      if (order === null) {
        await appendDeniedAudit(transaction, {
          action: input.auditedAction,
          actorRole: "owner",
          afterDigest: null,
          beforeDigest: null,
          reasonCode: "order_unavailable",
          session: authorization.session,
          targetId: input.orderPublicId,
          targetType: "commercial_order",
          ticketReference: input.ticketReference,
        });
        return Object.freeze({ error: "COMMERCE_ADMIN_NOT_FOUND" });
      }
      if (order.provider !== "stripe" || order.environment !== "sandbox") {
        await appendDeniedAudit(transaction, {
          action: input.auditedAction,
          actorRole: "owner",
          afterDigest: null,
          beforeDigest: null,
          reasonCode: "provider_environment_unavailable",
          session: authorization.session,
          targetId: order.publicId,
          targetType: "commercial_order",
          ticketReference: input.ticketReference,
        });
        return Object.freeze({ error: "COMMERCE_ADMIN_FORBIDDEN" });
      }
      const lockScope =
        input.action === "reconcile_order"
          ? `reconcile:${order.id}`
          : `refund:${authorization.session.userId}`;
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${lockScope}, 56073)
        )
      `;
      const existing = await transaction.$queryRaw<OperationRow[]>`
        SELECT
          operations.id, operations.action, operations.order_id AS "orderId",
          orders.public_id AS "orderPublicId", orders.user_id AS "userId",
          operations.amount_minor AS "amountMinor",
          operations.currency_code::text AS "currencyCode"
        FROM commerce_admin_operation_v1 AS operations
        JOIN commerce_admin_order_summary_v1 AS orders ON orders.id = operations.order_id
        WHERE operations.actor_user_id = ${authorization.session.userId}::uuid
          AND operations.action = ${input.action}
          AND operations.idempotency_key_hash = ${idempotencyKeyHash}
      `;
      if (existing.length > 1) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
      const replay = existing[0];
      if (replay !== undefined) {
        if (
          replay.orderPublicId !== input.orderPublicId ||
          replay.amountMinor !== input.amountMinor ||
          replay.currencyCode !== input.currencyCode
        ) {
          await appendDeniedAudit(transaction, {
            action: input.auditedAction,
            actorRole: "owner",
            afterDigest: null,
            beforeDigest: null,
            reasonCode: "idempotency_conflict",
            session: authorization.session,
            targetId: order.publicId,
            targetType: "commercial_order",
            ticketReference: input.ticketReference,
          });
          return Object.freeze({ error: "COMMERCE_ADMIN_CONFLICT" });
        }
        return Object.freeze({
          value: Object.freeze({ kind: "replayed", operation: replay }),
        });
      }
      if (
        input.action === "refund_order" &&
        (input.amountMinor !== order.amountMinor ||
          input.currencyCode !== order.currencyCode ||
          order.amountMinor > input.policy.maxRefundMinor)
      ) {
        await appendDeniedAudit(transaction, {
          action: input.auditedAction,
          actorRole: "owner",
          afterDigest: null,
          beforeDigest: null,
          reasonCode: "refund_scope_exceeded",
          session: authorization.session,
          targetId: order.publicId,
          targetType: "commercial_order",
          ticketReference: input.ticketReference,
        });
        return Object.freeze({ error: "COMMERCE_ADMIN_LIMIT_EXCEEDED" });
      }
      if (input.action === "reconcile_order") {
        const limits = await transaction.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS count
          FROM commerce_admin_operation_v1
          WHERE order_id = ${order.id}::uuid
            AND action = 'reconcile_order'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
        `;
        if (
          (limits[0]?.count ?? 0n) >= BigInt(input.policy.maxManualReconciliationsPerOrderPerHour)
        ) {
          await appendDeniedAudit(transaction, {
            action: input.auditedAction,
            actorRole: "owner",
            afterDigest: null,
            beforeDigest: null,
            reasonCode: "reconciliation_rate_limited",
            session: authorization.session,
            targetId: order.publicId,
            targetType: "commercial_order",
            ticketReference: input.ticketReference,
          });
          return Object.freeze({ error: "COMMERCE_ADMIN_LIMIT_EXCEEDED" });
        }
      } else {
        const limits = await transaction.$queryRaw<Array<{ amount: bigint }>>`
          SELECT COALESCE(SUM(amount_minor), 0) AS amount
          FROM commerce_admin_operation_v1
          WHERE actor_user_id = ${authorization.session.userId}::uuid
            AND action = 'refund_order'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        `;
        if (
          (limits[0]?.amount ?? 0n) + BigInt(input.amountMinor ?? 0) >
          BigInt(input.policy.maxRefundMinorPerActorPerDay)
        ) {
          await appendDeniedAudit(transaction, {
            action: input.auditedAction,
            actorRole: "owner",
            afterDigest: null,
            beforeDigest: null,
            reasonCode: "refund_daily_limit",
            session: authorization.session,
            targetId: order.publicId,
            targetType: "commercial_order",
            ticketReference: input.ticketReference,
          });
          return Object.freeze({ error: "COMMERCE_ADMIN_LIMIT_EXCEEDED" });
        }
      }
      const operationId = globalThis.crypto.randomUUID();
      const auditEventId = await appendCommerceAdminAuditEvent(transaction, {
        action: input.auditedAction,
        actorRole: "owner",
        afterDigest: canonicalRequestHash,
        beforeDigest: null,
        outcome: "accepted",
        reasonCode: input.reasonCode,
        session: authorization.session,
        targetId: operationId,
        targetType: "commerce_admin_operation",
        ticketReference: input.ticketReference,
      });
      const inserted = await transaction.$executeRaw`
        INSERT INTO commerce_admin_operation_v1 (
          id, action, order_id, actor_user_id, actor_session_id, audit_event_id,
          reason_code, ticket_reference, idempotency_key_hash, canonical_request_hash,
          limit_policy_version, amount_minor, currency_code, created_at
        ) VALUES (
          ${operationId}::uuid, ${input.action}, ${order.id}::uuid,
          ${authorization.session.userId}::uuid, ${authorization.session.sessionId}::uuid,
          ${auditEventId}::uuid, ${input.reasonCode}, ${input.ticketReference},
          ${idempotencyKeyHash}, ${canonicalRequestHash}, ${input.policy.limitPolicyVersion},
          ${input.amountMinor}, ${input.currencyCode}, CURRENT_TIMESTAMP
        )
      `;
      if (inserted !== 1) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
      await insertOperationEvent(transaction, {
        attemptId: null,
        eventType: "requested",
        operationId,
        resultReference: null,
      });
      return Object.freeze({
        value: Object.freeze({
          kind: "created",
          operation: Object.freeze({
            action: input.action,
            amountMinor: input.amountMinor,
            currencyCode: input.currencyCode,
            id: operationId,
            orderId: order.id,
            orderPublicId: order.publicId,
            userId: order.userId,
          }),
        }),
      });
    },
  );
  return throwIfError(result);
};

const claimExecution = async (
  database: PrismaClient,
  operationId: string,
  policy: CommerceAdminPolicy,
): Promise<
  | Readonly<{ attemptId: string; state: "claimed" }>
  | Readonly<{ resultReference: string | null; state: "failed" | "pending" | "succeeded" }>
> =>
  runCommerceAdminTransaction(database, async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${operationId}, 56073))
    `;
    const events = await transaction.$queryRaw<
      Array<{
        attemptId: string | null;
        createdAt: Date;
        eventType: string;
        resultReference: string | null;
      }>
    >`
      SELECT attempt_id AS "attemptId", event_type AS "eventType",
             result_reference AS "resultReference", created_at AS "createdAt"
      FROM commerce_admin_operation_event_v1
      WHERE operation_id = ${operationId}::uuid
      ORDER BY created_at, id
    `;
    const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
      SELECT CURRENT_TIMESTAMP AS now
    `;
    const now = clocks[0]?.now;
    if (now === undefined) throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
    const succeeded = events.find(({ eventType }) => eventType === "succeeded");
    if (succeeded !== undefined) {
      return Object.freeze({
        resultReference: succeeded.resultReference,
        state: "succeeded" as const,
      });
    }
    const starts = events.filter(({ eventType }) => eventType === "execution_started");
    const latest = starts.at(-1);
    const completedAttempts = new Set(
      events
        .filter(({ eventType }) => eventType === "failed" || eventType === "succeeded")
        .map(({ attemptId }) => attemptId),
    );
    if (
      latest !== undefined &&
      !completedAttempts.has(latest.attemptId) &&
      latest.createdAt.valueOf() > now.valueOf() - policy.executionLeaseSeconds * 1_000
    ) {
      return Object.freeze({ resultReference: null, state: "pending" as const });
    }
    if (starts.length >= policy.maxExecutionAttempts) {
      const failure = [...events].reverse().find(({ eventType }) => eventType === "failed");
      return Object.freeze({
        resultReference: failure?.resultReference ?? null,
        state: "failed" as const,
      });
    }
    const attemptId = globalThis.crypto.randomUUID();
    await insertOperationEvent(transaction, {
      attemptId,
      eventType: "execution_started",
      operationId,
      resultReference: null,
    });
    return Object.freeze({ attemptId, state: "claimed" as const });
  });

const completeExecution = async (
  database: PrismaClient,
  input: {
    attemptId: string;
    eventType: "failed" | "succeeded";
    operationId: string;
    resultReference: string;
  },
): Promise<void> => {
  if (!resultReferencePattern.test(input.resultReference)) {
    throw new CommerceAdminError("COMMERCE_ADMIN_ACTION_FAILED");
  }
  await runCommerceAdminTransaction(database, async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${input.operationId}, 56073))
    `;
    await insertOperationEvent(transaction, input);
  });
};

const mapUnexpectedError = (error: unknown): never => {
  if (error instanceof CommerceAdminError) throw error;
  if (error instanceof AdminSecurityError) {
    throw new CommerceAdminError(mapAdminError(error.code), { cause: error });
  }
  throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE", { cause: error });
};

export const assertCommerceAdminRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      canCreateInDatabase: boolean;
      canCreateInSchema: boolean;
      canInsertAdminHistory: boolean;
      canMutateCommerce: boolean;
      canMutateAdminHistory: boolean;
      canReadJournal: boolean;
      canReadAdminHistory: boolean;
      canReadRawCommerce: boolean;
      canReadSafeViews: boolean;
      privilegedRole: boolean;
      reachablePrivilegeEscalation: boolean;
      roleName: string;
      sessionRoleName: string;
    }>
  >`
    WITH relation_owners AS (
      SELECT relowner
      FROM pg_class
      WHERE oid IN (
        'public.commerce_admin_order_summary_v1'::regclass,
        'public.commerce_admin_timeline_v1'::regclass,
        'public.commerce_admin_audit_event_v1'::regclass,
        'public.commerce_admin_operation_v1'::regclass,
        'public.commerce_admin_operation_event_v1'::regclass
      )
    ), raw_commerce_relations AS (
      SELECT relation.oid
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND (
          relation.relname ~ '^(commercial_|credit_)'
          OR relation.relname IN (
            'commerce_order',
            'commerce_order_line',
            'payment_attempt',
            'payment_event',
            'ledger_entry',
            'entitlement'
          )
        )
    ), reachable_roles AS (
      SELECT role.*
      FROM pg_roles AS role
      WHERE role.rolname = current_user
         OR pg_has_role(current_user, role.oid, 'MEMBER')
    )
    SELECT current_user AS "roleName", session_user AS "sessionRoleName",
      rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls
        AS "privilegedRole",
      has_database_privilege(current_user, current_database(), 'CREATE')
        AS "canCreateInDatabase",
      has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateInSchema",
      has_table_privilege(current_user, 'commerce_admin_order_summary_v1', 'SELECT')
        AND has_table_privilege(current_user, 'commerce_admin_timeline_v1', 'SELECT')
        AS "canReadSafeViews",
      has_table_privilege(current_user, 'commerce_admin_audit_event_v1', 'INSERT')
        AND has_table_privilege(current_user, 'commerce_admin_operation_v1', 'INSERT')
        AND has_table_privilege(current_user, 'commerce_admin_operation_event_v1', 'INSERT')
        AS "canInsertAdminHistory",
      has_table_privilege(current_user, 'commerce_admin_audit_event_v1', 'SELECT')
        AND has_table_privilege(current_user, 'commerce_admin_operation_v1', 'SELECT')
        AND has_table_privilege(current_user, 'commerce_admin_operation_event_v1', 'SELECT')
        AS "canReadAdminHistory",
      has_table_privilege(current_user, 'commerce_admin_audit_event_v1',
        'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(current_user, 'commerce_admin_audit_event_v1',
          'UPDATE,REFERENCES')
        OR has_table_privilege(current_user, 'commerce_admin_operation_v1',
          'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(current_user, 'commerce_admin_operation_v1',
          'UPDATE,REFERENCES')
        OR has_table_privilege(current_user, 'commerce_admin_operation_event_v1',
          'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        OR has_any_column_privilege(current_user, 'commerce_admin_operation_event_v1',
          'UPDATE,REFERENCES')
        AS "canMutateAdminHistory",
      EXISTS (
        SELECT 1
        FROM raw_commerce_relations AS relation
        WHERE has_table_privilege(current_user, relation.oid, 'SELECT')
           OR has_any_column_privilege(current_user, relation.oid, 'SELECT')
      ) AS "canReadRawCommerce",
      EXISTS (
        SELECT 1
        FROM raw_commerce_relations AS relation
        WHERE has_table_privilege(
          current_user,
          relation.oid,
          'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'
        )
           OR has_any_column_privilege(
             current_user,
             relation.oid,
             'INSERT,UPDATE,REFERENCES'
           )
      ) AS "canMutateCommerce",
      has_table_privilege(current_user, 'private_journal_entry', 'SELECT')
        OR has_any_column_privilege(current_user, 'private_journal_entry', 'SELECT')
        AS "canReadJournal",
      EXISTS (
        SELECT 1
        FROM reachable_roles AS reachable
        WHERE reachable.rolsuper
           OR reachable.rolcreatedb
           OR reachable.rolcreaterole
           OR reachable.rolreplication
           OR reachable.rolbypassrls
           OR reachable.oid = (
             SELECT datdba FROM pg_database WHERE datname = current_database()
           )
           OR reachable.oid = (
             SELECT nspowner FROM pg_namespace WHERE nspname = 'public'
           )
           OR reachable.oid IN (SELECT relowner FROM relation_owners)
           OR has_database_privilege(reachable.oid, current_database(), 'CREATE')
           OR has_schema_privilege(reachable.oid, 'public', 'CREATE')
      ) AS "reachablePrivilegeEscalation"
    FROM pg_roles
    WHERE rolname = current_user
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    row.roleName !== "rituvia_admin_service" ||
    row.sessionRoleName !== row.roleName ||
    row.privilegedRole ||
    row.reachablePrivilegeEscalation ||
    row.canCreateInDatabase ||
    row.canCreateInSchema ||
    !row.canReadSafeViews ||
    !row.canReadAdminHistory ||
    !row.canInsertAdminHistory ||
    row.canMutateAdminHistory ||
    row.canReadRawCommerce ||
    row.canMutateCommerce ||
    row.canReadJournal
  ) {
    throw new CommerceAdminError("COMMERCE_ADMIN_UNAVAILABLE");
  }
};

export const createCommerceAdminService = (
  database: PrismaClient,
  rawPolicy: CommerceAdminPolicy,
  executors: CommerceAdminExecutors,
) => {
  const policy = validatePolicy(rawPolicy);

  const inspectOrder = async (input: {
    limit?: number | undefined;
    orderId: unknown;
    reasonCode: unknown;
    sessionToken: string;
    ticketReference: unknown;
  }): Promise<CommerceAdminOrderTimeline> => {
    try {
      await assertCommerceAdminRuntimeDatabasePrivileges(database);
      const orderPublicId = requireUuid(input.orderId);
      const reasonCode = requireReasonCode(input.reasonCode);
      const ticketReference = requireTicketReference(input.ticketReference);
      const requestedLimit = input.limit ?? policy.maxTimelineEvents;
      if (
        !Number.isSafeInteger(requestedLimit) ||
        requestedLimit < 1 ||
        requestedLimit > policy.maxTimelineEvents
      ) {
        throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
      }
      const result = await runCommerceAdminTransaction<
        TransactionResult<CommerceAdminOrderTimeline>
      >(database, async (transaction) => {
        const authorization = await authorize(transaction, {
          action: "admin.commerce.read",
          orderId: orderPublicId,
          policy,
          sessionToken: input.sessionToken,
        });
        if ("error" in authorization) return authorization;
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${"commerce-admin-inspect:" + authorization.session.userId}, 56073)
          )
        `;
        const recentInspections = await transaction.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS count
          FROM commerce_admin_audit_event_v1
          WHERE actor_user_id = ${authorization.session.userId}::uuid
            AND action = 'admin.commerce.read'
            AND outcome = 'completed'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
        `;
        if ((recentInspections[0]?.count ?? 0n) >= BigInt(policy.maxInspectionsPerActorPerMinute)) {
          await appendDeniedAudit(transaction, {
            action: "admin.commerce.read",
            actorRole: "owner",
            afterDigest: null,
            beforeDigest: null,
            reasonCode: "inspection_rate_limited",
            session: authorization.session,
            targetId: orderPublicId,
            targetType: "commercial_order",
            ticketReference,
          });
          return Object.freeze({ error: "COMMERCE_ADMIN_LIMIT_EXCEEDED" });
        }
        const order = await readOrder(transaction, orderPublicId);
        if (order === null) {
          await appendDeniedAudit(transaction, {
            action: "admin.commerce.read",
            actorRole: "owner",
            afterDigest: null,
            beforeDigest: null,
            reasonCode: "order_unavailable",
            session: authorization.session,
            targetId: orderPublicId,
            targetType: "commercial_order",
            ticketReference,
          });
          return Object.freeze({ error: "COMMERCE_ADMIN_NOT_FOUND" });
        }
        const timeline = await readTimeline(transaction, order, requestedLimit);
        await appendCommerceAdminAuditEvent(transaction, {
          action: "admin.commerce.read",
          actorRole: "owner",
          afterDigest: null,
          beforeDigest: null,
          outcome: "completed",
          reasonCode,
          session: authorization.session,
          targetId: order.publicId,
          targetType: "commercial_order",
          ticketReference,
        });
        return Object.freeze({
          value: Object.freeze({
            events: Object.freeze(
              timeline.events
                .map((event) =>
                  Object.freeze({
                    ...event,
                    occurredAt: event.occurredAt.toISOString(),
                  }),
                )
                .reverse(),
            ),
            order: Object.freeze({
              accountReference: accountReference(order.userId),
              amountMinor: order.amountMinor,
              currencyCode: order.currencyCode,
              environment: order.environment,
              orderId: order.publicId,
              productCode: order.productCode,
              provider: order.provider,
              status: order.status,
            }),
            truncated: timeline.truncated,
          }),
        });
      });
      return throwIfError(result);
    } catch (error) {
      return mapUnexpectedError(error);
    }
  };

  const execute = async (prepared: PreparedOperation): Promise<CommerceAdminActionResult> => {
    const claim = await claimExecution(database, prepared.operation.id, policy);
    if (claim.state !== "claimed") {
      return Object.freeze({
        kind: "replayed",
        operationId: prepared.operation.id,
        resultReference: claim.resultReference,
        state: claim.state,
      });
    }
    try {
      if (prepared.operation.action === "reconcile_order") {
        const outcome = await executors.reconcile({
          idempotencyKey: prepared.operation.id,
          operationId: prepared.operation.id,
          orderId: prepared.operation.orderPublicId,
        });
        if (
          !Number.isSafeInteger(outcome.cases) ||
          outcome.cases < 0 ||
          !uuidV4Pattern.test(outcome.runId)
        ) {
          throw new Error("Commerce reconciliation executor returned invalid evidence.");
        }
        await completeExecution(database, {
          attemptId: claim.attemptId,
          eventType: "succeeded",
          operationId: prepared.operation.id,
          resultReference: outcome.runId,
        });
        return Object.freeze({
          kind: prepared.kind,
          operationId: prepared.operation.id,
          resultReference: outcome.runId,
          state: "succeeded",
        });
      }
      const amountMinor = prepared.operation.amountMinor;
      const currencyCode = prepared.operation.currencyCode;
      if (amountMinor === null || currencyCode === null) {
        throw new Error("Commerce refund operation is incomplete.");
      }
      const outcome = await executors.refund({
        amountMinor,
        currencyCode,
        idempotencyKey: prepared.operation.id,
        operationId: prepared.operation.id,
        orderId: prepared.operation.orderPublicId,
        userId: prepared.operation.userId,
      });
      if (
        outcome.amountMinor !== amountMinor ||
        outcome.currencyCode !== currencyCode ||
        !uuidV4Pattern.test(outcome.refundId)
      ) {
        throw new Error("Commerce refund executor returned invalid evidence.");
      }
      await completeExecution(database, {
        attemptId: claim.attemptId,
        eventType: "succeeded",
        operationId: prepared.operation.id,
        resultReference: outcome.refundId,
      });
      return Object.freeze({
        kind: prepared.kind,
        operationId: prepared.operation.id,
        resultReference: outcome.refundId,
        state: "succeeded",
      });
    } catch (error) {
      await completeExecution(database, {
        attemptId: claim.attemptId,
        eventType: "failed",
        operationId: prepared.operation.id,
        resultReference: "executor_failed",
      }).catch(() => undefined);
      throw new CommerceAdminError("COMMERCE_ADMIN_ACTION_FAILED", { cause: error });
    }
  };

  const reconcileOrder = async (input: {
    confirmation: unknown;
    idempotencyKey: unknown;
    orderId: unknown;
    reasonCode: unknown;
    sessionToken: string;
    ticketReference: unknown;
  }): Promise<CommerceAdminActionResult> => {
    try {
      await assertCommerceAdminRuntimeDatabasePrivileges(database);
      const orderId = requireUuid(input.orderId);
      if (input.confirmation !== `RECONCILE ${orderId}`) {
        throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
      }
      const prepared = await prepareOperation(database, {
        action: "reconcile_order",
        amountMinor: null,
        auditedAction: "admin.commerce.reconcile",
        currencyCode: null,
        idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
        orderPublicId: orderId,
        policy,
        reasonCode: requireReasonCode(input.reasonCode),
        sessionToken: input.sessionToken,
        ticketReference: requireTicketReference(input.ticketReference),
      });
      return await execute(prepared);
    } catch (error) {
      return mapUnexpectedError(error);
    }
  };

  const refundOrder = async (input: {
    amountMinor: unknown;
    confirmation: unknown;
    currencyCode: unknown;
    idempotencyKey: unknown;
    orderId: unknown;
    reasonCode: unknown;
    sessionToken: string;
    ticketReference: unknown;
  }): Promise<CommerceAdminActionResult> => {
    try {
      await assertCommerceAdminRuntimeDatabasePrivileges(database);
      const orderId = requireUuid(input.orderId);
      if (
        !Number.isSafeInteger(input.amountMinor) ||
        (input.amountMinor as number) < 1 ||
        typeof input.currencyCode !== "string" ||
        !/^[A-Z]{3}$/u.test(input.currencyCode) ||
        input.confirmation !==
          `REFUND ${orderId} ${String(input.amountMinor)} ${input.currencyCode}`
      ) {
        throw new CommerceAdminError("COMMERCE_ADMIN_REQUEST_INVALID");
      }
      const prepared = await prepareOperation(database, {
        action: "refund_order",
        amountMinor: input.amountMinor as number,
        auditedAction: "admin.refund.execute",
        currencyCode: input.currencyCode,
        idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
        orderPublicId: orderId,
        policy,
        reasonCode: requireReasonCode(input.reasonCode),
        sessionToken: input.sessionToken,
        ticketReference: requireTicketReference(input.ticketReference),
      });
      return await execute(prepared);
    } catch (error) {
      return mapUnexpectedError(error);
    }
  };

  return Object.freeze({ inspectOrder, reconcileOrder, refundOrder });
};

export type CommerceAdminService = ReturnType<typeof createCommerceAdminService>;
