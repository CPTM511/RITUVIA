import { parseTarotReadingCreateRequestV1, parseTarotReadingReportRequest } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), report: vi.fn() }));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/tarot-reading-runtime", () => ({
  createWebTarotReading: harness.create,
  getWebTarotReading: harness.get,
  reportWebTarotReading: harness.report,
}));

import { GET } from "../app/api/v1/readings/[readingId]/route";
import { POST as POST_REPORT } from "../app/api/v1/readings/[readingId]/report/route";
import {
  POST,
  tarotReadingApiPath,
  tarotReadingMaximumBodyBytes,
} from "../app/api/v1/readings/tarot/route";
import { tarotReadingResourceApiPath } from "../app/api/v1/readings/tarot/_http";
import { TarotReadingApplicationError } from "../server/tarot-reading";
import {
  createTarotOneCardResponseFixture,
  createTarotThreeCardResponseFixture,
} from "./fixtures/tarot-reading-response";

const readingId = "33333333-3333-4333-8333-333333333333";
const interpretationRequestId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "abcdefghijklmnopqrstuv";
const token = "a".repeat(43);
const requestBody = Object.freeze({
  locale: "en",
  readingType: "one_card",
  schemaVersion: "tarot-reading-create.v1",
  themeCode: "open_reflection",
});
const responseBody = Object.freeze(createTarotOneCardResponseFixture());
const reportBody = Object.freeze({
  category: "factual",
  schemaVersion: "tarot-reading-report.v1",
  target: Object.freeze({ kind: "reading" }),
});
const interpretationReportBody = Object.freeze({
  category: "safety",
  schemaVersion: "tarot-reading-report.v2",
  target: Object.freeze({ interpretationRequestId, kind: "interpretation" }),
});
const reportCategories = Object.freeze([
  "factual",
  "cultural",
  "safety",
  "translation",
  "rights",
  "accessibility",
] as const);

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

