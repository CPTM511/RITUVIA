import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import IntlMessageFormat from "intl-messageformat";

import { canonicalizeLocale } from "./locale.js";

export type IcuMessageValue = string | number | bigint | boolean | Date;
export type IcuMessageValues = Readonly<Record<string, IcuMessageValue>>;

export type IcuMessageShape = Readonly<{
  arguments: readonly string[];
  tags: readonly string[];
}>;

const inspectElements = (
  elements: readonly MessageFormatElement[],
  argumentsFound: Set<string>,
  tagsFound: Set<string>,
): void => {
  for (const element of elements) {
    if (
      element.type === TYPE.argument ||
      element.type === TYPE.number ||
      element.type === TYPE.date ||
      element.type === TYPE.time ||
      element.type === TYPE.select ||
      element.type === TYPE.plural
    ) {
      argumentsFound.add(element.value);
    }
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const option of Object.values(element.options)) {
        inspectElements(option.value, argumentsFound, tagsFound);
      }
    }
    if (element.type === TYPE.tag) {
      tagsFound.add(element.value);
      inspectElements(element.children, argumentsFound, tagsFound);
    }
  }
};

export const inspectIcuMessage = (message: string): IcuMessageShape => {
  if (typeof message !== "string" || message.length < 1 || message.length > 10_000) {
    throw new TypeError("The ICU message must be bounded non-empty text.");
  }
  const argumentsFound = new Set<string>();
  const tagsFound = new Set<string>();
  inspectElements(parse(message, { requiresOtherClause: true }), argumentsFound, tagsFound);
  return Object.freeze({
    arguments: Object.freeze([...argumentsFound].sort()),
    tags: Object.freeze([...tagsFound].sort()),
  });
};

export const formatIcuMessage = (
  localeInput: string,
  message: string,
  values: IcuMessageValues = {},
): string => {
  const locale = canonicalizeLocale(localeInput);
  const shape = inspectIcuMessage(message);
  const supplied = Object.keys(values).sort();
  if (
    supplied.length !== shape.arguments.length ||
    supplied.some((key, index) => key !== shape.arguments.at(index))
  ) {
    throw new TypeError("The ICU message values do not match the exact placeholder inventory.");
  }
  const formatted = new IntlMessageFormat(message, locale).format(values);
  if (typeof formatted !== "string") {
    throw new TypeError("Messages must format to plain text.");
  }
  return formatted;
};
