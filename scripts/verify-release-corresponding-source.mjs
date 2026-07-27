import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve, sep } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const argumentsList = process.argv.slice(2).filter((value) => value !== "--");
const allowedOptions = new Set([
  "--component-archive",
  "--component-archive-sha256",
  "--expected-revision",
]);
const fixedTimestamp = new Date("2000-01-01T00:00:00.000Z");
const maximumFileBytes = 64 * 1024 * 1024;
const releaseCacheRoot = resolve(repositoryRoot, ".release-cache");
const releaseArchiveDirectory = resolve(releaseCacheRoot, "corresponding-source");
const cleanEnvironment = Object.freeze({
  HOME: process.env.HOME ?? tmpdir(),
  LANG: "C",
  LC_ALL: "C",
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  TMPDIR: process.env.TMPDIR ?? tmpdir(),
  TZ: "UTC",
});
const forbiddenEnvironmentNames = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_WORK_TREE",
  "NODE_OPTIONS",
  "TAR_OPTIONS",
];
if (forbiddenEnvironmentNames.some((name) => (process.env[name] ?? "").length > 0)) {
  throw new Error("Release Corresponding Source environment is not clean.");
}

const valueAfter = (name) => {
  const indexes = argumentsList.flatMap((value, index) => (value === name ? [index] : []));
  if (indexes.length !== 1) return null;
  return argumentsList[indexes[0] + 1] ?? null;
};

for (let index = 0; index < argumentsList.length; index += 1) {
  const argument = argumentsList[index];
  if (!allowedOptions.has(argument)) {
    throw new Error("Release Corresponding Source option is invalid.");
  }
  const value = argumentsList[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error("Release Corresponding Source option value is missing.");
  }
  index += 1;
}

const expectedRevision = valueAfter("--expected-revision");
const componentArchiveValue = valueAfter("--component-archive");
const expectedComponentArchiveSha256 = valueAfter("--component-archive-sha256");
if (
  !/^[0-9a-f]{40}$/u.test(expectedRevision ?? "") ||
  componentArchiveValue === null ||
  !/^[0-9a-f]{64}$/u.test(expectedComponentArchiveSha256 ?? "")
) {
  throw new Error("Release Corresponding Source inputs are invalid.");
}

