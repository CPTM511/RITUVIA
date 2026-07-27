import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class WebError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  }
  return { list: vi.fn(), record: vi.fn(), WebError };
});

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/account-consent", () => ({
  listWebAccountConsentControls: harness.list,
  recordWebAccountConsentControl: harness.record,
  WebAccountConsentError: harness.WebError,
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { GET, POST } from "../app/api/v1/me/consents/route";

const sessionToken = "s".repeat(43);
const control = {
  granted: true,
  noticeVersion: "rituvia.ai-personalization-notice.v1",
  purpose: "ai_personalization",
  recordedAt: "2026-07-25T08:00:00.000Z",
} as const;

const mutationRequest = (body: unknown, headers: Record<string, string> = {}): NextRequest => {
  const source = JSON.stringify(body);
  return new NextRequest("https://example.test/api/v1/me/consents", {
    body: source,
    headers: {
      "content-length": String(source.length),
      "content-type": "application/json",
      cookie: `__Host-rituvia-account-session=${sessionToken}`,
      "idempotency-key": "i".repeat(22),
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": deriveSessionCsrfToken(sessionToken),
      ...headers,
    },
    method: "POST",
  });
};

describe("account consent route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only current purpose controls with private response headers", async () => {
    harness.list.mockResolvedValue([control]);
    const response = await GET(
      new NextRequest("https://example.test/api/v1/me/consents", {
        headers: { cookie: `__Host-rituvia-account-session=${sessionToken}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ controls: [control], schemaVersion: 1 });
    expect(harness.list).toHaveBeenCalledWith(sessionToken);
  });

  it("passes exact bounded input, session, and idempotency key", async () => {
    const body = {
      granted: true,
      noticeVersion: control.noticeVersion,
      purpose: control.purpose,
      schemaVersion: 1,
    };
    harness.record.mockResolvedValue(control);
    const response = await POST(mutationRequest(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ control, schemaVersion: 1 });
    expect(harness.record).toHaveBeenCalledWith({
      idempotencyKey: "i".repeat(22),
      request: body,
      sessionToken,
    });
  });

  it.each([
    { origin: "https://foreign.test" },
    { "sec-fetch-site": "cross-site" },
    { "x-csrf-token": "invalid" },
  ])("rejects untrusted mutation evidence before the service", async (headers) => {
    const response = await POST(mutationRequest({}, headers));
    expect(response.status).toBe(403);
    expect(harness.record).not.toHaveBeenCalled();
  });

  it("maps session, invalid, conflict, and unavailable errors without reflecting input", async () => {
    const cases = [
      ["session_unavailable", 401, "ACCOUNT_SESSION_UNAVAILABLE"],
      ["invalid", 400, "ACCOUNT_CONSENT_INPUT_INVALID"],
      ["conflict", 409, "ACCOUNT_CONSENT_CONFLICT"],
      ["unavailable", 503, "ACCOUNT_CONSENT_UNAVAILABLE"],
    ] as const;
    for (const [code, status, responseCode] of cases) {
      harness.record.mockRejectedValueOnce(new harness.WebError(code));
      const response = await POST(
        mutationRequest({
          granted: true,
          noticeVersion: control.noticeVersion,
          purpose: control.purpose,
          schemaVersion: 1,
        }),
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code: responseCode, status });
    }
  });
});
