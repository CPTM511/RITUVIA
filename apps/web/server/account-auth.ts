import "server-only";

import {
  AccountIdentityError,
  createAccountIdentityService,
  type AccountIdentityService,
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

export type WebAccountAuthErrorCode =
  "conflict" | "invalid" | "session_unavailable" | "unavailable";

export class WebAccountAuthError extends Error {
  readonly code: WebAccountAuthErrorCode;

  constructor(code: WebAccountAuthErrorCode) {
    super("The account authentication operation failed.");
    this.name = "WebAccountAuthError";
    this.code = code;
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
  returnTo: unknown;
}): Promise<Readonly<{ callbackUrl: string; expiresAt: string }>> => {
  try {
    const started = loadProvider().start(input);
    await loadWebAccountIdentityService().createChallenge(started);
    return Object.freeze({ callbackUrl: started.callbackUrl, expiresAt: started.expiresAt });
  } catch (error) {
    return mapError(error);
  }
};

export const completeWebAccountAuth = async (input: {
  challengeId: string;
  previousSessionToken?: string | undefined;
  state: string;
  token: string;
}): Promise<
  Readonly<{ context: AccountSessionContext; returnTo: string; sessionToken: string }>
> => {
  try {
    const sessionToken = loadProvider().issueSessionToken();
    const completed = await loadWebAccountIdentityService().consumeChallenge({
      challengeId: input.challengeId,
      previousSessionToken: input.previousSessionToken,
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
}): Promise<"created" | "replayed"> => {
  if (input.accountSessionToken === undefined || input.anonymousSessionToken === undefined) {
    throw new WebAccountAuthError("conflict");
  }
  try {
    return await loadWebAccountIdentityService().mergeAnonymousSubject({
      accountSessionToken: input.accountSessionToken,
      anonymousSessionToken: input.anonymousSessionToken,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    return mapError(error);
  }
};
