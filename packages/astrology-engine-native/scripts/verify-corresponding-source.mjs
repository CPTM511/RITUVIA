import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const packageRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(packageRoot, "../..");
const manifestPath = resolve(packageRoot, "native/vendor-manifest.json");
const argumentsList = process.argv.slice(2).filter((value) => value !== "--");
const maximumFileBytes = 64 * 1024 * 1024;
const nativeCacheRoot = resolve(packageRoot, ".native-cache");
const archiveDirectory = resolve(nativeCacheRoot, "corresponding-source");
const archiveName = "rituvia-native-corresponding-source.tar";
const archivePath = resolve(archiveDirectory, archiveName);
const bundleName = "rituvia-native-corresponding-source";
const fixedTimestamp = new Date("2000-01-01T00:00:00.000Z");

const valueAfter = (name) => {
  const index = argumentsList.indexOf(name);
  return index === -1 ? null : (argumentsList[index + 1] ?? null);
};
const sourceRootValue = valueAfter("--source-root");
const allowDownload = argumentsList.includes("--allow-download");
const allowedOptions = new Set(["--allow-download", "--source-root"]);
for (const argument of argumentsList) {
  if (argument.startsWith("--") && !allowedOptions.has(argument)) {
    throw new Error("Corresponding Source option is invalid.");
  }
}
if (
  argumentsList.filter((value) => value === "--allow-download").length > 1 ||
  argumentsList.filter((value) => value === "--source-root").length > 1 ||
  (argumentsList.includes("--source-root") && sourceRootValue === null) ||
  allowDownload === (sourceRootValue !== null)
) {
  throw new Error("Corresponding Source requires exactly one explicit source acquisition mode.");
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const archiveRelativePath = (path) => path.split(sep).join("/");
const assertSafeRelativePath = (path) => {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\0") ||
    path.includes("\n") ||
    path.split("/").includes("..")
  ) {
    throw new Error("Corresponding Source path is invalid.");
  }
};
const inside = (root, path) => path === root || path.startsWith(`${root}${sep}`);
const readRegularFile = async (path) => {
  const status = await lstat(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.size === 0 ||
    status.size > maximumFileBytes
  ) {
    throw new Error("Corresponding Source input must be a bounded regular file.");
  }
  return await readFile(path);
};
const copyRegularFile = async (sourcePath, destinationPath) => {
  const value = await readRegularFile(sourcePath);
  await mkdir(dirname(destinationPath), { recursive: true, mode: 0o755 });
  await writeFile(destinationPath, value, { flag: "wx", mode: 0o444 });
};
const run = (command, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: options.env ?? {
        ...process.env,
        LANG: "C",
        LC_ALL: "C",
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    const append = (target, chunk) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > 8 * 1024 * 1024) {
        child.kill("SIGKILL");
        rejectPromise(new Error("Corresponding Source command output exceeded its limit."));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk) => append(stdout, chunk));
    child.stderr.on("data", (chunk) => append(stderr, chunk));
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`Corresponding Source command failed: ${command}.`));
        return;
      }
      resolvePromise({
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
    });
  });

const excludedDirectoryNames = new Set([".native-cache", ".turbo", "dist", "node_modules"]);
const collectFiles = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.includes("\n") || entry.name.includes("\0") || entry.isSymbolicLink()) {
      throw new Error("Corresponding Source tree contains an invalid entry.");
    }
    const entryPath = resolve(current, entry.name);
    if (!inside(root, entryPath)) {
      throw new Error("Corresponding Source tree escaped its root.");
    }
    if (entry.isDirectory()) {
      if (!excludedDirectoryNames.has(entry.name)) {
        paths.push(...(await collectFiles(root, entryPath)));
      }
    } else if (entry.isFile()) {
      paths.push(entryPath);
    } else {
      throw new Error("Corresponding Source tree contains a non-regular entry.");
    }
  }
  return paths;
};

