export const questionIntakeSchemaVersion = "1" as const;
export const questionIntakePolicyVersion = "question-intake.en.v1" as const;
export const questionIntakeMaximumLength = 600;

export const questionIntakeThemeCodes = Object.freeze([
  "self",
  "relationships",
  "work",
  "creativity",
  "transition",
  "grief",
  "courage",
  "gratitude",
  "release",
  "open_reflection",
] as const);

export type QuestionIntakeThemeCode = (typeof questionIntakeThemeCodes)[number];

export const questionIntakeStates = Object.freeze([
  "allowed",
  "reframed",
  "blocked",
  "crisis",
] as const);

export type QuestionIntakeState = (typeof questionIntakeStates)[number];

export const questionIntakeRiskCategories = Object.freeze([
  "self_harm",
  "immediate_danger",
  "violent_harm",
  "medical_determination",
  "legal_determination",
  "financial_determination",
  "death_timing",
  "criminal_guilt",
  "coercive_control",
  "supernatural_persecution",
  "relationship_mind_reading",
  "guaranteed_outcome",
  "instruction_injection",
] as const);

export type QuestionIntakeRiskCategory = (typeof questionIntakeRiskCategories)[number];

export const questionIntakeSuggestionCodes = Object.freeze([
  "agency_general",
  "professional_preparation",
  "relationship_agency",
  "grounded_observation",
] as const);

export type QuestionIntakeSuggestionCode = (typeof questionIntakeSuggestionCodes)[number];

export const questionIntakeErrorCodes = Object.freeze([
  "INTAKE_INPUT_INVALID",
  "INTAKE_OUTPUT_INVALID",
] as const);

export type QuestionIntakeErrorCode = (typeof questionIntakeErrorCodes)[number];

export class QuestionIntakeError extends Error {
  readonly code: QuestionIntakeErrorCode;

  constructor(code: QuestionIntakeErrorCode) {
    super("The question intake contract is invalid.");
    this.name = "QuestionIntakeError";
    this.code = code;
  }
}

export type QuestionIntakeRequest = Readonly<{
  locale: "en";
  question?: string;
  schemaVersion: typeof questionIntakeSchemaVersion;
  themeCode: QuestionIntakeThemeCode;
}>;

export type QuestionIntakeEvaluation = Readonly<{
  canContinue: boolean;
  locale: "en";
  policyVersion: typeof questionIntakePolicyVersion;
  riskCategories: readonly QuestionIntakeRiskCategory[];
  schemaVersion: typeof questionIntakeSchemaVersion;
  state: QuestionIntakeState;
  suggestedQuestionCode: QuestionIntakeSuggestionCode | null;
  themeCode: QuestionIntakeThemeCode;
}>;

export type QuestionIntakeAnalyticsEvent = Readonly<{
  eventName: "question_reframed" | "safety_boundary_shown";
  policyVersion: typeof questionIntakePolicyVersion;
  schemaVersion: typeof questionIntakeSchemaVersion;
  state: Exclude<QuestionIntakeState, "allowed">;
  themeCode: QuestionIntakeThemeCode;
}>;

export type QuestionIntakeResponse = Readonly<{
  canContinue: boolean;
  locale: "en";
  policyVersion: typeof questionIntakePolicyVersion;
  schemaVersion: typeof questionIntakeSchemaVersion;
  state: QuestionIntakeState;
  suggestedQuestionCode: QuestionIntakeSuggestionCode | null;
  themeCode: QuestionIntakeThemeCode;
}>;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key))
  );
};

const included = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.some((candidate) => candidate === value);

export const parseQuestionIntakeThemeCode = (value: unknown): QuestionIntakeThemeCode => {
  if (!included(questionIntakeThemeCodes, value)) {
    throw new QuestionIntakeError("INTAKE_INPUT_INVALID");
  }
  return value;
};

const forbiddenQuestionCharacters =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff]/u;

const normalizeQuestion = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    throw new QuestionIntakeError("INTAKE_INPUT_INVALID");
  }
  const normalized = value.normalize("NFC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (
    Array.from(normalized).length > questionIntakeMaximumLength ||
    forbiddenQuestionCharacters.test(normalized)
  ) {
    throw new QuestionIntakeError("INTAKE_INPUT_INVALID");
  }
  return normalized === "" ? undefined : normalized;
};

