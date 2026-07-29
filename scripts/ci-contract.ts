import { readdir, readFile } from "node:fs/promises";

import { parseDocument } from "yaml";

export type WorkflowFinding = Readonly<{
  location: string;
  rule: string;
}>;

const actionPins = Object.freeze({
  "actions/checkout": "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
  "actions/setup-node": "820762786026740c76f36085b0efc47a31fe5020",
  "pnpm/action-setup": "0ebf47130e4866e96fce0953f49152a61190b271",
});
const expectedJobs = Object.freeze({ database: 20, quality: 30, security: 15 });
const releaseCorrespondingSourceCommand =
  `component_archive=packages/astrology-engine-native/.native-cache/corresponding-source/rituvia-native-corresponding-source.tar; ` +
  `component_sha256="$(sha256sum "$component_archive" | cut -d ' ' -f1)"; ` +
  `pnpm test:release-corresponding-source -- --expected-revision "$GITHUB_SHA" ` +
  `--component-archive "$component_archive" --component-archive-sha256 "$component_sha256"`;
const expectedRunCommands = Object.freeze({
  database: Object.freeze(["pnpm install --frozen-lockfile", "pnpm test:ci-database"]),
  quality: Object.freeze([
    "pnpm install --frozen-lockfile",
    "pnpm check:ci-contract",
    "pnpm check:architecture",
    "pnpm check:ai-operations",
    "pnpm check:localization",
    "pnpm check:editorial-content",
    "pnpm check:public-pages",
    "pnpm check:search-operations",
    "pnpm check:rtl",
    "pnpm check:writing-systems",
    "pnpm check:records",
    "pnpm check:migrations",
    "pnpm check:generated",
    "pnpm format:check",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test:unit",
    "pnpm test:ai-evals",
    "pnpm test:configuration-boundary",
    "pnpm build",
    "pnpm exec playwright install --with-deps --only-shell chromium",
    "pnpm test:public-search-browser",
    "pnpm test:tarot-share-browser",
    "pnpm test:accessibility",
  ]),
  security: Object.freeze([
    "node scripts/run-pinned-ci-tool.mjs actionlint .github/workflows/ci.yml",
    "node scripts/run-pinned-ci-tool.mjs gitleaks",
    "pnpm install --frozen-lockfile",
    "pnpm test:astrology-native-security -- --allow-download",
    "pnpm test:astrology-native-sca -- --allow-network",
    "pnpm test:astrology-native-corresponding-source -- --allow-download",
    releaseCorrespondingSourceCommand,
    "pnpm audit --audit-level=high",
    "pnpm scan:secrets",
  ]),
});
const expectedStepSignatures = Object.freeze({
  database: Object.freeze([
    "uses:actions/checkout",
    "uses:actions/setup-node",
    "uses:pnpm/action-setup",
    "run:pnpm install --frozen-lockfile",
    "run:pnpm test:ci-database",
  ]),
  quality: Object.freeze([
    "uses:actions/checkout",
    "uses:actions/setup-node",
    "uses:pnpm/action-setup",
    ...expectedRunCommands.quality.map((command) => `run:${command}`),
  ]),
  security: Object.freeze([
    "uses:actions/checkout",
    "uses:actions/setup-node",
    "run:node scripts/run-pinned-ci-tool.mjs actionlint .github/workflows/ci.yml",
    "run:node scripts/run-pinned-ci-tool.mjs gitleaks",
    "uses:pnpm/action-setup",
    "run:pnpm install --frozen-lockfile",
    "run:pnpm test:astrology-native-security -- --allow-download",
    "run:pnpm test:astrology-native-sca -- --allow-network",
    "run:pnpm test:astrology-native-corresponding-source -- --allow-download",
    `run:${releaseCorrespondingSourceCommand}`,
    "run:pnpm audit --audit-level=high",
    "run:pnpm scan:secrets",
  ]),
});
const postgresImage =
  "postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394";
const postgresHealthcheck =
  '--health-cmd "pg_isready -U rituvia_ci_admin -d rituvia_ci" --health-interval 5s --health-timeout 5s --health-retries 12';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const add = (findings: WorkflowFinding[], rule: string, location: string): void => {
  findings.push(Object.freeze({ location, rule }));
};

const sortedKeys = (value: unknown): string[] => (isRecord(value) ? Object.keys(value).sort() : []);

