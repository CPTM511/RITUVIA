declare const identityValueBrand: unique symbol;

type Branded<Value, Brand extends string> = Value & {
  readonly [identityValueBrand]: Brand;
};

export type AnonymousSubjectId = Branded<string, "AnonymousSubjectId">;
export type AnonymousSessionId = Branded<string, "AnonymousSessionId">;
export type SessionTokenDigest = Branded<string, "SessionTokenDigest">;
export type IdentityPolicyVersion = Branded<string, "IdentityPolicyVersion">;
export type ConsentPurpose = Branded<string, "ConsentPurpose">;
export type ConsentNoticeVersion = Branded<string, "ConsentNoticeVersion">;
export type ConsentLocale = Branded<string, "ConsentLocale">;
export type UtcInstant = Branded<string, "UtcInstant">;

export const anonymousIdentityErrorCodes = Object.freeze([
  "IDENTITY_VALUE_INVALID",
  "ANONYMOUS_SESSION_EXPIRED",
  "ANONYMOUS_SESSION_ENDED",
  "CONSENT_TRANSITION_INVALID",
  "IDENTITY_SERIALIZATION_VERSION_UNSUPPORTED",
] as const);

export type AnonymousIdentityErrorCode = (typeof anonymousIdentityErrorCodes)[number];

const identityErrorMessage = (code: AnonymousIdentityErrorCode): string => {
  switch (code) {
    case "IDENTITY_VALUE_INVALID":
      return "An anonymous identity value is invalid.";
    case "ANONYMOUS_SESSION_EXPIRED":
      return "The anonymous session has expired.";
    case "ANONYMOUS_SESSION_ENDED":
      return "The anonymous session has ended.";
    case "CONSENT_TRANSITION_INVALID":
      return "The consent transition is invalid.";
    case "IDENTITY_SERIALIZATION_VERSION_UNSUPPORTED":
      return "The anonymous identity serialization version is unsupported.";
  }
};

export class AnonymousIdentityError extends Error {
  readonly code: AnonymousIdentityErrorCode;

  constructor(code: AnonymousIdentityErrorCode) {
    super(identityErrorMessage(code));
    this.name = "AnonymousIdentityError";
    this.code = code;
  }
}

const invalidValue = (): never => {
  throw new AnonymousIdentityError("IDENTITY_VALUE_INVALID");
};

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const digestPattern = /^[0-9a-f]{64}$/u;
const boundedIdentifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

const parseUuidV4 = <Value extends AnonymousSubjectId | AnonymousSessionId>(
  value: unknown,
): Value => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) invalidValue();
  return value as Value;
};

export const parseAnonymousSubjectId = (value: unknown): AnonymousSubjectId =>
  parseUuidV4<AnonymousSubjectId>(value);

export const parseAnonymousSessionId = (value: unknown): AnonymousSessionId =>
  parseUuidV4<AnonymousSessionId>(value);

export const parseSessionTokenDigest = (value: unknown): SessionTokenDigest => {
  if (typeof value !== "string" || !digestPattern.test(value)) invalidValue();
  return value as SessionTokenDigest;
};

const parseBoundedIdentifier = <Value extends string>(
  value: unknown,
  maximumLength: number,
): Value => {
  if (
    typeof value !== "string" ||
    value.length > maximumLength ||
    !boundedIdentifierPattern.test(value)
  ) {
    invalidValue();
  }
  return value as Value;
};

export const parseIdentityPolicyVersion = (value: unknown): IdentityPolicyVersion =>
  parseBoundedIdentifier<IdentityPolicyVersion>(value, 100);

export const parseConsentPurpose = (value: unknown): ConsentPurpose =>
  parseBoundedIdentifier<ConsentPurpose>(value, 64);

export const parseConsentNoticeVersion = (value: unknown): ConsentNoticeVersion =>
  parseBoundedIdentifier<ConsentNoticeVersion>(value, 100);

export const parseConsentLocale = (value: unknown): ConsentLocale => {
  if (typeof value !== "string" || value.length > 35) invalidValue();
  const locale = value as string;
  try {
    if (new Intl.Locale(locale).toString() !== locale) invalidValue();
  } catch {
    invalidValue();
  }
  return locale as ConsentLocale;
};

export const parseUtcInstant = (value: unknown): UtcInstant => {
  if (typeof value !== "string") invalidValue();
  const instant = value as string;
  const timestamp = Date.parse(instant);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== instant) invalidValue();
  return instant as UtcInstant;
};

export type IdentityClock = Readonly<{
  now(): UtcInstant;
}>;

export const anonymousSessionEndReasons = Object.freeze(["revoked", "rotated"] as const);
export type AnonymousSessionEndReason = (typeof anonymousSessionEndReasons)[number];
export type AnonymousSessionState = "active" | "expired" | AnonymousSessionEndReason;

export type PersistedAnonymousSessionV1 = Readonly<{
  createdAt: UtcInstant;
  end: Readonly<{ at: UtcInstant; reason: AnonymousSessionEndReason }> | null;
  expiresAt: UtcInstant;
  expiryPolicyVersion: IdentityPolicyVersion;
  lastSeenAt: UtcInstant;
  schemaVersion: 1;
  sessionId: AnonymousSessionId;
  subjectId: AnonymousSubjectId;
  tokenDigest: SessionTokenDigest;
}>;

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort().join("\u0000");
  const normalizedExpected = [...expected].sort().join("\u0000");
  return actual === normalizedExpected;
};

