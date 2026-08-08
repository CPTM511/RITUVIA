import "server-only";

import { createDatabaseClient } from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";

let webAiGenerationDatabase: ReturnType<typeof createDatabaseClient> | undefined;

export const loadWebAiGenerationDatabase = (): ReturnType<typeof createDatabaseClient> => {
  if (webAiGenerationDatabase !== undefined) return webAiGenerationDatabase;
  const databaseUrl = getWebRuntimeConfiguration().aiGenerationDatabaseUrl;
  if (databaseUrl === undefined) {
    throw new TypeError("Web AI generation database configuration is unavailable.");
  }
  webAiGenerationDatabase = createDatabaseClient(databaseUrl);
  return webAiGenerationDatabase;
};
