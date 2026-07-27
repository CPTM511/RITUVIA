import { describe, expect, it } from "vitest";

import {
  CoreLoopAnalyticsContractError,
  coreLoopAnalyticsConsentNoticeVersion,
  coreLoopAnalyticsConsentPurpose,
  coreLoopEventSchemaVersion,
  createBoundedInMemoryCoreLoopEventLedger,
  parseCoreLoopEvent,
  projectCoreLoopMetrics,
  type CoreLoopEvent,
  type CoreLoopEventName,
} from "../src/index.js";

const key = (prefix: "evt" | "flow" | "ses" | "sub", marker: string): string =>
  `${prefix}_${marker.repeat(43).slice(0, 43)}`;

const base = (eventName: CoreLoopEventName, marker = "a") => ({
  analyticsSessionKey: key("ses", marker),
  analyticsSubjectKey: key("sub", marker),
  consentNoticeVersion: coreLoopAnalyticsConsentNoticeVersion,
  consentPurpose: coreLoopAnalyticsConsentPurpose,
  eventId: key("evt", marker),
  eventName,
  locale: "en" as const,
  occurredAt: "2026-07-20T12:00:00.000Z",
  reflectionSessionKey: key("flow", marker),
  schemaVersion: coreLoopEventSchemaVersion,
  source: "server" as const,
});

const event = (eventName: CoreLoopEventName, marker: string, occurredAt: string): CoreLoopEvent => {
  const common = { ...base(eventName, marker), occurredAt };
  switch (eventName) {
    case "reading_started":
      return parseCoreLoopEvent({
        ...common,
        properties: {
          modality: "tarot",
          readingPolicyVersion: "tarot.policy",
          readingType: "one_card",
        },
      });
    case "reading_deterministic_completed":
      return parseCoreLoopEvent({
        ...common,
        properties: {
          catalogVersion: "1.0.0",
          engineVersion: "1.0.0",
          modality: "tarot",
          readingPolicyVersion: "tarot.policy",
          readingType: "one_card",
        },
      });
    case "interpretation_viewed":
      return parseCoreLoopEvent({
        ...common,
        properties: {
          contentVersion: "1.0.0",
          fallbackUsed: false,
          interpretationKind: "verified",
        },
        source: "client",
      });
    case "intention_created":
      return parseCoreLoopEvent({
        ...common,
        properties: { intentionCode: "calm_clarity" },
      });
    case "ritual_started":
    case "ritual_completed":
      return parseCoreLoopEvent({
        ...common,
        properties: {
          accessCategory: "free",
          ritualItemCode: "candle",
          templateVersion: "1.0.0",
        },
      });
    case "journal_entry_created":
    case "revisit_completed":
      return parseCoreLoopEvent({ ...common, properties: {} });
    case "revisit_scheduled":
      return parseCoreLoopEvent({
        ...common,
        properties: { scheduleKind: "seven_days" },
      });
  }
};

describe("core-loop event contract", () => {
  it("accepts the exact nine-event closed set", () => {
    const names = [
      "reading_started",
      "reading_deterministic_completed",
      "interpretation_viewed",
      "intention_created",
      "ritual_started",
      "ritual_completed",
      "journal_entry_created",
      "revisit_scheduled",
      "revisit_completed",
    ] as const;

    expect(
      names.map((name, index) =>
        event(name, String.fromCharCode(97 + index), "2026-07-20T12:00:00.000Z"),
      ),
    ).toHaveLength(9);
  });

  it("rejects arbitrary fields, raw identifiers, and private canaries", () => {
    const reading = {
      ...base("reading_started"),
      properties: {
        modality: "tarot",
        readingPolicyVersion: "tarot.policy",
        readingType: "one_card",
      },
    };

    expect(() => parseCoreLoopEvent({ ...reading, question: "PRIVATE-QUESTION-CANARY" })).toThrow(
      CoreLoopAnalyticsContractError,
    );
    expect(() =>
      parseCoreLoopEvent({
        ...reading,
        analyticsSubjectKey: "00000000-0000-4000-8000-000000000000",
      }),
    ).toThrow(CoreLoopAnalyticsContractError);
    expect(() =>
      parseCoreLoopEvent({
        ...reading,
        properties: { ...reading.properties, journal: "PRIVATE-JOURNAL-CANARY" },
      }),
    ).toThrow(CoreLoopAnalyticsContractError);
    expect(JSON.stringify(parseCoreLoopEvent(reading))).not.toContain("CANARY");
  });

  it("rejects accessors without evaluating private values", () => {
    let getterCalls = 0;
    const reading = {
      ...base("reading_started"),
      properties: {
        modality: "tarot",
        readingPolicyVersion: "tarot.policy",
        readingType: "one_card",
      },
    };
    Object.defineProperty(reading, "question", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "PRIVATE-ACCESSOR-CANARY";
      },
    });

    expect(() => parseCoreLoopEvent(reading)).toThrow(CoreLoopAnalyticsContractError);
    expect(getterCalls).toBe(0);
  });

  it("requires fallback metadata to remain internally consistent", () => {
    expect(() =>
      parseCoreLoopEvent({
        ...base("interpretation_viewed"),
        properties: {
          contentVersion: "1.0.0",
          fallbackUsed: false,
          interpretationKind: "reviewed_fallback",
        },
      }),
    ).toThrow(CoreLoopAnalyticsContractError);
  });
});

