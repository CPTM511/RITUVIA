import {
  accountConsentNoticeVersionFor,
  accountConsentPurposes,
  questionIntakeThemeCodes,
  type AccountConsentPurpose,
  type QuestionIntakeThemeCode,
} from "@rituvia/domain";

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const cursorPattern = /^[A-Za-z0-9_-]{1,512}$/u;
const themeCodes = new Set<string>(questionIntakeThemeCodes);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...keys].sort().join("\u0000");

const isUtcInstant = (value: unknown): value is string => {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

const isUuidV4 = (value: unknown): value is string =>
  typeof value === "string" && uuidV4Pattern.test(value);

export type AccountReadingSummary = Readonly<{
  createdAt: string;
  id: string;
  readingType: "one_card" | "three_card";
  themeCode: QuestionIntakeThemeCode;
}>;

export type AccountReadingPage = Readonly<{
  items: readonly AccountReadingSummary[];
  nextCursor: string | null;
}>;

export type AccountHistorySummary = Readonly<{
  occurredAt: string;
  readingType: "one_card" | "three_card" | null;
  resourceId: string;
  resourceType: "intention" | "journal" | "reading" | "revisit" | "ritual";
  status:
    "abandoned" | "active" | "archived" | "completed" | "facts_ready" | "paused" | "scheduled";
  themeCode: QuestionIntakeThemeCode | null;
}>;

export type AccountHistoryPage = Readonly<{
  items: readonly AccountHistorySummary[];
  nextCursor: string | null;
}>;

export type AccountSessionSummary = Readonly<{
  createdAt: string;
  current: boolean;
  expiresAt: string;
  id: string;
  lastSeenAt: string;
}>;

export type AccountConsentControl = Readonly<{
  granted: boolean;
  noticeVersion: string;
  purpose: AccountConsentPurpose;
  recordedAt: string | null;
}>;

const parseAccountConsentControl = (value: unknown): AccountConsentControl | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["granted", "noticeVersion", "purpose", "recordedAt"]) ||
    !accountConsentPurposes.includes(value.purpose as AccountConsentPurpose)
  ) {
    return null;
  }
  const purpose = value.purpose as AccountConsentPurpose;
  if (
    typeof value.granted !== "boolean" ||
    value.noticeVersion !== accountConsentNoticeVersionFor(purpose) ||
    (value.recordedAt !== null && !isUtcInstant(value.recordedAt))
  ) {
    return null;
  }
  return Object.freeze({
    granted: value.granted,
    noticeVersion: accountConsentNoticeVersionFor(purpose),
    purpose,
    recordedAt: value.recordedAt,
  });
};

export const parseAccountConsentControlResponse = (
  value: unknown,
): AccountConsentControl | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["control", "schemaVersion"]) ||
    value.schemaVersion !== 1
  ) {
    return null;
  }
  return parseAccountConsentControl(value.control);
};

export const parseAccountConsentControls = (
  value: unknown,
): readonly AccountConsentControl[] | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["controls", "schemaVersion"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.controls) ||
    value.controls.length !== accountConsentPurposes.length
  ) {
    return null;
  }
  const controls = value.controls.map(parseAccountConsentControl);
  if (
    controls.some((control) => control === null) ||
    new Set(controls.map((control) => control?.purpose)).size !== accountConsentPurposes.length
  ) {
    return null;
  }
  return Object.freeze(controls as AccountConsentControl[]);
};

export const parseAccountReadingPage = (value: unknown): AccountReadingPage | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "nextCursor", "schemaVersion"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    (value.nextCursor !== null &&
      (typeof value.nextCursor !== "string" || !cursorPattern.test(value.nextCursor)))
  ) {
    return null;
  }

  const identifiers = new Set<string>();
  const items: AccountReadingSummary[] = [];
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["createdAt", "id", "readingType", "themeCode"]) ||
      !isUuidV4(item.id) ||
      identifiers.has(item.id) ||
      !isUtcInstant(item.createdAt) ||
      (item.readingType !== "one_card" && item.readingType !== "three_card") ||
      typeof item.themeCode !== "string" ||
      !themeCodes.has(item.themeCode)
    ) {
      return null;
    }
    identifiers.add(item.id);
    items.push(
      Object.freeze({
        createdAt: item.createdAt,
        id: item.id,
        readingType: item.readingType,
        themeCode: item.themeCode as QuestionIntakeThemeCode,
      }),
    );
  }

  return Object.freeze({
    items: Object.freeze(items),
    nextCursor: value.nextCursor,
  });
};

