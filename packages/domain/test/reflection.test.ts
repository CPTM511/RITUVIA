import { describe, expect, it } from "vitest";

import {
  canonicalizeReflectionIntentionCreateRequestV1,
  canonicalizeReflectionJournalCreateRequestV1,
  canonicalizeReflectionRitualCreateRequestV1,
  parseReflectionIntentionCreateRequestV1,
  parseReflectionIntentionResourceV1,
  parseReflectionJournalCreateRequestV1,
  parseReflectionJournalResourceV1,
  parseReflectionRitualCreateRequestV1,
  parseReflectionRitualResourceV1,
  ReflectionError,
  reflectionFreeRitualObjectCodes,
  reflectionIntentionCodes,
  reflectionJournalMaximumLength,
  reflectionRitualObjectCodes,
  reflectionSmallActionMaximumLength,
} from "../src/reflection.js";

const readingId = "11111111-1111-4111-8111-111111111111";
const intentionId = "22222222-2222-4222-8222-222222222222";
const ritualSessionId = "33333333-3333-4333-8333-333333333333";
const journalEntryId = "44444444-4444-4444-8444-444444444444";

const intentionRequest = Object.freeze({
  intentionCode: "calm_clarity",
  locale: "en",
  readingId,
  schemaVersion: "reflection-intention.v1",
  smallAction: "  Take one quiet breath before replying.  ",
});

const ritualRequest = Object.freeze({
  intentionId,
  objectCode: "candle",
  schemaVersion: "reflection-ritual.v1",
});

const journalRequest = Object.freeze({
  intentionId,
  reflection: "  I paused and chose a calmer response.  ",
  ritualSessionId,
  schemaVersion: "reflection-journal.v1",
});

