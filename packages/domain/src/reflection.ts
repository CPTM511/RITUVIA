export const reflectionIntentionSchemaVersion = "reflection-intention.v1" as const;
export const reflectionRitualSchemaVersion = "reflection-ritual.v1" as const;
export const reflectionJournalSchemaVersion = "reflection-journal.v1" as const;
export const reflectionPolicyVersion = "reflection-loop.en.v1" as const;

export const reflectionIntentionCodes = Object.freeze([
  "calm_clarity",
  "gratitude_abundance",
  "courage_action",
  "connection_understanding",
  "release_renewal",
] as const);

export const reflectionRitualObjectCodes = Object.freeze([
  "candle",
  "incense",
  "mindful_incense",
  "moonlit_lotus",
  "amethyst_guardian",
  "golden_intention_bowl",
] as const);

export const reflectionFreeRitualObjectCodes = Object.freeze(["candle", "incense"] as const);

export const reflectionSmallActionMaximumLength = 280;
export const reflectionJournalMaximumLength = 600;

export type ReflectionIntentionCode = (typeof reflectionIntentionCodes)[number];
export type ReflectionRitualObjectCode = (typeof reflectionRitualObjectCodes)[number];
export type ReflectionFreeRitualObjectCode = (typeof reflectionFreeRitualObjectCodes)[number];

export const isFreeReflectionRitualObjectCode = (
  value: ReflectionRitualObjectCode,
): value is ReflectionFreeRitualObjectCode =>
  reflectionFreeRitualObjectCodes.some((candidate) => candidate === value);

export type ReflectionIntentionCreateRequestV1 = Readonly<{
  intentionCode: ReflectionIntentionCode;
  locale: "en";
  readingId: string;
  schemaVersion: typeof reflectionIntentionSchemaVersion;
  smallAction: string;
}>;

export type ReflectionRitualCreateRequestV1 = Readonly<{
  intentionId: string;
  objectCode: ReflectionRitualObjectCode;
  schemaVersion: typeof reflectionRitualSchemaVersion;
}>;

export type ReflectionJournalCreateRequestV1 = Readonly<{
  intentionId: string;
  reflection: string;
  ritualSessionId: string;
  schemaVersion: typeof reflectionJournalSchemaVersion;
}>;

export type ReflectionIntentionResourceV1 = Readonly<{
  createdAt: string;
  expiresAt: string;
  id: string;
  intentionCode: ReflectionIntentionCode;
  locale: "en";
  policyVersion: typeof reflectionPolicyVersion;
  readingId: string;
  schemaVersion: typeof reflectionIntentionSchemaVersion;
  smallAction: string;
}>;

export type ReflectionRitualResourceV1 = Readonly<{
  completedAt: string;
  expiresAt: string;
  id: string;
  intentionId: string;
  objectCode: ReflectionRitualObjectCode;
  policyVersion: typeof reflectionPolicyVersion;
  ritualDateUtc: string;
  schemaVersion: typeof reflectionRitualSchemaVersion;
}>;

export type ReflectionJournalResourceV1 = Readonly<{
  createdAt: string;
  expiresAt: string;
  id: string;
  intentionId: string;
  policyVersion: typeof reflectionPolicyVersion;
  reflection: string;
  revisitAt: string;
  ritualSessionId: string;
  schemaVersion: typeof reflectionJournalSchemaVersion;
}>;

export const reflectionErrorCodes = Object.freeze([
  "REFLECTION_INPUT_INVALID",
  "REFLECTION_OUTPUT_INVALID",
] as const);

export type ReflectionErrorCode = (typeof reflectionErrorCodes)[number];

export class ReflectionError extends Error {
  readonly code: ReflectionErrorCode;

  constructor(code: ReflectionErrorCode) {
    super("The reflection-loop contract is invalid.");
    this.name = "ReflectionError";
    this.code = code;
  }
}

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const utcDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const forbiddenPrivateText =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff]/u;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, required: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => Object.hasOwn(value, key));
};

