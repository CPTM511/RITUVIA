import { parseCurrencyCode, parseMinorAmount } from "./validation.js";

export type Money = Readonly<{
  amountMinor: number;
  currencyCode: string;
}>;

export const createMoney = (amountMinor: unknown, currencyCode: unknown): Money =>
  Object.freeze({
    amountMinor: parseMinorAmount(amountMinor),
    currencyCode: parseCurrencyCode(currencyCode),
  });

export const moneyEquals = (left: Money, right: Money): boolean =>
  left.amountMinor === right.amountMinor && left.currencyCode === right.currencyCode;
