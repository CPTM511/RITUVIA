import { describe, expect, it } from "vitest";

import {
  allowsConsentPurpose,
  AnonymousIdentityError,
  createConsentRecord,
  parseConsentNoticeVersion,
  parseConsentPurpose,
  parsePersistedAnonymousSessionV1,
  parseUtcInstant,
  requireActiveAnonymousSession,
  resolveAnonymousSessionState,
  serializePersistedAnonymousSessionV1,
} from "../src/index.js";

const persisted = () =>
  parsePersistedAnonymousSessionV1({
    createdAt: "2026-07-17T00:00:00.000Z",
    end: null,
    expiresAt: "2026-07-18T00:00:00.000Z",
    expiryPolicyVersion: "test.anonymous-session.v1",
    lastSeenAt: "2026-07-17T01:00:00.000Z",
    schemaVersion: 1,
    sessionId: "bda5656b-5707-4c1a-8265-08699ec9c406",
    subjectId: "bd31fbf3-a69d-4c1d-908d-359fc7c263ce",
    tokenDigest: "a".repeat(64),
  });

describe("anonymous identity values and serialization", () => {
  it("round-trips one deeply immutable v1 session without a bearer-token field", () => {
    const session = persisted();

    expect(serializePersistedAnonymousSessionV1(session)).toEqual(session);
    expect(Object.keys(session)).not.toContain("token");
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.end)).toBe(true);
  });

  it.each([
    { ...persisted(), extra: "field" },
    { ...persisted(), subjectId: "not-a-uuid" },
    { ...persisted(), sessionId: "bda5656b-5707-1c1a-8265-08699ec9c406" },
    { ...persisted(), tokenDigest: "A".repeat(64) },
    { ...persisted(), createdAt: "2026-07-17T00:00:00Z" },
    { ...persisted(), expiresAt: "2026-07-17T00:00:00.000Z" },
    { ...persisted(), lastSeenAt: "2026-07-18T00:00:00.001Z" },
  ])("rejects invalid persisted identity input without reflecting it", (candidate) => {
    const canary = "private-identity-canary";
    expect(() => parsePersistedAnonymousSessionV1({ ...candidate, canary })).toThrow(
      AnonymousIdentityError,
    );
    try {
      parsePersistedAnonymousSessionV1({ ...candidate, canary });
    } catch (error) {
      expect(String(error)).not.toContain(canary);
      expect(JSON.stringify(error)).not.toContain(canary);
    }
  });

  it("rejects unknown serialization versions with a stable code", () => {
    try {
      parsePersistedAnonymousSessionV1({ ...persisted(), schemaVersion: 2 });
      expect.unreachable("unknown versions must fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "IDENTITY_SERIALIZATION_VERSION_UNSUPPORTED",
      });
    }
  });
});

describe("anonymous session state", () => {
  it("expires at the exact boundary and never extends the absolute expiry", () => {
    const session = persisted();
    expect(resolveAnonymousSessionState(session, parseUtcInstant("2026-07-17T23:59:59.999Z"))).toBe(
      "active",
    );
    expect(resolveAnonymousSessionState(session, parseUtcInstant("2026-07-18T00:00:00.000Z"))).toBe(
      "expired",
    );
    expect(() =>
      requireActiveAnonymousSession(session, parseUtcInstant("2026-07-18T00:00:00.001Z")),
    ).toThrowError(expect.objectContaining({ code: "ANONYMOUS_SESSION_EXPIRED" }));
  });

  it.each(["revoked", "rotated"] as const)("keeps %s sessions terminal", (reason) => {
    const ended = parsePersistedAnonymousSessionV1({
      ...persisted(),
      end: { at: "2026-07-17T02:00:00.000Z", reason },
    });
    expect(resolveAnonymousSessionState(ended, parseUtcInstant("2026-07-17T03:00:00.000Z"))).toBe(
      reason,
    );
    expect(() =>
      requireActiveAnonymousSession(ended, parseUtcInstant("2026-07-17T03:00:00.000Z")),
    ).toThrowError(expect.objectContaining({ code: "ANONYMOUS_SESSION_ENDED" }));
  });
});

describe("purpose-scoped consent", () => {
  const purpose = parseConsentPurpose("optional_product_analytics");
  const notice = parseConsentNoticeVersion("test.analytics-notice.v1");

  it("fails closed for absent, denied, withdrawn, other-purpose, and stale-notice state", () => {
    const granted = createConsentRecord({
      decision: "granted",
      locale: "en",
      noticeVersion: notice,
      previous: null,
      purpose,
      recordedAt: "2026-07-17T00:00:00.000Z",
      sequence: 1,
      source: "first_party_consent_surface",
    });
    const withdrawn = createConsentRecord({
      ...granted,
      decision: "withdrawn",
      previous: granted,
      recordedAt: "2026-07-17T01:00:00.000Z",
      sequence: 2,
      source: "privacy_controls",
    });
    const denied = createConsentRecord({ ...granted, decision: "denied", previous: null });

    expect(allowsConsentPurpose(null, purpose, notice)).toBe(false);
    expect(allowsConsentPurpose(denied, purpose, notice)).toBe(false);
    expect(allowsConsentPurpose(withdrawn, purpose, notice)).toBe(false);
    expect(
      allowsConsentPurpose(granted, parseConsentPurpose("optional_marketing_analytics"), notice),
    ).toBe(false);
    expect(
      allowsConsentPurpose(granted, purpose, parseConsentNoticeVersion("test.analytics-notice.v2")),
    ).toBe(false);
    expect(allowsConsentPurpose(granted, purpose, notice)).toBe(true);
  });

  it("rejects withdrawal without the current grant and non-contiguous revisions", () => {
    expect(() =>
      createConsentRecord({
        decision: "withdrawn",
        locale: "en",
        noticeVersion: notice,
        previous: null,
        purpose,
        recordedAt: "2026-07-17T00:00:00.000Z",
        sequence: 1,
        source: "privacy_controls",
      }),
    ).toThrowError(expect.objectContaining({ code: "CONSENT_TRANSITION_INVALID" }));

    const denied = createConsentRecord({
      decision: "denied",
      locale: "en",
      noticeVersion: notice,
      previous: null,
      purpose,
      recordedAt: "2026-07-17T00:00:00.000Z",
      sequence: 1,
      source: "first_party_consent_surface",
    });
    expect(() =>
      createConsentRecord({
        ...denied,
        decision: "withdrawn",
        previous: denied,
        sequence: 3,
      }),
    ).toThrowError(expect.objectContaining({ code: "CONSENT_TRANSITION_INVALID" }));
  });
});
