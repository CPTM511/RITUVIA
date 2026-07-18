import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import {
  auditArchitecture,
  registeredArchitectureModules,
  type RepositoryArchitectureFile,
} from "./architecture-policy.js";

const root = process.cwd();
const maximumSourceBytes = 2 * 1024 * 1024;
const relevantFile = (filePath: string): boolean =>
  (/^tsconfig(?:\.[^/]+)?\.json$/u.test(filePath) ||
    /^content\/[^/]+(?:\/[^/]+)*\.json$/u.test(filePath) ||
    /^(?:apps|packages)\/[^/]+\/(?:package\.json|tsconfig(?:\.[^/]+)?\.json|.*\.[cm]?[jt]sx?)$/u.test(
      filePath,
    )) &&
  !/(?:^|\/)(?:\.next|\.turbo|coverage|dist|node_modules)(?:\/|$)/u.test(filePath);

const trackedAndUnignoredFiles = (): readonly string[] => {
  const result = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps",
      "content",
      "packages",
      "tsconfig.json",
      "tsconfig.base.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return result
    .split("\0")
    .filter((filePath) => filePath !== "")
    .sort();
};

const readRepositoryFiles = async (): Promise<readonly RepositoryArchitectureFile[]> =>
  (
    await Promise.all(
      trackedAndUnignoredFiles().map(
        async (filePath): Promise<RepositoryArchitectureFile | null> => {
          const absolutePath = path.join(root, filePath);
          const metadata = await lstat(absolutePath);
          if (metadata.isSymbolicLink()) return { kind: "symlink", path: filePath, source: "" };
          if (!relevantFile(filePath)) return null;
          if (!metadata.isFile() || metadata.size > maximumSourceBytes) {
            throw new Error(`Architecture input is not a bounded regular file: ${filePath}`);
          }
          const bytes = await readFile(absolutePath);
          let source: string;
          try {
            source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            throw new Error(`Architecture input is not valid UTF-8: ${filePath}`);
          }
          return { path: filePath, source };
        },
      ),
    )
  ).filter((file): file is RepositoryArchitectureFile => file !== null);

const files = await readRepositoryFiles();
const findings = auditArchitecture(files);
if (findings.length > 0) {
  for (const finding of findings) console.error(JSON.stringify(finding));
  console.error(`Architecture policy failed with ${findings.length} finding(s).`);
  process.exitCode = 1;
} else {
  const activeModules = new Set(
    files
      .map(
        ({ path: filePath }) =>
          registeredArchitectureModules.find(({ root: moduleRoot }) =>
            filePath.startsWith(`${moduleRoot}/`),
          )?.name,
      )
      .filter((name): name is string => name !== undefined),
  );
  const sourceCount = files.filter(({ path: filePath }) =>
    /\.[cm]?[jt]sx?$/u.test(filePath),
  ).length;
  console.log(
    `Architecture policy passed for ${sourceCount} source files across ${activeModules.size} active modules.`,
  );
}
