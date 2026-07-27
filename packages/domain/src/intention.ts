import {
  ReflectionError,
  reflectionIntentionCodes,
  reflectionPolicyVersion,
  reflectionSmallActionMaximumLength,
  type ReflectionIntentionCode,
} from "./reflection.js";

export const reflectionIntentionV2SchemaVersion = "reflection-intention.v2" as const;
export const reflectionIntentionMutationSchemaVersion = "reflection-intention-mutation.v1" as const;
export const reflectionIntentionTextMaximumLength = 280;
export const reflectionIntentionPrivacyState = "private" as const;
export const reflectionIntentionReminderPreference = "none" as const;

export const reflectionIntentionStatuses = Object.freeze([
  "active",
  "completed",
  "archived",
] as const);

export type ReflectionIntentionStatus = (typeof reflectionIntentionStatuses)[number];

export type ReflectionIntentionCreateRequestV2 = Readonly<{
  intentionCode: ReflectionIntentionCode;
  intentionText: string;
  locale: "en";
  privacyState: typeof reflectionIntentionPrivacyState;
  readingId: string | null;
  reminderPreference: typeof reflectionIntentionReminderPreference;
  revisitDate: string | null;
  schemaVersion: typeof reflectionIntentionV2SchemaVersion;
  smallAction: string;
  timeZone: string | null;
}>;

export type ReflectionIntentionEditMutationV1 = Readonly<{
  action: "edit";
  expectedRevision: number;
  intentionCode: ReflectionIntentionCode;
  intentionText: string;
  privacyState: typeof reflectionIntentionPrivacyState;
  reminderPreference: typeof reflectionIntentionReminderPreference;
  revisitDate: string | null;
  schemaVersion: typeof reflectionIntentionMutationSchemaVersion;
  smallAction: string;
  timeZone: string | null;
}>;

export type ReflectionIntentionStateMutationV1 = Readonly<{
  action: "archive" | "complete" | "delete";
  expectedRevision: number;
  schemaVersion: typeof reflectionIntentionMutationSchemaVersion;
}>;

export type ReflectionIntentionMutationRequestV1 =
  ReflectionIntentionEditMutationV1 | ReflectionIntentionStateMutationV1;

export type ReflectionIntentionResourceV2 = Readonly<{
  createdAt: string;
  expiresAt: string;
  id: string;
  intentionCode: ReflectionIntentionCode;
  intentionText: string;
  locale: "en";
  policyVersion: typeof reflectionPolicyVersion;
  privacyState: typeof reflectionIntentionPrivacyState;
  readingId: string | null;
  reminderPreference: typeof reflectionIntentionReminderPreference;
  revisitDate: string | null;
  revision: number;
  schemaVersion: typeof reflectionIntentionV2SchemaVersion;
  smallAction: string;
  status: ReflectionIntentionStatus;
  timeZone: string | null;
  updatedAt: string;
}>;

export type ReflectionIntentionAgencyResult =
  | Readonly<{ kind: "accepted"; intentionText: string }>
  | Readonly<{ kind: "reframe_required"; suggestedIntentionText: string }>;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const forbiddenPrivateText =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff]/u;
const coerciveControlPatterns = Object.freeze([
  /\b(?:force|compel|control|manipulate)\s+(?:him|her|them|someone|my\s+(?:partner|ex|boss|friend|family))\b/iu,
  /\bmake\s+(?:him|her|them|someone|my\s+(?:partner|ex|boss|friend|family))\b/iu,
  /\bget\s+(?:him|her|them|someone|my\s+(?:partner|ex|boss|friend|family))\s+to\b/iu,
  /\b(?:bring|get|win)\s+(?:my\s+)?ex\s+back\b/iu,
  /\b(?:make|force)\s+(?:him|her|them|someone)\b[\s\S]{0,80}\b(?:love|choose|contact|return|obey|agree|forgive)\b/iu,
] as const);
const incompleteTemplatePattern =
  /^(?:i intend to|i will practice|i am willing to)(?:\s*(?:…|\.{3}))?$/iu;

const reviewedReframeFor = (intentionCode: ReflectionIntentionCode): string => {
  switch (intentionCode) {
    case "calm_clarity":
      return "I intend to respond with calm and clarity.";
    case "connection_understanding":
      return "I intend to communicate honestly while respecting their choice.";
    case "courage_action":
      return "I intend to take one courageous action that remains within my control.";
    case "gratitude_abundance":
      return "I intend to notice and appreciate what is already present.";
    case "release_renewal":
      return "I intend to release what I cannot control and choose my next kind step.";
  }
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, required: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => Object.hasOwn(value, key));
};

const invalidInput = (): never => {
  throw new ReflectionError("REFLECTION_INPUT_INVALID");
};

