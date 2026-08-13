import { adminSafeDiffFieldsFor, type AdminAction, type AdminRole } from "@rituvia/security";

import {
  adminSecurityDigestsEqual,
  AdminSecurityError,
  authorizeAdminOperation,
  hashAdminSecurityValue,
  type AdminSecurityErrorCode,
  type AdminSecurityPolicy,
  type AdminTransactionClient,
  type AuthorizedAdminSession,
} from "./admin-security.js";
import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

export const operationalCaseQueues = Object.freeze([
  "support",
  "privacy",
  "safety",
  "content_report",
] as const);
export const operationalCaseActions = Object.freeze(["triage", "escalate", "resolve"] as const);

export type OperationalCaseQueue = (typeof operationalCaseQueues)[number];
export type OperationalCaseAction = (typeof operationalCaseActions)[number];
export type OperationalCasePriority = "high" | "normal" | "urgent";
export type OperationalCaseState = "escalated" | "open" | "resolved" | "triaged";
export type OperationalCaseSlaState = "breached" | "met" | "pending";
type OperationalCaseAdminAction = Extract<
  AdminAction,
  | "admin.content_report.review"
  | "admin.privacy.review"
  | "admin.safety.review"
  | "admin.support.review"
>;
export type OperationalCaseDraftTemplate =
  | "content_report_ack"
  | "privacy_request_ack"
  | "safety_report_ack"
  | "support_dispute_ack"
  | "support_request_ack"
  | "support_refund_ack";

export const operationalCaseErrorCodes = Object.freeze([
  "OPERATIONAL_CASE_UNAVAILABLE",
  "OPERATIONAL_CASE_SESSION_UNAVAILABLE",
  "OPERATIONAL_CASE_RECENT_AUTH_REQUIRED",
  "OPERATIONAL_CASE_MFA_REQUIRED",
  "OPERATIONAL_CASE_FORBIDDEN",
  "OPERATIONAL_CASE_REQUEST_INVALID",
  "OPERATIONAL_CASE_NOT_FOUND",
  "OPERATIONAL_CASE_CONFLICT",
] as const);

export type OperationalCaseErrorCode = (typeof operationalCaseErrorCodes)[number];

export class OperationalCaseError extends Error {
  readonly code: OperationalCaseErrorCode;

  constructor(code: OperationalCaseErrorCode) {
    super(code);
    this.name = "OperationalCaseError";
    this.code = code;
  }
}

export type OperationalCasePolicy = AdminSecurityPolicy &
  Readonly<{
    maximumListSize: number;
  }>;

export type OperationalCaseDraft = Readonly<{
  body: string;
  locale: "en";
  status: "draft_only_not_sent";
  templateCode: OperationalCaseDraftTemplate;
  templateVersion: "operational-case-draft.en.v1";
  title: string;
}>;

export type OperationalCaseItem = Readonly<{
  assignedRole: AdminRole | null;
  categoryCode: string;
  draft: OperationalCaseDraft;
  escalationRequired: boolean;
  firstResponseDueAt: string;
  firstResponseSla: OperationalCaseSlaState;
  id: string;
  openedAt: string;
  policyVersion: "protected-beta-operations.local.en.v1";
  priority: OperationalCasePriority;
  queue: OperationalCaseQueue;
  resolutionDueAt: string;
  resolutionSla: OperationalCaseSlaState;
  state: OperationalCaseState;
}>;

type CaseRow = Readonly<{
  actorRole: string | null;
  categoryCode: string;
  draftLocale: string;
  draftTemplateCode: string;
  draftTemplateVersion: string;
  firstResponseAt: Date | null;
  firstResponseDueAt: Date;
  id: string;
  openedAt: Date;
  policyVersion: string;
  priority: string;
  queueKind: string;
  resolutionAt: Date | null;
  resolutionDueAt: Date;
  state: string;
}>;

type EventRow = Readonly<{
  action: string;
  canonicalRequestHash: Uint8Array;
  fromPriority: string;
  fromState: string;
  id: string;
  toPriority: string;
  toState: string;
}>;

type AuditInput = Readonly<{
  action: AdminAction;
  actorRole: AdminRole | null;
  afterDigest: Uint8Array | null;
  beforeDigest: Uint8Array | null;
  changeFields: readonly string[];
  outcome: "completed" | "denied";
  reasonCode: string;
  session: AuthorizedAdminSession;
  targetId: string;
  targetType: "operational_case" | "operational_queue";
  ticketReference: string;
}>;
type OperationResult<Value> =
  Readonly<{ error: OperationalCaseErrorCode }> | Readonly<{ value: Value }>;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const reasonCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const ticketReferencePattern = /^[A-Z][A-Z0-9_-]{2,63}$/u;
