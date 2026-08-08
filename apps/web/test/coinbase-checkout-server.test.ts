import { describe, expect, it, vi } from "vitest";

import { parseCountryPolicyVersionV1 } from "@rituvia/country-policy";
import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import type { CatalogVersionV1 } from "@rituvia/payments";

import { createCoinbaseCheckoutApplicationService } from "../server/coinbase-checkout";

const userId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const now = "2026-08-08T12:00:00.000Z";
const expiresAt = "2026-08-08T12:30:00.000Z";
const checkoutId = "0123456789abcdef01234567";
const checkoutUrl = `https://payments.coinbase.com/checkout/${checkoutId}`;
const recoveryScope = "D-098:OWNER:item-11:protected-staging" as const;
const request = Object.freeze({
  cancelPath: "/en/store",
  productCode: "pack_6",
  successPath: "/en/checkout/return",
});

const catalog = Object.freeze({
  ...rituviaCatalog20260723LocalData,
  effectiveFrom: "2026-08-08T00:00:00.000Z",
  environment: "staging" as const,
  prices: Object.freeze(
    rituviaCatalog20260723LocalData.prices
      .filter(({ productCode }) => productCode === "pack_6")
      .map((price) => ({
        ...price,
        effectiveFrom: "2026-08-08T00:00:00.000Z",
        priceId: "price.pack_6.usd.item11",
        providerEligibility: ["stripe", "coinbase_usdc_base"],
        refundPolicyVersion: "staging.item11.refund.v1",
        version: "2026-08-08.item11",
      })),
  ),
  products: Object.freeze(
    rituviaCatalog20260723LocalData.products.filter(({ code }) => code === "pack_6"),
  ),
  version: "recovery.item11.2026-08-08.v1",
}) as CatalogVersionV1;

const policy = (refundPolicyVersion = "staging.item11.refund.v1") =>
  parseCountryPolicyVersionV1({
    approvalMode: "written",
    countryCode: "US",
    crypto: {
      assets: ["USDC"],
      enabled: true,
      providerRoute: "coinbase_usdc_base",
    },
    dataFlags: ["private_by_default"],
    effectiveFrom: "2026-08-08T00:00:00.000Z",
    effectiveUntil: null,
    environment: "staging",
    evidence: {
      cryptoApprovalReference: "D-098:OWNER:item-11:coinbase-sandbox:2026-08-08",
      fiatApprovalReference: "D-098:OWN-017:stripe-test:item-10",
      legalReference: "D-098:protected-staging-no-public-legal-activation",
      ownerReference: "D-098:OWNER:item-11:protected-staging",
      providerReference: "coinbase-business:sandbox:usdc-base:item-11",
    },
    fiat: {
      currencies: ["USD"],
      enabled: true,
      methods: ["card"],
      providerRoutes: ["stripe"],
      recurringAllowed: true,
    },
    legalDocumentVersions: [
      { documentCode: "privacy", version: "staging_only.privacy.item9.v1" },
      { documentCode: "terms", version: "staging_only.terms.item11.v1" },
    ],
    localeTags: ["en"],
    marketingFlags: ["no_fear_upsell"],
    minimumAge: 18,
    modalities: ["ritual"],
    nextReviewAt: "2026-09-03T00:00:00.000Z",
    prohibitedClaims: ["guaranteed_outcome"],
    products: [{ access: "paid", productCode: "pack_6", subscriptionAllowed: false }],
    refundPolicyVersion,
    requiredDisclosures: ["coinbase_sandbox", "digital_contents", "reflective_not_predictive"],
    schemaVersion: "country-policy-version.v1",
    status: "paid",
    supersedesVersion: "staging.us.stripe-test.item10.v1",
    supportAvailable: true,
    taxMode: "not_applicable",
    version: "staging.us.coinbase-sandbox.item11.v1",
  });

const createdRecord = Object.freeze({
  amountMinor: 599,
  checkoutExpiresAt: expiresAt,
  checkoutId: null,
  checkoutUrl: null,
  countryCode: "US",
  currencyCode: "USD",
  orderId,
  productCode: "pack_6",
  providerIdempotencyKey: orderId,
  state: "created" as const,
});
const attachedRecord = Object.freeze({
  ...createdRecord,
  checkoutId,
  checkoutUrl,
  state: "checkout_created" as const,
});