export const parseWorkflowYaml = (source: string): unknown => {
  const document = parseDocument(source, { prettyErrors: false, strict: true });
  if (document.errors.length > 0) throw new Error("Active CI workflow YAML is invalid.");
  return document.toJS({ maxAliasCount: 0 }) as unknown;
};

export const auditActiveWorkflowFileNames = (
  fileNames: readonly string[],
): readonly WorkflowFinding[] => {
  const active = fileNames.filter((fileName) => /\.ya?ml$/i.test(fileName)).sort();
  return active.length === 1 && active[0] === "ci.yml"
    ? []
    : [{ location: ".github/workflows", rule: "active-workflow-set" }];
};

export const auditToolchainVersions = ({
  nodeEngine,
  nodeVersion,
  packageManager,
  pnpmEngine,
  workspaceNodeVersion,
}: Readonly<{
  nodeEngine: unknown;
  nodeVersion: unknown;
  packageManager: unknown;
  pnpmEngine: unknown;
  workspaceNodeVersion: unknown;
}>): readonly WorkflowFinding[] => {
  const exactNode = "24.18.0";
  const exactPnpm = "11.13.1";
  return nodeVersion === exactNode &&
    workspaceNodeVersion === exactNode &&
    nodeEngine === `>=${exactNode} <25` &&
    packageManager === `pnpm@${exactPnpm}` &&
    pnpmEngine === exactPnpm
    ? []
    : [{ location: "toolchain", rule: "toolchain-version-drift" }];
};

export const auditCiScripts = (scripts: unknown): readonly WorkflowFinding[] => {
  const expected = Object.freeze({
    "check:ai-operations":
      "pnpm --filter @rituvia/observability build && node --import tsx scripts/verify-ai-operations.ts",
    "check:architecture": "node --import tsx scripts/verify-architecture.ts",
    "check:generated":
      "python3 -B scripts/sync_generated_evidence.py --check && python3 -B scripts/validate_instruction_pack.py",
    "check:editorial-content":
      "pnpm --filter @rituvia/i18n build && node --import tsx scripts/verify-editorial-content.ts",
    "check:localization": "node scripts/verify-localization-workflow.mjs",
    "check:public-pages": "node --import tsx scripts/verify-public-page-quality.ts",
    "check:search-operations": "node --import tsx scripts/verify-search-operations.ts",
    "check:rtl": "node --import tsx scripts/verify-rtl.ts",
    "check:writing-systems": "node --import tsx scripts/verify-writing-systems.ts",
    "check:records":
      "python3 -B scripts/build_record_index.py --check && node --import tsx scripts/verify-records.ts",
    "check:evidence":
      "pnpm check:ci-contract && pnpm check:architecture && pnpm check:ai-operations && pnpm check:localization && pnpm check:editorial-content && pnpm check:public-pages && pnpm check:search-operations && pnpm check:rtl && pnpm check:writing-systems && pnpm check:records && pnpm check:migrations && pnpm check:generated && pnpm scan:secrets",
    lint: "eslint eslint.config.mjs prettier.config.mjs vitest.config.ts scripts tests apps packages --max-warnings=0",
    test: "pnpm test:unit && pnpm test:ai-evals && pnpm test:configuration-boundary && pnpm test:database-foundation",
    "test:accessibility":
      "pnpm --filter @rituvia/i18n build && node scripts/verify-web-accessibility.mjs && node scripts/verify-intention-browser.mjs && node scripts/verify-ritual-browser.mjs && node scripts/verify-revisit-browser.mjs && node scripts/verify-full-loop-browser.mjs && node scripts/verify-writing-systems-browser.mjs",
    "test:ai-evals": "node --import tsx scripts/verify-ai-release-evals.ts",
    "test:astrology-native-corresponding-source":
      "pnpm --filter @rituvia/astrology-engine-native native:verify-corresponding-source",
    "test:astrology-native-sca": "pnpm --filter @rituvia/astrology-engine-native native:verify-sca",
    "test:astrology-native-security":
      "pnpm --filter @rituvia/astrology-engine-native native:verify-security",
    "test:release-corresponding-source": "node scripts/verify-release-corresponding-source.mjs",
    "test:public-search-browser": "node --import tsx scripts/verify-public-search-browser.mjs",
    "test:tarot-share-browser": "node scripts/verify-tarot-share-browser.mjs",
  });
  if (!isRecord(scripts)) return [{ location: "package.json#scripts", rule: "ci-scripts" }];
  return Object.entries(expected).flatMap(([name, command]) =>
    scripts[name] === command
      ? []
      : [{ location: `package.json#scripts.${name}`, rule: "ci-script-command" }],
  );
};

