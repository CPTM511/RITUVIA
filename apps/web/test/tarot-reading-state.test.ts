import { describe, expect, it } from "vitest";

import {
  evaluateTarotReadingAvailability,
  loadTarotReadingCatalog,
  tarotReadingHistoricalCatalog,
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
  it("enables the approved catalog only for a fully configured local or staging runtime", () => {
    expect(evaluateTarotReadingAvailability(configuredLocalRuntime, "2026-07-18")).toBe("enabled");
    expect(
      evaluateTarotReadingAvailability(
        { ...configuredLocalRuntime, deploymentEnvironment: "staging" },
        "2026-07-18",
      ),
    ).toBe("enabled");
    expect(tarotReadingMvpCatalog.editorial.approvalReference).toBe(
      "owner-directive:2026-07-18-major-arcana",
    );
    expect(tarotReadingMvpCatalog.catalogId).toBe("rituvia.major-arcana-catalog");
    expect(tarotReadingMvpCatalog.decks[0]?.cards).toHaveLength(22);
    expect(tarotReadingMvpCatalogChecksum).toBe(
      "sha256:06666a86d228c64d620f98c6c2b65925e788fb474e0c73fa55255af16e013c51",
    );
  });

  it("loads the exact active and historical catalogs for new draws and replay", () => {
    expect(loadTarotReadingCatalog({ id: "rituvia.major-arcana-catalog", version: "1.0.0" })).toBe(
      tarotReadingMvpCatalog,
    );
    expect(
      loadTarotReadingCatalog({
        id: "rituvia.original-reflection-catalog",
        version: "1.0.0",
      }),
    ).toBe(tarotReadingHistoricalCatalog);
    expect(loadTarotReadingCatalog({ id: "unknown.catalog", version: "1.0.0" })).toBeUndefined();
  });

  it.each([
    { ...configuredLocalRuntime, databaseUrl: undefined },
    { ...configuredLocalRuntime, tarotReadingIntegrityKeyring: undefined },
    { ...configuredLocalRuntime, deploymentEnvironment: "preview" as const },
    { ...configuredLocalRuntime, deploymentEnvironment: "production" as const },
  ])("fails closed when runtime approval prerequisites are absent", (configuration) => {
    expect(evaluateTarotReadingAvailability(configuration, "2026-07-18")).toBe("disabled");
  });

  it("fails closed after the catalog review window", () => {
    expect(evaluateTarotReadingAvailability(configuredLocalRuntime, "2027-07-19")).toBe("disabled");
  });
});
