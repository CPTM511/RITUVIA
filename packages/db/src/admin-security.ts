import { createHash, timingSafeEqual } from "node:crypto";

import {
  adminRoleAllows,
  adminRoles,
  adminSafeDiffFieldsFor,
  isAdminRole,
  type AdminRole,
} from "@rituvia/security";

import { Prisma, type PrismaClient } from "./generated/prisma/client.js";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/u;
const reasonCodePattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const ticketReferencePattern = /^[A-Z][A-Z0-9_-]{2,63}$/u;

export const adminSecurityErrorCodes = Object.freeze([
  "ADMIN_SECURITY_UNAVAILABLE",
  "ADMIN_SESSION_UNAVAILABLE",
  "ADMIN_RECENT_AUTH_REQUIRED",
  "ADMIN_MFA_REQUIRED",
  "ADMIN_FORBIDDEN",
  "ADMIN_REQUEST_INVALID",
  "ADMIN_ROLE_CONFLICT",
  "ADMIN_LAST_OWNER",
] as const);

export type AdminSecurityErrorCode = (typeof adminSecurityErrorCodes)[number];

const message = (code: AdminSecurityErrorCode): string => {
  switch (code) {
    case "ADMIN_SESSION_UNAVAILABLE":
      return "The admin session is unavailable.";
    case "ADMIN_RECENT_AUTH_REQUIRED":
      return "Recent authentication is required.";
    case "ADMIN_MFA_REQUIRED":
      return "A recent passkey verification is required.";
    case "ADMIN_FORBIDDEN":
      return "The privileged action is unavailable.";
    case "ADMIN_REQUEST_INVALID":
      return "The privileged action request is invalid.";
    case "ADMIN_ROLE_CONFLICT":
      return "The admin role state has changed.";
    case "ADMIN_LAST_OWNER":
      return "The final active owner role cannot be revoked.";
    case "ADMIN_SECURITY_UNAVAILABLE":
      return "Admin security storage is unavailable.";
  }
};

export class AdminSecurityError extends Error {
  readonly code: AdminSecurityErrorCode;

  constructor(code: AdminSecurityErrorCode) {
    super(message(code));
    this.name = "AdminSecurityError";
    this.code = code;
  }
}

export type AdminSecurityPolicy = Readonly<{
  recentAuthenticationSeconds: number;
}>;

export type AdminRoleAssignmentResult = Readonly<{
  assignmentId: string;
  expiresAt: string | null;
  role: AdminRole;
  userId: string;
}>;

export type AdminSecurityService = Readonly<{
  assignRole(input: {
    confirmation: string;
    expiresAt?: string | undefined;
    reasonCode: string;
    role: AdminRole;
    sessionToken: string;
    targetUserId: string;
    ticketReference?: string | undefined;
  }): Promise<AdminRoleAssignmentResult>;
  revokeRole(input: {
    assignmentId: string;
    confirmation: string;
    reasonCode: string;
    sessionToken: string;
    ticketReference?: string | undefined;
  }): Promise<Readonly<{ assignmentId: string; revoked: true }>>;
}>;

type TransactionClient = Prisma.TransactionClient;
type ActiveSession = Readonly<{
  authenticatedAt: Date | null;
  authIdentityId: string;
  sessionId: string;
  userId: string;
}>;
type ActiveRole = Readonly<{
  assignmentId: string;
  expiresAt: Date | null;
  role: AdminRole;
  userId: string;
}>;
type OperationResult<Value> =
  Readonly<{ error: AdminSecurityErrorCode }> | Readonly<{ value: Value }>;
type AuditAction = "admin.role.assign" | "admin.role.revoke";
type AuditInput = Readonly<{
  action: AuditAction;
  actorRole: AdminRole | null;
  afterDigest: Uint8Array | null;
  beforeDigest: Uint8Array | null;
  outcome: "completed" | "denied";
  reasonCode: string;
  session: ActiveSession;
  targetId: string;
  ticketReference: string | null;
}>;

const validatePolicy = (policy: AdminSecurityPolicy): AdminSecurityPolicy => {
  if (
    !Number.isSafeInteger(policy.recentAuthenticationSeconds) ||
    policy.recentAuthenticationSeconds < 60 ||
    policy.recentAuthenticationSeconds > 3_600
  ) {
    throw new TypeError("Admin security policy is invalid.");
  }
  return Object.freeze({ ...policy });
};

