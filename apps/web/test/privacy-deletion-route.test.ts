import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class DeletionError extends Error {
    readonly code: string;
    readonly retryAfterSeconds: number | undefined;
    constructor(code: string, retryAfterSeconds?: number) {
      super("synthetic");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  class ExportError extends Error {}
  return { DeletionError, ExportError, request: vi.fn() };
});

vi.mock("../server/privacy-deletion", () => ({
  requestWebPrivacyDeletion: harness.request,
  WebPrivacyDeletionError: harness.DeletionError,
}));
vi.mock("../server/privacy-export", () => ({
  WebPrivacyExportError: harness.ExportError,
}));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { POST } from "../app/api/v1/privacy/deletions/route";

const sessionToken = "s".repeat(43);
const mutationHeaders = {
  "content-type": "application/json",
  cookie: `__Host-rituvia-account-session=${sessionToken}`,
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
  "x-csrf-token": deriveSessionCsrfToken(sessionToken),
};
const completed = {
  completedAt: "2026-07-25T01:00:01.000Z",
  counts: {
    accountSessions: 0,
    authIdentities: 0,
    birthProfiles: 0,
    currentJournals: 1,
    exportArtifacts: 1,
    intentions: 1,
    interpretations: 1,
    legacyJournals: 0,
    passkeys: 0,
    revisits: 1,
    subjects: 1,
    verifications: 1,
    wallets: 0,
  },
  id: "11111111-1111-4111-8111-111111111111",
  policyVersion: "privacy-deletion.local.v1",
  requestedAt: "2026-07-25T01:00:00.000Z",
  retentionCategories: [
    "derived_reflection_metadata",
    "consent_history",
    "commerce_financial",
    "security_privacy_audit",
  ],
  scope: "private_content",
  status: "completed",
};

describe("privacy deletion route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts one CSRF-bound selective deletion without clearing the account cookie", async () => {
    harness.request.mockResolvedValue(completed);
    const response = await POST(
      new NextRequest("https://example.test/api/v1/privacy/deletions", {
        body: JSON.stringify({ scope: "private_content" }),
        headers: { ...mutationHeaders, "idempotency-key": "i".repeat(22) },
        method: "POST",
      }),
    );
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual(completed);
    expect(harness.request).toHaveBeenCalledWith({
      idempotencyKey: "i".repeat(22),
      scope: "private_content",
      sessionToken,
    });
  });

  it("clears the account session cookie after full account deletion", async () => {
    harness.request.mockResolvedValue({ ...completed, scope: "account" });
    const response = await POST(
      new NextRequest("https://example.test/api/v1/privacy/deletions", {
        body: JSON.stringify({ scope: "account" }),
        headers: { ...mutationHeaders, "idempotency-key": "a".repeat(22) },
        method: "POST",
      }),
    );
    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toContain("__Host-rituvia-account-session=;");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects cross-site, malformed, and over-specified requests before persistence", async () => {
    const crossSite = await POST(
      new NextRequest("https://example.test/api/v1/privacy/deletions", {
        body: JSON.stringify({ scope: "private_content" }),
        headers: {
          ...mutationHeaders,
          "idempotency-key": "i".repeat(22),
          origin: "https://attacker.test",
        },
        method: "POST",
      }),
    );
    expect(crossSite.status).toBe(403);

    const malformed = await POST(
      new NextRequest("https://example.test/api/v1/privacy/deletions", {
        body: JSON.stringify({ reason: "anything", scope: "account" }),
        headers: { ...mutationHeaders, "idempotency-key": "i".repeat(22) },
        method: "POST",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(harness.request).not.toHaveBeenCalled();
  });

  it("maps recent-authentication and rate-limit failures without exposing details", async () => {
    harness.request.mockRejectedValueOnce(new harness.DeletionError("recent_auth_required"));
    const recent = await POST(
      new NextRequest("https://example.test/api/v1/privacy/deletions", {
        body: JSON.stringify({ scope: "private_content" }),
        headers: { ...mutationHeaders, "idempotency-key": "i".repeat(22) },
        method: "POST",
      }),
    );
    expect(recent.status).toBe(403);
    expect(await recent.json()).toEqual({
      code: "PRIVACY_DELETION_RECENT_AUTH_REQUIRED",
      status: 403,
    });

    harness.request.mockRejectedValueOnce(new harness.DeletionError("rate_limited", 120));
    const limited = await POST(
      new NextRequest("https://example.test/api/v1/privacy/deletions", {
        body: JSON.stringify({ scope: "private_content" }),
        headers: { ...mutationHeaders, "idempotency-key": "j".repeat(22) },
        method: "POST",
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("120");
  });
});
