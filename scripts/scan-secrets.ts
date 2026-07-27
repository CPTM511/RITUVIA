import { execFileSync } from "node:child_process";
import { lstat, readFile, readlink } from "node:fs/promises";
import path from "node:path";

import {
  classifyReviewedStaticAsset,
  createSecretFinding,
  isReviewedStaticAssetPath,
  scanSecretBuffer,
  type SecretFinding,
} from "./secret-policy.js";

const MAX_FILE_BYTES = 1_048_576;
const repositoryRoot = path.resolve(import.meta.dirname, "..");

const output = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  },
);

const files = output
  .split("\0")
  .filter((filePath) => filePath !== "")
  .sort();
const findings: SecretFinding[] = [];

for (const filePath of files) {
  const absolutePath = path.join(repositoryRoot, filePath);
  let metadata;
  try {
    metadata = await lstat(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
    throw error;
  }
  if (metadata.isDirectory()) continue;
  if (isReviewedStaticAssetPath(filePath)) {
    const decision = classifyReviewedStaticAsset(
      filePath,
      metadata.isFile() ? await readFile(absolutePath) : null,
    );
    switch (decision) {
      case "accepted":
        continue;
      case "content-mismatch":
        findings.push(createSecretFinding("reviewed-static-asset-content-mismatch", filePath));
        continue;
      case "type-mismatch":
        findings.push(createSecretFinding("reviewed-static-asset-type-mismatch", filePath));
        continue;
      case "not-reviewed":
        throw new TypeError("Reviewed static asset classification drifted.");
    }
  }
  if (metadata.size > MAX_FILE_BYTES) {
    findings.push(createSecretFinding("file-too-large-to-scan", filePath));
    continue;
  }

  const buffer = metadata.isSymbolicLink()
    ? Buffer.from(await readlink(absolutePath), "utf8")
    : await readFile(absolutePath);
  findings.push(...scanSecretBuffer(filePath, buffer));
}

if (findings.length > 0) {
  process.stderr.write("Secret policy rejected repository content:\n");
  for (const finding of findings) {
    process.stderr.write(
      `- path=${JSON.stringify(finding.path)} line=${finding.line} rule=${finding.rule} fingerprint=${finding.fingerprint}\n`,
    );
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Secret policy passed for ${files.length} tracked/unignored files.\n`);
}
