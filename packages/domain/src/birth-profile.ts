export const birthProfileSchemaVersion = "birth-profile.v1" as const;
export const birthProfileCreateSchemaVersion = "birth-profile-create.v1" as const;
export const birthProfileUpdateSchemaVersion = "birth-profile-update.v1" as const;
export const birthProfileTimeCertainties = Object.freeze([
  "exact",
  "approximate",
  "unknown",
] as const);

export type BirthProfileTimeCertainty = (typeof birthProfileTimeCertainties)[number];

export type BirthProfileWriteRequestV1 = Readonly<{
  approximationWindowMinutes: number | null;
  birthDate: string;
  birthTime: string | null;
  disambiguation: "earlier" | "later" | null;
  label: string;
  locationId: string;
  schemaVersion: typeof birthProfileCreateSchemaVersion | typeof birthProfileUpdateSchemaVersion;
  timeCertainty: BirthProfileTimeCertainty;
}>;

export type BirthProfileLocationV1 = Readonly<{
  admin1Code: string | null;
  countryCode: string;
  displayName: string;
  latitudeE6: number;
  locationId: string;
  longitudeE6: number;
  timeZoneConfidence: "provider_assigned";
  timeZoneId: string;
  timeZoneSource: string;
}>;

export type BirthProfileProviderV1 = Readonly<{
  adapterVersion: string;
  attributionRequired: boolean;
  attributionText: string;
  dataSha256: string;
  dataVersion: string;
  licenseId: string;
  providerId: string;
  providerVersion: string;
  sourceUrl: string;
}>;

export type BirthProfileRuntimeV1 = Readonly<{
  historicalConfidence: "limited_pre_1970_tzdb" | "tzdb_rule_match";
  icuVersion: string;
  runtimeId: "node_intl";
  runtimeVersion: string;
  timeZoneDataVersion: string;
}>;

export type BirthProfilePayloadV1 = Readonly<{
  label: string;
  normalized: Readonly<{
    ambiguity: "earlier" | "later" | "unambiguous" | "unknown_time";
    offsetSeconds: number | null;
    runtimeCanonicalTimeZoneId: string | null;
    utcInstant: string | null;
  }>;
  originalInput: Readonly<{
    approximationWindowMinutes: number | null;
    birthDate: string;
    birthTime: string | null;
    disambiguation: "earlier" | "later" | null;
    locationId: string;
  }>;
  provider: BirthProfileProviderV1;
  runtime: BirthProfileRuntimeV1 | null;
  schemaVersion: typeof birthProfileSchemaVersion;
  selectedLocation: BirthProfileLocationV1;
  timeCertainty: BirthProfileTimeCertainty;
}>;

type UnknownRecord = Record<string, unknown>;

const forbiddenText =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff<>]/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const identifierPattern = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const timeZonePattern = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)+$/u;

const invalid = (): never => {
  throw new TypeError("Birth profile data is invalid.");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) invalid();
};

const text = (value: unknown, maximumLength: number): string => {
  if (typeof value !== "string") return invalid();
  const normalized = value.normalize("NFC");
  if (
    normalized.length === 0 ||
    Array.from(normalized).length > maximumLength ||
    normalized.trim() !== normalized ||
    forbiddenText.test(normalized)
  ) {
    invalid();
  }
  return normalized;
};

const identifier = (value: unknown, maximumLength = 128): string => {
  const parsed = text(value, maximumLength);
  if (!identifierPattern.test(parsed)) invalid();
  return parsed;
};

const date = (value: unknown): string => {
  const parsed = text(value, 10);
  if (!datePattern.test(parsed)) invalid();
  const year = Number.parseInt(parsed.slice(0, 4), 10);
  const instant = new Date(`${parsed}T00:00:00.000Z`);
  if (
    year < 1800 ||
    year > 2199 ||
    Number.isNaN(instant.getTime()) ||
    instant.toISOString().slice(0, 10) !== parsed
  ) {
    invalid();
  }
  return parsed;
};

const timeCertainty = (value: unknown): BirthProfileTimeCertainty =>
  birthProfileTimeCertainties.includes(value as BirthProfileTimeCertainty)
    ? (value as BirthProfileTimeCertainty)
    : invalid();

const approximationWindow = (
  value: unknown,
  certainty: BirthProfileTimeCertainty,
): number | null => {
  if (certainty !== "approximate") return value === null ? null : invalid();
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 720) invalid();
  return value as number;
};

const disambiguation = (
  value: unknown,
  certainty: BirthProfileTimeCertainty,
): "earlier" | "later" | null => {
  if (certainty === "unknown") return value === null ? null : invalid();
  return value === null || value === "earlier" || value === "later" ? value : invalid();
};

