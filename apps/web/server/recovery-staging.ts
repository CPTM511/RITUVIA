import "server-only";

import type { RawEnvironment } from "@rituvia/config/server";

import { getWebRuntimeConfiguration } from "../config/server";
import { resolveRecoverySourceRevision } from "../config/recovery-environment";

export const recoveryStagingPathname = "/recovery" as const;
export const recoveryHealthPathname = "/api/recovery/health" as const;
export const recoveryReadinessPathname = "/api/recovery/readiness" as const;
export const approvedRecoveryBaselineSha = "f79fee6713670fdc12b33dd3182569a942782636" as const;

const embeddedBuildSourceSha = resolveRecoverySourceRevision(process.env);
const forbiddenServiceEnvironmentPattern =
  /^(?:AI_|ANTHROPIC_|AWS_|BLOB_|COINBASE_|DATABASE_URL$|EMAIL_|GOOGLE_|KMS_|KV_|OPENAI_|PAYMENT_WEBHOOK_DATABASE_URL$|POSTGRES_|PRIVACY_DELETION_DATABASE_URL$|REDIS_|RESEND_|RITUVIA_(?:ACCOUNT|ANONYMOUS|ASTROLOGY|AUTH|LOCAL_CHECKOUT|PAYMENT|PRIVATE|PRIVACY|QUESTION|REFLECTION|STRIPE|TAROT)|S3_|SMTP_|STRIPE_)/u;

export type RecoveryStagingRuntimeStatus = Readonly<{
  baselineSha: typeof approvedRecoveryBaselineSha;
  database: "not-connected";
  environment: "staging";
  indexing: "disabled";
  objectStorage: "not-connected";
  productionProviders: "disabled";
  ready: boolean;
  recoveryItem: 3;
  sourceSha: string;
}>;

const hasForbiddenServiceEnvironment = (environment: RawEnvironment): boolean =>
  Object.entries(environment).some(
    ([key, value]) =>
      value !== undefined && value.trim() !== "" && forbiddenServiceEnvironmentPattern.test(key),
  );

export const inspectRecoveryStagingRuntime = (
  environment: RawEnvironment = process.env,
): RecoveryStagingRuntimeStatus => {
  const { deploymentEnvironment } = getWebRuntimeConfiguration();
  const sourceSha = resolveRecoverySourceRevision(environment) || embeddedBuildSourceSha;
  const sourceIdentityValid = sourceSha !== "";
  const safeOff = !hasForbiddenServiceEnvironment(environment);

  return Object.freeze({
    baselineSha: approvedRecoveryBaselineSha,
    database: "not-connected",
    environment: "staging",
    indexing: "disabled",
    objectStorage: "not-connected",
    productionProviders: "disabled",
    ready: deploymentEnvironment === "staging" && sourceIdentityValid && safeOff,
    recoveryItem: 3,
    sourceSha: sourceIdentityValid ? sourceSha : "unavailable",
  });
};
