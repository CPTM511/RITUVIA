import { describe, expect, it } from "vitest";

import {
  evaluateCountryPolicy,
  parseCountryPolicyRuleV1,
  type CountryPolicyEvaluationInput,
  type CountryPolicyRuleV1,
} from "../src/index.js";

const input = (): CountryPolicyEvaluationInput => ({
  adultAttested: true,
  asOf: "2026-07-18T12:00:00.000Z",
  countryCode: "US",
  currencyCode: "USD",
  environment: "local",
  paymentMethod: "card",
  productCode: "mindful_incense",
  providerId: "local_hosted",
});

const rule = (): CountryPolicyRuleV1 =>
  parseCountryPolicyRuleV1({
    approvalMode: "local_test",
    countryCode: "US",
    currencyCode: "USD",
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-08-18T00:00:00.000Z",
    environment: "local",
    evidence: {
      legalReference: "test:local-legal",
      ownerReference: "test:local-owner",
      providerReference: "test:local-provider",
    },
    minimumAge: 18,
    paymentMethod: "card",
    productCode: "mindful_incense",
    providerId: "local_hosted",
    schemaVersion: "country-policy-rule.v1",
    status: "approved",
    version: "local.us.v1",
  });

describe("country policy", () => {
  it("denies by default when no exact country policy exists", () => {
    expect(evaluateCountryPolicy(input(), [])).toEqual({
      allowed: false,
      reason: "no_country_policy",
      snapshot: null,
    });
  });

  it("allows exactly one active approved local combination and returns an immutable snapshot", () => {
    const decision = evaluateCountryPolicy(input(), [rule()]);
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
    expect(decision.snapshot?.ruleVersion).toBe("local.us.v1");
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.snapshot)).toBe(true);
  });

  it.each([
    ["currencyCode", "EUR", "currency_not_approved"],
    ["providerId", "stripe", "provider_not_approved"],
    ["productCode", "moonlit_lotus", "product_not_approved"],
    ["paymentMethod", "hosted_wallet", "method_not_approved"],
  ] as const)("denies an unapproved %s", (key, value, reason) => {
    expect(evaluateCountryPolicy({ ...input(), [key]: value }, [rule()]).reason).toBe(reason);
  });

  it("requires adult attestation", () => {
    expect(evaluateCountryPolicy({ ...input(), adultAttested: false }, [rule()]).reason).toBe(
      "adult_attestation_required",
    );
  });

  it("denies future, expired, disabled, and overlapping policies", () => {
    expect(
      evaluateCountryPolicy({ ...input(), asOf: "2026-07-17T23:59:59.999Z" }, [rule()]).reason,
    ).toBe("policy_inactive");
    expect(
      evaluateCountryPolicy({ ...input(), asOf: "2026-08-18T00:00:00.000Z" }, [rule()]).reason,
    ).toBe("policy_expired");
    expect(evaluateCountryPolicy(input(), [{ ...rule(), status: "disabled" }]).reason).toBe(
      "policy_not_approved",
    );
    expect(evaluateCountryPolicy(input(), [rule(), rule()]).reason).toBe("ambiguous_policy");
  });

  it("rejects local-test evidence outside the local environment", () => {
    expect(() =>
      parseCountryPolicyRuleV1({
        ...rule(),
        environment: "production",
      }),
    ).toThrow("Country policy rule is invalid.");
  });

  it("rejects unknown fields and malformed approval evidence without echoing input", () => {
    const canary = "private-policy-canary";
    expect(() => parseCountryPolicyRuleV1({ ...rule(), canary })).toThrow(
      "Country policy rule is invalid.",
    );
    try {
      parseCountryPolicyRuleV1({
        ...rule(),
        evidence: { ...rule().evidence, legalReference: canary },
      });
    } catch (error) {
      expect(String(error)).not.toContain(canary);
    }
  });

  it("fails closed when an unparsed runtime rule bypasses static types", () => {
    const malformed = {
      ...rule(),
      approvalMode: undefined,
    } as unknown as CountryPolicyRuleV1;
    expect(evaluateCountryPolicy(input(), [malformed])).toEqual({
      allowed: false,
      reason: "policy_not_approved",
      snapshot: null,
    });
  });
});
