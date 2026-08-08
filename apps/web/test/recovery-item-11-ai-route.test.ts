import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class AiError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic AI error");
      this.code = code;
    }
  }
  return { AiError, generate: vi.fn() };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));

vi.mock("../server/recovery-item-11-ai", () => ({
  loadWebRecoveryItem11AiApplicationService: () => ({ generate: harness.generate }),
  RecoveryItem11AiError: harness.AiError,
}));

import { POST } from "../app/api/v1/recovery/item-11/interpretation/route";
import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../server/session-csrf";

const accountToken = "a".repeat(43);
const requestHeaders = Object.freeze({
  cookie: `__Host-rituvia-account-session=${accountToken}`,
  "content-type": "application/json",
  "idempotency-key": "abcdefghijklmnopqrstuv",
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
  [sessionCsrfHeaderName]: deriveSessionCsrfToken(accountToken),
});

describe("Recovery Item 11 synthetic AI HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.generate.mockResolvedValue({
      creditConsumed: false,
      kind: "fallback",
      output: { schemaVersion: "1", title: "Safe fallback" },
      reason: "provider_failure",
      usage: null,
    });
  });

  it("accepts only an empty synthetic request and never forwards a client credential", async () => {
    const response = await POST(
      new NextRequest("https://example.test/api/v1/recovery/item-11/interpretation", {
        body: "{}",
        headers: { ...requestHeaders, "x-vercel-oidc-token": "client-supplied-canary" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(await response.json()).toMatchObject({
      creditConsumed: false,
      kind: "fallback",
      schemaVersion: 1,
    });
    expect(harness.generate).toHaveBeenCalledWith({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: {},
      sessionToken: accountToken,
    });
  });

  it("rejects cross-site, missing CSRF, and non-JSON requests before the service", async () => {
    const requests = [
      new NextRequest("https://example.test/api/v1/recovery/item-11/interpretation", {
        body: "{}",
        headers: { ...requestHeaders, origin: "https://foreign.test" },
        method: "POST",
      }),
      new NextRequest("https://example.test/api/v1/recovery/item-11/interpretation", {
        body: "{}",
        headers: Object.fromEntries(
          Object.entries(requestHeaders).filter(([name]) => name !== sessionCsrfHeaderName),
        ),
        method: "POST",
      }),
      new NextRequest("https://example.test/api/v1/recovery/item-11/interpretation", {
        body: "{}",
        headers: { ...requestHeaders, "content-type": "text/plain" },
        method: "POST",
      }),
    ];
    for (const request of requests) {
      expect((await POST(request)).status).toBeGreaterThanOrEqual(400);
    }
    expect(harness.generate).not.toHaveBeenCalled();
  });

  it("maps the daily limit without exposing provider or prompt details", async () => {
    harness.generate.mockRejectedValueOnce(new harness.AiError("daily_limit"));
    const response = await POST(
      new NextRequest("https://example.test/api/v1/recovery/item-11/interpretation", {
        body: "{}",
        headers: requestHeaders,
        method: "POST",
      }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "RECOVERY_ITEM_11_AI_DAILY_LIMIT",
      schemaVersion: 1,
      status: 429,
    });
  });
});
