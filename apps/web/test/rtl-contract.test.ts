import { readFileSync } from "node:fs";

import { inspectIcuMessage } from "@rituvia/i18n";
import { createRevisitReminderEmail } from "@rituvia/i18n/lifecycle";
import {
  pseudoLocalizeIcuMessage,
  pseudoLocalizeText,
  testPseudolocales,
} from "@rituvia/i18n/testing";
import { describe, expect, it } from "vitest";

import { getAccountMessages } from "../app/_i18n/account-messages";
import { getAstrologyMessages } from "../app/_i18n/astrology-messages";
import { getCommerceMessages } from "../app/_i18n/commerce-messages";
import { getMessages } from "../app/_i18n/messages";
import { getNumerologyMessages } from "../app/_i18n/numerology-messages";
import { getQuestionIntakeMessages } from "../app/_i18n/question-intake-messages";
import { getRevisitMessages } from "../app/_i18n/revisit-messages";
import { getSanctuaryMessages } from "../app/_i18n/sanctuary-messages";
import { getStateMessages } from "../app/_i18n/state-messages";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";
import { parseLocale, supportedLocales } from "../app/_i18n/routing";

const bidiControlPattern = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

const stringLeaves = (value: unknown): readonly string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringLeaves);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(stringLeaves);
  }
  return [];
};

const englishMessageSurfaces = Object.freeze([
  getMessages("en"),
  getAccountMessages("en"),
  getAstrologyMessages("en"),
  getCommerceMessages("en"),
  getNumerologyMessages("en"),
  getQuestionIntakeMessages("en"),
  getRevisitMessages("en"),
  getSanctuaryMessages("en"),
  getStateMessages("en"),
  getTarotOneCardMessages("en"),
  getTarotThreeCardMessages("en"),
]);

describe("RTL and test-pseudolocale boundaries", () => {
  it("pseudolocalizes every current Web message while preserving ICU structure", () => {
    const messages = englishMessageSurfaces.flatMap(stringLeaves);
    expect(messages.length).toBeGreaterThan(300);

    for (const message of messages) {
      const sourceStructure = inspectIcuMessage(message);
      for (const locale of testPseudolocales) {
        const localized = pseudoLocalizeIcuMessage(message, locale);
        expect(inspectIcuMessage(localized), `${locale}:${message}`).toEqual(sourceStructure);
        expect(localized, `${locale}:${message}`).not.toMatch(bidiControlPattern);
      }
    }
  });

  it("keeps pseudolocales out of runtime routes and publishable locale inventory", () => {
    expect(supportedLocales).toEqual(["en"]);
    for (const locale of testPseudolocales) expect(parseLocale(locale)).toBeNull();
  });

  it("exercises reminder copy without creating an Arabic email template", () => {
    const message = createRevisitReminderEmail({
      actionPath: "/en/revisit?source=reminder",
      brandName: "RITUVIA",
      canonicalOrigin: "https://example.test",
      locale: "en",
      preferencePath: "/en/revisit#reminder-preferences",
      quietHours: "none",
      scheduledLocalDate: "2026-07-28",
      supportEmail: "support@example.test",
      timeZone: "UTC",
    });

    expect(message.locale).toBe("en");
    expect(message.templateVersion).toBe("revisit-reminder.en.v1");
    for (const locale of testPseudolocales) {
      for (const value of [
        message.action.label,
        message.bodyText,
        message.previewText,
        message.subject,
      ]) {
        expect(pseudoLocalizeText(value, locale)).not.toMatch(bidiControlPattern);
      }
      expect(pseudoLocalizeText(message.action.url, locale)).toContain(message.action.url);
      expect(pseudoLocalizeText(message.preference.url, locale)).toContain(message.preference.url);
    }
  });

  it("keeps every current private product page out of social sharing", () => {
    const privatePages = [
      "../app/[locale]/account/page.tsx",
      "../app/[locale]/checkout/local/page.tsx",
      "../app/[locale]/checkout/return/page.tsx",
      "../app/[locale]/intake/page.tsx",
      "../app/[locale]/readings/astrology/page.tsx",
      "../app/[locale]/readings/numerology/page.tsx",
      "../app/[locale]/revisit/page.tsx",
      "../app/[locale]/sanctuary/page.tsx",
      "../app/[locale]/sign-in/page.tsx",
      "../app/[locale]/tarot/one-card/page.tsx",
      "../app/[locale]/tarot/three-card/page.tsx",
    ];

    for (const relativePath of privatePages) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source, relativePath).toMatch(
        /robots:\s*\{[^}]*index:\s*false|create(?:QuestionIntake|TarotOneCard|TarotThreeCard)Metadata/u,
      );
      expect(source, relativePath).not.toMatch(/\b(?:openGraph|twitter)\s*:/u);
    }
  });
});
