import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
};

const readManifest = async (path: string): Promise<PackageManifest> =>
  JSON.parse(await readFile(path, "utf8")) as PackageManifest;

describe("workspace contract", () => {
  it("keeps every application and package private with real build gates", async () => {
    const manifests = await Promise.all(
      [
        "apps/web/package.json",
        "apps/worker/package.json",
        "packages/config/package.json",
        "packages/domain/package.json",
      ].map(readManifest),
    );

    expect(manifests.map(({ name }) => name)).toEqual([
      "@rituvia/web",
      "@rituvia/worker",
      "@rituvia/config",
      "@rituvia/domain",
    ]);

    for (const manifest of manifests) {
      expect(manifest.private).toBe(true);
      expect(manifest.scripts?.build).toBeTypeOf("string");
      expect(manifest.scripts?.typecheck).toBeTypeOf("string");
    }
  });
});
