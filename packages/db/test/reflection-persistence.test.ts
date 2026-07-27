import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/anonymous-identity.js", () => ({
  assertAnonymousIdentityRuntimeDatabasePrivileges: vi.fn(async () => undefined),
}));

import { createReflectionPersistence } from "../src/reflection-persistence.js";

const subjectId = "11111111-1111-4111-8111-111111111111";
const intentionId = "22222222-2222-4222-8222-222222222222";
const digest = (byte: string) => `sha256:${byte.repeat(64)}`;
const digestBytes = (byte: number) => new Uint8Array(32).fill(byte);

describe("reflection persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("round-trips and idempotently replays a subject-owned standalone intention", async () => {
    const observedAt = new Date("2026-07-18T12:00:00.000Z");
    const expiresAt = new Date("2026-07-25T12:00:00.000Z");
    const row = {
      canonicalRequestHash: digestBytes(0x11),
      contractVersion: "reflection-intention.v1",
      createdAt: observedAt,
      deletedAt: null,
      encryptionKeyVersion: "test.reflection.v1",
      expiresAt,
      id: intentionId,
      idempotencyKeyHash: digestBytes(0x22),
      intentionCode: "calm_clarity",
      locale: "en",
      policyVersion: "reflection-loop.en.v1",
      readingId: null,
      schemaVersion: "reflection-intention.v1",
      smallActionCiphertext: new Uint8Array([7]),
      smallActionNonce: new Uint8Array(12).fill(8),
      smallActionTag: new Uint8Array(16).fill(9),
      status: "active",
      subjectId,
    };
    let transactionNumber = 0;
    const transactionCalls: unknown[][] = [];
    const transaction = {
      $queryRaw: vi.fn(async (...args: unknown[]) => {
        transactionCalls.push(args);
        const call = transactionCalls.length;
        if (transactionNumber === 1) {
          return call === 1
            ? [{ expiresAt, observedAt, subjectId }]
            : call === 2
              ? []
              : call === 3
                ? [{ id: intentionId }]
                : [row];
        }
        return call === 5 ? [{ expiresAt, observedAt, subjectId }] : [row];
      }),
    };
    const database = {
      $queryRaw: vi.fn(async () => [
        {
          canInsertIntention: true,
          canInsertJournal: true,
          canInsertRitual: true,
          canReadAccountSession: true,
          canReadAccountSubjectLink: true,
          canReadAppUser: true,
          canReadIntention: true,
          canReadJournal: true,
          canReadRitual: true,
          canUpdateIntention: true,
          canDeleteIntention: false,
          canUseSchema: true,
        },
      ]),
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) => {
        transactionNumber += 1;
        return callback(transaction);
      }),
    };
    const persistence = createReflectionPersistence(database as never, {
      policyVersion: "reflection-loop.en.v1",
      retentionSeconds: 604_800,
      revisitDelaySeconds: 86_400,
    });
    const prepare = vi.fn(() => ({
      canonicalRequestDigest: digest("1"),
      encrypted: {
        ciphertext: new Uint8Array([7]),
        keyVersion: "test.reflection.v1",
        nonce: new Uint8Array(12).fill(8),
        tag: new Uint8Array(16).fill(9),
      },
      idempotencyKeyDigest: digest("2"),
      idempotencyKeyVersion: "test.reflection.v1",
    }));
    const input = {
      prepare,
      principal: { anonymousSessionToken: Buffer.alloc(32, 3).toString("base64url") },
      request: {
        intentionCode: "calm_clarity",
        locale: "en",
        readingId: null,
        schemaVersion: "reflection-intention.v1",
        smallAction: "Take one quiet breath.",
      },
    } as const;

    const created = await persistence.resolveIntention(input);
    const replayed = await persistence.resolveIntention(input);

    expect(created).toMatchObject({ kind: "created", intention: { readingId: null, subjectId } });
    expect(replayed).toMatchObject({ kind: "replayed", intention: { readingId: null, subjectId } });
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ subjectId }));
    expect(transactionCalls[2]).toEqual(expect.arrayContaining([subjectId, null]));
    expect(transactionCalls).toHaveLength(6);
  });
});
