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
    expect(source).toContain("ALTER ROLE ${paymentWebhookRole} WITH LOGIN PASSWORD");
    expect(source).toContain("paymentCanDeleteAudit");
    expect(source).not.toMatch(/GRANT\s+ALL/iu);
    expect(source).not.toMatch(/\bDROP\s+(?:DATABASE|TABLE|ROLE)\b/iu);
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/iu);
    expect(source).not.toContain("sk_live_");
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