const birthTime = (value: unknown, certainty: BirthProfileTimeCertainty): string | null => {
  if (certainty === "unknown") return value === null ? null : invalid();
  const parsed = text(value, 5);
  return localTimePattern.test(parsed) ? parsed : invalid();
};

export const parseBirthProfileWriteRequestV1 = (
  value: unknown,
  expectedSchemaVersion:
    typeof birthProfileCreateSchemaVersion | typeof birthProfileUpdateSchemaVersion,
): BirthProfileWriteRequestV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "approximationWindowMinutes",
    "birthDate",
    "birthTime",
    "disambiguation",
    "label",
    "locationId",
    "schemaVersion",
    "timeCertainty",
  ]);
  if (parsed.schemaVersion !== expectedSchemaVersion) invalid();
  const certainty = timeCertainty(parsed.timeCertainty);
  return Object.freeze({
    approximationWindowMinutes: approximationWindow(parsed.approximationWindowMinutes, certainty),
    birthDate: date(parsed.birthDate),
    birthTime: birthTime(parsed.birthTime, certainty),
    disambiguation: disambiguation(parsed.disambiguation, certainty),
    label: text(parsed.label, 80),
    locationId: identifier(parsed.locationId),
    schemaVersion: expectedSchemaVersion,
    timeCertainty: certainty,
  });
};

export const canonicalizeBirthProfileWriteRequestV1 = (
  value: unknown,
  expectedSchemaVersion:
    typeof birthProfileCreateSchemaVersion | typeof birthProfileUpdateSchemaVersion,
): string => JSON.stringify(parseBirthProfileWriteRequestV1(value, expectedSchemaVersion));

const parseLocation = (value: unknown): BirthProfileLocationV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "admin1Code",
    "countryCode",
    "displayName",
    "latitudeE6",
    "locationId",
    "longitudeE6",
    "timeZoneConfidence",
    "timeZoneId",
    "timeZoneSource",
  ]);
  const countryCode = text(parsed.countryCode, 2);
  const admin1Code = parsed.admin1Code === null ? null : text(parsed.admin1Code, 32);
  const latitudeE6 = parsed.latitudeE6;
  const longitudeE6 = parsed.longitudeE6;
  const timeZoneId = text(parsed.timeZoneId, 100);
  if (
    !/^[A-Z]{2}$/u.test(countryCode) ||
    (admin1Code !== null && !/^[A-Za-z0-9._-]+$/u.test(admin1Code)) ||
    !Number.isSafeInteger(latitudeE6) ||
    (latitudeE6 as number) < -90_000_000 ||
    (latitudeE6 as number) > 90_000_000 ||
    !Number.isSafeInteger(longitudeE6) ||
    (longitudeE6 as number) < -180_000_000 ||
    (longitudeE6 as number) > 180_000_000 ||
    parsed.timeZoneConfidence !== "provider_assigned" ||
    !timeZonePattern.test(timeZoneId)
  ) {
    invalid();
  }
  return Object.freeze({
    admin1Code,
    countryCode,
    displayName: text(parsed.displayName, 180),
    latitudeE6: latitudeE6 as number,
    locationId: identifier(parsed.locationId),
    longitudeE6: longitudeE6 as number,
    timeZoneConfidence: "provider_assigned",
    timeZoneId,
    timeZoneSource: identifier(parsed.timeZoneSource),
  });
};

const parseProvider = (value: unknown): BirthProfileProviderV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "adapterVersion",
    "attributionRequired",
    "attributionText",
    "dataSha256",
    "dataVersion",
    "licenseId",
    "providerId",
    "providerVersion",
    "sourceUrl",
  ]);
  const dataSha256 = text(parsed.dataSha256, 64);
  const sourceUrl = text(parsed.sourceUrl, 500);
  const adapterVersion = text(parsed.adapterVersion, 64);
  const providerVersion = text(parsed.providerVersion, 64);
  if (
    typeof parsed.attributionRequired !== "boolean" ||
    !/^[0-9a-f]{64}$/u.test(dataSha256) ||
    !versionPattern.test(adapterVersion) ||
    !versionPattern.test(providerVersion) ||
    !/^https:\/\/[^?#@\s]+$/u.test(sourceUrl)
  ) {
    invalid();
  }
  const attributionRequired = parsed.attributionRequired as boolean;
  return Object.freeze({
    adapterVersion,
    attributionRequired,
    attributionText: text(parsed.attributionText, 200),
    dataSha256,
    dataVersion: text(parsed.dataVersion, 80),
    licenseId: text(parsed.licenseId, 80),
    providerId: identifier(parsed.providerId),
    providerVersion,
    sourceUrl,
  });
};

