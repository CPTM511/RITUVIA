import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const packageRoot = resolve(import.meta.dirname, "..");
const argumentsList = process.argv.slice(2);
const valueAfter = (name) => {
  const index = argumentsList.indexOf(name);
  return index === -1 ? null : (argumentsList[index + 1] ?? null);
};
const cacheRoot = resolve(valueAfter("--output-root") ?? resolve(packageRoot, ".native-cache"));
const sourceRoot = resolve(cacheRoot, "source");
const ephemerisRoot = resolve(cacheRoot, "ephe");
const binaryRoot = resolve(cacheRoot, "bin");
const binaryPath = resolve(binaryRoot, "rituvia-swisseph");
const metadataPath = resolve(cacheRoot, "build-metadata.json");
const manifestPath = resolve(packageRoot, "native/vendor-manifest.json");
const bridgePath = resolve(packageRoot, "native/rituvia_swisseph_bridge.c");
const fuzzHarnessPath = resolve(packageRoot, "native/rituvia_swisseph_fuzz.c");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const argumentsSet = new Set(argumentsList);
const allowDownload = argumentsSet.has("--allow-download");
const buildProfile = valueAfter("--build-profile") ?? "production";
const suppliedSourceRootValue = valueAfter("--source-root");
const suppliedSourceRoot =
  suppliedSourceRootValue === null ? null : resolve(suppliedSourceRootValue);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

if (
  (argumentsSet.has("--output-root") && valueAfter("--output-root") === null) ||
  (argumentsSet.has("--source-root") && suppliedSourceRootValue === null) ||
  (argumentsSet.has("--build-profile") && valueAfter("--build-profile") === null)
) {
  throw new Error("Native build option value is missing.");
}
if (!["production", "security"].includes(buildProfile)) {
  throw new Error("Native build profile is invalid.");
}

const ensureBuildDirectory = async (path) => {
  await mkdir(path, { recursive: true });
  const status = await lstat(path);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error("Native build directory must be a non-symlink directory.");
  }
  await chmod(path, 0o700);
};

const atomicWrite = async (path, value, mode) => {
  const temporaryPath = `${path}.write`;
  await writeFile(temporaryPath, value, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, mode);
};

const verifyRegularFile = async (filePath, expectedSha256) => {
  const status = await lstat(filePath);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error("Native vendor input must be a regular non-symlink file.");
  }
  const value = await readFile(filePath);
  if (sha256(value) !== expectedSha256) {
    throw new Error("Native vendor input checksum mismatch.");
  }
  return value;
};

const downloadOnce = async (path) => {
  const url = `${manifest.source.repository}/raw/${manifest.source.commit}/${path}`;
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "curl",
      [
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--max-time",
        "120",
        "--proto",
        "=https",
        "--tlsv1.2",
        "--user-agent",
        "rituvia-native-build/1.0",
        url,
      ],
      {
        env: { ...process.env, LANG: "C", LC_ALL: "C" },
        shell: false,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const output = [];
    let outputBytes = 0;
    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > 10_000_000) {
        child.kill("SIGKILL");
        rejectPromise(new Error("Pinned native source download exceeded its size limit."));
        return;
      }
      output.push(chunk);
    });
    child.once("error", () => rejectPromise(new Error("Pinned native source download failed.")));
    child.once("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error("Pinned native source download failed."));
        return;
      }
      resolvePromise(Buffer.concat(output));
    });
  });
};

const download = async (path) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await downloadOnce(path);
    } catch {
      if (attempt === 3) {
        throw new Error("Pinned native source download failed after retries.");
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_000));
    }
  }
  throw new Error("Pinned native source download failed.");
};

const acquire = async (entry) => {
  const targetRoot = entry.path.startsWith("ephe/") ? cacheRoot : sourceRoot;
  const targetPath = resolve(targetRoot, entry.path.startsWith("ephe/") ? entry.path : entry.path);
  if (!targetPath.startsWith(`${targetRoot}/`) && targetPath !== targetRoot) {
    throw new Error("Native vendor manifest path escaped its root.");
  }

  let value;
  if (suppliedSourceRoot !== null) {
    const suppliedPath = resolve(suppliedSourceRoot, entry.path);
    if (!suppliedPath.startsWith(`${suppliedSourceRoot}/`)) {
      throw new Error("Supplied native source path escaped its root.");
    }
    value = await verifyRegularFile(suppliedPath, entry.sha256);
  } else {
    try {
      value = await verifyRegularFile(targetPath, entry.sha256);
    } catch {
      if (!allowDownload) {
        throw new Error(
          "Pinned native inputs are absent. Run native:prepare with --allow-download or --source-root.",
        );
      }
      value = await download(entry.path);
      if (sha256(value) !== entry.sha256) {
        throw new Error("Downloaded native vendor input checksum mismatch.");
      }
    }
  }

  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, value, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, targetPath);
  await chmod(targetPath, entry.path.startsWith("ephe/") ? 0o444 : 0o400);
  return Object.freeze({ path: entry.path, sha256: entry.sha256 });
};

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? packageRoot,
      env: {
        LANG: "C",
        LC_ALL: "C",
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        TMPDIR: tmpdir(),
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`Native build command failed: ${basename(command)}.`));
        return;
      }
      resolvePromise({
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8"),
      });
    });
  });

