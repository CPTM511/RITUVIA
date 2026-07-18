import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ logout: vi.fn(), logoutAll: vi.fn() }));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
  logoutAllWebAccountSessions: harness.logoutAll,
  logoutWebAccountSession: harness.logout,
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
