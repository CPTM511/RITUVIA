import { parseCoreLoopEvent, type CoreLoopEvent } from "./contracts.js";

export type CoreLoopEventObservation = Readonly<{
  event: CoreLoopEvent;
  receivedAt: string;
}>;

export type CoreLoopEventLedger = Readonly<{
  append(event: unknown, receivedAt: string): boolean;
  snapshot(): readonly CoreLoopEventObservation[];
}>;

const parseInstant = (value: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError("The analytics receipt time is invalid.");
  }
  return value;
};

export const createBoundedInMemoryCoreLoopEventLedger = (capacity = 1_000): CoreLoopEventLedger => {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10_000) {
    throw new TypeError("The analytics ledger capacity is invalid.");
  }
  const observations: CoreLoopEventObservation[] = [];
  const eventIds = new Set<string>();

  return Object.freeze({
    append(event: unknown, receivedAt: string): boolean {
      const parsed = parseCoreLoopEvent(event);
      const receipt = parseInstant(receivedAt);
      if (eventIds.has(parsed.eventId)) return false;
      if (observations.length >= capacity) return false;
      eventIds.add(parsed.eventId);
      observations.push(Object.freeze({ event: parsed, receivedAt: receipt }));
      return true;
    },
    snapshot(): readonly CoreLoopEventObservation[] {
      return Object.freeze([...observations]);
    },
  });
};
