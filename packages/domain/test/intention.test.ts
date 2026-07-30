import {
  canonicalizeReflectionIntentionCreateRequestV2,
  canonicalizeReflectionIntentionMutationRequestV1,
  evaluateReflectionIntentionAgencyV1,
  parseReflectionIntentionCreateRequestV2,
  parseReflectionIntentionMutationRequestV1,
  parseReflectionIntentionResourceV2,
  ReflectionError,
  reflectionIntentionMutationSchemaVersion,
  reflectionIntentionTextMaximumLength,
  reflectionIntentionV2SchemaVersion,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const readingId = "11111111-1111-4111-8111-111111111111";
const intentionId = "22222222-2222-4222-8222-222222222222";

const createRequest = Object.freeze({
  intentionCode: "calm_clarity",
  intentionText: "  I intend to pause before I respond.  ",
  locale: "en",
  privacyState: "private",
  readingId,
  reminderPreference: "none",
  revisitDate: "2026-08-01",
  schemaVersion: reflectionIntentionV2SchemaVersion,
  smallAction: "  Take three slow breaths.  ",
  timeZone: "Asia/Shanghai",
});

describe("reflection intention v2", () => {
  it("normalizes and freezes an exact private create contract", () => {
    const parsed = parseReflectionIntentionCreateRequestV2(createRequest);

    expect(parsed).toEqual({
      ...createRequest,
      intentionText: "I intend to pause before I respond.",
      smallAction: "Take three slow breaths.",
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(canonicalizeReflectionIntentionCreateRequestV2(parsed)).toBe(
      `{"intentionCode":"calm_clarity","intentionText":"I intend to pause before I respond.","locale":"en","privacyState":"private","readingId":"${readingId}","reminderPreference":"none","revisitDate":"2026-08-01","schemaVersion":"reflection-intention.v2","smallAction":"Take three slow breaths.","timeZone":"Asia/Shanghai"}`,
    );
  });

  it("accepts standalone intentions without a revisit schedule", () => {
    expect(
      parseReflectionIntentionCreateRequestV2({
        ...createRequest,
        readingId: null,
        revisitDate: null,
        timeZone: null,
      }),
    ).toMatchObject({ readingId: null, revisitDate: null, timeZone: null });
  });

  it("preserves Indic shaping controls while applying compatibility folding only to safety review", () => {
    const intentionText = "मैं क्‍षमा के साथ उत्तर देने का इरादा रखता हूँ।";
    expect(
      parseReflectionIntentionCreateRequestV2({ ...createRequest, intentionText }).intentionText,
    ).toBe(intentionText);
    expect(evaluateReflectionIntentionAgencyV1("ｍａｋｅ her contact me", "calm_clarity")).toEqual({
      kind: "reframe_required",
      suggestedIntentionText: "I intend to respond with calm and clarity.",
    });
  });

  it.each([
    "I intend to force my ex to return.",
    "Make them contact me tomorrow.",
    "I will get her to forgive me.",
    "Bring my ex back.",
    "I intend to control my partner.",
  ])("requires a non-echoing self-owned reframe for coercive text: %s", (intentionText) => {
    const result = evaluateReflectionIntentionAgencyV1(intentionText, "connection_understanding");

    expect(result).toEqual({
      kind: "reframe_required",
      suggestedIntentionText: "I intend to communicate honestly while respecting their choice.",
    });
    expect(JSON.stringify(result)).not.toContain(intentionText);
    expect(() =>
      parseReflectionIntentionCreateRequestV2({ ...createRequest, intentionText }),
    ).toThrow(ReflectionError);
  });

  it.each([
    { revisitDate: "2026-08-01", timeZone: null },
    { revisitDate: null, timeZone: "UTC" },
    { revisitDate: "2026-02-30", timeZone: "UTC" },
    { revisitDate: "2026-08-01", timeZone: "Not/A_Zone" },
  ])("rejects an invalid schedule pairing", (schedule) => {
    expect(() =>
      parseReflectionIntentionCreateRequestV2({ ...createRequest, ...schedule }),
    ).toThrow(ReflectionError);
  });

  it.each([
    { extra: true },
    { intentionText: "I intend to…" },
    { privacyState: "public" },
    { reminderPreference: "email" },
    { intentionText: "x".repeat(reflectionIntentionTextMaximumLength + 1) },
    { intentionText: "\u202esecret" },
    { schemaVersion: "reflection-intention.v1" },
  ])("rejects unsafe or non-exact create input", (change) => {
    expect(() => parseReflectionIntentionCreateRequestV2({ ...createRequest, ...change })).toThrow(
      ReflectionError,
    );
  });

  it("parses exact edit and lifecycle mutations", () => {
    const edit = parseReflectionIntentionMutationRequestV1({
      action: "edit",
      expectedRevision: 3,
      intentionCode: "courage_action",
      intentionText: "I intend to make the call I can make.",
      privacyState: "private",
      reminderPreference: "none",
      revisitDate: null,
      schemaVersion: reflectionIntentionMutationSchemaVersion,
      smallAction: "Write the first sentence.",
      timeZone: null,
    });
    const archive = parseReflectionIntentionMutationRequestV1({
      action: "archive",
      expectedRevision: 4,
      schemaVersion: reflectionIntentionMutationSchemaVersion,
    });

    expect(edit).toMatchObject({ action: "edit", expectedRevision: 3 });
    expect(archive).toEqual({
      action: "archive",
      expectedRevision: 4,
      schemaVersion: reflectionIntentionMutationSchemaVersion,
    });
    expect(canonicalizeReflectionIntentionMutationRequestV1(archive)).toBe(
      '{"action":"archive","expectedRevision":4,"schemaVersion":"reflection-intention-mutation.v1"}',
    );
  });

  it.each([
    {
      action: "restore",
      expectedRevision: 1,
      schemaVersion: reflectionIntentionMutationSchemaVersion,
    },
    {
      action: "delete",
      expectedRevision: 0,
      schemaVersion: reflectionIntentionMutationSchemaVersion,
    },
    {
      action: "complete",
      expectedRevision: 1,
      schemaVersion: reflectionIntentionMutationSchemaVersion,
      unexpected: true,
    },
  ])("rejects invalid lifecycle mutations", (mutation) => {
    expect(() => parseReflectionIntentionMutationRequestV1(mutation)).toThrow(ReflectionError);
  });

  it("parses a private v2 resource without ownership or encryption metadata", () => {
    const resource = parseReflectionIntentionResourceV2({
      createdAt: "2026-07-24T10:00:00.000Z",
      expiresAt: "2026-08-24T10:00:00.000Z",
      id: intentionId,
      intentionCode: "calm_clarity",
      intentionText: "I intend to pause before I respond.",
      locale: "en",
      policyVersion: "reflection-loop.en.v1",
      privacyState: "private",
      readingId,
      reminderPreference: "none",
      revisitDate: "2026-08-01",
      revision: 2,
      schemaVersion: reflectionIntentionV2SchemaVersion,
      smallAction: "Take three slow breaths.",
      status: "active",
      timeZone: "Asia/Shanghai",
      updatedAt: "2026-07-24T11:00:00.000Z",
    });

    expect(resource.revision).toBe(2);
    expect(Object.keys(resource)).not.toContain("subjectId");
    expect(Object.keys(resource)).not.toContain("encryptedIntentionText");
  });
});
