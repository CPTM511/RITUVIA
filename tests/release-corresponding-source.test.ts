import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoots: string[] = [];
const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map(async (root) => {
      try {
        execFileSync("/bin/chmod", ["-R", "u+rwX", root]);
      } catch {}
      await rm(root, { force: true, recursive: true });
    }),
  );
});

const collectFiles = async (root: string, current = root): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, entryPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, entryPath).split(path.sep).join("/"));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
};

type Fixture = Readonly<{
  componentArchivePath: string;
  componentArchiveSha256: string;
  repositoryRevision: string;
  root: string;
}>;

const fixture = async ({
  componentPrepareOverride,
  componentWorktreeState = "clean",
  trackedLfsPointer = false,
  trackedSymlink = false,
}: Readonly<{
  componentPrepareOverride?: string;
  componentWorktreeState?: "clean" | "dirty";
  trackedLfsPointer?: boolean;
  trackedSymlink?: boolean;
}> = {}): Promise<Fixture> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rituvia-release-source-test-"));
  temporaryRoots.push(root);
  const nativeRoot = path.join(root, "packages", "astrology-engine-native");
  await Promise.all([
    mkdir(path.join(root, "docs"), { recursive: true }),
    mkdir(path.join(root, "scripts"), { recursive: true }),
    mkdir(path.join(nativeRoot, "native"), { recursive: true }),
    mkdir(path.join(nativeRoot, "scripts"), { recursive: true }),
  ]);
  await cp(
    path.join(repositoryRoot, "scripts", "verify-release-corresponding-source.mjs"),
    path.join(root, "scripts", "verify-release-corresponding-source.mjs"),
  );

  const vendorLicense = "Synthetic pinned vendor license\n";
  const vendorManifest = {
    files: [{ path: "LICENSE", sha256: sha256(vendorLicense) }],
    schemaVersion: "rituvia-native-vendor-manifest.v1",
    source: {
      commit: "a".repeat(40),
      repository: "https://example.invalid/vendor.git",
      tag: "v1.0.0",
    },
  };
  const prepareScript = [
    'import { mkdir, readFile, writeFile } from "node:fs/promises";',
    'import { resolve } from "node:path";',
    "const args = process.argv.slice(2);",
    'const sourceRoot = resolve(args[args.indexOf("--source-root") + 1]);',
    'const outputRoot = resolve(args[args.indexOf("--output-root") + 1]);',
    'if ((await readFile(resolve(sourceRoot, "LICENSE"), "utf8")).length === 0) process.exit(2);',
    "await mkdir(outputRoot, { recursive: true });",
    'await writeFile(resolve(outputRoot, "build-metadata.json"), "{\\"offline\\":true}\\n");',
    'process.stdout.write("{\\"offline\\":true}\\n");',
    "",
  ].join("\n");

  const files = new Map<string, string>([
    [".gitignore", ".DS_Store\n.release-cache/\npackages/astrology-engine-native/.native-cache/\n"],
    ["LICENSE", "GNU AFFERO GENERAL PUBLIC LICENSE\n"],
    ["NOTICE.md", "Synthetic notice\n"],
    ["docs/OPEN_SOURCE_COMPLIANCE.md", "# Synthetic policy\n"],
    [
      "package.json",
      `${JSON.stringify(
        {
          license: "AGPL-3.0-only",
          name: "rituvia-release-source-fixture",
          packageManager: "pnpm@11.13.1",
          private: true,
        },
        null,
        2,
      )}\n`,
    ],
    [
      "packages/astrology-engine-native/native/vendor-manifest.json",
      `${JSON.stringify(vendorManifest, null, 2)}\n`,
    ],
    [
      "packages/astrology-engine-native/package.json",
      '{"license":"AGPL-3.0-only","name":"@rituvia/astrology-engine-native","private":true}\n',
    ],
    ["packages/astrology-engine-native/scripts/prepare-native.mjs", prepareScript],
    [
      "packages/astrology-engine-native/scripts/verify-corresponding-source.mjs",
      'process.stdout.write("synthetic component verifier\\n");\n',
    ],
    ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
    ["pnpm-workspace.yaml", "packages:\n  - packages/*\n"],
  ]);
  for (const [relativePath, value] of files) {
    const destination = path.join(root, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, value);
  }
  if (trackedSymlink) {
    await symlink("NOTICE.md", path.join(root, "tracked-link"));
  }
  if (trackedLfsPointer) {
    await writeFile(
      path.join(root, "tracked-lfs.bin"),
      [
        "version https://git-lfs.github.com/spec/v1",
        `oid sha256:${"b".repeat(64)}`,
        "size 123",
        "",
      ].join("\n"),
    );
  }

  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "release-source@example.invalid"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Release Source Test"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  const repositoryRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();

  const componentParent = path.join(nativeRoot, ".native-cache", "fixture");
  const componentRoot = path.join(componentParent, "rituvia-native-corresponding-source");
  await mkdir(path.join(componentRoot, "vendor", "swisseph"), { recursive: true });
  const overlapPaths = [
    "packages/astrology-engine-native/native/vendor-manifest.json",
    "packages/astrology-engine-native/package.json",
    "packages/astrology-engine-native/scripts/prepare-native.mjs",
    "packages/astrology-engine-native/scripts/verify-corresponding-source.mjs",
  ];
  for (const relativePath of overlapPaths) {
    const destination = path.join(componentRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    const value =
      relativePath === "packages/astrology-engine-native/scripts/prepare-native.mjs" &&
      componentPrepareOverride !== undefined
        ? componentPrepareOverride
        : await readFile(path.join(root, relativePath), "utf8");
    await writeFile(destination, value);
  }
  await writeFile(path.join(componentRoot, "vendor", "swisseph", "LICENSE"), vendorLicense);
  await writeFile(path.join(componentRoot, "REBUILD.md"), "# Synthetic component rebuild\n");
  const componentFiles = await collectFiles(componentRoot);
  const componentInventory = await Promise.all(
    componentFiles.map(async (relativePath) => ({
      path: relativePath,
      sha256: sha256(await readFile(path.join(componentRoot, relativePath))),
    })),
  );
  await writeFile(
    path.join(componentRoot, "CORRESPONDING_SOURCE_MANIFEST.json"),
    `${JSON.stringify(
      {
        archiveScope: "native-component-dry-run",
        files: componentInventory,
        repositoryHead: repositoryRevision,
        schemaVersion: "rituvia-native-corresponding-source.v1",
        upstream: vendorManifest.source,
        worktreeState: componentWorktreeState,
      },
      null,
      2,
    )}\n`,
  );
  const archiveListPath = path.join(componentParent, "archive-files.txt");
  const archiveEntries = (await collectFiles(componentRoot)).map(
    (relativePath) => `rituvia-native-corresponding-source/${relativePath}`,
  );
  await writeFile(archiveListPath, `${archiveEntries.join("\n")}\n`);
  const componentArchivePath = path.join(componentParent, "component.tar");
  execFileSync(
    "/usr/bin/tar",
    ["--no-xattrs", "-cf", componentArchivePath, "-C", componentParent, "-T", archiveListPath],
    { cwd: root },
  );
  return {
    componentArchivePath,
    componentArchiveSha256: sha256(await readFile(componentArchivePath)),
    repositoryRevision,
    root,
  };
};

