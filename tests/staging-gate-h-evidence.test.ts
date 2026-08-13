import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  stagingGateHControlIds,
  stagingGateHEvidenceSchemaVersion,
} from "../packages/observability/src/index.js";
import { generateStagingGateHEvidenceFiles } from "../scripts/generate-staging-gate-h-evidence.js";

const temporaryDirectories: string[] = [];
const capturedAt = "2026-08-02T12:00:00.000Z";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rituvia-staging-gate-h-"));
  temporaryDirectories.push(directory);
  return directory;
};

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const snapshot = (evidenceDigest: string) => ({
  candidate: {
    artifactDigest: digest(Buffer.from("artifact")),
    configurationDigest: digest(Buffer.from("configuration")),
    correspondingSourceDigest: digest(Buffer.from("source")),
    invitePolicy: {
      adultOnly: true,
      automaticRetryAfterRateLimit: false,
      globalSessionLimit: 30,
      globalSessionWindowSeconds: 60,
      intakeLimit: 12,
      intakeWindowSeconds: 60,
      locale: "en",
      maximumInvitedAdults: 25,
      mutationLimit: 120,
      mutationWindowSeconds: 86_400,
      persistentNetworkOrDeviceIdentifiers: false,
      publicSignup: false,
      singleUseRevocableExpiringInvites: true,
    },
    lockfileDigest: digest(Buffer.from("lockfile")),
    nodeVersion: "26.5.1",
    policyReference: "own-019.protected-beta-abuse.v1",
    pnpmVersion: "11.13.1",
    profile: "protected_english_anonymous_free_beta",
    revision: "WORKTREE",
    stagingProfile: {
      access: "team_allowlist",
      appEnvironment: "staging",
      data: "synthetic_or_dedicated_test_accounts",
      indexing: "noindex_disallow_no_sitemap",
      liveProviders: "disabled",
      resources: "isolated_non_production",
    },
    worktreeState: "dirty",
  },
  capturedAt,
  controls: stagingGateHControlIds.map((id, index) => ({
    evidence:
      index === 0
        ? [
            {
              approvalReference: null,
              digest: evidenceDigest,
              environment: "local",
              kind: "repository_verification",
              observedAt: capturedAt,
              outcome: "passed",
              path: "docs/reports/local-contract.md",
              revision: "WORKTREE",
            },
          ]
        : [],
    id,
  })),
  schemaVersion: stagingGateHEvidenceSchemaVersion,
});

const setup = async () => {
  const rootPath = await temporaryDirectory();
  const evidencePath = path.join(rootPath, "docs/reports/local-contract.md");
  const inputPath = path.join(rootPath, "input.json");
  const jsonOutputPath = path.join(rootPath, "report.json");
  const markdownOutputPath = path.join(rootPath, "report.md");
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, "LOCAL CONTRACT ONLY\n", { encoding: "utf8", mode: 0o600 });
  const evidenceDigest = digest(await readFile(evidencePath));
  await writeFile(inputPath, `${JSON.stringify(snapshot(evidenceDigest))}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return { evidencePath, inputPath, jsonOutputPath, markdownOutputPath, rootPath };
};

describe("staging Gate H evidence files", () => {
  it("writes digest-bound private reports without provider access", async () => {
    const paths = await setup();
    const report = await generateStagingGateHEvidenceFiles({
      asOf: capturedAt,
      ...paths,
    });

    expect(report.decisionStatus).toBe("blocked");
    expect(report.gateHState).toBe("incomplete");
    expect(report.deploymentAuthorized).toBe(false);
    expect(JSON.parse(await readFile(paths.jsonOutputPath, "utf8"))).toEqual(report);
    expect(await readFile(paths.markdownOutputPath, "utf8")).toContain("Gate H state: incomplete");
    expect((await stat(paths.jsonOutputPath)).mode & 0o777).toBe(0o600);
    expect((await stat(paths.markdownOutputPath)).mode & 0o777).toBe(0o600);
  });

  it("rejects digest mismatch and symbolic-link evidence", async () => {
    const mismatch = await setup();
    await writeFile(mismatch.evidencePath, "DRIFTED\n");
    await expect(
      generateStagingGateHEvidenceFiles({ asOf: capturedAt, ...mismatch }),
    ).rejects.toThrow("Staging Gate H evidence arguments are invalid.");

    const linked = await setup();
    const targetPath = path.join(linked.rootPath, "target.md");
    await writeFile(targetPath, "LOCAL CONTRACT ONLY\n");
    await rm(linked.evidencePath);
    await symlink(targetPath, linked.evidencePath);
    await expect(
      generateStagingGateHEvidenceFiles({ asOf: capturedAt, ...linked }),
    ).rejects.toThrow("Staging Gate H evidence arguments are invalid.");
  });

  it("never overwrites an existing report", async () => {
    const paths = await setup();
    await writeFile(paths.jsonOutputPath, "OWNER EVIDENCE\n");

    await expect(
      generateStagingGateHEvidenceFiles({ asOf: capturedAt, ...paths }),
    ).rejects.toThrow();
    expect(await readFile(paths.jsonOutputPath, "utf8")).toBe("OWNER EVIDENCE\n");
  });
});
