import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const requiredArtifacts = [
  "apps/web/.next/BUILD_ID",
  "apps/worker/dist/main.js",
  "apps/worker/dist/runtime.d.ts",
  "apps/worker/dist/runtime.js",
  "packages/domain/dist/index.d.ts",
  "packages/domain/dist/index.js",
];

await Promise.all(requiredArtifacts.map((artifact) => access(artifact)));

const domainModule = await import(pathToFileURL(`${process.cwd()}/packages/domain/dist/index.js`));
const workerModule = await import(pathToFileURL(`${process.cwd()}/apps/worker/dist/runtime.js`));

if (Object.keys(domainModule).length !== 0) {
  throw new Error("The empty domain boundary emitted unexpected runtime exports.");
}

if (typeof workerModule.createWorkerRuntime !== "function") {
  throw new TypeError("The worker build does not export createWorkerRuntime.");
}

console.log(`Verified ${requiredArtifacts.length} workspace build artifacts and runtime exports.`);
