import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  astrologyAspectPolicyVersion,
  astrologyLocalTimeResolutionRequestSchemaVersion,
  astrologyMethodCatalogSha256,
  astrologyNatalMethodVersion,
  astrologyNatalRequestSchemaVersion,
  createAstrologyLocationTimeZoneAdapterV1,
  type AstrologyEphemerisAdapterV1,
  type AstrologyLocationTimeZoneAdapterV1,
  type AstrologyNatalFactsV1,
} from "@rituvia/divination";
import {
  birthProfileCreateSchemaVersion,
  canonicalizeBirthProfileWriteRequestV1,
  parseBirthProfileWriteRequestV1,
} from "@rituvia/domain";

import {
  parseRecoveryAstrologyRequest,
  type RecoveryAstrologyRequest,
} from "../app/_contracts/recovery-astrology";
import { loadWebAstrologyEphemeris } from "./astrology-runtime";
import { loadWebNodeIntlTimeZoneRuntimeV1 } from "./astrology-location-time-zone";

export const recoveryAstrologyLocationCatalogVersion = "recovery-item-8.synthetic.v1" as const;

const recoveryLocations = Object.freeze([
  Object.freeze({
    admin1Code: null,
    countryCode: "NP",
    displayName: "Kathmandu, Nepal",
    latitudeE6: 27_716_700,
    locationId: "geonames:1283240",
    longitudeE6: 85_316_700,
    rank: 1,
    timeZoneConfidence: "provider_assigned",
    timeZoneId: "Asia/Kathmandu",
    timeZoneSource: "geonames.timezone",
  }),
  Object.freeze({
    admin1Code: "NY",
    countryCode: "US",
    displayName: "New York City, United States",
    latitudeE6: 40_714_300,
    locationId: "geonames:5128581",
    longitudeE6: -74_006_000,
    rank: 1,
    timeZoneConfidence: "provider_assigned",
    timeZoneId: "America/New_York",
    timeZoneSource: "geonames.timezone",
  }),
  Object.freeze({
    admin1Code: "SH",
    countryCode: "CN",
    displayName: "Shanghai, China",
    latitudeE6: 31_222_200,
    locationId: "geonames:1796236",
    longitudeE6: 121_458_100,
    rank: 1,
    timeZoneConfidence: "provider_assigned",
    timeZoneId: "Asia/Shanghai",
    timeZoneSource: "geonames.timezone",
  }),
]);

export const recoveryAstrologyLocationCatalogSha256 = createHash("sha256")
  .update(
    JSON.stringify({
      locations: recoveryLocations,
      schemaVersion: recoveryAstrologyLocationCatalogVersion,
    }),
    "utf8",
  )
  .digest("hex");

const locationById = new Map<string, (typeof recoveryLocations)[number]>(
  recoveryLocations.map((location) => [location.locationId, location]),
);

const recoveryLocationProvider = Object.freeze({
  descriptor: Object.freeze({
    adapterVersion: "1.0.0",
    attributionRequired: true,
    attributionText: "GeoNames",
    dataSha256: recoveryAstrologyLocationCatalogSha256,
    dataVersion: recoveryAstrologyLocationCatalogVersion,
    licenseId: "CC-BY-4.0",
    privateSearchCacheTtlSeconds: 60,
    providerId: "geonames.recovery_fixture",
    providerVersion: "1.0.0",
    sourceUrl: "https://download.geonames.org/export/dump/",
  }),
  async readLocation(locationId: string) {
    return locationById.get(locationId) ?? null;
  },
  async search() {
    return [];
  },
});

export const createRecoveryAstrologyLocationTimeZoneAdapter = () =>
  createAstrologyLocationTimeZoneAdapterV1(
    recoveryLocationProvider,
    loadWebNodeIntlTimeZoneRuntimeV1(),
  );

export const recoveryAstrologyServiceErrorCodes = Object.freeze([
  "RECOVERY_ASTROLOGY_AMBIGUITY_REQUIRED",
  "RECOVERY_ASTROLOGY_INPUT_INVALID",
  "RECOVERY_ASTROLOGY_LOCAL_TIME_NONEXISTENT",
  "RECOVERY_ASTROLOGY_UNAVAILABLE",
] as const);

export type RecoveryAstrologyServiceErrorCode = (typeof recoveryAstrologyServiceErrorCodes)[number];

export class RecoveryAstrologyServiceError extends Error {
  readonly code: RecoveryAstrologyServiceErrorCode;

  constructor(code: RecoveryAstrologyServiceErrorCode) {
    super("The protected staging astrology calculation is unavailable.");
    this.name = "RecoveryAstrologyServiceError";
    this.code = code;
  }
}

