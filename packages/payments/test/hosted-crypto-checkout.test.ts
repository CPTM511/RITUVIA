import { describe, expect, it } from "vitest";

import {
  CommerceError,
  createHostedCryptoSettlementQuote,
  createMoney,
  formatUsdMinorAsUsdcAmountDecimal,
  hostedCryptoSettlementMatchesQuote,
  parseHostedCryptoReconciliationResultV1,
  parseHostedCryptoSettlement,
  parseHostedCryptoWebhookEventV1,
  validateCreateHostedCryptoCheckoutInput,
} from "../src/index.js";

describe("hosted crypto checkout contracts", () => {
  it("converts integer USD minor units into canonical USDC/Base decimals", () => {
    expect(formatUsdMinorAsUsdcAmountDecimal(1)).toBe("0.01");
    expect(formatUsdMinorAsUsdcAmountDecimal(100)).toBe("1");
    expect(formatUsdMinorAsUsdcAmountDecimal(1_234)).toBe("12.34");
    expect(formatUsdMinorAsUsdcAmountDecimal(1_230)).toBe("12.3");

    const quote = createHostedCryptoSettlementQuote(createMoney(1_234, "USD"));
    expect(quote).toEqual({
      assetCode: "USDC",
      networkCode: "base",
      usdAmount: createMoney(1_234, "USD"),
      usdcAmountDecimal: "12.34",
    });
  });

  it("rejects non-USD or recurring hosted crypto checkout inputs", () => {
    expect(() => createHostedCryptoSettlementQuote(createMoney(999, "EUR"))).toThrow(CommerceError);

    expect(() =>
      validateCreateHostedCryptoCheckoutInput({
        accountId: "account_11111111",
        amount: createMoney(999, "USD"),
        billingInterval: "month",
        cancelUrl: "https://rituvia.example/en/sanctuary",
        countryCode: "US",
        idempotencyKey: "idempotency_11111111",
        orderId: "order_11111111",
        productCode: "credits_6",
        productName: "Six credits",
        providerId: "coinbase_usdc_base",
        returnUrl: "https://rituvia.example/en/checkout/return",
      }),
    ).toThrow(CommerceError);
  });

  it("parses webhook and reconciliation settlements with the fixed USDC/Base allowlist", () => {
    const quote = createHostedCryptoSettlementQuote(createMoney(1_500, "USD"));
    const settlement = {
      amountDecimal: "15.00",
      assetCode: "USDC",
      networkCode: "base",
    } as const;

    expect(
      hostedCryptoSettlementMatchesQuote(
        parseHostedCryptoWebhookEventV1({
          eventId: "event_11111111",
          occurredAt: "2026-08-08T10:00:00.000Z",
          orderId: "order_11111111",
          providerCheckoutSessionId: "checkout_11111111",
          providerId: "coinbase_usdc_base",
          providerObjectId: "charge_11111111",
          settlement,
          status: "confirmed",
        }).settlement,
        quote,
      ),
    ).toBe(true);

    expect(
      hostedCryptoSettlementMatchesQuote(
        parseHostedCryptoSettlement({
          amountDecimal: "15",
          assetCode: "USDC",
          networkCode: "base",
        }),
        quote,
      ),
    ).toBe(true);

    expect(() =>
      parseHostedCryptoReconciliationResultV1({
        checkedAt: "2026-08-08T10:05:00.000Z",
        orderId: "order_11111111",
        providerCheckoutSessionId: "checkout_11111111",
        providerId: "coinbase_usdc_base",
        providerObjectId: "charge_11111111",
        settlement: { ...settlement, networkCode: "ethereum" },
        status: "confirmed",
      }),
    ).toThrow(CommerceError);
  });
});
