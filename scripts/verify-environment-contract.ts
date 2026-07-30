import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  auditEnvironmentContractReferences,
  auditEnvironmentContractSource,
} from "./environment-contract-policy.js";

const read = (path: string): Promise<string> => readFile(path, "utf8");

const [
  contract,
  architecture,
  compiledManualBuilder,
  configurationSource,
  docsIndex,
  envExample,
  launchRunbook,
  packageJson,
  readme,
  seoSource,
  workflow,
] = await Promise.all([
  read("docs/21_ENVIRONMENT_CONTRACT.md"),
  read("docs/04_ARCHITECTURE.md"),
  read("scripts/build_compiled_manual.py"),
  read("packages/config/src/server.ts"),
  read("docs/README.md"),
  read(".env.example"),
  read("docs/15_LAUNCH_RUNBOOK.md"),
  read("package.json"),
  read("README.md"),
  read("apps/web/app/_i18n/seo.ts"),
  read(".github/workflows/ci.yml"),
]);

const findings = [
  ...auditEnvironmentContractSource(contract),
  ...auditEnvironmentContractReferences({
    architecture,
    compiledManualBuilder,
    configurationSource,
    docsIndex,
    envExample,
    launchRunbook,
    packageJson,
    readme,
    seoSource,
    workflow,
  }),
];

assert.deepEqual(findings, []);
process.stdout.write(
  "Environment contract passed for four environments, ten control sections, and ten repository references.\n",
);
