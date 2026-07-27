export const tarotReadingReportSchemaVersion = "tarot-reading-report.v1" as const;
export const tarotReadingReportSchemaVersionV2 = "tarot-reading-report.v2" as const;

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

export type TarotReadingInterpretationReportTarget = Readonly<{
  interpretationRequestId: string;
  kind: "interpretation";
}>;

export type TarotReadingReportRequestV2 = Readonly<{
  category: TarotReadingReportCategory;
  schemaVersion: typeof tarotReadingReportSchemaVersionV2;
  target: TarotReadingInterpretationReportTarget;
}>;

export type TarotReadingReportRequest = TarotReadingReportRequestV1 | TarotReadingReportRequestV2;

export const tarotReadingReportInputErrorCode = "TAROT_READING_REPORT_INPUT_INVALID" as const;

export class TarotReadingReportInputError extends Error {
  public readonly code = tarotReadingReportInputErrorCode;

  public constructor() {
    super("The tarot reading report input is invalid.");
    this.name = "TarotReadingReportInputError";
  }
}

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

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

const parseCategory = (value: unknown): TarotReadingReportCategory => {
  if (
    typeof value !== "string" ||
    !tarotReadingReportCategories.includes(value as TarotReadingReportCategory)
  ) {
    return fail();
  }
  return value as TarotReadingReportCategory;
};

export const parseTarotReadingReportRequestV1 = (value: unknown): TarotReadingReportRequestV1 => {
  try {
    if (!isRecord(value) || !hasExactKeys(value, ["category", "schemaVersion", "target"])) {
      return fail();
    }
    if (value.schemaVersion !== tarotReadingReportSchemaVersion) {
      return fail();
    }
    return Object.freeze({
      category: parseCategory(value.category),
      schemaVersion: tarotReadingReportSchemaVersion,
      target: parseTarget(value.target),
    });
  } catch (error) {
    if (error instanceof TarotReadingReportInputError) throw error;
    return fail();
  }
};

export const parseTarotReadingReportRequestV2 = (value: unknown): TarotReadingReportRequestV2 => {
  try {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["category", "schemaVersion", "target"]) ||
      value.schemaVersion !== tarotReadingReportSchemaVersionV2 ||
      !isRecord(value.target) ||
      !hasExactKeys(value.target, ["interpretationRequestId", "kind"]) ||
      value.target.kind !== "interpretation" ||
      typeof value.target.interpretationRequestId !== "string" ||
      !uuidV4Pattern.test(value.target.interpretationRequestId)
    ) {
      return fail();
    }
    return Object.freeze({
      category: parseCategory(value.category),
      schemaVersion: tarotReadingReportSchemaVersionV2,
      target: Object.freeze({
        interpretationRequestId: value.target.interpretationRequestId,
        kind: "interpretation",
      }),
    });
  } catch (error) {
    if (error instanceof TarotReadingReportInputError) throw error;
    return fail();
  }
};

export const parseTarotReadingReportRequest = (value: unknown): TarotReadingReportRequest => {
  try {
    if (!isRecord(value) || typeof value.schemaVersion !== "string") return fail();
    if (value.schemaVersion === tarotReadingReportSchemaVersion) {
      return parseTarotReadingReportRequestV1(value);
    }
    if (value.schemaVersion === tarotReadingReportSchemaVersionV2) {
      return parseTarotReadingReportRequestV2(value);
    }
    return fail();
  } catch (error) {
    if (error instanceof TarotReadingReportInputError) throw error;
    return fail();
  }
};
