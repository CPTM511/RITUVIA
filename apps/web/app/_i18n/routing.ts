export const supportedLocales = Object.freeze(["en"] as const);

export type Locale = (typeof supportedLocales)[number];
export type TextDirection = "ltr" | "rtl";

export const defaultLocale: Locale = "en";

export const shellSectionIds = Object.freeze(["practice", "principles", "privacy"] as const);
export type ShellSectionId = (typeof shellSectionIds)[number];

const rtlLanguageSubtags = Object.freeze(["ar", "fa", "he", "ur"] as const);

export const parseLocale = (value: string | null | undefined): Locale | null =>
  value === "en" ? value : null;

export const localeHomePath = (locale: Locale): `/${Locale}` => `/${locale}`;

export const localeSectionPath = (
  locale: Locale,
  section: ShellSectionId,
): `/${Locale}#${ShellSectionId}` => `/${locale}#${section}`;

export const getTextDirection = (locale: string): TextDirection => {
  const primarySubtag = locale.toLowerCase().split("-", 1)[0];
  return rtlLanguageSubtags.some((candidate) => candidate === primarySubtag) ? "rtl" : "ltr";
};
