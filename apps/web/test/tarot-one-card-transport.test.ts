import { describe, expect, it, vi } from "vitest";

import {
  executeTarotOneCardOperation,
  executeTarotReadingResume,
  executeTarotReadingOperation,
} from "../app/_components/tarot-one-card-transport";
import {
  createTarotOneCardResponseFixture,
  createTarotThreeCardResponseFixture,
} from "./fixtures/tarot-reading-response";

const operation = Object.freeze({
  readingIdempotencyKey: "22222222-2222-4222-8222-222222222222",
  sessionIdempotencyKey: "11111111-1111-4111-8111-111111111111",
});

const execute = (fetcher: typeof fetch, onSessionReady = vi.fn()) =>
  executeTarotOneCardOperation({
    fetcher,
    onSessionReady,
    operation,
    signal: new AbortController().signal,
    themeCode: "open_reflection",
  });

describe("one-card browser transport", () => {
  it.each([
    [201, false],
    [200, true],
  ] as const)(
    "uses separate exact requests and accepts a %s response",
    async (status, replayed) => {
      const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
      const receivers: unknown[] = [];
      const fetcher = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
        receivers.push(this);
        calls.push([input, init]);
        if (calls.length === 1) return new Response(null, { status: 204 });
        return Response.json(createTarotOneCardResponseFixture(), { status });
      } as typeof fetch;
      const onSessionReady = vi.fn();

      await expect(execute(fetcher, onSessionReady)).resolves.toMatchObject({ replayed });
      expect(receivers).toEqual([undefined, undefined]);
      expect(onSessionReady).toHaveBeenCalledOnce();
      expect(calls).toHaveLength(2);
      expect(calls[0]).toMatchObject([
        "/api/v1/anonymous/session",
        { headers: { "idempotency-key": operation.sessionIdempotencyKey }, method: "POST" },
      ]);
      expect(calls[1]).toMatchObject([
        "/api/v1/readings/tarot",
        {
          headers: {
            "content-type": "application/json",
            "idempotency-key": operation.readingIdempotencyKey,
          },
          method: "POST",
        },
      ]);
      expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
        locale: "en",
        readingType: "one_card",
        schemaVersion: "tarot-reading-create.v1",
        themeCode: "open_reflection",
      });
      expect(String(calls[1]?.[1]?.body)).not.toMatch(/question|cardId|orientation/iu);
    },
  );

  it.each([
    [401, "session_required"],
    [409, "conflict"],
    [429, "limit_reached"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("maps reading status %s to %s", async (status, failure) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status })) as unknown as typeof fetch;

    await expect(execute(fetcher)).rejects.toMatchObject({ failure });
  });

  it.each([
    ["1", 1],
    ["604800", 604_800],
  ] as const)("accepts bounded integer Retry-After %s on a 429", async (header, expected) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(null, { headers: { "retry-after": header }, status: 429 }),
      ) as unknown as typeof fetch;

    await expect(execute(fetcher)).rejects.toMatchObject({
      failure: "limit_reached",
      retryAfterSeconds: expected,
    });
  });

  it.each(["", "0", "000001", "+1", "1.5", "604801", "1000000", "Wed, 21 Oct 2015 07:28:00 GMT"])(
    "rejects malformed or out-of-range Retry-After %j without enabling an immediate retry",
    async (header) => {
      const headers = header === "" ? undefined : { "retry-after": header };
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(
          new Response(null, {
            ...(headers === undefined ? {} : { headers }),
            status: 429,
          }),
        ) as unknown as typeof fetch;

      await expect(execute(fetcher)).rejects.toMatchObject({
        failure: "limit_reached",
        retryAfterSeconds: undefined,
      });
    },
  );

  it.each([" 1", "1 "])("rejects an unnormalized Retry-After %j", async (header) => {
    const rawResponse = {
      headers: { get: (name: string) => (name === "retry-after" ? header : null) },
      status: 429,
    } as unknown as Response;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(rawResponse) as unknown as typeof fetch;

    await expect(execute(fetcher)).rejects.toMatchObject({
      failure: "limit_reached",
      retryAfterSeconds: undefined,
    });
  });

  it("fails closed on malformed, oversized, or theme-mismatched JSON", async () => {
    const wrongTheme = { ...createTarotOneCardResponseFixture(), themeCode: "work" };
    for (const response of [
      new Response("{}", { headers: { "content-type": "text/plain" }, status: 201 }),
      new Response("{}", {
        headers: { "content-length": "65537", "content-type": "application/json" },
        status: 201,
      }),
      Response.json(wrongTheme, { status: 201 }),
    ]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(response) as unknown as typeof fetch;
      await expect(execute(fetcher)).rejects.toMatchObject({ failure: "error" });
    }
  });
});

