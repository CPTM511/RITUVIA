import "server-only";

import { assertTarotCatalogPublicationEligible, parseTarotCatalogV1 } from "@rituvia/divination";

import originalReflectionCatalogJson from "../../../content/traditions/tarot/rituvia-original-reflection.v1.json";
import { getWebRuntimeConfiguration } from "../config/server";
import { createTarotCatalogChecksum } from "./tarot-reading-crypto";

export type TarotReadingAvailability = "disabled" | "enabled";

export const tarotReadingMvpApprovalReference = "OWN-010:rituvia-original-reflection.v1" as const;
export const tarotReadingMvpCatalogChecksum =
  "sha256:e5359254f1596051db60139281d2c426b702b552496b9ff52b7834389ca1bb70" as const;
export const tarotReadingMvpCatalog = parseTarotCatalogV1(originalReflectionCatalogJson);

type TarotReadingAvailabilityConfiguration = Pick<
  ReturnType<typeof getWebRuntimeConfiguration>,
  "databaseUrl" | "deploymentEnvironment" | "tarotReadingIntegrityKeyring"
>;

export const evaluateTarotReadingAvailability = (
  configuration: TarotReadingAvailabilityConfiguration,
  asOf: string,
): TarotReadingAvailability => {
  try {
    if (
      configuration.deploymentEnvironment !== "local" ||
      configuration.databaseUrl === undefined ||
      configuration.tarotReadingIntegrityKeyring === undefined ||
      tarotReadingMvpCatalog.catalogId !== "rituvia.original-reflection-catalog" ||
      tarotReadingMvpCatalog.version !== "1.0.0" ||
      tarotReadingMvpCatalog.editorial.approvalReference !== tarotReadingMvpApprovalReference ||
      createTarotCatalogChecksum(JSON.stringify(tarotReadingMvpCatalog)) !==
        tarotReadingMvpCatalogChecksum
    ) {
      return "disabled";
    }

    assertTarotCatalogPublicationEligible(tarotReadingMvpCatalog, asOf);
    return "enabled";
  } catch {
    return "disabled";
  }
};

export const loadTarotReadingAvailability = (): TarotReadingAvailability => {
  try {
    return evaluateTarotReadingAvailability(
      getWebRuntimeConfiguration(),
      new Date().toISOString().slice(0, 10),
    );
  } catch {
    return "disabled";
  }
};
