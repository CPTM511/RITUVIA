import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  auditActiveWorkflowFileNames,
  auditCiWorkflow,
  auditToolchainVersions,
  parseWorkflowYaml,
} from "../scripts/ci-contract.js";

let workflow: Record<string, unknown>;

const cloneWorkflow = (): Record<string, unknown> => structuredClone(workflow);
const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

beforeAll(async () => {
  const source = await readFile(path.resolve(".github/workflows/ci.yml"), "utf8");
  workflow = parseWorkflowYaml(source) as Record<string, unknown>;
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
