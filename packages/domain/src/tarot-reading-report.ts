export const tarotReadingReportSchemaVersion = "tarot-reading-report.v1" as const;

export const tarotReadingReportCategories = Object.freeze([
  "factual",
  "cultural",
  "safety",
  "translation",
  "rights",
  "accessibility",
] as const);

export type TarotReadingReportCategory = (typeof tarotReadingReportCategories)[number];

export type TarotReadingReportTarget =
  Readonly<{ kind: "reading" }> | Readonly<{ kind: "position"; positionId: string }>;

export type TarotReadingReportRequestV1 = Readonly<{
  category: TarotReadingReportCategory;
  schemaVersion: typeof tarotReadingReportSchemaVersion;
  target: TarotReadingReportTarget;
}>;

export const tarotReadingReportInputErrorCode = "TAROT_READING_REPORT_INPUT_INVALID" as const;

export class TarotReadingReportInputError extends Error {
  public readonly code = tarotReadingReportInputErrorCode;

  public constructor() {
    super("The tarot reading report input is invalid.");
    this.name = "TarotReadingReportInputError";
  }
}

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...expected].sort().join("\u0000");

const fail = (): never => {
  throw new TarotReadingReportInputError();
};

const parseTarget = (value: unknown): TarotReadingReportTarget => {
  if (!isRecord(value) || typeof value.kind !== "string") return fail();
  if (value.kind === "reading") {
    if (!hasExactKeys(value, ["kind"])) return fail();
    return Object.freeze({ kind: "reading" });
  }
  if (value.kind === "position") {
    if (
      !hasExactKeys(value, ["kind", "positionId"]) ||
      typeof value.positionId !== "string" ||
      !identifierPattern.test(value.positionId) ||
      value.positionId.length > 100
    ) {
      return fail();
    }
    return Object.freeze({ kind: "position", positionId: value.positionId });
  }
  return fail();
};

export const parseTarotReadingReportRequestV1 = (value: unknown): TarotReadingReportRequestV1 => {
  try {
    if (!isRecord(value) || !hasExactKeys(value, ["category", "schemaVersion", "target"])) {
      return fail();
    }
    const category = value.category;
    if (
      value.schemaVersion !== tarotReadingReportSchemaVersion ||
      typeof category !== "string" ||
      !tarotReadingReportCategories.includes(category as TarotReadingReportCategory)
    ) {
      return fail();
    }
    return Object.freeze({
      category: category as TarotReadingReportCategory,
      schemaVersion: tarotReadingReportSchemaVersion,
      target: parseTarget(value.target),
    });
  } catch (error) {
    if (error instanceof TarotReadingReportInputError) throw error;
    return fail();
  }
};
