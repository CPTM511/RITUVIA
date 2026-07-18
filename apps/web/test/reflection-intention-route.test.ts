import { parseReflectionIntentionCreateRequestV1 } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class ApplicationError extends Error {
    readonly code: "conflict" | "daily_limit" | "not_found" | "session_required" | "unavailable";
    readonly retryAfterSeconds: number | undefined;

    constructor(
      code: "conflict" | "daily_limit" | "not_found" | "session_required" | "unavailable",
      retryAfterSeconds?: number,
    ) {
      super("synthetic reflection error");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { ApplicationError, create: vi.fn(), get: vi.fn(), merge: vi.fn() };
});

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
  mergeWebAnonymousSubject: harness.merge,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

vi.mock("../server/reflection-loop", () => ({
  createWebIntention: harness.create,
  getWebIntention: harness.get,
  ReflectionLoopApplicationError: harness.ApplicationError,
}));

import { GET } from "../app/api/v1/intentions/[intentionId]/route";
import { intentionApiPath, POST } from "../app/api/v1/intentions/route";

const token = "a".repeat(43);
const accountToken = "d".repeat(43);
const idempotencyKey = "abcdefghijklmnopqrstuv";
const readingId = "11111111-1111-4111-8111-111111111111";
const intentionId = "22222222-2222-4222-8222-222222222222";
const body = Object.freeze({
  intentionCode: "calm_clarity",
  locale: "en",
  readingId,
  schemaVersion: "reflection-intention.v1",
  smallAction: "Take one private small step.",
});
const resource = Object.freeze({
  createdAt: "2026-07-18T00:00:00.000Z",
  expiresAt: "2026-08-18T00:00:00.000Z",
  id: intentionId,
  intentionCode: "calm_clarity",
  locale: "en",
  policyVersion: "reflection-loop.en.v1",
  readingId,
  schemaVersion: "reflection-intention.v1",
  smallAction: "Take one private small step.",
});

const post = (
  rawBody: BodyInit | null = JSON.stringify(body),
  headers: Readonly<Record<string, string>> = {},
) =>
  new NextRequest(`https://example.test${intentionApiPath}`, {
    body: rawBody,
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-rituvia-correlation-id": "req_11111111111111111111111111111111",
      ...headers,
    },
    method: "POST",
  });

const get = (headers: Readonly<Record<string, string>> = {}) =>
  new NextRequest(`https://example.test${intentionApiPath}/${intentionId}`, {
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "sec-fetch-site": "same-origin",
      "x-rituvia-correlation-id": "req_11111111111111111111111111111111",
      ...headers,
    },
  });

const context = (id = intentionId) => ({ params: Promise.resolve({ intentionId: id }) });

describe("reflection intention API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.create.mockImplementation(async (input: unknown) => {
      parseReflectionIntentionCreateRequestV1(input);
      return { kind: "created", resource };
    });
    harness.get.mockResolvedValue(resource);
    harness.merge.mockResolvedValue("created");
  });

  it("creates an owner-bound encrypted intention contract without accepting a subject ID", async () => {
    const response = await POST(post());
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(responseBody).toEqual(resource);
    expect(JSON.stringify(responseBody)).not.toMatch(/anonymousSubjectId|idempotency|canonical/iu);
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, token);
  });

  it("returns the same private representation with 200 for an idempotent replay", async () => {
    harness.create.mockResolvedValueOnce({ kind: "replayed", resource });
    const response = await POST(post());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
  });

  it("reads only through the HttpOnly session token and never a client subject ID", async () => {
    const response = await GET(get(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
    expect(harness.get).toHaveBeenCalledWith(intentionId, token);
  });

  it("uses the account cookie after anonymous-to-account merge without a client user ID", async () => {
    const accountOnlyHeaders = {
      cookie: `__Host-rituvia-account-session=${accountToken}`,
    };
    const created = await POST(post(JSON.stringify(body), accountOnlyHeaders));
    const read = await GET(get(accountOnlyHeaders), context());

    expect(created.status).toBe(201);
    expect(read.status).toBe(200);
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, undefined, accountToken);
    expect(harness.get).toHaveBeenCalledWith(intentionId, undefined, accountToken);
  });

  it("links a post-login anonymous reading before creating the account-owned intention", async () => {
    const bothCookies = {
      cookie: `__Host-rituvia-account-session=${accountToken}; __Host-rituvia-anonymous-session=${token}`,
    };
    const response = await POST(post(JSON.stringify(body), bothCookies));
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(201);
    expect(harness.merge).toHaveBeenCalledWith({
      accountSessionToken: accountToken,
      anonymousSessionToken: token,
      idempotencyKey: `reflection_link_${token}`,
    });
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, token, accountToken);
    expect(cookie).toContain("__Host-rituvia-anonymous-session=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("fails closed without creating an intention when post-login ownership linking fails", async () => {
    harness.merge.mockRejectedValueOnce(new Error("synthetic merge outage"));
    const response = await POST(
      post(JSON.stringify(body), {
        cookie: `__Host-rituvia-account-session=${accountToken}; __Host-rituvia-anonymous-session=${token}`,
      }),
    );

    expect(response.status).toBe(503);
    expect(harness.create).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).not.toContain("synthetic merge outage");
  });

  it.each([
    [{ origin: "https://foreign.example" }, 403, "REFLECTION_REQUEST_REJECTED"],
    [{ "sec-fetch-site": "cross-site" }, 403, "REFLECTION_REQUEST_REJECTED"],
    [{ "content-type": "text/plain" }, 400, "REFLECTION_BODY_INVALID"],
    [{ "content-type": "application/json; charset=utf-8" }, 400, "REFLECTION_BODY_INVALID"],
    [{ "content-encoding": "gzip" }, 400, "REFLECTION_BODY_INVALID"],
    [{ "idempotency-key": "private invalid key" }, 400, "REFLECTION_IDEMPOTENCY_KEY_INVALID"],
    [{ cookie: "" }, 401, "REFLECTION_SESSION_REQUIRED"],
  ] as const)("rejects unsafe create metadata %#", async (headers, status, code) => {
    const response = await POST(post(undefined, headers));
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toContain("private invalid key");
    expect(harness.create).not.toHaveBeenCalled();
  });

  it.each([
    "{",
    JSON.stringify({ ...body, anonymousSubjectId: "private-subject-canary" }),
    JSON.stringify({ ...body, smallAction: "x".repeat(281) }),
  ])("rejects malformed or authority-bearing bodies without reflection", async (rawBody) => {
    const response = await POST(post(rawBody));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("REFLECTION_BODY_INVALID");
    expect(text).not.toContain("private-subject-canary");
  });

  it("makes a missing cookie indistinguishable from a missing or cross-owner intention", async () => {
    const noCookie = await GET(get({ cookie: "" }), context());
    harness.get.mockResolvedValueOnce(null);
    const missing = await GET(get(), context());

    expect(noCookie.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await noCookie.text()).toBe(await missing.text());
  });

  it("suppresses persistence failures, cookie values, and private text", async () => {
    const canary = "private-intention-error-canary";
    harness.create.mockRejectedValueOnce(new Error(canary));
    const response = await POST(post());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("REFLECTION_UNAVAILABLE");
    expect(text).not.toContain(canary);
    expect(text).not.toContain(token);
    expect(text).not.toContain(body.smallAction);
  });
});
