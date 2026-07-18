import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ merge: vi.fn() }));
vi.mock("../app/api/v1/anonymous/session/route", () => ({
  anonymousSessionCookieName: "__Host-rituvia-anonymous-session",
}));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
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

import { POST } from "../app/api/v1/auth/account-merge/route";

describe("anonymous account merge route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires both host cookies and idempotency, then deletes only the anonymous bearer", async () => {
    harness.merge.mockResolvedValue("created");
    const response = await POST(
      new NextRequest("https://example.test/api/v1/auth/account-merge", {
        headers: {
          "content-length": "0",
          cookie:
            "__Host-rituvia-account-session=" +
            "a".repeat(43) +
            "; __Host-rituvia-anonymous-session=" +
            "b".repeat(43),
          "idempotency-key": "abcdefghijklmnopqrstuv",
          origin: "https://example.test",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(204);
    expect(harness.merge).toHaveBeenCalledWith({
      accountSessionToken: "a".repeat(43),
      anonymousSessionToken: "b".repeat(43),
      idempotencyKey: "abcdefghijklmnopqrstuv",
    });
    expect(cookie).toContain("__Host-rituvia-anonymous-session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("__Host-rituvia-account-session");
  });

  it("accepts a browser-shaped empty stream without accepting request bytes", async () => {
    harness.merge.mockResolvedValue("created");
    const emptyBrowserPostBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const emptyBrowserPost = {
      body: emptyBrowserPostBody,
      duplex: "half" as const,
      headers: {
        cookie:
          "__Host-rituvia-account-session=" +
          "a".repeat(43) +
          "; __Host-rituvia-anonymous-session=" +
          "b".repeat(43),
        "idempotency-key": "abcdefghijklmnopqrstuv",
        origin: "https://example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    };
    const response = await POST(
      new NextRequest("https://example.test/api/v1/auth/account-merge", emptyBrowserPost),
    );

    expect(response.status).toBe(204);
    expect(harness.merge).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    const bodyWithBytes = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("unexpected"));
        controller.close();
      },
    });
    const postWithBytes = {
      body: bodyWithBytes,
      duplex: "half" as const,
      headers: {
        cookie:
          "__Host-rituvia-account-session=" +
          "a".repeat(43) +
          "; __Host-rituvia-anonymous-session=" +
          "b".repeat(43),
        "idempotency-key": "abcdefghijklmnopqrstuv",
        origin: "https://example.test",
        "sec-fetch-site": "same-origin",
      },
      method: "POST",
    };
    const rejected = await POST(
      new NextRequest("https://example.test/api/v1/auth/account-merge", postWithBytes),
    );

    expect(rejected.status).toBe(403);
    expect(harness.merge).not.toHaveBeenCalled();
  });

  it("rejects body metadata even when no bytes are present", async () => {
    const response = await POST(
      new NextRequest("https://example.test/api/v1/auth/account-merge", {
        headers: {
          "content-type": "application/json",
          "idempotency-key": "abcdefghijklmnopqrstuv",
          origin: "https://example.test",
          "sec-fetch-site": "same-origin",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(harness.merge).not.toHaveBeenCalled();
  });

  it("rejects missing idempotency and cross-origin requests before merge", async () => {
    for (const headers of [
      { "content-length": "0", origin: "https://example.test" },
      {
        "content-length": "0",
        "idempotency-key": "abcdefghijklmnopqrstuv",
        origin: "https://foreign.test",
      },
    ]) {
      const response = await POST(
        new NextRequest("https://example.test/api/v1/auth/account-merge", {
          headers,
          method: "POST",
        }),
      );
      expect(response.status).toBe(403);
    }
    expect(harness.merge).not.toHaveBeenCalled();
  });
});
