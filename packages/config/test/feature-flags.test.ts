import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../src/errors.js";
import {
  createFeatureFlagEvaluator,
  featureFlagKeys,
  featureFlagRegistry,
  featureFlagRegistryVersion,
  parseFeatureFlagSnapshot,
  type FeatureFlagKey,
} from "../src/feature-flags.js";

const NOW = "2026-07-17T12:00:00.000Z";

const createRecord = (
  flagKey: FeatureFlagKey,
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  actorId: "codex.local",
  approvalReference: null,
  changeReference: "RIT-007",
  countryCodes: [],
  createdAt: "2026-07-17T10:00:00.000Z",
  effectiveAt: "2026-07-17T11:00:00.000Z",
  expiresAt: null,
  flagKey,
  localeTags: [],
  registryVersion: featureFlagRegistryVersion,
  state: "off",
  version: 1,
  ...overrides,
});

const createSnapshot = (records: readonly unknown[] = []) => ({
  records,
  registryVersion: featureFlagRegistryVersion,
});

const createEvaluator = (records: readonly unknown[] = [], now = NOW) =>
  createFeatureFlagEvaluator(createSnapshot(records), () => now);

describe("typed feature-flag registry", () => {
  it("publishes a deeply immutable, versioned registry whose defaults are all safe-off", () => {
    expect(featureFlagRegistryVersion).toBe(1);
    expect(featureFlagKeys).toEqual([
      "content.regional_tradition",
      "experience.public_shell",
      "market.country_activation",
      "payments.crypto_checkout",
      "payments.fiat_checkout",
    ]);
    expect(Object.isFrozen(featureFlagKeys)).toBe(true);
    expect(Object.isFrozen(featureFlagRegistry)).toBe(true);

    for (const flagKey of featureFlagKeys) {
      const definition = featureFlagRegistry[flagKey];
      expect(definition.defaultState).toBe("off");
      expect(definition.lifecycle).toBe("active");
      expect(definition.cleanupReference).toMatch(/^RIT-\d+$/);
      expect(definition.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(definition.removalOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(definition.removalOn > definition.createdOn).toBe(true);
      expect(definition.owner.length).toBeGreaterThan(0);
      expect(definition.purpose.length).toBeGreaterThan(20);
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });

  it("returns a version-carrying safe-off result when no persisted version exists", () => {
    const evaluator = createEvaluator();

    for (const flagKey of featureFlagKeys) {
      expect(evaluator.evaluate(flagKey, {})).toEqual({
        enabled: false,
        evaluatedAt: NOW,
        flagKey,
        reason: "default-off",
        registryVersion: 1,
        source: "default",
        version: null,
      });
    }
  });

  it("enables a standard flag only from an effective immutable version", () => {
    const evaluator = createEvaluator([createRecord("experience.public_shell", { state: "on" })]);
    const evaluation = evaluator.evaluate("experience.public_shell", {});

    expect(evaluation).toEqual({
      enabled: true,
      evaluatedAt: NOW,
      flagKey: "experience.public_shell",
      reason: "enabled",
      registryVersion: 1,
      source: "version",
      version: 1,
    });
    expect(Object.isFrozen(evaluation)).toBe(true);
  });

  it("requires exact owner-gate evidence and explicit country scope for checkout", () => {
    const enabled = createRecord("payments.fiat_checkout", {
      approvalReference: "OWN-002:approval-2026-07-17",
      countryCodes: ["US"],
      state: "on",
    });
    const evaluator = createEvaluator([enabled]);

    expect(evaluator.evaluate("payments.fiat_checkout", { countryCode: "US" }).enabled).toBe(true);
    expect(evaluator.evaluate("payments.fiat_checkout", { countryCode: "CA" })).toMatchObject({
      enabled: false,
      reason: "scope-mismatch",
      version: 1,
    });
    expect(evaluator.evaluate("payments.fiat_checkout", {})).toMatchObject({
      enabled: false,
      reason: "scope-mismatch",
    });
  });

  it("requires both country and canonical locale scope for a regional tradition", () => {
    const evaluator = createEvaluator([
      createRecord("content.regional_tradition", {
        approvalReference: "OWN-007:approval-2026-07-17",
        countryCodes: ["JP"],
        localeTags: ["ja-JP"],
        state: "on",
      }),
    ]);

    expect(
      evaluator.evaluate("content.regional_tradition", {
        countryCode: "JP",
        locale: "ja-JP",
      }).enabled,
    ).toBe(true);
    expect(
      evaluator.evaluate("content.regional_tradition", {
        countryCode: "JP",
        locale: "en-US",
      }),
    ).toMatchObject({ enabled: false, reason: "scope-mismatch" });
  });

  it("uses the newest effective version and never resurrects an older version after expiry", () => {
    const first = createRecord("experience.public_shell", { state: "on" });
    const second = createRecord("experience.public_shell", {
      createdAt: "2026-07-17T10:30:00.000Z",
      effectiveAt: "2026-07-17T11:30:00.000Z",
      state: "off",
      version: 2,
    });
    const third = createRecord("experience.public_shell", {
      createdAt: "2026-07-17T11:00:00.000Z",
      effectiveAt: "2026-07-17T11:45:00.000Z",
      expiresAt: "2026-07-17T11:55:00.000Z",
      state: "on",
      version: 3,
    });
    const evaluator = createEvaluator([third, first, second]);

    expect(evaluator.evaluate("experience.public_shell", {})).toMatchObject({
      enabled: false,
      reason: "expired",
      version: 3,
    });
    expect(
      createEvaluator([third, first, second], "2026-07-17T11:40:00.000Z").evaluate(
        "experience.public_shell",
        {},
      ),
    ).toMatchObject({ enabled: false, reason: "configured-off", version: 2 });
  });

  it("keeps the current version effective until a scheduled newer version begins", () => {
    const current = createRecord("experience.public_shell", { state: "on" });
    const scheduled = createRecord("experience.public_shell", {
      createdAt: "2026-07-17T11:00:00.000Z",
      effectiveAt: "2026-07-18T00:00:00.000Z",
      state: "off",
      version: 2,
    });
    const evaluator = createEvaluator([scheduled, current]);

    expect(evaluator.evaluate("experience.public_shell", {})).toMatchObject({
      enabled: true,
      version: 1,
    });
  });

  it("lets a later-created emergency off version override a future scheduled activation", () => {
    const current = createRecord("experience.public_shell", { state: "on" });
    const scheduled = createRecord("experience.public_shell", {
      createdAt: "2026-07-17T10:30:00.000Z",
      effectiveAt: "2026-07-18T00:00:00.000Z",
      state: "on",
      version: 2,
    });
    const emergencyOff = createRecord("experience.public_shell", {
      createdAt: "2026-07-17T11:00:00.000Z",
      effectiveAt: "2026-07-17T11:00:00.000Z",
      state: "off",
      version: 3,
    });

    for (const now of ["2026-07-17T12:00:00.000Z", "2026-07-18T01:00:00.000Z"]) {
      expect(
        createEvaluator([scheduled, current, emergencyOff], now).evaluate(
          "experience.public_shell",
          {},
        ),
      ).toMatchObject({ enabled: false, reason: "configured-off", version: 3 });
    }
  });

  it.each([
    {
      label: "unknown registry version",
      snapshot: { records: [], registryVersion: 2 },
    },
    {
      label: "unknown flag",
      snapshot: createSnapshot([createRecord("experience.public_shell", { flagKey: "unknown" })]),
    },
    {
      label: "extra field",
      snapshot: createSnapshot([createRecord("experience.public_shell", { payload: "private" })]),
    },
    {
      label: "duplicate version",
      snapshot: createSnapshot([
        createRecord("experience.public_shell"),
        createRecord("experience.public_shell"),
      ]),
    },
    {
      label: "unsorted country scope",
      snapshot: createSnapshot([
        createRecord("payments.fiat_checkout", {
          approvalReference: "OWN-002:approval",
          countryCodes: ["US", "CA"],
          state: "on",
        }),
      ]),
    },
    {
      label: "non-canonical locale",
      snapshot: createSnapshot([
        createRecord("content.regional_tradition", {
          approvalReference: "OWN-007:approval",
          countryCodes: ["JP"],
          localeTags: ["JA-jp"],
          state: "on",
        }),
      ]),
    },
    {
      label: "missing approval",
      snapshot: createSnapshot([
        createRecord("payments.crypto_checkout", { countryCodes: ["US"], state: "on" }),
      ]),
    },
    {
      label: "backdated activation",
      snapshot: createSnapshot([
        createRecord("experience.public_shell", {
          createdAt: "2026-07-17T11:30:00.000Z",
        }),
      ]),
    },
    {
      label: "wrong approval gate",
      snapshot: createSnapshot([
        createRecord("payments.crypto_checkout", {
          approvalReference: "OWN-002:approval",
          countryCodes: ["US"],
          state: "on",
        }),
      ]),
    },
    {
      label: "missing gated country scope",
      snapshot: createSnapshot([
        createRecord("market.country_activation", {
          approvalReference: "OWN-004:approval",
          state: "on",
        }),
      ]),
    },
    {
      label: "non-monotonic creation timing",
      snapshot: createSnapshot([
        createRecord("experience.public_shell"),
        createRecord("experience.public_shell", { version: 2 }),
      ]),
    },
  ])("rejects $label without accepting an unsafe partial snapshot", ({ snapshot }) => {
    expect(() => parseFeatureFlagSnapshot(snapshot)).toThrow(ConfigurationError);
  });

  it("redacts malformed record values from every error surface", () => {
    const canary = "private feature flag canary";

    try {
      parseFeatureFlagSnapshot(
        createSnapshot([createRecord("experience.public_shell", { actorId: canary })]),
      );
      expect.unreachable("the malformed actor identifier should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).not.toContain(canary);
      expect((error as Error).stack).not.toContain(canary);
      expect(JSON.stringify(error)).not.toContain(canary);
    }
  });

  it("rejects invalid runtime context and unknown runtime keys instead of coercing them", () => {
    const evaluator = createEvaluator();

    expect(() =>
      evaluator.evaluate("experience.public_shell", {
        countryCode: "usa",
      }),
    ).toThrow(ConfigurationError);
    expect(() => evaluator.evaluate("unknown" as FeatureFlagKey, {})).toThrow(ConfigurationError);
    expect(() =>
      createFeatureFlagEvaluator(createSnapshot(), () => "invalid").evaluate(
        "experience.public_shell",
        {},
      ),
    ).toThrow(ConfigurationError);
  });

  it("fails closed after a registry definition reaches its removal date", () => {
    const evaluator = createEvaluator(
      [createRecord("experience.public_shell", { state: "on" })],
      "2027-01-01T00:00:00.000Z",
    );

    expect(evaluator.evaluate("experience.public_shell", {})).toMatchObject({
      enabled: false,
      reason: "registry-expired",
      version: 1,
    });
  });

  it("deeply freezes parsed snapshots and does not mutate caller input", () => {
    const input = createSnapshot([
      createRecord("payments.fiat_checkout", {
        approvalReference: "OWN-002:approval",
        countryCodes: ["US"],
        state: "on",
      }),
    ]);
    const before = structuredClone(input);
    const parsed = parseFeatureFlagSnapshot(input);

    expect(input).toEqual(before);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.records)).toBe(true);
    expect(Object.isFrozen(parsed.records[0])).toBe(true);
    expect(Object.isFrozen(parsed.records[0]?.countryCodes)).toBe(true);
    expect(Object.isFrozen(parsed.records[0]?.localeTags)).toBe(true);
  });
});
