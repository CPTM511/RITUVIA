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
    expect(source).toContain('const deletionRole = "rituvia_privacy_deletion"');
    expect(source).toContain('process.env.APP_ENV !== "staging"');
    expect(source).toContain('process.env.VERCEL_ENV === "production"');
    expect(source).not.toMatch(/CREATE\s+(?:DATABASE|ROLE)/u);
  });
});
