import { describe, expect, it } from "vitest";

import { isSensitiveFilePath, scanSecretBuffer, scanSecretText } from "../scripts/secret-policy.js";

describe("secret policy", () => {
  it("detects high-confidence canaries without returning their values", () => {
    const canaries = [
      ["private", ["-----BEGIN ", "PRIVATE KEY-----"].join("")],
      ["github", ["ghp_", "a".repeat(40)].join("")],
      ["aws", ["AKIA", "A1B2C3D4E5F6G7H8"].join("")],
      ["openai", ["sk-proj-", "aB3_".repeat(8)].join("")],
      ["database", ["postgresql://rituvia:", "long-canary@db.example.test/app"].join("")],
      ["slack", ["xoxb-", "1234567890-abcdefghijklmno"].join("")],
    ] as const;

    for (const [name, canary] of canaries) {
      const findings = scanSecretText(`fixtures/${name}.txt`, `prefix\n${canary}\nsuffix`);
      expect(findings, name).toHaveLength(1);
      expect(JSON.stringify(findings), name).not.toContain(canary);
      expect(findings[0]?.line).toBe(2);
    }
  });

  it("fails closed for sensitive filenames while allowing placeholders", () => {
    expect(isSensitiveFilePath(".env")).toBe(true);
    expect(isSensitiveFilePath(".env.staging")).toBe(true);
    expect(isSensitiveFilePath(".env.test.local")).toBe(true);
    expect(isSensitiveFilePath("config/credentials.json")).toBe(true);
    expect(isSensitiveFilePath("certificates/server.pem")).toBe(true);
    expect(isSensitiveFilePath(".env.example")).toBe(false);
    expect(
      scanSecretText(".env.example", "DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB"),
    ).toHaveLength(0);
  });

  it("fails closed for binary content and npm credentials", () => {
    const binaryCanary = Buffer.concat([
      Buffer.from([0]),
      Buffer.from(["ghp_", "x".repeat(40)].join("")),
    ]);
    expect(scanSecretBuffer("fixtures/blob.bin", binaryCanary)).toEqual([
      {
        fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/),
        line: 1,
        path: "fixtures/blob.bin",
        rule: "binary-content",
      },
    ]);
    const npmCanary = ["//registry.npmjs.org/:_authToken=", "npm-secret-canary"].join("");
    const findings = scanSecretText(".npmrc", npmCanary);
    expect(findings).toHaveLength(1);
    expect(JSON.stringify(findings)).not.toContain(npmCanary);
    expect(scanSecretText(".npmrc", "//registry.npmjs.org/:_authToken=${NPM_TOKEN}")).toHaveLength(
      0,
    );
  });

  it("reports only path, line, rule, and a non-secret fingerprint", () => {
    const canary = ["ghp_", "z".repeat(40)].join("");
    const [finding] = scanSecretText("safe.txt", canary);
    expect(finding).toEqual({
      fingerprint: expect.stringMatching(/^[0-9a-f]{16}$/),
      line: 1,
      path: "safe.txt",
      rule: "github-token",
    });
    expect(Object.keys(finding ?? {}).sort()).toEqual(["fingerprint", "line", "path", "rule"]);
  });
});
