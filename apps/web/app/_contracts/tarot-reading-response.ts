import { parseQuestionIntakeThemeCode, type QuestionIntakeThemeCode } from "@rituvia/domain";

export const tarotReadingResponseSchemaVersion = "tarot-reading-response.v2" as const;
export const tarotReadingPresentationSchemaVersion = "tarot-reading-presentation.v1" as const;

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const hiddenCharacters =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;

export type TarotReadingPresentationCardV1 = Readonly<{
  cannotDetermine: string;
  cardId: string;
  cardTitle: string;
  constructivePossibility: string;
  coreThemes: readonly string[];
  invitation: string;
  order: number;
  orientation: "reversed" | "upright";
  positionId: string;
  positionTitle: string;
  reflectionQuestion: string;
  smallAction: string;
  tension: string;
}>;

export type TarotReadingPresentationV1 = Readonly<{
  cards: readonly TarotReadingPresentationCardV1[];
  schemaVersion: typeof tarotReadingPresentationSchemaVersion;
}>;

export type TarotReadingDrawFactsV1 = Readonly<{
  algorithmVersion: "partial-fisher-yates-rejection-uint8.v1";
  catalog: Readonly<{ id: string; version: string }>;
  deck: Readonly<{ id: string; version: string }>;
  engineName: "rituvia.tarot-draw";
  engineVersion: "1.0.0";
  method: "tarot";
  orientationPolicy: "upright_and_reversed" | "upright_only";
  positions: readonly Readonly<{
    cardId: string;
    order: number;
    orientation: "reversed" | "upright";
    positionId: string;
  }>[];
  replacementPolicy: "without_replacement";
  rulesVersion: "tarot-draw-rules.v1";
  schemaVersion: "tarot-draw-facts.v1";
  spread: Readonly<{ id: string; version: string }>;
}>;

export type TarotReadingPublicResponseV2 = Readonly<{
  createdAt: string;
  facts: TarotReadingDrawFactsV1;
  locale: "en";
  presentation: TarotReadingPresentationV1;
  readingId: string;
  readingPolicyVersion: string;
  readingType: "one_card" | "three_card";
  schemaVersion: typeof tarotReadingResponseSchemaVersion;
  status: "facts_ready";
  themeCode: QuestionIntakeThemeCode;
}>;

export class TarotReadingResponseError extends Error {
  public constructor() {
    super("The tarot reading response is invalid.");
    this.name = "TarotReadingResponseError";
  }
}

const invalid = (): never => {
  throw new TarotReadingResponseError();
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...keys].sort().join("\u0000");

const parseText = (value: unknown, maximumLength: number): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    value.normalize("NFC") !== value ||
    hiddenCharacters.test(value)
  ) {
    return invalid();
  }
  return value;
};

const parseIdentifier = (value: unknown): string => {
  const parsed = parseText(value, 100);
  return identifierPattern.test(parsed) ? parsed : invalid();
};

export const isTarotReadingId = (value: unknown): value is string =>
  typeof value === "string" && uuidV4Pattern.test(value);

const parseReference = (value: unknown): Readonly<{ id: string; version: string }> => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["id", "version"])) return invalid();
  const id = parseIdentifier(candidate.id);
  const version = parseText(candidate.version, 50);
  if (!versionPattern.test(version)) return invalid();
  return Object.freeze({ id, version });
};

const parseFacts = (value: unknown): TarotReadingDrawFactsV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
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
    ]) ||
    candidate.algorithmVersion !== "partial-fisher-yates-rejection-uint8.v1" ||
    candidate.engineName !== "rituvia.tarot-draw" ||
    candidate.engineVersion !== "1.0.0" ||
    candidate.method !== "tarot" ||
    (candidate.orientationPolicy !== "upright_and_reversed" &&
      candidate.orientationPolicy !== "upright_only") ||
    candidate.replacementPolicy !== "without_replacement" ||
    candidate.rulesVersion !== "tarot-draw-rules.v1" ||
    candidate.schemaVersion !== "tarot-draw-facts.v1" ||
    !Array.isArray(candidate.positions) ||
    candidate.positions.length < 1 ||
    candidate.positions.length > 12
  ) {
    return invalid();
  }
  const positions = candidate.positions.map((value, index) => {
    const position = record(value);
    if (
      position === null ||
      !hasExactKeys(position, ["cardId", "order", "orientation", "positionId"]) ||
      position.order !== index + 1 ||
      (position.orientation !== "upright" && position.orientation !== "reversed")
    ) {
      return invalid();
    }
    return Object.freeze({
      cardId: parseIdentifier(position.cardId),
      order: position.order,
      orientation: position.orientation,
      positionId: parseIdentifier(position.positionId),
    });
  });
  if (
    new Set(positions.map(({ cardId }) => cardId)).size !== positions.length ||
    new Set(positions.map(({ positionId }) => positionId)).size !== positions.length
  ) {
    return invalid();
  }
  return Object.freeze({
    algorithmVersion: "partial-fisher-yates-rejection-uint8.v1",
    catalog: parseReference(candidate.catalog),
    deck: parseReference(candidate.deck),
    engineName: "rituvia.tarot-draw",
    engineVersion: "1.0.0",
    method: "tarot",
    orientationPolicy: candidate.orientationPolicy,
    positions: Object.freeze(positions),
    replacementPolicy: "without_replacement",
    rulesVersion: "tarot-draw-rules.v1",
    schemaVersion: "tarot-draw-facts.v1",
    spread: parseReference(candidate.spread),
  });
};

