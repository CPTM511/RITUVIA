import "server-only";

import { assertNumerologyEngineReady, parseNumerologyRuleCatalogV1 } from "@rituvia/divination";

import numerologyCatalogSource from "../../../content/traditions/numerology/rituvia-date-reduction.en.v1.json";

export type NumerologyAvailability = "disabled" | "enabled";

export const webNumerologyApprovalReference = "OWN-011:option-a:2026-07-25" as const;
export const webNumerologyCatalog = parseNumerologyRuleCatalogV1(numerologyCatalogSource);

export const evaluateNumerologyAvailability = (
  catalog: unknown,
  asOf: string,
): NumerologyAvailability => {
  try {
    const approved = assertNumerologyEngineReady(catalog, asOf);
    return approved.editorial.approvalReference === webNumerologyApprovalReference
      ? "enabled"
      : "disabled";
  } catch {
    return "disabled";
  }
};

export const loadNumerologyAvailability = (): NumerologyAvailability => {
  try {
    return evaluateNumerologyAvailability(
      webNumerologyCatalog,
      new Date().toISOString().slice(0, 10),
    );
  } catch {
    return "disabled";
  }
};