const parseRuntime = (value: unknown): BirthProfileRuntimeV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "historicalConfidence",
    "icuVersion",
    "runtimeId",
    "runtimeVersion",
    "timeZoneDataVersion",
  ]);
  if (
    (parsed.historicalConfidence !== "limited_pre_1970_tzdb" &&
      parsed.historicalConfidence !== "tzdb_rule_match") ||
    parsed.runtimeId !== "node_intl"
  ) {
    invalid();
  }
  const historicalConfidence = parsed.historicalConfidence as
    "limited_pre_1970_tzdb" | "tzdb_rule_match";
  return Object.freeze({
    historicalConfidence,
    icuVersion: text(parsed.icuVersion, 64),
    runtimeId: "node_intl",
    runtimeVersion: text(parsed.runtimeVersion, 64),
    timeZoneDataVersion: text(parsed.timeZoneDataVersion, 64),
  });
};

const parseUtcInstant = (value: unknown): string => {
  const parsed = text(value, 30);
  const instant = new Date(parsed);
  if (Number.isNaN(instant.getTime()) || instant.toISOString() !== parsed) invalid();
  return parsed;
};

export const parseBirthProfilePayloadV1 = (value: unknown): BirthProfilePayloadV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "label",
    "normalized",
    "originalInput",
    "provider",
    "runtime",
    "schemaVersion",
    "selectedLocation",
    "timeCertainty",
  ]);
  if (parsed.schemaVersion !== birthProfileSchemaVersion) invalid();
  const certainty = timeCertainty(parsed.timeCertainty);
  const original = record(parsed.originalInput);
  exactKeys(original, [
    "approximationWindowMinutes",
    "birthDate",
    "birthTime",
    "disambiguation",
    "locationId",
  ]);
  const normalized = record(parsed.normalized);
  exactKeys(normalized, ["ambiguity", "offsetSeconds", "runtimeCanonicalTimeZoneId", "utcInstant"]);
  const originalLocationId = identifier(original.locationId);
  const selectedLocation = parseLocation(parsed.selectedLocation);
  if (selectedLocation.locationId !== originalLocationId) invalid();
  const parsedBirthTime = birthTime(original.birthTime, certainty);
  const parsedWindow = approximationWindow(original.approximationWindowMinutes, certainty);
  const parsedDisambiguation = disambiguation(original.disambiguation, certainty);

  if (certainty === "unknown") {
    if (
      normalized.ambiguity !== "unknown_time" ||
      normalized.offsetSeconds !== null ||
      normalized.runtimeCanonicalTimeZoneId !== null ||
      normalized.utcInstant !== null ||
      parsed.runtime !== null
    ) {
      invalid();
    }
  } else if (
    (normalized.ambiguity !== "unambiguous" &&
      normalized.ambiguity !== "earlier" &&
      normalized.ambiguity !== "later") ||
    !Number.isSafeInteger(normalized.offsetSeconds) ||
    (normalized.offsetSeconds as number) < -93_600 ||
    (normalized.offsetSeconds as number) > 93_600 ||
    typeof normalized.runtimeCanonicalTimeZoneId !== "string" ||
    !timeZonePattern.test(normalized.runtimeCanonicalTimeZoneId) ||
    typeof normalized.utcInstant !== "string" ||
    parsed.runtime === null
  ) {
    invalid();
  }

  return Object.freeze({
    label: text(parsed.label, 80),
    normalized: Object.freeze({
      ambiguity: normalized.ambiguity as BirthProfilePayloadV1["normalized"]["ambiguity"],
      offsetSeconds:
        normalized.offsetSeconds === null ? null : (normalized.offsetSeconds as number),
      runtimeCanonicalTimeZoneId:
        normalized.runtimeCanonicalTimeZoneId === null
          ? null
          : (normalized.runtimeCanonicalTimeZoneId as string),
      utcInstant: normalized.utcInstant === null ? null : parseUtcInstant(normalized.utcInstant),
    }),
    originalInput: Object.freeze({
      approximationWindowMinutes: parsedWindow,
      birthDate: date(original.birthDate),
      birthTime: parsedBirthTime,
      disambiguation: parsedDisambiguation,
      locationId: originalLocationId,
    }),
    provider: parseProvider(parsed.provider),
    runtime: parsed.runtime === null ? null : parseRuntime(parsed.runtime),
    schemaVersion: birthProfileSchemaVersion,
    selectedLocation,
    timeCertainty: certainty,
  });
};
