import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { aiOperationsSnapshotSchemaVersion } from "../packages/analytics/src/index.js";
import { generateAiOperationsReportFiles } from "../scripts/generate-ai-operations-report.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rituvia-ai-operations-"));
  temporaryDirectories.push(directory);
  return directory;
};

const unavailableSnapshot = {
  capturedAt: "2026-07-30T01:00:00.000Z",
  groups: [],
  schemaVersion: aiOperationsSnapshotSchemaVersion,
  source: {
    approvalReference: null,
    kind: "unavailable",
    observedThrough: null,
  },
  windowEnd: "2026-07-30T00:00:00.000Z",
  windowStart: "2026-07-29T00:00:00.000Z",
};

describe("AI operations report files", () => {
  it("writes digest-bound private JSON and Markdown without provider access", async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "report.json");
    const markdownOutputPath = path.join(directory, "report.md");
    const inputBytes = `${JSON.stringify(unavailableSnapshot)}\n`;
    await writeFile(inputPath, inputBytes, { encoding: "utf8", mode: 0o600 });

    const report = await generateAiOperationsReportFiles({
      asOf: "2026-07-30T06:00:00.000Z",
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
    const jsonOutputPath = path.join(directory, "report.json");
    const markdownOutputPath = path.join(directory, "report.md");
    await writeFile(inputPath, `${JSON.stringify(unavailableSnapshot)}\n`);
    await writeFile(jsonOutputPath, "OWNER-EVIDENCE\n");

    await expect(
      generateAiOperationsReportFiles({
        asOf: "2026-07-30T06:00:00.000Z",
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
      generateAiOperationsReportFiles({
        asOf: "2026-07-30T06:00:00.000Z",
        inputPath,
        jsonOutputPath: path.join(directory, "report.json"),
        markdownOutputPath: path.join(directory, "report.md"),
      }),
    ).rejects.toThrow("AI operations report arguments are invalid.");
  });
});
