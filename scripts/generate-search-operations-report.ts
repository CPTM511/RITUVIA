import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  projectSearchOperationsReport,
  renderSearchOperationsMarkdown,
  type SearchOperationsEditorialAuthority,
  type SearchOperationsRouteAuthority,
} from "../packages/analytics/src/index.js";

const maximumInputBytes = 1_048_576;

type ReportArguments = Readonly<{
  asOf: string;
  inputPath: string;
  jsonOutputPath: string;
  markdownOutputPath: string;
  repositoryRoot: string;
}>;

const invalid = (): never => {
  throw new Error("Search operations report arguments are invalid.");
};

const parseArguments = (argumentsList: readonly string[]): ReportArguments => {
  const values = new Map<string, string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      !name ||
      !value ||
      !["--as-of", "--input", "--output-json", "--output-markdown", "--repository-root"].includes(
        name,
      ) ||
      values.has(name)
    ) {
      return invalid();
    }
    values.set(name, value);
  }
  if (values.size !== 5) return invalid();
  return Object.freeze({
    asOf: values.get("--as-of") ?? invalid(),
    inputPath: path.resolve(values.get("--input") ?? invalid()),
    jsonOutputPath: path.resolve(values.get("--output-json") ?? invalid()),
    markdownOutputPath: path.resolve(values.get("--output-markdown") ?? invalid()),
    repositoryRoot: path.resolve(values.get("--repository-root") ?? invalid()),
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
    return Object.freeze({
      bytes,
      value: JSON.parse(bytes.toString("utf8")) as unknown,
    });
  } catch {
    return invalid();
  }
};

const routeAuthoritiesFromInventory = (
  value: unknown,
): readonly SearchOperationsRouteAuthority[] => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== "rituvia-public-page-inventory.v1" ||
    !("records" in value) ||
    !Array.isArray(value.records) ||
    value.records.length !== 45
  ) {
    return invalid();
  }
  return Object.freeze(
    value.records.map((record): SearchOperationsRouteAuthority => {
      if (
        typeof record !== "object" ||
        record === null ||
        typeof record.contentFamily !== "string" ||
        typeof record.locale !== "string" ||
        typeof record.routeId !== "string" ||
        typeof record.pathname !== "string" ||
        typeof record.userIntent !== "string" ||
        record.qualityStatus !== "passed" ||
        typeof record.authority !== "object" ||
        record.authority === null ||
        typeof record.authority.reviewedDate !== "string" ||
        !(
          record.authority.reviewDueDate === null ||
          typeof record.authority.reviewDueDate === "string"
        )
      ) {
        return invalid();
      }
      return Object.freeze({
        contentFamily: record.contentFamily,
        locale: record.locale,
        pathname: record.pathname,
        qualityStatus: "passed",
        reviewDueDate: record.authority.reviewDueDate,
        reviewedDate: record.authority.reviewedDate,
        routeId: record.routeId,
        userIntent: record.userIntent,
      });
    }),
  );
};

const editorialAuthoritiesFromManifest = (
  value: unknown,
): readonly SearchOperationsEditorialAuthority[] => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== "rituvia-editorial-repository.v1" ||
    !("records" in value) ||
    !Array.isArray(value.records) ||
    !("sources" in value) ||
    !Array.isArray(value.sources)
  ) {
    return invalid();
  }
  const records = value.records.map((record): SearchOperationsEditorialAuthority => {
    if (
      typeof record !== "object" ||
      record === null ||
      typeof record.recordId !== "string" ||
      typeof record.review !== "object" ||
      record.review === null ||
      typeof record.review.reviewedDate !== "string" ||
      !(record.review.reviewDueDate === null || typeof record.review.reviewDueDate === "string")
    ) {
      return invalid();
    }
    return Object.freeze({
      authorityId: record.recordId,
      kind: "record",
      reviewDueDate: record.review.reviewDueDate,
      reviewedDate: record.review.reviewedDate,
      rightsExpiresDate: null,
    });
  });
  const sources = value.sources.map((source): SearchOperationsEditorialAuthority => {
    if (
      typeof source !== "object" ||
      source === null ||
      typeof source.sourceId !== "string" ||
      typeof source.reviewedDate !== "string" ||
      !(source.reviewDueDate === null || typeof source.reviewDueDate === "string") ||
      typeof source.rights !== "object" ||
      source.rights === null ||
      !(source.rights.expiresDate === null || typeof source.rights.expiresDate === "string")
    ) {
      return invalid();
    }
    return Object.freeze({
      authorityId: source.sourceId,
      kind: "source",
      reviewDueDate: source.reviewDueDate,
      reviewedDate: source.reviewedDate,
      rightsExpiresDate: source.rights.expiresDate,
    });
  });
  return Object.freeze([...records, ...sources]);
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

export const generateSearchOperationsReportFiles = async ({
  asOf,
  inputPath,
  jsonOutputPath,
  markdownOutputPath,
  repositoryRoot,
}: ReportArguments) => {
  if (
    inputPath === jsonOutputPath ||
    inputPath === markdownOutputPath ||
    jsonOutputPath === markdownOutputPath
  ) {
    return invalid();
  }
  const [snapshotFile, inventoryFile, editorialFile] = await Promise.all([
    readBoundedRegularJson(inputPath),
    readBoundedRegularJson(
      path.join(repositoryRoot, "content/editorial/public-page-inventory.v1.json"),
    ),
    readBoundedRegularJson(path.join(repositoryRoot, "content/editorial/manifest.v1.json")),
  ]);
  const digest = (bytes: Uint8Array): string =>
    `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const report = projectSearchOperationsReport(
    snapshotFile.value,
    routeAuthoritiesFromInventory(inventoryFile.value),
    editorialAuthoritiesFromManifest(editorialFile.value),
    Object.freeze({
      asOf,
      editorialDigest: digest(editorialFile.bytes),
      inputDigest: digest(snapshotFile.bytes),
      inventoryDigest: digest(inventoryFile.bytes),
    }),
  );
  await writeExclusivePair(
    jsonOutputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    markdownOutputPath,
    renderSearchOperationsMarkdown(report),
  );
  return report;
};

const main = async (): Promise<void> => {
  const report = await generateSearchOperationsReportFiles(parseArguments(process.argv.slice(2)));
  process.stdout.write(
    `Generated ${report.routeSummaries.length}-route SEO/GEO operations report with decision status ${report.decisionStatus}.\n`,
  );
};

const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  await main();
}
