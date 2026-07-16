import nextEnvironment from "@next/env";
import { parseServerConfiguration } from "@rituvia/config/server";
import { fileURLToPath } from "node:url";

import { createWorkerRuntime } from "./runtime.js";

const { loadEnvConfig } = nextEnvironment;
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const isDevelopment =
  process.env.NODE_ENV === "development" || process.argv.includes("--development");
loadEnvConfig(repositoryRoot, isDevelopment);
parseServerConfiguration(process.env);

const controller = new AbortController();
const runtime = createWorkerRuntime();

const requestShutdown = () => {
  controller.abort();
};

process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);

try {
  await runtime.start(controller.signal);
} finally {
  process.off("SIGINT", requestShutdown);
  process.off("SIGTERM", requestShutdown);
}
