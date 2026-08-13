import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class CommerceError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic commerce error");
      this.code = code;
    }
  }
  return {
    CommerceError,
    createCheckout: vi.fn(),
  };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));

vi.mock("../server/commerce", () => ({
  WebCommerceError: harness.CommerceError,
}));

vi.mock("../server/stripe-checkout", () => ({
  loadWebStripeCheckoutApplicationService: () => ({
    createCheckout: harness.createCheckout,
  }),
}));

import { POST } from "../app/api/v1/checkout/stripe/route";
import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../server/session-csrf";

const accountToken = "a".repeat(43);
const body = Object.freeze({
  cancelPath: "/en/store",
  productCode: "pack_6",
  successPath: "/en/checkout/return",
});
const requestHeaders = Object.freeze({
  cookie: `__Host-rituvia-account-session=${accountToken}`,
  "content-type": "application/json",
  "idempotency-key": "abcdefghijklmnopqrstuv",
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
  [sessionCsrfHeaderName]: deriveSessionCsrfToken(accountToken),
});

describe("Stripe checkout HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.createCheckout.mockResolvedValue({
      amountMinor: 599,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_12345678",
      currencyCode: "USD",
      expiresAt: "2026-07-30T12:30:00.000Z",
      kind: "created",
      orderId: "22222222-2222-4222-8222-222222222222",
      productCode: "pack_6",
      state: "checkout_created",
    });
  });

  it("creates a no-store authenticated checkout response", async () => {
    const response = await POST(
      new NextRequest("https://example.test/api/v1/checkout/stripe", {
        body: JSON.stringify(body),
        headers: requestHeaders,
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(await response.json()).toMatchObject({
      amountMinor: 599,
      schemaVersion: 1,
      state: "checkout_created",
    });
    expect(harness.createCheckout).toHaveBeenCalledWith({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: body,
      sessionToken: accountToken,
    });
  });

  it("uses 200 for exact replay and rejects cross-site or malformed metadata", async () => {
    harness.createCheckout.mockResolvedValueOnce({
      amountMinor: 599,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_12345678",
      currencyCode: "USD",
      expiresAt: "2026-07-30T12:30:00.000Z",
      kind: "replayed",
      orderId: "22222222-2222-4222-8222-222222222222",
      productCode: "pack_6",
      state: "checkout_created",
    });
    const replay = await POST(
      new NextRequest("https://example.test/api/v1/checkout/stripe", {
        body: JSON.stringify(body),
        headers: requestHeaders,
        method: "POST",
      }),
    );
    const crossSite = await POST(
      new NextRequest("https://example.test/api/v1/checkout/stripe", {
        body: JSON.stringify(body),
        headers: { ...requestHeaders, origin: "https://foreign.test" },
        method: "POST",
      }),
    );
    const encoded = await POST(
      new NextRequest("https://example.test/api/v1/checkout/stripe", {
        body: JSON.stringify(body),
        headers: { ...requestHeaders, "content-encoding": "gzip" },
        method: "POST",
      }),
    );
    const missingCsrf = await POST(
      new NextRequest("https://example.test/api/v1/checkout/stripe", {
        body: JSON.stringify(body),
        headers: Object.fromEntries(
          Object.entries(requestHeaders).filter(([key]) => key !== sessionCsrfHeaderName),
        ),
        method: "POST",
      }),
    );

    expect(replay.status).toBe(200);
    expect(crossSite.status).toBe(403);
    expect(encoded.status).toBe(400);
    expect(missingCsrf.status).toBe(403);
    expect(harness.createCheckout).toHaveBeenCalledTimes(1);
  });

  it("returns a redacted 503 when the payment-control plane is unavailable", async () => {
    harness.createCheckout.mockRejectedValueOnce(new harness.CommerceError("unavailable"));
    const response = await POST(
      new NextRequest("https://example.test/api/v1/checkout/stripe", {
        body: JSON.stringify(body),
        headers: requestHeaders,
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "COMMERCE_UNAVAILABLE",
      schemaVersion: 1,
      status: 503,
    });
  });
});
