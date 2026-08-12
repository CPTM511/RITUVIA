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
  return { CommerceError, processStripeWebhook: vi.fn(), processWebhook: vi.fn() };
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

vi.mock("../server/stripe-webhook", () => ({
  loadWebStripeWebhookApplicationService: () => ({
    processWebhook: harness.processStripeWebhook,
  }),
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
    harness.processStripeWebhook.mockResolvedValue({ disposition: "applied" });
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
    expect(harness.processStripeWebhook).toHaveBeenCalledOnce();
    const input = harness.processStripeWebhook.mock.calls[0]?.[0];
    expect(new TextDecoder().decode(input.rawBody)).toBe(rawBody);
    expect(input.headers["stripe-signature"]).toContain("t=1784366400");
    expect(harness.processWebhook).not.toHaveBeenCalled();
  });

  it("accepts Stripe UTF-8 JSON metadata and rejects other webhook media types", async () => {
    const signature = `t=1784366400,v1=${"b".repeat(64)}`;
    const accepted = await stripeWebhook(
      request("stripe", '{"id":"evt_charset"}', {
        "content-type": "application/json; charset=utf-8",
        "stripe-signature": signature,
      }),
    );

    expect(accepted.status).toBe(204);
    expect(harness.processStripeWebhook).toHaveBeenCalledOnce();

    for (const contentType of [
      "application/json; charset=iso-8859-1",
      "application/json; charset=utf-8; profile=unexpected",
      "text/json",
    ]) {
      vi.clearAllMocks();
      const rejected = await stripeWebhook(
        request("stripe", '{"id":"evt_media_rejected"}', {
          "content-type": contentType,
          "stripe-signature": signature,
        }),
      );
      expect(rejected.status).toBe(400);
      expect(harness.processStripeWebhook).not.toHaveBeenCalled();
    }
  });

  it("accepts only the bounded Vercel automation bypass query needed by Stripe Test", async () => {
    const signature = `t=1784366400,v1=${"b".repeat(64)}`;
    const valid = await stripeWebhook(
      new NextRequest(
        `https://example.test/api/v1/webhooks/payments/stripe?x-vercel-protection-bypass=${"a".repeat(32)}`,
        {
          body: '{"id":"evt_protected"}',
          headers: { "content-type": "application/json", "stripe-signature": signature },
          method: "POST",
        },
      ),
    );
    expect(valid.status).toBe(204);
    expect(harness.processStripeWebhook).toHaveBeenCalledOnce();

    for (const query of [
      "x-vercel-protection-bypass=short",
      `x-vercel-protection-bypass=${"a".repeat(32)}&extra=1`,
      `wrong=${"a".repeat(32)}`,
    ]) {
      vi.clearAllMocks();
      const rejected = await stripeWebhook(
        new NextRequest(`https://example.test/api/v1/webhooks/payments/stripe?${query}`, {
          body: '{"id":"evt_rejected"}',
          headers: { "content-type": "application/json", "stripe-signature": signature },
          method: "POST",
        }),
      );
      expect(rejected.status).toBe(400);
      expect(harness.processStripeWebhook).not.toHaveBeenCalled();
    }
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

  it("keeps Stripe storage failures retryable without exposing details", async () => {
    harness.processStripeWebhook.mockRejectedValueOnce(new harness.CommerceError("unavailable"));
    const response = await stripeWebhook(
      request("stripe", '{"private":"stripe-canary"}', {
        "stripe-signature": `t=1784366400,v1=${"b".repeat(64)}`,
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("COMMERCE_UNAVAILABLE");
    expect(text).not.toContain("stripe-canary");
  });
});
