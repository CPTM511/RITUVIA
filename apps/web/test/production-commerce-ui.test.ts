import { describe, expect, it } from "vitest";

import { parseCommerceCatalog } from "../app/_components/recovery-commerce";
import { getCommerceMessages } from "../app/_i18n/commerce-messages";

const catalog = (environment: string) => ({
  environment,
  prices: [
    {
      amountMinor: 599,
      billingInterval: "one_time",
      productCode: "pack_6",
      productVersion: "2026-07-23",
    },
  ],
  products: [
    {
      code: "pack_6",
      kind: "credit_pack",
      localizations: [
        {
          description: "Six Credits for enhanced reflective experiences.",
          exactContents: ["6 Credits"],
          locale: "en",
          title: "6 Credits",
        },
      ],
      version: "2026-07-23",
    },
  ],
  version: `${environment}.catalog.v1`,
});

describe("production commerce UI", () => {
  it("accepts production and protected-staging catalogs only", () => {
    expect(parseCommerceCatalog(catalog("production")).environment).toBe("production");
    expect(parseCommerceCatalog(catalog("staging")).environment).toBe("staging");
    expect(() => parseCommerceCatalog(catalog("preview"))).toThrowError(
      "Invalid commerce catalog response.",
    );
  });

  it("uses truthful Live Checkout copy in production", () => {
    const live = getCommerceMessages("en", "live").recoveryCommerce;

    expect(live.checkout).toBe("Continue to secure Stripe Checkout");
    expect(live.checkoutPending).not.toContain("Test");
    expect(live.plansIntroduction).not.toContain("test-only");
    expect(live.safetyNote).toContain("Stripe's hosted page");
    expect(live.safetyNote).not.toContain("Protected Staging");
  });

  it("preserves explicit Test Mode copy outside production", () => {
    const test = getCommerceMessages("en", "test").recoveryCommerce;

    expect(test.checkout).toContain("Stripe Test Checkout");
    expect(test.safetyNote).toContain("Protected Staging only");
  });
});
