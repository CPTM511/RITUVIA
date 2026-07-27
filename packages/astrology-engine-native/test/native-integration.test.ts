import { readFile } from "node:fs/promises";

import {
  astrologyMethodCatalogSha256,
  astrologyNatalRequestSchemaVersion,
  createAstrologyEphemerisAdapterV1,
  type AstrologyEngineBuildMetadataV1,
} from "@rituvia/divination";
import { describe, expect, it } from "vitest";

import {
  createSwissEphemerisNativeExecutorV1,
  loadSwissEphemerisAdapterV1FromBuildMetadata,
} from "../src/index.js";

type BuildRecord = Readonly<{
  buildProfile: "production" | "security";
  engine: AstrologyEngineBuildMetadataV1;
  runtime: Readonly<{
    binaryPath: string;
    ephemerisPath: string;
  }>;
}>;

const metadataPath = process.env.RITUVIA_NATIVE_BUILD_METADATA_PATH;
const build =
  metadataPath === undefined
    ? null
    : (JSON.parse(await readFile(metadataPath, "utf8")) as BuildRecord);
const nativeDescribe = build === null ? describe.skip : describe;
const method = Object.freeze({
  aspectPolicyVersion: "rituvia-major-aspects.v1" as const,
  catalogSha256: astrologyMethodCatalogSha256,
  methodVersion: "rituvia-western-natal.v1" as const,
  node: "true_node" as const,
  zodiac: "tropical" as const,
});

