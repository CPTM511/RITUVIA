import "server-only";

import {
  createPrivacyDeletionPersistence,
  PrivacyDeletionError,
  type PrivacyDeletionPersistence,
  type PrivacyDeletionResult,
  type PrivacyDeletionScope,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadPrivacyDeletionDatabase } from "./privacy-deletion-database";

export type WebPrivacyDeletionErrorCode =
  | "conflict"
  | "invalid"
  | "rate_limited"
  | "recent_auth_required"
  | "session_unavailable"
  | "unavailable";

export class WebPrivacyDeletionError extends Error {
  readonly code: WebPrivacyDeletionErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: WebPrivacyDeletionErrorCode, retryAfterSeconds?: number) {
    super("The privacy deletion operation failed.");
    this.name = "WebPrivacyDeletionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let persistence: PrivacyDeletionPersistence | undefined;

const loadPersistence = (): PrivacyDeletionPersistence => {
  if (persistence !== undefined) return persistence;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.privacyDeletionDatabaseUrl === undefined ||
    configuration.privacyDeletionPolicy === undefined
  ) {
    throw new WebPrivacyDeletionError("unavailable");
  }
  persistence = createPrivacyDeletionPersistence(
    loadPrivacyDeletionDatabase(),
    configuration.privacyDeletionPolicy,
  );
  return persistence;
};

const mapError = (error: unknown): never => {
  if (error instanceof WebPrivacyDeletionError) throw error;
  if (error instanceof PrivacyDeletionError) {
    switch (error.code) {
      case "PRIVACY_DELETION_CONFLICT":
        throw new WebPrivacyDeletionError("conflict");
      case "PRIVACY_DELETION_INVALID":
        throw new WebPrivacyDeletionError("invalid");
      case "PRIVACY_DELETION_RATE_LIMITED":
        throw new WebPrivacyDeletionError("rate_limited", error.retryAfterSeconds);
      case "PRIVACY_DELETION_RECENT_AUTH_REQUIRED":
        throw new WebPrivacyDeletionError("recent_auth_required");
      case "PRIVACY_DELETION_SESSION_UNAVAILABLE":
        throw new WebPrivacyDeletionError("session_unavailable");
      case "PRIVACY_DELETION_UNAVAILABLE":
        throw new WebPrivacyDeletionError("unavailable");
    }
  }
  throw new WebPrivacyDeletionError("unavailable");
};

export const requestWebPrivacyDeletion = async (input: {
  idempotencyKey: string;
  scope: PrivacyDeletionScope;
  sessionToken: string | undefined;
}): Promise<PrivacyDeletionResult> => {
  if (input.sessionToken === undefined) {
    throw new WebPrivacyDeletionError("session_unavailable");
  }
  try {
    return await loadPersistence().request({
      idempotencyKey: input.idempotencyKey,
      scope: input.scope,
      sessionToken: input.sessionToken,
    });
  } catch (error) {
    return mapError(error);
  }
};