export const parseAccountHistoryPage = (value: unknown): AccountHistoryPage | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "nextCursor", "schemaVersion"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    (value.nextCursor !== null &&
      (typeof value.nextCursor !== "string" || !cursorPattern.test(value.nextCursor)))
  ) {
    return null;
  }

  const identifiers = new Set<string>();
  const items: AccountHistorySummary[] = [];
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, [
        "occurredAt",
        "readingType",
        "resourceId",
        "resourceType",
        "status",
        "themeCode",
      ]) ||
      !isUuidV4(item.resourceId) ||
      !isUtcInstant(item.occurredAt) ||
      !["intention", "journal", "reading", "revisit", "ritual"].includes(
        String(item.resourceType),
      ) ||
      ![
        "abandoned",
        "active",
        "archived",
        "completed",
        "facts_ready",
        "paused",
        "scheduled",
      ].includes(String(item.status))
    ) {
      return null;
    }
    const resourceKey = `${String(item.resourceType)}:${item.resourceId}`;
    if (identifiers.has(resourceKey)) return null;
    identifiers.add(resourceKey);
    const reading =
      item.resourceType === "reading" &&
      (item.readingType === "one_card" || item.readingType === "three_card") &&
      typeof item.themeCode === "string" &&
      themeCodes.has(item.themeCode) &&
      item.status === "facts_ready";
    if (
      (!reading && item.resourceType === "reading") ||
      (item.resourceType !== "reading" && (item.readingType !== null || item.themeCode !== null)) ||
      (item.resourceType === "intention" &&
        !["active", "archived", "completed"].includes(String(item.status))) ||
      (item.resourceType === "journal" && item.status !== "active") ||
      (item.resourceType === "revisit" &&
        !["archived", "completed", "scheduled"].includes(String(item.status))) ||
      (item.resourceType === "ritual" &&
        !["abandoned", "active", "completed", "paused"].includes(String(item.status)))
    ) {
      return null;
    }
    const readingType =
      item.readingType === "one_card" || item.readingType === "three_card"
        ? item.readingType
        : null;
    const themeCode =
      typeof item.themeCode === "string" && themeCodes.has(item.themeCode)
        ? (item.themeCode as QuestionIntakeThemeCode)
        : null;
    items.push(
      Object.freeze({
        occurredAt: item.occurredAt,
        readingType: reading ? readingType : null,
        resourceId: item.resourceId,
        resourceType: item.resourceType as AccountHistorySummary["resourceType"],
        status: item.status as AccountHistorySummary["status"],
        themeCode: reading ? themeCode : null,
      }),
    );
  }

  return Object.freeze({
    items: Object.freeze(items),
    nextCursor: value.nextCursor,
  });
};

export const parseAccountSessionList = (
  value: unknown,
): readonly AccountSessionSummary[] | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["items", "schemaVersion"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length < 1 ||
    value.items.length > 100
  ) {
    return null;
  }

  const identifiers = new Set<string>();
  const items: AccountSessionSummary[] = [];
  let currentCount = 0;
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      !hasExactKeys(item, ["createdAt", "current", "expiresAt", "id", "lastSeenAt"]) ||
      !isUuidV4(item.id) ||
      identifiers.has(item.id) ||
      typeof item.current !== "boolean" ||
      !isUtcInstant(item.createdAt) ||
      !isUtcInstant(item.expiresAt) ||
      !isUtcInstant(item.lastSeenAt)
    ) {
      return null;
    }
    const createdAt = Date.parse(item.createdAt);
    const expiresAt = Date.parse(item.expiresAt);
    const lastSeenAt = Date.parse(item.lastSeenAt);
    if (createdAt > lastSeenAt || lastSeenAt > expiresAt) return null;
    identifiers.add(item.id);
    if (item.current) currentCount += 1;
    items.push(
      Object.freeze({
        createdAt: item.createdAt,
        current: item.current,
        expiresAt: item.expiresAt,
        id: item.id,
        lastSeenAt: item.lastSeenAt,
      }),
    );
  }

  return currentCount === 1 ? Object.freeze(items) : null;
};
