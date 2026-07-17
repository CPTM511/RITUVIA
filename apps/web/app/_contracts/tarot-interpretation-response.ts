export const tarotInterpretationResponseSchemaVersion = "tarot-interpretation-response.v1" as const;
export const tarotInterpretationMaximumResponseBytes = 128 * 1024;

const responseTextLimits = Object.freeze({
  boundaryNoteMaximum: 800,
  labelMaximum: 240,
  meaningMaximum: 800,
  perspectivesMaximum: 6,
  perspectiveTextMaximum: 800,
  questionsMaximum: 4,
  rationaleMaximum: 600,
  reflectionQuestionMaximum: 500,
  ritualReasonMaximum: 600,
  summaryMaximum: 1_200,
  symbolsMaximum: 12,
  titleMaximum: 120,
} as const);

const pollAfterMinimumMs = 250;
const pollAfterMaximumMs = 30_000;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const forbiddenCodePointPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u;
const markdownLinkPattern = /(?:!?\[.*\]\s*(?:\([^)]*\)|\[[^\]]*\])|^\[[^\]]+\]:\s*\S)/u;
const explicitUrlPattern =
  /(?:\b[a-z][a-z0-9+.-]{1,31}:\/\/|\bwww\.|\b(?:data|javascript|mailto|tel):\S|(?:^|[\s([])\/\/[a-z0-9])/iu;
const domainUrlPattern =
  /(?:^|[\s([])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})(?=$|[/:?#\s)\]])/iu;

export type TarotInterpretationOutputProjectionV1 = Readonly<{
  boundaryNote: string;
  perspectives: readonly string[];
  reflectionQuestions: readonly string[];
  ritualSuggestion?: Readonly<{ reason: string }>;
  smallAction: Readonly<{
    label: string;
    rationale: string;
    timeHorizon: "open" | "this_week" | "today";
  }>;
  summary: string;
  symbols: readonly Readonly<{
    limitation?: string;
    meaning: string;
    possibility: string;
  }>[];
  title: string;
}>;

type TarotInterpretationProcessingResponseV1 = Readonly<{
  displayable: false;
  pollAfterMs: number;
  readingId: string;
  schemaVersion: typeof tarotInterpretationResponseSchemaVersion;
  status: "processing";
}>;

type TarotInterpretationFailedResponseV1 = Readonly<{
  displayable: false;
  readingId: string;
  schemaVersion: typeof tarotInterpretationResponseSchemaVersion;
  status: "failed";
}>;

type TarotInterpretationVerifiedResponseV1 = Readonly<{
  displayable: true;
  output: TarotInterpretationOutputProjectionV1;
  readingId: string;
  schemaVersion: typeof tarotInterpretationResponseSchemaVersion;
  status: "verified";
}>;

type TarotInterpretationReviewedFallbackResponseV1 = Readonly<{
  displayable: true;
  output: TarotInterpretationOutputProjectionV1;
  readingId: string;
  schemaVersion: typeof tarotInterpretationResponseSchemaVersion;
  status: "reviewed_fallback";
}>;

export type TarotInterpretationResponseV1 =
  | TarotInterpretationProcessingResponseV1
  | TarotInterpretationFailedResponseV1
  | TarotInterpretationVerifiedResponseV1
  | TarotInterpretationReviewedFallbackResponseV1;

const invalid = (): never => {
  throw new TypeError("The tarot interpretation response is invalid.");
};

const record = (value: unknown): Record<string, unknown> => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    return invalid();
  }
  return value as Record<string, unknown>;
};

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  if (keys.length !== expected.length) return false;
  const actual = new Set(keys);
  return expected.every((key) => actual.has(key));
};

const exactRecord = (value: unknown, expected: readonly string[]): Record<string, unknown> => {
  const candidate = record(value);
  return hasExactKeys(candidate, expected) ? candidate : invalid();
};

const snapshotArray = (
  value: unknown,
  minimumItems: number,
  maximumItems: number,
): readonly unknown[] => {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) {
    return invalid();
  }
  return Object.freeze([...value]);
};

const parseText = (value: unknown, maximumLength: number): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    !value.isWellFormed() ||
    forbiddenCodePointPattern.test(value) ||
    markdownLinkPattern.test(value) ||
    explicitUrlPattern.test(value) ||
    domainUrlPattern.test(value)
  ) {
    return invalid();
  }
  return value;
};

const parseTextArray = (
  value: unknown,
  maximumItems: number,
  maximumTextLength: number,
): readonly string[] => {
  const parsed = snapshotArray(value, 1, maximumItems).map((entry) =>
    parseText(entry, maximumTextLength),
  );
  if (new Set(parsed).size !== parsed.length) return invalid();
  return Object.freeze(parsed);
};

const parseSymbols = (value: unknown): TarotInterpretationOutputProjectionV1["symbols"] =>
  Object.freeze(
    snapshotArray(value, 1, responseTextLimits.symbolsMaximum).map((entry) => {
      const initial = record(entry);
      const hasLimitation = Object.hasOwn(initial, "limitation");
      if (
        !hasExactKeys(
          initial,
          hasLimitation ? ["limitation", "meaning", "possibility"] : ["meaning", "possibility"],
        )
      ) {
        return invalid();
      }
      const base = {
        meaning: parseText(initial.meaning, responseTextLimits.meaningMaximum),
        possibility: parseText(initial.possibility, responseTextLimits.meaningMaximum),
      };
      return Object.freeze(
        hasLimitation
          ? {
              ...base,
              limitation: parseText(initial.limitation, responseTextLimits.meaningMaximum),
            }
          : base,
      );
    }),
  );

