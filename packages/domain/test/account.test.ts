import { describe, expect, it } from "vitest";

import {
  AccountError,
  normalizeAccountEmail,
  parseAccountAgeAttestationV1,
  parseAccountProfileUpdateV1,
  parseAccountSessionId,
  parseAccountUtcInstant,
  parseAuthProviderKey,
  parseAuthProviderSubject,
  parseUserId,
  requireActiveAccountSession,
  resolveAccountSessionState,
} from "../src/account";

const session = Object.freeze({
  createdAt: parseAccountUtcInstant("2026-07-18T00:00:00.000Z"),
  end: null,
  expiresAt: parseAccountUtcInstant("2026-07-19T00:00:00.000Z"),
  lastSeenAt: parseAccountUtcInstant("2026-07-18T00:00:00.000Z"),
  schemaVersion: 1 as const,
  sessionId: parseAccountSessionId("22222222-2222-4222-8222-222222222222"),
  userId: parseUserId("11111111-1111-4111-8111-111111111111"),
});

describe("account domain", () => {
  it("normalizes bounded ASCII email identities without exposing permissive parsing", () => {
    expect(normalizeAccountEmail("  DEMO+One@Example.Test ")).toBe("demo+one@example.test");
    for (const value of [
      "",
      "missing-at.example",
      ".demo@example.test",
      "a..b@example.test",
      "用户@example.test",
    ]) {
      expect(() => normalizeAccountEmail(value)).toThrow(AccountError);
    }
  });

  it("accepts only bounded provider identifiers and UUIDv4 account IDs", () => {
    expect(parseAuthProviderKey("local.passwordless.v1")).toBe("local.passwordless.v1");
    expect(parseAuthProviderSubject("local.abc123")).toBe("local.abc123");
    for (const value of ["LOCAL", "local/private", "", "a".repeat(201)]) {
      expect(() => parseAuthProviderSubject(value)).toThrow(AccountError);
    }
    expect(() => parseAuthProviderKey(`a.${"b".repeat(39)}`)).toThrow(AccountError);
    expect(() => parseUserId("11111111-1111-1111-8111-111111111111")).toThrow(AccountError);
  });

  it("resolves active, expired, revoked, and rotated sessions with end-state precedence", () => {
    const activeAt = parseAccountUtcInstant("2026-07-18T12:00:00.000Z");
    const expiredAt = parseAccountUtcInstant("2026-07-20T00:00:00.000Z");
    expect(resolveAccountSessionState(session, activeAt)).toBe("active");
    expect(resolveAccountSessionState(session, expiredAt)).toBe("expired");
    expect(requireActiveAccountSession(session, activeAt)).toBe(session);
    expect(() => requireActiveAccountSession(session, expiredAt)).toThrow(
      expect.objectContaining({ code: "ACCOUNT_SESSION_EXPIRED" }),
    );

    for (const reason of ["revoked", "rotated"] as const) {
      const ended = Object.freeze({
        ...session,
        end: Object.freeze({
          at: parseAccountUtcInstant("2026-07-18T12:00:00.000Z"),
          reason,
        }),
      });
      expect(resolveAccountSessionState(ended, expiredAt)).toBe(reason);
      expect(() => requireActiveAccountSession(ended, activeAt)).toThrow(
        expect.objectContaining({ code: "ACCOUNT_SESSION_ENDED" }),
      );
    }
  });

  it("parses an exact optimistic-concurrency profile update", () => {
    expect(
      parseAccountProfileUpdateV1({
        displayName: "  Rowan  ",
        locale: "en",
        profileVersion: 2,
        schemaVersion: 1,
        timeZone: "Asia/Shanghai",
      }),
    ).toEqual({
      displayName: "Rowan",
      locale: "en",
      profileVersion: 2,
      schemaVersion: 1,
      timeZone: "Asia/Shanghai",
    });

    for (const value of [
      { displayName: "Rowan", locale: "fr", profileVersion: 1, schemaVersion: 1, timeZone: "UTC" },
      { displayName: "Rowan", locale: "en", profileVersion: 0, schemaVersion: 1, timeZone: "UTC" },
      {
        displayName: "Rowan",
        extra: true,
        locale: "en",
        profileVersion: 1,
        schemaVersion: 1,
        timeZone: "UTC",
      },
      {
        displayName: "Rowan",
        locale: "en",
        profileVersion: 1,
        schemaVersion: 1,
        timeZone: "Not/AZone",
      },
    ]) {
      expect(() => parseAccountProfileUpdateV1(value)).toThrow(AccountError);
    }
  });

  it("accepts only an explicit current 18+ attestation", () => {
    expect(
      parseAccountAgeAttestationV1({
        ageAttested: true,
        agePolicyVersion: "age-18.local.v1",
      }),
    ).toEqual({ ageAttested: true, agePolicyVersion: "age-18.local.v1" });

    for (const value of [
      { ageAttested: false, agePolicyVersion: "age-18.local.v1" },
      { ageAttested: true, agePolicyVersion: "age-18.unknown.v1" },
      { ageAttested: true },
      { ageAttested: true, agePolicyVersion: "age-18.local.v1", inferred: true },
    ]) {
      expect(() => parseAccountAgeAttestationV1(value)).toThrow(AccountError);
    }
  });
});
