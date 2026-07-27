import { describe, expect, it } from "vitest";

import {
  parseTarotReadingReportRequest,
  parseTarotReadingReportRequestV1,
  parseTarotReadingReportRequestV2,
  tarotReadingReportCategories,
  tarotReadingReportSchemaVersion,
  tarotReadingReportSchemaVersionV2,
  TarotReadingReportInputError,
} from "../src/index.js";

const interpretationRequestId = "11111111-1111-4111-8111-111111111111";

const validReadingReport = Object.freeze({
  category: "factual",
  schemaVersion: tarotReadingReportSchemaVersion,
  target: Object.freeze({ kind: "reading" }),
});

const validInterpretationReport = Object.freeze({
  category: "safety",
  schemaVersion: tarotReadingReportSchemaVersionV2,
  target: Object.freeze({ interpretationRequestId, kind: "interpretation" }),
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

  it.each(tarotReadingReportCategories)(
    "parses the exact-version %s interpretation target",
    (category) => {
      const parsed = parseTarotReadingReportRequestV2({
        ...validInterpretationReport,
        category,
      });

      expect(parsed).toEqual({ ...validInterpretationReport, category });
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(Object.isFrozen(parsed.target)).toBe(true);
      expect(parseTarotReadingReportRequest(parsed)).toEqual(parsed);
    },
  );

  it("dispatches both schema versions without widening the strict version parsers", () => {
    expect(parseTarotReadingReportRequest(validReadingReport)).toEqual(validReadingReport);
    expect(parseTarotReadingReportRequest(validInterpretationReport)).toEqual(
      validInterpretationReport,
    );
    expect(() => parseTarotReadingReportRequestV1(validInterpretationReport)).toThrow(
      TarotReadingReportInputError,
    );
    expect(() => parseTarotReadingReportRequestV2(validReadingReport)).toThrow(
      TarotReadingReportInputError,
    );
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

  it.each([
    null,
    [],
    {},
    { ...validInterpretationReport, schemaVersion: tarotReadingReportSchemaVersion },
    { ...validInterpretationReport, details: "private-free-text-canary" },
    { ...validInterpretationReport, target: null },
    { ...validInterpretationReport, target: { kind: "interpretation" } },
    {
      ...validInterpretationReport,
      target: {
        interpretationRequestId,
        kind: "interpretation",
        note: "private-free-text-canary",
      },
    },
    {
      ...validInterpretationReport,
      target: {
        interpretationRequestId: "not-an-interpretation",
        kind: "interpretation",
      },
    },
    {
      ...validInterpretationReport,
      target: {
        interpretationRequestId: "11111111-1111-1111-8111-111111111111",
        kind: "interpretation",
      },
    },
    {
      ...validInterpretationReport,
      target: {
        interpretationRequestId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        kind: "interpretation",
      },
    },
  ])("rejects malformed v2 targets without echoing private input", (input) => {
    expect(() => parseTarotReadingReportRequest(input)).toThrow(TarotReadingReportInputError);
    try {
      parseTarotReadingReportRequest(input);
    } catch (error) {
      expect(String(error)).not.toContain("canary");
      expect(JSON.stringify(error)).not.toContain("canary");
    }
  });
});
