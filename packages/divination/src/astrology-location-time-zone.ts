declare const astrologyLocationValueBrand: unique symbol;

type Branded<Value, Brand extends string> = Value & {
  readonly [astrologyLocationValueBrand]: Brand;
};

type AstrologyLocationIdentifier = Branded<string, "AstrologyLocationIdentifier">;
type AstrologyLocationVersion = Branded<string, "AstrologyLocationVersion">;
type AstrologyLocationDate = Branded<string, "AstrologyLocationDate">;

export const astrologyLocationSearchRequestSchemaVersion =
  "astrology-location-search-request.v1" as const;
export const astrologyLocationSearchResultSchemaVersion =
  "astrology-location-search-result.v1" as const;
export const astrologyLocationSelectionResultSchemaVersion =
  "astrology-location-selection-result.v1" as const;
export const astrologyLocalTimeResolutionRequestSchemaVersion =
  "astrology-local-time-resolution-request.v1" as const;
export const astrologyLocalTimeResolutionResultSchemaVersion =
  "astrology-local-time-resolution-result.v1" as const;
export const astrologyLocationTimeZoneAdapterVersion = "1.0.0" as const;
export const astrologyLocationMaximumPrivateSearchCacheTtlSeconds = 900;

export const astrologyLocalTimeDisambiguations = Object.freeze(["earlier", "later"] as const);
export type AstrologyLocalTimeDisambiguation = (typeof astrologyLocalTimeDisambiguations)[number];

export const astrologyLocalTimeResolutionStatuses = Object.freeze([
  "resolved",
  "ambiguous_local_time",
  "nonexistent_local_time",
] as const);
export type AstrologyLocalTimeResolutionStatus =
  (typeof astrologyLocalTimeResolutionStatuses)[number];

export const astrologyHistoricalTimeZoneConfidences = Object.freeze([
  "tzdb_rule_match",
  "limited_pre_1970_tzdb",
] as const);
export type AstrologyHistoricalTimeZoneConfidence =
  (typeof astrologyHistoricalTimeZoneConfidences)[number];

export const astrologyLocationTimeZoneErrorCodes = Object.freeze([
  "ASTROLOGY_LOCATION_INPUT_INVALID",
  "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID",
  "ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE",
  "ASTROLOGY_LOCATION_NOT_FOUND",
  "ASTROLOGY_TIME_ZONE_RUNTIME_INVALID",
  "ASTROLOGY_TIME_ZONE_RUNTIME_UNAVAILABLE",
] as const);
export type AstrologyLocationTimeZoneErrorCode =
  (typeof astrologyLocationTimeZoneErrorCodes)[number];

const errorMessage = (code: AstrologyLocationTimeZoneErrorCode): string => {
  switch (code) {
    case "ASTROLOGY_LOCATION_INPUT_INVALID":
      return "The astrology location request is invalid.";
    case "ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID":
      return "The astrology location provider returned an invalid response.";
    case "ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE":
      return "The astrology location provider is unavailable.";
    case "ASTROLOGY_LOCATION_NOT_FOUND":
      return "The selected astrology location is unavailable.";
    case "ASTROLOGY_TIME_ZONE_RUNTIME_INVALID":
      return "The historical time-zone runtime is invalid.";
    case "ASTROLOGY_TIME_ZONE_RUNTIME_UNAVAILABLE":
      return "The historical time-zone runtime is unavailable.";
  }
};

export class AstrologyLocationTimeZoneError extends Error {
  readonly code: AstrologyLocationTimeZoneErrorCode;

  constructor(code: AstrologyLocationTimeZoneErrorCode) {
    super(errorMessage(code));
    this.name = "AstrologyLocationTimeZoneError";
    this.code = code;
  }
}

export type AstrologyLocationSearchRequestV1 = Readonly<{
  limit: number;
  locale: "en";
  query: string;
  schemaVersion: typeof astrologyLocationSearchRequestSchemaVersion;
}>;

