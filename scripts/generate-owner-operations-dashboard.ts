import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  projectOwnerOperationsReport,
  renderOwnerOperationsMarkdown,
} from "../packages/analytics/src/index.js";

const maximumInputBytes = 1_048_576;

type DashboardArguments = Readonly<{
  asOf: string;
  inputPath: string;
  jsonOutputPath: string;
  markdownOutputPath: string;
}>;

const invalid = (): never => {
  throw new Error("Owner operations dashboard arguments are invalid.");
};

const parseArguments = (argumentsList: readonly string[]): DashboardArguments => {
  const values = new Map<string, string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      !name ||
      !value ||
      !["--as-of", "--input", "--output-json", "--output-markdown"].includes(name) ||
      values.has(name)
    ) {
      return invalid();
    }
    values.set(name, value);
  }
  if (values.size !== 4) return invalid();
  return Object.freeze({
    asOf: values.get("--as-of") ?? invalid(),
    inputPath: path.resolve(values.get("--input") ?? invalid()),
    jsonOutputPath: path.resolve(values.get("--output-json") ?? invalid()),
    markdownOutputPath: path.resolve(values.get("--output-markdown") ?? invalid()),
  });
};

const readBoundedRegularJson = async (
  filePath: string,
): Promise<Readonly<{ bytes: Uint8Array; value: unknown }>> => {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > maximumInputBytes) {
    return invalid();
  }
  const bytes = await readFile(filePath);
  if (bytes.byteLength > maximumInputBytes) return invalid();
  try {
    return Object.freeze({ bytes, value: JSON.parse(bytes.toString("utf8")) as unknown });
  } catch {
    return invalid();
  }
};

const writeExclusivePair = async (
  jsonPath: string,
  json: string,
  markdownPath: string,
  markdown: string,
): Promise<void> => {
  if (jsonPath === markdownPath) return invalid();
  const flags = constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW;
  let jsonHandle;
  let markdownHandle;
  let jsonCreated = false;
  let markdownCreated = false;
  try {
    jsonHandle = await open(jsonPath, flags, 0o600);
    jsonCreated = true;
    markdownHandle = await open(markdownPath, flags, 0o600);
    markdownCreated = true;
    await Promise.all([
      jsonHandle.writeFile(json, { encoding: "utf8" }),
      markdownHandle.writeFile(markdown, { encoding: "utf8" }),
    ]);
  } catch (error) {
    await Promise.allSettled([
      jsonHandle?.close(),
      markdownHandle?.close(),
      ...(jsonCreated ? [unlink(jsonPath)] : []),
      ...(markdownCreated ? [unlink(markdownPath)] : []),
    ]);
    throw error;
  } finally {
    await Promise.allSettled([jsonHandle?.close(), markdownHandle?.close()]);
  }
};

export const generateOwnerOperationsDashboardFiles = async ({
  asOf,
  inputPath,
  jsonOutputPath,
  markdownOutputPath,
}: DashboardArguments) => {
  if (
    inputPath === jsonOutputPath ||
    inputPath === markdownOutputPath ||
    jsonOutputPath === markdownOutputPath
  ) {
    return invalid();
  }
  const input = await readBoundedRegularJson(inputPath);
  const inputDigest = `sha256:${createHash("sha256").update(input.bytes).digest("hex")}`;
  const report = projectOwnerOperationsReport(input.value, { asOf, inputDigest });
  await writeExclusivePair(
    jsonOutputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    markdownOutputPath,
    renderOwnerOperationsMarkdown(report),
  );
  return report;
};

const main = async (): Promise<void> => {
  const report = await generateOwnerOperationsDashboardFiles(parseArguments(process.argv.slice(2)));
  process.stdout.write(
    `Generated owner operations dashboard with decision status ${report.decisionStatus}.\n`,
  );
};

const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  await main();
}
