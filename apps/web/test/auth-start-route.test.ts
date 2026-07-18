import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ start: vi.fn() }));

vi.mock("../server/account-auth", () => ({
  startWebAccountAuth: harness.start,
  WebAccountAuthError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  },
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { POST } from "../app/api/v1/auth/start/route";

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

  it("returns a no-store local callback without reflecting the email", async () => {
    harness.start.mockResolvedValue({
      callbackUrl: "https://example.test/api/v1/auth/callback?challenge=safe&token=secret",
      expiresAt: "2026-07-18T00:10:00.000Z",
    });
    const response = await POST(
      request(JSON.stringify({ email: "demo@example.test", returnTo: "/en/account" })),
    );
    const text = await response.text();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(text).not.toContain("demo@example.test");
    expect(harness.start).toHaveBeenCalledWith({
      email: "demo@example.test",
      returnTo: "/en/account",
    });
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
