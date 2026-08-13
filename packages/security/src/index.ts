export const adminRoles = Object.freeze([
  "owner",
  "content_editor",
  "support_refund_reviewer",
  "risk_safety_reviewer",
  "analyst_read_only",
] as const);

export type AdminRole = (typeof adminRoles)[number];

export const adminActions = Object.freeze([
  "admin.role.assign",
  "admin.role.revoke",
  "admin.audit.read",
  "admin.commerce.read",
  "admin.commerce.reconcile",
  "admin.content.manage",
  "admin.content_report.review",
  "admin.privacy.review",
  "admin.refund.execute",
  "admin.refund.review",
  "admin.safety.review",
  "admin.support.review",
  "admin.analytics.read",
] as const);

export type AdminAction = (typeof adminActions)[number];

export const isAdminRole = (value: unknown): value is AdminRole =>
  typeof value === "string" && adminRoles.includes(value as AdminRole);

export const isAdminAction = (value: unknown): value is AdminAction =>
  typeof value === "string" && adminActions.includes(value as AdminAction);

export const adminRoleAllows = (role: unknown, action: unknown): boolean => {
  if (!isAdminRole(role) || !isAdminAction(action)) return false;
  switch (role) {
    case "owner":
      return true;
    case "content_editor":
      return action === "admin.content.manage" || action === "admin.content_report.review";
    case "support_refund_reviewer":
      return (
        action === "admin.privacy.review" ||
        action === "admin.refund.review" ||
        action === "admin.support.review"
      );
    case "risk_safety_reviewer":
      return action === "admin.safety.review";
    case "analyst_read_only":
      return action === "admin.audit.read" || action === "admin.analytics.read";
  }
};

export const adminSafeDiffFields = Object.freeze({
  "admin.audit.read": Object.freeze([]),
  "admin.commerce.read": Object.freeze([]),
  "admin.commerce.reconcile": Object.freeze([]),
  "admin.content_report.review": Object.freeze(["assigned_role", "priority", "state"]),
  "admin.privacy.review": Object.freeze(["assigned_role", "priority", "state"]),
  "admin.refund.execute": Object.freeze(["amount_minor", "currency_code"]),
  "admin.role.assign": Object.freeze(["expires_at", "role"]),
  "admin.role.revoke": Object.freeze(["expires_at", "role"]),
  "admin.safety.review": Object.freeze(["assigned_role", "priority", "state"]),
  "admin.support.review": Object.freeze(["assigned_role", "priority", "state"]),
} satisfies Readonly<
  Record<
    Extract<
      AdminAction,
      | "admin.audit.read"
      | "admin.commerce.read"
      | "admin.commerce.reconcile"
      | "admin.content_report.review"
      | "admin.privacy.review"
      | "admin.refund.execute"
      | "admin.role.assign"
      | "admin.role.revoke"
      | "admin.safety.review"
      | "admin.support.review"
    >,
    readonly string[]
  >
>);

export const adminSafeDiffFieldsFor = (
  action:
    | "admin.audit.read"
    | "admin.commerce.read"
    | "admin.commerce.reconcile"
    | "admin.content_report.review"
    | "admin.privacy.review"
    | "admin.refund.execute"
    | "admin.role.assign"
    | "admin.role.revoke"
    | "admin.safety.review"
    | "admin.support.review",
): readonly string[] => {
  switch (action) {
    case "admin.audit.read":
      return adminSafeDiffFields["admin.audit.read"];
    case "admin.commerce.read":
      return adminSafeDiffFields["admin.commerce.read"];
    case "admin.commerce.reconcile":
      return adminSafeDiffFields["admin.commerce.reconcile"];
    case "admin.content_report.review":
      return adminSafeDiffFields["admin.content_report.review"];
    case "admin.privacy.review":
      return adminSafeDiffFields["admin.privacy.review"];
    case "admin.refund.execute":
      return adminSafeDiffFields["admin.refund.execute"];
    case "admin.role.assign":
      return adminSafeDiffFields["admin.role.assign"];
    case "admin.role.revoke":
      return adminSafeDiffFields["admin.role.revoke"];
    case "admin.safety.review":
      return adminSafeDiffFields["admin.safety.review"];
    case "admin.support.review":
      return adminSafeDiffFields["admin.support.review"];
  }
};