export const auditDatabaseCiScripts = (scripts: unknown): readonly WorkflowFinding[] => {
  const expected =
    "pnpm generate && pnpm --filter @rituvia/security build && node --import tsx scripts/verify-ci-foundation.ts";
  return isRecord(scripts) && scripts["test:ci"] === expected
    ? []
    : [{ location: "packages/db/package.json#scripts.test:ci", rule: "ci-script-command" }];
};

export const auditBrowserTestDependencies = (
  developmentDependencies: unknown,
): readonly WorkflowFinding[] => {
  if (
    !isRecord(developmentDependencies) ||
    developmentDependencies["@axe-core/playwright"] !== "4.12.1" ||
    developmentDependencies.playwright !== "1.61.1"
  ) {
    return [{ location: "package.json#devDependencies", rule: "browser-test-dependencies" }];
  }
  return [];
};

const auditCheckout = (findings: WorkflowFinding[], jobName: string, withValue: unknown): void => {
  if (!isRecord(withValue)) {
    add(findings, "checkout-inputs", `${jobName}.checkout`);
    return;
  }
  const expectedDepth = jobName === "database" ? 1 : 0;
  if (
    JSON.stringify(sortedKeys(withValue)) !==
      JSON.stringify(["fetch-depth", "persist-credentials"]) ||
    withValue["fetch-depth"] !== expectedDepth ||
    withValue["persist-credentials"] !== false
  ) {
    add(findings, "checkout-inputs", `${jobName}.checkout`);
  }
};

const auditNodeSetup = (findings: WorkflowFinding[], jobName: string, withValue: unknown): void => {
  if (
    !isRecord(withValue) ||
    JSON.stringify(sortedKeys(withValue)) !==
      JSON.stringify(["node-version-file", "package-manager-cache"]) ||
    withValue["node-version-file"] !== ".node-version" ||
    withValue["package-manager-cache"] !== false
  ) {
    add(findings, "node-setup-inputs", `${jobName}.setup-node`);
  }
};

const auditPnpmSetup = (findings: WorkflowFinding[], jobName: string, withValue: unknown): void => {
  if (
    !isRecord(withValue) ||
    JSON.stringify(sortedKeys(withValue)) !== JSON.stringify(["run_install", "version"]) ||
    withValue.version !== "11.13.1" ||
    withValue.run_install !== false
  ) {
    add(findings, "pnpm-setup-inputs", `${jobName}.pnpm`);
  }
};

