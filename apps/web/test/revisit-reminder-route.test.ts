import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  revisitReminderChannel,
  revisitReminderFrequency,
  revisitReminderNoticeVersion,
  revisitReminderSchemaVersion,
} from "@rituvia/domain";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class WebError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  }
  return { get: vi.fn(), list: vi.fn(), mutate: vi.fn(), WebError };
});

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/revisit-reminder", () => ({
  getWebRevisitReminder: harness.get,
  listWebRevisitReminders: harness.list,
  mutateWebRevisitReminder: harness.mutate,
  WebRevisitReminderError: harness.WebError,
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { GET, POST } from "../app/api/v1/revisits/[revisitId]/reminder/route";
import { GET as GET_COLLECTION } from "../app/api/v1/me/revisit-reminders/route";

const revisitId = "12345678-1234-4123-8123-123456789abc";
const sessionToken = "s".repeat(43);
const context = { params: Promise.resolve({ revisitId }) };
const reminder = {
  channel: revisitReminderChannel,
  deliveryState: "pending",
  frequency: revisitReminderFrequency,
  locale: "en",
  noticeVersion: revisitReminderNoticeVersion,
  preferenceState: "subscribed",
  recordedAt: "2026-07-25T10:00:00.000Z",
  revisitId,
  schemaVersion: revisitReminderSchemaVersion,
} as const;
const body = {
  action: "subscribe",
  channel: revisitReminderChannel,
  frequency: revisitReminderFrequency,
  noticeVersion: revisitReminderNoticeVersion,
  schemaVersion: revisitReminderSchemaVersion,
} as const;

const mutationRequest = (headers: Record<string, string> = {}): NextRequest => {
  const source = JSON.stringify(body);
  return new NextRequest(`https://example.test/api/v1/revisits/${revisitId}/reminder`, {
    body: source,
    headers: {
      "content-length": String(source.length),
      "content-type": "application/json",
      cookie: `__Host-rituvia-account-session=${sessionToken}`,
      "idempotency-key": "i".repeat(22),
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      "x-csrf-token": deriveSessionCsrfToken(sessionToken),
      ...headers,
    },
    method: "POST",
  });
};

describe("Revisit reminder route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns private account-owned reminder state", async () => {
    harness.get.mockResolvedValue(reminder);
    const response = await GET(
      new NextRequest(`https://example.test/api/v1/revisits/${revisitId}/reminder`, {
        headers: { cookie: `__Host-rituvia-account-session=${sessionToken}` },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ reminder, schemaVersion: 1 });
    expect(harness.get).toHaveBeenCalledWith({ revisitId, sessionToken });
  });

  it("returns the bounded account reminder collection without N+1 resource reads", async () => {
    harness.list.mockResolvedValue([reminder]);
    const response = await GET_COLLECTION(
      new NextRequest("https://example.test/api/v1/me/revisit-reminders", {
        headers: { cookie: `__Host-rituvia-account-session=${sessionToken}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      accountAvailable: true,
      reminders: [reminder],
      schemaVersion: 1,
    });
    expect(harness.list).toHaveBeenCalledWith(sessionToken);
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("returns an anonymous-safe empty collection without a noisy authorization response", async () => {
    harness.list.mockRejectedValue(new harness.WebError("session_unavailable"));
    const response = await GET_COLLECTION(
      new NextRequest("https://example.test/api/v1/me/revisit-reminders"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accountAvailable: false,
      reminders: [],
      schemaVersion: 1,
    });
  });

  it("passes exact session, resource, body, and idempotency evidence", async () => {
    harness.mutate.mockResolvedValue(reminder);
    const response = await POST(mutationRequest(), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reminder, schemaVersion: 1 });
    expect(harness.mutate).toHaveBeenCalledWith({
      idempotencyKey: "i".repeat(22),
      request: body,
      revisitId,
      sessionToken,
    });
  });

  it.each([
    { origin: "https://foreign.test" },
    { "sec-fetch-site": "cross-site" },
    { "x-csrf-token": "invalid" },
  ])("rejects untrusted mutation evidence before the service", async (headers) => {
    const response = await POST(mutationRequest(headers), context);
    expect(response.status).toBe(403);
    expect(harness.mutate).not.toHaveBeenCalled();
  });

  it("maps private errors without reflecting identifiers", async () => {
    const cases = [
      ["session_unavailable", 401, "ACCOUNT_SESSION_UNAVAILABLE"],
      ["invalid", 400, "REVISIT_REMINDER_INPUT_INVALID"],
      ["not_found", 404, "REVISIT_REMINDER_NOT_FOUND"],
      ["conflict", 409, "REVISIT_REMINDER_CONFLICT"],
      ["unavailable", 503, "REVISIT_REMINDER_UNAVAILABLE"],
    ] as const;
    for (const [code, status, responseCode] of cases) {
      harness.mutate.mockRejectedValueOnce(new harness.WebError(code));
      const response = await POST(mutationRequest(), context);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code: responseCode, status });
    }
  });
});
