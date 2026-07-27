import { parseRevisitMutationRequestV1, parseRevisitScheduleRequestV1 } from "@rituvia/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deriveSessionCsrfToken } from "../server/session-csrf";

const harness = vi.hoisted(() => {
  class ApplicationError extends Error {
    readonly code:
      | "conflict"
      | "daily_limit"
      | "entitlement_required"
      | "invalid"
      | "not_found"
      | "schedule_invalid"
      | "session_required"
      | "unavailable";
    readonly retryAfterSeconds: number | undefined;

    constructor(code: ApplicationError["code"], retryAfterSeconds?: number) {
      super("synthetic reflection error");
      this.code = code;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return {
    ApplicationError,
    get: vi.fn(),
    list: vi.fn(),
    merge: vi.fn(),
    mutate: vi.fn(),
    schedule: vi.fn(),
  };
});

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
  mergeWebAnonymousSubject: harness.merge,
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

vi.mock("../server/reflection-loop", () => ({
  ReflectionLoopApplicationError: harness.ApplicationError,
}));

vi.mock("../server/revisit", () => ({
  getWebRevisit: harness.get,
  listWebRevisits: harness.list,
  mutateWebRevisit: harness.mutate,
  scheduleWebRevisit: harness.schedule,
}));

import { DELETE, GET as GET_RESOURCE, PATCH } from "../app/api/v1/revisits/[revisitId]/route";
import { POST as COMPLETE } from "../app/api/v1/revisits/[revisitId]/complete/route";
import { GET, POST, revisitApiPath } from "../app/api/v1/revisits/route";

const token = "r".repeat(43);
const csrfToken = deriveSessionCsrfToken(token);
const idempotencyKey = "revisit_request_key_0001";
const intentionId = "11111111-1111-4111-8111-111111111111";
const revisitId = "22222222-2222-4222-8222-222222222222";
const schedule = Object.freeze({
  customDate: null,
  intentionId,
  quietHours: { endLocalTime: "08:00", startLocalTime: "22:00" },
  reminderChannel: null,
  reminderPreference: "none",
  scheduleKind: "seven_days",
  schemaVersion: "reflection-revisit.v1",
  timeZone: "Asia/Shanghai",
});
const resource = Object.freeze({
  archivedAt: null,
  completedAt: null,
  completionReflection: null,
  createdAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-08-24T00:00:00.000Z",
  id: revisitId,
  intentionId,
  intentionRevision: 2,
  intentionText: "I intend to pause before I respond.",
  isDue: false,
  outcomeTags: [],
  policyVersion: "reflection-loop.en.v1",
  quietHours: { endLocalTime: "08:00", startLocalTime: "22:00" },
  reminderChannel: null,
  reminderPreference: "none",
  revision: 1,
  scheduledLocalDate: "2026-07-31",
  scheduleKind: "seven_days",
  schemaVersion: "reflection-revisit.v1",
  smallAction: "Take three slow breaths.",
  status: "scheduled",
  timeZone: "Asia/Shanghai",
  updatedAt: "2026-07-24T00:00:00.000Z",
});

const request = (
  path: string,
  method: "DELETE" | "GET" | "PATCH" | "POST",
  body?: unknown,
  headers: Readonly<Record<string, string>> = {},
) =>
  new NextRequest(`https://example.test${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      cookie: `__Host-rituvia-anonymous-session=${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(method === "GET" ? {} : { "idempotency-key": idempotencyKey }),
      ...(method === "GET" ? {} : { origin: "https://example.test" }),
      "sec-fetch-site": "same-origin",
      ...(method === "GET" ? {} : { "x-csrf-token": csrfToken }),
      ...headers,
    },
    method,
  });

const context = (id = revisitId) => ({ params: Promise.resolve({ revisitId: id }) });

describe("private Revisit API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.schedule.mockImplementation(async (input: unknown) => {
      parseRevisitScheduleRequestV1(input);
      return { kind: "created", resource };
    });
    harness.list.mockResolvedValue([resource]);
    harness.get.mockResolvedValue(resource);
    harness.mutate.mockImplementation(async (_id: string, input: unknown) => {
      parseRevisitMutationRequestV1(input);
      return { kind: "mutated", resource };
    });
    harness.merge.mockResolvedValue("created");
  });

  it("schedules with local-date authority and no reminder channel", async () => {
    const response = await POST(request(revisitApiPath, "POST", schedule));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(body).toEqual(resource);
    expect(JSON.stringify(body)).not.toMatch(/"ciphertext"|"nonce"|"tag"|"subjectId"/iu);
    expect(harness.schedule).toHaveBeenCalledWith(schedule, idempotencyKey, token);
  });

  it("returns a bounded private list and owner-scoped resource", async () => {
    const list = await GET(request(revisitApiPath, "GET"));
    const item = await GET_RESOURCE(request(`${revisitApiPath}/${revisitId}`, "GET"), context());

    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ items: [resource] });
    expect(item.status).toBe(200);
    expect(await item.json()).toEqual(resource);
    expect(harness.list).toHaveBeenCalledWith(token);
    expect(harness.get).toHaveBeenCalledWith(revisitId, token);
  });

  it("reschedules, completes, archives, and soft deletes through strict mutations", async () => {
    const reschedule = {
      action: "reschedule",
      customDate: "2026-08-02",
      expectedRevision: 1,
      quietHours: null,
      reminderChannel: null,
      reminderPreference: "none",
      scheduleKind: "custom",
      schemaVersion: "reflection-revisit-mutation.v1",
      timeZone: "UTC",
    };
    const completion = {
      action: "complete",
      expectedRevision: 1,
      outcomeTags: ["action_taken"],
      reflection: "I took the action and noticed a grounded change.",
      schemaVersion: "reflection-revisit-mutation.v1",
    };
    expect(
      (await PATCH(request(`${revisitApiPath}/${revisitId}`, "PATCH", reschedule), context()))
        .status,
    ).toBe(200);
    expect(
      (
        await COMPLETE(
          request(`${revisitApiPath}/${revisitId}/complete`, "POST", completion),
          context(),
        )
      ).status,
    ).toBe(200);
    harness.mutate.mockResolvedValueOnce({ kind: "mutated", resource: null });
    const removed = await DELETE(
      request(`${revisitApiPath}/${revisitId}`, "DELETE", undefined, {
        "if-match": '"revision-3"',
      }),
      context(),
    );
    expect(removed.status).toBe(204);
    expect(harness.mutate).toHaveBeenLastCalledWith(
      revisitId,
      {
        action: "delete",
        expectedRevision: 3,
        schemaVersion: "reflection-revisit-mutation.v1",
      },
      idempotencyKey,
      token,
    );
  });

  it.each([
    [{ origin: "https://foreign.example" }, 403],
    [{ "sec-fetch-site": "cross-site" }, 403],
    [{ "x-csrf-token": "" }, 403],
    [{ cookie: "" }, 401],
    [{ "content-type": "text/plain" }, 400],
  ] as const)(
    "rejects unsafe schedule metadata before application code",
    async (headers, status) => {
      const response = await POST(request(revisitApiPath, "POST", schedule, headers));

      expect(response.status).toBe(status);
      expect(harness.schedule).not.toHaveBeenCalled();
    },
  );

  it("rejects authority-bearing bodies without reflecting private canaries", async () => {
    const response = await POST(
      request(revisitApiPath, "POST", {
        ...schedule,
        anonymousSubjectId: "private-owner-canary",
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("REFLECTION_BODY_INVALID");
    expect(text).not.toContain("private-owner-canary");
    expect(harness.schedule).toHaveBeenCalledTimes(1);
  });

  it("maps invalid schedules to a safe 422 response", async () => {
    harness.schedule.mockRejectedValueOnce(new harness.ApplicationError("schedule_invalid"));
    const response = await POST(request(revisitApiPath, "POST", schedule));
    const text = await response.text();

    expect(response.status).toBe(422);
    expect(text).toContain("REFLECTION_SCHEDULE_INVALID");
    expect(text).not.toContain(resource.intentionText);
  });

  it("makes missing sessions and cross-owner resources indistinguishable", async () => {
    const noSession = await GET_RESOURCE(
      request(`${revisitApiPath}/${revisitId}`, "GET", undefined, { cookie: "" }),
      context(),
    );
    harness.get.mockResolvedValueOnce(null);
    const crossOwner = await GET_RESOURCE(
      request(`${revisitApiPath}/${revisitId}`, "GET"),
      context(),
    );

    expect(noSession.status).toBe(404);
    expect(await noSession.text()).toBe(await crossOwner.text());
  });

  it("rejects query-bearing and framework private reads before lookup", async () => {
    const query = await GET(
      new NextRequest(`https://example.test${revisitApiPath}?private=canary`, {
        headers: { cookie: `__Host-rituvia-anonymous-session=${token}` },
      }),
    );
    const rsc = await GET(
      request(revisitApiPath, "GET", undefined, {
        accept: "text/x-component",
        rsc: "1",
      }),
    );

    expect(query.status).toBe(404);
    expect(rsc.status).toBe(404);
    expect(harness.list).not.toHaveBeenCalled();
  });
});
