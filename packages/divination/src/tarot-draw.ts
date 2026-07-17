import {
  parseTarotCatalogV1,
  tarotOrientations,
  type TarotCatalogV1,
  type TarotDeckV1,
  type TarotOrientation,
  type TarotSpreadV1,
} from "./tarot-content.js";

export const tarotDrawRequestSchemaVersion = "tarot-draw-request.v1" as const;
export const tarotDrawFactsSchemaVersion = "tarot-draw-facts.v1" as const;
export const tarotDrawExecutionSchemaVersion = "tarot-draw-execution.v1" as const;
export const tarotDrawEngineName = "rituvia.tarot-draw" as const;
export const tarotDrawEngineVersion = "1.0.0" as const;
export const tarotDrawAlgorithmVersion = "partial-fisher-yates-rejection-uint8.v1" as const;
export const tarotDrawRulesVersion = "tarot-draw-rules.v1" as const;
export const tarotDrawReplacementPolicy = "without_replacement" as const;

export const tarotOrientationPolicies = Object.freeze([
  "upright_only",
  "upright_and_reversed",
] as const);
export type TarotOrientationPolicy = (typeof tarotOrientationPolicies)[number];

export const tarotDrawErrorCodes = Object.freeze([
  "TAROT_DRAW_REQUEST_INVALID",
  "TAROT_DRAW_SCHEMA_UNSUPPORTED",
  "TAROT_DRAW_REFERENCE_INVALID",
  "TAROT_DRAW_FACTS_INVALID",
  "TAROT_DRAW_EXECUTION_INVALID",
  "TAROT_DRAW_ENTROPY_INVALID",
  "TAROT_DRAW_ENTROPY_EXHAUSTED",
  "TAROT_DRAW_IDEMPOTENCY_CONFLICT",
] as const);
export type TarotDrawErrorCode = (typeof tarotDrawErrorCodes)[number];

const tarotDrawErrorMessage = (code: TarotDrawErrorCode): string => {
  switch (code) {
    case "TAROT_DRAW_REQUEST_INVALID":
      return "The tarot draw request is invalid.";
    case "TAROT_DRAW_SCHEMA_UNSUPPORTED":
      return "The tarot draw schema version is unsupported.";
    case "TAROT_DRAW_REFERENCE_INVALID":
      return "The tarot draw references are invalid.";
    case "TAROT_DRAW_FACTS_INVALID":
      return "The tarot draw facts are invalid.";
    case "TAROT_DRAW_EXECUTION_INVALID":
      return "The internal tarot draw execution is invalid.";
    case "TAROT_DRAW_ENTROPY_INVALID":
      return "The tarot draw entropy source is invalid.";
    case "TAROT_DRAW_ENTROPY_EXHAUSTED":
      return "The tarot draw could not obtain an unbiased entropy sample.";
    case "TAROT_DRAW_IDEMPOTENCY_CONFLICT":
      return "The tarot draw idempotency contract conflicts with the request.";
  }
};

export class TarotDrawError extends Error {
  public readonly code: TarotDrawErrorCode;

  public constructor(code: TarotDrawErrorCode) {
    super(tarotDrawErrorMessage(code));
    this.name = "TarotDrawError";
    this.code = code;
  }
}

export type TarotDrawReferenceV1 = Readonly<{
  id: string;
  version: string;
}>;

/** Server-internal command. This is not an HTTP request DTO. */
export type TarotDrawRequestV1 = Readonly<{
  catalog: TarotDrawReferenceV1;
  deck: TarotDrawReferenceV1;
  idempotencyKeyDigest: string;
  method: "tarot";
  orientationPolicy: TarotOrientationPolicy;
  requestDigest: string;
  rulesVersion: typeof tarotDrawRulesVersion;
  schemaVersion: typeof tarotDrawRequestSchemaVersion;
  spread: TarotDrawReferenceV1;
}>;

