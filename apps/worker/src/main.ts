import nextEnvironment from "@next/env";
import { parseWorkerConfiguration } from "@rituvia/config/server";
import { createCommercialFulfillmentPersistence, createDatabaseClient } from "@rituvia/db";
import { planCommercialCreditPackFulfillment } from "@rituvia/payments";
import { fileURLToPath } from "node:url";

import { createWorkerRuntime } from "./runtime.js";
import { createWorkerObservability } from "./observability.js";
import { runCommercialPaymentFulfillmentLoop } from "./payment-fulfillment.js";

const { loadEnvConfig } = nextEnvironment;
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const isDevelopment =
  process.env.NODE_ENV === "development" || process.argv.includes("--development");
loadEnvConfig(repositoryRoot, isDevelopment);
const configuration = parseWorkerConfiguration(process.env);

const controller = new AbortController();
const runtime = createWorkerRuntime();
const observability = createWorkerObservability(configuration.deploymentEnvironment);
const database =
  configuration.paymentFulfillmentDatabaseUrl === undefined
    ? undefined
    : createDatabaseClient(configuration.paymentFulfillmentDatabaseUrl);
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
  await Promise.all([
    runtime.start(controller.signal),
    ...(database === undefined
      ? []
      : [
          runCommercialPaymentFulfillmentLoop({
            observe: ({ disposition }) => {
              if (disposition === "idle") return;
              const operation = lifecycle.child({
                dependency: "payment",
                kind: "dependency",
                operation: "dependency.request",
              });
              if (disposition === "cancelled") {
                operation.end({ outcome: "cancelled" });
              } else if (disposition === "dead_lettered" || disposition === "retried") {
                operation.end({
                  category: "dependency",
                  errorCode: "dependency_error",
                  outcome: "failure",
                  retryable: disposition === "retried",
                });
              } else {
                operation.end({ outcome: "success" });
              }
            },
            plan: planCommercialCreditPackFulfillment,
            signal: controller.signal,
            store: createCommercialFulfillmentPersistence(database),
          }),
        ]),
  ]);
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
  await database?.$disconnect();
  await observability.flush();
}
