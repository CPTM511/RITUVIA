import { describe, expect, it, vi } from "vitest";

import {
  CommerceError,
  createMoney,
  type HostedCryptoReconciliationResultV1,
  type HostedCryptoWebhookEventV1,
} from "../src/index.js";
import {
  coinbaseBusinessHostedCheckoutOrigin,
  coinbaseBusinessWebhookSignatureHeaderName,
  createCoinbaseBusinessHostedCheckoutAdapter,
  type CoinbaseBusinessGateway,
} from "../src/adapters/coinbase-business-hosted-checkout.js";

const checkoutInput = () => ({
  accountId: "account_11111111",
  amount: createMoney(1_234, "USD"),
  cancelUrl: "https://rituvia.example/en/sanctuary",
  countryCode: "US",
  idempotencyKey: "idempotency_11111111",
  orderId: "order_11111111",
  productCode: "credits_6",
  productName: "Six credits",
  providerId: "coinbase_usdc_base",
  returnUrl: "https://rituvia.example/en/checkout/return",
});

const webhookEvent = (): HostedCryptoWebhookEventV1 => ({
  eventId: "event_11111111",
  occurredAt: "2026-08-08T10:00:00.000Z",
  orderId: "order_11111111",
  providerCheckoutSessionId: "checkout_11111111",
  providerId: "coinbase_usdc_base",
  providerObjectId: "charge_11111111",
  settlement: {
    amountDecimal: "12.34",
    assetCode: "USDC",
    networkCode: "base",
  },
  status: "confirmed",
});

const reconciliationResult = (): HostedCryptoReconciliationResultV1 => ({
  checkedAt: "2026-08-08T10:05:00.000Z",
  orderId: "order_11111111",
  providerCheckoutSessionId: "checkout_11111111",
  providerId: "coinbase_usdc_base",
  providerObjectId: "charge_11111111",
  settlement: {
    amountDecimal: "12.34",
    assetCode: "USDC",
    networkCode: "base",
  },
  status: "confirmed",
});

describe("Coinbase Business hosted checkout boundary", () => {
  it("maps server-owned USDC/Base checkout data into the injected gateway", async () => {
    const createCheckout = vi.fn(async () => ({
      expiresAt: "2026-08-08T10:30:00.000Z",
      id: "checkout_11111111",
      url: `${coinbaseBusinessHostedCheckoutOrigin}/buy/checkout_11111111`,
    }));
    const gateway: CoinbaseBusinessGateway = {
      createCheckout,
      reconcileCheckout: async () => reconciliationResult(),
      verifyWebhook: async () => webhookEvent(),
    };
    const adapter = createCoinbaseBusinessHostedCheckoutAdapter({
      clock: () => "2026-08-08T10:00:00.000Z",
      gateway,
      mapReconciliationResult: (value) => value as HostedCryptoReconciliationResultV1,
      mapVerifiedWebhookEvent: (value) => value as HostedCryptoWebhookEventV1,
    });

    await expect(adapter.createCheckout(checkoutInput())).resolves.toEqual({
      checkoutId: "checkout_11111111",
      expiresAt: "2026-08-08T10:30:00.000Z",
      providerId: "coinbase_usdc_base",
      settlementQuote: {
        assetCode: "USDC",
        networkCode: "base",
        usdAmount: createMoney(1_234, "USD"),
        usdcAmountDecimal: "12.34",
      },
      url: `${coinbaseBusinessHostedCheckoutOrigin}/buy/checkout_11111111`,
    });

    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "idempotency_11111111",
        metadata: {
          orderId: "order_11111111",
          productCode: "credits_6",
        },
        price: {
          assetCode: "USDC",
          currencyCode: "USD",
          networkCode: "base",
          usdAmountMinor: 1_234,
          usdcAmountDecimal: "12.34",
        },
      }),
    );
  });

  it("passes raw bytes and the exact Coinbase signature header into the verifier", async () => {
    const verifyWebhook = vi.fn(async () => ({ verified: true }));
    const gateway: CoinbaseBusinessGateway = {
      createCheckout: async () => ({
        expiresAt: "2026-08-08T10:30:00.000Z",
        id: "checkout_11111111",
        url: `${coinbaseBusinessHostedCheckoutOrigin}/buy/checkout_11111111`,
      }),
      reconcileCheckout: async () => reconciliationResult(),
      verifyWebhook,
    };
    const adapter = createCoinbaseBusinessHostedCheckoutAdapter({
      clock: () => "2026-08-08T10:00:00.000Z",
      gateway,
      mapReconciliationResult: (value) => value as HostedCryptoReconciliationResultV1,
      mapVerifiedWebhookEvent: () => webhookEvent(),
    });
    const rawBody = new TextEncoder().encode('{"id":"evt_1"}');

    await expect(
      adapter.verifyWebhook({
        headers: {
          [coinbaseBusinessWebhookSignatureHeaderName]: "t=1723111200,v1=signature",
        },
        rawBody,
      }),
    ).resolves.toEqual(webhookEvent());

    expect(verifyWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBody: expect.any(Uint8Array),
        signatureHeader: "t=1723111200,v1=signature",
        toleranceSeconds: 300,
      }),
    );
  });

  it("rejects unsupported provider results on webhook and reconciliation boundaries", async () => {
    const gateway: CoinbaseBusinessGateway = {
      createCheckout: async () => ({
        expiresAt: "2026-08-08T10:30:00.000Z",
        id: "checkout_11111111",
        url: `${coinbaseBusinessHostedCheckoutOrigin}/buy/checkout_11111111`,
      }),
      reconcileCheckout: async () => ({ verified: true }),
      verifyWebhook: async () => ({ verified: true }),
    };
    const adapter = createCoinbaseBusinessHostedCheckoutAdapter({
      clock: () => "2026-08-08T10:00:00.000Z",
      gateway,
      mapReconciliationResult: () =>
        ({
          ...reconciliationResult(),
          settlement: {
            amountDecimal: "12.34",
            assetCode: "USDC",
            networkCode: "ethereum",
          },
        }) as unknown as HostedCryptoReconciliationResultV1,
      mapVerifiedWebhookEvent: () =>
        ({
          ...webhookEvent(),
          providerId: "stripe",
        }) as unknown as HostedCryptoWebhookEventV1,
    });

    await expect(
      adapter.verifyWebhook({
        headers: { [coinbaseBusinessWebhookSignatureHeaderName]: "t=1723111200,v1=signature" },
        rawBody: new TextEncoder().encode('{"id":"evt_1"}'),
      }),
    ).rejects.toMatchObject({ code: "WEBHOOK_INVALID" });

    await expect(
      adapter.reconcileCheckout({
        checkoutId: "checkout_11111111",
        orderId: "order_11111111",
        providerId: "coinbase_usdc_base",
      }),
    ).rejects.toMatchObject({ code: "WEBHOOK_INVALID" });

    await expect(
      adapter.verifyWebhook({
        headers: {},
        rawBody: new TextEncoder().encode('{"id":"evt_1"}'),
      }),
    ).rejects.toBeInstanceOf(CommerceError);
  });
});
