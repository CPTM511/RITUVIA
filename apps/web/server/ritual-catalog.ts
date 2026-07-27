import "server-only";

import { parseRitualCatalogV1, type RitualCatalogV1 } from "@rituvia/domain";

import ritualCatalogSource from "../../../content/traditions/ritual/rituvia-original.en.v1.json";

const currentRitualCatalog = parseRitualCatalogV1(ritualCatalogSource);

export const getWebRitualCatalog = (): RitualCatalogV1 => currentRitualCatalog;
