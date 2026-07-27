import { parseReflectionJournalCreateRequestV1 } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class ApplicationError extends Error {
    readonly code: "conflict" | "daily_limit" | "not_found" | "session_required" | "unavailable";
    readonly retryAfterSeconds: number | undefined;
    constructor(
      code: "conflict" | "daily_limit" | "not_found" | "session_required" | "unavailable",
      retryAfterSeconds?: number,
    ) {
      super("synthetic reflection error");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return {
    ApplicationError,
    create: vi.fn(),
    get: vi.fn(),
    getV2: vi.fn(),
  };
});

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));
vi.mock("../server/reflection-loop", () => ({
  createWebJournalEntry: harness.create,
  getWebJournalEntry: harness.get,
  ReflectionLoopApplicationError: harness.ApplicationError,
}));
vi.mock("../server/ritual-journal", () => ({
  getWebJournalEntryV2: harness.getV2,
}));

import { GET } from "../app/api/v1/journal-entries/[journalEntryId]/route";
import { journalEntryApiPath, POST } from "../app/api/v1/journal-entries/route";

const token = "c".repeat(43);
const csrfToken = deriveSessionCsrfToken(token);
const idempotencyKey = "cdefghijklmnopqrstuvwx";
const intentionId = "22222222-2222-4222-8222-222222222222";
const ritualSessionId = "33333333-3333-4333-8333-333333333333";
const journalEntryId = "44444444-4444-4444-8444-444444444444";
const reflection = "I took the private small action I chose.";
const body = Object.freeze({
  intentionId,
  reflection,
  ritualSessionId,
  schemaVersion: "reflection-journal.v1",
});
const resource = Object.freeze({
  createdAt: "2026-07-18T00:10:00.000Z",
  expiresAt: "2026-08-18T00:00:00.000Z",
  id: journalEntryId,
  intentionId,
  policyVersion: "reflection-loop.en.v1",
  reflection,
  revisitAt: "2026-07-19T00:10:00.000Z",
  ritualSessionId,
  schemaVersion: "reflection-journal.v1",
});

const post = (
  rawBody: BodyInit | null = JSON.stringify(body),
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://example.test${journalEntryApiPath}`, {
    body: rawBody,
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": csrfToken,
      ...headers,
    },
    method: "POST",
  });
const get = (headers: Record<string, string> = {}) =>
  new NextRequest(`https://example.test${journalEntryApiPath}/${journalEntryId}`, {
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
const context = (id = journalEntryId) => ({ params: Promise.resolve({ journalEntryId: id }) });

describe("encrypted journal entry API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.create.mockImplementation(async (input: unknown) => {
      parseReflectionJournalCreateRequestV1(input);
      return { kind: "created", resource };
    });
    harness.get.mockResolvedValue(resource);
    harness.getV2.mockResolvedValue(null);
  });

  it("creates an owner-bound journal entry and returns a finite revisit", async () => {
    const response = await POST(post());
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(responseBody).toEqual(resource);
    expect(Date.parse(responseBody.revisitAt)).toBeGreaterThan(Date.parse(responseBody.createdAt));
    expect(harness.create).toHaveBeenCalledWith(body, idempotencyKey, token);
    expect(JSON.stringify(responseBody)).not.toMatch(
      /anonymousSubjectId|ciphertext|nonce|tag|keyVersion/iu,
    );
  });

  it("revisits only the owner's decrypted entry through the HttpOnly cookie", async () => {
    const response = await GET(get(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
    expect(harness.get).toHaveBeenCalledWith(journalEntryId, token);
  });

  it.each([
    "{",
    JSON.stringify({ ...body, reflection: "x".repeat(601) }),
    JSON.stringify({ ...body, anonymousSubjectId: "private-subject-canary" }),
    JSON.stringify({ ...body, readingId: "11111111-1111-4111-8111-111111111111" }),
  ])("rejects malformed, oversized, or authority-bearing journal bodies", async (rawBody) => {
    const response = await POST(post(rawBody));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("REFLECTION_BODY_INVALID");
    expect(text).not.toContain("private-subject-canary");
    expect(text).not.toContain(reflection);
  });

  it("does not reflect encrypted private content or internal failures", async () => {
    const canary = "private-journal-storage-canary";
    harness.create.mockRejectedValueOnce(new Error(canary));
    const response = await POST(post());
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(text).toContain("REFLECTION_UNAVAILABLE");
    expect(text).not.toContain(canary);
    expect(text).not.toContain(reflection);
    expect(text).not.toContain(token);
  });

  it("makes missing session and cross-owner revisit responses indistinguishable", async () => {
    const noCookie = await GET(get({ cookie: "" }), context());
    harness.get.mockResolvedValueOnce(null);
    const crossOwner = await GET(get(), context());

    expect(noCookie.status).toBe(404);
    expect(await noCookie.text()).toBe(await crossOwner.text());
  });

  it("rejects query-bearing private reads before resource lookup", async () => {
    const request = new NextRequest(
      `https://example.test${journalEntryApiPath}/${journalEntryId}?private=${reflection}`,
      { headers: { cookie: `__Host-rituvia-anonymous-session=${token}` } },
    );
    const response = await GET(request, context());
    const text = await response.text();

    expect(response.status).toBe(404);
    expect(text).not.toContain(reflection);
    expect(harness.get).not.toHaveBeenCalled();
  });
});
