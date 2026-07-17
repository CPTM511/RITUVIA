import "server-only";

import { createDatabaseClient } from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";

let webDatabase: ReturnType<typeof createDatabaseClient> | undefined;

export const loadWebDatabase = (): ReturnType<typeof createDatabaseClient> => {
  if (webDatabase !== undefined) return webDatabase;

  const databaseUrl = getWebRuntimeConfiguration().databaseUrl;
  if (databaseUrl === undefined) {
    throw new TypeError("Web database configuration is unavailable.");
  }

  webDatabase = createDatabaseClient(databaseUrl);
  return webDatabase;
};
