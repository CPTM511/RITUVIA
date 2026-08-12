import type { RawEnvironment } from "@rituvia/config/server";

export const recoveryStagingBranch = "codex/founder-acceptance-recovery" as const;

const sourceRevisionPattern = /^[0-9a-f]{40}$/u;

export const resolveRecoveryDeploymentEnvironment = (
  environment: RawEnvironment,
): string | undefined => {
  const explicitEnvironment = environment.APP_ENV?.trim();
  if (explicitEnvironment !== undefined && explicitEnvironment !== "") {
    return explicitEnvironment;
  }
  return environment.VERCEL === "1" &&
    environment.VERCEL_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === recoveryStagingBranch
    ? "staging"
    : explicitEnvironment;
};

export const resolveRecoverySourceRevision = (environment: RawEnvironment): string => {
  const configuredRevision =
    environment.RITUVIA_BUILD_SOURCE_SHA?.trim().toLowerCase() ??
    environment.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase() ??
    "";
  return sourceRevisionPattern.test(configuredRevision) ? configuredRevision : "";
};
