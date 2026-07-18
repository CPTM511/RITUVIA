import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ complete: vi.fn(), merge: vi.fn() }));
vi.mock("../app/api/v1/anonymous/session/route", () => ({
  anonymousSessionCookieName: "__Host-rituvia-anonymous-session",
}));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
  completeWebAccountAuth: harness.complete,
  mergeWebAnonymousSubject: harness.merge,
  WebAccountAuthError: class extends Error {
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

import { GET } from "../app/api/v1/auth/callback/route";

describe("account auth callback route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets only a fresh strict host cookie and redirects to the stored local path", async () => {
    harness.complete.mockResolvedValue({
      context: { expiresAt: new Date(Date.now() + 600_000).toISOString() },
      returnTo: "/en/account",
      sessionToken: "s".repeat(43),
    });
    const response = await GET(
      new NextRequest(
        "https://example.test/api/v1/auth/callback?challenge=44444444-4444-4444-8444-444444444444&state=" +
          "q".repeat(43) +
          "&token=" +
          "t".repeat(43),
        { headers: { cookie: "__Host-rituvia-account-session=" + "p".repeat(43) } },
      ),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.test/en/account");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(cookie).toContain("__Host-rituvia-account-session=" + "s".repeat(43));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("p".repeat(43));
    expect(harness.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSessionToken: "p".repeat(43),
        state: "q".repeat(43),
      }),
    );
    expect(harness.merge).not.toHaveBeenCalled();
  });

  it("links the pre-login anonymous reading owner before issuing the account cookie", async () => {
    harness.complete.mockResolvedValue({
      context: { expiresAt: new Date(Date.now() + 600_000).toISOString() },
      returnTo: "/en/account",
      sessionToken: "s".repeat(43),
    });
    harness.merge.mockResolvedValue("created");
    const response = await GET(
      new NextRequest(
        "https://example.test/api/v1/auth/callback?challenge=44444444-4444-4444-8444-444444444444&state=" +
          "q".repeat(43) +
          "&token=" +
          "t".repeat(43),
        {
          headers: {
            cookie:
              "__Host-rituvia-account-session=" +
              "p".repeat(43) +
              "; __Host-rituvia-anonymous-session=" +
              "a".repeat(43),
          },
        },
      ),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(harness.merge).toHaveBeenCalledWith({
      accountSessionToken: "s".repeat(43),
      anonymousSessionToken: "a".repeat(43),
      idempotencyKey: "auth_callback_" + "s".repeat(43),
    });
    expect(harness.complete.mock.invocationCallOrder[0]).toBeLessThan(
      harness.merge.mock.invocationCallOrder[0] ?? 0,
    );
    expect(cookie).toContain("__Host-rituvia-account-session=" + "s".repeat(43));
    expect(cookie).toContain("__Host-rituvia-anonymous-session=");
    expect(cookie).toContain("Max-Age=0");
  });

  it("keeps login fail-closed and retains the anonymous bearer when linking fails", async () => {
    harness.complete.mockResolvedValue({
      context: { expiresAt: new Date(Date.now() + 600_000).toISOString() },
      returnTo: "/en/account",
      sessionToken: "s".repeat(43),
    });
    harness.merge.mockRejectedValue(new Error("synthetic outage"));
    const response = await GET(
      new NextRequest(
        "https://example.test/api/v1/auth/callback?challenge=44444444-4444-4444-8444-444444444444&state=" +
          "q".repeat(43) +
          "&token=" +
          "t".repeat(43),
        {
          headers: { cookie: "__Host-rituvia-anonymous-session=" + "a".repeat(43) },
        },
      ),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects reordered, duplicate, and extra callback query shapes before consumption", async () => {
    for (const url of [
      "https://example.test/api/v1/auth/callback?token=x&state=z&challenge=y",
      "https://example.test/api/v1/auth/callback?challenge=x&challenge=y&state=q&token=z",
      "https://example.test/api/v1/auth/callback?challenge=x&state=q&token=y&next=https://foreign.test",
    ]) {
      const response = await GET(new NextRequest(url));
      expect(response.status).toBe(400);
    }
    expect(harness.complete).not.toHaveBeenCalled();
  });
});
