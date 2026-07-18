import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  getTextDirection,
  indexablePublicPageIds,
  indexablePublicPagePathnames,
  isIndexablePublicPagePathname,
  isPublicDiscoveryPathname,
  isPublicShellPathname,
  localeHomePath,
  localeAccountPath,
  localeCheckoutReturnPath,
  localePublicPagePath,
  localeLocalCheckoutPath,
  localeQuestionIntakePath,
  localeSanctuaryPath,
  localeSectionPath,
  localeSignInPath,
  localeTarotOneCardPath,
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
    expect(localeSanctuaryPath("en")).toBe("/en/sanctuary");
    expect(localeSignInPath("en")).toBe("/en/sign-in");
    expect(localeAccountPath("en")).toBe("/en/account");
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
    ]);
    expect(publicDiscoveryPathnames).toEqual(["/robots.txt", "/sitemap.xml"]);
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
    for (const pathname of ["/robots.txt/", "/ROBOTS.TXT", "/sitemap.xml/", "/sitemap.xml.rsc"]) {
      expect(isPublicDiscoveryPathname(pathname)).toBe(false);
    }
  });

  it("recognizes future RTL language subtags without activating them", () => {
    for (const locale of ["ar", "ar-EG", "fa", "he-IL", "ur-PK"]) {
      expect(getTextDirection(locale)).toBe("rtl");
      expect(parseLocale(locale)).toBeNull();
    }
    for (const locale of ["en", "de", "ja", "zh-Hans", "hi"]) {
      expect(getTextDirection(locale)).toBe("ltr");
    }
  });
});