export type AstrologyLocationProviderDescriptorV1 = Readonly<{
  adapterVersion: typeof astrologyLocationTimeZoneAdapterVersion;
  attributionRequired: boolean;
  attributionText: string;
  dataSha256: string;
  dataVersion: string;
  licenseId: string;
  providerId: AstrologyLocationIdentifier;
  providerVersion: AstrologyLocationVersion;
  privateSearchCacheTtlSeconds: number;
  sourceUrl: string;
}>;

export type AstrologyLocationCandidateV1 = Readonly<{
  admin1Code: string | null;
  countryCode: string;
  displayName: string;
  latitudeE6: number;
  locationId: AstrologyLocationIdentifier;
  longitudeE6: number;
  rank: number;
  timeZoneConfidence: "provider_assigned";
  timeZoneId: string;
  timeZoneSource: AstrologyLocationIdentifier;
}>;

export type AstrologyLocationSearchResultV1 = Readonly<{
  cachePolicy: Readonly<{
    containsRawQuery: false;
    searchResults: "private_process_memory_hmac_key_only";
    ttlSeconds: number;
  }>;
  candidates: readonly AstrologyLocationCandidateV1[];
  provider: AstrologyLocationProviderDescriptorV1;
  queryIncluded: false;
  schemaVersion: typeof astrologyLocationSearchResultSchemaVersion;
  selectionRequired: boolean;
}>;

export type AstrologyLocationSelectionResultV1 = Readonly<{
  provider: AstrologyLocationProviderDescriptorV1;
  queryIncluded: false;
  schemaVersion: typeof astrologyLocationSelectionResultSchemaVersion;
  selectedLocation: Omit<AstrologyLocationCandidateV1, "rank">;
}>;

export type AstrologyLocalTimeResolutionRequestV1 = Readonly<{
  disambiguation: AstrologyLocalTimeDisambiguation | null;
  localDate: AstrologyLocationDate;
  localTime: string;
  locationId: AstrologyLocationIdentifier;
  schemaVersion: typeof astrologyLocalTimeResolutionRequestSchemaVersion;
}>;

export type AstrologyTimeZoneRuntimeMetadataV1 = Readonly<{
  icuVersion: string;
  runtimeId: "node_intl";
  runtimeVersion: string;
  timeZoneDataVersion: string;
}>;

export type AstrologyTimeZoneLocalPartsV1 = Readonly<{
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}>;

export type AstrologyHistoricalInstantCandidateV1 = Readonly<{
  offsetSeconds: number;
  utcInstant: string;
}>;

type AstrologyLocalTimeResolutionBaseV1 = Readonly<{
  historicalConfidence: AstrologyHistoricalTimeZoneConfidence;
  localInput: Readonly<{
    date: AstrologyLocationDate;
    precision: "minute";
    time: string;
  }>;
  selectedLocation: Omit<AstrologyLocationCandidateV1, "rank">;
  provider: AstrologyLocationProviderDescriptorV1;
  queryIncluded: false;
  runtime: AstrologyTimeZoneRuntimeMetadataV1;
  runtimeCanonicalTimeZoneId: string;
  schemaVersion: typeof astrologyLocalTimeResolutionResultSchemaVersion;
}>;

export type AstrologyResolvedLocalTimeV1 = AstrologyLocalTimeResolutionBaseV1 &
  Readonly<{
    ambiguity: "unambiguous" | AstrologyLocalTimeDisambiguation;
    candidateInstants: readonly AstrologyHistoricalInstantCandidateV1[];
    offsetSeconds: number;
    status: "resolved";
    utcInstant: string;
  }>;

export type AstrologyAmbiguousLocalTimeV1 = AstrologyLocalTimeResolutionBaseV1 &
  Readonly<{
    ambiguity: "requires_explicit_choice";
    candidateInstants: readonly [
      AstrologyHistoricalInstantCandidateV1,
      AstrologyHistoricalInstantCandidateV1,
    ];
    offsetSeconds: null;
    status: "ambiguous_local_time";
    utcInstant: null;
  }>;