const idempotencyKeyPattern = /^[A-Za-z0-9_-]{16,128}$/u;

const digest = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(hashAdminSecurityValue(value));
const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  adminSecurityDigestsEqual(left, right);

const invalid = (): never => {
  throw new OperationalCaseError("OPERATIONAL_CASE_REQUEST_INVALID");
};

const parseQueue = (value: unknown): OperationalCaseQueue =>
  typeof value === "string" && operationalCaseQueues.includes(value as OperationalCaseQueue)
    ? (value as OperationalCaseQueue)
    : invalid();
const parseAction = (value: unknown): OperationalCaseAction =>
  typeof value === "string" && operationalCaseActions.includes(value as OperationalCaseAction)
    ? (value as OperationalCaseAction)
    : invalid();
const parseUuid = (value: unknown): string =>
  typeof value === "string" && uuidV4Pattern.test(value) ? value : invalid();
const parseReasonCode = (value: unknown): string =>
  typeof value === "string" && value.length <= 64 && reasonCodePattern.test(value)
    ? value
    : invalid();
const parseTicketReference = (value: unknown): string =>
  typeof value === "string" && ticketReferencePattern.test(value) ? value : invalid();
const parseIdempotencyKey = (value: unknown): string =>
  typeof value === "string" && idempotencyKeyPattern.test(value) ? value : invalid();

