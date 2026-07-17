import { createLocalActionHref, type LocalActionHref } from "@rituvia/ui";

export const supportedLocales = Object.freeze(["en"] as const);

export type Locale = (typeof supportedLocales)[number];
export type TextDirection = "ltr" | "rtl";

export const defaultLocale: Locale = "en";

export const shellSectionIds = Object.freeze(["practice", "principles", "privacy"] as const);
export type ShellSectionId = (typeof shellSectionIds)[number];

const rtlLanguageSubtags = Object.freeze(["ar", "fa", "he", "ur"] as const);

export const parseLocale = (value: string | null | undefined): Locale | null =>
  value === "en" ? value : null;

export const localeHomePath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}`);

export const localeSectionPath = (locale: Locale, section: ShellSectionId): LocalActionHref =>
  createLocalActionHref(`/${locale}#${section}`);

export const getTextDirection = (locale: string): TextDirection => {
  const primarySubtag = locale.toLowerCase().split("-", 1)[0];
  return rtlLanguageSubtags.some((candidate) => candidate === primarySubtag) ? "rtl" : "ltr";
};
