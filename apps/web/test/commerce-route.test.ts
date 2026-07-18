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
    completeLocalCheckout: vi.fn(),
    createOrder: vi.fn(),
    getOrder: vi.fn(),
    listEntitlements: vi.fn(),
    startCheckout: vi.fn(),
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
  loadWebCommerceApplicationService: () => ({
    completeLocalCheckout: harness.completeLocalCheckout,
    createOrder: harness.createOrder,
    getOrder: harness.getOrder,
    listEntitlements: harness.listEntitlements,
    startCheckout: harness.startCheckout,
  }),
  WebCommerceError: harness.CommerceError,
}));

import { POST as completeLocalCheckout } from "../app/api/v1/checkout/local/complete/route";
import { GET as listEntitlements } from "../app/api/v1/entitlements/route";
import { POST as createOrder } from "../app/api/v1/orders/route";
import { GET as getOrder } from "../app/api/v1/orders/[orderId]/route";
import { POST as startCheckout } from "../app/api/v1/orders/[orderId]/checkout/route";

const accountToken = "a".repeat(43);
const orderId = "11111111-1111-4111-8111-111111111111";
const order = Object.freeze({
  amountMinor: 99,
  checkoutExpiresAt: null,
  checkoutUrl: null,
  createdAt: "2026-07-18T12:00:00.000Z",
  currencyCode: "USD",
  entitlementGranted: false,
  exactContents: ["One mindful incense virtual ritual object"],
  orderId,
  productCode: "mindful_incense",
  state: "pending_checkout",
  updatedAt: "2026-07-18T12:00:00.000Z",
});

const headers = Object.freeze({
  cookie: `__Host-rituvia-account-session=${accountToken}`,
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
});

describe("commerce order HTTP contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.createOrder.mockResolvedValue({ kind: "created", order });
    harness.getOrder.mockResolvedValue(order);
    harness.listEntitlements.mockResolvedValue([]);
    harness.startCheckout.mockResolvedValue({
      order: { ...order, state: "checkout_created" },
      url: "https://checkout.example/session",
    });
    harness.completeLocalCheckout.mockResolvedValue({
      ...order,
      entitlementGranted: true,
      state: "paid",
    });
  });

  it("creates an authenticated server-priced order with an idempotency key", async () => {
    const body = { productCode: "mindful_incense" };
    const response = await createOrder(
      new NextRequest("https://example.test/api/v1/orders", {
        body: JSON.stringify(body),
        headers: {
          ...headers,
          "content-type": "application/json",
          "idempotency-key": "abcdefghijklmnopqrstuv",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toMatchObject({ kind: "created", order, schemaVersion: 1 });
    expect(harness.createOrder).toHaveBeenCalledWith({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      request: body,
      sessionToken: accountToken,
    });
  });

  it("rejects cross-site, incorrectly encoded, and missing-idempotency order requests", async () => {
    const build = (extra: Readonly<Record<string, string>>) =>
      new NextRequest("https://example.test/api/v1/orders", {
        body: JSON.stringify({ productCode: "mindful_incense" }),
        headers: {
          ...headers,
          "content-type": "application/json",
          "idempotency-key": "abcdefghijklmnopqrstuv",
          ...extra,
        },
        method: "POST",
      });
    const crossSite = await createOrder(build({ origin: "https://foreign.test" }));
    const encoded = await createOrder(build({ "content-encoding": "gzip" }));
    const missingKey = await createOrder(
      new NextRequest("https://example.test/api/v1/orders", {
        body: JSON.stringify({ productCode: "mindful_incense" }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(crossSite.status).toBe(403);
    expect(encoded.status).toBe(400);
    expect(missingKey.status).toBe(400);
    expect(harness.createOrder).not.toHaveBeenCalled();
  });

  it("keeps missing sessions and cross-owner order IDs indistinguishable", async () => {
    harness.getOrder.mockRejectedValue(new harness.CommerceError("not_found"));
    const request = new NextRequest(`https://example.test/api/v1/orders/${orderId}`, {
      headers: { "sec-fetch-site": "same-origin" },
    });
    const response = await getOrder(request, { params: Promise.resolve({ orderId }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "COMMERCE_NOT_FOUND", status: 404 });
  });

  it("starts checkout only from a bodyless same-origin request", async () => {
    const emptyBrowserPostBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const request = new NextRequest(`https://example.test/api/v1/orders/${orderId}/checkout`, {
      body: emptyBrowserPostBody,
      duplex: "half" as const,
      headers: { ...headers, "idempotency-key": "abcdefghijklmnopqrstuv" },
      method: "POST",
    });
    const response = await startCheckout(request, { params: Promise.resolve({ orderId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      schemaVersion: 1,
      url: "https://checkout.example/session",
    });
    expect(harness.startCheckout).toHaveBeenCalledWith({
      idempotencyKey: "abcdefghijklmnopqrstuv",
      orderId,
      sessionToken: accountToken,
    });
  });

  it("rejects checkout when a nominally bodyless request contains bytes", async () => {
    const request = new NextRequest(`https://example.test/api/v1/orders/${orderId}/checkout`, {
      body: "unexpected",
      headers: { ...headers, "idempotency-key": "abcdefghijklmnopqrstuv" },
      method: "POST",
    });
    const response = await startCheckout(request, { params: Promise.resolve({ orderId }) });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "COMMERCE_CHECKOUT_REQUEST_REJECTED" });
    expect(harness.startCheckout).not.toHaveBeenCalled();
  });

  it("completes local checkout from an exact CSRF-protected body and returns a flat order", async () => {
    const response = await completeLocalCheckout(
      new NextRequest("https://example.test/api/v1/checkout/local/complete", {
        body: JSON.stringify({ checkoutSessionId: "local_checkout_1" }),
        headers: { ...headers, "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      entitlementGranted: true,
      orderId,
      schemaVersion: 1,
      state: "paid",
    });
    expect(harness.completeLocalCheckout).toHaveBeenCalledWith({
      checkoutSessionId: "local_checkout_1",
      sessionToken: accountToken,
    });
  });

  it("lists only private entitlement projections", async () => {
    harness.listEntitlements.mockResolvedValue([
      {
        code: "sanctuary.mindful_incense",
        grantedAt: "2026-07-18T12:01:00.000Z",
        revokedAt: null,
        state: "active",
      },
    ]);
    const response = await listEntitlements(
      new NextRequest("https://example.test/api/v1/entitlements", {
        headers: {
          cookie: `__Host-rituvia-account-session=${accountToken}`,
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      items: [{ code: "sanctuary.mindful_incense", state: "active" }],
      schemaVersion: 1,
    });
  });
});
