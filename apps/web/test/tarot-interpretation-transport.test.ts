import { describe, expect, it, vi } from "vitest";

import {
  executeTarotInterpretationPoll,
  executeTarotInterpretationStart,
  TarotInterpretationTransportError,
} from "../app/_components/tarot-interpretation-transport";
import {
  tarotInterpretationMaximumResponseBytes,
  tarotInterpretationResponseSchemaVersion,
} from "../app/_contracts/tarot-interpretation-response";

const readingId = "33333333-3333-4333-8333-333333333333";
const operationId = "11111111-1111-4111-8111-111111111111";

const output = Object.freeze({
  boundaryNote: "Symbolic reflection only; it cannot determine an outcome.",
  perspectives: ["One possibility is to leave room for more context."],
  reflectionQuestions: ["What choice would preserve your agency today?"],
  smallAction: {
    label: "Write down one observable next step",
    rationale: "A small concrete step can keep this reflection grounded.",
    timeHorizon: "today",
  },
  summary: "This reflection invites a pause before choosing a practical next step.",
  symbols: [
    {
      limitation: "This symbol cannot establish what will happen.",
      meaning: "A pause can make another perspective easier to notice.",
      possibility: "You may have room to gather one more piece of information.",
    },
  ],
  title: "A grounded pause",
});

const responseBody = (
  status: "failed" | "processing" | "reviewed_fallback" | "verified",
): Record<string, unknown> => ({
  displayable: status === "reviewed_fallback" || status === "verified",
  ...(status === "processing" ? { pollAfterMs: 1_500 } : {}),
  ...(status === "reviewed_fallback" || status === "verified" ? { output } : {}),
  readingId,
  schemaVersion: tarotInterpretationResponseSchemaVersion,
  status,
});

const jsonResponse = (body: unknown, status: number, headers: HeadersInit = {}): Response =>
  Response.json(body, {
    headers: { "content-type": "application/json", ...headers },
    status,
  });

const problemResponse = (
  code: string,
  status: number,
  headers: HeadersInit = {},
  overrides: Readonly<Record<string, unknown>> = {},
): Response =>
  Response.json(
    {
      code,
      detail: "A safe explanation.",
      fields: [],
      instance: "/api/v1/readings",
      requestId: "req_00000000000000000000000000000000",
      status,
      title: "The request did not complete",
      type: `https://rituvia.example/problems/${code.toLowerCase()}`,
      ...overrides,
    },
    {
      headers: { "content-type": "application/problem+json", ...headers },
      status,
    },
  );

