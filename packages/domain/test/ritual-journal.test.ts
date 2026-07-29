import { describe, expect, it } from "vitest";

import {
  canonicalizePrivateJournalCreateRequestV2,
  canonicalizePrivateJournalMutationRequestV1,
  canonicalizeRitualSessionMutationRequestV1,
  canonicalizeRitualSessionStartRequestV2,
  createRitualSessionSnapshotV1,
  parsePrivateJournalCreateRequestV2,
  parsePrivateJournalMutationRequestV1,
  parsePrivateJournalResourceV2,
  parseRitualSessionMutationRequestV1,
  parseRitualSessionResourceV2,
  parseRitualSessionSnapshotV1,
  parseRitualSessionStartRequestV2,
  privateJournalMaximumLength,
  RitualJournalContractError,
  ritualSessionMaximumElapsedSeconds,
  ritualSessionMutationActions,
  ritualSessionStatuses,
  transitionRitualSessionStateV1,
  type RitualCatalogItemV1,
} from "../src/index.js";

const intentionId = "22222222-2222-4222-8222-222222222222";
const ritualSessionId = "33333333-3333-4333-8333-333333333333";
const journalEntryId = "44444444-4444-4444-8444-444444444444";

const freeItem = Object.freeze({
  access: Object.freeze({ kind: "free", requirementCode: null }),
  catalogId: "rituvia-original-secular",
  accessibilityLabelKey: "ritual.item.free_candle.accessibility_label",
  code: "free_candle",
  experienceScope: "symbolic_reflection_only",
  externalOutcome: "not_guaranteed",
  kind: "free_object",
  labelKey: "ritual.item.free_candle.label",
  presentationEnhancements: Object.freeze(["art", "animation"]),
  publicationId: "rituvia-original.en.2026-07-23",
  schemaVersion: "ritual-catalog-item.v1",
  status: "active",
  template: Object.freeze({ code: "free-candle-pause", version: "1.0.0" }),
  version: "1.0.0",
}) satisfies RitualCatalogItemV1;

const startRequest = Object.freeze({
  intentionId,
  itemCode: "free_candle",
  schemaVersion: "ritual-session.v2",
});

const sessionResource = Object.freeze({
  abandonedAt: null,
  access: Object.freeze({ kind: "free", requirementCode: null }),
  catalogId: "rituvia-original-secular",
  catalogVersion: "1.0.0",
  completedAt: null,
  currentStepCode: "prepare",
  elapsedSeconds: 0,
  expiresAt: "2026-08-24T00:00:00.000Z",
  id: ritualSessionId,
  intentionId,
  itemCode: "free_candle",
  itemVersion: "1.0.0",
  pausedAt: null,
  policyVersion: "reflection-loop.en.v1",
  publicationId: "rituvia-original.en.2026-07-23",
  revision: 1,
  schemaVersion: "ritual-session.v2",
  startedAt: "2026-07-24T00:00:00.000Z",
  status: "active",
  templateCode: "free-candle-pause",
  templateVersion: "1.0.0",
});

