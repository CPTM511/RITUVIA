import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { assertRegularFileBelowRoot } from "../scripts/editorial-content-path.js";

const temporaryRoots: string[] = [];

const fixture = async (): Promise<
  Readonly<{ artifact: string; content: string; root: string }>
> => {
  const root = await mkdtemp(path.join(tmpdir(), "rituvia-editorial-path-"));
  temporaryRoots.push(root);
  const content = path.join(root, "content");
  const directory = path.join(content, "editorial");
  const artifact = path.join(directory, "manifest.json");
  await mkdir(directory, { recursive: true });
  await writeFile(artifact, "{}\n", "utf8");
  return { artifact, content, root };
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("editorial content path boundary", () => {
  it("accepts only regular files through regular parent directories", async () => {
    const { artifact, content } = await fixture();
    await expect(assertRegularFileBelowRoot(content, artifact)).resolves.toBe(
      await realpath(artifact),
    );
  });

  it("rejects final-file and parent-directory symbolic links", async () => {
    const { artifact, content, root } = await fixture();
    const outsideDirectory = path.join(root, "outside");
    const outsideFile = path.join(outsideDirectory, "outside.json");
    await mkdir(outsideDirectory);
    await writeFile(outsideFile, "{}\n", "utf8");
    const finalLink = path.join(content, "editorial", "linked.json");
    const parentLink = path.join(content, "linked-parent");
    await symlink(outsideFile, finalLink);
    await symlink(outsideDirectory, parentLink);

    await expect(assertRegularFileBelowRoot(content, finalLink)).rejects.toThrow("symbolic links");
    await expect(
      assertRegularFileBelowRoot(content, path.join(parentLink, "outside.json")),
    ).rejects.toThrow("symbolic links");
    await expect(assertRegularFileBelowRoot(content, artifact)).resolves.toBe(
      await realpath(artifact),
    );
  });

  it("rejects a symbolic content root and lexical path escape", async () => {
    const { artifact, content, root } = await fixture();
    const rootLink = path.join(root, "content-link");
    await symlink(content, rootLink);

    await expect(
      assertRegularFileBelowRoot(rootLink, path.join(rootLink, "editorial", "manifest.json")),
    ).rejects.toThrow("regular directory");
    await expect(
      assertRegularFileBelowRoot(content, path.join(root, "outside.json")),
    ).rejects.toThrow("escapes");
    await expect(assertRegularFileBelowRoot(content, artifact)).resolves.toBe(
      await realpath(artifact),
    );
  });
});
