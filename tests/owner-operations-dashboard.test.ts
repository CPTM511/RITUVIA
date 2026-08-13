import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ownerOperationsSnapshotSchemaVersion } from "../packages/analytics/src/index.js";
import { generateOwnerOperationsDashboardFiles } from "../scripts/generate-owner-operations-dashboard.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rituvia-owner-operations-"));
  temporaryDirectories.push(directory);
  return directory;
};

const unavailableSource = {
  approvalReference: null,
  evidencePath: null,
  kind: "unavailable",
  observedThrough: null,
  windowEnd: null,
  windowStart: null,
};

const unavailableSnapshot = {
  capturedAt: "2026-08-02T01:00:00.000Z",
  environment: "local",
  release: {
    candidate: "protected_english_anonymous_free_beta",
    gateH: "incomplete",
    independentSecurityReview: "pending",
    nextApproval: "OWN-005",
    nextTasks: ["RIT-130"],
    standingStaging: "unavailable",
  },
  schemaVersion: ownerOperationsSnapshotSchemaVersion,
  sections: [
    {
      detailCode: "standing_staging_unavailable",
      id: "health",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "revenue_aggregate_unavailable",
      id: "revenue",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "core_loop_aggregate_unavailable",
      id: "core_loop",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "beta_production_ai_excluded",
      id: "ai",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "local_queue_controls_verified",
      id: "queue",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "support_queue_aggregate_unavailable",
      id: "support",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "cost_aggregate_unavailable",
      id: "cost",
      source: unavailableSource,
      state: "unknown",
    },
    {
      detailCode: "own_005_blocked",
      id: "approvals",
      source: unavailableSource,
      state: "unknown",
    },
  ],
};

describe("owner operations dashboard files", () => {
  it("writes digest-bound private JSON and Markdown without provider access", async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "dashboard.json");
    const markdownOutputPath = path.join(directory, "dashboard.md");
    const inputBytes = `${JSON.stringify(unavailableSnapshot)}\n`;
    await writeFile(inputPath, inputBytes, { encoding: "utf8", mode: 0o600 });

    const report = await generateOwnerOperationsDashboardFiles({
      asOf: "2026-08-02T01:30:00.000Z",
      inputPath,
      jsonOutputPath,
      markdownOutputPath,
    });

    expect(report.decisionStatus).toBe("blocked");
    expect(report.inputDigest).toBe(
      `sha256:${createHash("sha256").update(inputBytes).digest("hex")}`,
    );
    expect(JSON.parse(await readFile(jsonOutputPath, "utf8"))).toEqual(report);
    expect(await readFile(markdownOutputPath, "utf8")).toContain("Decision status: blocked");
    expect((await stat(jsonOutputPath)).mode & 0o777).toBe(0o600);
    expect((await stat(markdownOutputPath)).mode & 0o777).toBe(0o600);
  });

  it("never overwrites existing evidence", async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "dashboard.json");
    const markdownOutputPath = path.join(directory, "dashboard.md");
    await writeFile(inputPath, `${JSON.stringify(unavailableSnapshot)}\n`);
    await writeFile(jsonOutputPath, "OWNER-EVIDENCE\n");

    await expect(
      generateOwnerOperationsDashboardFiles({
        asOf: "2026-08-02T01:30:00.000Z",
        inputPath,
        jsonOutputPath,
        markdownOutputPath,
      }),
    ).rejects.toThrow();
    expect(await readFile(jsonOutputPath, "utf8")).toBe("OWNER-EVIDENCE\n");
  });

  it("rejects symbolic-link inputs", async () => {
    const directory = await temporaryDirectory();
    const targetPath = path.join(directory, "target.json");
    const inputPath = path.join(directory, "input.json");
    await writeFile(targetPath, `${JSON.stringify(unavailableSnapshot)}\n`);
    await symlink(targetPath, inputPath);

    await expect(
      generateOwnerOperationsDashboardFiles({
        asOf: "2026-08-02T01:30:00.000Z",
        inputPath,
        jsonOutputPath: path.join(directory, "dashboard.json"),
        markdownOutputPath: path.join(directory, "dashboard.md"),
      }),
    ).rejects.toThrow("Owner operations dashboard arguments are invalid.");
  });
});
