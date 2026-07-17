import { createLocalActionHref, type LocalActionHref } from "@rituvia/ui";

import { publicPagePathname, type PublicPageId, type PublicPageSlug } from "./public-routes";

export {
  isPublicShellPathname,
  parsePublicPageSlug,
  publicPageSlugs,
  type PublicPageId,
  type PublicPageSlug,
} from "./public-routes";

export const supportedLocales = Object.freeze(["en"] as const);

export type Locale = (typeof supportedLocales)[number];
export type TextDirection = "ltr" | "rtl";

export const defaultLocale: Locale = "en";

export const shellSectionIds = Object.freeze(["practice", "principles", "trust"] as const);
export type ShellSectionId = (typeof shellSectionIds)[number];

const rtlLanguageSubtags = Object.freeze(["ar", "fa", "he", "ur"] as const);

export const parseLocale = (value: string | null | undefined): Locale | null =>
  value === "en" ? value : null;

export const localeHomePath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}`);

export const localePublicPagePath = (
  locale: Locale,
  page: PublicPageId | PublicPageSlug,
): LocalActionHref => createLocalActionHref(publicPagePathname(locale, page));

export const localeSectionPath = (locale: Locale, section: ShellSectionId): LocalActionHref =>
  createLocalActionHref(`/${locale}#${section}`);

export const getTextDirection = (locale: string): TextDirection => {
  const primarySubtag = locale.toLowerCase().split("-", 1)[0];
  return rtlLanguageSubtags.some((candidate) => candidate === primarySubtag) ? "rtl" : "ltr";
};