describe("tarot interpretation browser transport", () => {
  it("starts and polls through exact same-origin no-store requests without a body or Origin header", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const receivers: unknown[] = [];
    const fetcher = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      receivers.push(this);
      calls.push([input, init]);
      return calls.length === 1
        ? jsonResponse(responseBody("processing"), 202, { "retry-after": "2" })
        : jsonResponse(responseBody("verified"), 200);
    } as typeof fetch;
    const signal = new AbortController().signal;

    await expect(
      executeTarotInterpretationStart({ fetcher, operationId, readingId, signal }),
    ).resolves.toMatchObject({ status: "processing" });
    await expect(
      executeTarotInterpretationPoll({ fetcher, readingId, signal }),
    ).resolves.toMatchObject({ status: "verified" });

    expect(receivers).toEqual([undefined, undefined]);
    expect(calls).toEqual([
      [
        `/api/v1/readings/${readingId}/interpretation`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "idempotency-key": operationId },
          method: "POST",
          redirect: "error",
          signal,
        },
      ],
      [
        `/api/v1/readings/${readingId}/interpretation`,
        {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
          redirect: "error",
          signal,
        },
      ],
    ]);
    expect(calls[0]?.[1]).not.toHaveProperty("body");
    expect(calls[0]?.[1]?.headers).not.toHaveProperty("origin");
    expect(calls[0]?.[1]?.headers).not.toHaveProperty("content-type");
    expect(calls[1]?.[1]).not.toHaveProperty("body");
    expect(calls[1]?.[1]).not.toHaveProperty("headers");
  });

  it.each(["verified", "reviewed_fallback", "failed"] as const)(
    "accepts a strict 200 %s response",
    async (status) => {
      const result = executeTarotInterpretationPoll({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(responseBody(status), 200)),
        readingId,
        signal: new AbortController().signal,
      });

      await expect(result).resolves.toMatchObject({ readingId, status });
    },
  );

  it("accepts the maximum legal UTF-8 interpretation within the shared byte boundary", async () => {
    const text = (length: number, suffix = ""): string =>
      `${"က".repeat(length - suffix.length)}${suffix}`;
    const maximumOutput = {
      boundaryNote: text(800),
      perspectives: Array.from({ length: 6 }, (_, index) => text(800, String(index))),
      reflectionQuestions: Array.from({ length: 4 }, (_, index) => text(500, String(index))),
      ritualSuggestion: { reason: text(600) },
      smallAction: {
        label: text(240),
        rationale: text(600),
        timeHorizon: "open",
      },
      summary: text(1_200),
      symbols: Array.from({ length: 12 }, () => ({
        limitation: text(800),
        meaning: text(800),
        possibility: text(800),
      })),
      title: text(120),
    };
    const body = JSON.stringify({ ...responseBody("verified"), output: maximumOutput });

    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(
      tarotInterpretationMaximumResponseBytes,
    );
    await expect(
      executeTarotInterpretationPoll({
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            new Response(body, { headers: { "content-type": "application/json" }, status: 200 }),
          ),
        readingId,
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ status: "verified" });
  });

  it.each([
    [250, "1"],
    [1_500, "2"],
    [30_000, "30"],
  ] as const)(
    "accepts bounded processing delay %sms with Retry-After %s",
    async (pollAfterMs, retryAfter) => {
      const body = { ...responseBody("processing"), pollAfterMs };
      const result = executeTarotInterpretationPoll({
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse(body, 202, { "retry-after": retryAfter })),
        readingId,
        signal: new AbortController().signal,
      });

      await expect(result).resolves.toMatchObject({ pollAfterMs, status: "processing" });
    },
  );

  it.each([
    [jsonResponse(responseBody("verified"), 202, { "retry-after": "2" }), "202 final"],
    [jsonResponse(responseBody("processing"), 200), "200 processing"],
    [jsonResponse(responseBody("processing"), 202), "missing Retry-After"],
    [
      jsonResponse(responseBody("processing"), 202, { "retry-after": "1" }),
      "inconsistent Retry-After",
    ],
    [
      jsonResponse(responseBody("processing"), 202, { "retry-after": "31" }),
      "out-of-range Retry-After",
    ],
    [
      jsonResponse(responseBody("failed"), 200, { "retry-after": "1" }),
      "Retry-After on a terminal response",
    ],
  ])("rejects an invalid success pairing: %s", async (result) => {
    await expect(
      executeTarotInterpretationPoll({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(result),
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(new TarotInterpretationTransportError("invalid_response"));
  });

  it.each([
    ["TAROT_INTERPRETATION_CONFLICT", 409, "conflict"],
    ["TAROT_READING_NOT_FOUND", 404, "not_found"],
    ["TAROT_INTERPRETATION_PERMISSION_DENIED", 403, "permission"],
    ["TAROT_INTERPRETATION_RATE_LIMITED", 429, "rate_limited"],
    ["TAROT_READING_SESSION_REQUIRED", 401, "session_expired"],
    ["TAROT_INTERPRETATION_UNAVAILABLE", 503, "unavailable"],
  ] as const)("maps %s/%s Problem Details to %s", async (code, status, failure) => {
    const headers = status === 429 ? { "retry-after": "30" } : {};
    const result = executeTarotInterpretationStart({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(problemResponse(code, status, headers)),
      operationId,
      readingId,
      signal: new AbortController().signal,
    });

    await expect(result).rejects.toMatchObject({
      failure,
      retryAfterSeconds: failure === "rate_limited" ? 30 : undefined,
    });
  });

  it.each([
    problemResponse("TAROT_READING_NOT_FOUND", 404, { "content-type": "application/json" }),
    problemResponse("TAROT_READING_NOT_FOUND", 404, {}, { status: 403 }),
    problemResponse("UNKNOWN_PRIVATE_FAILURE", 503),
    problemResponse("TAROT_READING_NOT_FOUND", 404, {}, { providerCode: "private" }),
  ])("fails closed on malformed or unknown Problem Details", async (result) => {
    await expect(
      executeTarotInterpretationPoll({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(result),
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure: "invalid_response" });
  });

  it.each(["", "0", "000001", "+1", "1.5", "604801"])(
    "does not expose malformed 429 Retry-After %j",
    async (retryAfter) => {
      const headers = retryAfter === "" ? {} : { "retry-after": retryAfter };
      const result = executeTarotInterpretationPoll({
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValue(problemResponse("TAROT_INTERPRETATION_RATE_LIMITED", 429, headers)),
        readingId,
        signal: new AbortController().signal,
      });

      await expect(result).rejects.toMatchObject({
        failure: "rate_limited",
        retryAfterSeconds: undefined,
      });
    },
  );

  it("does not expose an unnormalized Retry-After value", async () => {
    const underlying = problemResponse("TAROT_INTERPRETATION_RATE_LIMITED", 429);
    const rawHeaderResponse = {
      body: underlying.body,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? "1 " : underlying.headers.get(name),
      },
      status: underlying.status,
    } as unknown as Response;

    await expect(
      executeTarotInterpretationPoll({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(rawHeaderResponse),
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      failure: "rate_limited",
      retryAfterSeconds: undefined,
    });
  });

  it("rejects malformed, oversized, ID-mismatched, and internal-metadata responses", async () => {
    const oversized = JSON.stringify({
      value: "x".repeat(tarotInterpretationMaximumResponseBytes),
    });
    const responses = [
      new Response("{}", { headers: { "content-type": "text/plain" }, status: 200 }),
      new Response("{}", {
        headers: {
          "content-length": String(tarotInterpretationMaximumResponseBytes + 1),
          "content-type": "application/json",
        },
        status: 200,
      }),
      new Response(oversized, { headers: { "content-type": "application/json" }, status: 200 }),
      new Response("{", { headers: { "content-type": "application/json" }, status: 200 }),
      jsonResponse(
        { ...responseBody("verified"), readingId: "44444444-4444-4444-8444-444444444444" },
        200,
      ),
      jsonResponse({ ...responseBody("verified"), providerId: "private" }, 200),
    ];

    for (const result of responses) {
      await expect(
        executeTarotInterpretationPoll({
          fetcher: vi.fn<typeof fetch>().mockResolvedValue(result),
          readingId,
          signal: new AbortController().signal,
        }),
      ).rejects.toMatchObject({ failure: "invalid_response" });
    }
  });

  it("maps network rejection to offline but preserves abort cancellation", async () => {
    await expect(
      executeTarotInterpretationPoll({
        fetcher: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(new TarotInterpretationTransportError("offline"));

    const abortError = Object.assign(new Error("cancelled"), { name: "AbortError" });
    await expect(
      executeTarotInterpretationPoll({
        fetcher: vi.fn<typeof fetch>().mockRejectedValue(abortError),
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(abortError);
  });

  it("rejects invalid local identifiers before issuing any request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      executeTarotInterpretationStart({
        fetcher,
        operationId: "not-a-key",
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure: "invalid_response" });
    await expect(
      executeTarotInterpretationPoll({
        fetcher,
        readingId: "not-a-reading",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure: "invalid_response" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
