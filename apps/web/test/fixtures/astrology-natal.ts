import {
  astrologyNatalBodies,
  astrologyNatalRequestSchemaVersion,
  astrologyNativeExecutionSchemaVersion,
  createAstrologyEphemerisAdapterV1,
  type AstrologyEngineBuildMetadataV1,
  type AstrologyNatalFactsV1,
  type AstrologyNatalRequestV1,
  type AstrologyNativeExecutionV1,
} from "@rituvia/divination";

const digest = "a".repeat(64);

const engine: AstrologyEngineBuildMetadataV1 = Object.freeze({
  abiVersion: "darwin-arm64-clang",
  adapterVersion: "1.0.0",
  binarySha256: digest,
  compilerFlagsSha256: "b".repeat(64),
  compilerId: "Apple clang 17",
  dataInventorySha256: "c".repeat(64),
  libraryVersion: "2.10.03",
  nativeSbomSha256: "d".repeat(64),
  sourceCommit: "af9823fe7b06ffefe3d3968fdc5680be8b5eec5f",
  sourceInventorySha256: "e".repeat(64),
  sourceSnapshotTag: "v2.10.3final",
});

const request: AstrologyNatalRequestV1 = Object.freeze({
  approximationWindowMinutes: null,
  houseSystem: "placidus",
  inputSnapshotSha256: "f".repeat(64),
  latitudeE6: 40_712_800,
  longitudeE6: -74_006_000,
  method: Object.freeze({
    aspectPolicyVersion: "rituvia-major-aspects.v1",
    catalogSha256: "b9711f18e41d27807616493c1624ac9633d538c78d91d2fc1436fe99fa4b885f",
    methodVersion: "rituvia-western-natal.v1",
    node: "true_node",
    zodiac: "tropical",
  }),
  profileRevision: 3,
  schemaVersion: astrologyNatalRequestSchemaVersion,
  timeCertainty: "exact",
  timeZoneProvenanceSha256: "1".repeat(64),
  utcInstant: "2000-01-01T12:00:00.000Z",
});

const execution: AstrologyNativeExecutionV1 = Object.freeze({
  angles: Object.freeze({
    armcDegrees: 281.282,
    ascendantDegrees: 24.293,
    midheavenDegrees: 283.11,
    vertexDegrees: 167.2,
  }),
  engineVersion: "2.10.03",
  houseCuspsDegrees: Object.freeze([
    24.293, 51.2, 76.4, 103.11, 132.8, 164.2, 204.293, 231.2, 256.4, 283.11, 312.8, 344.2,
  ]),
  julianDayUt: 2_451_545,
  positions: Object.freeze(
    astrologyNatalBodies.map((body, index) =>
      Object.freeze({
        body,
        distanceAu: index === 1 ? 0.0027 : 1 + index,
        latitudeDegrees: 0,
        longitudeDegrees: (280 + index * 31) % 360,
        longitudeSpeedDegreesPerDay: index === 9 ? -0.01 : 1,
        returnedEphemerisFlags: 258,
      }),
    ),
  ),
  schemaVersion: astrologyNativeExecutionSchemaVersion,
});

const adapter = (reviewedExecution: AstrologyNativeExecutionV1) =>
  createAstrologyEphemerisAdapterV1({ execute: async () => reviewedExecution }, engine);

export const createExactAstrologyFacts = (): Promise<AstrologyNatalFactsV1> =>
  adapter(execution).calculateNatal(request);

export const createApproximateAstrologyFacts = (): Promise<AstrologyNatalFactsV1> =>
  adapter({ ...execution, angles: null, houseCuspsDegrees: null }).calculateNatal({
    ...request,
    approximationWindowMinutes: 90,
    timeCertainty: "approximate",
  });

export const createUnknownTimeAstrologyFacts = (): Promise<AstrologyNatalFactsV1> =>
  adapter(execution).calculateNatal({
    ...request,
    timeCertainty: "unknown",
    utcInstant: null,
  });

export const createAstrologyCalculationResource = async () =>
  Object.freeze({
    createdAt: "2026-07-27T08:00:00.000Z",
    facts: await createExactAstrologyFacts(),
    id: "22222222-2222-4222-8222-222222222222",
  });
