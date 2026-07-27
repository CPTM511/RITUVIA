export const astrologyNatalRequestSchemaVersion = "astrology-natal-request.v1" as const;
export const astrologyNativeExecutionSchemaVersion = "astrology-native-execution.v1" as const;
export const astrologyNatalFactsSchemaVersion = "astrology-natal-facts.v1" as const;
export const astrologyEphemerisAdapterVersion = "1.0.0" as const;
export const astrologyNatalMethodVersion = "rituvia-western-natal.v1" as const;
export const astrologyAspectPolicyVersion = "rituvia-major-aspects.v1" as const;
export const astrologyMethodCatalogSha256 =
  "b9711f18e41d27807616493c1624ac9633d538c78d91d2fc1436fe99fa4b885f" as const;
export const astrologyRequestedEphemerisFlags = 258 as const;

export const astrologyNatalBodies = Object.freeze([
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "true_node",
] as const);
export type AstrologyNatalBody = (typeof astrologyNatalBodies)[number];

export const astrologyZodiacSigns = Object.freeze([
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const);
export type AstrologyZodiacSign = (typeof astrologyZodiacSigns)[number];

export const astrologyHouseSystems = Object.freeze(["placidus", "whole_sign", "equal"] as const);
export type AstrologyHouseSystem = (typeof astrologyHouseSystems)[number];

export const astrologyMajorAspects = Object.freeze([
  "conjunction",
  "sextile",
  "square",
  "trine",
  "opposition",
] as const);
export type AstrologyMajorAspect = (typeof astrologyMajorAspects)[number];

export const astrologyNatalErrorCodes = Object.freeze([
  "ASTROLOGY_NATAL_INVALID",
  "ASTROLOGY_NATAL_SCHEMA_UNSUPPORTED",
] as const);
export type AstrologyNatalErrorCode = (typeof astrologyNatalErrorCodes)[number];

export class AstrologyNatalError extends Error {
  readonly code: AstrologyNatalErrorCode;

  constructor(code: AstrologyNatalErrorCode) {
    super(
      code === "ASTROLOGY_NATAL_SCHEMA_UNSUPPORTED"
        ? "The astrology natal schema version is unsupported."
        : "The astrology natal contract is invalid.",
    );
    this.name = "AstrologyNatalError";
    this.code = code;
  }
}

export type AstrologyNatalRequestV1 = Readonly<{
  approximationWindowMinutes: number | null;
  houseSystem: AstrologyHouseSystem;
  inputSnapshotSha256: string;
  latitudeE6: number;
  longitudeE6: number;
  method: Readonly<{
    aspectPolicyVersion: typeof astrologyAspectPolicyVersion;
    catalogSha256: typeof astrologyMethodCatalogSha256;
    methodVersion: typeof astrologyNatalMethodVersion;
    node: "true_node";
    zodiac: "tropical";
  }>;
  profileRevision: number;
  schemaVersion: typeof astrologyNatalRequestSchemaVersion;
  timeCertainty: "exact" | "approximate" | "unknown";
  timeZoneProvenanceSha256: string;
  utcInstant: string | null;
}>;

export type AstrologyNativeExecutionRequestV1 = Readonly<{
  houseSystem: AstrologyHouseSystem;
  includeHouses: boolean;
  latitudeE6: number;
  longitudeE6: number;
  schemaVersion: typeof astrologyNativeExecutionSchemaVersion;
  utcInstant: string;
}>;

export type AstrologyNativePositionV1 = Readonly<{
  body: AstrologyNatalBody;
  distanceAu: number;
  latitudeDegrees: number;
  longitudeDegrees: number;
  longitudeSpeedDegreesPerDay: number;
  returnedEphemerisFlags: number;
}>;

export type AstrologyNativeExecutionV1 = Readonly<{
  angles: Readonly<{
    armcDegrees: number;
    ascendantDegrees: number;
    midheavenDegrees: number;
    vertexDegrees: number;
  }> | null;
  engineVersion: string;
  houseCuspsDegrees: readonly number[] | null;
  julianDayUt: number;
  positions: readonly AstrologyNativePositionV1[];
  schemaVersion: typeof astrologyNativeExecutionSchemaVersion;
}>;

export type AstrologyEphemerisNativeExecutorV1 = Readonly<{
  execute(request: AstrologyNativeExecutionRequestV1): Promise<AstrologyNativeExecutionV1>;
}>;

export type AstrologyEngineBuildMetadataV1 = Readonly<{
  abiVersion: string;
  adapterVersion: typeof astrologyEphemerisAdapterVersion;
  binarySha256: string;
  compilerFlagsSha256: string;
  compilerId: string;
  dataInventorySha256: string;
  libraryVersion: "2.10.03";
  nativeSbomSha256: string;
  sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f";
  sourceInventorySha256: string;
  sourceSnapshotTag: "v2.10.3final";
}>;

export type AstrologyNatalPlacementV1 = Readonly<{
  body: AstrologyNatalBody;
  distanceAu: number;
  eclipticLatitudeDegrees: number;
  eclipticLongitudeDegrees: number;
  longitudeSpeedDegreesPerDay: number;
  returnedEphemerisFlags: number;
  sign: AstrologyZodiacSign;
  signDegrees: number;
}>;

export type AstrologyNatalAspectV1 = Readonly<{
  aspect: AstrologyMajorAspect;
  bodyA: AstrologyNatalBody;
  bodyB: AstrologyNatalBody;
  exactAngleDegrees: number;
  orbDegrees: number;
  separationDegrees: number;
}>;

export type AstrologyNatalFactsV1 = Readonly<{
  approximationWindowMinutes: number | null;
  aspects: readonly AstrologyNatalAspectV1[];
  calculationStatus:
    | "complete"
    | "limited_approximate_time"
    | "unavailable_engine"
    | "unavailable_unknown_time"
    | "unavailable_untrusted_engine_output";
  confidence: Readonly<{
    anglesAvailable: boolean;
    housesAvailable: boolean;
    messageCode:
      | "EXACT_TIME_FULL_FACTS"
      | "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED"
      | "UNKNOWN_TIME_NO_PLACEMENTS"
      | "ENGINE_UNAVAILABLE_NO_PLACEMENTS"
      | "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS";
    timeCertainty: AstrologyNatalRequestV1["timeCertainty"];
  }>;
  engine: AstrologyEngineBuildMetadataV1;
  houseSystem: AstrologyHouseSystem;
  houses: Readonly<{
    angles: Readonly<{
      armcDegrees: number;
      ascendantDegrees: number;
      midheavenDegrees: number;
      vertexDegrees: number;
    }>;
    cuspsDegrees: readonly number[];
  }> | null;
  inputSnapshotSha256: string;
  julianDayUt: number | null;
  method: AstrologyNatalRequestV1["method"];
  placements: readonly AstrologyNatalPlacementV1[];
  profileRevision: number;
  requestedEphemerisFlags: typeof astrologyRequestedEphemerisFlags;
  schemaVersion: typeof astrologyNatalFactsSchemaVersion;
  timeZoneProvenanceSha256: string;
}>;

export type AstrologyEphemerisAdapterV1 = Readonly<{
  calculateNatal(request: AstrologyNatalRequestV1): Promise<AstrologyNatalFactsV1>;
  engineMetadata(): AstrologyEngineBuildMetadataV1;
}>;

type UnknownRecord = Record<string, unknown>;

const invalid = (): never => {
  throw new AstrologyNatalError("ASTROLOGY_NATAL_INVALID");
};

const record = (value: unknown): UnknownRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as UnknownRecord;
};

