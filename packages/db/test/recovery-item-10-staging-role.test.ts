import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../scripts/configure-recovery-item-10-staging.mjs", import.meta.url),
  "utf8",
);

describe("Recovery Item 10 staging configuration boundary", () => {
  it("requires the exact protected-staging target and confirmation", () => {
    expect(source).toContain('const resourceName = "rituvia-recovery-staging"');
    expect(source).toContain('const databaseName = "neondb"');
    expect(source).toContain('process.env.APP_ENV !== "staging"');
    expect(source).toContain('process.env.VERCEL_ENV === "production"');
    expect(source).toContain("RITUVIA_ITEM10_STAGING_CONFIRM");
    expect(source).toContain("RITUVIA_ITEM10_ADMIN_DATABASE_URL");
  });

  it("rotates only the payment webhook role and denies privileged or destructive grants", () => {
    expect(source).toContain('const paymentWebhookRole = "rituvia_payment_webhook"');
    expect(source).toContain("if (!facts.paymentRoleExists)");
    expect(source).toContain("CREATE ROLE ${paymentWebhookRole}");
    expect(source).toContain("NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE");
    expect(source).toContain("ALTER ROLE ${paymentWebhookRole}");
    expect(source).toContain("LOGIN PASSWORD");
    expect(source).toContain("(!facts.paymentRoleExists && !facts.currentUserCanCreateRole)");
    expect(source).toContain("facts.paymentRolePrivileged");
    expect(source).toContain("paymentCanDeleteAudit");
    expect(source).not.toMatch(/GRANT\s+ALL/iu);
    expect(source).not.toMatch(/\bDROP\s+(?:DATABASE|TABLE|ROLE)\b/iu);
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/iu);
    expect(source).not.toContain("sk_live_");
  });

  it("binds the app only to the catalog reader group", () => {
    expect(source).toContain('const catalogReaderRole = "rituvia_catalog_reader"');
    expect(source).toContain("catalog_product_localization, catalog_price TO ${catalogReaderRole}");
    expect(source).toContain("GRANT ${catalogReaderRole} TO ${appRole}");
    expect(source).toContain("pg_has_role($4, $5, 'MEMBER')");
    expect(source).toContain('AS "appCanReadCatalog"');
    expect(source).toContain('AS "appCanMutateCatalog"');
    expect(source).toContain("!state.appCanReadCatalog");
    expect(source).toContain("state.appCanMutateCatalog");
  });

  it("binds the app only to the country-policy reader group", () => {
    expect(source).toContain('const countryPolicyReaderRole = "rituvia_country_policy_reader"');
    expect(source).toContain("country_policy_version TO ${countryPolicyReaderRole}");
    expect(source).toContain("GRANT ${countryPolicyReaderRole} TO ${appRole}");
    expect(source).toContain("pg_has_role($4, $6, 'MEMBER')");
    expect(source).toContain('AS "appCanReadCountryPolicy"');
    expect(source).toContain('AS "appCanMutateCountryPolicy"');
    expect(source).toContain("!state.appCanReadCountryPolicy");
    expect(source).toContain("state.appCanMutateCountryPolicy");
  });

  it("grants only the app checkout columns needed before signed fulfillment", () => {
    expect(source).toContain("commercial_payment_attempt_v2 TO ${appRole}");
    expect(source).toContain(
      "GRANT UPDATE (status, updated_at) ON TABLE commercial_order_v2 TO ${appRole}",
    );
    expect(source).toContain("provider_checkout_url, expires_at, updated_at)");
    expect(source).toContain('AS "appCanCreateCheckout"');
    expect(source).toContain('AS "appCanAttachCheckout"');
    expect(source).toContain('AS "appCanReadCommerceAccount"');
    expect(source).toContain('AS "appCanInsertPaymentEvent"');
    expect(source).toContain('AS "appCanInsertCreditLedger"');
    expect(source).toContain("!state.appCanCreateCheckout");
    expect(source).toContain("!state.appCanAttachCheckout");
    expect(source).toContain("state.appCanInsertPaymentEvent");
    expect(source).toContain("state.appCanInsertCreditLedger");
  });

  it("keeps catalog and country policy append-only and staging-only", () => {
    expect(source).toContain('environment: "staging"');
    expect(source).toContain('fiatApprovalReference: "D-098:OWN-017:stripe-test:item-10"');
    expect(source).toContain('providerReference: "stripe:test-mode:item-10"');
    expect(source).toContain("crypto: { assets: [], enabled: false, providerRoute: null }");
    expect(source).toContain("ON CONFLICT (version) DO NOTHING");
    expect(source).not.toMatch(/UPDATE\s+(?:catalog_|country_policy_version)/iu);
  });
});
