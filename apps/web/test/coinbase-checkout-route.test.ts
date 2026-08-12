import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ createCheckout: vi.fn() }));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));

vi.mock("../server/coinbase-checkout", () => ({
  loadWebCoinbaseCheckoutApplicationService: () => ({
    createCheckout: harness.createCheckout,
  }),
}));

import { POST } from "../app/api/v1/checkout/coinbase/route";
import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../server/session-csrf";

const accountToken = "a".repeat(43);
const body = Object.freeze({
  cancelPath: "/en/plans",
  productCode: "pack_6",
  successPath: "/en/checkout/return",
});
const headers = Object.freeze({
  cookie: `__Host-rituvia-account-session=${accountToken}`,
  "content-type": "application/json",
  "idempotency-key": "abcdefghijklmnopqrstuv",
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
  [sessionCsrfHeaderName]: deriveSessionCsrfToken(accountToken),
});

describe("Coinbase Business sandbox checkout HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.createCheckout.mockResolvedValue({
      checkoutUrl: "https://payments.coinbase.com/checkout/0123456789abcdef01234567",
      expiresAt: "2026-08-08T12:30:00.000Z",
      kind: "created",
      networkCode: "base",
      orderId: "22222222-2222-4222-8222-222222222222",
      productCode: "pack_6",
      settlementAsset: "USDC",
      state: "checkout_created",
      usdAmountMinor: 599,
    });
  });

  it("creates a no-store authenticated USDC/Base sandbox checkout", async () => {
    const response = await POST(
      new NextRequest("https://example.test/api/v1/checkout/coinbase", {
        body: JSON.stringify(body),
        headers,
        method: "POST",
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toMatchObject({
      networkCode: "base",
      schemaVersion: 1,
      settlementAsset: "USDC",
      usdAmountMinor: 599,
    });
    expect(harness.createCheckout).toHaveBeenCalledWith({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: body,
      sessionToken: accountToken,
    });
  });

  it("rejects cross-site and missing-CSRF requests before checkout creation", async () => {
    const crossSite = await POST(
      new NextRequest("https://example.test/api/v1/checkout/coinbase", {
        body: JSON.stringify(body),
        headers: { ...headers, origin: "https://foreign.test" },
        method: "POST",
      }),
    );
    const missingCsrf = await POST(
      new NextRequest("https://example.test/api/v1/checkout/coinbase", {
        body: JSON.stringify(body),
        headers: Object.fromEntries(
          Object.entries(headers).filter(([name]) => name !== sessionCsrfHeaderName),
        ),
        method: "POST",
      }),
    );
    expect(crossSite.status).toBe(403);
    expect(missingCsrf.status).toBe(403);
    expect(harness.createCheckout).not.toHaveBeenCalled();
  });
});