const execute = (
  candidate: Fixture,
  overrides: Readonly<{
    componentArchiveSha256?: string;
    environment?: NodeJS.ProcessEnv;
  }> = {},
) =>
  spawnSync(
    process.execPath,
    [
      "scripts/verify-release-corresponding-source.mjs",
      "--expected-revision",
      candidate.repositoryRevision,
      "--component-archive",
      candidate.componentArchivePath,
      "--component-archive-sha256",
      overrides.componentArchiveSha256 ?? candidate.componentArchiveSha256,
    ],
    {
      cwd: candidate.root,
      encoding: "utf8",
      env: overrides.environment ?? process.env,
      timeout: 30_000,
    },
  );

describe("release Corresponding Source boundary", () => {
  it("archives an exact clean revision with pinned native source and an offline rebuild", async () => {
    const candidate = await fixture();
    const result = execute(candidate);
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    const evidence = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
    expect(evidence).toMatchObject({
      archiveScope: "complete-repository-plus-pinned-native-source",
      offlineNativeRebuild: true,
      repositoryRevision: candidate.repositoryRevision,
      worktreeState: "clean",
    });
    const archivePath = String(evidence.archivePath);
    const archiveNames = execFileSync("/usr/bin/tar", ["-tf", archivePath], {
      encoding: "utf8",
    });
    expect(archiveNames).toContain("/CORRESPONDING_SOURCE_MANIFEST.json");
    expect(archiveNames).toContain("/CORRESPONDING_SOURCE_REBUILD.md");
    expect(archiveNames).toContain("/vendor/swisseph/LICENSE");
  });

  it("rejects a dirty repository instead of labeling it as a release revision", async () => {
    const candidate = await fixture();
    await writeFile(path.join(candidate.root, "NOTICE.md"), "dirty\n");
    const result = execute(candidate);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("exact clean repository revision");
  });

  it("rejects unexpected ignored inputs instead of silently omitting them", async () => {
    const candidate = await fixture();
    await writeFile(path.join(candidate.root, ".DS_Store"), "ignored but unsafe\n");
    const result = execute(candidate);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("exact clean repository revision");
  });

  it("rejects a component archive checksum mismatch", async () => {
    const candidate = await fixture();
    const result = execute(candidate, { componentArchiveSha256: "0".repeat(64) });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("component archive checksum mismatch");
  });

  it("rejects dirty or source-divergent component evidence", async () => {
    const dirty = await fixture({ componentWorktreeState: "dirty" });
    const dirtyResult = execute(dirty);
    expect(dirtyResult.status).not.toBe(0);
    expect(`${dirtyResult.stdout}${dirtyResult.stderr}`).toContain("component manifest is invalid");

    const divergent = await fixture({
      componentPrepareOverride: 'process.stdout.write("different clean source\\n");\n',
    });
    const divergentResult = execute(divergent);
    expect(divergentResult.status).not.toBe(0);
    expect(`${divergentResult.stdout}${divergentResult.stderr}`).toContain(
      "component and repository source differ",
    );
  });

  it("rejects tracked symlinks before creating release source", async () => {
    const candidate = await fixture({ trackedSymlink: true });
    const result = execute(candidate);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "rejects symlinks, submodules, and conflicts",
    );
  });

  it("rejects unresolved Git LFS pointers from the source payload", async () => {
    const candidate = await fixture({ trackedLfsPointer: true });
    const result = execute(candidate);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("unresolved Git LFS pointers");
  });

  it("rejects environment variables that can redirect Node, Git, or tar", async () => {
    const candidate = await fixture();
    const result = execute(candidate, {
      environment: { ...process.env, TAR_OPTIONS: "--absolute-names" },
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("environment is not clean");
  });
});