await ensureBuildDirectory(cacheRoot);
await ensureBuildDirectory(sourceRoot);
await ensureBuildDirectory(ephemerisRoot);
await ensureBuildDirectory(binaryRoot);
const inventory = [];
for (let index = 0; index < manifest.files.length; index += 4) {
  inventory.push(...(await Promise.all(manifest.files.slice(index, index + 4).map(acquire))));
}

const sourceFiles = manifest.files
  .map(({ path }) => path)
  .filter((path) => path.endsWith(".c"))
  .map((path) => resolve(sourceRoot, path));
const securitySanitizers = process.platform === "darwin" ? "undefined" : "address,undefined";
const commonFlags = [
  "-std=c11",
  ...(buildProfile === "security"
    ? ["-O1", "-g", "-fno-omit-frame-pointer", `-fsanitize=${securitySanitizers}`]
    : ["-O2"]),
  "-fno-common",
  "-fstack-protector-strong",
  "-D_FORTIFY_SOURCE=2",
  ...(process.platform === "linux" ? ["-D_POSIX_C_SOURCE=200809L"] : []),
  "-fPIE",
  "-Wall",
  "-Wextra",
  "-Werror=format-security",
  "-Werror=implicit-function-declaration",
  ...(buildProfile === "security" ? ["-fno-sanitize-recover=all"] : []),
];
const linkFlags = [
  ...(process.platform === "darwin"
    ? ["-Wl,-pie", "-Wl,-dead_strip", "-Wl,-no_uuid"]
    : ["-Wl,-pie", "-Wl,-z,relro", "-Wl,-z,now"]),
  ...(buildProfile === "security" ? [`-fsanitize=${securitySanitizers}`] : []),
];
const temporaryBinary = `${binaryPath}.build`;
await run("cc", [
  ...commonFlags,
  "-I",
  sourceRoot,
  bridgePath,
  ...sourceFiles,
  "-lm",
  ...linkFlags,
  "-o",
  temporaryBinary,
]);
await chmod(temporaryBinary, 0o500);
await rename(temporaryBinary, binaryPath);

const compiler = await run("cc", ["--version"]);
const binary = await verifyRegularFile(binaryPath, sha256(await readFile(binaryPath)));
const sourceInventorySha256 = sha256(
  `${inventory
    .filter(({ path }) => !path.startsWith("ephe/"))
    .map(({ path, sha256: digest }) => `${path}:${digest}`)
    .sort()
    .join("\n")}\n`,
);
const dataInventorySha256 = sha256(
  `${inventory
    .filter(({ path }) => path.startsWith("ephe/"))
    .map(({ path, sha256: digest }) => `${path}:${digest}`)
    .sort()
    .join("\n")}\n`,
);
const compilerFlagsSha256 = sha256(`${[...commonFlags, ...linkFlags].join("\n")}\n`);
const bridgeSha256 = sha256(await readFile(bridgePath));
const fuzzHarnessSha256 = sha256(await readFile(fuzzHarnessPath));
const sbom = {
  components: [
    ...inventory.map(({ path, sha256: digest }) => ({
      license: "AGPL-3.0-only",
      name: path,
      sha256: digest,
      sourceCommit: manifest.source.commit,
    })),
    {
      license: "AGPL-3.0-only",
      name: "native/rituvia_swisseph_bridge.c",
      sha256: bridgeSha256,
      sourceCommit: `sha256:${bridgeSha256}`,
    },
    {
      license: "AGPL-3.0-only",
      name: "native/rituvia_swisseph_fuzz.c",
      sha256: fuzzHarnessSha256,
      sourceCommit: `sha256:${fuzzHarnessSha256}`,
    },
  ],
  schemaVersion: "rituvia-native-sbom.v1",
};
const sbomValue = `${JSON.stringify(sbom, null, 2)}\n`;
const sbomPath = resolve(cacheRoot, "sbom.json");
await atomicWrite(sbomPath, sbomValue, 0o400);

const metadata = {
  buildProfile,
  securitySanitizers: buildProfile === "security" ? securitySanitizers.split(",") : [],
  engine: {
    abiVersion: `${process.platform}-${process.arch}-c-cli-v1`,
    adapterVersion: "1.0.0",
    binarySha256: sha256(binary),
    compilerFlagsSha256,
    compilerId: compiler.stdout.split("\n")[0]?.trim(),
    dataInventorySha256,
    libraryVersion: "2.10.03",
    nativeSbomSha256: sha256(sbomValue),
    sourceCommit: manifest.source.commit,
    sourceInventorySha256,
    sourceSnapshotTag: manifest.source.tag,
  },
  runtime: {
    binaryPath,
    ephemerisPath: ephemerisRoot,
  },
};
await atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 0o400);
await chmod(ephemerisRoot, 0o500);
await chmod(sourceRoot, 0o500);
await chmod(binaryRoot, 0o500);
await chmod(cacheRoot, 0o500);

process.stdout.write(
  `${JSON.stringify({
    binaryPath,
    metadataPath,
    sourceInventorySha256,
    dataInventorySha256,
  })}\n`,
);

process.on("exit", () => {
  void rm(temporaryBinary, { force: true });
});
