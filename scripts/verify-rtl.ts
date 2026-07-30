import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";

import { auditRtlPolicy, type RtlPolicyFile } from "./rtl-policy.js";

const root = process.cwd();
const maximumSourceBytes = 2 * 1024 * 1024;
const relevantPath =
  /^(?:apps\/web\/app|content|packages\/(?:i18n|ui)\/src)\/.*\.(?:css|json|mjs|ts|tsx)$/u;

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
    "content",
    "packages/i18n/src",
    "packages/ui/src",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
)
  .split("\0")
  .filter((path) => relevantPath.test(path))
  .sort();

const files = await Promise.all(
  paths.map(async (path): Promise<RtlPolicyFile> => {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size > maximumSourceBytes) {
      throw new Error(`RTL policy input is not a bounded regular file: ${path}`);
    }
    return { path, source: await readFile(path, "utf8") };
  }),
);

const findings = auditRtlPolicy(files);
if (findings.length > 0) {
  for (const finding of findings) console.error(JSON.stringify(finding));
  throw new Error(`RTL policy failed with ${findings.length} finding(s).`);
}

console.log(`RTL policy passed for ${files.length} production files.`);
