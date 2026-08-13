import "server-only";

import {
  createFeatureFlagEvaluator,
  featureFlagRegistryVersion,
  type FeatureFlagEvaluator,
} from "@rituvia/config/feature-flags";
import { assertFeatureFlagRuntimeDatabasePrivileges, readFeatureFlagVersions } from "@rituvia/db";

import { loadWebDatabase } from "./database";

export const loadWebFeatureFlagEvaluator = async (): Promise<FeatureFlagEvaluator> => {
  const database = loadWebDatabase();
  await assertFeatureFlagRuntimeDatabasePrivileges(database);
  const records = await readFeatureFlagVersions(database, featureFlagRegistryVersion);
  const evaluatedAt = new Date().toISOString();

  return createFeatureFlagEvaluator(
    {
      records,
      registryVersion: featureFlagRegistryVersion,
    },
    () => evaluatedAt,
  );
};