export const parseQuestionIntakeRequest = (value: unknown): QuestionIntakeRequest => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["locale", "schemaVersion", "themeCode"], ["question"]) ||
    input.schemaVersion !== questionIntakeSchemaVersion ||
    input.locale !== "en"
  ) {
    throw new QuestionIntakeError("INTAKE_INPUT_INVALID");
  }
  const themeCode = parseQuestionIntakeThemeCode(input.themeCode);
  const question = Object.hasOwn(input, "question") ? normalizeQuestion(input.question) : undefined;
  return Object.freeze({
    locale: "en",
    ...(question === undefined ? {} : { question }),
    schemaVersion: questionIntakeSchemaVersion,
    themeCode,
  });
};

const policyText = (question: string): string =>
  question
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replaceAll("0", "o")
    .replaceAll("1", "i")
    .replaceAll("3", "e")
    .replaceAll("4", "a")
    .replaceAll("5", "s")
    .replaceAll("7", "t")
    .replace(/[^a-z]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

const anyPattern = (value: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(value));

const crisisPatterns = Object.freeze([
  /\b(?:i am|i m|im|i feel|feeling) (?:suicidal|ready for suicide|drawn to self harm)\b/u,
  /\b(?:thinking|thoughts?|planning|plan) (?:about |of )?(?:suicide|self harm)\b/u,
  /\b(?:kill|hurt|harm) (?:myself|my self)\b/u,
  /\b(?:end|take) my life\b/u,
  /\b(?:want|plan|planning|intend|intending|ready) (?:to )?(?:die|kill myself|end my life)\b/u,
  /\b(?:do not|don t|dont) want (?:to )?live\b/u,
  /\bbetter off dead\b/u,
]);

const immediateDangerPatterns = Object.freeze([
  /\b(?:i am|i m|im) (?:in )?immediate danger\b/u,
  /\bsomeone (?:is )?(?:trying|planning|going) to (?:kill|hurt|attack) me\b/u,
  /\bi am being (?:attacked|held|threatened) right now\b/u,
]);

const violentHarmPatterns = Object.freeze([
  /\b(?:how (?:can|do) i|help me|tell me how to) (?:kill|poison|attack)\b/u,
  /\b(?:how (?:can|do) i|help me|tell me how to) hurt (?:someone|somebody|a person|him|her|them|myself)\b/u,
  /\b(?:plan|instructions) (?:to|for) (?:kill|hurt|poison|attack)\b/u,
]);

const medicalSubject =
  /\b(?:diagnos(?:e|is)|disease|cancer|pregnan(?:t|cy)|fertility|medication|medicine|treatment|cure|illness|sick)\b/u;
const legalSubject =
  /\b(?:court|lawsuit|legal case|judge|jury|verdict|sentence|immigration|visa|deportation|custody)\b/u;
const financialSubject =
  /\b(?:stock|share price|crypto|bitcoin|investment|lottery|market|trade|trading)\b/u;
const determinationLanguage =
  /\b(?:will|when|predict|guarantee|certain|definitely|should i|tell me|do i have|am i)\b/u;

const detectsRisk = (category: QuestionIntakeRiskCategory, value: string): boolean => {
  switch (category) {
    case "self_harm":
      return anyPattern(value, crisisPatterns);
    case "immediate_danger":
      return anyPattern(value, immediateDangerPatterns);
    case "violent_harm":
      return anyPattern(value, violentHarmPatterns);
    case "medical_determination":
      return (
        (medicalSubject.test(value) && determinationLanguage.test(value)) ||
        /\b(?:can|could) you diagnos(?:e|is)\b/u.test(value) ||
        /\bshould i (?:stop|start|change|take) (?:my )?(?:medication|medicine|treatment)\b/u.test(
          value,
        )
      );
    case "legal_determination":
      return legalSubject.test(value) && determinationLanguage.test(value);
    case "financial_determination":
      return financialSubject.test(value) && determinationLanguage.test(value);
    case "death_timing":
      return /\b(?:when|what age|how soon|how long until) (?:will )?(?:i|we|he|she|they|my |our |their )?.{0,24}\b(?:die|death)\b/u.test(
        value,
      );
    case "criminal_guilt":
      return /\b(?:is|was|did|prove|tell me if) .{0,40}\b(?:guilty of|murder(?:ed)?|stole|steal|commit(?:ted)? (?:a |the )?crime|criminal)\b/u.test(
        value,
      );
    case "coercive_control":
      return /\b(?:make|force|control|manipulate) .{0,32}\b(?:love|obey|return|stay|leave|choose|want|feel|do)\b/u.test(
        value,
      );
    case "supernatural_persecution":
      return /\b(?:curse|cursed|hexed|possess(?:ed|ion)|demon|evil spirit|psychic attack|thought control|supernatural persecution)\b/u.test(
        value,
      );
    case "relationship_mind_reading":
      return /\b(?:does|do|is|are|will) .{0,36}\b(?:love me|hate me|cheat(?:ing)?|faithful|thinking about me|return to me|secret feelings)\b/u.test(
        value,
      );
    case "guaranteed_outcome":
      return /\b(?:guarantee|guaranteed|definitely|certain|destined|sure thing)\b/u.test(value);
    case "instruction_injection":
      return /\b(?:ignore|reveal|override|bypass) (?:all |your |the )?(?:previous |hidden |system |safety )?(?:instructions|prompt|rules|policy)\b/u.test(
        value,
      );
  }
};

const classifyRisks = (question: string | undefined): readonly QuestionIntakeRiskCategory[] => {
  if (question === undefined) return Object.freeze([]);
  const normalized = policyText(question);
  return Object.freeze(
    questionIntakeRiskCategories.filter((category) => detectsRisk(category, normalized)),
  );
};

const includesRisk = (
  risks: readonly QuestionIntakeRiskCategory[],
  candidates: readonly QuestionIntakeRiskCategory[],
): boolean => candidates.some((candidate) => risks.includes(candidate));

const agencyPreservingPatterns = Object.freeze([
  /\bwhat (?:perspective|values|boundaries|actions?|choices?|questions?|observable facts|small step|support)\b/u,
  /\bwhat (?:can|could) i (?:notice|prepare|choose|change|learn|do|try|ask|control|reflect on)\b/u,
  /\bhow (?:can|could) i (?:approach|support|prepare|cope|reflect|learn|communicate|set|practice|respond|feel grounded)\b/u,
]);

const evaluationState = (
  risks: readonly QuestionIntakeRiskCategory[],
  question: string | undefined,
): QuestionIntakeState => {
  if (includesRisk(risks, ["self_harm", "immediate_danger"])) return "crisis";
  if (
    includesRisk(risks, [
      "violent_harm",
      "medical_determination",
      "legal_determination",
      "financial_determination",
      "death_timing",
      "criminal_guilt",
      "coercive_control",
      "supernatural_persecution",
      "instruction_injection",
    ])
  ) {
    return "blocked";
  }
  if (risks.length > 0) return "reframed";
  if (question === undefined) return "allowed";
  return anyPattern(policyText(question), agencyPreservingPatterns) ? "allowed" : "reframed";
};

const suggestionFor = (
  state: QuestionIntakeState,
  risks: readonly QuestionIntakeRiskCategory[],
): QuestionIntakeSuggestionCode | null => {
  if (state === "allowed" || state === "crisis") return null;
  if (
    includesRisk(risks, ["medical_determination", "legal_determination", "financial_determination"])
  ) {
    return "professional_preparation";
  }
  if (includesRisk(risks, ["coercive_control", "relationship_mind_reading"])) {
    return "relationship_agency";
  }
  if (risks.includes("supernatural_persecution")) return "grounded_observation";
  return "agency_general";
};

export const evaluateQuestionIntake = (rawInput: unknown): QuestionIntakeEvaluation => {
  const input = parseQuestionIntakeRequest(rawInput);
  const riskCategories = classifyRisks(input.question);
  const state = evaluationState(riskCategories, input.question);
  return Object.freeze({
    canContinue: state === "allowed",
    locale: input.locale,
    policyVersion: questionIntakePolicyVersion,
    riskCategories,
    schemaVersion: questionIntakeSchemaVersion,
    state,
    suggestedQuestionCode: suggestionFor(state, riskCategories),
    themeCode: input.themeCode,
  });
};

const canonicalRisks = (value: unknown): readonly QuestionIntakeRiskCategory[] => {
  if (!Array.isArray(value) || value.length > questionIntakeRiskCategories.length) {
    throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  }
  const parsed = value.map((category) => {
    if (!included(questionIntakeRiskCategories, category)) {
      throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
    }
    return category;
  });
  const expected = questionIntakeRiskCategories.filter((category) => parsed.includes(category));
  if (parsed.join("\u0000") !== expected.join("\u0000")) {
    throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  }
  return Object.freeze(parsed);
};

export const parseQuestionIntakeEvaluation = (value: unknown): QuestionIntakeEvaluation => {
  const output = record(value);
  if (
    output === null ||
    !hasExactKeys(output, [
      "canContinue",
      "locale",
      "policyVersion",
      "riskCategories",
      "schemaVersion",
      "state",
      "suggestedQuestionCode",
      "themeCode",
    ]) ||
    output.schemaVersion !== questionIntakeSchemaVersion ||
    output.policyVersion !== questionIntakePolicyVersion ||
    output.locale !== "en" ||
    typeof output.canContinue !== "boolean" ||
    !included(questionIntakeStates, output.state) ||
    !(
      output.suggestedQuestionCode === null ||
      included(questionIntakeSuggestionCodes, output.suggestedQuestionCode)
    )
  ) {
    throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  }
  if (!included(questionIntakeThemeCodes, output.themeCode)) {
    throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  }
  const themeCode = output.themeCode;
  const riskCategories = canonicalRisks(output.riskCategories);
  const state = output.state;
  const suggestedQuestionCode = output.suggestedQuestionCode;
  const validState =
    (state === "allowed" &&
      output.canContinue &&
      riskCategories.length === 0 &&
      suggestedQuestionCode === null) ||
    (state === "reframed" && !output.canContinue && suggestedQuestionCode !== null) ||
    (state === "blocked" &&
      !output.canContinue &&
      riskCategories.length > 0 &&
      suggestedQuestionCode !== null) ||
    (state === "crisis" &&
      !output.canContinue &&
      suggestedQuestionCode === null &&
      includesRisk(riskCategories, ["self_harm", "immediate_danger"]));
  if (!validState) throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  return Object.freeze({
    canContinue: output.canContinue,
    locale: "en",
    policyVersion: questionIntakePolicyVersion,
    riskCategories,
    schemaVersion: questionIntakeSchemaVersion,
    state,
    suggestedQuestionCode,
    themeCode,
  });
};

export const createQuestionIntakeAnalyticsEvent = (
  evaluation: QuestionIntakeEvaluation,
): QuestionIntakeAnalyticsEvent | null => {
  const safe = parseQuestionIntakeEvaluation(evaluation);
  if (safe.state === "allowed") return null;
  return Object.freeze({
    eventName: safe.state === "reframed" ? "question_reframed" : "safety_boundary_shown",
    policyVersion: safe.policyVersion,
    schemaVersion: safe.schemaVersion,
    state: safe.state,
    themeCode: safe.themeCode,
  });
};

export const createQuestionIntakeResponse = (
  evaluation: QuestionIntakeEvaluation,
): QuestionIntakeResponse => {
  const safe = parseQuestionIntakeEvaluation(evaluation);
  return Object.freeze({
    canContinue: safe.canContinue,
    locale: safe.locale,
    policyVersion: safe.policyVersion,
    schemaVersion: safe.schemaVersion,
    state: safe.state,
    suggestedQuestionCode: safe.suggestedQuestionCode,
    themeCode: safe.themeCode,
  });
};

export const parseQuestionIntakeResponse = (value: unknown): QuestionIntakeResponse => {
  const response = record(value);
  if (
    response === null ||
    !hasExactKeys(response, [
      "canContinue",
      "locale",
      "policyVersion",
      "schemaVersion",
      "state",
      "suggestedQuestionCode",
      "themeCode",
    ]) ||
    response.schemaVersion !== questionIntakeSchemaVersion ||
    response.policyVersion !== questionIntakePolicyVersion ||
    response.locale !== "en" ||
    typeof response.canContinue !== "boolean" ||
    !included(questionIntakeStates, response.state) ||
    !included(questionIntakeThemeCodes, response.themeCode) ||
    !(
      response.suggestedQuestionCode === null ||
      included(questionIntakeSuggestionCodes, response.suggestedQuestionCode)
    )
  ) {
    throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  }
  const validState =
    (response.state === "allowed" &&
      response.canContinue &&
      response.suggestedQuestionCode === null) ||
    (response.state === "crisis" &&
      !response.canContinue &&
      response.suggestedQuestionCode === null) ||
    ((response.state === "reframed" || response.state === "blocked") &&
      !response.canContinue &&
      response.suggestedQuestionCode !== null);
  if (!validState) throw new QuestionIntakeError("INTAKE_OUTPUT_INVALID");
  return Object.freeze({
    canContinue: response.canContinue,
    locale: "en",
    policyVersion: questionIntakePolicyVersion,
    schemaVersion: questionIntakeSchemaVersion,
    state: response.state,
    suggestedQuestionCode: response.suggestedQuestionCode,
    themeCode: response.themeCode,
  });
};