const invalidOutput = (): never => {
  throw new ReflectionError("REFLECTION_OUTPUT_INVALID");
};

const normalizePrivateText = (value: unknown, maximumLength: number, output = false): string => {
  if (typeof value !== "string") return output ? invalidOutput() : invalidInput();
  const normalized = value.normalize("NFKC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    forbiddenPrivateText.test(normalized)
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return normalized;
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

const parseDate = (value: unknown, output = false): string => {
  if (typeof value !== "string" || !isoDatePattern.test(value)) {
    return output ? invalidOutput() : invalidInput();
  }
  const milliseconds = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString().slice(0, 10) !== value
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseTimeZone = (value: unknown, output = false): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 100) {
    return output ? invalidOutput() : invalidInput();
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
  } catch {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseSchedule = (
  revisitDate: unknown,
  timeZone: unknown,
  output = false,
): Readonly<{ revisitDate: string | null; timeZone: string | null }> => {
  if (revisitDate === null && timeZone === null) {
    return Object.freeze({ revisitDate: null, timeZone: null });
  }
  if (revisitDate === null || timeZone === null) {
    return output ? invalidOutput() : invalidInput();
  }
  return Object.freeze({
    revisitDate: parseDate(revisitDate, output),
    timeZone: parseTimeZone(timeZone, output),
  });
};

const parseRevision = (value: unknown, output = false): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 2_147_483_647) {
    return output ? invalidOutput() : invalidInput();
  }
  return value as number;
};

const parseIntentionCode = (value: unknown, output = false): ReflectionIntentionCode => {
  if (
    typeof value !== "string" ||
    !reflectionIntentionCodes.some((candidate) => candidate === value)
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return value as ReflectionIntentionCode;
};

export const evaluateReflectionIntentionAgencyV1 = (
  value: unknown,
  intentionCode: ReflectionIntentionCode,
): ReflectionIntentionAgencyResult => {
  const intentionText = normalizePrivateText(value, reflectionIntentionTextMaximumLength);
  if (incompleteTemplatePattern.test(intentionText)) return invalidInput();
  return coerciveControlPatterns.some((pattern) => pattern.test(intentionText))
    ? Object.freeze({
        kind: "reframe_required",
        suggestedIntentionText: reviewedReframeFor(intentionCode),
      })
    : Object.freeze({ intentionText, kind: "accepted" });
};

const parseAgencyOwnedText = (
  value: unknown,
  intentionCode: ReflectionIntentionCode,
  output = false,
): string => {
  try {
    const result = evaluateReflectionIntentionAgencyV1(value, intentionCode);
    if (result.kind === "reframe_required") return output ? invalidOutput() : invalidInput();
    return result.intentionText;
  } catch {
    return output ? invalidOutput() : invalidInput();
  }
};

export const parseReflectionIntentionCreateRequestV2 = (
  value: unknown,
): ReflectionIntentionCreateRequestV2 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "intentionCode",
      "intentionText",
      "locale",
      "privacyState",
      "readingId",
      "reminderPreference",
      "revisitDate",
      "schemaVersion",
      "smallAction",
      "timeZone",
    ]) ||
    input.locale !== "en" ||
    input.privacyState !== reflectionIntentionPrivacyState ||
    input.reminderPreference !== reflectionIntentionReminderPreference ||
    input.schemaVersion !== reflectionIntentionV2SchemaVersion
  ) {
    return invalidInput();
  }
  const intentionCode = parseIntentionCode(input.intentionCode);
  const schedule = parseSchedule(input.revisitDate, input.timeZone);
  return Object.freeze({
    intentionCode,
    intentionText: parseAgencyOwnedText(input.intentionText, intentionCode),
    locale: "en",
    privacyState: reflectionIntentionPrivacyState,
    readingId: input.readingId === null ? null : parseUuidV4(input.readingId),
    reminderPreference: reflectionIntentionReminderPreference,
    revisitDate: schedule.revisitDate,
    schemaVersion: reflectionIntentionV2SchemaVersion,
    smallAction: normalizePrivateText(input.smallAction, reflectionSmallActionMaximumLength),
    timeZone: schedule.timeZone,
  });
};

export const canonicalizeReflectionIntentionCreateRequestV2 = (
  value: ReflectionIntentionCreateRequestV2,
): string => {
  const request = parseReflectionIntentionCreateRequestV2(value);
  return JSON.stringify({
    intentionCode: request.intentionCode,
    intentionText: request.intentionText,
    locale: request.locale,
    privacyState: request.privacyState,
    readingId: request.readingId,
    reminderPreference: request.reminderPreference,
    revisitDate: request.revisitDate,
    schemaVersion: request.schemaVersion,
    smallAction: request.smallAction,
    timeZone: request.timeZone,
  });
};

