import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  getTextDirection,
  localeHomePath,
  localeSectionPath,
  parseLocale,
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

  it("creates stable locale-prefixed home and in-page paths", () => {
    expect(localeHomePath("en")).toBe("/en");
    expect(localeSectionPath("en", "practice")).toBe("/en#practice");
    expect(localeSectionPath("en", "principles")).toBe("/en#principles");
    expect(localeSectionPath("en", "privacy")).toBe("/en#privacy");
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