export type AstrologyNonexistentLocalTimeV1 = AstrologyLocalTimeResolutionBaseV1 &
  Readonly<{
    ambiguity: "local_clock_gap";
    candidateInstants: readonly [];
    offsetSeconds: null;
    status: "nonexistent_local_time";
    utcInstant: null;
  }>;

export type AstrologyLocalTimeResolutionResultV1 =
  AstrologyAmbiguousLocalTimeV1 | AstrologyNonexistentLocalTimeV1 | AstrologyResolvedLocalTimeV1;

export type AstrologyLocationProviderV1 = Readonly<{
  descriptor: unknown;
  readLocation(
    locationId: string,
    context: Readonly<{ cancellation?: AstrologyLocationCancellationV1 }>,
  ): Promise<unknown>;
  search(
    request: AstrologyLocationSearchRequestV1,
    context: Readonly<{ cancellation?: AstrologyLocationCancellationV1 }>,
  ): Promise<unknown>;
}>;

export type AstrologyLocationCancellationV1 = Readonly<{
  readonly aborted: boolean;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: Readonly<{ once?: boolean }>,
  ): void;
  removeEventListener(type: "abort", listener: () => void): void;
}>;

export type AstrologyTimeZoneRuntimeV1 = Readonly<{
  canonicalizeTimeZone(timeZoneId: string): unknown;
  formatLocalParts(timeZoneId: string, utcEpochMilliseconds: number): unknown;
  metadata: unknown;
}>;

export type AstrologyLocationTimeZoneAdapterV1 = Readonly<{
  provider: AstrologyLocationProviderDescriptorV1;
  readLocation(
    locationId: string,
    context?: Readonly<{ cancellation?: AstrologyLocationCancellationV1 }>,
  ): Promise<AstrologyLocationSelectionResultV1>;
  resolve(
    value: unknown,
    context?: Readonly<{ cancellation?: AstrologyLocationCancellationV1 }>,
  ): Promise<AstrologyLocalTimeResolutionResultV1>;
  search(
    value: unknown,
    context?: Readonly<{ cancellation?: AstrologyLocationCancellationV1 }>,
  ): Promise<AstrologyLocationSearchResultV1>;
}>;

type UnknownRecord = Record<string, unknown>;

const forbiddenText =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ud800-\udfff\ufeff<>]/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const timeZonePattern = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)+$/u;

const inputInvalid = (): never => {
  throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_INPUT_INVALID");
};

const providerOutputInvalid = (): never => {
  throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_PROVIDER_OUTPUT_INVALID");
};

const runtimeInvalid = (): never => {
  throw new AstrologyLocationTimeZoneError("ASTROLOGY_TIME_ZONE_RUNTIME_INVALID");
};

const record = (value: unknown, failure: () => never): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) failure();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, keys: readonly string[], failure: () => never): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...keys].sort().join("\u0000")) failure();
};

const text = (value: unknown, failure: () => never, maximumLength = 256): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    forbiddenText.test(value)
  ) {
    failure();
  }
  return value as string;
};

const identifier = (value: unknown, failure: () => never): AstrologyLocationIdentifier => {
  const parsed = text(value, failure, 128);
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u.test(parsed)) failure();
  return parsed as AstrologyLocationIdentifier;
};

const version = (value: unknown, failure: () => never): AstrologyLocationVersion => {
  const parsed = text(value, failure, 64);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(parsed)) failure();
  return parsed as AstrologyLocationVersion;
};

const positiveInteger = (value: unknown, maximum: number, failure: () => never): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    failure();
  }
  return value as number;
};

const coordinate = (
  value: unknown,
  minimum: number,
  maximum: number,
  failure: () => never,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    failure();
  }
  return value as number;
};

const date = (value: unknown, failure: () => never): AstrologyLocationDate => {
  const parsed = text(value, failure, 10);
  if (!datePattern.test(parsed)) failure();
  const year = Number.parseInt(parsed.slice(0, 4), 10);
  if (year < 1800 || year > 2199) failure();
  const instant = new Date(`${parsed}T00:00:00.000Z`);
  if (Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== parsed) {
    failure();
  }
  return parsed as AstrologyLocationDate;
};

