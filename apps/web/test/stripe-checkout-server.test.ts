import { describe, expect, it, vi } from "vitest";

import { parseCountryPolicyVersionV1 } from "@rituvia/country-policy";
import { rituviaCatalog20260723LocalData } from "@rituvia/domain";
import { parseCatalogVersionV1 } from "@rituvia/payments";

import { createStripeCheckoutApplicationService } from "../server/stripe-checkout";

const userId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const now = "2026-07-30T12:00:00.000Z";
const expiresAt = "2026-07-30T12:30:00.000Z";
const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test_12345678";
const request = Object.freeze({
  cancelPath: "/en/store",
  productCode: "pack_6",
  successPath: "/en/checkout/return",
});

const policy = (refundPolicyVersion = "test:local:refund.v1") =>
  parseCountryPolicyVersionV1({
    approvalMode: "local_test",
    countryCode: "US",
    crypto: { assets: [], enabled: false, providerRoute: null },
    dataFlags: ["private_by_default"],
    effectiveFrom: "2026-07-30T00:00:00.000Z",
    effectiveUntil: null,
    environment: "local",
    evidence: {
      cryptoApprovalReference: null,
      fiatApprovalReference: "test:d-091:fiat",
      legalReference: "test:d-091:legal",
      ownerReference: "test:d-091:owner",
      providerReference: "test:d-091:stripe",
    },
    fiat: {
      currencies: ["USD"],
      enabled: true,
      methods: ["card"],
      providerRoutes: ["stripe"],
      recurringAllowed: false,
    },
    legalDocumentVersions: [
      { documentCode: "privacy", version: "local.privacy.v1" },
      { documentCode: "terms", version: "local.terms.v1" },
    ],
    localeTags: ["en"],
    marketingFlags: ["no_fear_upsell"],
    minimumAge: 18,
    modalities: ["ritual"],
    nextReviewAt: "2099-01-01T00:00:00.000Z",
    prohibitedClaims: ["guaranteed_outcome"],
    products: [{ access: "paid", productCode: "pack_6", subscriptionAllowed: false }],
    refundPolicyVersion,
    requiredDisclosures: ["digital_contents", "reflective_not_predictive"],
    schemaVersion: "country-policy-version.v1",
    status: "paid",
    supersedesVersion: null,
    supportAvailable: true,
    taxMode: "not_applicable",
    version: "local.us.stripe-sandbox.v1",
  });

const createdRecord = Object.freeze({
  amountMinor: 599 as number,
  checkoutExpiresAt: "2026-07-31T12:00:00.000Z",
  checkoutId: null,
  checkoutUrl: null,
  countryCode: "US",
  currencyCode: "USD",
  orderId,
  productCode: "pack_6",
  providerIdempotencyKey: `stripe:${orderId}:1`,
  state: "created" as const,
});

const attachedRecord = Object.freeze({
  ...createdRecord,
  checkoutExpiresAt: expiresAt,
  checkoutId: "cs_test_12345678",
  checkoutUrl,
  state: "checkout_created" as const,
});

const harness = (options?: {
  policyRefundVersion?: string;
  replay?: boolean;
  unattachedReplayAmount?: number;
}) => {
  const createCheckout = vi.fn(async () => ({
    checkoutId: "cs_test_12345678",
    expiresAt,
    providerId: "stripe",
    url: checkoutUrl,
  }));
  const createOrReplayStripeCheckout = vi.fn(async () => {
    if (options?.replay === true) {
      return {
        checkout: attachedRecord,
        kind: "replayed" as const,
      };
    }
    return options?.unattachedReplayAmount === undefined
      ? {
          checkout: createdRecord,
          kind: "created" as const,
        }
      : {
          checkout: {
            ...createdRecord,
            amountMinor: options.unattachedReplayAmount,
          },
          kind: "replayed" as const,
        };
  });
  const attachStripeCheckout = vi.fn(async () => ({
    ...attachedRecord,
    amountMinor: options?.unattachedReplayAmount ?? attachedRecord.amountMinor,
  }));
  const service = createStripeCheckoutApplicationService({
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
    catalog: {
      readActive: async () => parseCatalogVersionV1(rituviaCatalog20260723LocalData),
    },
    clock: () => now,
    countryPolicies: {
      read: async () => [policy(options?.policyRefundVersion)],
    },
    environment: "local",
    providerAccountFingerprint: "acct_12345678",
    paymentProvider: {
      createCheckout,
      providerId: "stripe",
      verifyWebhook: vi.fn(),
    },
    persistence: {
      attachStripeCheckout,
      createOrReplayStripeCheckout,
    },
  });
  return {
    attachStripeCheckout,
    createCheckout,
    createOrReplayStripeCheckout,
    service,
  };
};

