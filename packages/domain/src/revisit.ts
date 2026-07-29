import { reflectionPolicyVersion } from "./reflection.js";

export const revisitSchemaVersion = "reflection-revisit.v1" as const;
export const revisitMutationSchemaVersion = "reflection-revisit-mutation.v1" as const;
export const revisitReminderPreference = "none" as const;
export const revisitMaximumReflectionLength = 3_000;
export const revisitMaximumOutcomeTags = 3;

export const revisitScheduleKinds = Object.freeze(["next_day", "seven_days", "custom"] as const);
export const revisitStatuses = Object.freeze(["scheduled", "completed", "archived"] as const);
export const revisitOutcomeTags = Object.freeze([
  "action_taken",
  "partial_progress",
  "changed_direction",
  "not_yet",
  "released",
] as const);

export type RevisitScheduleKind = (typeof revisitScheduleKinds)[number];
export type RevisitStatus = (typeof revisitStatuses)[number];
export type RevisitOutcomeTag = (typeof revisitOutcomeTags)[number];

export type RevisitQuietHoursV1 = Readonly<{
  endLocalTime: string;
  startLocalTime: string;
}>;

export type RevisitScheduleRequestV1 = Readonly<{
  customDate: string | null;
  intentionId: string;
  quietHours: RevisitQuietHoursV1 | null;
  reminderChannel: null;
  reminderPreference: typeof revisitReminderPreference;
  scheduleKind: RevisitScheduleKind;
  schemaVersion: typeof revisitSchemaVersion;
  timeZone: string;
}>;

export type RevisitRescheduleMutationV1 = Readonly<{
  action: "reschedule";
  customDate: string | null;
  expectedRevision: number;
  quietHours: RevisitQuietHoursV1 | null;
  reminderChannel: null;
  reminderPreference: typeof revisitReminderPreference;
  scheduleKind: RevisitScheduleKind;
  schemaVersion: typeof revisitMutationSchemaVersion;
  timeZone: string;
}>;

export type RevisitCompleteMutationV1 = Readonly<{
  action: "complete";
  expectedRevision: number;
  outcomeTags: readonly RevisitOutcomeTag[];
  reflection: string;
  schemaVersion: typeof revisitMutationSchemaVersion;
}>;

export type RevisitArchiveMutationV1 = Readonly<{
  action: "archive";
  expectedRevision: number;
  schemaVersion: typeof revisitMutationSchemaVersion;
}>;

export type RevisitDeleteMutationV1 = Readonly<{
  action: "delete";
  expectedRevision: number;
  schemaVersion: typeof revisitMutationSchemaVersion;
}>;

export type RevisitMutationRequestV1 =
  | RevisitArchiveMutationV1
  | RevisitCompleteMutationV1
  | RevisitDeleteMutationV1
  | RevisitRescheduleMutationV1;

export type RevisitResourceV1 = Readonly<{
  archivedAt: string | null;
  completedAt: string | null;
  completionReflection: string | null;
  createdAt: string;
  expiresAt: string;
  id: string;
  intentionId: string;
  intentionRevision: number;
  intentionText: string;
  isDue: boolean;
  outcomeTags: readonly RevisitOutcomeTag[];
  policyVersion: typeof reflectionPolicyVersion;
  quietHours: RevisitQuietHoursV1 | null;
  reminderChannel: null;
  reminderPreference: typeof revisitReminderPreference;
  revision: number;
  scheduledLocalDate: string;
  scheduleKind: RevisitScheduleKind;
  schemaVersion: typeof revisitSchemaVersion;
  smallAction: string;
  status: RevisitStatus;
  timeZone: string;
  updatedAt: string;
}>;

export type RevisitStateV1 = Readonly<{
  completionPresent: boolean;
  deleted: boolean;
  revision: number;
  status: RevisitStatus;
}>;

export class RevisitContractError extends Error {
  readonly code: "REVISIT_INPUT_INVALID" | "REVISIT_OUTPUT_INVALID";

  constructor(code: "REVISIT_INPUT_INVALID" | "REVISIT_OUTPUT_INVALID") {
    super("The private Revisit contract is invalid.");
    this.name = "RevisitContractError";
    this.code = code;
  }
}

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const forbiddenPrivateText =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff]/u;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, required: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) => Object.hasOwn(value, key));
};