const exactKeys = (value: UnknownRecord, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) invalid();
};

const array = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : invalid());

const finite = (value: unknown, minimum: number, maximum: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    invalid();
  }
  return value as number;
};

const safeInteger = (value: unknown, minimum: number, maximum: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid();
  }
  return value as number;
};

const sha256 = (value: unknown): string =>
  typeof value === "string" && /^[0-9a-f]{64}$/u.test(value) ? value : invalid();

const safeText = (value: unknown, maximumLength: number): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff<>]/u.test(
      value,
    )
  ) {
    invalid();
  }
  return value as string;
};

const normalizedDegrees = (value: unknown): number => finite(value, 0, 360 - Number.EPSILON);
const rounded = (value: number): number => Math.round(value * 1_000_000_000) / 1_000_000_000;

const parseUtcInstant = (value: unknown): string => {
  const parsed = safeText(value, 30);
  const instant = new Date(parsed);
  if (Number.isNaN(instant.getTime()) || instant.toISOString() !== parsed) invalid();
  const year = instant.getUTCFullYear();
  if (year < 1800 || year > 2199) invalid();
  return parsed;
};

const parseHouseSystem = (value: unknown): AstrologyHouseSystem =>
  astrologyHouseSystems.includes(value as AstrologyHouseSystem)
    ? (value as AstrologyHouseSystem)
    : invalid();

