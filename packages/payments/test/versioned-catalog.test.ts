import { describe, expect, it } from "vitest";

import {
  CommerceError,
  parseCatalogVersionV1,
  rituviaCatalog20260723Local,
  selectActiveCatalogVersionV1,
} from "../src/index.js";

type MutableCatalog = Record<string, unknown> & {
  evidence: Record<string, unknown>;
  prices: Array<Record<string, unknown>>;
  products: Array<
    Record<string, unknown> & {
      localizations: Array<Record<string, unknown>>;
    }
  >;
};

const mutableCatalog = (): MutableCatalog =>
  JSON.parse(JSON.stringify(rituviaCatalog20260723Local)) as MutableCatalog;

describe("versioned commercial catalog", () => {
  it("matches the owner-approved product and price contract without activating production", () => {
    const catalog = rituviaCatalog20260723Local;
    expect(catalog).toMatchObject({
      approvalMode: "local_test",
      environment: "local",
      status: "active",
      supportedLocales: ["en", "zh-Hans"],
      version: "local.catalog.2026-07-23.v1",
    });
    expect(catalog.products).toHaveLength(21);
    expect(catalog.prices).toHaveLength(5);
    expect(
      Object.fromEntries(
        catalog.prices.map((price) => [
          price.productCode,
          {
            amountMinor: price.amountMinor,
            interval: price.billingInterval,
            providers: price.providerEligibility,
          },
        ]),
      ),
    ).toEqual({
      pack_6: {
        amountMinor: 599,
        interval: "one_time",
        providers: ["stripe", "coinbase_usdc_base"],
      },
      pack_15: {
        amountMinor: 1_199,
        interval: "one_time",
        providers: ["stripe", "coinbase_usdc_base"],
      },
      pack_40: {
        amountMinor: 2_499,
        interval: "one_time",
        providers: ["stripe", "coinbase_usdc_base"],
      },
      plus_annual: { amountMinor: 6_999, interval: "year", providers: ["stripe"] },
      plus_monthly: { amountMinor: 999, interval: "month", providers: ["stripe"] },
    });
    expect(catalog.products.find(({ code }) => code === "plus_annual")).toMatchObject({
      creditsPerMonth: 8,
      subscriptionInterval: "year",
    });
    expect(catalog.products.find(({ code }) => code === "golden_bowl")).toMatchObject({
      creditsCost: 8,
      fulfillmentCode: "sanctuary.golden_bowl",
      kind: "permanent_object",
    });
    expect(catalog.products.some(({ code }) => code === "golden_intention_bowl")).toBe(false);
  });

  it("keeps money off free, Credit-cost, and fulfillment products", () => {
    const directlyPriced = new Set(
      rituviaCatalog20260723Local.prices.map(({ productCode }) => productCode),
    );
    for (const product of rituviaCatalog20260723Local.products) {
      expect(directlyPriced.has(product.code)).toBe(
        product.kind === "credit_pack" || product.kind === "plus_plan",
      );
      expect(product.localizations.map(({ locale }) => locale)).toEqual(["en", "zh-Hans"]);
      expect(product.localizations.every(({ exactContents }) => exactContents.length > 0)).toBe(
        true,
      );
    }
  });

  it("is deeply frozen after strict parsing", () => {
    expect(Object.isFrozen(rituviaCatalog20260723Local)).toBe(true);
    expect(Object.isFrozen(rituviaCatalog20260723Local.products)).toBe(true);
    expect(Object.isFrozen(rituviaCatalog20260723Local.products[0]?.localizations)).toBe(true);
    expect(Object.isFrozen(rituviaCatalog20260723Local.prices[0]?.countryCodes)).toBe(true);
  });

  it("rejects unknown fields, incomplete locales, invalid term unions, and unsafe evidence", () => {
    const unknownField = mutableCatalog();
    unknownField.unreviewed = true;
    expect(() => parseCatalogVersionV1(unknownField)).toThrow(CommerceError);

    const missingLocale = mutableCatalog();
    missingLocale.products[0]!.localizations.pop();
    expect(() => parseCatalogVersionV1(missingLocale)).toThrow(CommerceError);

    const mixedTerms = mutableCatalog();
    mixedTerms.products[0]!.creditsCost = 1;
    expect(() => parseCatalogVersionV1(mixedTerms)).toThrow(CommerceError);

    const productionLocalEvidence = mutableCatalog();
    productionLocalEvidence.environment = "production";
    expect(() => parseCatalogVersionV1(productionLocalEvidence)).toThrow(CommerceError);
  });

  it("rejects fiat prices on Credit products, crypto subscriptions, and overlapping scopes", () => {
    const creditPriced = mutableCatalog();
    creditPriced.prices[0]!.productCode = "deep_one";
    expect(() => parseCatalogVersionV1(creditPriced)).toThrow(CommerceError);

    const cryptoSubscription = mutableCatalog();
    cryptoSubscription.prices.find(({ productCode }) => productCode === "plus_monthly")![
      "providerEligibility"
    ] = ["stripe", "coinbase_usdc_base"];
    expect(() => parseCatalogVersionV1(cryptoSubscription)).toThrow(CommerceError);

    const overlap = mutableCatalog();
    overlap.prices.push({
      ...overlap.prices[0]!,
      amountMinor: 600,
      priceId: "price.pack_6.usd.overlap",
      version: "overlap",
    });
    expect(() => parseCatalogVersionV1(overlap)).toThrow(CommerceError);
  });

  it("selects exactly one current catalog and fails closed on stale or ambiguous versions", () => {
    expect(
      selectActiveCatalogVersionV1([rituviaCatalog20260723Local], {
        asOf: "2026-07-25T00:00:00.000Z",
        environment: "local",
      }).version,
    ).toBe("local.catalog.2026-07-23.v1");
    expect(() =>
      selectActiveCatalogVersionV1([rituviaCatalog20260723Local], {
        asOf: "2099-01-01T00:00:00.000Z",
        environment: "local",
      }),
    ).toThrow(CommerceError);
    expect(() =>
      selectActiveCatalogVersionV1([rituviaCatalog20260723Local, rituviaCatalog20260723Local], {
        asOf: "2026-07-25T00:00:00.000Z",
        environment: "local",
      }),
    ).toThrow(CommerceError);
  });
});