const httpsUrl = (value: unknown, failure: () => never): string => {
  const parsed = text(value, failure, 500);
  if (
    !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]*)?$/u.test(parsed) ||
    parsed.includes("@") ||
    parsed.includes("?") ||
    parsed.includes("#")
  ) {
    failure();
  }
  return parsed;
};

const parseProviderDescriptor = (value: unknown): AstrologyLocationProviderDescriptorV1 => {
  const parsed = record(value, providerOutputInvalid);
  exactKeys(
    parsed,
    [
      "adapterVersion",
      "attributionRequired",
      "attributionText",
      "dataSha256",
      "dataVersion",
      "licenseId",
      "privateSearchCacheTtlSeconds",
      "providerId",
      "providerVersion",
      "sourceUrl",
    ],
    providerOutputInvalid,
  );
  if (typeof parsed.attributionRequired !== "boolean") providerOutputInvalid();
  return Object.freeze({
    adapterVersion:
      parsed.adapterVersion === astrologyLocationTimeZoneAdapterVersion
        ? astrologyLocationTimeZoneAdapterVersion
        : providerOutputInvalid(),
    attributionRequired: parsed.attributionRequired as boolean,
    attributionText: text(parsed.attributionText, providerOutputInvalid, 200),
    dataSha256: (() => {
      const digest = text(parsed.dataSha256, providerOutputInvalid, 64);
      return /^[0-9a-f]{64}$/u.test(digest) ? digest : providerOutputInvalid();
    })(),
    dataVersion: text(parsed.dataVersion, providerOutputInvalid, 80),
    licenseId: text(parsed.licenseId, providerOutputInvalid, 80),
    providerId: identifier(parsed.providerId, providerOutputInvalid),
    providerVersion: version(parsed.providerVersion, providerOutputInvalid),
    privateSearchCacheTtlSeconds: positiveInteger(
      parsed.privateSearchCacheTtlSeconds,
      astrologyLocationMaximumPrivateSearchCacheTtlSeconds,
      providerOutputInvalid,
    ),
    sourceUrl: httpsUrl(parsed.sourceUrl, providerOutputInvalid),
  });
};

const parseCandidate = (
  value: unknown,
  expectedRank: number | null,
): AstrologyLocationCandidateV1 => {
  const parsed = record(value, providerOutputInvalid);
  exactKeys(
    parsed,
    [
      "admin1Code",
      "countryCode",
      "displayName",
      "latitudeE6",
      "locationId",
      "longitudeE6",
      "rank",
      "timeZoneConfidence",
      "timeZoneId",
      "timeZoneSource",
    ],
    providerOutputInvalid,
  );
  const rank = positiveInteger(parsed.rank, 10, providerOutputInvalid);
  if (expectedRank !== null && rank !== expectedRank) providerOutputInvalid();
  const countryCode = text(parsed.countryCode, providerOutputInvalid, 2);
  if (!/^[A-Z]{2}$/u.test(countryCode)) providerOutputInvalid();
  const admin1Code =
    parsed.admin1Code === null ? null : text(parsed.admin1Code, providerOutputInvalid, 32);
  if (admin1Code !== null && !/^[A-Za-z0-9._-]+$/u.test(admin1Code)) {
    providerOutputInvalid();
  }
  const timeZoneId = text(parsed.timeZoneId, providerOutputInvalid, 100);
  if (!timeZonePattern.test(timeZoneId)) providerOutputInvalid();
  return Object.freeze({
    admin1Code,
    countryCode,
    displayName: text(parsed.displayName, providerOutputInvalid, 180),
    latitudeE6: coordinate(parsed.latitudeE6, -90_000_000, 90_000_000, providerOutputInvalid),
    locationId: identifier(parsed.locationId, providerOutputInvalid),
    longitudeE6: coordinate(parsed.longitudeE6, -180_000_000, 180_000_000, providerOutputInvalid),
    rank,
    timeZoneConfidence:
      parsed.timeZoneConfidence === "provider_assigned"
        ? "provider_assigned"
        : providerOutputInvalid(),
    timeZoneId,
    timeZoneSource: identifier(parsed.timeZoneSource, providerOutputInvalid),
  });
};