export const parseReflectionIntentionMutationRequestV1 = (
  value: unknown,
): ReflectionIntentionMutationRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    input.schemaVersion !== reflectionIntentionMutationSchemaVersion ||
    (input.action !== "edit" &&
      input.action !== "archive" &&
      input.action !== "complete" &&
      input.action !== "delete")
  ) {
    return invalidInput();
  }
  if (input.action !== "edit") {
    if (!hasExactKeys(input, ["action", "expectedRevision", "schemaVersion"])) {
      return invalidInput();
    }
    return Object.freeze({
      action: input.action,
      expectedRevision: parseRevision(input.expectedRevision),
      schemaVersion: reflectionIntentionMutationSchemaVersion,
    });
  }
  if (
    !hasExactKeys(input, [
      "action",
      "expectedRevision",
      "intentionCode",
      "intentionText",
      "privacyState",
      "reminderPreference",
      "revisitDate",
      "schemaVersion",
      "smallAction",
      "timeZone",
    ]) ||
    input.privacyState !== reflectionIntentionPrivacyState ||
    input.reminderPreference !== reflectionIntentionReminderPreference
  ) {
    return invalidInput();
  }
  const intentionCode = parseIntentionCode(input.intentionCode);
  const schedule = parseSchedule(input.revisitDate, input.timeZone);
  return Object.freeze({
    action: "edit",
    expectedRevision: parseRevision(input.expectedRevision),
    intentionCode,
    intentionText: parseAgencyOwnedText(input.intentionText, intentionCode),
    privacyState: reflectionIntentionPrivacyState,
    reminderPreference: reflectionIntentionReminderPreference,
    revisitDate: schedule.revisitDate,
    schemaVersion: reflectionIntentionMutationSchemaVersion,
    smallAction: normalizePrivateText(input.smallAction, reflectionSmallActionMaximumLength),
    timeZone: schedule.timeZone,
  });
};

export const canonicalizeReflectionIntentionMutationRequestV1 = (
  value: ReflectionIntentionMutationRequestV1,
): string => {
  const request = parseReflectionIntentionMutationRequestV1(value);
  return request.action === "edit"
    ? JSON.stringify({
        action: request.action,
        expectedRevision: request.expectedRevision,
        intentionCode: request.intentionCode,
        intentionText: request.intentionText,
        privacyState: request.privacyState,
        reminderPreference: request.reminderPreference,
        revisitDate: request.revisitDate,
        schemaVersion: request.schemaVersion,
        smallAction: request.smallAction,
        timeZone: request.timeZone,
      })
    : JSON.stringify({
        action: request.action,
        expectedRevision: request.expectedRevision,
        schemaVersion: request.schemaVersion,
      });
};

export const parseReflectionIntentionResourceV2 = (
  value: unknown,
): ReflectionIntentionResourceV2 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "createdAt",
      "expiresAt",
      "id",
      "intentionCode",
      "intentionText",
      "locale",
      "policyVersion",
      "privacyState",
      "readingId",
      "reminderPreference",
      "revisitDate",
      "revision",
      "schemaVersion",
      "smallAction",
      "status",
      "timeZone",
      "updatedAt",
    ]) ||
    input.locale !== "en" ||
    input.policyVersion !== reflectionPolicyVersion ||
    input.privacyState !== reflectionIntentionPrivacyState ||
    input.reminderPreference !== reflectionIntentionReminderPreference ||
    input.schemaVersion !== reflectionIntentionV2SchemaVersion ||
    !reflectionIntentionStatuses.some((status) => status === input.status)
  ) {
    return invalidOutput();
  }
  const createdAt = parseInstant(input.createdAt);
  const updatedAt = parseInstant(input.updatedAt);
  const expiresAt = parseInstant(input.expiresAt);
  if (updatedAt < createdAt || expiresAt <= updatedAt) return invalidOutput();
  const intentionCode = parseIntentionCode(input.intentionCode, true);
  const schedule = parseSchedule(input.revisitDate, input.timeZone, true);
  return Object.freeze({
    createdAt,
    expiresAt,
    id: parseUuidV4(input.id, true),
    intentionCode,
    intentionText: parseAgencyOwnedText(input.intentionText, intentionCode, true),
    locale: "en",
    policyVersion: reflectionPolicyVersion,
    privacyState: reflectionIntentionPrivacyState,
    readingId: input.readingId === null ? null : parseUuidV4(input.readingId, true),
    reminderPreference: reflectionIntentionReminderPreference,
    revisitDate: schedule.revisitDate,
    revision: parseRevision(input.revision, true),
    schemaVersion: reflectionIntentionV2SchemaVersion,
    smallAction: normalizePrivateText(input.smallAction, reflectionSmallActionMaximumLength, true),
    status: input.status as ReflectionIntentionStatus,
    timeZone: schedule.timeZone,
    updatedAt,
  });
};
