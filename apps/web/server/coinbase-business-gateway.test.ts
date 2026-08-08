import { createHmac, generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  createRecoveryItem11CoinbaseBusinessGateway,
  mapCoinbaseBusinessReconciliationResult,
  mapCoinbaseBusinessVerifiedWebhookEvent,
  recoveryItem11CoinbaseSandboxUrl,
} from "./coinbase-business-gateway";

const now = "2026-08-08T12:00:00.000Z";
const orderId = "11111111-1111-4111-8111-111111111111";
const checkoutId = "0123456789abcdef01234567";
const apiKeyId = "organizations/rituvia/apiKeys/recovery-item-11";
const webhookSecret = "item11-webhook-secret-only";
const privateKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({
  format: "pem",
  type: "pkcs8",
}) as string;
const ed25519KeyPair = generateKeyPairSync("ed25519");
const ed25519PrivateJwk = ed25519KeyPair.privateKey.export({ format: "jwk" });
const ed25519KeyId = "22222222-2222-4222-8222-222222222222";
if (ed25519PrivateJwk.d === undefined || ed25519PrivateJwk.x === undefined) {
  throw new TypeError("Missing synthetic Ed25519 key material.");
}
const ed25519Secret = Buffer.concat([
  Buffer.from(ed25519PrivateJwk.d, "base64url"),
  Buffer.from(ed25519PrivateJwk.x, "base64url"),
]).toString("base64");

type GatewayFetchInput = Readonly<{
  body?: string;
  headers: Readonly<Record<string, string>>;
  method: "GET" | "POST";
  signal: AbortSignal;
}>;

const checkoutResponse = (status = "ACTIVE") => ({
  amount: "5.99",
  currency: "USDC",
  expiresAt: "2026-08-08T12:30:00.000Z",
  failRedirectUrl: "https://staging.example/en/plans",
  id: checkoutId,
  metadata: { orderId, productCode: "pack_6" },
  network: "base",
  status,
  successRedirectUrl: `https://staging.example/en/checkout/return?order_id=${orderId}`,
  updatedAt: "2026-08-08T12:00:01.000Z",
  url: `https://payments.coinbase.com/checkout/${checkoutId}`,
});

const gateway = (fetchImplementation = vi.fn()) =>
  createRecoveryItem11CoinbaseBusinessGateway({
    apiKeyId,
    apiKeySecret: privateKey,
    clock: () => now,
    fetch: fetchImplementation,
    recoveryScope: "D-098:OWNER:item-11:protected-staging",
    webhookSecret,
  });

it("accepts the current CDP UUID and raw Ed25519 key format", async () => {
  const fetchImplementation = vi.fn(async (input: string, init: GatewayFetchInput) => {
    void input;
    void init;
    return {
      json: async () => checkoutResponse(),
      ok: true,
      status: 200,
    };
  });
  const provider = createRecoveryItem11CoinbaseBusinessGateway({
    apiKeyId: ed25519KeyId,
    apiKeySecret: ed25519Secret,
    clock: () => now,
    fetch: fetchImplementation,
    recoveryScope: "D-098:OWNER:item-11:protected-staging",
    webhookSecret,
  });
  await provider.createCheckout({
    cancelUrl: "https://staging.example/en/plans",
    idempotencyKey: orderId,
    metadata: { orderId, productCode: "pack_6" },
    price: {
      assetCode: "USDC",
      currencyCode: "USD",
      networkCode: "base",
      usdAmountMinor: 599,
      usdcAmountDecimal: "5.99",
    },
    productName: "6 Credits",
    redirectUrl: `https://staging.example/en/checkout/return?order_id=${orderId}`,
  });
  const authorization = fetchImplementation.mock.calls[0]?.[1].headers.authorization;
  if (authorization === undefined) throw new TypeError("Missing synthetic authorization.");
  const [header, payload] = authorization.replace("Bearer ", "").split(".");
  expect(JSON.parse(Buffer.from(header!, "base64url").toString("utf8"))).toMatchObject({
    alg: "EdDSA",
    kid: ed25519KeyId,
    typ: "JWT",
  });
  expect(JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"))).toMatchObject({
    sub: ed25519KeyId,
    uri: "POST business.coinbase.com/sandbox/api/v1/checkouts",
  });
});