export type TarotDrawPositionV1 = Readonly<{
  cardId: string;
  order: number;
  orientation: TarotOrientation;
  positionId: string;
}>;

export type TarotDrawFactsV1 = Readonly<{
  algorithmVersion: typeof tarotDrawAlgorithmVersion;
  catalog: TarotDrawReferenceV1;
  deck: TarotDrawReferenceV1;
  engineName: typeof tarotDrawEngineName;
  engineVersion: typeof tarotDrawEngineVersion;
  method: "tarot";
  orientationPolicy: TarotOrientationPolicy;
  positions: readonly TarotDrawPositionV1[];
  replacementPolicy: typeof tarotDrawReplacementPolicy;
  rulesVersion: typeof tarotDrawRulesVersion;
  schemaVersion: typeof tarotDrawFactsSchemaVersion;
  spread: TarotDrawReferenceV1;
}>;

/** Internal audit envelope. Use projectTarotDrawFactsV1 before API, AI, or analytics handoff. */
export type TarotDrawExecutionV1 = Readonly<{
  audit: Readonly<{
    entropy: Readonly<{
      bytesConsumed: number;
      commitment: string;
      rejectedSamples: number;
    }>;
    idempotencyKeyDigest: string;
    requestDigest: string;
  }>;
  facts: TarotDrawFactsV1;
  schemaVersion: typeof tarotDrawExecutionSchemaVersion;
}>;

/** RIT-024 must implement this with a server-only keyed integrity check. */
export type TarotExecutionVerifierV1 = (execution: TarotDrawExecutionV1) => boolean;

/**
 * Production implementations must return bytes from an operating-system-backed CSPRNG and a
 * SHA-256 commitment to their private audit nonce. Deterministic implementations are test/replay
 * fixtures only and must never be wired into a production composition root.
 */
export type TarotCSPRNG = Readonly<{
  auditCommitment: (facts: TarotDrawFactsV1) => string;
  readBytes: (length: number) => Uint8Array;
}>;

/** Server-internal idempotent transition input. Never expose it to a client or AI provider. */
export type ResolveTarotDrawInputV1 = Readonly<{
  catalog: unknown;
  entropy?: TarotCSPRNG;
  existingExecution?: unknown | null;
  existingExecutionVerifier?: TarotExecutionVerifierV1;
  request: unknown;
}>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  return actual === [...expected].sort().join("\u0000");
};

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;

const included = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.includes(value as Value);

function invalidRequest(): never {
  throw new TarotDrawError("TAROT_DRAW_REQUEST_INVALID");
}

function invalidReference(): never {
  throw new TarotDrawError("TAROT_DRAW_REFERENCE_INVALID");
}

function invalidFacts(): never {
  throw new TarotDrawError("TAROT_DRAW_FACTS_INVALID");
}

function invalidExecution(): never {
  throw new TarotDrawError("TAROT_DRAW_EXECUTION_INVALID");
}

function invalidEntropy(): never {
  throw new TarotDrawError("TAROT_DRAW_ENTROPY_INVALID");
}

const protectUnknownParse = <Value>(operation: () => Value, invalid: () => never): Value => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof TarotDrawError) throw error;
    invalid();
  }
};

const snapshotJsonInput = (value: unknown): unknown =>
  protectUnknownParse(() => {
    const active = new WeakSet<object>();
    let nodeCount = 0;
    const visit = (entry: unknown, depth: number): unknown => {
      nodeCount += 1;
      if (nodeCount > 2_000_000 || depth > 64) invalidReference();
      if (
        entry === null ||
        typeof entry === "string" ||
        typeof entry === "boolean" ||
        (typeof entry === "number" && Number.isFinite(entry))
      ) {
        return entry;
      }
      if (typeof entry !== "object") invalidReference();
      if (active.has(entry)) invalidReference();
      active.add(entry);
      if (Array.isArray(entry)) {
        const snapshot = Object.freeze(Array.from(entry, (child) => visit(child, depth + 1)));
        active.delete(entry);
        return snapshot;
      }
      const candidate = record(entry);
      if (candidate === null) invalidReference();
      const snapshot = Object.freeze(
        Object.fromEntries(
          Object.entries(candidate).map(([key, child]) => [key, visit(child, depth + 1)]),
        ),
      );
      active.delete(entry);
      return snapshot;
    };
    return visit(value, 0);
  }, invalidReference);

