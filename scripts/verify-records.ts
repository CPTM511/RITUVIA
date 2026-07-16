import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import path from "node:path";

import {
  auditAutomationPromptContracts,
  auditRecordSet,
  auditTaskResult,
  auditTaskResultSchema,
  isSafeRepositoryPath,
  parseBacklog,
} from "./record-policy.js";

const root = path.resolve(import.meta.dirname, "..");
const tracked = execFileSync("git", ["ls-files", "-z", "--cached"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const repositoryPaths = new Set<string>();
const files: Record<string, string> = {};

for (const item of tracked) {
  if (!isSafeRepositoryPath(item))
    throw new Error(`Unsafe Git-indexed path: ${JSON.stringify(item)}`);
  const absolute = path.join(root, item);
  const metadata = await lstat(absolute);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error(`Tracked input is not a regular file: ${item}`);
  const resolved = await realpath(absolute);
  if (resolved !== path.resolve(absolute) || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Tracked input escapes repository: ${item}`);
  }
  repositoryPaths.add(item);
  if (/^records\/(?:decisions|experiments|incidents|tasks)\//.test(item)) {
    files[item] = await readFile(absolute, "utf8");
  }
}

for (const directory of [
  "records/decisions",
  "records/experiments",
  "records/incidents",
  "records/tasks",
]) {
  const absolute = path.join(root, directory);
  try {
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const item = `${directory}/${entry.name}`;
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error(`Record entry is not a regular file: ${item}`);
      if (!repositoryPaths.has(item))
        throw new Error(`Record file is not represented in the Git index: ${item}`);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

const backlogSource = await readFile(path.join(root, "BACKLOG.md"), "utf8");
const promptDirectory = path.join(root, "automation", "prompts");
const promptFiles = Object.fromEntries(
  await Promise.all(
    (await readdir(promptDirectory))
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map(
        async (name) => [name, await readFile(path.join(promptDirectory, name), "utf8")] as const,
      ),
  ),
);
const findings = [
  ...auditRecordSet(
    files,
    backlogSource,
    await readFile(path.join(root, "DECISIONS.md"), "utf8"),
    await readFile(path.join(root, "CONTRIBUTING.md"), "utf8"),
  ),
  ...auditTaskResult(
    JSON.parse(
      await readFile(path.join(root, "automation/examples/task-result.example.json"), "utf8"),
    ) as unknown,
    { backlog: parseBacklog(backlogSource), repositoryPaths },
  ),
  ...auditTaskResultSchema(
    JSON.parse(
      await readFile(path.join(root, "automation/schemas/task-result.schema.json"), "utf8"),
    ) as unknown,
  ),
  ...auditAutomationPromptContracts(promptFiles),
];

if (findings.length > 0) {
  for (const finding of findings)
    process.stderr.write(`Record policy failure: ${finding.location} rule=${finding.rule}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Record policy passed for ${Object.keys(files).length} durable records.\n`);
}
