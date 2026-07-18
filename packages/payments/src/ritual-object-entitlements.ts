import { CommerceError } from "./errors.js";

export const paidRitualObjectCodes = Object.freeze([
  "mindful_incense",
  "moonlit_lotus",
  "amethyst_guardian",
  "golden_intention_bowl",
] as const);

export type PaidRitualObjectCode = (typeof paidRitualObjectCodes)[number];
export type RitualObjectEntitlementCode = `sanctuary.${PaidRitualObjectCode}`;

export const isPaidRitualObjectCode = (value: unknown): value is PaidRitualObjectCode =>
  typeof value === "string" && paidRitualObjectCodes.some((candidate) => candidate === value);

export const isRitualObjectEntitlementCode = (
  value: unknown,
): value is RitualObjectEntitlementCode =>
  typeof value === "string" &&
  paidRitualObjectCodes.some((objectCode) => value === `sanctuary.${objectCode}`);

export const parsePaidRitualObjectCode = (value: unknown): PaidRitualObjectCode => {
  if (!isPaidRitualObjectCode(value)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return value as PaidRitualObjectCode;
};

export const ritualObjectEntitlementCodeFor = (
  objectCode: PaidRitualObjectCode,
): RitualObjectEntitlementCode => `sanctuary.${parsePaidRitualObjectCode(objectCode)}`;

export const parseRitualObjectEntitlementCode = (value: unknown): PaidRitualObjectCode => {
  if (!isRitualObjectEntitlementCode(value)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return parsePaidRitualObjectCode(value.slice("sanctuary.".length));
};
