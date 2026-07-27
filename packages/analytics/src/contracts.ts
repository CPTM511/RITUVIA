import { snapshotOwnEnumerableData } from "@rituvia/observability";

export const coreLoopEventSchemaVersion = "core-loop-event.v1" as const;
export const coreLoopAnalyticsConsentPurpose = "optional_product_analytics" as const;
export const coreLoopAnalyticsConsentNoticeVersion = "rituvia.analytics-notice.v1" as const;

export const coreLoopEventNames = Object.freeze([
  "reading_started",
  "reading_deterministic_completed",
  "interpretation_viewed",
  "intention_created",
  "ritual_started",
  "ritual_completed",
  "journal_entry_created",
  "revisit_scheduled",
  "revisit_completed",
] as const);

export type CoreLoopEventName = (typeof coreLoopEventNames)[number];
export type CoreLoopEventSource = "client" | "server";

type EventCommon = Readonly<{
  analyticsSessionKey: string;
  analyticsSubjectKey: string;
  consentNoticeVersion: typeof coreLoopAnalyticsConsentNoticeVersion;
  consentPurpose: typeof coreLoopAnalyticsConsentPurpose;
  eventId: string;
  eventName: CoreLoopEventName;
  locale: "en";
  occurredAt: string;
  reflectionSessionKey: string;
  schemaVersion: typeof coreLoopEventSchemaVersion;
  source: CoreLoopEventSource;
}>;

export type ReadingStartedEvent = EventCommon &
  Readonly<{
    eventName: "reading_started";
    properties: Readonly<{
      modality: "tarot";
      readingPolicyVersion: string;
      readingType: "one_card" | "three_card";
    }>;
  }>;

export type ReadingDeterministicCompletedEvent = EventCommon &
  Readonly<{
    eventName: "reading_deterministic_completed";
    properties: Readonly<{
      catalogVersion: string;
      engineVersion: string;
      modality: "tarot";
      readingPolicyVersion: string;
      readingType: "one_card" | "three_card";
    }>;
  }>;

export type InterpretationViewedEvent = EventCommon &
  Readonly<{
    eventName: "interpretation_viewed";
    properties: Readonly<{
      contentVersion: string;
      fallbackUsed: boolean;
      interpretationKind: "reviewed_fallback" | "verified";
    }>;
  }>;

export type IntentionCreatedEvent = EventCommon &
  Readonly<{
    eventName: "intention_created";
    properties: Readonly<{
      intentionCode:
        | "calm_clarity"
        | "connection_understanding"
        | "courage_action"
        | "gratitude_abundance"
        | "release_renewal";
    }>;
  }>;

export type RitualEvent = EventCommon &
  Readonly<{
    eventName: "ritual_completed" | "ritual_started";
    properties: Readonly<{
      accessCategory: "consumable_pass" | "free" | "permanent_entitlement";
      ritualItemCode: string;
      templateVersion: string;
    }>;
  }>;

export type JournalEntryCreatedEvent = EventCommon &
  Readonly<{
    eventName: "journal_entry_created";
    properties: Readonly<Record<never, never>>;
  }>;

export type RevisitScheduledEvent = EventCommon &
  Readonly<{
    eventName: "revisit_scheduled";
    properties: Readonly<{
      scheduleKind: "custom" | "next_day" | "seven_days";
    }>;
  }>;

export type RevisitCompletedEvent = EventCommon &
  Readonly<{
    eventName: "revisit_completed";
    properties: Readonly<Record<never, never>>;
  }>;

export type CoreLoopEvent =
  | IntentionCreatedEvent
  | InterpretationViewedEvent
  | JournalEntryCreatedEvent
  | ReadingDeterministicCompletedEvent
  | ReadingStartedEvent
  | RevisitCompletedEvent
  | RevisitScheduledEvent
  | RitualEvent;

const pseudonymPattern = /^(?:evt|flow|ses|sub)_[A-Za-z0-9_-]{43}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;

export class CoreLoopAnalyticsContractError extends Error {
  constructor() {
    super("The core-loop analytics event is invalid.");
    this.name = "CoreLoopAnalyticsContractError";
  }
}

const invalid = (): never => {
  throw new CoreLoopAnalyticsContractError();
};

const ownDataRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  const snapshot = snapshotOwnEnumerableData(value);
  if (snapshot === null) return invalid();
  return Object.freeze(Object.fromEntries(snapshot));
};

const exact = (value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> => {
  const record = ownDataRecord(value);
  const actual = Object.keys(record);
  if (actual.length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
    return invalid();
  }
  return record;
};

const parsePseudonym = (value: unknown, prefix: "evt" | "flow" | "ses" | "sub"): string => {
  if (
    typeof value !== "string" ||
    !value.startsWith(`${prefix}_`) ||
    !pseudonymPattern.test(value)
  ) {
    return invalid();
  }
  return value;
};

const parseInstant = (value: unknown): string => {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) return invalid();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return invalid();
  }
  return value;
};

