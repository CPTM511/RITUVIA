import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const scriptPath = path.resolve(
  process.cwd(),
  "packages/db/scripts/configure-recovery-item-9-staging.mjs",
);

describe("Recovery Item 9 staging role configuration", () => {
  it("fails before database access without the exact staging authorization", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "Recovery Item 9 staging role configuration is not explicitly authorized.",
    );
  });

  it("pins the existing resource and role without creation authority", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain('const resourceName = "rituvia-recovery-staging"');
    expect(source).toContain('const databaseName = "neondb"');
    expect(source).toContain('const appRole = "rituvia_app"');
    expect(source).toContain('const deletionRole = "rituvia_privacy_deletion"');
    expect(source).toContain('process.env.APP_ENV !== "staging"');
    expect(source).toContain('process.env.VERCEL_ENV === "production"');
    expect(source).not.toMatch(/CREATE\s+(?:DATABASE|ROLE)/u);
    expect(source).not.toMatch(/GRANT\s+ALL/u);
  });

  it("grants and attests only the Item 9 application and deletion capabilities", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain(
      "GRANT SELECT, INSERT ON TABLE app_user, auth_identity, auth_challenge, account_session TO ${appRole}",
    );
    expect(source).toContain(
      "GRANT SELECT, INSERT ON TABLE wallet_identity, wallet_auth_challenge, wallet_auth_event TO ${appRole}",
    );
    expect(source).toContain(
      "GRANT SELECT, INSERT ON TABLE privacy_export, privacy_export_artifact, privacy_export_audit TO ${appRole}",
    );
    expect(source).toContain("const privacyExportReadTables = Object.freeze([");
    expect(source).toContain('"astrology_calculation"');
    expect(source).toContain('"payment_event"');
    expect(source).toContain('"revisit_reminder_subscription"');
    expect(source).toContain(
      'GRANT SELECT ON TABLE ${privacyExportReadTables.join(", ")} TO ${appRole}',
    );
    expect(source).toContain("has_table_privilege($1, 'auth_start_rate_limit', 'INSERT')");
    expect(source).toContain("has_table_privilege($2, 'privacy_deletion_request', 'INSERT')");
    expect(source).toContain("GRANT CONNECT ON DATABASE ${databaseName} TO ${deletionRole}");
    expect(source).toContain("has_database_privilege($2, current_database(), 'CONNECT')");
    expect(source).toContain(
      "GRANT SELECT (user_id) ON TABLE revisit_reminder_subscription TO ${deletionRole}",
    );
    expect(source).toContain(
      "GRANT SELECT ON TABLE birth_profile, astrology_calculation TO ${deletionRole}",
    );
    expect(source).toContain(
      "has_column_privilege($2, 'revisit_reminder_subscription', 'preference_state', 'UPDATE')",
    );
    expect(source).toContain(
      "has_column_privilege($2, 'birth_profile', 'payload_ciphertext', 'UPDATE')",
    );
    expect(source).toContain(
      "has_column_privilege($2, 'astrology_calculation', 'facts_ciphertext', 'UPDATE')",
    );
    expect(source).toContain("pg_has_role($1, $2, 'MEMBER')");
    expect(source).toContain("pg_has_role($2, $1, 'MEMBER')");
  });

  it("adds a subject-scoped deletion policy for reminder cancellation", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "packages/db",
        "prisma/migrations/202608060003_recovery_privacy_deletion_dependencies/migration.sql",
      ),
      "utf8",
    );
    expect(source).toContain(
      'ALTER TABLE "revisit_reminder_subscription" ENABLE ROW LEVEL SECURITY',
    );
    expect(source).toContain('TO "rituvia_privacy_deletion"');
    expect(source).toContain(
      '"user_id" IN (SELECT "user_id" FROM "privacy_deletion_authorized_user")',
    );
  });
});
