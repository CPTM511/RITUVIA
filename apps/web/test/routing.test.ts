import { describe, expect, it } from "vitest";

import { indexableRitualReflectionPathnames } from "../app/_i18n/ritual-reflection-public-routes";
import { indexableTarotPathnames } from "../app/_i18n/tarot-public-routes";
import {
  defaultLocale,
  getTextDirection,
  indexablePublicPageIds,
  indexablePublicPagePathnames,
  isIndexablePublicPagePathname,
  isPublicDiscoveryPathname,
  isPublicShellPathname,
  localeAstrologyLibraryPath,
  localeHomePath,
  localeAccountPath,
  localeAstrologyPath,
  localeCheckoutReturnPath,
  localePublicPagePath,
  localeLocalCheckoutPath,
  localeNumerologyLibraryPath,
  localeNumerologyPath,
  localePlansPath,
  localeQuestionIntakePath,
  localeSanctuaryPath,
  localeSectionPath,
  localeSignInPath,
  localeTarotOneCardPath,
  localeTarotLibraryPath,
  localeTarotThreeCardPath,
  parseLocale,
  parsePublicPageSlug,
  publicPageSlugs,
  publicDiscoveryPathnames,
  supportedLocales,
} from "../app/_i18n/routing";

describe("Web locale routing", () => {
  it("activates only exact reviewed English", () => {
    expect(supportedLocales).toEqual(["en"]);
    expect(defaultLocale).toBe("en");
    expect(parseLocale("en")).toBe("en");

    for (const value of [undefined, null, "", "EN", "en-US", "en/other", "ar", "fr"]) {
      expect(parseLocale(value)).toBeNull();
    }
  });

  it("creates stable locale-prefixed public and in-page paths", () => {
    expect(localeHomePath("en")).toBe("/en");
    expect(localeQuestionIntakePath("en")).toBe("/en/intake");
    expect(localeTarotOneCardPath("en")).toBe("/en/tarot/one-card");
    expect(localeTarotThreeCardPath("en")).toBe("/en/tarot/three-card");
    expect(localeTarotLibraryPath("en")).toBe("/en/tarot");
    expect(localeNumerologyPath("en")).toBe("/en/readings/numerology");
    expect(localeAstrologyPath("en")).toBe("/en/readings/astrology");
    expect(localeAstrologyLibraryPath("en")).toBe("/en/astrology");
    expect(localeNumerologyLibraryPath("en")).toBe("/en/numerology");
    expect(localeSanctuaryPath("en")).toBe("/en/sanctuary");
    expect(localeSignInPath("en")).toBe("/en/sign-in");
    expect(localeAccountPath("en")).toBe("/en/account");
    expect(localePlansPath("en")).toBe("/en/plans");
    expect(localeCheckoutReturnPath("en")).toBe("/en/checkout/return");
    expect(localeLocalCheckoutPath("en")).toBe("/en/checkout/local");
    expect(publicPageSlugs).toEqual(["methodology", "safety", "privacy"]);
    expect(localePublicPagePath("en", "methodology")).toBe("/en/methodology");
    expect(localePublicPagePath("en", "safety")).toBe("/en/safety");
    expect(localePublicPagePath("en", "privacy")).toBe("/en/privacy");
    expect(localeSectionPath("en", "practice")).toBe("/en#practice");
    expect(localeSectionPath("en", "principles")).toBe("/en#principles");
    expect(localeSectionPath("en", "trust")).toBe("/en#trust");
    expect(indexablePublicPageIds).toEqual(["home", "methodology", "safety", "privacy"]);
    expect(indexablePublicPagePathnames).toEqual([
      "/en",
      "/en/methodology",
      "/en/safety",
      "/en/privacy",
      "/en/numerology",
      "/en/numerology/life-path-number",
      "/en/numerology/birthday-number",
      "/en/numerology/personal-year-number",
      "/en/numerology/master-numbers",
      "/en/astrology",
      "/en/astrology/natal-chart-calculation",
      "/en/astrology/birth-time-uncertainty",
      "/en/astrology/houses-and-major-aspects",
      "/en/astrology/sources-and-methodology",
      ...indexableTarotPathnames,
      ...indexableRitualReflectionPathnames,
    ]);
    expect(publicDiscoveryPathnames).toEqual([
      "/robots.txt",
      "/sitemap.xml",
      "/sitemaps/en-pages.xml",
      "/sitemaps/en-numerology.xml",
      "/sitemaps/en-astrology.xml",
      "/sitemaps/en-tarot.xml",
      "/sitemaps/en-rituals.xml",
    ]);
  });

  it("accepts only exact public pages and their framework representations", () => {
    for (const page of publicPageSlugs) expect(parsePublicPageSlug(page)).toBe(page);
    for (const value of [undefined, null, "", "Privacy", "method", "privacy/extra"]) {
      expect(parsePublicPageSlug(value)).toBeNull();
    }

    for (const pathname of [
      "/",
      "/index.rsc",
      "/index.segments/_full.segment.rsc",
      "/en",
      "/en.rsc",
      "/en.segments/_full.segment.rsc",
      "/en/methodology",
      "/en/methodology.rsc",
      "/en/methodology.segments/_full.segment.rsc",
      "/en/safety",
      "/en/privacy",
      "/en/numerology",
      "/en/numerology.rsc",
      "/en/numerology/life-path-number",
      "/en/numerology/life-path-number.rsc",
      "/en/numerology/life-path-number.segments/_full.segment.rsc",
      "/en/astrology",
      "/en/astrology.rsc",
      "/en/astrology/natal-chart-calculation",
      "/en/astrology/natal-chart-calculation.rsc",
      "/en/astrology/natal-chart-calculation.segments/_full.segment.rsc",
      "/en/rituals",
      "/en/rituals.rsc",
      "/en/rituals/virtual-candle-reflection",
      "/en/rituals/virtual-candle-reflection.rsc",
      "/en/rituals/virtual-candle-reflection.segments/_full.segment.rsc",
    ]) {
      expect(isPublicShellPathname(pathname)).toBe(true);
    }
    for (const pathname of [
      "/EN",
      "/en/Privacy",
      "/en/privacy/",
      "/en/privacy/extra",
      "/en/privacy.rsc/extra",
      "/en/privacy.segments",
      "/en/unknown",
      "/en/numerology/number-1",
      "/en/numerology/life-path-number/",
      "/en/astrology/aries",
      "/en/astrology/natal-chart-calculation/",
      "/en/rituals/love",
      "/en/rituals/virtual-candle-reflection/",
    ]) {
      expect(isPublicShellPathname(pathname)).toBe(false);
    }
  });

  it("keeps canonical pages and discovery endpoints on exact finite allowlists", () => {
    for (const pathname of indexablePublicPagePathnames) {
      expect(isIndexablePublicPagePathname(pathname)).toBe(true);
    }
    for (const pathname of [
      "/",
      "/en/",
      "/en.rsc",
      "/en/account",
      "/en/intake",
      "/en/journal",
      "/en/checkout",
      "/en?question=private",
    ]) {
      expect(isIndexablePublicPagePathname(pathname)).toBe(false);
    }

    expect(isPublicDiscoveryPathname("/robots.txt")).toBe(true);
    expect(isPublicDiscoveryPathname("/sitemap.xml")).toBe(true);
    expect(isPublicDiscoveryPathname("/sitemaps/en-pages.xml")).toBe(true);
    for (const pathname of ["/robots.txt/", "/ROBOTS.TXT", "/sitemap.xml/", "/sitemap.xml.rsc"]) {
      expect(isPublicDiscoveryPathname(pathname)).toBe(false);
    }
  });

  it("recognizes future RTL language subtags without activating them", () => {
    for (const locale of [
      "ar-XB",
      "ar-EG",
      "ckb",
      "dv",
      "fa",
      "he-IL",
      "nqo",
      "ps",
      "sd",
      "ug",
      "ur-PK",
      "yi",
    ]) {
      expect(getTextDirection(locale)).toBe("rtl");
      expect(parseLocale(locale)).toBeNull();
    }
    for (const locale of ["en", "en-XA", "de", "ja", "zh-Hans", "hi", "ku"]) {
      expect(getTextDirection(locale)).toBe("ltr");
    }
    expect(() => getTextDirection("invalid_locale")).toThrow(TypeError);
  });
});
