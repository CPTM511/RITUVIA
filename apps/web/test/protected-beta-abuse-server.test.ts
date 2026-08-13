import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class RateLimitError extends Error {
    readonly code: "rate_limited" | "session_unavailable" | "unavailable";
    readonly retryAfterSeconds: number | undefined;

    constructor(
      code: "rate_limited" | "session_unavailable" | "unavailable",
      retryAfterSeconds?: number,
    ) {
      super("synthetic rate-limit error");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { consume: vi.fn(), database: Object.freeze({ kind: "database" }), RateLimitError };
});

vi.mock("@rituvia/db", () => ({
  AnonymousSessionRateLimitError: harness.RateLimitError,
  consumeAnonymousSessionRateLimit: harness.consume,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    protectedBetaAbusePolicy: {
      protectedBetaMutation: {
        limit: 120,
        policyVersion: "test.protected-beta.v1",
        scope: "protected_beta_mutation",
        windowSeconds: 86_400,
      },
      questionIntake: {
        limit: 12,
        policyVersion: "test.protected-beta.v1",
        scope: "question_intake",
        windowSeconds: 60,
      },
    },
  }),
}));

vi.mock("../server/database", () => ({ loadWebDatabase: () => harness.database }));

import {
  admitWebProtectedBetaRequest,
  ProtectedBetaAdmissionError,
} from "../server/protected-beta-abuse";

describe("protected Beta abuse composition", () => {
  beforeEach(() => {
    harness.consume.mockReset();
    harness.consume.mockResolvedValue(undefined);
  });

  it("selects one fixed privacy-minimal scope policy", async () => {
    await admitWebProtectedBetaRequest("a".repeat(43), "question_intake");

    expect(harness.consume).toHaveBeenCalledWith(
      harness.database,
      expect.objectContaining({ limit: 12, scope: "question_intake", windowSeconds: 60 }),
      "a".repeat(43),
    );
  });

  it("maps bounded capacity and invalid sessions without exposing storage errors", async () => {
    harness.consume.mockRejectedValueOnce(new harness.RateLimitError("rate_limited", 23));
    await expect(
      admitWebProtectedBetaRequest("a".repeat(43), "protected_beta_mutation"),
    ).rejects.toEqual(expect.objectContaining({ code: "rate_limited", retryAfterSeconds: 23 }));

    harness.consume.mockRejectedValueOnce(new harness.RateLimitError("session_unavailable"));
    await expect(admitWebProtectedBetaRequest("a".repeat(43), "question_intake")).rejects.toEqual(
      expect.objectContaining({ code: "session_required" }),
    );

    harness.consume.mockRejectedValueOnce(new Error("private-database-canary"));
    await expect(
      admitWebProtectedBetaRequest("a".repeat(43), "question_intake"),
    ).rejects.toBeInstanceOf(ProtectedBetaAdmissionError);
  });
});