const parseBody = (value: unknown): AstrologyNatalBody =>
  astrologyNatalBodies.includes(value as AstrologyNatalBody)
    ? (value as AstrologyNatalBody)
    : invalid();

export const parseAstrologyNatalRequestV1 = (value: unknown): AstrologyNatalRequestV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "approximationWindowMinutes",
    "houseSystem",
    "inputSnapshotSha256",
    "latitudeE6",
    "longitudeE6",
    "method",
    "profileRevision",
    "schemaVersion",
    "timeCertainty",
    "timeZoneProvenanceSha256",
    "utcInstant",
  ]);
  if (parsed.schemaVersion !== astrologyNatalRequestSchemaVersion) {
    throw new AstrologyNatalError("ASTROLOGY_NATAL_SCHEMA_UNSUPPORTED");
  }
  if (
    parsed.timeCertainty !== "exact" &&
    parsed.timeCertainty !== "approximate" &&
    parsed.timeCertainty !== "unknown"
  ) {
    invalid();
  }
  const timeCertainty = parsed.timeCertainty as AstrologyNatalRequestV1["timeCertainty"];
  const method = record(parsed.method);
  exactKeys(method, ["aspectPolicyVersion", "catalogSha256", "methodVersion", "node", "zodiac"]);
  if (
    method.aspectPolicyVersion !== astrologyAspectPolicyVersion ||
    method.catalogSha256 !== astrologyMethodCatalogSha256 ||
    method.methodVersion !== astrologyNatalMethodVersion ||
    method.node !== "true_node" ||
    method.zodiac !== "tropical" ||
    parsed.houseSystem !== "placidus"
  ) {
    invalid();
  }
  const approximationWindowMinutes =
    timeCertainty === "approximate"
      ? safeInteger(parsed.approximationWindowMinutes, 1, 720)
      : parsed.approximationWindowMinutes === null
        ? null
        : invalid();
  const utcInstant =
    timeCertainty === "unknown"
      ? parsed.utcInstant === null
        ? null
        : invalid()
      : parseUtcInstant(parsed.utcInstant);

  return Object.freeze({
    approximationWindowMinutes,
    houseSystem: parseHouseSystem(parsed.houseSystem),
    inputSnapshotSha256: sha256(parsed.inputSnapshotSha256),
    latitudeE6: safeInteger(parsed.latitudeE6, -90_000_000, 90_000_000),
    longitudeE6: safeInteger(parsed.longitudeE6, -180_000_000, 180_000_000),
    method: Object.freeze({
      aspectPolicyVersion: astrologyAspectPolicyVersion,
      catalogSha256: astrologyMethodCatalogSha256,
      methodVersion: astrologyNatalMethodVersion,
      node: "true_node",
      zodiac: "tropical",
    }),
    profileRevision: safeInteger(parsed.profileRevision, 1, Number.MAX_SAFE_INTEGER),
    schemaVersion: astrologyNatalRequestSchemaVersion,
    timeCertainty,
    timeZoneProvenanceSha256: sha256(parsed.timeZoneProvenanceSha256),
    utcInstant,
  });
};