const auditSteps = (
  findings: WorkflowFinding[],
  jobName: string,
  stepsValue: unknown,
  runCommands: string[],
  stepSignatures: string[],
): void => {
  if (!Array.isArray(stepsValue)) {
    add(findings, "steps", jobName);
    return;
  }
  const actionCounts: Record<string, number> = Object.fromEntries(
    Object.keys(actionPins).map((action) => [action, 0]),
  );
  for (const [index, stepValue] of stepsValue.entries()) {
    if (!isRecord(stepValue)) {
      add(findings, "step-shape", `${jobName}.steps[${index}]`);
      continue;
    }
    const location = `${jobName}.steps[${index}]`;
    const actionStep = typeof stepValue.uses === "string";
    const runStep = typeof stepValue.run === "string";
    const allowedKeys = actionStep
      ? ["name", "uses", "with"]
      : runStep
        ? ["env", "name", "run"]
        : ["name"];
    if (
      actionStep === runStep ||
      typeof stepValue.name !== "string" ||
      sortedKeys(stepValue).some((key) => !allowedKeys.includes(key))
    ) {
      add(findings, "step-keys", location);
    }
    for (const forbidden of ["continue-on-error", "if", "shell", "working-directory"] as const) {
      if (forbidden in stepValue) add(findings, `step-${forbidden}`, location);
    }
    if (typeof stepValue.run === "string") {
      runCommands.push(stepValue.run);
      stepSignatures.push(`run:${stepValue.run}`);
      if (stepValue.run.includes("${{")) {
        add(findings, "untrusted-run-interpolation", location);
      }
      const expectedDatabaseEnvironment =
        jobName === "database" && stepValue.run === "pnpm test:ci-database";
      if (
        "env" in stepValue &&
        (!expectedDatabaseEnvironment ||
          !isRecord(stepValue.env) ||
          JSON.stringify(stepValue.env) !==
            JSON.stringify({
              RITUVIA_CI_DATABASE_PASSWORD:
                "rituvia-ci-${{ github.run_id }}-${{ github.run_attempt }}-admin",
            }))
      ) {
        add(findings, "step-environment", location);
      }
    }
    if ("env" in stepValue && typeof stepValue.run !== "string") {
      add(findings, "step-environment", location);
    }
    if (typeof stepValue.uses !== "string") continue;
    const [action, reference, extra] = stepValue.uses.split("@");
    stepSignatures.push(`uses:${action ?? stepValue.uses}`);
    if (
      extra !== undefined ||
      action === undefined ||
      reference === undefined ||
      !/^[0-9a-f]{40}$/.test(reference) ||
      !(action in actionPins) ||
      actionPins[action as keyof typeof actionPins] !== reference
    ) {
      add(findings, "action-pin", location);
      continue;
    }
    actionCounts[action] = (actionCounts[action] ?? 0) + 1;
    if (action === "actions/checkout") auditCheckout(findings, jobName, stepValue.with);
    if (action === "actions/setup-node") auditNodeSetup(findings, jobName, stepValue.with);
    if (action === "pnpm/action-setup") auditPnpmSetup(findings, jobName, stepValue.with);
  }
  for (const [action, count] of Object.entries(actionCounts)) {
    if (count !== 1) add(findings, "action-count", `${jobName}.${action}`);
  }
};

const auditPostgresService = (findings: WorkflowFinding[], databaseJob: unknown): void => {
  if (!isRecord(databaseJob) || !isRecord(databaseJob.services)) {
    add(findings, "postgres-service", "database.services");
    return;
  }
  if (JSON.stringify(sortedKeys(databaseJob.services)) !== JSON.stringify(["postgres"])) {
    add(findings, "service-set", "database.services");
  }
  const postgres = databaseJob.services.postgres;
  if (!isRecord(postgres)) {
    add(findings, "postgres-service", "database.services.postgres");
    return;
  }
  if (
    JSON.stringify(sortedKeys(postgres)) !== JSON.stringify(["env", "image", "options", "ports"])
  ) {
    add(findings, "postgres-keys", "database.services.postgres");
  }
  if (postgres.image !== postgresImage)
    add(findings, "postgres-image", "database.services.postgres");
  if (
    !Array.isArray(postgres.ports) ||
    postgres.ports.length !== 1 ||
    postgres.ports[0] !== "5432:5432"
  ) {
    add(findings, "postgres-port", "database.services.postgres");
  }
  const env = postgres.env;
  if (
    !isRecord(env) ||
    JSON.stringify(sortedKeys(env)) !==
      JSON.stringify([
        "POSTGRES_DB",
        "POSTGRES_INITDB_ARGS",
        "POSTGRES_PASSWORD",
        "POSTGRES_USER",
      ]) ||
    env.POSTGRES_DB !== "rituvia_ci" ||
    env.POSTGRES_USER !== "rituvia_ci_admin" ||
    env.POSTGRES_INITDB_ARGS !== "--data-checksums --auth-host=scram-sha-256" ||
    env.POSTGRES_PASSWORD !== "rituvia-ci-${{ github.run_id }}-${{ github.run_attempt }}-admin"
  ) {
    add(findings, "postgres-environment", "database.services.postgres");
  }
  if (postgres.options !== postgresHealthcheck) {
    add(findings, "postgres-healthcheck", "database.services.postgres");
  }
};

