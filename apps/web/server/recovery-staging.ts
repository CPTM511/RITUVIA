import "server-only";

import type { RawEnvironment } from "@rituvia/config/server";

import { getWebRuntimeConfiguration } from "../config/server";
import { resolveRecoverySourceRevision } from "../config/recovery-environment";
import { resolveWebAstrologyNativeBuildMetadataPath } from "./astrology-runtime";
import { webAstrologyTimeZoneRuntimePin } from "./astrology-location-time-zone";
import { loadTarotReadingAvailability } from "./tarot-reading-state";

export const recoveryStagingPathname = "/recovery" as const;
export const recoveryHealthPathname = "/api/recovery/health" as const;
export const recoveryReadinessPathname = "/api/recovery/readiness" as const;
export const approvedRecoveryBaselineSha = "f79fee6713670fdc12b33dd3182569a942782636" as const;

const embeddedBuildSourceSha = resolveRecoverySourceRevision(process.env);
const forbiddenServiceEnvironmentPattern =
  /^(?:AI_|ANTHROPIC_|AWS_|BLOB_|COINBASE_|EMAIL_|GOOGLE_|KMS_|KV_|OPENAI_|PAYMENT_WEBHOOK_DATABASE_URL$|POSTGRES_|PRIVACY_DELETION_DATABASE_URL$|REDIS_|RESEND_|RITUVIA_(?:ACCOUNT|ASTROLOGY|AUTH|LOCAL_CHECKOUT|PAYMENT|PRIVACY|STRIPE)|S3_|SMTP_|STRIPE_)/u;
const allowedRecoveryAstrologyEnvironment = "RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH";

export type RecoveryStagingRuntimeStatus = Readonly<{
  baselineSha: typeof approvedRecoveryBaselineSha;
  database: "connected" | "not-connected";
  environment: "staging";
  indexing: "disabled";
  nativeAstrology: "disabled" | "enabled";
  numerologyEngine: "enabled";
  objectStorage: "not-connected";
  productionProviders: "disabled";
  ready: boolean;
  recoveryItem: 8;
  sourceSha: string;
  tarotCatalog: "disabled" | "enabled";
  timeZoneRuntime: "invalid" | "pinned";
}>;

const hasForbiddenServiceEnvironment = (environment: RawEnvironment): boolean =>
  Object.entries(environment).some(
    ([key, value]) =>
      value !== undefined &&
      value.trim() !== "" &&
      key !== allowedRecoveryAstrologyEnvironment &&
      forbiddenServiceEnvironmentPattern.test(key),
  );

export const inspectRecoveryStagingRuntime = (
  environment: RawEnvironment = process.env,
): RecoveryStagingRuntimeStatus => {
  const configuration = getWebRuntimeConfiguration();
  const { deploymentEnvironment } = configuration;
  const sourceSha = resolveRecoverySourceRevision(environment) || embeddedBuildSourceSha;
  const sourceIdentityValid = sourceSha !== "";
  const safeOff = !hasForbiddenServiceEnvironment(environment);
  const tarotCatalog = loadTarotReadingAvailability();
  const nativeAstrology =
    resolveWebAstrologyNativeBuildMetadataPath() === undefined ? "disabled" : "enabled";
  const timeZoneRuntime =
    process.versions.node === webAstrologyTimeZoneRuntimePin.runtimeVersion &&
    process.versions.icu === webAstrologyTimeZoneRuntimePin.icuVersion &&
    process.versions.tz === webAstrologyTimeZoneRuntimePin.timeZoneDataVersion
      ? "pinned"
      : "invalid";
  const databaseConnected = configuration.databaseUrl !== undefined;
  const coreLoopConfigured =
    databaseConnected &&
    configuration.anonymousSessionPolicy !== undefined &&
    configuration.privateContentKeyring !== undefined &&
    configuration.questionIntakeActivationReference !== undefined &&
    configuration.reflectionPolicy !== undefined &&
    configuration.tarotReadingIntegrityKeyring !== undefined;

  return Object.freeze({
    baselineSha: approvedRecoveryBaselineSha,
    database: databaseConnected ? "connected" : "not-connected",
    environment: "staging",
    indexing: "disabled",
    nativeAstrology,
    numerologyEngine: "enabled",
    objectStorage: "not-connected",
    productionProviders: "disabled",
    ready:
      deploymentEnvironment === "staging" &&
      sourceIdentityValid &&
      safeOff &&
      coreLoopConfigured &&
      tarotCatalog === "enabled" &&
      nativeAstrology === "enabled" &&
      timeZoneRuntime === "pinned",
    recoveryItem: 8,
    sourceSha: sourceIdentityValid ? sourceSha : "unavailable",
    tarotCatalog,
    timeZoneRuntime,
  });
};
