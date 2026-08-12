import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";

import { auditWritingSystemPolicy, type WritingSystemPolicyFile } from "./writing-system-policy.js";

const root = process.cwd();
const maximumSourceBytes = 2 * 1024 * 1024;
const relevantPath =
  /^(?:apps\/web\/app|packages\/ui\/(?:examples|src|test))\/.*\.(?:css|ts|tsx)$/u;

const paths = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "apps/web/app",
    "packages/ui/examples",
    "packages/ui/src",
    "packages/ui/test",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
)
  .split("\0")
  .filter((path) => relevantPath.test(path))
  .sort();

const files = await Promise.all(
  paths.map(async (path): Promise<WritingSystemPolicyFile> => {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size > maximumSourceBytes) {
      throw new Error(`Writing-system policy input is not a bounded regular file: ${path}`);
    }
    return { path, source: await readFile(path, "utf8") };
  }),
);

const findings = auditWritingSystemPolicy(files);
if (findings.length > 0) {
  for (const finding of findings) console.error(JSON.stringify(finding));
  throw new Error(`Writing-system policy failed with ${findings.length} finding(s).`);
}

console.log(`Writing-system policy passed for ${files.length} production and preview files.`);
