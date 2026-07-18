import { describe, expect, it } from "vitest";

import {
  evaluateTarotReadingAvailability,
  tarotReadingMvpCatalog,
  tarotReadingMvpCatalogChecksum,
} from "../server/tarot-reading-state";

const configuredLocalRuntime = Object.freeze({
  databaseUrl: "postgresql://runtime@example.test:5432/rituvia",
  deploymentEnvironment: "local" as const,
  tarotReadingIntegrityKeyring: Object.freeze({
    activeVersion: "tarot-integrity.v1" as const,
    keys: Object.freeze([
      Object.freeze({ encodedKey: "a".repeat(43), version: "tarot-integrity.v1" as const }),
    ]),
  }),
});

describe("tarot reading activation state", () => {
  it("enables the approved catalog only for a fully configured local runtime", () => {
    expect(evaluateTarotReadingAvailability(configuredLocalRuntime, "2026-07-18")).toBe("enabled");
    expect(tarotReadingMvpCatalog.editorial.approvalReference).toBe(
      "OWN-010:rituvia-original-reflection.v1",
    );
    expect(tarotReadingMvpCatalogChecksum).toBe(
      "sha256:e5359254f1596051db60139281d2c426b702b552496b9ff52b7834389ca1bb70",
    );
  });

  it.each([
    { ...configuredLocalRuntime, databaseUrl: undefined },
    { ...configuredLocalRuntime, tarotReadingIntegrityKeyring: undefined },
    { ...configuredLocalRuntime, deploymentEnvironment: "preview" as const },
    { ...configuredLocalRuntime, deploymentEnvironment: "staging" as const },
    { ...configuredLocalRuntime, deploymentEnvironment: "production" as const },
  ])("fails closed when runtime approval prerequisites are absent", (configuration) => {
    expect(evaluateTarotReadingAvailability(configuration, "2026-07-18")).toBe("disabled");
  });

  it("fails closed after the catalog review window", () => {
    expect(evaluateTarotReadingAvailability(configuredLocalRuntime, "2027-07-19")).toBe("disabled");
  });
});
