export const astrologyNatalViewResponseSchemaVersion = "astrology-natal-view-response.v1" as const;
export const astrologyNatalViewFactsSchemaVersion = "astrology-natal-view-facts.v1" as const;

export const astrologyNatalViewBodies = Object.freeze([
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
export type AstrologyNatalViewBody = (typeof astrologyNatalViewBodies)[number];

export const astrologyNatalViewZodiacSigns = Object.freeze([
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
export type AstrologyNatalViewZodiacSign = (typeof astrologyNatalViewZodiacSigns)[number];

export const astrologyNatalViewMajorAspects = Object.freeze([
  "conjunction",
  "sextile",
  "square",
  "trine",
  "opposition",
] as const);
export type AstrologyNatalViewMajorAspect = (typeof astrologyNatalViewMajorAspects)[number];

export type AstrologyNatalViewConfidenceCode =
  | "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED"
  | "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS"
  | "ENGINE_UNAVAILABLE_NO_PLACEMENTS"
  | "EXACT_TIME_FULL_FACTS"
  | "UNKNOWN_TIME_NO_PLACEMENTS";

export type AstrologyNatalViewFacts = Readonly<{
  approximationWindowMinutes: number | null;
  aspects: readonly Readonly<{
    aspect: AstrologyNatalViewMajorAspect;
    bodyA: AstrologyNatalViewBody;
    bodyB: AstrologyNatalViewBody;
    exactAngleDegrees: number;
    orbDegrees: number;
    separationDegrees: number;
  }>[];
  calculationStatus:
    | "complete"
    | "limited_approximate_time"
    | "unavailable_engine"
    | "unavailable_unknown_time"
    | "unavailable_untrusted_engine_output";
  confidence: Readonly<{
    anglesAvailable: boolean;
    housesAvailable: boolean;
    messageCode: AstrologyNatalViewConfidenceCode;
    timeCertainty: "approximate" | "exact" | "unknown";
  }>;
  engine: Readonly<{
    abiVersion: string;
    adapterVersion: "1.0.0";
    libraryVersion: "2.10.03";
    sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f";
    sourceSnapshotTag: "v2.10.3final";
  }>;
  houseSystem: "placidus";
  houses: Readonly<{
    angles: Readonly<{
      armcDegrees: number;
      ascendantDegrees: number;
      midheavenDegrees: number;
      vertexDegrees: number;
    }>;
    cuspsDegrees: readonly number[];
  }> | null;
  julianDayUt: number | null;
  method: Readonly<{
    aspectPolicyVersion: "rituvia-major-aspects.v1";
    methodVersion: "rituvia-western-natal.v1";
    node: "true_node";
    zodiac: "tropical";
  }>;
  placements: readonly Readonly<{
    body: AstrologyNatalViewBody;
    distanceAu: number;
    eclipticLatitudeDegrees: number;
    eclipticLongitudeDegrees: number;
    longitudeSpeedDegreesPerDay: number;
    returnedEphemerisFlags: number;
    sign: AstrologyNatalViewZodiacSign;
    signDegrees: number;
  }>[];
  profileRevision: number;
  requestedEphemerisFlags: 258;
  schemaVersion: typeof astrologyNatalViewFactsSchemaVersion;
}>;

export type AstrologyNatalViewItem = Readonly<{
  calculationId: string;
  createdAt: string;
  facts: AstrologyNatalViewFacts;
}>;

export type AstrologyNatalViewResponse = Readonly<{
  item: AstrologyNatalViewItem | null;
  schemaVersion: typeof astrologyNatalViewResponseSchemaVersion;
}>;

type AstrologyNatalViewSourceFacts = Readonly<
  Omit<AstrologyNatalViewFacts, "houseSystem" | "schemaVersion"> & {
    houseSystem: string;
    schemaVersion: string;
  }
>;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const invalid = (): never => {
  throw new TypeError("The saved astrology response is invalid.");
};

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): void => {
  if (Object.keys(value).sort().join("\u0000") !== [...expected].sort().join("\u0000")) invalid();
};

const finite = (value: unknown, minimum: number, maximum: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    invalid();
  }
  return value as number;
};

const integer = (value: unknown, minimum: number, maximum: number): number => {
  const parsed = finite(value, minimum, maximum);
  if (!Number.isSafeInteger(parsed)) invalid();
  return parsed;
};

const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") invalid();
  return value as boolean;
};

const boundedText = (value: unknown, maximumLength: number): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximumLength) invalid();
  return value as string;
};

const oneOf = <Value extends string>(value: unknown, values: readonly Value[]): Value => {
  if (typeof value !== "string" || !values.includes(value as Value)) invalid();
  return value as Value;
};

const parseCreatedAt = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !utcInstantPattern.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    invalid();
  }
  return value as string;
};

