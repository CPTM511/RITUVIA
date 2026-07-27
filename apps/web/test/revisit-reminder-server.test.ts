import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class DatabaseError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  }
  return {
    create: vi.fn(),
    DatabaseError,
    get: vi.fn(),
    mutate: vi.fn(),
  };
});

vi.mock("@rituvia/db", () => ({
  createRevisitReminderService: harness.create.mockReturnValue({
    get: harness.get,
    mutate: harness.mutate,
  }),
  RevisitReminderError: harness.DatabaseError,
}));
vi.mock("../server/database", () => ({ loadWebDatabase: () => ({ synthetic: true }) }));

import { getWebRevisitReminder, mutateWebRevisitReminder } from "../server/revisit-reminder";

const revisitId = "12345678-1234-4123-8123-123456789abc";

describe("Web Revisit reminder service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an account session before touching persistence", async () => {
    await expect(
      getWebRevisitReminder({ revisitId, sessionToken: undefined }),
    ).rejects.toMatchObject({ code: "session_unavailable" });
    expect(harness.get).not.toHaveBeenCalled();
  });

  it("passes only exact reminder service input", async () => {
    harness.mutate.mockResolvedValue({ preferenceState: "subscribed" });
    await mutateWebRevisitReminder({
      idempotencyKey: "i".repeat(22),
      request: { action: "subscribe" },
      revisitId,
      sessionToken: "s".repeat(43),
    });
    expect(harness.mutate).toHaveBeenCalledWith({
      idempotencyKey: "i".repeat(22),
      request: { action: "subscribe" },
      revisitId,
      sessionToken: "s".repeat(43),
    });
  });

  it.each([
    ["REVISIT_REMINDER_INVALID", "invalid"],
    ["REVISIT_REMINDER_CONFLICT", "conflict"],
    ["REVISIT_REMINDER_NOT_FOUND", "not_found"],
    ["REVISIT_REMINDER_SESSION_UNAVAILABLE", "session_unavailable"],
    ["REVISIT_REMINDER_UNAVAILABLE", "unavailable"],
  ])("maps %s to %s", async (databaseCode, webCode) => {
    harness.get.mockRejectedValueOnce(new harness.DatabaseError(databaseCode));
    await expect(
      getWebRevisitReminder({ revisitId, sessionToken: "s".repeat(43) }),
    ).rejects.toEqual(expect.objectContaining({ code: webCode }));
  });
});
