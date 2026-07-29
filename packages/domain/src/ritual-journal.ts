import {
  freeRitualCatalogItemCodes,
  permanentRitualObjectCodes,
  ritualCatalogItemCodes,
  ritualInteractionCodes,
  ritualTemplateCodes,
  type RitualCatalogItemCode,
  type RitualCatalogItemV1,
  type RitualInteractionCode,
  type RitualTemplateCode,
} from "./ritual.js";
import { reflectionPolicyVersion } from "./reflection.js";

export const ritualSessionSchemaVersion = "ritual-session.v2" as const;
export const ritualSessionMutationSchemaVersion = "ritual-session-mutation.v1" as const;
export const ritualSessionSnapshotSchemaVersion = "ritual-session-snapshot.v1" as const;
export const privateJournalSchemaVersion = "private-journal.v2" as const;
export const privateJournalMutationSchemaVersion = "private-journal-mutation.v1" as const;
export const privateJournalMaximumLength = 3_000;
export const ritualSessionMaximumElapsedSeconds = 86_400;

export const ritualSessionStatuses = Object.freeze([
  "active",
  "paused",
  "completed",
  "abandoned",
] as const);
export const ritualSessionMutationActions = Object.freeze([
  "pause",
  "resume",
  "complete",
  "abandon",
] as const);
export const privateJournalMutationActions = Object.freeze(["update", "delete"] as const);

export type RitualSessionStatus = (typeof ritualSessionStatuses)[number];
export type RitualSessionMutationAction = (typeof ritualSessionMutationActions)[number];
export type PrivateJournalMutationAction = (typeof privateJournalMutationActions)[number];

export type RitualSessionStateV1 = Readonly<{
  currentStepCode: RitualInteractionCode;
  elapsedSeconds: number;
  revision: number;
  status: RitualSessionStatus;
}>;

export type RitualSessionStartRequestV2 = Readonly<{
  intentionId: string;
  itemCode: RitualCatalogItemCode;
  schemaVersion: typeof ritualSessionSchemaVersion;
}>;

export type RitualSessionMutationRequestV1 = Readonly<{
  action: RitualSessionMutationAction;
  currentStepCode: RitualInteractionCode;
  elapsedSeconds: number;
  expectedRevision: number;
  schemaVersion: typeof ritualSessionMutationSchemaVersion;
}>;

export type RitualSessionAccessSnapshotV1 =
  | Readonly<{ kind: "free"; requirementCode: null }>
  | Readonly<{ kind: "permanent_entitlement"; requirementCode: string }>
  | Readonly<{ kind: "consumable_pass"; requirementCode: string }>;

export type RitualSessionSnapshotV1 = Readonly<{
  access: RitualSessionAccessSnapshotV1;
  catalogId: "rituvia-original-secular";
  catalogVersion: string;
  itemCode: RitualCatalogItemCode;
  itemVersion: string;
  publicationId: string;
  schemaVersion: typeof ritualSessionSnapshotSchemaVersion;
  templateCode: RitualTemplateCode;
  templateVersion: string;
}>;

export type RitualSessionResourceV2 = Readonly<{
  abandonedAt: string | null;
  access: RitualSessionAccessSnapshotV1;
  catalogId: "rituvia-original-secular";
  catalogVersion: string;
  completedAt: string | null;
  currentStepCode: RitualInteractionCode;
  elapsedSeconds: number;
  expiresAt: string;
  id: string;
  intentionId: string;
  itemCode: RitualCatalogItemCode;
  itemVersion: string;
  pausedAt: string | null;
  policyVersion: typeof reflectionPolicyVersion;
  publicationId: string;
  revision: number;
  schemaVersion: typeof ritualSessionSchemaVersion;
  startedAt: string;
  status: RitualSessionStatus;
  templateCode: RitualTemplateCode;
  templateVersion: string;
}>;

export type PrivateJournalCreateRequestV2 = Readonly<{
  intentionId: string;
  reflection: string;
  ritualSessionId: string;
  schemaVersion: typeof privateJournalSchemaVersion;
}>;