const parsePlacement = (value: unknown): AstrologyNatalViewFacts["placements"][number] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "body",
    "distanceAu",
    "eclipticLatitudeDegrees",
    "eclipticLongitudeDegrees",
    "longitudeSpeedDegreesPerDay",
    "returnedEphemerisFlags",
    "sign",
    "signDegrees",
  ]);
  const body = oneOf(parsed.body, astrologyNatalViewBodies);
  const longitude = finite(parsed.eclipticLongitudeDegrees, 0, 360 - Number.EPSILON);
  const sign = oneOf(parsed.sign, astrologyNatalViewZodiacSigns);
  const signIndex = Math.floor(longitude / 30);
  if (
    astrologyNatalViewZodiacSigns.at(signIndex) !== sign ||
    Math.abs(finite(parsed.signDegrees, 0, 30 - Number.EPSILON) - (longitude - signIndex * 30)) >
      1e-9
  ) {
    invalid();
  }
  return Object.freeze({
    body,
    distanceAu: finite(parsed.distanceAu, 0, 1_000),
    eclipticLatitudeDegrees: finite(parsed.eclipticLatitudeDegrees, -90, 90),
    eclipticLongitudeDegrees: longitude,
    longitudeSpeedDegreesPerDay: finite(parsed.longitudeSpeedDegreesPerDay, -100, 100),
    returnedEphemerisFlags: integer(parsed.returnedEphemerisFlags, 0, 2 ** 31 - 1),
    sign,
    signDegrees: parsed.signDegrees as number,
  });
};

const exactAspectAngle = (aspect: AstrologyNatalViewMajorAspect): number => {
  switch (aspect) {
    case "conjunction":
      return 0;
    case "sextile":
      return 60;
    case "square":
      return 90;
    case "trine":
      return 120;
    case "opposition":
      return 180;
  }
};

const maximumAspectOrb = (aspect: AstrologyNatalViewMajorAspect): number => {
  switch (aspect) {
    case "conjunction":
    case "opposition":
      return 8;
    case "square":
    case "trine":
      return 6;
    case "sextile":
      return 4;
  }
};

const parseAspect = (value: unknown): AstrologyNatalViewFacts["aspects"][number] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "aspect",
    "bodyA",
    "bodyB",
    "exactAngleDegrees",
    "orbDegrees",
    "separationDegrees",
  ]);
  const aspect = oneOf(parsed.aspect, astrologyNatalViewMajorAspects);
  const bodyA = oneOf(parsed.bodyA, astrologyNatalViewBodies);
  const bodyB = oneOf(parsed.bodyB, astrologyNatalViewBodies);
  const exactAngleDegrees = finite(parsed.exactAngleDegrees, 0, 180);
  const separationDegrees = finite(parsed.separationDegrees, 0, 180);
  const orbDegrees = finite(parsed.orbDegrees, 0, maximumAspectOrb(aspect));
  if (
    bodyA === bodyB ||
    exactAngleDegrees !== exactAspectAngle(aspect) ||
    Math.abs(Math.abs(separationDegrees - exactAngleDegrees) - orbDegrees) > 1e-9
  ) {
    invalid();
  }
  return Object.freeze({
    aspect,
    bodyA,
    bodyB,
    exactAngleDegrees,
    orbDegrees,
    separationDegrees,
  });
};

const parseAngles = (value: unknown): NonNullable<AstrologyNatalViewFacts["houses"]>["angles"] => {
  const parsed = record(value);
  exactKeys(parsed, ["armcDegrees", "ascendantDegrees", "midheavenDegrees", "vertexDegrees"]);
  return Object.freeze({
    armcDegrees: finite(parsed.armcDegrees, 0, 360 - Number.EPSILON),
    ascendantDegrees: finite(parsed.ascendantDegrees, 0, 360 - Number.EPSILON),
    midheavenDegrees: finite(parsed.midheavenDegrees, 0, 360 - Number.EPSILON),
    vertexDegrees: finite(parsed.vertexDegrees, 0, 360 - Number.EPSILON),
  });
};

const parseHouses = (value: unknown): AstrologyNatalViewFacts["houses"] => {
  if (value === null) return null;
  const parsed = record(value);
  exactKeys(parsed, ["angles", "cuspsDegrees"]);
  const cuspsDegrees: unknown[] = Array.isArray(parsed.cuspsDegrees)
    ? parsed.cuspsDegrees
    : invalid();
  if (cuspsDegrees.length !== 12) invalid();
  return Object.freeze({
    angles: parseAngles(parsed.angles),
    cuspsDegrees: Object.freeze(cuspsDegrees.map((cusp) => finite(cusp, 0, 360 - Number.EPSILON))),
  });
};

