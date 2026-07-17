import { parseTarotDrawFactsV1, type TarotDrawFactsV1 } from "@rituvia/divination";
import {
  parseQuestionIntakeThemeCode,
  tarotReadingTypes,
  type QuestionIntakeThemeCode,
  type TarotReadingType,
} from "@rituvia/domain";

import type {
  AllowedInterpretationSafetyDecisionV1,
  ProviderChecksummedReferenceV1,
} from "./provider.js";

export const tarotInterpretationInputSchemaVersion = "tarot-interpretation-input.v1" as const;
export const tarotInterpretationOutputSchemaVersion = "1" as const;
export const interpretationSafetyDecisionSchemaVersion =
  "interpretation-safety-decision.v1" as const;

export const interpretationTones = Object.freeze([
  "concise",
  "gentle",
  "grounded",
  "poetic-light",
] as const);
export type InterpretationTone = (typeof interpretationTones)[number];

export const interpretationTimeHorizons = Object.freeze(["open", "this_week", "today"] as const);
export type InterpretationTimeHorizon = (typeof interpretationTimeHorizons)[number];

export const interpretationContractLimits = Object.freeze({
  approvedContentMaximum: 24,
  approvedRitualTemplatesMaximum: 12,
  boundaryNoteMaximum: 800,
  contentIdMaximum: 120,
  jsonMaximum: 65_536,
  labelMaximum: 240,
  meaningMaximum: 800,
  perspectivesMaximum: 6,
  perspectiveTextMaximum: 800,
  questionsMaximum: 4,
  rationaleMaximum: 600,
  reflectionQuestionMaximum: 500,
  sourceRefsMaximum: 24,
  summaryMaximum: 1_200,
  symbolsMaximum: 12,
  titleMaximum: 120,
} as const);

export const interpretationContractErrorCodes = Object.freeze([
  "INTERPRETATION_INPUT_INVALID",
  "INTERPRETATION_OUTPUT_INVALID",
  "INTERPRETATION_SCHEMA_UNSUPPORTED",
] as const);
export type InterpretationContractErrorCode = (typeof interpretationContractErrorCodes)[number];

const interpretationContractErrorMessage = (code: InterpretationContractErrorCode): string => {
  switch (code) {
    case "INTERPRETATION_INPUT_INVALID":
      return "The tarot interpretation input is invalid.";
    case "INTERPRETATION_OUTPUT_INVALID":
      return "The tarot interpretation output is invalid.";
    case "INTERPRETATION_SCHEMA_UNSUPPORTED":
      return "The tarot interpretation schema version is unsupported.";
  }
};

export class InterpretationContractError extends Error {
  public readonly code: InterpretationContractErrorCode;

  public constructor(code: InterpretationContractErrorCode) {
    super(interpretationContractErrorMessage(code));
    this.name = "InterpretationContractError";
    this.code = code;
  }
}

export type InterpretationContentReferenceV1 = Readonly<{
  checksum: string;
  contentId: string;
  locale: string;
  sourceRef: string;
  tradition: string;
  version: string;
}>;

declare const parsedTarotInterpretationInputBrand: unique symbol;
const parsedTarotInterpretationInputs = new WeakSet<object>();

export type TarotInterpretationInputV1 = Readonly<{
  approvedContent: readonly InterpretationContentReferenceV1[];
  approvedRitualTemplateCodes: readonly string[];
  deterministicFacts: TarotDrawFactsV1;
  locale: string;
  modality: "tarot";
  prompt: ProviderChecksummedReferenceV1;
  readingType: TarotReadingType;
  requestId: string;
  safetyDecision: AllowedInterpretationSafetyDecisionV1;
  schemaVersion: typeof tarotInterpretationInputSchemaVersion;
  themeCode: QuestionIntakeThemeCode;
  tone: InterpretationTone;
  [parsedTarotInterpretationInputBrand]: true;
}>;

export type TarotInterpretationSymbolV1 = Readonly<{
  factRef: string;
  limitation?: string;
  meaning: string;
  possibility: string;
}>;

