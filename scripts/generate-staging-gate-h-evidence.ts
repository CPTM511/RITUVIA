import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseStagingGateHEvidenceSnapshot,
  projectStagingGateHReport,
  renderStagingGateHMarkdown,
} from "../packages/observability/src/index.js";

const maximumInputBytes = 1_048_576;
const maximumEvidenceBytes = 5_242_880;

type StagingGateHArguments = Readonly<{
  asOf: string;
  inputPath: string;
  jsonOutputPath: string;
  markdownOutputPath: string;
  rootPath?: string;
}>;

const invalid = (): never => {
  throw new Error("Staging Gate H evidence arguments are invalid.");
};

const parseArguments = (argumentsList: readonly string[]): StagingGateHArguments => {
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

const readBoundedRegularFile = async (filePath: string, maximumBytes: number): Promise<Buffer> => {
  let handle;
  try {
    handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > maximumBytes) return invalid();
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes) return invalid();
    return bytes;
  } catch {
    return invalid();
  } finally {
    await handle?.close();
  }
};

const parseJson = (bytes: Buffer): unknown => {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    return invalid();
  }
};

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

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

export const generateStagingGateHEvidenceFiles = async ({
  asOf,
  inputPath,
  jsonOutputPath,
  markdownOutputPath,
  rootPath = process.cwd(),
}: StagingGateHArguments) => {
  const repositoryRoot = path.resolve(rootPath);
  if (
    inputPath === jsonOutputPath ||
    inputPath === markdownOutputPath ||
    jsonOutputPath === markdownOutputPath
  ) {
    return invalid();
  }
  const inputBytes = await readBoundedRegularFile(inputPath, maximumInputBytes);
  const input = parseJson(inputBytes);
  const snapshot = parseStagingGateHEvidenceSnapshot(input);
  const verifiedEvidenceDigests: Record<string, string> = {};
  for (const evidence of snapshot.controls.flatMap((control) => control.evidence)) {
    if (Object.hasOwn(verifiedEvidenceDigests, evidence.path)) {
      if (verifiedEvidenceDigests[evidence.path] !== evidence.digest) return invalid();
      continue;
    }
    const evidencePath = path.resolve(repositoryRoot, evidence.path);
    if (!evidencePath.startsWith(`${repositoryRoot}${path.sep}`)) return invalid();
    const evidenceBytes = await readBoundedRegularFile(evidencePath, maximumEvidenceBytes);
    const evidenceDigest = digest(evidenceBytes);
    if (evidenceDigest !== evidence.digest) return invalid();
    verifiedEvidenceDigests[evidence.path] = evidenceDigest;
  }
  const report = projectStagingGateHReport(input, {
    asOf,
    inputDigest: digest(inputBytes),
    verifiedEvidenceDigests,
  });
  await writeExclusivePair(
    jsonOutputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    markdownOutputPath,
    renderStagingGateHMarkdown(report),
  );
  return report;
};

const main = async (): Promise<void> => {
  const report = await generateStagingGateHEvidenceFiles(parseArguments(process.argv.slice(2)));
  process.stdout.write(
    `Generated staging Gate H evidence with decision status ${report.decisionStatus}.\n`,
  );
};

const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  await main();
}
