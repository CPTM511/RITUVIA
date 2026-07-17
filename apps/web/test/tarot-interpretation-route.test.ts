import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type RuntimeErrorCode =
    "conflict" | "not_found" | "permission_denied" | "rate_limited" | "unavailable";

  class RuntimeError extends Error {
    readonly code: RuntimeErrorCode;

    constructor(code: RuntimeErrorCode) {
      super("private-runtime-error-canary");
      this.code = code;
    }
  }

  return { get: vi.fn(), RuntimeError, start: vi.fn() };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/interpretation-runtime", () => ({
  getWebTarotInterpretation: harness.get,
  startWebTarotInterpretation: harness.start,
  WebInterpretationRuntimeError: harness.RuntimeError,
}));

import {
  tarotInterpretationResponseSchemaVersion,
  type TarotInterpretationOutputProjectionV1,
  type TarotInterpretationResponseV1,
} from "../app/_contracts/tarot-interpretation-response";
import { GET, POST } from "../app/api/v1/readings/[readingId]/interpretation/route";
import {
  tarotInterpretationApiPath,
  tarotReadingResourceApiPath,
  tarotReadingSessionCookieName,
} from "../app/api/v1/readings/tarot/_http";

const readingId = "33333333-3333-4333-8333-333333333333";
const otherReadingId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "abcdefghijklmnopqrstuv";
const token = "a".repeat(43);
const requestId = "req_11111111111111111111111111111111";

const output = Object.freeze({
  boundaryNote: "This is a reflective possibility, not a prediction.",
  perspectives: Object.freeze(["Notice what feels useful right now."]),
  reflectionQuestions: Object.freeze(["What small choice remains yours?"]),
  ritualSuggestion: Object.freeze({ reason: "A quiet pause can support reflection." }),
  smallAction: Object.freeze({
    label: "Write one sentence.",
    rationale: "A small note keeps the reflection grounded.",
    timeHorizon: "today" as const,
  }),
  summary: "A bounded synthetic interpretation.",
  symbols: Object.freeze([
    Object.freeze({
      limitation: "Keep the symbol open to your own context.",
      meaning: "A grounded meaning.",
      possibility: "You might pause before choosing.",
    }),
  ]),
  title: "A reflective pause",
}) satisfies TarotInterpretationOutputProjectionV1;

const verifiedResponse = Object.freeze({
  displayable: true,
  output,
  readingId,
  schemaVersion: tarotInterpretationResponseSchemaVersion,
  status: "verified",
}) satisfies TarotInterpretationResponseV1;

const fallbackResponse = Object.freeze({
  displayable: true,
  output,
  readingId,
  schemaVersion: tarotInterpretationResponseSchemaVersion,
  status: "reviewed_fallback",
}) satisfies TarotInterpretationResponseV1;

const processingResponse = Object.freeze({
  displayable: false,
  pollAfterMs: 1_500,
  readingId,
  schemaVersion: tarotInterpretationResponseSchemaVersion,
  status: "processing",
}) satisfies TarotInterpretationResponseV1;

const failedResponse = Object.freeze({
  displayable: false,
  readingId,
  schemaVersion: tarotInterpretationResponseSchemaVersion,
  status: "failed",
}) satisfies TarotInterpretationResponseV1;

type RequestOptions = Readonly<{
  body?: BodyInit | null;
  headers?: Readonly<Record<string, string | null>>;
  path?: string;
  query?: string;
}>;

