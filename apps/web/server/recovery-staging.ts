import "server-only";

import type { RawEnvironment } from "@rituvia/config/server";

import { getWebRuntimeConfiguration } from "../config/server";
import { resolveRecoverySourceRevision } from "../config/recovery-environment";
import { resolveWebAstrologyNativeBuildMetadataPath } from "./astrology-runtime";
import {
  recoveryItem12AcceptanceManifest,
  recoveryItem12AcceptanceManifestSha256,
} from "./recovery-item-12-manifest";
import { webAstrologyTimeZoneRuntimePin } from "./astrology-location-time-zone";
import { loadTarotReadingAvailability } from "./tarot-reading-state";

export const recoveryStagingPathname = "/recovery" as const;
export const recoveryHealthPathname = "/api/recovery/health" as const;
export const recoveryReadinessPathname = "/api/recovery/readiness" as const;
export const approvedRecoveryBaselineSha = "f79fee6713670fdc12b33dd3182569a942782636" as const;

const embeddedBuildSourceSha = resolveRecoverySourceRevision(process.env);
const forbiddenServiceEnvironmentPattern =
  /^(?:AI_|ANTHROPIC_|AWS_|BLOB_|COINBASE_|EMAIL_|GOOGLE_|KMS_|KV_|OPENAI_|PAYMENT_WEBHOOK_DATABASE_URL$|POSTGRES_|PRIVACY_DELETION_DATABASE_URL$|REDIS_|RESEND_|RITUVIA_(?:ACCOUNT|AI|ASTROLOGY|AUTH|COINBASE|LOCAL_CHECKOUT|PAYMENT|PRIVACY|RECOVERY_ITEM_11|STRIPE)|S3_|SMTP_|STRIPE_)/u;
const allowedRecoveryAstrologyEnvironment = "RITUVIA_ASTROLOGY_NATIVE_BUILD_METADATA_PATH";
const allowedRecoveryIdentityEnvironment = new Set([
  "PRIVACY_DELETION_DATABASE_URL",
  "RITUVIA_ACCOUNT_SESSION_TTL_SECONDS",
  "RITUVIA_AUTH_CHALLENGE_TTL_SECONDS",
  "RITUVIA_AUTH_DATA_KEY_V1",
  "RITUVIA_AUTH_START_GLOBAL_LIMIT",
  "RITUVIA_AUTH_START_IDENTIFIER_LIMIT",
  "RITUVIA_AUTH_START_WINDOW_SECONDS",
  "RITUVIA_AUTH_SUBJECT_HMAC_KEY_V1",
  "RITUVIA_PRIVACY_DELETION_RECENT_AUTH_SECONDS",
  "RITUVIA_PRIVACY_DELETION_REQUEST_WINDOW_SECONDS",
  "RITUVIA_PRIVACY_DELETION_ROLE_PASSWORD",
  "RITUVIA_PRIVACY_EXPORT_KEY_V1",
  "RITUVIA_PRIVACY_EXPORT_RECENT_AUTH_SECONDS",
  "RITUVIA_PRIVACY_EXPORT_REQUEST_WINDOW_SECONDS",
  "RITUVIA_PRIVACY_EXPORT_TTL_SECONDS",
]);
const allowedRecoveryCommerceEnvironment = new Set([
  "PAYMENT_WEBHOOK_DATABASE_URL",
  "RITUVIA_PAYMENT_PROVIDER",
  "RITUVIA_PAYMENT_WEBHOOK_ROLE_PASSWORD",
  "RITUVIA_RECOVERY_COMMERCE_SANDBOX",
  "RITUVIA_STRIPE_ACCOUNT_ID",
  "RITUVIA_STRIPE_PRICE_IDS",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]);
const allowedRecoveryItem11Environment = new Set([
  "AI_GENERATION_DATABASE_URL",
  "RITUVIA_AI_DAILY_USER_LIMIT",
  "RITUVIA_AI_GATEWAY_MODEL",
  "RITUVIA_AI_GENERATION_ROLE_PASSWORD",
  "RITUVIA_AI_MAX_COST_MICROS",
  "RITUVIA_AI_MAX_OUTPUT_TOKENS",
  "RITUVIA_AI_TIMEOUT_MS",
  "RITUVIA_COINBASE_API_KEY_ID",
  "RITUVIA_COINBASE_API_KEY_SECRET",
  "RITUVIA_COINBASE_WEBHOOK_SECRET",
  "RITUVIA_RECOVERY_ITEM_11_SANDBOX",
]);

