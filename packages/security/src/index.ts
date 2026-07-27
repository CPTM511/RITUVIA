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
  "admin.content.manage",
  "admin.refund.review",
  "admin.safety.review",
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
      return action === "admin.content.manage";
    case "support_refund_reviewer":
      return action === "admin.refund.review";
    case "risk_safety_reviewer":
      return action === "admin.safety.review";
    case "analyst_read_only":
      return action === "admin.audit.read" || action === "admin.analytics.read";
  }
};

export const adminSafeDiffFields = Object.freeze({
  "admin.audit.read": Object.freeze([]),
  "admin.role.assign": Object.freeze(["expires_at", "role"]),
  "admin.role.revoke": Object.freeze(["expires_at", "role"]),
} satisfies Readonly<
  Record<
    Extract<AdminAction, "admin.audit.read" | "admin.role.assign" | "admin.role.revoke">,
    readonly string[]
  >
>);

export const adminSafeDiffFieldsFor = (
  action: "admin.audit.read" | "admin.role.assign" | "admin.role.revoke",
): readonly string[] => {
  switch (action) {
    case "admin.audit.read":
      return adminSafeDiffFields["admin.audit.read"];
    case "admin.role.assign":
      return adminSafeDiffFields["admin.role.assign"];
    case "admin.role.revoke":
      return adminSafeDiffFields["admin.role.revoke"];
  }
};
