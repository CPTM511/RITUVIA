import { parseReflectionIntentionCreateRequestV1 } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

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
  return {
    ApplicationError,
    create: vi.fn(),
    get: vi.fn(),
    mutate: vi.fn(),
  };
});

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

vi.mock("../server/reflection-loop", () => ({
  createWebIntention: harness.create,
  getWebIntention: harness.get,
  mutateWebIntention: harness.mutate,
  ReflectionLoopApplicationError: harness.ApplicationError,
}));

import { DELETE, GET, PATCH } from "../app/api/v1/intentions/[intentionId]/route";
import { intentionApiPath, POST } from "../app/api/v1/intentions/route";

const token = "a".repeat(43);
const accountToken = "d".repeat(43);
const idempotencyKey = "abcdefghijklmnopqrstuv";
const csrfToken = deriveSessionCsrfToken(token);
const accountCsrfToken = deriveSessionCsrfToken(accountToken);
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
const v2Resource = Object.freeze({
  createdAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-08-24T00:00:00.000Z",
  id: intentionId,
  intentionCode: "calm_clarity",
  intentionText: "I intend to pause before I respond.",
  locale: "en",
  policyVersion: "reflection-loop.en.v1",
  privacyState: "private",
  readingId,
  reminderPreference: "none",
  revisitDate: "2026-08-01",
  revision: 2,
  schemaVersion: "reflection-intention.v2",
  smallAction: "Take one private small step.",
  status: "active",
  timeZone: "Asia/Shanghai",
  updatedAt: "2026-07-24T01:00:00.000Z",
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
      "x-csrf-token": csrfToken,
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

const patch = (rawBody: BodyInit | null, headers: Readonly<Record<string, string>> = {}) =>
  new NextRequest(`https://example.test${intentionApiPath}/${intentionId}`, {
    body: rawBody,
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": csrfToken,
      ...headers,
    },
    method: "PATCH",
  });

const remove = (headers: Readonly<Record<string, string>> = {}) =>
  new NextRequest(`https://example.test${intentionApiPath}/${intentionId}`, {
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "idempotency-key": idempotencyKey,
      "if-match": '"revision-2"',
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": csrfToken,
      ...headers,
    },
    method: "DELETE",
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
    harness.mutate.mockResolvedValue({ kind: "mutated", resource: v2Resource });
  });

  it("creates an owner-bound encrypted intention contract without accepting a subject ID", async () => {
    const response = await POST(post());
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-csrf-token")).toBe(csrfToken);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(responseBody).toEqual(resource);
    expect(JSON.stringify(responseBody)).not.toMatch(/anonymousSubjectId|idempotency|canonical/iu);
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, token);
  });

  it("returns the same private representation with 200 for an idempotent replay", async () => {
    harness.create.mockResolvedValueOnce({ kind: "replayed", resource });
    const response = await POST(post());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-csrf-token")).toBe(csrfToken);
    expect(await response.json()).toEqual(resource);
  });

  it("reads only through the HttpOnly session token and never a client subject ID", async () => {
    const response = await GET(get(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
    expect(harness.get).toHaveBeenCalledWith(intentionId, token);
  });

  it("updates an owner-scoped v2 intention with a strict optimistic mutation", async () => {
    const mutation = {
      action: "edit",
      expectedRevision: 1,
      intentionCode: "calm_clarity",
      intentionText: "I intend to pause before I respond.",
      privacyState: "private",
      reminderPreference: "none",
      revisitDate: "2026-08-01",
      schemaVersion: "reflection-intention-mutation.v1",
      smallAction: "Take one private small step.",
      timeZone: "Asia/Shanghai",
    };
    const response = await PATCH(patch(JSON.stringify(mutation)), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(v2Resource);
    expect(harness.mutate).toHaveBeenCalledWith(intentionId, mutation, idempotencyKey, token);
  });

  it("soft deletes without returning a private representation", async () => {
    harness.mutate.mockResolvedValueOnce({ kind: "mutated", resource: null });
    const response = await DELETE(remove(), context());

    expect(response.status).toBe(204);
    expect(response.headers.get("x-csrf-token")).toBe(csrfToken);
    expect(await response.text()).toBe("");
    expect(harness.mutate).toHaveBeenCalledWith(
      intentionId,
      {
        action: "delete",
        expectedRevision: 2,
        schemaVersion: "reflection-intention-mutation.v1",
      },
      idempotencyKey,
      token,
    );
  });

  it.each([
    [patch("{}", { origin: "https://foreign.example" }), PATCH, 403],
    [patch("{}", { "x-csrf-token": "" }), PATCH, 403],
    [patch("{}", { cookie: "" }), PATCH, 404],
    [remove({ "if-match": '"revision-0"' }), DELETE, 400],
    [remove({ "if-match": "2" }), DELETE, 400],
  ] as const)("rejects unsafe mutation metadata", async (request, handler, status) => {
    const response = await handler(request, context());

    expect(response.status).toBe(status);
    expect(harness.mutate).not.toHaveBeenCalled();
  });

  it("uses the account cookie after anonymous-to-account merge without a client user ID", async () => {
    const accountOnlyHeaders = {
      cookie: `__Host-rituvia-account-session=${accountToken}`,
      "x-csrf-token": accountCsrfToken,
    };
    const created = await POST(post(JSON.stringify(body), accountOnlyHeaders));
    const read = await GET(get(accountOnlyHeaders), context());

    expect(created.status).toBe(201);
    expect(created.headers.get("x-csrf-token")).toBe(accountCsrfToken);
    expect(read.status).toBe(200);
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, undefined, accountToken);
    expect(harness.get).toHaveBeenCalledWith(intentionId, undefined, accountToken);
  });

  it("requires the dedicated account merge before creating with both private cookies", async () => {
    const bothCookies = {
      cookie: `__Host-rituvia-account-session=${accountToken}; __Host-rituvia-anonymous-session=${token}`,
    };
    const response = await POST(post(JSON.stringify(body), bothCookies));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "REFLECTION_CONFLICT", status: 409 }),
    );
    expect(harness.create).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("requires the dedicated account merge before mutating with both private cookies", async () => {
    const response = await PATCH(
      patch("{}", {
        cookie: `__Host-rituvia-account-session=${accountToken}; __Host-rituvia-anonymous-session=${token}`,
      }),
      context(),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "REFLECTION_CONFLICT", status: 409 }),
    );
    expect(harness.mutate).not.toHaveBeenCalled();
  });

  it.each([
    [{ origin: "https://foreign.example" }, 403, "REFLECTION_REQUEST_REJECTED"],
    [{ "sec-fetch-site": "cross-site" }, 403, "REFLECTION_REQUEST_REJECTED"],
    [{ "x-csrf-token": "" }, 403, "REFLECTION_REQUEST_REJECTED"],
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
