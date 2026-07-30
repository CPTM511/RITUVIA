import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  requestRefund: vi.fn(),
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));

vi.mock("../server/stripe-refund", () => ({
  loadWebStripeRefundApplicationService: () => ({
    requestRefund: harness.requestRefund,
  }),
}));

import { POST } from "../app/api/v1/orders/[orderId]/refund/route";
import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../server/session-csrf";

const accountToken = "a".repeat(43);
const orderId = "22222222-2222-4222-8222-222222222222";
const headers = Object.freeze({
  cookie: `__Host-rituvia-account-session=${accountToken}`,
  "idempotency-key": "abcdefghijklmnopqrstuv",
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
  [sessionCsrfHeaderName]: deriveSessionCsrfToken(accountToken),
});

const context = Object.freeze({ params: Promise.resolve({ orderId }) });

describe("Stripe refund HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.requestRefund.mockResolvedValue({
      amountMinor: 599,
      currencyCode: "USD",
      eligibilityPolicyVersion: "sandbox-unused-credit-refund.v1",
      kind: "created",
      orderId,
      providerConfirmationPending: true,
      refundId: "33333333-3333-4333-8333-333333333333",
      refundPolicyVersion: "test:local:refund.v1",
      state: "refund_requested",
    });
  });

  it("accepts an authenticated no-body request without asserting provider completion", async () => {
    const response = await POST(
      new NextRequest(`https://example.test/api/v1/orders/${orderId}/refund`, {
        headers,
        method: "POST",
      }),
      context,
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toMatchObject({
      orderId,
      providerConfirmationPending: true,
      schemaVersion: 1,
      state: "refund_requested",
    });
    expect(harness.requestRefund).toHaveBeenCalledWith({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      orderId,
      sessionToken: accountToken,
    });
  });

  it("rejects cross-site, missing-CSRF, and body-bearing requests before service use", async () => {
    const crossSite = await POST(
      new NextRequest(`https://example.test/api/v1/orders/${orderId}/refund`, {
        headers: { ...headers, origin: "https://foreign.test" },
        method: "POST",
      }),
      context,
    );
    const missingCsrf = await POST(
      new NextRequest(`https://example.test/api/v1/orders/${orderId}/refund`, {
        headers: Object.fromEntries(
          Object.entries(headers).filter(([key]) => key !== sessionCsrfHeaderName),
        ),
        method: "POST",
      }),
      context,
    );
    const withBody = await POST(
      new NextRequest(`https://example.test/api/v1/orders/${orderId}/refund`, {
        body: "{}",
        headers: { ...headers, "content-type": "application/json" },
        method: "POST",
      }),
      context,
    );

    expect(crossSite.status).toBe(403);
    expect(missingCsrf.status).toBe(403);
    expect(withBody.status).toBe(403);
    expect(harness.requestRefund).not.toHaveBeenCalled();
  });
});
