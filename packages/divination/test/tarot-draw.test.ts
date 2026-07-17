import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  TarotContentError,
  TarotDrawError,
  parseTarotDrawExecutionV1,
  parseTarotDrawFactsV1,
  parseTarotDrawRequestV1,
  projectTarotDrawFactsV1,
  resolveTarotDrawV1,
  tarotDrawAlgorithmVersion,
  tarotDrawEngineVersion,
  tarotDrawRulesVersion,
  type TarotCSPRNG,
  type TarotDrawErrorCode,
  type TarotDrawExecutionV1,
  type TarotDrawRequestV1,
  type TarotExecutionVerifierV1,
} from "../src/index.js";
import { sampleUnbiasedUint8IndexV1 } from "../src/tarot-draw.js";

type DrawFixture = Readonly<{
  entropyBytes: readonly number[];
  execution: TarotDrawExecutionV1;
  request: TarotDrawRequestV1;
}>;

const catalogFixture = JSON.parse(
  await readFile(
    new URL("../../../content/traditions/tarot/rituvia-placeholder.v1.json", import.meta.url),
    "utf8",
  ),
) as unknown;
const drawFixture = JSON.parse(
  await readFile(new URL("./fixtures/tarot-draw-v1.json", import.meta.url), "utf8"),
) as DrawFixture;

const commitment = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const alternateKeyDigest =
  "sha256:3333333333333333333333333333333333333333333333333333333333333333";
const alternateRequestDigest =
  "sha256:4444444444444444444444444444444444444444444444444444444444444444";

const exactExecutionVerifier = (expected: TarotDrawExecutionV1): TarotExecutionVerifierV1 => {
  const serialized = JSON.stringify(expected);
  return (execution) => JSON.stringify(execution) === serialized;
};

const createEntropy = (
  values: readonly number[],
  auditValue: unknown = commitment,
): Readonly<{
  entropy: TarotCSPRNG;
  state: () => Readonly<{ auditCalls: number; reads: number }>;
}> => {
  let offset = 0;
  let reads = 0;
  let auditCalls = 0;
  return Object.freeze({
    entropy: Object.freeze({
      auditCommitment: () => {
        auditCalls += 1;
        return auditValue as string;
      },
      readBytes: (length: number) => {
        reads += 1;
        if (length !== 1 || offset >= values.length) throw new Error("test entropy exhausted");
        const value = values[offset];
        offset += 1;
        if (value === undefined) throw new Error("test entropy is missing a byte");
        return Uint8Array.of(value);
      },
    }),
    state: () => Object.freeze({ auditCalls, reads }),
  });
};

const oneCardRequest = (
  orientationPolicy: TarotDrawRequestV1["orientationPolicy"] = "upright_only",
): TarotDrawRequestV1 => ({
  ...drawFixture.request,
  orientationPolicy,
  requestDigest: alternateRequestDigest,
  spread: { id: "one-card-perspective", version: "1.0.0" },
});