const parseProviderSearchCandidates = (
  value: unknown,
  limit: number,
): readonly AstrologyLocationCandidateV1[] => {
  if (!Array.isArray(value) || value.length > limit) providerOutputInvalid();
  const candidates = (value as unknown[]).map((candidate, index) =>
    parseCandidate(candidate, index + 1),
  );
  if (
    new Set(candidates.map(({ locationId }) => locationId)).size !== candidates.length ||
    new Set(
      candidates.map(
        ({ latitudeE6, longitudeE6, timeZoneId }) => `${latitudeE6}:${longitudeE6}:${timeZoneId}`,
      ),
    ).size !== candidates.length
  ) {
    providerOutputInvalid();
  }
  return Object.freeze(candidates);
};

const parseRuntimeMetadata = (value: unknown): AstrologyTimeZoneRuntimeMetadataV1 => {
  const parsed = record(value, runtimeInvalid);
  exactKeys(
    parsed,
    ["icuVersion", "runtimeId", "runtimeVersion", "timeZoneDataVersion"],
    runtimeInvalid,
  );
  return Object.freeze({
    icuVersion: text(parsed.icuVersion, runtimeInvalid, 64),
    runtimeId: parsed.runtimeId === "node_intl" ? "node_intl" : runtimeInvalid(),
    runtimeVersion: text(parsed.runtimeVersion, runtimeInvalid, 64),
    timeZoneDataVersion: text(parsed.timeZoneDataVersion, runtimeInvalid, 64),
  });
};

const parseLocalParts = (value: unknown): AstrologyTimeZoneLocalPartsV1 => {
  const parsed = record(value, runtimeInvalid);
  exactKeys(parsed, ["day", "hour", "minute", "month", "second", "year"], runtimeInvalid);
  const year = positiveInteger(parsed.year, 9999, runtimeInvalid);
  const month = positiveInteger(parsed.month, 12, runtimeInvalid);
  const day = positiveInteger(parsed.day, 31, runtimeInvalid);
  const hour =
    Number.isSafeInteger(parsed.hour) &&
    (parsed.hour as number) >= 0 &&
    (parsed.hour as number) <= 23
      ? (parsed.hour as number)
      : runtimeInvalid();
  const minute =
    Number.isSafeInteger(parsed.minute) &&
    (parsed.minute as number) >= 0 &&
    (parsed.minute as number) <= 59
      ? (parsed.minute as number)
      : runtimeInvalid();
  const second =
    Number.isSafeInteger(parsed.second) &&
    (parsed.second as number) >= 0 &&
    (parsed.second as number) <= 59
      ? (parsed.second as number)
      : runtimeInvalid();
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== day ||
    instant.getUTCHours() !== hour ||
    instant.getUTCMinutes() !== minute ||
    instant.getUTCSeconds() !== second
  ) {
    runtimeInvalid();
  }
  return Object.freeze({ day, hour, minute, month, second, year });
};

export const parseAstrologyLocationSearchRequestV1 = (
  value: unknown,
): AstrologyLocationSearchRequestV1 => {
  const parsed = record(value, inputInvalid);
  exactKeys(parsed, ["limit", "locale", "query", "schemaVersion"], inputInvalid);
  if (
    parsed.schemaVersion !== astrologyLocationSearchRequestSchemaVersion ||
    parsed.locale !== "en"
  ) {
    inputInvalid();
  }
  if (
    typeof parsed.query !== "string" ||
    parsed.query.length === 0 ||
    parsed.query.length > 256 ||
    forbiddenText.test(parsed.query)
  ) {
    inputInvalid();
  }
  const rawQuery = parsed.query as string;
  const query = rawQuery.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (query.length < 2 || query.length > 120 || forbiddenText.test(query)) inputInvalid();
  return Object.freeze({
    limit: positiveInteger(parsed.limit, 10, inputInvalid),
    locale: "en",
    query,
    schemaVersion: astrologyLocationSearchRequestSchemaVersion,
  });
};