const parseReference = (value: unknown, invalid: () => never): TarotDrawReferenceV1 =>
  protectUnknownParse(() => {
    const candidate = record(value);
    if (candidate === null || !hasExactKeys(candidate, ["id", "version"])) invalid();
    const id = candidate.id;
    const version = candidate.version;
    if (
      typeof id !== "string" ||
      !identifierPattern.test(id) ||
      typeof version !== "string" ||
      !versionPattern.test(version)
    ) {
      invalid();
    }
    return Object.freeze({ id, version });
  }, invalid);

const parseDigest = (value: unknown, invalid: () => never): string => {
  if (typeof value !== "string" || !sha256DigestPattern.test(value)) invalid();
  return value;
};

export const parseTarotDrawRequestV1 = (value: unknown): TarotDrawRequestV1 =>
  protectUnknownParse(() => {
    const candidate = record(value);
    if (candidate === null) invalidRequest();
    if (
      !hasExactKeys(candidate, [
        "catalog",
        "deck",
        "idempotencyKeyDigest",
        "method",
        "orientationPolicy",
        "requestDigest",
        "rulesVersion",
        "schemaVersion",
        "spread",
      ])
    ) {
      invalidRequest();
    }
    const catalog = candidate.catalog;
    const deck = candidate.deck;
    const idempotencyKeyDigest = candidate.idempotencyKeyDigest;
    const method = candidate.method;
    const orientationPolicy = candidate.orientationPolicy;
    const requestDigest = candidate.requestDigest;
    const rulesVersion = candidate.rulesVersion;
    const schemaVersion = candidate.schemaVersion;
    const spread = candidate.spread;
    if (schemaVersion !== tarotDrawRequestSchemaVersion) {
      throw new TarotDrawError("TAROT_DRAW_SCHEMA_UNSUPPORTED");
    }
    if (
      method !== "tarot" ||
      rulesVersion !== tarotDrawRulesVersion ||
      !included(tarotOrientationPolicies, orientationPolicy)
    ) {
      invalidRequest();
    }
    return Object.freeze({
      catalog: parseReference(catalog, invalidRequest),
      deck: parseReference(deck, invalidRequest),
      idempotencyKeyDigest: parseDigest(idempotencyKeyDigest, invalidRequest),
      method: "tarot",
      orientationPolicy,
      requestDigest: parseDigest(requestDigest, invalidRequest),
      rulesVersion: tarotDrawRulesVersion,
      schemaVersion: tarotDrawRequestSchemaVersion,
      spread: parseReference(spread, invalidRequest),
    });
  }, invalidRequest);

const parseInteger = (
  value: unknown,
  minimum: number,
  maximum: number,
  invalid: () => never,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid();
  }
  return value as number;
};

const parseDrawPosition = (value: unknown): TarotDrawPositionV1 =>
  protectUnknownParse(() => {
    const candidate = record(value);
    if (
      candidate === null ||
      !hasExactKeys(candidate, ["cardId", "order", "orientation", "positionId"])
    ) {
      invalidFacts();
    }
    const cardId = candidate.cardId;
    const order = candidate.order;
    const orientation = candidate.orientation;
    const positionId = candidate.positionId;
    if (
      typeof cardId !== "string" ||
      !identifierPattern.test(cardId) ||
      typeof positionId !== "string" ||
      !identifierPattern.test(positionId) ||
      !included(tarotOrientations, orientation)
    ) {
      invalidFacts();
    }
    return Object.freeze({
      cardId,
      order: parseInteger(order, 1, 12, invalidFacts),
      orientation,
      positionId,
    });
  }, invalidFacts);