describe("three-card browser transport", () => {
  it("sends one exact three-card command and accepts only a three-card response", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return calls.length === 1
        ? new Response(null, { status: 204 })
        : Response.json(createTarotThreeCardResponseFixture(), { status: 201 });
    }) as unknown as typeof fetch;

    const result = await executeTarotReadingOperation({
      fetcher,
      onSessionReady: vi.fn(),
      operation,
      readingType: "three_card",
      signal: new AbortController().signal,
      themeCode: "open_reflection",
    });

    expect(result.response.presentation.cards.map(({ positionId }) => positionId)).toEqual([
      "situation",
      "action",
      "possibility",
    ]);
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      locale: "en",
      readingType: "three_card",
      schemaVersion: "tarot-reading-create.v1",
      themeCode: "open_reflection",
    });
    expect(calls).toHaveLength(2);
  });

  it("rejects a one-card response for a three-card command", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json(createTarotOneCardResponseFixture(), { status: 201 }),
      ) as unknown as typeof fetch;

    await expect(
      executeTarotReadingOperation({
        fetcher,
        onSessionReady: vi.fn(),
        operation,
        readingType: "three_card",
        signal: new AbortController().signal,
        themeCode: "open_reflection",
      }),
    ).rejects.toMatchObject({ failure: "error" });
  });
});

describe("same-session tarot resume transport", () => {
  it.each([
    ["one_card", createTarotOneCardResponseFixture],
    ["three_card", createTarotThreeCardResponseFixture],
  ] as const)("restores one exact %s result with GET only", async (readingType, fixture) => {
    const body = fixture();
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push([input, init]);
      return Response.json(body, { status: 200 });
    }) as unknown as typeof fetch;
    const signal = new AbortController().signal;

    await expect(
      executeTarotReadingResume({ fetcher, readingId: body.readingId, readingType, signal }),
    ).resolves.toEqual(body);
    expect(calls).toEqual([
      [
        `/api/v1/readings/${body.readingId}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
          signal,
        },
      ],
    ]);
    expect(calls[0]?.[1]).not.toHaveProperty("body");
    expect(calls[0]?.[1]).not.toHaveProperty("headers");
    expect(String(calls[0]?.[0])).not.toMatch(/anonymous\/session|readings\/tarot/iu);
  });

  it("invokes a native-compatible fetcher without an object receiver", async () => {
    const body = createTarotOneCardResponseFixture();
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const receivers: unknown[] = [];
    const fetcher = function (
      this: unknown,
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      calls.push([input, init]);
      receivers.push(this);
      return Promise.resolve(Response.json(body, { status: 200 }));
    } as typeof fetch;

    await expect(
      executeTarotReadingResume({
        fetcher,
        readingId: body.readingId,
        readingType: "one_card",
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual(body);
    expect(receivers).toEqual([undefined]);
    expect(calls).toHaveLength(1);
  });

  it.each([
    [404, "not_found"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("maps resume status %s to %s", async (status, failure) => {
    const body = createTarotOneCardResponseFixture();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status })) as unknown as typeof fetch;

    await expect(
      executeTarotReadingResume({
        fetcher,
        readingId: body.readingId,
        readingType: "one_card",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure });
  });

  it("rejects an invalid saved ID without issuing a request", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;

    await expect(
      executeTarotReadingResume({
        fetcher,
        readingId: "not-a-reading",
        readingType: "one_card",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure: "invalid" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects malformed, oversized, ID-mismatched, and type-mismatched restore responses", async () => {
    const body = createTarotOneCardResponseFixture();
    const differentId = { ...body, readingId: "55555555-5555-4555-8555-555555555555" };
    const responses = [
      new Response("{}", { headers: { "content-type": "text/plain" }, status: 200 }),
      new Response("{}", {
        headers: { "content-length": "65537", "content-type": "application/json" },
        status: 200,
      }),
      Response.json(differentId, { status: 200 }),
      Response.json(createTarotThreeCardResponseFixture(), { status: 200 }),
    ];

    for (const response of responses) {
      const fetcher = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
      await expect(
        executeTarotReadingResume({
          fetcher,
          readingId: body.readingId,
          readingType: "one_card",
          signal: new AbortController().signal,
        }),
      ).rejects.toMatchObject({ failure: "invalid" });
    }
  });
});