export type RecoveryAstrologyCalculation = Readonly<{
  createdAt: string;
  facts: AstrologyNatalFactsV1;
  id: string;
}>;

type Dependencies = Readonly<{
  clock(): number;
  createId(): string;
  loadEphemeris(): Promise<AstrologyEphemerisAdapterV1>;
  locationTimeZone: AstrologyLocationTimeZoneAdapterV1;
}>;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const profileRequest = (request: RecoveryAstrologyRequest) =>
  parseBirthProfileWriteRequestV1(
    {
      approximationWindowMinutes: request.approximationWindowMinutes,
      birthDate: request.birthDate,
      birthTime: request.birthTime,
      disambiguation: request.disambiguation,
      label: "Protected staging synthetic chart",
      locationId: request.locationId,
      schemaVersion: birthProfileCreateSchemaVersion,
      timeCertainty: request.timeCertainty,
    },
    birthProfileCreateSchemaVersion,
  );

export const createRecoveryAstrologyService = (dependencies: Dependencies) =>
  Object.freeze({
    async calculate(value: unknown): Promise<RecoveryAstrologyCalculation> {
      let request: RecoveryAstrologyRequest;
      try {
        request = parseRecoveryAstrologyRequest(value);
      } catch {
        throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_INPUT_INVALID");
      }
      const profile = profileRequest(request);
      let selectedLocation;
      let utcInstant: string | null;
      let timeZoneProvenance: unknown;

      try {
        if (request.timeCertainty === "unknown") {
          const selection = await dependencies.locationTimeZone.readLocation(request.locationId);
          selectedLocation = selection.selectedLocation;
          utcInstant = null;
          timeZoneProvenance = Object.freeze({
            provider: selection.provider,
            selectedLocation,
            timeCertainty: request.timeCertainty,
          });
        } else {
          const resolution = await dependencies.locationTimeZone.resolve({
            disambiguation: request.disambiguation,
            localDate: request.birthDate,
            localTime: request.birthTime,
            locationId: request.locationId,
            schemaVersion: astrologyLocalTimeResolutionRequestSchemaVersion,
          });
          if (resolution.status === "ambiguous_local_time") {
            throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_AMBIGUITY_REQUIRED");
          }
          if (resolution.status === "nonexistent_local_time") {
            throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_LOCAL_TIME_NONEXISTENT");
          }
          selectedLocation = resolution.selectedLocation;
          utcInstant = resolution.utcInstant;
          timeZoneProvenance = resolution;
        }
      } catch (error) {
        if (error instanceof RecoveryAstrologyServiceError) throw error;
        throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_UNAVAILABLE");
      }

      let facts: AstrologyNatalFactsV1;
      try {
        const ephemeris = await dependencies.loadEphemeris();
        facts = await ephemeris.calculateNatal({
          approximationWindowMinutes: request.approximationWindowMinutes,
          houseSystem: "placidus",
          inputSnapshotSha256: sha256(
            canonicalizeBirthProfileWriteRequestV1(profile, birthProfileCreateSchemaVersion),
          ),
          latitudeE6: selectedLocation.latitudeE6,
          longitudeE6: selectedLocation.longitudeE6,
          method: {
            aspectPolicyVersion: astrologyAspectPolicyVersion,
            catalogSha256: astrologyMethodCatalogSha256,
            methodVersion: astrologyNatalMethodVersion,
            node: "true_node",
            zodiac: "tropical",
          },
          profileRevision: 1,
          schemaVersion: astrologyNatalRequestSchemaVersion,
          timeCertainty: request.timeCertainty,
          timeZoneProvenanceSha256: sha256(JSON.stringify(timeZoneProvenance)),
          utcInstant,
        });
      } catch {
        throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_UNAVAILABLE");
      }

      const createdAt = new Date(dependencies.clock()).toISOString();
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(createdAt)) {
        throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_UNAVAILABLE");
      }
      const id = dependencies.createId();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
        throw new RecoveryAstrologyServiceError("RECOVERY_ASTROLOGY_UNAVAILABLE");
      }
      return Object.freeze({ createdAt, facts, id });
    },
  });

let runtimeService: ReturnType<typeof createRecoveryAstrologyService> | undefined;

export const loadRecoveryAstrologyService = () => {
  runtimeService ??= createRecoveryAstrologyService({
    clock: Date.now,
    createId: randomUUID,
    loadEphemeris: loadWebAstrologyEphemeris,
    locationTimeZone: createRecoveryAstrologyLocationTimeZoneAdapter(),
  });
  return runtimeService;
};
