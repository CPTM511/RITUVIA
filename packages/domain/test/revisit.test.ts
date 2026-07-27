import { describe, expect, it } from "vitest";

import {
  isRevisitDueV1,
  isRevisitScheduleWithinWindowV1,
  parseRevisitMutationRequestV1,
  parseRevisitResourceV1,
  parseRevisitScheduleRequestV1,
  resolveRevisitScheduledLocalDateV1,
  RevisitContractError,
  transitionRevisitStateV1,
} from "../src/revisit";

const intentionId = "11111111-1111-4111-8111-111111111111";
const revisitId = "44444444-4444-4444-8444-444444444444";

const schedule = Object.freeze({
  customDate: null,
  intentionId,
  quietHours: Object.freeze({ endLocalTime: "08:00", startLocalTime: "22:00" }),
  reminderChannel: null,
  reminderPreference: "none" as const,
  scheduleKind: "next_day" as const,
  schemaVersion: "reflection-revisit.v1" as const,
  timeZone: "America/New_York",
});

const resource = Object.freeze({
  archivedAt: null,
  completedAt: null,
  completionReflection: null,
  createdAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-10-20T00:00:00.000Z",
  id: revisitId,
  intentionId,
  intentionRevision: 3,
  intentionText: "I intend to pause before I respond.",
  isDue: false,
  outcomeTags: [],
  policyVersion: "reflection-loop.en.v1" as const,
  quietHours: Object.freeze({ endLocalTime: "08:00", startLocalTime: "22:00" }),
  reminderChannel: null,
  reminderPreference: "none" as const,
  revision: 1,
  scheduledLocalDate: "2026-07-25",
  scheduleKind: "next_day" as const,
  schemaVersion: "reflection-revisit.v1" as const,
  smallAction: "Take one slow breath.",
  status: "scheduled" as const,
  timeZone: "America/New_York",
  updatedAt: "2026-07-24T00:00:00.000Z",
});