export const parseTarotDrawFactsV1 = (value: unknown): TarotDrawFactsV1 =>
  protectUnknownParse(() => {
    const candidate = record(value);
    if (candidate === null) invalidFacts();
    if (
      !hasExactKeys(candidate, [
        "algorithmVersion",
        "catalog",
        "deck",
        "engineName",
        "engineVersion",
        "method",
        "orientationPolicy",
        "positions",
        "replacementPolicy",
        "rulesVersion",
        "schemaVersion",
        "spread",
      ])
    ) {
      invalidFacts();
    }
    const algorithmVersion = candidate.algorithmVersion;
    const catalog = candidate.catalog;
    const deck = candidate.deck;
    const engineName = candidate.engineName;
    const engineVersion = candidate.engineVersion;
    const method = candidate.method;
    const orientationPolicy = candidate.orientationPolicy;
    const positionsInput = candidate.positions;
    const replacementPolicy = candidate.replacementPolicy;
    const rulesVersion = candidate.rulesVersion;
    const schemaVersion = candidate.schemaVersion;
    const spread = candidate.spread;
    if (schemaVersion !== tarotDrawFactsSchemaVersion) {
      throw new TarotDrawError("TAROT_DRAW_SCHEMA_UNSUPPORTED");
    }
    if (
      algorithmVersion !== tarotDrawAlgorithmVersion ||
      engineName !== tarotDrawEngineName ||
      engineVersion !== tarotDrawEngineVersion ||
      method !== "tarot" ||
      replacementPolicy !== tarotDrawReplacementPolicy ||
      rulesVersion !== tarotDrawRulesVersion ||
      !included(tarotOrientationPolicies, orientationPolicy) ||
      !Array.isArray(positionsInput)
    ) {
      invalidFacts();
    }
    const positionValues = Array.from(positionsInput);
    if (positionValues.length < 1 || positionValues.length > 12) invalidFacts();
    const positions = Object.freeze(positionValues.map(parseDrawPosition));
    if (
      positions.some(({ order }, index) => order !== index + 1) ||
      new Set(positions.map(({ cardId }) => cardId)).size !== positions.length ||
      new Set(positions.map(({ positionId }) => positionId)).size !== positions.length
    ) {
      invalidFacts();
    }

    return Object.freeze({
      algorithmVersion: tarotDrawAlgorithmVersion,
      catalog: parseReference(catalog, invalidFacts),
      deck: parseReference(deck, invalidFacts),
      engineName: tarotDrawEngineName,
      engineVersion: tarotDrawEngineVersion,
      method: "tarot",
      orientationPolicy,
      positions,
      replacementPolicy: tarotDrawReplacementPolicy,
      rulesVersion: tarotDrawRulesVersion,
      schemaVersion: tarotDrawFactsSchemaVersion,
      spread: parseReference(spread, invalidFacts),
    });
  }, invalidFacts);

