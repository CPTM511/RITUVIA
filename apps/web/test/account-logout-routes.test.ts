import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => ({ logout: vi.fn(), logoutAll: vi.fn() }));
vi.mock("../server/account-auth", () => ({
  accountAuthStateCookieName: "__Host-rituvia-auth-state",
  accountSessionCookieName: "__Host-rituvia-account-session",
  logoutAllWebAccountSessions: harness.logoutAll,
  logoutWebAccountSession: harness.logout,
  mergeWebAnonymousSubject: vi.fn(),
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { POST as logout } from "../app/api/v1/auth/logout/route";
import { POST as logoutAll } from "../app/api/v1/auth/logout-all/route";

const request = (origin = "https://example.test") =>
  new NextRequest("https://example.test/api/v1/auth/logout", {
    headers: {
      cookie: "__Host-rituvia-account-session=" + "s".repeat(43),
      origin,
      "sec-fetch-site": "same-origin",
      "x-csrf-token": deriveSessionCsrfToken("s".repeat(43)),
    },
    method: "POST",
  });

const streamedRequest = (bytes?: Uint8Array) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes !== undefined) controller.enqueue(bytes);
      controller.close();
    },
  });
  return new NextRequest("https://example.test/api/v1/auth/logout", {
    body,
    duplex: "half" as const,
    headers: {
      cookie: "__Host-rituvia-account-session=" + "s".repeat(43),
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": deriveSessionCsrfToken("s".repeat(43)),
    },
    method: "POST",
  });
};

describe("account logout routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["current", logout, harness.logout],
    ["all", logoutAll, harness.logoutAll],
  ] as const)(
    "revokes %s sessions and always clears the host cookie",
    async (_label, route, operation) => {
      operation.mockResolvedValue(true);
      const response = await route(request());
      const cookie = response.headers.get("set-cookie") ?? "";

      expect(response.status).toBe(204);
      expect(operation).toHaveBeenCalledWith("s".repeat(43));
      expect(cookie).toContain("__Host-rituvia-account-session=");
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
    },
  );

  it("rejects cross-origin logout before session lookup", async () => {
    expect((await logout(request("https://foreign.test"))).status).toBe(403);
    expect((await logoutAll(request("https://foreign.test"))).status).toBe(403);
    expect(harness.logout).not.toHaveBeenCalled();
    expect(harness.logoutAll).not.toHaveBeenCalled();
  });

  it("rejects a missing or mismatched session CSRF token", async () => {
    const missing = request();
    missing.headers.delete("x-csrf-token");
    expect((await logout(missing)).status).toBe(403);

    const mismatched = request();
    mismatched.headers.set("x-csrf-token", deriveSessionCsrfToken("x".repeat(43)));
    expect((await logoutAll(mismatched)).status).toBe(403);
    expect(harness.logout).not.toHaveBeenCalled();
    expect(harness.logoutAll).not.toHaveBeenCalled();
  });

  it("does not clear the browser cookie when durable revocation is unavailable", async () => {
    harness.logout.mockRejectedValue(new Error("database unavailable"));
    const response = await logout(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["current", logout, harness.logout],
    ["all", logoutAll, harness.logoutAll],
  ] as const)(
    "accepts a browser-shaped empty stream for %s logout",
    async (_label, route, operation) => {
      operation.mockResolvedValue(true);

      expect((await route(streamedRequest())).status).toBe(204);
      expect(operation).toHaveBeenCalledWith("s".repeat(43));
    },
  );

  it.each([
    ["current", logout, harness.logout],
    ["all", logoutAll, harness.logoutAll],
  ] as const)("rejects request bytes for %s logout", async (_label, route, operation) => {
    const bytes = new TextEncoder().encode("unexpected");

    expect((await route(streamedRequest(bytes))).status).toBe(403);
    expect(operation).not.toHaveBeenCalled();
  });
});
