import nextEnvironment from "@next/env";
import { parseServerConfiguration } from "@rituvia/config/server";
import { fileURLToPath } from "node:url";

import { createWorkerRuntime } from "./runtime.js";
import { createWorkerObservability } from "./observability.js";

const { loadEnvConfig } = nextEnvironment;
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const isDevelopment =
  process.env.NODE_ENV === "development" || process.argv.includes("--development");
loadEnvConfig(repositoryRoot, isDevelopment);
const configuration = parseServerConfiguration(process.env);

const controller = new AbortController();
const runtime = createWorkerRuntime();
const observability = createWorkerObservability(configuration.deploymentEnvironment);
const lifecycle = observability.start({ kind: "service", operation: "service.lifecycle" });
let shutdownSignal: "SIGINT" | "SIGTERM" | undefined;

const requestShutdown = (signal: "SIGINT" | "SIGTERM") => {
  shutdownSignal = signal;
  lifecycle.event({ name: "service.shutdown_requested", signal });
  controller.abort();
};

const requestInterrupt = () => requestShutdown("SIGINT");
const requestTermination = () => requestShutdown("SIGTERM");

process.once("SIGINT", requestInterrupt);
process.once("SIGTERM", requestTermination);
lifecycle.event({ name: "service.ready" });

try {
  await runtime.start(controller.signal);
  lifecycle.end({ outcome: shutdownSignal === undefined ? "success" : "cancelled" });
} catch {
  lifecycle.end({
    category: "internal",
    errorCode: "internal_error",
    outcome: "failure",
    retryable: false,
  });
  throw new Error("Worker runtime failed.");
} finally {
  process.off("SIGINT", requestInterrupt);
  process.off("SIGTERM", requestTermination);
  await observability.flush();
}
