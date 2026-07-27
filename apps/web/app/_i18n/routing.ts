import { createLocalActionHref, type LocalActionHref } from "@rituvia/ui";

import { publicPagePathname, type PublicPageId, type PublicPageSlug } from "./public-routes";

export {
  indexablePublicPageIds,
  indexablePublicPagePathnames,
  indexablePublicPageRecords,
  isIndexablePublicPagePathname,
  isPublicDiscoveryPathname,
  isPublicShellPathname,
  parsePublicPageSlug,
  publicDiscoveryPathnames,
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

export const localeQuestionIntakePath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/intake`);

export const localeTarotOneCardPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/tarot/one-card`);

export const localeTarotThreeCardPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/tarot/three-card`);

export const localeNumerologyPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/readings/numerology`);

export const localeNumerologyLibraryPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/numerology`);

export const localeSanctuaryPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/sanctuary`);

export const localeRevisitPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/revisit`);

export const localeSignInPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/sign-in`);

export const localeAccountPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/account`);

export const localeCheckoutReturnPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/checkout/return`);

export const localeLocalCheckoutPath = (locale: Locale): LocalActionHref =>
  createLocalActionHref(`/${locale}/checkout/local`);

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
