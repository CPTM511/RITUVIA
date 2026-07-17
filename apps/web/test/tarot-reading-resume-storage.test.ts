import { describe, expect, it, vi } from "vitest";

import {
  clearTarotReadingResumeId,
  readTarotReadingResumeId,
  storeTarotReadingResumeId,
  tarotReadingResumeStorageKeys,
  type TarotReadingResumeStorage,
} from "../app/_components/tarot-reading-resume-storage";

const oneCardId = "33333333-3333-4333-8333-333333333333";
const threeCardId = "44444444-4444-4444-8444-444444444444";
const originalTab = Object.freeze({ openerPresent: false });

const memoryStorage = (): Readonly<{
  entries: Map<string, string>;
  storage: TarotReadingResumeStorage;
}> => {
  const entries = new Map<string, string>();
  return {
    entries,
    storage: {
      getItem: (key) => entries.get(key) ?? null,
      removeItem: (key) => {
        entries.delete(key);
      },
      setItem: (key, value) => {
        entries.set(key, value);
      },
    },
  };
};

describe("same-tab tarot reading resume storage", () => {
  it("stores only one bounded UUID per reading type and keeps the keys isolated", () => {
    const { entries, storage } = memoryStorage();

    expect(storeTarotReadingResumeId(storage, "one_card", oneCardId)).toBe(true);
    expect(storeTarotReadingResumeId(storage, "three_card", threeCardId)).toBe(true);
    expect(readTarotReadingResumeId(storage, "one_card", originalTab)).toBe(oneCardId);
    expect(readTarotReadingResumeId(storage, "three_card", originalTab)).toBe(threeCardId);
    expect([...entries.entries()]).toEqual([
      [tarotReadingResumeStorageKeys.one_card, oneCardId],
      [tarotReadingResumeStorageKeys.three_card, threeCardId],
    ]);
    expect(JSON.stringify([...entries.values()])).not.toMatch(
      /theme|question|card|orientation|presentation|idempotency|cookie|report/iu,
    );
  });

  it.each([
    "not-a-reading",
    "ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF",
    `${oneCardId}0`,
    ` ${oneCardId}`,
  ])("removes an invalid saved value without returning it: %j", (invalid) => {
    const { entries, storage } = memoryStorage();
    entries.set(tarotReadingResumeStorageKeys.one_card, invalid);

    expect(readTarotReadingResumeId(storage, "one_card", originalTab)).toBeNull();
    expect(entries.has(tarotReadingResumeStorageKeys.one_card)).toBe(false);
  });

  it("refuses to write an invalid identifier", () => {
    const setItem = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem,
    } satisfies TarotReadingResumeStorage;

    expect(storeTarotReadingResumeId(storage, "one_card", "private-text")).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("degrades safely when browser storage access is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies TarotReadingResumeStorage;

    expect(readTarotReadingResumeId(blocked, "one_card", originalTab)).toBeNull();
    expect(storeTarotReadingResumeId(blocked, "one_card", oneCardId)).toBe(false);
    expect(() => clearTarotReadingResumeId(blocked, "one_card")).not.toThrow();
  });

  it("clears only the requested reading type", () => {
    const { entries, storage } = memoryStorage();
    storeTarotReadingResumeId(storage, "one_card", oneCardId);
    storeTarotReadingResumeId(storage, "three_card", threeCardId);

    clearTarotReadingResumeId(storage, "one_card");

    expect(readTarotReadingResumeId(storage, "one_card", originalTab)).toBeNull();
    expect(readTarotReadingResumeId(storage, "three_card", originalTab)).toBe(threeCardId);
    expect(entries.size).toBe(1);
  });

  it("clears and refuses an opener-cloned resume identifier", () => {
    const { entries, storage } = memoryStorage();
    storeTarotReadingResumeId(storage, "one_card", oneCardId);

    expect(
      readTarotReadingResumeId(storage, "one_card", {
        openerPresent: true,
      }),
    ).toBeNull();
    expect(entries.has(tarotReadingResumeStorageKeys.one_card)).toBe(false);
  });
});
