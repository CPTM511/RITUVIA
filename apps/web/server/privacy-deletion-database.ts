import "server-only";

import { createDatabaseClient } from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";

let privacyDeletionDatabase: ReturnType<typeof createDatabaseClient> | undefined;

export const loadPrivacyDeletionDatabase = (): ReturnType<typeof createDatabaseClient> => {
  if (privacyDeletionDatabase !== undefined) return privacyDeletionDatabase;

  const databaseUrl = getWebRuntimeConfiguration().privacyDeletionDatabaseUrl;
  if (databaseUrl === undefined) {
    throw new TypeError("Privacy deletion database configuration is unavailable.");
  }

  privacyDeletionDatabase = createDatabaseClient(databaseUrl);
  return privacyDeletionDatabase;
};
