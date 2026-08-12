import "server-only";

import { timingSafeEqual } from "node:crypto";

import {
  AccountIdentityError,
  createAccountIdentityService,
  type AccountIdentityService,
  type AccountMergeStatus,
  type AccountSessionContext,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";
import {
  AccountAuthProviderInputError,
  AccountAuthProviderUnavailableError,
  createAccountAuthProvider,
  type AccountAuthProvider,
} from "./auth-provider";

export const accountSessionCookieName = "__Host-rituvia-account-session";
export const accountAuthStateCookieName = "__Host-rituvia-auth-state";
const accountAuthStatePattern = /^[A-Za-z0-9_-]{43}$/u;

export const hasMatchingAccountAuthState = (
  suppliedState: string | null,
  cookieState: string | undefined,
): boolean => {
  if (
    suppliedState === null ||
    cookieState === undefined ||
    !accountAuthStatePattern.test(suppliedState) ||
    !accountAuthStatePattern.test(cookieState)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(suppliedState, "utf8"), Buffer.from(cookieState, "utf8"));
};

export type WebAccountAuthErrorCode =
  "conflict" | "invalid" | "rate_limited" | "session_unavailable" | "unavailable";

export class WebAccountAuthError extends Error {
  readonly code: WebAccountAuthErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: WebAccountAuthErrorCode, retryAfterSeconds?: number) {
    super("The account authentication operation failed.");
    this.name = "WebAccountAuthError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let identityService: AccountIdentityService | undefined;
let authProvider: AccountAuthProvider | undefined;

export const loadWebAccountIdentityService = (): AccountIdentityService => {
  if (identityService !== undefined) return identityService;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.databaseUrl === undefined ||
    configuration.accountIdentityPolicy === undefined
  ) {
    throw new WebAccountAuthError("unavailable");
  }
  identityService = createAccountIdentityService(
    loadWebDatabase(),
    configuration.accountIdentityPolicy,
  );
  return identityService;
};

const loadProvider = (): AccountAuthProvider => {
  if (authProvider !== undefined) return authProvider;
  const configuration = getWebRuntimeConfiguration();
  if (configuration.accountIdentityPolicy === undefined) {
    throw new WebAccountAuthError("unavailable");
  }
  try {
    authProvider = createAccountAuthProvider({
      canonicalOrigin: configuration.brand.canonicalOrigin,
      challengeTtlSeconds: configuration.accountIdentityPolicy.challengeTtlSeconds,
      deploymentEnvironment: configuration.deploymentEnvironment,
      encryptionKey: configuration.accountIdentityPolicy.emailEncryptionKey,
      sandboxEnabled: configuration.recoveryIdentitySandbox?.enabled,
    });
    return authProvider;
  } catch {
    throw new WebAccountAuthError("unavailable");
  }
};

const mapError = (error: unknown): never => {
  if (error instanceof WebAccountAuthError) throw error;
  if (error instanceof AccountAuthProviderUnavailableError) {
    throw new WebAccountAuthError("unavailable");
  }
  if (error instanceof AccountAuthProviderInputError) {
    throw new WebAccountAuthError("invalid");
  }
  if (error instanceof AccountIdentityError) {
    if (
      error.code === "ACCOUNT_AUTH_INVALID" ||
      error.code === "ACCOUNT_AUTH_EXPIRED" ||
      error.code === "ACCOUNT_AUTH_REPLAYED" ||
      error.code === "ACCOUNT_DISABLED"
    ) {
      throw new WebAccountAuthError("invalid");
    }
    if (error.code === "ACCOUNT_AUTH_RATE_LIMITED") {
      throw new WebAccountAuthError("rate_limited", error.retryAfterSeconds);
    }
    if (error.code === "ACCOUNT_SESSION_UNAVAILABLE") {
      throw new WebAccountAuthError("session_unavailable");
    }
    if (error.code === "ACCOUNT_MERGE_CONFLICT") {
      throw new WebAccountAuthError("conflict");
    }
  }
  throw new WebAccountAuthError("unavailable");
};

export const startWebAccountAuth = async (input: {
  email: unknown;
  previousSessionToken?: string | undefined;
  returnTo: unknown;
}): Promise<
  Readonly<{
    accepted: true;
    expiresAt: string;
    localPreviewPath: "/api/v1/auth/local-preview";
    stateToken: string;
  }>
> => {
  try {
    const provider = loadProvider();
    const started = provider.startEmailMagicLink(input);
    await loadWebAccountIdentityService().createChallenge({
      ...started,
      previousSessionToken: input.previousSessionToken,
    });
    return Object.freeze({
      accepted: true,
      expiresAt: started.expiresAt,
      localPreviewPath: "/api/v1/auth/local-preview",
      stateToken: provider.sealLocalPreview(started),
    });
  } catch (error) {
    return mapError(error);
  }
};

export const completeWebLocalPreviewAuth = async (input: {
  anonymousSessionToken?: string | undefined;
  stateToken: string | undefined;
}): Promise<
  Readonly<{
    context: AccountSessionContext;
    mergeStatus: AccountMergeStatus | null;
    returnTo: string;
    sessionToken: string;
  }>
> => {
  if (input.stateToken === undefined) throw new WebAccountAuthError("invalid");
  const provider = loadProvider();
  const started = provider.readLocalPreview(input.stateToken);
  if (started === null) throw new WebAccountAuthError("invalid");
  const completed = await completeWebAccountAuth({
    anonymousSessionToken: input.anonymousSessionToken,
    challengeId: started.challengeId,
    state: started.state,
    token: started.token,
  });
  return completed;
};

export const completeWebAccountAuth = async (input: {
  anonymousSessionToken?: string | undefined;
  challengeId: string;
  state: string;
  token: string;
}): Promise<
  Readonly<{
    context: AccountSessionContext;
    mergeStatus: AccountMergeStatus | null;
    returnTo: string;
    sessionToken: string;
  }>
> => {
  try {
    const sessionToken = loadProvider().issueSessionToken();
    const completed = await loadWebAccountIdentityService().consumeChallenge({
      ...(input.anonymousSessionToken === undefined
        ? {}
        : {
            anonymousMerge: {
              anonymousSessionToken: input.anonymousSessionToken,
              idempotencyKey: `auth_callback_${input.challengeId}`,
            },
          }),
      challengeId: input.challengeId,
      sessionToken,
      state: input.state,
      token: input.token,
    });
    return Object.freeze({ ...completed, sessionToken });
  } catch (error) {
    return mapError(error);
  }
};

export const resolveCurrentAccountSession = async (
  token: string | undefined,
): Promise<AccountSessionContext | null> => {
  if (token === undefined) return null;
  try {
    return await loadWebAccountIdentityService().resolveSession(token);
  } catch (error) {
    return mapError(error);
  }
};

export const logoutWebAccountSession = async (token: string | undefined): Promise<boolean> => {
  if (token === undefined) return false;
  try {
    const current = await loadWebAccountIdentityService().resolveSession(token);
    if (current === null) return false;
    return await loadWebAccountIdentityService().revokeSession({
      sessionId: current.sessionId,
      token,
    });
  } catch (error) {
    return mapError(error);
  }
};

export const logoutAllWebAccountSessions = async (token: string | undefined): Promise<boolean> => {
  if (token === undefined) return false;
  try {
    return await loadWebAccountIdentityService().revokeAllSessions(token);
  } catch (error) {
    return mapError(error);
  }
};

export const mergeWebAnonymousSubject = async (input: {
  accountSessionToken: string | undefined;
  anonymousSessionToken: string | undefined;
  idempotencyKey: string;
}): Promise<
  Readonly<{
    context: AccountSessionContext;
    sessionToken: string;
    status: AccountMergeStatus;
  }>
> => {
  if (input.accountSessionToken === undefined || input.anonymousSessionToken === undefined) {
    throw new WebAccountAuthError("conflict");
  }
  try {
    const merged = await loadWebAccountIdentityService().mergeAnonymousSubject({
      accountSessionToken: input.accountSessionToken,
      anonymousSessionToken: input.anonymousSessionToken,
      idempotencyKey: input.idempotencyKey,
    });
    return merged;
  } catch (error) {
    return mapError(error);
  }
};