export const parseAstrologyEngineBuildMetadataV1 = (
  value: unknown,
): AstrologyEngineBuildMetadataV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "abiVersion",
    "adapterVersion",
    "binarySha256",
    "compilerFlagsSha256",
    "compilerId",
    "dataInventorySha256",
    "libraryVersion",
    "nativeSbomSha256",
    "sourceCommit",
    "sourceInventorySha256",
    "sourceSnapshotTag",
  ]);
  if (
    parsed.adapterVersion !== astrologyEphemerisAdapterVersion ||
    parsed.libraryVersion !== "2.10.03" ||
    parsed.sourceCommit !== "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f" ||
    parsed.sourceSnapshotTag !== "v2.10.3final"
  ) {
    invalid();
  }
  return Object.freeze({
    abiVersion: safeText(parsed.abiVersion, 100),
    adapterVersion: astrologyEphemerisAdapterVersion,
    binarySha256: sha256(parsed.binarySha256),
    compilerFlagsSha256: sha256(parsed.compilerFlagsSha256),
    compilerId: safeText(parsed.compilerId, 200),
    dataInventorySha256: sha256(parsed.dataInventorySha256),
    libraryVersion: "2.10.03",
    nativeSbomSha256: sha256(parsed.nativeSbomSha256),
    sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
    sourceInventorySha256: sha256(parsed.sourceInventorySha256),
    sourceSnapshotTag: "v2.10.3final",
  });
};

export const parseAstrologyNativeExecutionV1 = (
  value: unknown,
  includeHouses: boolean,
): AstrologyNativeExecutionV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "angles",
    "engineVersion",
    "houseCuspsDegrees",
    "julianDayUt",
    "positions",
    "schemaVersion",
  ]);
  const rawPositions = array(parsed.positions);
  if (
    parsed.schemaVersion !== astrologyNativeExecutionSchemaVersion ||
    parsed.engineVersion !== "2.10.03" ||
    rawPositions.length !== astrologyNatalBodies.length
  ) {
    invalid();
  }
  const positions = rawPositions.map((entry: unknown) => {
    const position = record(entry);
    exactKeys(position, [
      "body",
      "distanceAu",
      "latitudeDegrees",
      "longitudeDegrees",
      "longitudeSpeedDegreesPerDay",
      "returnedEphemerisFlags",
    ]);
    return Object.freeze({
      body: parseBody(position.body),
      distanceAu: finite(position.distanceAu, 0, 100),
      latitudeDegrees: finite(position.latitudeDegrees, -90, 90),
      longitudeDegrees: normalizedDegrees(position.longitudeDegrees),
      longitudeSpeedDegreesPerDay: finite(position.longitudeSpeedDegreesPerDay, -20, 20),
      returnedEphemerisFlags: safeInteger(position.returnedEphemerisFlags, 0, 65_535),
    });
  });
  if (
    new Set(positions.map(({ body }) => body)).size !== astrologyNatalBodies.length ||
    astrologyNatalBodies.some((body) => !positions.some((position) => position.body === body))
  ) {
    invalid();
  }

  let angles: AstrologyNativeExecutionV1["angles"] = null;
  let houseCuspsDegrees: readonly number[] | null = null;
  if (includeHouses) {
    const parsedAngles = record(parsed.angles);
    exactKeys(parsedAngles, [
      "armcDegrees",
      "ascendantDegrees",
      "midheavenDegrees",
      "vertexDegrees",
    ]);
    const rawHouseCusps = array(parsed.houseCuspsDegrees);
    if (rawHouseCusps.length !== 12) invalid();
    angles = Object.freeze({
      armcDegrees: normalizedDegrees(parsedAngles.armcDegrees),
      ascendantDegrees: normalizedDegrees(parsedAngles.ascendantDegrees),
      midheavenDegrees: normalizedDegrees(parsedAngles.midheavenDegrees),
      vertexDegrees: normalizedDegrees(parsedAngles.vertexDegrees),
    });
    houseCuspsDegrees = Object.freeze(rawHouseCusps.map(normalizedDegrees));
  } else if (parsed.angles !== null || parsed.houseCuspsDegrees !== null) {
    invalid();
  }

  return Object.freeze({
    angles,
    engineVersion: "2.10.03",
    houseCuspsDegrees,
    julianDayUt: finite(parsed.julianDayUt, 2_300_000, 2_600_000),
    positions: Object.freeze(positions),
    schemaVersion: astrologyNativeExecutionSchemaVersion,
  });
};

const aspectDefinitions = Object.freeze([
  Object.freeze({ aspect: "conjunction", angle: 0, orb: 8 }),
  Object.freeze({ aspect: "sextile", angle: 60, orb: 4 }),
  Object.freeze({ aspect: "square", angle: 90, orb: 6 }),
  Object.freeze({ aspect: "trine", angle: 120, orb: 6 }),
  Object.freeze({ aspect: "opposition", angle: 180, orb: 8 }),
] satisfies readonly Readonly<{
  angle: number;
  aspect: AstrologyMajorAspect;
  orb: number;
}>[]);