export type TarotInterpretationOutputV1 = Readonly<{
  boundaryNote: string;
  perspectives: readonly string[];
  reflectionQuestions: readonly string[];
  ritualSuggestion?: Readonly<{
    approvedTemplateCode: string;
    reason: string;
  }>;
  safety: Readonly<{
    certaintyLevel: "reflective";
    containsGuaranteedOutcome: false;
    containsProfessionalAdvice: false;
  }>;
  schemaVersion: typeof tarotInterpretationOutputSchemaVersion;
  smallAction: Readonly<{
    label: string;
    rationale: string;
    timeHorizon: InterpretationTimeHorizon;
  }>;
  sourceRefs: readonly string[];
  summary: string;
  symbols: readonly TarotInterpretationSymbolV1[];
  title: string;
}>;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const sourceReferencePattern = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/u;
const forbiddenTextPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  return actual === [...expected].sort().join("\u0000");
};

const included = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.includes(value as Value);

const invalidInput = (): never => {
  throw new InterpretationContractError("INTERPRETATION_INPUT_INVALID");
};

const invalidOutput = (): never => {
  throw new InterpretationContractError("INTERPRETATION_OUTPUT_INVALID");
};

const unsupportedSchema = (): never => {
  throw new InterpretationContractError("INTERPRETATION_SCHEMA_UNSUPPORTED");
};

const protect = <Value>(operation: () => Value, invalid: () => never): Value => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof InterpretationContractError) throw error;
    return invalid();
  }
};

const parseLocale = (value: unknown, invalid: () => never): string => {
  if (typeof value !== "string" || value.length < 2 || value.length > 35) return invalid();
  return protect(() => {
    const locale = new Intl.Locale(value).toString();
    if (locale !== value) return invalid();
    return locale;
  }, invalid);
};

const parseNormalizedText = (value: unknown, maximum: number, invalid: () => never): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    value !== value.normalize("NFC") ||
    forbiddenTextPattern.test(value)
  ) {
    return invalid();
  }
  return value;
};

const parseIdentifier = (value: unknown, maximum: number, invalid: () => never): string => {
  const identifier = parseNormalizedText(value, maximum, invalid);
  if (!identifierPattern.test(identifier)) return invalid();
  return identifier;
};

const parseSourceReference = (value: unknown, invalid: () => never): string => {
  const reference = parseNormalizedText(value, 160, invalid);
  if (!sourceReferencePattern.test(reference)) return invalid();
  return reference;
};

const parseChecksummedReference = (
  value: unknown,
  invalid: () => never,
): ProviderChecksummedReferenceV1 => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["checksum", "id", "version"])) {
    return invalid();
  }
  const checksum = candidate.checksum;
  const version = candidate.version;
  if (
    typeof checksum !== "string" ||
    !sha256DigestPattern.test(checksum) ||
    typeof version !== "string" ||
    !versionPattern.test(version)
  ) {
    return invalid();
  }
  return Object.freeze({
    checksum,
    id: parseIdentifier(candidate.id, 120, invalid),
    version,
  });
};

const parseSafetyDecision = (
  value: unknown,
  invalid: () => never,
): AllowedInterpretationSafetyDecisionV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["policyVersion", "route", "schemaVersion"]) ||
    candidate.schemaVersion !== interpretationSafetyDecisionSchemaVersion ||
    candidate.route !== "allowed"
  ) {
    return invalid();
  }
  return Object.freeze({
    policyVersion: parseIdentifier(candidate.policyVersion, 120, invalid),
    route: "allowed",
    schemaVersion: interpretationSafetyDecisionSchemaVersion,
  });
};