const parseConfidence = (value: unknown): AstrologyNatalViewFacts["confidence"] => {
  const parsed = record(value);
  exactKeys(parsed, ["anglesAvailable", "housesAvailable", "messageCode", "timeCertainty"]);
  return Object.freeze({
    anglesAvailable: boolean(parsed.anglesAvailable),
    housesAvailable: boolean(parsed.housesAvailable),
    messageCode: oneOf(parsed.messageCode, [
      "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED",
      "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS",
      "ENGINE_UNAVAILABLE_NO_PLACEMENTS",
      "EXACT_TIME_FULL_FACTS",
      "UNKNOWN_TIME_NO_PLACEMENTS",
    ] as const),
    timeCertainty: oneOf(parsed.timeCertainty, ["approximate", "exact", "unknown"] as const),
  });
};

const parseEngine = (value: unknown): AstrologyNatalViewFacts["engine"] => {
  const parsed = record(value);
  exactKeys(parsed, [
    "abiVersion",
    "adapterVersion",
    "libraryVersion",
    "sourceCommit",
    "sourceSnapshotTag",
  ]);
  if (
    parsed.adapterVersion !== "1.0.0" ||
    parsed.libraryVersion !== "2.10.03" ||
    parsed.sourceCommit !== "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f" ||
    parsed.sourceSnapshotTag !== "v2.10.3final"
  ) {
    invalid();
  }
  return Object.freeze({
    abiVersion: boundedText(parsed.abiVersion, 128),
    adapterVersion: "1.0.0",
    libraryVersion: "2.10.03",
    sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
    sourceSnapshotTag: "v2.10.3final",
  });
};

const parseMethod = (value: unknown): AstrologyNatalViewFacts["method"] => {
  const parsed = record(value);
  exactKeys(parsed, ["aspectPolicyVersion", "methodVersion", "node", "zodiac"]);
  if (
    parsed.aspectPolicyVersion !== "rituvia-major-aspects.v1" ||
    parsed.methodVersion !== "rituvia-western-natal.v1" ||
    parsed.node !== "true_node" ||
    parsed.zodiac !== "tropical"
  ) {
    invalid();
  }
  return Object.freeze({
    aspectPolicyVersion: "rituvia-major-aspects.v1",
    methodVersion: "rituvia-western-natal.v1",
    node: "true_node",
    zodiac: "tropical",
  });
};

const assertUnavailable = (facts: AstrologyNatalViewFacts): void => {
  if (
    facts.placements.length !== 0 ||
    facts.houses !== null ||
    facts.aspects.length !== 0 ||
    facts.julianDayUt !== null ||
    facts.confidence.anglesAvailable ||
    facts.confidence.housesAvailable
  ) {
    invalid();
  }
};

