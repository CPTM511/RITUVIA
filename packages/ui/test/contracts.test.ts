import { describe, expect, it } from "vitest";

import {
  createLocalActionHref,
  createUiControlId,
  createUiControlName,
  createUiControlValue,
  resolveThemeMode,
} from "../src/index.js";

describe("UI public-value contracts", () => {
  it.each(["/", "/en", "/en/practice", "/en#privacy", "#main-content"])(
    "accepts a canonical local action target: %s",
    (target) => {
      expect(createLocalActionHref(target)).toBe(target);
    },
  );

  it.each([
    "",
    "#",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,unsafe",
    "blob:https://example.test/value",
    "//tracker.invalid/path",
    "https://tracker.invalid/path",
    "/\\tracker.invalid/path",
    "/en?private=question",
    "/en?value=a&private=journal",
    "/./en",
    "/en/../private",
    "/en//practice",
    "/en%0aprivate",
    "/en&#x3f;private",
    "\u0000/en",
    " /en",
    "/en path",
    "/user@example.invalid/path",
  ])("rejects an unsafe or ambiguous action target: %s", (target) => {
    expect(() => createLocalActionHref(target)).toThrow(TypeError);
  });

  it("rejects object coercion at every public string constructor", () => {
    const coercion = { toString: () => "/en" };
    expect(() => createLocalActionHref(coercion as unknown as string)).toThrow(TypeError);
    expect(() => createUiControlId(coercion as unknown as string)).toThrow(TypeError);
    expect(() => createUiControlName(coercion as unknown as string)).toThrow(TypeError);
    expect(() => createUiControlValue(coercion as unknown as string)).toThrow(TypeError);
  });

  it("accepts bounded public control identifiers and rejects free-text-shaped values", () => {
    expect(createUiControlId("question-theme")).toBe("question-theme");
    expect(createUiControlName("question.theme")).toBe("question.theme");
    expect(createUiControlValue("self-reflection")).toBe("self-reflection");

    for (const value of ["", "Private journal", "private/journal", "private?journal", "私密内容"]) {
      expect(() => createUiControlId(value)).toThrow(TypeError);
      expect(() => createUiControlName(value)).toThrow(TypeError);
      expect(() => createUiControlValue(value)).toThrow(TypeError);
    }
  });

  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
    ["DARK", "system"],
    ["auto", "system"],
    ["", "system"],
    [null, "system"],
    [{ color: "dark" }, "system"],
  ])("resolves only the closed theme enum %#", (value, expected) => {
    expect(resolveThemeMode(value)).toBe(expected);
  });
});