export const parseTarotDrawExecutionV1 = (value: unknown): TarotDrawExecutionV1 =>
  protectUnknownParse(() => {
    const candidate = record(value);
    if (candidate === null || !hasExactKeys(candidate, ["audit", "facts", "schemaVersion"])) {
      invalidExecution();
    }
    const auditInput = candidate.audit;
    const factsInput = candidate.facts;
    const schemaVersion = candidate.schemaVersion;
    if (schemaVersion !== tarotDrawExecutionSchemaVersion) {
      throw new TarotDrawError("TAROT_DRAW_SCHEMA_UNSUPPORTED");
    }
    const audit = record(auditInput);
    if (
      audit === null ||
      !hasExactKeys(audit, ["entropy", "idempotencyKeyDigest", "requestDigest"])
    ) {
      invalidExecution();
    }
    const entropyInput = audit.entropy;
    const idempotencyKeyDigest = audit.idempotencyKeyDigest;
    const requestDigest = audit.requestDigest;
    const entropy = record(entropyInput);
    if (
      entropy === null ||
      !hasExactKeys(entropy, ["bytesConsumed", "commitment", "rejectedSamples"])
    ) {
      invalidExecution();
    }
    const bytesConsumedInput = entropy.bytesConsumed;
    const commitment = entropy.commitment;
    const rejectedSamplesInput = entropy.rejectedSamples;
    const bytesConsumed = parseInteger(bytesConsumedInput, 0, 1_000_000, invalidExecution);
    const rejectedSamples = parseInteger(rejectedSamplesInput, 0, 1_000_000, invalidExecution);
    if (rejectedSamples > bytesConsumed) invalidExecution();
    return Object.freeze({
      audit: Object.freeze({
        entropy: Object.freeze({
          bytesConsumed,
          commitment: parseDigest(commitment, invalidExecution),
          rejectedSamples,
        }),
        idempotencyKeyDigest: parseDigest(idempotencyKeyDigest, invalidExecution),
        requestDigest: parseDigest(requestDigest, invalidExecution),
      }),
      facts: parseTarotDrawFactsV1(factsInput),
      schemaVersion: tarotDrawExecutionSchemaVersion,
    });
  }, invalidExecution);

const assertExecutionVerified = (execution: TarotDrawExecutionV1, verifier: unknown): void => {
  if (typeof verifier !== "function") invalidExecution();
  let verified: unknown;
  try {
    verified = (verifier as TarotExecutionVerifierV1)(execution);
  } catch {
    invalidExecution();
  }
  if (verified !== true) invalidExecution();
};

export const projectTarotDrawFactsV1 = (
  value: unknown,
  verifier: TarotExecutionVerifierV1,
): TarotDrawFactsV1 => {
  const execution = parseTarotDrawExecutionV1(value);
  assertExecutionVerified(execution, verifier);
  return execution.facts;
};

const referenceMatches = (reference: TarotDrawReferenceV1, id: string, version: string): boolean =>
  reference.id === id && reference.version === version;

const resolveReferences = (
  catalog: TarotCatalogV1,
  request: TarotDrawRequestV1,
): Readonly<{ deck: TarotDeckV1; spread: TarotSpreadV1 }> => {
  if (!referenceMatches(request.catalog, catalog.catalogId, catalog.version)) invalidReference();
  const deck = catalog.decks.find(({ deckId, version }) =>
    referenceMatches(request.deck, deckId, version),
  );
  const spread = catalog.spreads.find(({ spreadId, version }) =>
    referenceMatches(request.spread, spreadId, version),
  );
  if (
    deck === undefined ||
    spread === undefined ||
    !spread.compatibleDecks.some(({ id, version }) =>
      referenceMatches(request.deck, id, version),
    ) ||
    spread.positions.length > deck.cards.length ||
    !deck.supportedOrientations.includes("upright") ||
    (request.orientationPolicy === "upright_and_reversed" &&
      !deck.supportedOrientations.includes("reversed"))
  ) {
    invalidReference();
  }
  return Object.freeze({ deck, spread });
};

const executionMatchesRequest = (
  execution: TarotDrawExecutionV1,
  request: TarotDrawRequestV1,
): boolean =>
  referenceMatches(execution.facts.catalog, request.catalog.id, request.catalog.version) &&
  referenceMatches(execution.facts.deck, request.deck.id, request.deck.version) &&
  referenceMatches(execution.facts.spread, request.spread.id, request.spread.version) &&
  execution.audit.idempotencyKeyDigest === request.idempotencyKeyDigest &&
  execution.audit.requestDigest === request.requestDigest &&
  execution.facts.orientationPolicy === request.orientationPolicy;

