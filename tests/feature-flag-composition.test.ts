import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const database = { $disconnect: vi.fn(() => Promise.resolve()) };
  return {
    assertFeatureFlagRuntimeDatabasePrivileges: vi.fn(() => Promise.resolve()),
    createDatabaseClient: vi.fn(() => database),
    database,
    getWebRuntimeConfiguration: vi.fn(() => ({
      databaseUrl: "postgresql://runtime@db.internal/rituvia",
    })),
    readFeatureFlagVersions: vi.fn(() =>
      Promise.resolve([
        {
          actorId: "control.local",
          approvalReference: "OWN-002:owner-record",
          changeReference: "RIT-063",
          countryCodes: ["US"],
          createdAt: "2026-07-17T10:00:00.000Z",
          effectiveAt: "2026-07-17T11:00:00.000Z",
          expiresAt: null,
          flagKey: "payments.fiat_checkout",
          localeTags: [],
          registryVersion: 3,
          state: "on",
          version: 1,
        },
      ]),
    ),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@rituvia/db", () => ({
  assertFeatureFlagRuntimeDatabasePrivileges: harness.assertFeatureFlagRuntimeDatabasePrivileges,
  createDatabaseClient: harness.createDatabaseClient,
  readFeatureFlagVersions: harness.readFeatureFlagVersions,
}));
vi.mock("../apps/web/config/server", () => ({
  getWebRuntimeConfiguration: harness.getWebRuntimeConfiguration,
}));

import { loadWebFeatureFlagEvaluator } from "../apps/web/server/feature-flags.js";

describe("Web feature-flag composition boundary", () => {
  it("reuses its runtime database source and evaluates a control-plane-approved scope", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
    try {
      const evaluator = await loadWebFeatureFlagEvaluator();
      expect(harness.createDatabaseClient).toHaveBeenCalledWith(
        "postgresql://runtime@db.internal/rituvia",
      );
      expect(harness.assertFeatureFlagRuntimeDatabasePrivileges).toHaveBeenCalledWith(
        harness.database,
      );
      expect(harness.readFeatureFlagVersions).toHaveBeenCalledWith(harness.database, 3);
      expect(harness.database.$disconnect).not.toHaveBeenCalled();
      expect(evaluator.evaluate("payments.fiat_checkout", { countryCode: "US" })).toMatchObject({
        enabled: true,
        reason: "enabled",
        registryVersion: 3,
        version: 1,
      });
      expect(evaluator.evaluate("payments.fiat_checkout", { countryCode: "CA" })).toMatchObject({
        enabled: false,
        reason: "scope-mismatch",
        version: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