const invalidInput = (): never => {
  throw new RevisitContractError("REVISIT_INPUT_INVALID");
};

const invalidOutput = (): never => {
  throw new RevisitContractError("REVISIT_OUTPUT_INVALID");
};

const includes = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.some((candidate) => candidate === value);

const parseUuid = (value: unknown, output = false): string => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseRevision = (value: unknown, output = false): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 2_147_483_647) {
    return output ? invalidOutput() : invalidInput();
  }
  return value as number;
};

const parseDate = (value: unknown, output = false): string => {
  if (typeof value !== "string" || !isoDatePattern.test(value)) {
    return output ? invalidOutput() : invalidInput();
  }
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== value) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseInstant = (value: unknown): string => {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) return invalidOutput();
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value) {
    return invalidOutput();
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

const normalizePrivateText = (value: unknown, output = false): string => {
  if (typeof value !== "string") return output ? invalidOutput() : invalidInput();
  const normalized = value.normalize("NFC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (
    normalized.length < 1 ||
    Array.from(normalized).length > revisitMaximumReflectionLength ||
    forbiddenPrivateText.test(normalized)
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return normalized;
};

const parseSnapshotText = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    Array.from(value).length > 280 ||
    forbiddenPrivateText.test(value)
  ) {
    return invalidOutput();
  }
  return value;
};

const parseQuietHours = (value: unknown, output = false): RevisitQuietHoursV1 | null => {
  if (value === null) return null;
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["endLocalTime", "startLocalTime"]) ||
    typeof input.endLocalTime !== "string" ||
    typeof input.startLocalTime !== "string" ||
    !localTimePattern.test(input.endLocalTime) ||
    !localTimePattern.test(input.startLocalTime) ||
    input.endLocalTime === input.startLocalTime
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return Object.freeze({
    endLocalTime: input.endLocalTime,
    startLocalTime: input.startLocalTime,
  });
};

const parseSchedule = (
  input: Record<string, unknown>,
  output = false,
): Readonly<{
  customDate: string | null;
  quietHours: RevisitQuietHoursV1 | null;
  scheduleKind: RevisitScheduleKind;
  timeZone: string;
}> => {
  if (
    !includes(revisitScheduleKinds, input.scheduleKind) ||
    input.reminderPreference !== revisitReminderPreference ||
    input.reminderChannel !== null
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  const customDate =
    input.scheduleKind === "custom"
      ? parseDate(input.customDate, output)
      : input.customDate === null
        ? null
        : output
          ? invalidOutput()
          : invalidInput();
  return Object.freeze({
    customDate,
    quietHours: parseQuietHours(input.quietHours, output),
    scheduleKind: input.scheduleKind,
    timeZone: parseTimeZone(input.timeZone, output),
  });
};

const parseOutcomeTags = (value: unknown, output = false): readonly RevisitOutcomeTag[] => {
  if (
    !Array.isArray(value) ||
    value.length > revisitMaximumOutcomeTags ||
    !value.every((candidate) => includes(revisitOutcomeTags, candidate)) ||
    new Set(value).size !== value.length
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return Object.freeze([...value] as RevisitOutcomeTag[]);
};

export const parseRevisitScheduleRequestV1 = (value: unknown): RevisitScheduleRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "customDate",
      "intentionId",
      "quietHours",
      "reminderChannel",
      "reminderPreference",
      "scheduleKind",
      "schemaVersion",
      "timeZone",
    ]) ||
    input.schemaVersion !== revisitSchemaVersion
  ) {
    return invalidInput();
  }
  const schedule = parseSchedule(input);
  return Object.freeze({
    customDate: schedule.customDate,
    intentionId: parseUuid(input.intentionId),
    quietHours: schedule.quietHours,
    reminderChannel: null,
    reminderPreference: revisitReminderPreference,
    scheduleKind: schedule.scheduleKind,
    schemaVersion: revisitSchemaVersion,
    timeZone: schedule.timeZone,
  });
};

export const canonicalizeRevisitScheduleRequestV1 = (value: RevisitScheduleRequestV1): string =>
  JSON.stringify(parseRevisitScheduleRequestV1(value));

