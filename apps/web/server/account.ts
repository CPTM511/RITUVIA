import "server-only";

import { AccountIdentityError } from "@rituvia/db";

import { loadWebAccountIdentityService, WebAccountAuthError } from "./account-auth";

export class WebAccountError extends Error {
  readonly code: "conflict" | "invalid" | "not_found" | "session_unavailable" | "unavailable";

  constructor(code: "conflict" | "invalid" | "not_found" | "session_unavailable" | "unavailable") {
    super("The account operation failed.");
    this.name = "WebAccountError";
    this.code = code;
  }
}

const mapError = (error: unknown): never => {
  if (error instanceof WebAccountError) throw error;
  if (error instanceof WebAccountAuthError) {
    throw new WebAccountError(
      error.code === "session_unavailable" ? "session_unavailable" : "unavailable",
    );
  }
  if (error instanceof AccountIdentityError) {
    if (error.code === "ACCOUNT_SESSION_UNAVAILABLE") {
      throw new WebAccountError("session_unavailable");
    }
    if (error.code === "ACCOUNT_PROFILE_CONFLICT") {
      throw new WebAccountError("conflict");
    }
    if (error.code === "ACCOUNT_PROFILE_INVALID") {
      throw new WebAccountError("invalid");
    }
    if (error.code === "ACCOUNT_RESOURCE_NOT_FOUND") {
      throw new WebAccountError("not_found");
    }
  }
  throw new WebAccountError("unavailable");
};

export const getWebAccountProfile = async (sessionToken: string | undefined) => {
  if (sessionToken === undefined) throw new WebAccountError("session_unavailable");
  try {
    return await loadWebAccountIdentityService().getProfile(sessionToken);
  } catch (error) {
    return mapError(error);
  }
};

export const updateWebAccountProfile = async (input: {
  request: unknown;
  sessionToken: string | undefined;
}) => {
  if (input.sessionToken === undefined) throw new WebAccountError("session_unavailable");
  try {
    return await loadWebAccountIdentityService().updateProfile({
      request: input.request,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};

export const listWebAccountSessions = async (sessionToken: string | undefined) => {
  if (sessionToken === undefined) throw new WebAccountError("session_unavailable");
  try {
    return await loadWebAccountIdentityService().listSessions(sessionToken);
  } catch (error) {
    return mapError(error);
  }
};

export const revokeWebAccountSession = async (input: {
  sessionId: string;
  sessionToken: string | undefined;
}) => {
  if (input.sessionToken === undefined) throw new WebAccountError("session_unavailable");
  try {
    const revoked = await loadWebAccountIdentityService().revokeSession({
      sessionId: input.sessionId,
      token: input.sessionToken,
    });
    if (!revoked) throw new WebAccountError("not_found");
  } catch (error) {
    return mapError(error);
  }
};

export const listWebAccountReadings = async (input: {
  cursor?: Readonly<{ createdAt: string; readingId: string }> | undefined;
  limit: number;
  sessionToken: string | undefined;
}) => {
  if (input.sessionToken === undefined) throw new WebAccountError("session_unavailable");
  try {
    return await loadWebAccountIdentityService().listReadings({
      cursor: input.cursor,
      limit: input.limit,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};
