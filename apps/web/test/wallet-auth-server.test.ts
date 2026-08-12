import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { parseSiweMessage } from "viem/siwe";

const harness = vi.hoisted(() => {
  class IdentityError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic wallet identity error");
      this.code = code;
    }
  }
  return {
    createChallenge: vi.fn(),
    createDatabase: vi.fn(() => Object.freeze({ kind: "database" })),
    createService: vi.fn(),
    deploymentEnvironment: "staging" as "local" | "staging",
    IdentityError,
    listWallets: vi.fn(),
    recordRejectedVerification: vi.fn(),
    recoveryIdentitySandbox: {
      allowedWalletChainIds: [84_532],
      enabled: true,
      walletChallengeTtlSeconds: 300,
      walletRecentAuthenticationSeconds: 900,
    } as
      | {
          allowedWalletChainIds: number[];
          enabled: true;
          walletChallengeTtlSeconds: 300;
          walletRecentAuthenticationSeconds: 900;
        }
      | undefined,
    revokeWallet: vi.fn(),
    verifyChallenge: vi.fn(),
  };
});

vi.mock("@rituvia/db", () => ({
  createDatabaseClient: harness.createDatabase,
  createWalletIdentityService: harness.createService,
  WalletIdentityError: harness.IdentityError,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    accountIdentityPolicy: { sessionTtlSeconds: 3_600 },
    brand: { canonicalOrigin: "https://example.test" },
    databaseUrl: "postgresql://app:private@127.0.0.1:5432/rituvia",
    deploymentEnvironment: harness.deploymentEnvironment,
    recoveryIdentitySandbox: harness.recoveryIdentitySandbox,
  }),
}));

const account = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
);
const otherAccount = privateKeyToAccount(
  "0x0000000000000000000000000000000000000000000000000000000000000002",
);

describe("wallet authentication Web composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    harness.deploymentEnvironment = "staging";
    harness.recoveryIdentitySandbox = {
      allowedWalletChainIds: [84_532],
      enabled: true,
      walletChallengeTtlSeconds: 300,
      walletRecentAuthenticationSeconds: 900,
    };
    harness.createChallenge.mockImplementation(async (input) => ({
      expiresAt: "2026-08-06T14:05:00.000Z",
      message: input.message,
      purpose: input.purpose,
      requestId: input.requestId,
    }));
    harness.createService.mockReturnValue({
      createChallenge: harness.createChallenge,
      listWallets: harness.listWallets,
      recordRejectedVerification: harness.recordRejectedVerification,
      revokeWallet: harness.revokeWallet,
      verifyChallenge: harness.verifyChallenge,
    });
  });

  it("creates an exact Base Sepolia SIWE challenge bound to the staging origin", async () => {
    const { startWebWalletAuth } = await import("../server/wallet-auth");
    const result = await startWebWalletAuth({
      address: account.address,
      chainId: 84_532,
      idempotencyKey: "i".repeat(22),
      purpose: "link_wallet",
      sessionToken: "s".repeat(43),
    });
    const parsed = parseSiweMessage(result.message);

    expect(parsed).toMatchObject({
      address: account.address,
      chainId: 84_532,
      domain: "example.test",
      requestId: result.requestId,
      scheme: "https",
      statement: "Link this non-custodial wallet to your private RITUVIA account.",
      uri: "https://example.test/en/account",
      version: "1",
    });
    expect(harness.createChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        address: account.address.toLowerCase(),
        chainId: 84_532,
        purpose: "link_wallet",
        sessionToken: "s".repeat(43),
      }),
    );
  });

  it("accepts a real EOA signature and rotates to a server-issued session", async () => {
    const walletAuth = await import("../server/wallet-auth");
    const started = await walletAuth.startWebWalletAuth({
      address: account.address,
      chainId: 84_532,
      idempotencyKey: "j".repeat(22),
      purpose: "sign_in",
    });
    const signature = await account.signMessage({ message: started.message });
    harness.verifyChallenge.mockImplementation(async (input) => ({
      expiresAt: "2026-08-06T15:00:00.000Z",
      purpose: "sign_in",
      sessionToken: input.successorSessionToken,
    }));

    const verified = await walletAuth.verifyWebWalletAuth({
      message: started.message,
      requestId: started.requestId,
      signature,
    });

    expect(verified).toMatchObject({ purpose: "sign_in" });
    expect(harness.verifyChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        message: started.message,
        requestId: started.requestId,
        signature,
        successorSessionToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      }),
    );
  });

  it("fails closed for altered origin, wrong signer, and unapproved chains", async () => {
    const walletAuth = await import("../server/wallet-auth");
    const started = await walletAuth.startWebWalletAuth({
      address: account.address,
      chainId: 84_532,
      idempotencyKey: "k".repeat(22),
      purpose: "sign_in",
    });
    const alteredMessage = started.message.replaceAll("example.test", "foreign.test");
    const alteredSignature = await account.signMessage({ message: alteredMessage });
    await expect(
      walletAuth.verifyWebWalletAuth({
        message: alteredMessage,
        requestId: started.requestId,
        signature: alteredSignature,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "invalid" }));

    const wrongSignature = await otherAccount.signMessage({ message: started.message });
    await expect(
      walletAuth.verifyWebWalletAuth({
        message: started.message,
        requestId: started.requestId,
        signature: wrongSignature,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "invalid" }));
    await expect(
      walletAuth.startWebWalletAuth({
        address: account.address,
        chainId: 1,
        idempotencyKey: "m".repeat(22),
        purpose: "sign_in",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "invalid" }));
    expect(harness.recordRejectedVerification).toHaveBeenCalledTimes(2);
    expect(harness.verifyChallenge).not.toHaveBeenCalled();
  });

  it("uses the bounded Base Sepolia policy for local wallet reads", async () => {
    harness.deploymentEnvironment = "local";
    harness.recoveryIdentitySandbox = undefined;
    harness.listWallets.mockResolvedValue([]);

    const { listWebWalletIdentities } = await import("../server/wallet-auth");
    await expect(listWebWalletIdentities("s".repeat(43))).resolves.toEqual([]);
    expect(harness.createService).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        allowedChainIds: [84_532],
        challengeTtlSeconds: 300,
        recentAuthenticationSeconds: 900,
        sessionTtlSeconds: 3_600,
      }),
    );
  });

  it("keeps wallet identity unavailable outside local without an approved sandbox", async () => {
    harness.recoveryIdentitySandbox = undefined;

    const { listWebWalletIdentities } = await import("../server/wallet-auth");
    await expect(listWebWalletIdentities("s".repeat(43))).rejects.toEqual(
      expect.objectContaining({ code: "unavailable" }),
    );
    expect(harness.createService).not.toHaveBeenCalled();
  });
});