export type RecoveryStagingRuntimeStatus = Readonly<{
  baselineSha: typeof approvedRecoveryBaselineSha;
  coinbaseSandbox: "disabled" | "enabled";
  database: "connected" | "not-connected";
  commerceSandbox: "disabled" | "enabled";
  environment: "staging";
  indexing: "disabled";
  identitySandbox: "disabled" | "enabled";
  nativeAstrology: "disabled" | "enabled";
  numerologyEngine: "enabled";
  objectStorage: "not-connected";
  providerAi: "disabled" | "enabled";
  productionProviders: "disabled";
  privacyControls: "disabled" | "enabled";
  ready: boolean;
  recoveryItem: 12;
  recoveryManifest: typeof recoveryItem12AcceptanceManifest;
  recoveryManifestSha256: string;
  sourceSha: string;
  tarotCatalog: "disabled" | "enabled";
  timeZoneRuntime: "invalid" | "pinned";
}>;

const hasForbiddenServiceEnvironment = (environment: RawEnvironment): boolean =>
  environment.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true ||
  Object.entries(environment).some(
    ([key, value]) =>
      value !== undefined &&
      value.trim() !== "" &&
      key !== allowedRecoveryAstrologyEnvironment &&
      !allowedRecoveryIdentityEnvironment.has(key) &&
      !allowedRecoveryCommerceEnvironment.has(key) &&
      !allowedRecoveryItem11Environment.has(key) &&
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
  const identitySandbox = configuration.recoveryIdentitySandbox !== undefined;
  const privacyControls =
    configuration.privacyExport !== undefined &&
    configuration.privacyDeletionPolicy !== undefined &&
    configuration.privacyDeletionDatabaseUrl !== undefined;
  const commerceSandbox =
    configuration.recoveryCommerceSandbox !== undefined &&
    configuration.payment?.provider === "stripe" &&
    configuration.paymentWebhookDatabaseUrl !== undefined;
  const item11Sandbox =
    configuration.recoveryItem11Sandbox !== undefined &&
    configuration.aiGenerationDatabaseUrl !== undefined;
  const coreLoopConfigured =
    databaseConnected &&
    configuration.anonymousSessionPolicy !== undefined &&
    configuration.privateContentKeyring !== undefined &&
    configuration.questionIntakeActivationReference !== undefined &&
    configuration.reflectionPolicy !== undefined &&
    configuration.tarotReadingIntegrityKeyring !== undefined;

  return Object.freeze({
    baselineSha: approvedRecoveryBaselineSha,
    coinbaseSandbox: item11Sandbox ? "enabled" : "disabled",
    database: databaseConnected ? "connected" : "not-connected",
    commerceSandbox: commerceSandbox ? "enabled" : "disabled",
    environment: "staging",
    indexing: "disabled",
    identitySandbox: identitySandbox ? "enabled" : "disabled",
    nativeAstrology,
    numerologyEngine: "enabled",
    objectStorage: "not-connected",
    providerAi: item11Sandbox ? "enabled" : "disabled",
    productionProviders: "disabled",
    privacyControls: privacyControls ? "enabled" : "disabled",
    ready:
      deploymentEnvironment === "staging" &&
      sourceIdentityValid &&
      safeOff &&
      coreLoopConfigured &&
      tarotCatalog === "enabled" &&
      nativeAstrology === "enabled" &&
      timeZoneRuntime === "pinned" &&
      identitySandbox &&
      privacyControls &&
      commerceSandbox &&
      item11Sandbox,
    recoveryItem: 12,
    recoveryManifest: recoveryItem12AcceptanceManifest,
    recoveryManifestSha256: recoveryItem12AcceptanceManifestSha256,
    sourceSha: sourceIdentityValid ? sourceSha : "unavailable",
    tarotCatalog,
    timeZoneRuntime,
  });
};
