import { describe, expect, it } from "vitest";

import {
  recoveryStagingBranch,
  resolveRecoveryDeploymentEnvironment,
  resolveRecoverySourceRevision,
} from "../config/recovery-environment";

describe("recovery deployment environment", () => {
  it("honors an explicit canonical environment", () => {
    expect(
      resolveRecoveryDeploymentEnvironment({
        APP_ENV: "preview",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: recoveryStagingBranch,
      }),
    ).toBe("preview");
  });

  it("classifies only the exact approved Vercel preview branch as staging", () => {
    expect(
      resolveRecoveryDeploymentEnvironment({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: recoveryStagingBranch,
      }),
    ).toBe("staging");
    expect(
      resolveRecoveryDeploymentEnvironment({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "main",
      }),
    ).toBeUndefined();
  });

  it("uses only an exact explicit or Vercel source revision", () => {
    const sourceSha = "1111111111111111111111111111111111111111";
    expect(resolveRecoverySourceRevision({ RITUVIA_BUILD_SOURCE_SHA: sourceSha })).toBe(sourceSha);
    expect(resolveRecoverySourceRevision({ VERCEL_GIT_COMMIT_SHA: sourceSha })).toBe(sourceSha);
    expect(resolveRecoverySourceRevision({ RITUVIA_BUILD_SOURCE_SHA: "short" })).toBe("");
  });
});
