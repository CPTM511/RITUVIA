import { describe, expect, it } from "vitest";

import { getMessages } from "../app/_i18n/messages";

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

    expect(strings.length).toBeGreaterThan(40);
    expect(strings.every((value) => value.trim() === value && value.length > 0)).toBe(true);
    expect(strings.join(" ")).not.toMatch(/\b(?:TODO|TBD|lorem ipsum)\b/iu);
  });

  it("avoids deterministic, coercive, and professional-advice claims", () => {
    const copy = collectStrings(getMessages("en")).join(" ");

    expect(copy).not.toMatch(
      /\b(?:destined|definitely|guaranteed|act now|the universe says|you must|professional diagnosis)\b/iu,
    );
    expect(copy).toContain("not prediction or professional advice");
    expect(copy).toContain("No belief required");
    expect(copy).toContain("A meaningful free path");
  });
});
