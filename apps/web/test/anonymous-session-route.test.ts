import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class SessionError extends Error {
    readonly code: "conflict" | "rate_limited" | "unavailable";
    readonly retryAfterSeconds: number | undefined;

    constructor(code: "conflict" | "rate_limited" | "unavailable", retryAfterSeconds?: number) {
      super("synthetic session error");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { ensure: vi.fn(), SessionError };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/anonymous-session", () => ({
  ensureWebAnonymousSession: harness.ensure,
  WebAnonymousSessionError: harness.SessionError,
}));

import { anonymousSessionCookieName, POST } from "../app/api/v1/anonymous/session/route";

const idempotencyKey = "abcdefghijklmnopqrstuv";
const request = (input?: { cookie?: string; headers?: Record<string, string> }): NextRequest =>
  new NextRequest("https://example.test/api/v1/anonymous/session", {
    headers: {
      "idempotency-key": idempotencyKey,
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-rituvia-correlation-id": "req_11111111111111111111111111111111",
      ...(input?.cookie === undefined
        ? {}
        : { cookie: `${anonymousSessionCookieName}=${input.cookie}` }),
      ...input?.headers,
    },
    method: "POST",
  });

describe("anonymous session route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the raw token only in an exact private __Host cookie after creation", async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const token = "a".repeat(43);
    harness.ensure.mockResolvedValue({
      context: {
        expiresAt,
        sessionId: "internal-session-id",
        subjectId: "internal-subject-id",
      },
      kind: "created",
      token,
    });

    const response = await POST(request());
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-csrf-token")).toBe(deriveSessionCsrfToken(token));
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(setCookie).toContain(`${anonymousSessionCookieName}=${token}`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=strict");
    expect(setCookie).toContain("Expires=");
    expect(setCookie).toContain("Max-Age=");
    expect(setCookie).not.toContain("Domain=");
    expect(setCookie).not.toContain("internal-session-id");
    expect(setCookie).not.toContain("internal-subject-id");
    expect(harness.ensure).toHaveBeenCalledWith({
      idempotencyKey,
      token: undefined,
    });
  });

  it("resumes from the HttpOnly cookie without rotating or extending it", async () => {
    const token = "b".repeat(43);
    harness.ensure.mockResolvedValue({
      context: {
        expiresAt: "2026-07-18T00:00:00.000Z",
        sessionId: "internal-session-id",
        subjectId: "internal-subject-id",
      },
      kind: "resumed",
    });

    const response = await POST(request({ cookie: token }));

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-csrf-token")).toBe(deriveSessionCsrfToken(token));
    expect(harness.ensure).toHaveBeenCalledWith({ idempotencyKey, token });
  });

  it.each([
    { headers: { origin: "https://foreign.example" }, label: "foreign origin" },
    { headers: { origin: "null" }, label: "null origin" },
    { headers: { origin: "" }, label: "missing origin" },
    { headers: { "sec-fetch-site": "cross-site" }, label: "cross-site fetch" },
    { headers: { "content-type": "application/json" }, label: "request body type" },
    { headers: { "content-length": "2" }, label: "request body length" },
    { headers: { "transfer-encoding": "chunked" }, label: "chunked body" },
  ])("rejects a $label before persistence", async ({ headers }) => {
    const response = await POST(request({ headers }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "REQUEST_ORIGIN_REJECTED",
      requestId: "req_11111111111111111111111111111111",
      status: 403,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(harness.ensure).not.toHaveBeenCalled();
  });

  it("reads and rejects an HTTP/2-style body even without body metadata headers", async () => {
    const bodyRequest = new NextRequest("https://example.test/api/v1/anonymous/session", {
      body: new Uint8Array([1]),
      headers: {
        "idempotency-key": idempotencyKey,
        origin: "https://example.test",
        "sec-fetch-site": "same-origin",
        "x-rituvia-correlation-id": "req_11111111111111111111111111111111",
      },
      method: "POST",
    });

    const response = await POST(bodyRequest);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: "REQUEST_BODY_INVALID", status: 400 });
    expect(harness.ensure).not.toHaveBeenCalled();
  });

  it.each(["", "short", "A".repeat(129), "private value with spaces"])(
    "rejects an invalid idempotency key without reflecting it: %s",
    async (value) => {
      const response = await POST(request({ headers: { "idempotency-key": value } }));
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(text).toContain("IDEMPOTENCY_KEY_INVALID");
      expect(text).not.toContain(value === "" ? "private-empty-canary" : value);
      expect(harness.ensure).not.toHaveBeenCalled();
    },
  );

  it("returns safe bounded retry information for the database capacity gate", async () => {
    harness.ensure.mockRejectedValue(new harness.SessionError("rate_limited", 17));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(body).toMatchObject({ code: "ANONYMOUS_SESSION_RATE_LIMITED", status: 429 });
  });

  it("does not reissue a bearer token for an idempotency replay without its cookie", async () => {
    harness.ensure.mockRejectedValue(new harness.SessionError("conflict"));

    const response = await POST(request());
    const text = await response.text();

    expect(response.status).toBe(409);
    expect(text).toContain("ANONYMOUS_SESSION_CONFLICT");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("suppresses unknown database errors, identifiers, cookies, and private canaries", async () => {
    const canary = "private-database-error-canary";
    harness.ensure.mockRejectedValue(new Error(canary));

    const response = await POST(request({ cookie: "c".repeat(43) }));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("ANONYMOUS_SESSION_UNAVAILABLE");
    expect(text).not.toContain(canary);
    expect(text).not.toContain("c".repeat(43));
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