const includes = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.some((candidate) => candidate === value);

const invalidInput = (): never => {
  throw new ReflectionError("REFLECTION_INPUT_INVALID");
};

const invalidOutput = (): never => {
  throw new ReflectionError("REFLECTION_OUTPUT_INVALID");
};

const parseUuidV4 = (value: unknown, output = false): string => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseInstant = (value: unknown): string => {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) return invalidOutput();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return invalidOutput();
  }
  return value;
};

const parseUtcDate = (value: unknown): string => {
  if (typeof value !== "string" || !utcDatePattern.test(value)) return invalidOutput();
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    return invalidOutput();
  }
  return value;
};

const normalizePrivateText = (value: unknown, maximumLength: number): string => {
  if (typeof value !== "string") return invalidInput();
  const normalized = value.normalize("NFKC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    forbiddenPrivateText.test(normalized)
  ) {
    return invalidInput();
  }
  return normalized;
};

const parseOutputPrivateText = (value: unknown, maximumLength: number): string => {
  try {
    return normalizePrivateText(value, maximumLength);
  } catch {
    return invalidOutput();
  }
};

export const parseReflectionIntentionCreateRequestV1 = (
  value: unknown,
): ReflectionIntentionCreateRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "intentionCode",
      "locale",
      "readingId",
      "schemaVersion",
      "smallAction",
    ]) ||
    input.locale !== "en" ||
    input.schemaVersion !== reflectionIntentionSchemaVersion ||
    !includes(reflectionIntentionCodes, input.intentionCode)
  ) {
    return invalidInput();
  }
  return Object.freeze({
    intentionCode: input.intentionCode,
    locale: "en",
    readingId: parseUuidV4(input.readingId),
    schemaVersion: reflectionIntentionSchemaVersion,
    smallAction: normalizePrivateText(input.smallAction, reflectionSmallActionMaximumLength),
  });
};

export const parseReflectionRitualCreateRequestV1 = (
  value: unknown,
): ReflectionRitualCreateRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["intentionId", "objectCode", "schemaVersion"]) ||
    input.schemaVersion !== reflectionRitualSchemaVersion ||
    !includes(reflectionRitualObjectCodes, input.objectCode)
  ) {
    return invalidInput();
  }
  return Object.freeze({
    intentionId: parseUuidV4(input.intentionId),
    objectCode: input.objectCode,
    schemaVersion: reflectionRitualSchemaVersion,
  });
};

export const parseReflectionJournalCreateRequestV1 = (
  value: unknown,
): ReflectionJournalCreateRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["intentionId", "reflection", "ritualSessionId", "schemaVersion"]) ||
    input.schemaVersion !== reflectionJournalSchemaVersion
  ) {
    return invalidInput();
  }
  return Object.freeze({
    intentionId: parseUuidV4(input.intentionId),
    reflection: normalizePrivateText(input.reflection, reflectionJournalMaximumLength),
    ritualSessionId: parseUuidV4(input.ritualSessionId),
    schemaVersion: reflectionJournalSchemaVersion,
  });
};

export const canonicalizeReflectionIntentionCreateRequestV1 = (
  value: ReflectionIntentionCreateRequestV1,
): string => {
  const request = parseReflectionIntentionCreateRequestV1(value);
  return JSON.stringify({
    intentionCode: request.intentionCode,
    locale: request.locale,
    readingId: request.readingId,
    schemaVersion: request.schemaVersion,
    smallAction: request.smallAction,
  });
};

export const canonicalizeReflectionRitualCreateRequestV1 = (
  value: ReflectionRitualCreateRequestV1,
): string => {
  const request = parseReflectionRitualCreateRequestV1(value);
  return JSON.stringify({
    intentionId: request.intentionId,
    objectCode: request.objectCode,
    schemaVersion: request.schemaVersion,
  });
};

