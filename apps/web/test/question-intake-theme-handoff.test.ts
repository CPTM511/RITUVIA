import { describe, expect, it, vi } from "vitest";

import {
  clearQuestionIntakeThemeHandoff,
  questionIntakeThemeHandoffStorageKey,
  storeQuestionIntakeThemeHandoff,
  takeQuestionIntakeThemeHandoff,
  type QuestionIntakeThemeHandoffStorage,
} from "../app/_components/question-intake-theme-handoff";

const memoryStorage = (): Readonly<{
  entries: Map<string, string>;
  storage: QuestionIntakeThemeHandoffStorage;
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

describe("question intake theme handoff", () => {
  it("stores and consumes only one approved categorical theme", () => {
    const { entries, storage } = memoryStorage();

    expect(storeQuestionIntakeThemeHandoff(storage, "open_reflection")).toBe(true);
    expect(entries.get(questionIntakeThemeHandoffStorageKey)).toBe("open_reflection");
    expect(takeQuestionIntakeThemeHandoff(storage, { openerPresent: false })).toBe(
      "open_reflection",
    );
    expect(entries.size).toBe(0);
  });

  it.each(["private question", "OPEN_REFLECTION", "open-reflection", ""])(
    "refuses an unapproved value: %j",
    (invalid) => {
      const setItem = vi.fn();
      const storage = {
        getItem: vi.fn(() => null),
        removeItem: vi.fn(),
        setItem,
      } satisfies QuestionIntakeThemeHandoffStorage;

      expect(storeQuestionIntakeThemeHandoff(storage, invalid)).toBe(false);
      expect(setItem).not.toHaveBeenCalled();
    },
  );

  it("removes a malformed or opener-cloned value without returning it", () => {
    const malformed = memoryStorage();
    malformed.entries.set(questionIntakeThemeHandoffStorageKey, "private question");
    expect(takeQuestionIntakeThemeHandoff(malformed.storage, { openerPresent: false })).toBeNull();
    expect(malformed.entries.size).toBe(0);

    const cloned = memoryStorage();
    cloned.entries.set(questionIntakeThemeHandoffStorageKey, "work");
    expect(takeQuestionIntakeThemeHandoff(cloned.storage, { openerPresent: true })).toBeNull();
    expect(cloned.entries.size).toBe(0);
  });

  it("degrades safely when browser storage is blocked", () => {
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
    } satisfies QuestionIntakeThemeHandoffStorage;

    expect(storeQuestionIntakeThemeHandoff(blocked, "work")).toBe(false);
    expect(takeQuestionIntakeThemeHandoff(blocked, { openerPresent: false })).toBeNull();
    expect(() => clearQuestionIntakeThemeHandoff(blocked)).not.toThrow();
  });
});
