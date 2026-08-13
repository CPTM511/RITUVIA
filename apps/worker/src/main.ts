import nextEnvironment from "@next/env";
import { parseWorkerConfiguration } from "@rituvia/config/server";
import {
  createCommercialDisputeSupportPersistence,
  createCommercialFulfillmentPersistence,
  createCommercialPaymentEventPersistence,
  createCommercialReconciliationPersistence,
  createCommercialSubscriptionPersistence,
  createDatabaseClient,
} from "@rituvia/db";
import { planCommercialCreditPackFulfillment } from "@rituvia/payments";
import { fileURLToPath } from "node:url";

import { createWorkerRuntime } from "./runtime.js";
import { createWorkerObservability } from "./observability.js";
import { runCommercialPaymentFulfillmentLoop } from "./payment-fulfillment.js";
import { runCommercialDisputeSupportProjectionLoop } from "./payment-dispute-support.js";
import { runSubscriptionFulfillmentLoop } from "./subscription-fulfillment.js";
import { runCommercialPaymentReconciliationLoop } from "./payment-reconciliation.js";
import { createStripeReconciliationReader } from "./stripe-reconciliation.js";

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
const reconciliationDatabase =
  configuration.paymentReconciliationDatabaseUrl === undefined
    ? undefined
    : createDatabaseClient(configuration.paymentReconciliationDatabaseUrl);
const paymentEventDatabase =
  configuration.paymentWebhookDatabaseUrl === undefined
    ? undefined
    : createDatabaseClient(configuration.paymentWebhookDatabaseUrl);
const stripePaymentConfiguration =
  configuration.payment?.provider === "stripe" ? configuration.payment : undefined;
const stripeReconciliation =
  stripePaymentConfiguration === undefined
    ? undefined
    : createStripeReconciliationReader(stripePaymentConfiguration);
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
              } else if (
                disposition === "dead_lettered" ||
                disposition === "persistence_unavailable" ||
                disposition === "retried"
              ) {
                operation.end({
                  category: "dependency",
                  errorCode: "dependency_error",
                  outcome: "failure",
                  retryable: disposition === "persistence_unavailable" || disposition === "retried",
                });
              } else {
                operation.end({ outcome: "success" });
              }
            },
            plan: planCommercialCreditPackFulfillment,
            signal: controller.signal,
            store: createCommercialFulfillmentPersistence(database),
          }),
          runCommercialDisputeSupportProjectionLoop({
            observe: ({ disposition }) => {
              if (disposition === "idle") return;
              const operation = lifecycle.child({
                dependency: "payment",
                kind: "dependency",
                operation: "dependency.request",
              });
              if (disposition === "cancelled") {
                operation.end({ outcome: "cancelled" });
              } else if (disposition === "persistence_unavailable") {
                operation.end({
                  category: "dependency",
                  errorCode: "dependency_error",
                  outcome: "failure",
                  retryable: true,
                });
              } else {
                operation.end({ outcome: "success" });
              }
            },
            signal: controller.signal,
            store: createCommercialDisputeSupportPersistence(database),
          }),
          runSubscriptionFulfillmentLoop({
            observe: ({ disposition }) => {
              if (disposition === "idle") return;
              const operation = lifecycle.child({
                dependency: "payment",
                kind: "dependency",
                operation: "dependency.request",
              });
              if (disposition === "cancelled") {
                operation.end({ outcome: "cancelled" });
              } else if (
                disposition === "dead_lettered" ||
                disposition === "persistence_unavailable" ||
                disposition === "retried"
              ) {
                operation.end({
                  category: "dependency",
                  errorCode: "dependency_error",
                  outcome: "failure",
                  retryable: disposition === "persistence_unavailable" || disposition === "retried",
                });
              } else {
                operation.end({ outcome: "success" });
              }
            },
            signal: controller.signal,
            store: createCommercialSubscriptionPersistence(database),
          }),
          ...(stripeReconciliation === undefined ||
          stripePaymentConfiguration === undefined ||
          reconciliationDatabase === undefined ||
          paymentEventDatabase === undefined
            ? []
            : [
                runCommercialPaymentReconciliationLoop({
                  observe: ({ disposition }) => {
                    if (disposition === "duplicate") return;
                    const operation = lifecycle.child({
                      dependency: "payment",
                      kind: "dependency",
                      operation: "dependency.request",
                    });
                    if (disposition === "clean") {
                      operation.end({ outcome: "success" });
                    } else {
                      operation.end({
                        category: "dependency",
                        errorCode: "dependency_error",
                        outcome: "failure",
                        retryable: disposition === "unavailable",
                      });
                    }
                  },
                  paymentEvents: createCommercialPaymentEventPersistence(paymentEventDatabase),
                  providerAccountFingerprint: stripePaymentConfiguration.accountId,
                  reader: stripeReconciliation,
                  signal: controller.signal,
                  store: createCommercialReconciliationPersistence(reconciliationDatabase),
                }),
              ]),
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
  await reconciliationDatabase?.$disconnect();
  await paymentEventDatabase?.$disconnect();
  await observability.flush();
}