export const canonicalizeAstrologyLocationSearchRequestV1 = (
  request: AstrologyLocationSearchRequestV1,
): string => JSON.stringify(parseAstrologyLocationSearchRequestV1(request));

export const parseAstrologyLocalTimeResolutionRequestV1 = (
  value: unknown,
): AstrologyLocalTimeResolutionRequestV1 => {
  const parsed = record(value, inputInvalid);
  exactKeys(
    parsed,
    ["disambiguation", "localDate", "localTime", "locationId", "schemaVersion"],
    inputInvalid,
  );
  if (parsed.schemaVersion !== astrologyLocalTimeResolutionRequestSchemaVersion) inputInvalid();
  const localTime = text(parsed.localTime, inputInvalid, 5);
  if (!localTimePattern.test(localTime)) inputInvalid();
  const disambiguation =
    parsed.disambiguation === null
      ? null
      : astrologyLocalTimeDisambiguations.includes(
            parsed.disambiguation as AstrologyLocalTimeDisambiguation,
          )
        ? (parsed.disambiguation as AstrologyLocalTimeDisambiguation)
        : inputInvalid();
  return Object.freeze({
    disambiguation,
    localDate: date(parsed.localDate, inputInvalid),
    localTime,
    locationId: identifier(parsed.locationId, inputInvalid),
    schemaVersion: astrologyLocalTimeResolutionRequestSchemaVersion,
  });
};

const sameDescriptor = (
  left: AstrologyLocationProviderDescriptorV1,
  right: AstrologyLocationProviderDescriptorV1,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const sameRuntimeMetadata = (
  left: AstrologyTimeZoneRuntimeMetadataV1,
  right: AstrologyTimeZoneRuntimeMetadataV1,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const callProvider = async <Value>(operation: () => Promise<Value>): Promise<Value> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AstrologyLocationTimeZoneError) throw error;
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_PROVIDER_UNAVAILABLE");
  }
};

const runtimeCall = <Value>(operation: () => Value): Value => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof AstrologyLocationTimeZoneError) throw error;
    throw new AstrologyLocationTimeZoneError("ASTROLOGY_TIME_ZONE_RUNTIME_UNAVAILABLE");
  }
};

const projectLocation = (
  candidate: AstrologyLocationCandidateV1,
): Omit<AstrologyLocationCandidateV1, "rank"> =>
  Object.freeze({
    admin1Code: candidate.admin1Code,
    countryCode: candidate.countryCode,
    displayName: candidate.displayName,
    latitudeE6: candidate.latitudeE6,
    locationId: candidate.locationId,
    longitudeE6: candidate.longitudeE6,
    timeZoneConfidence: candidate.timeZoneConfidence,
    timeZoneId: candidate.timeZoneId,
    timeZoneSource: candidate.timeZoneSource,
  });

const localPartsEpochMilliseconds = (parts: AstrologyTimeZoneLocalPartsV1): number =>
  Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

const localInputEpochMilliseconds = (request: AstrologyLocalTimeResolutionRequestV1): number => {
  const year = Number.parseInt(request.localDate.slice(0, 4), 10);
  const month = Number.parseInt(request.localDate.slice(5, 7), 10);
  const day = Number.parseInt(request.localDate.slice(8, 10), 10);
  const hour = Number.parseInt(request.localTime.slice(0, 2), 10);
  const minute = Number.parseInt(request.localTime.slice(3, 5), 10);
  return Date.UTC(year, month - 1, day, hour, minute, 0, 0);
};

const matchesLocalInput = (
  parts: AstrologyTimeZoneLocalPartsV1,
  request: AstrologyLocalTimeResolutionRequestV1,
): boolean =>
  `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}` === request.localDate &&
  `${parts.hour.toString().padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}` ===
    request.localTime &&
  parts.second === 0;

