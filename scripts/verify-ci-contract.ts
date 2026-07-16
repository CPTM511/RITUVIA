import path from "node:path";
import { readFile } from "node:fs/promises";

import { parse } from "yaml";

import {
  auditCiScripts,
  auditToolchainVersions,
  verifyCiWorkflowDirectory,
} from "./ci-contract.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const workflowResult = await verifyCiWorkflowDirectory(
  path.join(repositoryRoot, ".github/workflows"),
);
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
) as {
  engines?: { node?: unknown; pnpm?: unknown };
  packageManager?: unknown;
  scripts?: unknown;
};
const workspace = parse(
  await readFile(path.join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
) as {
  nodeVersion?: unknown;
};
const toolchainFindings = auditToolchainVersions({
  nodeEngine: packageJson.engines?.node,
  nodeVersion: (await readFile(path.join(repositoryRoot, ".node-version"), "utf8")).trim(),
  packageManager: packageJson.packageManager,
  pnpmEngine: packageJson.engines?.pnpm,
  workspaceNodeVersion: workspace.nodeVersion,
});
const scriptFindings = auditCiScripts(packageJson.scripts);
if (toolchainFindings.length > 0) {
  process.stderr.write("CI contract failure: toolchain versions are not synchronized.\n");
}
if (scriptFindings.length > 0) {
  process.stderr.write("CI contract failure: repository gate scripts are not exact.\n");
}
process.exitCode =
  workflowResult === 0 && toolchainFindings.length === 0 && scriptFindings.length === 0 ? 0 : 1;
