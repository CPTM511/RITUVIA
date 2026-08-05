import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  deploymentEnvironment: "staging" as "local" | "preview" | "production" | "staging",
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    deploymentEnvironment: harness.deploymentEnvironment,
  }),
}));

import { inspectRecoveryStagingRuntime } from "../server/recovery-staging";

const sourceSha = "1111111111111111111111111111111111111111";

describe("Recovery Item 4 runtime identity", () => {
  beforeEach(() => {
    harness.deploymentEnvironment = "staging";
  });

  it("reports ready only for staging with an exact source SHA and no service authority", () => {
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha })).toMatchObject({
      database: "not-connected",
      environment: "staging",
      indexing: "disabled",
      objectStorage: "not-connected",
      productionProviders: "disabled",
      ready: true,
      recoveryItem: 4,
      sourceSha,
    });
  });

  it("fails closed for a missing source identity or configured service authority", () => {
    expect(inspectRecoveryStagingRuntime({}).ready).toBe(false);
    expect(
      inspectRecoveryStagingRuntime({
        RITUVIA_BUILD_SOURCE_SHA: sourceSha,
        STRIPE_SECRET_KEY: "sk_live_private-canary",
      }).ready,
    ).toBe(false);
    expect(
      inspectRecoveryStagingRuntime({
        DATABASE_URL: "postgresql://production.invalid/private",
        RITUVIA_BUILD_SOURCE_SHA: sourceSha,
      }).ready,
    ).toBe(false);
  });

  it("fails closed outside the protected staging classification", () => {
    harness.deploymentEnvironment = "preview";
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha }).ready).toBe(
      false,
    );
  });
});