export const parseRevisitMutationRequestV1 = (value: unknown): RevisitMutationRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    input.schemaVersion !== revisitMutationSchemaVersion ||
    (input.action !== "reschedule" &&
      input.action !== "complete" &&
      input.action !== "archive" &&
      input.action !== "delete")
  ) {
    return invalidInput();
  }
  if (input.action === "archive" || input.action === "delete") {
    if (!hasExactKeys(input, ["action", "expectedRevision", "schemaVersion"])) {
      return invalidInput();
    }
    return Object.freeze({
      action: input.action,
      expectedRevision: parseRevision(input.expectedRevision),
      schemaVersion: revisitMutationSchemaVersion,
    });
  }
  if (input.action === "complete") {
    if (
      !hasExactKeys(input, [
        "action",
        "expectedRevision",
        "outcomeTags",
        "reflection",
        "schemaVersion",
      ])
    ) {
      return invalidInput();
    }
    return Object.freeze({
      action: "complete",
      expectedRevision: parseRevision(input.expectedRevision),
      outcomeTags: parseOutcomeTags(input.outcomeTags),
      reflection: normalizePrivateText(input.reflection),
      schemaVersion: revisitMutationSchemaVersion,
    });
  }
  if (
    !hasExactKeys(input, [
      "action",
      "customDate",
      "expectedRevision",
      "quietHours",
      "reminderChannel",
      "reminderPreference",
      "scheduleKind",
      "schemaVersion",
      "timeZone",
    ])
  ) {
    return invalidInput();
  }
  const schedule = parseSchedule(input);
  return Object.freeze({
    action: "reschedule",
    customDate: schedule.customDate,
    expectedRevision: parseRevision(input.expectedRevision),
    quietHours: schedule.quietHours,
    reminderChannel: null,
    reminderPreference: revisitReminderPreference,
    scheduleKind: schedule.scheduleKind,
    schemaVersion: revisitMutationSchemaVersion,
    timeZone: schedule.timeZone,
  });
};

export const canonicalizeRevisitMutationRequestV1 = (value: RevisitMutationRequestV1): string =>
  JSON.stringify(parseRevisitMutationRequestV1(value));

export const parseRevisitResourceV1 = (value: unknown): RevisitResourceV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "archivedAt",
      "completedAt",
      "completionReflection",
      "createdAt",
      "expiresAt",
      "id",
      "intentionId",
      "intentionRevision",
      "intentionText",
      "isDue",
      "outcomeTags",
      "policyVersion",
      "quietHours",
      "reminderChannel",
      "reminderPreference",
      "revision",
      "scheduledLocalDate",
      "scheduleKind",
      "schemaVersion",
      "smallAction",
      "status",
      "timeZone",
      "updatedAt",
    ]) ||
    input.policyVersion !== reflectionPolicyVersion ||
    input.reminderChannel !== null ||
    input.reminderPreference !== revisitReminderPreference ||
    input.schemaVersion !== revisitSchemaVersion ||
    !includes(revisitScheduleKinds, input.scheduleKind) ||
    !includes(revisitStatuses, input.status) ||
    typeof input.isDue !== "boolean"
  ) {
    return invalidOutput();
  }
  const createdAt = parseInstant(input.createdAt);
  const updatedAt = parseInstant(input.updatedAt);
  const expiresAt = parseInstant(input.expiresAt);
  const completedAt = input.completedAt === null ? null : parseInstant(input.completedAt);
  const archivedAt = input.archivedAt === null ? null : parseInstant(input.archivedAt);
  const completionReflection =
    input.completionReflection === null
      ? null
      : normalizePrivateText(input.completionReflection, true);
  const outcomeTags = parseOutcomeTags(input.outcomeTags, true);
  if (
    updatedAt < createdAt ||
    expiresAt <= updatedAt ||
    (completedAt === null) !== (completionReflection === null) ||
    (completedAt === null && outcomeTags.length > 0) ||
    (completedAt !== null && (completedAt < createdAt || completedAt > updatedAt)) ||
    (archivedAt !== null &&
      (archivedAt < createdAt ||
        archivedAt > updatedAt ||
        (completedAt !== null && archivedAt < completedAt))) ||
    (input.status === "scheduled" && (completedAt !== null || archivedAt !== null)) ||
    (input.status === "completed" &&
      (completedAt === null || archivedAt !== null || input.isDue !== false)) ||
    (input.status === "archived" && (archivedAt === null || input.isDue !== false))
  ) {
    return invalidOutput();
  }
  return Object.freeze({
    archivedAt,
    completedAt,
    completionReflection,
    createdAt,
    expiresAt,
    id: parseUuid(input.id, true),
    intentionId: parseUuid(input.intentionId, true),
    intentionRevision: parseRevision(input.intentionRevision, true),
    intentionText: parseSnapshotText(input.intentionText),
    isDue: input.isDue,
    outcomeTags,
    policyVersion: reflectionPolicyVersion,
    quietHours: parseQuietHours(input.quietHours, true),
    reminderChannel: null,
    reminderPreference: revisitReminderPreference,
    revision: parseRevision(input.revision, true),
    scheduledLocalDate: parseDate(input.scheduledLocalDate, true),
    scheduleKind: input.scheduleKind,
    schemaVersion: revisitSchemaVersion,
    smallAction: parseSnapshotText(input.smallAction),
    status: input.status,
    timeZone: parseTimeZone(input.timeZone, true),
    updatedAt,
  });
};

