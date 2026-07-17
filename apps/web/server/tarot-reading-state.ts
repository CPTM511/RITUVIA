import "server-only";

export type TarotReadingAvailability = "disabled" | "enabled";

// No publication-eligible tarot catalog and approval manifest is committed yet.
// Keep the HTTP handoff closed until that separately reviewed artifact exists.
export const loadTarotReadingAvailability = (): TarotReadingAvailability => "disabled";