const expectDrawError = (operation: () => unknown, code: TarotDrawErrorCode): void => {
  try {
    operation();
    expect.unreachable("The invalid draw operation must fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(TarotDrawError);
    expect((error as TarotDrawError).code).toBe(code);
    expect((error as Error).message).not.toContain("private-canary");
  }
};

const expectDeepFrozen = (value: unknown): void => {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
};

describe("tarot draw engine v1", () => {
  it("matches the committed three-card compatibility vector exactly", () => {
    const catalogBefore = JSON.stringify(catalogFixture);
    const requestBefore = JSON.stringify(drawFixture.request);
    const source = createEntropy(drawFixture.entropyBytes);

    const execution = resolveTarotDrawV1({
      catalog: catalogFixture,
      entropy: source.entropy,
      request: drawFixture.request,
    });

    expect(execution).toEqual(drawFixture.execution);
    expect(parseTarotDrawExecutionV1(JSON.parse(JSON.stringify(execution)))).toEqual(
      drawFixture.execution,
    );
    expect(source.state()).toEqual({ auditCalls: 1, reads: 5 });
    expect(JSON.stringify(catalogFixture)).toBe(catalogBefore);
    expect(JSON.stringify(drawFixture.request)).toBe(requestBefore);
    expectDeepFrozen(execution);
    expect(JSON.stringify(execution)).not.toContain("entropyBytes");
  });

  it("projects public facts without internal idempotency or entropy audit fields", () => {
    const facts = projectTarotDrawFactsV1(
      drawFixture.execution,
      exactExecutionVerifier(drawFixture.execution),
    );
    expect(facts).toEqual(drawFixture.execution.facts);
    expect(parseTarotDrawFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    const serialized = JSON.stringify(facts);
    expect(serialized).not.toMatch(/audit|commitment|digest|entropy|idempotency/iu);
    expectDeepFrozen(facts);
  });

  it("uses rejection sampling instead of modulo mapping for a non-power-of-two deck", () => {
    const source = createEntropy([255, 1]);
    const execution = resolveTarotDrawV1({
      catalog: catalogFixture,
      entropy: source.entropy,
      request: oneCardRequest(),
    });

    expect(execution.facts.positions).toEqual([
      { cardId: "mirror", order: 1, orientation: "upright", positionId: "perspective" },
    ]);
    expect(execution.audit.entropy).toEqual({
      bytesConsumed: 2,
      commitment,
      rejectedSamples: 1,
    });
  });

  it("maps every accepted first-card byte uniformly across the three-card fixture", () => {
    const counts = new Map<string, number>();
    for (let byte = 0; byte < 255; byte += 1) {
      const execution = resolveTarotDrawV1({
        catalog: catalogFixture,
        entropy: createEntropy([byte]).entropy,
        request: oneCardRequest(),
      });
      const cardId = execution.facts.positions[0]?.cardId;
      if (cardId === undefined) throw new Error("The draw result is unexpectedly empty.");
      counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ threshold: 85, mirror: 85, lantern: 85 });
  });

  it("maps every accepted byte uniformly for every supported deck bound", () => {
    for (let upperBound = 2; upperBound <= 200; upperBound += 1) {
      const acceptanceLimit = 256 - (256 % upperBound);
      const counts = Array.from({ length: upperBound }, () => 0);
      for (let byte = 0; byte < acceptanceLimit; byte += 1) {
        const index = sampleUnbiasedUint8IndexV1(
          upperBound,
          () => byte,
          () => expect.unreachable("An accepted byte must not be rejected."),
        );
        const count = counts[index];
        if (count === undefined) throw new Error("The sample escaped its declared bound.");
        counts[index] = count + 1;
      }
      expect(new Set(counts).size).toBe(1);
    }
  });

  it("accepts after 255 rejections and consumes no byte for a singleton bound", () => {
    let reads = 0;
    let rejections = 0;
    expect(
      sampleUnbiasedUint8IndexV1(
        3,
        () => {
          reads += 1;
          return reads <= 255 ? 255 : 0;
        },
        () => {
          rejections += 1;
        },
      ),
    ).toBe(0);
    expect({ reads, rejections }).toEqual({ reads: 256, rejections: 255 });
    expect(
      sampleUnbiasedUint8IndexV1(
        1,
        () => expect.unreachable("A singleton bound must not consume entropy."),
        () => expect.unreachable("A singleton bound cannot reject entropy."),
      ),
    ).toBe(0);
  });

  it("keeps orientation independent and exactly balanced over the byte domain", () => {
    const counts = { reversed: 0, upright: 0 };
    for (let orientationByte = 0; orientationByte < 256; orientationByte += 1) {
      const execution = resolveTarotDrawV1({
        catalog: catalogFixture,
        entropy: createEntropy([0, orientationByte]).entropy,
        request: oneCardRequest("upright_and_reversed"),
      });
      const orientation = execution.facts.positions[0]?.orientation;
      if (orientation === undefined) throw new Error("The draw result is unexpectedly empty.");
      counts[orientation] += 1;
    }
    expect(counts).toEqual({ reversed: 128, upright: 128 });
  });

  it("never duplicates cards and preserves exact spread order across fixed byte sequences", () => {
    for (let byte = 0; byte < 32; byte += 1) {
      const bytes = [byte, byte + 1, byte + 2, byte + 3, byte + 4].map((value) => value % 255);
      const execution = resolveTarotDrawV1({
        catalog: catalogFixture,
        entropy: createEntropy(bytes).entropy,
        request: drawFixture.request,
      });
      expect(new Set(execution.facts.positions.map(({ cardId }) => cardId)).size).toBe(3);
      expect(
        execution.facts.positions.map(({ order, positionId }) => ({ order, positionId })),
      ).toEqual([
        { order: 1, positionId: "situation" },
        { order: 2, positionId: "action" },
        { order: 3, positionId: "possibility" },
      ]);
    }
  });

  it("canonicalizes a structurally valid out-of-order spread for creation and replay", () => {
    const reorderedCatalog = structuredClone(catalogFixture) as {
      spreads: Array<{ positions: unknown[]; spreadId: string }>;
    };
    const spread = reorderedCatalog.spreads.find(
      ({ spreadId }) => spreadId === "situation-action-possibility",
    );
    if (spread === undefined) throw new Error("The three-card spread fixture is unavailable.");
    spread.positions.reverse();
    const execution = resolveTarotDrawV1({
      catalog: reorderedCatalog,
      entropy: createEntropy(drawFixture.entropyBytes).entropy,
      request: drawFixture.request,
    });
    expect(execution.facts.positions.map(({ positionId }) => positionId)).toEqual([
      "situation",
      "action",
      "possibility",
    ]);
    expect(
      resolveTarotDrawV1({
        catalog: reorderedCatalog,
        existingExecution: execution,
        existingExecutionVerifier: exactExecutionVerifier(execution),
        request: drawFixture.request,
      }),
    ).toEqual(execution);
  });

  it("replays the same request without touching entropy and rejects changed requests", () => {
    const replayEntropy: TarotCSPRNG = {
      auditCommitment: () => {
        throw new Error("private-canary audit must not run");
      },
      readBytes: () => {
        throw new Error("private-canary entropy must not run");
      },
    };
    const replay = resolveTarotDrawV1({
      catalog: catalogFixture,
      entropy: replayEntropy,
      existingExecution: drawFixture.execution,
      existingExecutionVerifier: exactExecutionVerifier(drawFixture.execution),
      request: drawFixture.request,
    });
    expect(replay).toEqual(drawFixture.execution);
    expectDeepFrozen(replay);

    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: replayEntropy,
          existingExecution: drawFixture.execution,
          existingExecutionVerifier: exactExecutionVerifier(drawFixture.execution),
          request: { ...drawFixture.request, requestDigest: alternateRequestDigest },
        }),
      "TAROT_DRAW_IDEMPOTENCY_CONFLICT",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: replayEntropy,
          existingExecution: drawFixture.execution,
          existingExecutionVerifier: exactExecutionVerifier(drawFixture.execution),
          request: { ...drawFixture.request, idempotencyKeyDigest: alternateKeyDigest },
        }),
      "TAROT_DRAW_IDEMPOTENCY_CONFLICT",
    );
  });

  it("requires authenticated execution verification before replay or public projection", () => {
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          existingExecution: drawFixture.execution,
          request: drawFixture.request,
        }),
      "TAROT_DRAW_EXECUTION_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          existingExecution: drawFixture.execution,
          existingExecutionVerifier: () => {
            throw new Error("private-canary");
          },
          request: drawFixture.request,
        }),
      "TAROT_DRAW_EXECUTION_INVALID",
    );
    expectDrawError(
      () =>
        projectTarotDrawFactsV1(
          drawFixture.execution,
          undefined as unknown as TarotExecutionVerifierV1,
        ),
      "TAROT_DRAW_EXECUTION_INVALID",
    );
  });

  it("rejects structurally valid fact, audit, and commitment rewrites", () => {
    const changedOrientation = structuredClone(drawFixture.execution) as {
      facts: { positions: Array<{ orientation: string }> };
    };
    const firstPosition = changedOrientation.facts.positions[0];
    if (firstPosition === undefined) throw new Error("The draw fixture is unexpectedly empty.");
    firstPosition.orientation = firstPosition.orientation === "upright" ? "reversed" : "upright";

    const swappedCards = structuredClone(drawFixture.execution) as {
      facts: { positions: Array<{ cardId: string }> };
    };
    const firstCard = swappedCards.facts.positions[0];
    const secondCard = swappedCards.facts.positions[1];
    if (firstCard === undefined || secondCard === undefined) {
      throw new Error("The draw fixture is unexpectedly incomplete.");
    }
    [firstCard.cardId, secondCard.cardId] = [secondCard.cardId, firstCard.cardId];

    const changedCommitment = structuredClone(drawFixture.execution) as {
      audit: { entropy: { commitment: string } };
    };
    changedCommitment.audit.entropy.commitment =
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const plausibleAudit = structuredClone(drawFixture.execution) as {
      audit: { entropy: { bytesConsumed: number; rejectedSamples: number } };
    };
    plausibleAudit.audit.entropy.bytesConsumed = 6;
    plausibleAudit.audit.entropy.rejectedSamples = 1;

    const verifier = exactExecutionVerifier(drawFixture.execution);
    for (const candidate of [changedOrientation, swappedCards, changedCommitment, plausibleAudit]) {
      expectDrawError(
        () =>
          resolveTarotDrawV1({
            catalog: catalogFixture,
            existingExecution: candidate,
            existingExecutionVerifier: verifier,
            request: drawFixture.request,
          }),
        "TAROT_DRAW_EXECUTION_INVALID",
      );
    }
  });

  it("creates a fresh draw for a different key when no prior state is supplied", () => {
    const source = createEntropy([0]);
    const request = {
      ...oneCardRequest(),
      idempotencyKeyDigest: alternateKeyDigest,
    };
    const execution = resolveTarotDrawV1({
      catalog: catalogFixture,
      entropy: source.entropy,
      request,
    });
    expect(execution.audit.idempotencyKeyDigest).toBe(alternateKeyDigest);
    expect(source.state()).toEqual({ auditCalls: 1, reads: 1 });
  });

  it("rejects client-selected facts, unknown versions, and malformed digests", () => {
    expectDrawError(
      () => parseTarotDrawRequestV1({ ...drawFixture.request, cardIds: ["lantern"] }),
      "TAROT_DRAW_REQUEST_INVALID",
    );
    expectDrawError(
      () => parseTarotDrawRequestV1({ ...drawFixture.request, seed: "private-canary" }),
      "TAROT_DRAW_REQUEST_INVALID",
    );
    for (const key of [
      "algorithmVersion",
      "entropy",
      "existingExecution",
      "orientation",
    ] as const) {
      expectDrawError(
        () => parseTarotDrawRequestV1({ ...drawFixture.request, [key]: "private-canary" }),
        "TAROT_DRAW_REQUEST_INVALID",
      );
    }
    expectDrawError(
      () => parseTarotDrawRequestV1({ ...drawFixture.request, schemaVersion: "tarot-draw.v2" }),
      "TAROT_DRAW_SCHEMA_UNSUPPORTED",
    );
    expectDrawError(
      () => parseTarotDrawRequestV1({ ...drawFixture.request, idempotencyKeyDigest: "bad" }),
      "TAROT_DRAW_REQUEST_INVALID",
    );
    expectDrawError(
      () => parseTarotDrawRequestV1({ ...drawFixture.request, rulesVersion: "rules.latest" }),
      "TAROT_DRAW_REQUEST_INVALID",
    );
  });

  it("snapshots accessor and Proxy fields once before validation", () => {
    let accessorReads = 0;
    const accessorRequest = { ...drawFixture.request } as Record<string, unknown>;
    Object.defineProperty(accessorRequest, "orientationPolicy", {
      enumerable: true,
      get: () => {
        accessorReads += 1;
        return accessorReads === 1 ? "upright_only" : "private-canary";
      },
    });
    expect(parseTarotDrawRequestV1(accessorRequest).orientationPolicy).toBe("upright_only");
    expect(accessorReads).toBe(1);

    let proxyReads = 0;
    const proxyRequest = new Proxy(
      { ...drawFixture.request },
      {
        get: (target, property, receiver) => {
          if (property === "orientationPolicy") {
            proxyReads += 1;
            return proxyReads === 1 ? "upright_only" : "private-canary";
          }
          return Reflect.get(target, property, receiver) as unknown;
        },
      },
    );
    expect(parseTarotDrawRequestV1(proxyRequest).orientationPolicy).toBe("upright_only");
    expect(proxyReads).toBe(1);

    const throwingRequest = { ...drawFixture.request } as Record<string, unknown>;
    Object.defineProperty(throwingRequest, "requestDigest", {
      enumerable: true,
      get: () => {
        throw new Error("private-canary");
      },
    });
    expectDrawError(() => parseTarotDrawRequestV1(throwingRequest), "TAROT_DRAW_REQUEST_INVALID");
  });

  it("snapshots the untrusted catalog graph before content validation", () => {
    let reads = 0;
    const accessorCatalog = structuredClone(catalogFixture) as {
      decks: Array<Record<string, unknown>>;
    };
    const deck = accessorCatalog.decks[0];
    if (deck === undefined) throw new Error("The catalog fixture is unexpectedly empty.");
    Object.defineProperty(deck, "artworkStatus", {
      enumerable: true,
      get: () => {
        reads += 1;
        return reads === 1 ? "none" : "private-canary";
      },
    });
    const execution = resolveTarotDrawV1({
      catalog: accessorCatalog,
      entropy: createEntropy([0]).entropy,
      request: oneCardRequest(),
    });
    expect(execution.facts.positions[0]?.cardId).toBe("threshold");
    expect(reads).toBe(1);

    const throwingCatalog = structuredClone(catalogFixture) as Record<string, unknown>;
    Object.defineProperty(throwingCatalog, "title", {
      enumerable: true,
      get: () => {
        throw new Error("private-canary");
      },
    });
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: throwingCatalog,
          entropy: createEntropy([0]).entropy,
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_REFERENCE_INVALID",
    );
  });

  it("rejects missing exact references and orientation rules unsupported by the deck", () => {
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: createEntropy([0]).entropy,
          request: {
            ...oneCardRequest(),
            deck: { id: "rituvia.placeholder-deck", version: "1.0.1" },
          },
        }),
      "TAROT_DRAW_REFERENCE_INVALID",
    );

    const uprightOnlyCatalog = structuredClone(catalogFixture) as {
      cardContents: Array<{ orientation: string }>;
      decks: Array<{ supportedOrientations: string[] }>;
    };
    const firstDeck = uprightOnlyCatalog.decks[0];
    if (firstDeck === undefined) throw new Error("The catalog fixture is unexpectedly empty.");
    firstDeck.supportedOrientations = ["upright"];
    uprightOnlyCatalog.cardContents = uprightOnlyCatalog.cardContents.filter(
      ({ orientation }) => orientation === "upright",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: uprightOnlyCatalog,
          entropy: createEntropy([0, 0]).entropy,
          request: oneCardRequest("upright_and_reversed"),
        }),
      "TAROT_DRAW_REFERENCE_INVALID",
    );
  });

  it("consumes no selection or orientation byte for an upright-only singleton deck", () => {
    const singletonCatalog = structuredClone(catalogFixture) as {
      cardContents: Array<{ cardId: string }>;
      decks: Array<{ cards: Array<{ cardId: string }> }>;
      spreads: Array<{ spreadId: string }>;
    };
    const deck = singletonCatalog.decks[0];
    if (deck === undefined) throw new Error("The catalog fixture is unexpectedly empty.");
    deck.cards = deck.cards.filter(({ cardId }) => cardId === "threshold");
    singletonCatalog.cardContents = singletonCatalog.cardContents.filter(
      ({ cardId }) => cardId === "threshold",
    );
    singletonCatalog.spreads = singletonCatalog.spreads.filter(
      ({ spreadId }) => spreadId === "one-card-perspective",
    );
    const source = createEntropy([]);
    const execution = resolveTarotDrawV1({
      catalog: singletonCatalog,
      entropy: source.entropy,
      request: oneCardRequest(),
    });
    expect(execution.facts.positions[0]).toMatchObject({
      cardId: "threshold",
      orientation: "upright",
    });
    expect(execution.audit.entropy).toEqual({
      bytesConsumed: 0,
      commitment,
      rejectedSamples: 0,
    });
    expect(source.state()).toEqual({ auditCalls: 1, reads: 0 });
  });

  it("fails closed for invalid, throwing, short, and endlessly rejected entropy", () => {
    expectDrawError(
      () => resolveTarotDrawV1({ catalog: catalogFixture, request: oneCardRequest() }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: {
            auditCommitment: () => commitment,
            readBytes: () => new Uint8Array(0),
          },
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: {
            auditCommitment: () => commitment,
            readBytes: () => new Uint8Array(2),
          },
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: {
            auditCommitment: () => commitment,
            readBytes: () => [] as unknown as Uint8Array,
          },
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: {
            auditCommitment: () => commitment,
            readBytes: () => {
              throw new Error("private-canary");
            },
          },
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: {
            auditCommitment: () => {
              throw new Error("private-canary");
            },
            readBytes: () => Uint8Array.of(0),
          },
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: createEntropy([0], "private-canary").entropy,
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_INVALID",
    );
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: {
            auditCommitment: () => commitment,
            readBytes: () => Uint8Array.of(255),
          },
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_ENTROPY_EXHAUSTED",
    );
  });

  it("rejects damaged persisted facts and keeps errors content-free", () => {
    const duplicate = structuredClone(drawFixture.execution) as {
      facts: { positions: Array<{ cardId: string }> };
    };
    const firstPosition = duplicate.facts.positions[0];
    const secondPosition = duplicate.facts.positions[1];
    if (firstPosition === undefined || secondPosition === undefined) {
      throw new Error("The draw fixture is unexpectedly incomplete.");
    }
    secondPosition.cardId = firstPosition.cardId;
    expectDrawError(() => parseTarotDrawExecutionV1(duplicate), "TAROT_DRAW_FACTS_INVALID");

    const foreignCard = structuredClone(drawFixture.execution) as {
      facts: { positions: Array<{ cardId: string }> };
    };
    const foreignPosition = foreignCard.facts.positions[0];
    if (foreignPosition === undefined) throw new Error("The draw fixture is unexpectedly empty.");
    foreignPosition.cardId = "private-canary";
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          existingExecution: foreignCard,
          existingExecutionVerifier: exactExecutionVerifier(drawFixture.execution),
          request: drawFixture.request,
        }),
      "TAROT_DRAW_EXECUTION_INVALID",
    );

    const unsupported = {
      ...drawFixture.execution.facts,
      engineVersion: "2.0.0",
    };
    expectDrawError(() => parseTarotDrawFactsV1(unsupported), "TAROT_DRAW_FACTS_INVALID");

    const impossibleAudit = structuredClone(drawFixture.execution) as {
      audit: { entropy: { bytesConsumed: number; rejectedSamples: number } };
    };
    impossibleAudit.audit.entropy.bytesConsumed = 6;
    impossibleAudit.audit.entropy.rejectedSamples = 0;
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          existingExecution: impossibleAudit,
          existingExecutionVerifier: () => true,
          request: drawFixture.request,
        }),
      "TAROT_DRAW_EXECUTION_INVALID",
    );
  });

  it("validates the resolver shell without leaking native getter or null errors", () => {
    expectDrawError(() => resolveTarotDrawV1(null), "TAROT_DRAW_REQUEST_INVALID");
    expectDrawError(
      () =>
        resolveTarotDrawV1({
          catalog: catalogFixture,
          entropy: createEntropy([0]).entropy,
          private: "private-canary",
          request: oneCardRequest(),
        }),
      "TAROT_DRAW_REQUEST_INVALID",
    );
    const accessor: Record<string, unknown> = {
      request: oneCardRequest(),
    };
    Object.defineProperty(accessor, "catalog", {
      enumerable: true,
      get: () => {
        throw new Error("private-canary");
      },
    });
    expectDrawError(() => resolveTarotDrawV1(accessor), "TAROT_DRAW_REQUEST_INVALID");
  });

  it("surfaces invalid catalog data only through the existing bounded catalog error", () => {
    try {
      resolveTarotDrawV1({
        catalog: { private: "private-canary" },
        entropy: createEntropy([0]).entropy,
        request: oneCardRequest(),
      });
      expect.unreachable("The invalid catalog must fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(TarotContentError);
      expect((error as Error).message).not.toContain("private-canary");
    }
  });

  it("pins the public engine, rules, and algorithm versions", () => {
    expect(tarotDrawEngineVersion).toBe("1.0.0");
    expect(tarotDrawRulesVersion).toBe("tarot-draw-rules.v1");
    expect(tarotDrawAlgorithmVersion).toBe("partial-fisher-yates-rejection-uint8.v1");
  });
});
