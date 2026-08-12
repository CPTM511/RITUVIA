import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../scripts/configure-production-stripe-live.mjs", import.meta.url),
  "utf8",
);

describe("Production Stripe Live configuration boundary", () => {
  it("requires the exact production resource and keeps purchases disabled during configuration", () => {
    expect(source).toContain('const resourceName = "rituvia-production"');
    expect(source).toContain('const databaseName = "neondb"');
    expect(source).toContain('process.env.APP_ENV !== "production"');
    expect(source).toContain('process.env.VERCEL_ENV !== "production"');
    expect(source).toContain('process.env.RITUVIA_PAYMENT_PROVIDER !== "stripe"');
    expect(source).toContain("RITUVIA_PRODUCTION_STRIPE_CONFIRM");
    expect(source).toContain('process.env.RITUVIA_NEW_PURCHASES_ENABLED !== "false"');
    expect(source).toContain('process.env.RITUVIA_STRIPE_CHECKOUT_ENABLED !== "false"');
  });

  it("requires provider-backed live account, capability, descriptor, product, and price facts", () => {
    expect(source).toContain('stripeSecretKey.startsWith("rk_live_")');
    expect(source).toContain('await stripeRequest("account")');
    expect(source).toContain("stripeAccount.charges_enabled !== true");
    expect(source).toContain("stripeAccount.details_submitted !== true");
    expect(source).toContain('stripeCapabilities.card_payments !== "active"');
    expect(source).toContain("stripePaymentsSettings.statement_descriptor !== statementDescriptor");
    expect(source).toContain("stripePrice.livemode !== true");
    expect(source).toContain('stripePrice.type !== "one_time"');
    expect(source).toContain("stripePrice.unit_amount !== expectedProduct.amountMinor");
    expect(source).toContain(
      "stripeProduct.metadata.rituvia_product_code !== expectedProduct.code",
    );
    expect(source).toContain(
      "stripeProduct.metadata.rituvia_credits !== String(expectedProduct.creditsGranted)",
    );
    expect(source).toContain("RITUVIA_PRODUCTION_STRIPE_WEBHOOK_ENDPOINT_ID");
    expect(source).toContain("stripeWebhookEndpoint.livemode !== true");
    expect(source).toContain('stripeWebhookEndpoint.status !== "enabled"');
    expect(source).toContain("stripeWebhookEndpoint.url !== expectedWebhookUrl");
    expect(source).toContain(
      "stripeWebhookMetadata.rituvia_webhook_secret_sha256 !== sha256(stripeWebhookSecret)",
    );
  });

  it("activates only the exact United States English pack_6 scope", () => {
    expect(source).toContain('code: "pack_6"');
    expect(source).toContain("amountMinor: 599");
    expect(source).toContain("creditsGranted: 6");
    expect(source).toContain('countryCode: "US"');
    expect(source).toContain('localeTags: ["en"]');
    expect(source).toContain("minimumAge: 18");
    expect(source).toContain('providerEligibility: ["stripe"]');
    expect(source).toContain("crypto: { assets: [], enabled: false, providerRoute: null }");
    expect(source).toContain("recurringAllowed: false");
  });

  it("requires factual legal, support, refund, tax, and review inputs", () => {
    expect(source).toContain("BRAND_LEGAL_ENTITY");
    expect(source).toContain("BRAND_SUPPORT_EMAIL");
    expect(source).toContain("RITUVIA_PRODUCTION_LEGAL_EVIDENCE_REFERENCE");
    expect(source).toContain("RITUVIA_PRODUCTION_PRIVACY_VERSION");
    expect(source).toContain("RITUVIA_PRODUCTION_TERMS_VERSION");
    expect(source).toContain("RITUVIA_PRODUCTION_REFUND_POLICY_VERSION");
    expect(source).toContain("RITUVIA_PRODUCTION_TAX_MODE");
    expect(source).toContain("RITUVIA_PRODUCTION_NEXT_REVIEW_AT");
    expect(source).toContain("/(?:draft|placeholder|test)/iu");
    expect(source).toContain("legalReference !== `D-099:legal:us:${sha256(legalSeller)}`");
  });

  it("keeps registries append-only and application roles read-only", () => {
    expect(source).toContain("ON CONFLICT (version) DO NOTHING");
    expect(source).toContain('AS "appIsCatalogWriter"');
    expect(source).toContain('AS "appIsCountryPolicyWriter"');
    expect(source).toContain("state.appCanMutateCatalog");
    expect(source).toContain("state.appCanMutateCountryPolicy");
    expect(source).toContain('AS "paymentCanProcessWebhook"');
    expect(source).toContain('AS "paymentCanDeleteFinancial"');
    expect(source).toContain("!state.paymentCanProcessWebhook");
    expect(source).toContain("state.paymentCanDeleteFinancial");
    expect(source).toContain("persistedCatalog.rows.length !== 1");
    expect(source).toContain(
      "canonicalJson(persistedCatalogRow) !== canonicalJson(expectedCatalogRow)",
    );
    expect(source).not.toMatch(/UPDATE\s+(?:catalog_|country_policy_version)/iu);
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/iu);
    expect(source).not.toMatch(/\bDROP\s+(?:DATABASE|TABLE|ROLE)\b/iu);
    expect(source).not.toMatch(/GRANT\s+ALL/iu);
    expect(source).not.toContain("sk_live_");
    expect(source).toContain("env: { ...migrationEnvironment, DATABASE_URL: adminDatabaseUrl }");
    expect(source).not.toContain("env: { ...process.env, DATABASE_URL: adminDatabaseUrl }");
    expect(source).toContain("parsedAdminUrl = new URL(adminDatabaseUrl)");
  });
});
