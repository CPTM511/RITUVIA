import { describe, expect, it } from "vitest";

import { deriveSessionCsrfToken, hasValidSessionCsrfToken } from "../server/session-csrf";

const firstSession = "a".repeat(43);
const secondSession = "b".repeat(43);

describe("session CSRF", () => {
  it("derives a stable session-bound token without exposing the bearer token", () => {
    const token = deriveSessionCsrfToken(firstSession);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(token).not.toContain(firstSession);
    expect(deriveSessionCsrfToken(firstSession)).toBe(token);
    expect(deriveSessionCsrfToken(secondSession)).not.toBe(token);
  });

  it("accepts only a token bound to one presented session cookie", () => {
    const token = deriveSessionCsrfToken(firstSession);

    expect(hasValidSessionCsrfToken(token, [secondSession, firstSession])).toBe(true);
    expect(hasValidSessionCsrfToken(token, [secondSession])).toBe(false);
    expect(hasValidSessionCsrfToken(null, [firstSession])).toBe(false);
    expect(hasValidSessionCsrfToken("x".repeat(43), [firstSession])).toBe(false);
  });

  it("rejects malformed bearer material", () => {
    expect(() => deriveSessionCsrfToken("unsafe")).toThrowError(TypeError);
  });
});
