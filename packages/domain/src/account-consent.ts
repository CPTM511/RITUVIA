import {
  parseConsentNoticeVersion,
  parseConsentPurpose,
  type ConsentNoticeVersion,
  type ConsentPurpose,
} from "./identity.js";

export const accountConsentPurposes = Object.freeze([
  "optional_product_analytics",
  "ai_personalization",
  "model_improvement",
] as const);

export type AccountConsentPurpose = (typeof accountConsentPurposes)[number];

export const accountConsentNoticeVersions = Object.freeze({
  ai_personalization: parseConsentNoticeVersion("rituvia.ai-personalization-notice.v1"),
  model_improvement: parseConsentNoticeVersion("rituvia.model-improvement-notice.v1"),
  optional_product_analytics: parseConsentNoticeVersion("rituvia.analytics-notice.v1"),
}) satisfies Readonly<Record<AccountConsentPurpose, ConsentNoticeVersion>>;

export const accountConsentNoticeVersionFor = (
  purpose: AccountConsentPurpose,
): ConsentNoticeVersion => {
  switch (purpose) {
    case "ai_personalization":
      return accountConsentNoticeVersions.ai_personalization;
    case "model_improvement":
      return accountConsentNoticeVersions.model_improvement;
    case "optional_product_analytics":
      return accountConsentNoticeVersions.optional_product_analytics;
  }
};

export type AccountConsentMutationV1 = Readonly<{
  granted: boolean;
  noticeVersion: ConsentNoticeVersion;
  purpose: AccountConsentPurpose;
  schemaVersion: 1;
}>;

export type AccountConsentState = Readonly<{
  granted: boolean;
  noticeVersion: ConsentNoticeVersion;
  purpose: AccountConsentPurpose;
  recordedAt: string | null;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isAccountConsentPurpose = (value: unknown): value is AccountConsentPurpose =>
  typeof value === "string" && accountConsentPurposes.includes(value as AccountConsentPurpose);

export const parseAccountConsentPurpose = (value: unknown): AccountConsentPurpose => {
  if (!isAccountConsentPurpose(value)) {
    throw new TypeError("Account consent purpose is invalid.");
  }
  return parseConsentPurpose(value) as AccountConsentPurpose;
};

export const parseAccountConsentMutationV1 = (value: unknown): AccountConsentMutationV1 => {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(",") !== "granted,noticeVersion,purpose,schemaVersion"
  ) {
    throw new TypeError("Account consent request is invalid.");
  }
  const purpose = parseAccountConsentPurpose(value.purpose);
  if (
    value.schemaVersion !== 1 ||
    typeof value.granted !== "boolean" ||
    value.noticeVersion !== accountConsentNoticeVersionFor(purpose)
  ) {
    throw new TypeError("Account consent request is invalid.");
  }
  return Object.freeze({
    granted: value.granted,
    noticeVersion: accountConsentNoticeVersionFor(purpose),
    purpose,
    schemaVersion: 1,
  });
};

export const accountConsentPurposeValue = (purpose: AccountConsentPurpose): ConsentPurpose =>
  parseConsentPurpose(purpose);