describe("Revisit domain", () => {
  it("parses a reminder-off local-calendar schedule with overnight quiet hours", () => {
    expect(parseRevisitScheduleRequestV1(schedule)).toEqual(schedule);
  });

  it.each([
    { ...schedule, reminderPreference: "email" },
    { ...schedule, reminderChannel: "email" },
    { ...schedule, scheduleKind: "next_day", customDate: "2026-07-25" },
    { ...schedule, scheduleKind: "custom", customDate: null },
    {
      ...schedule,
      quietHours: { endLocalTime: "22:00", startLocalTime: "22:00" },
    },
    { ...schedule, timeZone: "Unknown/Nowhere" },
  ])("rejects invalid or delivery-bearing schedule authority", (value) => {
    expect(() => parseRevisitScheduleRequestV1(value)).toThrow(RevisitContractError);
  });

  it("resolves next-day and seven-day presets across leap day and DST without UTC drift", () => {
    expect(resolveRevisitScheduledLocalDateV1(schedule, "2028-02-28")).toBe("2028-02-29");
    expect(
      resolveRevisitScheduledLocalDateV1({ ...schedule, scheduleKind: "seven_days" }, "2026-03-07"),
    ).toBe("2026-03-14");
  });

  it("resolves and bounds a custom date inside inherited retention", () => {
    const custom = {
      ...schedule,
      customDate: "2026-08-20",
      scheduleKind: "custom" as const,
    };
    expect(resolveRevisitScheduledLocalDateV1(custom, "2026-07-24")).toBe("2026-08-20");
    expect(isRevisitScheduleWithinWindowV1("2026-07-24", "2026-08-20", "2026-10-20")).toBe(true);
    expect(isRevisitScheduleWithinWindowV1("2026-07-24", "2026-07-24", "2026-10-20")).toBe(false);
    expect(isRevisitScheduleWithinWindowV1("2026-07-24", "2026-10-20", "2026-10-20")).toBe(false);
  });

  it("computes due state from local calendar dates", () => {
    expect(isRevisitDueV1("2026-07-25", "2026-07-24")).toBe(false);
    expect(isRevisitDueV1("2026-07-25", "2026-07-25")).toBe(true);
    expect(isRevisitDueV1("2026-07-25", "2026-07-26")).toBe(true);
  });

  it("parses scheduled and completed private resources", () => {
    expect(parseRevisitResourceV1(resource)).toEqual(resource);
    const completed = {
      ...resource,
      completedAt: "2026-07-25T12:00:00.000Z",
      completionReflection: "I took the action and learned where I need more time.",
      isDue: false,
      outcomeTags: ["action_taken", "partial_progress"],
      revision: 2,
      status: "completed",
      updatedAt: "2026-07-25T12:00:00.000Z",
    };
    expect(parseRevisitResourceV1(completed)).toEqual(completed);
  });

  it("rejects plaintext lifecycle inconsistencies and duplicate tags", () => {
    expect(() =>
      parseRevisitResourceV1({
        ...resource,
        completedAt: "2026-07-25T12:00:00.000Z",
        completionReflection: null,
        status: "completed",
      }),
    ).toThrow(RevisitContractError);
    expect(() =>
      parseRevisitMutationRequestV1({
        action: "complete",
        expectedRevision: 1,
        outcomeTags: ["not_yet", "not_yet"],
        reflection: "I am still deciding what to do.",
        schemaVersion: "reflection-revisit-mutation.v1",
      }),
    ).toThrow(RevisitContractError);
  });

  it("allows early completion and preserves completion on archive", () => {
    const completion = parseRevisitMutationRequestV1({
      action: "complete",
      expectedRevision: 1,
      outcomeTags: ["action_taken"],
      reflection: "I did the small action and noticed a practical change.",
      schemaVersion: "reflection-revisit-mutation.v1",
    });
    const completed = transitionRevisitStateV1(
      { completionPresent: false, deleted: false, revision: 1, status: "scheduled" },
      completion,
    );
    expect(completed).toEqual({
      completionPresent: true,
      deleted: false,
      revision: 2,
      status: "completed",
    });
    expect(
      transitionRevisitStateV1(completed, {
        action: "archive",
        expectedRevision: 2,
        schemaVersion: "reflection-revisit-mutation.v1",
      }),
    ).toEqual({
      completionPresent: true,
      deleted: false,
      revision: 3,
      status: "archived",
    });
  });

  it("rejects reschedule after completion and stale revisions", () => {
    const reschedule = parseRevisitMutationRequestV1({
      action: "reschedule",
      customDate: null,
      expectedRevision: 1,
      quietHours: null,
      reminderChannel: null,
      reminderPreference: "none",
      scheduleKind: "seven_days",
      schemaVersion: "reflection-revisit-mutation.v1",
      timeZone: "Asia/Shanghai",
    });
    expect(() =>
      transitionRevisitStateV1(
        { completionPresent: true, deleted: false, revision: 1, status: "completed" },
        reschedule,
      ),
    ).toThrow(RevisitContractError);
    expect(() =>
      transitionRevisitStateV1(
        { completionPresent: false, deleted: false, revision: 2, status: "scheduled" },
        reschedule,
      ),
    ).toThrow(RevisitContractError);
  });

  it("soft deletes scheduled, completed, or archived resources and then rejects mutations", () => {
    const deleted = transitionRevisitStateV1(
      { completionPresent: true, deleted: false, revision: 3, status: "archived" },
      {
        action: "delete",
        expectedRevision: 3,
        schemaVersion: "reflection-revisit-mutation.v1",
      },
    );
    expect(deleted).toEqual({
      completionPresent: true,
      deleted: true,
      revision: 4,
      status: "archived",
    });
    expect(() =>
      transitionRevisitStateV1(deleted, {
        action: "delete",
        expectedRevision: 4,
        schemaVersion: "reflection-revisit-mutation.v1",
      }),
    ).toThrow(RevisitContractError);
  });
});
