import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ complete: vi.fn() }));

vi.mock("../app/api/v1/anonymous/session/route", () => ({
  anonymousSessionCookieName: "__Host-rituvia-anonymous-session",
}));
vi.mock("../server/account-auth", () => ({
  accountAuthStateCookieName: "__Host-rituvia-auth-state",
  accountSessionCookieName: "__Host-rituvia-account-session",
  completeWebLocalPreviewAuth: harness.complete,
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

import { GET } from "../app/api/v1/auth/local-preview/route";

describe("local auth preview route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes local auth from the HttpOnly state cookie without bearer query material", async () => {
    harness.complete.mockResolvedValue({
      context: { expiresAt: new Date(Date.now() + 600_000).toISOString() },
      mergeStatus: null,
      returnTo: "/en/account",
      sessionToken: "s".repeat(43),
    });
    const response = await GET(
      new NextRequest("https://example.test/api/v1/auth/local-preview", {
        headers: {
          cookie: "__Host-rituvia-auth-state=" + "q".repeat(43),
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.test/en/account");
    expect(harness.complete).toHaveBeenCalledWith({
      anonymousSessionToken: undefined,
      stateToken: "q".repeat(43),
    });
    expect(response.headers.get("set-cookie")).toContain(
      "__Host-rituvia-account-session=" + "s".repeat(43),
    );
    expect(response.headers.get("set-cookie")).toContain("__Host-rituvia-auth-state=");
    expect(response.headers.get("set-cookie")).not.toContain("q".repeat(43));
  });

  it("rejects query material before consuming local preview state", async () => {
    const response = await GET(
      new NextRequest("https://example.test/api/v1/auth/local-preview?token=secret", {
        headers: { cookie: "__Host-rituvia-auth-state=" + "q".repeat(43) },
      }),
    );

    expect(response.status).toBe(400);
    expect(harness.complete).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("secret");
  });
});
