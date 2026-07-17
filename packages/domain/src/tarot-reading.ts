import { parseQuestionIntakeThemeCode, type QuestionIntakeThemeCode } from "./question-intake.js";

export const tarotReadingCreateSchemaVersion = "tarot-reading-create.v1" as const;
export const tarotReadingTypes = Object.freeze(["one_card", "three_card"] as const);
export type TarotReadingType = (typeof tarotReadingTypes)[number];

export const tarotReadingInputErrorCode = "TAROT_READING_INPUT_INVALID" as const;

export class TarotReadingInputError extends Error {
  public readonly code = tarotReadingInputErrorCode;

  public constructor() {
    super("The tarot reading request is invalid.");
    this.name = "TarotReadingInputError";
  }
}

export type TarotReadingCreateRequestV1 = Readonly<{
  locale: "en";
  readingType: TarotReadingType;
  schemaVersion: typeof tarotReadingCreateSchemaVersion;
  themeCode: QuestionIntakeThemeCode;
}>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const invalid = (): never => {
  throw new TarotReadingInputError();
};

export const parseTarotReadingCreateRequestV1 = (value: unknown): TarotReadingCreateRequestV1 => {
  try {
    const candidate = record(value);
    if (candidate === null) return invalid();
    const keys = Object.keys(candidate);
    if (
      keys.length !== 4 ||
      !Object.hasOwn(candidate, "locale") ||
      !Object.hasOwn(candidate, "readingType") ||
      !Object.hasOwn(candidate, "schemaVersion") ||
      !Object.hasOwn(candidate, "themeCode")
    ) {
      invalid();
    }
    const locale = candidate.locale;
    const readingType = candidate.readingType;
    const schemaVersion = candidate.schemaVersion;
    const themeCode = candidate.themeCode;
    if (
      locale !== "en" ||
      schemaVersion !== tarotReadingCreateSchemaVersion ||
      !tarotReadingTypes.includes(readingType as TarotReadingType)
    ) {
      invalid();
    }
    return Object.freeze({
      locale: "en",
      readingType: readingType as TarotReadingType,
      schemaVersion: tarotReadingCreateSchemaVersion,
      themeCode: parseQuestionIntakeThemeCode(themeCode),
    });
  } catch (error) {
    if (error instanceof TarotReadingInputError) throw error;
    return invalid();
  }
};