const invalid = (): never => {
  throw new AdminSecurityError("ADMIN_REQUEST_INVALID");
};

const parseUuid = (value: string): string => (uuidV4Pattern.test(value) ? value : invalid());
const parseRole = (value: unknown): AdminRole => (isAdminRole(value) ? value : invalid());
const parseReasonCode = (value: string): string =>
  value.length <= 64 && reasonCodePattern.test(value) ? value : invalid();
const parseTicketReference = (value: string | undefined): string | null =>
  value === undefined ? null : ticketReferencePattern.test(value) ? value : invalid();
const parseSessionToken = (value: string): string => {
  if (!sessionTokenPattern.test(value)) {
    throw new AdminSecurityError("ADMIN_SESSION_UNAVAILABLE");
  }
  return value;
};
const parseExpiry = (value: string | undefined): Date | null => {
  if (value === undefined) return null;
  const expiresAt = new Date(value);
  const now = Date.now();
  if (
    !Number.isFinite(expiresAt.valueOf()) ||
    expiresAt.toISOString() !== value ||
    expiresAt.valueOf() <= now ||
    expiresAt.valueOf() > now + 366 * 86_400_000
  ) {
    invalid();
  }
  return expiresAt;
};

const sha256 = (value: string | Uint8Array): Uint8Array =>
  createHash("sha256").update(value).digest();
const sessionTokenDigest = (value: string): Uint8Array =>
  sha256(Buffer.from(parseSessionToken(value), "base64url"));

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const activeRoleDigest = (roles: readonly ActiveRole[]): Uint8Array =>
  sha256(
    JSON.stringify(
      roles
        .map(({ assignmentId, expiresAt, role, userId }) => ({
          assignmentId,
          expiresAt: expiresAt?.toISOString() ?? null,
          role,
          userId,
        }))
        .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId)),
    ),
  );

const findSession = async (
  transaction: TransactionClient,
  tokenHash: Uint8Array,
): Promise<ActiveSession | null> => {
  const rows = await transaction.$queryRaw<ActiveSession[]>`
    SELECT
      session.id AS "sessionId",
      session.user_id AS "userId",
      session.auth_identity_id AS "authIdentityId",
      session.authenticated_at AS "authenticatedAt"
      FROM account_session AS session
      JOIN app_user AS users ON users.id = session.user_id
     WHERE session.token_hash = ${tokenHash}
       AND session.revoked_at IS NULL
       AND session.expires_at > CURRENT_TIMESTAMP
       AND users.status = 'active'
  `;
  if (rows.length > 1) throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
  return rows[0] ?? null;
};

const findActiveRoles = (transaction: TransactionClient, userId: string): Promise<ActiveRole[]> =>
  transaction.$queryRaw<ActiveRole[]>`
    SELECT
      assignment.id AS "assignmentId",
      assignment.user_id AS "userId",
      assignment.role,
      assignment.expires_at AS "expiresAt"
      FROM admin_role_assignment AS assignment
      LEFT JOIN admin_role_revocation AS revocation
        ON revocation.assignment_id = assignment.id
     WHERE assignment.user_id = ${userId}::uuid
       AND revocation.assignment_id IS NULL
       AND (assignment.expires_at IS NULL OR assignment.expires_at > CURRENT_TIMESTAMP)
     ORDER BY assignment.created_at, assignment.id
  `;

