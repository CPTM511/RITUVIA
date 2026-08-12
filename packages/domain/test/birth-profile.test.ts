import { describe, expect, it } from "vitest";

import {
  birthProfileCreateSchemaVersion,
  birthProfileSchemaVersion,
  canonicalizeBirthProfileWriteRequestV1,
  parseBirthProfilePayloadV1,
  parseBirthProfileWriteRequestV1,
} from "../src/birth-profile";

const baseRequest = {
  approximationWindowMinutes: null,
  birthDate: "1990-05-20",
  birthTime: "09:15",
  disambiguation: null,
  label: "My birth profile",
  locationId: "geonames:5128581",
  schemaVersion: birthProfileCreateSchemaVersion,
  timeCertainty: "exact",
} as const;

const basePayload = {
  label: "My birth profile",
  selectedLocation: {
    admin1Code: "NY",
    countryCode: "US",
    displayName: "New York City, New York, United States",
    latitudeE6: 40_714_300,
    locationId: "geonames:5128581",
    longitudeE6: -74_006_000,
    timeZoneConfidence: "provider_assigned",
    timeZoneId: "America/New_York",
    timeZoneSource: "geonames.timezone",
  },
  normalized: {
    ambiguity: "unambiguous",
    offsetSeconds: -14_400,
    runtimeCanonicalTimeZoneId: "America/New_York",
    utcInstant: "1990-05-20T13:15:00.000Z",
  },
  originalInput: {
    approximationWindowMinutes: null,
    birthDate: "1990-05-20",
    birthTime: "09:15",
    disambiguation: null,
    locationId: "geonames:5128581",
  },
  provider: {
    adapterVersion: "1.0.0",
    attributionRequired: true,
    attributionText: "GeoNames",
    dataSha256: "a".repeat(64),
    dataVersion: "fixture-2026-07-26",
    licenseId: "CC-BY-4.0",
    providerId: "geonames.gazetteer",
    providerVersion: "1.0.0",
    sourceUrl: "https://download.geonames.org/export/dump/",
  },
  runtime: {
    historicalConfidence: "tzdb_rule_match",
    icuVersion: "78.3",
    runtimeId: "node_intl",
    runtimeVersion: "24.18.0",
    timeZoneDataVersion: "2026b",
  },
  schemaVersion: birthProfileSchemaVersion,
  timeCertainty: "exact",
} as const;

describe("birth profile uncertainty contract", () => {
  it("accepts exact time and produces a stable canonical request", () => {
    expect(parseBirthProfileWriteRequestV1(baseRequest, birthProfileCreateSchemaVersion)).toEqual(
      baseRequest,
    );
    expect(
      canonicalizeBirthProfileWriteRequestV1(baseRequest, birthProfileCreateSchemaVersion),
    ).toBe(JSON.stringify(baseRequest));
  });

  it("preserves a private CJK or Devanagari profile label in NFC", () => {
    for (const label of ["𠮷野家の出生プロフィール", "अनन्या का जन्म प्रोफ़ाइल"]) {
      expect(
        parseBirthProfileWriteRequestV1({ ...baseRequest, label }, birthProfileCreateSchemaVersion)
          .label,
      ).toBe(label.normalize("NFC"));
    }
  });

  it("requires an explicit bounded uncertainty window for approximate time", () => {
    expect(
      parseBirthProfileWriteRequestV1(
        { ...baseRequest, approximationWindowMinutes: 30, timeCertainty: "approximate" },
        birthProfileCreateSchemaVersion,
      ),
    ).toMatchObject({ approximationWindowMinutes: 30, timeCertainty: "approximate" });
    expect(() =>
      parseBirthProfileWriteRequestV1(
        { ...baseRequest, approximationWindowMinutes: null, timeCertainty: "approximate" },
        birthProfileCreateSchemaVersion,
      ),
    ).toThrow("Birth profile data is invalid.");
  });

  it("does not allow an unknown time to carry a fabricated time", () => {
    const unknown = {
      ...baseRequest,
      birthTime: null,
      disambiguation: null,
      timeCertainty: "unknown",
    };
    expect(parseBirthProfileWriteRequestV1(unknown, birthProfileCreateSchemaVersion)).toMatchObject(
      { birthTime: null, timeCertainty: "unknown" },
    );
    expect(() =>
      parseBirthProfileWriteRequestV1(
        { ...unknown, birthTime: "12:00" },
        birthProfileCreateSchemaVersion,
      ),
    ).toThrow("Birth profile data is invalid.");
  });

  it("validates replayable exact provenance and UTC normalization", () => {
    expect(parseBirthProfilePayloadV1(basePayload)).toEqual(basePayload);
  });

  it("requires unknown time payloads to omit UTC and runtime resolution", () => {
    const unknown = {
      ...basePayload,
      normalized: {
        ambiguity: "unknown_time",
        offsetSeconds: null,
        runtimeCanonicalTimeZoneId: null,
        utcInstant: null,
      },
      originalInput: {
        ...basePayload.originalInput,
        birthTime: null,
      },
      runtime: null,
      timeCertainty: "unknown",
    };
    expect(parseBirthProfilePayloadV1(unknown)).toEqual(unknown);
    expect(() =>
      parseBirthProfilePayloadV1({
        ...unknown,
        normalized: { ...unknown.normalized, utcInstant: "1990-05-20T12:00:00.000Z" },
      }),
    ).toThrow("Birth profile data is invalid.");
  });
});
