declare const accountValueBrand: unique symbol;

type Branded<Value, Brand extends string> = Value & {
  readonly [accountValueBrand]: Brand;
};

export type UserId = Branded<string, "UserId">;
export type AccountSessionId = Branded<string, "AccountSessionId">;
export type AuthIdentityId = Branded<string, "AuthIdentityId">;
export type AuthProviderKey = Branded<string, "AuthProviderKey">;
export type AuthProviderSubject = Branded<string, "AuthProviderSubject">;
export type NormalizedAccountEmail = Branded<string, "NormalizedAccountEmail">;
export type AccountUtcInstant = Branded<string, "AccountUtcInstant">;

export const accountStatuses = Object.freeze([
  "active",
  "suspended",
  "deletion_pending",
  "deleted",
] as const);
export type AccountStatus = (typeof accountStatuses)[number];

export const accountSessionEndReasons = Object.freeze(["revoked", "rotated"] as const);
export type AccountSessionEndReason = (typeof accountSessionEndReasons)[number];
export type AccountSessionState = "active" | "expired" | AccountSessionEndReason;

export const accountErrorCodes = Object.freeze([
  "ACCOUNT_VALUE_INVALID",
  "ACCOUNT_SESSION_EXPIRED",
  "ACCOUNT_SESSION_ENDED",
  "ACCOUNT_UNAVAILABLE",
] as const);
export type AccountErrorCode = (typeof accountErrorCodes)[number];

const accountErrorMessage = (code: AccountErrorCode): string => {
  switch (code) {
    case "ACCOUNT_VALUE_INVALID":
      return "An account value is invalid.";
    case "ACCOUNT_SESSION_EXPIRED":
      return "The account session has expired.";
    case "ACCOUNT_SESSION_ENDED":
      return "The account session has ended.";
    case "ACCOUNT_UNAVAILABLE":
      return "The account is unavailable.";
  }
};

export class AccountError extends Error {
  readonly code: AccountErrorCode;

  constructor(code: AccountErrorCode) {
    super(accountErrorMessage(code));
    this.name = "AccountError";
    this.code = code;
  }
}

const invalid = (): never => {
  throw new AccountError("ACCOUNT_VALUE_INVALID");
};

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const asciiEmailPattern =
  /^(?!.*\.\.)(?!\.)[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}(?<!\.)@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u;

const parseUuid = <Value extends UserId | AccountSessionId | AuthIdentityId>(
  value: unknown,
): Value => {
  if (typeof value !== "string" || !uuidV4Pattern.test(value)) invalid();
  return value as Value;
};

export const parseUserId = (value: unknown): UserId => parseUuid<UserId>(value);
export const parseAccountSessionId = (value: unknown): AccountSessionId =>
  parseUuid<AccountSessionId>(value);
export const parseAuthIdentityId = (value: unknown): AuthIdentityId =>
  parseUuid<AuthIdentityId>(value);

const parseIdentifier = <Value extends AuthProviderKey | AuthProviderSubject>(
  value: unknown,
  maximumLength: number,
): Value => {
  if (typeof value !== "string" || value.length > maximumLength || !identifierPattern.test(value)) {
    invalid();
  }
  return value as Value;
};

export const parseAuthProviderKey = (value: unknown): AuthProviderKey =>
  parseIdentifier<AuthProviderKey>(value, 40);
export const parseAuthProviderSubject = (value: unknown): AuthProviderSubject =>
  parseIdentifier<AuthProviderSubject>(value, 200);

export const normalizeAccountEmail = (value: unknown): NormalizedAccountEmail => {
  if (typeof value !== "string") return invalid();
  const normalized = value.trim().normalize("NFKC").toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    /[^\x21-\x7e]/u.test(normalized) ||
    !asciiEmailPattern.test(normalized)
  ) {
    invalid();
  }
  return normalized as NormalizedAccountEmail;
};

export const parseAccountUtcInstant = (value: unknown): AccountUtcInstant => {
  if (typeof value !== "string") return invalid();
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) invalid();
  return value as AccountUtcInstant;
};

export type PersistedAccountSessionV1 = Readonly<{
  createdAt: AccountUtcInstant;
  end: Readonly<{ at: AccountUtcInstant; reason: AccountSessionEndReason }> | null;
  expiresAt: AccountUtcInstant;
  lastSeenAt: AccountUtcInstant;
  schemaVersion: 1;
  sessionId: AccountSessionId;
  userId: UserId;
}>;

export const resolveAccountSessionState = (
  session: PersistedAccountSessionV1,
  now: AccountUtcInstant,
): AccountSessionState => {
  if (session.end !== null) return session.end.reason;
  return now >= session.expiresAt ? "expired" : "active";
};

export const requireActiveAccountSession = (
  session: PersistedAccountSessionV1,
  now: AccountUtcInstant,
): PersistedAccountSessionV1 => {
  const state = resolveAccountSessionState(session, now);
  if (state === "expired") throw new AccountError("ACCOUNT_SESSION_EXPIRED");
  if (state !== "active") throw new AccountError("ACCOUNT_SESSION_ENDED");
  return session;
};

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).sort().join("\u0000") === [...keys].sort().join("\u0000");

const parseLocale = (value: unknown): "en" => {
  if (value !== "en") invalid();
  return "en";
};

const parseTimeZone = (value: unknown): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) return invalid();
  try {
    const canonical = new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone;
    if (canonical !== value) invalid();
  } catch {
    invalid();
  }
  return value;
};

const parseDisplayName = (value: unknown): string | null => {
  if (value === null) return null;
  if (typeof value !== "string") return invalid();
  const normalized = value.trim().normalize("NFC");
  if (
    normalized.length < 1 ||
    normalized.length > 80 ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    invalid();
  }
  return normalized;
};

export type AccountProfileUpdateV1 = Readonly<{
  displayName: string | null;
  locale: "en";
  profileVersion: number;
  schemaVersion: 1;
  timeZone: string;
}>;

export const accountAgePolicyVersions = Object.freeze(["age-18.local.v1"] as const);
export type AccountAgePolicyVersion = (typeof accountAgePolicyVersions)[number];

export type AccountAgeAttestationV1 = Readonly<{
  ageAttested: true;
  agePolicyVersion: AccountAgePolicyVersion;
}>;

export const parseAccountAgeAttestationV1 = (value: unknown): AccountAgeAttestationV1 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  const candidate = value as Record<string, unknown>;
  if (
    !exactKeys(candidate, ["ageAttested", "agePolicyVersion"]) ||
    candidate.ageAttested !== true ||
    candidate.agePolicyVersion !== "age-18.local.v1"
  ) {
    invalid();
  }
  return Object.freeze({
    ageAttested: true,
    agePolicyVersion: "age-18.local.v1",
  });
};

export const parseAccountProfileUpdateV1 = (value: unknown): AccountProfileUpdateV1 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  const candidate = value as Record<string, unknown>;
  if (
    !exactKeys(candidate, [
      "displayName",
      "locale",
      "profileVersion",
      "schemaVersion",
      "timeZone",
    ]) ||
    candidate.schemaVersion !== 1 ||
    !Number.isSafeInteger(candidate.profileVersion) ||
    (candidate.profileVersion as number) < 1
  ) {
    invalid();
  }
  return Object.freeze({
    displayName: parseDisplayName(candidate.displayName),
    locale: parseLocale(candidate.locale),
    profileVersion: candidate.profileVersion as number,
    schemaVersion: 1,
    timeZone: parseTimeZone(candidate.timeZone),
  });
};
