import "server-only";

import { createTarotReadingPersistence } from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";
import {
  createTarotReadingApplicationService,
  TarotReadingApplicationError,
  tarotReadingPolicySchemaVersion,
} from "./tarot-reading";
import { createTarotCatalogChecksum } from "./tarot-reading-crypto";
import {
  loadTarotReadingAvailability,
  tarotReadingMvpApprovalReference,
  tarotReadingMvpCatalog,
  tarotReadingMvpCatalogChecksum,
} from "./tarot-reading-state";

const readingPolicyVersion = "tarot-reading.local.en.v1" as const;
const reportPolicyVersion = "tarot-reading-report.local.en.v1" as const;
const readingLimit = 12;
const readingWindowSeconds = 3_600;

type TarotReadingApplicationService = ReturnType<typeof createTarotReadingApplicationService>;

let webTarotReadingService: TarotReadingApplicationService | undefined;

const unavailable = (): never => {
  throw new TarotReadingApplicationError("unavailable");
};

const loadWebTarotReadingService = (): TarotReadingApplicationService => {
  if (loadTarotReadingAvailability() !== "enabled") return unavailable();
  if (webTarotReadingService !== undefined) return webTarotReadingService;

  try {
    const configuration = getWebRuntimeConfiguration();
    const integrityKeys = configuration.tarotReadingIntegrityKeyring;
    if (integrityKeys === undefined) return unavailable();

    const catalogChecksum = createTarotCatalogChecksum(JSON.stringify(tarotReadingMvpCatalog));
    if (catalogChecksum !== tarotReadingMvpCatalogChecksum) return unavailable();
    const persistence = createTarotReadingPersistence(loadWebDatabase(), {
      readingLimit,
      readingPolicyVersion,
      reportPolicyVersion,
      windowSeconds: readingWindowSeconds,
    });
    const service = createTarotReadingApplicationService({
      catalogProvider: Object.freeze({
        load: async (reference: Readonly<{ id: string; version: string }>) => {
          if (
            reference.id !== tarotReadingMvpCatalog.catalogId ||
            reference.version !== tarotReadingMvpCatalog.version
          ) {
            return unavailable();
          }
          return tarotReadingMvpCatalog;
        },
      }),
      clock: () => new Date(),
      integrityKeys,
      persistence,
      policy: Object.freeze({
        catalog: Object.freeze({
          approvalReference: tarotReadingMvpApprovalReference,
          checksum: tarotReadingMvpCatalogChecksum,
          id: tarotReadingMvpCatalog.catalogId,
          version: tarotReadingMvpCatalog.version,
        }),
        deck: Object.freeze({ id: "rituvia.original-reflection-deck", version: "1.0.0" }),
        locale: "en",
        maximumReadingsPerWindow: readingLimit,
        orientationPolicy: "upright_and_reversed",
        policyVersion: readingPolicyVersion,
        schemaVersion: tarotReadingPolicySchemaVersion,
        spreads: Object.freeze({
          one_card: Object.freeze({ id: "one-card-perspective", version: "1.0.0" }),
          three_card: Object.freeze({
            id: "situation-action-possibility",
            version: "1.0.0",
          }),
        }),
        windowSeconds: readingWindowSeconds,
      }),
    });
    webTarotReadingService = service;
    return service;
  } catch (error) {
    if (error instanceof TarotReadingApplicationError) throw error;
    return unavailable();
  }
};

export const createWebTarotReading: TarotReadingApplicationService["create"] = async (...args) =>
  await loadWebTarotReadingService().create(...args);

export const getWebTarotReading: TarotReadingApplicationService["get"] = async (...args) =>
  await loadWebTarotReadingService().get(...args);

export const reportWebTarotReading: TarotReadingApplicationService["report"] = async (...args) =>
  await loadWebTarotReadingService().report(...args);
