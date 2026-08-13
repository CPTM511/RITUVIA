import { describe, expect, it } from "vitest";

import {
  evaluateCountryPolicyVersion,
  parseCountryPolicyVersionV1,
  type CountryPolicyDecisionV2,
} from "@rituvia/country-policy";

import {
  evaluatePaymentRouteControl,
  type PaymentActivationControlsV1,
  type PaymentRouteV1,
} from "../src/index.js";

const evaluatedAt = "2026-08-03T00:00:00.000Z";
const route: PaymentRouteV1 = Object.freeze({
  countryCode: "US",
  currencyCode: "USD",
  evaluatedAt,
  kind: "fiat",
  method: "card",
  providerId: "stripe",
  recurring: false,
});

const flag = (
  flagKey: "market.country_activation" | "payments.crypto_checkout" | "payments.fiat_checkout",
  enabled: boolean,
) =>
  Object.freeze({
    enabled,
    evaluatedAt,
    flagKey,
    reason: enabled ? ("enabled" as const) : ("default-off" as const),
    registryVersion: 3,
    source: enabled ? ("version" as const) : ("default" as const),
    version: enabled ? 1 : null,
  });

const activation = (countryEnabled = true, checkoutEnabled = true): PaymentActivationControlsV1 =>
  Object.freeze({
    checkoutActivation: Object.freeze({
      countryCode: "US",
      evaluation: flag("payments.fiat_checkout", checkoutEnabled),
    }),
    countryActivation: Object.freeze({
      countryCode: "US",
      evaluation: flag("market.country_activation", countryEnabled),
    }),
  });

const policyVersion = (
  overrides: Readonly<{
    methods?: readonly ("card" | "hosted_wallet")[];
    providerRoutes?: readonly string[];
  }> = {},
) =>
  parseCountryPolicyVersionV1({
    approvalMode: "local_test",
    countryCode: "US",
    crypto: { assets: [], enabled: false, providerRoute: null },
    dataFlags: ["private_by_default"],
    effectiveFrom: "2026-08-01T00:00:00.000Z",
    effectiveUntil: null,
    environment: "local",
    evidence: {
      cryptoApprovalReference: null,
      fiatApprovalReference: "test:rit-075:fiat",
      legalReference: "test:rit-075:legal",
      ownerReference: "test:rit-075:owner",
      providerReference: "test:rit-075:provider",
    },
    fiat: {
      currencies: ["USD"],
      enabled: true,
      methods: overrides.methods ?? ["card"],
      providerRoutes: overrides.providerRoutes ?? ["stripe"],
      recurringAllowed: false,
    },
    legalDocumentVersions: [{ documentCode: "terms", version: "local.terms.v1" }],
    localeTags: ["en"],
    marketingFlags: [],
    minimumAge: 18,
    modalities: ["ritual"],
    nextReviewAt: "2027-08-01T00:00:00.000Z",
    prohibitedClaims: ["guaranteed_outcome"],
    products: [{ access: "paid", productCode: "pack_6", subscriptionAllowed: false }],
    refundPolicyVersion: "local.refund.v1",
    requiredDisclosures: ["digital_contents"],
    schemaVersion: "country-policy-version.v1",
    status: "paid",
    supersedesVersion: null,
    supportAvailable: true,
    taxMode: "not_applicable",
    version: "local.us.rit-075.v1",
  });

const policy = policyVersion();

const policyDecision = (
  request: PaymentRouteV1 = route,
  versions = [policy],
): CountryPolicyDecisionV2 =>
  evaluateCountryPolicyVersion(
    {
      ageAttested: true,
      asOf: request.evaluatedAt,
      countryEvidence: {
        billingCountryCode: request.countryCode,
        declaredCountryCode: request.countryCode,
        geolocationConfidence: "none",
        geolocationCountryCode: null,
        localeCountryCode: null,
      },
      environment: "local",
      modality: "ritual",
      payment: {
        currencyCode: request.currencyCode,
        kind: request.kind,
        method: request.method,
        providerId: request.providerId,
        recurring: request.recurring,
      },
      productCode: "pack_6",
    },
    versions,
  );

const decide = (overrides: Partial<Parameters<typeof evaluatePaymentRouteControl>[0]> = {}) =>
  evaluatePaymentRouteControl({
    activation: activation(),
    fallbackProviderIds: [],
    policyDecision: policyDecision(),
    route,
    ...overrides,
  });