const copyWorkspacePath = async (workspaceRelativePath, stagingRoot) => {
  assertSafeRelativePath(workspaceRelativePath);
  const sourcePath = resolve(workspaceRoot, workspaceRelativePath);
  const destinationPath = resolve(stagingRoot, workspaceRelativePath);
  if (!inside(workspaceRoot, sourcePath) || !inside(stagingRoot, destinationPath)) {
    throw new Error("Corresponding Source copy path escaped its root.");
  }
  await copyRegularFile(sourcePath, destinationPath);
};
const copyWorkspaceTree = async (workspaceRelativePath, stagingRoot) => {
  const sourceRoot = resolve(workspaceRoot, workspaceRelativePath);
  for (const sourcePath of await collectFiles(sourceRoot)) {
    const path = archiveRelativePath(relative(workspaceRoot, sourcePath));
    await copyWorkspacePath(path, stagingRoot);
  }
};
const inventoryFor = async (root, excluded = new Set()) => {
  const files = [];
  for (const filePath of await collectFiles(root)) {
    const path = archiveRelativePath(relative(root, filePath));
    if (!excluded.has(path)) {
      assertSafeRelativePath(path);
      files.push({
        path,
        sha256: sha256(await readRegularFile(filePath)),
      });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
};
const normalizeTree = async (root) => {
  const directories = [root];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const entryPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        directories.push(entryPath);
        await visit(entryPath);
      } else {
        await chmod(entryPath, 0o444);
        await utimes(entryPath, fixedTimestamp, fixedTimestamp);
      }
    }
  };
  await visit(root);
  for (const directory of directories.reverse()) {
    await chmod(directory, 0o555);
    await utimes(directory, fixedTimestamp, fixedTimestamp);
  }
};
const verifyInventory = async (root, expectedInventory) => {
  const actualInventory = await inventoryFor(root, new Set(["CORRESPONDING_SOURCE_MANIFEST.json"]));
  if (JSON.stringify(actualInventory) !== JSON.stringify(expectedInventory)) {
    throw new Error("Extracted Corresponding Source inventory mismatch.");
  }
};
const cleanTemporaryTree = async (path) => {
  try {
    await run("/bin/chmod", ["-R", "u+rwX", path]);
  } catch {}
  await rm(path, { force: true, recursive: true });
};

const vendorManifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (
  vendorManifest.schemaVersion !== "rituvia-native-vendor-manifest.v1" ||
  !/^[0-9a-f]{40}$/u.test(vendorManifest.source?.commit) ||
  !Array.isArray(vendorManifest.files)
) {
  throw new Error("Corresponding Source vendor manifest is invalid.");
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "rituvia-corresponding-source-"));
const acquiredRoot = resolve(temporaryRoot, "acquired");
const stagingParent = resolve(temporaryRoot, "staging");
const stagingRoot = resolve(stagingParent, bundleName);
const extractionRoot = resolve(temporaryRoot, "extracted");
const rebuildRoot = resolve(temporaryRoot, "rebuild");
const fakeBinRoot = resolve(temporaryRoot, "fake-bin");
const networkMarker = resolve(temporaryRoot, "network-used");
const temporaryArchivePath = resolve(archiveDirectory, `${archiveName}.write-${process.pid}`);

