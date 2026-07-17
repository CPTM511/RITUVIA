import { parseTarotReadingCreateRequestV1 } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn() }));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/tarot-reading-runtime", () => ({
  createWebTarotReading: harness.create,
  getWebTarotReading: harness.get,
}));

import { GET } from "../app/api/v1/readings/[readingId]/route";
import {
  POST,
  tarotReadingApiPath,
  tarotReadingMaximumBodyBytes,
} from "../app/api/v1/readings/tarot/route";
import { tarotReadingResourceApiPath } from "../app/api/v1/readings/tarot/_http";
import { TarotReadingApplicationError } from "../server/tarot-reading";

const readingId = "33333333-3333-4333-8333-333333333333";
const idempotencyKey = "abcdefghijklmnopqrstuv";
const token = "a".repeat(43);
const requestBody = Object.freeze({
  locale: "en",
  readingType: "one_card",
  schemaVersion: "tarot-reading-create.v1",
  themeCode: "open_reflection",
});
const responseBody = Object.freeze({
  createdAt: "2026-07-17T12:00:00.000Z",
  facts: Object.freeze({
    positions: Object.freeze([
      Object.freeze({
        cardId: "the-star",
        order: 1,
        orientation: "upright",
        positionId: "perspective",
      }),
    ]),
  }),
  locale: "en",
  readingId,
  readingPolicyVersion: "test.tarot-reading.v1",
  readingType: "one_card",
  schemaVersion: "tarot-reading-response.v1",
  status: "facts_ready",
  themeCode: "open_reflection",
});

