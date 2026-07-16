import "server-only";

import {
  createFeatureFlagEvaluator,
  featureFlagRegistryVersion,
  type FeatureFlagEvaluator,
} from "@rituvia/config/feature-flags";
import {
  assertFeatureFlagRuntimeDatabasePrivileges,
  createDatabaseClient,
  readFeatureFlagVersions,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";

export const loadWebFeatureFlagEvaluator = async (): Promise<FeatureFlagEvaluator> => {
  const databaseUrl = getWebRuntimeConfiguration().databaseUrl;
  if (databaseUrl === undefined) {
    throw new TypeError("Web database configuration is unavailable.");
  }
  const database = createDatabaseClient(databaseUrl);
  try {
    await assertFeatureFlagRuntimeDatabasePrivileges(database);
    const records = await readFeatureFlagVersions(database, featureFlagRegistryVersion);

    return createFeatureFlagEvaluator({
      records,
      registryVersion: featureFlagRegistryVersion,
    });
  } finally {
    await database.$disconnect();
  }
};
