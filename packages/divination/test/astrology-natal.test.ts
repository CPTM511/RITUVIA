import { describe, expect, it, vi } from "vitest";

import {
  AstrologyNatalError,
  astrologyNatalBodies,
  astrologyNatalFactsSchemaVersion,
  astrologyNatalRequestSchemaVersion,
  astrologyNativeExecutionSchemaVersion,
  createAstrologyEphemerisAdapterV1,
  parseAstrologyNatalFactsV1,
  type AstrologyEngineBuildMetadataV1,
  type AstrologyNativeExecutionV1,
} from "../src/index.js";

const digest = "a".repeat(64);
const buildMetadata: AstrologyEngineBuildMetadataV1 = Object.freeze({
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

const request = Object.freeze({
  approximationWindowMinutes: null,
  houseSystem: "placidus" as const,
  inputSnapshotSha256: "f".repeat(64),
  latitudeE6: 40_712_800,
  longitudeE6: -74_006_000,
  method: Object.freeze({
    aspectPolicyVersion: "rituvia-major-aspects.v1" as const,
    catalogSha256: "b9711f18e41d27807616493c1624ac9633d538c78d91d2fc1436fe99fa4b885f" as const,
    methodVersion: "rituvia-western-natal.v1" as const,
    node: "true_node" as const,
    zodiac: "tropical" as const,
  }),
  profileRevision: 3,
  schemaVersion: astrologyNatalRequestSchemaVersion,
  timeCertainty: "exact" as const,
  timeZoneProvenanceSha256: "1".repeat(64),
  utcInstant: "2000-01-01T12:00:00.000Z",
});

const execution = (returnedEphemerisFlags = 258): AstrologyNativeExecutionV1 =>
  Object.freeze({
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
          returnedEphemerisFlags,
        }),
      ),
    ),
    schemaVersion: astrologyNativeExecutionSchemaVersion,
  });

describe("astrology natal facts", () => {
  it("projects exact-time Swiss Ephemeris output into versioned placements, houses, and aspects", async () => {
    const execute = vi.fn(async () => execution());
    const adapter = createAstrologyEphemerisAdapterV1({ execute }, buildMetadata);
    const facts = await adapter.calculateNatal(request);

    expect(facts.schemaVersion).toBe(astrologyNatalFactsSchemaVersion);
    expect(facts.calculationStatus).toBe("complete");
    expect(facts.placements).toHaveLength(astrologyNatalBodies.length);
    expect(facts.placements[0]).toMatchObject({
      body: "sun",
      eclipticLongitudeDegrees: 280,
      sign: "capricorn",
      signDegrees: 10,
    });
    expect(facts.houses?.cuspsDegrees).toHaveLength(12);
    expect(facts.confidence).toEqual({
      anglesAvailable: true,
      housesAvailable: true,
      messageCode: "EXACT_TIME_FULL_FACTS",
      timeCertainty: "exact",
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ includeHouses: true, utcInstant: request.utcInstant }),
    );
  });

  it("suppresses houses and angles for approximate input while retaining the supplied center instant", async () => {
    const execute = vi.fn(async () => ({ ...execution(), angles: null, houseCuspsDegrees: null }));
    const adapter = createAstrologyEphemerisAdapterV1({ execute }, buildMetadata);
    const facts = await adapter.calculateNatal({
      ...request,
      approximationWindowMinutes: 90,
      timeCertainty: "approximate",
    });

    expect(facts.calculationStatus).toBe("limited_approximate_time");
    expect(facts.approximationWindowMinutes).toBe(90);
    expect(facts.houses).toBeNull();
    expect(facts.aspects).toEqual([]);
    expect(facts.placements).toHaveLength(astrologyNatalBodies.length);
    expect(facts.confidence.messageCode).toBe("APPROXIMATE_TIME_ANGLES_AND_HOUSES_SUPPRESSED");
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ includeHouses: false }));
  });

  it("never fabricates an instant or placements for unknown birth time", async () => {
    const execute = vi.fn(async () => execution());
    const adapter = createAstrologyEphemerisAdapterV1({ execute }, buildMetadata);
    const facts = await adapter.calculateNatal({
      ...request,
      timeCertainty: "unknown",
      utcInstant: null,
    });

    expect(facts.calculationStatus).toBe("unavailable_unknown_time");
    expect(facts.approximationWindowMinutes).toBeNull();
    expect(facts.placements).toEqual([]);
    expect(facts.houses).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed without placements when Swiss Ephemeris falls back to Moshier", async () => {
    const adapter = createAstrologyEphemerisAdapterV1(
      { execute: async () => execution(260) },
      buildMetadata,
    );
    const facts = await adapter.calculateNatal(request);

    expect(facts.calculationStatus).toBe("unavailable_untrusted_engine_output");
    expect(facts.placements).toEqual([]);
    expect(facts.julianDayUt).toBeNull();
  });

  it("fails closed without leaking native errors", async () => {
    const adapter = createAstrologyEphemerisAdapterV1(
      {
        execute: async () => {
          throw new Error("private path /tmp/ephe and raw native stderr");
        },
      },
      buildMetadata,
    );
    await expect(adapter.calculateNatal(request)).resolves.toMatchObject({
      calculationStatus: "unavailable_engine",
      placements: [],
    });
  });

  it("rejects invalid uncertainty and extra fields", async () => {
    const adapter = createAstrologyEphemerisAdapterV1(
      { execute: async () => execution() },
      buildMetadata,
    );
    await expect(
      adapter.calculateNatal({
        ...request,
        approximationWindowMinutes: 60,
      }),
    ).rejects.toBeInstanceOf(AstrologyNatalError);
    await expect(
      adapter.calculateNatal({
        ...request,
        unexpected: true,
      } as never),
    ).rejects.toBeInstanceOf(AstrologyNatalError);
    await expect(
      adapter.calculateNatal({
        ...request,
        houseSystem: "whole_sign",
      }),
    ).rejects.toBeInstanceOf(AstrologyNatalError);
    await expect(
      adapter.calculateNatal({
        ...request,
        method: { ...request.method, catalogSha256: "0".repeat(64) },
      } as never),
    ).rejects.toBeInstanceOf(AstrologyNatalError);
  });

  it("returns immutable metadata and facts", async () => {
    const adapter = createAstrologyEphemerisAdapterV1(
      { execute: async () => execution() },
      buildMetadata,
    );
    const facts = await adapter.calculateNatal(request);
    expect(Object.isFrozen(adapter.engineMetadata())).toBe(true);
    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.placements)).toBe(true);
    expect(Object.isFrozen(facts.aspects)).toBe(true);
    expect(parseAstrologyNatalFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
  });

  it("rejects replay facts with altered method, sign, or suppression evidence", async () => {
    const adapter = createAstrologyEphemerisAdapterV1(
      { execute: async () => execution() },
      buildMetadata,
    );
    const facts = await adapter.calculateNatal(request);
    expect(() =>
      parseAstrologyNatalFactsV1({
        ...facts,
        method: { ...facts.method, catalogSha256: "0".repeat(64) },
      }),
    ).toThrow(AstrologyNatalError);
    expect(() =>
      parseAstrologyNatalFactsV1({
        ...facts,
        placements: [{ ...facts.placements[0], sign: "aries" }, ...facts.placements.slice(1)],
      }),
    ).toThrow(AstrologyNatalError);
    expect(() =>
      parseAstrologyNatalFactsV1({
        ...facts,
        calculationStatus: "limited_approximate_time",
      }),
    ).toThrow(AstrologyNatalError);
  });
});
