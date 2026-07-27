import { readFile } from "node:fs/promises";

import {
  astrologyMethodCatalogSha256,
  astrologyNatalRequestSchemaVersion,
  createAstrologyEphemerisAdapterV1,
  type AstrologyEngineBuildMetadataV1,
} from "@rituvia/divination";
import { Body, Ecliptic, GeoVector } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { createSwissEphemerisNativeExecutorV1 } from "../src/index.js";

type BuildRecord = Readonly<{
  buildProfile: "production" | "security";
  engine: AstrologyEngineBuildMetadataV1;
  runtime: Readonly<{
    binaryPath: string;
    ephemerisPath: string;
  }>;
}>;
type IndependentBody =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";
type ExpectedPlacement = Readonly<{
  body: IndependentBody;
  distanceAu: number;
  latitudeDegrees: number;
  longitudeDegrees: number;
}>;
type IndependentCorpus = Readonly<{
  cases: readonly Readonly<{
    caseId: string;
    expected: readonly ExpectedPlacement[];
    utcInstant: string;
  }>[];
  tolerances: Readonly<{
    distanceRelative: number;
    latitudeDegrees: number;
    longitudeDegrees: number;
  }>;
}>;

const metadataPath = process.env.RITUVIA_NATIVE_BUILD_METADATA_PATH;
const build =
  metadataPath === undefined
    ? null
    : (JSON.parse(await readFile(metadataPath, "utf8")) as BuildRecord);
const nativeDescribe = build === null ? describe.skip : describe;
const independentBodies = Object.freeze([
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
] as const);
const expectedInstants = Object.freeze([
  "1801-01-01T00:00:00.000Z",
  "1888-08-08T12:00:00.000Z",
  "2000-01-01T12:00:00.000Z",
  "2050-06-01T00:00:00.000Z",
]);
const astronomyBodyByRituviaBody = Object.freeze({
  jupiter: Body.Jupiter,
  mars: Body.Mars,
  mercury: Body.Mercury,
  moon: Body.Moon,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
  saturn: Body.Saturn,
  sun: Body.Sun,
  uranus: Body.Uranus,
  venus: Body.Venus,
} satisfies Record<IndependentBody, Body>);
const method = Object.freeze({
  aspectPolicyVersion: "rituvia-major-aspects.v1" as const,
  catalogSha256: astrologyMethodCatalogSha256,
  methodVersion: "rituvia-western-natal.v1" as const,
  node: "true_node" as const,
  zodiac: "tropical" as const,
});
const corpusPath = new URL(
  "../../../content/sources/astrology/reference-vectors/astronomy-engine-2.1.19/independent-geocentric.v1.json",
  import.meta.url,
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
const finiteBetween = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
const parseCorpus = (value: unknown): IndependentCorpus => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "cases",
      "coordinateContract",
      "evidenceClassification",
      "generator",
      "schemaVersion",
      "tolerances",
    ]) ||
    value.schemaVersion !== "astrology-independent-reference-corpus.v1" ||
    value.evidenceClassification !== "independent_open_source_implementation_comparison" ||
    !isRecord(value.coordinateContract) ||
    !exactKeys(value.coordinateContract, [
      "astronomyEngineCalls",
      "description",
      "excludedRituviaBodies",
      "observer",
    ]) ||
    value.coordinateContract.description !==
      "Geocentric apparent true ecliptic-of-date positions with light-time and aberration." ||
    JSON.stringify(value.coordinateContract.astronomyEngineCalls) !==
      JSON.stringify(["GeoVector(body, date, true)", "Ecliptic(vector)"]) ||
    JSON.stringify(value.coordinateContract.excludedRituviaBodies) !==
      JSON.stringify(["true_node"]) ||
    value.coordinateContract.observer !== "earth_center" ||
    !isRecord(value.generator) ||
    !exactKeys(value.generator, [
      "gitCommit",
      "license",
      "npmIntegrity",
      "packageName",
      "packageVersion",
      "publishedAt",
      "repository",
      "validationStatement",
    ]) ||
    value.generator.packageName !== "astronomy-engine" ||
    value.generator.packageVersion !== "2.1.19" ||
    value.generator.gitCommit !== "61dc07020aaa6885d2c7f688a4d82beaf6edb9ef" ||
    value.generator.license !== "MIT" ||
    value.generator.npmIntegrity !==
      "sha512-8yWKNf7UeNbH458h3sAJ6ZgAjE5jTXp/mNNRFoC20j2SHwZIjAQeEsBB2Q3uCFRaTCCJRv33K2XhkhZQMXoX6w==" ||
    value.generator.publishedAt !== "2023-12-14T18:20:31.621Z" ||
    value.generator.repository !== "https://github.com/cosinekitty/astronomy" ||
    value.generator.validationStatement !==
      "The independent project states a plus-or-minus one arcminute design target and validation against NOVAS and JPL Horizons." ||
    !isRecord(value.tolerances) ||
    !exactKeys(value.tolerances, ["distanceRelative", "latitudeDegrees", "longitudeDegrees"]) ||
    value.tolerances.distanceRelative !== 0.001 ||
    value.tolerances.latitudeDegrees !== 0.02 ||
    value.tolerances.longitudeDegrees !== 0.02 ||
    !Array.isArray(value.cases) ||
    value.cases.length !== expectedInstants.length
  ) {
    throw new Error("Independent astronomy corpus is invalid.");
  }

  const cases = value.cases.map((candidate, caseIndex) => {
    const utcInstant = expectedInstants[caseIndex];
    if (
      utcInstant === undefined ||
      !isRecord(candidate) ||
      !exactKeys(candidate, ["caseId", "expected", "utcInstant"]) ||
      candidate.caseId !==
        `astronomy-engine.geocentric.${String(caseIndex + 1).padStart(2, "0")}` ||
      candidate.utcInstant !== utcInstant ||
      !Array.isArray(candidate.expected) ||
      candidate.expected.length !== independentBodies.length
    ) {
      throw new Error("Independent astronomy case is invalid.");
    }
    const expected = candidate.expected.map((placement, bodyIndex) => {
      if (
        !isRecord(placement) ||
        !exactKeys(placement, ["body", "distanceAu", "latitudeDegrees", "longitudeDegrees"]) ||
        placement.body !== independentBodies[bodyIndex] ||
        !finiteBetween(placement.distanceAu, 0.000_001, 100) ||
        !finiteBetween(placement.latitudeDegrees, -90, 90) ||
        !finiteBetween(placement.longitudeDegrees, 0, 360)
      ) {
        throw new Error("Independent astronomy placement is invalid.");
      }
      return Object.freeze({
        body: placement.body,
        distanceAu: placement.distanceAu,
        latitudeDegrees: placement.latitudeDegrees,
        longitudeDegrees: placement.longitudeDegrees,
      }) as ExpectedPlacement;
    });
    return Object.freeze({
      caseId: candidate.caseId,
      expected: Object.freeze(expected),
      utcInstant,
    });
  });
  return Object.freeze({
    cases: Object.freeze(cases),
    tolerances: Object.freeze({
      distanceRelative: value.tolerances.distanceRelative,
      latitudeDegrees: value.tolerances.latitudeDegrees,
      longitudeDegrees: value.tolerances.longitudeDegrees,
    }),
  });
};

