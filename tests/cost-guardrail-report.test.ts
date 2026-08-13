import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { costGuardrailSnapshotSchemaVersion } from "../packages/analytics/src/index.js";
import { generateCostGuardrailReportFiles } from "../scripts/generate-cost-guardrail-report.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rituvia-cost-guardrail-"));
  temporaryDirectories.push(directory);
  return directory;
};

const unavailableSnapshot = {
  capturedAt: "2026-08-02T02:00:00.000Z",
  currencyCode: "USD",
  environment: "local",
  observations: [],
  policy: {
    approvalReference: null,
    kind: "unavailable",
    lines: [],
    policyReference: null,
    totalBudgetMicros: null,
  },
  schemaVersion: costGuardrailSnapshotSchemaVersion,
  source: { kind: "unavailable", observedThrough: null },
  windowEnd: "2026-08-02T00:00:00.000Z",
  windowStart: "2026-08-01T00:00:00.000Z",
};

describe("cost guardrail report files", () => {
  it("writes digest-bound private blocked evidence without provider access", async () => {
    const directory = await temporaryDirectory();
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "report.json");
    const markdownOutputPath = path.join(directory, "report.md");
    const inputBytes = `${JSON.stringify(unavailableSnapshot)}\n`;
    await writeFile(inputPath, inputBytes, { encoding: "utf8", mode: 0o600 });

    const report = await generateCostGuardrailReportFiles({
      asOf: "2026-08-02T02:30:00.000Z",
      inputPath,
      jsonOutputPath,
      markdownOutputPath,
    });

    expect(report.decisionStatus).toBe("blocked");
    expect(report.inputDigest).toBe(
      `sha256:${createHash("sha256").update(inputBytes).digest("hex")}`,
    );
    expect(JSON.parse(await readFile(jsonOutputPath, "utf8"))).toEqual(report);
    expect(await readFile(markdownOutputPath, "utf8")).toContain(
      "No approved allocation is available.",
    );
    expect((await stat(jsonOutputPath)).mode & 0o777).toBe(0o600);
    expect((await stat(markdownOutputPath)).mode & 0o777).toBe(0o600);
  });

  it("never overwrites evidence and rejects symbolic-link inputs", async () => {
    const directory = await temporaryDirectory();
    const targetPath = path.join(directory, "target.json");
    const inputPath = path.join(directory, "input.json");
    const jsonOutputPath = path.join(directory, "report.json");
    await writeFile(targetPath, `${JSON.stringify(unavailableSnapshot)}\n`);
    await symlink(targetPath, inputPath);

    await expect(
      generateCostGuardrailReportFiles({
        asOf: "2026-08-02T02:30:00.000Z",
        inputPath,
        jsonOutputPath,
        markdownOutputPath: path.join(directory, "report.md"),
      }),
    ).rejects.toThrow("Cost guardrail report arguments are invalid.");

    await rm(inputPath);
    await writeFile(inputPath, `${JSON.stringify(unavailableSnapshot)}\n`);
    await writeFile(jsonOutputPath, "COST-EVIDENCE\n");
    await expect(
      generateCostGuardrailReportFiles({
        asOf: "2026-08-02T02:30:00.000Z",
        inputPath,
        jsonOutputPath,
        markdownOutputPath: path.join(directory, "report.md"),
      }),
    ).rejects.toThrow();
    expect(await readFile(jsonOutputPath, "utf8")).toBe("COST-EVIDENCE\n");
  });
});
