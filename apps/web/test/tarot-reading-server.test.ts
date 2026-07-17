import { readFile } from "node:fs/promises";

import { parseTarotCatalogV1, parseTarotDrawExecutionV1 } from "@rituvia/divination";
import { parseTarotReadingCreateRequestV1, questionIntakeThemeCodes } from "@rituvia/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTarotCatalogChecksum } from "../server/tarot-reading-crypto";
import {
  createTarotReadingApplicationService,
  tarotReadingPolicySchemaVersion,
  type PersistedTarotReading,
  type TarotReadingPersistence,
  type TarotReadingPolicyV1,
} from "../server/tarot-reading";

type EditorialFixture = {
  approvalReference: string | null;
  authorId: string;
  requiredApprovalRole: string;
  reviewedDate: string | null;
  reviewerId: string | null;
  reviewerRole: string | null;
  status: string;
};
type CatalogFixture = {
  cardContents: Array<{
    editorial: EditorialFixture;
    themeReadings: Array<{ text: string; themeCode: string }>;
    translationStatus: string;
  }>;
  decks: Array<{
    artworkRightsSource: { id: string; version: string } | null;
    artworkStatus: string;
    cards: Array<{
      artwork: null | {
        altText: string;
        assetId: string;
        credit: string;
        localizationNotes: string;
        source: { id: string; version: string };
        version: string;
      };
      cardId: string;
      title: string;
    }>;
    editorial: EditorialFixture;
  }>;
  editorial: EditorialFixture;
  sources: Array<{
    editorial: EditorialFixture;
    rights: {
      allowedUses: string[];
      materialTypes: string[];
      territory: string;
    };
    sourceId: string;
    version: string;
  }>;
  spreads: Array<{ editorial: EditorialFixture }>;
  supportedThemeCodes: string[];
  usePolicy: { publicationAllowed: boolean };
};

const rawCatalog = JSON.parse(
  await readFile(
    new URL("../../../content/traditions/tarot/rituvia-placeholder.v1.json", import.meta.url),
    "utf8",
  ),
) as CatalogFixture;

const approve = (editorial: EditorialFixture): void => {
  editorial.status = "approved";
  editorial.reviewerRole = editorial.requiredApprovalRole;
  editorial.reviewerId = "reviewer.fixture";
  editorial.reviewedDate = "2026-07-17";
  editorial.approvalReference = "test:explicit-approval-fixture";
};

const eligibleCatalog = (): unknown => {
  const candidate = structuredClone(rawCatalog);
  candidate.usePolicy.publicationAllowed = true;
  candidate.supportedThemeCodes = [...questionIntakeThemeCodes];
  [
    candidate.editorial,
    ...candidate.sources.map(({ editorial }) => editorial),
    ...candidate.decks.map(({ editorial }) => editorial),
    ...candidate.spreads.map(({ editorial }) => editorial),
    ...candidate.cardContents.map(({ editorial }) => editorial),
  ].forEach(approve);
  const source = candidate.sources[0];
  if (source === undefined) throw new Error("fixture source missing");
  source.rights.allowedUses = ["internal_validation", "public_display", "commercial_use"];
  source.rights.materialTypes = [
    "structural_data",
    "spread_definition",
    "interpretive_text",
    "artwork",
  ];
  source.rights.territory = "worldwide";
  const artworkSource = { id: source.sourceId, version: source.version };
  for (const deck of candidate.decks) {
    deck.artworkStatus = "assigned";
    deck.artworkRightsSource = artworkSource;
    for (const card of deck.cards) {
      card.artwork = {
        altText: `Synthetic test artwork for ${card.title}.`,
        assetId: `${card.cardId}-artwork`,
        credit: "Synthetic positive-path test fixture",
        localizationNotes: "Replace before real publication.",
        source: artworkSource,
        version: "1.0.0",
      };
    }
  }
  for (const content of candidate.cardContents) {
    content.translationStatus = "source_reviewed";
    content.themeReadings = questionIntakeThemeCodes.map((themeCode) => ({
      text: `A bounded reflective possibility for ${themeCode}.`,
      themeCode,
    }));
  }
  return candidate;
};

