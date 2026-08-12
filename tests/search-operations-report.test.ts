import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { searchOperationsSnapshotSchemaVersion } from "../packages/analytics/src/index.js";
import { generateSearchOperationsReportFiles } from "../scripts/generate-search-operations-report.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rituvia-search-operations-"));
  temporaryDirectories.push(directory);
  return directory;
};

const unavailableSnapshot = async () => {
  const inventory = JSON.parse(
    await readFile("content/editorial/public-page-inventory.v1.json", "utf8"),
  ) as { records: Array<{ pathname: string; routeId: string }> };
  return {
    capturedAt: "2026-07-29T11:00:00.000Z",
    routes: inventory.records.map(({ pathname, routeId }) => ({
      crawl: { attempted: false, statusCode: null, successful: false },
      index: { indexed: false },
      pathname,
      query: { clicks: 0, impressions: 0, positionWeightedSum: 0 },
      referral: {
        editorialReferralSessions: 0,
        excludedSessions: 0,
        generativeAiSessions: 0,
        otherOrUnknownSessions: 0,
        organicSearchSessions: 0,
        usefulActionSessions: 0,
      },
      routeId,
    })),
    schemaVersion: searchOperationsSnapshotSchemaVersion,
    sources: {
      crawl: { approvalReference: null, kind: "unavailable", observedThrough: null },
      index: { approvalReference: null, kind: "unavailable", observedThrough: null },
      query: { approvalReference: null, kind: "unavailable", observedThrough: null },
      referral: { approvalReference: null, kind: "unavailable", observedThrough: null },
    },
    windowEnd: "2026-07-29T00:00:00.000Z",
    windowStart: "2026-07-22T00:00:00.000Z",
  };
};

describe("search operations report files", () => {
  it("writes exclusive private JSON and Markdown reports for the exact inventory", async () => {
    const directory = await createTemporaryDirectory();
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "report.json");
    const markdownOutputPath = path.join(directory, "report.md");
    const inputBytes = `${JSON.stringify(await unavailableSnapshot())}\n`;
    await writeFile(inputPath, inputBytes, {
      encoding: "utf8",
      mode: 0o600,
    });

    const report = await generateSearchOperationsReportFiles({
      asOf: "2026-07-29T12:00:00.000Z",
      inputPath,
      jsonOutputPath,
      markdownOutputPath,
      repositoryRoot: process.cwd(),
    });

    expect(report.decisionStatus).toBe("blocked");
    expect(report.routeSummaries).toHaveLength(45);
    expect(report.inputDigest).toBe(
      `sha256:${createHash("sha256").update(inputBytes).digest("hex")}`,
    );
    expect(report.inventoryDigest).toBe(
      `sha256:${createHash("sha256")
        .update(await readFile("content/editorial/public-page-inventory.v1.json"))
        .digest("hex")}`,
    );
    expect(report.editorialDigest).toBe(
      `sha256:${createHash("sha256")
        .update(await readFile("content/editorial/manifest.v1.json"))
        .digest("hex")}`,
    );
    expect(JSON.parse(await readFile(jsonOutputPath, "utf8"))).toEqual(report);
    expect(await readFile(markdownOutputPath, "utf8")).toContain("Decision status: blocked");
    expect((await stat(jsonOutputPath)).mode & 0o777).toBe(0o600);
    expect((await stat(markdownOutputPath)).mode & 0o777).toBe(0o600);
  });

  it("never overwrites an existing report path", async () => {
    const directory = await createTemporaryDirectory();
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "report.json");
    const markdownOutputPath = path.join(directory, "report.md");
    await writeFile(inputPath, `${JSON.stringify(await unavailableSnapshot())}\n`);
    await writeFile(jsonOutputPath, "OWNER-EVIDENCE\n");

    await expect(
      generateSearchOperationsReportFiles({
        asOf: "2026-07-29T12:00:00.000Z",
        inputPath,
        jsonOutputPath,
        markdownOutputPath,
        repositoryRoot: process.cwd(),
      }),
    ).rejects.toThrow();
    expect(await readFile(jsonOutputPath, "utf8")).toBe("OWNER-EVIDENCE\n");
  });

  it("rejects a symbolic-link input", async () => {
    const directory = await createTemporaryDirectory();
    const targetPath = path.join(directory, "target.json");
    const inputPath = path.join(directory, "input.json");
    await writeFile(targetPath, `${JSON.stringify(await unavailableSnapshot())}\n`);
    await symlink(targetPath, inputPath);

    await expect(
      generateSearchOperationsReportFiles({
        asOf: "2026-07-29T12:00:00.000Z",
        inputPath,
        jsonOutputPath: path.join(directory, "report.json"),
        markdownOutputPath: path.join(directory, "report.md"),
        repositoryRoot: process.cwd(),
      }),
    ).rejects.toThrow("Search operations report arguments are invalid.");
  });
});