const validatePolicy = (policy: OperationalCasePolicy): OperationalCasePolicy => {
  if (
    !Number.isSafeInteger(policy.recentAuthenticationSeconds) ||
    policy.recentAuthenticationSeconds < 60 ||
    policy.recentAuthenticationSeconds > 3_600 ||
    !Number.isSafeInteger(policy.maximumListSize) ||
    policy.maximumListSize < 1 ||
    policy.maximumListSize > 100
  ) {
    throw new TypeError("Operational case policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const actionForQueue = (queue: OperationalCaseQueue): OperationalCaseAdminAction => {
  switch (queue) {
    case "support":
      return "admin.support.review";
    case "privacy":
      return "admin.privacy.review";
    case "safety":
      return "admin.safety.review";
    case "content_report":
      return "admin.content_report.review";
  }
};

const mapAdminError = (code: AdminSecurityErrorCode): OperationalCaseErrorCode => {
  switch (code) {
    case "ADMIN_SESSION_UNAVAILABLE":
      return "OPERATIONAL_CASE_SESSION_UNAVAILABLE";
    case "ADMIN_RECENT_AUTH_REQUIRED":
      return "OPERATIONAL_CASE_RECENT_AUTH_REQUIRED";
    case "ADMIN_MFA_REQUIRED":
      return "OPERATIONAL_CASE_MFA_REQUIRED";
    case "ADMIN_FORBIDDEN":
      return "OPERATIONAL_CASE_FORBIDDEN";
    case "ADMIN_REQUEST_INVALID":
      return "OPERATIONAL_CASE_REQUEST_INVALID";
    case "ADMIN_SECURITY_UNAVAILABLE":
    case "ADMIN_ROLE_CONFLICT":
    case "ADMIN_LAST_OWNER":
      return "OPERATIONAL_CASE_UNAVAILABLE";
  }
};

const auditPayload = (input: {
  audit: AuditInput;
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
    changeFields: input.audit.changeFields,
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

const appendAudit = async (
  transaction: AdminTransactionClient,
  audit: AuditInput,
): Promise<string> => {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended('operational_case_audit_event_v1', 56125))
  `;
  const [clocks, previous] = await Promise.all([
    transaction.$queryRaw<Array<{ now: Date }>>`SELECT CURRENT_TIMESTAMP AS now`,
    transaction.$queryRaw<Array<{ eventHash: Uint8Array }>>`
      SELECT event_hash AS "eventHash"
      FROM operational_case_audit_event_v1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
  ]);
  const createdAt = clocks[0]?.now;
  if (createdAt === undefined || previous.length > 1) {
    throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  }
  const eventId = globalThis.crypto.randomUUID();
  const requestId = globalThis.crypto.randomUUID();
  const previousEventHash = previous[0]?.eventHash ?? null;
  const eventHash = digest(
    auditPayload({ audit, createdAt, eventId, previousEventHash, requestId }),
  );
  const inserted = await transaction.$executeRaw`
    INSERT INTO operational_case_audit_event_v1 (
      id, actor_user_id, actor_session_id, actor_role, request_id, action, outcome,
      target_type, target_id, reason_code, ticket_reference, change_fields,
      before_digest, after_digest, previous_event_hash, event_hash, created_at
    ) VALUES (
      ${eventId}::uuid, ${audit.session.userId}::uuid, ${audit.session.sessionId}::uuid,
      ${audit.actorRole}, ${requestId}::uuid, ${audit.action}, ${audit.outcome},
      ${audit.targetType}, ${audit.targetId}, ${audit.reasonCode}, ${audit.ticketReference},
      ${[...audit.changeFields]}::text[], ${audit.beforeDigest}, ${audit.afterDigest},
      ${previousEventHash}, ${eventHash}, ${createdAt}
    )
  `;
  if (inserted !== 1) throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  return eventId;
};

export const verifyOperationalCaseAuditEventHash = (event: {
  action: AdminAction;
  actorRole: AdminRole | null;
  actorSessionId: string;
  actorUserId: string;
  afterDigest: Uint8Array | null;
  beforeDigest: Uint8Array | null;
  changeFields: readonly string[];
  createdAt: Date;
  eventHash: Uint8Array;
  eventId: string;
  outcome: "completed" | "denied";
  previousEventHash: Uint8Array | null;
  reasonCode: string;
  requestId: string;
  targetId: string;
  targetType: "operational_case" | "operational_queue";
  ticketReference: string;
}): boolean => {
  const expected = digest(
    auditPayload({
      audit: {
        action: event.action,
        actorRole: event.actorRole,
        afterDigest: event.afterDigest,
        beforeDigest: event.beforeDigest,
        changeFields: event.changeFields,
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

export const renderOperationalCaseDraft = (
  templateCode: OperationalCaseDraftTemplate,
): OperationalCaseDraft => {
  const common = Object.freeze({
    locale: "en" as const,
    status: "draft_only_not_sent" as const,
    templateCode,
    templateVersion: "operational-case-draft.en.v1" as const,
  });
  switch (templateCode) {
    case "support_dispute_ack":
      return Object.freeze({
        ...common,
        title: "Payment dispute review opened",
        body: "We are reviewing the payment dispute using commerce records only. No response, refund, account action, or payment-provider action has been completed, and this draft has not been sent.",
      });
    case "support_refund_ack":
      return Object.freeze({
        ...common,
        title: "Support request received",
        body: "We are reviewing this support request. No refund or account action has been completed. This draft has not been sent.",
      });
    case "support_request_ack":
      return Object.freeze({
        ...common,
        title: "Support request received",
        body: "We are reviewing the selected support category. The draft contains no question, reading, or journal text and has not been sent.",
      });
    case "privacy_request_ack":
      return Object.freeze({
        ...common,
        title: "Privacy request received",
        body: "We are reviewing the privacy request and its current system status. This draft contains no private content and has not been sent.",
      });
    case "safety_report_ack":
      return Object.freeze({
        ...common,
        title: "Safety report received",
        body: "We are prioritizing a review of the selected safety category. This is not emergency support, and this draft has not been sent.",
      });
    case "content_report_ack":
      return Object.freeze({
        ...common,
        title: "Content report received",
        body: "We are reviewing the selected content issue category. The draft contains no reading, question, or journal text and has not been sent.",
      });
  }
};

const parsePriority = (value: string): OperationalCasePriority =>
  value === "normal" || value === "high" || value === "urgent" ? value : invalid();
const parseState = (value: string): OperationalCaseState =>
  value === "open" || value === "triaged" || value === "escalated" || value === "resolved"
    ? value
    : invalid();
const parseRole = (value: string | null): AdminRole | null => {
  if (value === null) return null;
  if (
    value === "owner" ||
    value === "content_editor" ||
    value === "support_refund_reviewer" ||
    value === "risk_safety_reviewer" ||
    value === "analyst_read_only"
  ) {
    return value;
  }
  return invalid();
};
const parseDraftTemplate = (value: string): OperationalCaseDraftTemplate => {
  switch (value) {
    case "content_report_ack":
    case "privacy_request_ack":
    case "safety_report_ack":
    case "support_dispute_ack":
    case "support_request_ack":
    case "support_refund_ack":
      return value;
    default:
      return invalid();
  }
};

const slaState = (dueAt: Date, completedAt: Date | null, now: Date): OperationalCaseSlaState =>
  completedAt === null
    ? now.valueOf() <= dueAt.valueOf()
      ? "pending"
      : "breached"
    : completedAt.valueOf() <= dueAt.valueOf()
      ? "met"
      : "breached";

const projectCase = (row: CaseRow, now: Date): OperationalCaseItem => {
  const state = parseState(row.state);
  const firstResponseSla = slaState(row.firstResponseDueAt, row.firstResponseAt, now);
  const resolutionSla = slaState(row.resolutionDueAt, row.resolutionAt, now);
  if (
    row.policyVersion !== "protected-beta-operations.local.en.v1" ||
    row.draftTemplateVersion !== "operational-case-draft.en.v1" ||
    row.draftLocale !== "en"
  ) {
    throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  }
  return Object.freeze({
    assignedRole: parseRole(row.actorRole),
    categoryCode: row.categoryCode,
    draft: renderOperationalCaseDraft(parseDraftTemplate(row.draftTemplateCode)),
    escalationRequired:
      state !== "resolved" && (firstResponseSla === "breached" || resolutionSla === "breached"),
    firstResponseDueAt: row.firstResponseDueAt.toISOString(),
    firstResponseSla,
    id: row.id,
    openedAt: row.openedAt.toISOString(),
    policyVersion: "protected-beta-operations.local.en.v1",
    priority: parsePriority(row.priority),
    queue: parseQueue(row.queueKind),
    resolutionDueAt: row.resolutionDueAt.toISOString(),
    resolutionSla,
    state,
  });
};

const caseProjection = Prisma.sql`
  SELECT
    cases.id,
    cases.queue_kind AS "queueKind",
    cases.category_code AS "categoryCode",
    COALESCE(latest.to_priority, cases.priority) AS priority,
    cases.policy_version AS "policyVersion",
    cases.draft_template_code AS "draftTemplateCode",
    cases.draft_template_version AS "draftTemplateVersion",
    cases.draft_locale AS "draftLocale",
    cases.opened_at AS "openedAt",
    cases.first_response_due_at AS "firstResponseDueAt",
    cases.resolution_due_at AS "resolutionDueAt",
    COALESCE(latest.to_state, 'open') AS state,
    latest.actor_role AS "actorRole",
    response.created_at AS "firstResponseAt",
    resolution.created_at AS "resolutionAt"
  FROM operational_case_v1 AS cases
  LEFT JOIN LATERAL (
    SELECT event.to_state, event.to_priority, event.actor_role
    FROM operational_case_event_v1 AS event
    WHERE event.case_id = cases.id
    ORDER BY event.created_at DESC, event.id DESC
    LIMIT 1
  ) AS latest ON TRUE
  LEFT JOIN LATERAL (
    SELECT event.created_at
    FROM operational_case_event_v1 AS event
    WHERE event.case_id = cases.id AND event.to_state IN ('triaged', 'escalated', 'resolved')
    ORDER BY event.created_at, event.id
    LIMIT 1
  ) AS response ON TRUE
  LEFT JOIN LATERAL (
    SELECT event.created_at
    FROM operational_case_event_v1 AS event
    WHERE event.case_id = cases.id AND event.to_state = 'resolved'
    ORDER BY event.created_at, event.id
    LIMIT 1
  ) AS resolution ON TRUE
`;

const readCase = async (
  transaction: AdminTransactionClient,
  caseId: string,
  queue: OperationalCaseQueue,
  lock: boolean,
): Promise<CaseRow | null> => {
  if (lock) {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${caseId}, 56126))
    `;
  }
  const rows = await transaction.$queryRaw<CaseRow[]>`
    ${caseProjection}
    WHERE cases.id = ${caseId}::uuid AND cases.queue_kind = ${queue}
  `;
  if (rows.length > 1) throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  return rows[0] ?? null;
};

const runTransaction = async <Value>(
  database: PrismaClient,
  callback: (transaction: AdminTransactionClient) => Promise<Value>,
): Promise<Value> => {
  try {
    return await database.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof OperationalCaseError) throw error;
    if (error instanceof AdminSecurityError) {
      throw new OperationalCaseError(mapAdminError(error.code));
    }
    throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  }
};

export type OperationalCaseSource =
  | Readonly<{ sourceId: string; sourceKind: "commercial_refund_request" }>
  | Readonly<{ sourceId: string; sourceKind: "privacy_deletion_request" }>
  | Readonly<{ sourceId: string; sourceKind: "privacy_export" }>
  | Readonly<{ sourceId: string; sourceKind: "reading_report" }>
  | Readonly<{ sourceId: string; sourceKind: "support_ticket" }>;

export const enqueueOperationalCase = async (
  transaction: AdminTransactionClient,
  source: OperationalCaseSource,
): Promise<void> => {
  const sourceId = parseUuid(source.sourceId);
  const inserted = await (async (): Promise<number> => {
    switch (source.sourceKind) {
      case "support_ticket":
        return transaction.$executeRaw`
          INSERT INTO operational_case_v1 (
            queue_kind, source_kind, source_id, support_ticket_id, category_code, priority,
            policy_version, draft_template_code, draft_template_version, draft_locale,
            opened_at, first_response_due_at, resolution_due_at, expires_at
          )
          SELECT 'support', 'support_ticket', ticket.id, ticket.id,
            'support.' || ticket.category, 'normal', 'protected-beta-operations.local.en.v1',
            'support_request_ack', 'operational-case-draft.en.v1', 'en',
            date_trunc('milliseconds', ticket.created_at),
            date_trunc('milliseconds', ticket.created_at) + INTERVAL '24 hours',
            date_trunc('milliseconds', ticket.created_at) + INTERVAL '72 hours',
            date_trunc('milliseconds', ticket.expires_at)
          FROM support_ticket_v1 AS ticket
          WHERE ticket.id = ${sourceId}::uuid
        `;
      case "commercial_refund_request":
        return transaction.$executeRaw`
          INSERT INTO operational_case_v1 (
            queue_kind, source_kind, source_id, commercial_refund_request_id,
            category_code, priority, policy_version, draft_template_code,
            draft_template_version, draft_locale, opened_at,
            first_response_due_at, resolution_due_at
          )
          SELECT 'support', 'commercial_refund_request', refund.id, refund.id,
            'refund_request', 'high', 'protected-beta-operations.local.en.v1',
            'support_refund_ack', 'operational-case-draft.en.v1', 'en',
            date_trunc('milliseconds', refund.created_at),
            date_trunc('milliseconds', refund.created_at) + INTERVAL '4 hours',
            date_trunc('milliseconds', refund.created_at) + INTERVAL '24 hours'
          FROM commercial_refund_request_v1 AS refund
          WHERE refund.id = ${sourceId}::uuid
        `;
      case "privacy_export":
        return transaction.$executeRaw`
          INSERT INTO operational_case_v1 (
            queue_kind, source_kind, source_id, privacy_export_id, category_code, priority,
            policy_version, draft_template_code, draft_template_version, draft_locale,
            opened_at, first_response_due_at, resolution_due_at, expires_at
          )
          SELECT 'privacy', 'privacy_export', export.id, export.id,
            'privacy_export', 'normal', 'protected-beta-operations.local.en.v1',
            'privacy_request_ack', 'operational-case-draft.en.v1', 'en',
            date_trunc('milliseconds', export.created_at),
            date_trunc('milliseconds', export.created_at) + INTERVAL '24 hours',
            date_trunc('milliseconds', export.created_at) + INTERVAL '72 hours',
            date_trunc('milliseconds', export.expires_at)
          FROM privacy_export AS export
          WHERE export.id = ${sourceId}::uuid
        `;
      case "privacy_deletion_request":
        return transaction.$executeRaw`
          INSERT INTO operational_case_v1 (
            queue_kind, source_kind, source_id, privacy_deletion_request_id,
            category_code, priority, policy_version, draft_template_code,
            draft_template_version, draft_locale, opened_at,
            first_response_due_at, resolution_due_at
          )
          SELECT 'privacy', 'privacy_deletion_request', deletion.id, deletion.id,
            'privacy_deletion', 'high', 'protected-beta-operations.local.en.v1',
            'privacy_request_ack', 'operational-case-draft.en.v1', 'en',
            date_trunc('milliseconds', deletion.requested_at),
            date_trunc('milliseconds', deletion.requested_at) + INTERVAL '4 hours',
            date_trunc('milliseconds', deletion.requested_at) + INTERVAL '24 hours'
          FROM privacy_deletion_request AS deletion
          WHERE deletion.id = ${sourceId}::uuid
        `;
      case "reading_report":
        return transaction.$executeRaw`
          INSERT INTO operational_case_v1 (
            queue_kind, source_kind, source_id, reading_report_id, category_code, priority,
            policy_version, draft_template_code, draft_template_version, draft_locale,
            opened_at, first_response_due_at, resolution_due_at, expires_at
          )
          SELECT
            CASE WHEN report.category = 'safety' THEN 'safety' ELSE 'content_report' END,
            'reading_report', report.id, report.id, report.category,
            CASE WHEN report.category = 'safety' THEN 'urgent'
                 WHEN report.category = 'rights' THEN 'high' ELSE 'normal' END,
            'protected-beta-operations.local.en.v1',
            CASE WHEN report.category = 'safety'
                 THEN 'safety_report_ack' ELSE 'content_report_ack' END,
            'operational-case-draft.en.v1', 'en',
            date_trunc('milliseconds', report.created_at),
            date_trunc('milliseconds', report.created_at) +
              CASE WHEN report.category = 'safety' THEN INTERVAL '15 minutes'
                   WHEN report.category = 'rights' THEN INTERVAL '4 hours'
                   ELSE INTERVAL '24 hours' END,
            date_trunc('milliseconds', report.created_at) +
              CASE WHEN report.category = 'safety' THEN INTERVAL '4 hours'
                   WHEN report.category = 'rights' THEN INTERVAL '24 hours'
                   ELSE INTERVAL '72 hours' END,
            date_trunc('milliseconds', report.expires_at)
          FROM reading_report AS report
          WHERE report.id = ${sourceId}::uuid
        `;
    }
  })();
  if (inserted !== 1) {
    throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  }
};

const unwrap = <Value>(result: OperationResult<Value>): Value => {
  if ("error" in result) throw new OperationalCaseError(result.error);
  return result.value;
};

export const assertOperationalCaseRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      auditInsert: boolean;
      auditMutate: boolean;
      auditSelect: boolean;
      caseInsert: boolean;
      caseMutate: boolean;
      caseSelect: boolean;
      canCreateDatabase: boolean;
      canCreateRole: boolean;
      canCreateSchema: boolean;
      eventInsert: boolean;
      eventMutate: boolean;
      eventSelect: boolean;
      privateJournalSelect: boolean;
      privacyDeletionSelect: boolean;
      privacyExportSelect: boolean;
      readingReportSelect: boolean;
      refundSelect: boolean;
      roleName: string;
      superuser: boolean;
    }>
  >`
    SELECT
      current_user AS "roleName",
      has_table_privilege(current_user, 'operational_case_v1', 'SELECT') AS "caseSelect",
      has_table_privilege(current_user, 'operational_case_v1', 'INSERT') AS "caseInsert",
      has_table_privilege(current_user, 'operational_case_v1', 'UPDATE,DELETE,TRUNCATE')
        AS "caseMutate",
      has_table_privilege(current_user, 'operational_case_event_v1', 'SELECT') AS "eventSelect",
      has_table_privilege(current_user, 'operational_case_event_v1', 'INSERT') AS "eventInsert",
      has_table_privilege(current_user, 'operational_case_event_v1', 'UPDATE,DELETE,TRUNCATE')
        AS "eventMutate",
      has_table_privilege(current_user, 'operational_case_audit_event_v1', 'SELECT')
        AS "auditSelect",
      has_table_privilege(current_user, 'operational_case_audit_event_v1', 'INSERT')
        AS "auditInsert",
      has_table_privilege(
        current_user, 'operational_case_audit_event_v1', 'UPDATE,DELETE,TRUNCATE'
      ) AS "auditMutate",
      has_table_privilege(current_user, 'reading_report', 'SELECT') AS "readingReportSelect",
      has_table_privilege(current_user, 'privacy_export', 'SELECT') AS "privacyExportSelect",
      has_table_privilege(current_user, 'privacy_deletion_request', 'SELECT')
        AS "privacyDeletionSelect",
      has_table_privilege(current_user, 'commercial_refund_request_v1', 'SELECT')
        AS "refundSelect",
      has_table_privilege(current_user, 'private_journal_entry', 'SELECT')
        AS "privateJournalSelect",
      has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateSchema",
      (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
      (SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user) AS "canCreateDatabase",
      (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS "canCreateRole"
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    row.roleName !== "rituvia_admin_service" ||
    !row.caseSelect ||
    row.caseInsert ||
    row.caseMutate ||
    !row.eventSelect ||
    !row.eventInsert ||
    row.eventMutate ||
    !row.auditSelect ||
    !row.auditInsert ||
    row.auditMutate ||
    row.readingReportSelect ||
    row.privacyExportSelect ||
    row.privacyDeletionSelect ||
    row.refundSelect ||
    row.privateJournalSelect ||
    row.canCreateDatabase ||
    row.canCreateRole ||
    row.canCreateSchema ||
    row.superuser
  ) {
    throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
  }
};

export const createOperationalCaseService = (
  database: PrismaClient,
  rawPolicy: OperationalCasePolicy,
) => {
  const policy = validatePolicy(rawPolicy);

  const list = async (input: {
    queue: OperationalCaseQueue;
    reasonCode: string;
    sessionToken: string;
    ticketReference: string;
  }): Promise<readonly OperationalCaseItem[]> => {
    const queue = parseQueue(input.queue);
    const reasonCode = parseReasonCode(input.reasonCode);
    const ticketReference = parseTicketReference(input.ticketReference);
    const action = actionForQueue(queue);
    const result = await runTransaction<OperationResult<readonly OperationalCaseItem[]>>(
      database,
      async (transaction) => {
        const authorization = await authorizeAdminOperation(transaction, {
          action,
          policy,
          sessionToken: input.sessionToken,
        });
        if (!authorization.authorized) {
          if (authorization.session !== null) {
            await appendAudit(transaction, {
              action,
              actorRole: authorization.role,
              afterDigest: null,
              beforeDigest: null,
              changeFields: [],
              outcome: "denied",
              reasonCode: "authorization_denied",
              session: authorization.session,
              targetId: queue,
              targetType: "operational_queue",
              ticketReference,
            });
          }
          return Object.freeze({ error: mapAdminError(authorization.error) });
        }
        const rows = await transaction.$queryRaw<CaseRow[]>`
          ${caseProjection}
          WHERE cases.queue_kind = ${queue}
            AND COALESCE(latest.to_state, 'open') <> 'resolved'
          ORDER BY
            CASE COALESCE(latest.to_priority, cases.priority)
              WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3
            END,
            cases.first_response_due_at,
            cases.opened_at,
            cases.id
          LIMIT ${policy.maximumListSize}
        `;
        const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
        const now = clocks[0]?.now;
        if (now === undefined) throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
        await appendAudit(transaction, {
          action,
          actorRole: authorization.role,
          afterDigest: null,
          beforeDigest: null,
          changeFields: [],
          outcome: "completed",
          reasonCode,
          session: authorization.session,
          targetId: queue,
          targetType: "operational_queue",
          ticketReference,
        });
        return Object.freeze({ value: Object.freeze(rows.map((row) => projectCase(row, now))) });
      },
    );
    return unwrap(result);
  };

  const transition = async (input: {
    action: OperationalCaseAction;
    caseId: string;
    idempotencyKey: string;
    queue: OperationalCaseQueue;
    reasonCode: string;
    sessionToken: string;
    ticketReference: string;
  }): Promise<OperationalCaseItem> => {
    const caseAction = parseAction(input.action);
    const caseId = parseUuid(input.caseId);
    const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
    const queue = parseQueue(input.queue);
    const reasonCode = parseReasonCode(input.reasonCode);
    const ticketReference = parseTicketReference(input.ticketReference);
    const auditedAction = actionForQueue(queue);
    const canonicalRequestHash = digest(
      JSON.stringify({ action: caseAction, caseId, queue, reasonCode, ticketReference }),
    );
    const idempotencyKeyHash = digest(idempotencyKey);
    const result = await runTransaction<OperationResult<OperationalCaseItem>>(
      database,
      async (transaction) => {
        const authorization = await authorizeAdminOperation(transaction, {
          action: auditedAction,
          policy,
          sessionToken: input.sessionToken,
        });
        if (!authorization.authorized) {
          if (authorization.session !== null) {
            await appendAudit(transaction, {
              action: auditedAction,
              actorRole: authorization.role,
              afterDigest: null,
              beforeDigest: null,
              changeFields: [],
              outcome: "denied",
              reasonCode: "authorization_denied",
              session: authorization.session,
              targetId: caseId,
              targetType: "operational_case",
              ticketReference,
            });
          }
          return Object.freeze({ error: mapAdminError(authorization.error) });
        }
        const replayRows = await transaction.$queryRaw<EventRow[]>`
          SELECT
            id, action, from_state AS "fromState", to_state AS "toState",
            from_priority AS "fromPriority", to_priority AS "toPriority",
            canonical_request_hash AS "canonicalRequestHash"
          FROM operational_case_event_v1
          WHERE actor_user_id = ${authorization.session.userId}::uuid
            AND action = ${caseAction}
            AND idempotency_key_hash = ${idempotencyKeyHash}
        `;
        if (replayRows.length > 1) throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
        const replay = replayRows[0];
        if (
          replay !== undefined &&
          !bytesEqual(replay.canonicalRequestHash, canonicalRequestHash)
        ) {
          await appendAudit(transaction, {
            action: auditedAction,
            actorRole: authorization.role,
            afterDigest: null,
            beforeDigest: null,
            changeFields: [],
            outcome: "denied",
            reasonCode: "idempotency_conflict",
            session: authorization.session,
            targetId: caseId,
            targetType: "operational_case",
            ticketReference,
          });
          return Object.freeze({ error: "OPERATIONAL_CASE_CONFLICT" });
        }
        const current = await readCase(transaction, caseId, queue, true);
        if (current === null) {
          await appendAudit(transaction, {
            action: auditedAction,
            actorRole: authorization.role,
            afterDigest: null,
            beforeDigest: null,
            changeFields: [],
            outcome: "denied",
            reasonCode: "case_unavailable",
            session: authorization.session,
            targetId: caseId,
            targetType: "operational_case",
            ticketReference,
          });
          return Object.freeze({ error: "OPERATIONAL_CASE_NOT_FOUND" });
        }
        if (replay !== undefined) {
          const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
            SELECT CURRENT_TIMESTAMP AS now
          `;
          const now = clocks[0]?.now;
          if (now === undefined) throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
          return Object.freeze({ value: projectCase(current, now) });
        }
        const fromState = parseState(current.state);
        const fromPriority = parsePriority(current.priority);
        const toState: OperationalCaseState =
          caseAction === "triage"
            ? "triaged"
            : caseAction === "escalate"
              ? "escalated"
              : "resolved";
        const toPriority: OperationalCasePriority =
          caseAction === "escalate" ? "urgent" : fromPriority;
        const allowed =
          (caseAction === "triage" && fromState === "open") ||
          (caseAction === "escalate" && (fromState === "open" || fromState === "triaged")) ||
          (caseAction === "resolve" && (fromState === "triaged" || fromState === "escalated"));
        if (!allowed) {
          await appendAudit(transaction, {
            action: auditedAction,
            actorRole: authorization.role,
            afterDigest: null,
            beforeDigest: digest(JSON.stringify({ priority: fromPriority, state: fromState })),
            changeFields: [],
            outcome: "denied",
            reasonCode: "state_conflict",
            session: authorization.session,
            targetId: caseId,
            targetType: "operational_case",
            ticketReference,
          });
          return Object.freeze({ error: "OPERATIONAL_CASE_CONFLICT" });
        }
        const beforeDigest = digest(JSON.stringify({ priority: fromPriority, state: fromState }));
        const afterDigest = digest(
          JSON.stringify({
            assignedRole: authorization.role,
            priority: toPriority,
            state: toState,
          }),
        );
        const auditEventId = await appendAudit(transaction, {
          action: auditedAction,
          actorRole: authorization.role,
          afterDigest,
          beforeDigest,
          changeFields: adminSafeDiffFieldsFor(auditedAction),
          outcome: "completed",
          reasonCode,
          session: authorization.session,
          targetId: caseId,
          targetType: "operational_case",
          ticketReference,
        });
        const eventId = globalThis.crypto.randomUUID();
        const inserted = await transaction.$executeRaw`
          INSERT INTO operational_case_event_v1 (
            id, case_id, audit_event_id, actor_user_id, actor_session_id, actor_role,
            action, from_state, to_state, from_priority, to_priority, reason_code,
            ticket_reference, idempotency_key_hash, canonical_request_hash, created_at
          ) VALUES (
            ${eventId}::uuid, ${caseId}::uuid, ${auditEventId}::uuid,
            ${authorization.session.userId}::uuid, ${authorization.session.sessionId}::uuid,
            ${authorization.role}, ${caseAction}, ${fromState}, ${toState}, ${fromPriority},
            ${toPriority}, ${reasonCode}, ${ticketReference}, ${idempotencyKeyHash},
            ${canonicalRequestHash}, CURRENT_TIMESTAMP
          )
        `;
        if (inserted !== 1) throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
        const updated = await readCase(transaction, caseId, queue, false);
        const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT CURRENT_TIMESTAMP AS now
        `;
        const now = clocks[0]?.now;
        if (updated === null || now === undefined) {
          throw new OperationalCaseError("OPERATIONAL_CASE_UNAVAILABLE");
        }
        return Object.freeze({ value: projectCase(updated, now) });
      },
    );
    return unwrap(result);
  };

  return Object.freeze({ list, transition });
};

export type OperationalCaseService = ReturnType<typeof createOperationalCaseService>;
