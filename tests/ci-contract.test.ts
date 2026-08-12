import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  auditActiveWorkflowFileNames,
  auditBrowserTestDependencies,
  auditCiScripts,
  auditCiWorkflow,
  auditDatabaseCiScripts,
  auditToolchainVersions,
  parseWorkflowYaml,
} from "../scripts/ci-contract.js";

let workflow: Record<string, unknown>;
let databaseVerifierSource = "";

const cloneWorkflow = (): Record<string, unknown> => structuredClone(workflow);
const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

beforeAll(async () => {
  const source = await readFile(path.resolve(".github/workflows/ci.yml"), "utf8");
  workflow = parseWorkflowYaml(source) as Record<string, unknown>;
  databaseVerifierSource = await readFile(
    path.resolve("packages/db/scripts/verify-ci-foundation.ts"),
    "utf8",
  );
});

describe("active CI workflow contract", () => {
  it("accepts the committed least-privilege workflow", () => {
    expect(auditCiWorkflow(workflow)).toEqual([]);
    expect(auditActiveWorkflowFileNames(["README.md", "ci.yml"])).toEqual([]);
  });

  it("rejects every additional active workflow regardless of its filename", () => {
    expect(auditActiveWorkflowFileNames(["ci.yml", "other.yaml"])).toEqual([
      { location: ".github/workflows", rule: "active-workflow-set" },
    ]);
    expect(auditActiveWorkflowFileNames(["ci.yml", "unsafe.example.yml"])).toEqual([
      { location: ".github/workflows", rule: "active-workflow-set" },
    ]);
  });

  it("requires one exact Node and pnpm version across canonical files", () => {
    const valid = {
      nodeEngine: ">=24.18.0 <25",
      nodeVersion: "24.18.0",
      packageManager: "pnpm@11.13.1",
      pnpmEngine: "11.13.1",
      workspaceNodeVersion: "24.18.0",
    };
    expect(auditToolchainVersions(valid)).toEqual([]);
    expect(auditToolchainVersions({ ...valid, workspaceNodeVersion: "24.17.0" })).toEqual([
      { location: "toolchain", rule: "toolchain-version-drift" },
    ]);
  });

  it("pins the browser scanner and browser library versions", () => {
    const valid = { "@axe-core/playwright": "4.12.1", playwright: "1.61.1" };
    expect(auditBrowserTestDependencies(valid)).toEqual([]);
    expect(auditBrowserTestDependencies({ ...valid, playwright: "latest" })).toEqual([
      {
        location: "package.json#devDependencies",
        rule: "browser-test-dependencies",
      },
    ]);
    expect(auditBrowserTestDependencies(undefined)).toHaveLength(1);
  });

  it("rejects attempts to remove explicit repository evidence gates from scripts", () => {
    const valid = {
      "check:ai-operations":
        "pnpm --filter @rituvia/observability build && node --import tsx scripts/verify-ai-operations.ts",
      "check:architecture": "node --import tsx scripts/verify-architecture.ts",
      "check:environment-contract": "node --import tsx scripts/verify-environment-contract.ts",
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
        "pnpm check:ci-contract && pnpm check:architecture && pnpm check:environment-contract && pnpm check:ai-operations && pnpm check:localization && pnpm check:editorial-content && pnpm check:public-pages && pnpm check:search-operations && pnpm check:rtl && pnpm check:writing-systems && pnpm check:records && pnpm check:migrations && pnpm check:generated && pnpm scan:secrets",
      lint: "eslint eslint.config.mjs prettier.config.mjs vitest.config.ts scripts tests apps packages --max-warnings=0",
      test: "pnpm test:unit && pnpm test:ai-evals && pnpm test:configuration-boundary && pnpm test:database-foundation",
      "test:accessibility":
        "pnpm --filter @rituvia/i18n build && node scripts/verify-full-loop-browser.mjs && node scripts/verify-web-accessibility.mjs && node scripts/verify-intention-browser.mjs && node scripts/verify-ritual-browser.mjs && node scripts/verify-revisit-browser.mjs && node scripts/verify-writing-systems-browser.mjs",
      "test:ai-evals": "node --import tsx scripts/verify-ai-release-evals.ts",
      "test:astrology-native-corresponding-source":
        "pnpm --filter @rituvia/astrology-engine-native native:verify-corresponding-source",
      "test:astrology-native-sca":
        "pnpm --filter @rituvia/astrology-engine-native native:verify-sca",
      "test:astrology-native-security":
        "pnpm --filter @rituvia/astrology-engine-native native:verify-security",
      "test:backup-recovery-database": "pnpm --filter @rituvia/db test:backup-recovery",
      "test:release-corresponding-source": "node scripts/verify-release-corresponding-source.mjs",
      "test:public-search-browser": "node --import tsx scripts/verify-public-search-browser.mjs",
      "test:tarot-share-browser": "node scripts/verify-tarot-share-browser.mjs",
    };
    expect(auditCiScripts(valid)).toEqual([]);
    expect(auditCiScripts({ ...valid, "check:architecture": "node -e 'process.exit(0)'" })).toEqual(
      [
        {
          location: "package.json#scripts.check:architecture",
          rule: "ci-script-command",
        },
      ],
    );
    expect(auditCiScripts({ ...valid, "test:ai-evals": "node -e 'process.exit(0)'" })).toEqual([
      {
        location: "package.json#scripts.test:ai-evals",
        rule: "ci-script-command",
      },
    ]);
  });

  it("requires the database CI verifier to build its internal runtime dependency", () => {
    const valid = {
      "test:backup-recovery":
        "pnpm --filter @rituvia/domain build && pnpm generate && node --import tsx scripts/verify-backup-recovery.ts",
      "test:ci":
        "pnpm --filter @rituvia/domain build && pnpm --filter @rituvia/security build && pnpm generate && node --import tsx scripts/verify-ci-foundation.ts",
    };
    expect(auditDatabaseCiScripts(valid)).toEqual([]);
    expect(
      auditDatabaseCiScripts({ ...valid, "test:ci": "node scripts/verify-ci-foundation.ts" }),
    ).toEqual([
      {
        location: "packages/db/package.json#scripts.test:ci",
        rule: "ci-script-command",
      },
    ]);
    expect(
      auditDatabaseCiScripts({
        ...valid,
        "test:backup-recovery": "node scripts/verify-backup-recovery.ts",
      }),
    ).toEqual([
      {
        location: "packages/db/package.json#scripts.test:backup-recovery",
        rule: "ci-script-command",
      },
    ]);
  });

  it("locks the isolated backup restore after the CI database foundation", () => {
    const removed = cloneWorkflow();
    const removedSteps = record(record(removed.jobs).database).steps as unknown[];
    const removedIndex = removedSteps.findIndex(
      (step) => record(step).run === "pnpm test:backup-recovery-database",
    );
    if (removedIndex < 0) throw new Error("backup recovery fixture step missing");
    removedSteps.splice(removedIndex, 1);
    expect(auditCiWorkflow(removed)).toEqual(
      expect.arrayContaining([
        { location: "jobs.database", rule: "run-command-sequence" },
        { location: "jobs.database", rule: "step-sequence" },
      ]),
    );

    const broadened = cloneWorkflow();
    const steps = record(record(broadened.jobs).database).steps as unknown[];
    const index = steps.findIndex(
      (step) => record(step).run === "pnpm test:backup-recovery-database",
    );
    if (index < 0) throw new Error("backup recovery fixture step missing");
    record(steps[index]).env = { DATABASE_URL: "postgresql://production" };
    expect(auditCiWorkflow(broadened)).toContainEqual({
      location: `database.steps[${index}]`,
      rule: "step-environment",
    });
  });

  it("keeps CI Tarot report inserts on the exact runtime columns", () => {
    expect(databaseVerifierSource).toContain(
      "GRANT INSERT ON TABLE reading, tarot_draw TO ${READING_WRITER_ROLE}",
    );
    expect(databaseVerifierSource).toContain(
      "GRANT INSERT (anonymous_subject_id, canonical_request_hash, category, created_at, expires_at, idempotency_key_hash, idempotency_key_version, interpretation_id, interpretation_parent_status, interpretation_verification_status, reading_id, report_policy_version, report_request_schema_version, schema_version, target_kind, target_position_id) ON TABLE reading_report TO ${READING_WRITER_ROLE}",
    );
    expect(databaseVerifierSource).not.toContain(
      "GRANT INSERT ON TABLE reading, tarot_draw, reading_report",
    );
  });

  it("attests the current interpretation privacy-deletion policies", () => {
    expect(databaseVerifierSource).toContain('policyName: "interpretation_privacy_deletion"');
    expect(databaseVerifierSource).toContain('policyName: "interpretation_privacy_deletion_read"');
    expect(databaseVerifierSource).toContain(
      'policyName: "interpretation_verification_privacy_deletion"',
    );
    expect(databaseVerifierSource).toContain(
      'policyName: "interpretation_verification_privacy_deletion_read"',
    );
    expect(databaseVerifierSource).toContain("clock_timestamp() + interval '1 minute'");
    expect(databaseVerifierSource).not.toContain('new Date("2026-07-17T');
  });

  it("rejects write permissions and dangerous triggers", () => {
    const candidate = cloneWorkflow();
    candidate.permissions = { contents: "write" };
    record(candidate.on).pull_request_target = {};
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "permissions", rule: "permissions" },
        { location: "on", rule: "triggers" },
        { location: "workflow", rule: "forbidden-capability" },
      ]),
    );
  });

  it("rejects filters that can skip required pull request or main-push evidence", () => {
    const candidate = cloneWorkflow();
    record(candidate.on).pull_request = { paths: ["never/**"] };
    record(record(candidate.on).push).paths = ["never/**"];
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "on", rule: "trigger-filters" },
        { location: "on.push", rule: "push-branch" },
      ]),
    );
  });

  it("rejects mutable action references and credential persistence", () => {
    const candidate = cloneWorkflow();
    const quality = record(record(candidate.jobs).quality);
    const checkout = record((quality.steps as unknown[])[0]);
    checkout.uses = "actions/checkout@v7";
    record(checkout.with)["persist-credentials"] = true;
    const findings = auditCiWorkflow(candidate);
    expect(findings).toContainEqual({ location: "quality.steps[0]", rule: "action-pin" });
  });

  it("rejects checkout ref or path overrides that could test different source", () => {
    const candidate = cloneWorkflow();
    const quality = record(record(candidate.jobs).quality);
    const checkout = record((quality.steps as unknown[])[0]);
    record(checkout.with).ref = "main";
    expect(auditCiWorkflow(candidate)).toContainEqual({
      location: "quality.checkout",
      rule: "checkout-inputs",
    });
  });

  it("rejects reordered action setup steps", () => {
    const candidate = cloneWorkflow();
    const quality = record(record(candidate.jobs).quality);
    const steps = quality.steps as unknown[];
    [steps[0], steps[1]] = [steps[1], steps[0]];
    expect(auditCiWorkflow(candidate)).toContainEqual({
      location: "jobs.quality",
      rule: "step-sequence",
    });
  });

  it("rejects removal of the explicit architecture workflow step", () => {
    const candidate = cloneWorkflow();
    const quality = record(record(candidate.jobs).quality);
    const steps = quality.steps as unknown[];
    const index = steps.findIndex((step) => record(step).run === "pnpm check:architecture");
    if (index < 0) throw new Error("architecture fixture step missing");
    steps.splice(index, 1);
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "jobs.quality", rule: "run-command-sequence" },
        { location: "jobs.quality", rule: "step-sequence" },
      ]),
    );
  });

  it("locks the fixed AI release evaluation after unit tests", () => {
    const removed = cloneWorkflow();
    const removedSteps = record(record(removed.jobs).quality).steps as unknown[];
    const removedIndex = removedSteps.findIndex(
      (step) => record(step).run === "pnpm test:ai-evals",
    );
    if (removedIndex < 0) throw new Error("AI evaluation fixture step missing");
    removedSteps.splice(removedIndex, 1);
    expect(auditCiWorkflow(removed)).toEqual(
      expect.arrayContaining([
        { location: "jobs.quality", rule: "run-command-sequence" },
        { location: "jobs.quality", rule: "step-sequence" },
      ]),
    );

    const reordered = cloneWorkflow();
    const reorderedSteps = record(record(reordered.jobs).quality).steps as unknown[];
    const current = reorderedSteps.findIndex((step) => record(step).run === "pnpm test:ai-evals");
    if (current < 1) throw new Error("AI evaluation fixture step missing");
    [reorderedSteps[current - 1], reorderedSteps[current]] = [
      reorderedSteps[current],
      reorderedSteps[current - 1],
    ];
    expect(auditCiWorkflow(reordered)).toEqual(
      expect.arrayContaining([
        { location: "jobs.quality", rule: "run-command-sequence" },
        { location: "jobs.quality", rule: "step-sequence" },
      ]),
    );
  });

  it("locks the browser install and accessibility smoke after the reviewed Quality build", () => {
    const removed = cloneWorkflow();
    const quality = record(record(removed.jobs).quality);
    const steps = quality.steps as unknown[];
    const smokeIndex = steps.findIndex((step) => record(step).run === "pnpm test:accessibility");
    if (smokeIndex < 0) throw new Error("accessibility smoke fixture step missing");
    steps.splice(smokeIndex, 1);
    expect(auditCiWorkflow(removed)).toEqual(
      expect.arrayContaining([
        { location: "jobs.quality", rule: "run-command-sequence" },
        { location: "jobs.quality", rule: "step-sequence" },
      ]),
    );

    const broadened = cloneWorkflow();
    const broadenedSteps = record(record(broadened.jobs).quality).steps as unknown[];
    const install = broadenedSteps.findIndex(
      (step) =>
        record(step).run === "pnpm exec playwright install --with-deps --only-shell chromium",
    );
    if (install < 0) throw new Error("Playwright install fixture step missing");
    record(broadenedSteps[install]).run = "pnpm exec playwright install --with-deps";
    expect(auditCiWorkflow(broadened)).toEqual(
      expect.arrayContaining([
        { location: "jobs.quality", rule: "run-command-sequence" },
        { location: "jobs.quality", rule: "step-sequence" },
      ]),
    );
  });

  it.each([
    "pnpm check:environment-contract",
    "pnpm check:ai-operations",
    "pnpm check:localization",
    "pnpm check:editorial-content",
    "pnpm check:public-pages",
    "pnpm check:search-operations",
    "pnpm check:rtl",
    "pnpm check:writing-systems",
    "pnpm check:records",
    "pnpm check:generated",
  ])("rejects removal or reordering of the %s workflow gate", (command) => {
    const removed = cloneWorkflow();
    const removedSteps = record(record(removed.jobs).quality).steps as unknown[];
    const index = removedSteps.findIndex((step) => record(step).run === command);
    if (index < 0) throw new Error(`${command} fixture step missing`);
    removedSteps.splice(index, 1);
    expect(auditCiWorkflow(removed)).toEqual(
      expect.arrayContaining([
        { location: "jobs.quality", rule: "run-command-sequence" },
        { location: "jobs.quality", rule: "step-sequence" },
      ]),
    );

    const reordered = cloneWorkflow();
    const reorderedSteps = record(record(reordered.jobs).quality).steps as unknown[];
    const current = reorderedSteps.findIndex((step) => record(step).run === command);
    if (current < 0) throw new Error(`${command} fixture step missing`);
    [reorderedSteps[current], reorderedSteps[current + 1]] = [
      reorderedSteps[current + 1],
      reorderedSteps[current],
    ];
    expect(auditCiWorkflow(reordered)).toContainEqual({
      location: "jobs.quality",
      rule: "run-command-sequence",
    });
  });

  it.each([
    "pnpm test:astrology-native-security -- --allow-download",
    "pnpm test:astrology-native-sca -- --allow-network",
    "pnpm test:astrology-native-corresponding-source -- --allow-download",
    `component_archive=packages/astrology-engine-native/.native-cache/corresponding-source/rituvia-native-corresponding-source.tar; component_sha256="$(sha256sum "$component_archive" | cut -d ' ' -f1)"; pnpm test:release-corresponding-source -- --expected-revision "$GITHUB_SHA" --component-archive "$component_archive" --component-archive-sha256 "$component_sha256"`,
  ])("locks the native security command %s in the Linux security job", (command) => {
    const candidate = cloneWorkflow();
    const security = record(record(candidate.jobs).security);
    const steps = security.steps as unknown[];
    const index = steps.findIndex((step) => record(step).run === command);
    if (index < 0) throw new Error("native security fixture step missing");
    steps.splice(index, 1);
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "jobs.security", rule: "run-command-sequence" },
        { location: "jobs.security", rule: "step-sequence" },
      ]),
    );
  });

  it("rejects any extra PostgreSQL service environment key", () => {
    const candidate = cloneWorkflow();
    const database = record(record(candidate.jobs).database);
    const postgres = record(record(database.services).postgres);
    record(postgres.env).POSTGRES_HOST_AUTH_METHOD = "trust";
    expect(auditCiWorkflow(candidate)).toContainEqual({
      location: "database.services.postgres",
      rule: "postgres-environment",
    });
  });

  it("rejects extra services and appended PostgreSQL runtime options", () => {
    const candidate = cloneWorkflow();
    const database = record(record(candidate.jobs).database);
    const services = record(database.services);
    services.sidecar = { image: "attacker/latest" };
    const postgres = record(services.postgres);
    postgres.options = `${String(postgres.options)} --privileged`;
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "database.services", rule: "service-set" },
        { location: "database.services.postgres", rule: "postgres-healthcheck" },
      ]),
    );
  });

  it("rejects a mutable database image and event interpolation in shell", () => {
    const candidate = cloneWorkflow();
    const database = record(record(candidate.jobs).database);
    record(record(database.services).postgres).image = "postgres:latest";
    const steps = database.steps as unknown[];
    record(steps.at(-1)).run = "echo ${{ github.event.pull_request.title }}";
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "database.services.postgres", rule: "postgres-image" },
        { location: `database.steps[${steps.length - 1}]`, rule: "untrusted-run-interpolation" },
      ]),
    );
  });

  it("rejects unreachable gates and every expression inside shell commands", () => {
    const candidate = cloneWorkflow();
    const security = record(record(candidate.jobs).security);
    const steps = security.steps as unknown[];
    const historyScan = record(steps[3]);
    historyScan.if = false;
    historyScan.run = "echo ${{ github.head_ref }}";
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "security.steps[3]", rule: "step-if" },
        { location: "security.steps[3]", rule: "untrusted-run-interpolation" },
        { location: "jobs.security", rule: "run-command-sequence" },
      ]),
    );
  });

  it("rejects bracket-form secrets and extra shell steps", () => {
    const candidate = cloneWorkflow();
    const quality = record(record(candidate.jobs).quality);
    (quality.steps as unknown[]).push({
      name: "Unsafe",
      run: "echo ${{ secrets['TOKEN'] }}",
    });
    expect(auditCiWorkflow(candidate)).toEqual(
      expect.arrayContaining([
        { location: "workflow", rule: "forbidden-capability" },
        { location: "jobs.quality", rule: "run-command-sequence" },
      ]),
    );
  });
});