const parseTextList = (
  value: unknown,
  maximumItems: number,
  maximumLength: number,
): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumItems) return invalid();
  const parsed = value.map((entry) => parseText(entry, maximumLength));
  if (new Set(parsed).size !== parsed.length) return invalid();
  return Object.freeze(parsed);
};

const parseCard = (value: unknown): TarotReadingPresentationCardV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "cannotDetermine",
      "cardId",
      "cardTitle",
      "constructivePossibility",
      "coreThemes",
      "invitation",
      "order",
      "orientation",
      "positionId",
      "positionTitle",
      "reflectionQuestion",
      "smallAction",
      "tension",
    ]) ||
    !Number.isSafeInteger(candidate.order) ||
    (candidate.order as number) < 1 ||
    (candidate.order as number) > 12 ||
    (candidate.orientation !== "upright" && candidate.orientation !== "reversed")
  ) {
    return invalid();
  }
  return Object.freeze({
    cannotDetermine: parseText(candidate.cannotDetermine, 600),
    cardId: parseIdentifier(candidate.cardId),
    cardTitle: parseText(candidate.cardTitle, 160),
    constructivePossibility: parseText(candidate.constructivePossibility, 600),
    coreThemes: parseTextList(candidate.coreThemes, 12, 100),
    invitation: parseText(candidate.invitation, 1_200),
    order: candidate.order as number,
    orientation: candidate.orientation,
    positionId: parseIdentifier(candidate.positionId),
    positionTitle: parseText(candidate.positionTitle, 160),
    reflectionQuestion: parseText(candidate.reflectionQuestion, 600),
    smallAction: parseText(candidate.smallAction, 600),
    tension: parseText(candidate.tension, 600),
  });
};

const parsePresentation = (value: unknown): TarotReadingPresentationV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["cards", "schemaVersion"]) ||
    candidate.schemaVersion !== tarotReadingPresentationSchemaVersion ||
    !Array.isArray(candidate.cards) ||
    candidate.cards.length < 1 ||
    candidate.cards.length > 3
  ) {
    return invalid();
  }
  return Object.freeze({
    cards: Object.freeze(candidate.cards.map(parseCard)),
    schemaVersion: tarotReadingPresentationSchemaVersion,
  });
};

const parseInstant = (value: unknown): string => {
  if (typeof value !== "string" || !instantPattern.test(value)) return invalid();
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? value : invalid();
};

const expectedReadingShape = Object.freeze({
  one_card: Object.freeze({
    positionIds: Object.freeze(["perspective"]),
    positionTitles: Object.freeze(["Perspective"]),
    spreadId: "one-card-perspective",
  }),
  three_card: Object.freeze({
    positionIds: Object.freeze(["situation", "action", "possibility"]),
    positionTitles: Object.freeze(["Situation", "Action", "Possibility"]),
    spreadId: "situation-action-possibility",
  }),
} as const);

export const parseTarotReadingResponse = (
  value: unknown,
  expectedReadingType: "one_card" | "three_card",
): TarotReadingPublicResponseV2 => {
  try {
    const candidate = record(value);
    const expected =
      expectedReadingType === "one_card"
        ? expectedReadingShape.one_card
        : expectedReadingShape.three_card;
    if (
      candidate === null ||
      !hasExactKeys(candidate, [
        "createdAt",
        "facts",
        "locale",
        "presentation",
        "readingId",
        "readingPolicyVersion",
        "readingType",
        "schemaVersion",
        "status",
        "themeCode",
      ]) ||
      candidate.schemaVersion !== tarotReadingResponseSchemaVersion ||
      candidate.locale !== "en" ||
      candidate.readingType !== expectedReadingType ||
      candidate.status !== "facts_ready" ||
      !isTarotReadingId(candidate.readingId) ||
      typeof candidate.readingPolicyVersion !== "string" ||
      candidate.readingPolicyVersion.length > 100 ||
      !identifierPattern.test(candidate.readingPolicyVersion)
    ) {
      return invalid();
    }
    const themeCode = parseQuestionIntakeThemeCode(candidate.themeCode);
    const facts = parseFacts(candidate.facts);
    const presentation = parsePresentation(candidate.presentation);
    if (
      facts.spread.id !== expected.spreadId ||
      facts.positions.length !== expected.positionIds.length ||
      presentation.cards.length !== expected.positionIds.length ||
      facts.positions.some((fact, index) => {
        const card = presentation.cards.at(index);
        const expectedPositionId = expected.positionIds.at(index);
        const expectedPositionTitle = expected.positionTitles.at(index);
        return (
          card === undefined ||
          expectedPositionId === undefined ||
          expectedPositionTitle === undefined ||
          fact.order !== index + 1 ||
          fact.positionId !== expectedPositionId ||
          card.order !== fact.order ||
          card.cardId !== fact.cardId ||
          card.orientation !== fact.orientation ||
          card.positionId !== fact.positionId ||
          card.positionTitle !== expectedPositionTitle
        );
      })
    ) {
      return invalid();
    }
    return Object.freeze({
      createdAt: parseInstant(candidate.createdAt),
      facts,
      locale: "en",
      presentation,
      readingId: candidate.readingId,
      readingPolicyVersion: candidate.readingPolicyVersion,
      readingType: expectedReadingType,
      schemaVersion: tarotReadingResponseSchemaVersion,
      status: "facts_ready",
      themeCode,
    });
  } catch (error) {
    if (error instanceof TarotReadingResponseError) throw error;
    return invalid();
  }
};

export const parseTarotOneCardResponse = (value: unknown): TarotReadingPublicResponseV2 =>
  parseTarotReadingResponse(value, "one_card");

export const parseTarotThreeCardResponse = (value: unknown): TarotReadingPublicResponseV2 =>
  parseTarotReadingResponse(value, "three_card");
