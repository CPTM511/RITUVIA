import { describe, expect, it } from "vitest";

import {
  parseTarotOneCardResponse,
  parseTarotThreeCardResponse,
  TarotReadingResponseError,
} from "../app/_contracts/tarot-reading-response";
import {
  createTarotOneCardResponseFixture,
  createTarotThreeCardResponseFixture,
} from "./fixtures/tarot-reading-response";

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
    [
      "oversized reading policy version",
      (value: ReturnType<typeof createTarotOneCardResponseFixture>) => ({
        ...value,
        readingPolicyVersion: `a${"b".repeat(100)}`,
      }),
    ],
  ])("rejects %s", (_label, mutate) => {
    expect(() => parseTarotOneCardResponse(mutate(createTarotOneCardResponseFixture()))).toThrow(
      TarotReadingResponseError,
    );
  });
});

describe("tarot three-card public response", () => {
  it("accepts exactly three ordered positions matched to deterministic facts", () => {
    const parsed = parseTarotThreeCardResponse(createTarotThreeCardResponseFixture());

    expect(
      parsed.presentation.cards.map(({ cardId, order, positionId }) => ({
        cardId,
        order,
        positionId,
      })),
    ).toEqual([
      { cardId: "lantern", order: 1, positionId: "situation" },
      { cardId: "mirror", order: 2, positionId: "action" },
      { cardId: "threshold", order: 3, positionId: "possibility" },
    ]);
    expect(Object.isFrozen(parsed.presentation.cards)).toBe(true);
  });

  it.each([
    [
      "one-card type",
      (value: ReturnType<typeof createTarotThreeCardResponseFixture>) => ({
        ...value,
        readingType: "one_card",
      }),
    ],
    [
      "wrong spread",
      (value: ReturnType<typeof createTarotThreeCardResponseFixture>) => ({
        ...value,
        facts: { ...value.facts, spread: { id: "other-spread", version: "1.0.0" } },
      }),
    ],
    [
      "reordered facts",
      (value: ReturnType<typeof createTarotThreeCardResponseFixture>) => ({
        ...value,
        facts: { ...value.facts, positions: [...value.facts.positions].reverse() },
      }),
    ],
    [
      "mismatched presentation position",
      (value: ReturnType<typeof createTarotThreeCardResponseFixture>) => ({
        ...value,
        presentation: {
          ...value.presentation,
          cards: value.presentation.cards.map((card, index) =>
            index === 1 ? { ...card, positionId: "possibility" } : card,
          ),
        },
      }),
    ],
    [
      "swapped position title",
      (value: ReturnType<typeof createTarotThreeCardResponseFixture>) => ({
        ...value,
        presentation: {
          ...value.presentation,
          cards: value.presentation.cards.map((card, index) =>
            index === 0 ? { ...card, positionTitle: "Possibility" } : card,
          ),
        },
      }),
    ],
    [
      "duplicate card",
      (value: ReturnType<typeof createTarotThreeCardResponseFixture>) => ({
        ...value,
        facts: {
          ...value.facts,
          positions: value.facts.positions.map((position, index) =>
            index === 1 ? { ...position, cardId: "lantern" } : position,
          ),
        },
      }),
    ],
  ])("rejects %s", (_label, mutate) => {
    expect(() =>
      parseTarotThreeCardResponse(mutate(createTarotThreeCardResponseFixture())),
    ).toThrow(TarotReadingResponseError);
  });
});
