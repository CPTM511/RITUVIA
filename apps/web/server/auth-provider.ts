import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { normalizeAccountEmail, parseAuthProviderKey } from "@rituvia/domain";

import { isReviewedReturnTo } from "../app/_contracts/reviewed-return-to";

export const localPasswordlessProviderKey = parseAuthProviderKey("local.passwordless.v1");

export const accountAuthProviderCapabilities = Object.freeze({
  emailMagicLink: "active",
  passkey: "schema_ready",
} as const);

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
  capabilities: typeof accountAuthProviderCapabilities;
  consumeLocalPreview(stateToken: string): boolean;
  issueSessionToken(): string;
  readLocalPreview(stateToken: string): LocalPasswordlessStart | null;
  stageLocalPreview(started: LocalPasswordlessStart): void;
  startEmailMagicLink(
    input: Readonly<{ email: unknown; returnTo: unknown }>,
  ): LocalPasswordlessStart;
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
  const localPreviews = new Map<string, LocalPasswordlessStart>();

  const purgeExpiredPreviews = (): void => {
    const currentTime = now().getTime();
    for (const [stateToken, preview] of localPreviews) {
      if (Date.parse(preview.expiresAt) <= currentTime) localPreviews.delete(stateToken);
    }
  };

  return Object.freeze({
    capabilities: accountAuthProviderCapabilities,
    consumeLocalPreview(stateToken) {
      return localPreviews.delete(stateToken);
    },
    issueSessionToken: issueOpaqueToken,
    readLocalPreview(stateToken) {
      if (!/^[A-Za-z0-9_-]{43}$/u.test(stateToken)) return null;
      const started = localPreviews.get(stateToken);
      return started !== undefined && Date.parse(started.expiresAt) > now().getTime()
        ? started
        : null;
    },
    stageLocalPreview(started) {
      purgeExpiredPreviews();
      if (localPreviews.size >= 1_000 || localPreviews.has(started.state)) {
        throw new AccountAuthProviderUnavailableError();
      }
      localPreviews.set(started.state, started);
    },
    startEmailMagicLink(raw) {
      let email: string;
      try {
        email = normalizeAccountEmail(raw.email);
      } catch {
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
