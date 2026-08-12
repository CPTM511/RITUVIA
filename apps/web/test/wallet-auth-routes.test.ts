import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken, sessionCsrfHeaderName } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class WalletError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic wallet error");
      this.code = code;
    }
  }
  return {
    list: vi.fn(),
    revoke: vi.fn(),
    start: vi.fn(),
    verify: vi.fn(),
    WalletError,
  };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/wallet-auth", () => ({
  listWebWalletIdentities: harness.list,
  revokeWebWalletIdentity: harness.revoke,
  startWebWalletAuth: harness.start,
  verifyWebWalletAuth: harness.verify,
  WebWalletAuthError: harness.WalletError,
}));

import { POST as challenge } from "../app/api/v1/auth/wallet/challenge/route";
import { POST as verify } from "../app/api/v1/auth/wallet/verify/route";
import { GET as list } from "../app/api/v1/me/wallets/route";
import { DELETE as revoke } from "../app/api/v1/me/wallets/[walletId]/route";

const sessionToken = "s".repeat(43);
const walletId = "11111111-1111-4111-8111-111111111111";
const mutationHeaders = {
  "content-type": "application/json",
  origin: "https://example.test",
  "sec-fetch-site": "same-origin",
};

describe("wallet authentication routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts signed-out SIWE without accepting an existing account cookie", async () => {
    harness.start.mockResolvedValue({
      expiresAt: "2026-08-06T14:05:00.000Z",
      message: "example.test wants you to sign in with your Ethereum account:",
      purpose: "sign_in",
      requestId: walletId,
    });
    const body = JSON.stringify({
      address: "0x1111111111111111111111111111111111111111",
      chainId: 84_532,
      purpose: "sign_in",
    });
    const request = new NextRequest("https://example.test/api/v1/auth/wallet/challenge", {
      body,
      headers: { ...mutationHeaders, "idempotency-key": "i".repeat(22) },
      method: "POST",
    });
    const response = await challenge(request);
    expect(response.status).toBe(200);
    expect(harness.start).toHaveBeenCalledWith(expect.objectContaining({ purpose: "sign_in" }));
    expect(harness.start.mock.calls[0]?.[0]).not.toHaveProperty("sessionToken");

    const conflicted = await challenge(
      new NextRequest(request.url, {
        body,
        headers: {
          ...mutationHeaders,
          cookie: `__Host-rituvia-account-session=${sessionToken}`,
          "idempotency-key": "j".repeat(22),
        },
        method: "POST",
      }),
    );
    expect(conflicted.status).toBe(409);
  });

  it("requires session-bound CSRF for wallet linking and unlinking", async () => {
    const linkBody = JSON.stringify({
      address: "0x1111111111111111111111111111111111111111",
      chainId: 84_532,
      purpose: "link_wallet",
    });
    const denied = await challenge(
      new NextRequest("https://example.test/api/v1/auth/wallet/challenge", {
        body: linkBody,
        headers: {
          ...mutationHeaders,
          cookie: `__Host-rituvia-account-session=${sessionToken}`,
          "idempotency-key": "k".repeat(22),
        },
        method: "POST",
      }),
    );
    expect(denied.status).toBe(403);
    expect(harness.start).not.toHaveBeenCalled();

    const unlinkDenied = await revoke(
      new NextRequest(`https://example.test/api/v1/me/wallets/${walletId}`, {
        headers: { cookie: `__Host-rituvia-account-session=${sessionToken}` },
        method: "DELETE",
      }),
      { params: Promise.resolve({ walletId }) },
    );
    expect(unlinkDenied.status).toBe(403);
    expect(harness.revoke).not.toHaveBeenCalled();
  });

  it("sets only the secure account cookie after server verification", async () => {
    harness.verify.mockResolvedValue({
      expiresAt: "2026-08-06T15:00:00.000Z",
      purpose: "sign_in",
      sessionToken,
    });
    const response = await verify(
      new NextRequest("https://example.test/api/v1/auth/wallet/verify", {
        body: JSON.stringify({
          message: "signed message",
          requestId: walletId,
          signature: `0x${"11".repeat(65)}`,
        }),
        headers: mutationHeaders,
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get(sessionCsrfHeaderName)).toBe(deriveSessionCsrfToken(sessionToken));
    expect(await response.json()).toEqual({
      purpose: "sign_in",
      redirectTo: "/en/account",
      schemaVersion: 1,
    });
  });

  it("preserves owner scoping for listing and targeted unlink", async () => {
    harness.list.mockResolvedValue([
      {
        address: "0x1111111111111111111111111111111111111111",
        chainId: 84_532,
        id: walletId,
        linkedAt: "2026-08-06T14:00:00.000Z",
      },
    ]);
    const listed = await list(
      new NextRequest("https://example.test/api/v1/me/wallets", {
        headers: { cookie: `__Host-rituvia-account-session=${sessionToken}` },
      }),
    );
    expect(listed.status).toBe(200);
    expect((await listed.json()).wallets).toHaveLength(1);

    harness.revoke.mockResolvedValue(false);
    const missing = await revoke(
      new NextRequest(`https://example.test/api/v1/me/wallets/${walletId}`, {
        headers: {
          cookie: `__Host-rituvia-account-session=${sessionToken}`,
          origin: "https://example.test",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": deriveSessionCsrfToken(sessionToken),
        },
        method: "DELETE",
      }),
      { params: Promise.resolve({ walletId }) },
    );
    expect(missing.status).toBe(404);
    expect(harness.revoke).toHaveBeenCalledWith({
      sessionToken,
      walletIdentityId: walletId,
    });
  });
});