const postRequest = (
  body: BodyInit | null = JSON.stringify(requestBody),
  headers: Readonly<Record<string, string>> = {},
): NextRequest =>
  new NextRequest(`https://example.test${tarotReadingApiPath}`, {
    body,
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

const getRequest = (
  id: string = readingId,
  headers: Readonly<Record<string, string>> = {},
): NextRequest =>
  new NextRequest(`https://example.test${tarotReadingResourceApiPath}/${id}`, {
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "sec-fetch-site": "same-origin",
      "x-rituvia-correlation-id": "req_11111111111111111111111111111111",
      ...headers,
    },
    method: "GET",
  });

const getContext = (id: string = readingId) => ({ params: Promise.resolve({ readingId: id }) });

describe("tarot reading API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.create.mockImplementation(async (input: unknown) => {
      parseTarotReadingCreateRequestV1(input);
      return { kind: "created", response: responseBody };
    });
    harness.get.mockResolvedValue(responseBody);
  });

  it("creates and replays one private facts-only response with stable status codes", async () => {
    const created = await POST(postRequest());
    harness.create.mockResolvedValueOnce({ kind: "replayed", response: responseBody });
    const replayed = await POST(postRequest());

    expect(created.status).toBe(201);
    expect(replayed.status).toBe(200);
    expect(await created.json()).toEqual(responseBody);
    expect(await replayed.json()).toEqual(responseBody);
    expect(created.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(created.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(created.headers.get("access-control-allow-origin")).toBeNull();
    expect(harness.create).toHaveBeenCalledWith(requestBody, idempotencyKey, token);
  });

  it.each([
    [{ origin: "https://foreign.example" }, 403, "TAROT_READING_REQUEST_REJECTED"],
    [{ origin: "null" }, 403, "TAROT_READING_REQUEST_REJECTED"],
    [{ "sec-fetch-site": "cross-site" }, 403, "TAROT_READING_REQUEST_REJECTED"],
    [{ "content-type": "text/plain" }, 400, "TAROT_READING_BODY_INVALID"],
    [{ "content-type": "application/json; charset=utf-8" }, 400, "TAROT_READING_BODY_INVALID"],
    [{ "content-encoding": "gzip" }, 400, "TAROT_READING_BODY_INVALID"],
    [{ "transfer-encoding": "chunked" }, 400, "TAROT_READING_BODY_INVALID"],
    [{ "content-length": "unknown" }, 400, "TAROT_READING_BODY_INVALID"],
    [
      { "content-length": String(tarotReadingMaximumBodyBytes + 1) },
      413,
      "TAROT_READING_BODY_TOO_LARGE",
    ],
  ] as const)("rejects unsafe POST metadata %#", async (headers, status, code) => {
    const response = await POST(postRequest(undefined, headers));
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(text).toContain(code);
    expect(text).not.toContain("foreign.example");
    expect(harness.create).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "{",
    JSON.stringify({ ...requestBody, question: "private-question-canary" }),
    JSON.stringify({ ...requestBody, safeQuestion: "private-safe-canary" }),
    JSON.stringify({ ...requestBody, cardId: "the-star" }),
    JSON.stringify({ ...requestBody, orientation: "reversed" }),
  ])("rejects malformed or client-controlled execution input without reflection", async (body) => {
    const response = await POST(postRequest(body));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("TAROT_READING_BODY_INVALID");
    expect(text).not.toMatch(/private-question-canary|private-safe-canary|the-star|reversed/u);
  });

  it("bounds streamed bytes without trusting content length", async () => {
    const response = await POST(postRequest("x".repeat(tarotReadingMaximumBodyBytes + 1)));

    expect(response.status).toBe(413);
    expect(await response.text()).toContain("TAROT_READING_BODY_TOO_LARGE");
    expect(harness.create).not.toHaveBeenCalled();
  });

  it("rejects missing sessions and invalid idempotency keys without reflection", async () => {
    const noSession = await POST(postRequest(undefined, { cookie: "" }));
    const invalidKey = await POST(
      postRequest(undefined, { "idempotency-key": "private key canary" }),
    );
    const invalidText = await invalidKey.text();

    expect(noSession.status).toBe(401);
    expect(await noSession.text()).toContain("TAROT_READING_SESSION_REQUIRED");
    expect(invalidKey.status).toBe(400);
    expect(invalidText).toContain("IDEMPOTENCY_KEY_INVALID");
    expect(invalidText).not.toContain("private key canary");
    expect(harness.create).not.toHaveBeenCalled();
  });

  it.each([
    [new TarotReadingApplicationError("conflict"), 409, "TAROT_READING_CONFLICT"],
    [new TarotReadingApplicationError("limit_reached", 17), 429, "TAROT_READING_RATE_LIMITED"],
    [new TarotReadingApplicationError("session_required"), 401, "TAROT_READING_SESSION_REQUIRED"],
    [new TarotReadingApplicationError("unavailable"), 503, "TAROT_READING_UNAVAILABLE"],
    [new Error("private-internal-canary"), 503, "TAROT_READING_UNAVAILABLE"],
  ] as const)("maps application failures to redacted problems", async (error, status, code) => {
    harness.create.mockRejectedValue(error);
    const response = await POST(postRequest());
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toContain("private-internal-canary");
    if (status === 429) expect(response.headers.get("retry-after")).toBe("17");
  });

  it("returns an owner-scoped private reading and redacts unknown or cross-owner results", async () => {
    const found = await GET(getRequest(), getContext());
    harness.get.mockResolvedValueOnce(null);
    const unknown = await GET(getRequest(), getContext());
    harness.get.mockRejectedValueOnce(new TarotReadingApplicationError("session_required"));
    const crossOwner = await GET(getRequest(), getContext());

    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(responseBody);
    expect(unknown.status).toBe(404);
    expect(crossOwner.status).toBe(404);
    expect(await unknown.text()).toContain("TAROT_READING_NOT_FOUND");
    expect(await crossOwner.text()).toContain("TAROT_READING_NOT_FOUND");
    expect(harness.get).toHaveBeenCalledWith(readingId, token);
  });

  it("rejects invalid, cross-site, query, and cookie-less reads before persistence", async () => {
    const invalid = await GET(getRequest("not-a-reading"), getContext("not-a-reading"));
    const crossSite = await GET(
      getRequest(readingId, { "sec-fetch-site": "cross-site" }),
      getContext(),
    );
    const query = await GET(
      new NextRequest(
        `https://example.test${tarotReadingResourceApiPath}/${readingId}?private=canary`,
      ),
      getContext(),
    );
    const noCookie = await GET(
      new NextRequest(`https://example.test${tarotReadingResourceApiPath}/${readingId}`),
      getContext(),
    );

    for (const response of [invalid, crossSite, query, noCookie]) {
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("canary");
    }
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("keeps direct route invocation unavailable while the approved catalog is absent", async () => {
    vi.resetModules();
    vi.doUnmock("../server/tarot-reading-runtime");
    const runtimeModule = await import("../server/tarot-reading-runtime");

    await expect(
      runtimeModule.createWebTarotReading(requestBody, idempotencyKey, token),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});
