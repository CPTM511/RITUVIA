import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ list: vi.fn(), revoke: vi.fn() }));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/account", () => ({
  listWebAccountSessions: harness.list,
  revokeWebAccountSession: harness.revoke,
  WebAccountError: class extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  },
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { GET } from "../app/api/v1/me/sessions/route";
import { DELETE } from "../app/api/v1/me/sessions/[sessionId]/route";

describe("account session management routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only summaries returned by the owner-scoped service", async () => {
    harness.list.mockResolvedValue([
      {
        createdAt: "2026-07-18T00:00:00.000Z",
        current: true,
        expiresAt: "2026-07-19T00:00:00.000Z",
        id: "33333333-3333-4333-8333-333333333333",
        lastSeenAt: "2026-07-18T01:00:00.000Z",
      },
    ]);
    const response = await GET(
      new NextRequest("https://example.test/api/v1/me/sessions", {
        headers: { cookie: "__Host-rituvia-account-session=" + "s".repeat(43) },
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).items).toHaveLength(1);
  });

  it("delegates revocation with both current token and target ID, preserving IDOR filtering", async () => {
    harness.revoke.mockResolvedValue(undefined);
    const response = await DELETE(
      new NextRequest(
        "https://example.test/api/v1/me/sessions/44444444-4444-4444-8444-444444444444",
        {
          headers: {
            cookie: "__Host-rituvia-account-session=" + "s".repeat(43),
            origin: "https://example.test",
            "sec-fetch-site": "same-origin",
          },
          method: "DELETE",
        },
      ),
      { params: Promise.resolve({ sessionId: "44444444-4444-4444-8444-444444444444" }) },
    );
    expect(response.status).toBe(204);
    expect(harness.revoke).toHaveBeenCalledWith({
      sessionId: "44444444-4444-4444-8444-444444444444",
      sessionToken: "s".repeat(43),
    });
  });
});
