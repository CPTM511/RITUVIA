import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  restore: vi.fn(),
}));

vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({
    brand: { canonicalOrigin: "https://example.test" },
  }),
}));

vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));

vi.mock("../server/commerce", () => {
  class WebCommerceError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic commerce error");
      this.code = code;
    }
  }
  return { WebCommerceError };
});

vi.mock("../server/commercial-purchases", () => ({
  loadWebCommercialPurchaseApplicationService: () => ({
    restore: harness.restore,
  }),
}));

import { GET } from "../app/api/v1/credits/route";

describe("Credit restoration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.restore.mockResolvedValue({
      credits: {
        promotional: 1,
        purchased: 6,
        reserved: 2,
        subscription: 3,
        total: 10,
        version: 4,
      },
      entitlements: [],
    });
  });

  it("returns only the private server-derived Credit projection", async () => {
    const response = await GET(
      new NextRequest("https://example.test/api/v1/credits", {
        headers: {
          cookie: `__Host-rituvia-account-session=${"a".repeat(43)}`,
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({
      promotional: 1,
      purchased: 6,
      schemaVersion: 1,
      subscription: 3,
      total: 10,
      version: 4,
    });
    expect(harness.restore).toHaveBeenCalledWith("a".repeat(43));
  });

  it("rejects cross-site and query-shaped probes before restoration", async () => {
    const crossSite = await GET(
      new NextRequest("https://example.test/api/v1/credits", {
        headers: { origin: "https://foreign.test", "sec-fetch-site": "cross-site" },
      }),
    );
    const queried = await GET(
      new NextRequest("https://example.test/api/v1/credits?user=other", {
        headers: { "sec-fetch-site": "same-origin" },
      }),
    );
    expect(crossSite.status).toBe(404);
    expect(queried.status).toBe(404);
    expect(harness.restore).not.toHaveBeenCalled();
  });
});
