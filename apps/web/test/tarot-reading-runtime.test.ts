import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  configuration: {
    databaseUrl: "postgresql://runtime@example.test:5432/rituvia",
    deploymentEnvironment: "local",
    tarotReadingIntegrityKeyring: {
      activeVersion: "tarot-integrity.v1",
      keys: [{ encodedKey: "a".repeat(43), version: "tarot-integrity.v1" }],
    },
  } as {
    databaseUrl: string | undefined;
    deploymentEnvironment: "local" | "preview" | "production" | "staging";
    tarotReadingIntegrityKeyring: unknown | undefined;
  },
  create: vi.fn(),
  createApplicationService: vi.fn(),
  createPersistence: vi.fn(),
  database: Object.freeze({ kind: "database" }),
  get: vi.fn(),
  report: vi.fn(),
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => harness.configuration,
}));

vi.mock("../server/database", () => ({
  loadWebDatabase: () => harness.database,
}));

vi.mock("@rituvia/db", () => ({
  createTarotReadingPersistence: harness.createPersistence,
}));

vi.mock("../server/tarot-reading", async (importOriginal) => {
  const original = await importOriginal<typeof import("../server/tarot-reading")>();
  return {
    ...original,
    createTarotReadingApplicationService: harness.createApplicationService,
  };
});

import {
  createWebTarotReading,
  getWebTarotReading,
  reportWebTarotReading,
} from "../server/tarot-reading-runtime";

const request = Object.freeze({
  locale: "en",
  readingType: "one_card",
  schemaVersion: "tarot-reading-create.v1",
  themeCode: "open_reflection",
});
const idempotencyKey = "abcdefghijklmnopqrstuv";
const sessionToken = "s".repeat(43);
const readingId = "33333333-3333-4333-8333-333333333333";

describe("tarot reading web runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.configuration.databaseUrl = "postgresql://runtime@example.test:5432/rituvia";
    harness.configuration.deploymentEnvironment = "local";
    harness.configuration.tarotReadingIntegrityKeyring = {
      activeVersion: "tarot-integrity.v1",
      keys: [{ encodedKey: "a".repeat(43), version: "tarot-integrity.v1" }],
    };
    harness.create.mockResolvedValue({ kind: "created", response: { readingId } });
    harness.get.mockResolvedValue({ readingId });
    harness.report.mockResolvedValue({ kind: "created" });
    harness.createPersistence.mockReturnValue(Object.freeze({ kind: "persistence" }));
    harness.createApplicationService.mockReturnValue(
      Object.freeze({ create: harness.create, get: harness.get, report: harness.report }),
    );
  });

  it("wires the approved catalog, database persistence, and configured integrity keyring", async () => {
    await expect(createWebTarotReading(request, idempotencyKey, sessionToken)).resolves.toEqual({
      kind: "created",
      response: { readingId },
    });
    await expect(getWebTarotReading(readingId, sessionToken)).resolves.toEqual({ readingId });
    await expect(
      reportWebTarotReading(
        readingId,
        {
          category: "factual",
          schemaVersion: "tarot-reading-report.v1",
          target: { kind: "reading" },
        },
        idempotencyKey,
        sessionToken,
      ),
    ).resolves.toEqual({ kind: "created" });

    expect(harness.createPersistence).toHaveBeenCalledWith(harness.database, {
      readingLimit: 12,
      readingPolicyVersion: "tarot-reading.local.en.v1",
      reportPolicyVersion: "tarot-reading-report.local.en.v1",
      windowSeconds: 3_600,
    });
    expect(harness.createApplicationService).toHaveBeenCalledWith(
      expect.objectContaining({
        integrityKeys: harness.configuration.tarotReadingIntegrityKeyring,
        policy: expect.objectContaining({
          catalog: expect.objectContaining({
            approvalReference: "OWN-010:rituvia-original-reflection.v1",
            id: "rituvia.original-reflection-catalog",
            version: "1.0.0",
          }),
          deck: { id: "rituvia.original-reflection-deck", version: "1.0.0" },
          orientationPolicy: "upright_and_reversed",
        }),
      }),
    );
    expect(harness.create).toHaveBeenCalledWith(request, idempotencyKey, sessionToken);
    expect(harness.get).toHaveBeenCalledWith(readingId, sessionToken);
  });

  it.each(["preview", "staging", "production"] as const)(
    "keeps %s direct invocation fail-closed even after a local service was initialized",
    async (deploymentEnvironment) => {
      harness.configuration.deploymentEnvironment = deploymentEnvironment;

      await expect(
        createWebTarotReading(request, idempotencyKey, sessionToken),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(harness.create).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the database or integrity configuration is absent", async () => {
    harness.configuration.databaseUrl = undefined;

    await expect(getWebTarotReading(readingId, sessionToken)).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(harness.get).not.toHaveBeenCalled();

    harness.configuration.databaseUrl = "postgresql://runtime@example.test:5432/rituvia";
    harness.configuration.tarotReadingIntegrityKeyring = undefined;
    await expect(getWebTarotReading(readingId, sessionToken)).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
