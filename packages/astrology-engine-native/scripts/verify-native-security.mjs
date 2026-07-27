import { createHash } from "node:crypto";
import { chmod, lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { spawn } from "node:child_process";

const packageRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const prepareScript = resolve(packageRoot, "scripts/prepare-native.mjs");
const manifestPath = resolve(packageRoot, "native/vendor-manifest.json");
const bridgePath = resolve(packageRoot, "native/rituvia_swisseph_bridge.c");
const fuzzHarnessPath = resolve(packageRoot, "native/rituvia_swisseph_fuzz.c");
const forwarded = process.argv.slice(2).filter((value) => value !== "--");
const allowedOptions = new Set(["--allow-download", "--source-root"]);

for (let index = 0; index < forwarded.length; index += 1) {
  const option = forwarded[index];
  if (!allowedOptions.has(option)) {
    throw new Error("Native security verification option is invalid.");
  }
  if (option === "--source-root") {
    const value = forwarded[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error("Native security verification source root is missing.");
    }
    index += 1;
  }
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const securityRoot = await mkdtemp(resolve(tmpdir(), "rituvia-native-security-"));
const binaryPath = resolve(securityRoot, "bin/rituvia-swisseph");
const ephemerisPath = resolve(securityRoot, "ephe");
const metadataPath = resolve(securityRoot, "build-metadata.json");
const sanitizerPattern =
  /AddressSanitizer|LeakSanitizer|UndefinedBehaviorSanitizer|runtime error:|SUMMARY: .*Sanitizer/u;

const run = (
  command,
  argumentsList,
  {
    environment = process.env,
    expected = "success",
    label = "command",
    maximumOutputBytes = 1_048_576,
    timeoutMilliseconds = 10_000,
  } = {},
) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, {
      cwd: repositoryRoot,
      env: environment,
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
      if (outputBytes > maximumOutputBytes) {
        child.kill("SIGKILL");
        finish(() =>
          rejectPromise(new Error(`Native security ${label} output exceeded its bound.`)),
        );
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", () =>
      finish(() => rejectPromise(new Error(`Native security ${label} failed to start.`))),
    );
    child.once("close", (code, signal) =>
      finish(() => {
        const stdoutText = Buffer.concat(stdout).toString("utf8");
        const stderrText = Buffer.concat(stderr).toString("utf8");
        if (signal !== null || sanitizerPattern.test(stderrText)) {
          rejectPromise(new Error(`Native security ${label} sanitizer or signal failure.`));
          return;
        }
        if (
          (expected === "success" && code !== 0) ||
          (expected === "failure" && code === 0) ||
          (expected === "failure" && stdoutText.length !== 0)
        ) {
          rejectPromise(new Error(`Native security ${label} returned an unexpected result.`));
          return;
        }
        resolvePromise({ stderr: stderrText, stdout: stdoutText });
      }),
    );
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => rejectPromise(new Error(`Native security ${label} timed out.`)));
    }, timeoutMilliseconds);
  });

const regularFile = async (path) => {
  const status = await lstat(path);
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error("Native security input must be a regular non-symlink file.");
  }
  return await readFile(path);
};

const safeManifestPath = (path) =>
  /^(?:LICENSE|agpl-3\.0\.txt|ephe\/se(?:mo|pl)_18\.se1|[a-z0-9_]+\.[ch])$/u.test(path) &&
  !path.includes("..");

