import { describe, expect, it } from "vitest";

import {
  assertArtifactIntegrity,
  assertBackupArtifactMetadata,
  assertBackupCleanup,
  assertBackupDatabaseBoundary,
  assertEquivalentRestoreSnapshots,
  backupRecoveryPolicyVersion,
  createBackupRecoveryEvidence,
} from "../src/backup-recovery.js";

const sha = (character: string): string => character.repeat(64);

const validEvidence = () =>
  createBackupRecoveryEvidence({
    artifactBytes: 4096,
    artifactSha256: sha("a"),
    backupDurationMs: 10,
    constraintCount: 20,
    gitRevision: "b".repeat(40),
    indexCount: 30,
    migrationCount: 31,
    mode: "ci",
    postgresVersionNumber: 170_010,
    privilegeCount: 40,
    restoreDurationMs: 20,
    snapshotSha256: sha("c"),
    sourceDatabase: "rituvia_ci",
    tableCount: 50,
    targetDatabase: "rituvia_restore_123456_2",
    totalDurationMs: 40,
    totalRows: 3,
    workingTreeDirty: false,
  });

describe("backup recovery policy", () => {
  it("accepts only exact local or ephemeral CI source/target boundaries", () => {
    expect(() =>
      assertBackupDatabaseBoundary(
        "local",
        `rituvia_test_${"a".repeat(24)}`,
        `rituvia_test_${"b".repeat(24)}`,
      ),
    ).not.toThrow();
    expect(() =>
      assertBackupDatabaseBoundary("ci", "rituvia_ci", "rituvia_restore_123456_2"),
    ).not.toThrow();
    for (const [mode, source, target] of [
      ["ci", "production", "rituvia_restore_123456_2"],
      ["ci", "rituvia_ci", "rituvia_ci"],
      ["ci", "rituvia_ci", "caller_selected"],
      ["local", `rituvia_test_${"a".repeat(24)}`, "rituvia_local"],
    ] as const) {
      expect(() => assertBackupDatabaseBoundary(mode, source, target)).toThrow(
        /database boundary is unsafe/,
      );
    }
  });

  it("rejects empty, malformed, or tampered custom-format artifacts", () => {
    expect(() => assertArtifactIntegrity(4096, sha("a"), sha("a"), "PGDMP")).not.toThrow();
    expect(() => assertArtifactIntegrity(0, sha("a"), sha("a"), "PGDMP")).toThrow();
    expect(() => assertArtifactIntegrity(4096, sha("a"), sha("b"), "PGDMP")).toThrow();
    expect(() => assertArtifactIntegrity(4096, sha("a"), sha("a"), "plain")).toThrow();
  });

  it("rejects broad modes, symlinks, non-files, and incomplete cleanup", () => {
    expect(() =>
      assertBackupArtifactMetadata({
        isFile: true,
        isSymbolicLink: false,
        mode: 0o600,
        size: 4096,
      }),
    ).not.toThrow();
    expect(() =>
      assertBackupArtifactMetadata({
        isFile: true,
        isSymbolicLink: true,
        mode: 0o600,
        size: 4096,
      }),
    ).toThrow(/filesystem boundary/);
    expect(() =>
      assertBackupArtifactMetadata({
        isFile: true,
        isSymbolicLink: false,
        mode: 0o644,
        size: 4096,
      }),
    ).toThrow(/filesystem boundary/);
    expect(() =>
      assertBackupArtifactMetadata({
        isFile: false,
        isSymbolicLink: false,
        mode: 0o600,
        size: 4096,
      }),
    ).toThrow(/filesystem boundary/);
    expect(() =>
      assertBackupCleanup({
        artifactRemoved: true,
        sourceReleased: true,
        targetRemoved: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertBackupCleanup({
        artifactRemoved: true,
        sourceReleased: false,
        targetRemoved: true,
      }),
    ).toThrow(/cleanup verification/);
  });

  it("requires an exact pre/post restore snapshot digest", () => {
    expect(() => assertEquivalentRestoreSnapshots(sha("a"), sha("a"))).not.toThrow();
    expect(() => assertEquivalentRestoreSnapshots(sha("a"), sha("b"))).toThrow(/does not match/);
  });

  it("builds bounded privacy-minimal evidence without raw database identities", async () => {
    const evidence = await validEvidence();
    expect(evidence.policyVersion).toBe(backupRecoveryPolicyVersion);
    expect(evidence.dataClassification).toBe("synthetic-only");
    expect(evidence.cleanup).toEqual({
      artifactRemoved: true,
      sourceReleased: true,
      targetRemoved: true,
    });
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain("rituvia_ci");
    expect(serialized).not.toContain("rituvia_restore_123456_2");
    expect(serialized).not.toContain("postgresql://");
  });

  it("rejects invalid revisions, digests, counts, and duration evidence", async () => {
    const base = {
      artifactBytes: 4096,
      artifactSha256: sha("a"),
      backupDurationMs: 10,
      constraintCount: 20,
      gitRevision: "b".repeat(40),
      indexCount: 30,
      migrationCount: 31,
      mode: "ci" as const,
      postgresVersionNumber: 170_010,
      privilegeCount: 40,
      restoreDurationMs: 20,
      snapshotSha256: sha("c"),
      sourceDatabase: "rituvia_ci",
      tableCount: 50,
      targetDatabase: "rituvia_restore_123456_2",
      totalDurationMs: 40,
      totalRows: 3,
      workingTreeDirty: false,
    };
    await expect(createBackupRecoveryEvidence({ ...base, gitRevision: "dirty" })).rejects.toThrow();
    await expect(createBackupRecoveryEvidence({ ...base, artifactSha256: "x" })).rejects.toThrow();
    await expect(createBackupRecoveryEvidence({ ...base, tableCount: 0 })).rejects.toThrow();
    await expect(createBackupRecoveryEvidence({ ...base, totalDurationMs: 0 })).rejects.toThrow();
  });
});