export type PrivateJournalMutationRequestV1 =
  | Readonly<{
      action: "update";
      expectedRevision: number;
      reflection: string;
      schemaVersion: typeof privateJournalMutationSchemaVersion;
    }>
  | Readonly<{
      action: "delete";
      expectedRevision: number;
      schemaVersion: typeof privateJournalMutationSchemaVersion;
    }>;

export type PrivateJournalResourceV2 = Readonly<{
  createdAt: string;
  expiresAt: string;
  id: string;
  intentionId: string;
  reflection: string;
  revision: number;
  ritualSessionId: string;
  schemaVersion: typeof privateJournalSchemaVersion;
  updatedAt: string;
}>;

export class RitualJournalContractError extends Error {
  readonly code: "RITUAL_JOURNAL_INPUT_INVALID" | "RITUAL_JOURNAL_OUTPUT_INVALID";

  constructor(code: "RITUAL_JOURNAL_INPUT_INVALID" | "RITUAL_JOURNAL_OUTPUT_INVALID") {
    super("The ritual and private journal contract is invalid.");
    this.name = "RitualJournalContractError";
    this.code = code;
  }
}

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const forbiddenPrivateText =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff]/u;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
};

const includes = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === "string" && values.some((candidate) => candidate === value);

const invalidInput = (): never => {
  throw new RitualJournalContractError("RITUAL_JOURNAL_INPUT_INVALID");
};

const invalidOutput = (): never => {
  throw new RitualJournalContractError("RITUAL_JOURNAL_OUTPUT_INVALID");
};

const parseUuid = (value: unknown, output = false): string => {
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

const parseVersion = (value: unknown, output = false): string => {
  if (typeof value !== "string" || !semanticVersionPattern.test(value)) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseIdentifier = (value: unknown, output = false): string => {
  if (typeof value !== "string" || value.length > 120 || !identifierPattern.test(value)) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parsePositiveRevision = (value: unknown, output = false): number => {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 1) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const parseElapsedSeconds = (value: unknown, output = false): number => {
  if (
    !Number.isSafeInteger(value) ||
    typeof value !== "number" ||
    value < 0 ||
    value > ritualSessionMaximumElapsedSeconds
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return value;
};

const normalizePrivateText = (value: unknown, output = false): string => {
  if (typeof value !== "string") return output ? invalidOutput() : invalidInput();
  const normalized = value.normalize("NFC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (
    normalized.length === 0 ||
    Array.from(normalized).length > privateJournalMaximumLength ||
    forbiddenPrivateText.test(normalized)
  ) {
    return output ? invalidOutput() : invalidInput();
  }
  return normalized;
};

const parseAccessSnapshot = (value: unknown, output = false): RitualSessionAccessSnapshotV1 => {
  const input = record(value);
  const fail = output ? invalidOutput : invalidInput;
  if (
    input === null ||
    !hasExactKeys(input, ["kind", "requirementCode"]) ||
    (input.kind !== "free" &&
      input.kind !== "permanent_entitlement" &&
      input.kind !== "consumable_pass")
  ) {
    return fail();
  }
  if (input.kind === "free") {
    if (input.requirementCode !== null) return fail();
    return Object.freeze({ kind: "free", requirementCode: null });
  }
  return Object.freeze({
    kind: input.kind,
    requirementCode: parseIdentifier(input.requirementCode, output),
  });
};

export const createRitualSessionSnapshotV1 = (
  catalogId: "rituvia-original-secular",
  catalogVersion: string,
  item: RitualCatalogItemV1,
): RitualSessionSnapshotV1 =>
  parseRitualSessionSnapshotV1({
    access: item.access,
    catalogId,
    catalogVersion,
    itemCode: item.code,
    itemVersion: item.version,
    publicationId: item.publicationId,
    schemaVersion: ritualSessionSnapshotSchemaVersion,
    templateCode: item.template.code,
    templateVersion: item.template.version,
  });

export const parseRitualSessionStartRequestV2 = (value: unknown): RitualSessionStartRequestV2 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["intentionId", "itemCode", "schemaVersion"]) ||
    input.schemaVersion !== ritualSessionSchemaVersion ||
    !includes(ritualCatalogItemCodes, input.itemCode)
  ) {
    return invalidInput();
  }
  return Object.freeze({
    intentionId: parseUuid(input.intentionId),
    itemCode: input.itemCode,
    schemaVersion: ritualSessionSchemaVersion,
  });
};

export const parseRitualSessionMutationRequestV1 = (
  value: unknown,
): RitualSessionMutationRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "action",
      "currentStepCode",
      "elapsedSeconds",
      "expectedRevision",
      "schemaVersion",
    ]) ||
    input.schemaVersion !== ritualSessionMutationSchemaVersion ||
    !includes(ritualSessionMutationActions, input.action) ||
    !includes(ritualInteractionCodes, input.currentStepCode)
  ) {
    return invalidInput();
  }
  return Object.freeze({
    action: input.action,
    currentStepCode: input.currentStepCode,
    elapsedSeconds: parseElapsedSeconds(input.elapsedSeconds),
    expectedRevision: parsePositiveRevision(input.expectedRevision),
    schemaVersion: ritualSessionMutationSchemaVersion,
  });
};

