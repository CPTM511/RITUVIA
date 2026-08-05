import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  auditEnvironmentContractReferences,
  auditEnvironmentContractSource,
  type EnvironmentContractReferences,
} from "../scripts/environment-contract-policy.js";

const contractPath = "docs/21_ENVIRONMENT_CONTRACT.md";

describe("environment contract policy", () => {
  it("accepts the canonical four-environment contract", async () => {
    expect(auditEnvironmentContractSource(await readFile(contractPath, "utf8"))).toEqual([]);
  });

  it.each([
    ["preview status", "`required before use`", "`implemented`"],
    [
      "staging status",
      "| Staging     | `staging`    | `standing protected`",
      "| Staging     | `staging`    | `verified rehearsal`",
    ],
    ["downward secret flow", "Production secrets MUST NOT flow downward", "Secrets may be shared"],
    [
      "non-production indexing",
      "Local, preview, and staging MUST emit `noindex, nofollow`",
      "Preview may be indexed",
    ],
    [
      "production approval",
      "Production deployment and rollback that affect customers always require explicit owner approval",
      "Production deploys automatically",
    ],
  ])("rejects %s drift", async (_label, expected, replacement) => {
    const source = await readFile(contractPath, "utf8");
    expect(auditEnvironmentContractSource(source.replace(expected, replacement))).toContainEqual(
      expect.objectContaining({ rule: "requirement" }),
    );
  });

  it("rejects unsupported infrastructure claims", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(auditEnvironmentContractSource(`${source}\nProduction is deployed.\n`)).toContainEqual({
      location: "production is deployed",
      rule: "unsupported-current-state",
    });
  });

  it("requires every repository integration reference", () => {
    const valid = Object.freeze({
      architecture: "[Environment contract](21_ENVIRONMENT_CONTRACT.md)",
      compiledManualBuilder: '"AI_GROWTH_ENGINE",\n        "ENVIRONMENT_CONTRACT",',
      configurationSource: '"local", "preview", "staging", "production"',
      docsIndex: "`21_ENVIRONMENT_CONTRACT.md`",
      envExample: "Allowed values: local, preview, staging, production.",
      launchRunbook: "[environment contract](21_ENVIRONMENT_CONTRACT.md)",
      packageJson:
        '"check:environment-contract": "node --import tsx scripts/verify-environment-contract.ts"',
      readme: "docs/21_ENVIRONMENT_CONTRACT.md",
      seoSource: 'deploymentEnvironment === "production"',
      workflow: "run: pnpm check:environment-contract",
    }) satisfies EnvironmentContractReferences;
    expect(auditEnvironmentContractReferences(valid)).toEqual([]);
    expect(auditEnvironmentContractReferences({ ...valid, workflow: "" })).toEqual([
      { location: "workflow", rule: "reference" },
    ]);
  });
});
