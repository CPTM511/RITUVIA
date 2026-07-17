import "server-only";

import {
  AnonymousIdentityPersistenceError,
  createAnonymousIdentityService,
  type AnonymousIdentityService,
  type EnsuredAnonymousSession,
} from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";

export type WebAnonymousSessionErrorCode = "conflict" | "rate_limited" | "unavailable";

export class WebAnonymousSessionError extends Error {
  readonly code: WebAnonymousSessionErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: WebAnonymousSessionErrorCode, retryAfterSeconds?: number) {
    super("The anonymous session operation failed.");
    this.name = "WebAnonymousSessionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let anonymousIdentityService: AnonymousIdentityService | undefined;

const loadAnonymousIdentityService = (): AnonymousIdentityService => {
  if (anonymousIdentityService !== undefined) return anonymousIdentityService;
  const configuration = getWebRuntimeConfiguration();
  if (
    configuration.databaseUrl === undefined ||
    configuration.anonymousSessionPolicy === undefined
  ) {
    throw new WebAnonymousSessionError("unavailable");
  }
  anonymousIdentityService = createAnonymousIdentityService(
    loadWebDatabase(),
    configuration.anonymousSessionPolicy,
  );
  return anonymousIdentityService;
};

export const ensureWebAnonymousSession = async (input: {
  idempotencyKey: string;
  token?: string | undefined;
}): Promise<EnsuredAnonymousSession> => {
  try {
    return await loadAnonymousIdentityService().ensureSession(input);
  } catch (error) {
    if (error instanceof WebAnonymousSessionError) throw error;
    if (error instanceof AnonymousIdentityPersistenceError) {
      if (error.code === "ANONYMOUS_SESSION_RATE_LIMITED") {
        throw new WebAnonymousSessionError("rate_limited", error.retryAfterSeconds);
      }
      if (
        error.code === "ANONYMOUS_SESSION_REPLAY_REQUIRES_COOKIE" ||
        error.code === "ANONYMOUS_SESSION_IDEMPOTENCY_CONFLICT"
      ) {
        throw new WebAnonymousSessionError("conflict");
      }
    }
    throw new WebAnonymousSessionError("unavailable");
  }
};
