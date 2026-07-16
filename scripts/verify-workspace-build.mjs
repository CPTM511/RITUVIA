import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const requiredArtifacts = [
  "apps/web/.next/BUILD_ID",
  "apps/worker/dist/main.js",
  "apps/worker/dist/runtime.d.ts",
  "apps/worker/dist/runtime.js",
  "packages/config/dist/brand.d.ts",
  "packages/config/dist/brand.js",
  "packages/config/dist/client.js",
  "packages/config/dist/server.js",
  "packages/db/dist/client.d.ts",
  "packages/db/dist/client.js",
  "packages/db/dist/index.d.ts",
  "packages/db/dist/index.js",
  "packages/domain/dist/index.d.ts",
  "packages/domain/dist/index.js",
];

await Promise.all(requiredArtifacts.map((artifact) => access(artifact)));

const domainModule = await import(pathToFileURL(`${process.cwd()}/packages/domain/dist/index.js`));
const databaseModule = await import(pathToFileURL(`${process.cwd()}/packages/db/dist/index.js`));
const configBrandModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/brand.js`)
);
const configClientModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/client.js`)
);
const configServerModule = await import(
  pathToFileURL(`${process.cwd()}/packages/config/dist/server.js`)
);
const workerModule = await import(pathToFileURL(`${process.cwd()}/apps/worker/dist/runtime.js`));

if (Object.keys(domainModule).length !== 0) {
  throw new Error("The empty domain boundary emitted unexpected runtime exports.");
}

if (
  typeof databaseModule.assertDatabaseUrl !== "function" ||
  typeof databaseModule.createDatabaseClient !== "function"
) {
  throw new TypeError(
    "The database build does not expose its injected, connection-free adapter boundary.",
  );
}

if (typeof workerModule.createWorkerRuntime !== "function") {
  throw new TypeError("The worker build does not export createWorkerRuntime.");
}

if (
  typeof configBrandModule.createBrandConfiguration !== "function" ||
  typeof configClientModule.parseClientConfiguration !== "function" ||
  typeof configServerModule.parseServerConfiguration !== "function"
) {
  throw new TypeError("The config build does not expose its typed runtime boundaries.");
}

console.log(`Verified ${requiredArtifacts.length} workspace build artifacts and runtime exports.`);