const assertSupplyChainClosure = async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.schemaVersion !== "rituvia-native-vendor-manifest.v1" ||
    manifest.license?.spdx !== "AGPL-3.0-only" ||
    manifest.license?.noticePath !== "LICENSE" ||
    manifest.license?.textPath !== "agpl-3.0.txt" ||
    !/^[0-9a-f]{40}$/u.test(manifest.source?.commit ?? "") ||
    !/^v[0-9]+\.[0-9]+\.[0-9]+[a-z]+$/u.test(manifest.source?.tag ?? "") ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 23
  ) {
    throw new Error("Native vendor manifest contract is invalid.");
  }
  const names = manifest.files.map(({ path }) => path);
  if (
    new Set(names).size !== names.length ||
    !names.includes("LICENSE") ||
    !names.includes("agpl-3.0.txt") ||
    names.some((path) => !safeManifestPath(path))
  ) {
    throw new Error("Native vendor manifest inventory is invalid.");
  }

  const localIncludes = new Set();
  for (const entry of manifest.files) {
    if (!/^[0-9a-f]{64}$/u.test(entry.sha256)) {
      throw new Error("Native vendor manifest digest is invalid.");
    }
    const acquiredPath = resolve(
      entry.path.startsWith("ephe/") ? securityRoot : resolve(securityRoot, "source"),
      entry.path,
    );
    const value = await regularFile(acquiredPath);
    if (sha256(value) !== entry.sha256) {
      throw new Error("Native acquired input digest drifted.");
    }
    if (/\.[ch]$/u.test(entry.path)) {
      for (const match of value.toString("utf8").matchAll(/^\s*#\s*include\s+"([^"]+)"/gmu)) {
        localIncludes.add(match[1]);
      }
    }
  }
  if ([...localIncludes].some((include) => !names.includes(include))) {
    throw new Error("Native source include closure is incomplete.");
  }

  const agpl = (await regularFile(resolve(securityRoot, "source/agpl-3.0.txt"))).toString("utf8");
  if (!agpl.includes("GNU AFFERO GENERAL PUBLIC LICENSE")) {
    throw new Error("Native AGPL license text is invalid.");
  }

  const sbom = JSON.parse(await readFile(resolve(securityRoot, "sbom.json"), "utf8"));
  const expectedComponents = new Map(
    manifest.files.map((entry) => [
      entry.path,
      `${entry.sha256}:${manifest.source.commit}:AGPL-3.0-only`,
    ]),
  );
  expectedComponents.set(
    "native/rituvia_swisseph_bridge.c",
    `${sha256(await regularFile(bridgePath))}:sha256:${sha256(await regularFile(bridgePath))}:AGPL-3.0-only`,
  );
  expectedComponents.set(
    "native/rituvia_swisseph_fuzz.c",
    `${sha256(await regularFile(fuzzHarnessPath))}:sha256:${sha256(await regularFile(fuzzHarnessPath))}:AGPL-3.0-only`,
  );
  if (
    sbom.schemaVersion !== "rituvia-native-sbom.v1" ||
    !Array.isArray(sbom.components) ||
    sbom.components.length !== expectedComponents.size
  ) {
    throw new Error("Native SBOM contract is invalid.");
  }
  for (const component of sbom.components) {
    const expected = expectedComponents.get(component.name);
    if (
      expected === undefined ||
      expected !== `${component.sha256}:${component.sourceCommit}:${component.license}`
    ) {
      throw new Error("Native SBOM component is invalid.");
    }
    expectedComponents.delete(component.name);
  }
  if (expectedComponents.size !== 0) {
    throw new Error("Native SBOM is incomplete.");
  }
  return manifest;
};

const baseArguments = [ephemerisPath, "2000", "1", "1", "12", "0", "0", "0", "0", "P", "1"];
const sanitizerEnvironment = {
  ...process.env,
  ...(process.platform === "darwin"
    ? {}
    : { ASAN_OPTIONS: "abort_on_error=1:detect_leaks=1:strict_string_checks=1" }),
  LANG: "C",
  LC_ALL: "C",
  UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1",
};

const runBridgeCase = async (argumentsList, expected) =>
  await run(binaryPath, argumentsList, {
    environment: sanitizerEnvironment,
    expected,
    label: "mutation-smoke",
    maximumOutputBytes: 131_072,
    timeoutMilliseconds: 5_000,
  });

const invalidMutations = Object.freeze([
  [1, "1799"],
  [1, "2200"],
  [2, "0"],
  [2, "13"],
  [3, "0"],
  [3, "32"],
  [4, "24"],
  [5, "60"],
  [6, "60000"],
  [7, "-90000001"],
  [7, "90000001"],
  [8, "-180000001"],
  [8, "180000001"],
  [9, ""],
  [9, "PP"],
  [9, "X"],
  [10, "-1"],
  [10, "2"],
]);

let fuzzCaseCount = 0;
const coverageGuidedFuzzRuns = process.platform === "linux" ? 5_000 : 0;