const angularDistance = (left: number, right: number): number =>
  Math.abs(((left - right + 540) % 360) - 180);

nativeDescribe("independent astronomy comparison", () => {
  it("matches 40 locked Astronomy Engine geocentric vectors", async () => {
    if (build === null) throw new Error("Native build metadata is required.");
    const corpus = parseCorpus(JSON.parse(await readFile(corpusPath, "utf8")) as unknown);
    const adapter = createAstrologyEphemerisAdapterV1(
      createSwissEphemerisNativeExecutorV1({
        binaryPath: build.runtime.binaryPath,
        binarySha256: build.engine.binarySha256,
        ephemerisFiles: [
          {
            path: "semo_18.se1",
            sha256: "1aca59fbd7f73d3882768a847890304261051c5ed965b952b4c9d7c5951833a4",
          },
          {
            path: "sepl_18.se1",
            sha256: "20aa1c1d68d98895493aef8a4d67d596823309d55078f6d7a9bdbe0d0c7e8d80",
          },
        ],
        ephemerisPath: build.runtime.ephemerisPath,
        maximumOutputBytes: 65_536,
        timeoutMilliseconds: 3_000,
      }),
      build.engine,
    );

    for (const [caseIndex, candidate] of corpus.cases.entries()) {
      const instant = new Date(candidate.utcInstant);
      const facts = await adapter.calculateNatal({
        approximationWindowMinutes: 1,
        houseSystem: "placidus",
        inputSnapshotSha256: String(caseIndex + 1).repeat(64),
        latitudeE6: 0,
        longitudeE6: 0,
        method,
        profileRevision: 1,
        schemaVersion: astrologyNatalRequestSchemaVersion,
        timeCertainty: "approximate",
        timeZoneProvenanceSha256: String(caseIndex + 5).repeat(64),
        utcInstant: candidate.utcInstant,
      });
      expect(facts.calculationStatus).toBe("limited_approximate_time");

      for (const expected of candidate.expected) {
        const independentVector = GeoVector(
          astronomyBodyByRituviaBody[expected.body],
          instant,
          true,
        );
        const independentEcliptic = Ecliptic(independentVector);
        expect(independentEcliptic.elon).toBeCloseTo(expected.longitudeDegrees, 10);
        expect(independentEcliptic.elat).toBeCloseTo(expected.latitudeDegrees, 10);
        expect(
          Math.hypot(independentVector.x, independentVector.y, independentVector.z),
        ).toBeCloseTo(expected.distanceAu, 10);

        const actual = facts.placements.find(({ body }) => body === expected.body);
        expect(actual, `${candidate.caseId}:${expected.body}`).toBeDefined();
        expect(
          angularDistance(
            actual?.eclipticLongitudeDegrees ?? Number.POSITIVE_INFINITY,
            expected.longitudeDegrees,
          ),
          `${candidate.caseId}:${expected.body}:longitude`,
        ).toBeLessThanOrEqual(corpus.tolerances.longitudeDegrees);
        expect(
          Math.abs(
            (actual?.eclipticLatitudeDegrees ?? Number.POSITIVE_INFINITY) -
              expected.latitudeDegrees,
          ),
          `${candidate.caseId}:${expected.body}:latitude`,
        ).toBeLessThanOrEqual(corpus.tolerances.latitudeDegrees);
        expect(
          Math.abs((actual?.distanceAu ?? Number.POSITIVE_INFINITY) - expected.distanceAu) /
            expected.distanceAu,
          `${candidate.caseId}:${expected.body}:distance`,
        ).toBeLessThanOrEqual(corpus.tolerances.distanceRelative);
        expect(actual?.returnedEphemerisFlags).toBe(258);
      }
    }
  });
});
