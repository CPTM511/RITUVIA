import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const tools = Object.freeze({
  actionlint: Object.freeze({
    asset: "actionlint_1.7.12_linux_amd64.tar.gz",
    binary: "actionlint",
    sha256: "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8",
    version: "1.7.12",
  }),
  gitleaks: Object.freeze({
    asset: "gitleaks_8.30.1_linux_x64.tar.gz",
    binary: "gitleaks",
    sha256: "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
    version: "8.30.1",
  }),
});

const actionlintDarwinArm64 = Object.freeze({
  asset: "actionlint_1.7.12_darwin_arm64.tar.gz",
  binary: "actionlint",
  sha256: "aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f",
  version: "1.7.12",
});
const gitleaksDarwinArm64 = Object.freeze({
  asset: "gitleaks_8.30.1_darwin_arm64.tar.gz",
  binary: "gitleaks",
  sha256: "b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5",
  version: "8.30.1",
});

const allowedDownloadHost = (hostname) =>
  hostname === "github.com" || hostname.endsWith(".githubusercontent.com");

const download = async (url, redirects = 0) => {
  if (redirects > 5 || url.protocol !== "https:" || !allowedDownloadHost(url.hostname)) {
    throw new Error("Pinned CI tool download location is not allowed.");
  }
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "user-agent": "rituvia-ci" } }, (response) => {
      const location = response.headers.location;
      if (
        response.statusCode !== undefined &&
        response.statusCode >= 300 &&
        response.statusCode < 400
      ) {
        response.resume();
        if (location === undefined) reject(new Error("Pinned CI tool redirect is missing."));
        else resolve(download(new URL(location, url), redirects + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error("Pinned CI tool download failed."));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 32 * 1024 * 1024) request.destroy(new Error("Pinned CI tool is too large."));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.setTimeout(60_000, () =>
      request.destroy(new Error("Pinned CI tool download timed out.")),
    );
    request.on("error", reject);
  });
};

const downloadWithRetry = async (url) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await download(url);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
      }
    }
  }
  throw new Error("Pinned CI tool download failed after bounded retries.", { cause: lastError });
};

const [toolName, ...providedArguments] = process.argv.slice(2);
if (!(toolName in tools)) {
  throw new Error("Unknown pinned CI tool.");
}

const linuxX64 = os.platform() === "linux" && os.arch() === "x64";
const darwinArm64 = os.platform() === "darwin" && os.arch() === "arm64";
if (!linuxX64 && !darwinArm64) {
  throw new Error("Pinned CI tool does not support this runtime architecture.");
}

const tool = linuxX64
  ? tools[toolName]
  : toolName === "actionlint"
    ? actionlintDarwinArm64
    : gitleaksDarwinArm64;
const versionPrefix = toolName === "actionlint" ? "v" : "v";
const releaseUrl = new URL(
  `https://github.com/${toolName === "actionlint" ? "rhysd/actionlint" : "gitleaks/gitleaks"}/releases/download/${versionPrefix}${tool.version}/${tool.asset}`,
);
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), `rituvia-${toolName}-`));

try {
  const archivePath = path.join(temporaryDirectory, tool.asset);
  await writeFile(archivePath, await downloadWithRetry(releaseUrl), { mode: 0o600 });
  const actualChecksum = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex");
  if (actualChecksum !== tool.sha256) throw new Error("Pinned CI tool checksum mismatch.");
  execFileSync("/usr/bin/tar", ["-xzf", archivePath, "-C", temporaryDirectory, tool.binary], {
    stdio: "ignore",
  });
  const binaryPath = path.join(temporaryDirectory, tool.binary);
  await chmod(binaryPath, 0o700);
  const gitleaksConfigurationPath = path.join(temporaryDirectory, "gitleaks.toml");
  const gitleaksIgnorePath = path.join(temporaryDirectory, "gitleaks-ignore");
  if (toolName === "gitleaks") {
    await writeFile(gitleaksConfigurationPath, "[extend]\nuseDefault = true\n", { mode: 0o600 });
    await writeFile(gitleaksIgnorePath, "", { mode: 0o600 });
  }
  const argumentsForTool =
    toolName === "gitleaks"
      ? [
          "--config",
          gitleaksConfigurationPath,
          "--gitleaks-ignore-path",
          gitleaksIgnorePath,
          "--ignore-gitleaks-allow",
          "git",
          "--redact",
          "--no-banner",
          "--verbose",
          ".",
        ]
      : providedArguments;
  if (toolName === "actionlint" && providedArguments.length !== 1) {
    throw new Error("actionlint requires exactly one workflow path.");
  }
  const result = spawnSync(binaryPath, argumentsForTool, { stdio: "inherit" });
  if (result.status !== 0 || result.error !== undefined) process.exitCode = 1;
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
