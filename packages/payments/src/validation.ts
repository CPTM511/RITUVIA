import { CommerceError } from "./errors.js";

export const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
export const resourceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
export const currencyCodePattern = /^[A-Z]{3}$/u;
export const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
// Commerce persistence uses PostgreSQL INTEGER for minor units in MVP v1.
export const maximumMinorAmount = 2_147_483_647;

export const invalidInput = (): never => {
  throw new CommerceError("COMMERCE_INPUT_INVALID");
};

export const parseIdentifier = (value: unknown): string => {
  if (typeof value !== "string" || !identifierPattern.test(value)) invalidInput();
  return value as string;
};

export const parseResourceId = (value: unknown): string => {
  if (typeof value !== "string" || !resourceIdPattern.test(value)) invalidInput();
  return value as string;
};

export const parseInstant = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !instantPattern.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    invalidInput();
  }
  return value as string;
};

export const parseCurrencyCode = (value: unknown): string => {
  if (typeof value !== "string" || !currencyCodePattern.test(value)) invalidInput();
  return value as string;
};

export const parseMinorAmount = (value: unknown, allowZero = true): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > maximumMinorAmount
  ) {
    invalidInput();
  }
  return value as number;
};
