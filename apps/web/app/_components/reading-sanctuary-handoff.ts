export const sanctuaryReadingHandoffStorageKey = "rituvia.sanctuary-reading.v1";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const storeSanctuaryReadingHandoff = (
  storage: Pick<Storage, "setItem">,
  readingId: string,
): boolean => {
  if (!uuidPattern.test(readingId)) return false;
  try {
    storage.setItem(sanctuaryReadingHandoffStorageKey, readingId);
    return true;
  } catch {
    return false;
  }
};

export const clearSanctuaryReadingHandoff = (storage: Pick<Storage, "removeItem">): void => {
  try {
    storage.removeItem(sanctuaryReadingHandoffStorageKey);
  } catch {
    return;
  }
};