const hasPasskeyMfa = async (
  transaction: TransactionClient,
  session: ActiveSession,
  policy: AdminSecurityPolicy,
): Promise<boolean> => {
  const rows = await transaction.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1
        FROM admin_mfa_assertion AS assertion
        JOIN passkey_credential AS passkey
          ON passkey.id = assertion.passkey_credential_id
       WHERE assertion.user_id = ${session.userId}::uuid
         AND assertion.account_session_id = ${session.sessionId}::uuid
         AND assertion.verified_at >= CURRENT_TIMESTAMP
             - make_interval(secs => ${policy.recentAuthenticationSeconds})
         AND assertion.verified_at <= CURRENT_TIMESTAMP
         AND assertion.expires_at > CURRENT_TIMESTAMP
         AND passkey.auth_identity_id = ${session.authIdentityId}::uuid
         AND passkey.revoked_at IS NULL
    ) AS present
  `;
  return rows.length === 1 && rows[0]?.present === true;
};

const authorizeOwner = async (
  transaction: TransactionClient,
  session: ActiveSession,
  policy: AdminSecurityPolicy,
  action: AuditAction,
): Promise<Readonly<{ error: AdminSecurityErrorCode; role: AdminRole | null }> | null> => {
  const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT CURRENT_TIMESTAMP AS now
  `;
  const now = clocks[0]?.now;
  if (now === undefined) {
    return Object.freeze({ error: "ADMIN_SECURITY_UNAVAILABLE", role: null });
  }
  if (
    session.authenticatedAt === null ||
    session.authenticatedAt.valueOf() > now.valueOf() ||
    session.authenticatedAt.valueOf() < now.valueOf() - policy.recentAuthenticationSeconds * 1_000
  ) {
    return Object.freeze({ error: "ADMIN_RECENT_AUTH_REQUIRED", role: null });
  }
  const owner = (await findActiveRoles(transaction, session.userId)).find(
    ({ role }) => role === "owner",
  );
  if (owner === undefined || !adminRoleAllows(owner.role, action)) {
    return Object.freeze({ error: "ADMIN_FORBIDDEN", role: null });
  }
  if (!(await hasPasskeyMfa(transaction, session, policy))) {
    return Object.freeze({ error: "ADMIN_MFA_REQUIRED", role: owner.role });
  }
  return null;
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
    changeFields: adminSafeDiffFieldsFor(input.audit.action),
    createdAt: input.createdAt.toISOString(),
    eventId: input.eventId,
    outcome: input.audit.outcome,
    previousEventHash:
      input.previousEventHash === null
        ? null
        : Buffer.from(input.previousEventHash).toString("hex"),
    requestId: input.requestId,
    reasonCode: input.audit.reasonCode,
    targetId: input.audit.targetId,
    targetType: "admin_role_assignment",
    ticketReference: input.audit.ticketReference,
  });

const appendAudit = async (transaction: TransactionClient, audit: AuditInput): Promise<void> => {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended('admin_audit_event', 56056))
  `;
  const clocks = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT CURRENT_TIMESTAMP AS now
  `;
  const previous = await transaction.$queryRaw<Array<{ eventHash: Uint8Array }>>`
    SELECT event_hash AS "eventHash"
      FROM admin_audit_event
     ORDER BY created_at DESC, id DESC
     LIMIT 1
  `;
  const createdAt = clocks[0]?.now;
  if (createdAt === undefined || previous.length > 1) {
    throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
  }
  const eventId = globalThis.crypto.randomUUID();
  const requestId = globalThis.crypto.randomUUID();
  const previousEventHash = previous[0]?.eventHash ?? null;
  const eventHash = sha256(
    auditPayload({ audit, createdAt, eventId, previousEventHash, requestId }),
  );
  const inserted = await transaction.$executeRaw`
    INSERT INTO admin_audit_event (
      id, actor_user_id, actor_session_id, actor_role, request_id, action, outcome,
      target_type, target_id, reason_code, ticket_reference, change_fields,
      before_digest, after_digest, previous_event_hash, event_hash, created_at
    ) VALUES (
      ${eventId}::uuid, ${audit.session.userId}::uuid, ${audit.session.sessionId}::uuid,
      ${audit.actorRole}, ${requestId}::uuid, ${audit.action}, ${audit.outcome},
      'admin_role_assignment', ${audit.targetId}, ${audit.reasonCode},
      ${audit.ticketReference}, ${[...adminSafeDiffFieldsFor(audit.action)]}::text[],
      ${audit.beforeDigest}, ${audit.afterDigest}, ${previousEventHash},
      ${eventHash}, ${createdAt}
    )
  `;
  if (inserted !== 1) throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
};

const runTransaction = async <Value>(
  database: PrismaClient,
  callback: (transaction: TransactionClient) => Promise<Value>,
): Promise<Value> => {
  try {
    return await database.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (error instanceof AdminSecurityError) throw error;
    throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
  }
};

const throwIfError = <Value>(result: OperationResult<Value>): Value => {
  if ("error" in result) throw new AdminSecurityError(result.error);
  return result.value;
};

