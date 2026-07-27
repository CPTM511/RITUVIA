import "server-only";

import { calculateNumerologyV1, type NumerologyCalculationFactsV1 } from "@rituvia/divination";

import { webNumerologyCatalog } from "./numerology-state";

export const webNumerologyCatalogAsOf = "2026-07-25" as const;

export const calculateWebNumerologyAt = (
  request: unknown,
  asOf: string,
): NumerologyCalculationFactsV1 =>
  calculateNumerologyV1({
    asOf,
    catalog: webNumerologyCatalog,
    request,
  });

export const calculateWebNumerology = (request: unknown): NumerologyCalculationFactsV1 =>
  calculateWebNumerologyAt(request, new Date().toISOString().slice(0, 10));