const projectPlacement = (position: AstrologyNativePositionV1): AstrologyNatalPlacementV1 => {
  const longitude = rounded(position.longitudeDegrees);
  const signIndex = Math.floor(longitude / 30);
  return Object.freeze({
    body: position.body,
    distanceAu: rounded(position.distanceAu),
    eclipticLatitudeDegrees: rounded(position.latitudeDegrees),
    eclipticLongitudeDegrees: longitude,
    longitudeSpeedDegreesPerDay: rounded(position.longitudeSpeedDegreesPerDay),
    returnedEphemerisFlags: position.returnedEphemerisFlags,
    sign: astrologyZodiacSigns[signIndex] ?? invalid(),
    signDegrees: rounded(longitude - signIndex * 30),
  });
};

const calculateAspects = (
  placements: readonly AstrologyNatalPlacementV1[],
): readonly AstrologyNatalAspectV1[] => {
  const aspects: AstrologyNatalAspectV1[] = [];
  for (let firstIndex = 0; firstIndex < placements.length; firstIndex += 1) {
    const first = placements[firstIndex] ?? invalid();
    for (let secondIndex = firstIndex + 1; secondIndex < placements.length; secondIndex += 1) {
      const second = placements[secondIndex] ?? invalid();
      const rawSeparation = Math.abs(
        first.eclipticLongitudeDegrees - second.eclipticLongitudeDegrees,
      );
      const separation = rounded(Math.min(rawSeparation, 360 - rawSeparation));
      const match = aspectDefinitions.find(({ angle, orb }) => Math.abs(separation - angle) <= orb);
      if (!match) continue;
      aspects.push(
        Object.freeze({
          aspect: match.aspect,
          bodyA: first.body,
          bodyB: second.body,
          exactAngleDegrees: match.angle,
          orbDegrees: rounded(Math.abs(separation - match.angle)),
          separationDegrees: separation,
        }),
      );
    }
  }
  return Object.freeze(aspects);
};