const reportRequest = (
  body: BodyInit | null = JSON.stringify(reportBody),
  headers: Readonly<Record<string, string>> = {},
): NextRequest =>
  new NextRequest(`${getRequest().url}/report`, {
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

describe("tarot reading API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.create.mockImplementation(async (input: unknown) => {
      parseTarotReadingCreateRequestV1(input);
      return { kind: "created", response: responseBody };
    });
    harness.get.mockResolvedValue(responseBody);
    harness.report.mockImplementation(async (_readingId: string, input: unknown) => {
      parseTarotReadingReportRequest(input);
      return { kind: "created" };
    });
  });

  it("records one exact categorical report and returns an empty private 204", async () => {
    const response = await POST_REPORT(reportRequest(), getContext());

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("content-type")).toBeNull();
    expect(harness.report).toHaveBeenCalledWith(readingId, reportBody, idempotencyKey, token);
  });

  it.each(reportCategories)("accepts the bounded %s report category", async (category) => {
    const body = { ...reportBody, category };
    const response = await POST_REPORT(reportRequest(JSON.stringify(body)), getContext());

    expect(response.status).toBe(204);
    expect(harness.report).toHaveBeenCalledWith(readingId, body, idempotencyKey, token);
  });

  it("accepts one canonical position target without accepting free text", async () => {
    const body = {
      ...reportBody,
      target: { kind: "position", positionId: "situation" },
    } as const;
    const response = await POST_REPORT(reportRequest(JSON.stringify(body)), getContext());

    expect(response.status).toBe(204);
    expect(harness.report).toHaveBeenCalledWith(readingId, body, idempotencyKey, token);
  });

  it("accepts one exact interpretation target with the same empty private response", async () => {
    const response = await POST_REPORT(
      reportRequest(JSON.stringify(interpretationReportBody)),
      getContext(),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(harness.report).toHaveBeenCalledWith(
      readingId,
      interpretationReportBody,
      idempotencyKey,
      token,
    );
  });

  it.each([
    [{ origin: "https://foreign.example" }, 403, "TAROT_READING_REPORT_REQUEST_REJECTED"],
    [{ origin: "" }, 403, "TAROT_READING_REPORT_REQUEST_REJECTED"],
    [{ "sec-fetch-site": "cross-site" }, 403, "TAROT_READING_REPORT_REQUEST_REJECTED"],
    [{ "content-type": "text/plain" }, 400, "TAROT_READING_REPORT_BODY_INVALID"],
    [
      { "content-type": "application/json; charset=utf-8" },
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
    [{ "content-encoding": "gzip" }, 400, "TAROT_READING_REPORT_BODY_INVALID"],
    [{ "transfer-encoding": "chunked" }, 400, "TAROT_READING_REPORT_BODY_INVALID"],
    [{ "content-length": "unknown" }, 400, "TAROT_READING_REPORT_BODY_INVALID"],
    [
      { "content-length": String(tarotReadingMaximumBodyBytes + 1) },
      413,
      "TAROT_READING_REPORT_BODY_TOO_LARGE",
    ],
    [{ "idempotency-key": "private invalid key" }, 400, "IDEMPOTENCY_KEY_INVALID"],
    [{ cookie: "" }, 404, "TAROT_READING_NOT_FOUND"],
  ] as const)("rejects unsafe report metadata %#", async (headers, status, code) => {
    const response = await POST_REPORT(reportRequest(undefined, headers), getContext());
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toMatch(/foreign\.example|private invalid key/u);
    expect(harness.report).not.toHaveBeenCalled();
  });

  it.each([
    ["{", 400, "TAROT_READING_REPORT_BODY_INVALID"],
    [
      JSON.stringify({ ...reportBody, details: "private-report-canary" }),
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
    [
      JSON.stringify({ ...reportBody, category: "other" }),
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
    [
      JSON.stringify({ ...reportBody, target: { kind: "reading", note: "private-report-canary" } }),
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
    [
      JSON.stringify({ ...reportBody, target: { kind: "position", positionId: "Situation" } }),
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
    [
      JSON.stringify({
        ...interpretationReportBody,
        target: { interpretationRequestId: readingId, kind: "reading" },
      }),
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
    [
      JSON.stringify({
        ...interpretationReportBody,
        target: {
          interpretationRequestId,
          kind: "interpretation",
          note: "private-report-canary",
        },
      }),
      400,
      "TAROT_READING_REPORT_BODY_INVALID",
    ],
  ] as const)("rejects malformed or free-text report bodies", async (body, status, code) => {
    const response = await POST_REPORT(reportRequest(body), getContext());
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toContain("private-report-canary");
  });

  it("bounds streamed report bytes without trusting content length", async () => {
    const response = await POST_REPORT(
      reportRequest("x".repeat(tarotReadingMaximumBodyBytes + 1)),
      getContext(),
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toContain("TAROT_READING_REPORT_BODY_TOO_LARGE");
    expect(harness.report).not.toHaveBeenCalled();
  });

  it("makes a missing session indistinguishable from an owner-scoped missing reading", async () => {
    const noSession = await POST_REPORT(reportRequest(undefined, { cookie: "" }), getContext());
    harness.report.mockRejectedValueOnce(new TarotReadingApplicationError("not_found"));
    const notOwned = await POST_REPORT(reportRequest(), getContext());

    expect(noSession.status).toBe(404);
    expect(notOwned.status).toBe(404);
    expect(await noSession.text()).toBe(await notOwned.text());
  });

  it.each([
    ["not-a-reading", ""],
    [readingId, "?private=canary"],
  ] as const)(
    "rejects invalid report resource variants before service lookup",
    async (id, search) => {
      const unsafe = new NextRequest(
        `https://example.test${tarotReadingResourceApiPath}/${id}/report${search}`,
        {
          body: JSON.stringify(reportBody),
          headers: {
            cookie: `__Host-rituvia-anonymous-session=${token}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
            origin: "https://example.test",
          },
          method: "POST",
        },
      );
      const response = await POST_REPORT(unsafe, getContext(id));
      const text = await response.text();

      expect(response.status).toBe(404);
      expect(text).not.toContain("canary");
      expect(harness.report).not.toHaveBeenCalled();
    },
  );

  it.each([
    [new TarotReadingApplicationError("conflict"), 409, "TAROT_READING_REPORT_CONFLICT"],
    [new TarotReadingApplicationError("not_found"), 404, "TAROT_READING_NOT_FOUND"],
    [new TarotReadingApplicationError("unavailable"), 503, "TAROT_READING_REPORT_UNAVAILABLE"],
    [new Error("private-report-canary"), 503, "TAROT_READING_REPORT_UNAVAILABLE"],
  ] as const)("maps report failures to redacted problems", async (error, status, code) => {
    harness.report.mockRejectedValue(error);
    const response = await POST_REPORT(reportRequest(), getContext());
    const text = await response.text();

    expect(response.status).toBe(status);
    expect(text).toContain(code);
    expect(text).not.toContain("private-report-canary");
  });

  it("creates and replays one private presentation response with stable status codes", async () => {
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

  it("passes the exact theme-only three-card command to the shared application service", async () => {
    const threeCardRequest = { ...requestBody, readingType: "three_card" };
    const threeCardResponse = createTarotThreeCardResponseFixture();
    harness.create.mockResolvedValueOnce({ kind: "created", response: threeCardResponse });

    const response = await POST(postRequest(JSON.stringify(threeCardRequest)));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(threeCardResponse);
    expect(harness.create).toHaveBeenCalledWith(threeCardRequest, idempotencyKey, token);
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

  it.each([
    [1, "1"],
    [604_800, "604800"],
    [undefined, null],
    [0, null],
    [-1, null],
    [604_801, null],
    [1.5, null],
  ] as const)("bounds Retry-After response metadata for %s", async (seconds, expected) => {
    harness.create.mockRejectedValue(new TarotReadingApplicationError("limit_reached", seconds));
    const response = await POST(postRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe(expected);
  });

  it("returns an owner-scoped private reading and redacts unknown or cross-owner results", async () => {
    const found = await GET(getRequest(), getContext());
    harness.get.mockResolvedValueOnce(null);
    const unknown = await GET(getRequest(), getContext());
    harness.get.mockRejectedValueOnce(new TarotReadingApplicationError("not_found"));
    const expired = await GET(getRequest(), getContext());
    harness.get.mockRejectedValueOnce(new TarotReadingApplicationError("session_required"));
    const crossOwner = await GET(getRequest(), getContext());

    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(responseBody);
    expect(found.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(found.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(found.headers.get("access-control-allow-origin")).toBeNull();
    expect(unknown.status).toBe(404);
    expect(expired.status).toBe(404);
    expect(crossOwner.status).toBe(404);
    const unknownBody = await unknown.text();
    expect(unknownBody).toContain("TAROT_READING_NOT_FOUND");
    expect(await expired.text()).toBe(unknownBody);
    expect(await crossOwner.text()).toBe(unknownBody);
    expect(harness.get).toHaveBeenCalledWith(readingId, token);
  });

  it("restores an account-linked reading through the account session only", async () => {
    const response = await GET(
      getRequest(readingId, {
        cookie: `__Host-rituvia-account-session=${token}`,
      }),
      getContext(),
    );

    expect(response.status).toBe(200);
    expect(harness.get).toHaveBeenCalledWith(readingId, token, "account");
  });

  it("rejects invalid, cross-site, query, framework, and cookie-less reads before persistence", async () => {
    const invalid = await GET(getRequest("not-a-reading"), getContext("not-a-reading"));
    const crossSite = await GET(
      getRequest(readingId, { "sec-fetch-site": "cross-site" }),
      getContext(),
    );
    const crossOrigin = await GET(
      getRequest(readingId, { origin: "https://foreign.example" }),
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
    const frameworkHeaders = await Promise.all(
      [
        { rsc: "1" },
        { "next-router-prefetch": "1" },
        { "next-router-segment-prefetch": "1" },
        { "next-router-state-tree": "private-canary" },
        { accept: "text/x-component; charset=utf-8" },
      ].map((headers) => GET(getRequest(readingId, headers), getContext())),
    );
    const frameworkPaths = await Promise.all(
      [
        `${tarotReadingResourceApiPath}/${readingId}.rsc`,
        `${tarotReadingResourceApiPath}/${readingId}.segments/private-canary`,
      ].map((path) =>
        GET(
          new NextRequest(`https://example.test${path}`, {
            headers: { cookie: `__Host-rituvia-anonymous-session=${token}` },
          }),
          getContext(),
        ),
      ),
    );

    for (const response of [
      invalid,
      crossSite,
      crossOrigin,
      query,
      noCookie,
      ...frameworkHeaders,
      ...frameworkPaths,
    ]) {
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("canary");
    }
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("maps a damaged or unavailable saved reading to one private 503", async () => {
    harness.get.mockRejectedValueOnce(new TarotReadingApplicationError("unavailable"));

    const response = await GET(getRequest(), getContext());

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("TAROT_READING_UNAVAILABLE");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it("keeps direct create, read, and report invocation unavailable while activation is absent", async () => {
    vi.resetModules();
    vi.doUnmock("../server/tarot-reading-runtime");
    const runtimeModule = await import("../server/tarot-reading-runtime");

    await expect(
      runtimeModule.createWebTarotReading(requestBody, idempotencyKey, token),
    ).rejects.toMatchObject({ code: "unavailable" });
    await expect(runtimeModule.getWebTarotReading(readingId, token)).rejects.toMatchObject({
      code: "unavailable",
    });
    await expect(
      runtimeModule.reportWebTarotReading(readingId, reportBody, idempotencyKey, token),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});