const componentArchivePath = resolve(repositoryRoot, componentArchiveValue);
const releaseArchiveName = `rituvia-corresponding-source-${expectedRevision}.tar`;
const releaseArchivePath = resolve(releaseArchiveDirectory, releaseArchiveName);
const temporaryArchivePath = resolve(
  releaseArchiveDirectory,
  `${releaseArchiveName}.write-${process.pid}`,
);
const bundleName = `rituvia-${expectedRevision}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const portablePath = (value) => value.split(sep).join("/");
const inside = (root, path) => path === root || path.startsWith(`${root}${sep}`);

const assertSafeRelativePath = (path) => {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("\n") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Release Corresponding Source path is invalid.");
  }
};

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: options.env ?? cleanEnvironment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      action();
    };
    const collect = (target) => (chunk) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > (options.maximumOutputBytes ?? 8 * 1024 * 1024)) {
        child.kill("SIGKILL");
        finish(() =>
          rejectPromise(
            new Error(
              `Release Corresponding Source command output exceeded its limit: ${basename(command)}.`,
            ),
          ),
        );
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", () =>
      finish(() =>
        rejectPromise(
          new Error(`Release Corresponding Source command failed to start: ${basename(command)}.`),
        ),
      ),
    );
    child.once("close", (code, signal) =>
      finish(() => {
        if (code !== 0 || signal !== null) {
          rejectPromise(
            new Error(`Release Corresponding Source command failed: ${basename(command)}.`),
          );
          return;
        }
        resolvePromise({
          stderr: Buffer.concat(stderr).toString("utf8"),
          stdout: Buffer.concat(stdout).toString("utf8"),
        });
      }),
    );
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() =>
        rejectPromise(
          new Error(`Release Corresponding Source command timed out: ${basename(command)}.`),
        ),
      );
    }, options.timeoutMilliseconds ?? 120_000);
  });

const readRegularFile = async (path) => {
  const status = await lstat(path);
  if (!status.isFile() || status.isSymbolicLink() || status.size > maximumFileBytes) {
    throw new Error("Release Corresponding Source input must be a bounded regular file.");
  }
  return await readFile(path);
};

const collectFiles = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.includes("\0") || entry.name.includes("\n") || entry.isSymbolicLink()) {
      throw new Error("Release Corresponding Source tree contains an invalid entry.");
    }
    const path = resolve(current, entry.name);
    if (!inside(root, path)) {
      throw new Error("Release Corresponding Source tree escaped its root.");
    }
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, path)));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw new Error("Release Corresponding Source tree contains a non-regular entry.");
    }
  }
  return files;
};

const inventoryFor = async (root, excluded = new Set()) => {
  const inventory = [];
  for (const filePath of await collectFiles(root)) {
    const path = portablePath(relative(root, filePath));
    assertSafeRelativePath(path);
    if (excluded.has(path)) continue;
    const status = await lstat(filePath);
    const value = await readRegularFile(filePath);
    if (value.subarray(0, 43).toString("utf8") === "version https://git-lfs.github.com/spec/v1\n") {
      throw new Error("Release Corresponding Source rejects unresolved Git LFS pointers.");
    }
    inventory.push({
      mode: (status.mode & 0o111) === 0 ? "100644" : "100755",
      path,
      sha256: sha256(value),
    });
  }
  return inventory.sort((left, right) => left.path.localeCompare(right.path));
};

const copyTree = async (sourceRoot, destinationRoot) => {
  for (const sourcePath of await collectFiles(sourceRoot)) {
    const path = portablePath(relative(sourceRoot, sourcePath));
    assertSafeRelativePath(path);
    const destinationPath = resolve(destinationRoot, path);
    if (!inside(destinationRoot, destinationPath)) {
      throw new Error("Release Corresponding Source copy escaped its root.");
    }
    const status = await lstat(sourcePath);
    await mkdir(dirname(destinationPath), { recursive: true, mode: 0o755 });
    await writeFile(destinationPath, await readRegularFile(sourcePath), {
      flag: "wx",
      mode: (status.mode & 0o111) === 0 ? 0o444 : 0o555,
    });
  }
};

const normalizeTree = async (root) => {
  const directories = [root];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) {
        directories.push(path);
        await visit(path);
      } else {
        await utimes(path, fixedTimestamp, fixedTimestamp);
      }
    }
  };
  await visit(root);
  for (const directory of directories.reverse()) {
    await chmod(directory, 0o555);
    await utimes(directory, fixedTimestamp, fixedTimestamp);
  }
};

const assertArchiveContainsOnlySafeRegularFiles = async (archivePath, expectedPrefix) => {
  const listing = (await run("/usr/bin/tar", ["-tf", archivePath])).stdout
    .split("\n")
    .filter((value) => value.length > 0);
  const verboseListing = (await run("/usr/bin/tar", ["-tvf", archivePath])).stdout
    .split("\n")
    .filter((value) => value.length > 0);
  if (
    listing.length === 0 ||
    listing.length !== verboseListing.length ||
    new Set(listing).size !== listing.length ||
    verboseListing.some((value) => value[0] !== "-")
  ) {
    throw new Error("Release Corresponding Source archive entry type is invalid.");
  }
  for (const path of listing) {
    assertSafeRelativePath(path);
    if (!path.startsWith(`${expectedPrefix}/`)) {
      throw new Error("Release Corresponding Source archive prefix is invalid.");
    }
  }
  return listing;
};

const verifyInventory = async (root, expectedInventory) => {
  const actualInventory = await inventoryFor(root, new Set(["CORRESPONDING_SOURCE_MANIFEST.json"]));
  if (JSON.stringify(actualInventory) !== JSON.stringify(expectedInventory)) {
    throw new Error("Release Corresponding Source extracted inventory mismatch.");
  }
};

const cleanTemporaryTree = async (path) => {
  try {
    await run("/bin/chmod", ["-R", "u+rwX", path]);
  } catch {}
  await rm(path, { force: true, recursive: true });
};

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "rituvia-release-source-"));
const gitArchivePath = resolve(temporaryRoot, "repository.tar");
const verifiedComponentArchivePath = resolve(temporaryRoot, "verified-component.tar");
const stagingParent = resolve(temporaryRoot, "staging");
const stagingRoot = resolve(stagingParent, bundleName);
const componentExtractionRoot = resolve(temporaryRoot, "component");
const extractionRoot = resolve(temporaryRoot, "extracted");
const rebuildRoot = resolve(temporaryRoot, "rebuild");
const fakeBinRoot = resolve(temporaryRoot, "fake-bin");
const networkMarker = resolve(temporaryRoot, "network-used");

try {
  const actualRepositoryRoot = (await run("git", ["rev-parse", "--show-toplevel"])).stdout.trim();
  const repositoryHead = (await run("git", ["rev-parse", "--verify", "HEAD"])).stdout.trim();
  const worktreeState = (
    await run("git", ["status", "--porcelain=v1", "--untracked-files=all"])
  ).stdout.trim();
  const ignoredState = (
    await run("git", ["status", "--porcelain=v1", "--ignored=matching", "--untracked-files=all"])
  ).stdout
    .split("\n")
    .filter((value) => value.startsWith("!! "))
    .map((value) => value.slice(3));
  const allowedIgnoredPath = (path) =>
    path === ".pnpm-store/" ||
    path === ".release-cache/" ||
    path === "packages/astrology-engine-native/.native-cache/" ||
    /^(?:.+\/)?node_modules\/$/u.test(path);
  if (
    resolve(actualRepositoryRoot) !== repositoryRoot ||
    repositoryHead !== expectedRevision ||
    worktreeState.length !== 0 ||
    ignoredState.some((path) => !allowedIgnoredPath(path))
  ) {
    throw new Error("Release Corresponding Source requires the exact clean repository revision.");
  }

  const stagedEntries = (await run("git", ["ls-files", "--stage", "-z"])).stdout
    .split("\0")
    .filter((value) => value.length > 0);
  const trackedPaths = new Set();
  const caseFoldedPaths = new Set();
  for (const entry of stagedEntries) {
    const match = /^(100644|100755) [0-9a-f]{40,64} 0\t(.+)$/u.exec(entry);
    if (match === null) {
      throw new Error("Release Corresponding Source rejects symlinks, submodules, and conflicts.");
    }
    assertSafeRelativePath(match[2]);
    const caseFoldedPath = match[2].toLocaleLowerCase("en-US");
    if (caseFoldedPaths.has(caseFoldedPath)) {
      throw new Error("Release Corresponding Source rejects case-colliding paths.");
    }
    caseFoldedPaths.add(caseFoldedPath);
    trackedPaths.add(match[2]);
  }
  const requiredTrackedPaths = [
    "LICENSE",
    "NOTICE.md",
    "docs/OPEN_SOURCE_COMPLIANCE.md",
    "package.json",
    "packages/astrology-engine-native/native/vendor-manifest.json",
    "packages/astrology-engine-native/scripts/prepare-native.mjs",
    "packages/astrology-engine-native/scripts/verify-corresponding-source.mjs",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "scripts/verify-release-corresponding-source.mjs",
  ];
  if (requiredTrackedPaths.some((path) => !trackedPaths.has(path))) {
    throw new Error("Release Corresponding Source required tracked input is missing.");
  }

  const packageManifest = JSON.parse(
    await readFile(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  const licenseText = (await readRegularFile(resolve(repositoryRoot, "LICENSE"))).toString("utf8");
  if (
    packageManifest.license !== "AGPL-3.0-only" ||
    typeof packageManifest.packageManager !== "string" ||
    !packageManifest.packageManager.startsWith("pnpm@") ||
    !licenseText.includes("GNU AFFERO GENERAL PUBLIC LICENSE")
  ) {
    throw new Error("Release Corresponding Source root license contract is invalid.");
  }

  const componentArchive = await readRegularFile(componentArchivePath);
  if (sha256(componentArchive) !== expectedComponentArchiveSha256) {
    throw new Error("Release Corresponding Source component archive checksum mismatch.");
  }
  await writeFile(verifiedComponentArchivePath, componentArchive, {
    flag: "wx",
    mode: 0o400,
  });
  await assertArchiveContainsOnlySafeRegularFiles(
    verifiedComponentArchivePath,
    "rituvia-native-corresponding-source",
  );

  await mkdir(componentExtractionRoot, { recursive: true, mode: 0o700 });
  await run("/usr/bin/tar", ["-xf", verifiedComponentArchivePath, "-C", componentExtractionRoot]);
  const componentRoot = resolve(componentExtractionRoot, "rituvia-native-corresponding-source");
  const componentManifest = JSON.parse(
    await readFile(resolve(componentRoot, "CORRESPONDING_SOURCE_MANIFEST.json"), "utf8"),
  );
  if (
    componentManifest.schemaVersion !== "rituvia-native-corresponding-source.v1" ||
    componentManifest.archiveScope !== "native-component-dry-run" ||
    componentManifest.repositoryHead !== expectedRevision ||
    componentManifest.worktreeState !== "clean" ||
    !Array.isArray(componentManifest.files)
  ) {
    throw new Error("Release Corresponding Source component manifest is invalid.");
  }
  const actualComponentInventory = (
    await inventoryFor(componentRoot, new Set(["CORRESPONDING_SOURCE_MANIFEST.json"]))
  ).map(({ path, sha256: digest }) => ({ path, sha256: digest }));
  if (JSON.stringify(actualComponentInventory) !== JSON.stringify(componentManifest.files)) {
    throw new Error("Release Corresponding Source component inventory mismatch.");
  }

  await mkdir(stagingRoot, { recursive: true, mode: 0o755 });
  await run("git", ["archive", "--format=tar", `--output=${gitArchivePath}`, expectedRevision]);
  await run("/usr/bin/tar", ["-xf", gitArchivePath, "-C", stagingRoot]);

  const requiredComponentOverlap = [
    "packages/astrology-engine-native/native/vendor-manifest.json",
    "packages/astrology-engine-native/package.json",
    "packages/astrology-engine-native/scripts/prepare-native.mjs",
    "packages/astrology-engine-native/scripts/verify-corresponding-source.mjs",
  ];
  const componentInventoryByPath = new Map(
    componentManifest.files.map((entry) => [entry.path, entry.sha256]),
  );
  for (const path of requiredComponentOverlap) {
    const componentDigest = componentInventoryByPath.get(path);
    const repositoryDigest = sha256(await readRegularFile(resolve(stagingRoot, path)));
    if (componentDigest !== repositoryDigest) {
      throw new Error("Release Corresponding Source component and repository source differ.");
    }
  }
  for (const [path, componentDigest] of componentInventoryByPath) {
    if (
      typeof path === "string" &&
      typeof componentDigest === "string" &&
      trackedPaths.has(path) &&
      sha256(await readRegularFile(resolve(stagingRoot, path))) !== componentDigest
    ) {
      throw new Error("Release Corresponding Source component and repository source differ.");
    }
  }

  const vendorSourceRoot = resolve(componentRoot, "vendor/swisseph");
  const vendorDestinationRoot = resolve(stagingRoot, "vendor/swisseph");
  try {
    await lstat(vendorDestinationRoot);
    throw new Error("Release Corresponding Source vendor destination collides with Git source.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const vendorManifest = JSON.parse(
    await readFile(
      resolve(stagingRoot, "packages/astrology-engine-native/native/vendor-manifest.json"),
      "utf8",
    ),
  );
  if (
    vendorManifest.schemaVersion !== "rituvia-native-vendor-manifest.v1" ||
    !/^[0-9a-f]{40}$/u.test(vendorManifest.source?.commit ?? "") ||
    !Array.isArray(vendorManifest.files) ||
    vendorManifest.files.length === 0
  ) {
    throw new Error("Release Corresponding Source vendor manifest is invalid.");
  }
  const expectedVendorPaths = [];
  for (const entry of vendorManifest.files) {
    if (typeof entry.path !== "string" || !/^[0-9a-f]{64}$/u.test(entry.sha256 ?? "")) {
      throw new Error("Release Corresponding Source vendor entry is invalid.");
    }
    assertSafeRelativePath(entry.path);
    const value = await readRegularFile(resolve(vendorSourceRoot, entry.path));
    if (sha256(value) !== entry.sha256) {
      throw new Error("Release Corresponding Source vendor checksum mismatch.");
    }
    expectedVendorPaths.push(entry.path);
  }
  const actualVendorPaths = (await collectFiles(vendorSourceRoot))
    .map((path) => portablePath(relative(vendorSourceRoot, path)))
    .sort();
  if (JSON.stringify(actualVendorPaths) !== JSON.stringify(expectedVendorPaths.sort())) {
    throw new Error("Release Corresponding Source vendor inventory is incomplete.");
  }
  await copyTree(vendorSourceRoot, vendorDestinationRoot);

  const rebuildInstructions = `# RITUVIA Corresponding Source rebuild