describe("payment route control", () => {
  it("defaults country and checkout activation to safe-off before provider use", () => {
    expect(decide({ activation: activation(false, true) })).toMatchObject({
      allowed: false,
      fallbackProviderId: null,
      reason: "country_disabled",
      route: null,
    });
    expect(decide({ activation: activation(true, false) })).toMatchObject({
      allowed: false,
      fallbackProviderId: null,
      reason: "checkout_disabled",
      route: null,
    });
  });

  it("authorizes only the exact country, provider, method, currency, kind, and recurrence route", () => {
    const decision = decide();
    expect(decision).toEqual({
      allowed: true,
      evidence: {
        checkoutFlagKey: "payments.fiat_checkout",
        checkoutFlagVersion: 1,
        countryFlagVersion: 1,
        evaluatedAt,
        policyVersion: "local.us.rit-075.v1",
        registryVersion: 3,
        schemaVersion: "payment-route-control.v1",
      },
      fallbackProviderId: null,
      reason: "authorized",
      route,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.evidence)).toBe(true);
    expect(Object.isFrozen(decision.route)).toBe(true);
  });

  it("forbids every configured fallback even when the primary route is approved", () => {
    expect(decide({ fallbackProviderIds: ["local_hosted"] })).toMatchObject({
      allowed: false,
      fallbackProviderId: null,
      reason: "fallback_forbidden",
      route: null,
    });
  });

  it.each([
    ["provider_not_approved", "provider_disabled"],
    ["method_not_approved", "method_disabled"],
    ["policy_disabled", "policy_denied"],
  ] as const)("maps %s to a finite safe-off result", (policyReason, expectedReason) => {
    expect(
      decide({ policyDecision: { allowed: false, reason: policyReason, snapshot: null } }),
    ).toMatchObject({ allowed: false, reason: expectedReason, route: null });
  });

  it("does not accept a different provider or method hidden behind an allowed snapshot", () => {
    expect(decide({ route: { ...route, providerId: "local_hosted" } })).toMatchObject({
      allowed: false,
      reason: "provider_disabled",
    });
    expect(decide({ route: { ...route, method: "hosted_wallet" } })).toMatchObject({
      allowed: false,
      reason: "method_disabled",
    });
  });

  it("does not substitute another approved provider or method for the requested route", () => {
    expect(
      decide({
        policyDecision: policyDecision(route, [
          policyVersion({ providerRoutes: ["local_hosted"] }),
        ]),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "provider_disabled",
    });
    expect(
      decide({
        policyDecision: policyDecision(route, [policyVersion({ methods: ["hosted_wallet"] })]),
      }),
    ).toMatchObject({
      allowed: false,
      reason: "method_disabled",
    });
  });

  it("requires the correct crypto activation flag and keeps recurring crypto invalid", () => {
    const cryptoRoute = {
      ...route,
      currencyCode: "USDC",
      kind: "crypto" as const,
      method: null,
      providerId: "coinbase_hosted",
    };
    expect(
      decide({
        activation: {
          checkoutActivation: {
            countryCode: "US",
            evaluation: flag("payments.crypto_checkout", false),
          },
          countryActivation: activation().countryActivation,
        },
        policyDecision: { allowed: false, reason: "crypto_not_approved", snapshot: null },
        route: cryptoRoute,
      }),
    ).toMatchObject({ allowed: false, reason: "checkout_disabled" });
    expect(decide({ route: { ...cryptoRoute, recurring: true } })).toMatchObject({
      allowed: false,
      reason: "invalid_input",
    });
  });

  it("rejects drifted flag scope, time, registry, unknown fields, and malformed policy", () => {
    expect(
      decide({
        activation: {
          ...activation(),
          countryActivation: { ...activation().countryActivation, countryCode: "CA" },
        },
      }),
    ).toMatchObject({ allowed: false, reason: "invalid_input" });
    expect(
      decide({
        activation: {
          ...activation(),
          checkoutActivation: {
            ...activation().checkoutActivation,
            evaluation: {
              ...activation().checkoutActivation.evaluation,
              registryVersion: 4,
            },
          },
        },
      }),
    ).toMatchObject({ allowed: false, reason: "invalid_input" });
    expect(
      decide({
        activation: {
          ...activation(),
          checkoutActivation: {
            ...activation().checkoutActivation,
            evaluation: {
              ...activation().checkoutActivation.evaluation,
              source: "default",
              version: null,
            },
          },
        },
      }),
    ).toMatchObject({ allowed: false, reason: "invalid_input" });
    expect(
      evaluatePaymentRouteControl({
        activation: activation(),
        fallbackProviderIds: [],
        policyDecision: policyDecision(),
        privateCanary: "must-not-pass",
        route,
      } as never),
    ).toMatchObject({ allowed: false, reason: "invalid_input" });
    expect(
      decide({
        policyDecision: { allowed: true, reason: "allowed", snapshot: null } as never,
      }),
    ).toMatchObject({ allowed: false, reason: "invalid_input" });
  });
});
