import { describe, expect, it } from "vitest";

import {
  parseTarotOneCardResponse,
  TarotReadingResponseError,
} from "../app/_contracts/tarot-reading-response";
import { createTarotOneCardResponseFixture } from "./fixtures/tarot-reading-response";

describe("tarot one-card public response", () => {
  it("accepts and freezes one exact presentation matched to deterministic facts", () => {
    const parsed = parseTarotOneCardResponse(createTarotOneCardResponseFixture());

    expect(parsed.schemaVersion).toBe("tarot-reading-response.v2");
    expect(parsed.presentation.cards[0]).toMatchObject({
      cardId: "lantern",
      orientation: "upright",
      positionId: "perspective",
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.presentation.cards)).toBe(true);
  });

  it.each([
    [
      "extra top-level data",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        audit: "private",
      }),
    ],
    [
      "legacy schema",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        schemaVersion: "tarot-reading-response.v1",
      }),
    ],
    [
      "mismatched card",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        presentation: {
          ...value.presentation,
          cards: [{ ...value.presentation.cards[0], cardId: "mirror" }],
        },
      }),
    ],
    [
      "mismatched orientation",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        presentation: {
          ...value.presentation,
          cards: [{ ...value.presentation.cards[0], orientation: "reversed" }],
        },
      }),
    ],
    [
      "multiple cards",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        presentation: {
          ...value.presentation,
          cards: [
            ...value.presentation.cards,
            { ...value.presentation.cards[0], cardId: "mirror", order: 2, positionId: "action" },
          ],
        },
      }),
    ],
    [
      "non-v4 reading id",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        readingId: "not-a-reading",
      }),
    ],
  ])("rejects %s", (_label, mutate) => {
    expect(() => parseTarotOneCardResponse(mutate(createTarotOneCardResponseFixture()))).toThrow(
      TarotReadingResponseError,
    );
  });
});