export const transitionRitualSessionStateV1 = (
  current: RitualSessionStateV1,
  mutation: RitualSessionMutationRequestV1,
): RitualSessionStateV1 => {
  const request = parseRitualSessionMutationRequestV1(mutation);
  if (
    !includes(ritualSessionStatuses, current.status) ||
    !includes(ritualInteractionCodes, current.currentStepCode) ||
    !Number.isSafeInteger(current.elapsedSeconds) ||
    current.elapsedSeconds < 0 ||
    current.elapsedSeconds > ritualSessionMaximumElapsedSeconds ||
    parsePositiveRevision(current.revision) !== request.expectedRevision ||
    request.elapsedSeconds < current.elapsedSeconds ||
    (request.action === "pause" && current.status !== "active") ||
    (request.action === "resume" && current.status !== "paused") ||
    (request.action === "complete" && current.status !== "active" && current.status !== "paused") ||
    (request.action === "complete" && request.currentStepCode !== "complete") ||
    (request.action === "abandon" && current.status !== "active" && current.status !== "paused")
  ) {
    return invalidInput();
  }
  return Object.freeze({
    currentStepCode: request.currentStepCode,
    elapsedSeconds: request.elapsedSeconds,
    revision: current.revision + 1,
    status:
      request.action === "pause"
        ? "paused"
        : request.action === "resume"
          ? "active"
          : request.action === "complete"
            ? "completed"
            : "abandoned",
  });
};

export const parseRitualSessionSnapshotV1 = (value: unknown): RitualSessionSnapshotV1 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "access",
      "catalogId",
      "catalogVersion",
      "itemCode",
      "itemVersion",
      "publicationId",
      "schemaVersion",
      "templateCode",
      "templateVersion",
    ]) ||
    input.schemaVersion !== ritualSessionSnapshotSchemaVersion ||
    input.catalogId !== "rituvia-original-secular" ||
    !includes(ritualCatalogItemCodes, input.itemCode) ||
    !includes(ritualTemplateCodes, input.templateCode)
  ) {
    return invalidInput();
  }
  const access = parseAccessSnapshot(input.access);
  const itemCode = input.itemCode;
  if (
    (includes(freeRitualCatalogItemCodes, itemCode) && access.kind !== "free") ||
    (includes(permanentRitualObjectCodes, itemCode) && access.kind !== "permanent_entitlement") ||
    (!includes(freeRitualCatalogItemCodes, itemCode) &&
      !includes(permanentRitualObjectCodes, itemCode) &&
      access.kind !== "consumable_pass")
  ) {
    return invalidInput();
  }
  return Object.freeze({
    access,
    catalogId: "rituvia-original-secular",
    catalogVersion: parseVersion(input.catalogVersion),
    itemCode,
    itemVersion: parseVersion(input.itemVersion),
    publicationId: parseIdentifier(input.publicationId),
    schemaVersion: ritualSessionSnapshotSchemaVersion,
    templateCode: input.templateCode,
    templateVersion: parseVersion(input.templateVersion),
  });
};