export const parseAstrologyNatalFactsV1 = (value: unknown): AstrologyNatalFactsV1 => {
  const parsed = record(value);
  exactKeys(parsed, [
    "approximationWindowMinutes",
    "aspects",
    "calculationStatus",
    "confidence",
    "engine",
    "houseSystem",
    "houses",
    "inputSnapshotSha256",
    "julianDayUt",
    "method",
    "placements",
    "profileRevision",
    "requestedEphemerisFlags",
    "schemaVersion",
    "timeZoneProvenanceSha256",
  ]);
  if (parsed.schemaVersion !== astrologyNatalFactsSchemaVersion) {
    throw new AstrologyNatalError("ASTROLOGY_NATAL_SCHEMA_UNSUPPORTED");
  }
  const status = parsed.calculationStatus;
  if (
    status !== "complete" &&
    status !== "limited_approximate_time" &&
    status !== "unavailable_engine" &&
    status !== "unavailable_unknown_time" &&
    status !== "unavailable_untrusted_engine_output"
  ) {
    invalid();
  }
  const calculationStatus = status as AstrologyNatalFactsV1["calculationStatus"];
  const confidence = record(parsed.confidence);
  exactKeys(confidence, ["anglesAvailable", "housesAvailable", "messageCode", "timeCertainty"]);
  if (
    typeof confidence.anglesAvailable !== "boolean" ||
    typeof confidence.housesAvailable !== "boolean" ||
    (confidence.timeCertainty !== "exact" &&
      confidence.timeCertainty !== "approximate" &&
      confidence.timeCertainty !== "unknown")
  ) {
    invalid();
  }
  const method = record(parsed.method);
  exactKeys(method, ["aspectPolicyVersion", "catalogSha256", "methodVersion", "node", "zodiac"]);
  if (
    method.aspectPolicyVersion !== astrologyAspectPolicyVersion ||
    method.catalogSha256 !== astrologyMethodCatalogSha256 ||
    method.methodVersion !== astrologyNatalMethodVersion ||
    method.node !== "true_node" ||
    method.zodiac !== "tropical" ||
    parsed.houseSystem !== "placidus" ||
    parsed.requestedEphemerisFlags !== astrologyRequestedEphemerisFlags
  ) {
    invalid();
  }

  const placements = Object.freeze(
    array(parsed.placements).map((value) => {
      const placement = record(value);
      exactKeys(placement, [
        "body",
        "distanceAu",
        "eclipticLatitudeDegrees",
        "eclipticLongitudeDegrees",
        "longitudeSpeedDegreesPerDay",
        "returnedEphemerisFlags",
        "sign",
        "signDegrees",
      ]);
      const body = parseBody(placement.body);
      const longitude = normalizedDegrees(placement.eclipticLongitudeDegrees);
      const signIndex = Math.floor(longitude / 30);
      const sign = astrologyZodiacSigns[signIndex] ?? invalid();
      if (
        placement.sign !== sign ||
        finite(placement.signDegrees, 0, 30 - Number.EPSILON) !==
          rounded(longitude - signIndex * 30)
      ) {
        invalid();
      }
      return Object.freeze({
        body,
        distanceAu: finite(placement.distanceAu, 0, 100),
        eclipticLatitudeDegrees: finite(placement.eclipticLatitudeDegrees, -90, 90),
        eclipticLongitudeDegrees: longitude,
        longitudeSpeedDegreesPerDay: finite(placement.longitudeSpeedDegreesPerDay, -20, 20),
        returnedEphemerisFlags: safeInteger(placement.returnedEphemerisFlags, 0, 65_535),
        sign,
        signDegrees: placement.signDegrees as number,
      });
    }),
  );
  if (
    placements.length !== 0 &&
    (placements.length !== astrologyNatalBodies.length ||
      placements.some(({ body }, index) => body !== astrologyNatalBodies.at(index)))
  ) {
    invalid();
  }

  const aspects = Object.freeze(
    array(parsed.aspects).map((value) => {
      const aspect = record(value);
      exactKeys(aspect, [
        "aspect",
        "bodyA",
        "bodyB",
        "exactAngleDegrees",
        "orbDegrees",
        "separationDegrees",
      ]);
      const definition = aspectDefinitions.find(({ aspect: name }) => name === aspect.aspect);
      const matchedDefinition = definition ?? invalid();
      const bodyA = parseBody(aspect.bodyA);
      const bodyB = parseBody(aspect.bodyB);
      const firstIndex = astrologyNatalBodies.indexOf(bodyA);
      const secondIndex = astrologyNatalBodies.indexOf(bodyB);
      const separationDegrees = finite(aspect.separationDegrees, 0, 180);
      if (
        firstIndex >= secondIndex ||
        aspect.exactAngleDegrees !== matchedDefinition.angle ||
        finite(aspect.orbDegrees, 0, matchedDefinition.orb) !==
          rounded(Math.abs(separationDegrees - matchedDefinition.angle))
      ) {
        invalid();
      }
      return Object.freeze({
        aspect: matchedDefinition.aspect,
        bodyA,
        bodyB,
        exactAngleDegrees: matchedDefinition.angle,
        orbDegrees: aspect.orbDegrees as number,
        separationDegrees,
      });
    }),
  );

  let houses: AstrologyNatalFactsV1["houses"] = null;
  if (parsed.houses !== null) {
    const rawHouses = record(parsed.houses);
    exactKeys(rawHouses, ["angles", "cuspsDegrees"]);
    const rawAngles = record(rawHouses.angles);
    exactKeys(rawAngles, ["armcDegrees", "ascendantDegrees", "midheavenDegrees", "vertexDegrees"]);
    const cuspsDegrees = array(rawHouses.cuspsDegrees);
    if (cuspsDegrees.length !== 12) invalid();
    houses = Object.freeze({
      angles: Object.freeze({
        armcDegrees: normalizedDegrees(rawAngles.armcDegrees),
        ascendantDegrees: normalizedDegrees(rawAngles.ascendantDegrees),
        midheavenDegrees: normalizedDegrees(rawAngles.midheavenDegrees),
        vertexDegrees: normalizedDegrees(rawAngles.vertexDegrees),
      }),
      cuspsDegrees: Object.freeze(cuspsDegrees.map(normalizedDegrees)),
    });
  }

  const expected = (() => {
    switch (calculationStatus) {
      case "complete":
        return {
          angles: true,
          approximation: null,
          houses: true,
          message: "EXACT_TIME_FULL_FACTS",
          time: "exact",
        } as const;
      case "limited_approximate_time":
        return {
          angles: false,
          approximation: "window",
          houses: false,
          message: "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED",
          time: "approximate",
        } as const;
      case "unavailable_engine":
        return {
          angles: false,
          approximation: null,
          houses: false,
          message: "ENGINE_UNAVAILABLE_NO_PLACEMENTS",
          time: confidence.timeCertainty,
        } as const;
      case "unavailable_unknown_time":
        return {
          angles: false,
          approximation: null,
          houses: false,
          message: "UNKNOWN_TIME_NO_PLACEMENTS",
          time: "unknown",
        } as const;
      case "unavailable_untrusted_engine_output":
        return {
          angles: false,
          approximation: null,
          houses: false,
          message: "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS",
          time: confidence.timeCertainty,
        } as const;
    }
  })();
  const approximationWindowMinutes =
    expected.approximation === "window"
      ? safeInteger(parsed.approximationWindowMinutes, 1, 720)
      : parsed.approximationWindowMinutes === null
        ? null
        : invalid();
  const isAvailable = status === "complete" || status === "limited_approximate_time";
  if (
    confidence.anglesAvailable !== expected.angles ||
    confidence.housesAvailable !== expected.houses ||
    confidence.messageCode !== expected.message ||
    confidence.timeCertainty !== expected.time ||
    (status === "complete" &&
      (houses === null || placements.length !== astrologyNatalBodies.length)) ||
    (status === "limited_approximate_time" &&
      (houses !== null ||
        aspects.length !== 0 ||
        placements.length !== astrologyNatalBodies.length)) ||
    (!isAvailable && (houses !== null || aspects.length !== 0 || placements.length !== 0))
  ) {
    invalid();
  }
  const julianDayUt =
    isAvailable && parsed.julianDayUt !== null
      ? finite(parsed.julianDayUt, 2_300_000, 2_600_000)
      : parsed.julianDayUt === null
        ? null
        : invalid();

  return Object.freeze({
    approximationWindowMinutes,
    aspects,
    calculationStatus,
    confidence: Object.freeze({
      anglesAvailable: expected.angles,
      housesAvailable: expected.houses,
      messageCode: expected.message as AstrologyNatalFactsV1["confidence"]["messageCode"],
      timeCertainty: confidence.timeCertainty as AstrologyNatalRequestV1["timeCertainty"],
    }),
    engine: parseAstrologyEngineBuildMetadataV1(parsed.engine),
    houseSystem: "placidus",
    houses,
    inputSnapshotSha256: sha256(parsed.inputSnapshotSha256),
    julianDayUt,
    method: Object.freeze({
      aspectPolicyVersion: astrologyAspectPolicyVersion,
      catalogSha256: astrologyMethodCatalogSha256,
      methodVersion: astrologyNatalMethodVersion,
      node: "true_node",
      zodiac: "tropical",
    }),
    placements,
    profileRevision: safeInteger(parsed.profileRevision, 1, Number.MAX_SAFE_INTEGER),
    requestedEphemerisFlags: astrologyRequestedEphemerisFlags,
    schemaVersion: astrologyNatalFactsSchemaVersion,
    timeZoneProvenanceSha256: sha256(parsed.timeZoneProvenanceSha256),
  });
};

