import { describe, expect, it, vi } from "vitest";

import { executeTarotOneCardOperation } from "../app/_components/tarot-one-card-transport";
import { createTarotOneCardResponseFixture } from "./fixtures/tarot-reading-response";

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