const requestHeaders = (overrides: Readonly<Record<string, string | null>> = {}): Headers => {
  const headers = new Headers({
    cookie: `${tarotReadingSessionCookieName}=${token}`,
    origin: "https://example.test",
    "sec-fetch-site": "same-origin",
    "x-rituvia-correlation-id": requestId,
  });
  for (const [name, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return headers;
};

const postRequest = (options: RequestOptions = {}): NextRequest =>
  new NextRequest(
    `https://example.test${options.path ?? tarotInterpretationApiPath(readingId)}${options.query ?? ""}`,
    {
      body: options.body ?? null,
      headers: requestHeaders({ "idempotency-key": idempotencyKey, ...options.headers }),
      method: "POST",
    },
  );

const getRequest = (options: Omit<RequestOptions, "body"> = {}): NextRequest =>
  new NextRequest(
    `https://example.test${options.path ?? tarotInterpretationApiPath(readingId)}${options.query ?? ""}`,
    {
      headers: requestHeaders(options.headers),
      method: "GET",
    },
  );

const context = (id: string = readingId) => ({ params: Promise.resolve({ readingId: id }) });

const expectPrivateResponse = (response: Response): void => {
  expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
};

describe("tarot interpretation API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.start.mockResolvedValue(verifiedResponse);
    harness.get.mockResolvedValue(verifiedResponse);
  });

  it.each([
    ["POST", "final", verifiedResponse, 200, null],
    ["POST", "processing", processingResponse, 202, "2"],
    ["POST", "fallback", fallbackResponse, 200, null],
    ["POST", "failed", failedResponse, 200, null],
    ["GET", "final", verifiedResponse, 200, null],
    ["GET", "processing", processingResponse, 202, "2"],
    ["GET", "fallback", fallbackResponse, 200, null],
    ["GET", "failed", failedResponse, 200, null],
  ] as const)(
    "returns one private %s %s response",
    async (method, _state, runtimeResponse, expectedStatus, retryAfter) => {
      const runtime = method === "POST" ? harness.start : harness.get;
      runtime.mockResolvedValueOnce(runtimeResponse);

      const response =
        method === "POST"
          ? await POST(postRequest(), context())
          : await GET(getRequest(), context());

      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toEqual(runtimeResponse);
      expect(response.headers.get("retry-after")).toBe(retryAfter);
      expectPrivateResponse(response);
      if (method === "POST") {
        expect(harness.start).toHaveBeenCalledWith(readingId, idempotencyKey, token);
        expect(harness.get).not.toHaveBeenCalled();
      } else {
        expect(harness.get).toHaveBeenCalledWith(readingId, token);
        expect(harness.start).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    ["foreign origin", { origin: "https://foreign.example" }, null],
    ["missing origin", { origin: null }, null],
    ["null origin", { origin: "null" }, null],
    ["cross-site fetch", { "sec-fetch-site": "cross-site" }, null],
    ["content type", { "content-type": "application/json" }, null],
    ["content encoding", { "content-encoding": "gzip" }, null],
    ["non-zero content length", { "content-length": "1" }, null],
    ["chunked transfer", { "transfer-encoding": "chunked" }, null],
    ["body without metadata", {}, new Uint8Array([1])],
  ] as const)("rejects POST %s before starting work", async (_label, headers, body) => {
    const response = await POST(postRequest({ body, headers }), context());
    const text = await response.text();

    expect(response.status).toBe(403);
    expect(text).toContain("TAROT_INTERPRETATION_REQUEST_REJECTED");
    expect(text).not.toContain("foreign.example");
    expectPrivateResponse(response);
    expect(harness.start).not.toHaveBeenCalled();
  });

  it.each([null, "", "short", "private key canary", "A".repeat(129)])(
    "rejects an invalid idempotency key without reflection: %s",
    async (key) => {
      const response = await POST(postRequest({ headers: { "idempotency-key": key } }), context());
      const text = await response.text();

      expect(response.status).toBe(400);
      expect(text).toContain("IDEMPOTENCY_KEY_INVALID");
      expect(text).not.toContain("private key canary");
      expectPrivateResponse(response);
      expect(harness.start).not.toHaveBeenCalled();
    },
  );

  it("accepts the UUID idempotency form and forwards the HttpOnly session value", async () => {
    const uuidKey = "55555555-5555-4555-8555-555555555555";

    const response = await POST(
      postRequest({ headers: { "idempotency-key": uuidKey } }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(harness.start).toHaveBeenCalledWith(readingId, uuidKey, token);
  });

  it("redacts cookie-less, invalid UUID, query, and path-confused resources", async () => {
    const responses = await Promise.all([
      POST(postRequest({ headers: { cookie: null } }), context()),
      GET(getRequest({ headers: { cookie: null } }), context()),
      POST(postRequest(), context("not-a-reading")),
      GET(getRequest(), context("not-a-reading")),
      POST(postRequest({ query: "?private=canary" }), context()),
      GET(getRequest({ query: "?private=canary" }), context()),
      POST(postRequest({ path: tarotInterpretationApiPath(otherReadingId) }), context(readingId)),
      GET(getRequest({ path: `${tarotReadingResourceApiPath}/${readingId}` }), context()),
    ]);

    for (const response of responses) {
      const text = await response.text();
      expect(response.status).toBe(404);
      expect(text).toContain("TAROT_READING_NOT_FOUND");
      expect(text).not.toMatch(/canary|not-a-reading/u);
      expectPrivateResponse(response);
    }
    expect(harness.start).not.toHaveBeenCalled();
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("rejects foreign, framework, and body-bearing private reads as one redacted 404", async () => {
    const requests = [
      getRequest({ headers: { origin: "https://foreign.example" } }),
      getRequest({ headers: { "sec-fetch-site": "cross-site" } }),
      getRequest({ headers: { "content-type": "application/json" } }),
      getRequest({ headers: { "content-length": "1" } }),
      getRequest({ headers: { rsc: "1" } }),
      getRequest({ headers: { "next-router-prefetch": "1" } }),
      getRequest({ headers: { "next-router-segment-prefetch": "1" } }),
      getRequest({ headers: { "next-router-state-tree": "private-framework-canary" } }),
      getRequest({ headers: { accept: "text/x-component; charset=utf-8" } }),
      getRequest({ path: `${tarotInterpretationApiPath(readingId)}.rsc` }),
      getRequest({ path: `${tarotInterpretationApiPath(readingId)}.segments/private-canary` }),
      new NextRequest(`https://example.test${tarotInterpretationApiPath(readingId)}`, {
        body: new Uint8Array([1]),
        headers: requestHeaders(),
        method: "POST",
      }),
    ];

    for (const request of requests) {
      const response = await GET(request, context());
      const text = await response.text();
      expect(response.status).toBe(404);
      expect(text).toContain("TAROT_READING_NOT_FOUND");
      expect(text).not.toMatch(/foreign|framework|canary/u);
      expectPrivateResponse(response);
    }
    expect(harness.get).not.toHaveBeenCalled();
  });

  it.each([
    [new harness.RuntimeError("not_found"), 404, "TAROT_READING_NOT_FOUND", null],
    [new harness.RuntimeError("conflict"), 409, "TAROT_INTERPRETATION_CONFLICT", null],
    [
      new harness.RuntimeError("permission_denied"),
      403,
      "TAROT_INTERPRETATION_PERMISSION_DENIED",
      null,
    ],
    [new harness.RuntimeError("rate_limited"), 429, "TAROT_INTERPRETATION_RATE_LIMITED", "30"],
    [new harness.RuntimeError("unavailable"), 503, "TAROT_INTERPRETATION_UNAVAILABLE", null],
    [new Error("private-runtime-error-canary"), 503, "TAROT_INTERPRETATION_UNAVAILABLE", null],
  ] as const)(
    "maps one redacted runtime failure to %i %s",
    async (error, expectedStatus, code, retryAfter) => {
      harness.start.mockRejectedValueOnce(error);

      const response = await POST(postRequest(), context());
      const text = await response.text();

      expect(response.status).toBe(expectedStatus);
      expect(response.headers.get("retry-after")).toBe(retryAfter);
      expect(text).toContain(code);
      expect(text).not.toContain("private-runtime-error-canary");
      expect(text).not.toContain(token);
      expect(text).not.toContain(idempotencyKey);
      expectPrivateResponse(response);
    },
  );

  it("makes a runtime not-found indistinguishable from a cookie-less private read", async () => {
    harness.get.mockRejectedValueOnce(new harness.RuntimeError("not_found"));

    const runtimeNotFound = await GET(getRequest(), context());
    const cookieLess = await GET(getRequest({ headers: { cookie: null } }), context());

    expect(runtimeNotFound.status).toBe(404);
    expect(await runtimeNotFound.text()).toBe(await cookieLess.text());
  });

  it.each([
    [
      "POST root metadata",
      {
        ...verifiedResponse,
        provider: "private-provider-canary",
      },
    ],
    [
      "GET nested fact metadata",
      {
        ...verifiedResponse,
        output: {
          ...output,
          symbols: [{ ...output.symbols[0], factRef: "private-fact-canary" }],
        },
      },
    ],
  ] as const)("fails closed for an invalid private DTO from %s", async (label, invalidDto) => {
    const usePost = label.startsWith("POST");
    (usePost ? harness.start : harness.get).mockResolvedValueOnce(invalidDto);

    const response = usePost
      ? await POST(postRequest(), context())
      : await GET(getRequest(), context());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("TAROT_INTERPRETATION_UNAVAILABLE");
    expect(text).not.toMatch(/private-provider-canary|private-fact-canary|factRef|provider/u);
    expectPrivateResponse(response);
  });
});
