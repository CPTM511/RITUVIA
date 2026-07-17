import { describe, expect, it } from "vitest";

import { getMessages } from "../app/_i18n/messages";
import { getStateMessages } from "../app/_i18n/state-messages";

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
    expect(copy).toContain("Minimum operational request metadata may be processed");
    expect(copy).toContain("exclude raw sensitive prompts from routine logs");
    expect(copy).toContain("purpose-limited, authorized, and audited");
    expect(copy).toContain(
      "No readings, AI interpretations, accounts, purchases, or rituals are available",
    );
    expect(copy).not.toMatch(/(?:encrypted at rest|delete your account|export your data)/iu);
  });
});