export const canonicalizeReflectionJournalCreateRequestV1 = (
  value: ReflectionJournalCreateRequestV1,
): string => {
  const request = parseReflectionJournalCreateRequestV1(value);
  return JSON.stringify({
    intentionId: request.intentionId,
    reflection: request.reflection,
    ritualSessionId: request.ritualSessionId,
    schemaVersion: request.schemaVersion,
  });
};

export const parseReflectionIntentionResourceV1 = (
  value: unknown,
): ReflectionIntentionResourceV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "createdAt",
      "expiresAt",
      "id",
      "intentionCode",
      "locale",
      "policyVersion",
      "readingId",
      "schemaVersion",
      "smallAction",
    ]) ||
    input.locale !== "en" ||
    input.policyVersion !== reflectionPolicyVersion ||
    input.schemaVersion !== reflectionIntentionSchemaVersion ||
    !includes(reflectionIntentionCodes, input.intentionCode)
  ) {
    return invalidOutput();
  }
  const createdAt = parseInstant(input.createdAt);
  const expiresAt = parseInstant(input.expiresAt);
  if (expiresAt <= createdAt) return invalidOutput();
  return Object.freeze({
    createdAt,
    expiresAt,
    id: parseUuidV4(input.id, true),
    intentionCode: input.intentionCode,
    locale: "en",
    policyVersion: reflectionPolicyVersion,
    readingId: parseUuidV4(input.readingId, true),
    schemaVersion: reflectionIntentionSchemaVersion,
    smallAction: parseOutputPrivateText(input.smallAction, reflectionSmallActionMaximumLength),
  });
};

export const parseReflectionRitualResourceV1 = (value: unknown): ReflectionRitualResourceV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "completedAt",
      "expiresAt",
      "id",
      "intentionId",
      "objectCode",
      "policyVersion",
      "ritualDateUtc",
      "schemaVersion",
    ]) ||
    input.policyVersion !== reflectionPolicyVersion ||
    input.schemaVersion !== reflectionRitualSchemaVersion ||
    !includes(reflectionRitualObjectCodes, input.objectCode)
  ) {
    return invalidOutput();
  }
  const completedAt = parseInstant(input.completedAt);
  const expiresAt = parseInstant(input.expiresAt);
  if (expiresAt <= completedAt) return invalidOutput();
  return Object.freeze({
    completedAt,
    expiresAt,
    id: parseUuidV4(input.id, true),
    intentionId: parseUuidV4(input.intentionId, true),
    objectCode: input.objectCode,
    policyVersion: reflectionPolicyVersion,
    ritualDateUtc: parseUtcDate(input.ritualDateUtc),
    schemaVersion: reflectionRitualSchemaVersion,
  });
};

export const parseReflectionJournalResourceV1 = (value: unknown): ReflectionJournalResourceV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "createdAt",
      "expiresAt",
      "id",
      "intentionId",
      "policyVersion",
      "reflection",
      "revisitAt",
      "ritualSessionId",
      "schemaVersion",
    ]) ||
    input.policyVersion !== reflectionPolicyVersion ||
    input.schemaVersion !== reflectionJournalSchemaVersion
  ) {
    return invalidOutput();
  }
  const createdAt = parseInstant(input.createdAt);
  const revisitAt = parseInstant(input.revisitAt);
  const expiresAt = parseInstant(input.expiresAt);
  if (revisitAt <= createdAt || expiresAt <= revisitAt) return invalidOutput();
  return Object.freeze({
    createdAt,
    expiresAt,
    id: parseUuidV4(input.id, true),
    intentionId: parseUuidV4(input.intentionId, true),
    policyVersion: reflectionPolicyVersion,
    reflection: parseOutputPrivateText(input.reflection, reflectionJournalMaximumLength),
    revisitAt,
    ritualSessionId: parseUuidV4(input.ritualSessionId, true),
    schemaVersion: reflectionJournalSchemaVersion,
  });
};
