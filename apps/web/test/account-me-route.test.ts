import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  class WebError extends Error {
    readonly code: string;
    constructor(code: string) {
      super("synthetic");
      this.code = code;
    }
  }
  return { get: vi.fn(), update: vi.fn(), WebError };
});
vi.mock("../server/account-auth", () => ({
  accountSessionCookieName: "__Host-rituvia-account-session",
}));
vi.mock("../server/account", () => ({
  getWebAccountProfile: harness.get,
  updateWebAccountProfile: harness.update,
  WebAccountError: harness.WebError,
}));
vi.mock("../config/server", () => ({
  getWebRuntimeConfiguration: () => ({ brand: { canonicalOrigin: "https://example.test" } }),
}));

import { GET, PATCH } from "../app/api/v1/me/route";

const account = {
  ageAttested: false,
  displayName: null,
  emailVerified: true,
  id: "11111111-1111-4111-8111-111111111111",
  locale: "en",
  profileVersion: 1,
  status: "active",
  timeZone: "UTC",
};

describe("current account route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the current account profile with private cache policy", async () => {
    harness.get.mockResolvedValue(account);
    const response = await GET(
      new NextRequest("https://example.test/api/v1/me", {
        headers: { cookie: "__Host-rituvia-account-session=" + "s".repeat(43) },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ ...account, schemaVersion: 1 });
    expect(harness.get).toHaveBeenCalledWith("s".repeat(43));
  });

  it("passes an exact bounded profile update and rejects foreign origin first", async () => {
    const body = JSON.stringify({
      displayName: "Rowan",
      locale: "en",
      profileVersion: 1,
      schemaVersion: 1,
      timeZone: "UTC",
    });
    harness.update.mockResolvedValue({ ...account, displayName: "Rowan", profileVersion: 2 });
    const response = await PATCH(
      new NextRequest("https://example.test/api/v1/me", {
        body,
        headers: {
          "content-length": String(body.length),
          "content-type": "application/json",
          cookie: "__Host-rituvia-account-session=" + "s".repeat(43),
          origin: "https://example.test",
          "sec-fetch-site": "same-origin",
        },
        method: "PATCH",
      }),
    );
    expect(response.status).toBe(200);
    expect(harness.update).toHaveBeenCalledWith({
      request: JSON.parse(body),
      sessionToken: "s".repeat(43),
    });

    const rejected = await PATCH(
      new NextRequest("https://example.test/api/v1/me", {
        body,
        headers: {
          "content-length": String(body.length),
          "content-type": "application/json",
          origin: "https://foreign.test",
        },
        method: "PATCH",
      }),
    );
    expect(rejected.status).toBe(403);
    expect(harness.update).toHaveBeenCalledTimes(1);
  });

  it("forwards only an explicit age attestation and rejects invalid input safely", async () => {
    const body = JSON.stringify({
      ageAttested: true,
      agePolicyVersion: "age-18.local.v1",
    });
    harness.update.mockResolvedValue({ ...account, ageAttested: true, profileVersion: 2 });
    const response = await PATCH(
      new NextRequest("https://example.test/api/v1/me", {
        body,
        headers: {
          "content-type": "application/json",
          cookie: "__Host-rituvia-account-session=" + "s".repeat(43),
          origin: "https://example.test",
          "sec-fetch-site": "same-origin",
        },
        method: "PATCH",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...account,
      ageAttested: true,
      profileVersion: 2,
      schemaVersion: 1,
    });
    expect(harness.update).toHaveBeenLastCalledWith({
      request: { ageAttested: true, agePolicyVersion: "age-18.local.v1" },
      sessionToken: "s".repeat(43),
    });

    harness.update.mockRejectedValue(new harness.WebError("invalid"));
    const invalidBody = JSON.stringify({
      ageAttested: false,
      agePolicyVersion: "age-18.local.v1",
    });
    const invalid = await PATCH(
      new NextRequest("https://example.test/api/v1/me", {
        body: invalidBody,
        headers: {
          "content-type": "application/json",
          cookie: "__Host-rituvia-account-session=" + "s".repeat(43),
          origin: "https://example.test",
          "sec-fetch-site": "same-origin",
        },
        method: "PATCH",
      }),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ code: "ACCOUNT_PROFILE_INPUT_INVALID", status: 400 });
  });
});