const parseContentReference = (
  value: unknown,
  expectedLocale: string,
  invalid: () => never,
): InterpretationContentReferenceV1 => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "checksum",
      "contentId",
      "locale",
      "sourceRef",
      "tradition",
      "version",
    ])
  ) {
    return invalid();
  }
  const checksum = candidate.checksum;
  const version = candidate.version;
  if (
    typeof checksum !== "string" ||
    !sha256DigestPattern.test(checksum) ||
    typeof version !== "string" ||
    !versionPattern.test(version)
  ) {
    return invalid();
  }
  const locale = parseLocale(candidate.locale, invalid);
  if (locale !== expectedLocale) return invalid();
  return Object.freeze({
    checksum,
    contentId: parseIdentifier(
      candidate.contentId,
      interpretationContractLimits.contentIdMaximum,
      invalid,
    ),
    locale,
    sourceRef: parseSourceReference(candidate.sourceRef, invalid),
    tradition: parseIdentifier(candidate.tradition, 80, invalid),
    version,
  });
};

export const parseTarotInterpretationInputJsonV1 = (value: string): TarotInterpretationInputV1 =>
  protect(() => {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.length > interpretationContractLimits.jsonMaximum
    ) {
      return invalidInput();
    }
    const candidate = record(JSON.parse(value) as unknown);
    if (candidate === null) return invalidInput();
    if (candidate.schemaVersion !== tarotInterpretationInputSchemaVersion) {
      return unsupportedSchema();
    }
    if (
      !hasExactKeys(candidate, [
        "approvedContent",
        "approvedRitualTemplateCodes",
        "deterministicFacts",
        "locale",
        "modality",
        "prompt",
        "readingType",
        "requestId",
        "safetyDecision",
        "schemaVersion",
        "themeCode",
        "tone",
      ]) ||
      candidate.modality !== "tarot" ||
      !included(tarotReadingTypes, candidate.readingType) ||
      !included(interpretationTones, candidate.tone) ||
      typeof candidate.requestId !== "string" ||
      !uuidV4Pattern.test(candidate.requestId) ||
      !Array.isArray(candidate.approvedContent) ||
      candidate.approvedContent.length === 0 ||
      candidate.approvedContent.length > interpretationContractLimits.approvedContentMaximum ||
      !Array.isArray(candidate.approvedRitualTemplateCodes) ||
      candidate.approvedRitualTemplateCodes.length >
        interpretationContractLimits.approvedRitualTemplatesMaximum
    ) {
      return invalidInput();
    }
    const locale = parseLocale(candidate.locale, invalidInput);
    const approvedContent: InterpretationContentReferenceV1[] = [];
    const sourceRefs = new Set<string>();
    for (const entry of candidate.approvedContent) {
      const parsed = parseContentReference(entry, locale, invalidInput);
      if (sourceRefs.has(parsed.sourceRef)) return invalidInput();
      sourceRefs.add(parsed.sourceRef);
      approvedContent.push(parsed);
    }
    const approvedRitualTemplateCodes: string[] = [];
    const ritualTemplateCodes = new Set<string>();
    for (const entry of candidate.approvedRitualTemplateCodes) {
      const code = parseIdentifier(entry, 100, invalidInput);
      if (ritualTemplateCodes.has(code)) return invalidInput();
      ritualTemplateCodes.add(code);
      approvedRitualTemplateCodes.push(code);
    }
    const deterministicFacts = protect(
      () => parseTarotDrawFactsV1(candidate.deterministicFacts),
      invalidInput,
    );
    const readingType = candidate.readingType;
    const expectedPositions = readingType === "one_card" ? 1 : 3;
    if (deterministicFacts.positions.length !== expectedPositions) return invalidInput();
    const parsed = Object.freeze({
      approvedContent: Object.freeze(approvedContent),
      approvedRitualTemplateCodes: Object.freeze(approvedRitualTemplateCodes),
      deterministicFacts,
      locale,
      modality: "tarot",
      prompt: parseChecksummedReference(candidate.prompt, invalidInput),
      readingType,
      requestId: candidate.requestId,
      safetyDecision: parseSafetyDecision(candidate.safetyDecision, invalidInput),
      schemaVersion: tarotInterpretationInputSchemaVersion,
      themeCode: protect(() => parseQuestionIntakeThemeCode(candidate.themeCode), invalidInput),
      tone: candidate.tone,
    }) as TarotInterpretationInputV1;
    parsedTarotInterpretationInputs.add(parsed);
    return parsed;
  }, invalidInput);

