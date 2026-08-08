import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  aiGenerationDatabaseUrl: "postgresql://ai.example.invalid/rituvia" as string | undefined,
  anonymousSessionPolicy: {} as object | undefined,
  databaseUrl: "postgresql://staging.example.invalid/rituvia" as string | undefined,
  deploymentEnvironment: "staging" as "local" | "preview" | "production" | "staging",
  nativeMetadataPath: "/private/recovery/build-metadata.json" as string | undefined,
  privateContentKeyring: {} as object | undefined,
  privacyDeletionDatabaseUrl: "postgresql://deletion.example.invalid/rituvia" as string | undefined,
  privacyDeletionPolicy: {} as object | undefined,
  privacyExport: {} as object | undefined,
  payment: { provider: "stripe" } as object | undefined,
  paymentWebhookDatabaseUrl: "postgresql://webhook.example.invalid/rituvia" as string | undefined,
  questionIntakeActivationReference: "own-009.recovery-item-5" as string | undefined,
  reflectionPolicy: {} as object | undefined,
  recoveryIdentitySandbox: {} as object | undefined,
  recoveryCommerceSandbox: {} as object | undefined,
  recoveryItem11Sandbox: {} as object | undefined,
  tarotReadingIntegrityKeyring: {} as object | undefined,
  tarotReadingAvailability: "enabled" as "disabled" | "enabled",
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    aiGenerationDatabaseUrl: harness.aiGenerationDatabaseUrl,
    anonymousSessionPolicy: harness.anonymousSessionPolicy,
    databaseUrl: harness.databaseUrl,
    deploymentEnvironment: harness.deploymentEnvironment,
    privateContentKeyring: harness.privateContentKeyring,
    privacyDeletionDatabaseUrl: harness.privacyDeletionDatabaseUrl,
    privacyDeletionPolicy: harness.privacyDeletionPolicy,
    privacyExport: harness.privacyExport,
    payment: harness.payment,
    paymentWebhookDatabaseUrl: harness.paymentWebhookDatabaseUrl,
    questionIntakeActivationReference: harness.questionIntakeActivationReference,
    reflectionPolicy: harness.reflectionPolicy,
    recoveryIdentitySandbox: harness.recoveryIdentitySandbox,
    recoveryCommerceSandbox: harness.recoveryCommerceSandbox,
    recoveryItem11Sandbox: harness.recoveryItem11Sandbox,
    tarotReadingIntegrityKeyring: harness.tarotReadingIntegrityKeyring,
  }),
}));

vi.mock("../server/tarot-reading-state", () => ({
  loadTarotReadingAvailability: () => harness.tarotReadingAvailability,
}));

vi.mock("../server/astrology-runtime", () => ({
  resolveWebAstrologyNativeBuildMetadataPath: () => harness.nativeMetadataPath,
}));

import { inspectRecoveryStagingRuntime } from "../server/recovery-staging";

const sourceSha = "1111111111111111111111111111111111111111";

describe("Recovery Item 11 runtime identity", () => {
  beforeEach(() => {
    harness.aiGenerationDatabaseUrl = "postgresql://ai.example.invalid/rituvia";
    harness.anonymousSessionPolicy = {};
    harness.databaseUrl = "postgresql://staging.example.invalid/rituvia";
    harness.deploymentEnvironment = "staging";
    harness.nativeMetadataPath = "/private/recovery/build-metadata.json";
    harness.privateContentKeyring = {};
    harness.privacyDeletionDatabaseUrl = "postgresql://deletion.example.invalid/rituvia";
    harness.privacyDeletionPolicy = {};
    harness.privacyExport = {};
    harness.payment = { provider: "stripe" };
    harness.paymentWebhookDatabaseUrl = "postgresql://webhook.example.invalid/rituvia";
    harness.questionIntakeActivationReference = "own-009.recovery-item-5";
    harness.reflectionPolicy = {};
    harness.recoveryIdentitySandbox = {};
    harness.recoveryCommerceSandbox = {};
    harness.recoveryItem11Sandbox = {};
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
      coinbaseSandbox: "enabled",
      commerceSandbox: "enabled",
      environment: "staging",
      indexing: "disabled",
      identitySandbox: "enabled",
      nativeAstrology: "enabled",
      numerologyEngine: "enabled",
      objectStorage: "not-connected",
      providerAi: "enabled",
      productionProviders: "disabled",
      privacyControls: "enabled",
      ready: true,
      recoveryItem: 11,
      sourceSha,
      tarotCatalog: "enabled",
      timeZoneRuntime: "pinned",
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
    expect(
      inspectRecoveryStagingRuntime({
        AI_GATEWAY_API_KEY: "static-key-canary",
        RITUVIA_BUILD_SOURCE_SHA: sourceSha,
      }).ready,
    ).toBe(false);
  });

  it("fails closed when any required core-loop configuration is absent", () => {
    harness.privateContentKeyring = undefined;
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha }).ready).toBe(
      false,
    );
  });

  it("fails closed without the dedicated Item 11 sandbox or least-privilege AI database", () => {
    harness.recoveryItem11Sandbox = undefined;
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha })).toMatchObject({
      coinbaseSandbox: "disabled",
      providerAi: "disabled",
      ready: false,
    });

    harness.recoveryItem11Sandbox = {};
    harness.aiGenerationDatabaseUrl = undefined;
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

  it("fails closed when the reviewed native astrology build is unavailable", () => {
    harness.nativeMetadataPath = undefined;
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha })).toMatchObject({
      nativeAstrology: "disabled",
      ready: false,
    });
  });

  it("fails closed outside the protected staging classification", () => {
    harness.deploymentEnvironment = "preview";
    expect(inspectRecoveryStagingRuntime({ RITUVIA_BUILD_SOURCE_SHA: sourceSha }).ready).toBe(
      false,
    );
  });
});