export const parsePersistedAnonymousSessionV1 = (value: unknown): PersistedAnonymousSessionV1 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalidValue();
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1) {
    throw new AnonymousIdentityError("IDENTITY_SERIALIZATION_VERSION_UNSUPPORTED");
  }
  if (
    !exactKeys(candidate, [
      "createdAt",
      "end",
      "expiresAt",
      "expiryPolicyVersion",
      "lastSeenAt",
      "schemaVersion",
      "sessionId",
      "subjectId",
      "tokenDigest",
    ])
  ) {
    invalidValue();
  }

  const createdAt = parseUtcInstant(candidate.createdAt);
  const expiresAt = parseUtcInstant(candidate.expiresAt);
  const lastSeenAt = parseUtcInstant(candidate.lastSeenAt);
  if (createdAt >= expiresAt || lastSeenAt < createdAt || lastSeenAt > expiresAt) invalidValue();

  let end: PersistedAnonymousSessionV1["end"] = null;
  if (candidate.end !== null) {
    if (
      typeof candidate.end !== "object" ||
      Array.isArray(candidate.end) ||
      !exactKeys(candidate.end as Record<string, unknown>, ["at", "reason"])
    ) {
      invalidValue();
    }
    const endCandidate = candidate.end as Record<string, unknown>;
    const reason = endCandidate.reason;
    const at = parseUtcInstant(endCandidate.at);
    if (!anonymousSessionEndReasons.includes(reason as AnonymousSessionEndReason)) invalidValue();
    if (at < createdAt || at > expiresAt) invalidValue();
    end = Object.freeze({ at, reason: reason as AnonymousSessionEndReason });
  }

  return Object.freeze({
    createdAt,
    end,
    expiresAt,
    expiryPolicyVersion: parseIdentityPolicyVersion(candidate.expiryPolicyVersion),
    lastSeenAt,
    schemaVersion: 1,
    sessionId: parseAnonymousSessionId(candidate.sessionId),
    subjectId: parseAnonymousSubjectId(candidate.subjectId),
    tokenDigest: parseSessionTokenDigest(candidate.tokenDigest),
  });
};

export const serializePersistedAnonymousSessionV1 = (
  value: PersistedAnonymousSessionV1,
): PersistedAnonymousSessionV1 => parsePersistedAnonymousSessionV1(value);

export const resolveAnonymousSessionState = (
  session: PersistedAnonymousSessionV1,
  now: UtcInstant,
): AnonymousSessionState => {
  if (session.end !== null) return session.end.reason;
  return now >= session.expiresAt ? "expired" : "active";
};

export const requireActiveAnonymousSession = (
  session: PersistedAnonymousSessionV1,
  now: UtcInstant,
): PersistedAnonymousSessionV1 => {
  const state = resolveAnonymousSessionState(session, now);
  if (state === "expired") throw new AnonymousIdentityError("ANONYMOUS_SESSION_EXPIRED");
  if (state !== "active") throw new AnonymousIdentityError("ANONYMOUS_SESSION_ENDED");
  return session;
};

export const consentDecisions = Object.freeze(["granted", "denied", "withdrawn"] as const);
export type ConsentDecision = (typeof consentDecisions)[number];
export const consentSources = Object.freeze([
  "first_party_consent_surface",
  "privacy_controls",
] as const);
export type ConsentSource = (typeof consentSources)[number];

export type ConsentRecord = Readonly<{
  decision: ConsentDecision;
  locale: ConsentLocale;
  noticeVersion: ConsentNoticeVersion;
  purpose: ConsentPurpose;
  recordedAt: UtcInstant;
  sequence: number;
  source: ConsentSource;
}>;

export const createConsentRecord = (input: {
  decision: unknown;
  locale: unknown;
  noticeVersion: unknown;
  previous: ConsentRecord | null;
  purpose: unknown;
  recordedAt: unknown;
  sequence: unknown;
  source: unknown;
}): ConsentRecord => {
  if (
    !consentDecisions.includes(input.decision as ConsentDecision) ||
    !consentSources.includes(input.source as ConsentSource) ||
    !Number.isSafeInteger(input.sequence) ||
    (input.sequence as number) <= 0
  ) {
    invalidValue();
  }
  const purpose = parseConsentPurpose(input.purpose);
  const sequence = input.sequence as number;
  if (
    (input.previous === null && input.decision === "withdrawn") ||
    (input.previous !== null &&
      (input.previous.purpose !== purpose ||
        input.previous.sequence + 1 !== sequence ||
        (input.decision === "withdrawn" && input.previous.decision !== "granted")))
  ) {
    throw new AnonymousIdentityError("CONSENT_TRANSITION_INVALID");
  }
  return Object.freeze({
    decision: input.decision as ConsentDecision,
    locale: parseConsentLocale(input.locale),
    noticeVersion: parseConsentNoticeVersion(input.noticeVersion),
    purpose,
    recordedAt: parseUtcInstant(input.recordedAt),
    sequence,
    source: input.source as ConsentSource,
  });
};

export const allowsConsentPurpose = (
  record: ConsentRecord | null,
  purpose: ConsentPurpose,
  requiredNoticeVersion: ConsentNoticeVersion,
): boolean =>
  record !== null &&
  record.decision === "granted" &&
  record.purpose === purpose &&
  record.noticeVersion === requiredNoticeVersion;
