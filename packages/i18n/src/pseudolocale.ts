import {
  isLiteralElement,
  isPluralElement,
  isSelectElement,
  isTagElement,
  parse,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";

export const testPseudolocales = Object.freeze(["en-XA", "ar-XB"] as const);

export type TestPseudolocale = (typeof testPseudolocales)[number];

const accentCharacters = new Map<string, string>(
  Object.entries({
    A: "Å",
    B: "Ɓ",
    C: "Ç",
    D: "Ð",
    E: "Ë",
    F: "Ƒ",
    G: "Ĝ",
    H: "Ĥ",
    I: "Ï",
    J: "Ĵ",
    K: "Ķ",
    L: "Ŀ",
    M: "Ṁ",
    N: "Ñ",
    O: "Ö",
    P: "Þ",
    Q: "Ǫ",
    R: "Ŕ",
    S: "Š",
    T: "Ŧ",
    U: "Ü",
    V: "Ṽ",
    W: "Ŵ",
    X: "Ẍ",
    Y: "Ÿ",
    Z: "Ž",
    a: "å",
    b: "ƀ",
    c: "ç",
    d: "ð",
    e: "ë",
    f: "ƒ",
    g: "ĝ",
    h: "ĥ",
    i: "ï",
    j: "ĵ",
    k: "ķ",
    l: "ŀ",
    m: "ṁ",
    n: "ñ",
    o: "ö",
    p: "þ",
    q: "ǫ",
    r: "ŕ",
    s: "š",
    t: "ŧ",
    u: "ü",
    v: "ṽ",
    w: "ŵ",
    x: "ẍ",
    y: "ÿ",
    z: "ž",
  }),
);

const protectedTextPattern =
  /(https?:\/\/[^\s<>()]+|mailto:[^\s<>()]+|\/[A-Za-z0-9][^\s<>()]*|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|RITUVIA|\{[A-Za-z][A-Za-z0-9_]*\})/gu;
const protectedTextPartPattern =
  /^(?:https?:\/\/[^\s<>()]+|mailto:[^\s<>()]+|\/[A-Za-z0-9][^\s<>()]*|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|RITUVIA|\{[A-Za-z][A-Za-z0-9_]*\})$/u;
const forbiddenBidiControlsPattern = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

const assertTestPseudolocale = (locale: string): TestPseudolocale => {
  if (!testPseudolocales.some((candidate) => candidate === locale)) {
    throw new TypeError("Pseudolocalization is restricted to en-XA and ar-XB test locales.");
  }
  return locale as TestPseudolocale;
};

const accent = (value: string): string =>
  [...value].map((character) => accentCharacters.get(character) ?? character).join("");

const transformCore = (value: string, locale: TestPseudolocale): string => {
  const transformed = value
    .split(protectedTextPattern)
    .map((part) => (protectedTextPartPattern.test(part) ? part : accent(part)))
    .join("");
  const targetLength = Math.ceil([...value].length * 1.4);
  const wrap = (padding: string): string =>
    locale === "ar-XB" ? `اختبار ${transformed} ${padding} موسّع` : `［${transformed} ${padding}］`;
  let padding = "·";
  while ([...wrap(padding)].length < targetLength) padding += " ·";
  return wrap(padding);
};

export const pseudoLocalizeText = (value: string, localeInput = "en-XA"): string => {
  const locale = assertTestPseudolocale(localeInput);
  if (forbiddenBidiControlsPattern.test(value)) {
    throw new TypeError("Pseudolocalization input must not contain bidi control characters.");
  }
  const match = /^(\s*)([\s\S]*?)(\s*)$/u.exec(value);
  if (match === null) return value;
  const [, leading, core, trailing] = match;
  if (core === undefined || !/[A-Za-z]/u.test(core)) return value;
  return `${leading ?? ""}${transformCore(core, locale)}${trailing ?? ""}`;
};

const pseudoLocalizeAst = (
  elements: readonly MessageFormatElement[],
  locale: TestPseudolocale,
): MessageFormatElement[] =>
  elements.map((element): MessageFormatElement => {
    if (isLiteralElement(element)) {
      return { ...element, value: pseudoLocalizeText(element.value, locale) };
    }
    if (isTagElement(element)) {
      return { ...element, children: pseudoLocalizeAst(element.children, locale) };
    }
    if (isPluralElement(element) || isSelectElement(element)) {
      return {
        ...element,
        options: Object.fromEntries(
          Object.entries(element.options).map(([key, option]) => [
            key,
            { ...option, value: pseudoLocalizeAst(option.value, locale) },
          ]),
        ),
      };
    }
    return { ...element };
  });

export const pseudoLocalizeIcuMessage = (message: string, localeInput: string): string => {
  const locale = assertTestPseudolocale(localeInput);
  if (forbiddenBidiControlsPattern.test(message)) {
    throw new TypeError("Pseudolocalization input must not contain bidi control characters.");
  }
  return printAST(pseudoLocalizeAst(parse(message), locale));
};
