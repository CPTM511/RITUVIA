import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEnvironmentVariables,
  serverEnvironmentVariables,
} from "../packages/config/src/server.js";

const root = process.cwd();

const readProductionTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (path.relative(root, absolutePath) === "packages/db/src/generated/prisma") {
          return [];
        }
        if ([".next", ".turbo", "dist", "node_modules", "test"].includes(entry.name)) {
          return [];
        }
        return readProductionTypeScriptFiles(absolutePath);
      }
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [absolutePath] : [];
    }),
  );
  return files.flat();
};

describe("environment file contract", () => {
  it("tracks exactly the documented variables with empty values", async () => {
    const example = await readFile(path.join(root, ".env.example"), "utf8");
    const assignments = example
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#"));
    const parsed = assignments.map((assignment) => assignment.split("=", 2));

    expect(parsed.every(([, value]) => value === "")).toBe(true);
    expect(parsed.map(([key]) => key)).toEqual(serverEnvironmentVariables);
    expect(new Set(parsed.map(([key]) => key)).size).toBe(parsed.length);
    expect(buildEnvironmentVariables).not.toContain("DATABASE_URL");
  });

  it("ignores every local environment file except the empty example", async () => {
    const ignoreRules = await readFile(path.join(root, ".gitignore"), "utf8");

    expect(ignoreRules).toMatch(/^\.env$/m);
    expect(ignoreRules).toMatch(/^\.env\.\*$/m);
    expect(ignoreRules).toMatch(/^!\.env\.example$/m);
  });

  it("keeps server-runtime secrets out of the build orchestrator environment", async () => {
    const turbo = JSON.parse(await readFile(path.join(root, "turbo.json"), "utf8")) as {
      tasks: { build: { env: string[] } };
    };

    expect([...turbo.tasks.build.env].sort()).toEqual([...buildEnvironmentVariables].sort());
    expect(turbo.tasks.build.env).not.toContain("DATABASE_URL");
  });
});

describe("source configuration boundaries", () => {
  it("keeps process environment access in the approved adapters", async () => {
    const files = [
      ...(await readProductionTypeScriptFiles(path.join(root, "apps"))),
      ...(await readProductionTypeScriptFiles(path.join(root, "packages"))),
    ];
    const environmentReaders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/process(?:\["env"\]|\.env)/.test(source) || /globalThis\.process/.test(source)) {
        environmentReaders.push(path.relative(root, file));
      }
    }

    expect(environmentReaders.sort()).toEqual([
      "apps/web/config/server.ts",
      "apps/web/next.config.ts",
      "apps/web/start.mjs",
      "apps/worker/src/main.ts",
      "packages/db/prisma.config.ts",
      "packages/db/prisma/seed.ts",
      "packages/db/scripts/local-postgres.mjs",
      "packages/db/scripts/verify-foundation.mjs",
    ]);
  });

  it("marks the Web server entry server-only and keeps the client entry isolated", async () => {
    const serverEntry = await readFile(path.join(root, "apps/web/config/server.ts"), "utf8");
    const clientEntry = await readFile(
      path.join(root, "apps/web/config/client-provider.tsx"),
      "utf8",
    );
    const sharedClientEntry = await readFile(
      path.join(root, "packages/config/src/client.ts"),
      "utf8",
    );
    const clientBrandEntry = await readFile(
      path.join(root, "packages/config/src/client-brand.ts"),
      "utf8",
    );
    const nextConfig = await readFile(path.join(root, "apps/web/next.config.ts"), "utf8");

    expect(serverEntry.startsWith('import "server-only";')).toBe(true);
    expect(clientEntry).not.toMatch(/process\.env|config\/server/);
    expect(sharedClientEntry).not.toMatch(/process\.env|\.\/server|from "\.\/brand/);
    expect(clientBrandEntry).not.toMatch(
      /legalEntity|supportEmail|transactionalSender|working-brand/,
    );
    expect(nextConfig).not.toMatch(/\benv\s*:/);
  });

  it("loads the same repository-root environment set in Web and Worker adapters", async () => {
    const sources = await Promise.all(
      ["apps/web/next.config.ts", "apps/web/start.mjs", "apps/worker/src/main.ts"].map((file) =>
        readFile(path.join(root, file), "utf8"),
      ),
    );

    for (const source of sources) {
      expect(source).toContain('from "@next/env"');
      expect(source).toContain("loadEnvConfig(repositoryRoot");
    }
    expect(sources[2]).not.toContain("--env-file");
  });

  it("contains no working-brand display literal in application production source", async () => {
    const files = await readProductionTypeScriptFiles(path.join(root, "apps"));
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/(["'`])Rituvia\1|(["'`])RITUVIA\2/.test(source)) {
        violations.push(path.relative(root, file));
      }
    }

    expect(violations).toEqual([]);
  });
});