describe("Stripe sandbox checkout application service", () => {
  it("uses server catalog and policy values to create one hosted Test Mode checkout", async () => {
    const test = harness();

    await expect(
      test.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).resolves.toEqual({
      amountMinor: 599,
      checkoutUrl,
      currencyCode: "USD",
      expiresAt,
      kind: "created",
      orderId,
      productCode: "pack_6",
      state: "checkout_created",
    });
    expect(test.createOrReplayStripeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 599,
        catalogVersion: "local.catalog.2026-07-23.v1",
        countryCode: "US",
        countryPolicyVersion: "local.us.stripe-sandbox.v1",
        creditsGranted: 6,
        currencyCode: "USD",
        priceId: "price.pack_6.usd.2026-07-23",
        productCode: "pack_6",
        providerAccountFingerprint: "acct_12345678",
        refundPolicyVersion: "test:local:refund.v1",
        termsVersion: "local.terms.v1",
        userId,
      }),
    );
    expect(test.createCheckout).toHaveBeenCalledWith({
      accountId: userId,
      amount: { amountMinor: 599, currencyCode: "USD" },
      billingInterval: "one_time",
      cancelUrl: "https://example.test/en/store",
      countryCode: "US",
      idempotencyKey: `stripe:${orderId}:1`,
      orderId,
      productCode: "pack_6",
      productName: "6 Credits",
      providerId: "stripe",
      returnUrl: `https://example.test/en/checkout/return?order_id=${orderId}`,
    });
    expect(test.attachStripeCheckout).toHaveBeenCalledWith({
      attachedAt: now,
      checkoutExpiresAt: expiresAt,
      checkoutId: "cs_test_12345678",
      checkoutUrl,
      orderId,
      userId,
    });
  });

  it("replays an unexpired attached checkout without another provider call", async () => {
    const test = harness({ replay: true });

    await expect(
      test.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).resolves.toMatchObject({ checkoutUrl, kind: "replayed", orderId });
    expect(test.createCheckout).not.toHaveBeenCalled();
    expect(test.attachStripeCheckout).not.toHaveBeenCalled();
  });

  it("recovers an unattached attempt with its persisted amount instead of current catalog price", async () => {
    const test = harness({ unattachedReplayAmount: 499 });

    await expect(
      test.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).resolves.toMatchObject({ amountMinor: 499, kind: "replayed" });
    expect(test.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: { amountMinor: 499, currencyCode: "USD" },
        productCode: "pack_6",
      }),
    );
  });

  it("fails closed before persistence or provider use for request and policy mismatches", async () => {
    const malformed = harness();
    await expect(
      malformed.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request: { ...request, amountMinor: 1 },
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "input_invalid" });
    expect(malformed.createOrReplayStripeCheckout).not.toHaveBeenCalled();
    expect(malformed.createCheckout).not.toHaveBeenCalled();

    const mismatchedPolicy = harness({ policyRefundVersion: "local.refund.changed.v1" });
    await expect(
      mismatchedPolicy.service.createCheckout({
        idempotencyKey: "abcdefghijklmnopqrstuv",
        request,
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({ code: "not_eligible" });
    expect(mismatchedPolicy.createOrReplayStripeCheckout).not.toHaveBeenCalled();
    expect(mismatchedPolicy.createCheckout).not.toHaveBeenCalled();
  });
});
