import { parseReflectionRitualCreateRequestV1 } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class ApplicationError extends Error {
    readonly code:
      | "conflict"
      | "daily_limit"
      | "entitlement_required"
      | "not_found"
      | "session_required"
      | "unavailable";
    readonly retryAfterSeconds: number | undefined;
    constructor(
      code:
        | "conflict"
        | "daily_limit"
        | "entitlement_required"
        | "not_found"
        | "session_required"
        | "unavailable",
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
  createWebRitualSession: harness.create,
  getWebRitualSession: harness.get,
  ReflectionLoopApplicationError: harness.ApplicationError,
}));

import { GET } from "../app/api/v1/ritual-sessions/[ritualSessionId]/route";
import { POST, ritualSessionApiPath } from "../app/api/v1/ritual-sessions/route";

const token = "b".repeat(43);
const accountToken = "c".repeat(43);
const idempotencyKey = "bcdefghijklmnopqrstuvw";
const intentionId = "22222222-2222-4222-8222-222222222222";
const ritualSessionId = "33333333-3333-4333-8333-333333333333";
const body = Object.freeze({
  intentionId,
  objectCode: "candle",
  schemaVersion: "reflection-ritual.v1",
});
const resource = Object.freeze({
  completedAt: "2026-07-18T00:05:00.000Z",
  expiresAt: "2026-08-18T00:00:00.000Z",
  id: ritualSessionId,
  intentionId,
  objectCode: "candle",
  policyVersion: "reflection-loop.en.v1",
  ritualDateUtc: "2026-07-18",
  schemaVersion: "reflection-ritual.v1",
});

const post = (
  rawBody: BodyInit | null = JSON.stringify(body),
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://example.test${ritualSessionApiPath}`, {
    body: rawBody,
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    method: "POST",
  });
const get = (headers: Record<string, string> = {}) =>
  new NextRequest(`https://example.test${ritualSessionApiPath}/${ritualSessionId}`, {
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
const context = (id = ritualSessionId) => ({ params: Promise.resolve({ ritualSessionId: id }) });

describe("free ritual session API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.create.mockImplementation(async (input: unknown) => {
      parseReflectionRitualCreateRequestV1(input);
      return { kind: "created", resource };
    });
    harness.get.mockResolvedValue(resource);
    harness.merge.mockResolvedValue("created");
  });

  it.each(["candle", "incense"] as const)(
    "creates the always-free %s ritual without payment or efficacy fields",
    async (objectCode) => {
      const requestBody = { ...body, objectCode };
      const expected = { ...resource, objectCode };
      harness.create.mockResolvedValueOnce({ kind: "created", resource: expected });
      const response = await POST(post(JSON.stringify(requestBody)));

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(expected);
      expect(harness.create).toHaveBeenCalledWith(requestBody, idempotencyKey, token);
      expect(JSON.stringify(expected)).not.toMatch(/price|payment|entitlement|efficacy|streak/iu);
    },
  );

  it("reads an owner-bound completed ritual with private no-store headers", async () => {
    const response = await GET(get(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual(resource);
    expect(harness.get).toHaveBeenCalledWith(ritualSessionId, token);
  });

  it("passes only server cookies to the paid-object entitlement gate", async () => {
    const paidBody = { ...body, objectCode: "mindful_incense" };
    harness.create.mockRejectedValueOnce(new harness.ApplicationError("entitlement_required"));
    const response = await POST(
      post(JSON.stringify(paidBody), {
        cookie: `__Host-rituvia-anonymous-session=${token}; __Host-rituvia-account-session=${accountToken}`,
      }),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      code: "REFLECTION_ENTITLEMENT_REQUIRED",
    });
    expect(harness.create).toHaveBeenCalledWith(paidBody, idempotencyKey, token, accountToken);
    expect(harness.merge).toHaveBeenCalledWith({
      accountSessionToken: accountToken,
      anonymousSessionToken: token,
      idempotencyKey: `reflection_link_${token}`,
    });
  });

  it("allows an account-only principal without reviving the anonymous token", async () => {
    const response = await POST(
      post(JSON.stringify(body), {
        cookie: `__Host-rituvia-account-session=${accountToken}`,
      }),
    );

    expect(response.status).toBe(201);
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, undefined, accountToken);
    expect(harness.merge).not.toHaveBeenCalled();
  });

  it("enforces one free ritual per UTC day with a bounded calm retry", async () => {
    harness.create.mockRejectedValueOnce(new harness.ApplicationError("daily_limit", 3_600));
    const response = await POST(post());
    const text = await response.text();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(text).toContain("REFLECTION_DAILY_LIMIT");
    expect(text).not.toMatch(/streak|punish|lose|upgrade|buy/iu);
  });

  it.each([
    JSON.stringify({ ...body, objectCode: "premium_candle" }),
    JSON.stringify({ ...body, price: 99 }),
    JSON.stringify({ ...body, anonymousSubjectId: "private-subject-canary" }),
  ])("rejects non-free or authority-bearing ritual bodies", async (rawBody) => {
    const response = await POST(post(rawBody));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("REFLECTION_BODY_INVALID");
    expect(text).not.toContain("private-subject-canary");
  });

  it("rejects cross-site creation before the application service", async () => {
    const response = await POST(post(undefined, { origin: "https://foreign.example" }));

    expect(response.status).toBe(403);
    expect(harness.create).not.toHaveBeenCalled();
  });

  it("returns the same private 404 for no cookie, cross-owner, and malformed IDs", async () => {
    const noCookie = await GET(get({ cookie: "" }), context());
    harness.get.mockResolvedValueOnce(null);
    const crossOwner = await GET(get(), context());
    const malformed = await GET(
      new NextRequest(`https://example.test${ritualSessionApiPath}/unsafe`, {
        headers: { cookie: `__Host-rituvia-anonymous-session=${token}` },
      }),
      context("unsafe"),
    );

    expect(noCookie.status).toBe(404);
    const crossOwnerBody = await crossOwner.text();
    expect(await noCookie.text()).toBe(crossOwnerBody);
    expect(malformed.status).toBe(404);
    await expect(malformed.json()).resolves.toMatchObject({ code: "REFLECTION_NOT_FOUND" });
  });
});