export const tarotInterpretationFactRefsV1 = (
  input: TarotInterpretationInputV1,
): readonly string[] => {
  if (!parsedTarotInterpretationInputs.has(input)) return invalidInput();
  return Object.freeze(
    input.deterministicFacts.positions.map(({ positionId }) => `tarot.position.${positionId}`),
  );
};

const parseTextArray = (
  value: unknown,
  maximumItems: number,
  maximumText: number,
  invalid: () => never,
): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumItems) return invalid();
  const parsed: string[] = [];
  const unique = new Set<string>();
  for (const entry of value) {
    const text = parseNormalizedText(entry, maximumText, invalid);
    if (unique.has(text)) return invalid();
    unique.add(text);
    parsed.push(text);
  }
  return Object.freeze(parsed);
};

const parseSymbols = (
  value: unknown,
  invalid: () => never,
): readonly TarotInterpretationSymbolV1[] => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > interpretationContractLimits.symbolsMaximum
  ) {
    return invalid();
  }
  const symbols: TarotInterpretationSymbolV1[] = [];
  const factRefs = new Set<string>();
  for (const entry of value) {
    const candidate = record(entry);
    if (candidate === null) return invalid();
    const hasLimitation = Object.hasOwn(candidate, "limitation");
    if (
      !hasExactKeys(
        candidate,
        hasLimitation
          ? ["factRef", "limitation", "meaning", "possibility"]
          : ["factRef", "meaning", "possibility"],
      )
    ) {
      return invalid();
    }
    const factRef = parseSourceReference(candidate.factRef, invalid);
    if (!factRef.startsWith("tarot.position.") || factRefs.has(factRef)) return invalid();
    factRefs.add(factRef);
    const base = {
      factRef,
      meaning: parseNormalizedText(
        candidate.meaning,
        interpretationContractLimits.meaningMaximum,
        invalid,
      ),
      possibility: parseNormalizedText(
        candidate.possibility,
        interpretationContractLimits.meaningMaximum,
        invalid,
      ),
    };
    symbols.push(
      Object.freeze(
        hasLimitation
          ? {
              ...base,
              limitation: parseNormalizedText(
                candidate.limitation,
                interpretationContractLimits.meaningMaximum,
                invalid,
              ),
            }
          : base,
      ),
    );
  }
  return Object.freeze(symbols);
};

const parseSmallAction = (
  value: unknown,
  invalid: () => never,
): TarotInterpretationOutputV1["smallAction"] => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["label", "rationale", "timeHorizon"]) ||
    !included(interpretationTimeHorizons, candidate.timeHorizon)
  ) {
    return invalid();
  }
  return Object.freeze({
    label: parseNormalizedText(candidate.label, interpretationContractLimits.labelMaximum, invalid),
    rationale: parseNormalizedText(
      candidate.rationale,
      interpretationContractLimits.rationaleMaximum,
      invalid,
    ),
    timeHorizon: candidate.timeHorizon,
  });
};

const parseRitualSuggestion = (
  value: unknown,
  invalid: () => never,
): NonNullable<TarotInterpretationOutputV1["ritualSuggestion"]> => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(candidate, ["approvedTemplateCode", "reason"])) {
    return invalid();
  }
  return Object.freeze({
    approvedTemplateCode: parseIdentifier(candidate.approvedTemplateCode, 100, invalid),
    reason: parseNormalizedText(
      candidate.reason,
      interpretationContractLimits.rationaleMaximum,
      invalid,
    ),
  });
};

const parseSafety = (
  value: unknown,
  invalid: () => never,
): TarotInterpretationOutputV1["safety"] => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, [
      "certaintyLevel",
      "containsGuaranteedOutcome",
      "containsProfessionalAdvice",
    ]) ||
    candidate.certaintyLevel !== "reflective" ||
    candidate.containsGuaranteedOutcome !== false ||
    candidate.containsProfessionalAdvice !== false
  ) {
    return invalid();
  }
  return Object.freeze({
    certaintyLevel: "reflective",
    containsGuaranteedOutcome: false,
    containsProfessionalAdvice: false,
  });
};