describe("Coinbase Business protected sandbox gateway", () => {
  it("uses only the exact sandbox endpoint with a URI-bound 120-second ES256 JWT", async () => {
    const fetchImplementation = vi.fn(async (input: string, init: GatewayFetchInput) => {
      void input;
      void init;
      return {
        json: async () => checkoutResponse(),
        ok: true,
        status: 200,
      };
    });
    const provider = gateway(fetchImplementation);
    await expect(
      provider.createCheckout({
        cancelUrl: "https://staging.example/en/plans",
        idempotencyKey: orderId,
        metadata: { orderId, productCode: "pack_6" },
        price: {
          assetCode: "USDC",
          currencyCode: "USD",
          networkCode: "base",
          usdAmountMinor: 599,
          usdcAmountDecimal: "5.99",
        },
        productName: "6 Credits",
        redirectUrl: `https://staging.example/en/checkout/return?order_id=${orderId}`,
      }),
    ).resolves.toMatchObject({ id: checkoutId });

    expect(recoveryItem11CoinbaseSandboxUrl).toBe(
      "https://business.coinbase.com/sandbox/api/v1/checkouts",
    );
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = fetchImplementation.mock.calls[0]!;
    expect(url).toBe(recoveryItem11CoinbaseSandboxUrl);
    expect(init.method).toBe("POST");
    expect(init.headers["x-idempotency-key"]).toBe(orderId);
    const authorization = init.headers.authorization;
    if (authorization === undefined) throw new TypeError("Missing synthetic authorization.");
    const token = authorization.replace("Bearer ", "");
    const [header, payload] = token.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString("utf8"))).toMatchObject({
      alg: "ES256",
      kid: apiKeyId,
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"))).toMatchObject({
      exp: Math.floor(Date.parse(now) / 1_000) + 120,
      iss: "cdp",
      nbf: Math.floor(Date.parse(now) / 1_000),
      sub: apiKeyId,
      uri: "POST business.coinbase.com/sandbox/api/v1/checkouts",
    });
  });

  it("reconciles only the same sandbox checkout and maps USDC on Base", async () => {
    const fetchImplementation = vi.fn(async (input: string, init: GatewayFetchInput) => {
      void input;
      void init;
      return {
        json: async () => checkoutResponse("COMPLETED"),
        ok: true,
        status: 200,
      };
    });
    const result = await gateway(fetchImplementation).reconcileCheckout({
      checkoutId,
      orderId,
      providerId: "coinbase_usdc_base",
    });
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      `${recoveryItem11CoinbaseSandboxUrl}/${checkoutId}`,
    );
    expect(mapCoinbaseBusinessReconciliationResult(result)).toMatchObject({
      orderId,
      settlement: { amountDecimal: "5.99", assetCode: "USDC", networkCode: "base" },
      status: "confirmed",
    });
  });

  it("verifies Coinbase signed headers and raw body before normalizing the event", async () => {
    const rawBody = new TextEncoder().encode(
      JSON.stringify({ ...checkoutResponse("COMPLETED"), eventType: "checkout.payment.success" }),
    );
    const timestamp = String(Math.floor(Date.parse(now) / 1_000));
    const headers = {
      "content-type": "application/json",
      "x-hook0-id": "hook0_12345678",
    };
    const signedHeaderNames = "content-type x-hook0-id";
    const signature = createHmac("sha256", webhookSecret)
      .update(
        `${timestamp}.${signedHeaderNames}.${headers["content-type"]}.${headers["x-hook0-id"]}.${new TextDecoder().decode(rawBody)}`,
        "utf8",
      )
      .digest("hex");
    const verified = await gateway().verifyWebhook({
      headers,
      nowSeconds: Number(timestamp),
      rawBody,
      signatureHeader: `t=${timestamp},h=${signedHeaderNames},v1=${signature}`,
      toleranceSeconds: 300,
    });
    expect(mapCoinbaseBusinessVerifiedWebhookEvent(verified)).toMatchObject({
      eventId: "hook0_12345678",
      orderId,
      settlement: { amountDecimal: "5.99", assetCode: "USDC", networkCode: "base" },
      status: "confirmed",
    });
  });

  it("rejects altered webhook bytes and treats refund failure as no entitlement change", async () => {
    const body = JSON.stringify({
      ...checkoutResponse("COMPLETED"),
      eventType: "checkout.refund.failed",
    });
    const timestamp = String(Math.floor(Date.parse(now) / 1_000));
    const headers = { "content-type": "application/json", "x-hook0-id": "hook0_refund_failed" };
    const names = "content-type x-hook0-id";
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${names}.application/json.hook0_refund_failed.${body}`, "utf8")
      .digest("hex");
    const provider = gateway();
    await expect(
      provider.verifyWebhook({
        headers,
        nowSeconds: Number(timestamp),
        rawBody: new TextEncoder().encode(`${body} `),
        signatureHeader: `t=${timestamp},h=${names},v1=${signature}`,
        toleranceSeconds: 300,
      }),
    ).rejects.toThrow();
    const verified = await provider.verifyWebhook({
      headers,
      nowSeconds: Number(timestamp),
      rawBody: new TextEncoder().encode(body),
      signatureHeader: `t=${timestamp},h=${names},v1=${signature}`,
      toleranceSeconds: 300,
    });
    expect(mapCoinbaseBusinessVerifiedWebhookEvent(verified).status).toBe("confirmed");
  });
});