nativeDescribe("Swiss Ephemeris native integration", () => {
  it("matches the locked J2000 wrapper vector with explicit Swiss flags", async () => {
    if (build === null || metadataPath === undefined) {
      throw new Error("Native build metadata is required.");
    }
    const adapter =
      build.buildProfile === "production"
        ? await loadSwissEphemerisAdapterV1FromBuildMetadata({
            buildMetadataPath: metadataPath,
            maximumOutputBytes: 65_536,
            timeoutMilliseconds: 3_000,
          })
        : createAstrologyEphemerisAdapterV1(
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
    const facts = await adapter.calculateNatal({
      approximationWindowMinutes: null,
      houseSystem: "placidus",
      inputSnapshotSha256: "a".repeat(64),
      latitudeE6: 40_712_800,
      longitudeE6: -74_006_000,
      method,
      profileRevision: 1,
      schemaVersion: astrologyNatalRequestSchemaVersion,
      timeCertainty: "exact",
      timeZoneProvenanceSha256: "b".repeat(64),
      utcInstant: "2000-01-01T12:00:00.000Z",
    });

    expect(facts.calculationStatus).toBe("complete");
    expect(
      facts.placements.every(({ returnedEphemerisFlags }) => returnedEphemerisFlags === 258),
    ).toBe(true);
    expect(
      facts.placements.find(({ body }) => body === "sun")?.eclipticLongitudeDegrees,
    ).toBeCloseTo(280.36892286, 7);
    expect(
      facts.placements.find(({ body }) => body === "moon")?.eclipticLongitudeDegrees,
    ).toBeCloseTo(223.323800853, 7);
    expect(facts.houses?.angles.ascendantDegrees).toBeCloseTo(274.243391795, 7);
    expect(facts.houses?.angles.midheavenDegrees).toBeCloseTo(208.470568686, 7);
    expect(facts.julianDayUt).toBeCloseTo(2_451_545.00000411, 8);
  });

  it("rejects a mismatched binary attestation without returning partial facts", async () => {
    if (build === null) throw new Error("Native build metadata is required.");
    const executor = createSwissEphemerisNativeExecutorV1({
      binaryPath: build.runtime.binaryPath,
      binarySha256: "0".repeat(64),
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
    });
    const adapter = createAstrologyEphemerisAdapterV1(executor, {
      ...build.engine,
      binarySha256: "0".repeat(64),
    });
    const facts = await adapter.calculateNatal({
      approximationWindowMinutes: null,
      houseSystem: "placidus",
      inputSnapshotSha256: "a".repeat(64),
      latitudeE6: 40_712_800,
      longitudeE6: -74_006_000,
      method,
      profileRevision: 1,
      schemaVersion: astrologyNatalRequestSchemaVersion,
      timeCertainty: "exact",
      timeZoneProvenanceSha256: "b".repeat(64),
      utcInstant: "2000-01-01T12:00:00.000Z",
    });

    expect(facts).toMatchObject({
      calculationStatus: "unavailable_engine",
      houses: null,
      julianDayUt: null,
      placements: [],
    });
  });

  it("matches pinned upstream setest Saturn and Placidus reference vectors", async () => {
    if (build === null) throw new Error("Native build metadata is required.");
    const corpus = JSON.parse(
      await readFile(
        new URL(
          "../../../content/sources/astrology/reference-vectors/swiss-ephemeris-2.10.03/upstream-setest.v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as {
      cases: readonly [
        {
          expected: Record<string, number | string>;
          input: { utcInstant: string };
          tolerances: Record<string, number>;
        },
        {
          expected: {
            anglesDegrees: Record<string, number>;
            cuspsDegrees: readonly number[];
          };
          input: {
            houseSystem: "placidus";
            latitudeE6: number;
            longitudeE6: number;
            utcInstant: string;
          };
          tolerances: Record<string, number>;
        },
      ];
    };
    const executor = createSwissEphemerisNativeExecutorV1({
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
    });
    const adapter = createAstrologyEphemerisAdapterV1(executor, build.engine);
    const [saturnCase, housesCase] = corpus.cases;
    const saturnFacts = await adapter.calculateNatal({
      approximationWindowMinutes: 1,
      houseSystem: "placidus",
      inputSnapshotSha256: "c".repeat(64),
      latitudeE6: 0,
      longitudeE6: 0,
      method,
      profileRevision: 1,
      schemaVersion: astrologyNatalRequestSchemaVersion,
      timeCertainty: "approximate",
      timeZoneProvenanceSha256: "d".repeat(64),
      utcInstant: saturnCase.input.utcInstant,
    });
    const saturn = saturnFacts.placements.find(({ body }) => body === "saturn");
    expect(saturn).toBeDefined();
    expect(
      Math.abs(
        (saturn?.eclipticLongitudeDegrees ?? Number.POSITIVE_INFINITY) -
          Number(saturnCase.expected.longitudeDegrees),
      ),
    ).toBeLessThanOrEqual(saturnCase.tolerances.longitudeDegrees ?? 0);
    expect(
      Math.abs(
        (saturn?.eclipticLatitudeDegrees ?? Number.POSITIVE_INFINITY) -
          Number(saturnCase.expected.latitudeDegrees),
      ),
    ).toBeLessThanOrEqual(saturnCase.tolerances.latitudeDegrees ?? 0);
    expect(
      Math.abs(
        (saturn?.distanceAu ?? Number.POSITIVE_INFINITY) - Number(saturnCase.expected.distanceAu),
      ),
    ).toBeLessThanOrEqual(saturnCase.tolerances.distanceAu ?? 0);
    expect(saturn?.returnedEphemerisFlags).toBe(saturnCase.expected.returnedEphemerisFlags);

    const houseFacts = await adapter.calculateNatal({
      approximationWindowMinutes: null,
      houseSystem: housesCase.input.houseSystem,
      inputSnapshotSha256: "e".repeat(64),
      latitudeE6: housesCase.input.latitudeE6,
      longitudeE6: housesCase.input.longitudeE6,
      method,
      profileRevision: 1,
      schemaVersion: astrologyNatalRequestSchemaVersion,
      timeCertainty: "exact",
      timeZoneProvenanceSha256: "f".repeat(64),
      utcInstant: housesCase.input.utcInstant,
    });
    expect(houseFacts.calculationStatus).toBe("complete");
    houseFacts.houses?.cuspsDegrees.forEach((value, index) => {
      expect(
        Math.abs(value - (housesCase.expected.cuspsDegrees[index] ?? Number.POSITIVE_INFINITY)),
      ).toBeLessThanOrEqual(housesCase.tolerances.cuspsDegrees ?? 0);
    });
    expect(
      Math.abs(
        (houseFacts.houses?.angles.ascendantDegrees ?? Number.POSITIVE_INFINITY) -
          (housesCase.expected.anglesDegrees.ascendant ?? Number.POSITIVE_INFINITY),
      ),
    ).toBeLessThanOrEqual(housesCase.tolerances.anglesDegrees ?? 0);
  });

  it("rejects polar Placidus fallback without partial facts", async () => {
    if (build === null) throw new Error("Native build metadata is required.");
    const executor = createSwissEphemerisNativeExecutorV1({
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
    });
    const adapter = createAstrologyEphemerisAdapterV1(executor, build.engine);
    await expect(
      adapter.calculateNatal({
        approximationWindowMinutes: null,
        houseSystem: "placidus",
        inputSnapshotSha256: "1".repeat(64),
        latitudeE6: 89_900_000,
        longitudeE6: 0,
        method,
        profileRevision: 1,
        schemaVersion: astrologyNatalRequestSchemaVersion,
        timeCertainty: "exact",
        timeZoneProvenanceSha256: "2".repeat(64),
        utcInstant: "2013-02-11T00:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      aspects: [],
      calculationStatus: "unavailable_engine",
      houses: null,
      placements: [],
    });
  });
});
