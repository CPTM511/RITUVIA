import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class PersistenceError extends Error {
    readonly code: string;
    readonly retryAfterSeconds: number | undefined;

    constructor(code: string, retryAfterSeconds?: number) {
      super("synthetic persistence error");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return {
    createDatabase: vi.fn(() => Object.freeze({ kind: "database" })),
    createEvaluator: vi.fn(() => Object.freeze({ evaluate: vi.fn() })),
    createService: vi.fn(),
    ensure: vi.fn(),
    assertFeatureFlagPrivileges: vi.fn(),
    readFeatureFlagVersions: vi.fn(),
    PersistenceError,
  };
});

vi.mock("@rituvia/config/feature-flags", () => ({
  createFeatureFlagEvaluator: harness.createEvaluator,
  featureFlagRegistryVersion: "test.registry.v1",
}));

vi.mock("@rituvia/db", () => ({
  AnonymousIdentityPersistenceError: harness.PersistenceError,
  assertFeatureFlagRuntimeDatabasePrivileges: harness.assertFeatureFlagPrivileges,
  createAnonymousIdentityService: harness.createService,
  createDatabaseClient: harness.createDatabase,
  readFeatureFlagVersions: harness.readFeatureFlagVersions,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    anonymousSessionPolicy: {
      issuanceLimit: 100,
      issuanceWindowSeconds: 60,
      policyVersion: "test.web-session.v1",
      ttlSeconds: 3_600,
    },
    databaseUrl: "postgresql://app:private@127.0.0.1:5432/rituvia",
  }),
}));

describe("anonymous session Web composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    harness.createService.mockReturnValue({ ensureSession: harness.ensure });
    harness.readFeatureFlagVersions.mockResolvedValue([]);
  });

  it("reuses one bounded database pool across feature flags and identity requests", async () => {
    harness.ensure.mockResolvedValue({
      context: {
        expiresAt: "2026-07-18T00:00:00.000Z",
        sessionId: "internal-session-id",
        subjectId: "internal-subject-id",
      },
      kind: "resumed",
    });
    const { ensureWebAnonymousSession } = await import("../server/anonymous-session");
    const { loadWebFeatureFlagEvaluator } = await import("../server/feature-flags");

    await loadWebFeatureFlagEvaluator();
    await ensureWebAnonymousSession({ idempotencyKey: "request_key_abcdefghijkl" });
    await ensureWebAnonymousSession({ idempotencyKey: "request_key_mnopqrstuvwxyz" });

    expect(harness.createDatabase).toHaveBeenCalledTimes(1);
    expect(harness.assertFeatureFlagPrivileges).toHaveBeenCalledTimes(1);
    expect(harness.readFeatureFlagVersions).toHaveBeenCalledTimes(1);
    expect(harness.createService).toHaveBeenCalledTimes(1);
    expect(harness.ensure).toHaveBeenCalledTimes(2);
  });

  it("maps persistence capacity detail without exposing the underlying error", async () => {
    harness.ensure.mockRejectedValue(
      new harness.PersistenceError("ANONYMOUS_SESSION_RATE_LIMITED", 19),
    );
    const { ensureWebAnonymousSession } = await import("../server/anonymous-session");

    await expect(
      ensureWebAnonymousSession({ idempotencyKey: "request_key_abcdefghijkl" }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "rate_limited",
        retryAfterSeconds: 19,
      }),
    );
  });
});
