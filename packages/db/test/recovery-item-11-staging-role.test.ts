import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../scripts/configure-recovery-item-11-staging.mjs", import.meta.url),
  "utf8",
);

describe("Recovery Item 11 staging configuration boundary", () => {
  it("requires the exact protected-staging Neon target and confirmation", () => {
    expect(source).toContain('const resourceName = "rituvia-recovery-staging"');
    expect(source).toContain('const databaseName = "neondb"');
    expect(source).toContain('process.env.APP_ENV !== "staging"');
    expect(source).toContain('process.env.VERCEL_ENV === "production"');
    expect(source).toContain("RITUVIA_ITEM11_STAGING_CONFIRM");
    expect(source).toContain("RITUVIA_ITEM11_ADMIN_DATABASE_URL");
    expect(source).toContain("RITUVIA_ITEM11_AI_GENERATION_ROLE_PASSWORD");
  });

  it("rotates only the non-inheriting AI role and grants no broad privilege", () => {
    expect(source).toContain('const aiGenerationRole = "rituvia_ai_generation"');
    expect(source).toContain("if (!facts.aiRoleExists)");
    expect(source).toContain("CREATE ROLE ${aiGenerationRole}");
    expect(source).toContain("NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE");
    expect(source).toContain("ALTER ROLE ${aiGenerationRole} NOINHERIT LOGIN PASSWORD");
    expect(source).toContain("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public");
    expect(source).not.toMatch(/GRANT\s+ALL/iu);
    expect(source).not.toMatch(/\bDROP\s+(?:DATABASE|TABLE|ROLE)\b/iu);
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/iu);
  });

  it("limits runtime access to Credit reserve, consume, and release columns", () => {
    expect(source).toContain(
      "GRANT SELECT, INSERT ON TABLE credit_reservation, credit_ledger_entry",
    );
    expect(source).toContain("credit_allocation TO ${aiGenerationRole}");
    expect(source).toContain("GRANT SELECT ON TABLE credit_projection TO ${aiGenerationRole}");
    expect(source).toContain("GRANT UPDATE (status, consumed_at, released_at)");
    expect(source).toContain(
      "GRANT UPDATE (subscription_available, promotional_available, purchased_available",
    );
    expect(source).toContain('AS "aiCanDeleteCredits"');
    expect(source).toContain('AS "aiCanAccessProtectedTables"');
    expect(source).not.toMatch(/GRANT\s+UPDATE[^;]*credit_ledger_entry/isu);
  });

  it("adds append-only Item 11 policy data without a schema migration", () => {
    expect(source).toContain('const catalogVersion = "recovery.item11.2026-08-08.v1"');
    expect(source).toContain(
      'const countryPolicyVersion = "staging.us.coinbase-sandbox.item11.v1"',
    );
    expect(source).toContain(
      'cryptoApprovalReference: "D-098:OWNER:item-11:coinbase-sandbox:2026-08-08"',
    );
    expect(source).toContain('providerRoute: "coinbase_usdc_base"');
    expect(source).toContain('? ["stripe", "coinbase_usdc_base"] : ["stripe"]');
    expect(source).toContain(
      'const productCodes = Object.freeze(["deep_one", ...paidProductCodes])',
    );
    expect(source).toContain("ON CONFLICT (version) DO NOTHING");
    expect(source).toContain("migrationsApplied: 0");
    expect(source).not.toMatch(/prisma\s+.*migrate/iu);
    expect(source).not.toMatch(/UPDATE\s+(?:catalog_|country_policy_version)/iu);
  });
});
