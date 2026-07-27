import "server-only";

import {
  createAstrologyCalculationPersistence,
  createBirthProfilePersistence,
  type AstrologyCalculationPersistence,
  type BirthProfilePersistence,
} from "@rituvia/db";
import type { AstrologyEphemerisAdapterV1 } from "@rituvia/divination";
import { loadSwissEphemerisAdapterV1FromBuildMetadata } from "@rituvia/astrology-engine-native";

import { getWebRuntimeConfiguration } from "../config/server";
import {
  createAstrologyCalculationService,
  type AstrologyCalculationService,
} from "./astrology-calculation";
import { loadWebDatabase } from "./database";
import { loadWebFeatureFlagEvaluator } from "./feature-flags";
import {
  createPrivateContentCryptography,
  type PrivateContentCryptography,
} from "./private-content-crypto";

type WebAstrologyRuntimeDependencies = Readonly<{
  birthProfiles: BirthProfilePersistence;
  calculations: AstrologyCalculationPersistence;
  cryptography: PrivateContentCryptography;
  loadEphemeris(): Promise<AstrologyEphemerisAdapterV1>;
  loadFeatureFlagEvaluator(): Promise<
    Readonly<{
      evaluate(
        flagKey: "experience.astrology",
        context: Readonly<Record<string, never>>,
      ): Readonly<{ enabled: boolean }>;
    }>
  >;
}>;

export const createWebAstrologyCalculationRuntime = (
  dependencies: WebAstrologyRuntimeDependencies,
): AstrologyCalculationService =>
  createAstrologyCalculationService({
    birthProfiles: dependencies.birthProfiles,
    calculations: dependencies.calculations,
    cryptography: dependencies.cryptography,
    isEnabled: async () =>
      (await dependencies.loadFeatureFlagEvaluator()).evaluate("experience.astrology", {}).enabled,
    loadEphemeris: dependencies.loadEphemeris,
  });

let runtimeService: AstrologyCalculationService | undefined;
let ephemerisPromise: Promise<AstrologyEphemerisAdapterV1> | undefined;

const loadRuntimeEphemeris = (): Promise<AstrologyEphemerisAdapterV1> => {
  if (ephemerisPromise !== undefined) return ephemerisPromise;
  const metadataPath = getWebRuntimeConfiguration().astrologyNativeBuildMetadataPath;
  if (metadataPath === undefined) {
    return Promise.reject(new TypeError("Native astrology configuration is unavailable."));
  }
  ephemerisPromise = loadSwissEphemerisAdapterV1FromBuildMetadata({
    buildMetadataPath: metadataPath,
    maximumOutputBytes: 65_536,
    timeoutMilliseconds: 3_000,
  }).catch((error: unknown) => {
    ephemerisPromise = undefined;
    throw error;
  });
  return ephemerisPromise;
};

export const loadWebAstrologyCalculationService = (): AstrologyCalculationService => {
  if (runtimeService !== undefined) return runtimeService;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.databaseUrl === undefined ||
    configuration.privateContentKeyring === undefined
  ) {
    throw new TypeError("Web astrology runtime configuration is unavailable.");
  }
  const database = loadWebDatabase();
  runtimeService = createWebAstrologyCalculationRuntime({
    birthProfiles: createBirthProfilePersistence(database),
    calculations: createAstrologyCalculationPersistence(database),
    cryptography: createPrivateContentCryptography(configuration.privateContentKeyring),
    loadEphemeris: loadRuntimeEphemeris,
    loadFeatureFlagEvaluator: loadWebFeatureFlagEvaluator,
  });
  return runtimeService;
};
