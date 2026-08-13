import { describe, expect, it, vi } from "vitest";

import {
  executeTarotReadingReport,
  TarotReadingReportTransportError,
} from "../app/_components/tarot-reading-report-transport";
import { tarotReadingReportCategories } from "@rituvia/domain";

const readingId = "33333333-3333-4333-8333-333333333333";
const operation = Object.freeze({
  category: "safety" as const,
  idempotencyKey: "abcdefghijklmnopqrstuv",
  target: Object.freeze({ kind: "position" as const, positionId: "situation" }),
});
const interpretationRequestId = "44444444-4444-4444-8444-444444444444";

const response = (status: number, body: BodyInit | null = null, headers?: HeadersInit): Response =>
  new Response(body, { ...(headers === undefined ? {} : { headers }), status });

describe("tarot reading report transport", () => {
  it("invokes a native-style fetcher without an object receiver", async () => {
    const fetcher = function (this: unknown): Promise<Response> {
      expect(this).toBeUndefined();
      return Promise.resolve(response(204));
    } as typeof fetch;

    await executeTarotReadingReport({
      fetcher,
      operation,
      readingId,
      signal: new AbortController().signal,
    });
  });

  it("sends one exact no-store categorical command and accepts only an empty 204", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(204));

    await executeTarotReadingReport({
      fetcher,
      operation,
      readingId,
      signal: new AbortController().signal,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(`/api/v1/readings/${readingId}/report`, {
      body: JSON.stringify({
        category: "safety",
        schemaVersion: "tarot-reading-report.v1",
        target: { kind: "position", positionId: "situation" },
      }),
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "idempotency-key": operation.idempotencyKey,
      },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it.each(tarotReadingReportCategories)(
    "sends the closed %s category without private free text",
    async (category) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(204));

      await executeTarotReadingReport({
        fetcher,
        operation: { ...operation, category, target: { kind: "reading" } },
        readingId,
        signal: new AbortController().signal,
      });

      const request = fetcher.mock.calls[0]?.[1];
      const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
      expect(body).toEqual({
        category,
        schemaVersion: "tarot-reading-report.v1",
        target: { kind: "reading" },
      });
      expect(Object.keys(body).sort()).toEqual(["category", "schemaVersion", "target"]);
      expect(String(request?.body)).not.toMatch(/comment|free.?text|journal|prayer|question/iu);
    },
  );

  it("sends the exact interpretation operation through the strict v2 request arm", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(204));

    await executeTarotReadingReport({
      fetcher,
      operation: {
        ...operation,
        target: { interpretationRequestId, kind: "interpretation" },
      },
      readingId,
      signal: new AbortController().signal,
    });

    const request = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      category: "safety",
      schemaVersion: "tarot-reading-report.v2",
      target: { interpretationRequestId, kind: "interpretation" },
    });
    expect(String(request?.body)).not.toMatch(/comment|free.?text|journal|prayer|question/iu);
  });

  it("keeps the report idempotency key independent from the reading identifier and body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(204));

    await executeTarotReadingReport({
      fetcher,
      operation,
      readingId,
      signal: new AbortController().signal,
    });

    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({
      "idempotency-key": operation.idempotencyKey,
    });
    expect(operation.idempotencyKey).not.toBe(readingId);
    expect(String(request?.body)).not.toContain(operation.idempotencyKey);
  });

  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [429, "rate_limited"],
    [503, "unavailable"],
    [500, "error"],
  ] as const)("maps status %s to %s", async (status, failure) => {
    const pending = executeTarotReadingReport({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(response(status)),
      operation,
      readingId,
      signal: new AbortController().signal,
    });

    await expect(pending).rejects.toEqual(new TarotReadingReportTransportError(failure));
  });

  it("drains a bounded rate-limit response before exposing the closed failure", async () => {
    const result = response(429, JSON.stringify({ detail: "PRIVATE_REPORT_CANARY", status: 429 }), {
      "content-type": "application/problem+json",
      "retry-after": "31",
    });

    await expect(
      executeTarotReadingReport({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(result),
        operation,
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(new TarotReadingReportTransportError("rate_limited"));
    expect(result.bodyUsed).toBe(true);
  });

  it.each([
    [response(200), "a non-204 success"],
    [response(204, null, { "content-type": "application/json" }), "a typed 204"],
  ])("rejects %s response shape", async (result) => {
    await expect(
      executeTarotReadingReport({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(result),
        operation,
        readingId,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ failure: "error" });
  });

  it("does not retry a failed report automatically and permits an explicit same-operation retry", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(response(204));
    const input = {
      fetcher,
      operation,
      readingId,
      signal: new AbortController().signal,
    };

    await expect(executeTarotReadingReport(input)).rejects.toThrow("offline");
    expect(fetcher).toHaveBeenCalledOnce();

    await expect(executeTarotReadingReport(input)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(fetcher.mock.calls[1]?.[1]?.headers);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(fetcher.mock.calls[1]?.[1]?.body);
  });
});
