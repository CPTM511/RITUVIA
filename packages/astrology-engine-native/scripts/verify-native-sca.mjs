import { readFile, lstat } from "node:fs/promises";
import https from "node:https";
import { resolve } from "node:path";

import { parseOsvCommitResponse } from "./native-sca-policy.mjs";

const packageRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(packageRoot, "native/vendor-manifest.json");
const maximumResponseBytes = 8 * 1024 * 1024;
const argumentsList = process.argv.slice(2).filter((value) => value !== "--");
const allowedOptions = new Set(["--allow-network", "--response-file"]);

for (const argument of argumentsList) {
  if (argument.startsWith("--") && !allowedOptions.has(argument)) {
    throw new Error("Native SCA option is invalid.");
  }
}

const valueAfter = (name) => {
  const index = argumentsList.indexOf(name);
  return index === -1 ? null : (argumentsList[index + 1] ?? null);
};
const responseFileValue = valueAfter("--response-file");
if (argumentsList.includes("--response-file") && responseFileValue === null) {
  throw new Error("Native SCA response file is missing.");
}
const allowNetwork = argumentsList.includes("--allow-network");
if (allowNetwork === (responseFileValue !== null)) {
  throw new Error("Native SCA requires exactly one explicit data source.");
}

const regularJson = async (path, maximumBytes) => {
  const status = await lstat(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.size === 0 ||
    status.size > maximumBytes
  ) {
    throw new Error("Native SCA input is invalid.");
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error("Native SCA input is invalid.");
  }
};

const queryOnce = (commit) =>
  new Promise((resolvePromise, rejectPromise) => {
    const body = Buffer.from(JSON.stringify({ commit }), "utf8");
    const request = https.request(
      {
        headers: {
          accept: "application/json",
          "content-length": String(body.byteLength),
          "content-type": "application/json",
          "user-agent": "rituvia-native-sca/1.0",
        },
        hostname: "api.osv.dev",
        method: "POST",
        path: "/v1/query",
        port: 443,
        protocol: "https:",
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          rejectPromise(new Error("Native SCA service returned an unexpected status."));
          return;
        }
        const contentType = response.headers["content-type"];
        if (typeof contentType !== "string" || !contentType.startsWith("application/json")) {
          response.resume();
          rejectPromise(new Error("Native SCA service returned an unexpected content type."));
          return;
        }
        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.byteLength;
          if (size > maximumResponseBytes) {
            request.destroy(new Error("Native SCA response exceeded its size limit."));
            return;
          }
          chunks.push(chunk);
        });
        response.once("error", rejectPromise);
        response.once("end", () => {
          try {
            resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            rejectPromise(new Error("Native SCA service returned invalid JSON."));
          }
        });
      },
    );
    request.setTimeout(20_000, () => request.destroy(new Error("Native SCA service timed out.")));
    request.once("error", rejectPromise);
    request.end(body);
  });

const queryWithRetry = async (commit) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await queryOnce(commit);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000 * 2 ** attempt));
      }
    }
  }
  throw new Error("Native SCA service failed after bounded retries.", { cause: lastError });
};

const manifest = await regularJson(manifestPath, 128 * 1024);
const commit = manifest.source?.commit;
if (typeof commit !== "string" || !/^[0-9a-f]{40}$/u.test(commit)) {
  throw new Error("Native SCA manifest commit is invalid.");
}
const response =
  responseFileValue === null
    ? await queryWithRetry(commit)
    : await regularJson(resolve(responseFileValue), maximumResponseBytes);
const result = parseOsvCommitResponse(response, commit);
if (result.vulnerabilityIds.length > 0) {
  throw new Error(`Native SCA found known vulnerabilities: ${result.vulnerabilityIds.join(", ")}.`);
}

process.stdout.write(
  `${JSON.stringify({
    commit: result.commit,
    dataSource: "OSV.dev commit query",
    mode: responseFileValue === null ? "live" : "fixture",
    vulnerabilityCount: result.vulnerabilityIds.length,
  })}\n`,
);
