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
    status: vi.fn(),
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

vi.mock("../server/commercial-purchases", () => ({
  loadWebCommercialPurchaseApplicationService: () => ({
    status: harness.status,
  }),
}));

import { GET } from "../app/api/v1/checkout/return/[orderId]/route";

const accountToken = "a".repeat(43);
const orderId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ orderId }) };

const request = (url = `https://example.test/api/v1/checkout/return/${orderId}`) =>
  new NextRequest(url, {
    headers: {
      accept: "application/json",
      cookie: `__Host-rituvia-account-session=${accountToken}`,
      "sec-fetch-site": "same-origin",
    },
  });

describe("checkout return status HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.status.mockResolvedValue({
      amountMinor: 599,
      currencyCode: "USD",
      exactContents: ["6 Credits"],
      fulfilled: false,
      orderId,
      productCode: "pack_6",
      refundPolicyVersion: "test:local:refund.v1",
      state: "paid",
      updatedAt: "2026-07-30T12:00:00.000Z",
    });
  });

  it("returns an owner-scoped pending state without treating paid as fulfilled", async () => {
    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({
      amountMinor: 599,
      currency: "USD",
      fulfilled: false,
      id: orderId,
      paymentProvider: "stripe",
      productCode: "pack_6",
      schemaVersion: 1,
      status: "paid",
      updatedAt: "2026-07-30T12:00:00.000Z",
    });
    expect(harness.status).toHaveBeenCalledWith(accountToken, orderId);
  });

  it("uses the same not-found response for missing sessions, owners, and unsafe queries", async () => {
    harness.status.mockRejectedValueOnce(new harness.CommerceError("session_required"));
    const missingSession = await GET(request(), context);
    harness.status.mockRejectedValueOnce(new harness.CommerceError("not_found"));
    const wrongOwner = await GET(request(), context);
    const unsafeQuery = await GET(request(`${request().url}?private=value`), context);
    const crossSite = await GET(
      new NextRequest(request().url, {
        headers: {
          accept: "application/json",
          cookie: `__Host-rituvia-account-session=${accountToken}`,
          origin: "https://foreign.test",
          "sec-fetch-site": "cross-site",
        },
      }),
      context,
    );

    for (const response of [missingSession, wrongOwner, unsafeQuery, crossSite]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        code: "COMMERCE_NOT_FOUND",
        status: 404,
      });
    }
  });
});
