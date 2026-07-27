import {
  parseReflectionIntentionCreateRequestV2,
  parseReflectionIntentionCreateRequestV1,
  parseReflectionIntentionMutationRequestV1,
  parseReflectionJournalCreateRequestV1,
  parseReflectionRitualCreateRequestV1,
} from "@rituvia/domain";
import {
  ReflectionPersistenceError,
  type PersistedReflectionIntention,
  type PersistedReflectionIntentionV2,
  type PersistedReflectionJournal,
  type PersistedReflectionRitual,
  type ReflectionPersistence,
} from "@rituvia/db";
import { describe, expect, it, vi } from "vitest";

import { createPrivateContentCryptography } from "../server/private-content-crypto";
import {
  createReflectionLoopApplicationService,
  ReflectionLoopApplicationError,
} from "../server/reflection-loop";

const subjectId = "11111111-1111-4111-8111-111111111111";
const readingId = "22222222-2222-4222-8222-222222222222";
const intentionId = "33333333-3333-4333-8333-333333333333";
const ritualSessionId = "44444444-4444-4444-8444-444444444444";
const journalEntryId = "55555555-5555-4555-8555-555555555555";
const sessionToken = "A".repeat(43);
const idempotencyKey = "test-idempotency-key-0001";
const createdAt = "2026-07-18T12:00:00.000Z";
const completedAt = "2026-07-18T12:05:00.000Z";
const revisitAt = "2026-07-19T12:10:00.000Z";
const expiresAt = "2026-08-18T12:00:00.000Z";

const createCryptography = () =>
  createPrivateContentCryptography(
    {
      activeKeyVersion: "private-content.v1",
      digestKeyVersion: "private-content.v1",
      keys: [{ key: new Uint8Array(32).fill(17), version: "private-content.v1" }],
    },
    () => new Uint8Array(12).fill(23),
  );

const fixture = () => {
  const authorizeRitualObject = vi.fn().mockResolvedValue(false);
  const intentionRequest = parseReflectionIntentionCreateRequestV1({
    intentionCode: "courage_action",
    locale: "en",
    readingId,
    schemaVersion: "reflection-intention.v1",
    smallAction: "Make the first small call.",
  });
  const ritualRequest = parseReflectionRitualCreateRequestV1({
    intentionId,
    objectCode: "candle",
    schemaVersion: "reflection-ritual.v1",
  });
  const journalRequest = parseReflectionJournalCreateRequestV1({
    intentionId,
    reflection: "I made the call and noticed that starting was enough.",
    ritualSessionId,
    schemaVersion: "reflection-journal.v1",
  });
  let intention: PersistedReflectionIntention | undefined;
  let journal: PersistedReflectionJournal | undefined;
  const ritual: PersistedReflectionRitual = Object.freeze({
    completedAt,
    expiresAt,
    id: ritualSessionId,
    intentionId,
    objectCode: ritualRequest.objectCode,
    policyVersion: "reflection-loop.en.v1",
    ritualDateUtc: "2026-07-18",
    schemaVersion: "reflection-ritual.v1",
    subjectId,
  });
  const persistence: ReflectionPersistence = Object.freeze({
    async getIntention({ id }) {
      return id === intentionId ? (intention ?? null) : null;
    },
    async getIntentionV2() {
      return null;
    },
    async getJournal({ id }) {
      return id === journalEntryId ? (journal ?? null) : null;
    },
    async getRitual({ id }) {
      return id === ritualSessionId ? ritual : null;
    },
    async resolveIntention({ prepare, request }) {
      const parsed = parseReflectionIntentionCreateRequestV1(request);
      const prepared = await prepare({ request: parsed, subjectId });
      intention = Object.freeze({
        createdAt,
        encryptedSmallAction: prepared.encrypted,
        expiresAt,
        id: intentionId,
        intentionCode: parsed.intentionCode,
        locale: parsed.locale,
        policyVersion: "reflection-loop.en.v1",
        readingId: parsed.readingId,
        schemaVersion: parsed.schemaVersion,
        subjectId,
      });
      return Object.freeze({ intention, kind: "created" as const });
    },
    async resolveIntentionV2() {
      throw new Error("unused v2 intention create");
    },
    async mutateIntentionV2() {
      throw new Error("unused v2 intention mutation");
    },
    async resolveJournal({ prepare, request }) {
      const parsed = parseReflectionJournalCreateRequestV1(request);
      const prepared = await prepare({ request: parsed, subjectId });
      journal = Object.freeze({
        createdAt,
        encryptedReflection: prepared.encrypted,
        expiresAt,
        id: journalEntryId,
        intentionId: parsed.intentionId,
        policyVersion: "reflection-loop.en.v1",
        revisitAt,
        ritualSessionId: parsed.ritualSessionId,
        schemaVersion: parsed.schemaVersion,
        subjectId,
      });
      return Object.freeze({ journal, kind: "created" as const });
    },
    async resolveRitual({ prepare, request }) {
      const parsed = parseReflectionRitualCreateRequestV1(request);
      await prepare({ request: parsed, subjectId });
      return Object.freeze({
        kind: "created" as const,
        ritual: Object.freeze({ ...ritual, objectCode: parsed.objectCode }),
      });
    },
  });
  return {
    authorizeRitualObject,
    intentionRequest,
    journalRequest,
    persistence,
    ritualRequest,
    storedIntention: () => intention,
    storedJournal: () => journal,
  };
};

