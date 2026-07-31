import { describe, expect, it } from "vitest";

import {
  adminActions,
  adminRoleAllows,
  adminRoles,
  adminSafeDiffFields,
  isAdminAction,
  isAdminRole,
} from "../src/index.js";

describe("admin authorization policy", () => {
  it("uses a finite default-deny role and action catalog", () => {
    expect(adminRoles).toEqual([
      "owner",
      "content_editor",
      "support_refund_reviewer",
      "risk_safety_reviewer",
      "analyst_read_only",
    ]);
    expect(adminActions).not.toContain("admin.private_content.read");
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("OWNER")).toBe(false);
    expect(isAdminAction("admin.role.assign")).toBe(true);
    expect(isAdminAction("admin.commerce.reconcile")).toBe(true);
    expect(isAdminAction("admin.role.escalate")).toBe(false);
    expect(adminRoleAllows("owner", "admin.role.assign")).toBe(true);
    expect(adminRoleAllows("owner", "admin.refund.execute")).toBe(true);
    expect(adminRoleAllows("ordinary_user", "admin.role.assign")).toBe(false);
    expect(adminRoleAllows("owner", "unknown")).toBe(false);
  });

  it("keeps every non-owner role least-privileged", () => {
    expect(adminRoleAllows("content_editor", "admin.content.manage")).toBe(true);
    expect(adminRoleAllows("content_editor", "admin.refund.review")).toBe(false);
    expect(adminRoleAllows("support_refund_reviewer", "admin.refund.review")).toBe(true);
    expect(adminRoleAllows("support_refund_reviewer", "admin.refund.execute")).toBe(false);
    expect(adminRoleAllows("support_refund_reviewer", "admin.content.manage")).toBe(false);
    expect(adminRoleAllows("risk_safety_reviewer", "admin.safety.review")).toBe(true);
    expect(adminRoleAllows("risk_safety_reviewer", "admin.audit.read")).toBe(false);
    expect(adminRoleAllows("analyst_read_only", "admin.analytics.read")).toBe(true);
    expect(adminRoleAllows("analyst_read_only", "admin.role.assign")).toBe(false);
  });

  it("allows only digest-backed fields in role-change audit diffs", () => {
    expect(adminSafeDiffFields["admin.role.assign"]).toEqual(["expires_at", "role"]);
    expect(adminSafeDiffFields["admin.role.revoke"]).toEqual(["expires_at", "role"]);
    expect(adminSafeDiffFields["admin.refund.execute"]).toEqual(["amount_minor", "currency_code"]);
    expect(JSON.stringify(adminSafeDiffFields)).not.toMatch(
      /email|journal|prayer|prompt|secret|token|wallet/u,
    );
  });
});
