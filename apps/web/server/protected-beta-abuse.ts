import "server-only";

import { AnonymousSessionRateLimitError, consumeAnonymousSessionRateLimit } from "@rituvia/db";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";

export type ProtectedBetaAdmissionKind = "protected_beta_mutation" | "question_intake";

export class ProtectedBetaAdmissionError extends Error {
  readonly code: "rate_limited" | "session_required" | "unavailable";
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: "rate_limited" | "session_required" | "unavailable",
    retryAfterSeconds?: number,
  ) {
    super("The protected Beta admission operation failed.");
    this.name = "ProtectedBetaAdmissionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const admitWebProtectedBetaRequest = async (
  token: string,
  kind: ProtectedBetaAdmissionKind,
): Promise<void> => {
  const policy = getWebRuntimeConfiguration().protectedBetaAbusePolicy;
  if (policy === undefined) throw new ProtectedBetaAdmissionError("unavailable");
  try {
    await consumeAnonymousSessionRateLimit(
      loadWebDatabase(),
      kind === "question_intake" ? policy.questionIntake : policy.protectedBetaMutation,
      token,
    );
  } catch (error) {
    if (error instanceof AnonymousSessionRateLimitError) {
      if (error.code === "rate_limited") {
        throw new ProtectedBetaAdmissionError("rate_limited", error.retryAfterSeconds);
      }
      if (error.code === "session_unavailable") {
        throw new ProtectedBetaAdmissionError("session_required");
      }
    }
    throw new ProtectedBetaAdmissionError("unavailable");
  }
};