const unavailable = (
  request: AstrologyNatalRequestV1,
  engine: AstrologyEngineBuildMetadataV1,
  status: "unavailable_engine" | "unavailable_unknown_time" | "unavailable_untrusted_engine_output",
): AstrologyNatalFactsV1 =>
  Object.freeze({
    approximationWindowMinutes: request.approximationWindowMinutes,
    aspects: Object.freeze([]),
    calculationStatus: status,
    confidence: Object.freeze({
      anglesAvailable: false,
      housesAvailable: false,
      messageCode:
        status === "unavailable_unknown_time"
          ? "UNKNOWN_TIME_NO_PLACEMENTS"
          : status === "unavailable_engine"
            ? "ENGINE_UNAVAILABLE_NO_PLACEMENTS"
            : "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS",
      timeCertainty: request.timeCertainty,
    }),
    engine,
    houseSystem: request.houseSystem,
    houses: null,
    inputSnapshotSha256: request.inputSnapshotSha256,
    julianDayUt: null,
    method: request.method,
    placements: Object.freeze([]),
    profileRevision: request.profileRevision,
    requestedEphemerisFlags: astrologyRequestedEphemerisFlags,
    schemaVersion: astrologyNatalFactsSchemaVersion,
    timeZoneProvenanceSha256: request.timeZoneProvenanceSha256,
  });

