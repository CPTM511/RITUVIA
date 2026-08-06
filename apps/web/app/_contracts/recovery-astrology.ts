export const recoveryAstrologyRequestSchemaVersion =
  "recovery-item-8-astrology-request.v1" as const;

export const recoveryAstrologyLocationOptions = Object.freeze([
  Object.freeze({ label: "Kathmandu, Nepal", value: "geonames:1283240" }),
  Object.freeze({ label: "New York City, United States", value: "geonames:5128581" }),
  Object.freeze({ label: "Shanghai, China", value: "geonames:1796236" }),
] as const);

export const recoveryAstrologyTimeCertainties = Object.freeze([
  "exact",
  "approximate",
  "unknown",
] as const);

export type RecoveryAstrologyTimeCertainty = (typeof recoveryAstrologyTimeCertainties)[number];

export type RecoveryAstrologyRequest = Readonly<{
  approximationWindowMinutes: number | null;
  birthDate: string;
  birthTime: string | null;
  disambiguation: "earlier" | "later" | null;
  locationId: (typeof recoveryAstrologyLocationOptions)[number]["value"];
  schemaVersion: typeof recoveryAstrologyRequestSchemaVersion;
  timeCertainty: RecoveryAstrologyTimeCertainty;
}>;

type UnknownRecord = Record<string, unknown>;

const invalid = (): never => {
  throw new TypeError("The protected staging astrology request is invalid.");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) invalid();
};

const birthDate = (value: unknown): string => {
  const parsed = typeof value === "string" ? value : invalid();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed)) invalid();
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

const timeCertainty = (value: unknown): RecoveryAstrologyTimeCertainty => {
  if (
    typeof value !== "string" ||
    !recoveryAstrologyTimeCertainties.includes(value as RecoveryAstrologyTimeCertainty)
  ) {
    invalid();
  }
  return value as RecoveryAstrologyTimeCertainty;
};

export const parseRecoveryAstrologyRequest = (value: unknown): RecoveryAstrologyRequest => {
  const parsed = record(value);
  exactKeys(parsed, [
    "approximationWindowMinutes",
    "birthDate",
    "birthTime",
    "disambiguation",
    "locationId",
    "schemaVersion",
    "timeCertainty",
  ]);
  if (parsed.schemaVersion !== recoveryAstrologyRequestSchemaVersion) invalid();
  const certainty = timeCertainty(parsed.timeCertainty);
  const locationId =
    recoveryAstrologyLocationOptions.find((option) => option.value === parsed.locationId)?.value ??
    invalid();
  const time =
    certainty === "unknown"
      ? parsed.birthTime === null
        ? null
        : invalid()
      : typeof parsed.birthTime === "string" &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(parsed.birthTime)
        ? parsed.birthTime
        : invalid();
  const approximationWindowMinutes =
    certainty === "approximate"
      ? Number.isSafeInteger(parsed.approximationWindowMinutes) &&
        (parsed.approximationWindowMinutes as number) >= 1 &&
        (parsed.approximationWindowMinutes as number) <= 720
        ? (parsed.approximationWindowMinutes as number)
        : invalid()
      : parsed.approximationWindowMinutes === null
        ? null
        : invalid();
  const disambiguation =
    certainty === "unknown"
      ? parsed.disambiguation === null
        ? null
        : invalid()
      : parsed.disambiguation === null ||
          parsed.disambiguation === "earlier" ||
          parsed.disambiguation === "later"
        ? parsed.disambiguation
        : invalid();

  return Object.freeze({
    approximationWindowMinutes,
    birthDate: birthDate(parsed.birthDate),
    birthTime: time,
    disambiguation,
    locationId,
    schemaVersion: recoveryAstrologyRequestSchemaVersion,
    timeCertainty: certainty,
  });
};
