import type { PrismaClient } from "../src/generated/prisma/client.js";
import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

import {
  AccountIdentityError,
  createAccountIdentityService,
  type AccountIdentityPolicy,
} from "../src/account-identity.js";

const policy = (): AccountIdentityPolicy => ({
  challengeTtlSeconds: 600,
  emailEncryptionKey: Uint8Array.from({ length: 32 }, (_, index) => index + 1),
  encryptionKeyVersion: "test.account-email.v1",
  providerSubjectHmacKey: Uint8Array.from({ length: 32 }, (_, index) => 101 + index),
  sessionTtlSeconds: 3_600,
  startGlobalLimit: 100,
  startIdentifierLimit: 5,
  startWindowSeconds: 600,
});

const sqlText = (strings: TemplateStringsArray): string => strings.join("?");
const bearer = (byte: number): string => Buffer.alloc(32, byte).toString("base64url");

describe("account identity persistence", () => {
  it("encrypts email and hashes bearer material before challenge persistence", async () => {
    const calls: Array<Readonly<{ sql: string; values: readonly unknown[] }>> = [];
    const transaction = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        calls.push({ sql: sqlText(strings), values });
        return 1;
      }),
      $queryRaw: vi.fn(async () => [{ requestCount: 1, retryAfterSeconds: 600 }]),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());
    const token = bearer(1);
    const state = bearer(2);
    await service.createChallenge({
      challengeId: "44444444-4444-4444-8444-444444444444",
      email: "demo@example.test",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      providerKey: "local.passwordless.v1",
      returnTo: "/en/account",
      state,
      token,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("INSERT INTO auth_challenge");
    expect(calls[0]?.sql).not.toContain("account_challenge");
    expect(calls[0]?.sql).toContain("email_ciphertext");
    expect(calls[0]?.sql).toContain("token_hash");
    expect(calls[0]?.sql).toContain("state_hash");
    expect(calls[0]?.values).not.toContain("demo@example.test");
    expect(calls[0]?.values).not.toContain(token);
    expect(calls[0]?.values).not.toContain(state);
    const byteValues = calls[0]?.values.filter((value) => value instanceof Uint8Array) ?? [];
    expect(byteValues.map((value) => value.byteLength)).toEqual(
      expect.arrayContaining([12, 16, 32, 32]),
    );
  });

  it("derives provider subjects with the configured HMAC key", async () => {
    const subjects: string[] = [];
    const transaction = {
      $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        const subject = values.find(
          (value): value is string =>
            typeof value === "string" && /^local\.[0-9a-f]{64}$/u.test(value),
        );
        if (subject !== undefined) subjects.push(subject);
        return 1;
      }),
      $queryRaw: vi.fn(async () => [{ requestCount: 1, retryAfterSeconds: 600 }]),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const create = async (keyByte: number, challengeId: string) => {
      const service = createAccountIdentityService(database, {
        ...policy(),
        providerSubjectHmacKey: new Uint8Array(32).fill(keyByte),
      });
      await service.createChallenge({
        challengeId,
        email: "demo@example.test",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state: bearer(2),
        token: bearer(1),
      });
    };

    await create(7, "44444444-4444-4444-8444-444444444444");
    await create(8, "55555555-5555-4555-8555-555555555555");

    expect(subjects).toHaveLength(2);
    expect(subjects[0]).toMatch(/^local\.[0-9a-f]{64}$/u);
    expect(subjects[0]).not.toBe(subjects[1]);
  });

  it("rotates only a still-live previous session", async () => {
    let challengeValues: readonly unknown[] = [];
    const executeStatements: string[] = [];
    const transaction = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = sqlText(strings);
        if (sql.includes("INSERT INTO auth_challenge")) {
          challengeValues = values;
        } else {
          executeStatements.push(sql);
        }
        return 1;
      }),
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = sqlText(strings);
        if (sql.includes("INSERT INTO auth_start_rate_limit")) {
          return [{ requestCount: 1, retryAfterSeconds: 600 }];
        }
        if (sql.includes("UPDATE auth_challenge")) {
          return [
            {
              consumedAt: new Date(),
              emailCiphertext: challengeValues[3],
              emailNonce: challengeValues[4],
              emailTag: challengeValues[5],
              encryptionKeyVersion: challengeValues[6],
              expiresAt: new Date(Date.now() + 300_000),
              providerKey: challengeValues[1],
              providerSubject: challengeValues[2],
              previousSessionHash: challengeValues[9],
              returnTo: "/en/account",
            },
          ];
        }
        if (sql.includes("FROM auth_identity_suppression")) {
          return [];
        }
        if (sql.includes("FROM auth_identity AS identity")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              status: "active",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        if (sql.includes("INSERT INTO account_session")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              expiresAt: new Date(Date.now() + 3_600_000),
              providerKey: "local.passwordless.v1",
              sessionId: "33333333-3333-4333-8333-333333333333",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        throw new TypeError(`Unexpected SQL: ${sql}`);
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());
    const challengeId = "44444444-4444-4444-8444-444444444444";
    const state = bearer(2);
    const token = bearer(1);
    await service.createChallenge({
      challengeId,
      email: "demo@example.test",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      previousSessionToken: bearer(3),
      providerKey: "local.passwordless.v1",
      returnTo: "/en/account",
      state,
      token,
    });

    await service.consumeChallenge({
      challengeId,
      sessionToken: bearer(4),
      state,
      token,
    });

    const rotation = executeStatements.find((statement) =>
      statement.includes("UPDATE account_session"),
    );
    expect(rotation).toContain("AND expires_at >= CURRENT_TIMESTAMP");
  });

  it("applies global and keyed-identifier limits before challenge persistence", async () => {
    const execute = vi.fn();
    let queryCount = 0;
    const transaction = {
      $executeRaw: execute,
      $queryRaw: vi.fn(async () => {
        queryCount += 1;
        return [
          {
            requestCount: queryCount === 1 ? 1 : 6,
            retryAfterSeconds: 412,
          },
        ];
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());

    await expect(
      service.createChallenge({
        challengeId: "44444444-4444-4444-8444-444444444444",
        email: "person@example.com",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        providerKey: "local.passwordless.v1",
        returnTo: "/en/account",
        state: bearer(2),
        token: bearer(1),
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "ACCOUNT_AUTH_RATE_LIMITED",
        retryAfterSeconds: 412,
      }),
    );
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
    const values = transaction.$queryRaw.mock.calls.flatMap((call) => call.slice(1));
    expect(values).not.toContain("person@example.com");
  });

  it("rejects a cross-user anonymous-subject replay before inserting or revoking", async () => {
    const execute = vi.fn();
    const statements: string[] = [];
    const transaction = {
      $executeRaw: execute,
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = sqlText(strings);
        statements.push(sql);
        if (sql.includes("FROM account_session AS session")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              expiresAt: new Date("2026-07-19T00:00:00.000Z"),
              providerKey: "local.passwordless.v1",
              revokedAt: null,
              sessionId: "33333333-3333-4333-8333-333333333333",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        if (sql.includes("FROM anonymous_session AS session")) {
          return [
            {
              anonymousSubjectId: "55555555-5555-4555-8555-555555555555",
              sourceSessionId: "66666666-6666-4666-8666-666666666666",
            },
          ];
        }
        if (sql.includes("FROM account_subject_link")) {
          return [
            {
              canonicalRequestHash: new Uint8Array(32),
              idempotencyKeyHash: new Uint8Array(32),
              sourceAccountSessionId: "33333333-3333-4333-8333-333333333333",
              userId: "77777777-7777-4777-8777-777777777777",
            },
          ];
        }
        throw new TypeError(`Unexpected SQL: ${sql}`);
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());

    await expect(
      service.mergeAnonymousSubject({
        accountSessionToken: bearer(3),
        anonymousSessionToken: bearer(4),
        idempotencyKey: "abcdefghijklmnopqrstuv",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "ACCOUNT_MERGE_CONFLICT" }));
    expect(execute).not.toHaveBeenCalled();
    expect(
      statements.find((statement) => statement.includes("FROM account_subject_link")),
    ).not.toContain("FOR UPDATE");
  });

  it("keeps session revocation owner-scoped and returns not-found without leaking existence", async () => {
    const statements: string[] = [];
    const transaction = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = sqlText(strings);
        statements.push(sql);
        if (sql.includes("WITH active AS")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              expiresAt: new Date("2026-07-19T00:00:00.000Z"),
              providerKey: "local.passwordless.v1",
              sessionId: "33333333-3333-4333-8333-333333333333",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        return [];
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());

    await expect(
      service.revokeSession({
        sessionId: "44444444-4444-4444-8444-444444444444",
        token: bearer(3),
      }),
    ).resolves.toBe(false);
    expect(statements.at(-1)).toContain("AND user_id =");
    expect(statements.at(-1)).toContain("AND id <>");
    expect(statements.at(-1)).toContain("AND expires_at >= CURRENT_TIMESTAMP");
  });

  it("does not stamp a current revocation time onto expired sessions", async () => {
    const executeStatements: string[] = [];
    const transaction = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray) => {
        executeStatements.push(sqlText(strings));
        return 1;
      }),
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = sqlText(strings);
        if (sql.includes("WITH active AS")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              expiresAt: new Date("2026-07-19T00:00:00.000Z"),
              providerKey: "local.passwordless.v1",
              sessionId: "33333333-3333-4333-8333-333333333333",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        return [];
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());

    await expect(service.revokeAllSessions(bearer(3))).resolves.toBe(true);
    expect(executeStatements).toHaveLength(1);
    expect(executeStatements[0]).toContain("AND expires_at >= CURRENT_TIMESTAMP");
  });

  it("records only an explicit current age policy with a server timestamp", async () => {
    const statements: string[] = [];
    const transaction = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = sqlText(strings);
        statements.push(sql);
        if (sql.includes("WITH active AS")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              expiresAt: new Date("2026-07-19T00:00:00.000Z"),
              providerKey: "local.passwordless.v1",
              sessionId: "33333333-3333-4333-8333-333333333333",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        expect(values).toContain("age-18.local.v1");
        return [
          {
            ageAttestedAt: new Date("2026-07-18T00:00:00.000Z"),
            displayName: null,
            emailVerifiedAt: new Date("2026-07-18T00:00:00.000Z"),
            id: "11111111-1111-4111-8111-111111111111",
            locale: "en",
            profileVersion: 2,
            status: "active",
            timeZone: "UTC",
          },
        ];
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());

    await expect(
      service.updateProfile({
        request: { ageAttested: true, agePolicyVersion: "age-18.local.v1" },
        sessionToken: bearer(3),
      }),
    ).resolves.toEqual(expect.objectContaining({ ageAttested: true, profileVersion: 2 }));
    expect(statements.at(-1)).toContain("age_attested_at = CURRENT_TIMESTAMP");

    await expect(
      service.updateProfile({
        request: { ageAttested: false, agePolicyVersion: "age-18.local.v1" },
        sessionToken: bearer(3),
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "ACCOUNT_PROFILE_INVALID" }));
    expect(statements).toHaveLength(2);
  });

  it("collects only linked, retained, non-deleted account history metadata", async () => {
    const statements: string[] = [];
    const transaction = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = sqlText(strings);
        statements.push(sql);
        if (sql.includes("WITH active AS")) {
          return [
            {
              authIdentityId: "22222222-2222-4222-8222-222222222222",
              expiresAt: new Date("2026-08-19T00:00:00.000Z"),
              providerKey: "local.passwordless.v1",
              sessionId: "33333333-3333-4333-8333-333333333333",
              userId: "11111111-1111-4111-8111-111111111111",
            },
          ];
        }
        if (sql.includes("WITH account_history AS")) {
          return [
            {
              occurredAt: new Date("2026-07-24T02:00:00.000Z"),
              readingType: "one_card",
              resourceId: "44444444-4444-4444-8444-444444444444",
              resourceType: "reading",
              sourceType: "reading",
              status: "facts_ready",
              themeCode: "self",
            },
            {
              occurredAt: new Date("2026-07-24T01:00:00.000Z"),
              readingType: null,
              resourceId: "55555555-5555-4555-8555-555555555555",
              resourceType: "journal",
              sourceType: "journal",
              status: "active",
              themeCode: null,
            },
          ];
        }
        throw new TypeError(`Unexpected SQL: ${sql}`);
      }),
    };
    const database = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const service = createAccountIdentityService(database, policy());

    await expect(service.listHistory({ limit: 2, sessionToken: bearer(3) })).resolves.toEqual({
      items: [
        {
          occurredAt: "2026-07-24T02:00:00.000Z",
          readingType: "one_card",
          resourceId: "44444444-4444-4444-8444-444444444444",
          resourceType: "reading",
          status: "facts_ready",
          themeCode: "self",
        },
        {
          occurredAt: "2026-07-24T01:00:00.000Z",
          readingType: null,
          resourceId: "55555555-5555-4555-8555-555555555555",
          resourceType: "journal",
          status: "active",
          themeCode: null,
        },
      ],
      nextCursor: null,
    });
    const historySql = statements.find((statement) =>
      statement.includes("WITH account_history AS"),
    );
    expect(historySql).toContain("link.user_id =");
    expect(historySql).toContain("deleted_at IS NULL");
    expect(historySql).toContain("expires_at > CURRENT_TIMESTAMP");
    expect(historySql).not.toContain("intention_text");
    expect(historySql).not.toContain("reflection_ciphertext");
  });

  it("rejects weak encryption and unreasonable expiry policies", () => {
    const database = {} as PrismaClient;
    for (const invalid of [
      { ...policy(), emailEncryptionKey: new Uint8Array(31) },
      { ...policy(), providerSubjectHmacKey: new Uint8Array(31) },
      { ...policy(), challengeTtlSeconds: 59 },
      { ...policy(), sessionTtlSeconds: 2_592_001 },
      { ...policy(), startIdentifierLimit: 101, startGlobalLimit: 100 },
      { ...policy(), startWindowSeconds: 59 },
      { ...policy(), encryptionKeyVersion: "INVALID" },
    ]) {
      expect(() => createAccountIdentityService(database, invalid)).toThrow(TypeError);
    }
    expect(() => createAccountIdentityService(database, policy())).not.toThrow(
      AccountIdentityError,
    );
  });
});