export const parsePrivateJournalCreateRequestV2 = (
  value: unknown,
): PrivateJournalCreateRequestV2 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, ["intentionId", "reflection", "ritualSessionId", "schemaVersion"]) ||
    input.schemaVersion !== privateJournalSchemaVersion
  ) {
    return invalidInput();
  }
  return Object.freeze({
    intentionId: parseUuid(input.intentionId),
    reflection: normalizePrivateText(input.reflection),
    ritualSessionId: parseUuid(input.ritualSessionId),
    schemaVersion: privateJournalSchemaVersion,
  });
};

export const parsePrivateJournalMutationRequestV1 = (
  value: unknown,
): PrivateJournalMutationRequestV1 => {
  const input = record(value);
  if (
    input === null ||
    input.schemaVersion !== privateJournalMutationSchemaVersion ||
    !includes(privateJournalMutationActions, input.action)
  ) {
    return invalidInput();
  }
  if (input.action === "delete") {
    if (!hasExactKeys(input, ["action", "expectedRevision", "schemaVersion"])) {
      return invalidInput();
    }
    return Object.freeze({
      action: "delete",
      expectedRevision: parsePositiveRevision(input.expectedRevision),
      schemaVersion: privateJournalMutationSchemaVersion,
    });
  }
  if (!hasExactKeys(input, ["action", "expectedRevision", "reflection", "schemaVersion"])) {
    return invalidInput();
  }
  return Object.freeze({
    action: "update",
    expectedRevision: parsePositiveRevision(input.expectedRevision),
    reflection: normalizePrivateText(input.reflection),
    schemaVersion: privateJournalMutationSchemaVersion,
  });
};

export const canonicalizeRitualSessionStartRequestV2 = (
  value: RitualSessionStartRequestV2,
): string => {
  const request = parseRitualSessionStartRequestV2(value);
  return JSON.stringify({
    intentionId: request.intentionId,
    itemCode: request.itemCode,
    schemaVersion: request.schemaVersion,
  });
};

export const canonicalizeRitualSessionMutationRequestV1 = (
  value: RitualSessionMutationRequestV1,
): string => {
  const request = parseRitualSessionMutationRequestV1(value);
  return JSON.stringify({
    action: request.action,
    currentStepCode: request.currentStepCode,
    elapsedSeconds: request.elapsedSeconds,
    expectedRevision: request.expectedRevision,
    schemaVersion: request.schemaVersion,
  });
};

export const canonicalizePrivateJournalCreateRequestV2 = (
  value: PrivateJournalCreateRequestV2,
): string => {
  const request = parsePrivateJournalCreateRequestV2(value);
  return JSON.stringify({
    intentionId: request.intentionId,
    reflection: request.reflection,
    ritualSessionId: request.ritualSessionId,
    schemaVersion: request.schemaVersion,
  });
};

export const canonicalizePrivateJournalMutationRequestV1 = (
  value: PrivateJournalMutationRequestV1,
): string => {
  const request = parsePrivateJournalMutationRequestV1(value);
  return request.action === "delete"
    ? JSON.stringify({
        action: "delete",
        expectedRevision: request.expectedRevision,
        schemaVersion: request.schemaVersion,
      })
    : JSON.stringify({
        action: "update",
        expectedRevision: request.expectedRevision,
        reflection: request.reflection,
        schemaVersion: request.schemaVersion,
      });
};

