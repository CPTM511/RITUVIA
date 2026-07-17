import { describe, expect, it } from "vitest";

import {
  parseTarotReadingCreateRequestV1,
  tarotReadingCreateSchemaVersion,
  TarotReadingInputError,
} from "../src/index.js";

const validRequest = Object.freeze({
  locale: "en",
  readingType: "one_card",
  schemaVersion: tarotReadingCreateSchemaVersion,
  themeCode: "open_reflection",
});

describe("tarot reading create request", () => {
  it("parses and freezes the exact theme-only launch contract", () => {
    const parsed = parseTarotReadingCreateRequestV1(validRequest);

    expect(parsed).toEqual(validRequest);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it.each([
    null,
    [],
    {},
    { ...validRequest, locale: "fr" },
    { ...validRequest, readingType: "relationship" },
    { ...validRequest, schemaVersion: "tarot-reading-create.v2" },
    { ...validRequest, themeCode: "medical_diagnosis" },
    { ...validRequest, question: "private-question-canary" },
    { ...validRequest, safeQuestion: "forged-safe-question-canary" },
    { ...validRequest, cardId: "chosen-by-client" },
    { ...validRequest, orientation: "reversed" },
    { ...validRequest, seed: "predictable" },
    { ...validRequest, previousExecution: {} },
  ])("rejects unsafe, unsupported, or extra input without echoing it", (input) => {
    expect(() => parseTarotReadingCreateRequestV1(input)).toThrow(TarotReadingInputError);
    try {
      parseTarotReadingCreateRequestV1(input);
    } catch (error) {
      expect(String(error)).not.toContain("canary");
      expect(JSON.stringify(error)).not.toContain("canary");
    }
  });

  it("fails closed on an accessor without reading it twice", () => {
    let reads = 0;
    const input = {
      ...validRequest,
      get themeCode() {
        reads += 1;
        if (reads > 1) return "open_reflection";
        throw new Error("private-accessor-canary");
      },
    };

    expect(() => parseTarotReadingCreateRequestV1(input)).toThrow(TarotReadingInputError);
    expect(reads).toBe(1);
  });
});
