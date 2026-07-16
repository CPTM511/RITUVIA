import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
};

const readManifest = async (path: string): Promise<PackageManifest> =>
  JSON.parse(await readFile(path, "utf8")) as PackageManifest;

const workspaceManifestPaths = async (): Promise<readonly string[]> => {
  const paths = await Promise.all(
    ["apps", "packages"].map(async (area) => {
      const entries = await readdir(area, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(area, entry.name, "package.json"));
    }),
  );
  const candidates = paths.flat().sort();
  const existing = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await readFile(candidate, "utf8");
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }),
  );
  return existing.filter((candidate): candidate is string => candidate !== null);
};

describe("workspace contract", () => {
  it("keeps every application and package private with real build gates", async () => {
    const manifests = await Promise.all((await workspaceManifestPaths()).map(readManifest));
    const names = manifests.map(({ name }) => name);

    expect(manifests.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);

    for (const manifest of manifests) {
      expect(manifest.name).toMatch(/^@rituvia\/[a-z0-9-]+$/u);
      expect(manifest.private).toBe(true);
      expect(manifest.scripts?.build).toBeTypeOf("string");
      expect(manifest.scripts?.typecheck).toBeTypeOf("string");
    }
  });
});