const parseSmallAction = (value: unknown): TarotInterpretationOutputProjectionV1["smallAction"] => {
  const values = exactRecord(value, ["label", "rationale", "timeHorizon"]);
  if (
    values.timeHorizon !== "open" &&
    values.timeHorizon !== "this_week" &&
    values.timeHorizon !== "today"
  ) {
    return invalid();
  }
  return Object.freeze({
    label: parseText(values.label, responseTextLimits.labelMaximum),
    rationale: parseText(values.rationale, responseTextLimits.rationaleMaximum),
    timeHorizon: values.timeHorizon,
  });
};

const parseRitualSuggestion = (
  value: unknown,
): NonNullable<TarotInterpretationOutputProjectionV1["ritualSuggestion"]> => {
  const values = exactRecord(value, ["reason"]);
  return Object.freeze({
    reason: parseText(values.reason, responseTextLimits.ritualReasonMaximum),
  });
};

const parseOutput = (value: unknown): TarotInterpretationOutputProjectionV1 => {
  const initial = record(value);
  const hasRitualSuggestion = Object.hasOwn(initial, "ritualSuggestion");
  if (
    !hasExactKeys(
      initial,
      hasRitualSuggestion
        ? [
            "boundaryNote",
            "perspectives",
            "reflectionQuestions",
            "ritualSuggestion",
            "smallAction",
            "summary",
            "symbols",
            "title",
          ]
        : [
            "boundaryNote",
            "perspectives",
            "reflectionQuestions",
            "smallAction",
            "summary",
            "symbols",
            "title",
          ],
    )
  ) {
    return invalid();
  }

  return Object.freeze({
    boundaryNote: parseText(initial.boundaryNote, responseTextLimits.boundaryNoteMaximum),
    perspectives: parseTextArray(
      initial.perspectives,
      responseTextLimits.perspectivesMaximum,
      responseTextLimits.perspectiveTextMaximum,
    ),
    reflectionQuestions: parseTextArray(
      initial.reflectionQuestions,
      responseTextLimits.questionsMaximum,
      responseTextLimits.reflectionQuestionMaximum,
    ),
    ...(hasRitualSuggestion
      ? { ritualSuggestion: parseRitualSuggestion(initial.ritualSuggestion) }
      : {}),
    smallAction: parseSmallAction(initial.smallAction),
    summary: parseText(initial.summary, responseTextLimits.summaryMaximum),
    symbols: parseSymbols(initial.symbols),
    title: parseText(initial.title, responseTextLimits.titleMaximum),
  });
};

const assertIdentity = (values: Readonly<Record<string, unknown>>, expectedReadingId: string) => {
  if (
    values.schemaVersion !== tarotInterpretationResponseSchemaVersion ||
    typeof values.readingId !== "string" ||
    !uuidV4Pattern.test(values.readingId) ||
    values.readingId !== expectedReadingId
  ) {
    return invalid();
  }
};

export const parseTarotInterpretationResponseV1 = (
  value: unknown,
  expectedReadingId: string,
): TarotInterpretationResponseV1 => {
  try {
    if (typeof expectedReadingId !== "string" || !uuidV4Pattern.test(expectedReadingId)) {
      return invalid();
    }
    const initial = record(value);
    const values = initial;
    assertIdentity(values, expectedReadingId);

    switch (values.status) {
      case "processing": {
        if (
          !hasExactKeys(initial, [
            "displayable",
            "pollAfterMs",
            "readingId",
            "schemaVersion",
            "status",
          ]) ||
          values.displayable !== false ||
          !Number.isSafeInteger(values.pollAfterMs) ||
          (values.pollAfterMs as number) < pollAfterMinimumMs ||
          (values.pollAfterMs as number) > pollAfterMaximumMs
        ) {
          return invalid();
        }
        return Object.freeze({
          displayable: false,
          pollAfterMs: values.pollAfterMs as number,
          readingId: expectedReadingId,
          schemaVersion: tarotInterpretationResponseSchemaVersion,
          status: "processing",
        });
      }
      case "failed":
        if (
          !hasExactKeys(initial, ["displayable", "readingId", "schemaVersion", "status"]) ||
          values.displayable !== false
        ) {
          return invalid();
        }
        return Object.freeze({
          displayable: false,
          readingId: expectedReadingId,
          schemaVersion: tarotInterpretationResponseSchemaVersion,
          status: "failed",
        });
      case "verified":
      case "reviewed_fallback": {
        if (
          !hasExactKeys(initial, [
            "displayable",
            "output",
            "readingId",
            "schemaVersion",
            "status",
          ]) ||
          values.displayable !== true
        ) {
          return invalid();
        }
        const output = parseOutput(values.output);
        return values.status === "verified"
          ? Object.freeze({
              displayable: true,
              output,
              readingId: expectedReadingId,
              schemaVersion: tarotInterpretationResponseSchemaVersion,
              status: "verified",
            })
          : Object.freeze({
              displayable: true,
              output,
              readingId: expectedReadingId,
              schemaVersion: tarotInterpretationResponseSchemaVersion,
              status: "reviewed_fallback",
            });
      }
      default:
        return invalid();
    }
  } catch {
    return invalid();
  }
};
