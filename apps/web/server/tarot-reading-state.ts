import "server-only";

import { assertTarotCatalogPublicationEligible, parseTarotCatalogV1 } from "@rituvia/divination";

import majorArcanaCatalogJson from "../../../content/traditions/tarot/rituvia-major-arcana.v1.json";
import originalReflectionCatalogJson from "../../../content/traditions/tarot/rituvia-original-reflection.v1.json";
import { getWebRuntimeConfiguration } from "../config/server";
import { createTarotCatalogChecksum } from "./tarot-reading-crypto";

export type TarotReadingAvailability = "disabled" | "enabled";

export const tarotReadingMvpApprovalReference = "owner-directive:2026-07-18-major-arcana" as const;
export const tarotReadingMvpCatalogChecksum =
  "sha256:06666a86d228c64d620f98c6c2b65925e788fb474e0c73fa55255af16e013c51" as const;
export const tarotReadingMvpCatalog = parseTarotCatalogV1(majorArcanaCatalogJson);
export const tarotReadingHistoricalCatalog = parseTarotCatalogV1(originalReflectionCatalogJson);

const tarotReadingCatalogs = Object.freeze([tarotReadingMvpCatalog, tarotReadingHistoricalCatalog]);

export const loadTarotReadingCatalog = (reference: Readonly<{ id: string; version: string }>) =>
  tarotReadingCatalogs.find(
    (catalog) => catalog.catalogId === reference.id && catalog.version === reference.version,
  );

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
      (configuration.deploymentEnvironment !== "local" &&
        configuration.deploymentEnvironment !== "staging") ||
      configuration.databaseUrl === undefined ||
      configuration.tarotReadingIntegrityKeyring === undefined ||
      tarotReadingMvpCatalog.catalogId !== "rituvia.major-arcana-catalog" ||
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
