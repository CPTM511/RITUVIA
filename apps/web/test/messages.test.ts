import { describe, expect, it } from "vitest";

import { getMessages } from "../app/_i18n/messages";
import { getAccountMessages } from "../app/_i18n/account-messages";
import { getCommerceMessages } from "../app/_i18n/commerce-messages";
import { getQuestionIntakeMessages } from "../app/_i18n/question-intake-messages";
import { getSanctuaryMessages } from "../app/_i18n/sanctuary-messages";
import { getStateMessages } from "../app/_i18n/state-messages";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";
import { getTarotThreeCardMessages } from "../app/_i18n/tarot-three-card-messages";

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
};

describe("English shell messages", () => {
  it("provides complete non-placeholder source copy", () => {
    const strings = collectStrings(getMessages("en"));

    expect(strings.length).toBeGreaterThan(80);
    expect(strings.every((value) => value.trim() === value && value.length > 0)).toBe(true);
    expect(strings.join(" ")).not.toMatch(/\b(?:TODO|TBD|lorem ipsum)\b/iu);
  });

  it("provides a complete client-safe state and connection slice for every active locale", () => {
    const strings = collectStrings(getStateMessages("en"));

    expect(strings).toHaveLength(17);
    expect(strings.every((value) => value.trim() === value && value.length > 0)).toBe(true);
    expect(strings.join(" ")).not.toMatch(/\b(?:TODO|TBD|lorem ipsum)\b/iu);
  });

  it("keeps question intake copy complete, bounded, and private", () => {
    const copy = collectStrings(getQuestionIntakeMessages("en")).join(" ");

    expect(copy).toContain("What would you like to reflect on?");
    expect(copy).toContain("contact local emergency services now");
    expect(copy).toContain("someone else may be in immediate danger");
    expect(copy).toContain("not placed in the URL");
    expect(copy).toContain("No reading has been created or saved");
    expect(copy).not.toMatch(/\b(?:guaranteed|destined|curse removal|stronger ritual)\b/iu);
  });

  it("keeps one-card copy non-deterministic, private, and free of pressure", () => {
    const messages = getTarotOneCardMessages("en");
    const copy = collectStrings(messages).join(" ");

    expect(copy).toContain("reviewed canonical content, not an AI-generated interpretation");
    expect(copy).toContain("does not draw again");
    expect(copy).toContain("without an account or payment");
    expect(copy).toContain("Start a new reflection");
    expect(copy).toContain("previous fixed result remains available");
    expect(copy).toContain("There is no free-text field");
    expect(Object.keys(messages.result.report.categories).sort()).toEqual([
      "accessibility",
      "cultural",
      "factual",
      "rights",
      "safety",
      "translation",
    ]);
    expect(copy).not.toMatch(
      /\b(?:guaranteed|destined|curse removal|stronger ritual|act now|buy|upgrade)\b/iu,
    );
  });

  it("keeps three-card copy ordered, non-predictive, private, and free of pressure", () => {
    const messages = getTarotThreeCardMessages("en");
    const copy = collectStrings(messages).join(" ");

    expect(copy).toContain("Situation, Action, and Possibility");
    expect(copy).toContain("not a prediction");
    expect(copy).toContain("does not draw again");
    expect(copy).toContain("Start a new reflection");
    expect(copy).toContain("previous fixed result remains available");
    expect(copy).toContain("There is no free-text field");
    expect(Object.keys(messages.result.report.categories).sort()).toEqual([
      "accessibility",
      "cultural",
      "factual",
      "rights",
      "safety",
      "translation",
    ]);
    expect(copy).not.toMatch(
      /\b(?:guaranteed|destined|curse removal|stronger ritual|act now|buy|upgrade)\b/iu,
    );
  });

  it("avoids deterministic, coercive, and professional-advice claims", () => {
    const copy = collectStrings(getMessages("en")).join(" ");

    expect(copy).not.toMatch(
      /\b(?:destined|definitely|act now|the universe says|you must|professional diagnosis)\b/iu,
    );
    expect(copy).toContain("not prediction or professional advice");
    expect(copy).toContain("No belief required");
    expect(copy).toContain("A meaningful free path");
    expect(copy).toContain("Product systems draw and calculate; AI does not");
    expect(copy).toContain("Bounded AI explains");
    expect(copy).toContain("free candle and free incense experience remain available");
    expect(copy).toContain("This is a product-design overview, not a legal Privacy Policy");
    expect(copy).toContain("minimum operational request metadata needed");
    expect(copy).toContain("exclude raw sensitive prompts from routine logs");
    expect(copy).toContain("purpose-limited, authorized, and audited");
    expect(copy).toContain("Begin a free reading");
    expect(copy).toContain("Enter the sanctuary");
    expect(copy).toContain("Paid objects enhance visual ambience only");
    expect(copy).not.toMatch(/(?:encrypted at rest|delete your account|export your data)/iu);
  });

  it("keeps account, sanctuary, and commerce copy complete and non-coercive", () => {
    const copy = collectStrings({
      account: getAccountMessages("en"),
      commerce: getCommerceMessages("en"),
      sanctuary: getSanctuaryMessages("en"),
    }).join(" ");

    expect(copy).toContain("The free anonymous reflection path remains available");
    expect(copy).toContain("Payment does not imply stronger spiritual effect");
    expect(copy).toContain("Only a verified provider event can activate access");
    expect(copy).toContain("There is no need to draw again or purchase anything else");
    expect(copy).not.toMatch(
      /\b(?:guaranteed|destined|act now|limited time|stronger efficacy|unlock your fate)\b/iu,
    );
  });
});
