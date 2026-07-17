import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  evaluate: vi.fn(),
  loadWebFeatureFlagEvaluator: vi.fn(),
}));

vi.mock("../server/feature-flags", () => ({
  loadWebFeatureFlagEvaluator: harness.loadWebFeatureFlagEvaluator,
}));

import { loadPublicShellState } from "../server/public-shell-state";

describe("public shell state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.loadWebFeatureFlagEvaluator.mockResolvedValue({ evaluate: harness.evaluate });
  });

  it.each([
    [true, "enabled"],
    [false, "disabled"],
  ] as const)("maps evaluated enabled=%s to %s", async (enabled, expected) => {
    harness.evaluate.mockReturnValue({ enabled, reason: "test", version: 1 });

    await expect(loadPublicShellState()).resolves.toBe(expected);
    expect(harness.evaluate).toHaveBeenCalledWith("experience.public_shell", { locale: "en" });
  });

  it("fails closed without exposing the dependency error", async () => {
    harness.loadWebFeatureFlagEvaluator.mockRejectedValue(new Error("private database canary"));

    await expect(loadPublicShellState()).resolves.toBe("unavailable");
  });
});
