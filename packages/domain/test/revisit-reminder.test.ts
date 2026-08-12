import { describe, expect, it } from "vitest";

import {
  parseRevisitReminderMutationV1,
  revisitReminderBackoffSeconds,
  revisitReminderChannel,
  revisitReminderFrequency,
  revisitReminderNoticeVersion,
  revisitReminderSchemaVersion,
} from "../src/revisit-reminder.js";

const request = {
  action: "subscribe",
  channel: revisitReminderChannel,
  frequency: revisitReminderFrequency,
  noticeVersion: revisitReminderNoticeVersion,
  schemaVersion: revisitReminderSchemaVersion,
} as const;

describe("Revisit reminder contract", () => {
  it("accepts one exact versioned subscribe or unsubscribe request", () => {
    expect(parseRevisitReminderMutationV1(request)).toEqual(request);
    expect(parseRevisitReminderMutationV1({ ...request, action: "unsubscribe" })).toEqual({
      ...request,
      action: "unsubscribe",
    });
  });

  it.each([
    null,
    {},
    { ...request, channel: "push" },
    { ...request, frequency: "weekly" },
    { ...request, noticeVersion: "old" },
    { ...request, extra: true },
  ])("rejects bundled, stale, or unsupported request %j", (value) => {
    expect(() => parseRevisitReminderMutationV1(value)).toThrow(TypeError);
  });

  it("uses bounded deterministic exponential backoff with jitter", () => {
    const seed = "12345678-1234-4123-8123-123456789abc";
    const first = revisitReminderBackoffSeconds({ attempt: 1, seed });
    expect(first).toBeGreaterThanOrEqual(30);
    expect(first).toBeLessThanOrEqual(46);
    expect(revisitReminderBackoffSeconds({ attempt: 2, seed })).toBe(first + 30);
    expect(revisitReminderBackoffSeconds({ attempt: 8, seed })).toBeLessThanOrEqual(3_616);
  });
});