const hasRequiredSwissFlags = (flags: number): boolean =>
  (flags & 2) === 2 && (flags & 1) === 0 && (flags & 4) === 0;

export const createAstrologyEphemerisAdapterV1 = (
  executor: AstrologyEphemerisNativeExecutorV1,
  buildMetadata: AstrologyEngineBuildMetadataV1,
): AstrologyEphemerisAdapterV1 => {
  const engine = parseAstrologyEngineBuildMetadataV1(buildMetadata);
  return Object.freeze({
    async calculateNatal(value: AstrologyNatalRequestV1): Promise<AstrologyNatalFactsV1> {
      const request = parseAstrologyNatalRequestV1(value);
      if (request.timeCertainty === "unknown" || request.utcInstant === null) {
        return unavailable(request, engine, "unavailable_unknown_time");
      }
      const includeHouses = request.timeCertainty === "exact";
      let execution: AstrologyNativeExecutionV1;
      try {
        execution = parseAstrologyNativeExecutionV1(
          await executor.execute(
            Object.freeze({
              houseSystem: request.houseSystem,
              includeHouses,
              latitudeE6: request.latitudeE6,
              longitudeE6: request.longitudeE6,
              schemaVersion: astrologyNativeExecutionSchemaVersion,
              utcInstant: request.utcInstant,
            }),
          ),
          includeHouses,
        );
      } catch {
        return unavailable(request, engine, "unavailable_engine");
      }
      if (
        execution.positions.some(
          ({ returnedEphemerisFlags }) => !hasRequiredSwissFlags(returnedEphemerisFlags),
        )
      ) {
        return unavailable(request, engine, "unavailable_untrusted_engine_output");
      }

      const placements = Object.freeze(
        astrologyNatalBodies.map((body) => {
          const position = execution.positions.find((candidate) => candidate.body === body);
          return position ? projectPlacement(position) : invalid();
        }),
      );
      const houses =
        includeHouses && execution.angles !== null && execution.houseCuspsDegrees !== null
          ? Object.freeze({
              angles: Object.freeze({
                armcDegrees: rounded(execution.angles.armcDegrees),
                ascendantDegrees: rounded(execution.angles.ascendantDegrees),
                midheavenDegrees: rounded(execution.angles.midheavenDegrees),
                vertexDegrees: rounded(execution.angles.vertexDegrees),
              }),
              cuspsDegrees: Object.freeze(execution.houseCuspsDegrees.map(rounded)),
            })
          : null;

      return Object.freeze({
        approximationWindowMinutes: request.approximationWindowMinutes,
        aspects: includeHouses ? calculateAspects(placements) : Object.freeze([]),
        calculationStatus: includeHouses ? "complete" : "limited_approximate_time",
        confidence: Object.freeze({
          anglesAvailable: includeHouses,
          housesAvailable: includeHouses,
          messageCode: includeHouses
            ? "EXACT_TIME_FULL_FACTS"
            : "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED",
          timeCertainty: request.timeCertainty,
        }),
        engine,
        houseSystem: request.houseSystem,
        houses,
        inputSnapshotSha256: request.inputSnapshotSha256,
        julianDayUt: rounded(execution.julianDayUt),
        method: request.method,
        placements,
        profileRevision: request.profileRevision,
        requestedEphemerisFlags: astrologyRequestedEphemerisFlags,
        schemaVersion: astrologyNatalFactsSchemaVersion,
        timeZoneProvenanceSha256: request.timeZoneProvenanceSha256,
      });
    },
    engineMetadata(): AstrologyEngineBuildMetadataV1 {
      return engine;
    },
  });
};
