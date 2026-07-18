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
  return { CommerceError, processWebhook: vi.fn() };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/commerce", () => ({
  loadWebCommerceApplicationService: () => ({ processWebhook: harness.processWebhook }),
  WebCommerceError: harness.CommerceError,
}));

vi.mock("../server/payment-provider", () => ({
  localHostedCheckoutProviderId: "local_hosted",
  stripeHostedCheckoutProviderId: "stripe",
}));

import { POST as localWebhook } from "../app/api/v1/webhooks/payments/local/route";
import { POST as stripeWebhook } from "../app/api/v1/webhooks/payments/stripe/route";

const request = (
  path: "local" | "stripe",
  rawBody: string,
  headers: Readonly<Record<string, string>> = {},
) =>
  new NextRequest(`https://example.test/api/v1/webhooks/payments/${path}`, {
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "x-rituvia-local-signature":
        "t=1784366400,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ...headers,
    },
    method: "POST",
  });

describe("payment webhook HTTP boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.processWebhook.mockResolvedValue({ disposition: "applied" });
  });

  it("forwards the exact local raw bytes and signature header without JSON normalization", async () => {
    const rawBody = '{\n  "eventId": "evt_exact", "amount": {"amountMinor": 99}\n}';
    const response = await localWebhook(request("local", rawBody));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(harness.processWebhook).toHaveBeenCalledOnce();
    const input = harness.processWebhook.mock.calls[0]?.[0];
    expect(input.providerId).toBe("local_hosted");
    expect(new TextDecoder().decode(input.request.rawBody)).toBe(rawBody);
    expect(input.request.headers["x-rituvia-local-signature"]).toContain("t=1784366400");
  });

  it("routes Stripe bytes to Stripe and never requires a browser Origin", async () => {
    const rawBody = '{"id":"evt_stripe"}';
    const response = await stripeWebhook(
      request("stripe", rawBody, {
        "stripe-signature": `t=1784366400,v1=${"b".repeat(64)}`,
      }),
    );

    expect(response.status).toBe(204);
    expect(harness.processWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "stripe" }),
    );
  });

  it("rejects encoded, oversized, or malformed webhook bodies before verification", async () => {
    const encoded = await localWebhook(request("local", "{}", { "content-encoding": "gzip" }));
    const oversized = await localWebhook(request("local", "{}", { "content-length": "262145" }));
    const missing = await localWebhook(
      new NextRequest("https://example.test/api/v1/webhooks/payments/local", {
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(encoded.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(harness.processWebhook).not.toHaveBeenCalled();
  });

  it("suppresses signature/provider details and returns a stable invalid response", async () => {
    harness.processWebhook.mockRejectedValueOnce(new harness.CommerceError("webhook_invalid"));
    const response = await localWebhook(request("local", '{"private":"canary"}'));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("PAYMENT_WEBHOOK_INVALID");
    expect(text).not.toContain("canary");
  });
});