const parseTarotInterpretationOutputJsonV1 = (value: string): TarotInterpretationOutputV1 =>
  protect(() => {
    if (value.length === 0 || value.length > interpretationContractLimits.jsonMaximum) {
      return invalidOutput();
    }
    const candidate = record(JSON.parse(value) as unknown);
    if (candidate === null) return invalidOutput();
    if (candidate.schemaVersion !== tarotInterpretationOutputSchemaVersion) {
      return unsupportedSchema();
    }
    const hasRitualSuggestion = Object.hasOwn(candidate, "ritualSuggestion");
    if (
      !hasExactKeys(
        candidate,
        hasRitualSuggestion
          ? [
              "boundaryNote",
              "perspectives",
              "reflectionQuestions",
              "ritualSuggestion",
              "safety",
              "schemaVersion",
              "smallAction",
              "sourceRefs",
              "summary",
              "symbols",
              "title",
            ]
          : [
              "boundaryNote",
              "perspectives",
              "reflectionQuestions",
              "safety",
              "schemaVersion",
              "smallAction",
              "sourceRefs",
              "summary",
              "symbols",
              "title",
            ],
      )
    ) {
      return invalidOutput();
    }
    const sourceRefs = parseTextArray(
      candidate.sourceRefs,
      interpretationContractLimits.sourceRefsMaximum,
      160,
      invalidOutput,
    );
    for (const sourceRef of sourceRefs) {
      if (!sourceReferencePattern.test(sourceRef)) return invalidOutput();
    }
    const base = {
      boundaryNote: parseNormalizedText(
        candidate.boundaryNote,
        interpretationContractLimits.boundaryNoteMaximum,
        invalidOutput,
      ),
      perspectives: parseTextArray(
        candidate.perspectives,
        interpretationContractLimits.perspectivesMaximum,
        interpretationContractLimits.perspectiveTextMaximum,
        invalidOutput,
      ),
      reflectionQuestions: parseTextArray(
        candidate.reflectionQuestions,
        interpretationContractLimits.questionsMaximum,
        interpretationContractLimits.reflectionQuestionMaximum,
        invalidOutput,
      ),
      safety: parseSafety(candidate.safety, invalidOutput),
      schemaVersion: tarotInterpretationOutputSchemaVersion,
      smallAction: parseSmallAction(candidate.smallAction, invalidOutput),
      sourceRefs,
      summary: parseNormalizedText(
        candidate.summary,
        interpretationContractLimits.summaryMaximum,
        invalidOutput,
      ),
      symbols: parseSymbols(candidate.symbols, invalidOutput),
      title: parseNormalizedText(
        candidate.title,
        interpretationContractLimits.titleMaximum,
        invalidOutput,
      ),
    };
    return Object.freeze(
      hasRitualSuggestion
        ? {
            ...base,
            ritualSuggestion: parseRitualSuggestion(candidate.ritualSuggestion, invalidOutput),
          }
        : base,
    );
  }, invalidOutput);

const hasExactStringSet = (actual: readonly string[], expected: readonly string[]): boolean => {
  if (actual.length !== expected.length) return false;
  const expectedSet = new Set(expected);
  return actual.every((entry) => expectedSet.has(entry));
};

export const parseTarotInterpretationOutputForInputV1 = (
  input: TarotInterpretationInputV1,
  value: string,
): TarotInterpretationOutputV1 =>
  protect(() => {
    if (!parsedTarotInterpretationInputs.has(input)) return invalidInput();
    const output = parseTarotInterpretationOutputJsonV1(value);
    if (
      !hasExactStringSet(
        output.symbols.map(({ factRef }) => factRef),
        tarotInterpretationFactRefsV1(input),
      ) ||
      !hasExactStringSet(
        output.sourceRefs,
        input.approvedContent.map(({ sourceRef }) => sourceRef),
      ) ||
      (output.ritualSuggestion !== undefined &&
        !input.approvedRitualTemplateCodes.includes(output.ritualSuggestion.approvedTemplateCode))
    ) {
      return invalidOutput();
    }
    return output;
  }, invalidOutput);
