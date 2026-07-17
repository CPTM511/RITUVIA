import type { TarotReadingType } from "@rituvia/domain";

import { isTarotReadingId } from "../_contracts/tarot-reading-response";

export type TarotReadingResumeStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export const tarotReadingResumeStorageKeys = Object.freeze({
  one_card: "rituvia.tarot.resume.v1.one_card",
  three_card: "rituvia.tarot.resume.v1.three_card",
}) satisfies Readonly<Record<TarotReadingType, string>>;

const keyFor = (readingType: TarotReadingType): string =>
  readingType === "one_card"
    ? tarotReadingResumeStorageKeys.one_card
    : tarotReadingResumeStorageKeys.three_card;

export const readTarotReadingResumeId = (
  storage: TarotReadingResumeStorage,
  readingType: TarotReadingType,
  options: Readonly<{ openerPresent: boolean }>,
): string | null => {
  const key = keyFor(readingType);
  if (options.openerPresent) {
    try {
      storage.removeItem(key);
    } catch {
      // A cloned tab must never use an inherited resume identifier.
    }
    return null;
  }
  try {
    const candidate = storage.getItem(key);
    if (candidate === null) return null;
    if (isTarotReadingId(candidate)) return candidate;
    try {
      storage.removeItem(key);
    } catch {
      // A blocked cleanup cannot make an invalid identifier usable.
    }
    return null;
  } catch {
    return null;
  }
};

export const storeTarotReadingResumeId = (
  storage: TarotReadingResumeStorage,
  readingType: TarotReadingType,
  readingId: string,
): boolean => {
  if (!isTarotReadingId(readingId)) return false;
  try {
    storage.setItem(keyFor(readingType), readingId);
    return true;
  } catch {
    return false;
  }
};

export const clearTarotReadingResumeId = (
  storage: TarotReadingResumeStorage,
  readingType: TarotReadingType,
): void => {
  try {
    storage.removeItem(keyFor(readingType));
  } catch {
    // Storage can be disabled; the server remains the authorization boundary.
  }
};
