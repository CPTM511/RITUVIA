import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../scripts/repair-recovery-item-11-country-policy.mjs", import.meta.url),
  "utf8",
);

describe("Recovery Item 11 country-policy repair boundary", () => {
  it("requires the exact protected-staging target, version, and confirmation", () => {
    expect(source).toContain('const resourceName = "rituvia-recovery-staging"');
    expect(source).toContain('const databaseName = "neondb"');
    expect(source).toContain(
      'const countryPolicyVersion = "staging.us.coinbase-sandbox.item11.v1"',
    );
    expect(source).toContain('process.env.APP_ENV !== "staging"');
    expect(source).toContain('process.env.VERCEL_ENV === "production"');
    expect(source).toContain("RITUVIA_ITEM11_POLICY_REPAIR_CONFIRM");
    expect(source).toContain("RITUVIA_ITEM11_ADMIN_DATABASE_URL");
  });

  it("accepts only the known invalid order and its sorted replacement", () => {
    expect(source).toContain("expectedInvalidProductCodes");
    expect(source).toContain("expectedCorrectedProductCodes");
    expect(source).toContain("parseCountryPolicyVersionV1(correctedPolicyDocument)");
    expect(source).toContain("found an unexpected product order");
    expect(source).toContain("outside the approved envelope");
  });

  it("locks and updates exactly one preconditioned policy document", () => {
    expect(source).toMatch(/WHERE version = \$1\s+FOR UPDATE/iu);
    expect(source).toMatch(
      /UPDATE country_policy_version\s+SET policy_document = \$3::jsonb\s+WHERE version = \$1\s+AND policy_document = \$2::jsonb/iu,
    );
    expect(source).toContain("updated.rowCount !== 1");
    expect(source).toContain("beforeSha256");
    expect(source).toContain("afterSha256");
    expect(source).not.toMatch(/\bDELETE\s+FROM\b/iu);
    expect(source).not.toMatch(/\bDROP\s+(?:DATABASE|SCHEMA|TABLE|ROLE)\b/iu);
    expect(source).not.toMatch(/\bALTER\s+(?:DATABASE|SCHEMA|TABLE|ROLE)\b/iu);
  });
});