export const assertAdminSecurityRuntimeDatabasePrivileges = async (
  database: PrismaClient,
): Promise<void> => {
  const rows = await database.$queryRaw<
    Array<{
      auditDelete: boolean;
      auditInsert: boolean;
      auditSelect: boolean;
      auditTruncate: boolean;
      auditUpdate: boolean;
      bypassRls: boolean;
      canCreateDatabase: boolean;
      canCreateInDatabase: boolean;
      canCreateRole: boolean;
      canCreateSchema: boolean;
      mfaInsert: boolean;
      mfaSelect: boolean;
      privateJournalSelect: boolean;
      roleDelete: boolean;
      roleInsert: boolean;
      roleSelect: boolean;
      roleUpdate: boolean;
      revocationDelete: boolean;
      revocationInsert: boolean;
      revocationSelect: boolean;
      revocationUpdate: boolean;
      superuser: boolean;
    }>
  >`
    SELECT
      has_table_privilege(current_user, 'admin_role_assignment', 'SELECT') AS "roleSelect",
      has_table_privilege(current_user, 'admin_role_assignment', 'INSERT') AS "roleInsert",
      has_table_privilege(current_user, 'admin_role_assignment', 'UPDATE') AS "roleUpdate",
      has_table_privilege(current_user, 'admin_role_assignment', 'DELETE') AS "roleDelete",
      has_table_privilege(current_user, 'admin_role_revocation', 'SELECT') AS "revocationSelect",
      has_table_privilege(current_user, 'admin_role_revocation', 'INSERT') AS "revocationInsert",
      has_table_privilege(current_user, 'admin_role_revocation', 'UPDATE') AS "revocationUpdate",
      has_table_privilege(current_user, 'admin_role_revocation', 'DELETE') AS "revocationDelete",
      has_table_privilege(current_user, 'admin_mfa_assertion', 'SELECT') AS "mfaSelect",
      has_table_privilege(current_user, 'admin_mfa_assertion', 'INSERT') AS "mfaInsert",
      has_table_privilege(current_user, 'admin_audit_event', 'SELECT') AS "auditSelect",
      has_table_privilege(current_user, 'admin_audit_event', 'INSERT') AS "auditInsert",
      has_table_privilege(current_user, 'admin_audit_event', 'UPDATE') AS "auditUpdate",
      has_table_privilege(current_user, 'admin_audit_event', 'DELETE') AS "auditDelete",
      has_table_privilege(current_user, 'admin_audit_event', 'TRUNCATE') AS "auditTruncate",
      has_table_privilege(current_user, 'private_journal_entry', 'SELECT')
        AS "privateJournalSelect",
      has_database_privilege(current_user, current_database(), 'CREATE')
        AS "canCreateInDatabase",
      has_schema_privilege(current_user, 'public', 'CREATE') AS "canCreateSchema",
      (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
      (SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user) AS "canCreateDatabase",
      (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS "canCreateRole",
      (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS "bypassRls"
  `;
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    !row.roleSelect ||
    !row.roleInsert ||
    row.roleUpdate ||
    row.roleDelete ||
    !row.revocationSelect ||
    !row.revocationInsert ||
    row.revocationUpdate ||
    row.revocationDelete ||
    !row.mfaSelect ||
    row.mfaInsert ||
    !row.auditSelect ||
    !row.auditInsert ||
    row.auditUpdate ||
    row.auditDelete ||
    row.auditTruncate ||
    row.privateJournalSelect ||
    row.canCreateDatabase ||
    row.canCreateInDatabase ||
    row.canCreateRole ||
    row.canCreateSchema ||
    row.superuser ||
    row.bypassRls
  ) {
    throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
  }
};