This archive is bound to repository revision \`${expectedRevision}\`.

Install the locked dependencies with Node.js and pnpm versions declared by the repository:

\`\`\`sh
pnpm install --frozen-lockfile
\`\`\`

Rebuild the pinned native astrology engine without network access:

\`\`\`sh
node packages/astrology-engine-native/scripts/prepare-native.mjs \\
  --source-root vendor/swisseph \\
  --output-root .offline-native-build
\`\`\`

Run the repository build and release gates before deploying this exact revision.
`;
  await writeFile(resolve(stagingRoot, "CORRESPONDING_SOURCE_REBUILD.md"), rebuildInstructions, {
    flag: "wx",
    mode: 0o444,
  });

  const payloadInventory = await inventoryFor(stagingRoot);
  const releaseManifest = {
    archiveScope: "complete-repository-plus-pinned-native-source",
    componentArchiveSha256: expectedComponentArchiveSha256,
    files: payloadInventory,
    packageManager: packageManifest.packageManager,
    repositoryRevision: expectedRevision,
    schemaVersion: "rituvia-release-corresponding-source.v1",
    upstream: {
      commit: vendorManifest.source.commit,
      repository: vendorManifest.source.repository,
      tag: vendorManifest.source.tag,
    },
    worktreeState: "clean",
  };
  await writeFile(
    resolve(stagingRoot, "CORRESPONDING_SOURCE_MANIFEST.json"),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    { flag: "wx", mode: 0o444 },
  );
  await normalizeTree(stagingRoot);

  await mkdir(releaseCacheRoot, { recursive: true, mode: 0o700 });
  await chmod(releaseCacheRoot, 0o700);
  await mkdir(releaseArchiveDirectory, { recursive: true, mode: 0o700 });
  await chmod(releaseArchiveDirectory, 0o700);
  const archiveEntries = (await collectFiles(stagingRoot)).map(
    (path) => `${bundleName}/${portablePath(relative(stagingRoot, path))}`,
  );
  const archiveListPath = resolve(temporaryRoot, "archive-files.txt");
  await writeFile(archiveListPath, `${archiveEntries.sort().join("\n")}\n`, {
    flag: "wx",
    mode: 0o400,
  });
  await run(
    "/usr/bin/tar",
    ["--no-xattrs", "-cf", temporaryArchivePath, "-C", stagingParent, "-T", archiveListPath],
    { env: { ...cleanEnvironment, COPYFILE_DISABLE: "1" } },
  );

  await assertArchiveContainsOnlySafeRegularFiles(temporaryArchivePath, bundleName);
  await mkdir(extractionRoot, { recursive: true, mode: 0o700 });
  await run("/usr/bin/tar", ["-xf", temporaryArchivePath, "-C", extractionRoot]);
  const extractedRoot = resolve(extractionRoot, bundleName);
  const extractedManifest = JSON.parse(
    await readFile(resolve(extractedRoot, "CORRESPONDING_SOURCE_MANIFEST.json"), "utf8"),
  );
  if (
    extractedManifest.schemaVersion !== "rituvia-release-corresponding-source.v1" ||
    extractedManifest.repositoryRevision !== expectedRevision ||
    extractedManifest.componentArchiveSha256 !== expectedComponentArchiveSha256 ||
    JSON.stringify(extractedManifest.files) !== JSON.stringify(payloadInventory)
  ) {
    throw new Error("Release Corresponding Source extracted manifest is invalid.");
  }
  await verifyInventory(extractedRoot, payloadInventory);

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
        ...cleanEnvironment,
        PATH: `${fakeBinRoot}:${cleanEnvironment.PATH}`,
        RITUVIA_NETWORK_MARKER: networkMarker,
      },
    },
  );
  try {
    await stat(networkMarker);
    throw new Error("Release Corresponding Source offline rebuild attempted network access.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await lstat(releaseArchivePath);
    throw new Error("Release Corresponding Source output already exists.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await link(temporaryArchivePath, releaseArchivePath);
  await chmod(releaseArchivePath, 0o400);
  await rm(temporaryArchivePath, { force: true });

  process.stdout.write(
    `${JSON.stringify({
      archivePath: releaseArchivePath,
      archiveScope: releaseManifest.archiveScope,
      archiveSha256: sha256(await readFile(releaseArchivePath)),
      fileCount: payloadInventory.length + 1,
      offlineNativeRebuild: true,
      repositoryRevision: expectedRevision,
      worktreeState: "clean",
    })}\n`,
  );
} finally {
  await rm(temporaryArchivePath, { force: true });
  try {
    await chmod(releaseArchiveDirectory, 0o500);
    await chmod(releaseCacheRoot, 0o500);
  } catch {}
  await cleanTemporaryTree(temporaryRoot);
}
