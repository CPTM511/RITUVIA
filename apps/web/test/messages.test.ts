import { describe, expect, it } from "vitest";

import { getMessages } from "../app/_i18n/messages";
import { getQuestionIntakeMessages } from "../app/_i18n/question-intake-messages";
import { getStateMessages } from "../app/_i18n/state-messages";
import { getTarotOneCardMessages } from "../app/_i18n/tarot-one-card-messages";

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
    const copy = collectStrings(getTarotOneCardMessages("en")).join(" ");

    expect(copy).toContain("reviewed canonical content, not an AI-generated interpretation");
    expect(copy).toContain("does not draw again");
    expect(copy).toContain("without an account or payment");
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
    expect(copy).toContain("at least one free candle and one free incense experience");
    expect(copy).toContain("This is a product-design overview, not a legal Privacy Policy");
    expect(copy).toContain("minimum operational request metadata needed");
    expect(copy).toContain("exclude raw sensitive prompts from routine logs");
    expect(copy).toContain("purpose-limited, authorized, and audited");
    expect(copy).toContain(
      "No public readings, AI interpretations, accounts, purchases, or rituals are available",
    );
    expect(copy).not.toMatch(/(?:encrypted at rest|delete your account|export your data)/iu);
  });
});