export const createAdminSecurityService = (
  database: PrismaClient,
  rawPolicy: AdminSecurityPolicy,
): AdminSecurityService => {
  const policy = validatePolicy(rawPolicy);

  const assignRole: AdminSecurityService["assignRole"] = async (input) => {
    const targetUserId = parseUuid(input.targetUserId);
    const role = parseRole(input.role);
    const reasonCode = parseReasonCode(input.reasonCode);
    const ticketReference = parseTicketReference(input.ticketReference);
    const expiresAt = parseExpiry(input.expiresAt);
    if (input.confirmation !== `ASSIGN ${role}`) invalid();
    const tokenHash = sessionTokenDigest(input.sessionToken);
    const result = await runTransaction<OperationResult<AdminRoleAssignmentResult>>(
      database,
      async (transaction) => {
        const session = await findSession(transaction, tokenHash);
        if (session === null) {
          return Object.freeze({ error: "ADMIN_SESSION_UNAVAILABLE" });
        }
        const failure = await authorizeOwner(transaction, session, policy, "admin.role.assign");
        if (failure !== null) {
          await appendAudit(transaction, {
            action: "admin.role.assign",
            actorRole: failure.role,
            afterDigest: null,
            beforeDigest: null,
            outcome: "denied",
            reasonCode: "authorization_denied",
            session,
            targetId: targetUserId,
            ticketReference: null,
          });
          return Object.freeze({ error: failure.error });
        }
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${targetUserId}, 56056))
        `;
        const targets = await transaction.$queryRaw<Array<{ present: boolean }>>`
          SELECT EXISTS (
            SELECT 1 FROM app_user
             WHERE id = ${targetUserId}::uuid
               AND status = 'active'
          ) AS present
        `;
        if (targets[0]?.present !== true) {
          await appendAudit(transaction, {
            action: "admin.role.assign",
            actorRole: "owner",
            afterDigest: null,
            beforeDigest: null,
            outcome: "denied",
            reasonCode: "target_unavailable",
            session,
            targetId: targetUserId,
            ticketReference: null,
          });
          return Object.freeze({ error: "ADMIN_REQUEST_INVALID" });
        }
        const beforeRoles = await findActiveRoles(transaction, targetUserId);
        if (beforeRoles.some((assignment) => assignment.role === role)) {
          await appendAudit(transaction, {
            action: "admin.role.assign",
            actorRole: "owner",
            afterDigest: activeRoleDigest(beforeRoles),
            beforeDigest: activeRoleDigest(beforeRoles),
            outcome: "denied",
            reasonCode: "role_conflict",
            session,
            targetId: targetUserId,
            ticketReference: null,
          });
          return Object.freeze({ error: "ADMIN_ROLE_CONFLICT" });
        }
        const assignmentId = globalThis.crypto.randomUUID();
        const inserted = await transaction.$executeRaw`
          INSERT INTO admin_role_assignment (
            id, user_id, role, granted_by_user_id, reason_code,
            ticket_reference, created_at, expires_at
          ) VALUES (
            ${assignmentId}::uuid, ${targetUserId}::uuid, ${role},
            ${session.userId}::uuid, ${reasonCode}, ${ticketReference},
            CURRENT_TIMESTAMP, ${expiresAt}
          )
        `;
        if (inserted !== 1) {
          throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
        }
        const afterRoles = await findActiveRoles(transaction, targetUserId);
        await appendAudit(transaction, {
          action: "admin.role.assign",
          actorRole: "owner",
          afterDigest: activeRoleDigest(afterRoles),
          beforeDigest: activeRoleDigest(beforeRoles),
          outcome: "completed",
          reasonCode,
          session,
          targetId: assignmentId,
          ticketReference,
        });
        return Object.freeze({
          value: Object.freeze({
            assignmentId,
            expiresAt: expiresAt?.toISOString() ?? null,
            role,
            userId: targetUserId,
          }),
        });
      },
    );
    return throwIfError(result);
  };

  const revokeRole: AdminSecurityService["revokeRole"] = async (input) => {
    const assignmentId = parseUuid(input.assignmentId);
    const reasonCode = parseReasonCode(input.reasonCode);
    const ticketReference = parseTicketReference(input.ticketReference);
    if (input.confirmation !== `REVOKE ${assignmentId}`) invalid();
    const tokenHash = sessionTokenDigest(input.sessionToken);
    const result = await runTransaction<
      OperationResult<Readonly<{ assignmentId: string; revoked: true }>>
    >(database, async (transaction) => {
      const session = await findSession(transaction, tokenHash);
      if (session === null) {
        return Object.freeze({ error: "ADMIN_SESSION_UNAVAILABLE" });
      }
      const failure = await authorizeOwner(transaction, session, policy, "admin.role.revoke");
      if (failure !== null) {
        await appendAudit(transaction, {
          action: "admin.role.revoke",
          actorRole: failure.role,
          afterDigest: null,
          beforeDigest: null,
          outcome: "denied",
          reasonCode: "authorization_denied",
          session,
          targetId: assignmentId,
          ticketReference: null,
        });
        return Object.freeze({ error: failure.error });
      }
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${assignmentId}, 56056))
      `;
      const assignments = await transaction.$queryRaw<ActiveRole[]>`
        SELECT
          assignment.id AS "assignmentId",
          assignment.user_id AS "userId",
          assignment.role,
          assignment.expires_at AS "expiresAt"
          FROM admin_role_assignment AS assignment
          LEFT JOIN admin_role_revocation AS revocation
            ON revocation.assignment_id = assignment.id
         WHERE assignment.id = ${assignmentId}::uuid
           AND revocation.assignment_id IS NULL
           AND (assignment.expires_at IS NULL OR assignment.expires_at > CURRENT_TIMESTAMP)
      `;
      const assignment = assignments[0];
      if (assignments.length !== 1 || assignment === undefined) {
        await appendAudit(transaction, {
          action: "admin.role.revoke",
          actorRole: "owner",
          afterDigest: null,
          beforeDigest: null,
          outcome: "denied",
          reasonCode: "role_conflict",
          session,
          targetId: assignmentId,
          ticketReference: null,
        });
        return Object.freeze({ error: "ADMIN_ROLE_CONFLICT" });
      }
      const beforeRoles = await findActiveRoles(transaction, assignment.userId);
      if (assignment.role === "owner") {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended('admin_active_owner', 56056))
        `;
        const counts = await transaction.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) AS count
            FROM admin_role_assignment AS owner_assignment
            LEFT JOIN admin_role_revocation AS owner_revocation
              ON owner_revocation.assignment_id = owner_assignment.id
           WHERE owner_assignment.role = 'owner'
             AND owner_revocation.assignment_id IS NULL
             AND (
               owner_assignment.expires_at IS NULL
               OR owner_assignment.expires_at > CURRENT_TIMESTAMP
             )
        `;
        if ((counts[0]?.count ?? 0n) <= 1n) {
          await appendAudit(transaction, {
            action: "admin.role.revoke",
            actorRole: "owner",
            afterDigest: activeRoleDigest(beforeRoles),
            beforeDigest: activeRoleDigest(beforeRoles),
            outcome: "denied",
            reasonCode: "last_owner_protection",
            session,
            targetId: assignmentId,
            ticketReference: null,
          });
          return Object.freeze({ error: "ADMIN_LAST_OWNER" });
        }
      }
      const inserted = await transaction.$executeRaw`
        INSERT INTO admin_role_revocation (
          assignment_id, user_id, revoked_by_user_id, reason_code,
          ticket_reference, created_at
        ) VALUES (
          ${assignment.assignmentId}::uuid, ${assignment.userId}::uuid,
          ${session.userId}::uuid, ${reasonCode}, ${ticketReference}, CURRENT_TIMESTAMP
        )
      `;
      if (inserted !== 1) {
        throw new AdminSecurityError("ADMIN_SECURITY_UNAVAILABLE");
      }
      const afterRoles = await findActiveRoles(transaction, assignment.userId);
      await appendAudit(transaction, {
        action: "admin.role.revoke",
        actorRole: "owner",
        afterDigest: activeRoleDigest(afterRoles),
        beforeDigest: activeRoleDigest(beforeRoles),
        outcome: "completed",
        reasonCode,
        session,
        targetId: assignmentId,
        ticketReference,
      });
      return Object.freeze({
        value: Object.freeze({ assignmentId, revoked: true }),
      });
    });
    return throwIfError(result);
  };

  return Object.freeze({ assignRole, revokeRole });
};

export const verifyAdminAuditEventHash = (event: {
  action: AuditAction;
  actorRole: AdminRole | null;
  actorSessionId: string;
  actorUserId: string;
  afterDigest: Uint8Array | null;
  beforeDigest: Uint8Array | null;
  createdAt: Date;
  eventHash: Uint8Array;
  eventId: string;
  outcome: "completed" | "denied";
  previousEventHash: Uint8Array | null;
  reasonCode: string;
  requestId: string;
  targetId: string;
  ticketReference: string | null;
}): boolean => {
  const expected = sha256(
    auditPayload({
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

export { adminRoles, type AdminRole };
