import { CommerceError } from "./errors.js";
import { createMoney, type Money } from "./money.js";
import {
  isPaidRitualObjectCode,
  isRitualObjectEntitlementCode,
  ritualObjectEntitlementCodeFor,
} from "./ritual-object-entitlements.js";
import { parseIdentifier, parseInstant, parseResourceId } from "./validation.js";

export type DigitalProductV1 = Readonly<{
  code: string;
  entitlementCode: string;
  exactContents: readonly string[];
  kind: "digital_item";
  publishedAt: string;
  status: "active" | "retired";
  version: string;
}>;

export type ProductPriceV1 = Readonly<{
  effectiveFrom: string;
  effectiveUntil: string | null;
  money: Money;
  priceId: string;
  productCode: string;
  productVersion: string;
  status: "active" | "retired";
  version: string;
}>;

export const createDigitalProductV1 = (input: {
  code: unknown;
  entitlementCode: unknown;
  exactContents: unknown;
  kind: unknown;
  publishedAt: unknown;
  status: unknown;
  version: unknown;
}): DigitalProductV1 => {
  if (
    input.kind !== "digital_item" ||
    (input.status !== "active" && input.status !== "retired") ||
    !Array.isArray(input.exactContents) ||
    input.exactContents.length === 0 ||
    input.exactContents.length > 16 ||
    input.exactContents.some(
      (item) => typeof item !== "string" || item.length === 0 || item.length > 240,
    ) ||
    new Set(input.exactContents).size !== input.exactContents.length
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }

  const code = parseIdentifier(input.code);
  const entitlementCode = parseIdentifier(input.entitlementCode);
  const paidRitualObject = isPaidRitualObjectCode(code);
  const ritualObjectEntitlement = isRitualObjectEntitlementCode(entitlementCode);
  if (
    paidRitualObject !== ritualObjectEntitlement ||
    (paidRitualObject && entitlementCode !== ritualObjectEntitlementCodeFor(code))
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }

  return Object.freeze({
    code,
    entitlementCode,
    exactContents: Object.freeze([...input.exactContents] as string[]),
    kind: "digital_item",
    publishedAt: parseInstant(input.publishedAt),
    status: input.status,
    version: parseResourceId(input.version),
  });
};

export const createProductPriceV1 = (input: {
  amountMinor: unknown;
  currencyCode: unknown;
  effectiveFrom: unknown;
  effectiveUntil: unknown;
  priceId: unknown;
  productCode: unknown;
  productVersion: unknown;
  status: unknown;
  version: unknown;
}): ProductPriceV1 => {
  if (
    (input.status !== "active" && input.status !== "retired") ||
    (input.effectiveUntil !== null && typeof input.effectiveUntil !== "string")
  ) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  const effectiveFrom = parseInstant(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil === null ? null : parseInstant(input.effectiveUntil);
  if (effectiveUntil !== null && Date.parse(effectiveUntil) <= Date.parse(effectiveFrom)) {
    throw new CommerceError("COMMERCE_INPUT_INVALID");
  }
  return Object.freeze({
    effectiveFrom,
    effectiveUntil,
    money: createMoney(input.amountMinor, input.currencyCode),
    priceId: parseResourceId(input.priceId),
    productCode: parseIdentifier(input.productCode),
    productVersion: parseResourceId(input.productVersion),
    status: input.status,
    version: parseResourceId(input.version),
  });
};

export const assertPurchasableProduct = (
  product: DigitalProductV1,
  price: ProductPriceV1,
  asOf: string,
): void => {
  const evaluatedAt = Date.parse(parseInstant(asOf));
  if (
    product.status !== "active" ||
    price.status !== "active" ||
    price.money.amountMinor === 0 ||
    price.productCode !== product.code ||
    price.productVersion !== product.version ||
    evaluatedAt < Date.parse(price.effectiveFrom) ||
    (price.effectiveUntil !== null && evaluatedAt >= Date.parse(price.effectiveUntil))
  ) {
    throw new CommerceError("COMMERCE_STATE_CONFLICT");
  }
};
