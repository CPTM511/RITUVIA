import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { normalizeAccountEmail, parseAuthProviderKey } from "@rituvia/domain";

import { isReviewedReturnTo } from "../app/_contracts/reviewed-return-to";

export const localPasswordlessProviderKey = parseAuthProviderKey("local.passwordless.v1");
const localEmailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@example\.test$/u;

export class AccountAuthProviderUnavailableError extends Error {
  constructor() {
    super("The account authentication provider is unavailable.");
    this.name = "AccountAuthProviderUnavailableError";
  }
}

export class AccountAuthProviderInputError extends Error {
  constructor() {
    super("The account authentication request is invalid.");
    this.name = "AccountAuthProviderInputError";
  }
}

export type LocalPasswordlessStart = Readonly<{
  callbackUrl: string;
  challengeId: string;
  email: string;
  expiresAt: string;
  providerKey: typeof localPasswordlessProviderKey;
  returnTo: string;
  state: string;
  token: string;
}>;

export type AccountAuthProvider = Readonly<{
  issueSessionToken(): string;
  start(input: Readonly<{ email: unknown; returnTo: unknown }>): LocalPasswordlessStart;
}>;

const issueOpaqueToken = (): string => {
  const token = randomBytes(32).toString("base64url");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    throw new AccountAuthProviderUnavailableError();
  }
  return token;
};

export const createAccountAuthProvider = (input: {
  canonicalOrigin: string;
  challengeTtlSeconds: number;
  deploymentEnvironment: "local" | "preview" | "production" | "staging";
  now?: (() => Date) | undefined;
}): AccountAuthProvider => {
  if (
    input.deploymentEnvironment !== "local" ||
    !Number.isSafeInteger(input.challengeTtlSeconds) ||
    input.challengeTtlSeconds < 60 ||
    input.challengeTtlSeconds > 3_600
  ) {
    throw new AccountAuthProviderUnavailableError();
  }
  const origin = new URL(input.canonicalOrigin);
  if (origin.pathname !== "/" || origin.search !== "" || origin.hash !== "") {
    throw new AccountAuthProviderUnavailableError();
  }
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    issueSessionToken: issueOpaqueToken,
    start(raw) {
      let email: string;
      try {
        email = normalizeAccountEmail(raw.email);
      } catch {
        throw new AccountAuthProviderInputError();
      }
      if (!localEmailPattern.test(email)) {
        throw new AccountAuthProviderInputError();
      }
      if (!isReviewedReturnTo(raw.returnTo)) {
        throw new AccountAuthProviderInputError();
      }
      const challengeId = randomUUID();
      const token = issueOpaqueToken();
      const state = issueOpaqueToken();
      const expiresAt = new Date(now().getTime() + input.challengeTtlSeconds * 1_000).toISOString();
      const callback = new URL("/api/v1/auth/callback", origin);
      callback.searchParams.set("challenge", challengeId);
      callback.searchParams.set("state", state);
      callback.searchParams.set("token", token);
      return Object.freeze({
        callbackUrl: callback.toString(),
        challengeId,
        email,
        expiresAt,
        providerKey: localPasswordlessProviderKey,
        returnTo: raw.returnTo,
        state,
        token,
      });
    },
  });
};
