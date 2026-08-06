import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import {
  createWalletIdentityService,
  WalletIdentityError,
  type WalletIdentityService,
} from "@rituvia/db";
import { getAddress, isAddress, recoverMessageAddress, type Address, type Hex } from "viem";
import {
  createSiweMessage,
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
} from "viem/siwe";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";

export class WebWalletAuthError extends Error {
  readonly code: "conflict" | "invalid" | "session_unavailable" | "unavailable";

  constructor(code: WebWalletAuthError["code"]) {
    super("The wallet identity operation failed.");
    this.name = "WebWalletAuthError";
    this.code = code;
  }
}

let service: WalletIdentityService | undefined;

const loadService = (): WalletIdentityService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  const sandbox = configuration.recoveryIdentitySandbox;
  const account = configuration.accountIdentityPolicy;
  if (configuration.databaseUrl === undefined || sandbox === undefined || account === undefined) {
    throw new WebWalletAuthError("unavailable");
  }
  service = createWalletIdentityService(loadWebDatabase(), {
    allowedChainIds: sandbox.allowedWalletChainIds,
    challengeTtlSeconds: sandbox.walletChallengeTtlSeconds,
    recentAuthenticationSeconds: sandbox.walletRecentAuthenticationSeconds,
    sessionTtlSeconds: account.sessionTtlSeconds,
  });
  return service;
};

const mapError = (error: unknown): never => {
  if (error instanceof WebWalletAuthError) throw error;
  if (error instanceof WalletIdentityError) {
    if (error.code === "WALLET_AUTH_CONFLICT") throw new WebWalletAuthError("conflict");
    if (error.code === "WALLET_SESSION_UNAVAILABLE") {
      throw new WebWalletAuthError("session_unavailable");
    }
    if (
      error.code === "WALLET_AUTH_INVALID" ||
      error.code === "WALLET_AUTH_EXPIRED" ||
      error.code === "WALLET_AUTH_REPLAYED"
    ) {
      throw new WebWalletAuthError("invalid");
    }
  }
  throw new WebWalletAuthError("unavailable");
};

const normalizeWalletAddress = (value: unknown): Address => {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    throw new WebWalletAuthError("invalid");
  }
  return getAddress(value);
};

const issueSessionToken = (): string => randomBytes(32).toString("base64url");

export const startWebWalletAuth = async (input: {
  address: unknown;
  chainId: unknown;
  idempotencyKey: string;
  purpose: unknown;
  sessionToken?: string | undefined;
}) => {
  const configuration = getWebRuntimeConfiguration();
  const sandbox = configuration.recoveryIdentitySandbox;
  if (sandbox === undefined) throw new WebWalletAuthError("unavailable");
  const address = normalizeWalletAddress(input.address);
  if (
    typeof input.chainId !== "number" ||
    !Number.isSafeInteger(input.chainId) ||
    !sandbox.allowedWalletChainIds.includes(input.chainId as 84532) ||
    (input.purpose !== "sign_in" && input.purpose !== "link_wallet")
  ) {
    throw new WebWalletAuthError("invalid");
  }
  const requestId = randomUUID();
  const nonce = generateSiweNonce();
  const origin = new URL(configuration.brand.canonicalOrigin);
  const issuedAt = new Date();
  const expirationTime = new Date(issuedAt.getTime() + sandbox.walletChallengeTtlSeconds * 1_000);
  const uri = new URL(input.purpose === "link_wallet" ? "/en/account" : "/en/sign-in", origin);
  let message: string;
  try {
    message = createSiweMessage({
      address,
      chainId: input.chainId,
      domain: origin.host,
      expirationTime,
      issuedAt,
      nonce,
      requestId,
      scheme: origin.protocol.slice(0, -1),
      statement:
        input.purpose === "link_wallet"
          ? "Link this non-custodial wallet to your private RITUVIA account."
          : "Sign in to your private RITUVIA account with this linked wallet.",
      uri: uri.toString(),
      version: "1",
    });
  } catch (error) {
    return mapError(error);
  }
  try {
    return await loadService().createChallenge({
      address: address.toLowerCase(),
      chainId: input.chainId,
      idempotencyKey: input.idempotencyKey,
      message,
      nonce,
      purpose: input.purpose,
      requestId,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};

export const verifyWebWalletAuth = async (input: {
  message: unknown;
  requestId: unknown;
  sessionToken?: string | undefined;
  signature: unknown;
}) => {
  if (
    typeof input.message !== "string" ||
    typeof input.requestId !== "string" ||
    typeof input.signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/u.test(input.signature)
  ) {
    throw new WebWalletAuthError("invalid");
  }
  const configuration = getWebRuntimeConfiguration();
  const origin = new URL(configuration.brand.canonicalOrigin);
  let parsed: ReturnType<typeof parseSiweMessage>;
  try {
    parsed = parseSiweMessage(input.message);
  } catch {
    await loadService().recordRejectedVerification({
      reasonCode: "invalid_message",
      requestId: input.requestId,
      signature: input.signature,
    });
    throw new WebWalletAuthError("invalid");
  }
  const expectedUri =
    parsed.statement === "Link this non-custodial wallet to your private RITUVIA account."
      ? new URL("/en/account", origin).toString()
      : new URL("/en/sign-in", origin).toString();
  const structurallyValid =
    parsed.requestId === input.requestId &&
    parsed.uri === expectedUri &&
    parsed.chainId === 84532 &&
    validateSiweMessage({
      domain: origin.host,
      message: parsed,
      scheme: origin.protocol.slice(0, -1),
      time: new Date(),
    });
  if (!structurallyValid || parsed.address === undefined) {
    await loadService().recordRejectedVerification({
      reasonCode: "invalid_message",
      requestId: input.requestId,
      signature: input.signature,
    });
    throw new WebWalletAuthError("invalid");
  }
  let recovered: Address;
  try {
    recovered = await recoverMessageAddress({
      message: input.message,
      signature: input.signature as Hex,
    });
  } catch {
    await loadService().recordRejectedVerification({
      reasonCode: "invalid_signature",
      requestId: input.requestId,
      signature: input.signature,
    });
    throw new WebWalletAuthError("invalid");
  }
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    await loadService().recordRejectedVerification({
      reasonCode: "invalid_signature",
      requestId: input.requestId,
      signature: input.signature,
    });
    throw new WebWalletAuthError("invalid");
  }
  try {
    return await loadService().verifyChallenge({
      message: input.message,
      requestId: input.requestId,
      sessionToken: input.sessionToken,
      signature: input.signature,
      ...(input.sessionToken === undefined ? { successorSessionToken: issueSessionToken() } : {}),
    });
  } catch (error) {
    return mapError(error);
  }
};

export const listWebWalletIdentities = async (sessionToken: string | undefined) => {
  if (sessionToken === undefined) throw new WebWalletAuthError("session_unavailable");
  try {
    return await loadService().listWallets(sessionToken);
  } catch (error) {
    return mapError(error);
  }
};

export const revokeWebWalletIdentity = async (input: {
  sessionToken: string | undefined;
  walletIdentityId: string;
}) => {
  if (input.sessionToken === undefined) throw new WebWalletAuthError("session_unavailable");
  try {
    return await loadService().revokeWallet({
      sessionToken: input.sessionToken,
      walletIdentityId: input.walletIdentityId,
    });
  } catch (error) {
    return mapError(error);
  }
};