const resolveHistoricalCandidates = (
  runtime: AstrologyTimeZoneRuntimeV1,
  timeZoneId: string,
  request: AstrologyLocalTimeResolutionRequestV1,
): readonly AstrologyHistoricalInstantCandidateV1[] => {
  const localEpoch = localInputEpochMilliseconds(request);
  const offsets = new Set<number>();
  for (let hourDelta = -48; hourDelta <= 48; hourDelta += 6) {
    const sampleEpoch = localEpoch + hourDelta * 3_600_000;
    const parts = parseLocalParts(
      runtimeCall(() => runtime.formatLocalParts(timeZoneId, sampleEpoch)),
    );
    const offsetMilliseconds = localPartsEpochMilliseconds(parts) - sampleEpoch;
    if (
      !Number.isSafeInteger(offsetMilliseconds) ||
      offsetMilliseconds < -93_600_000 ||
      offsetMilliseconds > 93_600_000 ||
      offsetMilliseconds % 1_000 !== 0
    ) {
      runtimeInvalid();
    }
    offsets.add(offsetMilliseconds);
  }

  const candidates = [...offsets]
    .map((offsetMilliseconds) => {
      const utcEpoch = localEpoch - offsetMilliseconds;
      const parts = parseLocalParts(
        runtimeCall(() => runtime.formatLocalParts(timeZoneId, utcEpoch)),
      );
      return matchesLocalInput(parts, request)
        ? Object.freeze({
            offsetSeconds: offsetMilliseconds / 1_000,
            utcInstant: new Date(utcEpoch).toISOString(),
          })
        : null;
    })
    .filter((candidate): candidate is AstrologyHistoricalInstantCandidateV1 => candidate !== null)
    .sort((left, right) => left.utcInstant.localeCompare(right.utcInstant));

  if (candidates.length > 2) runtimeInvalid();
  return Object.freeze(candidates);
};

const baseResolution = (
  request: AstrologyLocalTimeResolutionRequestV1,
  candidate: AstrologyLocationCandidateV1,
  provider: AstrologyLocationProviderDescriptorV1,
  runtime: AstrologyTimeZoneRuntimeMetadataV1,
  runtimeCanonicalTimeZoneId: string,
): AstrologyLocalTimeResolutionBaseV1 =>
  Object.freeze({
    historicalConfidence:
      Number.parseInt(request.localDate.slice(0, 4), 10) < 1970
        ? "limited_pre_1970_tzdb"
        : "tzdb_rule_match",
    localInput: Object.freeze({
      date: request.localDate,
      precision: "minute",
      time: request.localTime,
    }),
    selectedLocation: projectLocation(candidate),
    provider,
    queryIncluded: false,
    runtime,
    runtimeCanonicalTimeZoneId,
    schemaVersion: astrologyLocalTimeResolutionResultSchemaVersion,
  });