const assertExecutionMatchesCatalog = (
  execution: TarotDrawExecutionV1,
  deck: TarotDeckV1,
  spread: TarotSpreadV1,
): void => {
  const orderedSpreadPositions = [...spread.positions].sort(
    (left, right) => left.order - right.order,
  );
  const facts = execution.facts;
  if (
    facts.positions.length !== orderedSpreadPositions.length ||
    facts.positions.some((draw, index) => {
      const position = orderedSpreadPositions.at(index);
      return (
        position === undefined ||
        draw.order !== position.order ||
        draw.positionId !== position.positionId ||
        !deck.cards.some(({ cardId }) => cardId === draw.cardId) ||
        !deck.supportedOrientations.includes(draw.orientation) ||
        (facts.orientationPolicy === "upright_only" && draw.orientation !== "upright")
      );
    })
  ) {
    invalidFacts();
  }

  const drawCount = facts.positions.length;
  const acceptedSelectionSamples = Math.min(drawCount, deck.cards.length - 1);
  const acceptedOrientationSamples =
    facts.orientationPolicy === "upright_and_reversed" ? drawCount : 0;
  const acceptedSamples = acceptedSelectionSamples + acceptedOrientationSamples;
  let rejectionEligibleSamples = 0;
  for (let index = 0; index < drawCount; index += 1) {
    const upperBound = deck.cards.length - index;
    if (upperBound > 1 && 256 % upperBound !== 0) rejectionEligibleSamples += 1;
  }
  const entropy = execution.audit.entropy;
  if (
    entropy.bytesConsumed !== acceptedSamples + entropy.rejectedSamples ||
    entropy.rejectedSamples > rejectionEligibleSamples * 255
  ) {
    invalidExecution();
  }
};

// Internal algorithm primitive. It is intentionally absent from the package root export.
export const sampleUnbiasedUint8IndexV1 = (
  upperBound: number,
  readByte: () => number,
  onRejected: () => void,
): number => {
  if (!Number.isSafeInteger(upperBound) || upperBound < 1 || upperBound > 256) {
    invalidEntropy();
  }
  if (upperBound === 1) return 0;
  const acceptanceLimit = 256 - (256 % upperBound);
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const byte = readByte();
    if (!Number.isSafeInteger(byte) || byte < 0 || byte > 255) invalidEntropy();
    if (byte < acceptanceLimit) return byte % upperBound;
    onRejected();
  }
  throw new TarotDrawError("TAROT_DRAW_ENTROPY_EXHAUSTED");
};

const createSampler = (entropy: TarotCSPRNG) => {
  if (
    typeof entropy !== "object" ||
    entropy === null ||
    typeof entropy.readBytes !== "function" ||
    typeof entropy.auditCommitment !== "function"
  ) {
    invalidEntropy();
  }
  let bytesConsumed = 0;
  let rejectedSamples = 0;

  const readByte = (): number => {
    let bytes: Uint8Array;
    try {
      bytes = entropy.readBytes(1);
    } catch {
      invalidEntropy();
    }
    if (!(bytes instanceof Uint8Array) || bytes.length !== 1) invalidEntropy();
    bytesConsumed += 1;
    const byte = bytes[0];
    if (byte === undefined) invalidEntropy();
    return byte;
  };

  const sample = (upperBound: number): number =>
    sampleUnbiasedUint8IndexV1(upperBound, readByte, () => {
      rejectedSamples += 1;
    });

  const audit = (facts: TarotDrawFactsV1): TarotDrawExecutionV1["audit"]["entropy"] => {
    let commitment: unknown;
    try {
      commitment = entropy.auditCommitment(facts);
    } catch {
      invalidEntropy();
    }
    return Object.freeze({
      bytesConsumed,
      commitment: parseDigest(commitment, invalidEntropy),
      rejectedSamples,
    });
  };

  return Object.freeze({ audit, sample });
};

