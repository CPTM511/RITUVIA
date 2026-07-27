import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/account", () => ({
  listWebAccountHistory: harness.list,
  WebAccountError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  },
}));

import { GET } from "../app/api/v1/me/history/route";

const cursor = {
  occurredAt: "2026-07-24T00:00:00.000Z",
  resourceId: "33333333-3333-4333-8333-333333333333",
  sourceType: "reading",
} as const;

describe("account history route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns owner-scoped minimal summaries and an opaque stable cursor", async () => {
    harness.list.mockResolvedValue({
      items: [
        {
          occurredAt: cursor.occurredAt,
          readingType: "one_card",
          resourceId: cursor.resourceId,
          resourceType: "reading",
          status: "facts_ready",
          themeCode: "self",
        },
      ],
      nextCursor: cursor,
    });
    const response = await GET(
      new NextRequest("https://example.test/api/v1/me/history?limit=1", {
        headers: { cookie: "__Host-rituvia-account-session=" + "s".repeat(43) },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(JSON.stringify(body)).not.toContain("private");
    expect(harness.list).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 1,
      sessionToken: "s".repeat(43),
    });

    harness.list.mockResolvedValue({ items: [], nextCursor: null });
    const next = await GET(
      new NextRequest(`https://example.test/api/v1/me/history?limit=1&cursor=${body.nextCursor}`, {
        headers: { cookie: "__Host-rituvia-account-session=" + "s".repeat(43) },
      }),
    );
    expect(next.status).toBe(200);
    expect(harness.list).toHaveBeenLastCalledWith({
      cursor,
      limit: 1,
      sessionToken: "s".repeat(43),
    });
  });

  it.each([
    "?userId=11111111-1111-4111-8111-111111111111",
    "?limit=0",
    "?limit=51",
    "?cursor=not-json",
    `?cursor=${Buffer.from(JSON.stringify({ ...cursor, sourceType: "order" })).toString(
      "base64url",
    )}`,
  ])("rejects unreviewed history input before owner lookup: %s", async (query) => {
    const response = await GET(new NextRequest(`https://example.test/api/v1/me/history${query}`));

    expect(response.status).toBe(400);
    expect(harness.list).not.toHaveBeenCalled();
  });
});
