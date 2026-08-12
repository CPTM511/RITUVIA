import "server-only";

import { createDatabaseClient } from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";

let webPaymentWebhookDatabase: ReturnType<typeof createDatabaseClient> | undefined;

export const loadWebPaymentWebhookDatabase = (): ReturnType<typeof createDatabaseClient> => {
  if (webPaymentWebhookDatabase !== undefined) return webPaymentWebhookDatabase;

  const databaseUrl = getWebRuntimeConfiguration().paymentWebhookDatabaseUrl;
  if (databaseUrl === undefined) {
    throw new TypeError("Web payment webhook database configuration is unavailable.");
  }

  webPaymentWebhookDatabase = createDatabaseClient(databaseUrl);
  return webPaymentWebhookDatabase;
};
