import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  anonymousSessionPolicy: {} as object | undefined,
  databaseUrl: "postgresql://staging.example.invalid/rituvia" as string | undefined,
  deploymentEnvironment: "staging" as "local" | "preview" | "production" | "staging",
  privateContentKeyring: {} as object | undefined,
  questionIntakeActivationReference: "own-009.recovery-item-5" as string | undefined,
  reflectionPolicy: {} as object | undefined,
  tarotReadingIntegrityKeyring: {} as object | undefined,
  tarotReadingAvailability: "enabled" as "disabled" | "enabled",
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    anonymousSessionPolicy: harness.anonymousSessionPolicy,
    databaseUrl: harness.databaseUrl,
    deploymentEnvironment: harness.deploymentEnvironment,
    privateContentKeyring: harness.privateContentKeyring,
    questionIntakeActivationReference: harness.questionIntakeActivationReference,
    reflectionPolicy: harness.reflectionPolicy,
    tarotReadingIntegrityKeyring: harness.tarotReadingIntegrityKeyring,
  }),
}));

vi.mock("../server/tarot-reading-state", () => ({
  loadTarotReadingAvailability: () => harness.tarotReadingAvailability,
}));

import { inspectRecoveryStagingRuntime } from "../server/recovery-staging";

const sourceSha = "1111111111111111111111111111111111111111";

describe("Recovery Item 7 runtime identity", () => {
  beforeEach(() => {
    harness.anonymousSessionPolicy = {};
    harness.databaseUrl = "postgresql://staging.example.invalid/rituvia";
    harness.deploymentEnvironment = "staging";
    harness.privateContentKeyring = {};
    harness.questionIntakeActivationReference = "own-009.recovery-item-5";
    harness.reflectionPolicy = {};
    harness.tarotReadingIntegrityKeyring = {};
    harness.tarotReadingAvailability = "enabled";
  });

  it("reports ready only for staging with the complete bounded core-loop configuration", () => {
    expect(
      inspectRecoveryStagingRuntime({
        DATABASE_URL: "postgresql://staging.example.invalid/rituvia",
        RITUVIA_BUILD_SOURCE_SHA: sourceSha,
      }),
    ).toMatchObject({
      database: "connected",
      environment: "staging",
      indexing: "disabled",
      objectStorage: "not-connected",
      productionProviders: "disabled",
      ready: true,
      recoveryItem: 7,
      sourceSha,
      tarotCatalog: "enabled",
    });
  });

  it("fails closed for a missing source identity or configured production authority", () => {
    expect(inspectRecoveryStagingRuntime({}).ready).toBe(false);
    expect(
      inspectRecoveryStagingRuntime({
        RITUVIA_BUILD_SOURCE_SHA: sourceSha,
        STRIPE_SECRET_KEY: "sk_live_private-canary",
      }).ready,
    ).toBe(false);
  });

  it("fails closed when any required core-loop configuration is absent", () => {
    harness.privateContentKeyring = undefined;
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha }).ready).toBe(
      false,
    );
  });

  it("fails closed when the approved Tarot catalog is unavailable", () => {
    harness.tarotReadingAvailability = "disabled";
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha })).toMatchObject({
      ready: false,
      tarotCatalog: "disabled",
    });
  });

  it("fails closed outside the protected staging classification", () => {
    harness.deploymentEnvironment = "preview";
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha }).ready).toBe(
      false,
    );
  });
});