try {
  await mkdir(stagingRoot, { recursive: true, mode: 0o755 });
  await run(process.execPath, [
    resolve(packageRoot, "scripts/prepare-native.mjs"),
    "--output-root",
    acquiredRoot,
    ...(allowDownload ? ["--allow-download"] : ["--source-root", resolve(sourceRootValue)]),
  ]);

  const requiredWorkspaceFiles = [
    ".npmrc",
    "LICENSE",
    "NOTICE.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tests/server-only-stub.ts",
    "tsconfig.base.json",
    "turbo.json",
    "vitest.config.ts",
    "docs/OPEN_SOURCE_COMPLIANCE.md",
  ];
  for (const path of requiredWorkspaceFiles) {
    await copyWorkspacePath(path, stagingRoot);
  }
  await copyWorkspaceTree("patches", stagingRoot);
  await copyWorkspaceTree("packages/astrology-engine-native", stagingRoot);
  await copyWorkspaceTree("packages/divination", stagingRoot);
  await copyWorkspaceTree("packages/domain", stagingRoot);
  await copyWorkspaceTree("content/sources/astrology", stagingRoot);

  for (const entry of vendorManifest.files) {
    if (
      typeof entry.path !== "string" ||
      typeof entry.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(entry.sha256)
    ) {
      throw new Error("Corresponding Source vendor entry is invalid.");
    }
    assertSafeRelativePath(entry.path);
    const acquiredPath = entry.path.startsWith("ephe/")
      ? resolve(acquiredRoot, entry.path)
      : resolve(acquiredRoot, "source", entry.path);
    const value = await readRegularFile(acquiredPath);
    if (sha256(value) !== entry.sha256) {
      throw new Error("Corresponding Source vendor checksum mismatch.");
    }
    const destinationPath = resolve(stagingRoot, "vendor/swisseph", entry.path);
    if (!inside(stagingRoot, destinationPath)) {
      throw new Error("Corresponding Source vendor path escaped its root.");
    }
    await mkdir(dirname(destinationPath), { recursive: true, mode: 0o755 });
    await writeFile(destinationPath, value, { flag: "wx", mode: 0o444 });
  }

  const head = (
    await run("git", ["rev-parse", "--verify", "HEAD"], { cwd: workspaceRoot })
  ).stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(head)) {
    throw new Error("Corresponding Source repository revision is invalid.");
  }
  const worktreeState =
    (
      await run("git", ["status", "--porcelain=v1", "--untracked-files=normal"], {
        cwd: workspaceRoot,
      })
    ).stdout.trim().length === 0
      ? "clean"
      : "dirty";
  const rebuildInstructions = `# Native Corresponding Source offline rebuild

This archive is a native-component dry run, not proof that a complete deployed RITUVIA release
matches a public source revision.

From this directory, with Node.js and a C11 compiler already installed:

\`\`\`sh
node packages/astrology-engine-native/scripts/prepare-native.mjs \\
  --source-root vendor/swisseph \\
  --output-root .offline-native-build
\`\`\`

The command must not access the network. It verifies every Swiss Ephemeris source and data file
against \`packages/astrology-engine-native/native/vendor-manifest.json\` before compiling.
`;
  await writeFile(resolve(stagingRoot, "REBUILD.md"), rebuildInstructions, {
    flag: "wx",
    mode: 0o444,
  });

  const payloadInventory = await inventoryFor(stagingRoot);
  const correspondingSourceManifest = {
    archiveScope: "native-component-dry-run",
    files: payloadInventory,
    repositoryHead: head,
    schemaVersion: "rituvia-native-corresponding-source.v1",
    upstream: {
      commit: vendorManifest.source.commit,
      repository: vendorManifest.source.repository,
      tag: vendorManifest.source.tag,
    },
    worktreeState,
  };
  await writeFile(
    resolve(stagingRoot, "CORRESPONDING_SOURCE_MANIFEST.json"),
    `${JSON.stringify(correspondingSourceManifest, null, 2)}\n`,
    { flag: "wx", mode: 0o444 },
  );
  await normalizeTree(stagingRoot);

  await mkdir(nativeCacheRoot, { recursive: true, mode: 0o700 });
  await chmod(nativeCacheRoot, 0o700);
  await mkdir(archiveDirectory, { recursive: true, mode: 0o700 });
  await chmod(archiveDirectory, 0o700);
  const archiveEntries = (await collectFiles(stagingRoot)).map(
    (path) => `${bundleName}/${archiveRelativePath(relative(stagingRoot, path))}`,
  );
  const archiveListPath = resolve(temporaryRoot, "archive-files.txt");
  await writeFile(archiveListPath, `${archiveEntries.sort().join("\n")}\n`, {
    flag: "wx",
    mode: 0o400,
  });
  await run(
    "/usr/bin/tar",
    ["--no-xattrs", "-cf", temporaryArchivePath, "-C", stagingParent, "-T", archiveListPath],
    {
      env: {
        ...process.env,
        COPYFILE_DISABLE: "1",
        LANG: "C",
        LC_ALL: "C",
      },
    },
  );
  await rename(temporaryArchivePath, archivePath);
  await chmod(archivePath, 0o400);

  await mkdir(extractionRoot, { recursive: true, mode: 0o700 });
  await run("/usr/bin/tar", ["-xf", archivePath, "-C", extractionRoot], {
    env: {
      ...process.env,
      COPYFILE_DISABLE: "1",
      LANG: "C",
      LC_ALL: "C",
    },
  });
  const extractedRoot = resolve(extractionRoot, bundleName);
  const extractedManifest = JSON.parse(
    await readFile(resolve(extractedRoot, "CORRESPONDING_SOURCE_MANIFEST.json"), "utf8"),
  );
  if (
    extractedManifest.schemaVersion !== "rituvia-native-corresponding-source.v1" ||
    extractedManifest.upstream?.commit !== vendorManifest.source.commit
  ) {
    throw new Error("Extracted Corresponding Source manifest is invalid.");
  }
  await verifyInventory(extractedRoot, extractedManifest.files);

  await mkdir(fakeBinRoot, { recursive: true, mode: 0o700 });
  const fakeCurlPath = resolve(fakeBinRoot, "curl");
  await writeFile(fakeCurlPath, `#!/bin/sh\nprintf used > "$RITUVIA_NETWORK_MARKER"\nexit 99\n`, {
    flag: "wx",
    mode: 0o500,
  });
  await run(
    process.execPath,
    [
      resolve(extractedRoot, "packages/astrology-engine-native/scripts/prepare-native.mjs"),
      "--source-root",
      resolve(extractedRoot, "vendor/swisseph"),
      "--output-root",
      rebuildRoot,
    ],
    {
      cwd: extractedRoot,
      env: {
        ...process.env,
        LANG: "C",
        LC_ALL: "C",
        PATH: `${fakeBinRoot}:${process.env.PATH ?? "/usr/bin:/bin"}`,
        RITUVIA_NETWORK_MARKER: networkMarker,
      },
    },
  );
  try {
    await stat(networkMarker);
    throw new Error("Corresponding Source offline rebuild attempted network access.");
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  const baselineMetadata = JSON.parse(
    await readFile(resolve(acquiredRoot, "build-metadata.json"), "utf8"),
  );
  const rebuiltMetadata = JSON.parse(
    await readFile(resolve(rebuildRoot, "build-metadata.json"), "utf8"),
  );
  if (
    baselineMetadata.buildProfile !== rebuiltMetadata.buildProfile ||
    JSON.stringify(baselineMetadata.engine) !== JSON.stringify(rebuiltMetadata.engine)
  ) {
    throw new Error("Corresponding Source offline rebuild evidence mismatch.");
  }

  process.stdout.write(
    `${JSON.stringify({
      archivePath,
      archiveScope: correspondingSourceManifest.archiveScope,
      archiveSha256: sha256(await readFile(archivePath)),
      fileCount: payloadInventory.length + 1,
      offlineRebuild: true,
      repositoryHead: head,
      upstreamCommit: vendorManifest.source.commit,
      worktreeState,
    })}\n`,
  );
} finally {
  await rm(temporaryArchivePath, { force: true });
  try {
    await chmod(archiveDirectory, 0o500);
    await chmod(nativeCacheRoot, 0o500);
  } catch {}
  await cleanTemporaryTree(temporaryRoot);
}
