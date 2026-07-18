import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class IdentityError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic identity error");
      this.code = code;
    }
  }
  return {
    consumeChallenge: vi.fn(),
    createChallenge: vi.fn(),
    createDatabase: vi.fn(() => Object.freeze({ kind: "database" })),
    createService: vi.fn(),
    accountIdentityPolicyEnabled: true,
    deploymentEnvironment: "local" as "local" | "preview" | "production" | "staging",
    IdentityError,
    mergeAnonymousSubject: vi.fn(),
    resolveSession: vi.fn(),
    revokeAllSessions: vi.fn(),
    revokeSession: vi.fn(),
  };
});

vi.mock("@rituvia/db", () => ({
  AccountIdentityError: harness.IdentityError,
  createAccountIdentityService: harness.createService,
  createDatabaseClient: harness.createDatabase,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => {
    const accountIdentityPolicy = harness.accountIdentityPolicyEnabled
      ? {
          challengeTtlSeconds: 600,
          emailEncryptionKey: new Uint8Array(32).fill(1),
          encryptionKeyVersion: "auth-data.v1",
          providerSubjectHmacKey: new Uint8Array(32).fill(2),
          sessionTtlSeconds: 604_800,
        }
      : undefined;
    return {
      accountIdentityPolicy,
      brand: { canonicalOrigin: "https://example.test" },
      databaseUrl: "postgresql://app:private@127.0.0.1:5432/rituvia",
      deploymentEnvironment: harness.deploymentEnvironment,
    };
  },
}));

describe("account auth Web composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    harness.accountIdentityPolicyEnabled = true;
    harness.deploymentEnvironment = "local";
    harness.createService.mockReturnValue({
      consumeChallenge: harness.consumeChallenge,
      createChallenge: harness.createChallenge,
      mergeAnonymousSubject: harness.mergeAnonymousSubject,
      resolveSession: harness.resolveSession,
      revokeAllSessions: harness.revokeAllSessions,
      revokeSession: harness.revokeSession,
    });
  });

  it("persists one-time challenge material while returning only the local callback", async () => {
    const { startWebAccountAuth } = await import("../server/account-auth");
    const result = await startWebAccountAuth({
      email: "demo@example.test",
      returnTo: "/en/account",
    });

    expect(result.callbackUrl).toMatch(/^https:\/\/example\.test\/api\/v1\/auth\/callback\?/u);
    expect(result).not.toHaveProperty("token");
    expect(harness.createChallenge).toHaveBeenCalledOnce();
    expect(harness.createChallenge.mock.calls[0]?.[0]).toMatchObject({
      email: "demo@example.test",
      providerKey: "local.passwordless.v1",
      returnTo: "/en/account",
    });
    expect(harness.createChallenge.mock.calls[0]?.[0].token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(harness.createService.mock.calls[0]?.[1]).toMatchObject({
      encryptionKeyVersion: "auth-data.v1",
      providerSubjectHmacKey: expect.any(Uint8Array),
    });
  });

  it("rotates to a fresh session token and forwards the prior token only for same-user revocation", async () => {
    harness.consumeChallenge.mockImplementation(async (input) => ({
      context: {
        authIdentityId: "22222222-2222-4222-8222-222222222222",
        expiresAt: "2026-07-19T00:00:00.000Z",
        providerKey: "local.passwordless.v1",
        sessionId: "33333333-3333-4333-8333-333333333333",
        userId: "11111111-1111-4111-8111-111111111111",
      },
      returnTo: "/en/account",
      observedSessionToken: input.sessionToken,
    }));
    const { completeWebAccountAuth } = await import("../server/account-auth");
    const completed = await completeWebAccountAuth({
      challengeId: "44444444-4444-4444-8444-444444444444",
      previousSessionToken: "p".repeat(43),
      state: "q".repeat(43),
      token: "t".repeat(43),
    });

    expect(completed.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(completed.sessionToken).not.toBe("p".repeat(43));
    expect(harness.consumeChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        previousSessionToken: "p".repeat(43),
        sessionToken: completed.sessionToken,
        state: "q".repeat(43),
      }),
    );
  });

  it("does not touch storage for an absent account cookie and hard-fails production local auth", async () => {
    let authModule = await import("../server/account-auth");
    await expect(authModule.resolveCurrentAccountSession(undefined)).resolves.toBeNull();
    expect(harness.resolveSession).not.toHaveBeenCalled();

    vi.resetModules();
    harness.deploymentEnvironment = "production";
    authModule = await import("../server/account-auth");
    await expect(
      authModule.startWebAccountAuth({ email: "demo@example.test", returnTo: "/en/account" }),
    ).rejects.toEqual(expect.objectContaining({ code: "unavailable" }));
    expect(harness.createChallenge).not.toHaveBeenCalled();
  });

  it("keeps local auth safely off when account identity keys are not configured", async () => {
    harness.accountIdentityPolicyEnabled = false;
    const authModule = await import("../server/account-auth");

    await expect(
      authModule.startWebAccountAuth({ email: "demo@example.test", returnTo: "/en/account" }),
    ).rejects.toEqual(expect.objectContaining({ code: "unavailable" }));
    expect(harness.createChallenge).not.toHaveBeenCalled();
    expect(harness.createService).not.toHaveBeenCalled();
  });

  it("classifies malformed local credentials as input instead of an outage", async () => {
    const authModule = await import("../server/account-auth");

    await expect(
      authModule.startWebAccountAuth({ email: "not-an-email", returnTo: "/en/account" }),
    ).rejects.toEqual(expect.objectContaining({ code: "invalid" }));
    expect(harness.createChallenge).not.toHaveBeenCalled();
  });
});
