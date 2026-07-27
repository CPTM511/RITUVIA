import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class WebError extends Error {
    readonly code: string;
    readonly retryAfterSeconds: number | undefined;
    constructor(code: string, retryAfterSeconds?: number) {
      super("synthetic");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return {
    download: vi.fn(),
    get: vi.fn(),
    request: vi.fn(),
    WebError,
  };
});

vi.mock("../server/privacy-export", () => ({
  downloadWebPrivacyExport: harness.download,
  getWebPrivacyExportMetadata: harness.get,
  requestWebPrivacyExport: harness.request,
  WebPrivacyExportError: harness.WebError,
}));
vi.mock("../server/account-auth", () => ({
  accountAuthStateCookieName: "__Host-rituvia-auth-state",
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { POST as requestExport } from "../app/api/v1/privacy/export/route";
import { POST as downloadExport } from "../app/api/v1/privacy/exports/[exportId]/download/route";
import { GET as getExport } from "../app/api/v1/privacy/exports/[exportId]/route";

const sessionToken = "s".repeat(43);
const exportId = "11111111-1111-4111-8111-111111111111";
const mutationHeaders = {
  cookie: `__Host-rituvia-account-session=${sessionToken}`,
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
  "x-csrf-token": deriveSessionCsrfToken(sessionToken),
};
const metadata = {
  completedAt: "2026-07-25T00:00:01.000Z",
  createdAt: "2026-07-25T00:00:00.000Z",
  expiresAt: "2026-07-25T00:15:00.000Z",
  id: exportId,
  recordCount: 4,
  schemaVersion: "privacy-export-package.v2",
  status: "ready",
};

describe("privacy export routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts one CSRF-bound idempotent request and returns private metadata", async () => {
    harness.request.mockResolvedValue(metadata);
    const response = await requestExport(
      new NextRequest("https://example.test/api/v1/privacy/export", {
        headers: { ...mutationHeaders, "idempotency-key": "i".repeat(22) },
        method: "POST",
      }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(await response.json()).toEqual(metadata);
    expect(harness.request).toHaveBeenCalledWith({
      idempotencyKey: "i".repeat(22),
      sessionToken,
    });
  });

  it("rejects cross-site, missing-CSRF, body-bearing, and missing-key requests before service", async () => {
    const requests = [
      new NextRequest("https://example.test/api/v1/privacy/export", {
        headers: {
          ...mutationHeaders,
          origin: "https://foreign.test",
          "idempotency-key": "i".repeat(22),
        },
        method: "POST",
      }),
      new NextRequest("https://example.test/api/v1/privacy/export", {
        headers: {
          cookie: mutationHeaders.cookie,
          origin: mutationHeaders.origin,
          "idempotency-key": "i".repeat(22),
        },
        method: "POST",
      }),
      new NextRequest("https://example.test/api/v1/privacy/export", {
        body: "{}",
        headers: {
          ...mutationHeaders,
          "content-type": "application/json",
          "idempotency-key": "i".repeat(22),
        },
        method: "POST",
      }),
      new NextRequest("https://example.test/api/v1/privacy/export", {
        headers: mutationHeaders,
        method: "POST",
      }),
    ];
    for (const request of requests) {
      expect((await requestExport(request)).status).toBe(403);
    }
    expect(harness.request).not.toHaveBeenCalled();
  });

  it("owner-scopes metadata and requires another CSRF-bound POST to download", async () => {
    harness.get.mockResolvedValue(metadata);
    harness.download.mockResolvedValue('{"schemaVersion":"privacy-export-package.v2"}');
    const metadataResponse = await getExport(
      new NextRequest(`https://example.test/api/v1/privacy/exports/${exportId}`, {
        headers: { cookie: mutationHeaders.cookie, "sec-fetch-site": "same-origin" },
      }),
      { params: Promise.resolve({ exportId }) },
    );
    const downloadResponse = await downloadExport(
      new NextRequest(`https://example.test/api/v1/privacy/exports/${exportId}/download`, {
        headers: mutationHeaders,
        method: "POST",
      }),
      { params: Promise.resolve({ exportId }) },
    );

    expect(metadataResponse.status).toBe(200);
    expect(harness.get).toHaveBeenCalledWith({ exportId, sessionToken });
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-disposition")).toContain("attachment");
    expect(downloadResponse.headers.get("content-type")).toContain("application/json");
    expect(await downloadResponse.text()).toContain("privacy-export-package.v2");
    expect(harness.download).toHaveBeenCalledWith({ exportId, sessionToken });
  });

  it("rejects cross-site export metadata reads before owner lookup", async () => {
    const responses = await Promise.all(
      [
        { origin: "https://foreign.test", "sec-fetch-site": "cross-site" },
        { "sec-fetch-site": "cross-site" },
      ].map((headers) =>
        getExport(
          new NextRequest(`https://example.test/api/v1/privacy/exports/${exportId}`, {
            headers: { cookie: mutationHeaders.cookie, ...headers },
          }),
          { params: Promise.resolve({ exportId }) },
        ),
      ),
    );

    expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("preserves non-enumerating owner failures and bounded retry evidence", async () => {
    harness.get.mockRejectedValue(new harness.WebError("not_found"));
    const missing = await getExport(
      new NextRequest(`https://example.test/api/v1/privacy/exports/${exportId}`, {
        headers: { cookie: mutationHeaders.cookie, "sec-fetch-site": "same-origin" },
      }),
      { params: Promise.resolve({ exportId }) },
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: "PRIVACY_EXPORT_NOT_FOUND", status: 404 });

    harness.request.mockRejectedValue(new harness.WebError("rate_limited", 60));
    const limited = await requestExport(
      new NextRequest("https://example.test/api/v1/privacy/export", {
        headers: { ...mutationHeaders, "idempotency-key": "i".repeat(22) },
        method: "POST",
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