const parseIdentifier = (value: unknown): string => {
  if (typeof value !== "string" || value.length > 120 || !identifierPattern.test(value)) {
    return invalid();
  }
  return value;
};

const parseVersion = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length > 120 ||
    (!semanticVersionPattern.test(value) && !identifierPattern.test(value))
  ) {
    return invalid();
  }
  return value;
};

const oneOf = <Value extends string>(value: unknown, values: readonly Value[]): Value => {
  if (typeof value !== "string" || !values.some((candidate) => candidate === value)) {
    return invalid();
  }
  return value as Value;
};

const parseProperties = (
  eventName: CoreLoopEventName,
  value: unknown,
): CoreLoopEvent["properties"] => {
  switch (eventName) {
    case "reading_started": {
      const properties = exact(value, ["modality", "readingPolicyVersion", "readingType"]);
      return Object.freeze({
        modality: oneOf(properties.modality, ["tarot"] as const),
        readingPolicyVersion: parseIdentifier(properties.readingPolicyVersion),
        readingType: oneOf(properties.readingType, ["one_card", "three_card"] as const),
      });
    }
    case "reading_deterministic_completed": {
      const properties = exact(value, [
        "catalogVersion",
        "engineVersion",
        "modality",
        "readingPolicyVersion",
        "readingType",
      ]);
      return Object.freeze({
        catalogVersion: parseVersion(properties.catalogVersion),
        engineVersion: parseVersion(properties.engineVersion),
        modality: oneOf(properties.modality, ["tarot"] as const),
        readingPolicyVersion: parseIdentifier(properties.readingPolicyVersion),
        readingType: oneOf(properties.readingType, ["one_card", "three_card"] as const),
      });
    }
    case "interpretation_viewed": {
      const properties = exact(value, ["contentVersion", "fallbackUsed", "interpretationKind"]);
      const interpretationKind = oneOf(properties.interpretationKind, [
        "reviewed_fallback",
        "verified",
      ] as const);
      if (
        typeof properties.fallbackUsed !== "boolean" ||
        properties.fallbackUsed !== (interpretationKind === "reviewed_fallback")
      ) {
        return invalid();
      }
      return Object.freeze({
        contentVersion: parseVersion(properties.contentVersion),
        fallbackUsed: properties.fallbackUsed,
        interpretationKind,
      });
    }
    case "intention_created": {
      const properties = exact(value, ["intentionCode"]);
      return Object.freeze({
        intentionCode: oneOf(properties.intentionCode, [
          "calm_clarity",
          "connection_understanding",
          "courage_action",
          "gratitude_abundance",
          "release_renewal",
        ] as const),
      });
    }
    case "ritual_started":
    case "ritual_completed": {
      const properties = exact(value, ["accessCategory", "ritualItemCode", "templateVersion"]);
      return Object.freeze({
        accessCategory: oneOf(properties.accessCategory, [
          "consumable_pass",
          "free",
          "permanent_entitlement",
        ] as const),
        ritualItemCode: parseIdentifier(properties.ritualItemCode),
        templateVersion: parseVersion(properties.templateVersion),
      });
    }
    case "journal_entry_created":
    case "revisit_completed":
      exact(value, []);
      return Object.freeze({});
    case "revisit_scheduled": {
      const properties = exact(value, ["scheduleKind"]);
      return Object.freeze({
        scheduleKind: oneOf(properties.scheduleKind, ["custom", "next_day", "seven_days"] as const),
      });
    }
  }
};

export const parseCoreLoopEvent = (value: unknown): CoreLoopEvent => {
  const event = exact(value, [
    "analyticsSessionKey",
    "analyticsSubjectKey",
    "consentNoticeVersion",
    "consentPurpose",
    "eventId",
    "eventName",
    "locale",
    "occurredAt",
    "properties",
    "reflectionSessionKey",
    "schemaVersion",
    "source",
  ]);
  const eventName = oneOf(event.eventName, coreLoopEventNames);
  if (
    event.schemaVersion !== coreLoopEventSchemaVersion ||
    event.consentPurpose !== coreLoopAnalyticsConsentPurpose ||
    event.consentNoticeVersion !== coreLoopAnalyticsConsentNoticeVersion ||
    event.locale !== "en"
  ) {
    return invalid();
  }
  return Object.freeze({
    analyticsSessionKey: parsePseudonym(event.analyticsSessionKey, "ses"),
    analyticsSubjectKey: parsePseudonym(event.analyticsSubjectKey, "sub"),
    consentNoticeVersion: coreLoopAnalyticsConsentNoticeVersion,
    consentPurpose: coreLoopAnalyticsConsentPurpose,
    eventId: parsePseudonym(event.eventId, "evt"),
    eventName,
    locale: "en",
    occurredAt: parseInstant(event.occurredAt),
    properties: parseProperties(eventName, event.properties),
    reflectionSessionKey: parsePseudonym(event.reflectionSessionKey, "flow"),
    schemaVersion: coreLoopEventSchemaVersion,
    source: oneOf(event.source, ["client", "server"] as const),
  }) as CoreLoopEvent;
};