describe("ritual session and private journal contracts", () => {
  it("creates an exact immutable server snapshot from the approved catalog item", () => {
    const snapshot = createRitualSessionSnapshotV1("rituvia-original-secular", "1.0.0", freeItem);

    expect(snapshot).toEqual({
      access: { kind: "free", requirementCode: null },
      catalogId: "rituvia-original-secular",
      catalogVersion: "1.0.0",
      itemCode: "free_candle",
      itemVersion: "1.0.0",
      publicationId: "rituvia-original.en.2026-07-23",
      schemaVersion: "ritual-session-snapshot.v1",
      templateCode: "free-candle-pause",
      templateVersion: "1.0.0",
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it.each([
    ["free_candle", { kind: "free", requirementCode: null }],
    [
      "mindful_incense",
      {
        kind: "permanent_entitlement",
        requirementCode: "permanent-object.mindful_incense",
      },
    ],
    ["guided_light", { kind: "consumable_pass", requirementCode: "ritual-pass.guided_light" }],
  ] as const)("requires access kind to match canonical item kind for %s", (itemCode, access) => {
    const templateCode =
      itemCode === "free_candle"
        ? "free-candle-pause"
        : itemCode === "mindful_incense"
          ? "permanent-object-pause"
          : "guided-light";
    expect(
      parseRitualSessionSnapshotV1({
        access,
        catalogId: "rituvia-original-secular",
        catalogVersion: "1.0.0",
        itemCode,
        itemVersion: "1.0.0",
        publicationId: "rituvia-original.en.2026-07-23",
        schemaVersion: "ritual-session-snapshot.v1",
        templateCode,
        templateVersion: "1.0.0",
      }).access.kind,
    ).toBe(access.kind);
  });

  it("accepts only client-owned start fields and canonicalizes them", () => {
    expect(parseRitualSessionStartRequestV2(startRequest)).toEqual(startRequest);
    expect(canonicalizeRitualSessionStartRequestV2(startRequest)).toBe(
      `{"intentionId":"${intentionId}","itemCode":"free_candle","schemaVersion":"ritual-session.v2"}`,
    );
    expect(() =>
      parseRitualSessionStartRequestV2({
        ...startRequest,
        access: { kind: "free", requirementCode: null },
      }),
    ).toThrowError(RitualJournalContractError);
  });

  it.each(ritualSessionMutationActions)("parses the %s lifecycle action", (action) => {
    const request = {
      action,
      currentStepCode: "breathe",
      elapsedSeconds: 30,
      expectedRevision: 1,
      schemaVersion: "ritual-session-mutation.v1",
    };
    expect(parseRitualSessionMutationRequestV1(request).action).toBe(action);
    expect(canonicalizeRitualSessionMutationRequestV1(request)).toContain(`"action":"${action}"`);
  });

  it("enforces the explicit lifecycle transition table and monotonic progress", () => {
    const paused = transitionRitualSessionStateV1(
      {
        currentStepCode: "prepare",
        elapsedSeconds: 0,
        revision: 1,
        status: "active",
      },
      {
        action: "pause",
        currentStepCode: "breathe",
        elapsedSeconds: 30,
        expectedRevision: 1,
        schemaVersion: "ritual-session-mutation.v1",
      },
    );
    expect(paused).toEqual({
      currentStepCode: "breathe",
      elapsedSeconds: 30,
      revision: 2,
      status: "paused",
    });
    expect(() =>
      transitionRitualSessionStateV1(paused, {
        action: "complete",
        currentStepCode: "breathe",
        elapsedSeconds: 20,
        expectedRevision: 2,
        schemaVersion: "ritual-session-mutation.v1",
      }),
    ).toThrowError(RitualJournalContractError);
  });

  it("rejects invalid elapsed time, revisions, and unknown lifecycle fields", () => {
    expect(() =>
      parseRitualSessionMutationRequestV1({
        action: "complete",
        currentStepCode: "complete",
        elapsedSeconds: ritualSessionMaximumElapsedSeconds + 1,
        expectedRevision: 1,
        schemaVersion: "ritual-session-mutation.v1",
      }),
    ).toThrowError(RitualJournalContractError);
    expect(() =>
      parseRitualSessionMutationRequestV1({
        action: "complete",
        currentStepCode: "complete",
        elapsedSeconds: 10,
        expectedRevision: 0,
        schemaVersion: "ritual-session-mutation.v1",
      }),
    ).toThrowError(RitualJournalContractError);
  });

  it.each(ritualSessionStatuses)("parses a timestamp-consistent %s resource", (status) => {
    const timestampFields =
      status === "active"
        ? {}
        : status === "paused"
          ? { pausedAt: "2026-07-24T00:01:00.000Z" }
          : status === "completed"
            ? { completedAt: "2026-07-24T00:02:00.000Z" }
            : { abandonedAt: "2026-07-24T00:02:00.000Z" };
    expect(
      parseRitualSessionResourceV2({ ...sessionResource, ...timestampFields, status }).status,
    ).toBe(status);
  });

  it("rejects impossible ritual timestamp combinations", () => {
    expect(() =>
      parseRitualSessionResourceV2({
        ...sessionResource,
        completedAt: "2026-07-24T00:02:00.000Z",
        pausedAt: "2026-07-24T00:01:00.000Z",
        status: "completed",
      }),
    ).toThrowError(expect.objectContaining({ code: "RITUAL_JOURNAL_OUTPUT_INVALID" }));
  });

  it("normalizes and canonicalizes private journal creation without leaking text in errors", () => {
    const request = {
      intentionId,
      reflection: "  I paused before answering.  ",
      ritualSessionId,
      schemaVersion: "private-journal.v2",
    };
    const parsed = parsePrivateJournalCreateRequestV2(request);
    expect(parsed.reflection).toBe("I paused before answering.");
    expect(canonicalizePrivateJournalCreateRequestV2(request)).toContain(
      '"reflection":"I paused before answering."',
    );
    const privateCanary = "private-journal-contract-canary";
    try {
      parsePrivateJournalCreateRequestV2({ ...request, privateCanary });
    } catch (error) {
      expect(String(error)).not.toContain(privateCanary);
    }
  });

  it("preserves NFC CJK and Devanagari shaping controls in private journal text", () => {
    const reflection = "𠮷という字と क्‍षमा を静かに書き留めた。";
    expect(
      parsePrivateJournalCreateRequestV2({
        intentionId,
        reflection,
        ritualSessionId,
        schemaVersion: "private-journal.v2",
      }).reflection,
    ).toBe(reflection);
  });

  it("parses optimistic update and delete journal mutations", () => {
    const update = parsePrivateJournalMutationRequestV1({
      action: "update",
      expectedRevision: 1,
      reflection: "  A revised private note.  ",
      schemaVersion: "private-journal-mutation.v1",
    });
    const remove = parsePrivateJournalMutationRequestV1({
      action: "delete",
      expectedRevision: 2,
      schemaVersion: "private-journal-mutation.v1",
    });
    expect(update).toMatchObject({ action: "update", reflection: "A revised private note." });
    expect(remove).toEqual({
      action: "delete",
      expectedRevision: 2,
      schemaVersion: "private-journal-mutation.v1",
    });
    expect(canonicalizePrivateJournalMutationRequestV1(update)).toContain('"action":"update"');
    expect(canonicalizePrivateJournalMutationRequestV1(remove)).toContain('"action":"delete"');
  });

  it("rejects oversized private journal content", () => {
    expect(() =>
      parsePrivateJournalCreateRequestV2({
        intentionId,
        reflection: "x".repeat(privateJournalMaximumLength + 1),
        ritualSessionId,
        schemaVersion: "private-journal.v2",
      }),
    ).toThrowError(RitualJournalContractError);
  });

  it("parses a private resource without owner, ciphertext, or mutation digests", () => {
    const resource = parsePrivateJournalResourceV2({
      createdAt: "2026-07-24T00:03:00.000Z",
      expiresAt: "2026-08-24T00:00:00.000Z",
      id: journalEntryId,
      intentionId,
      reflection: "A private note.",
      revision: 1,
      ritualSessionId,
      schemaVersion: "private-journal.v2",
      updatedAt: "2026-07-24T00:03:00.000Z",
    });
    expect(Object.keys(resource)).not.toContain("anonymousSubjectId");
    expect(Object.keys(resource)).not.toContain("ciphertext");
    expect(Object.keys(resource)).not.toContain("idempotencyKeyHash");
    expect(Object.isFrozen(resource)).toBe(true);
  });
});
