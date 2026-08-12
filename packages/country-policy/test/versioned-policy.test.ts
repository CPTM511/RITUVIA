import { describe, expect, it } from "vitest";

import {
  compareCountryPolicyVersions,
  evaluateCountryPolicyVersion,
  parseCountryPolicyVersionV1,
  type CountryPolicyEvaluationInputV2,
  type CountryPolicyVersionV1,
} from "../src/index.js";

const policy = (): CountryPolicyVersionV1 =>
  parseCountryPolicyVersionV1({
    approvalMode: "local_test",
    countryCode: "US",
    crypto: { assets: [], enabled: false, providerRoute: null },
    dataFlags: ["private_by_default"],
    effectiveFrom: "2026-07-25T00:00:00.000Z",
    effectiveUntil: "2026-08-25T00:00:00.000Z",
    environment: "local",
    evidence: {
      cryptoApprovalReference: null,
      fiatApprovalReference: "test:local:fiat",
      legalReference: "test:local:legal",
      ownerReference: "test:local:owner",
      providerReference: "test:local:provider",
    },
    fiat: {
      currencies: ["USD"],
      enabled: true,
      methods: ["card"],
      providerRoutes: ["local_hosted"],
      recurringAllowed: false,
    },
    legalDocumentVersions: [
      { documentCode: "privacy", version: "privacy.local.v1" },
      { documentCode: "terms", version: "terms.local.v1" },
    ],
    localeTags: ["en"],
    marketingFlags: ["no_fear_upsell"],
    minimumAge: 18,
    modalities: ["ritual", "tarot"],
    nextReviewAt: "2026-08-20T00:00:00.000Z",
    prohibitedClaims: ["guaranteed_outcome"],
    products: [{ access: "paid", productCode: "mindful_incense", subscriptionAllowed: false }],
    refundPolicyVersion: "refund.local.v1",
    requiredDisclosures: ["ai_generated", "reflective_not_predictive"],
    schemaVersion: "country-policy-version.v1",
    status: "paid",
    supersedesVersion: null,
    supportAvailable: true,
    taxMode: "not_applicable",
    version: "local.us.v1",
  });

const input = (): CountryPolicyEvaluationInputV2 => ({
  ageAttested: true,
  asOf: "2026-07-25T12:00:00.000Z",
  countryEvidence: {
    billingCountryCode: "US",
    declaredCountryCode: "US",
    geolocationConfidence: "low",
    geolocationCountryCode: "CA",
    localeCountryCode: "US",
  },
  environment: "local",
  modality: "ritual",
  payment: {
    currencyCode: "USD",
    kind: "fiat",
    method: "card",
    providerId: "local_hosted",
    recurring: false,
  },
  productCode: "mindful_incense",
});