describe("bounded event ledger", () => {
  it("deduplicates semantic event keys and fails closed at capacity", () => {
    const ledger = createBoundedInMemoryCoreLoopEventLedger(2);
    const first = event("reading_started", "a", "2026-07-20T12:00:00.000Z");
    const second = event("reading_deterministic_completed", "b", "2026-07-20T12:00:01.000Z");
    const third = event("intention_created", "c", "2026-07-20T12:00:02.000Z");

    expect(ledger.append(first, "2026-07-20T12:00:00.100Z")).toBe(true);
    expect(ledger.append(first, "2026-07-20T12:00:00.200Z")).toBe(false);
    expect(ledger.append(second, "2026-07-20T12:00:01.100Z")).toBe(true);
    expect(ledger.append(third, "2026-07-20T12:00:02.100Z")).toBe(false);
    expect(ledger.snapshot()).toHaveLength(2);
  });
});

describe("WMRS and funnel projection", () => {
  it("counts distinct subjects separately from qualifying reflection sessions", () => {
    const ledger = createBoundedInMemoryCoreLoopEventLedger();
    const append = (
      name: CoreLoopEventName,
      subjectMarker: string,
      flowMarker: string,
      eventMarker: string,
      occurredAt: string,
      receivedAt = occurredAt,
    ) => {
      const candidate = {
        ...event(name, eventMarker, occurredAt),
        analyticsSessionKey: key("ses", subjectMarker),
        analyticsSubjectKey: key("sub", subjectMarker),
        reflectionSessionKey: key("flow", flowMarker),
      };
      expect(ledger.append(candidate, receivedAt)).toBe(true);
    };

    append("reading_deterministic_completed", "a", "a", "a", "2026-07-20T12:00:00.000Z");
    append("intention_created", "a", "a", "b", "2026-07-20T12:01:00.000Z");
    append("reading_deterministic_completed", "a", "b", "c", "2026-07-21T12:00:00.000Z");
    append(
      "ritual_completed",
      "a",
      "b",
      "d",
      "2026-07-21T12:02:00.000Z",
      "2026-07-23T12:02:00.000Z",
    );
    append("reading_deterministic_completed", "b", "c", "e", "2026-07-22T12:00:00.000Z");
    append("journal_entry_created", "b", "c", "f", "2026-07-22T12:03:00.000Z");
    append("intention_created", "c", "d", "g", "2026-07-10T12:00:00.000Z");

    const projected = projectCoreLoopMetrics(ledger.snapshot(), "2026-07-24T12:00:00.000Z");

    expect(projected.wmrs).toBe(2);
    expect(projected.qualifyingReflectionSessions).toBe(3);
    expect(projected.distinctAnalyticsSubjects).toBe(2);
    expect(projected.lateEventCount).toBe(1);
    expect(projected.windowStart).toBe("2026-07-17T12:00:00.000Z");
  });

  it("requires a deeper step at or after deterministic reading completion", () => {
    const ledger = createBoundedInMemoryCoreLoopEventLedger();
    expect(
      ledger.append(
        event("intention_created", "a", "2026-07-20T11:59:00.000Z"),
        "2026-07-20T11:59:00.000Z",
      ),
    ).toBe(true);
    expect(
      ledger.append(
        {
          ...event("reading_deterministic_completed", "b", "2026-07-20T12:00:00.000Z"),
          analyticsSessionKey: key("ses", "a"),
          analyticsSubjectKey: key("sub", "a"),
          reflectionSessionKey: key("flow", "a"),
        },
        "2026-07-20T12:00:00.000Z",
      ),
    ).toBe(true);

    expect(projectCoreLoopMetrics(ledger.snapshot(), "2026-07-24T12:00:00.000Z").wmrs).toBe(0);
  });
});