describe("reflection-loop application service", () => {
  it("completes the anonymous reading-to-revisit loop without returning owner identifiers", async () => {
    const fake = fixture();
    const capture = vi.fn(async () => true);
    const service = createReflectionLoopApplicationService({
      analytics: { capture },
      authorizeRitualObject: fake.authorizeRitualObject,
      cryptography: createCryptography(),
      persistence: fake.persistence,
    });

    const intention = await service.createIntention(
      fake.intentionRequest,
      idempotencyKey,
      sessionToken,
    );
    const ritual = await service.createRitual(
      fake.ritualRequest,
      `${idempotencyKey}-ritual`,
      sessionToken,
    );
    const journal = await service.createJournal(
      fake.journalRequest,
      `${idempotencyKey}-journal`,
      sessionToken,
    );

    expect(intention.resource.smallAction).toBe(fake.intentionRequest.smallAction);
    expect(ritual.resource).toMatchObject({ objectCode: "candle", ritualDateUtc: "2026-07-18" });
    expect(journal.resource).toMatchObject({
      reflection: fake.journalRequest.reflection,
      revisitAt,
    });
    expect(Object.keys(intention.resource)).not.toContain("subjectId");
    expect(Object.keys(journal.resource)).not.toContain("anonymousSubjectId");
    expect(fake.authorizeRitualObject).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "intention_created",
        properties: { intentionCode: fake.intentionRequest.intentionCode },
        reflectionRoot: { kind: "reading", readingId },
      }),
    );
    expect(JSON.stringify(capture.mock.calls)).not.toContain(fake.intentionRequest.smallAction);
    expect(JSON.stringify(capture.mock.calls)).not.toContain(fake.journalRequest.reflection);

    const encryptedAction = fake.storedIntention()?.encryptedSmallAction;
    const encryptedJournal = fake.storedJournal()?.encryptedReflection;
    expect(Buffer.from(encryptedAction?.ciphertext ?? []).toString("utf8")).not.toContain(
      fake.intentionRequest.smallAction,
    );
    expect(Buffer.from(encryptedJournal?.ciphertext ?? []).toString("utf8")).not.toContain(
      fake.journalRequest.reflection,
    );

    await expect(service.getIntention(intentionId, sessionToken)).resolves.toEqual(
      intention.resource,
    );
    await expect(service.getJournal(journalEntryId, sessionToken)).resolves.toEqual(
      journal.resource,
    );
  });

  it("encrypts, edits, and soft deletes a private v2 intention with resource binding", async () => {
    const base = fixture();
    let stored: PersistedReflectionIntentionV2 | undefined;
    const persistence: ReflectionPersistence = Object.freeze({
      ...base.persistence,
      async getIntentionV2({ id }) {
        return id === intentionId && stored?.deletedAt === null ? stored : null;
      },
      async resolveIntentionV2({ prepare, request }) {
        const parsed = parseReflectionIntentionCreateRequestV2(request);
        const prepared = await prepare({ request: parsed, resourceId: intentionId, subjectId });
        stored = Object.freeze({
          archivedAt: null,
          completedAt: null,
          createdAt,
          deletedAt: null,
          encryptedIntentionText: prepared.encryptedIntentionText,
          encryptedSmallAction: prepared.encryptedSmallAction,
          expiresAt,
          id: intentionId,
          intentionCode: parsed.intentionCode,
          locale: "en",
          policyVersion: "reflection-loop.en.v1",
          privacyState: "private",
          readingId: parsed.readingId,
          reminderPreference: "none",
          revisitDate: parsed.revisitDate,
          revision: 1,
          schemaVersion: "reflection-intention.v2",
          status: "active",
          subjectId,
          timeZone: parsed.timeZone,
          updatedAt: createdAt,
        });
        return Object.freeze({ intention: stored, kind: "created" as const });
      },
      async mutateIntentionV2({ prepare, request }) {
        if (stored === undefined) throw new Error("missing v2 intention");
        const parsed = parseReflectionIntentionMutationRequestV1(request);
        const prepared = await prepare({ request: parsed, resourceId: intentionId, subjectId });
        stored =
          parsed.action === "delete"
            ? Object.freeze({
                ...stored,
                deletedAt: completedAt,
                revision: stored.revision + 1,
                updatedAt: completedAt,
              })
            : parsed.action === "edit" && "encryptedIntentionText" in prepared
              ? Object.freeze({
                  ...stored,
                  encryptedIntentionText: prepared.encryptedIntentionText,
                  encryptedSmallAction: prepared.encryptedSmallAction,
                  intentionCode: parsed.intentionCode,
                  revisitDate: parsed.revisitDate,
                  revision: stored.revision + 1,
                  timeZone: parsed.timeZone,
                  updatedAt: completedAt,
                })
              : stored;
        return Object.freeze({
          intention: parsed.action === "delete" ? null : stored,
          kind: "mutated" as const,
        });
      },
    });
    const service = createReflectionLoopApplicationService({
      authorizeRitualObject: base.authorizeRitualObject,
      cryptography: createCryptography(),
      persistence,
    });
    const created = await service.createIntention(
      {
        intentionCode: "calm_clarity",
        intentionText: "I intend to pause before I respond.",
        locale: "en",
        privacyState: "private",
        readingId,
        reminderPreference: "none",
        revisitDate: "2026-08-01",
        schemaVersion: "reflection-intention.v2",
        smallAction: "Take three slow breaths.",
        timeZone: "Asia/Shanghai",
      },
      idempotencyKey,
      sessionToken,
    );

    expect(created.resource).toMatchObject({
      intentionText: "I intend to pause before I respond.",
      revision: 1,
      status: "active",
    });
    expect(
      Buffer.from(stored?.encryptedIntentionText.ciphertext ?? []).toString("utf8"),
    ).not.toContain("pause before");
    expect(
      Buffer.from(stored?.encryptedSmallAction.ciphertext ?? []).toString("utf8"),
    ).not.toContain("slow breaths");

    const edited = await service.mutateIntention(
      intentionId,
      {
        action: "edit",
        expectedRevision: 1,
        intentionCode: "courage_action",
        intentionText: "I intend to make the call I can make.",
        privacyState: "private",
        reminderPreference: "none",
        revisitDate: null,
        schemaVersion: "reflection-intention-mutation.v1",
        smallAction: "Write the first sentence.",
        timeZone: null,
      },
      `${idempotencyKey}-edit`,
      sessionToken,
    );
    expect(edited.resource).toMatchObject({
      intentionText: "I intend to make the call I can make.",
      revision: 2,
      smallAction: "Write the first sentence.",
    });

    await expect(
      service.mutateIntention(
        intentionId,
        {
          action: "delete",
          expectedRevision: 2,
          schemaVersion: "reflection-intention-mutation.v1",
        },
        `${idempotencyKey}-delete`,
        sessionToken,
      ),
    ).resolves.toEqual({ kind: "mutated", resource: null });
    await expect(service.getIntention(intentionId, sessionToken)).resolves.toBeNull();
  });

  it("requires an active linked-account entitlement for paid ritual objects", async () => {
    const fake = fixture();
    const service = createReflectionLoopApplicationService({
      authorizeRitualObject: fake.authorizeRitualObject,
      cryptography: createCryptography(),
      persistence: fake.persistence,
    });
    const paidRequest = { ...fake.ritualRequest, objectCode: "mindful_incense" };

    await expect(
      service.createRitual(paidRequest, idempotencyKey, sessionToken),
    ).rejects.toMatchObject({ code: "entitlement_required" });
    expect(fake.authorizeRitualObject).not.toHaveBeenCalled();

    await expect(
      service.createRitual(paidRequest, idempotencyKey, sessionToken, "account-session"),
    ).rejects.toMatchObject({ code: "entitlement_required" });
    expect(fake.authorizeRitualObject).toHaveBeenCalledWith({
      accountSessionToken: "account-session",
      anonymousSessionToken: sessionToken,
      objectCode: "mindful_incense",
    });

    fake.authorizeRitualObject.mockResolvedValueOnce(true);
    await expect(
      service.createRitual(paidRequest, idempotencyKey, undefined, "account-session"),
    ).resolves.toMatchObject({ resource: { objectCode: "mindful_incense" } });
  });

  it("maps persistence failures to bounded application errors", async () => {
    const fake = fixture();
    const persistence: ReflectionPersistence = Object.freeze({
      ...fake.persistence,
      async resolveRitual() {
        throw new ReflectionPersistenceError("REFLECTION_RITUAL_DAILY_LIMIT", 3_600);
      },
    });
    const service = createReflectionLoopApplicationService({
      authorizeRitualObject: fake.authorizeRitualObject,
      cryptography: createCryptography(),
      persistence,
    });

    await expect(
      service.createRitual(fake.ritualRequest, idempotencyKey, sessionToken),
    ).rejects.toEqual(expect.objectContaining({ code: "daily_limit", retryAfterSeconds: 3_600 }));
  });

  it("fails closed when stored private ciphertext cannot be authenticated", async () => {
    const fake = fixture();
    const service = createReflectionLoopApplicationService({
      authorizeRitualObject: fake.authorizeRitualObject,
      cryptography: createCryptography(),
      persistence: fake.persistence,
    });
    await service.createJournal(fake.journalRequest, idempotencyKey, sessionToken);
    const stored = fake.storedJournal();
    if (stored === undefined) throw new Error("journal fixture missing");
    const persistence: ReflectionPersistence = Object.freeze({
      ...fake.persistence,
      async getJournal() {
        return Object.freeze({
          ...stored,
          encryptedReflection: Object.freeze({
            ...stored.encryptedReflection,
            tag: new Uint8Array(16),
          }),
        });
      },
    });
    const readingService = createReflectionLoopApplicationService({
      authorizeRitualObject: fake.authorizeRitualObject,
      cryptography: createCryptography(),
      persistence,
    });

    await expect(readingService.getJournal(journalEntryId, sessionToken)).rejects.toBeInstanceOf(
      ReflectionLoopApplicationError,
    );
    await expect(readingService.getJournal(journalEntryId, sessionToken)).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