describe("versioned country policy", () => {
  it("returns the immutable governing version and disclosure snapshot", () => {
    const decision = evaluateCountryPolicyVersion(input(), [policy()]);
    expect(decision).toMatchObject({
      allowed: true,
      reason: "allowed",
      snapshot: {
        countryEvidenceSource: "billing",
        policyVersion: "local.us.v1",
        requiredDisclosures: ["ai_generated", "reflective_not_predictive"],
        selectedCountryCode: "US",
      },
    });
    expect(Object.isFrozen(decision.snapshot?.legalDocumentVersions)).toBe(true);
  });

  it("fails closed for missing, overlapping, future, expired, disabled, and overdue versions", () => {
    expect(evaluateCountryPolicyVersion(input(), []).reason).toBe("no_country_policy");
    expect(evaluateCountryPolicyVersion(input(), [policy(), policy()]).reason).toBe(
      "ambiguous_policy",
    );
    expect(
      evaluateCountryPolicyVersion({ ...input(), asOf: "2026-07-24T23:59:59.999Z" }, [policy()])
        .reason,
    ).toBe("policy_inactive");
    expect(
      evaluateCountryPolicyVersion({ ...input(), asOf: "2026-08-25T00:00:00.000Z" }, [policy()])
        .reason,
    ).toBe("policy_expired");
    expect(
      evaluateCountryPolicyVersion(input(), [
        parseCountryPolicyVersionV1({
          ...policy(),
          evidence: {
            ...policy().evidence,
            fiatApprovalReference: null,
          },
          fiat: {
            currencies: [],
            enabled: false,
            methods: [],
            providerRoutes: [],
            recurringAllowed: false,
          },
          products: [],
          status: "disabled",
        }),
      ]).reason,
    ).toBe("policy_disabled");
    expect(
      evaluateCountryPolicyVersion({ ...input(), asOf: "2026-08-20T00:00:00.000Z" }, [policy()])
        .reason,
    ).toBe("policy_review_overdue");
  });

  it("uses an immutable successor as a kill switch and supports append-only rollback", () => {
    const disabled = parseCountryPolicyVersionV1({
      ...policy(),
      effectiveFrom: "2026-07-25T06:00:00.000Z",
      evidence: {
        ...policy().evidence,
        fiatApprovalReference: null,
      },
      fiat: {
        currencies: [],
        enabled: false,
        methods: [],
        providerRoutes: [],
        recurringAllowed: false,
      },
      products: [],
      status: "disabled",
      supersedesVersion: policy().version,
      version: "local.us.kill.v2",
    });
    expect(evaluateCountryPolicyVersion(input(), [policy(), disabled]).reason).toBe(
      "policy_disabled",
    );

    const rollback = parseCountryPolicyVersionV1({
      ...policy(),
      effectiveFrom: "2026-07-25T10:00:00.000Z",
      evidence: policy().evidence,
      supersedesVersion: disabled.version,
      version: "local.us.rollback.v3",
    });
    expect(evaluateCountryPolicyVersion(input(), [policy(), disabled, rollback])).toMatchObject({
      allowed: true,
      snapshot: { policyVersion: "local.us.rollback.v3" },
    });
  });

  it("does not let locale or weak IP evidence authorize a country", () => {
    const weak = {
      ...input(),
      countryEvidence: {
        billingCountryCode: null,
        declaredCountryCode: null,
        geolocationConfidence: "low" as const,
        geolocationCountryCode: "US",
        localeCountryCode: "US",
      },
    };
    expect(evaluateCountryPolicyVersion(weak, [policy()]).reason).toBe(
      "country_evidence_insufficient",
    );
  });

  it("denies conflicting billing, declared, or reliable geolocation evidence", () => {
    expect(
      evaluateCountryPolicyVersion(
        {
          ...input(),
          countryEvidence: {
            ...input().countryEvidence,
            declaredCountryCode: "CA",
          },
        },
        [policy()],
      ).reason,
    ).toBe("country_evidence_conflict");
    expect(
      evaluateCountryPolicyVersion(
        {
          ...input(),
          countryEvidence: {
            ...input().countryEvidence,
            geolocationConfidence: "reliable",
          },
        },
        [policy()],
      ).reason,
    ).toBe("country_evidence_conflict");
  });

  it.each([
    [{ ageAttested: false }, "age_requirement_not_met"],
    [{ modality: "astrology" }, "modality_not_approved"],
    [{ productCode: "unknown_product" }, "product_not_approved"],
    [{ payment: { ...input().payment!, providerId: "stripe" } }, "provider_not_approved"],
    [{ payment: { ...input().payment!, method: "hosted_wallet" as const } }, "method_not_approved"],
    [{ payment: { ...input().payment!, currencyCode: "EUR" } }, "currency_not_approved"],
    [{ payment: { ...input().payment!, recurring: true } }, "recurring_not_approved"],
  ] as const)("denies an unsupported request %#", (change, reason) => {
    expect(evaluateCountryPolicyVersion({ ...input(), ...change }, [policy()]).reason).toBe(reason);
  });

  it("prevents local evidence and unapproved payment owner references outside local", () => {
    expect(() => parseCountryPolicyVersionV1({ ...policy(), environment: "production" })).toThrow(
      "Country policy version is invalid.",
    );
    expect(() =>
      parseCountryPolicyVersionV1({
        ...policy(),
        approvalMode: "written",
        environment: "production",
        evidence: {
          cryptoApprovalReference: null,
          fiatApprovalReference: "OWN-999:wrong-gate",
          legalReference: "LEGAL-001:us",
          ownerReference: "OWN-999:wrong-gate",
          providerReference: "PROVIDER-001:stripe",
        },
      }),
    ).toThrow("Country policy version is invalid.");
  });

  it("requires independent written fiat and crypto approval evidence", () => {
    const production = parseCountryPolicyVersionV1({
      ...policy(),
      approvalMode: "written",
      crypto: { assets: ["USDC"], enabled: true, providerRoute: "coinbase_hosted" },
      environment: "production",
      evidence: {
        cryptoApprovalReference: "OWN-006:usdc-base",
        fiatApprovalReference: "OWN-002:stripe-us",
        legalReference: "LEGAL-001:us",
        ownerReference: "OWN-004:us-market",
        providerReference: "PROVIDER-001:us",
      },
      taxMode: "merchant_of_record",
      version: "production.us.v1",
    });
    const decision = evaluateCountryPolicyVersion(
      {
        ...input(),
        environment: "production",
        payment: {
          currencyCode: "USDC",
          kind: "crypto",
          method: null,
          providerId: "coinbase_hosted",
          recurring: false,
        },
      },
      [production],
    );
    expect(decision.reason).toBe("allowed");
    expect(decision).toMatchObject({
      allowed: true,
      snapshot: { policyVersion: "production.us.v1" },
    });
  });

  it("accepts the D-099 Stripe Live approval only for production fiat policy", () => {
    expect(
      parseCountryPolicyVersionV1({
        ...policy(),
        approvalMode: "written",
        environment: "production",
        evidence: {
          cryptoApprovalReference: null,
          fiatApprovalReference: "D-099:stripe-live:us:pack-6",
          legalReference: "D-099:legal:us",
          ownerReference: "D-099:owner:limited-production",
          providerReference: "D-099:stripe-account:verified",
        },
        version: "production.us.d-099.v1",
      }),
    ).toMatchObject({
      environment: "production",
      evidence: { fiatApprovalReference: "D-099:stripe-live:us:pack-6" },
    });
    expect(() =>
      parseCountryPolicyVersionV1({
        ...policy(),
        approvalMode: "written",
        environment: "staging",
        evidence: {
          cryptoApprovalReference: null,
          fiatApprovalReference: "D-099:stripe-live:us:pack-6",
          legalReference: "D-099:legal:us",
          ownerReference: "D-099:owner:limited-production",
          providerReference: "D-099:stripe-account:verified",
        },
      }),
    ).toThrow("Country policy version is invalid.");
  });

  it("accepts the exact Item 11 Coinbase sandbox approval only in staging", () => {
    const staging = {
      ...policy(),
      approvalMode: "written" as const,
      crypto: { assets: ["USDC"], enabled: true, providerRoute: "coinbase_usdc_base" },
      environment: "staging" as const,
      evidence: {
        cryptoApprovalReference: "D-098:OWNER:item-11:coinbase-sandbox:2026-08-08",
        fiatApprovalReference: "OWN-002:stripe-us",
        legalReference: "D-098:protected-staging",
        ownerReference: "D-098:OWNER:item-11",
        providerReference: "coinbase-business:sandbox",
      },
      version: "staging.us.coinbase-sandbox.item11.v1",
    };
    expect(parseCountryPolicyVersionV1(staging).environment).toBe("staging");
    expect(() => parseCountryPolicyVersionV1({ ...staging, environment: "production" })).toThrow(
      "Country policy version is invalid.",
    );
  });

  it("accepts the D-098 Stripe Test approval only in protected staging", () => {
    const written = {
      ...policy(),
      approvalMode: "written" as const,
      environment: "staging" as const,
      evidence: {
        ...policy().evidence,
        fiatApprovalReference: "D-098:OWN-017:stripe-test:item-10",
        legalReference: "D-098:protected-staging",
        ownerReference: "D-098:item-10",
        providerReference: "D-091:stripe-test-mode",
      },
    };
    expect(parseCountryPolicyVersionV1(written).environment).toBe("staging");
    expect(() => parseCountryPolicyVersionV1({ ...written, environment: "production" })).toThrow();
  });

  it("strictly rejects unknown, duplicate, unsorted, and private input without echoing it", () => {
    expect(() =>
      parseCountryPolicyVersionV1({
        ...policy(),
        requiredDisclosures: ["reflective_not_predictive", "ai_generated"],
      }),
    ).toThrow("Country policy version is invalid.");
    const canary = "private-policy-canary";
    try {
      parseCountryPolicyVersionV1({ ...policy(), canary });
    } catch (error) {
      expect(String(error)).not.toContain(canary);
    }
  });

  it("dry-runs a proposed version without mutating the current result", () => {
    const comparison = compareCountryPolicyVersions(input(), [policy()], []);
    expect(comparison).toMatchObject({
      changed: true,
      current: { allowed: true },
      proposed: { allowed: false, reason: "no_country_policy" },
      schemaVersion: "country-policy-dry-run.v1",
    });
  });
});
