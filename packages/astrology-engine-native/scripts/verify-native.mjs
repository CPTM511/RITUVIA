import { chmod, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { spawn } from "node:child_process";

const packageRoot = resolve(import.meta.dirname, "..");
const prepareScript = resolve(packageRoot, "scripts/prepare-native.mjs");
const forwarded = process.argv.slice(2).filter((value) => value !== "--");

const run = (command, argumentsList, environment = process.env) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, {
      cwd: resolve(packageRoot, "../.."),
      env: environment,
      shell: false,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error("Native verification command failed."));
        return;
      }
      resolvePromise();
    });
  });

const firstRoot = await mkdtemp(resolve(tmpdir(), "rituvia-native-first-"));
const secondRoot = await mkdtemp(resolve(tmpdir(), "rituvia-native-second-"));

try {
  await run(process.execPath, [prepareScript, ...forwarded, "--output-root", firstRoot]);
  await run(process.execPath, [prepareScript, ...forwarded, "--output-root", secondRoot]);
  const first = JSON.parse(await readFile(resolve(firstRoot, "build-metadata.json"), "utf8"));
  const second = JSON.parse(await readFile(resolve(secondRoot, "build-metadata.json"), "utf8"));
  const reproducibleFields = [
    "binarySha256",
    "compilerFlagsSha256",
    "dataInventorySha256",
    "nativeSbomSha256",
    "sourceInventorySha256",
  ];
  for (const field of reproducibleFields) {
    if (first.engine[field] !== second.engine[field]) {
      throw new Error(`Native build reproducibility check failed for ${field}.`);
    }
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
      ...process.env,
      PATH: `${resolve(process.execPath, "..")}${delimiter}${process.env.PATH ?? ""}`,
      RITUVIA_NATIVE_BUILD_METADATA_PATH: resolve(firstRoot, "build-metadata.json"),
    },
  );
} finally {
  await Promise.all(
    [firstRoot, secondRoot]
      .flatMap((root) => [
        root,
        resolve(root, "source"),
        resolve(root, "ephe"),
        resolve(root, "bin"),
      ])
      .map(async (path) => {
        try {
          await chmod(path, 0o700);
        } catch {
          // Cleanup is best effort when preparation failed before creating every directory.
        }
      }),
  );
  await Promise.all([
    rm(firstRoot, { force: true, recursive: true }),
    rm(secondRoot, { force: true, recursive: true }),
  ]);
}