try {
  await run(
    process.execPath,
    [prepareScript, ...forwarded, "--build-profile", "security", "--output-root", securityRoot],
    { label: "security-build" },
  );
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  if (
    metadata.buildProfile !== "security" ||
    JSON.stringify(metadata.securitySanitizers) !==
      JSON.stringify(process.platform === "darwin" ? ["undefined"] : ["address", "undefined"]) ||
    metadata.engine?.abiVersion !== `${process.platform}-${process.arch}-c-cli-v1` ||
    !/^[0-9a-f]{64}$/u.test(metadata.engine?.compilerFlagsSha256 ?? "")
  ) {
    throw new Error("Native security build metadata is invalid.");
  }
  const manifest = await assertSupplyChainClosure();
  if (process.platform === "linux") {
    const fuzzBinaryPath = resolve(securityRoot, "bin/rituvia-swisseph-fuzz");
    const sourceFiles = manifest.files
      .map(({ path }) => path)
      .filter((path) => path.endsWith(".c"))
      .map((path) => resolve(securityRoot, "source", path));
    const fuzzSanitizers = "fuzzer,address,undefined";
    await chmod(resolve(securityRoot, "bin"), 0o700);
    await run(
      "clang",
      [
        "-std=c11",
        "-O1",
        "-g",
        "-fno-common",
        "-fno-omit-frame-pointer",
        "-fstack-protector-strong",
        "-D_FORTIFY_SOURCE=2",
        "-D_POSIX_C_SOURCE=200809L",
        "-Wall",
        "-Wextra",
        "-Werror=format-security",
        "-Werror=implicit-function-declaration",
        `-fsanitize=${fuzzSanitizers}`,
        "-fno-sanitize-recover=all",
        "-I",
        resolve(securityRoot, "source"),
        fuzzHarnessPath,
        ...sourceFiles,
        "-lm",
        `-fsanitize=${fuzzSanitizers}`,
        "-o",
        fuzzBinaryPath,
      ],
      { label: "fuzzer-build" },
    );
    await chmod(fuzzBinaryPath, 0o500);
    await chmod(resolve(securityRoot, "bin"), 0o500);
    await run(
      fuzzBinaryPath,
      [
        `-runs=${coverageGuidedFuzzRuns}`,
        "-max_len=256",
        "-timeout=5",
        "-rss_limit_mb=1024",
        "-print_final_stats=1",
      ],
      {
        environment: {
          ...sanitizerEnvironment,
          RITUVIA_FUZZ_EPHE_PATH: ephemerisPath,
        },
        label: "coverage-guided-fuzz",
        maximumOutputBytes: 1_048_576,
        timeoutMilliseconds: 60_000,
      },
    );
  }

  for (const argumentsList of [
    baseArguments,
    [ephemerisPath, "1800", "1", "1", "0", "0", "0", "-90000000", "-180000000", "P", "0"],
    [ephemerisPath, "2199", "12", "31", "23", "59", "59999", "90000000", "180000000", "A", "0"],
  ]) {
    const result = await runBridgeCase(argumentsList, "success");
    JSON.parse(result.stdout);
    fuzzCaseCount += 1;
  }

  for (const [index, value] of invalidMutations) {
    const candidate = [...baseArguments];
    candidate[index] = value;
    await runBridgeCase(candidate, "failure");
    fuzzCaseCount += 1;
  }
  await runBridgeCase(baseArguments.slice(0, -1), "failure");
  await runBridgeCase([...baseArguments, "extra"], "failure");
  fuzzCaseCount += 2;

  let state = 0x5eed_9309;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_!@#";
  for (let index = 0; index < 128; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const fieldIndex = 1 + (state % 10);
    const length = 1 + ((state >>> 8) % 64);
    let value = "";
    for (let characterIndex = 0; characterIndex < length; characterIndex += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      value += alphabet[state % alphabet.length];
    }
    const candidate = [...baseArguments];
    candidate[fieldIndex] = value;
    await runBridgeCase(candidate, "failure");
    fuzzCaseCount += 1;
  }

  await run(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "packages/astrology-engine-native/test/native-integration.test.ts",
      "packages/astrology-engine-native/test/independent-astronomy.test.ts",
    ],
    {
      environment: {
        ...sanitizerEnvironment,
        PATH: `${resolve(process.execPath, "..")}${delimiter}${process.env.PATH ?? ""}`,
        RITUVIA_NATIVE_BUILD_METADATA_PATH: metadataPath,
      },
      label: "sanitized-integration",
      timeoutMilliseconds: 30_000,
    },
  );

  process.stdout.write(
    `${JSON.stringify({
      architecture: process.arch,
      buildProfile: "security",
      coverageGuidedFuzzRuns,
      mutationCaseCount: fuzzCaseCount,
      platform: process.platform,
      sanitizers: metadata.securitySanitizers,
      sourceCommit: manifest.source.commit,
      vendorComponentCount: manifest.files.length,
    })}\n`,
  );
} finally {
  await Promise.all(
    [
      securityRoot,
      resolve(securityRoot, "source"),
      ephemerisPath,
      resolve(securityRoot, "bin"),
    ].map(async (path) => {
      try {
        await chmod(path, 0o700);
      } catch {
        // Cleanup is best effort when preparation failed before creating every directory.
      }
    }),
  );
  await rm(securityRoot, { force: true, recursive: true });
}