const parseFacts = (value: unknown): AstrologyNatalViewFacts => {
  const parsed = record(value);
  exactKeys(parsed, [
    "approximationWindowMinutes",
    "aspects",
    "calculationStatus",
    "confidence",
    "engine",
    "houseSystem",
    "houses",
    "julianDayUt",
    "method",
    "placements",
    "profileRevision",
    "requestedEphemerisFlags",
    "schemaVersion",
  ]);
  const placements: unknown[] = Array.isArray(parsed.placements) ? parsed.placements : invalid();
  const aspects: unknown[] = Array.isArray(parsed.aspects) ? parsed.aspects : invalid();
  if (
    parsed.schemaVersion !== astrologyNatalViewFactsSchemaVersion ||
    parsed.houseSystem !== "placidus" ||
    parsed.requestedEphemerisFlags !== 258
  ) {
    invalid();
  }
  const approximationWindowMinutes =
    parsed.approximationWindowMinutes === null
      ? null
      : integer(parsed.approximationWindowMinutes, 1, 1_440);
  const julianDayUt =
    parsed.julianDayUt === null ? null : finite(parsed.julianDayUt, 1_000_000, 4_000_000);
  const facts: AstrologyNatalViewFacts = Object.freeze({
    approximationWindowMinutes,
    aspects: Object.freeze(aspects.map(parseAspect)),
    calculationStatus: oneOf(parsed.calculationStatus, [
      "complete",
      "limited_approximate_time",
      "unavailable_engine",
      "unavailable_unknown_time",
      "unavailable_untrusted_engine_output",
    ] as const),
    confidence: parseConfidence(parsed.confidence),
    engine: parseEngine(parsed.engine),
    houseSystem: "placidus",
    houses: parseHouses(parsed.houses),
    julianDayUt,
    method: parseMethod(parsed.method),
    placements: Object.freeze(placements.map(parsePlacement)),
    profileRevision: integer(parsed.profileRevision, 1, 2 ** 31 - 1),
    requestedEphemerisFlags: 258,
    schemaVersion: astrologyNatalViewFactsSchemaVersion,
  });
  if (
    facts.placements.length !== 0 &&
    (facts.placements.length !== astrologyNatalViewBodies.length ||
      facts.placements.some(
        (placement, index) => placement.body !== astrologyNatalViewBodies.at(index),
      ))
  ) {
    invalid();
  }
  if (facts.calculationStatus === "complete") {
    if (
      facts.approximationWindowMinutes !== null ||
      facts.placements.length !== astrologyNatalViewBodies.length ||
      facts.houses === null ||
      facts.julianDayUt === null ||
      facts.confidence.messageCode !== "EXACT_TIME_FULL_FACTS" ||
      facts.confidence.timeCertainty !== "exact" ||
      !facts.confidence.anglesAvailable ||
      !facts.confidence.housesAvailable
    ) {
      invalid();
    }
  } else if (facts.calculationStatus === "limited_approximate_time") {
    if (
      facts.approximationWindowMinutes === null ||
      facts.placements.length !== astrologyNatalViewBodies.length ||
      facts.houses !== null ||
      facts.aspects.length !== 0 ||
      facts.julianDayUt === null ||
      facts.confidence.messageCode !== "APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED" ||
      facts.confidence.timeCertainty !== "approximate" ||
      facts.confidence.anglesAvailable ||
      facts.confidence.housesAvailable
    ) {
      invalid();
    }
  } else {
    assertUnavailable(facts);
    if (
      (facts.calculationStatus === "unavailable_unknown_time" &&
        (facts.confidence.messageCode !== "UNKNOWN_TIME_NO_PLACEMENTS" ||
          facts.confidence.timeCertainty !== "unknown" ||
          facts.approximationWindowMinutes !== null)) ||
      (facts.calculationStatus === "unavailable_engine" &&
        facts.confidence.messageCode !== "ENGINE_UNAVAILABLE_NO_PLACEMENTS") ||
      (facts.calculationStatus === "unavailable_untrusted_engine_output" &&
        facts.confidence.messageCode !== "ENGINE_OUTPUT_REJECTED_NO_PLACEMENTS")
    ) {
      invalid();
    }
  }
  return facts;
};

const parseItem = (value: unknown): AstrologyNatalViewItem => {
  const parsed = record(value);
  exactKeys(parsed, ["calculationId", "createdAt", "facts"]);
  if (typeof parsed.calculationId !== "string" || !uuidV4Pattern.test(parsed.calculationId)) {
    invalid();
  }
  const calculationId = parsed.calculationId as string;
  return Object.freeze({
    calculationId,
    createdAt: parseCreatedAt(parsed.createdAt),
    facts: parseFacts(parsed.facts),
  });
};

export const parseAstrologyNatalViewResponse = (value: unknown): AstrologyNatalViewResponse => {
  const parsed = record(value);
  exactKeys(parsed, ["item", "schemaVersion"]);
  if (parsed.schemaVersion !== astrologyNatalViewResponseSchemaVersion) invalid();
  return Object.freeze({
    item: parsed.item === null ? null : parseItem(parsed.item),
    schemaVersion: astrologyNatalViewResponseSchemaVersion,
  });
};

export const createAstrologyNatalViewResponse = (
  item: Readonly<{
    createdAt: string;
    facts: AstrologyNatalViewSourceFacts;
    id: string;
  }> | null,
): AstrologyNatalViewResponse =>
  parseAstrologyNatalViewResponse({
    item:
      item === null
        ? null
        : {
            calculationId: item.id,
            createdAt: item.createdAt,
            facts: {
              approximationWindowMinutes: item.facts.approximationWindowMinutes,
              aspects: item.facts.aspects,
              calculationStatus: item.facts.calculationStatus,
              confidence: item.facts.confidence,
              engine: {
                abiVersion: item.facts.engine.abiVersion,
                adapterVersion: item.facts.engine.adapterVersion,
                libraryVersion: item.facts.engine.libraryVersion,
                sourceCommit: item.facts.engine.sourceCommit,
                sourceSnapshotTag: item.facts.engine.sourceSnapshotTag,
              },
              houseSystem: item.facts.houseSystem,
              houses: item.facts.houses,
              julianDayUt: item.facts.julianDayUt,
              method: {
                aspectPolicyVersion: item.facts.method.aspectPolicyVersion,
                methodVersion: item.facts.method.methodVersion,
                node: item.facts.method.node,
                zodiac: item.facts.method.zodiac,
              },
              placements: item.facts.placements,
              profileRevision: item.facts.profileRevision,
              requestedEphemerisFlags: item.facts.requestedEphemerisFlags,
              schemaVersion: astrologyNatalViewFactsSchemaVersion,
            },
          },
    schemaVersion: astrologyNatalViewResponseSchemaVersion,
  });
