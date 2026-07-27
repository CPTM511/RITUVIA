import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/account", () => ({
  listWebAccountReadings: harness.list,
  WebAccountError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  },
}));

import { GET } from "../app/api/v1/me/readings/route";

describe("account reading history route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("round-trips an opaque stable cursor without accepting ownership input", async () => {
    const nextCursor = {
      createdAt: "2026-07-18T00:00:00.000Z",
      readingId: "33333333-3333-4333-8333-333333333333",
    };
    harness.list.mockResolvedValue({
      items: [
        { ...nextCursor, id: nextCursor.readingId, readingType: "one_card", themeCode: "self" },
      ],
      nextCursor,
    });
    const first = await GET(
      new NextRequest("https://example.test/api/v1/me/readings?limit=1", {
        headers: { cookie: "__Host-rituvia-account-session=" + "s".repeat(43) },
      }),
    );
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(harness.list).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 1,
      sessionToken: "s".repeat(43),
    });

    harness.list.mockResolvedValue({ items: [], nextCursor: null });
    const second = await GET(
      new NextRequest(
        `https://example.test/api/v1/me/readings?cursor=${firstBody.nextCursor}&limit=1`,
        { headers: { cookie: "__Host-rituvia-account-session=" + "s".repeat(43) } },
      ),
    );
    expect(second.status).toBe(200);
    expect(harness.list).toHaveBeenLastCalledWith({
      cursor: nextCursor,
      limit: 1,
      sessionToken: "s".repeat(43),
    });
  });

  it.each([
    "?userId=11111111-1111-4111-8111-111111111111",
    "?limit=0",
    "?limit=51",
    "?cursor=not-json",
    `?cursor=${Buffer.from(
      JSON.stringify({
        createdAt: "not-an-instant",
        readingId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toString("base64url")}`,
    `?cursor=${Buffer.from(
      JSON.stringify({
        createdAt: "2026-07-18T00:00:00.000Z",
        readingId: "not-a-reading",
      }),
    ).toString("base64url")}`,
  ])("rejects unreviewed history input before owner lookup: %s", async (query) => {
    const response = await GET(new NextRequest(`https://example.test/api/v1/me/readings${query}`));
    expect(response.status).toBe(400);
    expect(harness.list).not.toHaveBeenCalled();
  });
});