export const auditCiWorkflow = (workflow: unknown): readonly WorkflowFinding[] => {
  const findings: WorkflowFinding[] = [];
  if (!isRecord(workflow)) return [{ location: "workflow", rule: "workflow-shape" }];

  if (
    JSON.stringify(sortedKeys(workflow)) !==
    JSON.stringify(["concurrency", "jobs", "name", "on", "permissions"])
  ) {
    add(findings, "workflow-keys", "workflow");
  }

  const triggers = workflow.on;
  if (
    !isRecord(triggers) ||
    JSON.stringify(sortedKeys(triggers)) !==
      JSON.stringify(["pull_request", "push", "workflow_dispatch"])
  ) {
    add(findings, "triggers", "on");
  } else {
    const push = triggers.push;
    if (
      !isRecord(push) ||
      JSON.stringify(sortedKeys(push)) !== JSON.stringify(["branches"]) ||
      !Array.isArray(push.branches) ||
      push.branches.length !== 1 ||
      push.branches[0] !== "main"
    ) {
      add(findings, "push-branch", "on.push");
    }
    if (triggers.pull_request !== null || triggers.workflow_dispatch !== null) {
      add(findings, "trigger-filters", "on");
    }
  }
  if (
    !isRecord(workflow.permissions) ||
    JSON.stringify(workflow.permissions) !== JSON.stringify({ contents: "read" })
  ) {
    add(findings, "permissions", "permissions");
  }
  if (
    !isRecord(workflow.concurrency) ||
    workflow.concurrency.group !== "ci-${{ github.workflow }}-${{ github.ref }}" ||
    workflow.concurrency["cancel-in-progress"] !== true
  ) {
    add(findings, "concurrency", "concurrency");
  }

  const jobs = workflow.jobs;
  if (
    !isRecord(jobs) ||
    JSON.stringify(sortedKeys(jobs)) !== JSON.stringify(sortedKeys(expectedJobs))
  ) {
    add(findings, "jobs", "jobs");
    return Object.freeze(findings);
  }

  for (const [jobName, timeout] of Object.entries(expectedJobs)) {
    const job = jobs[jobName];
    if (!isRecord(job)) {
      add(findings, "job-shape", `jobs.${jobName}`);
      continue;
    }
    if (job["runs-on"] !== "ubuntu-24.04") add(findings, "runner", `jobs.${jobName}`);
    if (job["timeout-minutes"] !== timeout) add(findings, "timeout", `jobs.${jobName}`);
    const expectedJobKeys =
      jobName === "database"
        ? ["name", "runs-on", "services", "steps", "timeout-minutes"]
        : ["name", "runs-on", "steps", "timeout-minutes"];
    if (JSON.stringify(sortedKeys(job)) !== JSON.stringify(expectedJobKeys.sort())) {
      add(findings, "job-keys", `jobs.${jobName}`);
    }
    for (const forbidden of [
      "continue-on-error",
      "container",
      "env",
      "environment",
      "if",
      "permissions",
    ] as const) {
      if (forbidden in job) add(findings, `job-${forbidden}`, `jobs.${jobName}`);
    }
    const runCommands: string[] = [];
    const stepSignatures: string[] = [];
    auditSteps(findings, jobName, job.steps, runCommands, stepSignatures);
    if (
      JSON.stringify(runCommands) !==
      JSON.stringify(expectedRunCommands[jobName as keyof typeof expectedRunCommands])
    ) {
      add(findings, "run-command-sequence", `jobs.${jobName}`);
    }
    if (
      JSON.stringify(stepSignatures) !==
      JSON.stringify(expectedStepSignatures[jobName as keyof typeof expectedStepSignatures])
    ) {
      add(findings, "step-sequence", `jobs.${jobName}`);
    }
  }
  auditPostgresService(findings, jobs.database);

  const serialized = JSON.stringify(workflow);
  if (
    /pull_request_target|self-hosted|id-token|contents[^}]*write|secrets(?:\.|\[)/u.test(serialized)
  ) {
    add(findings, "forbidden-capability", "workflow");
  }
  return Object.freeze(findings);
};

export const verifyCiWorkflowFile = async (workflowPath: string): Promise<number> => {
  const findings = auditCiWorkflow(parseWorkflowYaml(await readFile(workflowPath, "utf8")));
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(`CI contract failure: ${finding.location} rule=${finding.rule}\n`);
    }
    return 1;
  }
  process.stdout.write("Active CI workflow passed the least-privilege contract.\n");
  return 0;
};

export const verifyCiWorkflowDirectory = async (workflowDirectory: string): Promise<number> => {
  const findings = auditActiveWorkflowFileNames(await readdir(workflowDirectory));
  if (findings.length > 0) {
    process.stderr.write("CI contract failure: unexpected active workflow set.\n");
    return 1;
  }
  return verifyCiWorkflowFile(`${workflowDirectory}/ci.yml`);
};
