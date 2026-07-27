import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("../server/astrology-runtime", () => ({
  loadWebAstrologyCalculationService: () => ({ list: harness.list }),
}));

import { accountSessionCookieName } from "../server/account-auth";
import { GET } from "../app/api/v1/readings/astrology/natal/route";
import { createAstrologyCalculationResource } from "./fixtures/astrology-natal";

const sessionToken = "A".repeat(43);

const request = (suffix = "", headers: Readonly<Record<string, string>> = {}): NextRequest =>
  new NextRequest(`https://example.test/api/v1/readings/astrology/natal${suffix}`, {
    headers: {
      cookie: `${accountSessionCookieName}=${sessionToken}`,
      ...headers,
    },
  });

describe("saved astrology natal route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the latest owner-scoped calculation with private headers", async () => {
    const resource = await createAstrologyCalculationResource();
    harness.list.mockResolvedValue([resource]);
    const response = await GET(request());
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(text).toContain(resource.id);
    expect(text).not.toContain("birthProfileId");
    expect(harness.list).toHaveBeenCalledWith({ limit: 1, sessionToken });
  });

  it("returns a typed empty response without fabricating a chart", async () => {
    harness.list.mockResolvedValue([]);
    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      item: null,
      schemaVersion: "astrology-natal-view-response.v1",
    });
  });

  it("rejects missing sessions, query input, and body metadata before lookup", async () => {
    const missing = await GET(
      new NextRequest("https://example.test/api/v1/readings/astrology/natal"),
    );
    const query = await GET(request("?birthDate=private-canary"));
    const bodyMetadata = await GET(request("", { "content-type": "application/json" }));

    expect(missing.status).toBe(401);
    expect(query.status).toBe(400);
    expect(bodyMetadata.status).toBe(400);
    expect(await query.text()).not.toContain("private-canary");
    expect(harness.list).not.toHaveBeenCalled();
  });

  it("redacts session and dependency failures", async () => {
    const sessionError = Object.assign(new Error("private-session-canary"), {
      code: "ASTROLOGY_CALCULATION_SESSION_UNAVAILABLE",
    });
    harness.list.mockRejectedValueOnce(sessionError);
    const unauthorized = await GET(request());
    harness.list.mockRejectedValueOnce(new Error("private-database-canary"));
    const unavailable = await GET(request());

    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.text()).not.toContain("private-session-canary");
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("private-database-canary");
  });
});