const parseResolveInput = (value: unknown): ResolveTarotDrawInputV1 => {
  try {
    const candidate = record(value);
    if (candidate === null) invalidRequest();
    const keys = Object.keys(candidate);
    const allowedKeys = new Set([
      "catalog",
      "entropy",
      "existingExecution",
      "existingExecutionVerifier",
      "request",
    ]);
    if (
      !keys.includes("catalog") ||
      !keys.includes("request") ||
      keys.some((key) => !allowedKeys.has(key))
    ) {
      invalidRequest();
    }
    return Object.freeze({
      catalog: candidate.catalog,
      ...(keys.includes("entropy") ? { entropy: candidate.entropy as TarotCSPRNG } : {}),
      ...(keys.includes("existingExecution")
        ? { existingExecution: candidate.existingExecution }
        : {}),
      ...(keys.includes("existingExecutionVerifier")
        ? {
            existingExecutionVerifier:
              candidate.existingExecutionVerifier as TarotExecutionVerifierV1,
          }
        : {}),
      request: candidate.request,
    });
  } catch (error) {
    if (error instanceof TarotDrawError) throw error;
    invalidRequest();
  }
};

export const resolveTarotDrawV1 = (value: unknown): TarotDrawExecutionV1 => {
  const input = parseResolveInput(value);
  const catalog = parseTarotCatalogV1(snapshotJsonInput(input.catalog));
  const request = parseTarotDrawRequestV1(input.request);
  const { deck, spread } = resolveReferences(catalog, request);

  if (input.existingExecution !== undefined && input.existingExecution !== null) {
    const existing = parseTarotDrawExecutionV1(input.existingExecution);
    assertExecutionVerified(existing, input.existingExecutionVerifier);
    if (!executionMatchesRequest(existing, request)) {
      throw new TarotDrawError("TAROT_DRAW_IDEMPOTENCY_CONFLICT");
    }
    assertExecutionMatchesCatalog(existing, deck, spread);
    return existing;
  }
  if (input.entropy === undefined) invalidEntropy();

  const sampler = createSampler(input.entropy);
  const shuffledCards = [...deck.cards].sort((left, right) => left.order - right.order);
  const orderedPositions = [...spread.positions].sort((left, right) => left.order - right.order);
  const positions = Object.freeze(
    orderedPositions.map((position, positionIndex) => {
      const selectedIndex = positionIndex + sampler.sample(shuffledCards.length - positionIndex);
      const currentCard = shuffledCards.at(positionIndex);
      const selectedCard = shuffledCards.at(selectedIndex);
      if (currentCard === undefined || selectedCard === undefined) invalidReference();
      shuffledCards.splice(selectedIndex, 1, currentCard);
      shuffledCards.splice(positionIndex, 1, selectedCard);
      const orientation: TarotOrientation =
        request.orientationPolicy === "upright_only" || sampler.sample(2) === 0
          ? "upright"
          : "reversed";
      return Object.freeze({
        cardId: selectedCard.cardId,
        order: position.order,
        orientation,
        positionId: position.positionId,
      });
    }),
  );

  const facts: TarotDrawFactsV1 = Object.freeze({
    algorithmVersion: tarotDrawAlgorithmVersion,
    catalog: request.catalog,
    deck: request.deck,
    engineName: tarotDrawEngineName,
    engineVersion: tarotDrawEngineVersion,
    method: "tarot",
    orientationPolicy: request.orientationPolicy,
    positions,
    replacementPolicy: tarotDrawReplacementPolicy,
    rulesVersion: tarotDrawRulesVersion,
    schemaVersion: tarotDrawFactsSchemaVersion,
    spread: request.spread,
  });
  return Object.freeze({
    audit: Object.freeze({
      entropy: sampler.audit(facts),
      idempotencyKeyDigest: request.idempotencyKeyDigest,
      requestDigest: request.requestDigest,
    }),
    facts,
    schemaVersion: tarotDrawExecutionSchemaVersion,
  });
};
