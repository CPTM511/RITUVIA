import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class AuthError extends Error {
    readonly code: string;
    readonly retryAfterSeconds: number | undefined;
    constructor(code: string, retryAfterSeconds?: number) {
      super("synthetic");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { AuthError, start: vi.fn() };
});

vi.mock("../server/account-auth", () => ({
  accountAuthStateCookieName: "__Host-rituvia-auth-state",
  accountSessionCookieName: "__Host-rituvia-account-session",
  startWebAccountAuth: harness.start,
  WebAccountAuthError: harness.AuthError,
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { POST } from "../app/api/v1/auth/start/route";
import { WebAccountAuthError } from "../server/account-auth";

const request = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest("https://example.test/api/v1/auth/start", {
    body,
    headers: {
      "content-length": String(new TextEncoder().encode(body).byteLength),
      "content-type": "application/json",
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    method: "POST",
  });

describe("account auth start route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a uniform accepted local preview without reflecting email or bearer material", async () => {
    harness.start.mockResolvedValue({
      accepted: true,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      localPreviewPath: "/api/v1/auth/local-preview",
      stateToken: "s".repeat(43),
    });
    const response = await POST(
      request(JSON.stringify({ email: "demo@example.test", returnTo: "/en/account" })),
    );
    const text = await response.text();

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(text).not.toContain("demo@example.test");
    expect(text).not.toContain("s".repeat(43));
    expect(text).not.toContain("token");
    expect(response.headers.get("set-cookie")).toContain("__Host-rituvia-auth-state=");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(harness.start).toHaveBeenCalledWith({
      email: "demo@example.test",
      previousSessionToken: undefined,
      returnTo: "/en/account",
    });
  });

  it("returns a uniform production acceptance without exposing a callback path", async () => {
    harness.start.mockResolvedValue({
      accepted: true,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      stateToken: "s".repeat(43),
    });
    const response = await POST(
      request(JSON.stringify({ email: "person@example.net", returnTo: "/en/account" })),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      accepted: true,
      expiresAt: expect.any(String),
    });
    expect(response.headers.get("set-cookie")).toContain("__Host-rituvia-auth-state=");
  });

  it("returns a bounded rate-limit response without a preview or state cookie", async () => {
    harness.start.mockRejectedValue(new WebAccountAuthError("rate_limited", 42));
    const response = await POST(
      request(JSON.stringify({ email: "person@example.com", returnTo: "/en/account" })),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ code: "ACCOUNT_AUTH_RATE_LIMITED", status: 429 });
  });

  it.each([
    { body: "{}", headers: {}, status: 400 },
    {
      body: JSON.stringify({ email: "demo@example.test", extra: true, returnTo: "/en" }),
      headers: {},
      status: 400,
    },
    {
      body: JSON.stringify({ email: "demo@example.test", returnTo: "/en" }),
      headers: { origin: "https://foreign.test" },
      status: 403,
    },
  ])(
    "rejects malformed or cross-origin requests before auth: %#",
    async ({ body, headers, status }) => {
      const response = await POST(request(body, headers));
      expect(response.status).toBe(status);
      expect(harness.start).not.toHaveBeenCalled();
    },
  );
});