class FakePersistenceError extends Error {
  readonly code:
    | "TAROT_READING_IDEMPOTENCY_CONFLICT"
    | "TAROT_READING_RATE_LIMITED"
    | "TAROT_READING_SESSION_UNAVAILABLE";
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code:
      | "TAROT_READING_IDEMPOTENCY_CONFLICT"
      | "TAROT_READING_RATE_LIMITED"
      | "TAROT_READING_SESSION_UNAVAILABLE",
    retryAfterSeconds?: number,
  ) {
    super("synthetic persistence error");
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const subjectId = "11111111-1111-4111-8111-111111111111";
const otherSubjectId = "22222222-2222-4222-8222-222222222222";
const token = "a".repeat(43);
const otherToken = "b".repeat(43);
const idempotencyKey = "abcdefghijklmnopqrstuv";
const key = (byte: number): string => Buffer.alloc(32, byte).toString("base64url");
const request = Object.freeze({
  locale: "en" as const,
  readingType: "one_card" as const,
  schemaVersion: "tarot-reading-create.v1" as const,
  themeCode: "open_reflection" as const,
});

const createFakePersistence = (maximumReadingsPerWindow = 2) => {
  const readings: PersistedTarotReading[] = [];
  let createCalls = 0;
  const ownerFor = (sessionToken: string): string => {
    if (sessionToken === token) return subjectId;
    if (sessionToken === otherToken) return otherSubjectId;
    throw new FakePersistenceError("TAROT_READING_SESSION_UNAVAILABLE");
  };
  const persistence: TarotReadingPersistence = {
    get: ({ readingId, token: sessionToken }) => {
      const owner = ownerFor(sessionToken);
      return Promise.resolve(
        readings.find((candidate) => candidate.id === readingId && candidate.subjectId === owner) ??
          null,
      );
    },
    resolveCreate: async ({ prepare, request: requestInput, token: sessionToken }) => {
      const owner = ownerFor(sessionToken);
      const parsedRequest = parseTarotReadingCreateRequestV1(requestInput);
      const prepared = await prepare({
        readingPolicyVersion: "test.tarot-reading.v1",
        request: parsedRequest,
        subjectId: owner,
      });
      const replay = readings.find(
        (candidate) =>
          candidate.subjectId === owner &&
          prepared.candidates.some(
            (entry) =>
              entry.idempotencyKeyVersion === candidate.idempotencyKeyVersion &&
              entry.idempotencyKeyDigest === candidate.idempotencyKeyDigest,
          ),
      );
      if (replay !== undefined) {
        const candidate = prepared.candidates.find(
          (entry) =>
            entry.idempotencyKeyVersion === replay.idempotencyKeyVersion &&
            entry.idempotencyKeyDigest === replay.idempotencyKeyDigest,
        );
        if (candidate?.clientRequestDigest !== replay.clientRequestDigest) {
          throw new FakePersistenceError("TAROT_READING_IDEMPOTENCY_CONFLICT");
        }
        return { kind: "replayed" as const, reading: replay };
      }
      if (
        readings.filter(({ subjectId: ownerId }) => ownerId === owner).length >=
        maximumReadingsPerWindow
      ) {
        throw new FakePersistenceError("TAROT_READING_RATE_LIMITED", 31);
      }
      const activeCandidate = prepared.candidates.find(
        ({ idempotencyKeyVersion }) =>
          idempotencyKeyVersion === prepared.activeIdempotencyKeyVersion,
      );
      if (activeCandidate === undefined) throw new Error("active candidate missing");
      const readingId = `33333333-3333-4333-8333-${String(createCalls + 1).padStart(12, "0")}`;
      const execution = parseTarotDrawExecutionV1(
        await prepared.createExecution({
          catalog: prepared.catalog,
          idempotencyKeyDigest: activeCandidate.idempotencyKeyDigest,
          integrityKeyVersion: prepared.integrityKeyVersion,
          readingId,
          subjectId: owner,
        }),
      );
      createCalls += 1;
      const reading: PersistedTarotReading = Object.freeze({
        catalog: prepared.catalog,
        clientRequestDigest: activeCandidate.clientRequestDigest,
        completedAt: "2026-07-17T12:00:00.000Z",
        createdAt: "2026-07-17T12:00:00.000Z",
        drawRequestDigest: execution.audit.requestDigest,
        execution,
        expiresAt: "2026-07-18T12:00:00.000Z",
        id: readingId,
        idempotencyKeyDigest: activeCandidate.idempotencyKeyDigest,
        idempotencyKeyVersion: activeCandidate.idempotencyKeyVersion,
        integrityKeyVersion: prepared.integrityKeyVersion,
        integrityScheme: prepared.integrityScheme,
        locale: parsedRequest.locale,
        readingPolicyVersion: "test.tarot-reading.v1",
        readingType: parsedRequest.readingType,
        requestSchemaVersion: parsedRequest.schemaVersion,
        status: "facts_ready",
        subjectId: owner,
        themeCode: parsedRequest.themeCode,
      });
      readings.push(reading);
      return { kind: "created" as const, reading };
    },
  };
  return { createCalls: () => createCalls, persistence, readings };
};

const serviceFixture = (input?: { limit?: number; rawCatalog?: unknown }) => {
  const catalog = input?.rawCatalog ?? eligibleCatalog();
  const parsed = parseTarotCatalogV1(catalog);
  const policy: TarotReadingPolicyV1 = Object.freeze({
    catalog: Object.freeze({
      approvalReference: "test:explicit-approval-fixture",
      checksum: createTarotCatalogChecksum(JSON.stringify(parsed)),
      id: parsed.catalogId,
      version: parsed.version,
    }),
    deck: Object.freeze({ id: "rituvia.placeholder-deck", version: "1.0.0" }),
    locale: "en",
    maximumReadingsPerWindow: input?.limit ?? 2,
    orientationPolicy: "upright_and_reversed",
    policyVersion: "test.tarot-reading.v1",
    schemaVersion: tarotReadingPolicySchemaVersion,
    spreads: Object.freeze({
      one_card: Object.freeze({ id: "one-card-perspective", version: "1.0.0" }),
      three_card: Object.freeze({
        id: "situation-action-possibility",
        version: "1.0.0",
      }),
    }),
    windowSeconds: 3_600,
  });
  const fake = createFakePersistence(input?.limit ?? 2);
  const provider = { load: vi.fn().mockResolvedValue(catalog) };
  const service = createTarotReadingApplicationService({
    catalogProvider: provider,
    clock: () => new Date("2026-07-17T12:00:00.000Z"),
    integrityKeys: {
      activeVersion: "test.key.v2",
      keys: [
        { encodedKey: key(3), version: "test.key.v1" },
        { encodedKey: key(7), version: "test.key.v2" },
      ],
    },
    persistence: fake.persistence,
    policy,
  });
  return { fake, provider, service };
};

describe("tarot reading application service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and replays one immutable public presentation without exposing audit data", async () => {
    const { fake, service } = serviceFixture();
    const created = await service.create(request, idempotencyKey, token);
    const replayed = await service.create(request, idempotencyKey, token);

    expect(created.kind).toBe("created");
    expect(replayed).toEqual({ kind: "replayed", response: created.response });
    expect(fake.createCalls()).toBe(1);
    expect(fake.readings).toHaveLength(1);
    expect(created.response.facts.positions).toHaveLength(1);
    expect(created.response.schemaVersion).toBe("tarot-reading-response.v2");
    expect(created.response.presentation.cards).toHaveLength(1);
    expect(created.response.presentation.cards[0]).toMatchObject({
      cardId: created.response.facts.positions[0]?.cardId,
      orientation: created.response.facts.positions[0]?.orientation,
      positionId: created.response.facts.positions[0]?.positionId,
    });
    expect(created.response.presentation.cards[0]?.invitation).toBe(
      "A bounded reflective possibility for open_reflection.",
    );
    expect(JSON.stringify(created.response)).not.toMatch(
      /audit|commitment|digest|entropy|subject|session/iu,
    );
  });

  it("projects reviewed theme-specific content for every accepted theme", async () => {
    const { fake, service } = serviceFixture({ limit: questionIntakeThemeCodes.length });

    for (const [index, themeCode] of questionIntakeThemeCodes.entries()) {
      const created = await service.create(
        { ...request, themeCode },
        `abcdefghijklmnopqrst${String(index).padStart(2, "0")}`,
        token,
      );
      expect(created.response.presentation.cards[0]?.invitation).toBe(
        `A bounded reflective possibility for ${themeCode}.`,
      );
    }

    expect(fake.createCalls()).toBe(questionIntakeThemeCodes.length);
  });

  it("returns an owner-scoped saved reading and makes cross-owner lookup indistinguishable", async () => {
    const { service } = serviceFixture();
    const created = await service.create(request, idempotencyKey, token);

    await expect(service.get(created.response.readingId, token)).resolves.toEqual(created.response);
    await expect(service.get(created.response.readingId, otherToken)).resolves.toBeNull();
    await expect(
      service.get("33333333-3333-4333-8333-333333333333", otherToken),
    ).resolves.toBeNull();
  });

  it("conflicts on same-key changed client semantics and limits only different keys", async () => {
    const { service } = serviceFixture({ limit: 1 });
    await service.create(request, idempotencyKey, token);
    await expect(
      service.create({ ...request, themeCode: "work" }, idempotencyKey, token),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(service.create(request, "mnopqrstuvabcdefghijkl", token)).rejects.toMatchObject({
      code: "limit_reached",
      retryAfterSeconds: 31,
    });
    await expect(service.create(request, idempotencyKey, token)).resolves.toMatchObject({
      kind: "replayed",
    });
  });

  it("rejects missing sessions without exposing the token", async () => {
    const { service } = serviceFixture();
    await expect(service.create(request, idempotencyKey, "private-token-canary")).rejects.toEqual(
      expect.objectContaining({ code: "session_required" }),
    );
    try {
      await service.create(request, idempotencyKey, "private-token-canary");
    } catch (error) {
      expect(String(error)).not.toContain("private-token-canary");
    }
  });

  it("fails before persistence for the canonical unpublished placeholder", async () => {
    const { fake, service } = serviceFixture({ rawCatalog });

    await expect(service.create(request, idempotencyKey, token)).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(fake.createCalls()).toBe(0);
    expect(fake.readings).toHaveLength(0);
  });

  it("fails before draw persistence when the approved catalog does not support the theme", async () => {
    const catalog = eligibleCatalog() as CatalogFixture;
    catalog.supportedThemeCodes = ["work"];
    for (const content of catalog.cardContents) {
      content.themeReadings = content.themeReadings.filter(({ themeCode }) => themeCode === "work");
    }
    const { fake, service } = serviceFixture({ rawCatalog: catalog });

    await expect(service.create(request, idempotencyKey, token)).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(fake.createCalls()).toBe(0);
    expect(fake.readings).toHaveLength(0);
  });

  it("fails closed when a persisted owner-bound execution is transplanted or damaged", async () => {
    const { fake, service } = serviceFixture();
    const created = await service.create(request, idempotencyKey, token);
    const original = fake.readings[0];
    if (original === undefined) throw new Error("fixture reading missing");
    fake.readings[0] = Object.freeze({ ...original, subjectId: otherSubjectId });

    await expect(service.get(created.response.readingId, otherToken)).rejects.toEqual(
      expect.objectContaining({ code: "unavailable" }),
    );
  });

  it.each([
    ["catalog checksum", { checksumSha256: `sha256:${"d".repeat(64)}` }],
    ["catalog approval", { approvalReference: "test:substituted-approval" }],
  ])("rejects a changed persisted %s before historical catalog use", async (_label, change) => {
    const { fake, service } = serviceFixture();
    const created = await service.create(request, idempotencyKey, token);
    const original = fake.readings[0];
    if (original === undefined) throw new Error("fixture reading missing");
    fake.readings[0] = Object.freeze({
      ...original,
      catalog: Object.freeze({ ...original.catalog, ...change }),
    });

    await expect(service.get(created.response.readingId, token)).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("uses retained historical keys to replay after the active key changes", async () => {
    const catalog = eligibleCatalog();
    const parsed = parseTarotCatalogV1(catalog);
    const fake = createFakePersistence();
    const policy: TarotReadingPolicyV1 = {
      catalog: {
        approvalReference: "test:explicit-approval-fixture",
        checksum: createTarotCatalogChecksum(JSON.stringify(parsed)),
        id: parsed.catalogId,
        version: parsed.version,
      },
      deck: { id: "rituvia.placeholder-deck", version: "1.0.0" },
      locale: "en",
      maximumReadingsPerWindow: 2,
      orientationPolicy: "upright_only",
      policyVersion: "test.tarot-reading.v1",
      schemaVersion: tarotReadingPolicySchemaVersion,
      spreads: {
        one_card: { id: "one-card-perspective", version: "1.0.0" },
        three_card: { id: "situation-action-possibility", version: "1.0.0" },
      },
      windowSeconds: 3_600,
    };
    const base = {
      catalogProvider: { load: () => Promise.resolve(catalog) },
      clock: () => new Date("2026-07-17T12:00:00.000Z"),
      persistence: fake.persistence,
      policy,
    };
    const first = createTarotReadingApplicationService({
      ...base,
      integrityKeys: {
        activeVersion: "test.key.v1",
        keys: [
          { encodedKey: key(3), version: "test.key.v1" },
          { encodedKey: key(7), version: "test.key.v2" },
        ],
      },
    });
    const created = await first.create(request, idempotencyKey, token);
    const rotated = createTarotReadingApplicationService({
      ...base,
      integrityKeys: {
        activeVersion: "test.key.v2",
        keys: [
          { encodedKey: key(3), version: "test.key.v1" },
          { encodedKey: key(7), version: "test.key.v2" },
        ],
      },
    });

    await expect(rotated.create(request, idempotencyKey, token)).resolves.toEqual({
      kind: "replayed",
      response: created.response,
    });
  });
});
