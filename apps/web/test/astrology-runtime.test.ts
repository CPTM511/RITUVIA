import { describe, expect, it, vi } from "vitest";

import { createWebAstrologyCalculationRuntime } from "../server/astrology-runtime";
import { createPrivateContentCryptography } from "../server/private-content-crypto";

describe("Web astrology runtime composition", () => {
  it("evaluates the canonical kill switch before loading native artifacts", async () => {
    const evaluate = vi.fn(() => ({
      enabled: false,
      evaluatedAt: "2026-07-26T00:00:00.000Z",
      flagKey: "experience.astrology" as const,
      reason: "default-off" as const,
      registryVersion: 1 as const,
      source: "default" as const,
      version: null,
    }));
    const loadEphemeris = vi.fn();
    const runtime = createWebAstrologyCalculationRuntime({
      birthProfiles: {
        create: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        read: vi.fn(),
        update: vi.fn(),
      },
      calculations: {
        create: vi.fn(),
        list: vi.fn(),
        read: vi.fn(),
      },
      cryptography: createPrivateContentCryptography({
        activeKeyVersion: "private-content.v1",
        digestKeyVersion: "private-content.v1",
        keys: [{ key: new Uint8Array(32).fill(19), version: "private-content.v1" }],
      }),
      loadEphemeris,
      loadFeatureFlagEvaluator: async () => ({ evaluate }),
    });

    await expect(
      runtime.calculate({
        birthProfileId: "22222222-2222-4222-8222-222222222222",
        expectedBirthProfileRevision: 1,
        idempotencyKey: "r".repeat(22),
        sessionToken: "A".repeat(43),
      }),
    ).rejects.toMatchObject({ code: "ASTROLOGY_CALCULATION_DISABLED" });
    expect(evaluate).toHaveBeenCalledWith("experience.astrology", {});
    expect(loadEphemeris).not.toHaveBeenCalled();
  });
});