export const createAstrologyLocationTimeZoneAdapterV1 = (
  providerImplementation: AstrologyLocationProviderV1,
  runtimeImplementation: AstrologyTimeZoneRuntimeV1,
): AstrologyLocationTimeZoneAdapterV1 => {
  const provider = parseProviderDescriptor(providerImplementation.descriptor);
  const runtime = parseRuntimeMetadata(runtimeImplementation.metadata);

  return Object.freeze({
    provider,
    async readLocation(locationId, context = {}) {
      const parsedLocationId = identifier(locationId, inputInvalid);
      const rawCandidate = await callProvider(() =>
        providerImplementation.readLocation(parsedLocationId, context),
      );
      if (rawCandidate === null) {
        throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_NOT_FOUND");
      }
      const candidate = parseCandidate(rawCandidate, 1);
      if (candidate.locationId !== parsedLocationId) providerOutputInvalid();
      const returnedProvider = parseProviderDescriptor(providerImplementation.descriptor);
      if (!sameDescriptor(provider, returnedProvider)) providerOutputInvalid();
      return Object.freeze({
        provider,
        queryIncluded: false,
        schemaVersion: astrologyLocationSelectionResultSchemaVersion,
        selectedLocation: projectLocation(candidate),
      });
    },
    async resolve(value, context = {}) {
      const request = parseAstrologyLocalTimeResolutionRequestV1(value);
      const rawCandidate = await callProvider(() =>
        providerImplementation.readLocation(request.locationId, context),
      );
      if (rawCandidate === null) {
        throw new AstrologyLocationTimeZoneError("ASTROLOGY_LOCATION_NOT_FOUND");
      }
      const candidate = parseCandidate(rawCandidate, 1);
      if (candidate.locationId !== request.locationId) providerOutputInvalid();
      const returnedProvider = parseProviderDescriptor(providerImplementation.descriptor);
      if (!sameDescriptor(provider, returnedProvider)) providerOutputInvalid();

      const runtimeCanonicalTimeZoneId = text(
        runtimeCall(() => runtimeImplementation.canonicalizeTimeZone(candidate.timeZoneId)),
        runtimeInvalid,
        100,
      );
      if (!timeZonePattern.test(runtimeCanonicalTimeZoneId)) runtimeInvalid();
      const candidateInstants = resolveHistoricalCandidates(
        runtimeImplementation,
        runtimeCanonicalTimeZoneId,
        request,
      );
      const returnedRuntime = parseRuntimeMetadata(runtimeImplementation.metadata);
      if (!sameRuntimeMetadata(runtime, returnedRuntime)) runtimeInvalid();
      const base = baseResolution(
        request,
        candidate,
        provider,
        runtime,
        runtimeCanonicalTimeZoneId,
      );

      if (candidateInstants.length === 0) {
        if (request.disambiguation !== null) inputInvalid();
        return Object.freeze({
          ...base,
          ambiguity: "local_clock_gap",
          candidateInstants: Object.freeze([]) as readonly [],
          offsetSeconds: null,
          status: "nonexistent_local_time",
          utcInstant: null,
        });
      }
      if (candidateInstants.length === 1) {
        if (request.disambiguation !== null) inputInvalid();
        const resolved = candidateInstants[0]!;
        return Object.freeze({
          ...base,
          ambiguity: "unambiguous",
          candidateInstants,
          offsetSeconds: resolved.offsetSeconds,
          status: "resolved",
          utcInstant: resolved.utcInstant,
        });
      }
      const ambiguousCandidates = candidateInstants as readonly [
        AstrologyHistoricalInstantCandidateV1,
        AstrologyHistoricalInstantCandidateV1,
      ];
      if (request.disambiguation === null) {
        return Object.freeze({
          ...base,
          ambiguity: "requires_explicit_choice",
          candidateInstants: ambiguousCandidates,
          offsetSeconds: null,
          status: "ambiguous_local_time",
          utcInstant: null,
        });
      }
      const resolved =
        request.disambiguation === "earlier" ? ambiguousCandidates[0] : ambiguousCandidates[1];
      return Object.freeze({
        ...base,
        ambiguity: request.disambiguation,
        candidateInstants: ambiguousCandidates,
        offsetSeconds: resolved.offsetSeconds,
        status: "resolved",
        utcInstant: resolved.utcInstant,
      });
    },
    async search(value, context = {}) {
      const request = parseAstrologyLocationSearchRequestV1(value);
      const rawCandidates = await callProvider(() =>
        providerImplementation.search(request, context),
      );
      const candidates = parseProviderSearchCandidates(rawCandidates, request.limit);
      const returnedProvider = parseProviderDescriptor(providerImplementation.descriptor);
      if (!sameDescriptor(provider, returnedProvider)) providerOutputInvalid();
      return Object.freeze({
        cachePolicy: Object.freeze({
          containsRawQuery: false,
          searchResults: "private_process_memory_hmac_key_only",
          ttlSeconds: provider.privateSearchCacheTtlSeconds,
        }),
        candidates,
        provider,
        queryIncluded: false,
        schemaVersion: astrologyLocationSearchResultSchemaVersion,
        selectionRequired: candidates.length !== 1,
      });
    },
  });
};
