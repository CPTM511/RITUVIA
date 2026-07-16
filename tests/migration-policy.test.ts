import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  auditHistoricalMigrations,
  auditMigrationFiles,
  migrationBaselineFromEvent,
  parseMigrationManifest,
  type MigrationManifest,
} from "../scripts/migration-policy.js";

const migrationPath = "migrations/202607160001_foundation/migration.sql";
const lockPath = "migrations/migration_lock.toml";
const safeSql = "-- additive migration\nBEGIN;\nCREATE TABLE example (id UUID);\nCOMMIT;\n";
const lock = 'provider = "postgresql"\n';
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

const manifest = Object.freeze({
  files: Object.freeze({
    [lockPath]: digest(lock),
    [migrationPath]: digest(safeSql),
  }),
  policyVersion: 1,
}) satisfies MigrationManifest;

describe("migration policy", () => {
  it("accepts an exact, additive, transactional migration set", () => {
    expect(auditMigrationFiles({ [lockPath]: lock, [migrationPath]: safeSql }, manifest)).toEqual(
      [],
    );
  });

  it("detects tampering, unlisted files, and missing files", () => {
    const findings = auditMigrationFiles(
      {
        [migrationPath]: `${safeSql}-- tampered`,
        "migrations/202607160002_extra/migration.sql": safeSql,
      },
      manifest,
    );
    expect(findings).toEqual(
      expect.arrayContaining([
        { path: migrationPath, rule: "checksum-mismatch" },
        { path: lockPath, rule: "missing-file" },
        { path: "migrations/202607160002_extra/migration.sql", rule: "unlisted-file" },
      ]),
    );
  });

  it("rejects historical migration edits even when the manifest checksum is updated", () => {
    const rewritten = "-- rewritten\nBEGIN;\nCREATE TABLE example (id UUID);\nCOMMIT;\n";
    const rewrittenManifest = {
      files: { [lockPath]: digest(lock), [migrationPath]: digest(rewritten) },
      policyVersion: 1,
    } satisfies MigrationManifest;
    const current = { [lockPath]: lock, [migrationPath]: rewritten };
    expect(auditMigrationFiles(current, rewrittenManifest)).toEqual([]);
    expect(
      auditHistoricalMigrations(current, { [lockPath]: lock, [migrationPath]: safeSql }),
    ).toEqual([{ path: migrationPath, rule: "historical-file-modified" }]);
  });

  it("does not treat comments or string literals as executable destructive SQL", () => {
    const documentedSql =
      "-- DROP TABLE is forbidden\nBEGIN;\nCREATE TABLE example (note TEXT DEFAULT 'DELETE FROM example');\nCOMMIT;\n";
    const documentedManifest = {
      files: { [migrationPath]: digest(documentedSql) },
      policyVersion: 1,
    } satisfies MigrationManifest;
    expect(auditMigrationFiles({ [migrationPath]: documentedSql }, documentedManifest)).toEqual([]);
  });

  it("rejects destructive stored routines even when their bodies are dollar quoted", () => {
    const routineSql =
      "-- unsafe routine\nBEGIN;\nCREATE FUNCTION wipe() RETURNS void LANGUAGE plpgsql AS $$ BEGIN EXECUTE 'DROP TABLE example'; END $$;\nCALL wipe();\nCOMMIT;\n";
    const routineManifest = {
      files: { [migrationPath]: digest(routineSql) },
      policyVersion: 1,
    } satisfies MigrationManifest;
    expect(auditMigrationFiles({ [migrationPath]: routineSql }, routineManifest)).toEqual(
      expect.arrayContaining([
        { path: migrationPath, rule: "routine-administration" },
        { path: migrationPath, rule: "routine-execution" },
      ]),
    );
  });

  it("selects immutable baselines from the trusted Actions event shape", () => {
    const base = "a".repeat(40);
    const before = "b".repeat(40);
    expect(
      migrationBaselineFromEvent("pull_request", { pull_request: { base: { sha: base } } }),
    ).toBe(base);
    expect(migrationBaselineFromEvent("push", { before })).toBe(before);
    expect(migrationBaselineFromEvent("workflow_dispatch", {})).toBe("HEAD^1");
    expect(migrationBaselineFromEvent("push", { before: "not-a-sha" })).toBeUndefined();
    expect(migrationBaselineFromEvent("push", { before: "0".repeat(40) })).toBeUndefined();
  });

  it.each([
    "DROP TABLE example",
    "DROP SCHEMA public",
    "ALTER TABLE example DROP CONSTRAINT example_pkey",
    "TRUNCATE example",
    "DELETE FROM example",
    "COPY example TO PROGRAM 'unsafe'",
    "ALTER SYSTEM SET shared_preload_libraries = 'unsafe'",
    "CREATE ROLE unsafe SUPERUSER",
    "SET ROLE unsafe",
    "SELECT pg_read_file('/etc/passwd')",
    "CASCADE",
  ])("rejects destructive SQL containing %s", (statement) => {
    const unsafeSql = `-- unsafe\nBEGIN;\n${statement};\nCOMMIT;\n`;
    const unsafeManifest = {
      files: { [migrationPath]: digest(unsafeSql) },
      policyVersion: 1,
    } satisfies MigrationManifest;
    expect(auditMigrationFiles({ [migrationPath]: unsafeSql }, unsafeManifest)).not.toEqual([]);
  });

  it("rejects malformed manifests", () => {
    expect(() => parseMigrationManifest({ policyVersion: 2, files: {} })).toThrow(
      /unsupported shape or version/,
    );
    expect(() =>
      parseMigrationManifest({ policyVersion: 1, files: { "../escape": "bad" } }),
    ).toThrow(/entry is invalid/);
  });
});
