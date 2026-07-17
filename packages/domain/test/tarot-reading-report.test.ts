import { describe, expect, it } from "vitest";

import {
  parseTarotReadingReportRequestV1,
  tarotReadingReportCategories,
  tarotReadingReportSchemaVersion,
  TarotReadingReportInputError,
} from "../src/index.js";

const validReadingReport = Object.freeze({
  category: "factual",
  schemaVersion: tarotReadingReportSchemaVersion,
  target: Object.freeze({ kind: "reading" }),
});

describe("tarot reading report request", () => {
  it.each(tarotReadingReportCategories)("parses the %s category", (category) => {
    const parsed = parseTarotReadingReportRequestV1({ ...validReadingReport, category });

    expect(parsed).toEqual({ ...validReadingReport, category });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.target)).toBe(true);
  });

  it("accepts one bounded canonical position identifier", () => {
    expect(
      parseTarotReadingReportRequestV1({
        ...validReadingReport,
        target: { kind: "position", positionId: "possibility" },
      }),
    ).toEqual({
      ...validReadingReport,
      target: { kind: "position", positionId: "possibility" },
    });
  });

  it.each([
    null,
    [],
    {},
    { ...validReadingReport, category: "private-free-text-canary" },
    { ...validReadingReport, schemaVersion: "tarot-reading-report.v2" },
    { ...validReadingReport, details: "private-free-text-canary" },
    { ...validReadingReport, target: null },
    { ...validReadingReport, target: { kind: "card", positionId: "situation" } },
    { ...validReadingReport, target: { kind: "reading", positionId: "situation" } },
    { ...validReadingReport, target: { kind: "position" } },
    { ...validReadingReport, target: { kind: "position", positionId: "Situation" } },
    { ...validReadingReport, target: { kind: "position", positionId: "a".repeat(101) } },
  ])("rejects unsupported, free-text, or extra input without echoing it", (input) => {
    expect(() => parseTarotReadingReportRequestV1(input)).toThrow(TarotReadingReportInputError);
    try {
      parseTarotReadingReportRequestV1(input);
    } catch (error) {
      expect(String(error)).not.toContain("canary");
      expect(JSON.stringify(error)).not.toContain("canary");
    }
  });
});