export const parseRitualSessionResourceV2 = (value: unknown): RitualSessionResourceV2 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "abandonedAt",
      "access",
      "catalogId",
      "catalogVersion",
      "completedAt",
      "currentStepCode",
      "elapsedSeconds",
      "expiresAt",
      "id",
      "intentionId",
      "itemCode",
      "itemVersion",
      "pausedAt",
      "policyVersion",
      "publicationId",
      "revision",
      "schemaVersion",
      "startedAt",
      "status",
      "templateCode",
      "templateVersion",
    ]) ||
    input.schemaVersion !== ritualSessionSchemaVersion ||
    !includes(ritualSessionStatuses, input.status) ||
    !includes(ritualCatalogItemCodes, input.itemCode) ||
    !includes(ritualInteractionCodes, input.currentStepCode) ||
    !includes(ritualTemplateCodes, input.templateCode)
  ) {
    return invalidOutput();
  }
  const startedAt = parseInstant(input.startedAt);
  const expiresAt = parseInstant(input.expiresAt);
  const pausedAt = input.pausedAt === null ? null : parseInstant(input.pausedAt);
  const completedAt = input.completedAt === null ? null : parseInstant(input.completedAt);
  const abandonedAt = input.abandonedAt === null ? null : parseInstant(input.abandonedAt);
  if (
    expiresAt <= startedAt ||
    (pausedAt !== null && (pausedAt < startedAt || pausedAt > expiresAt)) ||
    (completedAt !== null && (completedAt < startedAt || completedAt > expiresAt)) ||
    (abandonedAt !== null && (abandonedAt < startedAt || abandonedAt > expiresAt)) ||
    (input.status === "active" &&
      (pausedAt !== null || completedAt !== null || abandonedAt !== null)) ||
    (input.status === "paused" &&
      (pausedAt === null || completedAt !== null || abandonedAt !== null)) ||
    (input.status === "completed" &&
      (pausedAt !== null || completedAt === null || abandonedAt !== null)) ||
    (input.status === "abandoned" &&
      (pausedAt !== null || completedAt !== null || abandonedAt === null))
  ) {
    return invalidOutput();
  }
  return Object.freeze({
    abandonedAt,
    access: parseAccessSnapshot(input.access, true),
    catalogId:
      input.catalogId === "rituvia-original-secular" ? "rituvia-original-secular" : invalidOutput(),
    catalogVersion: parseVersion(input.catalogVersion, true),
    completedAt,
    currentStepCode: input.currentStepCode,
    elapsedSeconds: parseElapsedSeconds(input.elapsedSeconds, true),
    expiresAt,
    id: parseUuid(input.id, true),
    intentionId: parseUuid(input.intentionId, true),
    itemCode: input.itemCode,
    itemVersion: parseVersion(input.itemVersion, true),
    pausedAt,
    policyVersion:
      input.policyVersion === reflectionPolicyVersion ? reflectionPolicyVersion : invalidOutput(),
    publicationId: parseIdentifier(input.publicationId, true),
    revision: parsePositiveRevision(input.revision, true),
    schemaVersion: ritualSessionSchemaVersion,
    startedAt,
    status: input.status,
    templateCode: input.templateCode,
    templateVersion: parseVersion(input.templateVersion, true),
  });
};

export const parsePrivateJournalResourceV2 = (value: unknown): PrivateJournalResourceV2 => {
  const input = record(value);
  if (
    input === null ||
    !hasExactKeys(input, [
      "createdAt",
      "expiresAt",
      "id",
      "intentionId",
      "reflection",
      "revision",
      "ritualSessionId",
      "schemaVersion",
      "updatedAt",
    ]) ||
    input.schemaVersion !== privateJournalSchemaVersion
  ) {
    return invalidOutput();
  }
  const createdAt = parseInstant(input.createdAt);
  const updatedAt = parseInstant(input.updatedAt);
  const expiresAt = parseInstant(input.expiresAt);
  if (updatedAt < createdAt || expiresAt <= updatedAt) return invalidOutput();
  return Object.freeze({
    createdAt,
    expiresAt,
    id: parseUuid(input.id, true),
    intentionId: parseUuid(input.intentionId, true),
    reflection: normalizePrivateText(input.reflection, true),
    revision: parsePositiveRevision(input.revision, true),
    ritualSessionId: parseUuid(input.ritualSessionId, true),
    schemaVersion: privateJournalSchemaVersion,
    updatedAt,
  });
};