const harness = (options?: {
  policyRefundVersion?: string;
  quoteAmountMinor?: number;
  replay?: boolean;
}) => {
  const createCheckout = vi.fn(async () => ({
    checkoutId,
    expiresAt,
    providerId: "coinbase_usdc_base",
    settlementQuote: {
      assetCode: "USDC" as const,
      networkCode: "base" as const,
      usdAmount: {
        amountMinor: options?.quoteAmountMinor ?? 599,
        currencyCode: "USD",
      },
      usdcAmountDecimal: options?.quoteAmountMinor === 1 ? "0.01" : "5.99",
    },
    url: checkoutUrl,
  }));
  const createOrReplayCoinbaseCheckout = vi.fn(async () => ({
    checkout: options?.replay === true ? attachedRecord : createdRecord,
    kind: options?.replay === true ? ("replayed" as const) : ("created" as const),
  }));
  const attachCoinbaseCheckout = vi.fn(async () => attachedRecord);
  const service = createCoinbaseCheckoutApplicationService({
    accounts: {
      getProfile: async () => ({
        ageAttested: true,
        emailVerified: true,
        id: userId,
        status: "active",
      }),
      resolveSession: async () => ({ userId }),
    },
    canonicalOrigin: "https://example.test",
    catalog: { readActive: async () => catalog },
    clock: () => now,
    countryPolicies: { read: async () => [policy(options?.policyRefundVersion)] },
    environment: "staging",
    paymentProvider: {
      createCheckout,
      providerId: "coinbase_usdc_base",
      reconcileCheckout: vi.fn(),
      verifyWebhook: vi.fn(),
    },
    persistence: { attachCoinbaseCheckout, createOrReplayCoinbaseCheckout },
    providerAccountFingerprint: `sha256:${"a".repeat(64)}`,
    recoveryScope,
  });
  return {
    attachCoinbaseCheckout,
    createCheckout,
    createOrReplayCoinbaseCheckout,
    service,
  };
};

describe("Coinbase Business USDC/Base sandbox checkout application service", () => {
  it("uses the Item 11 catalog and policy to create one hosted sandbox checkout", async () => {
    const test = harness();
    await expect(
      test.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).resolves.toEqual({
      checkoutUrl,
      expiresAt,
      kind: "created",
      networkCode: "base",
      orderId,
      productCode: "pack_6",
      settlementAsset: "USDC",
      state: "checkout_created",
      usdAmountMinor: 599,
    });
    expect(test.createOrReplayCoinbaseCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 599,
        catalogVersion: "recovery.item11.2026-08-08.v1",
        countryPolicyVersion: "staging.us.coinbase-sandbox.item11.v1",
        productCode: "pack_6",
        recoveryScope,
        refundPolicyVersion: "staging.item11.refund.v1",
        termsVersion: "staging_only.terms.item11.v1",
        userId,
      }),
    );
    expect(test.createCheckout).toHaveBeenCalledWith({
      accountId: userId,
      amount: { amountMinor: 599, currencyCode: "USD" },
      billingInterval: "one_time",
      cancelUrl: "https://example.test/en/store",
      countryCode: "US",
      idempotencyKey: orderId,
      orderId,
      productCode: "pack_6",
      productName: "6 Credits",
      providerId: "coinbase_usdc_base",
      returnUrl: `https://example.test/en/checkout/return?order_id=${orderId}`,
    });
    expect(test.attachCoinbaseCheckout).toHaveBeenCalledWith({
      attachedAt: now,
      checkoutExpiresAt: expiresAt,
      checkoutId,
      checkoutUrl,
      orderId,
      recoveryScope,
      userId,
    });
  });

  it("replays an unexpired attached sandbox checkout without another provider call", async () => {
    const test = harness({ replay: true });
    await expect(
      test.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).resolves.toMatchObject({ checkoutUrl, kind: "replayed", orderId });
    expect(test.createCheckout).not.toHaveBeenCalled();
    expect(test.attachCoinbaseCheckout).not.toHaveBeenCalled();
  });

  it("fails closed before fulfillment for request, policy, or quote mismatches", async () => {
    const malformed = harness();
    await expect(
      malformed.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { ...request, amountMinor: 1 },
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "input_invalid" });
    expect(malformed.createOrReplayCoinbaseCheckout).not.toHaveBeenCalled();
    expect(malformed.createCheckout).not.toHaveBeenCalled();

    const policyMismatch = harness({ policyRefundVersion: "staging.changed.refund.v1" });
    await expect(
      policyMismatch.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "not_eligible" });
    expect(policyMismatch.createCheckout).not.toHaveBeenCalled();

    const quoteMismatch = harness({ quoteAmountMinor: 1 });
    await expect(
      quoteMismatch.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(quoteMismatch.attachCoinbaseCheckout).not.toHaveBeenCalled();
  });
});