const addCalendarDays = (date: string, days: number): string => {
  const instant = Date.parse(`${parseDate(date)}T00:00:00.000Z`);
  return new Date(instant + days * 86_400_000).toISOString().slice(0, 10);
};

export const resolveRevisitScheduledLocalDateV1 = (
  requestValue: RevisitScheduleRequestV1 | RevisitRescheduleMutationV1,
  observedLocalDateValue: string,
): string => {
  const observedLocalDate = parseDate(observedLocalDateValue);
  let request: RevisitScheduleRequestV1 | RevisitRescheduleMutationV1;
  if ("intentionId" in requestValue) {
    request = parseRevisitScheduleRequestV1(requestValue);
  } else {
    const parsed = parseRevisitMutationRequestV1(requestValue);
    if (parsed.action !== "reschedule") return invalidInput();
    request = parsed;
  }
  switch (request.scheduleKind) {
    case "next_day":
      return addCalendarDays(observedLocalDate, 1);
    case "seven_days":
      return addCalendarDays(observedLocalDate, 7);
    case "custom":
      return request.customDate ?? invalidInput();
  }
};

export const isRevisitScheduleWithinWindowV1 = (
  observedLocalDateValue: string,
  scheduledLocalDateValue: string,
  expiresLocalDateValue: string,
): boolean => {
  const observedLocalDate = parseDate(observedLocalDateValue);
  const scheduledLocalDate = parseDate(scheduledLocalDateValue);
  const expiresLocalDate = parseDate(expiresLocalDateValue);
  return scheduledLocalDate > observedLocalDate && scheduledLocalDate < expiresLocalDate;
};

export const isRevisitDueV1 = (
  scheduledLocalDateValue: string,
  observedLocalDateValue: string,
): boolean => parseDate(scheduledLocalDateValue) <= parseDate(observedLocalDateValue);

export const transitionRevisitStateV1 = (
  state: RevisitStateV1,
  requestValue: RevisitMutationRequestV1,
): RevisitStateV1 => {
  const request = parseRevisitMutationRequestV1(requestValue);
  if (
    !includes(revisitStatuses, state.status) ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < 1 ||
    typeof state.deleted !== "boolean" ||
    (state.status === "scheduled" && state.completionPresent) ||
    (state.status === "completed" && !state.completionPresent) ||
    state.deleted ||
    request.expectedRevision !== state.revision
  ) {
    return invalidInput();
  }
  if (request.action === "reschedule") {
    if (state.status !== "scheduled") return invalidInput();
    return Object.freeze({
      completionPresent: false,
      deleted: false,
      revision: state.revision + 1,
      status: "scheduled",
    });
  }
  if (request.action === "complete") {
    if (state.status !== "scheduled") return invalidInput();
    return Object.freeze({
      completionPresent: true,
      deleted: false,
      revision: state.revision + 1,
      status: "completed",
    });
  }
  if (request.action === "delete") {
    return Object.freeze({
      completionPresent: state.completionPresent,
      deleted: true,
      revision: state.revision + 1,
      status: state.status,
    });
  }
  if (state.status === "archived") return invalidInput();
  return Object.freeze({
    completionPresent: state.completionPresent,
    deleted: false,
    revision: state.revision + 1,
    status: "archived",
  });
};