describe("reflection loop domain", () => {
  it("normalizes and freezes exact intention, ritual, and journal requests", () => {
    const intention = parseReflectionIntentionCreateRequestV1(intentionRequest);
    const ritual = parseReflectionRitualCreateRequestV1(ritualRequest);
    const journal = parseReflectionJournalCreateRequestV1(journalRequest);

    expect(intention.smallAction).toBe("Take one quiet breath before replying.");
    expect(journal.reflection).toBe("I paused and chose a calmer response.");
    expect(Object.isFrozen(intention)).toBe(true);
    expect(Object.isFrozen(ritual)).toBe(true);
    expect(Object.isFrozen(journal)).toBe(true);
  });

  it.each(reflectionIntentionCodes)("accepts the bounded %s intention", (intentionCode) => {
    expect(
      parseReflectionIntentionCreateRequestV1({ ...intentionRequest, intentionCode }).intentionCode,
    ).toBe(intentionCode);
  });

  it.each(reflectionFreeRitualObjectCodes)("keeps the free %s ritual available", (objectCode) => {
    expect(parseReflectionRitualCreateRequestV1({ ...ritualRequest, objectCode }).objectCode).toBe(
      objectCode,
    );
  });

  it.each(reflectionRitualObjectCodes)("accepts the bounded %s ritual object", (objectCode) => {
    expect(parseReflectionRitualCreateRequestV1({ ...ritualRequest, objectCode }).objectCode).toBe(
      objectCode,
    );
  });

  it("canonicalizes normalized requests with stable key ordering", () => {
    expect(canonicalizeReflectionIntentionCreateRequestV1(intentionRequest)).toBe(
      `{"intentionCode":"calm_clarity","locale":"en","readingId":"${readingId}","schemaVersion":"reflection-intention.v1","smallAction":"Take one quiet breath before replying."}`,
    );
    expect(canonicalizeReflectionRitualCreateRequestV1(ritualRequest)).toBe(
      `{"intentionId":"${intentionId}","objectCode":"candle","schemaVersion":"reflection-ritual.v1"}`,
    );
    expect(canonicalizeReflectionJournalCreateRequestV1(journalRequest)).toBe(
      `{"intentionId":"${intentionId}","reflection":"I paused and chose a calmer response.","ritualSessionId":"${ritualSessionId}","schemaVersion":"reflection-journal.v1"}`,
    );
  });

  it.each([
    [intentionRequest, parseReflectionIntentionCreateRequestV1],
    [ritualRequest, parseReflectionRitualCreateRequestV1],
    [journalRequest, parseReflectionJournalCreateRequestV1],
  ] as const)(
    "rejects unknown request fields without reflecting private text",
    (request, parse) => {
      const privateCanary = "private-reflection-canary";
      expect(() => parse({ ...request, extra: privateCanary })).toThrowError(
        expect.objectContaining({ code: "REFLECTION_INPUT_INVALID" }),
      );
      try {
        parse({ ...request, extra: privateCanary });
      } catch (error) {
        expect(String(error)).not.toContain(privateCanary);
      }
    },
  );

  it.each([
    ["", reflectionSmallActionMaximumLength + 1, parseReflectionIntentionCreateRequestV1],
    ["\u202esecret", 0, parseReflectionIntentionCreateRequestV1],
    ["", reflectionJournalMaximumLength + 1, parseReflectionJournalCreateRequestV1],
    ["\u0000secret", 0, parseReflectionJournalCreateRequestV1],
  ] as const)("rejects empty, oversized, or unsafe private content", (text, size, parse) => {
    const value = size === 0 ? text : "x".repeat(size);
    const request =
      parse === parseReflectionIntentionCreateRequestV1
        ? { ...intentionRequest, smallAction: value }
        : { ...journalRequest, reflection: value };
    expect(() => parse(request as never)).toThrowError(ReflectionError);
  });

  it("rejects non-v4 IDs and non-English locale", () => {
    expect(() =>
      parseReflectionIntentionCreateRequestV1({ ...intentionRequest, readingId: "not-private" }),
    ).toThrowError(ReflectionError);
    expect(() =>
      parseReflectionIntentionCreateRequestV1({ ...intentionRequest, locale: "zh" }),
    ).toThrowError(ReflectionError);
  });

  it("parses frozen private resources without exposing ownership or idempotency data", () => {
    const intention = parseReflectionIntentionResourceV1({
      createdAt: "2026-07-18T00:00:00.000Z",
      expiresAt: "2026-08-18T00:00:00.000Z",
      id: intentionId,
      intentionCode: "courage_action",
      locale: "en",
      policyVersion: "reflection-loop.en.v1",
      readingId,
      schemaVersion: "reflection-intention.v1",
      smallAction: "Make the first call.",
    });
    const ritual = parseReflectionRitualResourceV1({
      completedAt: "2026-07-18T00:05:00.000Z",
      expiresAt: "2026-08-18T00:00:00.000Z",
      id: ritualSessionId,
      intentionId,
      objectCode: "incense",
      policyVersion: "reflection-loop.en.v1",
      ritualDateUtc: "2026-07-18",
      schemaVersion: "reflection-ritual.v1",
    });
    const journal = parseReflectionJournalResourceV1({
      createdAt: "2026-07-18T00:10:00.000Z",
      expiresAt: "2026-08-18T00:00:00.000Z",
      id: journalEntryId,
      intentionId,
      policyVersion: "reflection-loop.en.v1",
      reflection: "I took the first step.",
      revisitAt: "2026-07-19T00:10:00.000Z",
      ritualSessionId,
      schemaVersion: "reflection-journal.v1",
    });

    expect(Object.keys(intention)).not.toContain("anonymousSubjectId");
    expect(Object.keys(ritual)).not.toContain("idempotencyKeyHash");
    expect(Object.keys(journal)).not.toContain("canonicalRequestHash");
    expect(Object.isFrozen(journal)).toBe(true);
  });

  it("rejects malformed resource time ordering", () => {
    expect(() =>
      parseReflectionJournalResourceV1({
        createdAt: "2026-07-18T00:10:00.000Z",
        expiresAt: "2026-07-18T00:11:00.000Z",
        id: journalEntryId,
        intentionId,
        policyVersion: "reflection-loop.en.v1",
        reflection: "private-canary",
        revisitAt: "2026-07-18T00:09:00.000Z",
        ritualSessionId,
        schemaVersion: "reflection-journal.v1",
      }),
    ).toThrowError(expect.objectContaining({ code: "REFLECTION_OUTPUT_INVALID" }));
  });
});
